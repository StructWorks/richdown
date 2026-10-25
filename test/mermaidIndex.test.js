import { describe, expect, it } from "vitest";

import {
  findMermaidSourceLine,
  getMermaidLineReferences,
  getMermaidTargetLabel,
  normalizeLabel,
  renameMermaidTarget,
} from "../src/rich-editor/domain/mermaidIndex.js";

const lines = (...values) => values.join("\n");

function lineOf(code, keys, text) {
  return findMermaidSourceLine(code, { keys, text });
}

function textOfLine(code, keys, text) {
  return code.split("\n")[lineOf(code, keys, text)]?.trim();
}

function rename(code, keys, to, text) {
  return renameMermaidTarget(code, { keys, text }, to);
}

describe("labels", () => {
  it("normalizes decorated labels", () => {
    expect(normalizeLabel("  [Every   min] ")).toBe("Every min");
    expect(normalizeLabel("<<satisfies>>")).toBe("satisfies");
    expect(normalizeLabel('"Quoted"')).toBe("Quoted");
  });
});

describe("class diagrams", () => {
  const code = lines(
    "classDiagram",
    "  Animal <|-- Duck : extends",
    "  class Animal {",
    "    +String name",
    "    +move()",
    "  }",
    "  Duck : +swim()",
    "  Duck --> Pond",
  );

  it("prefers the explicit declaration over the first mention", () => {
    expect(textOfLine(code, ["node:Animal"])).toBe("class Animal {");
    expect(textOfLine(code, ["node:Pond"])).toBe("Duck --> Pond");
  });

  it("finds members inside class bodies and after colons", () => {
    expect(textOfLine(code, ["member:Animal:+move()"])).toBe("+move()");
    expect(textOfLine(code, ["member:Duck:+swim()"])).toBe("Duck : +swim()");
  });

  it("numbers relations from 1 like Mermaid's edge ids", () => {
    expect(textOfLine(code, ["rel:2"])).toBe("Duck --> Pond");
    expect(textOfLine(code, ["edge:Animal>Duck"])).toBe("Animal <|-- Duck : extends");
  });

  it("renames classes everywhere and members in place", () => {
    const renamed = rename(code, ["node:Animal"], "Creature");
    expect(renamed).toContain("Creature <|-- Duck");
    expect(renamed).toContain("class Creature {");
    expect(rename(code, ["member:Animal:+move()"], "+run()")).toContain("    +run()");
  });

  it("gives a class a display label for a multi-word name", () => {
    expect(rename(code, ["node:Animal"], "Wild animal")).toContain('class Animal["Wild animal"] {');
  });

  it("adds a label to an unlabeled relation", () => {
    expect(rename(code, ["rel:2"], "swims in")).toContain("Duck --> Pond : swims in");
  });
});

describe("state diagrams", () => {
  const code = lines(
    "stateDiagram-v2",
    "  [*] --> Idle",
    "  Idle --> Running : start",
    "  note right of Idle : waiting",
    "  state Running {",
    "    [*] --> Fast",
    "  }",
    "  Running --> [*]",
  );

  it("counts transitions and notes like Mermaid's edge ids", () => {
    expect(textOfLine(code, ["stateEdge:1"])).toBe("Idle --> Running : start");
    expect(textOfLine(code, ["stateEdge:3"])).toBe("[*] --> Fast");
    expect(textOfLine(code, ["stateEdge:4"])).toBe("Running --> [*]");
  });

  it("maps start and end markers to their scope", () => {
    expect(textOfLine(code, ["node:root_start"])).toBe("[*] --> Idle");
    expect(textOfLine(code, ["node:Running_start"])).toBe("[*] --> Fast");
    expect(textOfLine(code, ["node:root_end"])).toBe("Running --> [*]");
  });

  it("finds composite states and notes", () => {
    expect(textOfLine(code, ["node:Running"])).toBe("state Running {");
    expect(textOfLine(code, ["note:Idle"])).toBe("note right of Idle : waiting");
  });

  it("renames states, labels, and aliases", () => {
    expect(rename(code, ["node:Idle"], "Waiting")).toContain("Waiting --> Running : start");
    expect(rename(code, ["stateEdge:1"], "go")).toContain("Idle --> Running : go");
    expect(rename(code, ["node:Idle"], "Doing nothing")).toContain('state "Doing nothing" as Idle');
  });
});

