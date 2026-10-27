import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { findMermaidBlocks } from "../src/rich-editor/domain/markdownBlocks.js";
import {
  findMermaidSourceLine,
  getMermaidLineReferences,
  renameMermaidTarget,
} from "../src/rich-editor/domain/mermaidIndex.js";
import {
  addFlowchartEdge,
  addFlowchartNode,
  addFlowchartSubgraph,
  detectMermaidDiagramType,
  formatFlowchartLabel,
  getFlowchartDirection,
  getFlowchartNode,
  getFlowchartNodeColor,
  getFlowchartNodeSubgraph,
  getFlowchartSubgraphs,
  getMermaidBlockContentChange,
  getMermaidErrorLine,
  moveFlowchartNodeToSubgraph,
  nextFlowchartNodeId,
  parseFlowchart,
  parseFlowchartEdgeDomId,
  parseMermaidNodeDomId,
  readMermaidBlockContent,
  removeFlowchartEdge,
  removeFlowchartNode,
  removeFlowchartSubgraph,
  renameFlowchartEdgeLabel,
  renameFlowchartNodeLabel,
  renameSequenceParticipant,
  replaceMermaidText,
  setFlowchartDirection,
  setFlowchartNodeColor,
  setFlowchartNodeShape,
  summarizeMermaidError,
} from "../src/rich-editor/domain/mermaidSource.js";

const lines = (...values) => values.join("\n");

describe("diagram type and header", () => {
  it.each([
    ["flowchart LR\n  A-->B", "flowchart"],
    ["graph TD\n  A-->B", "flowchart"],
    ["sequenceDiagram\n  A->>B: hi", "sequence"],
    ["classDiagram\n  A <|-- B", "class"],
    ["stateDiagram-v2\n  [*] --> A", "state"],
    ["erDiagram\n  A ||--o{ B : has", "er"],
    ['pie title x\n  "a" : 1', "pie"],
    ["journey\n  title x", "journey"],
    ["xychart-beta\n  x", "other"],
  ])("detects %j", (code, type) => {
    expect(detectMermaidDiagramType(code)).toBe(type);
  });

  it("skips blank lines, directives, and front matter", () => {
    expect(
      detectMermaidDiagramType(
        lines("", "---", "title: Flow", "---", "%%{init: {}}%%", "%% note", "flowchart TD"),
      ),
    ).toBe("flowchart");
  });

  it("returns null for an empty diagram", () => {
    expect(detectMermaidDiagramType("\n  \n")).toBeNull();
  });
});

describe("error lines", () => {
  it("offsets Mermaid's header-relative line by the header position", () => {
    const code = lines("", "%% c", "flowchart TD", "  A --> B", "  B -->> C[");
    expect(getMermaidErrorLine({ hash: { loc: { first_line: 3 } } }, code)).toBe(4);
  });

  it("prefers the line named in the message over Jison's token location", () => {
    const code = lines("flowchart TD", "  A --> B", "  -->> [[");
    expect(
      getMermaidErrorLine(
        { message: "Parse error on line 3:\n...", hash: { loc: { first_line: 2 } } },
        code,
      ),
    ).toBe(2);
  });

  it("skips the %% comments Mermaid strips before parsing", () => {
    // Mermaid removes whole-line comments (and blank lines right before them)
    // before numbering lines.
    const code = lines("flowchart TD", "  %% c1", "  %% c2", "  A-->B", "", "  %% c3", "  B -->");
    expect(getMermaidErrorLine({ message: "Parse error on line 3:" }, code)).toBe(6);
    expect(getMermaidErrorLine({ message: "Parse error on line 2:" }, code)).toBe(3);
  });

  it("summarizes parser errors", () => {
    expect(
      summarizeMermaidError(new Error("Parse error on line 3:\n...\nExpecting 'AMP', got 'TAGEND'")),
    ).toBe("Syntax error near TAGEND");
    expect(summarizeMermaidError(new Error("Failed to load Mermaid renderer."))).toBe(
      "Failed to load Mermaid renderer.",
    );
  });

  it("falls back to the line named in the message", () => {
    expect(
      getMermaidErrorLine(new Error("Parse error on line 2, column 9"), "pie\n x"),
    ).toBe(1);
  });

  it("returns -1 when the error has no position", () => {
    expect(getMermaidErrorLine(new Error("Failed to load"), "pie")).toBe(-1);
  });

  it("clamps to the last line", () => {
    expect(getMermaidErrorLine({ hash: { loc: { first_line: 9 } } }, "a\nb")).toBe(1);
  });
});

