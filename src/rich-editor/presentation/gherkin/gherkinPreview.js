import { WidgetType } from "@codemirror/view";

const gherkinPreviewModes = ["board", "source"];

export function normalizeGherkinPreviewMode(mode) {
  return gherkinPreviewModes.includes(mode) ? mode : "board";
}

export function createGherkinPreviewWidgetClass({
  setActiveGherkinEdit,
  setGherkinPreviewMode,
  requestEditorMeasure,
}) {
  class GherkinPreviewWidget extends WidgetType {
    constructor(gherkinBlock, mode, revision) {
      super();
      this.gherkinBlock = gherkinBlock;
      this.mode = normalizeGherkinPreviewMode(mode);
      this.revision = revision;
      this.parsed = parseGherkinFeature(gherkinBlock.code);
    }

    eq(other) {
      return (
        other.gherkinBlock.from === this.gherkinBlock.from &&
        other.gherkinBlock.to === this.gherkinBlock.to &&
        other.gherkinBlock.signature === this.gherkinBlock.signature &&
        other.mode === this.mode &&
        other.revision === this.revision
      );
    }

    get estimatedHeight() {
      const lineHeight = 22;
      if (this.mode === "source") {
        return Math.max(180, this.gherkinBlock.sourceLineCount * lineHeight);
      }
      return Math.max(
        220,
        120 +
          this.parsed.scenarioCount * 112 +
          this.parsed.stepCount * 18 +
          this.parsed.exampleRowCount * 24,
      );
    }

    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = `cm-gherkin-preview is-${this.mode}`;
      wrapper.setAttribute("role", "group");
      wrapper.setAttribute("aria-label", "Gherkin preview");
      wrapper.title = "Gherkin preview";

      const toolbar = this.createToolbar(view);
      const body = document.createElement("div");
      body.className = "cm-gherkin-body";
      body.appendChild(
        this.mode === "source"
          ? renderGherkinSource(this.gherkinBlock.code)
          : renderGherkinBoard(this.parsed),
      );

      wrapper.appendChild(toolbar);
      wrapper.appendChild(body);
      wrapper.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        this.focusSource(view);
      });

      if (typeof requestEditorMeasure === "function") {
        queueMicrotask(() => requestEditorMeasure(view));
      }

      return wrapper;
    }

    createToolbar(view) {
      const toolbar = document.createElement("div");
      toolbar.className = "cm-gherkin-toolbar";

      const title = document.createElement("div");
      title.className = "cm-gherkin-toolbar-title";
      const label = document.createElement("span");
      label.className = "cm-gherkin-toolbar-label";
      label.textContent = "Gherkin";
      const name = document.createElement("span");
      name.className = "cm-gherkin-toolbar-name";
      name.textContent =
        this.parsed.features.length > 1
          ? `${this.parsed.features.length} features`
          : this.parsed.features[0]?.title || "Feature";
      title.append(label, name);

      const stats = document.createElement("div");
      stats.className = "cm-gherkin-stats";
      stats.appendChild(
        createStat(`${this.parsed.scenarioCount}`, "scenarios"),
      );
      stats.appendChild(createStat(`${this.parsed.stepCount}`, "steps"));

      const actions = document.createElement("div");
      actions.className = "cm-gherkin-actions";
      actions.appendChild(
        this.createModeButton("Board", "board", "Show as BDD board", view),
      );
      actions.appendChild(
        this.createModeButton("Source", "source", "Show highlighted source", view),
      );
      actions.appendChild(
        createGherkinButton("Edit", "Edit Gherkin source", () =>
          this.focusSource(view),
        ),
      );

      toolbar.append(title, stats, actions);
      return toolbar;
    }

    createModeButton(label, mode, title, view) {
      return createGherkinButton(
        label,
        title,
        () => {
          view.dispatch({
            effects: setGherkinPreviewMode.of({
              key: this.gherkinBlock.key,
              mode,
            }),
          });
        },
        mode === this.mode,
      );
    }

    focusSource(view) {
      const openingLine = view.state.doc.lineAt(this.gherkinBlock.from);
      const anchor = Math.min(view.state.doc.length, openingLine.to + 1);
      view.dispatch({
        effects: setActiveGherkinEdit.of({
          from: this.gherkinBlock.from,
          to: this.gherkinBlock.sourceTo,
        }),
        selection: { anchor },
        scrollIntoView: true,
      });
      view.focus();
    }

    ignoreEvent() {
      return true;
    }
  }

  return GherkinPreviewWidget;
}