describe("ER diagrams", () => {
  const code = lines(
    "erDiagram",
    "  CUSTOMER ||--o{ ORDER : places",
    "  CUSTOMER {",
    "    string name PK",
    "    int age",
    "  }",
  );

  it("finds entities, attributes by name and row, and relations", () => {
    expect(textOfLine(code, ["node:CUSTOMER"])).toBe("CUSTOMER {");
    expect(textOfLine(code, ["node:ORDER"])).toBe("CUSTOMER ||--o{ ORDER : places");
    expect(textOfLine(code, ["attr:CUSTOMER:age"])).toBe("int age");
    expect(textOfLine(code, ["attrRow:CUSTOMER:0"])).toBe("string name PK");
    expect(textOfLine(code, ["edge:CUSTOMER>ORDER"])).toBe("CUSTOMER ||--o{ ORDER : places");
  });

  it("does not rename ids that merely contain the renamed one", () => {
    const linked = `${code}\n  CUSTOMER-ADDRESS ||--|| CUSTOMER : at`;
    const renamed = rename(linked, ["node:CUSTOMER"], "CLIENT");
    expect(renamed).not.toContain("CLIENT-ADDRESS");
    expect(renamed).toContain("CUSTOMER-ADDRESS ||--|| CLIENT : at");
  });

  it("quotes multi-word relation labels", () => {
    expect(rename(code, ["edge:CUSTOMER>ORDER"], "makes many")).toContain(': "makes many"');
    expect(rename(code, ["attr:CUSTOMER:age"], "years old")).toContain("int years_old");
  });
});

describe("sequence diagrams", () => {
  const code = lines(
    "sequenceDiagram",
    "  autonumber",
    "  participant A as Alice",
    "  A->>+B: Hello",
    "  Note over A,B: a note",
    "  loop Every min",
    "    B-->>-A: Hi",
    "  end",
    "  activate A",
  );

  it("numbers statements like Mermaid's message ids", () => {
    expect(textOfLine(code, ["stmt:1"])).toBe("A->>+B: Hello");
    expect(textOfLine(code, ["stmt:3"])).toBe("Note over A,B: a note");
    expect(textOfLine(code, ["stmt:5"])).toBe("B-->>-A: Hi");
    expect(textOfLine(code, ["stmt:8"])).toBe("activate A");
  });

  it("maps a control block's closing id to its opening line", () => {
    expect(textOfLine(code, ["stmt:7"])).toBe("loop Every min");
  });

  it("finds declared, implicit, and labelled participants", () => {
    expect(textOfLine(code, ["participant:A"])).toBe("participant A as Alice");
    expect(textOfLine(code, ["participant:B"])).toBe("A->>+B: Hello");
    expect(textOfLine(code, ["participantLabel:Alice"])).toBe("participant A as Alice");
  });

  it("renames messages, loop titles, and participants", () => {
    expect(rename(code, ["stmt:1"], "Hey")).toContain("A->>+B: Hey");
    expect(rename(code, ["stmt:7"], "Every hour")).toContain("loop Every hour");
    expect(rename(code, ["participant:A"], "Alice Smith")).toContain("participant A as Alice Smith");
  });
});

describe("gantt charts", () => {
  const code = lines(
    "gantt",
    "  title Plan",
    "  dateFormat YYYY-MM-DD",
    "  section Build",
    "  Design :a1, 2026-01-01, 5d",
    "  Implement :after a1, 10d",
    "  Review :crit, done, 2026-01-09, 1d",
    "  Release :milestone, m1, 2026-01-20, 0d",
  );

  it("keys tasks by explicit id or Mermaid's auto id", () => {
    expect(textOfLine(code, ["task:a1"])).toContain("Design");
    expect(textOfLine(code, ["task:task1"])).toContain("Implement");
    expect(textOfLine(code, ["task:task2"])).toContain("Review");
    expect(textOfLine(code, ["task:m1"])).toContain("Release");
  });

  it("finds sections and the title", () => {
    expect(textOfLine(code, ["section:Build"])).toBe("section Build");
    expect(textOfLine(code, ["title"])).toBe("title Plan");
  });

  it("renames a task name without touching its metadata", () => {
    expect(rename(code, ["task:task1"], "Build: it")).toContain("Build - it :after a1, 10d");
  });

  it("does not take a task named like a title for the title", () => {
    const tricky = lines("gantt", "  dateFormat YYYY-MM-DD", "  My title task :2026-01-01, 1d");
    expect(textOfLine(tricky, ["task:task1"])).toContain("My title task");
    expect(lineOf(tricky, ["title"])).toBe(-1);
  });
});

describe("pie, mindmap, journey, timeline", () => {
  it("indexes pie slices in source order", () => {
    const code = lines('pie title Share', '  "Small" : 5', '  "Big" : 80');
    expect(textOfLine(code, ["slice:1"])).toBe('"Big" : 80');
    expect(textOfLine(code, ["title"])).toBe("pie title Share");
    expect(rename(code, ["slice:0"], 'Tiny "one"')).toContain(`"Tiny 'one'" : 5`);
  });

  it("indexes mindmap nodes, skipping icons and classes", () => {
    const code = lines("mindmap", "  root((Topic))", "    A", "    ::icon(fa fa-book)", "    Idea B[Bee]", "    :::urgent", "      C");
    expect(textOfLine(code, ["mindmap:2"])).toBe("Idea B[Bee]");
    expect(textOfLine(code, ["mindmap:3"])).toBe("C");
    expect(rename(code, ["mindmap:2"], "Bees")).toContain("Idea B[Bees]");
    expect(rename(code, ["mindmap:0"], "Subject")).toContain("root((Subject))");
    expect(getMermaidTargetLabel(code, { keys: ["mindmap:0"] })).toBe("Topic");
  });

  it("indexes journey tasks and sections", () => {
    const code = lines("journey", "  title Day", "  section Morning", "    Make tea: 5: Me", "    Commute: 2: Me, Cat");
    expect(textOfLine(code, ["journeyTask:1"])).toBe("Commute: 2: Me, Cat");
    expect(rename(code, ["journeyTask:0"], "Brew")).toContain("    Brew: 5: Me");
  });

  it("numbers timeline sections, periods, and events in order", () => {
    const code = lines("timeline", "  title T", "  section S1", "    2001 : a", "         : b", "  2002 : c : d");
    expect(textOfLine(code, ["timeline:0"])).toBe("section S1");
    expect(textOfLine(code, ["timeline:3"])).toBe(": b");
    expect(textOfLine(code, ["timeline:6"])).toBe("2002 : c : d");
    expect(rename(code, ["timeline:6"], "dd")).toContain("2002 : c : dd");
  });
});

