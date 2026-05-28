// highlight.js 11.11.1 does not ship a separate TOML module. Keep a small
// dedicated grammar here so `toml` fences are not registered as INI.
export function tomlLanguage(hljs) {
  const regex = hljs.regex;
  const comment = hljs.COMMENT(/#/, /$/);
  const number = {
    className: "number",
    relevance: 0,
    variants: [
      { begin: /[+-]?0x[\da-fA-F_]+/ },
      { begin: /[+-]?0o[0-7_]+/ },
      { begin: /[+-]?0b[01_]+/ },
      {
        begin:
          /[+-]?(?:\d[\d_]*)(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?/,
      },
    ],
  };
  const dateTime = {
    className: "number",
    begin:
      /\b\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?\b/,
  };
  const literal = {
    className: "literal",
    begin: /\b(?:true|false|inf|nan)\b/,
  };
  const string = {
    className: "string",
    contains: [hljs.BACKSLASH_ESCAPE],
    variants: [
      { begin: /"""/, end: /"""/ },
      { begin: /'''/, end: /'''/ },
      { begin: /"/, end: /"/ },
      { begin: /'/, end: /'/ },
    ],
  };
  const array = {
    begin: /\[/,
    end: /\]/,
    contains: [comment, string, dateTime, number, literal, "self"],
    relevance: 0,
  };
  const bareKey = /[A-Za-z0-9_-]+/;
  const quotedKey = /"(?:\\.|[^"\\])*"|'[^']*'/;
  const key = regex.either(bareKey, quotedKey);
  const dottedKey = regex.concat(
    key,
    "(\\s*\\.\\s*",
    key,
    ")*",
    regex.lookahead(/\s*=/),
  );

  return {
    name: "TOML",
    aliases: ["toml"],
    contains: [
      comment,
      {
        className: "section",
        begin: /^\s*\[\[?/,
        end: /\]?\]/,
      },
      {
        begin: dottedKey,
        className: "attr",
        starts: {
          end: /$/,
          contains: [comment, array, string, dateTime, number, literal],
        },
      },
    ],
  };
}