describe("rendered element ids", () => {
  it("parses node DOM ids with and without the render prefix", () => {
    expect(parseMermaidNodeDomId("r1-flowchart-my_node-3", "r1")).toEqual({
      kind: "flowchart",
      id: "my_node",
    });
    expect(parseMermaidNodeDomId("classId-Duck-1")).toEqual({
      kind: "classId",
      id: "Duck",
    });
    expect(parseMermaidNodeDomId("x-state-root_start-0", "x")).toEqual({
      kind: "state",
      id: "root_start",
    });
    expect(parseMermaidNodeDomId("something")).toBeNull();
  });

  it("splits edge ids against known node ids", () => {
    expect(parseFlowchartEdgeDomId("L_my_node_C_0", new Set(["my_node", "C", "my"]))).toEqual({
      from: "my_node",
      to: "C",
      occurrence: 0,
    });
    expect(parseFlowchartEdgeDomId("L_A_B_2", ["A", "B"])).toEqual({
      from: "A",
      to: "B",
      occurrence: 2,
    });
    expect(parseFlowchartEdgeDomId("L_X_Y_0", ["A"])).toBeNull();
  });
});

describe("flowchart parsing", () => {
  const code = lines(
    "flowchart LR",
    '  A[Start] -->|go| B("Next [step]")',
    "  B --> C{Decide} & D((Done)):::hot",
    "  C -. maybe .-> E[/In/]",
    "  E ==> F[(DB)]",
    "  subgraph S1 [Group]",
    "    G",
    "  end",
    "  H@{ shape: circle, label: \"Attr\" }",
    "  style A fill:#fff",
    "  weird line here",
  );
  const model = parseFlowchart(code);

  it("reads the direction", () => {
    expect(model.direction).toBe("LR");
    expect(getFlowchartDirection("graph\n A")).toBe("TD");
  });

  it("collects nodes with their labels and shapes", () => {
    expect([...model.nodes.keys()]).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(model.nodes.get("A").labeled.ref).toMatchObject({ shape: "rect", label: "Start" });
    expect(model.nodes.get("B").labeled.ref).toMatchObject({
      shape: "round",
      label: "Next [step]",
    });
    expect(model.nodes.get("D").labeled.ref.shape).toBe("circle");
    expect(model.nodes.get("E").labeled.ref.shape).toBe("parallelogram");
    expect(model.nodes.get("F").labeled.ref.shape).toBe("cylinder");
    expect(model.nodes.get("G").labeled).toBeNull();
    expect(model.nodes.get("H").labeled.ref).toMatchObject({ shape: "attrs", label: "Attr" });
  });

  it("collects edges including & groups and text links", () => {
    expect(model.edges.map((edge) => `${edge.from}>${edge.to}`)).toEqual([
      "A>B",
      "B>C",
      "B>D",
      "C>E",
      "E>F",
    ]);
    expect(model.edges[0].link).toMatchObject({ label: "go", labelKind: "pipe" });
    expect(model.edges[3].link).toMatchObject({ label: "maybe", labelKind: "inline" });
  });

  it("keeps unparseable lines out of the model", () => {
    expect(model.statements.find((statement) => statement.lineIndex === 10).kind).toBe(
      "unknown",
    );
  });

  it("splits ; separated statements", () => {
    const parsed = parseFlowchart("graph TD; A-->B; B-->C");
    expect(parsed.edges.map((edge) => edge.to)).toEqual(["B", "C"]);
  });

  it("does not read link heads as node ids", () => {
    const parsed = parseFlowchart("graph TD\n  A---B\n  B--oC\n  C-.->D\n  D~~~E");
    expect([...parsed.nodes.keys()]).toEqual(["A", "B", "C", "D", "E"]);
  });
});

