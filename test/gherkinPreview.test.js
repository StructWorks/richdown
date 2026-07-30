// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  normalizeGherkinPreviewMode,
  parseGherkinFeature,
} from "../src/rich-editor/presentation/gherkin/gherkinPreview.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

const FEATURE = [
  "@smoke @auth",
  "Feature: Login",
  "  A user can sign in.",
  "",
  "  Background:",
  "    Given the app is running",
  "",
  "  @happy",
  "  Scenario: Successful login",
  "    Given a registered user",
  "    When they submit valid credentials",
  "    Then the dashboard appears",
  "    And a welcome banner shows",
  "",
  "  Scenario Outline: Invalid input",
  "    When they submit <field>",
  "    Then they see <error>",
  "",
  "    Examples:",
  "      | field | error |",
  "      | email | Invalid email |",
  "      | pass  | Too short |",
].join("\n");

function docFor(code) {
  return ["intro", "", "```gherkin", code, "```", ""].join("\n");
}

let harness;

afterEach(() => {
  harness?.destroy();
  harness = null;
  document.body.replaceChildren();
});

describe("normalizeGherkinPreviewMode", () => {
  it("keeps the known modes", () => {
    expect(normalizeGherkinPreviewMode("board")).toBe("board");
    expect(normalizeGherkinPreviewMode("source")).toBe("source");
  });

  it("falls back to the board for anything else", () => {
    for (const value of ["", "table", null, undefined, 2]) {
      expect(normalizeGherkinPreviewMode(value)).toBe("board");
    }
  });
});

describe("parseGherkinFeature", () => {
  const parsed = parseGherkinFeature(FEATURE);

  it("reads the feature title, description and tags", () => {
    expect(parsed.features).toHaveLength(1);
    expect(parsed.feature.title).toBe("Login");
    expect(parsed.feature.keyword).toBe("Feature");
    expect(parsed.feature.tags).toEqual(["@smoke", "@auth"]);
    expect(parsed.feature.description).toEqual(["A user can sign in."]);
  });

  it("separates the background from the scenarios", () => {
    expect(parsed.feature.backgrounds.map((entry) => entry.type)).toEqual([
      "background",
    ]);
    expect(parsed.feature.scenarios.map((entry) => entry.title)).toEqual([
      "Successful login",
      "Invalid input",
    ]);
  });

  it("counts scenarios, steps and example rows", () => {
    // Background counts as a scenario card; its Given is one of the 7 steps.
    expect(parsed.scenarioCount).toBe(3);
    expect(parsed.stepCount).toBe(7);
    expect(parsed.exampleRowCount).toBe(3);
  });

  it("attaches tags to the scenario that follows them", () => {
    expect(parsed.feature.scenarios[0].tags).toEqual(["@happy"]);
    expect(parsed.feature.scenarios[1].tags).toEqual([]);
  });

  it("marks a scenario outline as such", () => {
    expect(parsed.feature.scenarios[1].type).toBe("outline");
  });

  it("keeps step keywords and text apart", () => {
    expect(
      parsed.feature.scenarios[0].steps.map((step) => [
        step.keyword,
        step.text,
      ]),
    ).toEqual([
      ["Given", "a registered user"],
      ["When", "they submit valid credentials"],
      ["Then", "the dashboard appears"],
      ["And", "a welcome banner shows"],
    ]);
  });

  it("inherits the role of the previous step for And and But", () => {
    const steps = parsed.feature.scenarios[0].steps;
    expect(steps.at(-1).role).toBe("and");
    expect(steps.at(-1).primaryRole).toBe("then");
  });

  it("collects examples tables with a header row", () => {
    const [examples] = parsed.feature.scenarios[1].examples;
    expect(examples.title).toBe("Examples");
    expect(examples.rows).toEqual([
      ["field", "error"],
      ["email", "Invalid email"],
      ["pass", "Too short"],
    ]);
  });

  it("attaches a data table to the step above it", () => {
    const withTable = parseGherkinFeature(
      [
        "Feature: Data",
        "  Scenario: Table",
        "    Given these users",
        "      | name | role |",
        "      | ada  | dev  |",
      ].join("\n"),
    );
    expect(withTable.feature.scenarios[0].steps[0].tableRows).toEqual([
      ["name", "role"],
      ["ada", "dev"],
    ]);
  });

  it("groups scenarios under a rule", () => {
    const withRule = parseGherkinFeature(
      [
        "Feature: Rules",
        "  Rule: Only admins",
        "    Scenario: Admin can delete",
        "      Given an admin",
        "    Scenario: User cannot delete",
        "      Given a user",
      ].join("\n"),
    );
    expect(withRule.feature.rules).toHaveLength(1);
    expect(withRule.feature.rules[0].title).toBe("Only admins");
    expect(
      withRule.feature.rules[0].scenarios.map((entry) => entry.title),
    ).toEqual(["Admin can delete", "User cannot delete"]);
    expect(withRule.feature.scenarios).toEqual([]);
    expect(withRule.scenarioCount).toBe(2);
  });

  it("records the rule a scenario belongs to", () => {
    const withRule = parseGherkinFeature(
      ["Feature: R", "  Rule: Named", "    Scenario: S", "      Given x"].join(
        "\n",
      ),
    );
    expect(withRule.feature.rules[0].scenarios[0].ruleTitle).toBe("Named");
  });

  it("supports several features in one block", () => {
    const multi = parseGherkinFeature(
      [
        "Feature: One",
        "  Scenario: A",
        "    Given x",
        "Feature: Two",
        "  Scenario: B",
        "    Given y",
      ].join("\n"),
    );
    expect(multi.features.map((entry) => entry.title)).toEqual(["One", "Two"]);
    expect(multi.feature.title).toBe("One");
    expect(multi.scenarioCount).toBe(2);
  });

  it("ignores comments and blank lines", () => {
    const parsedComments = parseGherkinFeature(
      [
        "# a comment",
        "Feature: Comments",
        "",
        "  Scenario: S",
        "    # step comment",
        "    Given x",
      ].join("\n"),
    );
    expect(parsedComments.stepCount).toBe(1);
    expect(parsedComments.feature.description).toEqual([]);
  });

  it("normalizes CRLF input", () => {
    const crlf = parseGherkinFeature(
      "Feature: CRLF\r\n  Scenario: S\r\n    Given x\r\n",
    );
    expect(crlf.feature.title).toBe("CRLF");
    expect(crlf.stepCount).toBe(1);
  });

  it("invents a feature for a bare list of steps", () => {
    const bare = parseGherkinFeature("Given a start\nWhen something\nThen done");
    expect(bare.feature.title).toBe("Feature");
    expect(bare.feature.scenarios[0].title).toBe("Steps");
    expect(bare.stepCount).toBe(3);
  });

  it("returns an empty feature for empty input", () => {
    const empty = parseGherkinFeature("");
    expect(empty.features).toHaveLength(1);
    expect(empty.scenarioCount).toBe(0);
    expect(empty.stepCount).toBe(0);
  });

  it("keeps a scenario title when the keyword has none", () => {
    const untitled = parseGherkinFeature("Feature:\n  Scenario:\n    Given x");
    expect(untitled.feature.title).toBe("Feature");
    expect(untitled.feature.scenarios[0].title).toBe("Scenario");
  });

  it("parses Japanese keywords", () => {
    const japanese = parseGherkinFeature(
      [
        "機能: ログイン",
        "  シナリオ: 成功",
        "    前提 登録済みユーザーがいる",
        "    もし 正しい情報を送信する",
        "    ならば ダッシュボードが表示される",
        "    かつ 歓迎メッセージが出る",
      ].join("\n"),
    );

    expect(japanese.feature.title).toBe("ログイン");
    expect(japanese.feature.scenarios[0].title).toBe("成功");
    expect(
      japanese.feature.scenarios[0].steps.map((step) => step.primaryRole),
    ).toEqual(["given", "when", "then", "then"]);
  });
});

