import { describe, expect, it } from "vitest";

import {
  addClass,
  addClassMember,
  addErAttribute,
  addErEntity,
  addMindmapChild,
  addMindmapSibling,
  addSequenceMessage,
  addSequenceNote,
  addSequenceParticipant,
  addState,
  addStateNote,
  classifySequenceLine,
  connectClasses,
  connectErEntities,
  connectStates,
  getClassRelation,
  getErRelation,
  getMindmapNodes,
  getSequenceParticipants,
  getStateDirection,
  hasSequenceAutonumber,
  moveMindmapNode,
  moveSequenceParticipant,
  removeClass,
  removeErEntity,
  removeMindmapNode,
  removeSequenceLine,
  removeSequenceParticipant,
  removeState,
  removeStateLine,
  reverseSequenceMessage,
  setClassRelationArrow,
  setErRelation,
  setMindmapShape,
  setSequenceMessageArrow,
  setStateDirection,
  toggleSequenceAutonumber,
  wrapSequenceStatement,
} from "../src/rich-editor/domain/mermaidEdits.js";
import {
  getMermaidTableSpec,
  insertMermaidTableRow,
  moveMermaidTableRow,
  readMermaidTable,
  removeMermaidTableRow,
  updateMermaidTableRow,
} from "../src/rich-editor/domain/mermaidTables.js";

const lines = (...values) => values.join("\n");

describe("sequence edits", () => {
  const code = lines(
    "sequenceDiagram",
    "    participant A as Alice",
    "    A->>B: Hello",
    "    loop Every min",
    "        B-->>A: Hi",
    "    end",
  );

  it("lists participants in drawing order", () => {
    expect(getSequenceParticipants(code).map((participant) => [participant.id, participant.label, participant.declarationLine])).toEqual([
      ["A", "Alice", 1],
      ["B", "B", -1],
    ]);
  });

  it("classifies statements", () => {
    expect(code.split("\n").map(classifySequenceLine)).toEqual([
      null,
      "participant",
      "message",
      "block",
      "message",
      "end",
    ]);
  });

  it("adds participants after the declarations", () => {
    expect(addSequenceParticipant(code, "Carol")).toMatchObject({ id: "Carol", lineIndex: 2 });
    expect(addSequenceParticipant(code, "Carol").code.split("\n")[2]).toBe("    participant Carol");
    expect(addSequenceParticipant(code, "Web server").code.split("\n")[2]).toBe(
      "    participant P1 as Web server",
    );
  });

  it("adds messages after a statement, inside blocks when it opens one", () => {
    const after = addSequenceMessage(code, { from: "A", to: "B", afterLine: 2 });
    expect(after.code.split("\n")[3]).toBe("    A->>B: Message");
    const inside = addSequenceMessage(code, { from: "B", to: "A", afterLine: 3, arrow: "-->>" });
    expect(inside.code.split("\n")[4]).toBe("      B-->>A: Message");
    expect(addSequenceMessage(code, { from: "A", to: "B" }).lineIndex).toBe(6);
  });

  it("changes arrows and reverses messages", () => {
    expect(setSequenceMessageArrow(code, 2, "-x").split("\n")[2]).toBe("    A-xB: Hello");
    expect(reverseSequenceMessage(code, 2).split("\n")[2]).toBe("    B->>A: Hello");
  });

  it("adds notes beside or over participants", () => {
    expect(addSequenceNote(code, ["A"], { afterLine: 2 }).code.split("\n")[3]).toBe("    Note right of A: Note");
    expect(addSequenceNote(code, ["A", "B"]).code.split("\n").at(-1)).toBe("    Note over A,B: Note");
  });

  it("wraps statements and blocks", () => {
    expect(wrapSequenceStatement(code, 2, "opt", "maybe").code).toBe(
      lines(
        "sequenceDiagram",
        "    participant A as Alice",
        "    opt maybe",
        "      A->>B: Hello",
        "    end",
        "    loop Every min",
        "        B-->>A: Hi",
        "    end",
      ),
    );
    const wrapped = wrapSequenceStatement(code, 3, "alt", "ok").code.split("\n");
    expect(wrapped.slice(3)).toEqual(["    alt ok", "      loop Every min", "          B-->>A: Hi", "      end", "    end"]);
  });

  it("removes statements and unwraps blocks", () => {
    expect(removeSequenceLine(code, 2).split("\n")).toHaveLength(5);
    expect(removeSequenceLine(code, 3)).toBe(
      lines("sequenceDiagram", "    participant A as Alice", "    A->>B: Hello", "      B-->>A: Hi"),
    );
  });

  it("removes participants with their messages and notes", () => {
    const withNote = `${code}\n    Note over A,B: both`;
    expect(removeSequenceParticipant(withNote, "B")).toBe(
      lines("sequenceDiagram", "    participant A as Alice", "    loop Every min", "    end", "    Note over A: both"),
    );
  });

  it("reorders participants with explicit declarations", () => {
    expect(moveSequenceParticipant(code, "B", -1).split("\n").slice(0, 3)).toEqual([
      "sequenceDiagram",
      "    participant B",
      "    participant A as Alice",
    ]);
    expect(moveSequenceParticipant(code, "A", -1)).toBe(code);
  });

  it("does not reorder participants grouped in boxes", () => {
    const boxed = lines("sequenceDiagram", "    box Blue G", "    participant A", "    participant B", "    end", "    A->>B: hi");
    expect(moveSequenceParticipant(boxed, "A", 1)).toBe(boxed);
  });

  it("toggles autonumber", () => {
    const numbered = toggleSequenceAutonumber(code);
    expect(numbered.split("\n")[1]).toBe("    autonumber");
    expect(hasSequenceAutonumber(numbered)).toBe(true);
    expect(toggleSequenceAutonumber(numbered)).toBe(code);
  });
});

