const slashCommands = [
  {
    label: "Heading 1",
    description: "Large section heading",
    insert: "# ",
    cursor: 2,
  },
  {
    label: "Heading 2",
    description: "Medium section heading",
    insert: "## ",
    cursor: 3,
  },
  {
    label: "Heading 3",
    description: "Small section heading",
    insert: "### ",
    cursor: 4,
  },
  {
    label: "Bullet list",
    description: "Unordered list item",
    insert: "- ",
    cursor: 2,
  },
  {
    label: "Numbered list",
    description: "Ordered list item",
    insert: "1. ",
    cursor: 3,
  },
  {
    label: "Task list",
    description: "Unchecked task item",
    insert: "- [ ] ",
    cursor: 6,
  },
  {
    label: "Quote",
    description: "Block quote",
    insert: "> ",
    cursor: 2,
  },
  {
    label: "Code block",
    description: "Fenced code block",
    insert: "```\n\n```",
    cursor: 4,
  },
  {
    label: "Mermaid",
    description: "Diagram block",
    insert: "```mermaid\n\n```",
    cursor: 11,
  },
  {
    label: "Azure Mermaid",
    description: "Azure DevOps diagram block",
    insert: "::: mermaid\n\n:::",
    cursor: 12,
  },
  {
    label: "Gherkin",
    description: "BDD scenario block",
    insert:
      "```gherkin\nFeature: \n\n  Scenario: \n    Given \n    When \n    Then \n```",
    cursor: 20,
  },
  {
    label: "Table",
    description: "Three-column table",
    insert: "| Column | Column | Column |\n| --- | --- | --- |\n|  |  |  |",
    cursor: 2,
  },
  {
    label: "Details",
    description: "Collapsible section",
    insert: "<details>\n<summary>Details</summary>\n\n</details>",
    cursor: 37,
  },
];

export function createSlashCommandController() {
  let menu = null;

  function trigger(view) {
    const selection = view.state.selection.main;
    if (!selection.empty) {
      return false;
    }
    const line = view.state.doc.lineAt(selection.from);
    if (line.text.trim().length !== 0) {
      return false;
    }
    close();
    menu = new SlashCommandMenu(view, selection.from, selection.from + 1, close);
    view.dispatch({
      changes: { from: selection.from, insert: "/" },
      selection: { anchor: selection.from + 1 },
    });
    return true;
  }

  function sync(update) {
    menu?.sync(update);
  }

  function move(delta) {
    if (!menu) {
      return false;
    }
    menu.move(delta);
    return true;
  }

  function accept() {
    if (!menu) {
      return false;
    }
    menu.accept();
    return true;
  }

  function close() {
    if (!menu) {
      return false;
    }
    menu.destroy();
    menu = null;
    return true;
  }

  return {
    close,
    sync,
    keymap: [
      {
        key: "/",
        run: trigger,
      },
      {
        key: "ArrowDown",
        run() {
          return move(1);
        },
        preventDefault: true,
      },
      {
        key: "ArrowUp",
        run() {
          return move(-1);
        },
        preventDefault: true,
      },
      {
        key: "Enter",
        run: accept,
        preventDefault: true,
      },
      {
        key: "Tab",
        run: accept,
        preventDefault: true,
      },
      {
        key: "Escape",
        run: close,
        preventDefault: true,
      },
    ],
  };
}

class SlashCommandMenu {
  constructor(view, from, to, closeMenu) {
    this.view = view;
    this.from = from;
    this.to = to;
    this.closeMenu = closeMenu;
    this.activeIndex = 0;
    this.dom = document.createElement("div");
    this.dom.className = "cm-slash-menu";
    this.dom.setAttribute("role", "listbox");
    this.render();
    document.body.appendChild(this.dom);
    this.position();
  }

  render() {
    this.dom.textContent = "";
    slashCommands.forEach((command, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `cm-slash-menu-item${
        index === this.activeIndex ? " is-active" : ""
      }`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === this.activeIndex));

      const label = document.createElement("span");
      label.className = "cm-slash-menu-label";
      label.textContent = command.label;

      const description = document.createElement("span");
      description.className = "cm-slash-menu-description";
      description.textContent = command.description;

      item.appendChild(label);
      item.appendChild(description);
      item.addEventListener("mousedown", (event) => event.preventDefault());
      item.addEventListener("mouseenter", () => {
        this.activeIndex = index;
        this.render();
        this.scrollActiveItemIntoView();
      });
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.accept();
      });
      this.dom.appendChild(item);
    });
  }

  sync(update) {
    if (update.docChanged) {
      this.from = update.changes.mapPos(this.from);
      this.to = update.changes.mapPos(this.to);
    }

    const selection = update.state.selection.main;
    const slashStillPresent =
      this.from >= 0 &&
      this.to <= update.state.doc.length &&
      update.state.doc.sliceString(this.from, this.to) === "/";
    if (!selection.empty || selection.from !== this.to || !slashStillPresent) {
      this.closeMenu();
      return;
    }
    this.position();
  }

  move(delta) {
    this.activeIndex =
      (this.activeIndex + delta + slashCommands.length) % slashCommands.length;
    this.render();
    this.scrollActiveItemIntoView();
    this.position();
  }

  accept() {
    const command = slashCommands[this.activeIndex];
    const anchor = this.from + command.cursor;
    const view = this.view;
    const from = this.from;
    const to = this.to;
    this.closeMenu();
    view.dispatch({
      changes: { from, to, insert: command.insert },
      selection: { anchor },
      scrollIntoView: true,
    });
    view.focus();
  }

  position() {
    const coords =
      this.view.coordsAtPos(this.to) || this.view.coordsAtPos(this.from);
    if (!coords) {
      return;
    }
    const menuWidth = 260;
    const menuHeight = Math.min(
      this.dom.offsetHeight || 320,
      window.innerHeight - 24,
    );
    const left = Math.min(
      Math.max(8, coords.left),
      window.innerWidth - menuWidth - 8,
    );
    const spaceBelow = window.innerHeight - coords.bottom - 8;
    const top =
      spaceBelow >= menuHeight
        ? coords.bottom + 6
        : coords.top - menuHeight - 6;
    this.dom.style.left = `${left}px`;
    this.dom.style.top = `${Math.max(
      8,
      Math.min(top, window.innerHeight - menuHeight - 8),
    )}px`;
  }

  scrollActiveItemIntoView() {
    const activeItem = this.dom.querySelector(".cm-slash-menu-item.is-active");
    if (!activeItem) {
      return;
    }
    activeItem.scrollIntoView({ block: "nearest" });
  }

  destroy() {
    this.dom.remove();
  }
}