describe("git graphs", () => {
  const code = lines(
    "gitGraph",
    "  commit",
    '  commit id: "feat"',
    "  branch dev",
    '  commit tag: "v1"',
    "  checkout main",
    "  merge dev",
  );

  it("keys commits by id or sequence, plus tags and branches", () => {
    expect(textOfLine(code, ["commitSeq:0"])).toBe("commit");
    expect(textOfLine(code, ["commit:feat"])).toBe('commit id: "feat"');
    expect(textOfLine(code, ["commitSeq:3"])).toBe("merge dev");
    expect(textOfLine(code, ["tag:v1"])).toBe('commit tag: "v1"');
    expect(textOfLine(code, ["branch:dev"])).toBe("branch dev");
  });

  it("names auto commits, renames ids, and renames branches everywhere", () => {
    expect(rename(code, ["commitSeq:0"], "start")).toContain('  commit id: "start"');
    expect(rename(code, ["commit:feat"], "feature")).toContain('commit id: "feature"');
    const branch = rename(code, ["branch:dev"], "feature/x");
    expect(branch).toContain("branch feature/x");
    expect(branch).toContain("merge feature/x");
  });
});

describe("other diagram types", () => {
  it("indexes xychart plots", () => {
    const code = lines("xychart-beta", "  title Sales", "  x-axis [jan, feb]", "  line [1, 2]", "  bar [3, 4]");
    expect(textOfLine(code, ["plot:1"])).toBe("bar [3, 4]");
    expect(rename(code, [], "february", "feb")).toContain("x-axis [jan, february]");
  });

  it("indexes sankey nodes and links", () => {
    const code = lines("sankey-beta", "Solar,Grid,60", "Wind,Grid,40", "Grid,Homes,90");
    expect(textOfLine(code, ["sankeyNode:2"])).toBe("Wind,Grid,40");
    expect(textOfLine(code, ["sankeyLink:2"])).toBe("Grid,Homes,90");
    expect(rename(code, ["sankeyNode:1"], "Power Grid")).toBe(
      lines("sankey-beta", "Solar,Power Grid,60", "Wind,Power Grid,40", "Power Grid,Homes,90"),
    );
  });

  it("indexes block, kanban, and architecture nodes", () => {
    expect(textOfLine('block-beta\n  a["Alpha"] b\n  a --> b', ["node:b"])).toBe('a["Alpha"] b');
    expect(rename('block-beta\n  a["Alpha"] b', ["node:a"], "Alef")).toBe('block-beta\n  a["Alef"] b');
    expect(rename("kanban\n  todo[Todo]\n    t1[Write docs]", ["node:t1"], "Write")).toContain("t1[Write]");
    expect(
      rename("architecture-beta\n  service db(database)[Database] in api", ["node:db"], "Main DB"),
    ).toContain("[Main DB] in api");
  });

  it("indexes requirement fields", () => {
    const code = lines("requirementDiagram", "  requirement r1 {", "    text: the text.", "    verifymethod: test", "  }");
    expect(textOfLine(code, ["field:r1:verification"])).toBe("verifymethod: test");
    expect(getMermaidTargetLabel(code, { keys: ["field:r1:text"] })).toBe("the text.");
  });

  it("matches label-only diagrams by text", () => {
    const c4 = 'C4Context\n  Person(customer, "Customer", "A user")';
    expect(lineOf(c4, [], "Customer")).toBe(1);
    expect(rename(c4, [], "Client", "Customer")).toContain('"Client"');
    expect(rename("radar-beta\n  axis A, B, C", [], "Beta", "B")).toContain("axis A, Beta, C");
  });
});

describe("line references", () => {
  it("lists the keys a line draws", () => {
    const code = lines("gantt", "  dateFormat YYYY-MM-DD", "  Design :a1, 2026-01-01, 1d");
    expect([...getMermaidLineReferences(code, 2).keys]).toEqual(["task:a1", "taskIndex:0"]);
  });

  it("includes the participants a message mentions", () => {
    const code = lines("sequenceDiagram", "  A->>B: hi");
    const refs = getMermaidLineReferences(code, 1);
    expect(refs.keys.has("participant:A")).toBe(true);
    expect(refs.keys.has("participant:B")).toBe(true);
  });
});