describe("state edits", () => {
  const code = lines(
    "stateDiagram-v2",
    "    [*] --> Idle",
    "    Idle --> Running : start",
    "    note right of Idle : waiting",
    "    state Running {",
    "        [*] --> Fast",
    "    }",
  );

  it("adds states, aliased when the label is not a single word", () => {
    expect(addState(code, { label: "Done", from: "Running" })).toMatchObject({ id: "Done" });
    expect(addState(code, { label: "Done", from: "Running" }).code.split("\n").at(-1)).toBe("    Running --> Done");
    expect(addState(code, { label: "All done" }).code.split("\n").at(-1)).toBe('    state "All done" as S1');
  });

  it("connects states once", () => {
    expect(connectStates(code, "Running", "Idle").code.split("\n").at(-1)).toBe("    Running --> Idle");
    expect(connectStates(code, "Idle", "Running")).toEqual({ code, lineIndex: 2 });
    expect(connectStates(code, "Idle", "[*]").code.split("\n").at(-1)).toBe("    Idle --> [*]");
  });

  it("removes a state with its transitions, notes, and block", () => {
    expect(removeState(code, "Running")).toBe(
      lines("stateDiagram-v2", "    [*] --> Idle", "    note right of Idle : waiting"),
    );
    expect(removeState(code, "Idle")).toBe(
      lines("stateDiagram-v2", "    state Running {", "        [*] --> Fast", "    }"),
    );
  });

  it("keeps states whose ids only contain the removed one", () => {
    const dashed = lines("stateDiagram-v2", "    A --> B", "    state A-B {", "        X --> Y", "    }", "    B --> A-B");
    expect(removeState(dashed, "A")).toBe(
      lines("stateDiagram-v2", "    state A-B {", "        X --> Y", "    }", "    B --> A-B"),
    );
  });

  it("removes multi-line notes whole", () => {
    const note = lines("stateDiagram-v2", "    note left of A", "        text", "    end note", "    A --> B");
    expect(removeStateLine(note, 1)).toBe(lines("stateDiagram-v2", "    A --> B"));
  });

  it("adds notes and sets the direction", () => {
    expect(addStateNote(code, "Running").code.split("\n").at(-1)).toBe("    note right of Running : Note");
    const directed = setStateDirection(code, "LR");
    expect(directed.split("\n")[1]).toBe("    direction LR");
    expect(getStateDirection(directed)).toBe("LR");
    expect(setStateDirection(directed, "BT").split("\n")[1]).toBe("    direction BT");
  });
});

