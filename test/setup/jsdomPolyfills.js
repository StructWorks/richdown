// jsdom implements no layout, so a few methods the webview calls are missing.
// They are stubbed as no-ops: the tests assert on state and DOM structure, never
// on scroll positions the browser would compute.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