describe("flowchart edits", () => {
  const base = lines("flowchart TD", "    A[Start] --> B", "    B --> C(Old)");

  it("renames a labeled node in place", () => {
    expect(renameFlowchartNodeLabel(base, "C", "New")).toBe(
      lines("flowchart TD", "    A[Start] --> B", "    B --> C(New)"),
    );
  });

  it("adds a label to a bare node", () => {
    expect(renameFlowchartNodeLabel(base, "B", "Middle")).toBe(
      lines("flowchart TD", "    A[Start] --> B[Middle]", "    B --> C(Old)"),
    );
  });

  it("quotes labels Mermaid would misread", () => {
    expect(formatFlowchartLabel("a (b)")).toBe('"a (b)"');
    expect(formatFlowchartLabel('say "hi"')).toBe("say 'hi'");
    expect(formatFlowchartLabel("plain text")).toBe("plain text");
    expect(renameFlowchartNodeLabel(base, "A", "x|y")).toContain('A["x|y"]');
  });

  it("renames an attribute-style label", () => {
    expect(renameFlowchartNodeLabel('graph TD\n  H@{ shape: circle, label: "a" }', "H", "b")).toBe(
      'graph TD\n  H@{ shape: circle, label: "b" }',
    );
  });

  it("ignores an empty label", () => {
    expect(renameFlowchartNodeLabel(base, "A", "  ")).toBe(base);
  });

  it("changes a node shape and keeps its label", () => {
    expect(setFlowchartNodeShape(base, "C", "rhombus")).toContain("C{Old}");
    expect(setFlowchartNodeShape(base, "B", "circle")).toContain("B((B))");
    expect(getFlowchartNode(setFlowchartNodeShape(base, "C", "stadium"), "C")).toMatchObject({
      shape: "stadium",
      label: "Old",
    });
  });

  it("sets, replaces, and clears node colors", () => {
    const colored = setFlowchartNodeColor(base, "A", "green");
    expect(colored.split("\n").at(-1)).toBe(
      "    style A fill:#dcfce7,stroke:#16a34a,color:#172033",
    );
    expect(getFlowchartNodeColor(colored, "A")).toBe("green");
    const recolored = setFlowchartNodeColor(colored, "A", "red");
    expect(recolored.match(/style A/g)).toHaveLength(1);
    expect(getFlowchartNodeColor(recolored, "A")).toBe("red");
    expect(setFlowchartNodeColor(recolored, "A", null)).toBe(base);
  });

  it("adds a node, optionally connected, before trailing style lines", () => {
    const styled = `${base}\n    style A fill:#fff`;
    const { code, id } = addFlowchartNode(styled, { label: "Next", from: "C" });
    expect(id).toBe("N1");
    expect(code).toBe(
      lines(
        "flowchart TD",
        "    A[Start] --> B",
        "    B --> C(Old)",
        "    C --> N1[Next]",
        "    style A fill:#fff",
      ),
    );
    expect(nextFlowchartNodeId(code)).toBe("N2");
  });

  it("adds new nodes after a top-level subgraph, not inside it", () => {
    const code = lines("graph TD", "  subgraph S", "    A", "  end");
    expect(addFlowchartNode(code, { label: "X" }).code).toBe(
      lines("graph TD", "  subgraph S", "    A", "  end", "    N1[X]"),
    );
  });

  it("adds an edge once", () => {
    const code = addFlowchartEdge(base, "A", "C");
    expect(code.split("\n").at(-1)).toBe("    A --> C");
    expect(addFlowchartEdge(code, "A", "C")).toBe(code);
    expect(addFlowchartEdge(base, "A", "Z")).toBe(base);
    expect(addFlowchartEdge(base, "C", "A", "back").split("\n").at(-1)).toBe(
      "    C -->|back| A",
    );
  });

  it("renames, adds, and removes edge labels", () => {
    const labeled = renameFlowchartEdgeLabel(base, "A", "B", "go");
    expect(labeled).toContain("A[Start] -->|go| B");
    expect(renameFlowchartEdgeLabel(labeled, "A", "B", "stop")).toContain("-->|stop| B");
    expect(renameFlowchartEdgeLabel(labeled, "A", "B", "")).toBe(base);
    const inline = "graph TD\n  A -- old --> B";
    expect(renameFlowchartEdgeLabel(inline, "A", "B", "new")).toBe(
      "graph TD\n  A -- new --> B",
    );
    expect(renameFlowchartEdgeLabel(inline, "A", "B", "")).toBe("graph TD\n  A --> B");
  });

  it("removes a node with its edges, styles, and class assignments", () => {
    const code = lines(
      "graph TD",
      "  A[Start] --> B[Mid] --> C[End]",
      "  B --> D",
      "  style B fill:#fff",
      "  class A,B hot",
      "  class B cold",
    );
    expect(removeFlowchartNode(code, "B")).toBe(
      lines("graph TD", "  A[Start]", "  C[End]", "  D", "  class A hot"),
    );
  });

  it("removes one node from an & group", () => {
    expect(removeFlowchartNode("graph TD\n  A --> B & C", "B")).toBe("graph TD\n  A --> C");
  });

  it("removes an edge and splits the chain", () => {
    const code = "graph TD\n  A --> B --> C";
    expect(removeFlowchartEdge(code, "A", "B")).toBe("graph TD\n  A\n  B --> C");
    expect(removeFlowchartEdge("graph TD\n  A[a] --> B\n  B --> A", "A", "B")).toBe(
      "graph TD\n  A[a]\n  B --> A",
    );
  });

  it("removes one pair from a fan-out", () => {
    expect(removeFlowchartEdge("graph TD\n  A --> B & C", "A", "B")).toBe(
      "graph TD\n  A --> C\n  B",
    );
  });

  it("rewrites the direction", () => {
    expect(setFlowchartDirection(base, "LR").split("\n")[0]).toBe("flowchart LR");
    expect(setFlowchartDirection("graph\n  A", "RL").split("\n")[0]).toBe("graph RL");
    expect(setFlowchartDirection(base, "bogus")).toBe(base);
  });
});