function createStat(value, label) {
  const stat = document.createElement("span");
  stat.className = "cm-gherkin-stat";
  stat.textContent = `${value} ${label}`;
  return stat;
}

function createGherkinButton(label, title, action, active = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cm-gherkin-button${active ? " is-active" : ""}`;
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("mousedown", stopInteractiveEvent);
  button.addEventListener("click", (event) => {
    stopInteractiveEvent(event);
    action();
  });
  return button;
}

function stopInteractiveEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

export function parseGherkinFeature(code) {
  const parsed = {
    features: [],
    feature: null,
    scenarioCount: 0,
    stepCount: 0,
    exampleRowCount: 0,
  };
  const lines = normalizeLineEndings(code).split("\n");
  let pendingTags = [];
  let currentFeature = null;
  let currentRule = null;
  let currentScenario = null;
  let currentExamples = null;
  let lastStepRole = "";

  function ensureFeature() {
    if (!currentFeature) {
      currentFeature = createParsedFeature({
        title: "Feature",
        keyword: "Feature",
        tags: [],
      });
      parsed.features.push(currentFeature);
    }
    return currentFeature;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("#")) {
      continue;
    }

    const tags = parseTagLine(line);
    if (tags.length > 0) {
      pendingTags = pendingTags.concat(tags);
      continue;
    }

    const keywordLine = parseKeywordLine(line);
    if (keywordLine) {
      currentExamples = null;
      if (keywordLine.type === "feature") {
        currentFeature = createParsedFeature({
          title: keywordLine.title || "Feature",
          keyword: keywordLine.keyword,
          tags: pendingTags,
        });
        parsed.features.push(currentFeature);
        pendingTags = [];
        currentScenario = null;
        currentRule = null;
        continue;
      }

      if (keywordLine.type === "rule") {
        const feature = ensureFeature();
        currentRule = {
          title: keywordLine.title || "Rule",
          keyword: keywordLine.keyword,
          tags: pendingTags,
          scenarios: [],
        };
        feature.rules.push(currentRule);
        pendingTags = [];
        currentScenario = null;
        continue;
      }

      if (keywordLine.type === "examples") {
        if (currentScenario) {
          currentExamples = {
            title: keywordLine.title || "Examples",
            keyword: keywordLine.keyword,
            rows: [],
          };
          currentScenario.examples.push(currentExamples);
        }
        continue;
      }

      const feature = ensureFeature();
      currentScenario = {
        title: keywordLine.title || keywordLine.typeLabel,
        keyword: keywordLine.keyword,
        type: keywordLine.type,
        tags: pendingTags,
        description: [],
        steps: [],
        examples: [],
        ruleTitle: currentRule?.title || "",
      };
      pendingTags = [];
      lastStepRole = "";
      if (keywordLine.type === "background") {
        feature.backgrounds.push(currentScenario);
      } else if (currentRule) {
        currentRule.scenarios.push(currentScenario);
      } else {
        feature.scenarios.push(currentScenario);
      }
      continue;
    }

    if (currentExamples && isPipeTableLine(line)) {
      currentExamples.rows.push(parsePipeRow(line));
      parsed.exampleRowCount += 1;
      continue;
    }

    const step = parseStepLine(line, lastStepRole);
    if (step) {
      if (!currentScenario) {
        const feature = ensureFeature();
        currentScenario = {
          title: "Steps",
          keyword: "Scenario",
          type: "scenario",
          tags: [],
          description: [],
          steps: [],
          examples: [],
          ruleTitle: currentRule?.title || "",
        };
        feature.scenarios.push(currentScenario);
      }
      currentScenario.steps.push(step);
      parsed.stepCount += 1;
      if (step.primaryRole !== "and" && step.primaryRole !== "but") {
        lastStepRole = step.primaryRole;
      }
      currentExamples = null;
      continue;
    }

    if (isPipeTableLine(line) && currentScenario?.steps.length) {
      const lastStep = currentScenario.steps[currentScenario.steps.length - 1];
      lastStep.tableRows.push(parsePipeRow(line));
      continue;
    }

    if (currentScenario) {
      currentScenario.description.push(line);
    } else {
      ensureFeature().description.push(line);
    }
  }

  if (parsed.features.length === 0) {
    parsed.features.push(createParsedFeature());
  }
  parsed.feature = parsed.features[0];
  parsed.scenarioCount = parsed.features.reduce(
    (total, feature) =>
      total +
      feature.backgrounds.length +
      feature.scenarios.length +
      feature.rules.reduce((sum, rule) => sum + rule.scenarios.length, 0),
    0,
  );
  return parsed;
}

function createParsedFeature({
  title = "Feature",
  keyword = "Feature",
  tags = [],
} = {}) {
  return {
    title,
    keyword,
    tags,
    description: [],
    backgrounds: [],
    scenarios: [],
    rules: [],
  };
}

function renderGherkinBoard(parsed) {
  const board = document.createElement("div");
  board.className = "cm-gherkin-board";

  for (const feature of parsed.features) {
    board.appendChild(renderFeatureSection(feature));
  }

  if (parsed.scenarioCount === 0) {
    const empty = document.createElement("div");
    empty.className = "cm-gherkin-empty";
    empty.textContent = "No scenarios found.";
    board.appendChild(empty);
  }

  return board;
}

function renderFeatureSection(feature) {
  const section = document.createElement("section");
  section.className = "cm-gherkin-feature-section";
  section.appendChild(renderFeatureSummary(feature));

  for (const background of feature.backgrounds) {
    section.appendChild(renderScenarioCard(background));
  }

  if (feature.scenarios.length > 0) {
    section.appendChild(renderScenarioGroup("Scenarios", feature.scenarios));
  }

  for (const rule of feature.rules) {
    const group = renderScenarioGroup(rule.title, rule.scenarios, "Rule");
    if (rule.tags.length > 0) {
      group
        .querySelector(".cm-gherkin-group-header")
        ?.appendChild(renderTags(rule.tags));
    }
    section.appendChild(group);
  }

  return section;
}

function renderFeatureSummary(feature) {
  const card = document.createElement("section");
  card.className = "cm-gherkin-feature";
  const heading = document.createElement("div");
  heading.className = "cm-gherkin-feature-heading";
  const keyword = document.createElement("span");
  keyword.className = "cm-gherkin-keyword-pill is-feature";
  keyword.textContent = feature.keyword || "Feature";
  const title = document.createElement("div");
  title.className = "cm-gherkin-feature-title";
  title.textContent = feature.title || "Feature";
  heading.append(keyword, title);
  card.appendChild(heading);

  if (feature.tags.length > 0) {
    card.appendChild(renderTags(feature.tags));
  }
  if (feature.description.length > 0) {
    card.appendChild(renderDescription(feature.description));
  }
  return card;
}

function renderScenarioGroup(title, scenarios, eyebrow = "") {
  const group = document.createElement("section");
  group.className = "cm-gherkin-group";
  const header = document.createElement("div");
  header.className = "cm-gherkin-group-header";
  const heading = document.createElement("div");
  heading.className = "cm-gherkin-group-title";
  if (eyebrow) {
    const label = document.createElement("span");
    label.className = "cm-gherkin-group-eyebrow";
    label.textContent = eyebrow;
    heading.appendChild(label);
  }
  const name = document.createElement("span");
  name.textContent = title;
  heading.appendChild(name);
  header.appendChild(heading);
  group.appendChild(header);

  const list = document.createElement("div");
  list.className = "cm-gherkin-scenario-grid";
  for (const scenario of scenarios) {
    list.appendChild(renderScenarioCard(scenario));
  }
  group.appendChild(list);
  return group;
}

function renderScenarioCard(scenario) {
  const card = document.createElement("article");
  card.className = `cm-gherkin-scenario is-${scenario.type}`;
  const header = document.createElement("div");
  header.className = "cm-gherkin-scenario-header";
  const keyword = document.createElement("span");
  keyword.className = `cm-gherkin-keyword-pill is-${scenario.type}`;
  keyword.textContent = scenario.keyword;
  const title = document.createElement("div");
  title.className = "cm-gherkin-scenario-title";
  title.textContent = scenario.title;
  header.append(keyword, title);
  card.appendChild(header);

  if (scenario.tags.length > 0) {
    card.appendChild(renderTags(scenario.tags));
  }
  if (scenario.description.length > 0) {
    card.appendChild(renderDescription(scenario.description));
  }

  const flow = document.createElement("div");
  flow.className = "cm-gherkin-flow";
  for (const step of scenario.steps) {
    flow.appendChild(renderStep(step));
  }
  if (scenario.steps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "cm-gherkin-empty";
    empty.textContent = "No steps yet.";
    flow.appendChild(empty);
  }
  card.appendChild(flow);

  for (const examples of scenario.examples) {
    card.appendChild(renderExamples(examples));
  }

  return card;
}

function renderStep(step) {
  const item = document.createElement("div");
  item.className = `cm-gherkin-step is-${step.primaryRole}`;
  const rail = document.createElement("span");
  rail.className = "cm-gherkin-step-rail";
  const keyword = document.createElement("span");
  keyword.className = "cm-gherkin-step-keyword";
  keyword.textContent = step.keyword;
  const text = document.createElement("span");
  text.className = "cm-gherkin-step-text";
  text.textContent = step.text;
  item.append(rail, keyword, text);
  if (step.tableRows.length > 0) {
    item.appendChild(renderTable(step.tableRows, "cm-gherkin-step-table"));
  }
  return item;
}

function renderExamples(examples) {
  const section = document.createElement("div");
  section.className = "cm-gherkin-examples";
  const title = document.createElement("div");
  title.className = "cm-gherkin-examples-title";
  title.textContent = examples.title;
  section.appendChild(title);
  if (examples.rows.length > 0) {
    section.appendChild(renderTable(examples.rows, "cm-gherkin-example-table"));
  }
  return section;
}

function renderTable(rows, className) {
  const table = document.createElement("table");
  table.className = className;
  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const cell of row) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  table.appendChild(body);
  return table;
}

function renderTags(tags) {
  const list = document.createElement("div");
  list.className = "cm-gherkin-tags";
  for (const tag of tags) {
    const item = document.createElement("span");
    item.className = "cm-gherkin-tag";
    item.textContent = tag;
    list.appendChild(item);
  }
  return list;
}

function renderDescription(lines) {
  const description = document.createElement("div");
  description.className = "cm-gherkin-description";
  for (const line of lines) {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    description.appendChild(paragraph);
  }
  return description;
}

function renderGherkinSource(code) {
  const pre = document.createElement("pre");
  pre.className = "cm-gherkin-source";
  const lines = normalizeLineEndings(code).split("\n");
  for (const line of lines) {
    pre.appendChild(renderSourceLine(line));
  }
  return pre;
}

function renderSourceLine(line) {
  const row = document.createElement("div");
  row.className = "cm-gherkin-source-line";
  const trimmed = line.trim();
  const leading = line.match(/^\s*/)?.[0] || "";

  if (!trimmed) {
    row.appendChild(document.createTextNode(" "));
    return row;
  }

  if (leading) {
    row.appendChild(document.createTextNode(leading));
  }

  if (trimmed.startsWith("#")) {
    row.appendChild(createSourceSpan(trimmed, "comment"));
    return row;
  }

  const tags = parseTagLine(trimmed);
  if (tags.length > 0) {
    for (const tag of tags) {
      row.appendChild(createSourceSpan(tag, "tag"));
      row.appendChild(document.createTextNode(" "));
    }
    return row;
  }

  const keywordLine = parseKeywordLine(trimmed);
  if (keywordLine) {
    row.appendChild(createSourceSpan(keywordLine.keyword, keywordLine.type));
    row.appendChild(createSourceSpan(":", "punctuation"));
    if (keywordLine.title) {
      row.appendChild(document.createTextNode(" "));
      row.appendChild(createSourceSpan(keywordLine.title, "title"));
    }
    return row;
  }

  const step = parseStepLine(trimmed);
  if (step) {
    row.appendChild(createSourceSpan(step.keyword, step.primaryRole));
    row.appendChild(document.createTextNode(" "));
    row.appendChild(createSourceSpan(step.text, "text"));
    return row;
  }

  if (isPipeTableLine(trimmed)) {
    row.appendChild(createSourceSpan(trimmed, "table"));
    return row;
  }

  row.appendChild(createSourceSpan(trimmed, "text"));
  return row;
}

function createSourceSpan(text, type) {
  const span = document.createElement("span");
  span.className = `cm-gherkin-token is-${type}`;
  span.textContent = text;
  return span;
}

function parseKeywordLine(line) {
  const match = line.match(
    /^(Feature|Rule|Background|Scenario Outline|Scenario Template|Scenario|Examples|機能|ルール|背景|シナリオアウトライン|シナリオテンプレート|シナリオ|例|サンプル)\s*:\s*(.*)$/i,
  );
  if (!match) {
    return null;
  }
  const keyword = match[1];
  const lower = keyword.toLowerCase();
  const title = match[2].trim();
  if (lower === "feature" || keyword === "機能") {
    return { type: "feature", typeLabel: "Feature", keyword, title };
  }
  if (lower === "rule" || keyword === "ルール") {
    return { type: "rule", typeLabel: "Rule", keyword, title };
  }
  if (lower === "background" || keyword === "背景") {
    return { type: "background", typeLabel: "Background", keyword, title };
  }
  if (
    lower === "scenario outline" ||
    lower === "scenario template" ||
    keyword === "シナリオアウトライン" ||
    keyword === "シナリオテンプレート"
  ) {
    return {
      type: "outline",
      typeLabel: "Scenario Outline",
      keyword,
      title,
    };
  }
  if (lower === "scenario" || keyword === "シナリオ") {
    return { type: "scenario", typeLabel: "Scenario", keyword, title };
  }
  return { type: "examples", typeLabel: "Examples", keyword, title };
}

function parseStepLine(line, inheritedRole = "") {
  const match =
    line.match(/^(Given|When|Then|And|But)\b\s*(.*)$/i) ||
    line.match(/^(前提|もし|ならば|かつ|しかし)\s*(.*)$/);
  if (!match) {
    return null;
  }
  const keyword = match[1];
  const role = getStepRole(keyword);
  const primaryRole =
    role === "and" || role === "but" ? inheritedRole || role : role;
  return {
    keyword,
    role,
    primaryRole,
    text: match[2].trim(),
    tableRows: [],
  };
}

function getStepRole(keyword) {
  const lower = keyword.toLowerCase();
  if (lower === "given" || keyword === "前提") return "given";
  if (lower === "when" || keyword === "もし") return "when";
  if (lower === "then" || keyword === "ならば") return "then";
  if (lower === "but" || keyword === "しかし") return "but";
  return "and";
}

function parseTagLine(line) {
  if (!line.startsWith("@")) {
    return [];
  }
  return line.split(/\s+/).filter((part) => /^@[\w-]+$/.test(part));
}

function isPipeTableLine(line) {
  return /^\|.*\|$/.test(line);
}

function parsePipeRow(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}