describe("gherkin board widget", () => {
  function mount(code = FEATURE, options = {}) {
    harness = createPreviewHarness({ doc: docFor(code), ...options });
    const widget = harness.widget("GherkinPreviewWidget");
    expect(widget, "the document must produce a gherkin preview").toBeTruthy();
    const dom = widget.toDOM(harness.view);
    document.body.appendChild(dom);
    return { widget, dom, view: harness.view };
  }

  it("replaces the fenced block with a board", () => {
    const { dom } = mount();
    expect(dom.className).toContain("is-board");
    expect(dom.getAttribute("role")).toBe("group");
    expect(dom.getAttribute("aria-label")).toBe("Gherkin preview");
    expect(dom.querySelector(".cm-gherkin-board")).toBeTruthy();
  });

  it("summarizes the feature in the toolbar", () => {
    const { dom } = mount();
    expect(dom.querySelector(".cm-gherkin-toolbar-name").textContent).toBe(
      "Login",
    );
    expect(
      [...dom.querySelectorAll(".cm-gherkin-stat")].map(
        (stat) => stat.textContent,
      ),
    ).toEqual(["3 scenarios", "7 steps"]);
  });

  it("names the feature count when a block holds several features", () => {
    const { dom } = mount(
      ["Feature: One", "  Scenario: A", "    Given x", "Feature: Two"].join("\n"),
    );
    expect(dom.querySelector(".cm-gherkin-toolbar-name").textContent).toBe(
      "2 features",
    );
  });

  it("renders a card per scenario with its steps", () => {
    const { dom } = mount();
    const steps = [...dom.querySelectorAll(".cm-gherkin-step")];

    expect(steps).toHaveLength(7);
    expect(steps[1].className).toContain("is-given");
    expect(steps[1].querySelector(".cm-gherkin-step-keyword").textContent).toBe(
      "Given",
    );
    expect(steps[1].querySelector(".cm-gherkin-step-text").textContent).toBe(
      "a registered user",
    );
  });

  it("styles an And step after Then as a Then step", () => {
    const { dom } = mount();
    expect(
      [...dom.querySelectorAll(".cm-gherkin-step")].at(4).className,
    ).toContain("is-then");
  });

  it("renders tags and the examples table", () => {
    const { dom } = mount();
    expect(
      [...dom.querySelectorAll(".cm-gherkin-tag")].map((tag) => tag.textContent),
    ).toContain("@smoke");
    expect(dom.querySelectorAll(".cm-gherkin-example-table tr")).toHaveLength(3);
  });

  it("renders a step data table", () => {
    const { dom } = mount(
      [
        "Feature: Data",
        "  Scenario: Table",
        "    Given these users",
        "      | name | role |",
        "      | ada  | dev  |",
      ].join("\n"),
    );
    expect(dom.querySelectorAll(".cm-gherkin-step-table tr")).toHaveLength(2);
  });

  it("groups rule scenarios under the rule title", () => {
    const { dom } = mount(
      [
        "Feature: Rules",
        "  Rule: Only admins",
        "    Scenario: Admin can delete",
        "      Given an admin",
      ].join("\n"),
    );
    const groupTitles = [...dom.querySelectorAll(".cm-gherkin-group-title")];
    expect(groupTitles.map((title) => title.textContent)).toContain(
      "RuleOnly admins",
    );
    expect(
      groupTitles[0].querySelector(".cm-gherkin-group-eyebrow").textContent,
    ).toBe("Rule");
  });

  it("says so when a block has no scenarios", () => {
    const { dom } = mount("Feature: Empty");
    expect(dom.querySelector(".cm-gherkin-empty").textContent).toBe(
      "No scenarios found.",
    );
  });

  it("switches to the highlighted source view", () => {
    const { dom, view } = mount();
    const sourceButton = [...dom.querySelectorAll(".cm-gherkin-button")].find(
      (button) => button.textContent === "Source",
    );
    sourceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const switched = harness.widget("GherkinPreviewWidget");
    expect(switched.mode).toBe("source");
    const sourceDom = switched.toDOM(view);
    expect(sourceDom.className).toContain("is-source");
    expect(sourceDom.querySelector(".cm-gherkin-board")).toBeNull();
    expect(sourceDom.textContent).toContain("Scenario: Successful login");
  });

  it("marks the active mode button", () => {
    const { dom } = mount();
    const [board, source] = dom.querySelectorAll(".cm-gherkin-button");
    expect(board.classList.contains("is-active")).toBe(true);
    expect(source.classList.contains("is-active")).toBe(false);
  });

  it("opens the Markdown source from the Edit button", () => {
    const { dom, view } = mount();
    [...dom.querySelectorAll(".cm-gherkin-button")]
      .find((button) => button.textContent === "Edit")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // The caret lands on the first line inside the fence.
    expect(view.state.doc.lineAt(view.state.selection.main.anchor).text).toBe(
      "@smoke @auth",
    );
    expect(harness.widget("GherkinPreviewWidget")).toBeNull();
  });

  it("opens the source on Enter and Space", () => {
    const { dom, view } = mount();
    dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(view.state.selection.main.anchor).toBeGreaterThan(0);
  });

  it("does not open the source in a read-only editor", () => {
    const { dom, view } = mount(FEATURE, { readOnly: true });
    dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(view.state.selection.main.anchor).toBe(0);
  });

  it("estimates a height from the parsed content", () => {
    const { widget } = mount();
    expect(widget.estimatedHeight).toBeGreaterThan(220);
  });

  it("compares widgets by range, signature, mode and revision", () => {
    const { widget } = mount();
    expect(widget.eq(widget)).toBe(true);
    expect(
      widget.eq({
        gherkinBlock: widget.gherkinBlock,
        mode: "source",
        revision: widget.revision,
      }),
    ).toBe(false);
  });

  it("keeps the fenced source when gherkin previews are disabled", () => {
    harness = createPreviewHarness({
      doc: docFor(FEATURE),
      settings: { gherkinPreview: false },
    });
    expect(harness.widget("GherkinPreviewWidget")).toBeNull();
  });

  it("shows the source while the caret is inside the block", () => {
    const doc = docFor(FEATURE);
    harness = createPreviewHarness({
      doc,
      selection: { anchor: doc.indexOf("Scenario: Successful login") },
    });
    expect(harness.widget("GherkinPreviewWidget")).toBeNull();
  });
});