describe("class edits", () => {
  const code = lines(
    "classDiagram",
    "    class Animal {",
    "        +String name",
    "    }",
    "    Animal <|-- Duck",
    "    Duck : +swim()",
  );

  it("adds classes and members", () => {
    expect(addClass(code)).toMatchObject({ id: "NewClass" });
    expect(addClass(code, { name: "Animal" }).id).toBe("Animal2");
    expect(addClassMember(code, "Animal", "+move()").code.split("\n")[3]).toBe("        +move()");
    expect(addClassMember(code, "Duck", "+quack()").code.split("\n").at(-1)).toBe("    Duck : +quack()");
  });

  it("connects classes and changes relation types", () => {
    expect(connectClasses(code, "Duck", "Animal", "*--").code.split("\n").at(-1)).toBe("    Duck *-- Animal");
    expect(getClassRelation(code, 4)).toMatchObject({ from: "Animal", arrow: "<|--", to: "Duck" });
    expect(setClassRelationArrow(code, 4, "..>").split("\n")[4]).toBe("    Animal ..> Duck");
  });

  it("removes a class with its body, members, and relations", () => {
    expect(removeClass(code, "Duck")).toBe(lines("classDiagram", "    class Animal {", "        +String name", "    }"));
    expect(removeClass(code, "Animal")).toBe(lines("classDiagram", "    Duck : +swim()"));
  });
});

describe("ER edits", () => {
  const code = lines(
    "erDiagram",
    "    CUSTOMER ||--o{ ORDER : places",
    "    CUSTOMER {",
    "        string name",
    "    }",
  );

  it("reads and rewrites cardinalities and identification", () => {
    expect(getErRelation(code, 1)).toMatchObject({
      from: "CUSTOMER",
      to: "ORDER",
      left: "one",
      right: "zeroOrMore",
      identifying: true,
    });
    expect(setErRelation(code, 1, { left: "zeroOrOne", right: "oneOrMore", identifying: false }).split("\n")[1]).toBe(
      "    CUSTOMER |o..|{ ORDER : places",
    );
  });

  it("adds entities, relations, and attributes", () => {
    expect(addErEntity(code).code.split("\n").slice(-3)).toEqual(["    ENTITY {", "        string id PK", "    }"]);
    expect(connectErEntities(code, "ORDER", "CUSTOMER").code.split("\n").at(-1)).toBe("    ORDER ||--o{ CUSTOMER : has");
    expect(addErAttribute(code, "CUSTOMER", "int age").code.split("\n")[4]).toBe("        int age");
    expect(addErAttribute(code, "ORDER", "int id").code.split("\n").slice(-3)).toEqual([
      "    ORDER {",
      "        int id",
      "    }",
    ]);
  });

  it("removes an entity with its block and relations", () => {
    expect(removeErEntity(code, "CUSTOMER")).toBe("erDiagram");
  });
});

describe("mindmap edits", () => {
  const code = lines("mindmap", "  root((Topic))", "    A", "      A1", "    B[Bee]");

  it("reads nodes with their subtrees and shapes", () => {
    const nodes = getMindmapNodes(code);
    expect(nodes.map((node) => [node.label, node.shape, node.endLine])).toEqual([
      ["Topic", "circle", 4],
      ["A", "default", 3],
      ["A1", "default", 3],
      ["Bee", "square", 4],
    ]);
  });

  it("adds children and siblings after the subtree", () => {
    expect(addMindmapChild(code, 1, "A2")).toEqual({
      code: lines("mindmap", "  root((Topic))", "    A", "      A1", "      A2", "    B[Bee]"),
      index: 3,
    });
    expect(addMindmapSibling(code, 1, "C").code.split("\n")[4]).toBe("    C");
    expect(addMindmapChild(code, 3, "Hive").code.split("\n").at(-1)).toBe("      Hive");
  });

  it("removes and moves subtrees", () => {
    expect(removeMindmapNode(code, 1)).toBe(lines("mindmap", "  root((Topic))", "    B[Bee]"));
    expect(removeMindmapNode(code, 0)).toBe(code);
    expect(moveMindmapNode(code, 3, -1)).toEqual({
      code: lines("mindmap", "  root((Topic))", "    B[Bee]", "    A", "      A1"),
      index: 1,
    });
  });

  it("changes node shapes", () => {
    expect(setMindmapShape(code, 1, "hexagon").split("\n")[2]).toBe("    n1{{A}}");
    expect(setMindmapShape(code, 3, "default").split("\n")[4]).toBe("    Bee");
    expect(setMindmapShape(code, 3, "rounded").split("\n")[4]).toBe("    B(Bee)");
  });
});

