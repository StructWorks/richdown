// jsdom implements no layout, so a few methods the webview calls are missing.
// They are stubbed as no-ops: the tests assert on state and DOM structure, never
// on scroll positions the browser would compute.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// CodeMirror measures text through Range rects when it scrolls a position into
// view (the reveal tests do), and jsdom's Range has no geometry at all.
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return [];
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  };
}
