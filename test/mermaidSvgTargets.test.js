// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  collectMermaidNodeIds,
  describeMermaidElement,
  findMermaidElements,
} from "../src/rich-editor/presentation/mermaid/mermaidSvgTargets.js";

// Fixtures follow the structure Mermaid 11 renders for each diagram type
// (ids prefixed with the render id "R").
const R = "R";

function stageFor(svg) {
  const stage = document.createElement("div");
  stage.innerHTML = `<svg>${svg}</svg>`;
  document.body.appendChild(stage);
  return stage;
}

function describeIn(stage, type, selector, nth = 0) {
  const context = { stage, renderId: R, type, nodeIds: collectMermaidNodeIds({ stage, renderId: R }) };
  return describeMermaidElement(stage.querySelectorAll(selector)[nth], context);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("node diagrams", () => {
  it("reads flowchart nodes and edges", () => {
    const stage = stageFor(`
      <path data-id="L_my_node_C_0" class="flowchart-link"></path>
      <g class="label" data-id="L_my_node_C_0"><text>go</text></g>
      <g class="node" id="R-flowchart-my_node-0"><rect></rect><text>Start</text></g>
      <g class="node" id="R-flowchart-C-1"><rect></rect><text>C</text></g>`);
    expect(describeIn(stage, "flowchart", "g.node rect")).toMatchObject({
      kind: "node",
      id: "my_node",
      keys: ["node:my_node"],
      text: "Start",
    });
    expect(describeIn(stage, "flowchart", "g.label text")).toMatchObject({
      kind: "edge",
      from: "my_node",
      to: "C",
      keys: ["edge:my_node>C#0", "edge:my_node>C"],
      text: "go",
    });
  });

  it("reads flowchart subgraph clusters, but prefers the node inside", () => {
    const stage = stageFor(`
      <g class="cluster" id="R-S1"><rect></rect><g class="cluster-label"><text>Backend</text></g></g>
      <g class="node" id="R-flowchart-C-0"><rect></rect><text>C</text></g>`);
    expect(describeIn(stage, "flowchart", "g.cluster rect")).toMatchObject({
      kind: "subgraph",
      id: "S1",
      keys: ["subgraph:S1"],
      text: "Backend",
    });
    expect(describeIn(stage, "flowchart", "g.node rect").keys).toEqual(["node:C"]);
  });

  it("tells class members from the class name", () => {
    const stage = stageFor(`
      <path data-id="id_Animal_Duck_1"></path>
      <g class="node" id="R-classId-Animal-0">
        <g class="label"><foreignObject>Animal</foreignObject></g>
        <g class="label"><foreignObject>+move()</foreignObject></g>
      </g>
      <g class="node" id="R-classId-Duck-1"><g class="label"><foreignObject>Duck</foreignObject></g></g>`);
    expect(describeIn(stage, "class", "foreignObject", 1).keys).toEqual([
      "member:Animal:+move()",
      "node:Animal",
    ]);
    expect(describeIn(stage, "class", "foreignObject", 0).keys).toEqual(["node:Animal"]);
    expect(describeIn(stage, "class", "path").keys).toEqual(["rel:1", "edge:Animal>Duck"]);
  });

  it("reads state nodes, notes, clusters, and numbered edges", () => {
    const stage = stageFor(`
      <path data-id="edge3"></path>
      <g class="node" id="R-state-Idle-3"><g class="label"><text>Idle</text></g></g>
      <g class="node statediagram-note" id="R-state-Idle----note-3"><text>waiting</text></g>
      <g class="statediagram-state statediagram-cluster" id="R-state-Running-4" data-id="Running"><rect></rect></g>
      <g class="node" id="R-state-root_start-0"><circle></circle></g>`);
    expect(describeIn(stage, "state", "g.node text").keys).toEqual(["node:Idle"]);
    expect(describeIn(stage, "state", "g.statediagram-note text").keys).toEqual(["note:Idle"]);
    expect(describeIn(stage, "state", "g.statediagram-cluster rect").keys).toEqual(["node:Running"]);
    expect(describeIn(stage, "state", "circle").keys).toEqual(["node:root_start"]);
    expect(describeIn(stage, "state", "path").keys).toEqual(["stateEdge:3"]);
  });

  it("reads ER attributes by row and relations by entity names", () => {
    const stage = stageFor(`
      <path data-id="id_entity-CUSTOMER-0_entity-ORDER-1_0"></path>
      <g class="node" id="R-entity-CUSTOMER-0">
        <g class="label name"><text>CUSTOMER</text></g>
        <g class="label attribute-type"><text>string</text></g>
        <g class="label attribute-name"><text>name</text></g>
        <g class="label attribute-type"><text>int</text></g>
        <g class="label attribute-name"><text>age</text></g>
      </g>`);
    expect(describeIn(stage, "er", ".attribute-name text", 1).keys).toEqual([
      "attr:CUSTOMER:age",
      "attrRow:CUSTOMER:1",
      "node:CUSTOMER",
    ]);
    expect(describeIn(stage, "er", ".attribute-type text", 0).keys).toEqual([
      "attrRow:CUSTOMER:0",
      "node:CUSTOMER",
    ]);
    expect(describeIn(stage, "er", "path").keys).toEqual(["edge:CUSTOMER>ORDER"]);
  });

  it("reads mindmap nodes and edges by index", () => {
    const stage = stageFor(`
      <path data-id="edge_0_2"></path>
      <g class="node mindmap-node" id="R-node_2"><text>Sub</text></g>`);
    expect(describeIn(stage, "mindmap", "text").keys).toEqual(["mindmap:2"]);
    expect(describeIn(stage, "mindmap", "path").keys).toEqual(["mindmap:2"]);
  });

  it("reads ids of block, kanban, architecture, and requirement nodes", () => {
    const stage = stageFor(`
      <g class="node" id="R-test_req"><g class="label"><foreignObject>Text: the text.</foreignObject></g></g>
      <g class="architecture-service" id="R-service-db"><text>Database</text></g>
      <rect class="node-bkg" id="R-group-api"></rect>`);
    expect(describeIn(stage, "other", "foreignObject").keys).toEqual([
      "field:test_req:text",
      "node:test_req",
    ]);
    expect(describeIn(stage, "other", "g.architecture-service text").keys).toEqual(["node:db"]);
    expect(describeIn(stage, "other", "rect.node-bkg").keys).toEqual(["node:api"]);
  });
});

describe("sequence diagrams", () => {
  const svg = `
    <g data-et="participant" data-id="A" id="root-0"><rect class="actor actor-top"></rect><text class="actor">Alice</text></g>
    <line data-et="life-line" data-id="A"></line>
    <rect class="actor actor-bottom"></rect><text class="actor actor-box">Alice</text>
    <text class="messageText">Hello</text>
    <line class="messageLine0" data-et="message" data-id="i1" data-from="A" data-to="B"></line>
    <g data-et="control-structure" data-id="i7"><text class="labelText">loop</text><text class="loopText">[Every min]</text></g>`;

  it("reads messages from the line or its text", () => {
    const stage = stageFor(svg);
    expect(describeIn(stage, "sequence", "text.messageText")).toMatchObject({
      keys: ["stmt:1"],
      text: "Hello",
    });
    expect(describeIn(stage, "sequence", "line[data-et='message']")).toMatchObject({
      keys: ["stmt:1"],
      text: "Hello",
    });
  });

  it("reads control blocks by their closing id and title", () => {
    const stage = stageFor(svg);
    expect(describeIn(stage, "sequence", "text.loopText")).toMatchObject({
      keys: ["stmt:7"],
      text: "Every min",
    });
  });

  it("reads participants, lifelines, and bottom boxes", () => {
    const stage = stageFor(svg);
    expect(describeIn(stage, "sequence", "g[data-et] rect").keys).toEqual(["participant:A"]);
    expect(describeIn(stage, "sequence", "line[data-et='life-line']").keys).toEqual([
      "participant:A",
    ]);
    expect(describeIn(stage, "sequence", "rect.actor-bottom").keys).toEqual([
      "participantLabel:Alice",
    ]);
  });
});

describe("chart diagrams", () => {
  it("reads gantt tasks from bars and labels", () => {
    const stage = stageFor(`
      <rect class="task" id="R-task1"></rect>
      <text class="taskText" id="R-task1-text">Implement</text>
      <text class="sectionTitle">Build</text>
      <text class="titleText">Plan</text>`);
    expect(describeIn(stage, "gantt", "rect")).toMatchObject({ keys: ["task:task1"], text: "Implement" });
    expect(describeIn(stage, "gantt", "text.taskText").keys).toEqual(["task:task1"]);
    expect(describeIn(stage, "gantt", "text.sectionTitle").keys).toEqual(["section:Build"]);
    expect(describeIn(stage, "gantt", "text.titleText").keys).toEqual(["title"]);
  });

  it("reads pie slices from wedges, percentages, and the legend", () => {
    const stage = stageFor(`
      <g><path class="pieCircle"></path><path class="pieCircle"></path></g>
      <text class="slice">5%</text><text class="slice">95%</text>
      <g class="legend"><text>Small</text></g><g class="legend"><text>Big</text></g>`);
    expect(describeIn(stage, "pie", "path.pieCircle", 1)).toMatchObject({ keys: ["slice:1"], text: "Big" });
    expect(describeIn(stage, "pie", "text.slice", 0).keys).toEqual(["slice:0"]);
    expect(describeIn(stage, "pie", "g.legend text", 1).keys).toEqual(["slice:1"]);
  });

  it("reads git commits by id or sequence, tags, and branches", () => {
    const stage = stageFor(`
      <circle class="commit 0-857a793 commit0"></circle>
      <circle class="commit feat commit0"></circle>
      <circle class="commit commit-merge 5-8780b67 commit0"></circle>
      <text class="tag-label">v1</text>
      <g class="branchLabel"><text>dev</text></g>`);
    expect(describeIn(stage, "git", "circle", 0).keys).toEqual(["commitSeq:0"]);
    expect(describeIn(stage, "git", "circle", 1).keys).toEqual(["commit:feat"]);
    expect(describeIn(stage, "git", "circle", 2).keys).toEqual(["commitSeq:5"]);
    expect(describeIn(stage, "git", "text.tag-label").keys).toEqual(["tag:v1"]);
    expect(describeIn(stage, "git", "g.branchLabel text").keys).toEqual(["branch:dev"]);
  });

  it("reads journey tasks, timeline shapes, and xychart plots by index", () => {
    const journey = stageFor(`
      <line class="task-line" id="R-task1"></line>
      <rect class="task"></rect><rect class="task"></rect>
      <text class="task">Tea</text><text class="task">Commute</text>`);
    expect(describeIn(journey, "journey", "rect.task", 1)).toMatchObject({
      keys: ["journeyTask:1"],
      text: "Commute",
    });
    expect(describeIn(journey, "journey", "line").keys).toEqual(["journeyTask:1"]);

    const timeline = stageFor(`<g class="timeline-node"><path id="R-node-5"></path></g>`);
    expect(describeIn(timeline, "timeline", "path").keys).toEqual(["timeline:5"]);

    const xy = stageFor(`<g class="line-plot-0"><path></path></g><g class="bar-plot-1"><rect></rect></g>`);
    expect(describeIn(xy, "other", "rect").keys).toEqual(["plot:1"]);
  });

  it("reads sankey nodes, labels, and links in order", () => {
    const stage = stageFor(`
      <g class="nodes"><g class="node" id="node-22"><rect></rect></g><g class="node" id="node-23"><rect></rect></g></g>
      <g class="node-labels"><text>Solar\n60</text><text>Grid\n100</text></g>
      <g class="links"><g class="link"><path></path></g><g class="link"><path></path></g></g>`);
    expect(describeIn(stage, "other", "g.nodes rect", 1)).toMatchObject({ keys: ["sankeyNode:1"], text: "Grid" });
    expect(describeIn(stage, "other", "g.node-labels text", 0).keys).toEqual(["sankeyNode:0"]);
    expect(describeIn(stage, "other", "g.link path", 1).keys).toEqual(["sankeyLink:1"]);
  });

  it("falls back to the clicked text", () => {
    const stage = stageFor(`<g><text>Campaign A</text></g>`);
    expect(describeIn(stage, "quadrant", "text")).toMatchObject({ keys: [], text: "Campaign A" });
  });
});

describe("finding elements for a line", () => {
  it("matches structural keys and label-only text", () => {
    const stage = stageFor(`
      <rect class="task" id="R-a1"></rect><text class="taskText" id="R-a1-text">Design</text>
      <rect class="task" id="R-b2"></rect>
      <g><text>Loose label</text></g>`);
    const context = { stage, renderId: R, type: "gantt", nodeIds: new Set() };
    const found = findMermaidElements(context, {
      keys: new Set(["task:a1"]),
      texts: new Set(["Loose label"]),
    });
    expect([...found].map((element) => element.id || element.textContent)).toEqual([
      "R-a1",
      "Loose label",
    ]);
  });
});