describe("table views", () => {
  it("edits pie slices", () => {
    const code = lines("pie title Pets", '    "Dogs" : 386', '    "Cats" : 85');
    const spec = getMermaidTableSpec(code);
    expect(readMermaidTable(code, spec).map((row) => row.cells)).toEqual([["Dogs", "386"], ["Cats", "85"]]);
    expect(updateMermaidTableRow(code, spec, 2, ['Big "cats"', "90"]).split("\n")[2]).toBe(`    "Big 'cats'" : 90`);
    const inserted = insertMermaidTableRow(code, spec);
    expect(inserted).toMatchObject({ lineIndex: 3 });
    expect(inserted.code.split("\n")[3]).toBe('    "New slice" : 10');
    expect(moveMermaidTableRow(code, spec, 2, -1)).toEqual({
      code: lines("pie title Pets", '    "Cats" : 85', '    "Dogs" : 386'),
      lineIndex: 1,
    });
    expect(removeMermaidTableRow(code, 1)).toBe(lines("pie title Pets", '    "Cats" : 85'));
  });

  it("edits gantt tasks and sections", () => {
    const code = lines(
      "gantt",
      "    title Plan",
      "    dateFormat YYYY-MM-DD",
      "    section Build",
      "    Design :a1, 2026-01-01, 5d",
      "    Implement :crit, after a1, 10d",
      "    Polish :3d",
    );
    const spec = getMermaidTableSpec(code);
    expect(readMermaidTable(code, spec).map((row) => [row.kind, ...row.cells])).toEqual([
      ["group", "Build"],
      ["row", "Design", "", "a1", "2026-01-01", "5d"],
      ["row", "Implement", "crit", "", "after a1", "10d"],
      ["row", "Polish", "", "", "", "3d"],
    ]);
    expect(updateMermaidTableRow(code, spec, 5, ["Build: it", "crit, active", "b2", "after a1", "8d"]).split("\n")[5]).toBe(
      "    Build - it :crit, active, b2, after a1, 8d",
    );
    expect(updateMermaidTableRow(code, spec, 6, ["Polish", "", "p1", "", "2d"]).split("\n")[6]).toBe("    Polish :2d");
    expect(updateMermaidTableRow(code, spec, 3, ["Ship"]).split("\n")[3]).toBe("    section Ship");
    expect(insertMermaidTableRow(code, spec, { kind: "group" }).code.split("\n").at(-1)).toBe("    section New section");
    expect(insertMermaidTableRow(code, spec, { afterLine: 4 }).code.split("\n")[5]).toBe("    New task :1d");
  });

  it("edits journey, timeline, sankey, and quadrant records", () => {
    const journey = lines("journey", "  title Day", "  section Morning", "    Make tea: 5: Me");
    const journeySpec = getMermaidTableSpec(journey);
    expect(readMermaidTable(journey, journeySpec).map((row) => row.cells)).toEqual([["Morning"], ["Make tea", "5", "Me"]]);
    expect(updateMermaidTableRow(journey, journeySpec, 3, ["Tea", "4", ""]).split("\n")[3]).toBe("    Tea: 4");

    const timeline = lines("timeline", "  title T", "  2004 : Facebook : Google", "       : Gmail");
    const timelineSpec = getMermaidTableSpec(timeline);
    expect(readMermaidTable(timeline, timelineSpec).map((row) => row.cells)).toEqual([
      ["2004", "Facebook : Google"],
      ["", "Gmail"],
    ]);
    expect(updateMermaidTableRow(timeline, timelineSpec, 2, ["2005", "YouTube:Reddit"]).split("\n")[2]).toBe(
      "  2005 : YouTube : Reddit",
    );

    const sankey = lines("sankey-beta", "Solar,Grid,60", '"Wind, offshore",Grid,40');
    const sankeySpec = getMermaidTableSpec(sankey);
    expect(readMermaidTable(sankey, sankeySpec).map((row) => row.cells)).toEqual([
      ["Solar", "Grid", "60"],
      ["Wind, offshore", "Grid", "40"],
    ]);
    expect(updateMermaidTableRow(sankey, sankeySpec, 1, ["Sun, roof", "Grid", "70"]).split("\n")[1]).toBe(
      '"Sun, roof",Grid,70',
    );

    const quadrant = lines("quadrantChart", "  x-axis Low --> High", "  Campaign A: [0.3, 0.6] radius: 10");
    const quadrantSpec = getMermaidTableSpec(quadrant);
    expect(readMermaidTable(quadrant, quadrantSpec).map((row) => row.cells)).toEqual([["Campaign A", "0.3", "0.6"]]);
    expect(updateMermaidTableRow(quadrant, quadrantSpec, 2, ["B", "0.1", "0.9"]).split("\n")[2]).toBe(
      "  B: [0.1, 0.9] radius: 10",
    );
  });

  it("has no table for other diagram types", () => {
    expect(getMermaidTableSpec("flowchart TD\n  A --> B")).toBeNull();
  });
});
