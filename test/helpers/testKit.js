// Test doubles for the CodeMirror types the domain modules read.
//
// The modules under test only ever access a document through 1-based
// `line(number)` lookups and a selection through `ranges`, so these small
// stand-ins keep the tests free of a real EditorState.

export function createDoc(text) {
  const lineTexts = text.split("\n");
  const lines = [];
  let from = 0;
  for (let index = 0; index < lineTexts.length; index += 1) {
    const lineText = lineTexts[index];
    lines.push({
      text: lineText,
      from,
      to: from + lineText.length,
      number: index + 1,
    });
    from += lineText.length + 1;
  }
  return {
    lines: lines.length,
    length: text.length,
    line(number) {
      return lines[number - 1];
    },
  };
}

export function createDocOf(lines) {
  return createDoc(lines.join("\n"));
}

export function createSelection(...ranges) {
  return {
    ranges: ranges.map(([from, to = from]) => ({ from, to })),
  };
}