describe("source navigation", () => {
  const flow = lines("flowchart TD", "  A --> B", "  B[Label B] --> C", "  C -->|x| A");

  it("finds a flowchart node's defining line", () => {
    expect(findMermaidSourceLine(flow, { kind: "node", id: "B" })).toBe(2);
    expect(findMermaidSourceLine(flow, { kind: "node", id: "A" })).toBe(1);
  });

  it("finds a flowchart edge line", () => {
    expect(findMermaidSourceLine(flow, { kind: "edge", from: "C", to: "A" })).toBe(3);
  });

  it("finds sequence participants by declaration and text by content", () => {
    const seq = lines("sequenceDiagram", "  A->>B: hi", "  participant B as Bob");
    expect(findMermaidSourceLine(seq, { kind: "node", id: "B" })).toBe(2);
    expect(findMermaidSourceLine(seq, { kind: "text", text: "hi" })).toBe(1);
    expect(findMermaidSourceLine(seq, { kind: "text", text: "nope" })).toBe(-1);
  });

  it("lists the nodes a flowchart line draws", () => {
    expect([...getMermaidLineReferences(flow, 2).ids]).toEqual(["B", "C"]);
    expect(getMermaidLineReferences(flow, 0).ids.size).toBe(0);
  });

  it("lists the names a sequence line mentions", () => {
    const seq = lines("sequenceDiagram", "  participant A as Alice", "  A->>Bob: Hello there");
    const declaration = getMermaidLineReferences(seq, 1);
    expect(declaration.ids.has("A")).toBe(true);
    expect(declaration.texts.has("Alice")).toBe(true);
    const message = getMermaidLineReferences(seq, 2);
    expect([...message.ids]).toEqual(["A", "Bob"]);
  });
});

describe("label edits outside flowcharts", () => {
  it("renames identifiers everywhere", () => {
    expect(replaceMermaidText("classDiagram\n  Animal <|-- Duck\n  class Duck", "Duck", "Goose")).toBe(
      "classDiagram\n  Animal <|-- Goose\n  class Goose",
    );
  });

  it("replaces message text once", () => {
    expect(
      replaceMermaidText("sequenceDiagram\n  A->>B: Hello\n  B->>A: Hello", "Hello", "Hey"),
    ).toBe("sequenceDiagram\n  A->>B: Hey\n  B->>A: Hello");
  });

  it("replaces free text at its first occurrence", () => {
    expect(replaceMermaidText("pie title Big share\n  \"a b\" : 1", "a b", "c d")).toBe(
      'pie title Big share\n  "c d" : 1',
    );
  });

  it("aliases a participant renamed to a non-identifier", () => {
    expect(renameSequenceParticipant("sequenceDiagram\n  A->>B: hi", "A", "Alice Smith")).toBe(
      "sequenceDiagram\n  participant A as Alice Smith\n  A->>B: hi",
    );
    expect(
      renameSequenceParticipant("sequenceDiagram\n  participant A as Al\n  A->>B: hi", "A", "Alice"),
    ).toBe("sequenceDiagram\n  participant A as Alice\n  A->>B: hi");
    expect(renameSequenceParticipant("sequenceDiagram\n  A->>B: hi", "B", "Bob")).toBe(
      "sequenceDiagram\n  A->>Bob: hi",
    );
  });

  it("routes renames by diagram type", () => {
    expect(
      renameMermaidTarget("graph TD\n  A[x] --> B", { kind: "edge", from: "A", to: "B" }, "go"),
    ).toBe("graph TD\n  A[x] -->|go| B");
    expect(
      renameMermaidTarget("erDiagram\n  A ||--o{ B : has", { kind: "text", text: "has" }, "owns"),
    ).toBe("erDiagram\n  A ||--o{ B : owns");
  });
});

