// Line-based diff model for the rich Markdown diff view.
//
// VS Code provides the file versions, but the webview renders its own Markdown
// aware side-by-side view. This module returns plain rows with stable line
// numbers so presentation code can stay DOM-focused.

export function splitLines(text) {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}

export function buildDiffRows(leftLines, rightLines) {
  const operations = diffLineOperations(leftLines, rightLines);
  const rows = [];
  let index = 0;

  while (index < operations.length) {
    const operation = operations[index];
    if (operation.type === "equal") {
      rows.push({
        type: "equal",
        left: operation.left,
        right: operation.right,
      });
      index += 1;
      continue;
    }

    // Group adjacent delete/insert operations into replace rows so the UI can
    // display common "changed line" pairs instead of two unrelated blocks.
    const deleted = [];
    const inserted = [];
    while (index < operations.length && operations[index].type !== "equal") {
      if (operations[index].type === "delete") {
        deleted.push(operations[index].left);
      } else {
        inserted.push(operations[index].right);
      }
      index += 1;
    }

    const length = Math.max(deleted.length, inserted.length);
    for (let offset = 0; offset < length; offset += 1) {
      rows.push({
        type:
          deleted[offset] && inserted[offset]
            ? "replace"
            : deleted[offset]
              ? "delete"
              : "insert",
        left: deleted[offset] || null,
        right: inserted[offset] || null,
      });
    }
  }

  return rows;
}

export function diffLineOperations(leftLines, rightLines) {
  const operations = [];
  // Trim common prefix/suffix first. It keeps the dynamic-programming middle
  // smaller and makes large Markdown documents much cheaper to compare.
  let prefix = 0;
  while (
    prefix < leftLines.length &&
    prefix < rightLines.length &&
    leftLines[prefix] === rightLines[prefix]
  ) {
    operations.push({
      type: "equal",
      left: createLine(leftLines[prefix], prefix + 1),
      right: createLine(rightLines[prefix], prefix + 1),
    });
    prefix += 1;
  }

  let leftEnd = leftLines.length - 1;
  let rightEnd = rightLines.length - 1;
  const suffix = [];
  while (
    leftEnd >= prefix &&
    rightEnd >= prefix &&
    leftLines[leftEnd] === rightLines[rightEnd]
  ) {
    suffix.push({
      type: "equal",
      left: createLine(leftLines[leftEnd], leftEnd + 1),
      right: createLine(rightLines[rightEnd], rightEnd + 1),
    });
    leftEnd -= 1;
    rightEnd -= 1;
  }

  const leftMiddle = leftLines.slice(prefix, leftEnd + 1);
  const rightMiddle = rightLines.slice(prefix, rightEnd + 1);
  operations.push(
    ...diffMiddleLines(leftMiddle, rightMiddle, prefix, prefix),
    ...suffix.reverse(),
  );
  return operations;
}

export function diffMiddleLines(leftLines, rightLines, leftOffset, rightOffset) {
  if (leftLines.length === 0) {
    return rightLines.map((text, index) => ({
      type: "insert",
      right: createLine(text, rightOffset + index + 1),
    }));
  }
  if (rightLines.length === 0) {
    return leftLines.map((text, index) => ({
      type: "delete",
      left: createLine(text, leftOffset + index + 1),
    }));
  }

  const cellCount = (leftLines.length + 1) * (rightLines.length + 1);
  if (cellCount > 4_000_000) {
    // Avoid blocking the extension host on very large unrelated documents. The
    // fallback is less precise but still communicates that the range changed.
    return [
      ...leftLines.map((text, index) => ({
        type: "delete",
        left: createLine(text, leftOffset + index + 1),
      })),
      ...rightLines.map((text, index) => ({
        type: "insert",
        right: createLine(text, rightOffset + index + 1),
      })),
    ];
  }

  const width = rightLines.length + 1;
  const dp = new Uint32Array((leftLines.length + 1) * width);
  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (
      let rightIndex = rightLines.length - 1;
      rightIndex >= 0;
      rightIndex -= 1
    ) {
      const current = leftIndex * width + rightIndex;
      dp[current] =
        leftLines[leftIndex] === rightLines[rightIndex]
          ? dp[(leftIndex + 1) * width + rightIndex + 1] + 1
          : Math.max(
              dp[(leftIndex + 1) * width + rightIndex],
              dp[leftIndex * width + rightIndex + 1],
            );
    }
  }

  const operations = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      operations.push({
        type: "equal",
        left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1),
        right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1),
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (
      dp[(leftIndex + 1) * width + rightIndex] >=
      dp[leftIndex * width + rightIndex + 1]
    ) {
      operations.push({
        type: "delete",
        left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1),
      });
      leftIndex += 1;
    } else {
      operations.push({
        type: "insert",
        right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1),
      });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLines.length) {
    operations.push({
      type: "delete",
      left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1),
    });
    leftIndex += 1;
  }

  while (rightIndex < rightLines.length) {
    operations.push({
      type: "insert",
      right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1),
    });
    rightIndex += 1;
  }

  return operations;
}

export function createLine(text, number) {
  return { text, number };
}

export function summarizeRows(rows) {
  return rows.reduce(
    (summary, row) => {
      if (row.type === "insert") summary.added += 1;
      if (row.type === "delete") summary.deleted += 1;
      if (row.type === "replace") {
        summary.added += row.right ? 1 : 0;
        summary.deleted += row.left ? 1 : 0;
      }
      if (row.type !== "equal") summary.changed += 1;
      return summary;
    },
    { added: 0, deleted: 0, changed: 0 },
  );
}