describe("block content", () => {
  it("reads and rewrites only the diagram text", () => {
    const doc = Text.of(["# T", "```mermaid", "graph TD", "  A-->B", "```"]);
    const [block] = findMermaidBlocks(doc);
    const code = readMermaidBlockContent(doc, block);
    expect(code).toBe("graph TD\n  A-->B");
    expect(getMermaidBlockContentChange(block, code, code)).toBeNull();
    const change = getMermaidBlockContentChange(block, code, "graph TD\n  A-->C");
    expect(doc.replace(change.from, change.to, Text.of([change.insert])).toString()).toBe(
      "# T\n```mermaid\ngraph TD\n  A-->C\n```",
    );
  });

  it("adds a content line to an empty block", () => {
    const doc = Text.of(["```mermaid", "```"]);
    const [block] = findMermaidBlocks(doc);
    expect(readMermaidBlockContent(doc, block)).toBe("");
    const change = getMermaidBlockContentChange(block, "", "pie");
    expect(
      doc.replace(change.from, change.to, Text.of(change.insert.split("\n"))).toString(),
    ).toBe("```mermaid\npie\n```");
  });
});

describe("flowchart subgraphs", () => {
  const code = lines(
    "flowchart TD",
    "    A[Start] --> B",
    "    subgraph S1 [Backend]",
    "        C[(DB)] --> D",
    "        subgraph inner",
    "            E",
    "        end",
    "    end",
    "    subgraph Two words",
    "        F",
    "    end",
  );

  it("lists blocks with Mermaid's ids, titles, and nesting", () => {
    expect(
      getFlowchartSubgraphs(code).map(({ id, title, parent, depth, lineIndex, endLine }) => ({
        id,
        title,
        parent,
        depth,
        lineIndex,
        endLine,
      })),
    ).toEqual([
      { id: "S1", title: "Backend", parent: null, depth: 0, lineIndex: 2, endLine: 7 },
      { id: "inner", title: "inner", parent: "S1", depth: 1, lineIndex: 4, endLine: 6 },
      // Untitled ids count blocks in closing order: inner, S1, then this one.
      { id: "subGraph2", title: "Two words", parent: null, depth: 0, lineIndex: 8, endLine: 10 },
    ]);
  });

  it("finds the subgraph a node is drawn in", () => {
    expect(getFlowchartNodeSubgraph(code, "A")).toBeNull();
    expect(getFlowchartNodeSubgraph(code, "C")).toBe("S1");
    expect(getFlowchartNodeSubgraph(code, "E")).toBe("inner");
    // The block that closes first claims a node mentioned in two blocks.
    const twice = lines("graph TD", "  subgraph X", "    A", "  end", "  subgraph Y", "    A", "  end");
    expect(getFlowchartNodeSubgraph(twice, "A")).toBe("X");
  });

  it("wraps a top-level node in a new subgraph", () => {
    const result = addFlowchartSubgraph(lines("flowchart TD", "    A[Start] --> B"), { nodeId: "B" });
    expect(result).toMatchObject({ id: "S1", nodeId: "B" });
    expect(result.code).toBe(
      lines("flowchart TD", "    A[Start] --> B", "    subgraph S1 [Group]", "        B", "    end"),
    );
  });

  it("adds a subgraph with a first node, nested in the selected one", () => {
    const top = addFlowchartSubgraph(lines("flowchart TD", "    A"));
    expect(top.code).toBe(
      lines("flowchart TD", "    A", "    subgraph S1 [Group]", "        N1[New node]", "    end"),
    );
    const nested = addFlowchartSubgraph(top.code, { parent: "S1", title: "Inner: part" });
    expect(nested.id).toBe("S2");
    expect(nested.code).toBe(
      lines(
        "flowchart TD",
        "    A",
        "    subgraph S1 [Group]",
        "        N1[New node]",
        '        subgraph S2 ["Inner: part"]',
        "            N2[New node]",
        "        end",
        "    end",
      ),
    );
  });

  it("moves a node between subgraphs, keeping its label and the other nodes' places", () => {
    const moved = moveFlowchartNodeToSubgraph(code, "C", "subGraph2");
    expect(moved).toBe(
      lines(
        "flowchart TD",
        "    A[Start] --> B",
        "    subgraph S1 [Backend]",
        "        D",
        "        subgraph inner",
        "            E",
        "        end",
        "    end",
        "    subgraph Two words",
        "        F",
        "        C",
        "    end",
        "    C[(DB)] --> D",
      ),
    );
    expect(getFlowchartNodeSubgraph(moved, "C")).toBe("subGraph2");
    expect(getFlowchartNodeSubgraph(moved, "D")).toBe("S1");
  });

  it("moves a defining mention with its shape, and out to the top level", () => {
    const code2 = lines("graph TD", "  subgraph X", "    A[Label] & B", "  end", "  subgraph Y", "    C", "  end");
    const intoY = moveFlowchartNodeToSubgraph(code2, "A", "Y");
    expect(intoY).toBe(
      lines("graph TD", "  subgraph X", "    B", "  end", "  subgraph Y", "    C", "    A[Label]", "  end"),
    );
    expect(moveFlowchartNodeToSubgraph(intoY, "C", null)).toBe(
      lines("graph TD", "  subgraph X", "    B", "  end", "  subgraph Y", "    A[Label]", "  end", "    C"),
    );
  });

  it("moves a node out of a nested block into its parent", () => {
    const moved = moveFlowchartNodeToSubgraph(code, "E", "S1");
    expect(getFlowchartNodeSubgraph(moved, "E")).toBe("S1");
    expect(moved).toContain(lines("        subgraph inner", "        end", "        E", "    end"));
  });

  it("leaves the code alone for unknown nodes or targets", () => {
    expect(moveFlowchartNodeToSubgraph(code, "Z", "S1")).toBe(code);
    expect(moveFlowchartNodeToSubgraph(code, "A", "nope")).toBe(code);
    expect(moveFlowchartNodeToSubgraph(code, "inner", "S1")).toBe(code);
  });

  it("removes a subgraph but keeps its contents and drops references to it", () => {
    const withRefs = lines(
      "flowchart LR",
      "    A --> S1",
      "    subgraph S1 [Group]",
      "        direction TB",
      "        B --> C",
      "    end",
      "    style S1 fill:#fff",
    );
    expect(removeFlowchartSubgraph(withRefs, "S1")).toBe(
      lines("flowchart LR", "    A", "    B --> C"),
    );
    expect(removeFlowchartSubgraph(code, "inner")).toContain(
      lines("        C[(DB)] --> D", "        E", "    end"),
    );
    expect(removeFlowchartSubgraph(code, "missing")).toBe(code);
  });

  it("adds nodes inside a subgraph and connects or colors subgraphs", () => {
    expect(addFlowchartNode(code, { from: "C", subgraph: "S1" }).code).toContain(
      lines("        end", "        C --> N1[New node]", "    end"),
    );
    expect(addFlowchartEdge(code, "A", "S1").split("\n")).toContain("    A --> S1");
    const colored = setFlowchartNodeColor(code, "S1", "green");
    expect(colored.split("\n").at(-1)).toBe("    style S1 fill:#dcfce7,stroke:#16a34a,color:#172033");
    expect(getFlowchartNodeColor(colored, "S1")).toBe("green");
  });

  it("renames subgraph titles without touching their ids", () => {
    const target = (id) => ({ kind: "subgraph", id, keys: [`subgraph:${id}`] });
    expect(renameMermaidTarget(code, target("S1"), "Server")).toContain("subgraph S1 [Server]");
    expect(renameMermaidTarget(code, target("inner"), "Core db")).toContain(
      "subgraph inner [Core db]",
    );
    expect(renameMermaidTarget(code, target("subGraph2"), "Other")).toContain("subgraph Other");
    expect(findMermaidSourceLine(code, target("inner"))).toBe(4);
  });
});
