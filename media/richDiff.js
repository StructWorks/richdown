(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/highlight.js/lib/core.js
  var require_core = __commonJS({
    "node_modules/highlight.js/lib/core.js"(exports, module) {
      function deepFreeze(obj) {
        if (obj instanceof Map) {
          obj.clear = obj.delete = obj.set = function() {
            throw new Error("map is read-only");
          };
        } else if (obj instanceof Set) {
          obj.add = obj.clear = obj.delete = function() {
            throw new Error("set is read-only");
          };
        }
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach((name) => {
          const prop = obj[name];
          const type = typeof prop;
          if ((type === "object" || type === "function") && !Object.isFrozen(prop)) {
            deepFreeze(prop);
          }
        });
        return obj;
      }
      var Response = class {
        /**
         * @param {CompiledMode} mode
         */
        constructor(mode) {
          if (mode.data === void 0) mode.data = {};
          this.data = mode.data;
          this.isMatchIgnored = false;
        }
        ignoreMatch() {
          this.isMatchIgnored = true;
        }
      };
      function escapeHTML(value) {
        return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
      }
      function inherit$1(original, ...objects) {
        const result = /* @__PURE__ */ Object.create(null);
        for (const key in original) {
          result[key] = original[key];
        }
        objects.forEach(function(obj) {
          for (const key in obj) {
            result[key] = obj[key];
          }
        });
        return (
          /** @type {T} */
          result
        );
      }
      var SPAN_CLOSE = "</span>";
      var emitsWrappingTags = (node) => {
        return !!node.scope;
      };
      var scopeToCSSClass = (name, { prefix }) => {
        if (name.startsWith("language:")) {
          return name.replace("language:", "language-");
        }
        if (name.includes(".")) {
          const pieces = name.split(".");
          return [
            `${prefix}${pieces.shift()}`,
            ...pieces.map((x, i) => `${x}${"_".repeat(i + 1)}`)
          ].join(" ");
        }
        return `${prefix}${name}`;
      };
      var HTMLRenderer = class {
        /**
         * Creates a new HTMLRenderer
         *
         * @param {Tree} parseTree - the parse tree (must support `walk` API)
         * @param {{classPrefix: string}} options
         */
        constructor(parseTree, options) {
          this.buffer = "";
          this.classPrefix = options.classPrefix;
          parseTree.walk(this);
        }
        /**
         * Adds texts to the output stream
         *
         * @param {string} text */
        addText(text) {
          this.buffer += escapeHTML(text);
        }
        /**
         * Adds a node open to the output stream (if needed)
         *
         * @param {Node} node */
        openNode(node) {
          if (!emitsWrappingTags(node)) return;
          const className = scopeToCSSClass(
            node.scope,
            { prefix: this.classPrefix }
          );
          this.span(className);
        }
        /**
         * Adds a node close to the output stream (if needed)
         *
         * @param {Node} node */
        closeNode(node) {
          if (!emitsWrappingTags(node)) return;
          this.buffer += SPAN_CLOSE;
        }
        /**
         * returns the accumulated buffer
        */
        value() {
          return this.buffer;
        }
        // helpers
        /**
         * Builds a span element
         *
         * @param {string} className */
        span(className) {
          this.buffer += `<span class="${className}">`;
        }
      };
      var newNode = (opts = {}) => {
        const result = { children: [] };
        Object.assign(result, opts);
        return result;
      };
      var TokenTree = class _TokenTree {
        constructor() {
          this.rootNode = newNode();
          this.stack = [this.rootNode];
        }
        get top() {
          return this.stack[this.stack.length - 1];
        }
        get root() {
          return this.rootNode;
        }
        /** @param {Node} node */
        add(node) {
          this.top.children.push(node);
        }
        /** @param {string} scope */
        openNode(scope) {
          const node = newNode({ scope });
          this.add(node);
          this.stack.push(node);
        }
        closeNode() {
          if (this.stack.length > 1) {
            return this.stack.pop();
          }
          return void 0;
        }
        closeAllNodes() {
          while (this.closeNode()) ;
        }
        toJSON() {
          return JSON.stringify(this.rootNode, null, 4);
        }
        /**
         * @typedef { import("./html_renderer").Renderer } Renderer
         * @param {Renderer} builder
         */
        walk(builder) {
          return this.constructor._walk(builder, this.rootNode);
        }
        /**
         * @param {Renderer} builder
         * @param {Node} node
         */
        static _walk(builder, node) {
          if (typeof node === "string") {
            builder.addText(node);
          } else if (node.children) {
            builder.openNode(node);
            node.children.forEach((child) => this._walk(builder, child));
            builder.closeNode(node);
          }
          return builder;
        }
        /**
         * @param {Node} node
         */
        static _collapse(node) {
          if (typeof node === "string") return;
          if (!node.children) return;
          if (node.children.every((el) => typeof el === "string")) {
            node.children = [node.children.join("")];
          } else {
            node.children.forEach((child) => {
              _TokenTree._collapse(child);
            });
          }
        }
      };
      var TokenTreeEmitter = class extends TokenTree {
        /**
         * @param {*} options
         */
        constructor(options) {
          super();
          this.options = options;
        }
        /**
         * @param {string} text
         */
        addText(text) {
          if (text === "") {
            return;
          }
          this.add(text);
        }
        /** @param {string} scope */
        startScope(scope) {
          this.openNode(scope);
        }
        endScope() {
          this.closeNode();
        }
        /**
         * @param {Emitter & {root: DataNode}} emitter
         * @param {string} name
         */
        __addSublanguage(emitter, name) {
          const node = emitter.root;
          if (name) node.scope = `language:${name}`;
          this.add(node);
        }
        toHTML() {
          const renderer = new HTMLRenderer(this, this.options);
          return renderer.value();
        }
        finalize() {
          this.closeAllNodes();
          return true;
        }
      };
      function source3(re) {
        if (!re) return null;
        if (typeof re === "string") return re;
        return re.source;
      }
      function lookahead3(re) {
        return concat3("(?=", re, ")");
      }
      function anyNumberOfTimes(re) {
        return concat3("(?:", re, ")*");
      }
      function optional(re) {
        return concat3("(?:", re, ")?");
      }
      function concat3(...args) {
        const joined = args.map((x) => source3(x)).join("");
        return joined;
      }
      function stripOptionsFromArgs3(args) {
        const opts = args[args.length - 1];
        if (typeof opts === "object" && opts.constructor === Object) {
          args.splice(args.length - 1, 1);
          return opts;
        } else {
          return {};
        }
      }
      function either3(...args) {
        const opts = stripOptionsFromArgs3(args);
        const joined = "(" + (opts.capture ? "" : "?:") + args.map((x) => source3(x)).join("|") + ")";
        return joined;
      }
      function countMatchGroups(re) {
        return new RegExp(re.toString() + "|").exec("").length - 1;
      }
      function startsWith(re, lexeme) {
        const match = re && re.exec(lexeme);
        return match && match.index === 0;
      }
      var BACKREF_RE = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;
      function _rewriteBackreferences(regexps, { joinWith }) {
        let numCaptures = 0;
        return regexps.map((regex) => {
          numCaptures += 1;
          const offset = numCaptures;
          let re = source3(regex);
          let out = "";
          while (re.length > 0) {
            const match = BACKREF_RE.exec(re);
            if (!match) {
              out += re;
              break;
            }
            out += re.substring(0, match.index);
            re = re.substring(match.index + match[0].length);
            if (match[0][0] === "\\" && match[1]) {
              out += "\\" + String(Number(match[1]) + offset);
            } else {
              out += match[0];
              if (match[0] === "(") {
                numCaptures++;
              }
            }
          }
          return out;
        }).map((re) => `(${re})`).join(joinWith);
      }
      var MATCH_NOTHING_RE = /\b\B/;
      var IDENT_RE3 = "[a-zA-Z]\\w*";
      var UNDERSCORE_IDENT_RE = "[a-zA-Z_]\\w*";
      var NUMBER_RE = "\\b\\d+(\\.\\d+)?";
      var C_NUMBER_RE = "(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)";
      var BINARY_NUMBER_RE = "\\b(0b[01]+)";
      var RE_STARTERS_RE = "!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~";
      var SHEBANG = (opts = {}) => {
        const beginShebang = /^#![ ]*\//;
        if (opts.binary) {
          opts.begin = concat3(
            beginShebang,
            /.*\b/,
            opts.binary,
            /\b.*/
          );
        }
        return inherit$1({
          scope: "meta",
          begin: beginShebang,
          end: /$/,
          relevance: 0,
          /** @type {ModeCallback} */
          "on:begin": (m, resp) => {
            if (m.index !== 0) resp.ignoreMatch();
          }
        }, opts);
      };
      var BACKSLASH_ESCAPE = {
        begin: "\\\\[\\s\\S]",
        relevance: 0
      };
      var APOS_STRING_MODE = {
        scope: "string",
        begin: "'",
        end: "'",
        illegal: "\\n",
        contains: [BACKSLASH_ESCAPE]
      };
      var QUOTE_STRING_MODE = {
        scope: "string",
        begin: '"',
        end: '"',
        illegal: "\\n",
        contains: [BACKSLASH_ESCAPE]
      };
      var PHRASAL_WORDS_MODE = {
        begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
      };
      var COMMENT = function(begin, end, modeOptions = {}) {
        const mode = inherit$1(
          {
            scope: "comment",
            begin,
            end,
            contains: []
          },
          modeOptions
        );
        mode.contains.push({
          scope: "doctag",
          // hack to avoid the space from being included. the space is necessary to
          // match here to prevent the plain text rule below from gobbling up doctags
          begin: "[ ]*(?=(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):)",
          end: /(TODO|FIXME|NOTE|BUG|OPTIMIZE|HACK|XXX):/,
          excludeBegin: true,
          relevance: 0
        });
        const ENGLISH_WORD = either3(
          // list of common 1 and 2 letter words in English
          "I",
          "a",
          "is",
          "so",
          "us",
          "to",
          "at",
          "if",
          "in",
          "it",
          "on",
          // note: this is not an exhaustive list of contractions, just popular ones
          /[A-Za-z]+['](d|ve|re|ll|t|s|n)/,
          // contractions - can't we'd they're let's, etc
          /[A-Za-z]+[-][a-z]+/,
          // `no-way`, etc.
          /[A-Za-z][a-z]{2,}/
          // allow capitalized words at beginning of sentences
        );
        mode.contains.push(
          {
            // TODO: how to include ", (, ) without breaking grammars that use these for
            // comment delimiters?
            // begin: /[ ]+([()"]?([A-Za-z'-]{3,}|is|a|I|so|us|[tT][oO]|at|if|in|it|on)[.]?[()":]?([.][ ]|[ ]|\))){3}/
            // ---
            // this tries to find sequences of 3 english words in a row (without any
            // "programming" type syntax) this gives us a strong signal that we've
            // TRULY found a comment - vs perhaps scanning with the wrong language.
            // It's possible to find something that LOOKS like the start of the
            // comment - but then if there is no readable text - good chance it is a
            // false match and not a comment.
            //
            // for a visual example please see:
            // https://github.com/highlightjs/highlight.js/issues/2827
            begin: concat3(
              /[ ]+/,
              // necessary to prevent us gobbling up doctags like /* @author Bob Mcgill */
              "(",
              ENGLISH_WORD,
              /[.]?[:]?([.][ ]|[ ])/,
              "){3}"
            )
            // look for 3 words in a row
          }
        );
        return mode;
      };
      var C_LINE_COMMENT_MODE = COMMENT("//", "$");
      var C_BLOCK_COMMENT_MODE = COMMENT("/\\*", "\\*/");
      var HASH_COMMENT_MODE = COMMENT("#", "$");
      var NUMBER_MODE = {
        scope: "number",
        begin: NUMBER_RE,
        relevance: 0
      };
      var C_NUMBER_MODE = {
        scope: "number",
        begin: C_NUMBER_RE,
        relevance: 0
      };
      var BINARY_NUMBER_MODE = {
        scope: "number",
        begin: BINARY_NUMBER_RE,
        relevance: 0
      };
      var REGEXP_MODE = {
        scope: "regexp",
        begin: /\/(?=[^/\n]*\/)/,
        end: /\/[gimuy]*/,
        contains: [
          BACKSLASH_ESCAPE,
          {
            begin: /\[/,
            end: /\]/,
            relevance: 0,
            contains: [BACKSLASH_ESCAPE]
          }
        ]
      };
      var TITLE_MODE = {
        scope: "title",
        begin: IDENT_RE3,
        relevance: 0
      };
      var UNDERSCORE_TITLE_MODE = {
        scope: "title",
        begin: UNDERSCORE_IDENT_RE,
        relevance: 0
      };
      var METHOD_GUARD = {
        // excludes method names from keyword processing
        begin: "\\.\\s*" + UNDERSCORE_IDENT_RE,
        relevance: 0
      };
      var END_SAME_AS_BEGIN = function(mode) {
        return Object.assign(
          mode,
          {
            /** @type {ModeCallback} */
            "on:begin": (m, resp) => {
              resp.data._beginMatch = m[1];
            },
            /** @type {ModeCallback} */
            "on:end": (m, resp) => {
              if (resp.data._beginMatch !== m[1]) resp.ignoreMatch();
            }
          }
        );
      };
      var MODES5 = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        APOS_STRING_MODE,
        BACKSLASH_ESCAPE,
        BINARY_NUMBER_MODE,
        BINARY_NUMBER_RE,
        COMMENT,
        C_BLOCK_COMMENT_MODE,
        C_LINE_COMMENT_MODE,
        C_NUMBER_MODE,
        C_NUMBER_RE,
        END_SAME_AS_BEGIN,
        HASH_COMMENT_MODE,
        IDENT_RE: IDENT_RE3,
        MATCH_NOTHING_RE,
        METHOD_GUARD,
        NUMBER_MODE,
        NUMBER_RE,
        PHRASAL_WORDS_MODE,
        QUOTE_STRING_MODE,
        REGEXP_MODE,
        RE_STARTERS_RE,
        SHEBANG,
        TITLE_MODE,
        UNDERSCORE_IDENT_RE,
        UNDERSCORE_TITLE_MODE
      });
      function skipIfHasPrecedingDot(match, response) {
        const before = match.input[match.index - 1];
        if (before === ".") {
          response.ignoreMatch();
        }
      }
      function scopeClassName(mode, _parent) {
        if (mode.className !== void 0) {
          mode.scope = mode.className;
          delete mode.className;
        }
      }
      function beginKeywords(mode, parent) {
        if (!parent) return;
        if (!mode.beginKeywords) return;
        mode.begin = "\\b(" + mode.beginKeywords.split(" ").join("|") + ")(?!\\.)(?=\\b|\\s)";
        mode.__beforeBegin = skipIfHasPrecedingDot;
        mode.keywords = mode.keywords || mode.beginKeywords;
        delete mode.beginKeywords;
        if (mode.relevance === void 0) mode.relevance = 0;
      }
      function compileIllegal(mode, _parent) {
        if (!Array.isArray(mode.illegal)) return;
        mode.illegal = either3(...mode.illegal);
      }
      function compileMatch(mode, _parent) {
        if (!mode.match) return;
        if (mode.begin || mode.end) throw new Error("begin & end are not supported with match");
        mode.begin = mode.match;
        delete mode.match;
      }
      function compileRelevance(mode, _parent) {
        if (mode.relevance === void 0) mode.relevance = 1;
      }
      var beforeMatchExt = (mode, parent) => {
        if (!mode.beforeMatch) return;
        if (mode.starts) throw new Error("beforeMatch cannot be used with starts");
        const originalMode = Object.assign({}, mode);
        Object.keys(mode).forEach((key) => {
          delete mode[key];
        });
        mode.keywords = originalMode.keywords;
        mode.begin = concat3(originalMode.beforeMatch, lookahead3(originalMode.begin));
        mode.starts = {
          relevance: 0,
          contains: [
            Object.assign(originalMode, { endsParent: true })
          ]
        };
        mode.relevance = 0;
        delete originalMode.beforeMatch;
      };
      var COMMON_KEYWORDS = [
        "of",
        "and",
        "for",
        "in",
        "not",
        "or",
        "if",
        "then",
        "parent",
        // common variable name
        "list",
        // common variable name
        "value"
        // common variable name
      ];
      var DEFAULT_KEYWORD_SCOPE = "keyword";
      function compileKeywords(rawKeywords, caseInsensitive, scopeName = DEFAULT_KEYWORD_SCOPE) {
        const compiledKeywords = /* @__PURE__ */ Object.create(null);
        if (typeof rawKeywords === "string") {
          compileList(scopeName, rawKeywords.split(" "));
        } else if (Array.isArray(rawKeywords)) {
          compileList(scopeName, rawKeywords);
        } else {
          Object.keys(rawKeywords).forEach(function(scopeName2) {
            Object.assign(
              compiledKeywords,
              compileKeywords(rawKeywords[scopeName2], caseInsensitive, scopeName2)
            );
          });
        }
        return compiledKeywords;
        function compileList(scopeName2, keywordList) {
          if (caseInsensitive) {
            keywordList = keywordList.map((x) => x.toLowerCase());
          }
          keywordList.forEach(function(keyword) {
            const pair = keyword.split("|");
            compiledKeywords[pair[0]] = [scopeName2, scoreForKeyword(pair[0], pair[1])];
          });
        }
      }
      function scoreForKeyword(keyword, providedScore) {
        if (providedScore) {
          return Number(providedScore);
        }
        return commonKeyword(keyword) ? 0 : 1;
      }
      function commonKeyword(keyword) {
        return COMMON_KEYWORDS.includes(keyword.toLowerCase());
      }
      var seenDeprecations = {};
      var error = (message) => {
        console.error(message);
      };
      var warn = (message, ...args) => {
        console.log(`WARN: ${message}`, ...args);
      };
      var deprecated = (version2, message) => {
        if (seenDeprecations[`${version2}/${message}`]) return;
        console.log(`Deprecated as of ${version2}. ${message}`);
        seenDeprecations[`${version2}/${message}`] = true;
      };
      var MultiClassError = new Error();
      function remapScopeNames(mode, regexes, { key }) {
        let offset = 0;
        const scopeNames = mode[key];
        const emit = {};
        const positions = {};
        for (let i = 1; i <= regexes.length; i++) {
          positions[i + offset] = scopeNames[i];
          emit[i + offset] = true;
          offset += countMatchGroups(regexes[i - 1]);
        }
        mode[key] = positions;
        mode[key]._emit = emit;
        mode[key]._multi = true;
      }
      function beginMultiClass(mode) {
        if (!Array.isArray(mode.begin)) return;
        if (mode.skip || mode.excludeBegin || mode.returnBegin) {
          error("skip, excludeBegin, returnBegin not compatible with beginScope: {}");
          throw MultiClassError;
        }
        if (typeof mode.beginScope !== "object" || mode.beginScope === null) {
          error("beginScope must be object");
          throw MultiClassError;
        }
        remapScopeNames(mode, mode.begin, { key: "beginScope" });
        mode.begin = _rewriteBackreferences(mode.begin, { joinWith: "" });
      }
      function endMultiClass(mode) {
        if (!Array.isArray(mode.end)) return;
        if (mode.skip || mode.excludeEnd || mode.returnEnd) {
          error("skip, excludeEnd, returnEnd not compatible with endScope: {}");
          throw MultiClassError;
        }
        if (typeof mode.endScope !== "object" || mode.endScope === null) {
          error("endScope must be object");
          throw MultiClassError;
        }
        remapScopeNames(mode, mode.end, { key: "endScope" });
        mode.end = _rewriteBackreferences(mode.end, { joinWith: "" });
      }
      function scopeSugar(mode) {
        if (mode.scope && typeof mode.scope === "object" && mode.scope !== null) {
          mode.beginScope = mode.scope;
          delete mode.scope;
        }
      }
      function MultiClass(mode) {
        scopeSugar(mode);
        if (typeof mode.beginScope === "string") {
          mode.beginScope = { _wrap: mode.beginScope };
        }
        if (typeof mode.endScope === "string") {
          mode.endScope = { _wrap: mode.endScope };
        }
        beginMultiClass(mode);
        endMultiClass(mode);
      }
      function compileLanguage(language) {
        function langRe(value, global) {
          return new RegExp(
            source3(value),
            "m" + (language.case_insensitive ? "i" : "") + (language.unicodeRegex ? "u" : "") + (global ? "g" : "")
          );
        }
        class MultiRegex {
          constructor() {
            this.matchIndexes = {};
            this.regexes = [];
            this.matchAt = 1;
            this.position = 0;
          }
          // @ts-ignore
          addRule(re, opts) {
            opts.position = this.position++;
            this.matchIndexes[this.matchAt] = opts;
            this.regexes.push([opts, re]);
            this.matchAt += countMatchGroups(re) + 1;
          }
          compile() {
            if (this.regexes.length === 0) {
              this.exec = () => null;
            }
            const terminators = this.regexes.map((el) => el[1]);
            this.matcherRe = langRe(_rewriteBackreferences(terminators, { joinWith: "|" }), true);
            this.lastIndex = 0;
          }
          /** @param {string} s */
          exec(s) {
            this.matcherRe.lastIndex = this.lastIndex;
            const match = this.matcherRe.exec(s);
            if (!match) {
              return null;
            }
            const i = match.findIndex((el, i2) => i2 > 0 && el !== void 0);
            const matchData = this.matchIndexes[i];
            match.splice(0, i);
            return Object.assign(match, matchData);
          }
        }
        class ResumableMultiRegex {
          constructor() {
            this.rules = [];
            this.multiRegexes = [];
            this.count = 0;
            this.lastIndex = 0;
            this.regexIndex = 0;
          }
          // @ts-ignore
          getMatcher(index) {
            if (this.multiRegexes[index]) return this.multiRegexes[index];
            const matcher = new MultiRegex();
            this.rules.slice(index).forEach(([re, opts]) => matcher.addRule(re, opts));
            matcher.compile();
            this.multiRegexes[index] = matcher;
            return matcher;
          }
          resumingScanAtSamePosition() {
            return this.regexIndex !== 0;
          }
          considerAll() {
            this.regexIndex = 0;
          }
          // @ts-ignore
          addRule(re, opts) {
            this.rules.push([re, opts]);
            if (opts.type === "begin") this.count++;
          }
          /** @param {string} s */
          exec(s) {
            const m = this.getMatcher(this.regexIndex);
            m.lastIndex = this.lastIndex;
            let result = m.exec(s);
            if (this.resumingScanAtSamePosition()) {
              if (result && result.index === this.lastIndex) ;
              else {
                const m2 = this.getMatcher(0);
                m2.lastIndex = this.lastIndex + 1;
                result = m2.exec(s);
              }
            }
            if (result) {
              this.regexIndex += result.position + 1;
              if (this.regexIndex === this.count) {
                this.considerAll();
              }
            }
            return result;
          }
        }
        function buildModeRegex(mode) {
          const mm = new ResumableMultiRegex();
          mode.contains.forEach((term) => mm.addRule(term.begin, { rule: term, type: "begin" }));
          if (mode.terminatorEnd) {
            mm.addRule(mode.terminatorEnd, { type: "end" });
          }
          if (mode.illegal) {
            mm.addRule(mode.illegal, { type: "illegal" });
          }
          return mm;
        }
        function compileMode(mode, parent) {
          const cmode = (
            /** @type CompiledMode */
            mode
          );
          if (mode.isCompiled) return cmode;
          [
            scopeClassName,
            // do this early so compiler extensions generally don't have to worry about
            // the distinction between match/begin
            compileMatch,
            MultiClass,
            beforeMatchExt
          ].forEach((ext) => ext(mode, parent));
          language.compilerExtensions.forEach((ext) => ext(mode, parent));
          mode.__beforeBegin = null;
          [
            beginKeywords,
            // do this later so compiler extensions that come earlier have access to the
            // raw array if they wanted to perhaps manipulate it, etc.
            compileIllegal,
            // default to 1 relevance if not specified
            compileRelevance
          ].forEach((ext) => ext(mode, parent));
          mode.isCompiled = true;
          let keywordPattern = null;
          if (typeof mode.keywords === "object" && mode.keywords.$pattern) {
            mode.keywords = Object.assign({}, mode.keywords);
            keywordPattern = mode.keywords.$pattern;
            delete mode.keywords.$pattern;
          }
          keywordPattern = keywordPattern || /\w+/;
          if (mode.keywords) {
            mode.keywords = compileKeywords(mode.keywords, language.case_insensitive);
          }
          cmode.keywordPatternRe = langRe(keywordPattern, true);
          if (parent) {
            if (!mode.begin) mode.begin = /\B|\b/;
            cmode.beginRe = langRe(cmode.begin);
            if (!mode.end && !mode.endsWithParent) mode.end = /\B|\b/;
            if (mode.end) cmode.endRe = langRe(cmode.end);
            cmode.terminatorEnd = source3(cmode.end) || "";
            if (mode.endsWithParent && parent.terminatorEnd) {
              cmode.terminatorEnd += (mode.end ? "|" : "") + parent.terminatorEnd;
            }
          }
          if (mode.illegal) cmode.illegalRe = langRe(
            /** @type {RegExp | string} */
            mode.illegal
          );
          if (!mode.contains) mode.contains = [];
          mode.contains = [].concat(...mode.contains.map(function(c2) {
            return expandOrCloneMode(c2 === "self" ? mode : c2);
          }));
          mode.contains.forEach(function(c2) {
            compileMode(
              /** @type Mode */
              c2,
              cmode
            );
          });
          if (mode.starts) {
            compileMode(mode.starts, parent);
          }
          cmode.matcher = buildModeRegex(cmode);
          return cmode;
        }
        if (!language.compilerExtensions) language.compilerExtensions = [];
        if (language.contains && language.contains.includes("self")) {
          throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.");
        }
        language.classNameAliases = inherit$1(language.classNameAliases || {});
        return compileMode(
          /** @type Mode */
          language
        );
      }
      function dependencyOnParent(mode) {
        if (!mode) return false;
        return mode.endsWithParent || dependencyOnParent(mode.starts);
      }
      function expandOrCloneMode(mode) {
        if (mode.variants && !mode.cachedVariants) {
          mode.cachedVariants = mode.variants.map(function(variant) {
            return inherit$1(mode, { variants: null }, variant);
          });
        }
        if (mode.cachedVariants) {
          return mode.cachedVariants;
        }
        if (dependencyOnParent(mode)) {
          return inherit$1(mode, { starts: mode.starts ? inherit$1(mode.starts) : null });
        }
        if (Object.isFrozen(mode)) {
          return inherit$1(mode);
        }
        return mode;
      }
      var version = "11.11.1";
      var HTMLInjectionError = class extends Error {
        constructor(reason, html) {
          super(reason);
          this.name = "HTMLInjectionError";
          this.html = html;
        }
      };
      var escape2 = escapeHTML;
      var inherit = inherit$1;
      var NO_MATCH = /* @__PURE__ */ Symbol("nomatch");
      var MAX_KEYWORD_HITS = 7;
      var HLJS = function(hljs) {
        const languages = /* @__PURE__ */ Object.create(null);
        const aliases = /* @__PURE__ */ Object.create(null);
        const plugins = [];
        let SAFE_MODE = true;
        const LANGUAGE_NOT_FOUND = "Could not find the language '{}', did you forget to load/include a language module?";
        const PLAINTEXT_LANGUAGE = { disableAutodetect: true, name: "Plain text", contains: [] };
        let options = {
          ignoreUnescapedHTML: false,
          throwUnescapedHTML: false,
          noHighlightRe: /^(no-?highlight)$/i,
          languageDetectRe: /\blang(?:uage)?-([\w-]+)\b/i,
          classPrefix: "hljs-",
          cssSelector: "pre code",
          languages: null,
          // beta configuration options, subject to change, welcome to discuss
          // https://github.com/highlightjs/highlight.js/issues/1086
          __emitter: TokenTreeEmitter
        };
        function shouldNotHighlight(languageName) {
          return options.noHighlightRe.test(languageName);
        }
        function blockLanguage(block) {
          let classes = block.className + " ";
          classes += block.parentNode ? block.parentNode.className : "";
          const match = options.languageDetectRe.exec(classes);
          if (match) {
            const language = getLanguage(match[1]);
            if (!language) {
              warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
              warn("Falling back to no-highlight mode for this block.", block);
            }
            return language ? match[1] : "no-highlight";
          }
          return classes.split(/\s+/).find((_class) => shouldNotHighlight(_class) || getLanguage(_class));
        }
        function highlight2(codeOrLanguageName, optionsOrCode, ignoreIllegals) {
          let code = "";
          let languageName = "";
          if (typeof optionsOrCode === "object") {
            code = codeOrLanguageName;
            ignoreIllegals = optionsOrCode.ignoreIllegals;
            languageName = optionsOrCode.language;
          } else {
            deprecated("10.7.0", "highlight(lang, code, ...args) has been deprecated.");
            deprecated("10.7.0", "Please use highlight(code, options) instead.\nhttps://github.com/highlightjs/highlight.js/issues/2277");
            languageName = codeOrLanguageName;
            code = optionsOrCode;
          }
          if (ignoreIllegals === void 0) {
            ignoreIllegals = true;
          }
          const context = {
            code,
            language: languageName
          };
          fire("before:highlight", context);
          const result = context.result ? context.result : _highlight(context.language, context.code, ignoreIllegals);
          result.code = context.code;
          fire("after:highlight", result);
          return result;
        }
        function _highlight(languageName, codeToHighlight, ignoreIllegals, continuation) {
          const keywordHits = /* @__PURE__ */ Object.create(null);
          function keywordData(mode, matchText) {
            return mode.keywords[matchText];
          }
          function processKeywords() {
            if (!top.keywords) {
              emitter.addText(modeBuffer);
              return;
            }
            let lastIndex = 0;
            top.keywordPatternRe.lastIndex = 0;
            let match = top.keywordPatternRe.exec(modeBuffer);
            let buf = "";
            while (match) {
              buf += modeBuffer.substring(lastIndex, match.index);
              const word = language.case_insensitive ? match[0].toLowerCase() : match[0];
              const data = keywordData(top, word);
              if (data) {
                const [kind, keywordRelevance] = data;
                emitter.addText(buf);
                buf = "";
                keywordHits[word] = (keywordHits[word] || 0) + 1;
                if (keywordHits[word] <= MAX_KEYWORD_HITS) relevance += keywordRelevance;
                if (kind.startsWith("_")) {
                  buf += match[0];
                } else {
                  const cssClass = language.classNameAliases[kind] || kind;
                  emitKeyword(match[0], cssClass);
                }
              } else {
                buf += match[0];
              }
              lastIndex = top.keywordPatternRe.lastIndex;
              match = top.keywordPatternRe.exec(modeBuffer);
            }
            buf += modeBuffer.substring(lastIndex);
            emitter.addText(buf);
          }
          function processSubLanguage() {
            if (modeBuffer === "") return;
            let result2 = null;
            if (typeof top.subLanguage === "string") {
              if (!languages[top.subLanguage]) {
                emitter.addText(modeBuffer);
                return;
              }
              result2 = _highlight(top.subLanguage, modeBuffer, true, continuations[top.subLanguage]);
              continuations[top.subLanguage] = /** @type {CompiledMode} */
              result2._top;
            } else {
              result2 = highlightAuto(modeBuffer, top.subLanguage.length ? top.subLanguage : null);
            }
            if (top.relevance > 0) {
              relevance += result2.relevance;
            }
            emitter.__addSublanguage(result2._emitter, result2.language);
          }
          function processBuffer() {
            if (top.subLanguage != null) {
              processSubLanguage();
            } else {
              processKeywords();
            }
            modeBuffer = "";
          }
          function emitKeyword(keyword, scope) {
            if (keyword === "") return;
            emitter.startScope(scope);
            emitter.addText(keyword);
            emitter.endScope();
          }
          function emitMultiClass(scope, match) {
            let i = 1;
            const max = match.length - 1;
            while (i <= max) {
              if (!scope._emit[i]) {
                i++;
                continue;
              }
              const klass = language.classNameAliases[scope[i]] || scope[i];
              const text = match[i];
              if (klass) {
                emitKeyword(text, klass);
              } else {
                modeBuffer = text;
                processKeywords();
                modeBuffer = "";
              }
              i++;
            }
          }
          function startNewMode(mode, match) {
            if (mode.scope && typeof mode.scope === "string") {
              emitter.openNode(language.classNameAliases[mode.scope] || mode.scope);
            }
            if (mode.beginScope) {
              if (mode.beginScope._wrap) {
                emitKeyword(modeBuffer, language.classNameAliases[mode.beginScope._wrap] || mode.beginScope._wrap);
                modeBuffer = "";
              } else if (mode.beginScope._multi) {
                emitMultiClass(mode.beginScope, match);
                modeBuffer = "";
              }
            }
            top = Object.create(mode, { parent: { value: top } });
            return top;
          }
          function endOfMode(mode, match, matchPlusRemainder) {
            let matched = startsWith(mode.endRe, matchPlusRemainder);
            if (matched) {
              if (mode["on:end"]) {
                const resp = new Response(mode);
                mode["on:end"](match, resp);
                if (resp.isMatchIgnored) matched = false;
              }
              if (matched) {
                while (mode.endsParent && mode.parent) {
                  mode = mode.parent;
                }
                return mode;
              }
            }
            if (mode.endsWithParent) {
              return endOfMode(mode.parent, match, matchPlusRemainder);
            }
          }
          function doIgnore(lexeme) {
            if (top.matcher.regexIndex === 0) {
              modeBuffer += lexeme[0];
              return 1;
            } else {
              resumeScanAtSamePosition = true;
              return 0;
            }
          }
          function doBeginMatch(match) {
            const lexeme = match[0];
            const newMode = match.rule;
            const resp = new Response(newMode);
            const beforeCallbacks = [newMode.__beforeBegin, newMode["on:begin"]];
            for (const cb of beforeCallbacks) {
              if (!cb) continue;
              cb(match, resp);
              if (resp.isMatchIgnored) return doIgnore(lexeme);
            }
            if (newMode.skip) {
              modeBuffer += lexeme;
            } else {
              if (newMode.excludeBegin) {
                modeBuffer += lexeme;
              }
              processBuffer();
              if (!newMode.returnBegin && !newMode.excludeBegin) {
                modeBuffer = lexeme;
              }
            }
            startNewMode(newMode, match);
            return newMode.returnBegin ? 0 : lexeme.length;
          }
          function doEndMatch(match) {
            const lexeme = match[0];
            const matchPlusRemainder = codeToHighlight.substring(match.index);
            const endMode = endOfMode(top, match, matchPlusRemainder);
            if (!endMode) {
              return NO_MATCH;
            }
            const origin = top;
            if (top.endScope && top.endScope._wrap) {
              processBuffer();
              emitKeyword(lexeme, top.endScope._wrap);
            } else if (top.endScope && top.endScope._multi) {
              processBuffer();
              emitMultiClass(top.endScope, match);
            } else if (origin.skip) {
              modeBuffer += lexeme;
            } else {
              if (!(origin.returnEnd || origin.excludeEnd)) {
                modeBuffer += lexeme;
              }
              processBuffer();
              if (origin.excludeEnd) {
                modeBuffer = lexeme;
              }
            }
            do {
              if (top.scope) {
                emitter.closeNode();
              }
              if (!top.skip && !top.subLanguage) {
                relevance += top.relevance;
              }
              top = top.parent;
            } while (top !== endMode.parent);
            if (endMode.starts) {
              startNewMode(endMode.starts, match);
            }
            return origin.returnEnd ? 0 : lexeme.length;
          }
          function processContinuations() {
            const list = [];
            for (let current = top; current !== language; current = current.parent) {
              if (current.scope) {
                list.unshift(current.scope);
              }
            }
            list.forEach((item) => emitter.openNode(item));
          }
          let lastMatch = {};
          function processLexeme(textBeforeMatch, match) {
            const lexeme = match && match[0];
            modeBuffer += textBeforeMatch;
            if (lexeme == null) {
              processBuffer();
              return 0;
            }
            if (lastMatch.type === "begin" && match.type === "end" && lastMatch.index === match.index && lexeme === "") {
              modeBuffer += codeToHighlight.slice(match.index, match.index + 1);
              if (!SAFE_MODE) {
                const err = new Error(`0 width match regex (${languageName})`);
                err.languageName = languageName;
                err.badRule = lastMatch.rule;
                throw err;
              }
              return 1;
            }
            lastMatch = match;
            if (match.type === "begin") {
              return doBeginMatch(match);
            } else if (match.type === "illegal" && !ignoreIllegals) {
              const err = new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.scope || "<unnamed>") + '"');
              err.mode = top;
              throw err;
            } else if (match.type === "end") {
              const processed = doEndMatch(match);
              if (processed !== NO_MATCH) {
                return processed;
              }
            }
            if (match.type === "illegal" && lexeme === "") {
              modeBuffer += "\n";
              return 1;
            }
            if (iterations > 1e5 && iterations > match.index * 3) {
              const err = new Error("potential infinite loop, way more iterations than matches");
              throw err;
            }
            modeBuffer += lexeme;
            return lexeme.length;
          }
          const language = getLanguage(languageName);
          if (!language) {
            error(LANGUAGE_NOT_FOUND.replace("{}", languageName));
            throw new Error('Unknown language: "' + languageName + '"');
          }
          const md = compileLanguage(language);
          let result = "";
          let top = continuation || md;
          const continuations = {};
          const emitter = new options.__emitter(options);
          processContinuations();
          let modeBuffer = "";
          let relevance = 0;
          let index = 0;
          let iterations = 0;
          let resumeScanAtSamePosition = false;
          try {
            if (!language.__emitTokens) {
              top.matcher.considerAll();
              for (; ; ) {
                iterations++;
                if (resumeScanAtSamePosition) {
                  resumeScanAtSamePosition = false;
                } else {
                  top.matcher.considerAll();
                }
                top.matcher.lastIndex = index;
                const match = top.matcher.exec(codeToHighlight);
                if (!match) break;
                const beforeMatch = codeToHighlight.substring(index, match.index);
                const processedCount = processLexeme(beforeMatch, match);
                index = match.index + processedCount;
              }
              processLexeme(codeToHighlight.substring(index));
            } else {
              language.__emitTokens(codeToHighlight, emitter);
            }
            emitter.finalize();
            result = emitter.toHTML();
            return {
              language: languageName,
              value: result,
              relevance,
              illegal: false,
              _emitter: emitter,
              _top: top
            };
          } catch (err) {
            if (err.message && err.message.includes("Illegal")) {
              return {
                language: languageName,
                value: escape2(codeToHighlight),
                illegal: true,
                relevance: 0,
                _illegalBy: {
                  message: err.message,
                  index,
                  context: codeToHighlight.slice(index - 100, index + 100),
                  mode: err.mode,
                  resultSoFar: result
                },
                _emitter: emitter
              };
            } else if (SAFE_MODE) {
              return {
                language: languageName,
                value: escape2(codeToHighlight),
                illegal: false,
                relevance: 0,
                errorRaised: err,
                _emitter: emitter,
                _top: top
              };
            } else {
              throw err;
            }
          }
        }
        function justTextHighlightResult(code) {
          const result = {
            value: escape2(code),
            illegal: false,
            relevance: 0,
            _top: PLAINTEXT_LANGUAGE,
            _emitter: new options.__emitter(options)
          };
          result._emitter.addText(code);
          return result;
        }
        function highlightAuto(code, languageSubset) {
          languageSubset = languageSubset || options.languages || Object.keys(languages);
          const plaintext = justTextHighlightResult(code);
          const results = languageSubset.filter(getLanguage).filter(autoDetection).map(
            (name) => _highlight(name, code, false)
          );
          results.unshift(plaintext);
          const sorted = results.sort((a, b) => {
            if (a.relevance !== b.relevance) return b.relevance - a.relevance;
            if (a.language && b.language) {
              if (getLanguage(a.language).supersetOf === b.language) {
                return 1;
              } else if (getLanguage(b.language).supersetOf === a.language) {
                return -1;
              }
            }
            return 0;
          });
          const [best, secondBest] = sorted;
          const result = best;
          result.secondBest = secondBest;
          return result;
        }
        function updateClassName(element, currentLang, resultLang) {
          const language = currentLang && aliases[currentLang] || resultLang;
          element.classList.add("hljs");
          element.classList.add(`language-${language}`);
        }
        function highlightElement(element) {
          let node = null;
          const language = blockLanguage(element);
          if (shouldNotHighlight(language)) return;
          fire(
            "before:highlightElement",
            { el: element, language }
          );
          if (element.dataset.highlighted) {
            console.log("Element previously highlighted. To highlight again, first unset `dataset.highlighted`.", element);
            return;
          }
          if (element.children.length > 0) {
            if (!options.ignoreUnescapedHTML) {
              console.warn("One of your code blocks includes unescaped HTML. This is a potentially serious security risk.");
              console.warn("https://github.com/highlightjs/highlight.js/wiki/security");
              console.warn("The element with unescaped HTML:");
              console.warn(element);
            }
            if (options.throwUnescapedHTML) {
              const err = new HTMLInjectionError(
                "One of your code blocks includes unescaped HTML.",
                element.innerHTML
              );
              throw err;
            }
          }
          node = element;
          const text = node.textContent;
          const result = language ? highlight2(text, { language, ignoreIllegals: true }) : highlightAuto(text);
          element.innerHTML = result.value;
          element.dataset.highlighted = "yes";
          updateClassName(element, language, result.language);
          element.result = {
            language: result.language,
            // TODO: remove with version 11.0
            re: result.relevance,
            relevance: result.relevance
          };
          if (result.secondBest) {
            element.secondBest = {
              language: result.secondBest.language,
              relevance: result.secondBest.relevance
            };
          }
          fire("after:highlightElement", { el: element, result, text });
        }
        function configure(userOptions) {
          options = inherit(options, userOptions);
        }
        const initHighlighting = () => {
          highlightAll();
          deprecated("10.6.0", "initHighlighting() deprecated.  Use highlightAll() now.");
        };
        function initHighlightingOnLoad() {
          highlightAll();
          deprecated("10.6.0", "initHighlightingOnLoad() deprecated.  Use highlightAll() now.");
        }
        let wantsHighlight = false;
        function highlightAll() {
          function boot() {
            highlightAll();
          }
          if (document.readyState === "loading") {
            if (!wantsHighlight) {
              window.addEventListener("DOMContentLoaded", boot, false);
            }
            wantsHighlight = true;
            return;
          }
          const blocks = document.querySelectorAll(options.cssSelector);
          blocks.forEach(highlightElement);
        }
        function registerLanguage(languageName, languageDefinition) {
          let lang = null;
          try {
            lang = languageDefinition(hljs);
          } catch (error$1) {
            error("Language definition for '{}' could not be registered.".replace("{}", languageName));
            if (!SAFE_MODE) {
              throw error$1;
            } else {
              error(error$1);
            }
            lang = PLAINTEXT_LANGUAGE;
          }
          if (!lang.name) lang.name = languageName;
          languages[languageName] = lang;
          lang.rawDefinition = languageDefinition.bind(null, hljs);
          if (lang.aliases) {
            registerAliases(lang.aliases, { languageName });
          }
        }
        function unregisterLanguage(languageName) {
          delete languages[languageName];
          for (const alias of Object.keys(aliases)) {
            if (aliases[alias] === languageName) {
              delete aliases[alias];
            }
          }
        }
        function listLanguages() {
          return Object.keys(languages);
        }
        function getLanguage(name) {
          name = (name || "").toLowerCase();
          return languages[name] || languages[aliases[name]];
        }
        function registerAliases(aliasList, { languageName }) {
          if (typeof aliasList === "string") {
            aliasList = [aliasList];
          }
          aliasList.forEach((alias) => {
            aliases[alias.toLowerCase()] = languageName;
          });
        }
        function autoDetection(name) {
          const lang = getLanguage(name);
          return lang && !lang.disableAutodetect;
        }
        function upgradePluginAPI(plugin) {
          if (plugin["before:highlightBlock"] && !plugin["before:highlightElement"]) {
            plugin["before:highlightElement"] = (data) => {
              plugin["before:highlightBlock"](
                Object.assign({ block: data.el }, data)
              );
            };
          }
          if (plugin["after:highlightBlock"] && !plugin["after:highlightElement"]) {
            plugin["after:highlightElement"] = (data) => {
              plugin["after:highlightBlock"](
                Object.assign({ block: data.el }, data)
              );
            };
          }
        }
        function addPlugin(plugin) {
          upgradePluginAPI(plugin);
          plugins.push(plugin);
        }
        function removePlugin(plugin) {
          const index = plugins.indexOf(plugin);
          if (index !== -1) {
            plugins.splice(index, 1);
          }
        }
        function fire(event, args) {
          const cb = event;
          plugins.forEach(function(plugin) {
            if (plugin[cb]) {
              plugin[cb](args);
            }
          });
        }
        function deprecateHighlightBlock(el) {
          deprecated("10.7.0", "highlightBlock will be removed entirely in v12.0");
          deprecated("10.7.0", "Please use highlightElement now.");
          return highlightElement(el);
        }
        Object.assign(hljs, {
          highlight: highlight2,
          highlightAuto,
          highlightAll,
          highlightElement,
          // TODO: Remove with v12 API
          highlightBlock: deprecateHighlightBlock,
          configure,
          initHighlighting,
          initHighlightingOnLoad,
          registerLanguage,
          unregisterLanguage,
          listLanguages,
          getLanguage,
          registerAliases,
          autoDetection,
          inherit,
          addPlugin,
          removePlugin
        });
        hljs.debugMode = function() {
          SAFE_MODE = false;
        };
        hljs.safeMode = function() {
          SAFE_MODE = true;
        };
        hljs.versionString = version;
        hljs.regex = {
          concat: concat3,
          lookahead: lookahead3,
          either: either3,
          optional,
          anyNumberOfTimes
        };
        for (const key in MODES5) {
          if (typeof MODES5[key] === "object") {
            deepFreeze(MODES5[key]);
          }
        }
        Object.assign(hljs, MODES5);
        return hljs;
      };
      var highlight = HLJS({});
      highlight.newInstance = () => HLJS({});
      module.exports = highlight;
      highlight.HighlightJS = highlight;
      highlight.default = highlight;
    }
  });

  // node_modules/highlight.js/es/core.js
  var import_core = __toESM(require_core(), 1);
  var core_default = import_core.default;

  // node_modules/highlight.js/es/languages/bash.js
  function bash(hljs) {
    const regex = hljs.regex;
    const VAR = {};
    const BRACED_VAR = {
      begin: /\$\{/,
      end: /\}/,
      contains: [
        "self",
        {
          begin: /:-/,
          contains: [VAR]
        }
        // default values
      ]
    };
    Object.assign(VAR, {
      className: "variable",
      variants: [
        { begin: regex.concat(
          /\$[\w\d#@][\w\d_]*/,
          // negative look-ahead tries to avoid matching patterns that are not
          // Perl at all like $ident$, @ident@, etc.
          `(?![\\w\\d])(?![$])`
        ) },
        BRACED_VAR
      ]
    });
    const SUBST = {
      className: "subst",
      begin: /\$\(/,
      end: /\)/,
      contains: [hljs.BACKSLASH_ESCAPE]
    };
    const COMMENT = hljs.inherit(
      hljs.COMMENT(),
      {
        match: [
          /(^|\s)/,
          /#.*$/
        ],
        scope: {
          2: "comment"
        }
      }
    );
    const HERE_DOC = {
      begin: /<<-?\s*(?=\w+)/,
      starts: { contains: [
        hljs.END_SAME_AS_BEGIN({
          begin: /(\w+)/,
          end: /(\w+)/,
          className: "string"
        })
      ] }
    };
    const QUOTE_STRING = {
      className: "string",
      begin: /"/,
      end: /"/,
      contains: [
        hljs.BACKSLASH_ESCAPE,
        VAR,
        SUBST
      ]
    };
    SUBST.contains.push(QUOTE_STRING);
    const ESCAPED_QUOTE = {
      match: /\\"/
    };
    const APOS_STRING = {
      className: "string",
      begin: /'/,
      end: /'/
    };
    const ESCAPED_APOS = {
      match: /\\'/
    };
    const ARITHMETIC = {
      begin: /\$?\(\(/,
      end: /\)\)/,
      contains: [
        {
          begin: /\d+#[0-9a-f]+/,
          className: "number"
        },
        hljs.NUMBER_MODE,
        VAR
      ]
    };
    const SH_LIKE_SHELLS = [
      "fish",
      "bash",
      "zsh",
      "sh",
      "csh",
      "ksh",
      "tcsh",
      "dash",
      "scsh"
    ];
    const KNOWN_SHEBANG = hljs.SHEBANG({
      binary: `(${SH_LIKE_SHELLS.join("|")})`,
      relevance: 10
    });
    const FUNCTION = {
      className: "function",
      begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
      returnBegin: true,
      contains: [hljs.inherit(hljs.TITLE_MODE, { begin: /\w[\w\d_]*/ })],
      relevance: 0
    };
    const KEYWORDS3 = [
      "if",
      "then",
      "else",
      "elif",
      "fi",
      "time",
      "for",
      "while",
      "until",
      "in",
      "do",
      "done",
      "case",
      "esac",
      "coproc",
      "function",
      "select"
    ];
    const LITERALS3 = [
      "true",
      "false"
    ];
    const PATH_MODE = { match: /(\/[a-z._-]+)+/ };
    const SHELL_BUILT_INS = [
      "break",
      "cd",
      "continue",
      "eval",
      "exec",
      "exit",
      "export",
      "getopts",
      "hash",
      "pwd",
      "readonly",
      "return",
      "shift",
      "test",
      "times",
      "trap",
      "umask",
      "unset"
    ];
    const BASH_BUILT_INS = [
      "alias",
      "bind",
      "builtin",
      "caller",
      "command",
      "declare",
      "echo",
      "enable",
      "help",
      "let",
      "local",
      "logout",
      "mapfile",
      "printf",
      "read",
      "readarray",
      "source",
      "sudo",
      "type",
      "typeset",
      "ulimit",
      "unalias"
    ];
    const ZSH_BUILT_INS = [
      "autoload",
      "bg",
      "bindkey",
      "bye",
      "cap",
      "chdir",
      "clone",
      "comparguments",
      "compcall",
      "compctl",
      "compdescribe",
      "compfiles",
      "compgroups",
      "compquote",
      "comptags",
      "comptry",
      "compvalues",
      "dirs",
      "disable",
      "disown",
      "echotc",
      "echoti",
      "emulate",
      "fc",
      "fg",
      "float",
      "functions",
      "getcap",
      "getln",
      "history",
      "integer",
      "jobs",
      "kill",
      "limit",
      "log",
      "noglob",
      "popd",
      "print",
      "pushd",
      "pushln",
      "rehash",
      "sched",
      "setcap",
      "setopt",
      "stat",
      "suspend",
      "ttyctl",
      "unfunction",
      "unhash",
      "unlimit",
      "unsetopt",
      "vared",
      "wait",
      "whence",
      "where",
      "which",
      "zcompile",
      "zformat",
      "zftp",
      "zle",
      "zmodload",
      "zparseopts",
      "zprof",
      "zpty",
      "zregexparse",
      "zsocket",
      "zstyle",
      "ztcp"
    ];
    const GNU_CORE_UTILS = [
      "chcon",
      "chgrp",
      "chown",
      "chmod",
      "cp",
      "dd",
      "df",
      "dir",
      "dircolors",
      "ln",
      "ls",
      "mkdir",
      "mkfifo",
      "mknod",
      "mktemp",
      "mv",
      "realpath",
      "rm",
      "rmdir",
      "shred",
      "sync",
      "touch",
      "truncate",
      "vdir",
      "b2sum",
      "base32",
      "base64",
      "cat",
      "cksum",
      "comm",
      "csplit",
      "cut",
      "expand",
      "fmt",
      "fold",
      "head",
      "join",
      "md5sum",
      "nl",
      "numfmt",
      "od",
      "paste",
      "ptx",
      "pr",
      "sha1sum",
      "sha224sum",
      "sha256sum",
      "sha384sum",
      "sha512sum",
      "shuf",
      "sort",
      "split",
      "sum",
      "tac",
      "tail",
      "tr",
      "tsort",
      "unexpand",
      "uniq",
      "wc",
      "arch",
      "basename",
      "chroot",
      "date",
      "dirname",
      "du",
      "echo",
      "env",
      "expr",
      "factor",
      // "false", // keyword literal already
      "groups",
      "hostid",
      "id",
      "link",
      "logname",
      "nice",
      "nohup",
      "nproc",
      "pathchk",
      "pinky",
      "printenv",
      "printf",
      "pwd",
      "readlink",
      "runcon",
      "seq",
      "sleep",
      "stat",
      "stdbuf",
      "stty",
      "tee",
      "test",
      "timeout",
      // "true", // keyword literal already
      "tty",
      "uname",
      "unlink",
      "uptime",
      "users",
      "who",
      "whoami",
      "yes"
    ];
    return {
      name: "Bash",
      aliases: [
        "sh",
        "zsh"
      ],
      keywords: {
        $pattern: /\b[a-z][a-z0-9._-]+\b/,
        keyword: KEYWORDS3,
        literal: LITERALS3,
        built_in: [
          ...SHELL_BUILT_INS,
          ...BASH_BUILT_INS,
          // Shell modifiers
          "set",
          "shopt",
          ...ZSH_BUILT_INS,
          ...GNU_CORE_UTILS
        ]
      },
      contains: [
        KNOWN_SHEBANG,
        // to catch known shells and boost relevancy
        hljs.SHEBANG(),
        // to catch unknown shells but still highlight the shebang
        FUNCTION,
        ARITHMETIC,
        COMMENT,
        HERE_DOC,
        PATH_MODE,
        QUOTE_STRING,
        ESCAPED_QUOTE,
        APOS_STRING,
        ESCAPED_APOS,
        VAR
      ]
    };
  }

  // node_modules/highlight.js/es/languages/brainfuck.js
  function brainfuck(hljs) {
    const LITERAL = {
      className: "literal",
      begin: /[+-]+/,
      relevance: 0
    };
    return {
      name: "Brainfuck",
      aliases: ["bf"],
      contains: [
        hljs.COMMENT(
          /[^\[\]\.,\+\-<> \r\n]/,
          /[\[\]\.,\+\-<> \r\n]/,
          {
            contains: [
              {
                match: /[ ]+[^\[\]\.,\+\-<> \r\n]/,
                relevance: 0
              }
            ],
            returnEnd: true,
            relevance: 0
          }
        ),
        {
          className: "title",
          begin: "[\\[\\]]",
          relevance: 0
        },
        {
          className: "string",
          begin: "[\\.,]",
          relevance: 0
        },
        {
          // this mode works as the only relevance counter
          // it looks ahead to find the start of a run of literals
          // so only the runs are counted as relevant
          begin: /(?=\+\+|--)/,
          contains: [LITERAL]
        },
        LITERAL
      ]
    };
  }

  // node_modules/highlight.js/es/languages/c.js
  function c(hljs) {
    const regex = hljs.regex;
    const C_LINE_COMMENT_MODE = hljs.COMMENT("//", "$", { contains: [{ begin: /\\\n/ }] });
    const DECLTYPE_AUTO_RE = "decltype\\(auto\\)";
    const NAMESPACE_RE = "[a-zA-Z_]\\w*::";
    const TEMPLATE_ARGUMENT_RE = "<[^<>]+>";
    const FUNCTION_TYPE_RE = "(" + DECLTYPE_AUTO_RE + "|" + regex.optional(NAMESPACE_RE) + "[a-zA-Z_]\\w*" + regex.optional(TEMPLATE_ARGUMENT_RE) + ")";
    const TYPES3 = {
      className: "type",
      variants: [
        { begin: "\\b[a-z\\d_]*_t\\b" },
        { match: /\batomic_[a-z]{3,6}\b/ }
      ]
    };
    const CHARACTER_ESCAPES = "\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)";
    const STRINGS = {
      className: "string",
      variants: [
        {
          begin: '(u8?|U|L)?"',
          end: '"',
          illegal: "\\n",
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: "(u8?|U|L)?'(" + CHARACTER_ESCAPES + "|.)",
          end: "'",
          illegal: "."
        },
        hljs.END_SAME_AS_BEGIN({
          begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,
          end: /\)([^()\\ ]{0,16})"/
        })
      ]
    };
    const NUMBERS = {
      className: "number",
      variants: [
        { match: /\b(0b[01']+)/ },
        { match: /(-?)\b([\d']+(\.[\d']*)?|\.[\d']+)((ll|LL|l|L)(u|U)?|(u|U)(ll|LL|l|L)?|f|F|b|B)/ },
        { match: /(-?)\b(0[xX][a-fA-F0-9]+(?:'[a-fA-F0-9]+)*(?:\.[a-fA-F0-9]*(?:'[a-fA-F0-9]*)*)?(?:[pP][-+]?[0-9]+)?(l|L)?(u|U)?)/ },
        { match: /(-?)\b\d+(?:'\d+)*(?:\.\d*(?:'\d*)*)?(?:[eE][-+]?\d+)?/ }
      ],
      relevance: 0
    };
    const PREPROCESSOR = {
      className: "meta",
      begin: /#\s*[a-z]+\b/,
      end: /$/,
      keywords: { keyword: "if else elif endif define undef warning error line pragma _Pragma ifdef ifndef elifdef elifndef include" },
      contains: [
        {
          begin: /\\\n/,
          relevance: 0
        },
        hljs.inherit(STRINGS, { className: "string" }),
        {
          className: "string",
          begin: /<.*?>/
        },
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE
      ]
    };
    const TITLE_MODE = {
      className: "title",
      begin: regex.optional(NAMESPACE_RE) + hljs.IDENT_RE,
      relevance: 0
    };
    const FUNCTION_TITLE = regex.optional(NAMESPACE_RE) + hljs.IDENT_RE + "\\s*\\(";
    const C_KEYWORDS = [
      "asm",
      "auto",
      "break",
      "case",
      "continue",
      "default",
      "do",
      "else",
      "enum",
      "extern",
      "for",
      "fortran",
      "goto",
      "if",
      "inline",
      "register",
      "restrict",
      "return",
      "sizeof",
      "typeof",
      "typeof_unqual",
      "struct",
      "switch",
      "typedef",
      "union",
      "volatile",
      "while",
      "_Alignas",
      "_Alignof",
      "_Atomic",
      "_Generic",
      "_Noreturn",
      "_Static_assert",
      "_Thread_local",
      // aliases
      "alignas",
      "alignof",
      "noreturn",
      "static_assert",
      "thread_local",
      // not a C keyword but is, for all intents and purposes, treated exactly like one.
      "_Pragma"
    ];
    const C_TYPES = [
      "float",
      "double",
      "signed",
      "unsigned",
      "int",
      "short",
      "long",
      "char",
      "void",
      "_Bool",
      "_BitInt",
      "_Complex",
      "_Imaginary",
      "_Decimal32",
      "_Decimal64",
      "_Decimal96",
      "_Decimal128",
      "_Decimal64x",
      "_Decimal128x",
      "_Float16",
      "_Float32",
      "_Float64",
      "_Float128",
      "_Float32x",
      "_Float64x",
      "_Float128x",
      // modifiers
      "const",
      "static",
      "constexpr",
      // aliases
      "complex",
      "bool",
      "imaginary"
    ];
    const KEYWORDS3 = {
      keyword: C_KEYWORDS,
      type: C_TYPES,
      literal: "true false NULL",
      // TODO: apply hinting work similar to what was done in cpp.js
      built_in: "std string wstring cin cout cerr clog stdin stdout stderr stringstream istringstream ostringstream auto_ptr deque list queue stack vector map set pair bitset multiset multimap unordered_set unordered_map unordered_multiset unordered_multimap priority_queue make_pair array shared_ptr abort terminate abs acos asin atan2 atan calloc ceil cosh cos exit exp fabs floor fmod fprintf fputs free frexp fscanf future isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper isxdigit tolower toupper labs ldexp log10 log malloc realloc memchr memcmp memcpy memset modf pow printf putchar puts scanf sinh sin snprintf sprintf sqrt sscanf strcat strchr strcmp strcpy strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn strstr tanh tan vfprintf vprintf vsprintf endl initializer_list unique_ptr"
    };
    const EXPRESSION_CONTAINS = [
      PREPROCESSOR,
      TYPES3,
      C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      NUMBERS,
      STRINGS
    ];
    const EXPRESSION_CONTEXT = {
      // This mode covers expression context where we can't expect a function
      // definition and shouldn't highlight anything that looks like one:
      // `return some()`, `else if()`, `(x*sum(1, 2))`
      variants: [
        {
          begin: /=/,
          end: /;/
        },
        {
          begin: /\(/,
          end: /\)/
        },
        {
          beginKeywords: "new throw return else",
          end: /;/
        }
      ],
      keywords: KEYWORDS3,
      contains: EXPRESSION_CONTAINS.concat([
        {
          begin: /\(/,
          end: /\)/,
          keywords: KEYWORDS3,
          contains: EXPRESSION_CONTAINS.concat(["self"]),
          relevance: 0
        }
      ]),
      relevance: 0
    };
    const FUNCTION_DECLARATION = {
      begin: "(" + FUNCTION_TYPE_RE + "[\\*&\\s]+)+" + FUNCTION_TITLE,
      returnBegin: true,
      end: /[{;=]/,
      excludeEnd: true,
      keywords: KEYWORDS3,
      illegal: /[^\w\s\*&:<>.]/,
      contains: [
        {
          // to prevent it from being confused as the function title
          begin: DECLTYPE_AUTO_RE,
          keywords: KEYWORDS3,
          relevance: 0
        },
        {
          begin: FUNCTION_TITLE,
          returnBegin: true,
          contains: [hljs.inherit(TITLE_MODE, { className: "title.function" })],
          relevance: 0
        },
        // allow for multiple declarations, e.g.:
        // extern void f(int), g(char);
        {
          relevance: 0,
          match: /,/
        },
        {
          className: "params",
          begin: /\(/,
          end: /\)/,
          keywords: KEYWORDS3,
          relevance: 0,
          contains: [
            C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            STRINGS,
            NUMBERS,
            TYPES3,
            // Count matching parentheses.
            {
              begin: /\(/,
              end: /\)/,
              keywords: KEYWORDS3,
              relevance: 0,
              contains: [
                "self",
                C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                STRINGS,
                NUMBERS,
                TYPES3
              ]
            }
          ]
        },
        TYPES3,
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        PREPROCESSOR
      ]
    };
    return {
      name: "C",
      aliases: ["h"],
      keywords: KEYWORDS3,
      // Until differentiations are added between `c` and `cpp`, `c` will
      // not be auto-detected to avoid auto-detect conflicts between C and C++
      disableAutodetect: true,
      illegal: "</",
      contains: [].concat(
        EXPRESSION_CONTEXT,
        FUNCTION_DECLARATION,
        EXPRESSION_CONTAINS,
        [
          PREPROCESSOR,
          {
            begin: hljs.IDENT_RE + "::",
            keywords: KEYWORDS3
          },
          {
            className: "class",
            beginKeywords: "enum class struct union",
            end: /[{;:<>=]/,
            contains: [
              { beginKeywords: "final class struct" },
              hljs.TITLE_MODE
            ]
          }
        ]
      ),
      exports: {
        preprocessor: PREPROCESSOR,
        strings: STRINGS,
        keywords: KEYWORDS3
      }
    };
  }

  // node_modules/highlight.js/es/languages/clojure.js
  function clojure(hljs) {
    const SYMBOLSTART = "a-zA-Z_\\-!.?+*=<>&'";
    const SYMBOL_RE = "[#]?[" + SYMBOLSTART + "][" + SYMBOLSTART + "0-9/;:$#]*";
    const globals = "def defonce defprotocol defstruct defmulti defmethod defn- defn defmacro deftype defrecord";
    const keywords2 = {
      $pattern: SYMBOL_RE,
      built_in: (
        // Clojure keywords
        globals + " cond apply if-not if-let if not not= =|0 <|0 >|0 <=|0 >=|0 ==|0 +|0 /|0 *|0 -|0 rem quot neg? pos? delay? symbol? keyword? true? false? integer? empty? coll? list? set? ifn? fn? associative? sequential? sorted? counted? reversible? number? decimal? class? distinct? isa? float? rational? reduced? ratio? odd? even? char? seq? vector? string? map? nil? contains? zero? instance? not-every? not-any? libspec? -> ->> .. . inc compare do dotimes mapcat take remove take-while drop letfn drop-last take-last drop-while while intern condp case reduced cycle split-at split-with repeat replicate iterate range merge zipmap declare line-seq sort comparator sort-by dorun doall nthnext nthrest partition eval doseq await await-for let agent atom send send-off release-pending-sends add-watch mapv filterv remove-watch agent-error restart-agent set-error-handler error-handler set-error-mode! error-mode shutdown-agents quote var fn loop recur throw try monitor-enter monitor-exit macroexpand macroexpand-1 for dosync and or when when-not when-let comp juxt partial sequence memoize constantly complement identity assert peek pop doto proxy first rest cons cast coll last butlast sigs reify second ffirst fnext nfirst nnext meta with-meta ns in-ns create-ns import refer keys select-keys vals key val rseq name namespace promise into transient persistent! conj! assoc! dissoc! pop! disj! use class type num float double short byte boolean bigint biginteger bigdec print-method print-dup throw-if printf format load compile get-in update-in pr pr-on newline flush read slurp read-line subvec with-open memfn time re-find re-groups rand-int rand mod locking assert-valid-fdecl alias resolve ref deref refset swap! reset! set-validator! compare-and-set! alter-meta! reset-meta! commute get-validator alter ref-set ref-history-count ref-min-history ref-max-history ensure sync io! new next conj set! to-array future future-call into-array aset gen-class reduce map filter find empty hash-map hash-set sorted-map sorted-map-by sorted-set sorted-set-by vec vector seq flatten reverse assoc dissoc list disj get union difference intersection extend extend-type extend-protocol int nth delay count concat chunk chunk-buffer chunk-append chunk-first chunk-rest max min dec unchecked-inc-int unchecked-inc unchecked-dec-inc unchecked-dec unchecked-negate unchecked-add-int unchecked-add unchecked-subtract-int unchecked-subtract chunk-next chunk-cons chunked-seq? prn vary-meta lazy-seq spread list* str find-keyword keyword symbol gensym force rationalize"
      )
    };
    const SYMBOL = {
      begin: SYMBOL_RE,
      relevance: 0
    };
    const NUMBER = {
      scope: "number",
      relevance: 0,
      variants: [
        { match: /[-+]?0[xX][0-9a-fA-F]+N?/ },
        // hexadecimal                 // 0x2a
        { match: /[-+]?0[0-7]+N?/ },
        // octal                       // 052
        { match: /[-+]?[1-9][0-9]?[rR][0-9a-zA-Z]+N?/ },
        // variable radix from 2 to 36 // 2r101010, 8r52, 36r16
        { match: /[-+]?[0-9]+\/[0-9]+N?/ },
        // ratio                       // 1/2
        { match: /[-+]?[0-9]+((\.[0-9]*([eE][+-]?[0-9]+)?M?)|([eE][+-]?[0-9]+M?|M))/ },
        // float        // 0.42 4.2E-1M 42E1 42M
        { match: /[-+]?([1-9][0-9]*|0)N?/ }
        // int (don't match leading 0) // 42 42N
      ]
    };
    const CHARACTER = {
      scope: "character",
      variants: [
        { match: /\\o[0-3]?[0-7]{1,2}/ },
        // Unicode Octal 0 - 377
        { match: /\\u[0-9a-fA-F]{4}/ },
        // Unicode Hex 0000 - FFFF
        { match: /\\(newline|space|tab|formfeed|backspace|return)/ },
        // special characters
        {
          match: /\\\S/,
          relevance: 0
        }
        // any non-whitespace char
      ]
    };
    const REGEX = {
      scope: "regex",
      begin: /#"/,
      end: /"/,
      contains: [hljs.BACKSLASH_ESCAPE]
    };
    const STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null });
    const COMMA = {
      scope: "punctuation",
      match: /,/,
      relevance: 0
    };
    const COMMENT = hljs.COMMENT(
      ";",
      "$",
      { relevance: 0 }
    );
    const LITERAL = {
      className: "literal",
      begin: /\b(true|false|nil)\b/
    };
    const COLLECTION = {
      begin: "\\[|(#::?" + SYMBOL_RE + ")?\\{",
      end: "[\\]\\}]",
      relevance: 0
    };
    const KEY = {
      className: "symbol",
      begin: "[:]{1,2}" + SYMBOL_RE
    };
    const LIST = {
      begin: "\\(",
      end: "\\)"
    };
    const BODY = {
      endsWithParent: true,
      relevance: 0
    };
    const NAME = {
      keywords: keywords2,
      className: "name",
      begin: SYMBOL_RE,
      relevance: 0,
      starts: BODY
    };
    const DEFAULT_CONTAINS = [
      COMMA,
      LIST,
      CHARACTER,
      REGEX,
      STRING,
      COMMENT,
      KEY,
      COLLECTION,
      NUMBER,
      LITERAL,
      SYMBOL
    ];
    const GLOBAL = {
      beginKeywords: globals,
      keywords: {
        $pattern: SYMBOL_RE,
        keyword: globals
      },
      end: '(\\[|#|\\d|"|:|\\{|\\)|\\(|$)',
      contains: [
        {
          className: "title",
          begin: SYMBOL_RE,
          relevance: 0,
          excludeEnd: true,
          // we can only have a single title
          endsParent: true
        }
      ].concat(DEFAULT_CONTAINS)
    };
    LIST.contains = [
      GLOBAL,
      NAME,
      BODY
    ];
    BODY.contains = DEFAULT_CONTAINS;
    COLLECTION.contains = DEFAULT_CONTAINS;
    return {
      name: "Clojure",
      aliases: [
        "clj",
        "edn"
      ],
      illegal: /\S/,
      contains: [
        COMMA,
        LIST,
        CHARACTER,
        REGEX,
        STRING,
        COMMENT,
        KEY,
        COLLECTION,
        NUMBER,
        LITERAL
      ]
    };
  }

  // node_modules/highlight.js/es/languages/cmake.js
  function cmake(hljs) {
    return {
      name: "CMake",
      aliases: ["cmake.in"],
      case_insensitive: true,
      keywords: { keyword: (
        // scripting commands
        "break cmake_host_system_information cmake_minimum_required cmake_parse_arguments cmake_policy configure_file continue elseif else endforeach endfunction endif endmacro endwhile execute_process file find_file find_library find_package find_path find_program foreach function get_cmake_property get_directory_property get_filename_component get_property if include include_guard list macro mark_as_advanced math message option return separate_arguments set_directory_properties set_property set site_name string unset variable_watch while add_compile_definitions add_compile_options add_custom_command add_custom_target add_definitions add_dependencies add_executable add_library add_link_options add_subdirectory add_test aux_source_directory build_command create_test_sourcelist define_property enable_language enable_testing export fltk_wrap_ui get_source_file_property get_target_property get_test_property include_directories include_external_msproject include_regular_expression install link_directories link_libraries load_cache project qt_wrap_cpp qt_wrap_ui remove_definitions set_source_files_properties set_target_properties set_tests_properties source_group target_compile_definitions target_compile_features target_compile_options target_include_directories target_link_directories target_link_libraries target_link_options target_sources try_compile try_run ctest_build ctest_configure ctest_coverage ctest_empty_binary_directory ctest_memcheck ctest_read_custom_files ctest_run_script ctest_sleep ctest_start ctest_submit ctest_test ctest_update ctest_upload build_name exec_program export_library_dependencies install_files install_programs install_targets load_command make_directory output_required_files remove subdir_depends subdirs use_mangled_mesa utility_source variable_requires write_file qt5_use_modules qt5_use_package qt5_wrap_cpp on off true false and or not command policy target test exists is_newer_than is_directory is_symlink is_absolute matches less greater equal less_equal greater_equal strless strgreater strequal strless_equal strgreater_equal version_less version_greater version_equal version_less_equal version_greater_equal in_list defined"
      ) },
      contains: [
        {
          className: "variable",
          begin: /\$\{/,
          end: /\}/
        },
        hljs.COMMENT(/#\[\[/, /]]/),
        hljs.HASH_COMMENT_MODE,
        hljs.QUOTE_STRING_MODE,
        hljs.NUMBER_MODE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/cpp.js
  function cpp(hljs) {
    const regex = hljs.regex;
    const C_LINE_COMMENT_MODE = hljs.COMMENT("//", "$", { contains: [{ begin: /\\\n/ }] });
    const DECLTYPE_AUTO_RE = "decltype\\(auto\\)";
    const NAMESPACE_RE = "[a-zA-Z_]\\w*::";
    const TEMPLATE_ARGUMENT_RE = "<[^<>]+>";
    const FUNCTION_TYPE_RE = "(?!struct)(" + DECLTYPE_AUTO_RE + "|" + regex.optional(NAMESPACE_RE) + "[a-zA-Z_]\\w*" + regex.optional(TEMPLATE_ARGUMENT_RE) + ")";
    const CPP_PRIMITIVE_TYPES = {
      className: "type",
      begin: "\\b[a-z\\d_]*_t\\b"
    };
    const CHARACTER_ESCAPES = "\\\\(x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4,8}|[0-7]{3}|\\S)";
    const STRINGS = {
      className: "string",
      variants: [
        {
          begin: '(u8?|U|L)?"',
          end: '"',
          illegal: "\\n",
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: "(u8?|U|L)?'(" + CHARACTER_ESCAPES + "|.)",
          end: "'",
          illegal: "."
        },
        hljs.END_SAME_AS_BEGIN({
          begin: /(?:u8?|U|L)?R"([^()\\ ]{0,16})\(/,
          end: /\)([^()\\ ]{0,16})"/
        })
      ]
    };
    const NUMBERS = {
      className: "number",
      variants: [
        // Floating-point literal.
        {
          begin: "[+-]?(?:(?:[0-9](?:'?[0-9])*\\.(?:[0-9](?:'?[0-9])*)?|\\.[0-9](?:'?[0-9])*)(?:[Ee][+-]?[0-9](?:'?[0-9])*)?|[0-9](?:'?[0-9])*[Ee][+-]?[0-9](?:'?[0-9])*|0[Xx](?:[0-9A-Fa-f](?:'?[0-9A-Fa-f])*(?:\\.(?:[0-9A-Fa-f](?:'?[0-9A-Fa-f])*)?)?|\\.[0-9A-Fa-f](?:'?[0-9A-Fa-f])*)[Pp][+-]?[0-9](?:'?[0-9])*)(?:[Ff](?:16|32|64|128)?|(BF|bf)16|[Ll]|)"
        },
        // Integer literal.
        {
          begin: "[+-]?\\b(?:0[Bb][01](?:'?[01])*|0[Xx][0-9A-Fa-f](?:'?[0-9A-Fa-f])*|0(?:'?[0-7])*|[1-9](?:'?[0-9])*)(?:[Uu](?:LL?|ll?)|[Uu][Zz]?|(?:LL?|ll?)[Uu]?|[Zz][Uu]|)"
          // Note: there are user-defined literal suffixes too, but perhaps having the custom suffix not part of the
          // literal highlight actually makes it stand out more.
        }
      ],
      relevance: 0
    };
    const PREPROCESSOR = {
      className: "meta",
      begin: /#\s*[a-z]+\b/,
      end: /$/,
      keywords: { keyword: "if else elif endif define undef warning error line pragma _Pragma ifdef ifndef include" },
      contains: [
        {
          begin: /\\\n/,
          relevance: 0
        },
        hljs.inherit(STRINGS, { className: "string" }),
        {
          className: "string",
          begin: /<.*?>/
        },
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE
      ]
    };
    const TITLE_MODE = {
      className: "title",
      begin: regex.optional(NAMESPACE_RE) + hljs.IDENT_RE,
      relevance: 0
    };
    const FUNCTION_TITLE = regex.optional(NAMESPACE_RE) + hljs.IDENT_RE + "\\s*\\(";
    const RESERVED_KEYWORDS = [
      "alignas",
      "alignof",
      "and",
      "and_eq",
      "asm",
      "atomic_cancel",
      "atomic_commit",
      "atomic_noexcept",
      "auto",
      "bitand",
      "bitor",
      "break",
      "case",
      "catch",
      "class",
      "co_await",
      "co_return",
      "co_yield",
      "compl",
      "concept",
      "const_cast|10",
      "consteval",
      "constexpr",
      "constinit",
      "continue",
      "decltype",
      "default",
      "delete",
      "do",
      "dynamic_cast|10",
      "else",
      "enum",
      "explicit",
      "export",
      "extern",
      "false",
      "final",
      "for",
      "friend",
      "goto",
      "if",
      "import",
      "inline",
      "module",
      "mutable",
      "namespace",
      "new",
      "noexcept",
      "not",
      "not_eq",
      "nullptr",
      "operator",
      "or",
      "or_eq",
      "override",
      "private",
      "protected",
      "public",
      "reflexpr",
      "register",
      "reinterpret_cast|10",
      "requires",
      "return",
      "sizeof",
      "static_assert",
      "static_cast|10",
      "struct",
      "switch",
      "synchronized",
      "template",
      "this",
      "thread_local",
      "throw",
      "transaction_safe",
      "transaction_safe_dynamic",
      "true",
      "try",
      "typedef",
      "typeid",
      "typename",
      "union",
      "using",
      "virtual",
      "volatile",
      "while",
      "xor",
      "xor_eq"
    ];
    const RESERVED_TYPES = [
      "bool",
      "char",
      "char16_t",
      "char32_t",
      "char8_t",
      "double",
      "float",
      "int",
      "long",
      "short",
      "void",
      "wchar_t",
      "unsigned",
      "signed",
      "const",
      "static"
    ];
    const TYPE_HINTS = [
      "any",
      "auto_ptr",
      "barrier",
      "binary_semaphore",
      "bitset",
      "complex",
      "condition_variable",
      "condition_variable_any",
      "counting_semaphore",
      "deque",
      "false_type",
      "flat_map",
      "flat_set",
      "future",
      "imaginary",
      "initializer_list",
      "istringstream",
      "jthread",
      "latch",
      "lock_guard",
      "multimap",
      "multiset",
      "mutex",
      "optional",
      "ostringstream",
      "packaged_task",
      "pair",
      "promise",
      "priority_queue",
      "queue",
      "recursive_mutex",
      "recursive_timed_mutex",
      "scoped_lock",
      "set",
      "shared_future",
      "shared_lock",
      "shared_mutex",
      "shared_timed_mutex",
      "shared_ptr",
      "stack",
      "string_view",
      "stringstream",
      "timed_mutex",
      "thread",
      "true_type",
      "tuple",
      "unique_lock",
      "unique_ptr",
      "unordered_map",
      "unordered_multimap",
      "unordered_multiset",
      "unordered_set",
      "variant",
      "vector",
      "weak_ptr",
      "wstring",
      "wstring_view"
    ];
    const FUNCTION_HINTS = [
      "abort",
      "abs",
      "acos",
      "apply",
      "as_const",
      "asin",
      "atan",
      "atan2",
      "calloc",
      "ceil",
      "cerr",
      "cin",
      "clog",
      "cos",
      "cosh",
      "cout",
      "declval",
      "endl",
      "exchange",
      "exit",
      "exp",
      "fabs",
      "floor",
      "fmod",
      "forward",
      "fprintf",
      "fputs",
      "free",
      "frexp",
      "fscanf",
      "future",
      "invoke",
      "isalnum",
      "isalpha",
      "iscntrl",
      "isdigit",
      "isgraph",
      "islower",
      "isprint",
      "ispunct",
      "isspace",
      "isupper",
      "isxdigit",
      "labs",
      "launder",
      "ldexp",
      "log",
      "log10",
      "make_pair",
      "make_shared",
      "make_shared_for_overwrite",
      "make_tuple",
      "make_unique",
      "malloc",
      "memchr",
      "memcmp",
      "memcpy",
      "memset",
      "modf",
      "move",
      "pow",
      "printf",
      "putchar",
      "puts",
      "realloc",
      "scanf",
      "sin",
      "sinh",
      "snprintf",
      "sprintf",
      "sqrt",
      "sscanf",
      "std",
      "stderr",
      "stdin",
      "stdout",
      "strcat",
      "strchr",
      "strcmp",
      "strcpy",
      "strcspn",
      "strlen",
      "strncat",
      "strncmp",
      "strncpy",
      "strpbrk",
      "strrchr",
      "strspn",
      "strstr",
      "swap",
      "tan",
      "tanh",
      "terminate",
      "to_underlying",
      "tolower",
      "toupper",
      "vfprintf",
      "visit",
      "vprintf",
      "vsprintf"
    ];
    const LITERALS3 = [
      "NULL",
      "false",
      "nullopt",
      "nullptr",
      "true"
    ];
    const BUILT_IN = ["_Pragma"];
    const CPP_KEYWORDS = {
      type: RESERVED_TYPES,
      keyword: RESERVED_KEYWORDS,
      literal: LITERALS3,
      built_in: BUILT_IN,
      _type_hints: TYPE_HINTS
    };
    const FUNCTION_DISPATCH = {
      className: "function.dispatch",
      relevance: 0,
      keywords: {
        // Only for relevance, not highlighting.
        _hint: FUNCTION_HINTS
      },
      begin: regex.concat(
        /\b/,
        /(?!decltype)/,
        /(?!if)/,
        /(?!for)/,
        /(?!switch)/,
        /(?!while)/,
        hljs.IDENT_RE,
        regex.lookahead(/(<[^<>]+>|)\s*\(/)
      )
    };
    const EXPRESSION_CONTAINS = [
      FUNCTION_DISPATCH,
      PREPROCESSOR,
      CPP_PRIMITIVE_TYPES,
      C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      NUMBERS,
      STRINGS
    ];
    const EXPRESSION_CONTEXT = {
      // This mode covers expression context where we can't expect a function
      // definition and shouldn't highlight anything that looks like one:
      // `return some()`, `else if()`, `(x*sum(1, 2))`
      variants: [
        {
          begin: /=/,
          end: /;/
        },
        {
          begin: /\(/,
          end: /\)/
        },
        {
          beginKeywords: "new throw return else",
          end: /;/
        }
      ],
      keywords: CPP_KEYWORDS,
      contains: EXPRESSION_CONTAINS.concat([
        {
          begin: /\(/,
          end: /\)/,
          keywords: CPP_KEYWORDS,
          contains: EXPRESSION_CONTAINS.concat(["self"]),
          relevance: 0
        }
      ]),
      relevance: 0
    };
    const FUNCTION_DECLARATION = {
      className: "function",
      begin: "(" + FUNCTION_TYPE_RE + "[\\*&\\s]+)+" + FUNCTION_TITLE,
      returnBegin: true,
      end: /[{;=]/,
      excludeEnd: true,
      keywords: CPP_KEYWORDS,
      illegal: /[^\w\s\*&:<>.]/,
      contains: [
        {
          // to prevent it from being confused as the function title
          begin: DECLTYPE_AUTO_RE,
          keywords: CPP_KEYWORDS,
          relevance: 0
        },
        {
          begin: FUNCTION_TITLE,
          returnBegin: true,
          contains: [TITLE_MODE],
          relevance: 0
        },
        // needed because we do not have look-behind on the below rule
        // to prevent it from grabbing the final : in a :: pair
        {
          begin: /::/,
          relevance: 0
        },
        // initializers
        {
          begin: /:/,
          endsWithParent: true,
          contains: [
            STRINGS,
            NUMBERS
          ]
        },
        // allow for multiple declarations, e.g.:
        // extern void f(int), g(char);
        {
          relevance: 0,
          match: /,/
        },
        {
          className: "params",
          begin: /\(/,
          end: /\)/,
          keywords: CPP_KEYWORDS,
          relevance: 0,
          contains: [
            C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE,
            STRINGS,
            NUMBERS,
            CPP_PRIMITIVE_TYPES,
            // Count matching parentheses.
            {
              begin: /\(/,
              end: /\)/,
              keywords: CPP_KEYWORDS,
              relevance: 0,
              contains: [
                "self",
                C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                STRINGS,
                NUMBERS,
                CPP_PRIMITIVE_TYPES
              ]
            }
          ]
        },
        CPP_PRIMITIVE_TYPES,
        C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        PREPROCESSOR
      ]
    };
    return {
      name: "C++",
      aliases: [
        "cc",
        "c++",
        "h++",
        "hpp",
        "hh",
        "hxx",
        "cxx"
      ],
      keywords: CPP_KEYWORDS,
      illegal: "</",
      classNameAliases: { "function.dispatch": "built_in" },
      contains: [].concat(
        EXPRESSION_CONTEXT,
        FUNCTION_DECLARATION,
        FUNCTION_DISPATCH,
        EXPRESSION_CONTAINS,
        [
          PREPROCESSOR,
          {
            // containers: ie, `vector <int> rooms (9);`
            begin: "\\b(deque|list|queue|priority_queue|pair|stack|vector|map|set|bitset|multiset|multimap|unordered_map|unordered_set|unordered_multiset|unordered_multimap|array|tuple|optional|variant|function|flat_map|flat_set)\\s*<(?!<)",
            end: ">",
            keywords: CPP_KEYWORDS,
            contains: [
              "self",
              CPP_PRIMITIVE_TYPES
            ]
          },
          {
            begin: hljs.IDENT_RE + "::",
            keywords: CPP_KEYWORDS
          },
          {
            match: [
              // extra complexity to deal with `enum class` and `enum struct`
              /\b(?:enum(?:\s+(?:class|struct))?|class|struct|union)/,
              /\s+/,
              /\w+/
            ],
            className: {
              1: "keyword",
              3: "title.class"
            }
          }
        ]
      )
    };
  }

  // node_modules/highlight.js/es/languages/crystal.js
  function crystal(hljs) {
    const INT_SUFFIX = "(_?[ui](8|16|32|64|128))?";
    const FLOAT_SUFFIX = "(_?f(32|64))?";
    const CRYSTAL_IDENT_RE = "[a-zA-Z_]\\w*[!?=]?";
    const CRYSTAL_METHOD_RE = "[a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|[=!]~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~|]|//|//=|&[-+*]=?|&\\*\\*|\\[\\][=?]?";
    const CRYSTAL_PATH_RE = "[A-Za-z_]\\w*(::\\w+)*(\\?|!)?";
    const CRYSTAL_KEYWORDS = {
      $pattern: CRYSTAL_IDENT_RE,
      keyword: "abstract alias annotation as as? asm begin break case class def do else elsif end ensure enum extend for fun if include instance_sizeof is_a? lib macro module next nil? of out pointerof private protected rescue responds_to? return require select self sizeof struct super then type typeof union uninitialized unless until verbatim when while with yield __DIR__ __END_LINE__ __FILE__ __LINE__",
      literal: "false nil true"
    };
    const SUBST = {
      className: "subst",
      begin: /#\{/,
      end: /\}/,
      keywords: CRYSTAL_KEYWORDS
    };
    const VARIABLE = {
      // negative-look forward attemps to prevent false matches like:
      // @ident@ or $ident$ that might indicate this is not ruby at all
      className: "variable",
      begin: `(\\$\\W)|((\\$|@@?)(\\w+))(?=[^@$?])(?![A-Za-z])(?![@$?'])`
    };
    const EXPANSION = {
      className: "template-variable",
      variants: [
        {
          begin: "\\{\\{",
          end: "\\}\\}"
        },
        {
          begin: "\\{%",
          end: "%\\}"
        }
      ],
      keywords: CRYSTAL_KEYWORDS
    };
    function recursiveParen(begin, end) {
      const contains = [
        {
          begin,
          end
        }
      ];
      contains[0].contains = contains;
      return contains;
    }
    const STRING = {
      className: "string",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ],
      variants: [
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /"/,
          end: /"/
        },
        {
          begin: /`/,
          end: /`/
        },
        {
          begin: "%[Qwi]?\\(",
          end: "\\)",
          contains: recursiveParen("\\(", "\\)")
        },
        {
          begin: "%[Qwi]?\\[",
          end: "\\]",
          contains: recursiveParen("\\[", "\\]")
        },
        {
          begin: "%[Qwi]?\\{",
          end: /\}/,
          contains: recursiveParen(/\{/, /\}/)
        },
        {
          begin: "%[Qwi]?<",
          end: ">",
          contains: recursiveParen("<", ">")
        },
        {
          begin: "%[Qwi]?\\|",
          end: "\\|"
        },
        {
          begin: /<<-\w+$/,
          end: /^\s*\w+$/
        }
      ],
      relevance: 0
    };
    const Q_STRING = {
      className: "string",
      variants: [
        {
          begin: "%q\\(",
          end: "\\)",
          contains: recursiveParen("\\(", "\\)")
        },
        {
          begin: "%q\\[",
          end: "\\]",
          contains: recursiveParen("\\[", "\\]")
        },
        {
          begin: "%q\\{",
          end: /\}/,
          contains: recursiveParen(/\{/, /\}/)
        },
        {
          begin: "%q<",
          end: ">",
          contains: recursiveParen("<", ">")
        },
        {
          begin: "%q\\|",
          end: "\\|"
        },
        {
          begin: /<<-'\w+'$/,
          end: /^\s*\w+$/
        }
      ],
      relevance: 0
    };
    const REGEXP = {
      begin: "(?!%\\})(" + hljs.RE_STARTERS_RE + "|\\n|\\b(case|if|select|unless|until|when|while)\\b)\\s*",
      keywords: "case if select unless until when while",
      contains: [
        {
          className: "regexp",
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ],
          variants: [
            {
              begin: "//[a-z]*",
              relevance: 0
            },
            {
              begin: "/(?!\\/)",
              end: "/[a-z]*"
            }
          ]
        }
      ],
      relevance: 0
    };
    const REGEXP2 = {
      className: "regexp",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ],
      variants: [
        {
          begin: "%r\\(",
          end: "\\)",
          contains: recursiveParen("\\(", "\\)")
        },
        {
          begin: "%r\\[",
          end: "\\]",
          contains: recursiveParen("\\[", "\\]")
        },
        {
          begin: "%r\\{",
          end: /\}/,
          contains: recursiveParen(/\{/, /\}/)
        },
        {
          begin: "%r<",
          end: ">",
          contains: recursiveParen("<", ">")
        },
        {
          begin: "%r\\|",
          end: "\\|"
        }
      ],
      relevance: 0
    };
    const ATTRIBUTE = {
      className: "meta",
      begin: "@\\[",
      end: "\\]",
      contains: [hljs.inherit(hljs.QUOTE_STRING_MODE, { className: "string" })]
    };
    const CRYSTAL_DEFAULT_CONTAINS = [
      EXPANSION,
      STRING,
      Q_STRING,
      REGEXP2,
      REGEXP,
      ATTRIBUTE,
      VARIABLE,
      hljs.HASH_COMMENT_MODE,
      {
        className: "class",
        beginKeywords: "class module struct",
        end: "$|;",
        illegal: /=/,
        contains: [
          hljs.HASH_COMMENT_MODE,
          hljs.inherit(hljs.TITLE_MODE, { begin: CRYSTAL_PATH_RE }),
          {
            // relevance booster for inheritance
            begin: "<"
          }
        ]
      },
      {
        className: "class",
        beginKeywords: "lib enum union",
        end: "$|;",
        illegal: /=/,
        contains: [
          hljs.HASH_COMMENT_MODE,
          hljs.inherit(hljs.TITLE_MODE, { begin: CRYSTAL_PATH_RE })
        ]
      },
      {
        beginKeywords: "annotation",
        end: "$|;",
        illegal: /=/,
        contains: [
          hljs.HASH_COMMENT_MODE,
          hljs.inherit(hljs.TITLE_MODE, { begin: CRYSTAL_PATH_RE })
        ],
        relevance: 2
      },
      {
        className: "function",
        beginKeywords: "def",
        end: /\B\b/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            begin: CRYSTAL_METHOD_RE,
            endsParent: true
          })
        ]
      },
      {
        className: "function",
        beginKeywords: "fun macro",
        end: /\B\b/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {
            begin: CRYSTAL_METHOD_RE,
            endsParent: true
          })
        ],
        relevance: 2
      },
      {
        className: "symbol",
        begin: hljs.UNDERSCORE_IDENT_RE + "(!|\\?)?:",
        relevance: 0
      },
      {
        className: "symbol",
        begin: ":",
        contains: [
          STRING,
          { begin: CRYSTAL_METHOD_RE }
        ],
        relevance: 0
      },
      {
        className: "number",
        variants: [
          { begin: "\\b0b([01_]+)" + INT_SUFFIX },
          { begin: "\\b0o([0-7_]+)" + INT_SUFFIX },
          { begin: "\\b0x([A-Fa-f0-9_]+)" + INT_SUFFIX },
          { begin: "\\b([1-9][0-9_]*[0-9]|[0-9])(\\.[0-9][0-9_]*)?([eE]_?[-+]?[0-9_]*)?" + FLOAT_SUFFIX + "(?!_)" },
          { begin: "\\b([1-9][0-9_]*|0)" + INT_SUFFIX }
        ],
        relevance: 0
      }
    ];
    SUBST.contains = CRYSTAL_DEFAULT_CONTAINS;
    EXPANSION.contains = CRYSTAL_DEFAULT_CONTAINS.slice(1);
    return {
      name: "Crystal",
      aliases: ["cr"],
      keywords: CRYSTAL_KEYWORDS,
      contains: CRYSTAL_DEFAULT_CONTAINS
    };
  }

  // node_modules/highlight.js/es/languages/css.js
  var MODES = (hljs) => {
    return {
      IMPORTANT: {
        scope: "meta",
        begin: "!important"
      },
      BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
      HEXCOLOR: {
        scope: "number",
        begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
      },
      FUNCTION_DISPATCH: {
        className: "built_in",
        begin: /[\w-]+(?=\()/
      },
      ATTRIBUTE_SELECTOR_MODE: {
        scope: "selector-attr",
        begin: /\[/,
        end: /\]/,
        illegal: "$",
        contains: [
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      },
      CSS_NUMBER_MODE: {
        scope: "number",
        begin: hljs.NUMBER_RE + "(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",
        relevance: 0
      },
      CSS_VARIABLE: {
        className: "attr",
        begin: /--[A-Za-z_][A-Za-z0-9_-]*/
      }
    };
  };
  var HTML_TAGS = [
    "a",
    "abbr",
    "address",
    "article",
    "aside",
    "audio",
    "b",
    "blockquote",
    "body",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "dd",
    "del",
    "details",
    "dfn",
    "div",
    "dl",
    "dt",
    "em",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "main",
    "mark",
    "menu",
    "nav",
    "object",
    "ol",
    "optgroup",
    "option",
    "p",
    "picture",
    "q",
    "quote",
    "samp",
    "section",
    "select",
    "source",
    "span",
    "strong",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "tr",
    "ul",
    "var",
    "video"
  ];
  var SVG_TAGS = [
    "defs",
    "g",
    "marker",
    "mask",
    "pattern",
    "svg",
    "switch",
    "symbol",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feFlood",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMorphology",
    "feOffset",
    "feSpecularLighting",
    "feTile",
    "feTurbulence",
    "linearGradient",
    "radialGradient",
    "stop",
    "circle",
    "ellipse",
    "image",
    "line",
    "path",
    "polygon",
    "polyline",
    "rect",
    "text",
    "use",
    "textPath",
    "tspan",
    "foreignObject",
    "clipPath"
  ];
  var TAGS = [
    ...HTML_TAGS,
    ...SVG_TAGS
  ];
  var MEDIA_FEATURES = [
    "any-hover",
    "any-pointer",
    "aspect-ratio",
    "color",
    "color-gamut",
    "color-index",
    "device-aspect-ratio",
    "device-height",
    "device-width",
    "display-mode",
    "forced-colors",
    "grid",
    "height",
    "hover",
    "inverted-colors",
    "monochrome",
    "orientation",
    "overflow-block",
    "overflow-inline",
    "pointer",
    "prefers-color-scheme",
    "prefers-contrast",
    "prefers-reduced-motion",
    "prefers-reduced-transparency",
    "resolution",
    "scan",
    "scripting",
    "update",
    "width",
    // TODO: find a better solution?
    "min-width",
    "max-width",
    "min-height",
    "max-height"
  ].sort().reverse();
  var PSEUDO_CLASSES = [
    "active",
    "any-link",
    "blank",
    "checked",
    "current",
    "default",
    "defined",
    "dir",
    // dir()
    "disabled",
    "drop",
    "empty",
    "enabled",
    "first",
    "first-child",
    "first-of-type",
    "fullscreen",
    "future",
    "focus",
    "focus-visible",
    "focus-within",
    "has",
    // has()
    "host",
    // host or host()
    "host-context",
    // host-context()
    "hover",
    "indeterminate",
    "in-range",
    "invalid",
    "is",
    // is()
    "lang",
    // lang()
    "last-child",
    "last-of-type",
    "left",
    "link",
    "local-link",
    "not",
    // not()
    "nth-child",
    // nth-child()
    "nth-col",
    // nth-col()
    "nth-last-child",
    // nth-last-child()
    "nth-last-col",
    // nth-last-col()
    "nth-last-of-type",
    //nth-last-of-type()
    "nth-of-type",
    //nth-of-type()
    "only-child",
    "only-of-type",
    "optional",
    "out-of-range",
    "past",
    "placeholder-shown",
    "read-only",
    "read-write",
    "required",
    "right",
    "root",
    "scope",
    "target",
    "target-within",
    "user-invalid",
    "valid",
    "visited",
    "where"
    // where()
  ].sort().reverse();
  var PSEUDO_ELEMENTS = [
    "after",
    "backdrop",
    "before",
    "cue",
    "cue-region",
    "first-letter",
    "first-line",
    "grammar-error",
    "marker",
    "part",
    "placeholder",
    "selection",
    "slotted",
    "spelling-error"
  ].sort().reverse();
  var ATTRIBUTES = [
    "accent-color",
    "align-content",
    "align-items",
    "align-self",
    "alignment-baseline",
    "all",
    "anchor-name",
    "animation",
    "animation-composition",
    "animation-delay",
    "animation-direction",
    "animation-duration",
    "animation-fill-mode",
    "animation-iteration-count",
    "animation-name",
    "animation-play-state",
    "animation-range",
    "animation-range-end",
    "animation-range-start",
    "animation-timeline",
    "animation-timing-function",
    "appearance",
    "aspect-ratio",
    "backdrop-filter",
    "backface-visibility",
    "background",
    "background-attachment",
    "background-blend-mode",
    "background-clip",
    "background-color",
    "background-image",
    "background-origin",
    "background-position",
    "background-position-x",
    "background-position-y",
    "background-repeat",
    "background-size",
    "baseline-shift",
    "block-size",
    "border",
    "border-block",
    "border-block-color",
    "border-block-end",
    "border-block-end-color",
    "border-block-end-style",
    "border-block-end-width",
    "border-block-start",
    "border-block-start-color",
    "border-block-start-style",
    "border-block-start-width",
    "border-block-style",
    "border-block-width",
    "border-bottom",
    "border-bottom-color",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "border-bottom-style",
    "border-bottom-width",
    "border-collapse",
    "border-color",
    "border-end-end-radius",
    "border-end-start-radius",
    "border-image",
    "border-image-outset",
    "border-image-repeat",
    "border-image-slice",
    "border-image-source",
    "border-image-width",
    "border-inline",
    "border-inline-color",
    "border-inline-end",
    "border-inline-end-color",
    "border-inline-end-style",
    "border-inline-end-width",
    "border-inline-start",
    "border-inline-start-color",
    "border-inline-start-style",
    "border-inline-start-width",
    "border-inline-style",
    "border-inline-width",
    "border-left",
    "border-left-color",
    "border-left-style",
    "border-left-width",
    "border-radius",
    "border-right",
    "border-right-color",
    "border-right-style",
    "border-right-width",
    "border-spacing",
    "border-start-end-radius",
    "border-start-start-radius",
    "border-style",
    "border-top",
    "border-top-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-top-style",
    "border-top-width",
    "border-width",
    "bottom",
    "box-align",
    "box-decoration-break",
    "box-direction",
    "box-flex",
    "box-flex-group",
    "box-lines",
    "box-ordinal-group",
    "box-orient",
    "box-pack",
    "box-shadow",
    "box-sizing",
    "break-after",
    "break-before",
    "break-inside",
    "caption-side",
    "caret-color",
    "clear",
    "clip",
    "clip-path",
    "clip-rule",
    "color",
    "color-interpolation",
    "color-interpolation-filters",
    "color-profile",
    "color-rendering",
    "color-scheme",
    "column-count",
    "column-fill",
    "column-gap",
    "column-rule",
    "column-rule-color",
    "column-rule-style",
    "column-rule-width",
    "column-span",
    "column-width",
    "columns",
    "contain",
    "contain-intrinsic-block-size",
    "contain-intrinsic-height",
    "contain-intrinsic-inline-size",
    "contain-intrinsic-size",
    "contain-intrinsic-width",
    "container",
    "container-name",
    "container-type",
    "content",
    "content-visibility",
    "counter-increment",
    "counter-reset",
    "counter-set",
    "cue",
    "cue-after",
    "cue-before",
    "cursor",
    "cx",
    "cy",
    "direction",
    "display",
    "dominant-baseline",
    "empty-cells",
    "enable-background",
    "field-sizing",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "flex",
    "flex-basis",
    "flex-direction",
    "flex-flow",
    "flex-grow",
    "flex-shrink",
    "flex-wrap",
    "float",
    "flood-color",
    "flood-opacity",
    "flow",
    "font",
    "font-display",
    "font-family",
    "font-feature-settings",
    "font-kerning",
    "font-language-override",
    "font-optical-sizing",
    "font-palette",
    "font-size",
    "font-size-adjust",
    "font-smooth",
    "font-smoothing",
    "font-stretch",
    "font-style",
    "font-synthesis",
    "font-synthesis-position",
    "font-synthesis-small-caps",
    "font-synthesis-style",
    "font-synthesis-weight",
    "font-variant",
    "font-variant-alternates",
    "font-variant-caps",
    "font-variant-east-asian",
    "font-variant-emoji",
    "font-variant-ligatures",
    "font-variant-numeric",
    "font-variant-position",
    "font-variation-settings",
    "font-weight",
    "forced-color-adjust",
    "gap",
    "glyph-orientation-horizontal",
    "glyph-orientation-vertical",
    "grid",
    "grid-area",
    "grid-auto-columns",
    "grid-auto-flow",
    "grid-auto-rows",
    "grid-column",
    "grid-column-end",
    "grid-column-start",
    "grid-gap",
    "grid-row",
    "grid-row-end",
    "grid-row-start",
    "grid-template",
    "grid-template-areas",
    "grid-template-columns",
    "grid-template-rows",
    "hanging-punctuation",
    "height",
    "hyphenate-character",
    "hyphenate-limit-chars",
    "hyphens",
    "icon",
    "image-orientation",
    "image-rendering",
    "image-resolution",
    "ime-mode",
    "initial-letter",
    "initial-letter-align",
    "inline-size",
    "inset",
    "inset-area",
    "inset-block",
    "inset-block-end",
    "inset-block-start",
    "inset-inline",
    "inset-inline-end",
    "inset-inline-start",
    "isolation",
    "justify-content",
    "justify-items",
    "justify-self",
    "kerning",
    "left",
    "letter-spacing",
    "lighting-color",
    "line-break",
    "line-height",
    "line-height-step",
    "list-style",
    "list-style-image",
    "list-style-position",
    "list-style-type",
    "margin",
    "margin-block",
    "margin-block-end",
    "margin-block-start",
    "margin-bottom",
    "margin-inline",
    "margin-inline-end",
    "margin-inline-start",
    "margin-left",
    "margin-right",
    "margin-top",
    "margin-trim",
    "marker",
    "marker-end",
    "marker-mid",
    "marker-start",
    "marks",
    "mask",
    "mask-border",
    "mask-border-mode",
    "mask-border-outset",
    "mask-border-repeat",
    "mask-border-slice",
    "mask-border-source",
    "mask-border-width",
    "mask-clip",
    "mask-composite",
    "mask-image",
    "mask-mode",
    "mask-origin",
    "mask-position",
    "mask-repeat",
    "mask-size",
    "mask-type",
    "masonry-auto-flow",
    "math-depth",
    "math-shift",
    "math-style",
    "max-block-size",
    "max-height",
    "max-inline-size",
    "max-width",
    "min-block-size",
    "min-height",
    "min-inline-size",
    "min-width",
    "mix-blend-mode",
    "nav-down",
    "nav-index",
    "nav-left",
    "nav-right",
    "nav-up",
    "none",
    "normal",
    "object-fit",
    "object-position",
    "offset",
    "offset-anchor",
    "offset-distance",
    "offset-path",
    "offset-position",
    "offset-rotate",
    "opacity",
    "order",
    "orphans",
    "outline",
    "outline-color",
    "outline-offset",
    "outline-style",
    "outline-width",
    "overflow",
    "overflow-anchor",
    "overflow-block",
    "overflow-clip-margin",
    "overflow-inline",
    "overflow-wrap",
    "overflow-x",
    "overflow-y",
    "overlay",
    "overscroll-behavior",
    "overscroll-behavior-block",
    "overscroll-behavior-inline",
    "overscroll-behavior-x",
    "overscroll-behavior-y",
    "padding",
    "padding-block",
    "padding-block-end",
    "padding-block-start",
    "padding-bottom",
    "padding-inline",
    "padding-inline-end",
    "padding-inline-start",
    "padding-left",
    "padding-right",
    "padding-top",
    "page",
    "page-break-after",
    "page-break-before",
    "page-break-inside",
    "paint-order",
    "pause",
    "pause-after",
    "pause-before",
    "perspective",
    "perspective-origin",
    "place-content",
    "place-items",
    "place-self",
    "pointer-events",
    "position",
    "position-anchor",
    "position-visibility",
    "print-color-adjust",
    "quotes",
    "r",
    "resize",
    "rest",
    "rest-after",
    "rest-before",
    "right",
    "rotate",
    "row-gap",
    "ruby-align",
    "ruby-position",
    "scale",
    "scroll-behavior",
    "scroll-margin",
    "scroll-margin-block",
    "scroll-margin-block-end",
    "scroll-margin-block-start",
    "scroll-margin-bottom",
    "scroll-margin-inline",
    "scroll-margin-inline-end",
    "scroll-margin-inline-start",
    "scroll-margin-left",
    "scroll-margin-right",
    "scroll-margin-top",
    "scroll-padding",
    "scroll-padding-block",
    "scroll-padding-block-end",
    "scroll-padding-block-start",
    "scroll-padding-bottom",
    "scroll-padding-inline",
    "scroll-padding-inline-end",
    "scroll-padding-inline-start",
    "scroll-padding-left",
    "scroll-padding-right",
    "scroll-padding-top",
    "scroll-snap-align",
    "scroll-snap-stop",
    "scroll-snap-type",
    "scroll-timeline",
    "scroll-timeline-axis",
    "scroll-timeline-name",
    "scrollbar-color",
    "scrollbar-gutter",
    "scrollbar-width",
    "shape-image-threshold",
    "shape-margin",
    "shape-outside",
    "shape-rendering",
    "speak",
    "speak-as",
    "src",
    // @font-face
    "stop-color",
    "stop-opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "tab-size",
    "table-layout",
    "text-align",
    "text-align-all",
    "text-align-last",
    "text-anchor",
    "text-combine-upright",
    "text-decoration",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-skip",
    "text-decoration-skip-ink",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-emphasis",
    "text-emphasis-color",
    "text-emphasis-position",
    "text-emphasis-style",
    "text-indent",
    "text-justify",
    "text-orientation",
    "text-overflow",
    "text-rendering",
    "text-shadow",
    "text-size-adjust",
    "text-transform",
    "text-underline-offset",
    "text-underline-position",
    "text-wrap",
    "text-wrap-mode",
    "text-wrap-style",
    "timeline-scope",
    "top",
    "touch-action",
    "transform",
    "transform-box",
    "transform-origin",
    "transform-style",
    "transition",
    "transition-behavior",
    "transition-delay",
    "transition-duration",
    "transition-property",
    "transition-timing-function",
    "translate",
    "unicode-bidi",
    "user-modify",
    "user-select",
    "vector-effect",
    "vertical-align",
    "view-timeline",
    "view-timeline-axis",
    "view-timeline-inset",
    "view-timeline-name",
    "view-transition-name",
    "visibility",
    "voice-balance",
    "voice-duration",
    "voice-family",
    "voice-pitch",
    "voice-range",
    "voice-rate",
    "voice-stress",
    "voice-volume",
    "white-space",
    "white-space-collapse",
    "widows",
    "width",
    "will-change",
    "word-break",
    "word-spacing",
    "word-wrap",
    "writing-mode",
    "x",
    "y",
    "z-index",
    "zoom"
  ].sort().reverse();
  function css(hljs) {
    const regex = hljs.regex;
    const modes = MODES(hljs);
    const VENDOR_PREFIX = { begin: /-(webkit|moz|ms|o)-(?=[a-z])/ };
    const AT_MODIFIERS = "and or not only";
    const AT_PROPERTY_RE = /@-?\w[\w]*(-\w+)*/;
    const IDENT_RE3 = "[a-zA-Z-][a-zA-Z0-9_-]*";
    const STRINGS = [
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE
    ];
    return {
      name: "CSS",
      case_insensitive: true,
      illegal: /[=|'\$]/,
      keywords: { keyframePosition: "from to" },
      classNameAliases: {
        // for visual continuity with `tag {}` and because we
        // don't have a great class for this?
        keyframePosition: "selector-tag"
      },
      contains: [
        modes.BLOCK_COMMENT,
        VENDOR_PREFIX,
        // to recognize keyframe 40% etc which are outside the scope of our
        // attribute value mode
        modes.CSS_NUMBER_MODE,
        {
          className: "selector-id",
          begin: /#[A-Za-z0-9_-]+/,
          relevance: 0
        },
        {
          className: "selector-class",
          begin: "\\." + IDENT_RE3,
          relevance: 0
        },
        modes.ATTRIBUTE_SELECTOR_MODE,
        {
          className: "selector-pseudo",
          variants: [
            { begin: ":(" + PSEUDO_CLASSES.join("|") + ")" },
            { begin: ":(:)?(" + PSEUDO_ELEMENTS.join("|") + ")" }
          ]
        },
        // we may actually need this (12/2020)
        // { // pseudo-selector params
        //   begin: /\(/,
        //   end: /\)/,
        //   contains: [ hljs.CSS_NUMBER_MODE ]
        // },
        modes.CSS_VARIABLE,
        {
          className: "attribute",
          begin: "\\b(" + ATTRIBUTES.join("|") + ")\\b"
        },
        // attribute values
        {
          begin: /:/,
          end: /[;}{]/,
          contains: [
            modes.BLOCK_COMMENT,
            modes.HEXCOLOR,
            modes.IMPORTANT,
            modes.CSS_NUMBER_MODE,
            ...STRINGS,
            // needed to highlight these as strings and to avoid issues with
            // illegal characters that might be inside urls that would tigger the
            // languages illegal stack
            {
              begin: /(url|data-uri)\(/,
              end: /\)/,
              relevance: 0,
              // from keywords
              keywords: { built_in: "url data-uri" },
              contains: [
                ...STRINGS,
                {
                  className: "string",
                  // any character other than `)` as in `url()` will be the start
                  // of a string, which ends with `)` (from the parent mode)
                  begin: /[^)]/,
                  endsWithParent: true,
                  excludeEnd: true
                }
              ]
            },
            modes.FUNCTION_DISPATCH
          ]
        },
        {
          begin: regex.lookahead(/@/),
          end: "[{;]",
          relevance: 0,
          illegal: /:/,
          // break on Less variables @var: ...
          contains: [
            {
              className: "keyword",
              begin: AT_PROPERTY_RE
            },
            {
              begin: /\s/,
              endsWithParent: true,
              excludeEnd: true,
              relevance: 0,
              keywords: {
                $pattern: /[a-z-]+/,
                keyword: AT_MODIFIERS,
                attribute: MEDIA_FEATURES.join(" ")
              },
              contains: [
                {
                  begin: /[a-z-]+(?=:)/,
                  className: "attribute"
                },
                ...STRINGS,
                modes.CSS_NUMBER_MODE
              ]
            }
          ]
        },
        {
          className: "selector-tag",
          begin: "\\b(" + TAGS.join("|") + ")\\b"
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/csharp.js
  function csharp(hljs) {
    const BUILT_IN_KEYWORDS = [
      "bool",
      "byte",
      "char",
      "decimal",
      "delegate",
      "double",
      "dynamic",
      "enum",
      "float",
      "int",
      "long",
      "nint",
      "nuint",
      "object",
      "sbyte",
      "short",
      "string",
      "ulong",
      "uint",
      "ushort"
    ];
    const FUNCTION_MODIFIERS = [
      "public",
      "private",
      "protected",
      "static",
      "internal",
      "protected",
      "abstract",
      "async",
      "extern",
      "override",
      "unsafe",
      "virtual",
      "new",
      "sealed",
      "partial"
    ];
    const LITERAL_KEYWORDS = [
      "default",
      "false",
      "null",
      "true"
    ];
    const NORMAL_KEYWORDS = [
      "abstract",
      "as",
      "base",
      "break",
      "case",
      "catch",
      "class",
      "const",
      "continue",
      "do",
      "else",
      "event",
      "explicit",
      "extern",
      "finally",
      "fixed",
      "for",
      "foreach",
      "goto",
      "if",
      "implicit",
      "in",
      "interface",
      "internal",
      "is",
      "lock",
      "namespace",
      "new",
      "operator",
      "out",
      "override",
      "params",
      "private",
      "protected",
      "public",
      "readonly",
      "record",
      "ref",
      "return",
      "scoped",
      "sealed",
      "sizeof",
      "stackalloc",
      "static",
      "struct",
      "switch",
      "this",
      "throw",
      "try",
      "typeof",
      "unchecked",
      "unsafe",
      "using",
      "virtual",
      "void",
      "volatile",
      "while"
    ];
    const CONTEXTUAL_KEYWORDS = [
      "add",
      "alias",
      "and",
      "ascending",
      "args",
      "async",
      "await",
      "by",
      "descending",
      "dynamic",
      "equals",
      "file",
      "from",
      "get",
      "global",
      "group",
      "init",
      "into",
      "join",
      "let",
      "nameof",
      "not",
      "notnull",
      "on",
      "or",
      "orderby",
      "partial",
      "record",
      "remove",
      "required",
      "scoped",
      "select",
      "set",
      "unmanaged",
      "value|0",
      "var",
      "when",
      "where",
      "with",
      "yield"
    ];
    const KEYWORDS3 = {
      keyword: NORMAL_KEYWORDS.concat(CONTEXTUAL_KEYWORDS),
      built_in: BUILT_IN_KEYWORDS,
      literal: LITERAL_KEYWORDS
    };
    const TITLE_MODE = hljs.inherit(hljs.TITLE_MODE, { begin: "[a-zA-Z](\\.?\\w)*" });
    const NUMBERS = {
      className: "number",
      variants: [
        { begin: "\\b(0b[01']+)" },
        { begin: "(-?)\\b([\\d']+(\\.[\\d']*)?|\\.[\\d']+)(u|U|l|L|ul|UL|f|F|b|B)" },
        { begin: "(-?)(\\b0[xX][a-fA-F0-9']+|(\\b[\\d']+(\\.[\\d']*)?|\\.[\\d']+)([eE][-+]?[\\d']+)?)" }
      ],
      relevance: 0
    };
    const RAW_STRING = {
      className: "string",
      begin: /"""("*)(?!")(.|\n)*?"""\1/,
      relevance: 1
    };
    const VERBATIM_STRING = {
      className: "string",
      begin: '@"',
      end: '"',
      contains: [{ begin: '""' }]
    };
    const VERBATIM_STRING_NO_LF = hljs.inherit(VERBATIM_STRING, { illegal: /\n/ });
    const SUBST = {
      className: "subst",
      begin: /\{/,
      end: /\}/,
      keywords: KEYWORDS3
    };
    const SUBST_NO_LF = hljs.inherit(SUBST, { illegal: /\n/ });
    const INTERPOLATED_STRING = {
      className: "string",
      begin: /\$"/,
      end: '"',
      illegal: /\n/,
      contains: [
        { begin: /\{\{/ },
        { begin: /\}\}/ },
        hljs.BACKSLASH_ESCAPE,
        SUBST_NO_LF
      ]
    };
    const INTERPOLATED_VERBATIM_STRING = {
      className: "string",
      begin: /\$@"/,
      end: '"',
      contains: [
        { begin: /\{\{/ },
        { begin: /\}\}/ },
        { begin: '""' },
        SUBST
      ]
    };
    const INTERPOLATED_VERBATIM_STRING_NO_LF = hljs.inherit(INTERPOLATED_VERBATIM_STRING, {
      illegal: /\n/,
      contains: [
        { begin: /\{\{/ },
        { begin: /\}\}/ },
        { begin: '""' },
        SUBST_NO_LF
      ]
    });
    SUBST.contains = [
      INTERPOLATED_VERBATIM_STRING,
      INTERPOLATED_STRING,
      VERBATIM_STRING,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      NUMBERS,
      hljs.C_BLOCK_COMMENT_MODE
    ];
    SUBST_NO_LF.contains = [
      INTERPOLATED_VERBATIM_STRING_NO_LF,
      INTERPOLATED_STRING,
      VERBATIM_STRING_NO_LF,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      NUMBERS,
      hljs.inherit(hljs.C_BLOCK_COMMENT_MODE, { illegal: /\n/ })
    ];
    const STRING = { variants: [
      RAW_STRING,
      INTERPOLATED_VERBATIM_STRING,
      INTERPOLATED_STRING,
      VERBATIM_STRING,
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE
    ] };
    const GENERIC_MODIFIER = {
      begin: "<",
      end: ">",
      contains: [
        { beginKeywords: "in out" },
        TITLE_MODE
      ]
    };
    const TYPE_IDENT_RE = hljs.IDENT_RE + "(<" + hljs.IDENT_RE + "(\\s*,\\s*" + hljs.IDENT_RE + ")*>)?(\\[\\])?";
    const AT_IDENTIFIER = {
      // prevents expressions like `@class` from incorrect flagging
      // `class` as a keyword
      begin: "@" + hljs.IDENT_RE,
      relevance: 0
    };
    return {
      name: "C#",
      aliases: [
        "cs",
        "c#"
      ],
      keywords: KEYWORDS3,
      illegal: /::/,
      contains: [
        hljs.COMMENT(
          "///",
          "$",
          {
            returnBegin: true,
            contains: [
              {
                className: "doctag",
                variants: [
                  {
                    begin: "///",
                    relevance: 0
                  },
                  { begin: "<!--|-->" },
                  {
                    begin: "</?",
                    end: ">"
                  }
                ]
              }
            ]
          }
        ),
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          className: "meta",
          begin: "#",
          end: "$",
          keywords: { keyword: "if else elif endif define undef warning error line region endregion pragma checksum" }
        },
        STRING,
        NUMBERS,
        {
          beginKeywords: "class interface",
          relevance: 0,
          end: /[{;=]/,
          illegal: /[^\s:,]/,
          contains: [
            { beginKeywords: "where class" },
            TITLE_MODE,
            GENERIC_MODIFIER,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        {
          beginKeywords: "namespace",
          relevance: 0,
          end: /[{;=]/,
          illegal: /[^\s:]/,
          contains: [
            TITLE_MODE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        {
          beginKeywords: "record",
          relevance: 0,
          end: /[{;=]/,
          illegal: /[^\s:]/,
          contains: [
            TITLE_MODE,
            GENERIC_MODIFIER,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        {
          // [Attributes("")]
          className: "meta",
          begin: "^\\s*\\[(?=[\\w])",
          excludeBegin: true,
          end: "\\]",
          excludeEnd: true,
          contains: [
            {
              className: "string",
              begin: /"/,
              end: /"/
            }
          ]
        },
        {
          // Expression keywords prevent 'keyword Name(...)' from being
          // recognized as a function definition
          beginKeywords: "new return throw await else",
          relevance: 0
        },
        {
          className: "function",
          begin: "(" + TYPE_IDENT_RE + "\\s+)+" + hljs.IDENT_RE + "\\s*(<[^=]+>\\s*)?\\(",
          returnBegin: true,
          end: /\s*[{;=]/,
          excludeEnd: true,
          keywords: KEYWORDS3,
          contains: [
            // prevents these from being highlighted `title`
            {
              beginKeywords: FUNCTION_MODIFIERS.join(" "),
              relevance: 0
            },
            {
              begin: hljs.IDENT_RE + "\\s*(<[^=]+>\\s*)?\\(",
              returnBegin: true,
              contains: [
                hljs.TITLE_MODE,
                GENERIC_MODIFIER
              ],
              relevance: 0
            },
            { match: /\(\)/ },
            {
              className: "params",
              begin: /\(/,
              end: /\)/,
              excludeBegin: true,
              excludeEnd: true,
              keywords: KEYWORDS3,
              relevance: 0,
              contains: [
                STRING,
                NUMBERS,
                hljs.C_BLOCK_COMMENT_MODE
              ]
            },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        AT_IDENTIFIER
      ]
    };
  }

  // node_modules/highlight.js/es/languages/d.js
  function d(hljs) {
    const D_KEYWORDS = {
      $pattern: hljs.UNDERSCORE_IDENT_RE,
      keyword: "abstract alias align asm assert auto body break byte case cast catch class const continue debug default delete deprecated do else enum export extern final finally for foreach foreach_reverse|10 goto if immutable import in inout int interface invariant is lazy macro mixin module new nothrow out override package pragma private protected public pure ref return scope shared static struct super switch synchronized template this throw try typedef typeid typeof union unittest version void volatile while with __FILE__ __LINE__ __gshared|10 __thread __traits __DATE__ __EOF__ __TIME__ __TIMESTAMP__ __VENDOR__ __VERSION__",
      built_in: "bool cdouble cent cfloat char creal dchar delegate double dstring float function idouble ifloat ireal long real short string ubyte ucent uint ulong ushort wchar wstring",
      literal: "false null true"
    };
    const decimal_integer_re = "(0|[1-9][\\d_]*)";
    const decimal_integer_nosus_re = "(0|[1-9][\\d_]*|\\d[\\d_]*|[\\d_]+?\\d)";
    const binary_integer_re = "0[bB][01_]+";
    const hexadecimal_digits_re = "([\\da-fA-F][\\da-fA-F_]*|_[\\da-fA-F][\\da-fA-F_]*)";
    const hexadecimal_integer_re = "0[xX]" + hexadecimal_digits_re;
    const decimal_exponent_re = "([eE][+-]?" + decimal_integer_nosus_re + ")";
    const decimal_float_re = "(" + decimal_integer_nosus_re + "(\\.\\d*|" + decimal_exponent_re + ")|\\d+\\." + decimal_integer_nosus_re + "|\\." + decimal_integer_re + decimal_exponent_re + "?)";
    const hexadecimal_float_re = "(0[xX](" + hexadecimal_digits_re + "\\." + hexadecimal_digits_re + "|\\.?" + hexadecimal_digits_re + ")[pP][+-]?" + decimal_integer_nosus_re + ")";
    const integer_re = "(" + decimal_integer_re + "|" + binary_integer_re + "|" + hexadecimal_integer_re + ")";
    const float_re = "(" + hexadecimal_float_re + "|" + decimal_float_re + ")";
    const escape_sequence_re = `\\\\(['"\\?\\\\abfnrtv]|u[\\dA-Fa-f]{4}|[0-7]{1,3}|x[\\dA-Fa-f]{2}|U[\\dA-Fa-f]{8})|&[a-zA-Z\\d]{2,};`;
    const D_INTEGER_MODE = {
      className: "number",
      begin: "\\b" + integer_re + "(L|u|U|Lu|LU|uL|UL)?",
      relevance: 0
    };
    const D_FLOAT_MODE = {
      className: "number",
      begin: "\\b(" + float_re + "([fF]|L|i|[fF]i|Li)?|" + integer_re + "(i|[fF]i|Li))",
      relevance: 0
    };
    const D_CHARACTER_MODE = {
      className: "string",
      begin: "'(" + escape_sequence_re + "|.)",
      end: "'",
      illegal: "."
    };
    const D_ESCAPE_SEQUENCE = {
      begin: escape_sequence_re,
      relevance: 0
    };
    const D_STRING_MODE = {
      className: "string",
      begin: '"',
      contains: [D_ESCAPE_SEQUENCE],
      end: '"[cwd]?'
    };
    const D_WYSIWYG_DELIMITED_STRING_MODE = {
      className: "string",
      begin: '[rq]"',
      end: '"[cwd]?',
      relevance: 5
    };
    const D_ALTERNATE_WYSIWYG_STRING_MODE = {
      className: "string",
      begin: "`",
      end: "`[cwd]?"
    };
    const D_HEX_STRING_MODE = {
      className: "string",
      begin: 'x"[\\da-fA-F\\s\\n\\r]*"[cwd]?',
      relevance: 10
    };
    const D_TOKEN_STRING_MODE = {
      className: "string",
      begin: 'q"\\{',
      end: '\\}"'
    };
    const D_HASHBANG_MODE = {
      className: "meta",
      begin: "^#!",
      end: "$",
      relevance: 5
    };
    const D_SPECIAL_TOKEN_SEQUENCE_MODE = {
      className: "meta",
      begin: "#(line)",
      end: "$",
      relevance: 5
    };
    const D_ATTRIBUTE_MODE = {
      className: "keyword",
      begin: "@[a-zA-Z_][a-zA-Z_\\d]*"
    };
    const D_NESTING_COMMENT_MODE = hljs.COMMENT(
      "\\/\\+",
      "\\+\\/",
      {
        contains: ["self"],
        relevance: 10
      }
    );
    return {
      name: "D",
      keywords: D_KEYWORDS,
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        D_NESTING_COMMENT_MODE,
        D_HEX_STRING_MODE,
        D_STRING_MODE,
        D_WYSIWYG_DELIMITED_STRING_MODE,
        D_ALTERNATE_WYSIWYG_STRING_MODE,
        D_TOKEN_STRING_MODE,
        D_FLOAT_MODE,
        D_INTEGER_MODE,
        D_CHARACTER_MODE,
        D_HASHBANG_MODE,
        D_SPECIAL_TOKEN_SEQUENCE_MODE,
        D_ATTRIBUTE_MODE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/dart.js
  function dart(hljs) {
    const SUBST = {
      className: "subst",
      variants: [{ begin: "\\$[A-Za-z0-9_]+" }]
    };
    const BRACED_SUBST = {
      className: "subst",
      variants: [
        {
          begin: /\$\{/,
          end: /\}/
        }
      ],
      keywords: "true false null this is new super"
    };
    const NUMBER = {
      className: "number",
      relevance: 0,
      variants: [
        { match: /\b[0-9][0-9_]*(\.[0-9][0-9_]*)?([eE][+-]?[0-9][0-9_]*)?\b/ },
        { match: /\b0[xX][0-9A-Fa-f][0-9A-Fa-f_]*\b/ }
      ]
    };
    const STRING = {
      className: "string",
      variants: [
        {
          begin: "r'''",
          end: "'''"
        },
        {
          begin: 'r"""',
          end: '"""'
        },
        {
          begin: "r'",
          end: "'",
          illegal: "\\n"
        },
        {
          begin: 'r"',
          end: '"',
          illegal: "\\n"
        },
        {
          begin: "'''",
          end: "'''",
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST,
            BRACED_SUBST
          ]
        },
        {
          begin: '"""',
          end: '"""',
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST,
            BRACED_SUBST
          ]
        },
        {
          begin: "'",
          end: "'",
          illegal: "\\n",
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST,
            BRACED_SUBST
          ]
        },
        {
          begin: '"',
          end: '"',
          illegal: "\\n",
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST,
            BRACED_SUBST
          ]
        }
      ]
    };
    BRACED_SUBST.contains = [
      NUMBER,
      STRING
    ];
    const BUILT_IN_TYPES = [
      // dart:core
      "Comparable",
      "DateTime",
      "Duration",
      "Function",
      "Iterable",
      "Iterator",
      "List",
      "Map",
      "Match",
      "Object",
      "Pattern",
      "RegExp",
      "Set",
      "Stopwatch",
      "String",
      "StringBuffer",
      "StringSink",
      "Symbol",
      "Type",
      "Uri",
      "bool",
      "double",
      "int",
      "num",
      // dart:html
      "Element",
      "ElementList"
    ];
    const NULLABLE_BUILT_IN_TYPES = BUILT_IN_TYPES.map((e) => `${e}?`);
    const BASIC_KEYWORDS = [
      "abstract",
      "as",
      "assert",
      "async",
      "await",
      "base",
      "break",
      "case",
      "catch",
      "class",
      "const",
      "continue",
      "covariant",
      "default",
      "deferred",
      "do",
      "dynamic",
      "else",
      "enum",
      "export",
      "extends",
      "extension",
      "external",
      "factory",
      "false",
      "final",
      "finally",
      "for",
      "Function",
      "get",
      "hide",
      "if",
      "implements",
      "import",
      "in",
      "interface",
      "is",
      "late",
      "library",
      "mixin",
      "new",
      "null",
      "on",
      "operator",
      "part",
      "required",
      "rethrow",
      "return",
      "sealed",
      "set",
      "show",
      "static",
      "super",
      "switch",
      "sync",
      "this",
      "throw",
      "true",
      "try",
      "typedef",
      "var",
      "void",
      "when",
      "while",
      "with",
      "yield"
    ];
    const KEYWORDS3 = {
      keyword: BASIC_KEYWORDS,
      built_in: BUILT_IN_TYPES.concat(NULLABLE_BUILT_IN_TYPES).concat([
        // dart:core
        "Never",
        "Null",
        "dynamic",
        "print",
        // dart:html
        "document",
        "querySelector",
        "querySelectorAll",
        "window"
      ]),
      $pattern: /[A-Za-z][A-Za-z0-9_]*\??/
    };
    return {
      name: "Dart",
      keywords: KEYWORDS3,
      contains: [
        STRING,
        hljs.COMMENT(
          /\/\*\*(?!\/)/,
          /\*\//,
          {
            subLanguage: "markdown",
            relevance: 0
          }
        ),
        hljs.COMMENT(
          /\/{3,} ?/,
          /$/,
          { contains: [
            {
              subLanguage: "markdown",
              begin: ".",
              end: "$",
              relevance: 0
            }
          ] }
        ),
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          className: "class",
          beginKeywords: "class interface",
          end: /\{/,
          excludeEnd: true,
          contains: [
            { beginKeywords: "extends implements" },
            hljs.UNDERSCORE_TITLE_MODE
          ]
        },
        NUMBER,
        {
          className: "meta",
          begin: "@[A-Za-z]+"
        },
        {
          begin: "=>"
          // No markup, just a relevance booster
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/diff.js
  function diff(hljs) {
    const regex = hljs.regex;
    return {
      name: "Diff",
      aliases: ["patch"],
      contains: [
        {
          className: "meta",
          relevance: 10,
          match: regex.either(
            /^@@ +-\d+,\d+ +\+\d+,\d+ +@@/,
            /^\*\*\* +\d+,\d+ +\*\*\*\*$/,
            /^--- +\d+,\d+ +----$/
          )
        },
        {
          className: "comment",
          variants: [
            {
              begin: regex.either(
                /Index: /,
                /^index/,
                /={3,}/,
                /^-{3}/,
                /^\*{3} /,
                /^\+{3}/,
                /^diff --git/
              ),
              end: /$/
            },
            { match: /^\*{15}$/ }
          ]
        },
        {
          className: "addition",
          begin: /^\+/,
          end: /$/
        },
        {
          className: "deletion",
          begin: /^-/,
          end: /$/
        },
        {
          className: "addition",
          begin: /^!/,
          end: /$/
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/dockerfile.js
  function dockerfile(hljs) {
    const KEYWORDS3 = [
      "from",
      "maintainer",
      "expose",
      "env",
      "arg",
      "user",
      "onbuild",
      "stopsignal"
    ];
    return {
      name: "Dockerfile",
      aliases: ["docker"],
      case_insensitive: true,
      keywords: KEYWORDS3,
      contains: [
        hljs.HASH_COMMENT_MODE,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        hljs.NUMBER_MODE,
        {
          beginKeywords: "run cmd entrypoint volume add copy workdir label healthcheck shell",
          starts: {
            end: /[^\\]$/,
            subLanguage: "bash"
          }
        }
      ],
      illegal: "</"
    };
  }

  // node_modules/highlight.js/es/languages/elixir.js
  function elixir(hljs) {
    const regex = hljs.regex;
    const ELIXIR_IDENT_RE = "[a-zA-Z_][a-zA-Z0-9_.]*(!|\\?)?";
    const ELIXIR_METHOD_RE = "[a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?";
    const KEYWORDS3 = [
      "after",
      "alias",
      "and",
      "case",
      "catch",
      "cond",
      "defstruct",
      "defguard",
      "do",
      "else",
      "end",
      "fn",
      "for",
      "if",
      "import",
      "in",
      "not",
      "or",
      "quote",
      "raise",
      "receive",
      "require",
      "reraise",
      "rescue",
      "try",
      "unless",
      "unquote",
      "unquote_splicing",
      "use",
      "when",
      "with|0"
    ];
    const LITERALS3 = [
      "false",
      "nil",
      "true"
    ];
    const KWS = {
      $pattern: ELIXIR_IDENT_RE,
      keyword: KEYWORDS3,
      literal: LITERALS3
    };
    const SUBST = {
      className: "subst",
      begin: /#\{/,
      end: /\}/,
      keywords: KWS
    };
    const NUMBER = {
      className: "number",
      begin: "(\\b0o[0-7_]+)|(\\b0b[01_]+)|(\\b0x[0-9a-fA-F_]+)|(-?\\b[0-9][0-9_]*(\\.[0-9_]+([eE][-+]?[0-9]+)?)?)",
      relevance: 0
    };
    const ESCAPES_RE = /\\[\s\S]/;
    const BACKSLASH_ESCAPE = {
      match: ESCAPES_RE,
      scope: "char.escape",
      relevance: 0
    };
    const SIGIL_DELIMITERS = `[/|([{<"']`;
    const SIGIL_DELIMITER_MODES = [
      {
        begin: /"/,
        end: /"/
      },
      {
        begin: /'/,
        end: /'/
      },
      {
        begin: /\//,
        end: /\//
      },
      {
        begin: /\|/,
        end: /\|/
      },
      {
        begin: /\(/,
        end: /\)/
      },
      {
        begin: /\[/,
        end: /\]/
      },
      {
        begin: /\{/,
        end: /\}/
      },
      {
        begin: /</,
        end: />/
      }
    ];
    const escapeSigilEnd = (end) => {
      return {
        scope: "char.escape",
        begin: regex.concat(/\\/, end),
        relevance: 0
      };
    };
    const LOWERCASE_SIGIL = {
      className: "string",
      begin: "~[a-z](?=" + SIGIL_DELIMITERS + ")",
      contains: SIGIL_DELIMITER_MODES.map((x) => hljs.inherit(
        x,
        { contains: [
          escapeSigilEnd(x.end),
          BACKSLASH_ESCAPE,
          SUBST
        ] }
      ))
    };
    const UPCASE_SIGIL = {
      className: "string",
      begin: "~[A-Z](?=" + SIGIL_DELIMITERS + ")",
      contains: SIGIL_DELIMITER_MODES.map((x) => hljs.inherit(
        x,
        { contains: [escapeSigilEnd(x.end)] }
      ))
    };
    const REGEX_SIGIL = {
      className: "regex",
      variants: [
        {
          begin: "~r(?=" + SIGIL_DELIMITERS + ")",
          contains: SIGIL_DELIMITER_MODES.map((x) => hljs.inherit(
            x,
            {
              end: regex.concat(x.end, /[uismxfU]{0,7}/),
              contains: [
                escapeSigilEnd(x.end),
                BACKSLASH_ESCAPE,
                SUBST
              ]
            }
          ))
        },
        {
          begin: "~R(?=" + SIGIL_DELIMITERS + ")",
          contains: SIGIL_DELIMITER_MODES.map(
            (x) => hljs.inherit(
              x,
              {
                end: regex.concat(x.end, /[uismxfU]{0,7}/),
                contains: [escapeSigilEnd(x.end)]
              }
            )
          )
        }
      ]
    };
    const STRING = {
      className: "string",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ],
      variants: [
        {
          begin: /"""/,
          end: /"""/
        },
        {
          begin: /'''/,
          end: /'''/
        },
        {
          begin: /~S"""/,
          end: /"""/,
          contains: []
          // override default
        },
        {
          begin: /~S"/,
          end: /"/,
          contains: []
          // override default
        },
        {
          begin: /~S'''/,
          end: /'''/,
          contains: []
          // override default
        },
        {
          begin: /~S'/,
          end: /'/,
          contains: []
          // override default
        },
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /"/,
          end: /"/
        }
      ]
    };
    const FUNCTION = {
      className: "function",
      beginKeywords: "def defp defmacro defmacrop",
      end: /\B\b/,
      // the mode is ended by the title
      contains: [
        hljs.inherit(hljs.TITLE_MODE, {
          begin: ELIXIR_IDENT_RE,
          endsParent: true
        })
      ]
    };
    const CLASS = hljs.inherit(FUNCTION, {
      className: "class",
      beginKeywords: "defimpl defmodule defprotocol defrecord",
      end: /\bdo\b|$|;/
    });
    const ELIXIR_DEFAULT_CONTAINS = [
      STRING,
      REGEX_SIGIL,
      UPCASE_SIGIL,
      LOWERCASE_SIGIL,
      hljs.HASH_COMMENT_MODE,
      CLASS,
      FUNCTION,
      { begin: "::" },
      {
        className: "symbol",
        begin: ":(?![\\s:])",
        contains: [
          STRING,
          { begin: ELIXIR_METHOD_RE }
        ],
        relevance: 0
      },
      {
        className: "symbol",
        begin: ELIXIR_IDENT_RE + ":(?!:)",
        relevance: 0
      },
      {
        // Usage of a module, struct, etc.
        className: "title.class",
        begin: /(\b[A-Z][a-zA-Z0-9_]+)/,
        relevance: 0
      },
      NUMBER,
      {
        className: "variable",
        begin: "(\\$\\W)|((\\$|@@?)(\\w+))"
      }
      // -> has been removed, capnproto always uses this grammar construct
    ];
    SUBST.contains = ELIXIR_DEFAULT_CONTAINS;
    return {
      name: "Elixir",
      aliases: [
        "ex",
        "exs"
      ],
      keywords: KWS,
      contains: ELIXIR_DEFAULT_CONTAINS
    };
  }

  // node_modules/highlight.js/es/languages/elm.js
  function elm(hljs) {
    const COMMENT = { variants: [
      hljs.COMMENT("--", "$"),
      hljs.COMMENT(
        /\{-/,
        /-\}/,
        { contains: ["self"] }
      )
    ] };
    const CONSTRUCTOR = {
      className: "type",
      begin: "\\b[A-Z][\\w']*",
      // TODO: other constructors (built-in, infix).
      relevance: 0
    };
    const LIST = {
      begin: "\\(",
      end: "\\)",
      illegal: '"',
      contains: [
        {
          className: "type",
          begin: "\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?"
        },
        COMMENT
      ]
    };
    const RECORD = {
      begin: /\{/,
      end: /\}/,
      contains: LIST.contains
    };
    const CHARACTER = {
      className: "string",
      begin: "'\\\\?.",
      end: "'",
      illegal: "."
    };
    const KEYWORDS3 = [
      "let",
      "in",
      "if",
      "then",
      "else",
      "case",
      "of",
      "where",
      "module",
      "import",
      "exposing",
      "type",
      "alias",
      "as",
      "infix",
      "infixl",
      "infixr",
      "port",
      "effect",
      "command",
      "subscription"
    ];
    return {
      name: "Elm",
      keywords: KEYWORDS3,
      contains: [
        // Top-level constructions.
        {
          beginKeywords: "port effect module",
          end: "exposing",
          keywords: "port effect module where command subscription exposing",
          contains: [
            LIST,
            COMMENT
          ],
          illegal: "\\W\\.|;"
        },
        {
          begin: "import",
          end: "$",
          keywords: "import as exposing",
          contains: [
            LIST,
            COMMENT
          ],
          illegal: "\\W\\.|;"
        },
        {
          begin: "type",
          end: "$",
          keywords: "type alias",
          contains: [
            CONSTRUCTOR,
            LIST,
            RECORD,
            COMMENT
          ]
        },
        {
          beginKeywords: "infix infixl infixr",
          end: "$",
          contains: [
            hljs.C_NUMBER_MODE,
            COMMENT
          ]
        },
        {
          begin: "port",
          end: "$",
          keywords: "port",
          contains: [COMMENT]
        },
        // Literals and names.
        CHARACTER,
        hljs.QUOTE_STRING_MODE,
        hljs.C_NUMBER_MODE,
        CONSTRUCTOR,
        hljs.inherit(hljs.TITLE_MODE, { begin: "^[_a-z][\\w']*" }),
        COMMENT,
        {
          // No markup, relevance booster
          begin: "->|<-"
        }
      ],
      illegal: /;/
    };
  }

  // node_modules/highlight.js/es/languages/erlang.js
  function erlang(hljs) {
    const BASIC_ATOM_RE = "[a-z'][a-zA-Z0-9_']*";
    const FUNCTION_NAME_RE = "(" + BASIC_ATOM_RE + ":" + BASIC_ATOM_RE + "|" + BASIC_ATOM_RE + ")";
    const ERLANG_RESERVED = {
      keyword: "after and andalso|10 band begin bnot bor bsl bzr bxor case catch cond div end fun if let not of orelse|10 query receive rem try when xor maybe else",
      literal: "false true"
    };
    const COMMENT = hljs.COMMENT("%", "$");
    const NUMBER = {
      className: "number",
      begin: "\\b(\\d+(_\\d+)*#[a-fA-F0-9]+(_[a-fA-F0-9]+)*|\\d+(_\\d+)*(\\.\\d+(_\\d+)*)?([eE][-+]?\\d+)?)",
      relevance: 0
    };
    const NAMED_FUN = { begin: "fun\\s+" + BASIC_ATOM_RE + "/\\d+" };
    const FUNCTION_CALL = {
      begin: FUNCTION_NAME_RE + "\\(",
      end: "\\)",
      returnBegin: true,
      relevance: 0,
      contains: [
        {
          begin: FUNCTION_NAME_RE,
          relevance: 0
        },
        {
          begin: "\\(",
          end: "\\)",
          endsWithParent: true,
          returnEnd: true,
          relevance: 0
          // "contains" defined later
        }
      ]
    };
    const TUPLE = {
      begin: /\{/,
      end: /\}/,
      relevance: 0
      // "contains" defined later
    };
    const VAR1 = {
      begin: "\\b_([A-Z][A-Za-z0-9_]*)?",
      relevance: 0
    };
    const VAR2 = {
      begin: "[A-Z][a-zA-Z0-9_]*",
      relevance: 0
    };
    const RECORD_ACCESS = {
      begin: "#" + hljs.UNDERSCORE_IDENT_RE,
      relevance: 0,
      returnBegin: true,
      contains: [
        {
          begin: "#" + hljs.UNDERSCORE_IDENT_RE,
          relevance: 0
        },
        {
          begin: /\{/,
          end: /\}/,
          relevance: 0
          // "contains" defined later
        }
      ]
    };
    const CHAR_LITERAL = {
      scope: "string",
      match: /\$(\\([^0-9]|[0-9]{1,3}|)|.)/
    };
    const TRIPLE_QUOTE = {
      scope: "string",
      match: /"""("*)(?!")[\s\S]*?"""\1/
    };
    const SIGIL = {
      scope: "string",
      contains: [hljs.BACKSLASH_ESCAPE],
      variants: [
        { match: /~\w?"""("*)(?!")[\s\S]*?"""\1/ },
        { begin: /~\w?\(/, end: /\)/ },
        { begin: /~\w?\[/, end: /\]/ },
        { begin: /~\w?{/, end: /}/ },
        { begin: /~\w?</, end: />/ },
        { begin: /~\w?\//, end: /\// },
        { begin: /~\w?\|/, end: /\|/ },
        { begin: /~\w?'/, end: /'/ },
        { begin: /~\w?"/, end: /"/ },
        { begin: /~\w?`/, end: /`/ },
        { begin: /~\w?#/, end: /#/ }
      ]
    };
    const BLOCK_STATEMENTS = {
      beginKeywords: "fun receive if try case maybe",
      end: "end",
      keywords: ERLANG_RESERVED
    };
    BLOCK_STATEMENTS.contains = [
      COMMENT,
      NAMED_FUN,
      hljs.inherit(hljs.APOS_STRING_MODE, { className: "" }),
      BLOCK_STATEMENTS,
      FUNCTION_CALL,
      SIGIL,
      TRIPLE_QUOTE,
      hljs.QUOTE_STRING_MODE,
      NUMBER,
      TUPLE,
      VAR1,
      VAR2,
      RECORD_ACCESS,
      CHAR_LITERAL
    ];
    const BASIC_MODES = [
      COMMENT,
      NAMED_FUN,
      BLOCK_STATEMENTS,
      FUNCTION_CALL,
      SIGIL,
      TRIPLE_QUOTE,
      hljs.QUOTE_STRING_MODE,
      NUMBER,
      TUPLE,
      VAR1,
      VAR2,
      RECORD_ACCESS,
      CHAR_LITERAL
    ];
    FUNCTION_CALL.contains[1].contains = BASIC_MODES;
    TUPLE.contains = BASIC_MODES;
    RECORD_ACCESS.contains[1].contains = BASIC_MODES;
    const DIRECTIVES = [
      "-module",
      "-record",
      "-undef",
      "-export",
      "-ifdef",
      "-ifndef",
      "-author",
      "-copyright",
      "-doc",
      "-moduledoc",
      "-vsn",
      "-import",
      "-include",
      "-include_lib",
      "-compile",
      "-define",
      "-else",
      "-endif",
      "-file",
      "-behaviour",
      "-behavior",
      "-spec",
      "-on_load",
      "-nifs"
    ];
    const PARAMS = {
      className: "params",
      begin: "\\(",
      end: "\\)",
      contains: BASIC_MODES
    };
    return {
      name: "Erlang",
      aliases: ["erl"],
      keywords: ERLANG_RESERVED,
      illegal: "(</|\\*=|\\+=|-=|/\\*|\\*/|\\(\\*|\\*\\))",
      contains: [
        {
          className: "function",
          begin: "^" + BASIC_ATOM_RE + "\\s*\\(",
          end: "->",
          returnBegin: true,
          illegal: "\\(|#|//|/\\*|\\\\|:|;",
          contains: [
            PARAMS,
            hljs.inherit(hljs.TITLE_MODE, { begin: BASIC_ATOM_RE })
          ],
          starts: {
            end: ";|\\.",
            keywords: ERLANG_RESERVED,
            contains: BASIC_MODES
          }
        },
        COMMENT,
        {
          begin: "^-",
          end: "\\.",
          relevance: 0,
          excludeEnd: true,
          returnBegin: true,
          keywords: {
            $pattern: "-" + hljs.IDENT_RE,
            keyword: DIRECTIVES.map((x) => `${x}|1.5`).join(" ")
          },
          contains: [
            PARAMS,
            SIGIL,
            TRIPLE_QUOTE,
            hljs.QUOTE_STRING_MODE
          ]
        },
        NUMBER,
        SIGIL,
        TRIPLE_QUOTE,
        hljs.QUOTE_STRING_MODE,
        RECORD_ACCESS,
        VAR1,
        VAR2,
        TUPLE,
        CHAR_LITERAL,
        { begin: /\.$/ }
        // relevance booster
      ]
    };
  }

  // node_modules/highlight.js/es/languages/fortran.js
  function fortran(hljs) {
    const regex = hljs.regex;
    const PARAMS = {
      className: "params",
      begin: "\\(",
      end: "\\)"
    };
    const COMMENT = { variants: [
      hljs.COMMENT("!", "$", { relevance: 0 }),
      // allow FORTRAN 77 style comments
      hljs.COMMENT("^C[ ]", "$", { relevance: 0 }),
      hljs.COMMENT("^C$", "$", { relevance: 0 })
    ] };
    const OPTIONAL_NUMBER_SUFFIX = /(_[a-z_\d]+)?/;
    const OPTIONAL_NUMBER_EXP = /([de][+-]?\d+)?/;
    const NUMBER = {
      className: "number",
      variants: [
        { begin: regex.concat(/\b\d+/, /\.(\d*)/, OPTIONAL_NUMBER_EXP, OPTIONAL_NUMBER_SUFFIX) },
        { begin: regex.concat(/\b\d+/, OPTIONAL_NUMBER_EXP, OPTIONAL_NUMBER_SUFFIX) },
        { begin: regex.concat(/\.\d+/, OPTIONAL_NUMBER_EXP, OPTIONAL_NUMBER_SUFFIX) }
      ],
      relevance: 0
    };
    const FUNCTION_DEF = {
      className: "function",
      beginKeywords: "subroutine function program",
      illegal: "[${=\\n]",
      contains: [
        hljs.UNDERSCORE_TITLE_MODE,
        PARAMS
      ]
    };
    const STRING = {
      className: "string",
      relevance: 0,
      variants: [
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ]
    };
    const KEYWORDS3 = [
      "kind",
      "do",
      "concurrent",
      "local",
      "shared",
      "while",
      "private",
      "call",
      "intrinsic",
      "where",
      "elsewhere",
      "type",
      "endtype",
      "endmodule",
      "endselect",
      "endinterface",
      "end",
      "enddo",
      "endif",
      "if",
      "forall",
      "endforall",
      "only",
      "contains",
      "default",
      "return",
      "stop",
      "then",
      "block",
      "endblock",
      "endassociate",
      "public",
      "subroutine|10",
      "function",
      "program",
      ".and.",
      ".or.",
      ".not.",
      ".le.",
      ".eq.",
      ".ge.",
      ".gt.",
      ".lt.",
      "goto",
      "save",
      "else",
      "use",
      "module",
      "select",
      "case",
      "access",
      "blank",
      "direct",
      "exist",
      "file",
      "fmt",
      "form",
      "formatted",
      "iostat",
      "name",
      "named",
      "nextrec",
      "number",
      "opened",
      "rec",
      "recl",
      "sequential",
      "status",
      "unformatted",
      "unit",
      "continue",
      "format",
      "pause",
      "cycle",
      "exit",
      "c_null_char",
      "c_alert",
      "c_backspace",
      "c_form_feed",
      "flush",
      "wait",
      "decimal",
      "round",
      "iomsg",
      "synchronous",
      "nopass",
      "non_overridable",
      "pass",
      "protected",
      "volatile",
      "abstract",
      "extends",
      "import",
      "non_intrinsic",
      "value",
      "deferred",
      "generic",
      "final",
      "enumerator",
      "class",
      "associate",
      "bind",
      "enum",
      "c_int",
      "c_short",
      "c_long",
      "c_long_long",
      "c_signed_char",
      "c_size_t",
      "c_int8_t",
      "c_int16_t",
      "c_int32_t",
      "c_int64_t",
      "c_int_least8_t",
      "c_int_least16_t",
      "c_int_least32_t",
      "c_int_least64_t",
      "c_int_fast8_t",
      "c_int_fast16_t",
      "c_int_fast32_t",
      "c_int_fast64_t",
      "c_intmax_t",
      "C_intptr_t",
      "c_float",
      "c_double",
      "c_long_double",
      "c_float_complex",
      "c_double_complex",
      "c_long_double_complex",
      "c_bool",
      "c_char",
      "c_null_ptr",
      "c_null_funptr",
      "c_new_line",
      "c_carriage_return",
      "c_horizontal_tab",
      "c_vertical_tab",
      "iso_c_binding",
      "c_loc",
      "c_funloc",
      "c_associated",
      "c_f_pointer",
      "c_ptr",
      "c_funptr",
      "iso_fortran_env",
      "character_storage_size",
      "error_unit",
      "file_storage_size",
      "input_unit",
      "iostat_end",
      "iostat_eor",
      "numeric_storage_size",
      "output_unit",
      "c_f_procpointer",
      "ieee_arithmetic",
      "ieee_support_underflow_control",
      "ieee_get_underflow_mode",
      "ieee_set_underflow_mode",
      "newunit",
      "contiguous",
      "recursive",
      "pad",
      "position",
      "action",
      "delim",
      "readwrite",
      "eor",
      "advance",
      "nml",
      "interface",
      "procedure",
      "namelist",
      "include",
      "sequence",
      "elemental",
      "pure",
      "impure",
      "integer",
      "real",
      "character",
      "complex",
      "logical",
      "codimension",
      "dimension",
      "allocatable|10",
      "parameter",
      "external",
      "implicit|10",
      "none",
      "double",
      "precision",
      "assign",
      "intent",
      "optional",
      "pointer",
      "target",
      "in",
      "out",
      "common",
      "equivalence",
      "data"
    ];
    const LITERALS3 = [
      ".False.",
      ".True."
    ];
    const BUILT_INS3 = [
      "alog",
      "alog10",
      "amax0",
      "amax1",
      "amin0",
      "amin1",
      "amod",
      "cabs",
      "ccos",
      "cexp",
      "clog",
      "csin",
      "csqrt",
      "dabs",
      "dacos",
      "dasin",
      "datan",
      "datan2",
      "dcos",
      "dcosh",
      "ddim",
      "dexp",
      "dint",
      "dlog",
      "dlog10",
      "dmax1",
      "dmin1",
      "dmod",
      "dnint",
      "dsign",
      "dsin",
      "dsinh",
      "dsqrt",
      "dtan",
      "dtanh",
      "float",
      "iabs",
      "idim",
      "idint",
      "idnint",
      "ifix",
      "isign",
      "max0",
      "max1",
      "min0",
      "min1",
      "sngl",
      "algama",
      "cdabs",
      "cdcos",
      "cdexp",
      "cdlog",
      "cdsin",
      "cdsqrt",
      "cqabs",
      "cqcos",
      "cqexp",
      "cqlog",
      "cqsin",
      "cqsqrt",
      "dcmplx",
      "dconjg",
      "derf",
      "derfc",
      "dfloat",
      "dgamma",
      "dimag",
      "dlgama",
      "iqint",
      "qabs",
      "qacos",
      "qasin",
      "qatan",
      "qatan2",
      "qcmplx",
      "qconjg",
      "qcos",
      "qcosh",
      "qdim",
      "qerf",
      "qerfc",
      "qexp",
      "qgamma",
      "qimag",
      "qlgama",
      "qlog",
      "qlog10",
      "qmax1",
      "qmin1",
      "qmod",
      "qnint",
      "qsign",
      "qsin",
      "qsinh",
      "qsqrt",
      "qtan",
      "qtanh",
      "abs",
      "acos",
      "aimag",
      "aint",
      "anint",
      "asin",
      "atan",
      "atan2",
      "char",
      "cmplx",
      "conjg",
      "cos",
      "cosh",
      "exp",
      "ichar",
      "index",
      "int",
      "log",
      "log10",
      "max",
      "min",
      "nint",
      "sign",
      "sin",
      "sinh",
      "sqrt",
      "tan",
      "tanh",
      "print",
      "write",
      "dim",
      "lge",
      "lgt",
      "lle",
      "llt",
      "mod",
      "nullify",
      "allocate",
      "deallocate",
      "adjustl",
      "adjustr",
      "all",
      "allocated",
      "any",
      "associated",
      "bit_size",
      "btest",
      "ceiling",
      "count",
      "cshift",
      "date_and_time",
      "digits",
      "dot_product",
      "eoshift",
      "epsilon",
      "exponent",
      "floor",
      "fraction",
      "huge",
      "iand",
      "ibclr",
      "ibits",
      "ibset",
      "ieor",
      "ior",
      "ishft",
      "ishftc",
      "lbound",
      "len_trim",
      "matmul",
      "maxexponent",
      "maxloc",
      "maxval",
      "merge",
      "minexponent",
      "minloc",
      "minval",
      "modulo",
      "mvbits",
      "nearest",
      "pack",
      "present",
      "product",
      "radix",
      "random_number",
      "random_seed",
      "range",
      "repeat",
      "reshape",
      "rrspacing",
      "scale",
      "scan",
      "selected_int_kind",
      "selected_real_kind",
      "set_exponent",
      "shape",
      "size",
      "spacing",
      "spread",
      "sum",
      "system_clock",
      "tiny",
      "transpose",
      "trim",
      "ubound",
      "unpack",
      "verify",
      "achar",
      "iachar",
      "transfer",
      "dble",
      "entry",
      "dprod",
      "cpu_time",
      "command_argument_count",
      "get_command",
      "get_command_argument",
      "get_environment_variable",
      "is_iostat_end",
      "ieee_arithmetic",
      "ieee_support_underflow_control",
      "ieee_get_underflow_mode",
      "ieee_set_underflow_mode",
      "is_iostat_eor",
      "move_alloc",
      "new_line",
      "selected_char_kind",
      "same_type_as",
      "extends_type_of",
      "acosh",
      "asinh",
      "atanh",
      "bessel_j0",
      "bessel_j1",
      "bessel_jn",
      "bessel_y0",
      "bessel_y1",
      "bessel_yn",
      "erf",
      "erfc",
      "erfc_scaled",
      "gamma",
      "log_gamma",
      "hypot",
      "norm2",
      "atomic_define",
      "atomic_ref",
      "execute_command_line",
      "leadz",
      "trailz",
      "storage_size",
      "merge_bits",
      "bge",
      "bgt",
      "ble",
      "blt",
      "dshiftl",
      "dshiftr",
      "findloc",
      "iall",
      "iany",
      "iparity",
      "image_index",
      "lcobound",
      "ucobound",
      "maskl",
      "maskr",
      "num_images",
      "parity",
      "popcnt",
      "poppar",
      "shifta",
      "shiftl",
      "shiftr",
      "this_image",
      "sync",
      "change",
      "team",
      "co_broadcast",
      "co_max",
      "co_min",
      "co_sum",
      "co_reduce"
    ];
    return {
      name: "Fortran",
      case_insensitive: true,
      aliases: [
        "f90",
        "f95"
      ],
      keywords: {
        $pattern: /\b[a-z][a-z0-9_]+\b|\.[a-z][a-z0-9_]+\./,
        keyword: KEYWORDS3,
        literal: LITERALS3,
        built_in: BUILT_INS3
      },
      illegal: /\/\*/,
      contains: [
        STRING,
        FUNCTION_DEF,
        // allow `C = value` for assignments so they aren't misdetected
        // as Fortran 77 style comments
        {
          begin: /^C\s*=(?!=)/,
          relevance: 0
        },
        COMMENT,
        NUMBER
      ]
    };
  }

  // node_modules/highlight.js/es/languages/fsharp.js
  function escape(value) {
    return new RegExp(value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "m");
  }
  function source(re) {
    if (!re) return null;
    if (typeof re === "string") return re;
    return re.source;
  }
  function lookahead(re) {
    return concat("(?=", re, ")");
  }
  function concat(...args) {
    const joined = args.map((x) => source(x)).join("");
    return joined;
  }
  function stripOptionsFromArgs(args) {
    const opts = args[args.length - 1];
    if (typeof opts === "object" && opts.constructor === Object) {
      args.splice(args.length - 1, 1);
      return opts;
    } else {
      return {};
    }
  }
  function either(...args) {
    const opts = stripOptionsFromArgs(args);
    const joined = "(" + (opts.capture ? "" : "?:") + args.map((x) => source(x)).join("|") + ")";
    return joined;
  }
  function fsharp(hljs) {
    const KEYWORDS3 = [
      "abstract",
      "and",
      "as",
      "assert",
      "base",
      "begin",
      "class",
      "default",
      "delegate",
      "do",
      "done",
      "downcast",
      "downto",
      "elif",
      "else",
      "end",
      "exception",
      "extern",
      // "false", // literal
      "finally",
      "fixed",
      "for",
      "fun",
      "function",
      "global",
      "if",
      "in",
      "inherit",
      "inline",
      "interface",
      "internal",
      "lazy",
      "let",
      "match",
      "member",
      "module",
      "mutable",
      "namespace",
      "new",
      // "not", // built_in
      // "null", // literal
      "of",
      "open",
      "or",
      "override",
      "private",
      "public",
      "rec",
      "return",
      "static",
      "struct",
      "then",
      "to",
      // "true", // literal
      "try",
      "type",
      "upcast",
      "use",
      "val",
      "void",
      "when",
      "while",
      "with",
      "yield"
    ];
    const BANG_KEYWORD_MODE = {
      // monad builder keywords (matches before non-bang keywords)
      scope: "keyword",
      match: /\b(yield|return|let|do|match|use)!/
    };
    const PREPROCESSOR_KEYWORDS = [
      "if",
      "else",
      "endif",
      "line",
      "nowarn",
      "light",
      "r",
      "i",
      "I",
      "load",
      "time",
      "help",
      "quit"
    ];
    const LITERALS3 = [
      "true",
      "false",
      "null",
      "Some",
      "None",
      "Ok",
      "Error",
      "infinity",
      "infinityf",
      "nan",
      "nanf"
    ];
    const SPECIAL_IDENTIFIERS = [
      "__LINE__",
      "__SOURCE_DIRECTORY__",
      "__SOURCE_FILE__"
    ];
    const KNOWN_TYPES = [
      // basic types
      "bool",
      "byte",
      "sbyte",
      "int8",
      "int16",
      "int32",
      "uint8",
      "uint16",
      "uint32",
      "int",
      "uint",
      "int64",
      "uint64",
      "nativeint",
      "unativeint",
      "decimal",
      "float",
      "double",
      "float32",
      "single",
      "char",
      "string",
      "unit",
      "bigint",
      // other native types or lowercase aliases
      "option",
      "voption",
      "list",
      "array",
      "seq",
      "byref",
      "exn",
      "inref",
      "nativeptr",
      "obj",
      "outref",
      "voidptr",
      // other important FSharp types
      "Result"
    ];
    const BUILTINS = [
      // Somewhat arbitrary list of builtin functions and values.
      // Most of them are declared in Microsoft.FSharp.Core
      // I tried to stay relevant by adding only the most idiomatic
      // and most used symbols that are not already declared as types.
      "not",
      "ref",
      "raise",
      "reraise",
      "dict",
      "readOnlyDict",
      "set",
      "get",
      "enum",
      "sizeof",
      "typeof",
      "typedefof",
      "nameof",
      "nullArg",
      "invalidArg",
      "invalidOp",
      "id",
      "fst",
      "snd",
      "ignore",
      "lock",
      "using",
      "box",
      "unbox",
      "tryUnbox",
      "printf",
      "printfn",
      "sprintf",
      "eprintf",
      "eprintfn",
      "fprintf",
      "fprintfn",
      "failwith",
      "failwithf"
    ];
    const ALL_KEYWORDS = {
      keyword: KEYWORDS3,
      literal: LITERALS3,
      built_in: BUILTINS,
      "variable.constant": SPECIAL_IDENTIFIERS
    };
    const ML_COMMENT = hljs.COMMENT(/\(\*(?!\))/, /\*\)/, {
      contains: ["self"]
    });
    const COMMENT = {
      variants: [
        ML_COMMENT,
        hljs.C_LINE_COMMENT_MODE
      ]
    };
    const IDENTIFIER_RE = /[a-zA-Z_](\w|')*/;
    const QUOTED_IDENTIFIER = {
      scope: "variable",
      begin: /``/,
      end: /``/
    };
    const BEGIN_GENERIC_TYPE_SYMBOL_RE = /\B('|\^)/;
    const GENERIC_TYPE_SYMBOL = {
      scope: "symbol",
      variants: [
        // the type name is a quoted identifier:
        { match: concat(BEGIN_GENERIC_TYPE_SYMBOL_RE, /``.*?``/) },
        // the type name is a normal identifier (we don't use IDENTIFIER_RE because there cannot be another apostrophe here):
        { match: concat(BEGIN_GENERIC_TYPE_SYMBOL_RE, hljs.UNDERSCORE_IDENT_RE) }
      ],
      relevance: 0
    };
    const makeOperatorMode = function({ includeEqual }) {
      let allOperatorChars;
      if (includeEqual)
        allOperatorChars = "!%&*+-/<=>@^|~?";
      else
        allOperatorChars = "!%&*+-/<>@^|~?";
      const OPERATOR_CHARS = Array.from(allOperatorChars);
      const OPERATOR_CHAR_RE = concat("[", ...OPERATOR_CHARS.map(escape), "]");
      const OPERATOR_CHAR_OR_DOT_RE = either(OPERATOR_CHAR_RE, /\./);
      const OPERATOR_FIRST_CHAR_OF_MULTIPLE_RE = concat(OPERATOR_CHAR_OR_DOT_RE, lookahead(OPERATOR_CHAR_OR_DOT_RE));
      const SYMBOLIC_OPERATOR_RE = either(
        concat(OPERATOR_FIRST_CHAR_OF_MULTIPLE_RE, OPERATOR_CHAR_OR_DOT_RE, "*"),
        // Matches at least 2 chars operators
        concat(OPERATOR_CHAR_RE, "+")
        // Matches at least one char operators
      );
      return {
        scope: "operator",
        match: either(
          // symbolic operators:
          SYMBOLIC_OPERATOR_RE,
          // other symbolic keywords:
          // Type casting and conversion operators:
          /:\?>/,
          /:\?/,
          /:>/,
          /:=/,
          // Reference cell assignment
          /::?/,
          // : or ::
          /\$/
        ),
        // A single $ can be used as an operator
        relevance: 0
      };
    };
    const OPERATOR = makeOperatorMode({ includeEqual: true });
    const OPERATOR_WITHOUT_EQUAL = makeOperatorMode({ includeEqual: false });
    const makeTypeAnnotationMode = function(prefix, prefixScope) {
      return {
        begin: concat(
          // a type annotation is a
          prefix,
          // should be a colon or the 'of' keyword
          lookahead(
            // that has to be followed by
            concat(
              /\s*/,
              // optional space
              either(
                // then either of:
                /\w/,
                // word
                /'/,
                // generic type name
                /\^/,
                // generic type name
                /#/,
                // flexible type name
                /``/,
                // quoted type name
                /\(/,
                // parens type expression
                /{\|/
                // anonymous type annotation
              )
            )
          )
        ),
        beginScope: prefixScope,
        // BUG: because ending with \n is necessary for some cases, multi-line type annotations are not properly supported.
        // Examples where \n is required at the end:
        // - abstract member definitions in classes: abstract Property : int * string
        // - return type annotations: let f f' = f' () : returnTypeAnnotation
        // - record fields definitions: { A : int \n B : string }
        end: lookahead(
          either(
            /\n/,
            /=/
          )
        ),
        relevance: 0,
        // we need the known types, and we need the type constraint keywords and literals. e.g.: when 'a : null
        keywords: hljs.inherit(ALL_KEYWORDS, { type: KNOWN_TYPES }),
        contains: [
          COMMENT,
          GENERIC_TYPE_SYMBOL,
          hljs.inherit(QUOTED_IDENTIFIER, { scope: null }),
          // match to avoid strange patterns inside that may break the parsing
          OPERATOR_WITHOUT_EQUAL
        ]
      };
    };
    const TYPE_ANNOTATION = makeTypeAnnotationMode(/:/, "operator");
    const DISCRIMINATED_UNION_TYPE_ANNOTATION = makeTypeAnnotationMode(/\bof\b/, "keyword");
    const TYPE_DECLARATION = {
      begin: [
        /(^|\s+)/,
        // prevents matching the following: `match s.stype with`
        /type/,
        /\s+/,
        IDENTIFIER_RE
      ],
      beginScope: {
        2: "keyword",
        4: "title.class"
      },
      end: lookahead(/\(|=|$/),
      keywords: ALL_KEYWORDS,
      // match keywords in type constraints. e.g.: when 'a : null
      contains: [
        COMMENT,
        hljs.inherit(QUOTED_IDENTIFIER, { scope: null }),
        // match to avoid strange patterns inside that may break the parsing
        GENERIC_TYPE_SYMBOL,
        {
          // For visual consistency, highlight type brackets as operators.
          scope: "operator",
          match: /<|>/
        },
        TYPE_ANNOTATION
        // generic types can have constraints, which are type annotations. e.g. type MyType<'T when 'T : delegate<obj * string>> =
      ]
    };
    const COMPUTATION_EXPRESSION = {
      // computation expressions:
      scope: "computation-expression",
      // BUG: might conflict with record deconstruction. e.g. let f { Name = name } = name // will highlight f
      match: /\b[_a-z]\w*(?=\s*\{)/
    };
    const PREPROCESSOR = {
      // preprocessor directives and fsi commands:
      begin: [
        /^\s*/,
        concat(/#/, either(...PREPROCESSOR_KEYWORDS)),
        /\b/
      ],
      beginScope: { 2: "meta" },
      end: lookahead(/\s|$/)
    };
    const NUMBER = {
      variants: [
        hljs.BINARY_NUMBER_MODE,
        hljs.C_NUMBER_MODE
      ]
    };
    const QUOTED_STRING = {
      scope: "string",
      begin: /"/,
      end: /"/,
      contains: [
        hljs.BACKSLASH_ESCAPE
      ]
    };
    const VERBATIM_STRING = {
      scope: "string",
      begin: /@"/,
      end: /"/,
      contains: [
        {
          match: /""/
          // escaped "
        },
        hljs.BACKSLASH_ESCAPE
      ]
    };
    const TRIPLE_QUOTED_STRING = {
      scope: "string",
      begin: /"""/,
      end: /"""/,
      relevance: 2
    };
    const SUBST = {
      scope: "subst",
      begin: /\{/,
      end: /\}/,
      keywords: ALL_KEYWORDS
    };
    const INTERPOLATED_STRING = {
      scope: "string",
      begin: /\$"/,
      end: /"/,
      contains: [
        {
          match: /\{\{/
          // escaped {
        },
        {
          match: /\}\}/
          // escaped }
        },
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ]
    };
    const INTERPOLATED_VERBATIM_STRING = {
      scope: "string",
      begin: /(\$@|@\$)"/,
      end: /"/,
      contains: [
        {
          match: /\{\{/
          // escaped {
        },
        {
          match: /\}\}/
          // escaped }
        },
        {
          match: /""/
        },
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ]
    };
    const INTERPOLATED_TRIPLE_QUOTED_STRING = {
      scope: "string",
      begin: /\$"""/,
      end: /"""/,
      contains: [
        {
          match: /\{\{/
          // escaped {
        },
        {
          match: /\}\}/
          // escaped }
        },
        SUBST
      ],
      relevance: 2
    };
    const CHAR_LITERAL = {
      scope: "string",
      match: concat(
        /'/,
        either(
          /[^\\']/,
          // either a single non escaped char...
          /\\(?:.|\d{3}|x[a-fA-F\d]{2}|u[a-fA-F\d]{4}|U[a-fA-F\d]{8})/
          // ...or an escape sequence
        ),
        /'/
      )
    };
    SUBST.contains = [
      INTERPOLATED_VERBATIM_STRING,
      INTERPOLATED_STRING,
      VERBATIM_STRING,
      QUOTED_STRING,
      CHAR_LITERAL,
      BANG_KEYWORD_MODE,
      COMMENT,
      QUOTED_IDENTIFIER,
      TYPE_ANNOTATION,
      COMPUTATION_EXPRESSION,
      PREPROCESSOR,
      NUMBER,
      GENERIC_TYPE_SYMBOL,
      OPERATOR
    ];
    const STRING = {
      variants: [
        INTERPOLATED_TRIPLE_QUOTED_STRING,
        INTERPOLATED_VERBATIM_STRING,
        INTERPOLATED_STRING,
        TRIPLE_QUOTED_STRING,
        VERBATIM_STRING,
        QUOTED_STRING,
        CHAR_LITERAL
      ]
    };
    return {
      name: "F#",
      aliases: [
        "fs",
        "f#"
      ],
      keywords: ALL_KEYWORDS,
      illegal: /\/\*/,
      classNameAliases: {
        "computation-expression": "keyword"
      },
      contains: [
        BANG_KEYWORD_MODE,
        STRING,
        COMMENT,
        QUOTED_IDENTIFIER,
        TYPE_DECLARATION,
        {
          // e.g. [<Attributes("")>] or [<``module``: MyCustomAttributeThatWorksOnModules>]
          // or [<Sealed; NoEquality; NoComparison; CompiledName("FSharpAsync`1")>]
          scope: "meta",
          begin: /\[</,
          end: />\]/,
          relevance: 2,
          contains: [
            QUOTED_IDENTIFIER,
            // can contain any constant value
            TRIPLE_QUOTED_STRING,
            VERBATIM_STRING,
            QUOTED_STRING,
            CHAR_LITERAL,
            NUMBER
          ]
        },
        DISCRIMINATED_UNION_TYPE_ANNOTATION,
        TYPE_ANNOTATION,
        COMPUTATION_EXPRESSION,
        PREPROCESSOR,
        NUMBER,
        GENERIC_TYPE_SYMBOL,
        OPERATOR
      ]
    };
  }

  // node_modules/highlight.js/es/languages/gherkin.js
  function gherkin(hljs) {
    return {
      name: "Gherkin",
      aliases: ["feature"],
      keywords: "Feature Background Ability Business Need Scenario Scenarios Scenario Outline Scenario Template Examples Given And Then But When",
      contains: [
        {
          className: "symbol",
          begin: "\\*",
          relevance: 0
        },
        {
          className: "meta",
          begin: "@[^@\\s]+"
        },
        {
          begin: "\\|",
          end: "\\|\\w*$",
          contains: [
            {
              className: "string",
              begin: "[^|]+"
            }
          ]
        },
        {
          className: "variable",
          begin: "<",
          end: ">"
        },
        hljs.HASH_COMMENT_MODE,
        {
          className: "string",
          begin: '"""',
          end: '"""'
        },
        hljs.QUOTE_STRING_MODE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/go.js
  function go(hljs) {
    const LITERALS3 = [
      "true",
      "false",
      "iota",
      "nil"
    ];
    const BUILT_INS3 = [
      "append",
      "cap",
      "close",
      "complex",
      "copy",
      "imag",
      "len",
      "make",
      "new",
      "panic",
      "print",
      "println",
      "real",
      "recover",
      "delete"
    ];
    const TYPES3 = [
      "bool",
      "byte",
      "complex64",
      "complex128",
      "error",
      "float32",
      "float64",
      "int8",
      "int16",
      "int32",
      "int64",
      "string",
      "uint8",
      "uint16",
      "uint32",
      "uint64",
      "int",
      "uint",
      "uintptr",
      "rune"
    ];
    const KWS = [
      "break",
      "case",
      "chan",
      "const",
      "continue",
      "default",
      "defer",
      "else",
      "fallthrough",
      "for",
      "func",
      "go",
      "goto",
      "if",
      "import",
      "interface",
      "map",
      "package",
      "range",
      "return",
      "select",
      "struct",
      "switch",
      "type",
      "var"
    ];
    const KEYWORDS3 = {
      keyword: KWS,
      type: TYPES3,
      literal: LITERALS3,
      built_in: BUILT_INS3
    };
    return {
      name: "Go",
      aliases: ["golang"],
      keywords: KEYWORDS3,
      illegal: "</",
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          className: "string",
          variants: [
            hljs.QUOTE_STRING_MODE,
            hljs.APOS_STRING_MODE,
            {
              begin: "`",
              end: "`"
            }
          ]
        },
        {
          className: "number",
          variants: [
            {
              match: /-?\b0[xX]\.[a-fA-F0-9](_?[a-fA-F0-9])*[pP][+-]?\d(_?\d)*i?/,
              // hex without a present digit before . (making a digit afterwards required)
              relevance: 0
            },
            {
              match: /-?\b0[xX](_?[a-fA-F0-9])+((\.([a-fA-F0-9](_?[a-fA-F0-9])*)?)?[pP][+-]?\d(_?\d)*)?i?/,
              // hex with a present digit before . (making a digit afterwards optional)
              relevance: 0
            },
            {
              match: /-?\b0[oO](_?[0-7])*i?/,
              // leading 0o octal
              relevance: 0
            },
            {
              match: /-?\.\d(_?\d)*([eE][+-]?\d(_?\d)*)?i?/,
              // decimal without a present digit before . (making a digit afterwards required)
              relevance: 0
            },
            {
              match: /-?\b\d(_?\d)*(\.(\d(_?\d)*)?)?([eE][+-]?\d(_?\d)*)?i?/,
              // decimal with a present digit before . (making a digit afterwards optional)
              relevance: 0
            }
          ]
        },
        {
          begin: /:=/
          // relevance booster
        },
        {
          className: "function",
          beginKeywords: "func",
          end: "\\s*(\\{|$)",
          excludeEnd: true,
          contains: [
            hljs.TITLE_MODE,
            {
              className: "params",
              begin: /\(/,
              end: /\)/,
              endsParent: true,
              keywords: KEYWORDS3,
              illegal: /["']/
            }
          ]
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/gradle.js
  function gradle(hljs) {
    const KEYWORDS3 = [
      "task",
      "project",
      "allprojects",
      "subprojects",
      "artifacts",
      "buildscript",
      "configurations",
      "dependencies",
      "repositories",
      "sourceSets",
      "description",
      "delete",
      "from",
      "into",
      "include",
      "exclude",
      "source",
      "classpath",
      "destinationDir",
      "includes",
      "options",
      "sourceCompatibility",
      "targetCompatibility",
      "group",
      "flatDir",
      "doLast",
      "doFirst",
      "flatten",
      "todir",
      "fromdir",
      "ant",
      "def",
      "abstract",
      "break",
      "case",
      "catch",
      "continue",
      "default",
      "do",
      "else",
      "extends",
      "final",
      "finally",
      "for",
      "if",
      "implements",
      "instanceof",
      "native",
      "new",
      "private",
      "protected",
      "public",
      "return",
      "static",
      "switch",
      "synchronized",
      "throw",
      "throws",
      "transient",
      "try",
      "volatile",
      "while",
      "strictfp",
      "package",
      "import",
      "false",
      "null",
      "super",
      "this",
      "true",
      "antlrtask",
      "checkstyle",
      "codenarc",
      "copy",
      "boolean",
      "byte",
      "char",
      "class",
      "double",
      "float",
      "int",
      "interface",
      "long",
      "short",
      "void",
      "compile",
      "runTime",
      "file",
      "fileTree",
      "abs",
      "any",
      "append",
      "asList",
      "asWritable",
      "call",
      "collect",
      "compareTo",
      "count",
      "div",
      "dump",
      "each",
      "eachByte",
      "eachFile",
      "eachLine",
      "every",
      "find",
      "findAll",
      "flatten",
      "getAt",
      "getErr",
      "getIn",
      "getOut",
      "getText",
      "grep",
      "immutable",
      "inject",
      "inspect",
      "intersect",
      "invokeMethods",
      "isCase",
      "join",
      "leftShift",
      "minus",
      "multiply",
      "newInputStream",
      "newOutputStream",
      "newPrintWriter",
      "newReader",
      "newWriter",
      "next",
      "plus",
      "pop",
      "power",
      "previous",
      "print",
      "println",
      "push",
      "putAt",
      "read",
      "readBytes",
      "readLines",
      "reverse",
      "reverseEach",
      "round",
      "size",
      "sort",
      "splitEachLine",
      "step",
      "subMap",
      "times",
      "toInteger",
      "toList",
      "tokenize",
      "upto",
      "waitForOrKill",
      "withPrintWriter",
      "withReader",
      "withStream",
      "withWriter",
      "withWriterAppend",
      "write",
      "writeLine"
    ];
    return {
      name: "Gradle",
      case_insensitive: true,
      keywords: KEYWORDS3,
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        hljs.NUMBER_MODE,
        hljs.REGEXP_MODE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/graphql.js
  function graphql(hljs) {
    const regex = hljs.regex;
    const GQL_NAME = /[_A-Za-z][_0-9A-Za-z]*/;
    return {
      name: "GraphQL",
      aliases: ["gql"],
      case_insensitive: true,
      disableAutodetect: false,
      keywords: {
        keyword: [
          "query",
          "mutation",
          "subscription",
          "type",
          "input",
          "schema",
          "directive",
          "interface",
          "union",
          "scalar",
          "fragment",
          "enum",
          "on"
        ],
        literal: [
          "true",
          "false",
          "null"
        ]
      },
      contains: [
        hljs.HASH_COMMENT_MODE,
        hljs.QUOTE_STRING_MODE,
        hljs.NUMBER_MODE,
        {
          scope: "punctuation",
          match: /[.]{3}/,
          relevance: 0
        },
        {
          scope: "punctuation",
          begin: /[\!\(\)\:\=\[\]\{\|\}]{1}/,
          relevance: 0
        },
        {
          scope: "variable",
          begin: /\$/,
          end: /\W/,
          excludeEnd: true,
          relevance: 0
        },
        {
          scope: "meta",
          match: /@\w+/,
          excludeEnd: true
        },
        {
          scope: "symbol",
          begin: regex.concat(GQL_NAME, regex.lookahead(/\s*:/)),
          relevance: 0
        }
      ],
      illegal: [
        /[;<']/,
        /BEGIN/
      ]
    };
  }

  // node_modules/highlight.js/es/languages/groovy.js
  function variants(variants2, obj = {}) {
    obj.variants = variants2;
    return obj;
  }
  function groovy(hljs) {
    const regex = hljs.regex;
    const IDENT_RE3 = "[A-Za-z0-9_$]+";
    const COMMENT = variants([
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.COMMENT(
        "/\\*\\*",
        "\\*/",
        {
          relevance: 0,
          contains: [
            {
              // eat up @'s in emails to prevent them to be recognized as doctags
              begin: /\w+@/,
              relevance: 0
            },
            {
              className: "doctag",
              begin: "@[A-Za-z]+"
            }
          ]
        }
      )
    ]);
    const REGEXP = {
      className: "regexp",
      begin: /~?\/[^\/\n]+\//,
      contains: [hljs.BACKSLASH_ESCAPE]
    };
    const NUMBER = variants([
      hljs.BINARY_NUMBER_MODE,
      hljs.C_NUMBER_MODE
    ]);
    const STRING = variants(
      [
        {
          begin: /"""/,
          end: /"""/
        },
        {
          begin: /'''/,
          end: /'''/
        },
        {
          begin: "\\$/",
          end: "/\\$",
          relevance: 10
        },
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ],
      { className: "string" }
    );
    const CLASS_DEFINITION = {
      match: [
        /(class|interface|trait|enum|record|extends|implements)/,
        /\s+/,
        hljs.UNDERSCORE_IDENT_RE
      ],
      scope: {
        1: "keyword",
        3: "title.class"
      }
    };
    const TYPES3 = [
      "byte",
      "short",
      "char",
      "int",
      "long",
      "boolean",
      "float",
      "double",
      "void"
    ];
    const KEYWORDS3 = [
      // groovy specific keywords
      "def",
      "as",
      "in",
      "assert",
      "trait",
      // common keywords with Java
      "abstract",
      "static",
      "volatile",
      "transient",
      "public",
      "private",
      "protected",
      "synchronized",
      "final",
      "class",
      "interface",
      "enum",
      "if",
      "else",
      "for",
      "while",
      "switch",
      "case",
      "break",
      "default",
      "continue",
      "throw",
      "throws",
      "try",
      "catch",
      "finally",
      "implements",
      "extends",
      "new",
      "import",
      "package",
      "return",
      "instanceof",
      "var"
    ];
    return {
      name: "Groovy",
      keywords: {
        "variable.language": "this super",
        literal: "true false null",
        type: TYPES3,
        keyword: KEYWORDS3
      },
      contains: [
        hljs.SHEBANG({
          binary: "groovy",
          relevance: 10
        }),
        COMMENT,
        STRING,
        REGEXP,
        NUMBER,
        CLASS_DEFINITION,
        {
          className: "meta",
          begin: "@[A-Za-z]+",
          relevance: 0
        },
        {
          // highlight map keys and named parameters as attrs
          className: "attr",
          begin: IDENT_RE3 + "[ 	]*:",
          relevance: 0
        },
        {
          // catch middle element of the ternary operator
          // to avoid highlight it as a label, named parameter, or map key
          begin: /\?/,
          end: /:/,
          relevance: 0,
          contains: [
            COMMENT,
            STRING,
            REGEXP,
            NUMBER,
            "self"
          ]
        },
        {
          // highlight labeled statements
          className: "symbol",
          begin: "^[ 	]*" + regex.lookahead(IDENT_RE3 + ":"),
          excludeBegin: true,
          end: IDENT_RE3 + ":",
          relevance: 0
        }
      ],
      illegal: /#|<\//
    };
  }

  // node_modules/highlight.js/es/languages/haskell.js
  function haskell(hljs) {
    const decimalDigits3 = "([0-9]_*)+";
    const hexDigits3 = "([0-9a-fA-F]_*)+";
    const binaryDigits = "([01]_*)+";
    const octalDigits = "([0-7]_*)+";
    const ascSymbol = "[!#$%&*+.\\/<=>?@\\\\^~-]";
    const uniSymbol = "(\\p{S}|\\p{P})";
    const special = "[(),;\\[\\]`|{}]";
    const symbol = `(${ascSymbol}|(?!(${special}|[_:"']))${uniSymbol})`;
    const COMMENT = { variants: [
      // Double dash forms a valid comment only if it's not part of legal lexeme.
      // See: Haskell 98 report: https://www.haskell.org/onlinereport/lexemes.html
      //
      // The commented code does the job, but we can't use negative lookbehind,
      // due to poor support by Safari browser.
      // > hljs.COMMENT(`(?<!${symbol})--+(?!${symbol})`, '$'),
      // So instead, we'll add a no-markup rule before the COMMENT rule in the rules list
      // to match the problematic infix operators that contain double dash.
      hljs.COMMENT("--+", "$"),
      hljs.COMMENT(
        /\{-/,
        /-\}/,
        { contains: ["self"] }
      )
    ] };
    const PRAGMA = {
      className: "meta",
      begin: /\{-#/,
      end: /#-\}/
    };
    const PREPROCESSOR = {
      className: "meta",
      begin: "^#",
      end: "$"
    };
    const CONSTRUCTOR = {
      className: "type",
      begin: "\\b[A-Z][\\w']*",
      // TODO: other constructors (build-in, infix).
      relevance: 0
    };
    const LIST = {
      begin: "\\(",
      end: "\\)",
      illegal: '"',
      contains: [
        PRAGMA,
        PREPROCESSOR,
        {
          className: "type",
          begin: "\\b[A-Z][\\w]*(\\((\\.\\.|,|\\w+)\\))?"
        },
        hljs.inherit(hljs.TITLE_MODE, { begin: "[_a-z][\\w']*" }),
        COMMENT
      ]
    };
    const RECORD = {
      begin: /\{/,
      end: /\}/,
      contains: LIST.contains
    };
    const NUMBER = {
      className: "number",
      relevance: 0,
      variants: [
        // decimal floating-point-literal (subsumes decimal-literal)
        { match: `\\b(${decimalDigits3})(\\.(${decimalDigits3}))?([eE][+-]?(${decimalDigits3}))?\\b` },
        // hexadecimal floating-point-literal (subsumes hexadecimal-literal)
        { match: `\\b0[xX]_*(${hexDigits3})(\\.(${hexDigits3}))?([pP][+-]?(${decimalDigits3}))?\\b` },
        // octal-literal
        { match: `\\b0[oO](${octalDigits})\\b` },
        // binary-literal
        { match: `\\b0[bB](${binaryDigits})\\b` }
      ]
    };
    return {
      name: "Haskell",
      aliases: ["hs"],
      keywords: "let in if then else case of where do module import hiding qualified type data newtype deriving class instance as default infix infixl infixr foreign export ccall stdcall cplusplus jvm dotnet safe unsafe family forall mdo proc rec",
      unicodeRegex: true,
      contains: [
        // Top-level constructions.
        {
          beginKeywords: "module",
          end: "where",
          keywords: "module where",
          contains: [
            LIST,
            COMMENT
          ],
          illegal: "\\W\\.|;"
        },
        {
          begin: "\\bimport\\b",
          end: "$",
          keywords: "import qualified as hiding",
          contains: [
            LIST,
            COMMENT
          ],
          illegal: "\\W\\.|;"
        },
        {
          className: "class",
          begin: "^(\\s*)?(class|instance)\\b",
          end: "where",
          keywords: "class family instance where",
          contains: [
            CONSTRUCTOR,
            LIST,
            COMMENT
          ]
        },
        {
          className: "class",
          begin: "\\b(data|(new)?type)\\b",
          end: "$",
          keywords: "data family type newtype deriving",
          contains: [
            PRAGMA,
            CONSTRUCTOR,
            LIST,
            RECORD,
            COMMENT
          ]
        },
        {
          beginKeywords: "default",
          end: "$",
          contains: [
            CONSTRUCTOR,
            LIST,
            COMMENT
          ]
        },
        {
          beginKeywords: "infix infixl infixr",
          end: "$",
          contains: [
            hljs.C_NUMBER_MODE,
            COMMENT
          ]
        },
        {
          begin: "\\bforeign\\b",
          end: "$",
          keywords: "foreign import export ccall stdcall cplusplus jvm dotnet safe unsafe",
          contains: [
            CONSTRUCTOR,
            hljs.QUOTE_STRING_MODE,
            COMMENT
          ]
        },
        {
          className: "meta",
          begin: "#!\\/usr\\/bin\\/env runhaskell",
          end: "$"
        },
        // "Whitespaces".
        PRAGMA,
        PREPROCESSOR,
        // Literals and names.
        // Single characters.
        {
          scope: "string",
          begin: /'(?=\\?.')/,
          end: /'/,
          contains: [
            {
              scope: "char.escape",
              match: /\\./
            }
          ]
        },
        hljs.QUOTE_STRING_MODE,
        NUMBER,
        CONSTRUCTOR,
        hljs.inherit(hljs.TITLE_MODE, { begin: "^[_a-z][\\w']*" }),
        // No markup, prevents infix operators from being recognized as comments.
        { begin: `(?!-)${symbol}--+|--+(?!-)${symbol}` },
        COMMENT,
        {
          // No markup, relevance booster
          begin: "->|<-"
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/http.js
  function http(hljs) {
    const regex = hljs.regex;
    const VERSION = "HTTP/([32]|1\\.[01])";
    const HEADER_NAME = /[A-Za-z][A-Za-z0-9-]*/;
    const HEADER = {
      className: "attribute",
      begin: regex.concat("^", HEADER_NAME, "(?=\\:\\s)"),
      starts: { contains: [
        {
          className: "punctuation",
          begin: /: /,
          relevance: 0,
          starts: {
            end: "$",
            relevance: 0
          }
        }
      ] }
    };
    const HEADERS_AND_BODY = [
      HEADER,
      {
        begin: "\\n\\n",
        starts: {
          subLanguage: [],
          endsWithParent: true
        }
      }
    ];
    return {
      name: "HTTP",
      aliases: ["https"],
      illegal: /\S/,
      contains: [
        // response
        {
          begin: "^(?=" + VERSION + " \\d{3})",
          end: /$/,
          contains: [
            {
              className: "meta",
              begin: VERSION
            },
            {
              className: "number",
              begin: "\\b\\d{3}\\b"
            }
          ],
          starts: {
            end: /\b\B/,
            illegal: /\S/,
            contains: HEADERS_AND_BODY
          }
        },
        // request
        {
          begin: "(?=^[A-Z]+ (.*?) " + VERSION + "$)",
          end: /$/,
          contains: [
            {
              className: "string",
              begin: " ",
              end: " ",
              excludeBegin: true,
              excludeEnd: true
            },
            {
              className: "meta",
              begin: VERSION
            },
            {
              className: "keyword",
              begin: "[A-Z]+"
            }
          ],
          starts: {
            end: /\b\B/,
            illegal: /\S/,
            contains: HEADERS_AND_BODY
          }
        },
        // to allow headers to work even without a preamble
        hljs.inherit(HEADER, { relevance: 0 })
      ]
    };
  }

  // node_modules/highlight.js/es/languages/ini.js
  function ini(hljs) {
    const regex = hljs.regex;
    const NUMBERS = {
      className: "number",
      relevance: 0,
      variants: [
        { begin: /([+-]+)?[\d]+_[\d_]+/ },
        { begin: hljs.NUMBER_RE }
      ]
    };
    const COMMENTS = hljs.COMMENT();
    COMMENTS.variants = [
      {
        begin: /;/,
        end: /$/
      },
      {
        begin: /#/,
        end: /$/
      }
    ];
    const VARIABLES = {
      className: "variable",
      variants: [
        { begin: /\$[\w\d"][\w\d_]*/ },
        { begin: /\$\{(.*?)\}/ }
      ]
    };
    const LITERALS3 = {
      className: "literal",
      begin: /\bon|off|true|false|yes|no\b/
    };
    const STRINGS = {
      className: "string",
      contains: [hljs.BACKSLASH_ESCAPE],
      variants: [
        {
          begin: "'''",
          end: "'''",
          relevance: 10
        },
        {
          begin: '"""',
          end: '"""',
          relevance: 10
        },
        {
          begin: '"',
          end: '"'
        },
        {
          begin: "'",
          end: "'"
        }
      ]
    };
    const ARRAY = {
      begin: /\[/,
      end: /\]/,
      contains: [
        COMMENTS,
        LITERALS3,
        VARIABLES,
        STRINGS,
        NUMBERS,
        "self"
      ],
      relevance: 0
    };
    const BARE_KEY = /[A-Za-z0-9_-]+/;
    const QUOTED_KEY_DOUBLE_QUOTE = /"(\\"|[^"])*"/;
    const QUOTED_KEY_SINGLE_QUOTE = /'[^']*'/;
    const ANY_KEY = regex.either(
      BARE_KEY,
      QUOTED_KEY_DOUBLE_QUOTE,
      QUOTED_KEY_SINGLE_QUOTE
    );
    const DOTTED_KEY = regex.concat(
      ANY_KEY,
      "(\\s*\\.\\s*",
      ANY_KEY,
      ")*",
      regex.lookahead(/\s*=\s*[^#\s]/)
    );
    return {
      name: "TOML, also INI",
      aliases: ["toml"],
      case_insensitive: true,
      illegal: /\S/,
      contains: [
        COMMENTS,
        {
          className: "section",
          begin: /\[+/,
          end: /\]+/
        },
        {
          begin: DOTTED_KEY,
          className: "attr",
          starts: {
            end: /$/,
            contains: [
              COMMENTS,
              ARRAY,
              LITERALS3,
              VARIABLES,
              STRINGS,
              NUMBERS
            ]
          }
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/java.js
  var decimalDigits = "[0-9](_*[0-9])*";
  var frac = `\\.(${decimalDigits})`;
  var hexDigits = "[0-9a-fA-F](_*[0-9a-fA-F])*";
  var NUMERIC = {
    className: "number",
    variants: [
      // DecimalFloatingPointLiteral
      // including ExponentPart
      { begin: `(\\b(${decimalDigits})((${frac})|\\.)?|(${frac}))[eE][+-]?(${decimalDigits})[fFdD]?\\b` },
      // excluding ExponentPart
      { begin: `\\b(${decimalDigits})((${frac})[fFdD]?\\b|\\.([fFdD]\\b)?)` },
      { begin: `(${frac})[fFdD]?\\b` },
      { begin: `\\b(${decimalDigits})[fFdD]\\b` },
      // HexadecimalFloatingPointLiteral
      { begin: `\\b0[xX]((${hexDigits})\\.?|(${hexDigits})?\\.(${hexDigits}))[pP][+-]?(${decimalDigits})[fFdD]?\\b` },
      // DecimalIntegerLiteral
      { begin: "\\b(0|[1-9](_*[0-9])*)[lL]?\\b" },
      // HexIntegerLiteral
      { begin: `\\b0[xX](${hexDigits})[lL]?\\b` },
      // OctalIntegerLiteral
      { begin: "\\b0(_*[0-7])*[lL]?\\b" },
      // BinaryIntegerLiteral
      { begin: "\\b0[bB][01](_*[01])*[lL]?\\b" }
    ],
    relevance: 0
  };
  function recurRegex(re, substitution, depth) {
    if (depth === -1) return "";
    return re.replace(substitution, (_) => {
      return recurRegex(re, substitution, depth - 1);
    });
  }
  function java(hljs) {
    const regex = hljs.regex;
    const JAVA_IDENT_RE = "[\xC0-\u02B8a-zA-Z_$][\xC0-\u02B8a-zA-Z_$0-9]*";
    const GENERIC_IDENT_RE = JAVA_IDENT_RE + recurRegex("(?:<" + JAVA_IDENT_RE + "~~~(?:\\s*,\\s*" + JAVA_IDENT_RE + "~~~)*>)?", /~~~/g, 2);
    const MAIN_KEYWORDS = [
      "synchronized",
      "abstract",
      "private",
      "var",
      "static",
      "if",
      "const ",
      "for",
      "while",
      "strictfp",
      "finally",
      "protected",
      "import",
      "native",
      "final",
      "void",
      "enum",
      "else",
      "break",
      "transient",
      "catch",
      "instanceof",
      "volatile",
      "case",
      "assert",
      "package",
      "default",
      "public",
      "try",
      "switch",
      "continue",
      "throws",
      "protected",
      "public",
      "private",
      "module",
      "requires",
      "exports",
      "do",
      "sealed",
      "yield",
      "permits",
      "goto",
      "when"
    ];
    const BUILT_INS3 = [
      "super",
      "this"
    ];
    const LITERALS3 = [
      "false",
      "true",
      "null"
    ];
    const TYPES3 = [
      "char",
      "boolean",
      "long",
      "float",
      "int",
      "byte",
      "short",
      "double"
    ];
    const KEYWORDS3 = {
      keyword: MAIN_KEYWORDS,
      literal: LITERALS3,
      type: TYPES3,
      built_in: BUILT_INS3
    };
    const ANNOTATION = {
      className: "meta",
      begin: "@" + JAVA_IDENT_RE,
      contains: [
        {
          begin: /\(/,
          end: /\)/,
          contains: ["self"]
          // allow nested () inside our annotation
        }
      ]
    };
    const PARAMS = {
      className: "params",
      begin: /\(/,
      end: /\)/,
      keywords: KEYWORDS3,
      relevance: 0,
      contains: [hljs.C_BLOCK_COMMENT_MODE],
      endsParent: true
    };
    return {
      name: "Java",
      aliases: ["jsp"],
      keywords: KEYWORDS3,
      illegal: /<\/|#/,
      contains: [
        hljs.COMMENT(
          "/\\*\\*",
          "\\*/",
          {
            relevance: 0,
            contains: [
              {
                // eat up @'s in emails to prevent them to be recognized as doctags
                begin: /\w+@/,
                relevance: 0
              },
              {
                className: "doctag",
                begin: "@[A-Za-z]+"
              }
            ]
          }
        ),
        // relevance boost
        {
          begin: /import java\.[a-z]+\./,
          keywords: "import",
          relevance: 2
        },
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          begin: /"""/,
          end: /"""/,
          className: "string",
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        {
          match: [
            /\b(?:class|interface|enum|extends|implements|new)/,
            /\s+/,
            JAVA_IDENT_RE
          ],
          className: {
            1: "keyword",
            3: "title.class"
          }
        },
        {
          // Exceptions for hyphenated keywords
          match: /non-sealed/,
          scope: "keyword"
        },
        {
          begin: [
            regex.concat(/(?!else)/, JAVA_IDENT_RE),
            /\s+/,
            JAVA_IDENT_RE,
            /\s+/,
            /=(?!=)/
          ],
          className: {
            1: "type",
            3: "variable",
            5: "operator"
          }
        },
        {
          begin: [
            /record/,
            /\s+/,
            JAVA_IDENT_RE
          ],
          className: {
            1: "keyword",
            3: "title.class"
          },
          contains: [
            PARAMS,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        {
          // Expression keywords prevent 'keyword Name(...)' from being
          // recognized as a function definition
          beginKeywords: "new throw return else",
          relevance: 0
        },
        {
          begin: [
            "(?:" + GENERIC_IDENT_RE + "\\s+)",
            hljs.UNDERSCORE_IDENT_RE,
            /\s*(?=\()/
          ],
          className: { 2: "title.function" },
          keywords: KEYWORDS3,
          contains: [
            {
              className: "params",
              begin: /\(/,
              end: /\)/,
              keywords: KEYWORDS3,
              relevance: 0,
              contains: [
                ANNOTATION,
                hljs.APOS_STRING_MODE,
                hljs.QUOTE_STRING_MODE,
                NUMERIC,
                hljs.C_BLOCK_COMMENT_MODE
              ]
            },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        NUMERIC,
        ANNOTATION
      ]
    };
  }

  // node_modules/highlight.js/es/languages/javascript.js
  var IDENT_RE = "[A-Za-z$_][0-9A-Za-z$_]*";
  var KEYWORDS = [
    "as",
    // for exports
    "in",
    "of",
    "if",
    "for",
    "while",
    "finally",
    "var",
    "new",
    "function",
    "do",
    "return",
    "void",
    "else",
    "break",
    "catch",
    "instanceof",
    "with",
    "throw",
    "case",
    "default",
    "try",
    "switch",
    "continue",
    "typeof",
    "delete",
    "let",
    "yield",
    "const",
    "class",
    // JS handles these with a special rule
    // "get",
    // "set",
    "debugger",
    "async",
    "await",
    "static",
    "import",
    "from",
    "export",
    "extends",
    // It's reached stage 3, which is "recommended for implementation":
    "using"
  ];
  var LITERALS = [
    "true",
    "false",
    "null",
    "undefined",
    "NaN",
    "Infinity"
  ];
  var TYPES = [
    // Fundamental objects
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    // numbers and dates
    "Math",
    "Date",
    "Number",
    "BigInt",
    // text
    "String",
    "RegExp",
    // Indexed collections
    "Array",
    "Float32Array",
    "Float64Array",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Int32Array",
    "Uint16Array",
    "Uint32Array",
    "BigInt64Array",
    "BigUint64Array",
    // Keyed collections
    "Set",
    "Map",
    "WeakSet",
    "WeakMap",
    // Structured data
    "ArrayBuffer",
    "SharedArrayBuffer",
    "Atomics",
    "DataView",
    "JSON",
    // Control abstraction objects
    "Promise",
    "Generator",
    "GeneratorFunction",
    "AsyncFunction",
    // Reflection
    "Reflect",
    "Proxy",
    // Internationalization
    "Intl",
    // WebAssembly
    "WebAssembly"
  ];
  var ERROR_TYPES = [
    "Error",
    "EvalError",
    "InternalError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError"
  ];
  var BUILT_IN_GLOBALS = [
    "setInterval",
    "setTimeout",
    "clearInterval",
    "clearTimeout",
    "require",
    "exports",
    "eval",
    "isFinite",
    "isNaN",
    "parseFloat",
    "parseInt",
    "decodeURI",
    "decodeURIComponent",
    "encodeURI",
    "encodeURIComponent",
    "escape",
    "unescape"
  ];
  var BUILT_IN_VARIABLES = [
    "arguments",
    "this",
    "super",
    "console",
    "window",
    "document",
    "localStorage",
    "sessionStorage",
    "module",
    "global"
    // Node.js
  ];
  var BUILT_INS = [].concat(
    BUILT_IN_GLOBALS,
    TYPES,
    ERROR_TYPES
  );
  function javascript(hljs) {
    const regex = hljs.regex;
    const hasClosingTag = (match, { after }) => {
      const tag = "</" + match[0].slice(1);
      const pos = match.input.indexOf(tag, after);
      return pos !== -1;
    };
    const IDENT_RE$1 = IDENT_RE;
    const FRAGMENT = {
      begin: "<>",
      end: "</>"
    };
    const XML_SELF_CLOSING = /<[A-Za-z0-9\\._:-]+\s*\/>/;
    const XML_TAG = {
      begin: /<[A-Za-z0-9\\._:-]+/,
      end: /\/[A-Za-z0-9\\._:-]+>|\/>/,
      /**
       * @param {RegExpMatchArray} match
       * @param {CallbackResponse} response
       */
      isTrulyOpeningTag: (match, response) => {
        const afterMatchIndex = match[0].length + match.index;
        const nextChar = match.input[afterMatchIndex];
        if (
          // HTML should not include another raw `<` inside a tag
          // nested type?
          // `<Array<Array<number>>`, etc.
          nextChar === "<" || // the , gives away that this is not HTML
          // `<T, A extends keyof T, V>`
          nextChar === ","
        ) {
          response.ignoreMatch();
          return;
        }
        if (nextChar === ">") {
          if (!hasClosingTag(match, { after: afterMatchIndex })) {
            response.ignoreMatch();
          }
        }
        let m;
        const afterMatch = match.input.substring(afterMatchIndex);
        if (m = afterMatch.match(/^\s*=/)) {
          response.ignoreMatch();
          return;
        }
        if (m = afterMatch.match(/^\s+extends\s+/)) {
          if (m.index === 0) {
            response.ignoreMatch();
            return;
          }
        }
      }
    };
    const KEYWORDS$1 = {
      $pattern: IDENT_RE,
      keyword: KEYWORDS,
      literal: LITERALS,
      built_in: BUILT_INS,
      "variable.language": BUILT_IN_VARIABLES
    };
    const decimalDigits3 = "[0-9](_?[0-9])*";
    const frac3 = `\\.(${decimalDigits3})`;
    const decimalInteger = `0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*`;
    const NUMBER = {
      className: "number",
      variants: [
        // DecimalLiteral
        { begin: `(\\b(${decimalInteger})((${frac3})|\\.)?|(${frac3}))[eE][+-]?(${decimalDigits3})\\b` },
        { begin: `\\b(${decimalInteger})\\b((${frac3})\\b|\\.)?|(${frac3})\\b` },
        // DecimalBigIntegerLiteral
        { begin: `\\b(0|[1-9](_?[0-9])*)n\\b` },
        // NonDecimalIntegerLiteral
        { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b" },
        { begin: "\\b0[bB][0-1](_?[0-1])*n?\\b" },
        { begin: "\\b0[oO][0-7](_?[0-7])*n?\\b" },
        // LegacyOctalIntegerLiteral (does not include underscore separators)
        // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
        { begin: "\\b0[0-7]+n?\\b" }
      ],
      relevance: 0
    };
    const SUBST = {
      className: "subst",
      begin: "\\$\\{",
      end: "\\}",
      keywords: KEYWORDS$1,
      contains: []
      // defined later
    };
    const HTML_TEMPLATE = {
      begin: ".?html`",
      end: "",
      starts: {
        end: "`",
        returnEnd: false,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        subLanguage: "xml"
      }
    };
    const CSS_TEMPLATE = {
      begin: ".?css`",
      end: "",
      starts: {
        end: "`",
        returnEnd: false,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        subLanguage: "css"
      }
    };
    const GRAPHQL_TEMPLATE = {
      begin: ".?gql`",
      end: "",
      starts: {
        end: "`",
        returnEnd: false,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        subLanguage: "graphql"
      }
    };
    const TEMPLATE_STRING = {
      className: "string",
      begin: "`",
      end: "`",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ]
    };
    const JSDOC_COMMENT = hljs.COMMENT(
      /\/\*\*(?!\/)/,
      "\\*/",
      {
        relevance: 0,
        contains: [
          {
            begin: "(?=@[A-Za-z]+)",
            relevance: 0,
            contains: [
              {
                className: "doctag",
                begin: "@[A-Za-z]+"
              },
              {
                className: "type",
                begin: "\\{",
                end: "\\}",
                excludeEnd: true,
                excludeBegin: true,
                relevance: 0
              },
              {
                className: "variable",
                begin: IDENT_RE$1 + "(?=\\s*(-)|$)",
                endsParent: true,
                relevance: 0
              },
              // eat spaces (not newlines) so we can find
              // types or variables
              {
                begin: /(?=[^\n])\s/,
                relevance: 0
              }
            ]
          }
        ]
      }
    );
    const COMMENT = {
      className: "comment",
      variants: [
        JSDOC_COMMENT,
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.C_LINE_COMMENT_MODE
      ]
    };
    const SUBST_INTERNALS = [
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      HTML_TEMPLATE,
      CSS_TEMPLATE,
      GRAPHQL_TEMPLATE,
      TEMPLATE_STRING,
      // Skip numbers when they are part of a variable name
      { match: /\$\d+/ },
      NUMBER
      // This is intentional:
      // See https://github.com/highlightjs/highlight.js/issues/3288
      // hljs.REGEXP_MODE
    ];
    SUBST.contains = SUBST_INTERNALS.concat({
      // we need to pair up {} inside our subst to prevent
      // it from ending too early by matching another }
      begin: /\{/,
      end: /\}/,
      keywords: KEYWORDS$1,
      contains: [
        "self"
      ].concat(SUBST_INTERNALS)
    });
    const SUBST_AND_COMMENTS = [].concat(COMMENT, SUBST.contains);
    const PARAMS_CONTAINS = SUBST_AND_COMMENTS.concat([
      // eat recursive parens in sub expressions
      {
        begin: /(\s*)\(/,
        end: /\)/,
        keywords: KEYWORDS$1,
        contains: ["self"].concat(SUBST_AND_COMMENTS)
      }
    ]);
    const PARAMS = {
      className: "params",
      // convert this to negative lookbehind in v12
      begin: /(\s*)\(/,
      // to match the parms with
      end: /\)/,
      excludeBegin: true,
      excludeEnd: true,
      keywords: KEYWORDS$1,
      contains: PARAMS_CONTAINS
    };
    const CLASS_OR_EXTENDS = {
      variants: [
        // class Car extends vehicle
        {
          match: [
            /class/,
            /\s+/,
            IDENT_RE$1,
            /\s+/,
            /extends/,
            /\s+/,
            regex.concat(IDENT_RE$1, "(", regex.concat(/\./, IDENT_RE$1), ")*")
          ],
          scope: {
            1: "keyword",
            3: "title.class",
            5: "keyword",
            7: "title.class.inherited"
          }
        },
        // class Car
        {
          match: [
            /class/,
            /\s+/,
            IDENT_RE$1
          ],
          scope: {
            1: "keyword",
            3: "title.class"
          }
        }
      ]
    };
    const CLASS_REFERENCE = {
      relevance: 0,
      match: regex.either(
        // Hard coded exceptions
        /\bJSON/,
        // Float32Array, OutT
        /\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,
        // CSSFactory, CSSFactoryT
        /\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,
        // FPs, FPsT
        /\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/
        // P
        // single letters are not highlighted
        // BLAH
        // this will be flagged as a UPPER_CASE_CONSTANT instead
      ),
      className: "title.class",
      keywords: {
        _: [
          // se we still get relevance credit for JS library classes
          ...TYPES,
          ...ERROR_TYPES
        ]
      }
    };
    const USE_STRICT = {
      label: "use_strict",
      className: "meta",
      relevance: 10,
      begin: /^\s*['"]use (strict|asm)['"]/
    };
    const FUNCTION_DEFINITION = {
      variants: [
        {
          match: [
            /function/,
            /\s+/,
            IDENT_RE$1,
            /(?=\s*\()/
          ]
        },
        // anonymous function
        {
          match: [
            /function/,
            /\s*(?=\()/
          ]
        }
      ],
      className: {
        1: "keyword",
        3: "title.function"
      },
      label: "func.def",
      contains: [PARAMS],
      illegal: /%/
    };
    const UPPER_CASE_CONSTANT = {
      relevance: 0,
      match: /\b[A-Z][A-Z_0-9]+\b/,
      className: "variable.constant"
    };
    function noneOf(list) {
      return regex.concat("(?!", list.join("|"), ")");
    }
    const FUNCTION_CALL = {
      match: regex.concat(
        /\b/,
        noneOf([
          ...BUILT_IN_GLOBALS,
          "super",
          "import"
        ].map((x) => `${x}\\s*\\(`)),
        IDENT_RE$1,
        regex.lookahead(/\s*\(/)
      ),
      className: "title.function",
      relevance: 0
    };
    const PROPERTY_ACCESS = {
      begin: regex.concat(/\./, regex.lookahead(
        regex.concat(IDENT_RE$1, /(?![0-9A-Za-z$_(])/)
      )),
      end: IDENT_RE$1,
      excludeBegin: true,
      keywords: "prototype",
      className: "property",
      relevance: 0
    };
    const GETTER_OR_SETTER = {
      match: [
        /get|set/,
        /\s+/,
        IDENT_RE$1,
        /(?=\()/
      ],
      className: {
        1: "keyword",
        3: "title.function"
      },
      contains: [
        {
          // eat to avoid empty params
          begin: /\(\)/
        },
        PARAMS
      ]
    };
    const FUNC_LEAD_IN_RE = "(\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)|" + hljs.UNDERSCORE_IDENT_RE + ")\\s*=>";
    const FUNCTION_VARIABLE = {
      match: [
        /const|var|let/,
        /\s+/,
        IDENT_RE$1,
        /\s*/,
        /=\s*/,
        /(async\s*)?/,
        // async is optional
        regex.lookahead(FUNC_LEAD_IN_RE)
      ],
      keywords: "async",
      className: {
        1: "keyword",
        3: "title.function"
      },
      contains: [
        PARAMS
      ]
    };
    return {
      name: "JavaScript",
      aliases: ["js", "jsx", "mjs", "cjs"],
      keywords: KEYWORDS$1,
      // this will be extended by TypeScript
      exports: { PARAMS_CONTAINS, CLASS_REFERENCE },
      illegal: /#(?![$_A-z])/,
      contains: [
        hljs.SHEBANG({
          label: "shebang",
          binary: "node",
          relevance: 5
        }),
        USE_STRICT,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        HTML_TEMPLATE,
        CSS_TEMPLATE,
        GRAPHQL_TEMPLATE,
        TEMPLATE_STRING,
        COMMENT,
        // Skip numbers when they are part of a variable name
        { match: /\$\d+/ },
        NUMBER,
        CLASS_REFERENCE,
        {
          scope: "attr",
          match: IDENT_RE$1 + regex.lookahead(":"),
          relevance: 0
        },
        FUNCTION_VARIABLE,
        {
          // "value" container
          begin: "(" + hljs.RE_STARTERS_RE + "|\\b(case|return|throw)\\b)\\s*",
          keywords: "return throw case",
          relevance: 0,
          contains: [
            COMMENT,
            hljs.REGEXP_MODE,
            {
              className: "function",
              // we have to count the parens to make sure we actually have the
              // correct bounding ( ) before the =>.  There could be any number of
              // sub-expressions inside also surrounded by parens.
              begin: FUNC_LEAD_IN_RE,
              returnBegin: true,
              end: "\\s*=>",
              contains: [
                {
                  className: "params",
                  variants: [
                    {
                      begin: hljs.UNDERSCORE_IDENT_RE,
                      relevance: 0
                    },
                    {
                      className: null,
                      begin: /\(\s*\)/,
                      skip: true
                    },
                    {
                      begin: /(\s*)\(/,
                      end: /\)/,
                      excludeBegin: true,
                      excludeEnd: true,
                      keywords: KEYWORDS$1,
                      contains: PARAMS_CONTAINS
                    }
                  ]
                }
              ]
            },
            {
              // could be a comma delimited list of params to a function call
              begin: /,/,
              relevance: 0
            },
            {
              match: /\s+/,
              relevance: 0
            },
            {
              // JSX
              variants: [
                { begin: FRAGMENT.begin, end: FRAGMENT.end },
                { match: XML_SELF_CLOSING },
                {
                  begin: XML_TAG.begin,
                  // we carefully check the opening tag to see if it truly
                  // is a tag and not a false positive
                  "on:begin": XML_TAG.isTrulyOpeningTag,
                  end: XML_TAG.end
                }
              ],
              subLanguage: "xml",
              contains: [
                {
                  begin: XML_TAG.begin,
                  end: XML_TAG.end,
                  skip: true,
                  contains: ["self"]
                }
              ]
            }
          ]
        },
        FUNCTION_DEFINITION,
        {
          // prevent this from getting swallowed up by function
          // since they appear "function like"
          beginKeywords: "while if switch catch for"
        },
        {
          // we have to count the parens to make sure we actually have the correct
          // bounding ( ).  There could be any number of sub-expressions inside
          // also surrounded by parens.
          begin: "\\b(?!function)" + hljs.UNDERSCORE_IDENT_RE + "\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)\\s*\\{",
          // end parens
          returnBegin: true,
          label: "func.def",
          contains: [
            PARAMS,
            hljs.inherit(hljs.TITLE_MODE, { begin: IDENT_RE$1, className: "title.function" })
          ]
        },
        // catch ... so it won't trigger the property rule below
        {
          match: /\.\.\./,
          relevance: 0
        },
        PROPERTY_ACCESS,
        // hack: prevents detection of keywords in some circumstances
        // .keyword()
        // $keyword = x
        {
          match: "\\$" + IDENT_RE$1,
          relevance: 0
        },
        {
          match: [/\bconstructor(?=\s*\()/],
          className: { 1: "title.function" },
          contains: [PARAMS]
        },
        FUNCTION_CALL,
        UPPER_CASE_CONSTANT,
        CLASS_OR_EXTENDS,
        GETTER_OR_SETTER,
        {
          match: /\$[(.]/
          // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/json.js
  function json(hljs) {
    const ATTRIBUTE = {
      className: "attr",
      begin: /"(\\.|[^\\"\r\n])*"(?=\s*:)/,
      relevance: 1.01
    };
    const PUNCTUATION = {
      match: /[{}[\],:]/,
      className: "punctuation",
      relevance: 0
    };
    const LITERALS3 = [
      "true",
      "false",
      "null"
    ];
    const LITERALS_MODE = {
      scope: "literal",
      beginKeywords: LITERALS3.join(" ")
    };
    return {
      name: "JSON",
      aliases: ["jsonc"],
      keywords: {
        literal: LITERALS3
      },
      contains: [
        ATTRIBUTE,
        PUNCTUATION,
        hljs.QUOTE_STRING_MODE,
        LITERALS_MODE,
        hljs.C_NUMBER_MODE,
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE
      ],
      illegal: "\\S"
    };
  }

  // node_modules/highlight.js/es/languages/julia.js
  function julia(hljs) {
    const VARIABLE_NAME_RE = "[A-Za-z_\\u00A1-\\uFFFF][A-Za-z_0-9\\u00A1-\\uFFFF]*";
    const KEYWORD_LIST = [
      "baremodule",
      "begin",
      "break",
      "catch",
      "ccall",
      "const",
      "continue",
      "do",
      "else",
      "elseif",
      "end",
      "export",
      "false",
      "finally",
      "for",
      "function",
      "global",
      "if",
      "import",
      "in",
      "isa",
      "let",
      "local",
      "macro",
      "module",
      "quote",
      "return",
      "true",
      "try",
      "using",
      "where",
      "while"
    ];
    const LITERAL_LIST = [
      "ARGS",
      "C_NULL",
      "DEPOT_PATH",
      "ENDIAN_BOM",
      "ENV",
      "Inf",
      "Inf16",
      "Inf32",
      "Inf64",
      "InsertionSort",
      "LOAD_PATH",
      "MergeSort",
      "NaN",
      "NaN16",
      "NaN32",
      "NaN64",
      "PROGRAM_FILE",
      "QuickSort",
      "RoundDown",
      "RoundFromZero",
      "RoundNearest",
      "RoundNearestTiesAway",
      "RoundNearestTiesUp",
      "RoundToZero",
      "RoundUp",
      "VERSION|0",
      "devnull",
      "false",
      "im",
      "missing",
      "nothing",
      "pi",
      "stderr",
      "stdin",
      "stdout",
      "true",
      "undef",
      "\u03C0",
      "\u212F"
    ];
    const BUILT_IN_LIST = [
      "AbstractArray",
      "AbstractChannel",
      "AbstractChar",
      "AbstractDict",
      "AbstractDisplay",
      "AbstractFloat",
      "AbstractIrrational",
      "AbstractMatrix",
      "AbstractRange",
      "AbstractSet",
      "AbstractString",
      "AbstractUnitRange",
      "AbstractVecOrMat",
      "AbstractVector",
      "Any",
      "ArgumentError",
      "Array",
      "AssertionError",
      "BigFloat",
      "BigInt",
      "BitArray",
      "BitMatrix",
      "BitSet",
      "BitVector",
      "Bool",
      "BoundsError",
      "CapturedException",
      "CartesianIndex",
      "CartesianIndices",
      "Cchar",
      "Cdouble",
      "Cfloat",
      "Channel",
      "Char",
      "Cint",
      "Cintmax_t",
      "Clong",
      "Clonglong",
      "Cmd",
      "Colon",
      "Complex",
      "ComplexF16",
      "ComplexF32",
      "ComplexF64",
      "CompositeException",
      "Condition",
      "Cptrdiff_t",
      "Cshort",
      "Csize_t",
      "Cssize_t",
      "Cstring",
      "Cuchar",
      "Cuint",
      "Cuintmax_t",
      "Culong",
      "Culonglong",
      "Cushort",
      "Cvoid",
      "Cwchar_t",
      "Cwstring",
      "DataType",
      "DenseArray",
      "DenseMatrix",
      "DenseVecOrMat",
      "DenseVector",
      "Dict",
      "DimensionMismatch",
      "Dims",
      "DivideError",
      "DomainError",
      "EOFError",
      "Enum",
      "ErrorException",
      "Exception",
      "ExponentialBackOff",
      "Expr",
      "Float16",
      "Float32",
      "Float64",
      "Function",
      "GlobalRef",
      "HTML",
      "IO",
      "IOBuffer",
      "IOContext",
      "IOStream",
      "IdDict",
      "IndexCartesian",
      "IndexLinear",
      "IndexStyle",
      "InexactError",
      "InitError",
      "Int",
      "Int128",
      "Int16",
      "Int32",
      "Int64",
      "Int8",
      "Integer",
      "InterruptException",
      "InvalidStateException",
      "Irrational",
      "KeyError",
      "LinRange",
      "LineNumberNode",
      "LinearIndices",
      "LoadError",
      "MIME",
      "Matrix",
      "Method",
      "MethodError",
      "Missing",
      "MissingException",
      "Module",
      "NTuple",
      "NamedTuple",
      "Nothing",
      "Number",
      "OrdinalRange",
      "OutOfMemoryError",
      "OverflowError",
      "Pair",
      "PartialQuickSort",
      "PermutedDimsArray",
      "Pipe",
      "ProcessFailedException",
      "Ptr",
      "QuoteNode",
      "Rational",
      "RawFD",
      "ReadOnlyMemoryError",
      "Real",
      "ReentrantLock",
      "Ref",
      "Regex",
      "RegexMatch",
      "RoundingMode",
      "SegmentationFault",
      "Set",
      "Signed",
      "Some",
      "StackOverflowError",
      "StepRange",
      "StepRangeLen",
      "StridedArray",
      "StridedMatrix",
      "StridedVecOrMat",
      "StridedVector",
      "String",
      "StringIndexError",
      "SubArray",
      "SubString",
      "SubstitutionString",
      "Symbol",
      "SystemError",
      "Task",
      "TaskFailedException",
      "Text",
      "TextDisplay",
      "Timer",
      "Tuple",
      "Type",
      "TypeError",
      "TypeVar",
      "UInt",
      "UInt128",
      "UInt16",
      "UInt32",
      "UInt64",
      "UInt8",
      "UndefInitializer",
      "UndefKeywordError",
      "UndefRefError",
      "UndefVarError",
      "Union",
      "UnionAll",
      "UnitRange",
      "Unsigned",
      "Val",
      "Vararg",
      "VecElement",
      "VecOrMat",
      "Vector",
      "VersionNumber",
      "WeakKeyDict",
      "WeakRef"
    ];
    const KEYWORDS3 = {
      $pattern: VARIABLE_NAME_RE,
      keyword: KEYWORD_LIST,
      literal: LITERAL_LIST,
      built_in: BUILT_IN_LIST
    };
    const DEFAULT = {
      keywords: KEYWORDS3,
      illegal: /<\//
    };
    const NUMBER = {
      className: "number",
      // supported numeric literals:
      //  * binary literal (e.g. 0x10)
      //  * octal literal (e.g. 0o76543210)
      //  * hexadecimal literal (e.g. 0xfedcba876543210)
      //  * hexadecimal floating point literal (e.g. 0x1p0, 0x1.2p2)
      //  * decimal literal (e.g. 9876543210, 100_000_000)
      //  * floating pointe literal (e.g. 1.2, 1.2f, .2, 1., 1.2e10, 1.2e-10)
      begin: /(\b0x[\d_]*(\.[\d_]*)?|0x\.\d[\d_]*)p[-+]?\d+|\b0[box][a-fA-F0-9][a-fA-F0-9_]*|(\b\d[\d_]*(\.[\d_]*)?|\.\d[\d_]*)([eEfF][-+]?\d+)?/,
      relevance: 0
    };
    const CHAR = {
      className: "string",
      begin: /'(.|\\[xXuU][a-zA-Z0-9]+)'/
    };
    const INTERPOLATION = {
      className: "subst",
      begin: /\$\(/,
      end: /\)/,
      keywords: KEYWORDS3
    };
    const INTERPOLATED_VARIABLE = {
      className: "variable",
      begin: "\\$" + VARIABLE_NAME_RE
    };
    const STRING = {
      className: "string",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        INTERPOLATION,
        INTERPOLATED_VARIABLE
      ],
      variants: [
        {
          begin: /\w*"""/,
          end: /"""\w*/,
          relevance: 10
        },
        {
          begin: /\w*"/,
          end: /"\w*/
        }
      ]
    };
    const COMMAND = {
      className: "string",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        INTERPOLATION,
        INTERPOLATED_VARIABLE
      ],
      begin: "`",
      end: "`"
    };
    const MACROCALL = {
      className: "meta",
      begin: "@" + VARIABLE_NAME_RE
    };
    const COMMENT = {
      className: "comment",
      variants: [
        {
          begin: "#=",
          end: "=#",
          relevance: 10
        },
        {
          begin: "#",
          end: "$"
        }
      ]
    };
    DEFAULT.name = "Julia";
    DEFAULT.contains = [
      NUMBER,
      CHAR,
      STRING,
      COMMAND,
      MACROCALL,
      COMMENT,
      hljs.HASH_COMMENT_MODE,
      {
        className: "keyword",
        begin: "\\b(((abstract|primitive)\\s+)type|(mutable\\s+)?struct)\\b"
      },
      { begin: /<:/ }
      // relevance booster
    ];
    INTERPOLATION.contains = DEFAULT.contains;
    return DEFAULT;
  }

  // node_modules/highlight.js/es/languages/kotlin.js
  var decimalDigits2 = "[0-9](_*[0-9])*";
  var frac2 = `\\.(${decimalDigits2})`;
  var hexDigits2 = "[0-9a-fA-F](_*[0-9a-fA-F])*";
  var NUMERIC2 = {
    className: "number",
    variants: [
      // DecimalFloatingPointLiteral
      // including ExponentPart
      { begin: `(\\b(${decimalDigits2})((${frac2})|\\.)?|(${frac2}))[eE][+-]?(${decimalDigits2})[fFdD]?\\b` },
      // excluding ExponentPart
      { begin: `\\b(${decimalDigits2})((${frac2})[fFdD]?\\b|\\.([fFdD]\\b)?)` },
      { begin: `(${frac2})[fFdD]?\\b` },
      { begin: `\\b(${decimalDigits2})[fFdD]\\b` },
      // HexadecimalFloatingPointLiteral
      { begin: `\\b0[xX]((${hexDigits2})\\.?|(${hexDigits2})?\\.(${hexDigits2}))[pP][+-]?(${decimalDigits2})[fFdD]?\\b` },
      // DecimalIntegerLiteral
      { begin: "\\b(0|[1-9](_*[0-9])*)[lL]?\\b" },
      // HexIntegerLiteral
      { begin: `\\b0[xX](${hexDigits2})[lL]?\\b` },
      // OctalIntegerLiteral
      { begin: "\\b0(_*[0-7])*[lL]?\\b" },
      // BinaryIntegerLiteral
      { begin: "\\b0[bB][01](_*[01])*[lL]?\\b" }
    ],
    relevance: 0
  };
  function kotlin(hljs) {
    const KEYWORDS3 = {
      keyword: "abstract as val var vararg get set class object open private protected public noinline crossinline dynamic final enum if else do while for when throw try catch finally import package is in fun override companion reified inline lateinit init interface annotation data sealed internal infix operator out by constructor super tailrec where const inner suspend typealias external expect actual",
      built_in: "Byte Short Char Int Long Boolean Float Double Void Unit Nothing",
      literal: "true false null"
    };
    const KEYWORDS_WITH_LABEL = {
      className: "keyword",
      begin: /\b(break|continue|return|this)\b/,
      starts: { contains: [
        {
          className: "symbol",
          begin: /@\w+/
        }
      ] }
    };
    const LABEL = {
      className: "symbol",
      begin: hljs.UNDERSCORE_IDENT_RE + "@"
    };
    const SUBST = {
      className: "subst",
      begin: /\$\{/,
      end: /\}/,
      contains: [hljs.C_NUMBER_MODE]
    };
    const VARIABLE = {
      className: "variable",
      begin: "\\$" + hljs.UNDERSCORE_IDENT_RE
    };
    const STRING = {
      className: "string",
      variants: [
        {
          begin: '"""',
          end: '"""(?=[^"])',
          contains: [
            VARIABLE,
            SUBST
          ]
        },
        // Can't use built-in modes easily, as we want to use STRING in the meta
        // context as 'meta-string' and there's no syntax to remove explicitly set
        // classNames in built-in modes.
        {
          begin: "'",
          end: "'",
          illegal: /\n/,
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: '"',
          end: '"',
          illegal: /\n/,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            VARIABLE,
            SUBST
          ]
        }
      ]
    };
    SUBST.contains.push(STRING);
    const ANNOTATION_USE_SITE = {
      className: "meta",
      begin: "@(?:file|property|field|get|set|receiver|param|setparam|delegate)\\s*:(?:\\s*" + hljs.UNDERSCORE_IDENT_RE + ")?"
    };
    const ANNOTATION = {
      className: "meta",
      begin: "@" + hljs.UNDERSCORE_IDENT_RE,
      contains: [
        {
          begin: /\(/,
          end: /\)/,
          contains: [
            hljs.inherit(STRING, { className: "string" }),
            "self"
          ]
        }
      ]
    };
    const KOTLIN_NUMBER_MODE = NUMERIC2;
    const KOTLIN_NESTED_COMMENT = hljs.COMMENT(
      "/\\*",
      "\\*/",
      { contains: [hljs.C_BLOCK_COMMENT_MODE] }
    );
    const KOTLIN_PAREN_TYPE = { variants: [
      {
        className: "type",
        begin: hljs.UNDERSCORE_IDENT_RE
      },
      {
        begin: /\(/,
        end: /\)/,
        contains: []
        // defined later
      }
    ] };
    const KOTLIN_PAREN_TYPE2 = KOTLIN_PAREN_TYPE;
    KOTLIN_PAREN_TYPE2.variants[1].contains = [KOTLIN_PAREN_TYPE];
    KOTLIN_PAREN_TYPE.variants[1].contains = [KOTLIN_PAREN_TYPE2];
    return {
      name: "Kotlin",
      aliases: [
        "kt",
        "kts"
      ],
      keywords: KEYWORDS3,
      contains: [
        hljs.COMMENT(
          "/\\*\\*",
          "\\*/",
          {
            relevance: 0,
            contains: [
              {
                className: "doctag",
                begin: "@[A-Za-z]+"
              }
            ]
          }
        ),
        hljs.C_LINE_COMMENT_MODE,
        KOTLIN_NESTED_COMMENT,
        KEYWORDS_WITH_LABEL,
        LABEL,
        ANNOTATION_USE_SITE,
        ANNOTATION,
        {
          className: "function",
          beginKeywords: "fun",
          end: "[(]|$",
          returnBegin: true,
          excludeEnd: true,
          keywords: KEYWORDS3,
          relevance: 5,
          contains: [
            {
              begin: hljs.UNDERSCORE_IDENT_RE + "\\s*\\(",
              returnBegin: true,
              relevance: 0,
              contains: [hljs.UNDERSCORE_TITLE_MODE]
            },
            {
              className: "type",
              begin: /</,
              end: />/,
              keywords: "reified",
              relevance: 0
            },
            {
              className: "params",
              begin: /\(/,
              end: /\)/,
              endsParent: true,
              keywords: KEYWORDS3,
              relevance: 0,
              contains: [
                {
                  begin: /:/,
                  end: /[=,\/]/,
                  endsWithParent: true,
                  contains: [
                    KOTLIN_PAREN_TYPE,
                    hljs.C_LINE_COMMENT_MODE,
                    KOTLIN_NESTED_COMMENT
                  ],
                  relevance: 0
                },
                hljs.C_LINE_COMMENT_MODE,
                KOTLIN_NESTED_COMMENT,
                ANNOTATION_USE_SITE,
                ANNOTATION,
                STRING,
                hljs.C_NUMBER_MODE
              ]
            },
            KOTLIN_NESTED_COMMENT
          ]
        },
        {
          begin: [
            /class|interface|trait/,
            /\s+/,
            hljs.UNDERSCORE_IDENT_RE
          ],
          beginScope: {
            3: "title.class"
          },
          keywords: "class interface trait",
          end: /[:\{(]|$/,
          excludeEnd: true,
          illegal: "extends implements",
          contains: [
            { beginKeywords: "public protected internal private constructor" },
            hljs.UNDERSCORE_TITLE_MODE,
            {
              className: "type",
              begin: /</,
              end: />/,
              excludeBegin: true,
              excludeEnd: true,
              relevance: 0
            },
            {
              className: "type",
              begin: /[,:]\s*/,
              end: /[<\(,){\s]|$/,
              excludeBegin: true,
              returnEnd: true
            },
            ANNOTATION_USE_SITE,
            ANNOTATION
          ]
        },
        STRING,
        {
          className: "meta",
          begin: "^#!/usr/bin/env",
          end: "$",
          illegal: "\n"
        },
        KOTLIN_NUMBER_MODE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/latex.js
  function latex(hljs) {
    const regex = hljs.regex;
    const KNOWN_CONTROL_WORDS = regex.either(...[
      "(?:NeedsTeXFormat|RequirePackage|GetIdInfo)",
      "Provides(?:Expl)?(?:Package|Class|File)",
      "(?:DeclareOption|ProcessOptions)",
      "(?:documentclass|usepackage|input|include)",
      "makeat(?:letter|other)",
      "ExplSyntax(?:On|Off)",
      "(?:new|renew|provide)?command",
      "(?:re)newenvironment",
      "(?:New|Renew|Provide|Declare)(?:Expandable)?DocumentCommand",
      "(?:New|Renew|Provide|Declare)DocumentEnvironment",
      "(?:(?:e|g|x)?def|let)",
      "(?:begin|end)",
      "(?:part|chapter|(?:sub){0,2}section|(?:sub)?paragraph)",
      "caption",
      "(?:label|(?:eq|page|name)?ref|(?:paren|foot|super)?cite)",
      "(?:alpha|beta|[Gg]amma|[Dd]elta|(?:var)?epsilon|zeta|eta|[Tt]heta|vartheta)",
      "(?:iota|(?:var)?kappa|[Ll]ambda|mu|nu|[Xx]i|[Pp]i|varpi|(?:var)rho)",
      "(?:[Ss]igma|varsigma|tau|[Uu]psilon|[Pp]hi|varphi|chi|[Pp]si|[Oo]mega)",
      "(?:frac|sum|prod|lim|infty|times|sqrt|leq|geq|left|right|middle|[bB]igg?)",
      "(?:[lr]angle|q?quad|[lcvdi]?dots|d?dot|hat|tilde|bar)"
    ].map((word) => word + "(?![a-zA-Z@:_])"));
    const L3_REGEX = new RegExp([
      // A function \module_function_name:signature or \__module_function_name:signature,
      // where both module and function_name need at least two characters and
      // function_name may contain single underscores.
      "(?:__)?[a-zA-Z]{2,}_[a-zA-Z](?:_?[a-zA-Z])+:[a-zA-Z]*",
      // A variable \scope_module_and_name_type or \scope__module_ane_name_type,
      // where scope is one of l, g or c, type needs at least two characters
      // and module_and_name may contain single underscores.
      "[lgc]__?[a-zA-Z](?:_?[a-zA-Z])*_[a-zA-Z]{2,}",
      // A quark \q_the_name or \q__the_name or
      // scan mark \s_the_name or \s__vthe_name,
      // where variable_name needs at least two characters and
      // may contain single underscores.
      "[qs]__?[a-zA-Z](?:_?[a-zA-Z])+",
      // Other LaTeX3 macro names that are not covered by the three rules above.
      "use(?:_i)?:[a-zA-Z]*",
      "(?:else|fi|or):",
      "(?:if|cs|exp):w",
      "(?:hbox|vbox):n",
      "::[a-zA-Z]_unbraced",
      "::[a-zA-Z:]"
    ].map((pattern) => pattern + "(?![a-zA-Z:_])").join("|"));
    const L2_VARIANTS = [
      { begin: /[a-zA-Z@]+/ },
      // control word
      { begin: /[^a-zA-Z@]?/ }
      // control symbol
    ];
    const DOUBLE_CARET_VARIANTS = [
      { begin: /\^{6}[0-9a-f]{6}/ },
      { begin: /\^{5}[0-9a-f]{5}/ },
      { begin: /\^{4}[0-9a-f]{4}/ },
      { begin: /\^{3}[0-9a-f]{3}/ },
      { begin: /\^{2}[0-9a-f]{2}/ },
      { begin: /\^{2}[\u0000-\u007f]/ }
    ];
    const CONTROL_SEQUENCE = {
      className: "keyword",
      begin: /\\/,
      relevance: 0,
      contains: [
        {
          endsParent: true,
          begin: KNOWN_CONTROL_WORDS
        },
        {
          endsParent: true,
          begin: L3_REGEX
        },
        {
          endsParent: true,
          variants: DOUBLE_CARET_VARIANTS
        },
        {
          endsParent: true,
          relevance: 0,
          variants: L2_VARIANTS
        }
      ]
    };
    const MACRO_PARAM = {
      className: "params",
      relevance: 0,
      begin: /#+\d?/
    };
    const DOUBLE_CARET_CHAR = {
      // relevance: 1
      variants: DOUBLE_CARET_VARIANTS
    };
    const SPECIAL_CATCODE = {
      className: "built_in",
      relevance: 0,
      begin: /[$&^_]/
    };
    const MAGIC_COMMENT = {
      className: "meta",
      begin: /% ?!(T[eE]X|tex|BIB|bib)/,
      end: "$",
      relevance: 10
    };
    const COMMENT = hljs.COMMENT(
      "%",
      "$",
      { relevance: 0 }
    );
    const EVERYTHING_BUT_VERBATIM = [
      CONTROL_SEQUENCE,
      MACRO_PARAM,
      DOUBLE_CARET_CHAR,
      SPECIAL_CATCODE,
      MAGIC_COMMENT,
      COMMENT
    ];
    const BRACE_GROUP_NO_VERBATIM = {
      begin: /\{/,
      end: /\}/,
      relevance: 0,
      contains: [
        "self",
        ...EVERYTHING_BUT_VERBATIM
      ]
    };
    const ARGUMENT_BRACES = hljs.inherit(
      BRACE_GROUP_NO_VERBATIM,
      {
        relevance: 0,
        endsParent: true,
        contains: [
          BRACE_GROUP_NO_VERBATIM,
          ...EVERYTHING_BUT_VERBATIM
        ]
      }
    );
    const ARGUMENT_BRACKETS = {
      begin: /\[/,
      end: /\]/,
      endsParent: true,
      relevance: 0,
      contains: [
        BRACE_GROUP_NO_VERBATIM,
        ...EVERYTHING_BUT_VERBATIM
      ]
    };
    const SPACE_GOBBLER = {
      begin: /\s+/,
      relevance: 0
    };
    const ARGUMENT_M = [ARGUMENT_BRACES];
    const ARGUMENT_O = [ARGUMENT_BRACKETS];
    const ARGUMENT_AND_THEN = function(arg, starts_mode) {
      return {
        contains: [SPACE_GOBBLER],
        starts: {
          relevance: 0,
          contains: arg,
          starts: starts_mode
        }
      };
    };
    const CSNAME = function(csname, starts_mode) {
      return {
        begin: "\\\\" + csname + "(?![a-zA-Z@:_])",
        keywords: {
          $pattern: /\\[a-zA-Z]+/,
          keyword: "\\" + csname
        },
        relevance: 0,
        contains: [SPACE_GOBBLER],
        starts: starts_mode
      };
    };
    const BEGIN_ENV = function(envname, starts_mode) {
      return hljs.inherit(
        {
          begin: "\\\\begin(?=[ 	]*(\\r?\\n[ 	]*)?\\{" + envname + "\\})",
          keywords: {
            $pattern: /\\[a-zA-Z]+/,
            keyword: "\\begin"
          },
          relevance: 0
        },
        ARGUMENT_AND_THEN(ARGUMENT_M, starts_mode)
      );
    };
    const VERBATIM_DELIMITED_EQUAL = (innerName = "string") => {
      return hljs.END_SAME_AS_BEGIN({
        className: innerName,
        begin: /(.|\r?\n)/,
        end: /(.|\r?\n)/,
        excludeBegin: true,
        excludeEnd: true,
        endsParent: true
      });
    };
    const VERBATIM_DELIMITED_ENV = function(envname) {
      return {
        className: "string",
        end: "(?=\\\\end\\{" + envname + "\\})"
      };
    };
    const VERBATIM_DELIMITED_BRACES = (innerName = "string") => {
      return {
        relevance: 0,
        begin: /\{/,
        starts: {
          endsParent: true,
          contains: [
            {
              className: innerName,
              end: /(?=\})/,
              endsParent: true,
              contains: [
                {
                  begin: /\{/,
                  end: /\}/,
                  relevance: 0,
                  contains: ["self"]
                }
              ]
            }
          ]
        }
      };
    };
    const VERBATIM = [
      ...[
        "verb",
        "lstinline"
      ].map((csname) => CSNAME(csname, { contains: [VERBATIM_DELIMITED_EQUAL()] })),
      CSNAME("mint", ARGUMENT_AND_THEN(ARGUMENT_M, { contains: [VERBATIM_DELIMITED_EQUAL()] })),
      CSNAME("mintinline", ARGUMENT_AND_THEN(ARGUMENT_M, { contains: [
        VERBATIM_DELIMITED_BRACES(),
        VERBATIM_DELIMITED_EQUAL()
      ] })),
      CSNAME("url", { contains: [
        VERBATIM_DELIMITED_BRACES("link"),
        VERBATIM_DELIMITED_BRACES("link")
      ] }),
      CSNAME("hyperref", { contains: [VERBATIM_DELIMITED_BRACES("link")] }),
      CSNAME("href", ARGUMENT_AND_THEN(ARGUMENT_O, { contains: [VERBATIM_DELIMITED_BRACES("link")] })),
      ...[].concat(...[
        "",
        "\\*"
      ].map((suffix) => [
        BEGIN_ENV("verbatim" + suffix, VERBATIM_DELIMITED_ENV("verbatim" + suffix)),
        BEGIN_ENV("filecontents" + suffix, ARGUMENT_AND_THEN(ARGUMENT_M, VERBATIM_DELIMITED_ENV("filecontents" + suffix))),
        ...[
          "",
          "B",
          "L"
        ].map(
          (prefix) => BEGIN_ENV(prefix + "Verbatim" + suffix, ARGUMENT_AND_THEN(ARGUMENT_O, VERBATIM_DELIMITED_ENV(prefix + "Verbatim" + suffix)))
        )
      ])),
      BEGIN_ENV("minted", ARGUMENT_AND_THEN(ARGUMENT_O, ARGUMENT_AND_THEN(ARGUMENT_M, VERBATIM_DELIMITED_ENV("minted"))))
    ];
    return {
      name: "LaTeX",
      aliases: ["tex"],
      contains: [
        ...VERBATIM,
        ...EVERYTHING_BUT_VERBATIM
      ]
    };
  }

  // node_modules/highlight.js/es/languages/less.js
  var MODES2 = (hljs) => {
    return {
      IMPORTANT: {
        scope: "meta",
        begin: "!important"
      },
      BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
      HEXCOLOR: {
        scope: "number",
        begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
      },
      FUNCTION_DISPATCH: {
        className: "built_in",
        begin: /[\w-]+(?=\()/
      },
      ATTRIBUTE_SELECTOR_MODE: {
        scope: "selector-attr",
        begin: /\[/,
        end: /\]/,
        illegal: "$",
        contains: [
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      },
      CSS_NUMBER_MODE: {
        scope: "number",
        begin: hljs.NUMBER_RE + "(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",
        relevance: 0
      },
      CSS_VARIABLE: {
        className: "attr",
        begin: /--[A-Za-z_][A-Za-z0-9_-]*/
      }
    };
  };
  var HTML_TAGS2 = [
    "a",
    "abbr",
    "address",
    "article",
    "aside",
    "audio",
    "b",
    "blockquote",
    "body",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "dd",
    "del",
    "details",
    "dfn",
    "div",
    "dl",
    "dt",
    "em",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "main",
    "mark",
    "menu",
    "nav",
    "object",
    "ol",
    "optgroup",
    "option",
    "p",
    "picture",
    "q",
    "quote",
    "samp",
    "section",
    "select",
    "source",
    "span",
    "strong",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "tr",
    "ul",
    "var",
    "video"
  ];
  var SVG_TAGS2 = [
    "defs",
    "g",
    "marker",
    "mask",
    "pattern",
    "svg",
    "switch",
    "symbol",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feFlood",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMorphology",
    "feOffset",
    "feSpecularLighting",
    "feTile",
    "feTurbulence",
    "linearGradient",
    "radialGradient",
    "stop",
    "circle",
    "ellipse",
    "image",
    "line",
    "path",
    "polygon",
    "polyline",
    "rect",
    "text",
    "use",
    "textPath",
    "tspan",
    "foreignObject",
    "clipPath"
  ];
  var TAGS2 = [
    ...HTML_TAGS2,
    ...SVG_TAGS2
  ];
  var MEDIA_FEATURES2 = [
    "any-hover",
    "any-pointer",
    "aspect-ratio",
    "color",
    "color-gamut",
    "color-index",
    "device-aspect-ratio",
    "device-height",
    "device-width",
    "display-mode",
    "forced-colors",
    "grid",
    "height",
    "hover",
    "inverted-colors",
    "monochrome",
    "orientation",
    "overflow-block",
    "overflow-inline",
    "pointer",
    "prefers-color-scheme",
    "prefers-contrast",
    "prefers-reduced-motion",
    "prefers-reduced-transparency",
    "resolution",
    "scan",
    "scripting",
    "update",
    "width",
    // TODO: find a better solution?
    "min-width",
    "max-width",
    "min-height",
    "max-height"
  ].sort().reverse();
  var PSEUDO_CLASSES2 = [
    "active",
    "any-link",
    "blank",
    "checked",
    "current",
    "default",
    "defined",
    "dir",
    // dir()
    "disabled",
    "drop",
    "empty",
    "enabled",
    "first",
    "first-child",
    "first-of-type",
    "fullscreen",
    "future",
    "focus",
    "focus-visible",
    "focus-within",
    "has",
    // has()
    "host",
    // host or host()
    "host-context",
    // host-context()
    "hover",
    "indeterminate",
    "in-range",
    "invalid",
    "is",
    // is()
    "lang",
    // lang()
    "last-child",
    "last-of-type",
    "left",
    "link",
    "local-link",
    "not",
    // not()
    "nth-child",
    // nth-child()
    "nth-col",
    // nth-col()
    "nth-last-child",
    // nth-last-child()
    "nth-last-col",
    // nth-last-col()
    "nth-last-of-type",
    //nth-last-of-type()
    "nth-of-type",
    //nth-of-type()
    "only-child",
    "only-of-type",
    "optional",
    "out-of-range",
    "past",
    "placeholder-shown",
    "read-only",
    "read-write",
    "required",
    "right",
    "root",
    "scope",
    "target",
    "target-within",
    "user-invalid",
    "valid",
    "visited",
    "where"
    // where()
  ].sort().reverse();
  var PSEUDO_ELEMENTS2 = [
    "after",
    "backdrop",
    "before",
    "cue",
    "cue-region",
    "first-letter",
    "first-line",
    "grammar-error",
    "marker",
    "part",
    "placeholder",
    "selection",
    "slotted",
    "spelling-error"
  ].sort().reverse();
  var ATTRIBUTES2 = [
    "accent-color",
    "align-content",
    "align-items",
    "align-self",
    "alignment-baseline",
    "all",
    "anchor-name",
    "animation",
    "animation-composition",
    "animation-delay",
    "animation-direction",
    "animation-duration",
    "animation-fill-mode",
    "animation-iteration-count",
    "animation-name",
    "animation-play-state",
    "animation-range",
    "animation-range-end",
    "animation-range-start",
    "animation-timeline",
    "animation-timing-function",
    "appearance",
    "aspect-ratio",
    "backdrop-filter",
    "backface-visibility",
    "background",
    "background-attachment",
    "background-blend-mode",
    "background-clip",
    "background-color",
    "background-image",
    "background-origin",
    "background-position",
    "background-position-x",
    "background-position-y",
    "background-repeat",
    "background-size",
    "baseline-shift",
    "block-size",
    "border",
    "border-block",
    "border-block-color",
    "border-block-end",
    "border-block-end-color",
    "border-block-end-style",
    "border-block-end-width",
    "border-block-start",
    "border-block-start-color",
    "border-block-start-style",
    "border-block-start-width",
    "border-block-style",
    "border-block-width",
    "border-bottom",
    "border-bottom-color",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "border-bottom-style",
    "border-bottom-width",
    "border-collapse",
    "border-color",
    "border-end-end-radius",
    "border-end-start-radius",
    "border-image",
    "border-image-outset",
    "border-image-repeat",
    "border-image-slice",
    "border-image-source",
    "border-image-width",
    "border-inline",
    "border-inline-color",
    "border-inline-end",
    "border-inline-end-color",
    "border-inline-end-style",
    "border-inline-end-width",
    "border-inline-start",
    "border-inline-start-color",
    "border-inline-start-style",
    "border-inline-start-width",
    "border-inline-style",
    "border-inline-width",
    "border-left",
    "border-left-color",
    "border-left-style",
    "border-left-width",
    "border-radius",
    "border-right",
    "border-right-color",
    "border-right-style",
    "border-right-width",
    "border-spacing",
    "border-start-end-radius",
    "border-start-start-radius",
    "border-style",
    "border-top",
    "border-top-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-top-style",
    "border-top-width",
    "border-width",
    "bottom",
    "box-align",
    "box-decoration-break",
    "box-direction",
    "box-flex",
    "box-flex-group",
    "box-lines",
    "box-ordinal-group",
    "box-orient",
    "box-pack",
    "box-shadow",
    "box-sizing",
    "break-after",
    "break-before",
    "break-inside",
    "caption-side",
    "caret-color",
    "clear",
    "clip",
    "clip-path",
    "clip-rule",
    "color",
    "color-interpolation",
    "color-interpolation-filters",
    "color-profile",
    "color-rendering",
    "color-scheme",
    "column-count",
    "column-fill",
    "column-gap",
    "column-rule",
    "column-rule-color",
    "column-rule-style",
    "column-rule-width",
    "column-span",
    "column-width",
    "columns",
    "contain",
    "contain-intrinsic-block-size",
    "contain-intrinsic-height",
    "contain-intrinsic-inline-size",
    "contain-intrinsic-size",
    "contain-intrinsic-width",
    "container",
    "container-name",
    "container-type",
    "content",
    "content-visibility",
    "counter-increment",
    "counter-reset",
    "counter-set",
    "cue",
    "cue-after",
    "cue-before",
    "cursor",
    "cx",
    "cy",
    "direction",
    "display",
    "dominant-baseline",
    "empty-cells",
    "enable-background",
    "field-sizing",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "flex",
    "flex-basis",
    "flex-direction",
    "flex-flow",
    "flex-grow",
    "flex-shrink",
    "flex-wrap",
    "float",
    "flood-color",
    "flood-opacity",
    "flow",
    "font",
    "font-display",
    "font-family",
    "font-feature-settings",
    "font-kerning",
    "font-language-override",
    "font-optical-sizing",
    "font-palette",
    "font-size",
    "font-size-adjust",
    "font-smooth",
    "font-smoothing",
    "font-stretch",
    "font-style",
    "font-synthesis",
    "font-synthesis-position",
    "font-synthesis-small-caps",
    "font-synthesis-style",
    "font-synthesis-weight",
    "font-variant",
    "font-variant-alternates",
    "font-variant-caps",
    "font-variant-east-asian",
    "font-variant-emoji",
    "font-variant-ligatures",
    "font-variant-numeric",
    "font-variant-position",
    "font-variation-settings",
    "font-weight",
    "forced-color-adjust",
    "gap",
    "glyph-orientation-horizontal",
    "glyph-orientation-vertical",
    "grid",
    "grid-area",
    "grid-auto-columns",
    "grid-auto-flow",
    "grid-auto-rows",
    "grid-column",
    "grid-column-end",
    "grid-column-start",
    "grid-gap",
    "grid-row",
    "grid-row-end",
    "grid-row-start",
    "grid-template",
    "grid-template-areas",
    "grid-template-columns",
    "grid-template-rows",
    "hanging-punctuation",
    "height",
    "hyphenate-character",
    "hyphenate-limit-chars",
    "hyphens",
    "icon",
    "image-orientation",
    "image-rendering",
    "image-resolution",
    "ime-mode",
    "initial-letter",
    "initial-letter-align",
    "inline-size",
    "inset",
    "inset-area",
    "inset-block",
    "inset-block-end",
    "inset-block-start",
    "inset-inline",
    "inset-inline-end",
    "inset-inline-start",
    "isolation",
    "justify-content",
    "justify-items",
    "justify-self",
    "kerning",
    "left",
    "letter-spacing",
    "lighting-color",
    "line-break",
    "line-height",
    "line-height-step",
    "list-style",
    "list-style-image",
    "list-style-position",
    "list-style-type",
    "margin",
    "margin-block",
    "margin-block-end",
    "margin-block-start",
    "margin-bottom",
    "margin-inline",
    "margin-inline-end",
    "margin-inline-start",
    "margin-left",
    "margin-right",
    "margin-top",
    "margin-trim",
    "marker",
    "marker-end",
    "marker-mid",
    "marker-start",
    "marks",
    "mask",
    "mask-border",
    "mask-border-mode",
    "mask-border-outset",
    "mask-border-repeat",
    "mask-border-slice",
    "mask-border-source",
    "mask-border-width",
    "mask-clip",
    "mask-composite",
    "mask-image",
    "mask-mode",
    "mask-origin",
    "mask-position",
    "mask-repeat",
    "mask-size",
    "mask-type",
    "masonry-auto-flow",
    "math-depth",
    "math-shift",
    "math-style",
    "max-block-size",
    "max-height",
    "max-inline-size",
    "max-width",
    "min-block-size",
    "min-height",
    "min-inline-size",
    "min-width",
    "mix-blend-mode",
    "nav-down",
    "nav-index",
    "nav-left",
    "nav-right",
    "nav-up",
    "none",
    "normal",
    "object-fit",
    "object-position",
    "offset",
    "offset-anchor",
    "offset-distance",
    "offset-path",
    "offset-position",
    "offset-rotate",
    "opacity",
    "order",
    "orphans",
    "outline",
    "outline-color",
    "outline-offset",
    "outline-style",
    "outline-width",
    "overflow",
    "overflow-anchor",
    "overflow-block",
    "overflow-clip-margin",
    "overflow-inline",
    "overflow-wrap",
    "overflow-x",
    "overflow-y",
    "overlay",
    "overscroll-behavior",
    "overscroll-behavior-block",
    "overscroll-behavior-inline",
    "overscroll-behavior-x",
    "overscroll-behavior-y",
    "padding",
    "padding-block",
    "padding-block-end",
    "padding-block-start",
    "padding-bottom",
    "padding-inline",
    "padding-inline-end",
    "padding-inline-start",
    "padding-left",
    "padding-right",
    "padding-top",
    "page",
    "page-break-after",
    "page-break-before",
    "page-break-inside",
    "paint-order",
    "pause",
    "pause-after",
    "pause-before",
    "perspective",
    "perspective-origin",
    "place-content",
    "place-items",
    "place-self",
    "pointer-events",
    "position",
    "position-anchor",
    "position-visibility",
    "print-color-adjust",
    "quotes",
    "r",
    "resize",
    "rest",
    "rest-after",
    "rest-before",
    "right",
    "rotate",
    "row-gap",
    "ruby-align",
    "ruby-position",
    "scale",
    "scroll-behavior",
    "scroll-margin",
    "scroll-margin-block",
    "scroll-margin-block-end",
    "scroll-margin-block-start",
    "scroll-margin-bottom",
    "scroll-margin-inline",
    "scroll-margin-inline-end",
    "scroll-margin-inline-start",
    "scroll-margin-left",
    "scroll-margin-right",
    "scroll-margin-top",
    "scroll-padding",
    "scroll-padding-block",
    "scroll-padding-block-end",
    "scroll-padding-block-start",
    "scroll-padding-bottom",
    "scroll-padding-inline",
    "scroll-padding-inline-end",
    "scroll-padding-inline-start",
    "scroll-padding-left",
    "scroll-padding-right",
    "scroll-padding-top",
    "scroll-snap-align",
    "scroll-snap-stop",
    "scroll-snap-type",
    "scroll-timeline",
    "scroll-timeline-axis",
    "scroll-timeline-name",
    "scrollbar-color",
    "scrollbar-gutter",
    "scrollbar-width",
    "shape-image-threshold",
    "shape-margin",
    "shape-outside",
    "shape-rendering",
    "speak",
    "speak-as",
    "src",
    // @font-face
    "stop-color",
    "stop-opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "tab-size",
    "table-layout",
    "text-align",
    "text-align-all",
    "text-align-last",
    "text-anchor",
    "text-combine-upright",
    "text-decoration",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-skip",
    "text-decoration-skip-ink",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-emphasis",
    "text-emphasis-color",
    "text-emphasis-position",
    "text-emphasis-style",
    "text-indent",
    "text-justify",
    "text-orientation",
    "text-overflow",
    "text-rendering",
    "text-shadow",
    "text-size-adjust",
    "text-transform",
    "text-underline-offset",
    "text-underline-position",
    "text-wrap",
    "text-wrap-mode",
    "text-wrap-style",
    "timeline-scope",
    "top",
    "touch-action",
    "transform",
    "transform-box",
    "transform-origin",
    "transform-style",
    "transition",
    "transition-behavior",
    "transition-delay",
    "transition-duration",
    "transition-property",
    "transition-timing-function",
    "translate",
    "unicode-bidi",
    "user-modify",
    "user-select",
    "vector-effect",
    "vertical-align",
    "view-timeline",
    "view-timeline-axis",
    "view-timeline-inset",
    "view-timeline-name",
    "view-transition-name",
    "visibility",
    "voice-balance",
    "voice-duration",
    "voice-family",
    "voice-pitch",
    "voice-range",
    "voice-rate",
    "voice-stress",
    "voice-volume",
    "white-space",
    "white-space-collapse",
    "widows",
    "width",
    "will-change",
    "word-break",
    "word-spacing",
    "word-wrap",
    "writing-mode",
    "x",
    "y",
    "z-index",
    "zoom"
  ].sort().reverse();
  var PSEUDO_SELECTORS = PSEUDO_CLASSES2.concat(PSEUDO_ELEMENTS2).sort().reverse();
  function less(hljs) {
    const modes = MODES2(hljs);
    const PSEUDO_SELECTORS$1 = PSEUDO_SELECTORS;
    const AT_MODIFIERS = "and or not only";
    const IDENT_RE3 = "[\\w-]+";
    const INTERP_IDENT_RE = "(" + IDENT_RE3 + "|@\\{" + IDENT_RE3 + "\\})";
    const RULES = [];
    const VALUE_MODES = [];
    const STRING_MODE = function(c2) {
      return {
        // Less strings are not multiline (also include '~' for more consistent coloring of "escaped" strings)
        className: "string",
        begin: "~?" + c2 + ".*?" + c2
      };
    };
    const IDENT_MODE = function(name, begin, relevance) {
      return {
        className: name,
        begin,
        relevance
      };
    };
    const AT_KEYWORDS = {
      $pattern: /[a-z-]+/,
      keyword: AT_MODIFIERS,
      attribute: MEDIA_FEATURES2.join(" ")
    };
    const PARENS_MODE = {
      // used only to properly balance nested parens inside mixin call, def. arg list
      begin: "\\(",
      end: "\\)",
      contains: VALUE_MODES,
      keywords: AT_KEYWORDS,
      relevance: 0
    };
    VALUE_MODES.push(
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      STRING_MODE("'"),
      STRING_MODE('"'),
      modes.CSS_NUMBER_MODE,
      // fixme: it does not include dot for numbers like .5em :(
      {
        begin: "(url|data-uri)\\(",
        starts: {
          className: "string",
          end: "[\\)\\n]",
          excludeEnd: true
        }
      },
      modes.HEXCOLOR,
      PARENS_MODE,
      IDENT_MODE("variable", "@@?" + IDENT_RE3, 10),
      IDENT_MODE("variable", "@\\{" + IDENT_RE3 + "\\}"),
      IDENT_MODE("built_in", "~?`[^`]*?`"),
      // inline javascript (or whatever host language) *multiline* string
      {
        // @media features (it’s here to not duplicate things in AT_RULE_MODE with extra PARENS_MODE overriding):
        className: "attribute",
        begin: IDENT_RE3 + "\\s*:",
        end: ":",
        returnBegin: true,
        excludeEnd: true
      },
      modes.IMPORTANT,
      { beginKeywords: "and not" },
      modes.FUNCTION_DISPATCH
    );
    const VALUE_WITH_RULESETS = VALUE_MODES.concat({
      begin: /\{/,
      end: /\}/,
      contains: RULES
    });
    const MIXIN_GUARD_MODE = {
      beginKeywords: "when",
      endsWithParent: true,
      contains: [{ beginKeywords: "and not" }].concat(VALUE_MODES)
      // using this form to override VALUE’s 'function' match
    };
    const RULE_MODE = {
      begin: INTERP_IDENT_RE + "\\s*:",
      returnBegin: true,
      end: /[;}]/,
      relevance: 0,
      contains: [
        { begin: /-(webkit|moz|ms|o)-/ },
        modes.CSS_VARIABLE,
        {
          className: "attribute",
          begin: "\\b(" + ATTRIBUTES2.join("|") + ")\\b",
          end: /(?=:)/,
          starts: {
            endsWithParent: true,
            illegal: "[<=$]",
            relevance: 0,
            contains: VALUE_MODES
          }
        }
      ]
    };
    const AT_RULE_MODE = {
      className: "keyword",
      begin: "@(import|media|charset|font-face|(-[a-z]+-)?keyframes|supports|document|namespace|page|viewport|host)\\b",
      starts: {
        end: "[;{}]",
        keywords: AT_KEYWORDS,
        returnEnd: true,
        contains: VALUE_MODES,
        relevance: 0
      }
    };
    const VAR_RULE_MODE = {
      className: "variable",
      variants: [
        // using more strict pattern for higher relevance to increase chances of Less detection.
        // this is *the only* Less specific statement used in most of the sources, so...
        // (we’ll still often loose to the css-parser unless there's '//' comment,
        // simply because 1 variable just can't beat 99 properties :)
        {
          begin: "@" + IDENT_RE3 + "\\s*:",
          relevance: 15
        },
        { begin: "@" + IDENT_RE3 }
      ],
      starts: {
        end: "[;}]",
        returnEnd: true,
        contains: VALUE_WITH_RULESETS
      }
    };
    const SELECTOR_MODE = {
      // first parse unambiguous selectors (i.e. those not starting with tag)
      // then fall into the scary lookahead-discriminator variant.
      // this mode also handles mixin definitions and calls
      variants: [
        {
          begin: "[\\.#:&\\[>]",
          end: "[;{}]"
          // mixin calls end with ';'
        },
        {
          begin: INTERP_IDENT_RE,
          end: /\{/
        }
      ],
      returnBegin: true,
      returnEnd: true,
      illegal: `[<='$"]`,
      relevance: 0,
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        MIXIN_GUARD_MODE,
        IDENT_MODE("keyword", "all\\b"),
        IDENT_MODE("variable", "@\\{" + IDENT_RE3 + "\\}"),
        // otherwise it’s identified as tag
        {
          begin: "\\b(" + TAGS2.join("|") + ")\\b",
          className: "selector-tag"
        },
        modes.CSS_NUMBER_MODE,
        IDENT_MODE("selector-tag", INTERP_IDENT_RE, 0),
        IDENT_MODE("selector-id", "#" + INTERP_IDENT_RE),
        IDENT_MODE("selector-class", "\\." + INTERP_IDENT_RE, 0),
        IDENT_MODE("selector-tag", "&", 0),
        modes.ATTRIBUTE_SELECTOR_MODE,
        {
          className: "selector-pseudo",
          begin: ":(" + PSEUDO_CLASSES2.join("|") + ")"
        },
        {
          className: "selector-pseudo",
          begin: ":(:)?(" + PSEUDO_ELEMENTS2.join("|") + ")"
        },
        {
          begin: /\(/,
          end: /\)/,
          relevance: 0,
          contains: VALUE_WITH_RULESETS
        },
        // argument list of parametric mixins
        { begin: "!important" },
        // eat !important after mixin call or it will be colored as tag
        modes.FUNCTION_DISPATCH
      ]
    };
    const PSEUDO_SELECTOR_MODE = {
      begin: IDENT_RE3 + `:(:)?(${PSEUDO_SELECTORS$1.join("|")})`,
      returnBegin: true,
      contains: [SELECTOR_MODE]
    };
    RULES.push(
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      AT_RULE_MODE,
      VAR_RULE_MODE,
      PSEUDO_SELECTOR_MODE,
      RULE_MODE,
      SELECTOR_MODE,
      MIXIN_GUARD_MODE,
      modes.FUNCTION_DISPATCH
    );
    return {
      name: "Less",
      case_insensitive: true,
      illegal: `[=>'/<($"]`,
      contains: RULES
    };
  }

  // node_modules/highlight.js/es/languages/lisp.js
  function lisp(hljs) {
    const LISP_IDENT_RE = "[a-zA-Z_\\-+\\*\\/<=>&#][a-zA-Z0-9_\\-+*\\/<=>&#!]*";
    const MEC_RE = "\\|[^]*?\\|";
    const LISP_SIMPLE_NUMBER_RE = "(-|\\+)?\\d+(\\.\\d+|\\/\\d+)?((d|e|f|l|s|D|E|F|L|S)(\\+|-)?\\d+)?";
    const LITERAL = {
      className: "literal",
      begin: "\\b(t{1}|nil)\\b"
    };
    const NUMBER = {
      className: "number",
      variants: [
        {
          begin: LISP_SIMPLE_NUMBER_RE,
          relevance: 0
        },
        { begin: "#(b|B)[0-1]+(/[0-1]+)?" },
        { begin: "#(o|O)[0-7]+(/[0-7]+)?" },
        { begin: "#(x|X)[0-9a-fA-F]+(/[0-9a-fA-F]+)?" },
        {
          begin: "#(c|C)\\(" + LISP_SIMPLE_NUMBER_RE + " +" + LISP_SIMPLE_NUMBER_RE,
          end: "\\)"
        }
      ]
    };
    const STRING = hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null });
    const COMMENT = hljs.COMMENT(
      ";",
      "$",
      { relevance: 0 }
    );
    const VARIABLE = {
      begin: "\\*",
      end: "\\*"
    };
    const KEYWORD = {
      className: "symbol",
      begin: "[:&]" + LISP_IDENT_RE
    };
    const IDENT = {
      begin: LISP_IDENT_RE,
      relevance: 0
    };
    const MEC = { begin: MEC_RE };
    const QUOTED_LIST = {
      begin: "\\(",
      end: "\\)",
      contains: [
        "self",
        LITERAL,
        STRING,
        NUMBER,
        IDENT
      ]
    };
    const QUOTED = {
      contains: [
        NUMBER,
        STRING,
        VARIABLE,
        KEYWORD,
        QUOTED_LIST,
        IDENT
      ],
      variants: [
        {
          begin: "['`]\\(",
          end: "\\)"
        },
        {
          begin: "\\(quote ",
          end: "\\)",
          keywords: { name: "quote" }
        },
        { begin: "'" + MEC_RE }
      ]
    };
    const QUOTED_ATOM = { variants: [
      { begin: "'" + LISP_IDENT_RE },
      { begin: "#'" + LISP_IDENT_RE + "(::" + LISP_IDENT_RE + ")*" }
    ] };
    const LIST = {
      begin: "\\(\\s*",
      end: "\\)"
    };
    const BODY = {
      endsWithParent: true,
      relevance: 0
    };
    LIST.contains = [
      {
        className: "name",
        variants: [
          {
            begin: LISP_IDENT_RE,
            relevance: 0
          },
          { begin: MEC_RE }
        ]
      },
      BODY
    ];
    BODY.contains = [
      QUOTED,
      QUOTED_ATOM,
      LIST,
      LITERAL,
      NUMBER,
      STRING,
      COMMENT,
      VARIABLE,
      KEYWORD,
      MEC,
      IDENT
    ];
    return {
      name: "Lisp",
      illegal: /\S/,
      contains: [
        NUMBER,
        hljs.SHEBANG(),
        LITERAL,
        STRING,
        COMMENT,
        QUOTED,
        QUOTED_ATOM,
        LIST,
        IDENT
      ]
    };
  }

  // node_modules/highlight.js/es/languages/lua.js
  function lua(hljs) {
    const OPENING_LONG_BRACKET = "\\[=*\\[";
    const CLOSING_LONG_BRACKET = "\\]=*\\]";
    const LONG_BRACKETS = {
      begin: OPENING_LONG_BRACKET,
      end: CLOSING_LONG_BRACKET,
      contains: ["self"]
    };
    const COMMENTS = [
      hljs.COMMENT("--(?!" + OPENING_LONG_BRACKET + ")", "$"),
      hljs.COMMENT(
        "--" + OPENING_LONG_BRACKET,
        CLOSING_LONG_BRACKET,
        {
          contains: [LONG_BRACKETS],
          relevance: 10
        }
      )
    ];
    return {
      name: "Lua",
      aliases: ["pluto"],
      keywords: {
        $pattern: hljs.UNDERSCORE_IDENT_RE,
        literal: "true false nil",
        keyword: "and break do else elseif end for goto if in local not or repeat return then until while",
        built_in: (
          // Metatags and globals:
          "_G _ENV _VERSION __index __newindex __mode __call __metatable __tostring __len __gc __add __sub __mul __div __mod __pow __concat __unm __eq __lt __le assert collectgarbage dofile error getfenv getmetatable ipairs load loadfile loadstring module next pairs pcall print rawequal rawget rawset require select setfenv setmetatable tonumber tostring type unpack xpcall arg self coroutine resume yield status wrap create running debug getupvalue debug sethook getmetatable gethook setmetatable setlocal traceback setfenv getinfo setupvalue getlocal getregistry getfenv io lines write close flush open output type read stderr stdin input stdout popen tmpfile math log max acos huge ldexp pi cos tanh pow deg tan cosh sinh random randomseed frexp ceil floor rad abs sqrt modf asin min mod fmod log10 atan2 exp sin atan os exit setlocale date getenv difftime remove time clock tmpname rename execute package preload loadlib loaded loaders cpath config path seeall string sub upper len gfind rep find match char dump gmatch reverse byte format gsub lower table setn insert getn foreachi maxn foreach concat sort remove"
        )
      },
      contains: COMMENTS.concat([
        {
          className: "function",
          beginKeywords: "function",
          end: "\\)",
          contains: [
            hljs.inherit(hljs.TITLE_MODE, { begin: "([_a-zA-Z]\\w*\\.)*([_a-zA-Z]\\w*:)?[_a-zA-Z]\\w*" }),
            {
              className: "params",
              begin: "\\(",
              endsWithParent: true,
              contains: COMMENTS
            }
          ].concat(COMMENTS)
        },
        hljs.C_NUMBER_MODE,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        {
          className: "string",
          begin: OPENING_LONG_BRACKET,
          end: CLOSING_LONG_BRACKET,
          contains: [LONG_BRACKETS],
          relevance: 5
        }
      ])
    };
  }

  // node_modules/highlight.js/es/languages/makefile.js
  function makefile(hljs) {
    const VARIABLE = {
      className: "variable",
      variants: [
        {
          begin: "\\$\\(" + hljs.UNDERSCORE_IDENT_RE + "\\)",
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        { begin: /\$[@%<?\^\+\*]/ }
      ]
    };
    const QUOTE_STRING = {
      className: "string",
      begin: /"/,
      end: /"/,
      contains: [
        hljs.BACKSLASH_ESCAPE,
        VARIABLE
      ]
    };
    const FUNC = {
      className: "variable",
      begin: /\$\([\w-]+\s/,
      end: /\)/,
      keywords: { built_in: "subst patsubst strip findstring filter filter-out sort word wordlist firstword lastword dir notdir suffix basename addsuffix addprefix join wildcard realpath abspath error warning shell origin flavor foreach if or and call eval file value" },
      contains: [
        VARIABLE,
        QUOTE_STRING
        // Added QUOTE_STRING as they can be a part of functions
      ]
    };
    const ASSIGNMENT = { begin: "^" + hljs.UNDERSCORE_IDENT_RE + "\\s*(?=[:+?]?=)" };
    const META = {
      className: "meta",
      begin: /^\.PHONY:/,
      end: /$/,
      keywords: {
        $pattern: /[\.\w]+/,
        keyword: ".PHONY"
      }
    };
    const TARGET = {
      className: "section",
      begin: /^[^\s]+:/,
      end: /$/,
      contains: [VARIABLE]
    };
    return {
      name: "Makefile",
      aliases: [
        "mk",
        "mak",
        "make"
      ],
      keywords: {
        $pattern: /[\w-]+/,
        keyword: "define endef undefine ifdef ifndef ifeq ifneq else endif include -include sinclude override export unexport private vpath"
      },
      contains: [
        hljs.HASH_COMMENT_MODE,
        VARIABLE,
        QUOTE_STRING,
        FUNC,
        ASSIGNMENT,
        META,
        TARGET
      ]
    };
  }

  // node_modules/highlight.js/es/languages/markdown.js
  function markdown(hljs) {
    const regex = hljs.regex;
    const INLINE_HTML = {
      begin: /<\/?[A-Za-z_]/,
      end: ">",
      subLanguage: "xml",
      relevance: 0
    };
    const HORIZONTAL_RULE = {
      begin: "^[-\\*]{3,}",
      end: "$"
    };
    const CODE = {
      className: "code",
      variants: [
        // TODO: fix to allow these to work with sublanguage also
        { begin: "(`{3,})[^`](.|\\n)*?\\1`*[ ]*" },
        { begin: "(~{3,})[^~](.|\\n)*?\\1~*[ ]*" },
        // needed to allow markdown as a sublanguage to work
        {
          begin: "```",
          end: "```+[ ]*$"
        },
        {
          begin: "~~~",
          end: "~~~+[ ]*$"
        },
        { begin: "`.+?`" },
        {
          begin: "(?=^( {4}|\\t))",
          // use contains to gobble up multiple lines to allow the block to be whatever size
          // but only have a single open/close tag vs one per line
          contains: [
            {
              begin: "^( {4}|\\t)",
              end: "(\\n)$"
            }
          ],
          relevance: 0
        }
      ]
    };
    const LIST = {
      className: "bullet",
      begin: "^[ 	]*([*+-]|(\\d+\\.))(?=\\s+)",
      end: "\\s+",
      excludeEnd: true
    };
    const LINK_REFERENCE = {
      begin: /^\[[^\n]+\]:/,
      returnBegin: true,
      contains: [
        {
          className: "symbol",
          begin: /\[/,
          end: /\]/,
          excludeBegin: true,
          excludeEnd: true
        },
        {
          className: "link",
          begin: /:\s*/,
          end: /$/,
          excludeBegin: true
        }
      ]
    };
    const URL_SCHEME = /[A-Za-z][A-Za-z0-9+.-]*/;
    const LINK = {
      variants: [
        // too much like nested array access in so many languages
        // to have any real relevance
        {
          begin: /\[.+?\]\[.*?\]/,
          relevance: 0
        },
        // popular internet URLs
        {
          begin: /\[.+?\]\(((data|javascript|mailto):|(?:http|ftp)s?:\/\/).*?\)/,
          relevance: 2
        },
        {
          begin: regex.concat(/\[.+?\]\(/, URL_SCHEME, /:\/\/.*?\)/),
          relevance: 2
        },
        // relative urls
        {
          begin: /\[.+?\]\([./?&#].*?\)/,
          relevance: 1
        },
        // whatever else, lower relevance (might not be a link at all)
        {
          begin: /\[.*?\]\(.*?\)/,
          relevance: 0
        }
      ],
      returnBegin: true,
      contains: [
        {
          // empty strings for alt or link text
          match: /\[(?=\])/
        },
        {
          className: "string",
          relevance: 0,
          begin: "\\[",
          end: "\\]",
          excludeBegin: true,
          returnEnd: true
        },
        {
          className: "link",
          relevance: 0,
          begin: "\\]\\(",
          end: "\\)",
          excludeBegin: true,
          excludeEnd: true
        },
        {
          className: "symbol",
          relevance: 0,
          begin: "\\]\\[",
          end: "\\]",
          excludeBegin: true,
          excludeEnd: true
        }
      ]
    };
    const BOLD = {
      className: "strong",
      contains: [],
      // defined later
      variants: [
        {
          begin: /_{2}(?!\s)/,
          end: /_{2}/
        },
        {
          begin: /\*{2}(?!\s)/,
          end: /\*{2}/
        }
      ]
    };
    const ITALIC = {
      className: "emphasis",
      contains: [],
      // defined later
      variants: [
        {
          begin: /\*(?![*\s])/,
          end: /\*/
        },
        {
          begin: /_(?![_\s])/,
          end: /_/,
          relevance: 0
        }
      ]
    };
    const BOLD_WITHOUT_ITALIC = hljs.inherit(BOLD, { contains: [] });
    const ITALIC_WITHOUT_BOLD = hljs.inherit(ITALIC, { contains: [] });
    BOLD.contains.push(ITALIC_WITHOUT_BOLD);
    ITALIC.contains.push(BOLD_WITHOUT_ITALIC);
    let CONTAINABLE = [
      INLINE_HTML,
      LINK
    ];
    [
      BOLD,
      ITALIC,
      BOLD_WITHOUT_ITALIC,
      ITALIC_WITHOUT_BOLD
    ].forEach((m) => {
      m.contains = m.contains.concat(CONTAINABLE);
    });
    CONTAINABLE = CONTAINABLE.concat(BOLD, ITALIC);
    const HEADER = {
      className: "section",
      variants: [
        {
          begin: "^#{1,6}",
          end: "$",
          contains: CONTAINABLE
        },
        {
          begin: "(?=^.+?\\n[=-]{2,}$)",
          contains: [
            { begin: "^[=-]*$" },
            {
              begin: "^",
              end: "\\n",
              contains: CONTAINABLE
            }
          ]
        }
      ]
    };
    const BLOCKQUOTE = {
      className: "quote",
      begin: "^>\\s+",
      contains: CONTAINABLE,
      end: "$"
    };
    const ENTITY = {
      //https://spec.commonmark.org/0.31.2/#entity-references
      scope: "literal",
      match: /&([a-zA-Z0-9]+|#[0-9]{1,7}|#[Xx][0-9a-fA-F]{1,6});/
    };
    return {
      name: "Markdown",
      aliases: [
        "md",
        "mkdown",
        "mkd"
      ],
      contains: [
        HEADER,
        INLINE_HTML,
        LIST,
        BOLD,
        ITALIC,
        BLOCKQUOTE,
        CODE,
        HORIZONTAL_RULE,
        LINK,
        LINK_REFERENCE,
        ENTITY
      ]
    };
  }

  // node_modules/highlight.js/es/languages/matlab.js
  function matlab(hljs) {
    const TRANSPOSE_RE = "('|\\.')+";
    const TRANSPOSE = {
      relevance: 0,
      contains: [{ begin: TRANSPOSE_RE }]
    };
    return {
      name: "Matlab",
      keywords: {
        keyword: "arguments break case catch classdef continue else elseif end enumeration events for function global if methods otherwise parfor persistent properties return spmd switch try while",
        built_in: "sin sind sinh asin asind asinh cos cosd cosh acos acosd acosh tan tand tanh atan atand atan2 atanh sec secd sech asec asecd asech csc cscd csch acsc acscd acsch cot cotd coth acot acotd acoth hypot exp expm1 log log1p log10 log2 pow2 realpow reallog realsqrt sqrt nthroot nextpow2 abs angle complex conj imag real unwrap isreal cplxpair fix floor ceil round mod rem sign airy besselj bessely besselh besseli besselk beta betainc betaln ellipj ellipke erf erfc erfcx erfinv expint gamma gammainc gammaln psi legendre cross dot factor isprime primes gcd lcm rat rats perms nchoosek factorial cart2sph cart2pol pol2cart sph2cart hsv2rgb rgb2hsv zeros ones eye repmat rand randn linspace logspace freqspace meshgrid accumarray size length ndims numel disp isempty isequal isequalwithequalnans cat reshape diag blkdiag tril triu fliplr flipud flipdim rot90 find sub2ind ind2sub bsxfun ndgrid permute ipermute shiftdim circshift squeeze isscalar isvector ans eps realmax realmin pi i|0 inf nan isnan isinf isfinite j|0 why compan gallery hadamard hankel hilb invhilb magic pascal rosser toeplitz vander wilkinson max min nanmax nanmin mean nanmean type table readtable writetable sortrows sort figure plot plot3 scatter scatter3 cellfun legend intersect ismember procrustes hold num2cell "
      },
      illegal: '(//|"|#|/\\*|\\s+/\\w+)',
      contains: [
        {
          className: "function",
          beginKeywords: "function",
          end: "$",
          contains: [
            hljs.UNDERSCORE_TITLE_MODE,
            {
              className: "params",
              variants: [
                {
                  begin: "\\(",
                  end: "\\)"
                },
                {
                  begin: "\\[",
                  end: "\\]"
                }
              ]
            }
          ]
        },
        {
          className: "built_in",
          begin: /true|false/,
          relevance: 0,
          starts: TRANSPOSE
        },
        {
          begin: "[a-zA-Z][a-zA-Z_0-9]*" + TRANSPOSE_RE,
          relevance: 0
        },
        {
          className: "number",
          begin: hljs.C_NUMBER_RE,
          relevance: 0,
          starts: TRANSPOSE
        },
        {
          className: "string",
          begin: "'",
          end: "'",
          contains: [{ begin: "''" }]
        },
        {
          begin: /\]|\}|\)/,
          relevance: 0,
          starts: TRANSPOSE
        },
        {
          className: "string",
          begin: '"',
          end: '"',
          contains: [{ begin: '""' }],
          starts: TRANSPOSE
        },
        hljs.COMMENT("^\\s*%\\{\\s*$", "^\\s*%\\}\\s*$"),
        hljs.COMMENT("%", "$")
      ]
    };
  }

  // node_modules/highlight.js/es/languages/nginx.js
  function nginx(hljs) {
    const regex = hljs.regex;
    const VAR = {
      className: "variable",
      variants: [
        { begin: /\$\d+/ },
        { begin: /\$\{\w+\}/ },
        { begin: regex.concat(/[$@]/, hljs.UNDERSCORE_IDENT_RE) }
      ]
    };
    const LITERALS3 = [
      "on",
      "off",
      "yes",
      "no",
      "true",
      "false",
      "none",
      "blocked",
      "debug",
      "info",
      "notice",
      "warn",
      "error",
      "crit",
      "select",
      "break",
      "last",
      "permanent",
      "redirect",
      "kqueue",
      "rtsig",
      "epoll",
      "poll",
      "/dev/poll"
    ];
    const DEFAULT = {
      endsWithParent: true,
      keywords: {
        $pattern: /[a-z_]{2,}|\/dev\/poll/,
        literal: LITERALS3
      },
      relevance: 0,
      illegal: "=>",
      contains: [
        hljs.HASH_COMMENT_MODE,
        {
          className: "string",
          contains: [
            hljs.BACKSLASH_ESCAPE,
            VAR
          ],
          variants: [
            {
              begin: /"/,
              end: /"/
            },
            {
              begin: /'/,
              end: /'/
            }
          ]
        },
        // this swallows entire URLs to avoid detecting numbers within
        {
          begin: "([a-z]+):/",
          end: "\\s",
          endsWithParent: true,
          excludeEnd: true,
          contains: [VAR]
        },
        {
          className: "regexp",
          contains: [
            hljs.BACKSLASH_ESCAPE,
            VAR
          ],
          variants: [
            {
              begin: "\\s\\^",
              end: "\\s|\\{|;",
              returnEnd: true
            },
            // regexp locations (~, ~*)
            {
              begin: "~\\*?\\s+",
              end: "\\s|\\{|;",
              returnEnd: true
            },
            // *.example.com
            { begin: "\\*(\\.[a-z\\-]+)+" },
            // sub.example.*
            { begin: "([a-z\\-]+\\.)+\\*" }
          ]
        },
        // IP
        {
          className: "number",
          begin: "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}(:\\d{1,5})?\\b"
        },
        // units
        {
          className: "number",
          begin: "\\b\\d+[kKmMgGdshdwy]?\\b",
          relevance: 0
        },
        VAR
      ]
    };
    return {
      name: "Nginx config",
      aliases: ["nginxconf"],
      contains: [
        hljs.HASH_COMMENT_MODE,
        {
          beginKeywords: "upstream location",
          end: /;|\{/,
          contains: DEFAULT.contains,
          keywords: { section: "upstream location" }
        },
        {
          className: "section",
          begin: regex.concat(hljs.UNDERSCORE_IDENT_RE + regex.lookahead(/\s+\{/)),
          relevance: 0
        },
        {
          begin: regex.lookahead(hljs.UNDERSCORE_IDENT_RE + "\\s"),
          end: ";|\\{",
          contains: [
            {
              className: "attribute",
              begin: hljs.UNDERSCORE_IDENT_RE,
              starts: DEFAULT
            }
          ],
          relevance: 0
        }
      ],
      illegal: "[^\\s\\}\\{]"
    };
  }

  // node_modules/highlight.js/es/languages/objectivec.js
  function objectivec(hljs) {
    const API_CLASS = {
      className: "built_in",
      begin: "\\b(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)\\w+"
    };
    const IDENTIFIER_RE = /[a-zA-Z@][a-zA-Z0-9_]*/;
    const TYPES3 = [
      "int",
      "float",
      "char",
      "unsigned",
      "signed",
      "short",
      "long",
      "double",
      "wchar_t",
      "unichar",
      "void",
      "bool",
      "BOOL",
      "id|0",
      "_Bool"
    ];
    const KWS = [
      "while",
      "export",
      "sizeof",
      "typedef",
      "const",
      "struct",
      "for",
      "union",
      "volatile",
      "static",
      "mutable",
      "if",
      "do",
      "return",
      "goto",
      "enum",
      "else",
      "break",
      "extern",
      "asm",
      "case",
      "default",
      "register",
      "explicit",
      "typename",
      "switch",
      "continue",
      "inline",
      "readonly",
      "assign",
      "readwrite",
      "self",
      "@synchronized",
      "id",
      "typeof",
      "nonatomic",
      "IBOutlet",
      "IBAction",
      "strong",
      "weak",
      "copy",
      "in",
      "out",
      "inout",
      "bycopy",
      "byref",
      "oneway",
      "__strong",
      "__weak",
      "__block",
      "__autoreleasing",
      "@private",
      "@protected",
      "@public",
      "@try",
      "@property",
      "@end",
      "@throw",
      "@catch",
      "@finally",
      "@autoreleasepool",
      "@synthesize",
      "@dynamic",
      "@selector",
      "@optional",
      "@required",
      "@encode",
      "@package",
      "@import",
      "@defs",
      "@compatibility_alias",
      "__bridge",
      "__bridge_transfer",
      "__bridge_retained",
      "__bridge_retain",
      "__covariant",
      "__contravariant",
      "__kindof",
      "_Nonnull",
      "_Nullable",
      "_Null_unspecified",
      "__FUNCTION__",
      "__PRETTY_FUNCTION__",
      "__attribute__",
      "getter",
      "setter",
      "retain",
      "unsafe_unretained",
      "nonnull",
      "nullable",
      "null_unspecified",
      "null_resettable",
      "class",
      "instancetype",
      "NS_DESIGNATED_INITIALIZER",
      "NS_UNAVAILABLE",
      "NS_REQUIRES_SUPER",
      "NS_RETURNS_INNER_POINTER",
      "NS_INLINE",
      "NS_AVAILABLE",
      "NS_DEPRECATED",
      "NS_ENUM",
      "NS_OPTIONS",
      "NS_SWIFT_UNAVAILABLE",
      "NS_ASSUME_NONNULL_BEGIN",
      "NS_ASSUME_NONNULL_END",
      "NS_REFINED_FOR_SWIFT",
      "NS_SWIFT_NAME",
      "NS_SWIFT_NOTHROW",
      "NS_DURING",
      "NS_HANDLER",
      "NS_ENDHANDLER",
      "NS_VALUERETURN",
      "NS_VOIDRETURN"
    ];
    const LITERALS3 = [
      "false",
      "true",
      "FALSE",
      "TRUE",
      "nil",
      "YES",
      "NO",
      "NULL"
    ];
    const BUILT_INS3 = [
      "dispatch_once_t",
      "dispatch_queue_t",
      "dispatch_sync",
      "dispatch_async",
      "dispatch_once"
    ];
    const KEYWORDS3 = {
      "variable.language": [
        "this",
        "super"
      ],
      $pattern: IDENTIFIER_RE,
      keyword: KWS,
      literal: LITERALS3,
      built_in: BUILT_INS3,
      type: TYPES3
    };
    const CLASS_KEYWORDS = {
      $pattern: IDENTIFIER_RE,
      keyword: [
        "@interface",
        "@class",
        "@protocol",
        "@implementation"
      ]
    };
    return {
      name: "Objective-C",
      aliases: [
        "mm",
        "objc",
        "obj-c",
        "obj-c++",
        "objective-c++"
      ],
      keywords: KEYWORDS3,
      illegal: "</",
      contains: [
        API_CLASS,
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.C_NUMBER_MODE,
        hljs.QUOTE_STRING_MODE,
        hljs.APOS_STRING_MODE,
        {
          className: "string",
          variants: [
            {
              begin: '@"',
              end: '"',
              illegal: "\\n",
              contains: [hljs.BACKSLASH_ESCAPE]
            }
          ]
        },
        {
          className: "meta",
          begin: /#\s*[a-z]+\b/,
          end: /$/,
          keywords: { keyword: "if else elif endif define undef warning error line pragma ifdef ifndef include" },
          contains: [
            {
              begin: /\\\n/,
              relevance: 0
            },
            hljs.inherit(hljs.QUOTE_STRING_MODE, { className: "string" }),
            {
              className: "string",
              begin: /<.*?>/,
              end: /$/,
              illegal: "\\n"
            },
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        {
          className: "class",
          begin: "(" + CLASS_KEYWORDS.keyword.join("|") + ")\\b",
          end: /(\{|$)/,
          excludeEnd: true,
          keywords: CLASS_KEYWORDS,
          contains: [hljs.UNDERSCORE_TITLE_MODE]
        },
        {
          begin: "\\." + hljs.UNDERSCORE_IDENT_RE,
          relevance: 0
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/ocaml.js
  function ocaml(hljs) {
    return {
      name: "OCaml",
      aliases: ["ml"],
      keywords: {
        $pattern: "[a-z_]\\w*!?",
        keyword: "and as assert asr begin class constraint do done downto else end exception external for fun function functor if in include inherit! inherit initializer land lazy let lor lsl lsr lxor match method!|10 method mod module mutable new object of open! open or private rec sig struct then to try type val! val virtual when while with parser value",
        built_in: (
          /* built-in types */
          "array bool bytes char exn|5 float int int32 int64 list lazy_t|5 nativeint|5 string unit in_channel out_channel ref"
        ),
        literal: "true false"
      },
      illegal: /\/\/|>>/,
      contains: [
        {
          className: "literal",
          begin: "\\[(\\|\\|)?\\]|\\(\\)",
          relevance: 0
        },
        hljs.COMMENT(
          "\\(\\*",
          "\\*\\)",
          { contains: ["self"] }
        ),
        {
          /* type variable */
          className: "symbol",
          begin: "'[A-Za-z_](?!')[\\w']*"
          /* the grammar is ambiguous on how 'a'b should be interpreted but not the compiler */
        },
        {
          /* polymorphic variant */
          className: "type",
          begin: "`[A-Z][\\w']*"
        },
        {
          /* module or constructor */
          className: "type",
          begin: "\\b[A-Z][\\w']*",
          relevance: 0
        },
        {
          /* don't color identifiers, but safely catch all identifiers with ' */
          begin: "[a-z_]\\w*'[\\w']*",
          relevance: 0
        },
        hljs.inherit(hljs.APOS_STRING_MODE, {
          className: "string",
          relevance: 0
        }),
        hljs.inherit(hljs.QUOTE_STRING_MODE, { illegal: null }),
        {
          className: "number",
          begin: "\\b(0[xX][a-fA-F0-9_]+[Lln]?|0[oO][0-7_]+[Lln]?|0[bB][01_]+[Lln]?|[0-9][0-9_]*([Lln]|(\\.[0-9_]*)?([eE][-+]?[0-9_]+)?)?)",
          relevance: 0
        },
        {
          begin: /->/
          // relevance booster
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/php.js
  function php(hljs) {
    const regex = hljs.regex;
    const NOT_PERL_ETC = /(?![A-Za-z0-9])(?![$])/;
    const IDENT_RE3 = regex.concat(
      /[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/,
      NOT_PERL_ETC
    );
    const PASCAL_CASE_CLASS_NAME_RE = regex.concat(
      /(\\?[A-Z][a-z0-9_\x7f-\xff]+|\\?[A-Z]+(?=[A-Z][a-z0-9_\x7f-\xff])){1,}/,
      NOT_PERL_ETC
    );
    const UPCASE_NAME_RE = regex.concat(
      /[A-Z]+/,
      NOT_PERL_ETC
    );
    const VARIABLE = {
      scope: "variable",
      match: "\\$+" + IDENT_RE3
    };
    const PREPROCESSOR = {
      scope: "meta",
      variants: [
        { begin: /<\?php/, relevance: 10 },
        // boost for obvious PHP
        { begin: /<\?=/ },
        // less relevant per PSR-1 which says not to use short-tags
        { begin: /<\?/, relevance: 0.1 },
        { begin: /\?>/ }
        // end php tag
      ]
    };
    const SUBST = {
      scope: "subst",
      variants: [
        { begin: /\$\w+/ },
        {
          begin: /\{\$/,
          end: /\}/
        }
      ]
    };
    const SINGLE_QUOTED = hljs.inherit(hljs.APOS_STRING_MODE, { illegal: null });
    const DOUBLE_QUOTED = hljs.inherit(hljs.QUOTE_STRING_MODE, {
      illegal: null,
      contains: hljs.QUOTE_STRING_MODE.contains.concat(SUBST)
    });
    const HEREDOC = {
      begin: /<<<[ \t]*(?:(\w+)|"(\w+)")\n/,
      end: /[ \t]*(\w+)\b/,
      contains: hljs.QUOTE_STRING_MODE.contains.concat(SUBST),
      "on:begin": (m, resp) => {
        resp.data._beginMatch = m[1] || m[2];
      },
      "on:end": (m, resp) => {
        if (resp.data._beginMatch !== m[1]) resp.ignoreMatch();
      }
    };
    const NOWDOC = hljs.END_SAME_AS_BEGIN({
      begin: /<<<[ \t]*'(\w+)'\n/,
      end: /[ \t]*(\w+)\b/
    });
    const WHITESPACE = "[ 	\n]";
    const STRING = {
      scope: "string",
      variants: [
        DOUBLE_QUOTED,
        SINGLE_QUOTED,
        HEREDOC,
        NOWDOC
      ]
    };
    const NUMBER = {
      scope: "number",
      variants: [
        { begin: `\\b0[bB][01]+(?:_[01]+)*\\b` },
        // Binary w/ underscore support
        { begin: `\\b0[oO][0-7]+(?:_[0-7]+)*\\b` },
        // Octals w/ underscore support
        { begin: `\\b0[xX][\\da-fA-F]+(?:_[\\da-fA-F]+)*\\b` },
        // Hex w/ underscore support
        // Decimals w/ underscore support, with optional fragments and scientific exponent (e) suffix.
        { begin: `(?:\\b\\d+(?:_\\d+)*(\\.(?:\\d+(?:_\\d+)*))?|\\B\\.\\d+)(?:[eE][+-]?\\d+)?` }
      ],
      relevance: 0
    };
    const LITERALS3 = [
      "false",
      "null",
      "true"
    ];
    const KWS = [
      // Magic constants:
      // <https://www.php.net/manual/en/language.constants.predefined.php>
      "__CLASS__",
      "__DIR__",
      "__FILE__",
      "__FUNCTION__",
      "__COMPILER_HALT_OFFSET__",
      "__LINE__",
      "__METHOD__",
      "__NAMESPACE__",
      "__TRAIT__",
      // Function that look like language construct or language construct that look like function:
      // List of keywords that may not require parenthesis
      "die",
      "echo",
      "exit",
      "include",
      "include_once",
      "print",
      "require",
      "require_once",
      // These are not language construct (function) but operate on the currently-executing function and can access the current symbol table
      // 'compact extract func_get_arg func_get_args func_num_args get_called_class get_parent_class ' +
      // Other keywords:
      // <https://www.php.net/manual/en/reserved.php>
      // <https://www.php.net/manual/en/language.types.type-juggling.php>
      "array",
      "abstract",
      "and",
      "as",
      "binary",
      "bool",
      "boolean",
      "break",
      "callable",
      "case",
      "catch",
      "class",
      "clone",
      "const",
      "continue",
      "declare",
      "default",
      "do",
      "double",
      "else",
      "elseif",
      "empty",
      "enddeclare",
      "endfor",
      "endforeach",
      "endif",
      "endswitch",
      "endwhile",
      "enum",
      "eval",
      "extends",
      "final",
      "finally",
      "float",
      "for",
      "foreach",
      "from",
      "global",
      "goto",
      "if",
      "implements",
      "instanceof",
      "insteadof",
      "int",
      "integer",
      "interface",
      "isset",
      "iterable",
      "list",
      "match|0",
      "mixed",
      "new",
      "never",
      "object",
      "or",
      "private",
      "protected",
      "public",
      "readonly",
      "real",
      "return",
      "string",
      "switch",
      "throw",
      "trait",
      "try",
      "unset",
      "use",
      "var",
      "void",
      "while",
      "xor",
      "yield"
    ];
    const BUILT_INS3 = [
      // Standard PHP library:
      // <https://www.php.net/manual/en/book.spl.php>
      "Error|0",
      "AppendIterator",
      "ArgumentCountError",
      "ArithmeticError",
      "ArrayIterator",
      "ArrayObject",
      "AssertionError",
      "BadFunctionCallException",
      "BadMethodCallException",
      "CachingIterator",
      "CallbackFilterIterator",
      "CompileError",
      "Countable",
      "DirectoryIterator",
      "DivisionByZeroError",
      "DomainException",
      "EmptyIterator",
      "ErrorException",
      "Exception",
      "FilesystemIterator",
      "FilterIterator",
      "GlobIterator",
      "InfiniteIterator",
      "InvalidArgumentException",
      "IteratorIterator",
      "LengthException",
      "LimitIterator",
      "LogicException",
      "MultipleIterator",
      "NoRewindIterator",
      "OutOfBoundsException",
      "OutOfRangeException",
      "OuterIterator",
      "OverflowException",
      "ParentIterator",
      "ParseError",
      "RangeException",
      "RecursiveArrayIterator",
      "RecursiveCachingIterator",
      "RecursiveCallbackFilterIterator",
      "RecursiveDirectoryIterator",
      "RecursiveFilterIterator",
      "RecursiveIterator",
      "RecursiveIteratorIterator",
      "RecursiveRegexIterator",
      "RecursiveTreeIterator",
      "RegexIterator",
      "RuntimeException",
      "SeekableIterator",
      "SplDoublyLinkedList",
      "SplFileInfo",
      "SplFileObject",
      "SplFixedArray",
      "SplHeap",
      "SplMaxHeap",
      "SplMinHeap",
      "SplObjectStorage",
      "SplObserver",
      "SplPriorityQueue",
      "SplQueue",
      "SplStack",
      "SplSubject",
      "SplTempFileObject",
      "TypeError",
      "UnderflowException",
      "UnexpectedValueException",
      "UnhandledMatchError",
      // Reserved interfaces:
      // <https://www.php.net/manual/en/reserved.interfaces.php>
      "ArrayAccess",
      "BackedEnum",
      "Closure",
      "Fiber",
      "Generator",
      "Iterator",
      "IteratorAggregate",
      "Serializable",
      "Stringable",
      "Throwable",
      "Traversable",
      "UnitEnum",
      "WeakReference",
      "WeakMap",
      // Reserved classes:
      // <https://www.php.net/manual/en/reserved.classes.php>
      "Directory",
      "__PHP_Incomplete_Class",
      "parent",
      "php_user_filter",
      "self",
      "static",
      "stdClass"
    ];
    const dualCase = (items) => {
      const result = [];
      items.forEach((item) => {
        result.push(item);
        if (item.toLowerCase() === item) {
          result.push(item.toUpperCase());
        } else {
          result.push(item.toLowerCase());
        }
      });
      return result;
    };
    const KEYWORDS3 = {
      keyword: KWS,
      literal: dualCase(LITERALS3),
      built_in: BUILT_INS3
    };
    const normalizeKeywords = (items) => {
      return items.map((item) => {
        return item.replace(/\|\d+$/, "");
      });
    };
    const CONSTRUCTOR_CALL = { variants: [
      {
        match: [
          /new/,
          regex.concat(WHITESPACE, "+"),
          // to prevent built ins from being confused as the class constructor call
          regex.concat("(?!", normalizeKeywords(BUILT_INS3).join("\\b|"), "\\b)"),
          PASCAL_CASE_CLASS_NAME_RE
        ],
        scope: {
          1: "keyword",
          4: "title.class"
        }
      }
    ] };
    const CONSTANT_REFERENCE = regex.concat(IDENT_RE3, "\\b(?!\\()");
    const LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON = { variants: [
      {
        match: [
          regex.concat(
            /::/,
            regex.lookahead(/(?!class\b)/)
          ),
          CONSTANT_REFERENCE
        ],
        scope: { 2: "variable.constant" }
      },
      {
        match: [
          /::/,
          /class/
        ],
        scope: { 2: "variable.language" }
      },
      {
        match: [
          PASCAL_CASE_CLASS_NAME_RE,
          regex.concat(
            /::/,
            regex.lookahead(/(?!class\b)/)
          ),
          CONSTANT_REFERENCE
        ],
        scope: {
          1: "title.class",
          3: "variable.constant"
        }
      },
      {
        match: [
          PASCAL_CASE_CLASS_NAME_RE,
          regex.concat(
            "::",
            regex.lookahead(/(?!class\b)/)
          )
        ],
        scope: { 1: "title.class" }
      },
      {
        match: [
          PASCAL_CASE_CLASS_NAME_RE,
          /::/,
          /class/
        ],
        scope: {
          1: "title.class",
          3: "variable.language"
        }
      }
    ] };
    const NAMED_ARGUMENT = {
      scope: "attr",
      match: regex.concat(IDENT_RE3, regex.lookahead(":"), regex.lookahead(/(?!::)/))
    };
    const PARAMS_MODE = {
      relevance: 0,
      begin: /\(/,
      end: /\)/,
      keywords: KEYWORDS3,
      contains: [
        NAMED_ARGUMENT,
        VARIABLE,
        LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
        hljs.C_BLOCK_COMMENT_MODE,
        STRING,
        NUMBER,
        CONSTRUCTOR_CALL
      ]
    };
    const FUNCTION_INVOKE = {
      relevance: 0,
      match: [
        /\b/,
        // to prevent keywords from being confused as the function title
        regex.concat("(?!fn\\b|function\\b|", normalizeKeywords(KWS).join("\\b|"), "|", normalizeKeywords(BUILT_INS3).join("\\b|"), "\\b)"),
        IDENT_RE3,
        regex.concat(WHITESPACE, "*"),
        regex.lookahead(/(?=\()/)
      ],
      scope: { 3: "title.function.invoke" },
      contains: [PARAMS_MODE]
    };
    PARAMS_MODE.contains.push(FUNCTION_INVOKE);
    const ATTRIBUTE_CONTAINS = [
      NAMED_ARGUMENT,
      LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
      hljs.C_BLOCK_COMMENT_MODE,
      STRING,
      NUMBER,
      CONSTRUCTOR_CALL
    ];
    const ATTRIBUTES5 = {
      begin: regex.concat(
        /#\[\s*\\?/,
        regex.either(
          PASCAL_CASE_CLASS_NAME_RE,
          UPCASE_NAME_RE
        )
      ),
      beginScope: "meta",
      end: /]/,
      endScope: "meta",
      keywords: {
        literal: LITERALS3,
        keyword: [
          "new",
          "array"
        ]
      },
      contains: [
        {
          begin: /\[/,
          end: /]/,
          keywords: {
            literal: LITERALS3,
            keyword: [
              "new",
              "array"
            ]
          },
          contains: [
            "self",
            ...ATTRIBUTE_CONTAINS
          ]
        },
        ...ATTRIBUTE_CONTAINS,
        {
          scope: "meta",
          variants: [
            { match: PASCAL_CASE_CLASS_NAME_RE },
            { match: UPCASE_NAME_RE }
          ]
        }
      ]
    };
    return {
      case_insensitive: false,
      keywords: KEYWORDS3,
      contains: [
        ATTRIBUTES5,
        hljs.HASH_COMMENT_MODE,
        hljs.COMMENT("//", "$"),
        hljs.COMMENT(
          "/\\*",
          "\\*/",
          { contains: [
            {
              scope: "doctag",
              match: "@[A-Za-z]+"
            }
          ] }
        ),
        {
          match: /__halt_compiler\(\);/,
          keywords: "__halt_compiler",
          starts: {
            scope: "comment",
            end: hljs.MATCH_NOTHING_RE,
            contains: [
              {
                match: /\?>/,
                scope: "meta",
                endsParent: true
              }
            ]
          }
        },
        PREPROCESSOR,
        {
          scope: "variable.language",
          match: /\$this\b/
        },
        VARIABLE,
        FUNCTION_INVOKE,
        LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
        {
          match: [
            /const/,
            /\s/,
            IDENT_RE3
          ],
          scope: {
            1: "keyword",
            3: "variable.constant"
          }
        },
        CONSTRUCTOR_CALL,
        {
          scope: "function",
          relevance: 0,
          beginKeywords: "fn function",
          end: /[;{]/,
          excludeEnd: true,
          illegal: "[$%\\[]",
          contains: [
            { beginKeywords: "use" },
            hljs.UNDERSCORE_TITLE_MODE,
            {
              begin: "=>",
              // No markup, just a relevance booster
              endsParent: true
            },
            {
              scope: "params",
              begin: "\\(",
              end: "\\)",
              excludeBegin: true,
              excludeEnd: true,
              keywords: KEYWORDS3,
              contains: [
                "self",
                ATTRIBUTES5,
                VARIABLE,
                LEFT_AND_RIGHT_SIDE_OF_DOUBLE_COLON,
                hljs.C_BLOCK_COMMENT_MODE,
                STRING,
                NUMBER
              ]
            }
          ]
        },
        {
          scope: "class",
          variants: [
            {
              beginKeywords: "enum",
              illegal: /[($"]/
            },
            {
              beginKeywords: "class interface trait",
              illegal: /[:($"]/
            }
          ],
          relevance: 0,
          end: /\{/,
          excludeEnd: true,
          contains: [
            { beginKeywords: "extends implements" },
            hljs.UNDERSCORE_TITLE_MODE
          ]
        },
        // both use and namespace still use "old style" rules (vs multi-match)
        // because the namespace name can include `\` and we still want each
        // element to be treated as its own *individual* title
        {
          beginKeywords: "namespace",
          relevance: 0,
          end: ";",
          illegal: /[.']/,
          contains: [hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, { scope: "title.class" })]
        },
        {
          beginKeywords: "use",
          relevance: 0,
          end: ";",
          contains: [
            // TODO: title.function vs title.class
            {
              match: /\b(as|const|function)\b/,
              scope: "keyword"
            },
            // TODO: could be title.class or title.function
            hljs.UNDERSCORE_TITLE_MODE
          ]
        },
        STRING,
        NUMBER
      ]
    };
  }

  // node_modules/highlight.js/es/languages/powershell.js
  function powershell(hljs) {
    const TYPES3 = [
      "string",
      "char",
      "byte",
      "int",
      "long",
      "bool",
      "decimal",
      "single",
      "double",
      "DateTime",
      "xml",
      "array",
      "hashtable",
      "void"
    ];
    const VALID_VERBS = "Add|Clear|Close|Copy|Enter|Exit|Find|Format|Get|Hide|Join|Lock|Move|New|Open|Optimize|Pop|Push|Redo|Remove|Rename|Reset|Resize|Search|Select|Set|Show|Skip|Split|Step|Switch|Undo|Unlock|Watch|Backup|Checkpoint|Compare|Compress|Convert|ConvertFrom|ConvertTo|Dismount|Edit|Expand|Export|Group|Import|Initialize|Limit|Merge|Mount|Out|Publish|Restore|Save|Sync|Unpublish|Update|Approve|Assert|Build|Complete|Confirm|Deny|Deploy|Disable|Enable|Install|Invoke|Register|Request|Restart|Resume|Start|Stop|Submit|Suspend|Uninstall|Unregister|Wait|Debug|Measure|Ping|Repair|Resolve|Test|Trace|Connect|Disconnect|Read|Receive|Send|Write|Block|Grant|Protect|Revoke|Unblock|Unprotect|Use|ForEach|Sort|Tee|Where";
    const COMPARISON_OPERATORS = "-and|-as|-band|-bnot|-bor|-bxor|-casesensitive|-ccontains|-ceq|-cge|-cgt|-cle|-clike|-clt|-cmatch|-cne|-cnotcontains|-cnotlike|-cnotmatch|-contains|-creplace|-csplit|-eq|-exact|-f|-file|-ge|-gt|-icontains|-ieq|-ige|-igt|-ile|-ilike|-ilt|-imatch|-in|-ine|-inotcontains|-inotlike|-inotmatch|-ireplace|-is|-isnot|-isplit|-join|-le|-like|-lt|-match|-ne|-not|-notcontains|-notin|-notlike|-notmatch|-or|-regex|-replace|-shl|-shr|-split|-wildcard|-xor";
    const KEYWORDS3 = {
      $pattern: /-?[A-z\.\-]+\b/,
      keyword: "if else foreach return do while until elseif begin for trap data dynamicparam end break throw param continue finally in switch exit filter try process catch hidden static parameter",
      // "echo" relevance has been set to 0 to avoid auto-detect conflicts with shell transcripts
      built_in: "ac asnp cat cd CFS chdir clc clear clhy cli clp cls clv cnsn compare copy cp cpi cpp curl cvpa dbp del diff dir dnsn ebp echo|0 epal epcsv epsn erase etsn exsn fc fhx fl ft fw gal gbp gc gcb gci gcm gcs gdr gerr ghy gi gin gjb gl gm gmo gp gps gpv group gsn gsnp gsv gtz gu gv gwmi h history icm iex ihy ii ipal ipcsv ipmo ipsn irm ise iwmi iwr kill lp ls man md measure mi mount move mp mv nal ndr ni nmo npssc nsn nv ogv oh popd ps pushd pwd r rbp rcjb rcsn rd rdr ren ri rjb rm rmdir rmo rni rnp rp rsn rsnp rujb rv rvpa rwmi sajb sal saps sasv sbp sc scb select set shcm si sl sleep sls sort sp spjb spps spsv start stz sujb sv swmi tee trcm type wget where wjb write"
      // TODO: 'validate[A-Z]+' can't work in keywords
    };
    const TITLE_NAME_RE = /\w[\w\d]*((-)[\w\d]+)*/;
    const BACKTICK_ESCAPE = {
      begin: "`[\\s\\S]",
      relevance: 0
    };
    const VAR = {
      className: "variable",
      variants: [
        { begin: /\$\B/ },
        {
          className: "keyword",
          begin: /\$this/
        },
        { begin: /\$[\w\d][\w\d_:]*/ }
      ]
    };
    const LITERAL = {
      className: "literal",
      begin: /\$(null|true|false)\b/
    };
    const QUOTE_STRING = {
      className: "string",
      variants: [
        {
          begin: /"/,
          end: /"/
        },
        {
          begin: /@"/,
          end: /^"@/
        }
      ],
      contains: [
        BACKTICK_ESCAPE,
        VAR,
        {
          className: "variable",
          begin: /\$[A-z]/,
          end: /[^A-z]/
        }
      ]
    };
    const APOS_STRING = {
      className: "string",
      variants: [
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /@'/,
          end: /^'@/
        }
      ]
    };
    const PS_HELPTAGS = {
      className: "doctag",
      variants: [
        /* no paramater help tags */
        { begin: /\.(synopsis|description|example|inputs|outputs|notes|link|component|role|functionality)/ },
        /* one parameter help tags */
        { begin: /\.(parameter|forwardhelptargetname|forwardhelpcategory|remotehelprunspace|externalhelp)\s+\S+/ }
      ]
    };
    const PS_COMMENT = hljs.inherit(
      hljs.COMMENT(null, null),
      {
        variants: [
          /* single-line comment */
          {
            begin: /#/,
            end: /$/
          },
          /* multi-line comment */
          {
            begin: /<#/,
            end: /#>/
          }
        ],
        contains: [PS_HELPTAGS]
      }
    );
    const CMDLETS = {
      className: "built_in",
      variants: [{ begin: "(".concat(VALID_VERBS, ")+(-)[\\w\\d]+") }]
    };
    const PS_CLASS = {
      className: "class",
      beginKeywords: "class enum",
      end: /\s*[{]/,
      excludeEnd: true,
      relevance: 0,
      contains: [hljs.TITLE_MODE]
    };
    const PS_FUNCTION = {
      className: "function",
      begin: /function\s+/,
      end: /\s*\{|$/,
      excludeEnd: true,
      returnBegin: true,
      relevance: 0,
      contains: [
        {
          begin: "function",
          relevance: 0,
          className: "keyword"
        },
        {
          className: "title",
          begin: TITLE_NAME_RE,
          relevance: 0
        },
        {
          begin: /\(/,
          end: /\)/,
          className: "params",
          relevance: 0,
          contains: [VAR]
        }
        // CMDLETS
      ]
    };
    const PS_USING = {
      begin: /using\s/,
      end: /$/,
      returnBegin: true,
      contains: [
        QUOTE_STRING,
        APOS_STRING,
        {
          className: "keyword",
          begin: /(using|assembly|command|module|namespace|type)/
        }
      ]
    };
    const PS_ARGUMENTS = { variants: [
      // PS literals are pretty verbose so it's a good idea to accent them a bit.
      {
        className: "operator",
        begin: "(".concat(COMPARISON_OPERATORS, ")\\b")
      },
      {
        className: "literal",
        begin: /(-){1,2}[\w\d-]+/,
        relevance: 0
      }
    ] };
    const HASH_SIGNS = {
      className: "selector-tag",
      begin: /@\B/,
      relevance: 0
    };
    const PS_METHODS = {
      className: "function",
      begin: /\[.*\]\s*[\w]+[ ]??\(/,
      end: /$/,
      returnBegin: true,
      relevance: 0,
      contains: [
        {
          className: "keyword",
          begin: "(".concat(
            KEYWORDS3.keyword.toString().replace(
              /\s/g,
              "|"
            ),
            ")\\b"
          ),
          endsParent: true,
          relevance: 0
        },
        hljs.inherit(hljs.TITLE_MODE, { endsParent: true })
      ]
    };
    const GENTLEMANS_SET = [
      // STATIC_MEMBER,
      PS_METHODS,
      PS_COMMENT,
      BACKTICK_ESCAPE,
      hljs.NUMBER_MODE,
      QUOTE_STRING,
      APOS_STRING,
      // PS_NEW_OBJECT_TYPE,
      CMDLETS,
      VAR,
      LITERAL,
      HASH_SIGNS
    ];
    const PS_TYPE = {
      begin: /\[/,
      end: /\]/,
      excludeBegin: true,
      excludeEnd: true,
      relevance: 0,
      contains: [].concat(
        "self",
        GENTLEMANS_SET,
        {
          begin: "(" + TYPES3.join("|") + ")",
          className: "built_in",
          relevance: 0
        },
        {
          className: "type",
          begin: /[\.\w\d]+/,
          relevance: 0
        }
      )
    };
    PS_METHODS.contains.unshift(PS_TYPE);
    return {
      name: "PowerShell",
      aliases: [
        "pwsh",
        "ps",
        "ps1"
      ],
      case_insensitive: true,
      keywords: KEYWORDS3,
      contains: GENTLEMANS_SET.concat(
        PS_CLASS,
        PS_FUNCTION,
        PS_USING,
        PS_ARGUMENTS,
        PS_TYPE
      )
    };
  }

  // node_modules/highlight.js/es/languages/properties.js
  function properties(hljs) {
    const WS0 = "[ \\t\\f]*";
    const WS1 = "[ \\t\\f]+";
    const EQUAL_DELIM = WS0 + "[:=]" + WS0;
    const WS_DELIM = WS1;
    const DELIM = "(" + EQUAL_DELIM + "|" + WS_DELIM + ")";
    const KEY = "([^\\\\:= \\t\\f\\n]|\\\\.)+";
    const DELIM_AND_VALUE = {
      // skip DELIM
      end: DELIM,
      relevance: 0,
      starts: {
        // value: everything until end of line (again, taking into account backslashes)
        className: "string",
        end: /$/,
        relevance: 0,
        contains: [
          { begin: "\\\\\\\\" },
          { begin: "\\\\\\n" }
        ]
      }
    };
    return {
      name: ".properties",
      disableAutodetect: true,
      case_insensitive: true,
      illegal: /\S/,
      contains: [
        hljs.COMMENT("^\\s*[!#]", "$"),
        // key: everything until whitespace or = or : (taking into account backslashes)
        // case of a key-value pair
        {
          returnBegin: true,
          variants: [
            { begin: KEY + EQUAL_DELIM },
            { begin: KEY + WS_DELIM }
          ],
          contains: [
            {
              className: "attr",
              begin: KEY,
              endsParent: true
            }
          ],
          starts: DELIM_AND_VALUE
        },
        // case of an empty key
        {
          className: "attr",
          begin: KEY + WS0 + "$"
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/protobuf.js
  function protobuf(hljs) {
    const KEYWORDS3 = [
      "package",
      "import",
      "option",
      "optional",
      "required",
      "repeated",
      "group",
      "oneof"
    ];
    const TYPES3 = [
      "double",
      "float",
      "int32",
      "int64",
      "uint32",
      "uint64",
      "sint32",
      "sint64",
      "fixed32",
      "fixed64",
      "sfixed32",
      "sfixed64",
      "bool",
      "string",
      "bytes"
    ];
    const CLASS_DEFINITION = {
      match: [
        /(message|enum|service)\s+/,
        hljs.IDENT_RE
      ],
      scope: {
        1: "keyword",
        2: "title.class"
      }
    };
    return {
      name: "Protocol Buffers",
      aliases: ["proto"],
      keywords: {
        keyword: KEYWORDS3,
        type: TYPES3,
        literal: [
          "true",
          "false"
        ]
      },
      contains: [
        hljs.QUOTE_STRING_MODE,
        hljs.NUMBER_MODE,
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        CLASS_DEFINITION,
        {
          className: "function",
          beginKeywords: "rpc",
          end: /[{;]/,
          excludeEnd: true,
          keywords: "rpc returns"
        },
        {
          // match enum items (relevance)
          // BLAH = ...;
          begin: /^\s*[A-Z_]+(?=\s*=[^\n]+;$)/
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/puppet.js
  function puppet(hljs) {
    const PUPPET_KEYWORDS = {
      keyword: (
        /* language keywords */
        "and case default else elsif false if in import enherits node or true undef unless main settings $string "
      ),
      literal: (
        /* metaparameters */
        "alias audit before loglevel noop require subscribe tag owner ensure group mode name|0 changes context force incl lens load_path onlyif provider returns root show_diff type_check en_address ip_address realname command environment hour monute month monthday special target weekday creates cwd ogoutput refresh refreshonly tries try_sleep umask backup checksum content ctime force ignore links mtime purge recurse recurselimit replace selinux_ignore_defaults selrange selrole seltype seluser source souirce_permissions sourceselect validate_cmd validate_replacement allowdupe attribute_membership auth_membership forcelocal gid ia_load_module members system host_aliases ip allowed_trunk_vlans description device_url duplex encapsulation etherchannel native_vlan speed principals allow_root auth_class auth_type authenticate_user k_of_n mechanisms rule session_owner shared options device fstype enable hasrestart directory present absent link atboot blockdevice device dump pass remounts poller_tag use message withpath adminfile allow_virtual allowcdrom category configfiles flavor install_options instance package_settings platform responsefile status uninstall_options vendor unless_system_user unless_uid binary control flags hasstatus manifest pattern restart running start stop allowdupe auths expiry gid groups home iterations key_membership keys managehome membership password password_max_age password_min_age profile_membership profiles project purge_ssh_keys role_membership roles salt shell uid baseurl cost descr enabled enablegroups exclude failovermethod gpgcheck gpgkey http_caching include includepkgs keepalive metadata_expire metalink mirrorlist priority protect proxy proxy_password proxy_username repo_gpgcheck s3_enabled skip_if_unavailable sslcacert sslclientcert sslclientkey sslverify mounted"
      ),
      built_in: (
        /* core facts */
        "architecture augeasversion blockdevices boardmanufacturer boardproductname boardserialnumber cfkey dhcp_servers domain ec2_ ec2_userdata facterversion filesystems ldom fqdn gid hardwareisa hardwaremodel hostname id|0 interfaces ipaddress ipaddress_ ipaddress6 ipaddress6_ iphostnumber is_virtual kernel kernelmajversion kernelrelease kernelversion kernelrelease kernelversion lsbdistcodename lsbdistdescription lsbdistid lsbdistrelease lsbmajdistrelease lsbminordistrelease lsbrelease macaddress macaddress_ macosx_buildversion macosx_productname macosx_productversion macosx_productverson_major macosx_productversion_minor manufacturer memoryfree memorysize netmask metmask_ network_ operatingsystem operatingsystemmajrelease operatingsystemrelease osfamily partitions path physicalprocessorcount processor processorcount productname ps puppetversion rubysitedir rubyversion selinux selinux_config_mode selinux_config_policy selinux_current_mode selinux_current_mode selinux_enforced selinux_policyversion serialnumber sp_ sshdsakey sshecdsakey sshrsakey swapencrypted swapfree swapsize timezone type uniqueid uptime uptime_days uptime_hours uptime_seconds uuid virtual vlans xendomains zfs_version zonenae zones zpool_version"
      )
    };
    const COMMENT = hljs.COMMENT("#", "$");
    const IDENT_RE3 = "([A-Za-z_]|::)(\\w|::)*";
    const TITLE = hljs.inherit(hljs.TITLE_MODE, { begin: IDENT_RE3 });
    const VARIABLE = {
      className: "variable",
      begin: "\\$" + IDENT_RE3
    };
    const STRING = {
      className: "string",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        VARIABLE
      ],
      variants: [
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /"/,
          end: /"/
        }
      ]
    };
    return {
      name: "Puppet",
      aliases: ["pp"],
      contains: [
        COMMENT,
        VARIABLE,
        STRING,
        {
          beginKeywords: "class",
          end: "\\{|;",
          illegal: /=/,
          contains: [
            TITLE,
            COMMENT
          ]
        },
        {
          beginKeywords: "define",
          end: /\{/,
          contains: [
            {
              className: "section",
              begin: hljs.IDENT_RE,
              endsParent: true
            }
          ]
        },
        {
          begin: hljs.IDENT_RE + "\\s+\\{",
          returnBegin: true,
          end: /\S/,
          contains: [
            {
              className: "keyword",
              begin: hljs.IDENT_RE,
              relevance: 0.2
            },
            {
              begin: /\{/,
              end: /\}/,
              keywords: PUPPET_KEYWORDS,
              relevance: 0,
              contains: [
                STRING,
                COMMENT,
                {
                  begin: "[a-zA-Z_]+\\s*=>",
                  returnBegin: true,
                  end: "=>",
                  contains: [
                    {
                      className: "attr",
                      begin: hljs.IDENT_RE
                    }
                  ]
                },
                {
                  className: "number",
                  begin: "(\\b0[0-7_]+)|(\\b0x[0-9a-fA-F_]+)|(\\b[1-9][0-9_]*(\\.[0-9_]+)?)|[0_]\\b",
                  relevance: 0
                },
                VARIABLE
              ]
            }
          ],
          relevance: 0
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/python.js
  function python(hljs) {
    const regex = hljs.regex;
    const IDENT_RE3 = /[\p{XID_Start}_]\p{XID_Continue}*/u;
    const RESERVED_WORDS = [
      "and",
      "as",
      "assert",
      "async",
      "await",
      "break",
      "case",
      "class",
      "continue",
      "def",
      "del",
      "elif",
      "else",
      "except",
      "finally",
      "for",
      "from",
      "global",
      "if",
      "import",
      "in",
      "is",
      "lambda",
      "match",
      "nonlocal|10",
      "not",
      "or",
      "pass",
      "raise",
      "return",
      "try",
      "while",
      "with",
      "yield"
    ];
    const BUILT_INS3 = [
      "__import__",
      "abs",
      "all",
      "any",
      "ascii",
      "bin",
      "bool",
      "breakpoint",
      "bytearray",
      "bytes",
      "callable",
      "chr",
      "classmethod",
      "compile",
      "complex",
      "delattr",
      "dict",
      "dir",
      "divmod",
      "enumerate",
      "eval",
      "exec",
      "filter",
      "float",
      "format",
      "frozenset",
      "getattr",
      "globals",
      "hasattr",
      "hash",
      "help",
      "hex",
      "id",
      "input",
      "int",
      "isinstance",
      "issubclass",
      "iter",
      "len",
      "list",
      "locals",
      "map",
      "max",
      "memoryview",
      "min",
      "next",
      "object",
      "oct",
      "open",
      "ord",
      "pow",
      "print",
      "property",
      "range",
      "repr",
      "reversed",
      "round",
      "set",
      "setattr",
      "slice",
      "sorted",
      "staticmethod",
      "str",
      "sum",
      "super",
      "tuple",
      "type",
      "vars",
      "zip"
    ];
    const LITERALS3 = [
      "__debug__",
      "Ellipsis",
      "False",
      "None",
      "NotImplemented",
      "True"
    ];
    const TYPES3 = [
      "Any",
      "Callable",
      "Coroutine",
      "Dict",
      "List",
      "Literal",
      "Generic",
      "Optional",
      "Sequence",
      "Set",
      "Tuple",
      "Type",
      "Union"
    ];
    const KEYWORDS3 = {
      $pattern: /[A-Za-z]\w+|__\w+__/,
      keyword: RESERVED_WORDS,
      built_in: BUILT_INS3,
      literal: LITERALS3,
      type: TYPES3
    };
    const PROMPT = {
      className: "meta",
      begin: /^(>>>|\.\.\.) /
    };
    const SUBST = {
      className: "subst",
      begin: /\{/,
      end: /\}/,
      keywords: KEYWORDS3,
      illegal: /#/
    };
    const LITERAL_BRACKET = {
      begin: /\{\{/,
      relevance: 0
    };
    const STRING = {
      className: "string",
      contains: [hljs.BACKSLASH_ESCAPE],
      variants: [
        {
          begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?'''/,
          end: /'''/,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            PROMPT
          ],
          relevance: 10
        },
        {
          begin: /([uU]|[bB]|[rR]|[bB][rR]|[rR][bB])?"""/,
          end: /"""/,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            PROMPT
          ],
          relevance: 10
        },
        {
          begin: /([fF][rR]|[rR][fF]|[fF])'''/,
          end: /'''/,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            PROMPT,
            LITERAL_BRACKET,
            SUBST
          ]
        },
        {
          begin: /([fF][rR]|[rR][fF]|[fF])"""/,
          end: /"""/,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            PROMPT,
            LITERAL_BRACKET,
            SUBST
          ]
        },
        {
          begin: /([uU]|[rR])'/,
          end: /'/,
          relevance: 10
        },
        {
          begin: /([uU]|[rR])"/,
          end: /"/,
          relevance: 10
        },
        {
          begin: /([bB]|[bB][rR]|[rR][bB])'/,
          end: /'/
        },
        {
          begin: /([bB]|[bB][rR]|[rR][bB])"/,
          end: /"/
        },
        {
          begin: /([fF][rR]|[rR][fF]|[fF])'/,
          end: /'/,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            LITERAL_BRACKET,
            SUBST
          ]
        },
        {
          begin: /([fF][rR]|[rR][fF]|[fF])"/,
          end: /"/,
          contains: [
            hljs.BACKSLASH_ESCAPE,
            LITERAL_BRACKET,
            SUBST
          ]
        },
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE
      ]
    };
    const digitpart = "[0-9](_?[0-9])*";
    const pointfloat = `(\\b(${digitpart}))?\\.(${digitpart})|\\b(${digitpart})\\.`;
    const lookahead3 = `\\b|${RESERVED_WORDS.join("|")}`;
    const NUMBER = {
      className: "number",
      relevance: 0,
      variants: [
        // exponentfloat, pointfloat
        // https://docs.python.org/3.9/reference/lexical_analysis.html#floating-point-literals
        // optionally imaginary
        // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
        // Note: no leading \b because floats can start with a decimal point
        // and we don't want to mishandle e.g. `fn(.5)`,
        // no trailing \b for pointfloat because it can end with a decimal point
        // and we don't want to mishandle e.g. `0..hex()`; this should be safe
        // because both MUST contain a decimal point and so cannot be confused with
        // the interior part of an identifier
        {
          begin: `(\\b(${digitpart})|(${pointfloat}))[eE][+-]?(${digitpart})[jJ]?(?=${lookahead3})`
        },
        {
          begin: `(${pointfloat})[jJ]?`
        },
        // decinteger, bininteger, octinteger, hexinteger
        // https://docs.python.org/3.9/reference/lexical_analysis.html#integer-literals
        // optionally "long" in Python 2
        // https://docs.python.org/2.7/reference/lexical_analysis.html#integer-and-long-integer-literals
        // decinteger is optionally imaginary
        // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
        {
          begin: `\\b([1-9](_?[0-9])*|0+(_?0)*)[lLjJ]?(?=${lookahead3})`
        },
        {
          begin: `\\b0[bB](_?[01])+[lL]?(?=${lookahead3})`
        },
        {
          begin: `\\b0[oO](_?[0-7])+[lL]?(?=${lookahead3})`
        },
        {
          begin: `\\b0[xX](_?[0-9a-fA-F])+[lL]?(?=${lookahead3})`
        },
        // imagnumber (digitpart-based)
        // https://docs.python.org/3.9/reference/lexical_analysis.html#imaginary-literals
        {
          begin: `\\b(${digitpart})[jJ](?=${lookahead3})`
        }
      ]
    };
    const COMMENT_TYPE = {
      className: "comment",
      begin: regex.lookahead(/# type:/),
      end: /$/,
      keywords: KEYWORDS3,
      contains: [
        {
          // prevent keywords from coloring `type`
          begin: /# type:/
        },
        // comment within a datatype comment includes no keywords
        {
          begin: /#/,
          end: /\b\B/,
          endsWithParent: true
        }
      ]
    };
    const PARAMS = {
      className: "params",
      variants: [
        // Exclude params in functions without params
        {
          className: "",
          begin: /\(\s*\)/,
          skip: true
        },
        {
          begin: /\(/,
          end: /\)/,
          excludeBegin: true,
          excludeEnd: true,
          keywords: KEYWORDS3,
          contains: [
            "self",
            PROMPT,
            NUMBER,
            STRING,
            hljs.HASH_COMMENT_MODE
          ]
        }
      ]
    };
    SUBST.contains = [
      STRING,
      NUMBER,
      PROMPT
    ];
    return {
      name: "Python",
      aliases: [
        "py",
        "gyp",
        "ipython"
      ],
      unicodeRegex: true,
      keywords: KEYWORDS3,
      illegal: /(<\/|\?)|=>/,
      contains: [
        PROMPT,
        NUMBER,
        {
          // very common convention
          scope: "variable.language",
          match: /\bself\b/
        },
        {
          // eat "if" prior to string so that it won't accidentally be
          // labeled as an f-string
          beginKeywords: "if",
          relevance: 0
        },
        { match: /\bor\b/, scope: "keyword" },
        STRING,
        COMMENT_TYPE,
        hljs.HASH_COMMENT_MODE,
        {
          match: [
            /\bdef/,
            /\s+/,
            IDENT_RE3
          ],
          scope: {
            1: "keyword",
            3: "title.function"
          },
          contains: [PARAMS]
        },
        {
          variants: [
            {
              match: [
                /\bclass/,
                /\s+/,
                IDENT_RE3,
                /\s*/,
                /\(\s*/,
                IDENT_RE3,
                /\s*\)/
              ]
            },
            {
              match: [
                /\bclass/,
                /\s+/,
                IDENT_RE3
              ]
            }
          ],
          scope: {
            1: "keyword",
            3: "title.class",
            6: "title.class.inherited"
          }
        },
        {
          className: "meta",
          begin: /^[\t ]*@/,
          end: /(?=#)|$/,
          contains: [
            NUMBER,
            PARAMS,
            STRING
          ]
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/r.js
  function r(hljs) {
    const regex = hljs.regex;
    const IDENT_RE3 = /(?:(?:[a-zA-Z]|\.[._a-zA-Z])[._a-zA-Z0-9]*)|\.(?!\d)/;
    const NUMBER_TYPES_RE = regex.either(
      // Special case: only hexadecimal binary powers can contain fractions
      /0[xX][0-9a-fA-F]+\.[0-9a-fA-F]*[pP][+-]?\d+i?/,
      // Hexadecimal numbers without fraction and optional binary power
      /0[xX][0-9a-fA-F]+(?:[pP][+-]?\d+)?[Li]?/,
      // Decimal numbers
      /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[Li]?/
    );
    const OPERATORS_RE = /[=!<>:]=|\|\||&&|:::?|<-|<<-|->>|->|\|>|[-+*\/?!$&|:<=>@^~]|\*\*/;
    const PUNCTUATION_RE = regex.either(
      /[()]/,
      /[{}]/,
      /\[\[/,
      /[[\]]/,
      /\\/,
      /,/
    );
    return {
      name: "R",
      keywords: {
        $pattern: IDENT_RE3,
        keyword: "function if in break next repeat else for while",
        literal: "NULL NA TRUE FALSE Inf NaN NA_integer_|10 NA_real_|10 NA_character_|10 NA_complex_|10",
        built_in: (
          // Builtin constants
          "LETTERS letters month.abb month.name pi T F abs acos acosh all any anyNA Arg as.call as.character as.complex as.double as.environment as.integer as.logical as.null.default as.numeric as.raw asin asinh atan atanh attr attributes baseenv browser c call ceiling class Conj cos cosh cospi cummax cummin cumprod cumsum digamma dim dimnames emptyenv exp expression floor forceAndCall gamma gc.time globalenv Im interactive invisible is.array is.atomic is.call is.character is.complex is.double is.environment is.expression is.finite is.function is.infinite is.integer is.language is.list is.logical is.matrix is.na is.name is.nan is.null is.numeric is.object is.pairlist is.raw is.recursive is.single is.symbol lazyLoadDBfetch length lgamma list log max min missing Mod names nargs nzchar oldClass on.exit pos.to.env proc.time prod quote range Re rep retracemem return round seq_along seq_len seq.int sign signif sin sinh sinpi sqrt standardGeneric substitute sum switch tan tanh tanpi tracemem trigamma trunc unclass untracemem UseMethod xtfrm"
        )
      },
      contains: [
        // Roxygen comments
        hljs.COMMENT(
          /#'/,
          /$/,
          { contains: [
            {
              // Handle `@examples` separately to cause all subsequent code
              // until the next `@`-tag on its own line to be kept as-is,
              // preventing highlighting. This code is example R code, so nested
              // doctags shouldn’t be treated as such. See
              // `test/markup/r/roxygen.txt` for an example.
              scope: "doctag",
              match: /@examples/,
              starts: {
                end: regex.lookahead(regex.either(
                  // end if another doc comment
                  /\n^#'\s*(?=@[a-zA-Z]+)/,
                  // or a line with no comment
                  /\n^(?!#')/
                )),
                endsParent: true
              }
            },
            {
              // Handle `@param` to highlight the parameter name following
              // after.
              scope: "doctag",
              begin: "@param",
              end: /$/,
              contains: [
                {
                  scope: "variable",
                  variants: [
                    { match: IDENT_RE3 },
                    { match: /`(?:\\.|[^`\\])+`/ }
                  ],
                  endsParent: true
                }
              ]
            },
            {
              scope: "doctag",
              match: /@[a-zA-Z]+/
            },
            {
              scope: "keyword",
              match: /\\[a-zA-Z]+/
            }
          ] }
        ),
        hljs.HASH_COMMENT_MODE,
        {
          scope: "string",
          contains: [hljs.BACKSLASH_ESCAPE],
          variants: [
            hljs.END_SAME_AS_BEGIN({
              begin: /[rR]"(-*)\(/,
              end: /\)(-*)"/
            }),
            hljs.END_SAME_AS_BEGIN({
              begin: /[rR]"(-*)\{/,
              end: /\}(-*)"/
            }),
            hljs.END_SAME_AS_BEGIN({
              begin: /[rR]"(-*)\[/,
              end: /\](-*)"/
            }),
            hljs.END_SAME_AS_BEGIN({
              begin: /[rR]'(-*)\(/,
              end: /\)(-*)'/
            }),
            hljs.END_SAME_AS_BEGIN({
              begin: /[rR]'(-*)\{/,
              end: /\}(-*)'/
            }),
            hljs.END_SAME_AS_BEGIN({
              begin: /[rR]'(-*)\[/,
              end: /\](-*)'/
            }),
            {
              begin: '"',
              end: '"',
              relevance: 0
            },
            {
              begin: "'",
              end: "'",
              relevance: 0
            }
          ]
        },
        // Matching numbers immediately following punctuation and operators is
        // tricky since we need to look at the character ahead of a number to
        // ensure the number is not part of an identifier, and we cannot use
        // negative look-behind assertions. So instead we explicitly handle all
        // possible combinations of (operator|punctuation), number.
        // TODO: replace with negative look-behind when available
        // { begin: /(?<![a-zA-Z0-9._])0[xX][0-9a-fA-F]+\.[0-9a-fA-F]*[pP][+-]?\d+i?/ },
        // { begin: /(?<![a-zA-Z0-9._])0[xX][0-9a-fA-F]+([pP][+-]?\d+)?[Li]?/ },
        // { begin: /(?<![a-zA-Z0-9._])(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[Li]?/ }
        {
          relevance: 0,
          variants: [
            {
              scope: {
                1: "operator",
                2: "number"
              },
              match: [
                OPERATORS_RE,
                NUMBER_TYPES_RE
              ]
            },
            {
              scope: {
                1: "operator",
                2: "number"
              },
              match: [
                /%[^%]*%/,
                NUMBER_TYPES_RE
              ]
            },
            {
              scope: {
                1: "punctuation",
                2: "number"
              },
              match: [
                PUNCTUATION_RE,
                NUMBER_TYPES_RE
              ]
            },
            {
              scope: { 2: "number" },
              match: [
                /[^a-zA-Z0-9._]|^/,
                // not part of an identifier, or start of document
                NUMBER_TYPES_RE
              ]
            }
          ]
        },
        // Operators/punctuation when they're not directly followed by numbers
        {
          // Relevance boost for the most common assignment form.
          scope: { 3: "operator" },
          match: [
            IDENT_RE3,
            /\s+/,
            /<-/,
            /\s+/
          ]
        },
        {
          scope: "operator",
          relevance: 0,
          variants: [
            { match: OPERATORS_RE },
            { match: /%[^%]*%/ }
          ]
        },
        {
          scope: "punctuation",
          relevance: 0,
          match: PUNCTUATION_RE
        },
        {
          // Escaped identifier
          begin: "`",
          end: "`",
          contains: [{ begin: /\\./ }]
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/ruby.js
  function ruby(hljs) {
    const regex = hljs.regex;
    const RUBY_METHOD_RE = "([a-zA-Z_]\\w*[!?=]?|[-+~]@|<<|>>|=~|===?|<=>|[<>]=?|\\*\\*|[-/+%^&*~`|]|\\[\\]=?)";
    const CLASS_NAME_RE = regex.either(
      /\b([A-Z]+[a-z0-9]+)+/,
      // ends in caps
      /\b([A-Z]+[a-z0-9]+)+[A-Z]+/
    );
    const CLASS_NAME_WITH_NAMESPACE_RE = regex.concat(CLASS_NAME_RE, /(::\w+)*/);
    const PSEUDO_KWS = [
      "include",
      "extend",
      "prepend",
      "public",
      "private",
      "protected",
      "raise",
      "throw"
    ];
    const RUBY_KEYWORDS = {
      "variable.constant": [
        "__FILE__",
        "__LINE__",
        "__ENCODING__"
      ],
      "variable.language": [
        "self",
        "super"
      ],
      keyword: [
        "alias",
        "and",
        "begin",
        "BEGIN",
        "break",
        "case",
        "class",
        "defined",
        "do",
        "else",
        "elsif",
        "end",
        "END",
        "ensure",
        "for",
        "if",
        "in",
        "module",
        "next",
        "not",
        "or",
        "redo",
        "require",
        "rescue",
        "retry",
        "return",
        "then",
        "undef",
        "unless",
        "until",
        "when",
        "while",
        "yield",
        ...PSEUDO_KWS
      ],
      built_in: [
        "proc",
        "lambda",
        "attr_accessor",
        "attr_reader",
        "attr_writer",
        "define_method",
        "private_constant",
        "module_function"
      ],
      literal: [
        "true",
        "false",
        "nil"
      ]
    };
    const YARDOCTAG = {
      className: "doctag",
      begin: "@[A-Za-z]+"
    };
    const IRB_OBJECT = {
      begin: "#<",
      end: ">"
    };
    const COMMENT_MODES = [
      hljs.COMMENT(
        "#",
        "$",
        { contains: [YARDOCTAG] }
      ),
      hljs.COMMENT(
        "^=begin",
        "^=end",
        {
          contains: [YARDOCTAG],
          relevance: 10
        }
      ),
      hljs.COMMENT("^__END__", hljs.MATCH_NOTHING_RE)
    ];
    const SUBST = {
      className: "subst",
      begin: /#\{/,
      end: /\}/,
      keywords: RUBY_KEYWORDS
    };
    const STRING = {
      className: "string",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ],
      variants: [
        {
          begin: /'/,
          end: /'/
        },
        {
          begin: /"/,
          end: /"/
        },
        {
          begin: /`/,
          end: /`/
        },
        {
          begin: /%[qQwWx]?\(/,
          end: /\)/
        },
        {
          begin: /%[qQwWx]?\[/,
          end: /\]/
        },
        {
          begin: /%[qQwWx]?\{/,
          end: /\}/
        },
        {
          begin: /%[qQwWx]?</,
          end: />/
        },
        {
          begin: /%[qQwWx]?\//,
          end: /\//
        },
        {
          begin: /%[qQwWx]?%/,
          end: /%/
        },
        {
          begin: /%[qQwWx]?-/,
          end: /-/
        },
        {
          begin: /%[qQwWx]?\|/,
          end: /\|/
        },
        // in the following expressions, \B in the beginning suppresses recognition of ?-sequences
        // where ? is the last character of a preceding identifier, as in: `func?4`
        { begin: /\B\?(\\\d{1,3})/ },
        { begin: /\B\?(\\x[A-Fa-f0-9]{1,2})/ },
        { begin: /\B\?(\\u\{?[A-Fa-f0-9]{1,6}\}?)/ },
        { begin: /\B\?(\\M-\\C-|\\M-\\c|\\c\\M-|\\M-|\\C-\\M-)[\x20-\x7e]/ },
        { begin: /\B\?\\(c|C-)[\x20-\x7e]/ },
        { begin: /\B\?\\?\S/ },
        // heredocs
        {
          // this guard makes sure that we have an entire heredoc and not a false
          // positive (auto-detect, etc.)
          begin: regex.concat(
            /<<[-~]?'?/,
            regex.lookahead(/(\w+)(?=\W)[^\n]*\n(?:[^\n]*\n)*?\s*\1\b/)
          ),
          contains: [
            hljs.END_SAME_AS_BEGIN({
              begin: /(\w+)/,
              end: /(\w+)/,
              contains: [
                hljs.BACKSLASH_ESCAPE,
                SUBST
              ]
            })
          ]
        }
      ]
    };
    const decimal = "[1-9](_?[0-9])*|0";
    const digits = "[0-9](_?[0-9])*";
    const NUMBER = {
      className: "number",
      relevance: 0,
      variants: [
        // decimal integer/float, optionally exponential or rational, optionally imaginary
        { begin: `\\b(${decimal})(\\.(${digits}))?([eE][+-]?(${digits})|r)?i?\\b` },
        // explicit decimal/binary/octal/hexadecimal integer,
        // optionally rational and/or imaginary
        { begin: "\\b0[dD][0-9](_?[0-9])*r?i?\\b" },
        { begin: "\\b0[bB][0-1](_?[0-1])*r?i?\\b" },
        { begin: "\\b0[oO][0-7](_?[0-7])*r?i?\\b" },
        { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*r?i?\\b" },
        // 0-prefixed implicit octal integer, optionally rational and/or imaginary
        { begin: "\\b0(_?[0-7])+r?i?\\b" }
      ]
    };
    const PARAMS = {
      variants: [
        {
          match: /\(\)/
        },
        {
          className: "params",
          begin: /\(/,
          end: /(?=\))/,
          excludeBegin: true,
          endsParent: true,
          keywords: RUBY_KEYWORDS
        }
      ]
    };
    const INCLUDE_EXTEND = {
      match: [
        /(include|extend)\s+/,
        CLASS_NAME_WITH_NAMESPACE_RE
      ],
      scope: {
        2: "title.class"
      },
      keywords: RUBY_KEYWORDS
    };
    const CLASS_DEFINITION = {
      variants: [
        {
          match: [
            /class\s+/,
            CLASS_NAME_WITH_NAMESPACE_RE,
            /\s+<\s+/,
            CLASS_NAME_WITH_NAMESPACE_RE
          ]
        },
        {
          match: [
            /\b(class|module)\s+/,
            CLASS_NAME_WITH_NAMESPACE_RE
          ]
        }
      ],
      scope: {
        2: "title.class",
        4: "title.class.inherited"
      },
      keywords: RUBY_KEYWORDS
    };
    const UPPER_CASE_CONSTANT = {
      relevance: 0,
      match: /\b[A-Z][A-Z_0-9]+\b/,
      className: "variable.constant"
    };
    const METHOD_DEFINITION = {
      match: [
        /def/,
        /\s+/,
        RUBY_METHOD_RE
      ],
      scope: {
        1: "keyword",
        3: "title.function"
      },
      contains: [
        PARAMS
      ]
    };
    const OBJECT_CREATION = {
      relevance: 0,
      match: [
        CLASS_NAME_WITH_NAMESPACE_RE,
        /\.new[. (]/
      ],
      scope: {
        1: "title.class"
      }
    };
    const CLASS_REFERENCE = {
      relevance: 0,
      match: CLASS_NAME_RE,
      scope: "title.class"
    };
    const RUBY_DEFAULT_CONTAINS = [
      STRING,
      CLASS_DEFINITION,
      INCLUDE_EXTEND,
      OBJECT_CREATION,
      UPPER_CASE_CONSTANT,
      CLASS_REFERENCE,
      METHOD_DEFINITION,
      {
        // swallow namespace qualifiers before symbols
        begin: hljs.IDENT_RE + "::"
      },
      {
        className: "symbol",
        begin: hljs.UNDERSCORE_IDENT_RE + "(!|\\?)?:",
        relevance: 0
      },
      {
        className: "symbol",
        begin: ":(?!\\s)",
        contains: [
          STRING,
          { begin: RUBY_METHOD_RE }
        ],
        relevance: 0
      },
      NUMBER,
      {
        // negative-look forward attempts to prevent false matches like:
        // @ident@ or $ident$ that might indicate this is not ruby at all
        className: "variable",
        begin: `(\\$\\W)|((\\$|@@?)(\\w+))(?=[^@$?])(?![A-Za-z])(?![@$?'])`
      },
      {
        className: "params",
        begin: /\|(?!=)/,
        end: /\|/,
        excludeBegin: true,
        excludeEnd: true,
        relevance: 0,
        // this could be a lot of things (in other languages) other than params
        keywords: RUBY_KEYWORDS
      },
      {
        // regexp container
        begin: "(" + hljs.RE_STARTERS_RE + "|unless)\\s*",
        keywords: "unless",
        contains: [
          {
            className: "regexp",
            contains: [
              hljs.BACKSLASH_ESCAPE,
              SUBST
            ],
            illegal: /\n/,
            variants: [
              {
                begin: "/",
                end: "/[a-z]*"
              },
              {
                begin: /%r\{/,
                end: /\}[a-z]*/
              },
              {
                begin: "%r\\(",
                end: "\\)[a-z]*"
              },
              {
                begin: "%r!",
                end: "![a-z]*"
              },
              {
                begin: "%r\\[",
                end: "\\][a-z]*"
              }
            ]
          }
        ].concat(IRB_OBJECT, COMMENT_MODES),
        relevance: 0
      }
    ].concat(IRB_OBJECT, COMMENT_MODES);
    SUBST.contains = RUBY_DEFAULT_CONTAINS;
    PARAMS.contains = RUBY_DEFAULT_CONTAINS;
    const SIMPLE_PROMPT = "[>?]>";
    const DEFAULT_PROMPT = "[\\w#]+\\(\\w+\\):\\d+:\\d+[>*]";
    const RVM_PROMPT = "(\\w+-)?\\d+\\.\\d+\\.\\d+(p\\d+)?[^\\d][^>]+>";
    const IRB_DEFAULT = [
      {
        begin: /^\s*=>/,
        starts: {
          end: "$",
          contains: RUBY_DEFAULT_CONTAINS
        }
      },
      {
        className: "meta.prompt",
        begin: "^(" + SIMPLE_PROMPT + "|" + DEFAULT_PROMPT + "|" + RVM_PROMPT + ")(?=[ ])",
        starts: {
          end: "$",
          keywords: RUBY_KEYWORDS,
          contains: RUBY_DEFAULT_CONTAINS
        }
      }
    ];
    COMMENT_MODES.unshift(IRB_OBJECT);
    return {
      name: "Ruby",
      aliases: [
        "rb",
        "gemspec",
        "podspec",
        "thor",
        "irb"
      ],
      keywords: RUBY_KEYWORDS,
      illegal: /\/\*/,
      contains: [hljs.SHEBANG({ binary: "ruby" })].concat(IRB_DEFAULT).concat(COMMENT_MODES).concat(RUBY_DEFAULT_CONTAINS)
    };
  }

  // node_modules/highlight.js/es/languages/rust.js
  function rust(hljs) {
    const regex = hljs.regex;
    const RAW_IDENTIFIER = /(r#)?/;
    const UNDERSCORE_IDENT_RE = regex.concat(RAW_IDENTIFIER, hljs.UNDERSCORE_IDENT_RE);
    const IDENT_RE3 = regex.concat(RAW_IDENTIFIER, hljs.IDENT_RE);
    const FUNCTION_INVOKE = {
      className: "title.function.invoke",
      relevance: 0,
      begin: regex.concat(
        /\b/,
        /(?!let|for|while|if|else|match\b)/,
        IDENT_RE3,
        regex.lookahead(/\s*\(/)
      )
    };
    const NUMBER_SUFFIX = "([ui](8|16|32|64|128|size)|f(32|64))?";
    const KEYWORDS3 = [
      "abstract",
      "as",
      "async",
      "await",
      "become",
      "box",
      "break",
      "const",
      "continue",
      "crate",
      "do",
      "dyn",
      "else",
      "enum",
      "extern",
      "false",
      "final",
      "fn",
      "for",
      "if",
      "impl",
      "in",
      "let",
      "loop",
      "macro",
      "match",
      "mod",
      "move",
      "mut",
      "override",
      "priv",
      "pub",
      "ref",
      "return",
      "self",
      "Self",
      "static",
      "struct",
      "super",
      "trait",
      "true",
      "try",
      "type",
      "typeof",
      "union",
      "unsafe",
      "unsized",
      "use",
      "virtual",
      "where",
      "while",
      "yield"
    ];
    const LITERALS3 = [
      "true",
      "false",
      "Some",
      "None",
      "Ok",
      "Err"
    ];
    const BUILTINS = [
      // functions
      "drop ",
      // traits
      "Copy",
      "Send",
      "Sized",
      "Sync",
      "Drop",
      "Fn",
      "FnMut",
      "FnOnce",
      "ToOwned",
      "Clone",
      "Debug",
      "PartialEq",
      "PartialOrd",
      "Eq",
      "Ord",
      "AsRef",
      "AsMut",
      "Into",
      "From",
      "Default",
      "Iterator",
      "Extend",
      "IntoIterator",
      "DoubleEndedIterator",
      "ExactSizeIterator",
      "SliceConcatExt",
      "ToString",
      // macros
      "assert!",
      "assert_eq!",
      "bitflags!",
      "bytes!",
      "cfg!",
      "col!",
      "concat!",
      "concat_idents!",
      "debug_assert!",
      "debug_assert_eq!",
      "env!",
      "eprintln!",
      "panic!",
      "file!",
      "format!",
      "format_args!",
      "include_bytes!",
      "include_str!",
      "line!",
      "local_data_key!",
      "module_path!",
      "option_env!",
      "print!",
      "println!",
      "select!",
      "stringify!",
      "try!",
      "unimplemented!",
      "unreachable!",
      "vec!",
      "write!",
      "writeln!",
      "macro_rules!",
      "assert_ne!",
      "debug_assert_ne!"
    ];
    const TYPES3 = [
      "i8",
      "i16",
      "i32",
      "i64",
      "i128",
      "isize",
      "u8",
      "u16",
      "u32",
      "u64",
      "u128",
      "usize",
      "f32",
      "f64",
      "str",
      "char",
      "bool",
      "Box",
      "Option",
      "Result",
      "String",
      "Vec"
    ];
    return {
      name: "Rust",
      aliases: ["rs"],
      keywords: {
        $pattern: hljs.IDENT_RE + "!?",
        type: TYPES3,
        keyword: KEYWORDS3,
        literal: LITERALS3,
        built_in: BUILTINS
      },
      illegal: "</",
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.COMMENT("/\\*", "\\*/", { contains: ["self"] }),
        hljs.inherit(hljs.QUOTE_STRING_MODE, {
          begin: /b?"/,
          illegal: null
        }),
        {
          className: "symbol",
          // negative lookahead to avoid matching `'`
          begin: /'[a-zA-Z_][a-zA-Z0-9_]*(?!')/
        },
        {
          scope: "string",
          variants: [
            { begin: /b?r(#*)"(.|\n)*?"\1(?!#)/ },
            {
              begin: /b?'/,
              end: /'/,
              contains: [
                {
                  scope: "char.escape",
                  match: /\\('|\w|x\w{2}|u\w{4}|U\w{8})/
                }
              ]
            }
          ]
        },
        {
          className: "number",
          variants: [
            { begin: "\\b0b([01_]+)" + NUMBER_SUFFIX },
            { begin: "\\b0o([0-7_]+)" + NUMBER_SUFFIX },
            { begin: "\\b0x([A-Fa-f0-9_]+)" + NUMBER_SUFFIX },
            { begin: "\\b(\\d[\\d_]*(\\.[0-9_]+)?([eE][+-]?[0-9_]+)?)" + NUMBER_SUFFIX }
          ],
          relevance: 0
        },
        {
          begin: [
            /fn/,
            /\s+/,
            UNDERSCORE_IDENT_RE
          ],
          className: {
            1: "keyword",
            3: "title.function"
          }
        },
        {
          className: "meta",
          begin: "#!?\\[",
          end: "\\]",
          contains: [
            {
              className: "string",
              begin: /"/,
              end: /"/,
              contains: [
                hljs.BACKSLASH_ESCAPE
              ]
            }
          ]
        },
        {
          begin: [
            /let/,
            /\s+/,
            /(?:mut\s+)?/,
            UNDERSCORE_IDENT_RE
          ],
          className: {
            1: "keyword",
            3: "keyword",
            4: "variable"
          }
        },
        // must come before impl/for rule later
        {
          begin: [
            /for/,
            /\s+/,
            UNDERSCORE_IDENT_RE,
            /\s+/,
            /in/
          ],
          className: {
            1: "keyword",
            3: "variable",
            5: "keyword"
          }
        },
        {
          begin: [
            /type/,
            /\s+/,
            UNDERSCORE_IDENT_RE
          ],
          className: {
            1: "keyword",
            3: "title.class"
          }
        },
        {
          begin: [
            /(?:trait|enum|struct|union|impl|for)/,
            /\s+/,
            UNDERSCORE_IDENT_RE
          ],
          className: {
            1: "keyword",
            3: "title.class"
          }
        },
        {
          begin: hljs.IDENT_RE + "::",
          keywords: {
            keyword: "Self",
            built_in: BUILTINS,
            type: TYPES3
          }
        },
        {
          className: "punctuation",
          begin: "->"
        },
        FUNCTION_INVOKE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/sas.js
  function sas(hljs) {
    const regex = hljs.regex;
    const SAS_KEYWORDS = [
      "do",
      "if",
      "then",
      "else",
      "end",
      "until",
      "while",
      "abort",
      "array",
      "attrib",
      "by",
      "call",
      "cards",
      "cards4",
      "catname",
      "continue",
      "datalines",
      "datalines4",
      "delete",
      "delim",
      "delimiter",
      "display",
      "dm",
      "drop",
      "endsas",
      "error",
      "file",
      "filename",
      "footnote",
      "format",
      "goto",
      "in",
      "infile",
      "informat",
      "input",
      "keep",
      "label",
      "leave",
      "length",
      "libname",
      "link",
      "list",
      "lostcard",
      "merge",
      "missing",
      "modify",
      "options",
      "output",
      "out",
      "page",
      "put",
      "redirect",
      "remove",
      "rename",
      "replace",
      "retain",
      "return",
      "select",
      "set",
      "skip",
      "startsas",
      "stop",
      "title",
      "update",
      "waitsas",
      "where",
      "window",
      "x|0",
      "systask",
      "add",
      "and",
      "alter",
      "as",
      "cascade",
      "check",
      "create",
      "delete",
      "describe",
      "distinct",
      "drop",
      "foreign",
      "from",
      "group",
      "having",
      "index",
      "insert",
      "into",
      "in",
      "key",
      "like",
      "message",
      "modify",
      "msgtype",
      "not",
      "null",
      "on",
      "or",
      "order",
      "primary",
      "references",
      "reset",
      "restrict",
      "select",
      "set",
      "table",
      "unique",
      "update",
      "validate",
      "view",
      "where"
    ];
    const FUNCTIONS = [
      "abs",
      "addr",
      "airy",
      "arcos",
      "arsin",
      "atan",
      "attrc",
      "attrn",
      "band",
      "betainv",
      "blshift",
      "bnot",
      "bor",
      "brshift",
      "bxor",
      "byte",
      "cdf",
      "ceil",
      "cexist",
      "cinv",
      "close",
      "cnonct",
      "collate",
      "compbl",
      "compound",
      "compress",
      "cos",
      "cosh",
      "css",
      "curobs",
      "cv",
      "daccdb",
      "daccdbsl",
      "daccsl",
      "daccsyd",
      "dacctab",
      "dairy",
      "date",
      "datejul",
      "datepart",
      "datetime",
      "day",
      "dclose",
      "depdb",
      "depdbsl",
      "depdbsl",
      "depsl",
      "depsl",
      "depsyd",
      "depsyd",
      "deptab",
      "deptab",
      "dequote",
      "dhms",
      "dif",
      "digamma",
      "dim",
      "dinfo",
      "dnum",
      "dopen",
      "doptname",
      "doptnum",
      "dread",
      "dropnote",
      "dsname",
      "erf",
      "erfc",
      "exist",
      "exp",
      "fappend",
      "fclose",
      "fcol",
      "fdelete",
      "fetch",
      "fetchobs",
      "fexist",
      "fget",
      "fileexist",
      "filename",
      "fileref",
      "finfo",
      "finv",
      "fipname",
      "fipnamel",
      "fipstate",
      "floor",
      "fnonct",
      "fnote",
      "fopen",
      "foptname",
      "foptnum",
      "fpoint",
      "fpos",
      "fput",
      "fread",
      "frewind",
      "frlen",
      "fsep",
      "fuzz",
      "fwrite",
      "gaminv",
      "gamma",
      "getoption",
      "getvarc",
      "getvarn",
      "hbound",
      "hms",
      "hosthelp",
      "hour",
      "ibessel",
      "index",
      "indexc",
      "indexw",
      "input",
      "inputc",
      "inputn",
      "int",
      "intck",
      "intnx",
      "intrr",
      "irr",
      "jbessel",
      "juldate",
      "kurtosis",
      "lag",
      "lbound",
      "left",
      "length",
      "lgamma",
      "libname",
      "libref",
      "log",
      "log10",
      "log2",
      "logpdf",
      "logpmf",
      "logsdf",
      "lowcase",
      "max",
      "mdy",
      "mean",
      "min",
      "minute",
      "mod",
      "month",
      "mopen",
      "mort",
      "n",
      "netpv",
      "nmiss",
      "normal",
      "note",
      "npv",
      "open",
      "ordinal",
      "pathname",
      "pdf",
      "peek",
      "peekc",
      "pmf",
      "point",
      "poisson",
      "poke",
      "probbeta",
      "probbnml",
      "probchi",
      "probf",
      "probgam",
      "probhypr",
      "probit",
      "probnegb",
      "probnorm",
      "probt",
      "put",
      "putc",
      "putn",
      "qtr",
      "quote",
      "ranbin",
      "rancau",
      "ranexp",
      "rangam",
      "range",
      "rank",
      "rannor",
      "ranpoi",
      "rantbl",
      "rantri",
      "ranuni",
      "repeat",
      "resolve",
      "reverse",
      "rewind",
      "right",
      "round",
      "saving",
      "scan",
      "sdf",
      "second",
      "sign",
      "sin",
      "sinh",
      "skewness",
      "soundex",
      "spedis",
      "sqrt",
      "std",
      "stderr",
      "stfips",
      "stname",
      "stnamel",
      "substr",
      "sum",
      "symget",
      "sysget",
      "sysmsg",
      "sysprod",
      "sysrc",
      "system",
      "tan",
      "tanh",
      "time",
      "timepart",
      "tinv",
      "tnonct",
      "today",
      "translate",
      "tranwrd",
      "trigamma",
      "trim",
      "trimn",
      "trunc",
      "uniform",
      "upcase",
      "uss",
      "var",
      "varfmt",
      "varinfmt",
      "varlabel",
      "varlen",
      "varname",
      "varnum",
      "varray",
      "varrayx",
      "vartype",
      "verify",
      "vformat",
      "vformatd",
      "vformatdx",
      "vformatn",
      "vformatnx",
      "vformatw",
      "vformatwx",
      "vformatx",
      "vinarray",
      "vinarrayx",
      "vinformat",
      "vinformatd",
      "vinformatdx",
      "vinformatn",
      "vinformatnx",
      "vinformatw",
      "vinformatwx",
      "vinformatx",
      "vlabel",
      "vlabelx",
      "vlength",
      "vlengthx",
      "vname",
      "vnamex",
      "vtype",
      "vtypex",
      "weekday",
      "year",
      "yyq",
      "zipfips",
      "zipname",
      "zipnamel",
      "zipstate"
    ];
    const MACRO_FUNCTIONS = [
      "bquote",
      "nrbquote",
      "cmpres",
      "qcmpres",
      "compstor",
      "datatyp",
      "display",
      "do",
      "else",
      "end",
      "eval",
      "global",
      "goto",
      "if",
      "index",
      "input",
      "keydef",
      "label",
      "left",
      "length",
      "let",
      "local",
      "lowcase",
      "macro",
      "mend",
      "nrbquote",
      "nrquote",
      "nrstr",
      "put",
      "qcmpres",
      "qleft",
      "qlowcase",
      "qscan",
      "qsubstr",
      "qsysfunc",
      "qtrim",
      "quote",
      "qupcase",
      "scan",
      "str",
      "substr",
      "superq",
      "syscall",
      "sysevalf",
      "sysexec",
      "sysfunc",
      "sysget",
      "syslput",
      "sysprod",
      "sysrc",
      "sysrput",
      "then",
      "to",
      "trim",
      "unquote",
      "until",
      "upcase",
      "verify",
      "while",
      "window"
    ];
    const LITERALS3 = [
      "null",
      "missing",
      "_all_",
      "_automatic_",
      "_character_",
      "_infile_",
      "_n_",
      "_name_",
      "_null_",
      "_numeric_",
      "_user_",
      "_webout_"
    ];
    return {
      name: "SAS",
      case_insensitive: true,
      keywords: {
        literal: LITERALS3,
        keyword: SAS_KEYWORDS
      },
      contains: [
        {
          // Distinct highlight for proc <proc>, data, run, quit
          className: "keyword",
          begin: /^\s*(proc [\w\d_]+|data|run|quit)[\s;]/
        },
        {
          // Macro variables
          className: "variable",
          begin: /&[a-zA-Z_&][a-zA-Z0-9_]*\.?/
        },
        {
          begin: [
            /^\s*/,
            /datalines;|cards;/,
            /(?:.*\n)+/,
            /^\s*;\s*$/
          ],
          className: {
            2: "keyword",
            3: "string"
          }
        },
        {
          begin: [
            /%mend|%macro/,
            /\s+/,
            /[a-zA-Z_&][a-zA-Z0-9_]*/
          ],
          className: {
            1: "built_in",
            3: "title.function"
          }
        },
        {
          // Built-in macro variables
          className: "built_in",
          begin: "%" + regex.either(...MACRO_FUNCTIONS)
        },
        {
          // User-defined macro functions
          className: "title.function",
          begin: /%[a-zA-Z_][a-zA-Z_0-9]*/
        },
        {
          // TODO: this is most likely an incorrect classification
          // built_in may need more nuance
          // https://github.com/highlightjs/highlight.js/issues/2521
          className: "meta",
          begin: regex.either(...FUNCTIONS) + "(?=\\()"
        },
        {
          className: "string",
          variants: [
            hljs.APOS_STRING_MODE,
            hljs.QUOTE_STRING_MODE
          ]
        },
        hljs.COMMENT("\\*", ";"),
        hljs.C_BLOCK_COMMENT_MODE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/scala.js
  function scala(hljs) {
    const regex = hljs.regex;
    const ANNOTATION = {
      className: "meta",
      begin: "@[A-Za-z]+"
    };
    const SUBST = {
      className: "subst",
      variants: [
        { begin: "\\$[A-Za-z0-9_]+" },
        {
          begin: /\$\{/,
          end: /\}/
        }
      ]
    };
    const STRING = {
      className: "string",
      variants: [
        {
          begin: '"""',
          end: '"""'
        },
        {
          begin: '"',
          end: '"',
          illegal: "\\n",
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          begin: '[a-z]+"',
          end: '"',
          illegal: "\\n",
          contains: [
            hljs.BACKSLASH_ESCAPE,
            SUBST
          ]
        },
        {
          className: "string",
          begin: '[a-z]+"""',
          end: '"""',
          contains: [SUBST],
          relevance: 10
        }
      ]
    };
    const TYPE = {
      className: "type",
      begin: "\\b[A-Z][A-Za-z0-9_]*",
      relevance: 0
    };
    const NAME = {
      className: "title",
      begin: /[^0-9\n\t "'(),.`{}\[\]:;][^\n\t "'(),.`{}\[\]:;]+|[^0-9\n\t "'(),.`{}\[\]:;=]/,
      relevance: 0
    };
    const CLASS = {
      className: "class",
      beginKeywords: "class object trait type",
      end: /[:={\[\n;]/,
      excludeEnd: true,
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          beginKeywords: "extends with",
          relevance: 10
        },
        {
          begin: /\[/,
          end: /\]/,
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0,
          contains: [
            TYPE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        {
          className: "params",
          begin: /\(/,
          end: /\)/,
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0,
          contains: [
            TYPE,
            hljs.C_LINE_COMMENT_MODE,
            hljs.C_BLOCK_COMMENT_MODE
          ]
        },
        NAME
      ]
    };
    const METHOD = {
      className: "function",
      beginKeywords: "def",
      end: regex.lookahead(/[:={\[(\n;]/),
      contains: [NAME]
    };
    const EXTENSION = {
      begin: [
        /^\s*/,
        // Is first token on the line
        "extension",
        /\s+(?=[[(])/
        // followed by at least one space and `[` or `(`
      ],
      beginScope: { 2: "keyword" }
    };
    const END = {
      begin: [
        /^\s*/,
        // Is first token on the line
        /end/,
        /\s+/,
        /(extension\b)?/
        // `extension` is the only marker that follows an `end` that cannot be captured by another rule.
      ],
      beginScope: {
        2: "keyword",
        4: "keyword"
      }
    };
    const INLINE_MODES = [
      { match: /\.inline\b/ },
      {
        begin: /\binline(?=\s)/,
        keywords: "inline"
      }
    ];
    const USING_PARAM_CLAUSE = {
      begin: [
        /\(\s*/,
        // Opening `(` of a parameter or argument list
        /using/,
        /\s+(?!\))/
        // Spaces not followed by `)`
      ],
      beginScope: { 2: "keyword" }
    };
    const DIRECTIVE_VALUE = {
      className: "string",
      begin: /\S+/
    };
    const USING_DIRECTIVE = {
      begin: [
        "//>",
        /\s+/,
        /using/,
        /\s+/,
        /\S+/
      ],
      beginScope: {
        1: "comment",
        3: "keyword",
        5: "type"
      },
      end: /$/,
      contains: [
        DIRECTIVE_VALUE
      ]
    };
    return {
      name: "Scala",
      keywords: {
        literal: "true false null",
        keyword: "type yield lazy override def with val var sealed abstract private trait object if then forSome for while do throw finally protected extends import final return else break new catch super class case package default try this match continue throws implicit export enum given transparent"
      },
      contains: [
        USING_DIRECTIVE,
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        STRING,
        TYPE,
        METHOD,
        CLASS,
        hljs.C_NUMBER_MODE,
        EXTENSION,
        END,
        ...INLINE_MODES,
        USING_PARAM_CLAUSE,
        ANNOTATION
      ]
    };
  }

  // node_modules/highlight.js/es/languages/scheme.js
  function scheme(hljs) {
    const SCHEME_IDENT_RE = "[^\\(\\)\\[\\]\\{\\}\",'`;#|\\\\\\s]+";
    const SCHEME_SIMPLE_NUMBER_RE = "(-|\\+)?\\d+([./]\\d+)?";
    const SCHEME_COMPLEX_NUMBER_RE = SCHEME_SIMPLE_NUMBER_RE + "[+\\-]" + SCHEME_SIMPLE_NUMBER_RE + "i";
    const KEYWORDS3 = {
      $pattern: SCHEME_IDENT_RE,
      built_in: "case-lambda call/cc class define-class exit-handler field import inherit init-field interface let*-values let-values let/ec mixin opt-lambda override protect provide public rename require require-for-syntax syntax syntax-case syntax-error unit/sig unless when with-syntax and begin call-with-current-continuation call-with-input-file call-with-output-file case cond define define-syntax delay do dynamic-wind else for-each if lambda let let* let-syntax letrec letrec-syntax map or syntax-rules ' * + , ,@ - ... / ; < <= = => > >= ` abs acos angle append apply asin assoc assq assv atan boolean? caar cadr call-with-input-file call-with-output-file call-with-values car cdddar cddddr cdr ceiling char->integer char-alphabetic? char-ci<=? char-ci<? char-ci=? char-ci>=? char-ci>? char-downcase char-lower-case? char-numeric? char-ready? char-upcase char-upper-case? char-whitespace? char<=? char<? char=? char>=? char>? char? close-input-port close-output-port complex? cons cos current-input-port current-output-port denominator display eof-object? eq? equal? eqv? eval even? exact->inexact exact? exp expt floor force gcd imag-part inexact->exact inexact? input-port? integer->char integer? interaction-environment lcm length list list->string list->vector list-ref list-tail list? load log magnitude make-polar make-rectangular make-string make-vector max member memq memv min modulo negative? newline not null-environment null? number->string number? numerator odd? open-input-file open-output-file output-port? pair? peek-char port? positive? procedure? quasiquote quote quotient rational? rationalize read read-char real-part real? remainder reverse round scheme-report-environment set! set-car! set-cdr! sin sqrt string string->list string->number string->symbol string-append string-ci<=? string-ci<? string-ci=? string-ci>=? string-ci>? string-copy string-fill! string-length string-ref string-set! string<=? string<? string=? string>=? string>? string? substring symbol->string symbol? tan transcript-off transcript-on truncate values vector vector->list vector-fill! vector-length vector-ref vector-set! with-input-from-file with-output-to-file write write-char zero?"
    };
    const LITERAL = {
      className: "literal",
      begin: "(#t|#f|#\\\\" + SCHEME_IDENT_RE + "|#\\\\.)"
    };
    const NUMBER = {
      className: "number",
      variants: [
        {
          begin: SCHEME_SIMPLE_NUMBER_RE,
          relevance: 0
        },
        {
          begin: SCHEME_COMPLEX_NUMBER_RE,
          relevance: 0
        },
        { begin: "#b[0-1]+(/[0-1]+)?" },
        { begin: "#o[0-7]+(/[0-7]+)?" },
        { begin: "#x[0-9a-f]+(/[0-9a-f]+)?" }
      ]
    };
    const STRING = hljs.QUOTE_STRING_MODE;
    const COMMENT_MODES = [
      hljs.COMMENT(
        ";",
        "$",
        { relevance: 0 }
      ),
      hljs.COMMENT("#\\|", "\\|#")
    ];
    const IDENT = {
      begin: SCHEME_IDENT_RE,
      relevance: 0
    };
    const QUOTED_IDENT = {
      className: "symbol",
      begin: "'" + SCHEME_IDENT_RE
    };
    const BODY = {
      endsWithParent: true,
      relevance: 0
    };
    const QUOTED_LIST = {
      variants: [
        { begin: /'/ },
        { begin: "`" }
      ],
      contains: [
        {
          begin: "\\(",
          end: "\\)",
          contains: [
            "self",
            LITERAL,
            STRING,
            NUMBER,
            IDENT,
            QUOTED_IDENT
          ]
        }
      ]
    };
    const NAME = {
      className: "name",
      relevance: 0,
      begin: SCHEME_IDENT_RE,
      keywords: KEYWORDS3
    };
    const LAMBDA = {
      begin: /lambda/,
      endsWithParent: true,
      returnBegin: true,
      contains: [
        NAME,
        {
          endsParent: true,
          variants: [
            {
              begin: /\(/,
              end: /\)/
            },
            {
              begin: /\[/,
              end: /\]/
            }
          ],
          contains: [IDENT]
        }
      ]
    };
    const LIST = {
      variants: [
        {
          begin: "\\(",
          end: "\\)"
        },
        {
          begin: "\\[",
          end: "\\]"
        }
      ],
      contains: [
        LAMBDA,
        NAME,
        BODY
      ]
    };
    BODY.contains = [
      LITERAL,
      NUMBER,
      STRING,
      IDENT,
      QUOTED_IDENT,
      QUOTED_LIST,
      LIST
    ].concat(COMMENT_MODES);
    return {
      name: "Scheme",
      aliases: ["scm"],
      illegal: /\S/,
      contains: [
        hljs.SHEBANG(),
        NUMBER,
        STRING,
        QUOTED_IDENT,
        QUOTED_LIST,
        LIST
      ].concat(COMMENT_MODES)
    };
  }

  // node_modules/highlight.js/es/languages/scss.js
  var MODES3 = (hljs) => {
    return {
      IMPORTANT: {
        scope: "meta",
        begin: "!important"
      },
      BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
      HEXCOLOR: {
        scope: "number",
        begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
      },
      FUNCTION_DISPATCH: {
        className: "built_in",
        begin: /[\w-]+(?=\()/
      },
      ATTRIBUTE_SELECTOR_MODE: {
        scope: "selector-attr",
        begin: /\[/,
        end: /\]/,
        illegal: "$",
        contains: [
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      },
      CSS_NUMBER_MODE: {
        scope: "number",
        begin: hljs.NUMBER_RE + "(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",
        relevance: 0
      },
      CSS_VARIABLE: {
        className: "attr",
        begin: /--[A-Za-z_][A-Za-z0-9_-]*/
      }
    };
  };
  var HTML_TAGS3 = [
    "a",
    "abbr",
    "address",
    "article",
    "aside",
    "audio",
    "b",
    "blockquote",
    "body",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "dd",
    "del",
    "details",
    "dfn",
    "div",
    "dl",
    "dt",
    "em",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "main",
    "mark",
    "menu",
    "nav",
    "object",
    "ol",
    "optgroup",
    "option",
    "p",
    "picture",
    "q",
    "quote",
    "samp",
    "section",
    "select",
    "source",
    "span",
    "strong",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "tr",
    "ul",
    "var",
    "video"
  ];
  var SVG_TAGS3 = [
    "defs",
    "g",
    "marker",
    "mask",
    "pattern",
    "svg",
    "switch",
    "symbol",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feFlood",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMorphology",
    "feOffset",
    "feSpecularLighting",
    "feTile",
    "feTurbulence",
    "linearGradient",
    "radialGradient",
    "stop",
    "circle",
    "ellipse",
    "image",
    "line",
    "path",
    "polygon",
    "polyline",
    "rect",
    "text",
    "use",
    "textPath",
    "tspan",
    "foreignObject",
    "clipPath"
  ];
  var TAGS3 = [
    ...HTML_TAGS3,
    ...SVG_TAGS3
  ];
  var MEDIA_FEATURES3 = [
    "any-hover",
    "any-pointer",
    "aspect-ratio",
    "color",
    "color-gamut",
    "color-index",
    "device-aspect-ratio",
    "device-height",
    "device-width",
    "display-mode",
    "forced-colors",
    "grid",
    "height",
    "hover",
    "inverted-colors",
    "monochrome",
    "orientation",
    "overflow-block",
    "overflow-inline",
    "pointer",
    "prefers-color-scheme",
    "prefers-contrast",
    "prefers-reduced-motion",
    "prefers-reduced-transparency",
    "resolution",
    "scan",
    "scripting",
    "update",
    "width",
    // TODO: find a better solution?
    "min-width",
    "max-width",
    "min-height",
    "max-height"
  ].sort().reverse();
  var PSEUDO_CLASSES3 = [
    "active",
    "any-link",
    "blank",
    "checked",
    "current",
    "default",
    "defined",
    "dir",
    // dir()
    "disabled",
    "drop",
    "empty",
    "enabled",
    "first",
    "first-child",
    "first-of-type",
    "fullscreen",
    "future",
    "focus",
    "focus-visible",
    "focus-within",
    "has",
    // has()
    "host",
    // host or host()
    "host-context",
    // host-context()
    "hover",
    "indeterminate",
    "in-range",
    "invalid",
    "is",
    // is()
    "lang",
    // lang()
    "last-child",
    "last-of-type",
    "left",
    "link",
    "local-link",
    "not",
    // not()
    "nth-child",
    // nth-child()
    "nth-col",
    // nth-col()
    "nth-last-child",
    // nth-last-child()
    "nth-last-col",
    // nth-last-col()
    "nth-last-of-type",
    //nth-last-of-type()
    "nth-of-type",
    //nth-of-type()
    "only-child",
    "only-of-type",
    "optional",
    "out-of-range",
    "past",
    "placeholder-shown",
    "read-only",
    "read-write",
    "required",
    "right",
    "root",
    "scope",
    "target",
    "target-within",
    "user-invalid",
    "valid",
    "visited",
    "where"
    // where()
  ].sort().reverse();
  var PSEUDO_ELEMENTS3 = [
    "after",
    "backdrop",
    "before",
    "cue",
    "cue-region",
    "first-letter",
    "first-line",
    "grammar-error",
    "marker",
    "part",
    "placeholder",
    "selection",
    "slotted",
    "spelling-error"
  ].sort().reverse();
  var ATTRIBUTES3 = [
    "accent-color",
    "align-content",
    "align-items",
    "align-self",
    "alignment-baseline",
    "all",
    "anchor-name",
    "animation",
    "animation-composition",
    "animation-delay",
    "animation-direction",
    "animation-duration",
    "animation-fill-mode",
    "animation-iteration-count",
    "animation-name",
    "animation-play-state",
    "animation-range",
    "animation-range-end",
    "animation-range-start",
    "animation-timeline",
    "animation-timing-function",
    "appearance",
    "aspect-ratio",
    "backdrop-filter",
    "backface-visibility",
    "background",
    "background-attachment",
    "background-blend-mode",
    "background-clip",
    "background-color",
    "background-image",
    "background-origin",
    "background-position",
    "background-position-x",
    "background-position-y",
    "background-repeat",
    "background-size",
    "baseline-shift",
    "block-size",
    "border",
    "border-block",
    "border-block-color",
    "border-block-end",
    "border-block-end-color",
    "border-block-end-style",
    "border-block-end-width",
    "border-block-start",
    "border-block-start-color",
    "border-block-start-style",
    "border-block-start-width",
    "border-block-style",
    "border-block-width",
    "border-bottom",
    "border-bottom-color",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "border-bottom-style",
    "border-bottom-width",
    "border-collapse",
    "border-color",
    "border-end-end-radius",
    "border-end-start-radius",
    "border-image",
    "border-image-outset",
    "border-image-repeat",
    "border-image-slice",
    "border-image-source",
    "border-image-width",
    "border-inline",
    "border-inline-color",
    "border-inline-end",
    "border-inline-end-color",
    "border-inline-end-style",
    "border-inline-end-width",
    "border-inline-start",
    "border-inline-start-color",
    "border-inline-start-style",
    "border-inline-start-width",
    "border-inline-style",
    "border-inline-width",
    "border-left",
    "border-left-color",
    "border-left-style",
    "border-left-width",
    "border-radius",
    "border-right",
    "border-right-color",
    "border-right-style",
    "border-right-width",
    "border-spacing",
    "border-start-end-radius",
    "border-start-start-radius",
    "border-style",
    "border-top",
    "border-top-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-top-style",
    "border-top-width",
    "border-width",
    "bottom",
    "box-align",
    "box-decoration-break",
    "box-direction",
    "box-flex",
    "box-flex-group",
    "box-lines",
    "box-ordinal-group",
    "box-orient",
    "box-pack",
    "box-shadow",
    "box-sizing",
    "break-after",
    "break-before",
    "break-inside",
    "caption-side",
    "caret-color",
    "clear",
    "clip",
    "clip-path",
    "clip-rule",
    "color",
    "color-interpolation",
    "color-interpolation-filters",
    "color-profile",
    "color-rendering",
    "color-scheme",
    "column-count",
    "column-fill",
    "column-gap",
    "column-rule",
    "column-rule-color",
    "column-rule-style",
    "column-rule-width",
    "column-span",
    "column-width",
    "columns",
    "contain",
    "contain-intrinsic-block-size",
    "contain-intrinsic-height",
    "contain-intrinsic-inline-size",
    "contain-intrinsic-size",
    "contain-intrinsic-width",
    "container",
    "container-name",
    "container-type",
    "content",
    "content-visibility",
    "counter-increment",
    "counter-reset",
    "counter-set",
    "cue",
    "cue-after",
    "cue-before",
    "cursor",
    "cx",
    "cy",
    "direction",
    "display",
    "dominant-baseline",
    "empty-cells",
    "enable-background",
    "field-sizing",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "flex",
    "flex-basis",
    "flex-direction",
    "flex-flow",
    "flex-grow",
    "flex-shrink",
    "flex-wrap",
    "float",
    "flood-color",
    "flood-opacity",
    "flow",
    "font",
    "font-display",
    "font-family",
    "font-feature-settings",
    "font-kerning",
    "font-language-override",
    "font-optical-sizing",
    "font-palette",
    "font-size",
    "font-size-adjust",
    "font-smooth",
    "font-smoothing",
    "font-stretch",
    "font-style",
    "font-synthesis",
    "font-synthesis-position",
    "font-synthesis-small-caps",
    "font-synthesis-style",
    "font-synthesis-weight",
    "font-variant",
    "font-variant-alternates",
    "font-variant-caps",
    "font-variant-east-asian",
    "font-variant-emoji",
    "font-variant-ligatures",
    "font-variant-numeric",
    "font-variant-position",
    "font-variation-settings",
    "font-weight",
    "forced-color-adjust",
    "gap",
    "glyph-orientation-horizontal",
    "glyph-orientation-vertical",
    "grid",
    "grid-area",
    "grid-auto-columns",
    "grid-auto-flow",
    "grid-auto-rows",
    "grid-column",
    "grid-column-end",
    "grid-column-start",
    "grid-gap",
    "grid-row",
    "grid-row-end",
    "grid-row-start",
    "grid-template",
    "grid-template-areas",
    "grid-template-columns",
    "grid-template-rows",
    "hanging-punctuation",
    "height",
    "hyphenate-character",
    "hyphenate-limit-chars",
    "hyphens",
    "icon",
    "image-orientation",
    "image-rendering",
    "image-resolution",
    "ime-mode",
    "initial-letter",
    "initial-letter-align",
    "inline-size",
    "inset",
    "inset-area",
    "inset-block",
    "inset-block-end",
    "inset-block-start",
    "inset-inline",
    "inset-inline-end",
    "inset-inline-start",
    "isolation",
    "justify-content",
    "justify-items",
    "justify-self",
    "kerning",
    "left",
    "letter-spacing",
    "lighting-color",
    "line-break",
    "line-height",
    "line-height-step",
    "list-style",
    "list-style-image",
    "list-style-position",
    "list-style-type",
    "margin",
    "margin-block",
    "margin-block-end",
    "margin-block-start",
    "margin-bottom",
    "margin-inline",
    "margin-inline-end",
    "margin-inline-start",
    "margin-left",
    "margin-right",
    "margin-top",
    "margin-trim",
    "marker",
    "marker-end",
    "marker-mid",
    "marker-start",
    "marks",
    "mask",
    "mask-border",
    "mask-border-mode",
    "mask-border-outset",
    "mask-border-repeat",
    "mask-border-slice",
    "mask-border-source",
    "mask-border-width",
    "mask-clip",
    "mask-composite",
    "mask-image",
    "mask-mode",
    "mask-origin",
    "mask-position",
    "mask-repeat",
    "mask-size",
    "mask-type",
    "masonry-auto-flow",
    "math-depth",
    "math-shift",
    "math-style",
    "max-block-size",
    "max-height",
    "max-inline-size",
    "max-width",
    "min-block-size",
    "min-height",
    "min-inline-size",
    "min-width",
    "mix-blend-mode",
    "nav-down",
    "nav-index",
    "nav-left",
    "nav-right",
    "nav-up",
    "none",
    "normal",
    "object-fit",
    "object-position",
    "offset",
    "offset-anchor",
    "offset-distance",
    "offset-path",
    "offset-position",
    "offset-rotate",
    "opacity",
    "order",
    "orphans",
    "outline",
    "outline-color",
    "outline-offset",
    "outline-style",
    "outline-width",
    "overflow",
    "overflow-anchor",
    "overflow-block",
    "overflow-clip-margin",
    "overflow-inline",
    "overflow-wrap",
    "overflow-x",
    "overflow-y",
    "overlay",
    "overscroll-behavior",
    "overscroll-behavior-block",
    "overscroll-behavior-inline",
    "overscroll-behavior-x",
    "overscroll-behavior-y",
    "padding",
    "padding-block",
    "padding-block-end",
    "padding-block-start",
    "padding-bottom",
    "padding-inline",
    "padding-inline-end",
    "padding-inline-start",
    "padding-left",
    "padding-right",
    "padding-top",
    "page",
    "page-break-after",
    "page-break-before",
    "page-break-inside",
    "paint-order",
    "pause",
    "pause-after",
    "pause-before",
    "perspective",
    "perspective-origin",
    "place-content",
    "place-items",
    "place-self",
    "pointer-events",
    "position",
    "position-anchor",
    "position-visibility",
    "print-color-adjust",
    "quotes",
    "r",
    "resize",
    "rest",
    "rest-after",
    "rest-before",
    "right",
    "rotate",
    "row-gap",
    "ruby-align",
    "ruby-position",
    "scale",
    "scroll-behavior",
    "scroll-margin",
    "scroll-margin-block",
    "scroll-margin-block-end",
    "scroll-margin-block-start",
    "scroll-margin-bottom",
    "scroll-margin-inline",
    "scroll-margin-inline-end",
    "scroll-margin-inline-start",
    "scroll-margin-left",
    "scroll-margin-right",
    "scroll-margin-top",
    "scroll-padding",
    "scroll-padding-block",
    "scroll-padding-block-end",
    "scroll-padding-block-start",
    "scroll-padding-bottom",
    "scroll-padding-inline",
    "scroll-padding-inline-end",
    "scroll-padding-inline-start",
    "scroll-padding-left",
    "scroll-padding-right",
    "scroll-padding-top",
    "scroll-snap-align",
    "scroll-snap-stop",
    "scroll-snap-type",
    "scroll-timeline",
    "scroll-timeline-axis",
    "scroll-timeline-name",
    "scrollbar-color",
    "scrollbar-gutter",
    "scrollbar-width",
    "shape-image-threshold",
    "shape-margin",
    "shape-outside",
    "shape-rendering",
    "speak",
    "speak-as",
    "src",
    // @font-face
    "stop-color",
    "stop-opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "tab-size",
    "table-layout",
    "text-align",
    "text-align-all",
    "text-align-last",
    "text-anchor",
    "text-combine-upright",
    "text-decoration",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-skip",
    "text-decoration-skip-ink",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-emphasis",
    "text-emphasis-color",
    "text-emphasis-position",
    "text-emphasis-style",
    "text-indent",
    "text-justify",
    "text-orientation",
    "text-overflow",
    "text-rendering",
    "text-shadow",
    "text-size-adjust",
    "text-transform",
    "text-underline-offset",
    "text-underline-position",
    "text-wrap",
    "text-wrap-mode",
    "text-wrap-style",
    "timeline-scope",
    "top",
    "touch-action",
    "transform",
    "transform-box",
    "transform-origin",
    "transform-style",
    "transition",
    "transition-behavior",
    "transition-delay",
    "transition-duration",
    "transition-property",
    "transition-timing-function",
    "translate",
    "unicode-bidi",
    "user-modify",
    "user-select",
    "vector-effect",
    "vertical-align",
    "view-timeline",
    "view-timeline-axis",
    "view-timeline-inset",
    "view-timeline-name",
    "view-transition-name",
    "visibility",
    "voice-balance",
    "voice-duration",
    "voice-family",
    "voice-pitch",
    "voice-range",
    "voice-rate",
    "voice-stress",
    "voice-volume",
    "white-space",
    "white-space-collapse",
    "widows",
    "width",
    "will-change",
    "word-break",
    "word-spacing",
    "word-wrap",
    "writing-mode",
    "x",
    "y",
    "z-index",
    "zoom"
  ].sort().reverse();
  function scss(hljs) {
    const modes = MODES3(hljs);
    const PSEUDO_ELEMENTS$1 = PSEUDO_ELEMENTS3;
    const PSEUDO_CLASSES$1 = PSEUDO_CLASSES3;
    const AT_IDENTIFIER = "@[a-z-]+";
    const AT_MODIFIERS = "and or not only";
    const IDENT_RE3 = "[a-zA-Z-][a-zA-Z0-9_-]*";
    const VARIABLE = {
      className: "variable",
      begin: "(\\$" + IDENT_RE3 + ")\\b",
      relevance: 0
    };
    return {
      name: "SCSS",
      case_insensitive: true,
      illegal: "[=/|']",
      contains: [
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        // to recognize keyframe 40% etc which are outside the scope of our
        // attribute value mode
        modes.CSS_NUMBER_MODE,
        {
          className: "selector-id",
          begin: "#[A-Za-z0-9_-]+",
          relevance: 0
        },
        {
          className: "selector-class",
          begin: "\\.[A-Za-z0-9_-]+",
          relevance: 0
        },
        modes.ATTRIBUTE_SELECTOR_MODE,
        {
          className: "selector-tag",
          begin: "\\b(" + TAGS3.join("|") + ")\\b",
          // was there, before, but why?
          relevance: 0
        },
        {
          className: "selector-pseudo",
          begin: ":(" + PSEUDO_CLASSES$1.join("|") + ")"
        },
        {
          className: "selector-pseudo",
          begin: ":(:)?(" + PSEUDO_ELEMENTS$1.join("|") + ")"
        },
        VARIABLE,
        {
          // pseudo-selector params
          begin: /\(/,
          end: /\)/,
          contains: [modes.CSS_NUMBER_MODE]
        },
        modes.CSS_VARIABLE,
        {
          className: "attribute",
          begin: "\\b(" + ATTRIBUTES3.join("|") + ")\\b"
        },
        { begin: "\\b(whitespace|wait|w-resize|visible|vertical-text|vertical-ideographic|uppercase|upper-roman|upper-alpha|underline|transparent|top|thin|thick|text|text-top|text-bottom|tb-rl|table-header-group|table-footer-group|sw-resize|super|strict|static|square|solid|small-caps|separate|se-resize|scroll|s-resize|rtl|row-resize|ridge|right|repeat|repeat-y|repeat-x|relative|progress|pointer|overline|outside|outset|oblique|nowrap|not-allowed|normal|none|nw-resize|no-repeat|no-drop|newspaper|ne-resize|n-resize|move|middle|medium|ltr|lr-tb|lowercase|lower-roman|lower-alpha|loose|list-item|line|line-through|line-edge|lighter|left|keep-all|justify|italic|inter-word|inter-ideograph|inside|inset|inline|inline-block|inherit|inactive|ideograph-space|ideograph-parenthesis|ideograph-numeric|ideograph-alpha|horizontal|hidden|help|hand|groove|fixed|ellipsis|e-resize|double|dotted|distribute|distribute-space|distribute-letter|distribute-all-lines|disc|disabled|default|decimal|dashed|crosshair|collapse|col-resize|circle|char|center|capitalize|break-word|break-all|bottom|both|bolder|bold|block|bidi-override|below|baseline|auto|always|all-scroll|absolute|table|table-cell)\\b" },
        {
          begin: /:/,
          end: /[;}{]/,
          relevance: 0,
          contains: [
            modes.BLOCK_COMMENT,
            VARIABLE,
            modes.HEXCOLOR,
            modes.CSS_NUMBER_MODE,
            hljs.QUOTE_STRING_MODE,
            hljs.APOS_STRING_MODE,
            modes.IMPORTANT,
            modes.FUNCTION_DISPATCH
          ]
        },
        // matching these here allows us to treat them more like regular CSS
        // rules so everything between the {} gets regular rule highlighting,
        // which is what we want for page and font-face
        {
          begin: "@(page|font-face)",
          keywords: {
            $pattern: AT_IDENTIFIER,
            keyword: "@page @font-face"
          }
        },
        {
          begin: "@",
          end: "[{;]",
          returnBegin: true,
          keywords: {
            $pattern: /[a-z-]+/,
            keyword: AT_MODIFIERS,
            attribute: MEDIA_FEATURES3.join(" ")
          },
          contains: [
            {
              begin: AT_IDENTIFIER,
              className: "keyword"
            },
            {
              begin: /[a-z-]+(?=:)/,
              className: "attribute"
            },
            VARIABLE,
            hljs.QUOTE_STRING_MODE,
            hljs.APOS_STRING_MODE,
            modes.HEXCOLOR,
            modes.CSS_NUMBER_MODE
          ]
        },
        modes.FUNCTION_DISPATCH
      ]
    };
  }

  // node_modules/highlight.js/es/languages/smalltalk.js
  function smalltalk(hljs) {
    const VAR_IDENT_RE = "[a-z][a-zA-Z0-9_]*";
    const CHAR = {
      className: "string",
      begin: "\\$.{1}"
    };
    const SYMBOL = {
      className: "symbol",
      begin: "#" + hljs.UNDERSCORE_IDENT_RE
    };
    return {
      name: "Smalltalk",
      aliases: ["st"],
      keywords: [
        "self",
        "super",
        "nil",
        "true",
        "false",
        "thisContext"
      ],
      contains: [
        hljs.COMMENT('"', '"'),
        hljs.APOS_STRING_MODE,
        {
          className: "type",
          begin: "\\b[A-Z][A-Za-z0-9_]*",
          relevance: 0
        },
        {
          begin: VAR_IDENT_RE + ":",
          relevance: 0
        },
        hljs.C_NUMBER_MODE,
        SYMBOL,
        CHAR,
        {
          // This looks more complicated than needed to avoid combinatorial
          // explosion under V8. It effectively means `| var1 var2 ... |` with
          // whitespace adjacent to `|` being optional.
          begin: "\\|[ ]*" + VAR_IDENT_RE + "([ ]+" + VAR_IDENT_RE + ")*[ ]*\\|",
          returnBegin: true,
          end: /\|/,
          illegal: /\S/,
          contains: [{ begin: "(\\|[ ]*)?" + VAR_IDENT_RE }]
        },
        {
          begin: "#\\(",
          end: "\\)",
          contains: [
            hljs.APOS_STRING_MODE,
            CHAR,
            hljs.C_NUMBER_MODE,
            SYMBOL
          ]
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/sql.js
  function sql(hljs) {
    const regex = hljs.regex;
    const COMMENT_MODE = hljs.COMMENT("--", "$");
    const STRING = {
      scope: "string",
      variants: [
        {
          begin: /'/,
          end: /'/,
          contains: [{ match: /''/ }]
        }
      ]
    };
    const QUOTED_IDENTIFIER = {
      begin: /"/,
      end: /"/,
      contains: [{ match: /""/ }]
    };
    const LITERALS3 = [
      "true",
      "false",
      // Not sure it's correct to call NULL literal, and clauses like IS [NOT] NULL look strange that way.
      // "null",
      "unknown"
    ];
    const MULTI_WORD_TYPES = [
      "double precision",
      "large object",
      "with timezone",
      "without timezone"
    ];
    const TYPES3 = [
      "bigint",
      "binary",
      "blob",
      "boolean",
      "char",
      "character",
      "clob",
      "date",
      "dec",
      "decfloat",
      "decimal",
      "float",
      "int",
      "integer",
      "interval",
      "nchar",
      "nclob",
      "national",
      "numeric",
      "real",
      "row",
      "smallint",
      "time",
      "timestamp",
      "varchar",
      "varying",
      // modifier (character varying)
      "varbinary"
    ];
    const NON_RESERVED_WORDS = [
      "add",
      "asc",
      "collation",
      "desc",
      "final",
      "first",
      "last",
      "view"
    ];
    const RESERVED_WORDS = [
      "abs",
      "acos",
      "all",
      "allocate",
      "alter",
      "and",
      "any",
      "are",
      "array",
      "array_agg",
      "array_max_cardinality",
      "as",
      "asensitive",
      "asin",
      "asymmetric",
      "at",
      "atan",
      "atomic",
      "authorization",
      "avg",
      "begin",
      "begin_frame",
      "begin_partition",
      "between",
      "bigint",
      "binary",
      "blob",
      "boolean",
      "both",
      "by",
      "call",
      "called",
      "cardinality",
      "cascaded",
      "case",
      "cast",
      "ceil",
      "ceiling",
      "char",
      "char_length",
      "character",
      "character_length",
      "check",
      "classifier",
      "clob",
      "close",
      "coalesce",
      "collate",
      "collect",
      "column",
      "commit",
      "condition",
      "connect",
      "constraint",
      "contains",
      "convert",
      "copy",
      "corr",
      "corresponding",
      "cos",
      "cosh",
      "count",
      "covar_pop",
      "covar_samp",
      "create",
      "cross",
      "cube",
      "cume_dist",
      "current",
      "current_catalog",
      "current_date",
      "current_default_transform_group",
      "current_path",
      "current_role",
      "current_row",
      "current_schema",
      "current_time",
      "current_timestamp",
      "current_path",
      "current_role",
      "current_transform_group_for_type",
      "current_user",
      "cursor",
      "cycle",
      "date",
      "day",
      "deallocate",
      "dec",
      "decimal",
      "decfloat",
      "declare",
      "default",
      "define",
      "delete",
      "dense_rank",
      "deref",
      "describe",
      "deterministic",
      "disconnect",
      "distinct",
      "double",
      "drop",
      "dynamic",
      "each",
      "element",
      "else",
      "empty",
      "end",
      "end_frame",
      "end_partition",
      "end-exec",
      "equals",
      "escape",
      "every",
      "except",
      "exec",
      "execute",
      "exists",
      "exp",
      "external",
      "extract",
      "false",
      "fetch",
      "filter",
      "first_value",
      "float",
      "floor",
      "for",
      "foreign",
      "frame_row",
      "free",
      "from",
      "full",
      "function",
      "fusion",
      "get",
      "global",
      "grant",
      "group",
      "grouping",
      "groups",
      "having",
      "hold",
      "hour",
      "identity",
      "in",
      "indicator",
      "initial",
      "inner",
      "inout",
      "insensitive",
      "insert",
      "int",
      "integer",
      "intersect",
      "intersection",
      "interval",
      "into",
      "is",
      "join",
      "json_array",
      "json_arrayagg",
      "json_exists",
      "json_object",
      "json_objectagg",
      "json_query",
      "json_table",
      "json_table_primitive",
      "json_value",
      "lag",
      "language",
      "large",
      "last_value",
      "lateral",
      "lead",
      "leading",
      "left",
      "like",
      "like_regex",
      "listagg",
      "ln",
      "local",
      "localtime",
      "localtimestamp",
      "log",
      "log10",
      "lower",
      "match",
      "match_number",
      "match_recognize",
      "matches",
      "max",
      "member",
      "merge",
      "method",
      "min",
      "minute",
      "mod",
      "modifies",
      "module",
      "month",
      "multiset",
      "national",
      "natural",
      "nchar",
      "nclob",
      "new",
      "no",
      "none",
      "normalize",
      "not",
      "nth_value",
      "ntile",
      "null",
      "nullif",
      "numeric",
      "octet_length",
      "occurrences_regex",
      "of",
      "offset",
      "old",
      "omit",
      "on",
      "one",
      "only",
      "open",
      "or",
      "order",
      "out",
      "outer",
      "over",
      "overlaps",
      "overlay",
      "parameter",
      "partition",
      "pattern",
      "per",
      "percent",
      "percent_rank",
      "percentile_cont",
      "percentile_disc",
      "period",
      "portion",
      "position",
      "position_regex",
      "power",
      "precedes",
      "precision",
      "prepare",
      "primary",
      "procedure",
      "ptf",
      "range",
      "rank",
      "reads",
      "real",
      "recursive",
      "ref",
      "references",
      "referencing",
      "regr_avgx",
      "regr_avgy",
      "regr_count",
      "regr_intercept",
      "regr_r2",
      "regr_slope",
      "regr_sxx",
      "regr_sxy",
      "regr_syy",
      "release",
      "result",
      "return",
      "returns",
      "revoke",
      "right",
      "rollback",
      "rollup",
      "row",
      "row_number",
      "rows",
      "running",
      "savepoint",
      "scope",
      "scroll",
      "search",
      "second",
      "seek",
      "select",
      "sensitive",
      "session_user",
      "set",
      "show",
      "similar",
      "sin",
      "sinh",
      "skip",
      "smallint",
      "some",
      "specific",
      "specifictype",
      "sql",
      "sqlexception",
      "sqlstate",
      "sqlwarning",
      "sqrt",
      "start",
      "static",
      "stddev_pop",
      "stddev_samp",
      "submultiset",
      "subset",
      "substring",
      "substring_regex",
      "succeeds",
      "sum",
      "symmetric",
      "system",
      "system_time",
      "system_user",
      "table",
      "tablesample",
      "tan",
      "tanh",
      "then",
      "time",
      "timestamp",
      "timezone_hour",
      "timezone_minute",
      "to",
      "trailing",
      "translate",
      "translate_regex",
      "translation",
      "treat",
      "trigger",
      "trim",
      "trim_array",
      "true",
      "truncate",
      "uescape",
      "union",
      "unique",
      "unknown",
      "unnest",
      "update",
      "upper",
      "user",
      "using",
      "value",
      "values",
      "value_of",
      "var_pop",
      "var_samp",
      "varbinary",
      "varchar",
      "varying",
      "versioning",
      "when",
      "whenever",
      "where",
      "width_bucket",
      "window",
      "with",
      "within",
      "without",
      "year"
    ];
    const RESERVED_FUNCTIONS = [
      "abs",
      "acos",
      "array_agg",
      "asin",
      "atan",
      "avg",
      "cast",
      "ceil",
      "ceiling",
      "coalesce",
      "corr",
      "cos",
      "cosh",
      "count",
      "covar_pop",
      "covar_samp",
      "cume_dist",
      "dense_rank",
      "deref",
      "element",
      "exp",
      "extract",
      "first_value",
      "floor",
      "json_array",
      "json_arrayagg",
      "json_exists",
      "json_object",
      "json_objectagg",
      "json_query",
      "json_table",
      "json_table_primitive",
      "json_value",
      "lag",
      "last_value",
      "lead",
      "listagg",
      "ln",
      "log",
      "log10",
      "lower",
      "max",
      "min",
      "mod",
      "nth_value",
      "ntile",
      "nullif",
      "percent_rank",
      "percentile_cont",
      "percentile_disc",
      "position",
      "position_regex",
      "power",
      "rank",
      "regr_avgx",
      "regr_avgy",
      "regr_count",
      "regr_intercept",
      "regr_r2",
      "regr_slope",
      "regr_sxx",
      "regr_sxy",
      "regr_syy",
      "row_number",
      "sin",
      "sinh",
      "sqrt",
      "stddev_pop",
      "stddev_samp",
      "substring",
      "substring_regex",
      "sum",
      "tan",
      "tanh",
      "translate",
      "translate_regex",
      "treat",
      "trim",
      "trim_array",
      "unnest",
      "upper",
      "value_of",
      "var_pop",
      "var_samp",
      "width_bucket"
    ];
    const POSSIBLE_WITHOUT_PARENS = [
      "current_catalog",
      "current_date",
      "current_default_transform_group",
      "current_path",
      "current_role",
      "current_schema",
      "current_transform_group_for_type",
      "current_user",
      "session_user",
      "system_time",
      "system_user",
      "current_time",
      "localtime",
      "current_timestamp",
      "localtimestamp"
    ];
    const COMBOS = [
      "create table",
      "insert into",
      "primary key",
      "foreign key",
      "not null",
      "alter table",
      "add constraint",
      "grouping sets",
      "on overflow",
      "character set",
      "respect nulls",
      "ignore nulls",
      "nulls first",
      "nulls last",
      "depth first",
      "breadth first"
    ];
    const FUNCTIONS = RESERVED_FUNCTIONS;
    const KEYWORDS3 = [
      ...RESERVED_WORDS,
      ...NON_RESERVED_WORDS
    ].filter((keyword) => {
      return !RESERVED_FUNCTIONS.includes(keyword);
    });
    const VARIABLE = {
      scope: "variable",
      match: /@[a-z0-9][a-z0-9_]*/
    };
    const OPERATOR = {
      scope: "operator",
      match: /[-+*/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?/,
      relevance: 0
    };
    const FUNCTION_CALL = {
      match: regex.concat(/\b/, regex.either(...FUNCTIONS), /\s*\(/),
      relevance: 0,
      keywords: { built_in: FUNCTIONS }
    };
    function kws_to_regex(list) {
      return regex.concat(
        /\b/,
        regex.either(...list.map((kw) => {
          return kw.replace(/\s+/, "\\s+");
        })),
        /\b/
      );
    }
    const MULTI_WORD_KEYWORDS = {
      scope: "keyword",
      match: kws_to_regex(COMBOS),
      relevance: 0
    };
    function reduceRelevancy(list, {
      exceptions,
      when
    } = {}) {
      const qualifyFn = when;
      exceptions = exceptions || [];
      return list.map((item) => {
        if (item.match(/\|\d+$/) || exceptions.includes(item)) {
          return item;
        } else if (qualifyFn(item)) {
          return `${item}|0`;
        } else {
          return item;
        }
      });
    }
    return {
      name: "SQL",
      case_insensitive: true,
      // does not include {} or HTML tags `</`
      illegal: /[{}]|<\//,
      keywords: {
        $pattern: /\b[\w\.]+/,
        keyword: reduceRelevancy(KEYWORDS3, { when: (x) => x.length < 3 }),
        literal: LITERALS3,
        type: TYPES3,
        built_in: POSSIBLE_WITHOUT_PARENS
      },
      contains: [
        {
          scope: "type",
          match: kws_to_regex(MULTI_WORD_TYPES)
        },
        MULTI_WORD_KEYWORDS,
        FUNCTION_CALL,
        VARIABLE,
        STRING,
        QUOTED_IDENTIFIER,
        hljs.C_NUMBER_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        COMMENT_MODE,
        OPERATOR
      ]
    };
  }

  // node_modules/highlight.js/es/languages/stylus.js
  var MODES4 = (hljs) => {
    return {
      IMPORTANT: {
        scope: "meta",
        begin: "!important"
      },
      BLOCK_COMMENT: hljs.C_BLOCK_COMMENT_MODE,
      HEXCOLOR: {
        scope: "number",
        begin: /#(([0-9a-fA-F]{3,4})|(([0-9a-fA-F]{2}){3,4}))\b/
      },
      FUNCTION_DISPATCH: {
        className: "built_in",
        begin: /[\w-]+(?=\()/
      },
      ATTRIBUTE_SELECTOR_MODE: {
        scope: "selector-attr",
        begin: /\[/,
        end: /\]/,
        illegal: "$",
        contains: [
          hljs.APOS_STRING_MODE,
          hljs.QUOTE_STRING_MODE
        ]
      },
      CSS_NUMBER_MODE: {
        scope: "number",
        begin: hljs.NUMBER_RE + "(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)?",
        relevance: 0
      },
      CSS_VARIABLE: {
        className: "attr",
        begin: /--[A-Za-z_][A-Za-z0-9_-]*/
      }
    };
  };
  var HTML_TAGS4 = [
    "a",
    "abbr",
    "address",
    "article",
    "aside",
    "audio",
    "b",
    "blockquote",
    "body",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "dd",
    "del",
    "details",
    "dfn",
    "div",
    "dl",
    "dt",
    "em",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "main",
    "mark",
    "menu",
    "nav",
    "object",
    "ol",
    "optgroup",
    "option",
    "p",
    "picture",
    "q",
    "quote",
    "samp",
    "section",
    "select",
    "source",
    "span",
    "strong",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "tr",
    "ul",
    "var",
    "video"
  ];
  var SVG_TAGS4 = [
    "defs",
    "g",
    "marker",
    "mask",
    "pattern",
    "svg",
    "switch",
    "symbol",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feFlood",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMorphology",
    "feOffset",
    "feSpecularLighting",
    "feTile",
    "feTurbulence",
    "linearGradient",
    "radialGradient",
    "stop",
    "circle",
    "ellipse",
    "image",
    "line",
    "path",
    "polygon",
    "polyline",
    "rect",
    "text",
    "use",
    "textPath",
    "tspan",
    "foreignObject",
    "clipPath"
  ];
  var TAGS4 = [
    ...HTML_TAGS4,
    ...SVG_TAGS4
  ];
  var MEDIA_FEATURES4 = [
    "any-hover",
    "any-pointer",
    "aspect-ratio",
    "color",
    "color-gamut",
    "color-index",
    "device-aspect-ratio",
    "device-height",
    "device-width",
    "display-mode",
    "forced-colors",
    "grid",
    "height",
    "hover",
    "inverted-colors",
    "monochrome",
    "orientation",
    "overflow-block",
    "overflow-inline",
    "pointer",
    "prefers-color-scheme",
    "prefers-contrast",
    "prefers-reduced-motion",
    "prefers-reduced-transparency",
    "resolution",
    "scan",
    "scripting",
    "update",
    "width",
    // TODO: find a better solution?
    "min-width",
    "max-width",
    "min-height",
    "max-height"
  ].sort().reverse();
  var PSEUDO_CLASSES4 = [
    "active",
    "any-link",
    "blank",
    "checked",
    "current",
    "default",
    "defined",
    "dir",
    // dir()
    "disabled",
    "drop",
    "empty",
    "enabled",
    "first",
    "first-child",
    "first-of-type",
    "fullscreen",
    "future",
    "focus",
    "focus-visible",
    "focus-within",
    "has",
    // has()
    "host",
    // host or host()
    "host-context",
    // host-context()
    "hover",
    "indeterminate",
    "in-range",
    "invalid",
    "is",
    // is()
    "lang",
    // lang()
    "last-child",
    "last-of-type",
    "left",
    "link",
    "local-link",
    "not",
    // not()
    "nth-child",
    // nth-child()
    "nth-col",
    // nth-col()
    "nth-last-child",
    // nth-last-child()
    "nth-last-col",
    // nth-last-col()
    "nth-last-of-type",
    //nth-last-of-type()
    "nth-of-type",
    //nth-of-type()
    "only-child",
    "only-of-type",
    "optional",
    "out-of-range",
    "past",
    "placeholder-shown",
    "read-only",
    "read-write",
    "required",
    "right",
    "root",
    "scope",
    "target",
    "target-within",
    "user-invalid",
    "valid",
    "visited",
    "where"
    // where()
  ].sort().reverse();
  var PSEUDO_ELEMENTS4 = [
    "after",
    "backdrop",
    "before",
    "cue",
    "cue-region",
    "first-letter",
    "first-line",
    "grammar-error",
    "marker",
    "part",
    "placeholder",
    "selection",
    "slotted",
    "spelling-error"
  ].sort().reverse();
  var ATTRIBUTES4 = [
    "accent-color",
    "align-content",
    "align-items",
    "align-self",
    "alignment-baseline",
    "all",
    "anchor-name",
    "animation",
    "animation-composition",
    "animation-delay",
    "animation-direction",
    "animation-duration",
    "animation-fill-mode",
    "animation-iteration-count",
    "animation-name",
    "animation-play-state",
    "animation-range",
    "animation-range-end",
    "animation-range-start",
    "animation-timeline",
    "animation-timing-function",
    "appearance",
    "aspect-ratio",
    "backdrop-filter",
    "backface-visibility",
    "background",
    "background-attachment",
    "background-blend-mode",
    "background-clip",
    "background-color",
    "background-image",
    "background-origin",
    "background-position",
    "background-position-x",
    "background-position-y",
    "background-repeat",
    "background-size",
    "baseline-shift",
    "block-size",
    "border",
    "border-block",
    "border-block-color",
    "border-block-end",
    "border-block-end-color",
    "border-block-end-style",
    "border-block-end-width",
    "border-block-start",
    "border-block-start-color",
    "border-block-start-style",
    "border-block-start-width",
    "border-block-style",
    "border-block-width",
    "border-bottom",
    "border-bottom-color",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "border-bottom-style",
    "border-bottom-width",
    "border-collapse",
    "border-color",
    "border-end-end-radius",
    "border-end-start-radius",
    "border-image",
    "border-image-outset",
    "border-image-repeat",
    "border-image-slice",
    "border-image-source",
    "border-image-width",
    "border-inline",
    "border-inline-color",
    "border-inline-end",
    "border-inline-end-color",
    "border-inline-end-style",
    "border-inline-end-width",
    "border-inline-start",
    "border-inline-start-color",
    "border-inline-start-style",
    "border-inline-start-width",
    "border-inline-style",
    "border-inline-width",
    "border-left",
    "border-left-color",
    "border-left-style",
    "border-left-width",
    "border-radius",
    "border-right",
    "border-right-color",
    "border-right-style",
    "border-right-width",
    "border-spacing",
    "border-start-end-radius",
    "border-start-start-radius",
    "border-style",
    "border-top",
    "border-top-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-top-style",
    "border-top-width",
    "border-width",
    "bottom",
    "box-align",
    "box-decoration-break",
    "box-direction",
    "box-flex",
    "box-flex-group",
    "box-lines",
    "box-ordinal-group",
    "box-orient",
    "box-pack",
    "box-shadow",
    "box-sizing",
    "break-after",
    "break-before",
    "break-inside",
    "caption-side",
    "caret-color",
    "clear",
    "clip",
    "clip-path",
    "clip-rule",
    "color",
    "color-interpolation",
    "color-interpolation-filters",
    "color-profile",
    "color-rendering",
    "color-scheme",
    "column-count",
    "column-fill",
    "column-gap",
    "column-rule",
    "column-rule-color",
    "column-rule-style",
    "column-rule-width",
    "column-span",
    "column-width",
    "columns",
    "contain",
    "contain-intrinsic-block-size",
    "contain-intrinsic-height",
    "contain-intrinsic-inline-size",
    "contain-intrinsic-size",
    "contain-intrinsic-width",
    "container",
    "container-name",
    "container-type",
    "content",
    "content-visibility",
    "counter-increment",
    "counter-reset",
    "counter-set",
    "cue",
    "cue-after",
    "cue-before",
    "cursor",
    "cx",
    "cy",
    "direction",
    "display",
    "dominant-baseline",
    "empty-cells",
    "enable-background",
    "field-sizing",
    "fill",
    "fill-opacity",
    "fill-rule",
    "filter",
    "flex",
    "flex-basis",
    "flex-direction",
    "flex-flow",
    "flex-grow",
    "flex-shrink",
    "flex-wrap",
    "float",
    "flood-color",
    "flood-opacity",
    "flow",
    "font",
    "font-display",
    "font-family",
    "font-feature-settings",
    "font-kerning",
    "font-language-override",
    "font-optical-sizing",
    "font-palette",
    "font-size",
    "font-size-adjust",
    "font-smooth",
    "font-smoothing",
    "font-stretch",
    "font-style",
    "font-synthesis",
    "font-synthesis-position",
    "font-synthesis-small-caps",
    "font-synthesis-style",
    "font-synthesis-weight",
    "font-variant",
    "font-variant-alternates",
    "font-variant-caps",
    "font-variant-east-asian",
    "font-variant-emoji",
    "font-variant-ligatures",
    "font-variant-numeric",
    "font-variant-position",
    "font-variation-settings",
    "font-weight",
    "forced-color-adjust",
    "gap",
    "glyph-orientation-horizontal",
    "glyph-orientation-vertical",
    "grid",
    "grid-area",
    "grid-auto-columns",
    "grid-auto-flow",
    "grid-auto-rows",
    "grid-column",
    "grid-column-end",
    "grid-column-start",
    "grid-gap",
    "grid-row",
    "grid-row-end",
    "grid-row-start",
    "grid-template",
    "grid-template-areas",
    "grid-template-columns",
    "grid-template-rows",
    "hanging-punctuation",
    "height",
    "hyphenate-character",
    "hyphenate-limit-chars",
    "hyphens",
    "icon",
    "image-orientation",
    "image-rendering",
    "image-resolution",
    "ime-mode",
    "initial-letter",
    "initial-letter-align",
    "inline-size",
    "inset",
    "inset-area",
    "inset-block",
    "inset-block-end",
    "inset-block-start",
    "inset-inline",
    "inset-inline-end",
    "inset-inline-start",
    "isolation",
    "justify-content",
    "justify-items",
    "justify-self",
    "kerning",
    "left",
    "letter-spacing",
    "lighting-color",
    "line-break",
    "line-height",
    "line-height-step",
    "list-style",
    "list-style-image",
    "list-style-position",
    "list-style-type",
    "margin",
    "margin-block",
    "margin-block-end",
    "margin-block-start",
    "margin-bottom",
    "margin-inline",
    "margin-inline-end",
    "margin-inline-start",
    "margin-left",
    "margin-right",
    "margin-top",
    "margin-trim",
    "marker",
    "marker-end",
    "marker-mid",
    "marker-start",
    "marks",
    "mask",
    "mask-border",
    "mask-border-mode",
    "mask-border-outset",
    "mask-border-repeat",
    "mask-border-slice",
    "mask-border-source",
    "mask-border-width",
    "mask-clip",
    "mask-composite",
    "mask-image",
    "mask-mode",
    "mask-origin",
    "mask-position",
    "mask-repeat",
    "mask-size",
    "mask-type",
    "masonry-auto-flow",
    "math-depth",
    "math-shift",
    "math-style",
    "max-block-size",
    "max-height",
    "max-inline-size",
    "max-width",
    "min-block-size",
    "min-height",
    "min-inline-size",
    "min-width",
    "mix-blend-mode",
    "nav-down",
    "nav-index",
    "nav-left",
    "nav-right",
    "nav-up",
    "none",
    "normal",
    "object-fit",
    "object-position",
    "offset",
    "offset-anchor",
    "offset-distance",
    "offset-path",
    "offset-position",
    "offset-rotate",
    "opacity",
    "order",
    "orphans",
    "outline",
    "outline-color",
    "outline-offset",
    "outline-style",
    "outline-width",
    "overflow",
    "overflow-anchor",
    "overflow-block",
    "overflow-clip-margin",
    "overflow-inline",
    "overflow-wrap",
    "overflow-x",
    "overflow-y",
    "overlay",
    "overscroll-behavior",
    "overscroll-behavior-block",
    "overscroll-behavior-inline",
    "overscroll-behavior-x",
    "overscroll-behavior-y",
    "padding",
    "padding-block",
    "padding-block-end",
    "padding-block-start",
    "padding-bottom",
    "padding-inline",
    "padding-inline-end",
    "padding-inline-start",
    "padding-left",
    "padding-right",
    "padding-top",
    "page",
    "page-break-after",
    "page-break-before",
    "page-break-inside",
    "paint-order",
    "pause",
    "pause-after",
    "pause-before",
    "perspective",
    "perspective-origin",
    "place-content",
    "place-items",
    "place-self",
    "pointer-events",
    "position",
    "position-anchor",
    "position-visibility",
    "print-color-adjust",
    "quotes",
    "r",
    "resize",
    "rest",
    "rest-after",
    "rest-before",
    "right",
    "rotate",
    "row-gap",
    "ruby-align",
    "ruby-position",
    "scale",
    "scroll-behavior",
    "scroll-margin",
    "scroll-margin-block",
    "scroll-margin-block-end",
    "scroll-margin-block-start",
    "scroll-margin-bottom",
    "scroll-margin-inline",
    "scroll-margin-inline-end",
    "scroll-margin-inline-start",
    "scroll-margin-left",
    "scroll-margin-right",
    "scroll-margin-top",
    "scroll-padding",
    "scroll-padding-block",
    "scroll-padding-block-end",
    "scroll-padding-block-start",
    "scroll-padding-bottom",
    "scroll-padding-inline",
    "scroll-padding-inline-end",
    "scroll-padding-inline-start",
    "scroll-padding-left",
    "scroll-padding-right",
    "scroll-padding-top",
    "scroll-snap-align",
    "scroll-snap-stop",
    "scroll-snap-type",
    "scroll-timeline",
    "scroll-timeline-axis",
    "scroll-timeline-name",
    "scrollbar-color",
    "scrollbar-gutter",
    "scrollbar-width",
    "shape-image-threshold",
    "shape-margin",
    "shape-outside",
    "shape-rendering",
    "speak",
    "speak-as",
    "src",
    // @font-face
    "stop-color",
    "stop-opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "stroke-width",
    "tab-size",
    "table-layout",
    "text-align",
    "text-align-all",
    "text-align-last",
    "text-anchor",
    "text-combine-upright",
    "text-decoration",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-skip",
    "text-decoration-skip-ink",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-emphasis",
    "text-emphasis-color",
    "text-emphasis-position",
    "text-emphasis-style",
    "text-indent",
    "text-justify",
    "text-orientation",
    "text-overflow",
    "text-rendering",
    "text-shadow",
    "text-size-adjust",
    "text-transform",
    "text-underline-offset",
    "text-underline-position",
    "text-wrap",
    "text-wrap-mode",
    "text-wrap-style",
    "timeline-scope",
    "top",
    "touch-action",
    "transform",
    "transform-box",
    "transform-origin",
    "transform-style",
    "transition",
    "transition-behavior",
    "transition-delay",
    "transition-duration",
    "transition-property",
    "transition-timing-function",
    "translate",
    "unicode-bidi",
    "user-modify",
    "user-select",
    "vector-effect",
    "vertical-align",
    "view-timeline",
    "view-timeline-axis",
    "view-timeline-inset",
    "view-timeline-name",
    "view-transition-name",
    "visibility",
    "voice-balance",
    "voice-duration",
    "voice-family",
    "voice-pitch",
    "voice-range",
    "voice-rate",
    "voice-stress",
    "voice-volume",
    "white-space",
    "white-space-collapse",
    "widows",
    "width",
    "will-change",
    "word-break",
    "word-spacing",
    "word-wrap",
    "writing-mode",
    "x",
    "y",
    "z-index",
    "zoom"
  ].sort().reverse();
  function stylus(hljs) {
    const modes = MODES4(hljs);
    const AT_MODIFIERS = "and or not only";
    const VARIABLE = {
      className: "variable",
      begin: "\\$" + hljs.IDENT_RE
    };
    const AT_KEYWORDS = [
      "charset",
      "css",
      "debug",
      "extend",
      "font-face",
      "for",
      "import",
      "include",
      "keyframes",
      "media",
      "mixin",
      "page",
      "warn",
      "while"
    ];
    const LOOKAHEAD_TAG_END = "(?=[.\\s\\n[:,(])";
    const ILLEGAL = [
      "\\?",
      "(\\bReturn\\b)",
      // monkey
      "(\\bEnd\\b)",
      // monkey
      "(\\bend\\b)",
      // vbscript
      "(\\bdef\\b)",
      // gradle
      ";",
      // a whole lot of languages
      "#\\s",
      // markdown
      "\\*\\s",
      // markdown
      "===\\s",
      // markdown
      "\\|",
      "%"
      // prolog
    ];
    return {
      name: "Stylus",
      aliases: ["styl"],
      case_insensitive: false,
      keywords: "if else for in",
      illegal: "(" + ILLEGAL.join("|") + ")",
      contains: [
        // strings
        hljs.QUOTE_STRING_MODE,
        hljs.APOS_STRING_MODE,
        // comments
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        // hex colors
        modes.HEXCOLOR,
        // class tag
        {
          begin: "\\.[a-zA-Z][a-zA-Z0-9_-]*" + LOOKAHEAD_TAG_END,
          className: "selector-class"
        },
        // id tag
        {
          begin: "#[a-zA-Z][a-zA-Z0-9_-]*" + LOOKAHEAD_TAG_END,
          className: "selector-id"
        },
        // tags
        {
          begin: "\\b(" + TAGS4.join("|") + ")" + LOOKAHEAD_TAG_END,
          className: "selector-tag"
        },
        // psuedo selectors
        {
          className: "selector-pseudo",
          begin: "&?:(" + PSEUDO_CLASSES4.join("|") + ")" + LOOKAHEAD_TAG_END
        },
        {
          className: "selector-pseudo",
          begin: "&?:(:)?(" + PSEUDO_ELEMENTS4.join("|") + ")" + LOOKAHEAD_TAG_END
        },
        modes.ATTRIBUTE_SELECTOR_MODE,
        {
          className: "keyword",
          begin: /@media/,
          starts: {
            end: /[{;}]/,
            keywords: {
              $pattern: /[a-z-]+/,
              keyword: AT_MODIFIERS,
              attribute: MEDIA_FEATURES4.join(" ")
            },
            contains: [modes.CSS_NUMBER_MODE]
          }
        },
        // @ keywords
        {
          className: "keyword",
          begin: "@((-(o|moz|ms|webkit)-)?(" + AT_KEYWORDS.join("|") + "))\\b"
        },
        // variables
        VARIABLE,
        // dimension
        modes.CSS_NUMBER_MODE,
        // functions
        //  - only from beginning of line + whitespace
        {
          className: "function",
          begin: "^[a-zA-Z][a-zA-Z0-9_-]*\\(.*\\)",
          illegal: "[\\n]",
          returnBegin: true,
          contains: [
            {
              className: "title",
              begin: "\\b[a-zA-Z][a-zA-Z0-9_-]*"
            },
            {
              className: "params",
              begin: /\(/,
              end: /\)/,
              contains: [
                modes.HEXCOLOR,
                VARIABLE,
                hljs.APOS_STRING_MODE,
                modes.CSS_NUMBER_MODE,
                hljs.QUOTE_STRING_MODE
              ]
            }
          ]
        },
        // css variables
        modes.CSS_VARIABLE,
        // attributes
        //  - only from beginning of line + whitespace
        //  - must have whitespace after it
        {
          className: "attribute",
          begin: "\\b(" + ATTRIBUTES4.join("|") + ")\\b",
          starts: {
            // value container
            end: /;|$/,
            contains: [
              modes.HEXCOLOR,
              VARIABLE,
              hljs.APOS_STRING_MODE,
              hljs.QUOTE_STRING_MODE,
              modes.CSS_NUMBER_MODE,
              hljs.C_BLOCK_COMMENT_MODE,
              modes.IMPORTANT,
              modes.FUNCTION_DISPATCH
            ],
            illegal: /\./,
            relevance: 0
          }
        },
        modes.FUNCTION_DISPATCH
      ]
    };
  }

  // node_modules/highlight.js/es/languages/swift.js
  function source2(re) {
    if (!re) return null;
    if (typeof re === "string") return re;
    return re.source;
  }
  function lookahead2(re) {
    return concat2("(?=", re, ")");
  }
  function concat2(...args) {
    const joined = args.map((x) => source2(x)).join("");
    return joined;
  }
  function stripOptionsFromArgs2(args) {
    const opts = args[args.length - 1];
    if (typeof opts === "object" && opts.constructor === Object) {
      args.splice(args.length - 1, 1);
      return opts;
    } else {
      return {};
    }
  }
  function either2(...args) {
    const opts = stripOptionsFromArgs2(args);
    const joined = "(" + (opts.capture ? "" : "?:") + args.map((x) => source2(x)).join("|") + ")";
    return joined;
  }
  var keywordWrapper = (keyword) => concat2(
    /\b/,
    keyword,
    /\w$/.test(keyword) ? /\b/ : /\B/
  );
  var dotKeywords = [
    "Protocol",
    // contextual
    "Type"
    // contextual
  ].map(keywordWrapper);
  var optionalDotKeywords = [
    "init",
    "self"
  ].map(keywordWrapper);
  var keywordTypes = [
    "Any",
    "Self"
  ];
  var keywords = [
    // strings below will be fed into the regular `keywords` engine while regex
    // will result in additional modes being created to scan for those keywords to
    // avoid conflicts with other rules
    "actor",
    "any",
    // contextual
    "associatedtype",
    "async",
    "await",
    /as\?/,
    // operator
    /as!/,
    // operator
    "as",
    // operator
    "borrowing",
    // contextual
    "break",
    "case",
    "catch",
    "class",
    "consume",
    // contextual
    "consuming",
    // contextual
    "continue",
    "convenience",
    // contextual
    "copy",
    // contextual
    "default",
    "defer",
    "deinit",
    "didSet",
    // contextual
    "distributed",
    "do",
    "dynamic",
    // contextual
    "each",
    "else",
    "enum",
    "extension",
    "fallthrough",
    /fileprivate\(set\)/,
    "fileprivate",
    "final",
    // contextual
    "for",
    "func",
    "get",
    // contextual
    "guard",
    "if",
    "import",
    "indirect",
    // contextual
    "infix",
    // contextual
    /init\?/,
    /init!/,
    "inout",
    /internal\(set\)/,
    "internal",
    "in",
    "is",
    // operator
    "isolated",
    // contextual
    "nonisolated",
    // contextual
    "lazy",
    // contextual
    "let",
    "macro",
    "mutating",
    // contextual
    "nonmutating",
    // contextual
    /open\(set\)/,
    // contextual
    "open",
    // contextual
    "operator",
    "optional",
    // contextual
    "override",
    // contextual
    "package",
    "postfix",
    // contextual
    "precedencegroup",
    "prefix",
    // contextual
    /private\(set\)/,
    "private",
    "protocol",
    /public\(set\)/,
    "public",
    "repeat",
    "required",
    // contextual
    "rethrows",
    "return",
    "set",
    // contextual
    "some",
    // contextual
    "static",
    "struct",
    "subscript",
    "super",
    "switch",
    "throws",
    "throw",
    /try\?/,
    // operator
    /try!/,
    // operator
    "try",
    // operator
    "typealias",
    /unowned\(safe\)/,
    // contextual
    /unowned\(unsafe\)/,
    // contextual
    "unowned",
    // contextual
    "var",
    "weak",
    // contextual
    "where",
    "while",
    "willSet"
    // contextual
  ];
  var literals = [
    "false",
    "nil",
    "true"
  ];
  var precedencegroupKeywords = [
    "assignment",
    "associativity",
    "higherThan",
    "left",
    "lowerThan",
    "none",
    "right"
  ];
  var numberSignKeywords = [
    "#colorLiteral",
    "#column",
    "#dsohandle",
    "#else",
    "#elseif",
    "#endif",
    "#error",
    "#file",
    "#fileID",
    "#fileLiteral",
    "#filePath",
    "#function",
    "#if",
    "#imageLiteral",
    "#keyPath",
    "#line",
    "#selector",
    "#sourceLocation",
    "#warning"
  ];
  var builtIns = [
    "abs",
    "all",
    "any",
    "assert",
    "assertionFailure",
    "debugPrint",
    "dump",
    "fatalError",
    "getVaList",
    "isKnownUniquelyReferenced",
    "max",
    "min",
    "numericCast",
    "pointwiseMax",
    "pointwiseMin",
    "precondition",
    "preconditionFailure",
    "print",
    "readLine",
    "repeatElement",
    "sequence",
    "stride",
    "swap",
    "swift_unboxFromSwiftValueWithType",
    "transcode",
    "type",
    "unsafeBitCast",
    "unsafeDowncast",
    "withExtendedLifetime",
    "withUnsafeMutablePointer",
    "withUnsafePointer",
    "withVaList",
    "withoutActuallyEscaping",
    "zip"
  ];
  var operatorHead = either2(
    /[/=\-+!*%<>&|^~?]/,
    /[\u00A1-\u00A7]/,
    /[\u00A9\u00AB]/,
    /[\u00AC\u00AE]/,
    /[\u00B0\u00B1]/,
    /[\u00B6\u00BB\u00BF\u00D7\u00F7]/,
    /[\u2016-\u2017]/,
    /[\u2020-\u2027]/,
    /[\u2030-\u203E]/,
    /[\u2041-\u2053]/,
    /[\u2055-\u205E]/,
    /[\u2190-\u23FF]/,
    /[\u2500-\u2775]/,
    /[\u2794-\u2BFF]/,
    /[\u2E00-\u2E7F]/,
    /[\u3001-\u3003]/,
    /[\u3008-\u3020]/,
    /[\u3030]/
  );
  var operatorCharacter = either2(
    operatorHead,
    /[\u0300-\u036F]/,
    /[\u1DC0-\u1DFF]/,
    /[\u20D0-\u20FF]/,
    /[\uFE00-\uFE0F]/,
    /[\uFE20-\uFE2F]/
    // TODO: The following characters are also allowed, but the regex isn't supported yet.
    // /[\u{E0100}-\u{E01EF}]/u
  );
  var operator = concat2(operatorHead, operatorCharacter, "*");
  var identifierHead = either2(
    /[a-zA-Z_]/,
    /[\u00A8\u00AA\u00AD\u00AF\u00B2-\u00B5\u00B7-\u00BA]/,
    /[\u00BC-\u00BE\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/,
    /[\u0100-\u02FF\u0370-\u167F\u1681-\u180D\u180F-\u1DBF]/,
    /[\u1E00-\u1FFF]/,
    /[\u200B-\u200D\u202A-\u202E\u203F-\u2040\u2054\u2060-\u206F]/,
    /[\u2070-\u20CF\u2100-\u218F\u2460-\u24FF\u2776-\u2793]/,
    /[\u2C00-\u2DFF\u2E80-\u2FFF]/,
    /[\u3004-\u3007\u3021-\u302F\u3031-\u303F\u3040-\uD7FF]/,
    /[\uF900-\uFD3D\uFD40-\uFDCF\uFDF0-\uFE1F\uFE30-\uFE44]/,
    /[\uFE47-\uFEFE\uFF00-\uFFFD]/
    // Should be /[\uFE47-\uFFFD]/, but we have to exclude FEFF.
    // The following characters are also allowed, but the regexes aren't supported yet.
    // /[\u{10000}-\u{1FFFD}\u{20000-\u{2FFFD}\u{30000}-\u{3FFFD}\u{40000}-\u{4FFFD}]/u,
    // /[\u{50000}-\u{5FFFD}\u{60000-\u{6FFFD}\u{70000}-\u{7FFFD}\u{80000}-\u{8FFFD}]/u,
    // /[\u{90000}-\u{9FFFD}\u{A0000-\u{AFFFD}\u{B0000}-\u{BFFFD}\u{C0000}-\u{CFFFD}]/u,
    // /[\u{D0000}-\u{DFFFD}\u{E0000-\u{EFFFD}]/u
  );
  var identifierCharacter = either2(
    identifierHead,
    /\d/,
    /[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/
  );
  var identifier = concat2(identifierHead, identifierCharacter, "*");
  var typeIdentifier = concat2(/[A-Z]/, identifierCharacter, "*");
  var keywordAttributes = [
    "attached",
    "autoclosure",
    concat2(/convention\(/, either2("swift", "block", "c"), /\)/),
    "discardableResult",
    "dynamicCallable",
    "dynamicMemberLookup",
    "escaping",
    "freestanding",
    "frozen",
    "GKInspectable",
    "IBAction",
    "IBDesignable",
    "IBInspectable",
    "IBOutlet",
    "IBSegueAction",
    "inlinable",
    "main",
    "nonobjc",
    "NSApplicationMain",
    "NSCopying",
    "NSManaged",
    concat2(/objc\(/, identifier, /\)/),
    "objc",
    "objcMembers",
    "propertyWrapper",
    "requires_stored_property_inits",
    "resultBuilder",
    "Sendable",
    "testable",
    "UIApplicationMain",
    "unchecked",
    "unknown",
    "usableFromInline",
    "warn_unqualified_access"
  ];
  var availabilityKeywords = [
    "iOS",
    "iOSApplicationExtension",
    "macOS",
    "macOSApplicationExtension",
    "macCatalyst",
    "macCatalystApplicationExtension",
    "watchOS",
    "watchOSApplicationExtension",
    "tvOS",
    "tvOSApplicationExtension",
    "swift"
  ];
  function swift(hljs) {
    const WHITESPACE = {
      match: /\s+/,
      relevance: 0
    };
    const BLOCK_COMMENT = hljs.COMMENT(
      "/\\*",
      "\\*/",
      { contains: ["self"] }
    );
    const COMMENTS = [
      hljs.C_LINE_COMMENT_MODE,
      BLOCK_COMMENT
    ];
    const DOT_KEYWORD = {
      match: [
        /\./,
        either2(...dotKeywords, ...optionalDotKeywords)
      ],
      className: { 2: "keyword" }
    };
    const KEYWORD_GUARD = {
      // Consume .keyword to prevent highlighting properties and methods as keywords.
      match: concat2(/\./, either2(...keywords)),
      relevance: 0
    };
    const PLAIN_KEYWORDS = keywords.filter((kw) => typeof kw === "string").concat(["_|0"]);
    const REGEX_KEYWORDS = keywords.filter((kw) => typeof kw !== "string").concat(keywordTypes).map(keywordWrapper);
    const KEYWORD = { variants: [
      {
        className: "keyword",
        match: either2(...REGEX_KEYWORDS, ...optionalDotKeywords)
      }
    ] };
    const KEYWORDS3 = {
      $pattern: either2(
        /\b\w+/,
        // regular keywords
        /#\w+/
        // number keywords
      ),
      keyword: PLAIN_KEYWORDS.concat(numberSignKeywords),
      literal: literals
    };
    const KEYWORD_MODES = [
      DOT_KEYWORD,
      KEYWORD_GUARD,
      KEYWORD
    ];
    const BUILT_IN_GUARD = {
      // Consume .built_in to prevent highlighting properties and methods.
      match: concat2(/\./, either2(...builtIns)),
      relevance: 0
    };
    const BUILT_IN = {
      className: "built_in",
      match: concat2(/\b/, either2(...builtIns), /(?=\()/)
    };
    const BUILT_INS3 = [
      BUILT_IN_GUARD,
      BUILT_IN
    ];
    const OPERATOR_GUARD = {
      // Prevent -> from being highlighting as an operator.
      match: /->/,
      relevance: 0
    };
    const OPERATOR = {
      className: "operator",
      relevance: 0,
      variants: [
        { match: operator },
        {
          // dot-operator: only operators that start with a dot are allowed to use dots as
          // characters (..., ...<, .*, etc). So there rule here is: a dot followed by one or more
          // characters that may also include dots.
          match: `\\.(\\.|${operatorCharacter})+`
        }
      ]
    };
    const OPERATORS = [
      OPERATOR_GUARD,
      OPERATOR
    ];
    const decimalDigits3 = "([0-9]_*)+";
    const hexDigits3 = "([0-9a-fA-F]_*)+";
    const NUMBER = {
      className: "number",
      relevance: 0,
      variants: [
        // decimal floating-point-literal (subsumes decimal-literal)
        { match: `\\b(${decimalDigits3})(\\.(${decimalDigits3}))?([eE][+-]?(${decimalDigits3}))?\\b` },
        // hexadecimal floating-point-literal (subsumes hexadecimal-literal)
        { match: `\\b0x(${hexDigits3})(\\.(${hexDigits3}))?([pP][+-]?(${decimalDigits3}))?\\b` },
        // octal-literal
        { match: /\b0o([0-7]_*)+\b/ },
        // binary-literal
        { match: /\b0b([01]_*)+\b/ }
      ]
    };
    const ESCAPED_CHARACTER = (rawDelimiter = "") => ({
      className: "subst",
      variants: [
        { match: concat2(/\\/, rawDelimiter, /[0\\tnr"']/) },
        { match: concat2(/\\/, rawDelimiter, /u\{[0-9a-fA-F]{1,8}\}/) }
      ]
    });
    const ESCAPED_NEWLINE = (rawDelimiter = "") => ({
      className: "subst",
      match: concat2(/\\/, rawDelimiter, /[\t ]*(?:[\r\n]|\r\n)/)
    });
    const INTERPOLATION = (rawDelimiter = "") => ({
      className: "subst",
      label: "interpol",
      begin: concat2(/\\/, rawDelimiter, /\(/),
      end: /\)/
    });
    const MULTILINE_STRING = (rawDelimiter = "") => ({
      begin: concat2(rawDelimiter, /"""/),
      end: concat2(/"""/, rawDelimiter),
      contains: [
        ESCAPED_CHARACTER(rawDelimiter),
        ESCAPED_NEWLINE(rawDelimiter),
        INTERPOLATION(rawDelimiter)
      ]
    });
    const SINGLE_LINE_STRING = (rawDelimiter = "") => ({
      begin: concat2(rawDelimiter, /"/),
      end: concat2(/"/, rawDelimiter),
      contains: [
        ESCAPED_CHARACTER(rawDelimiter),
        INTERPOLATION(rawDelimiter)
      ]
    });
    const STRING = {
      className: "string",
      variants: [
        MULTILINE_STRING(),
        MULTILINE_STRING("#"),
        MULTILINE_STRING("##"),
        MULTILINE_STRING("###"),
        SINGLE_LINE_STRING(),
        SINGLE_LINE_STRING("#"),
        SINGLE_LINE_STRING("##"),
        SINGLE_LINE_STRING("###")
      ]
    };
    const REGEXP_CONTENTS = [
      hljs.BACKSLASH_ESCAPE,
      {
        begin: /\[/,
        end: /\]/,
        relevance: 0,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ];
    const BARE_REGEXP_LITERAL = {
      begin: /\/[^\s](?=[^/\n]*\/)/,
      end: /\//,
      contains: REGEXP_CONTENTS
    };
    const EXTENDED_REGEXP_LITERAL = (rawDelimiter) => {
      const begin = concat2(rawDelimiter, /\//);
      const end = concat2(/\//, rawDelimiter);
      return {
        begin,
        end,
        contains: [
          ...REGEXP_CONTENTS,
          {
            scope: "comment",
            begin: `#(?!.*${end})`,
            end: /$/
          }
        ]
      };
    };
    const REGEXP = {
      scope: "regexp",
      variants: [
        EXTENDED_REGEXP_LITERAL("###"),
        EXTENDED_REGEXP_LITERAL("##"),
        EXTENDED_REGEXP_LITERAL("#"),
        BARE_REGEXP_LITERAL
      ]
    };
    const QUOTED_IDENTIFIER = { match: concat2(/`/, identifier, /`/) };
    const IMPLICIT_PARAMETER = {
      className: "variable",
      match: /\$\d+/
    };
    const PROPERTY_WRAPPER_PROJECTION = {
      className: "variable",
      match: `\\$${identifierCharacter}+`
    };
    const IDENTIFIERS = [
      QUOTED_IDENTIFIER,
      IMPLICIT_PARAMETER,
      PROPERTY_WRAPPER_PROJECTION
    ];
    const AVAILABLE_ATTRIBUTE = {
      match: /(@|#(un)?)available/,
      scope: "keyword",
      starts: { contains: [
        {
          begin: /\(/,
          end: /\)/,
          keywords: availabilityKeywords,
          contains: [
            ...OPERATORS,
            NUMBER,
            STRING
          ]
        }
      ] }
    };
    const KEYWORD_ATTRIBUTE = {
      scope: "keyword",
      match: concat2(/@/, either2(...keywordAttributes), lookahead2(either2(/\(/, /\s+/)))
    };
    const USER_DEFINED_ATTRIBUTE = {
      scope: "meta",
      match: concat2(/@/, identifier)
    };
    const ATTRIBUTES5 = [
      AVAILABLE_ATTRIBUTE,
      KEYWORD_ATTRIBUTE,
      USER_DEFINED_ATTRIBUTE
    ];
    const TYPE = {
      match: lookahead2(/\b[A-Z]/),
      relevance: 0,
      contains: [
        {
          // Common Apple frameworks, for relevance boost
          className: "type",
          match: concat2(/(AV|CA|CF|CG|CI|CL|CM|CN|CT|MK|MP|MTK|MTL|NS|SCN|SK|UI|WK|XC)/, identifierCharacter, "+")
        },
        {
          // Type identifier
          className: "type",
          match: typeIdentifier,
          relevance: 0
        },
        {
          // Optional type
          match: /[?!]+/,
          relevance: 0
        },
        {
          // Variadic parameter
          match: /\.\.\./,
          relevance: 0
        },
        {
          // Protocol composition
          match: concat2(/\s+&\s+/, lookahead2(typeIdentifier)),
          relevance: 0
        }
      ]
    };
    const GENERIC_ARGUMENTS = {
      begin: /</,
      end: />/,
      keywords: KEYWORDS3,
      contains: [
        ...COMMENTS,
        ...KEYWORD_MODES,
        ...ATTRIBUTES5,
        OPERATOR_GUARD,
        TYPE
      ]
    };
    TYPE.contains.push(GENERIC_ARGUMENTS);
    const TUPLE_ELEMENT_NAME = {
      match: concat2(identifier, /\s*:/),
      keywords: "_|0",
      relevance: 0
    };
    const TUPLE = {
      begin: /\(/,
      end: /\)/,
      relevance: 0,
      keywords: KEYWORDS3,
      contains: [
        "self",
        TUPLE_ELEMENT_NAME,
        ...COMMENTS,
        REGEXP,
        ...KEYWORD_MODES,
        ...BUILT_INS3,
        ...OPERATORS,
        NUMBER,
        STRING,
        ...IDENTIFIERS,
        ...ATTRIBUTES5,
        TYPE
      ]
    };
    const GENERIC_PARAMETERS = {
      begin: /</,
      end: />/,
      keywords: "repeat each",
      contains: [
        ...COMMENTS,
        TYPE
      ]
    };
    const FUNCTION_PARAMETER_NAME = {
      begin: either2(
        lookahead2(concat2(identifier, /\s*:/)),
        lookahead2(concat2(identifier, /\s+/, identifier, /\s*:/))
      ),
      end: /:/,
      relevance: 0,
      contains: [
        {
          className: "keyword",
          match: /\b_\b/
        },
        {
          className: "params",
          match: identifier
        }
      ]
    };
    const FUNCTION_PARAMETERS = {
      begin: /\(/,
      end: /\)/,
      keywords: KEYWORDS3,
      contains: [
        FUNCTION_PARAMETER_NAME,
        ...COMMENTS,
        ...KEYWORD_MODES,
        ...OPERATORS,
        NUMBER,
        STRING,
        ...ATTRIBUTES5,
        TYPE,
        TUPLE
      ],
      endsParent: true,
      illegal: /["']/
    };
    const FUNCTION_OR_MACRO = {
      match: [
        /(func|macro)/,
        /\s+/,
        either2(QUOTED_IDENTIFIER.match, identifier, operator)
      ],
      className: {
        1: "keyword",
        3: "title.function"
      },
      contains: [
        GENERIC_PARAMETERS,
        FUNCTION_PARAMETERS,
        WHITESPACE
      ],
      illegal: [
        /\[/,
        /%/
      ]
    };
    const INIT_SUBSCRIPT = {
      match: [
        /\b(?:subscript|init[?!]?)/,
        /\s*(?=[<(])/
      ],
      className: { 1: "keyword" },
      contains: [
        GENERIC_PARAMETERS,
        FUNCTION_PARAMETERS,
        WHITESPACE
      ],
      illegal: /\[|%/
    };
    const OPERATOR_DECLARATION = {
      match: [
        /operator/,
        /\s+/,
        operator
      ],
      className: {
        1: "keyword",
        3: "title"
      }
    };
    const PRECEDENCEGROUP = {
      begin: [
        /precedencegroup/,
        /\s+/,
        typeIdentifier
      ],
      className: {
        1: "keyword",
        3: "title"
      },
      contains: [TYPE],
      keywords: [
        ...precedencegroupKeywords,
        ...literals
      ],
      end: /}/
    };
    const CLASS_FUNC_DECLARATION = {
      match: [
        /class\b/,
        /\s+/,
        /func\b/,
        /\s+/,
        /\b[A-Za-z_][A-Za-z0-9_]*\b/
      ],
      scope: {
        1: "keyword",
        3: "keyword",
        5: "title.function"
      }
    };
    const CLASS_VAR_DECLARATION = {
      match: [
        /class\b/,
        /\s+/,
        /var\b/
      ],
      scope: {
        1: "keyword",
        3: "keyword"
      }
    };
    const TYPE_DECLARATION = {
      begin: [
        /(struct|protocol|class|extension|enum|actor)/,
        /\s+/,
        identifier,
        /\s*/
      ],
      beginScope: {
        1: "keyword",
        3: "title.class"
      },
      keywords: KEYWORDS3,
      contains: [
        GENERIC_PARAMETERS,
        ...KEYWORD_MODES,
        {
          begin: /:/,
          end: /\{/,
          keywords: KEYWORDS3,
          contains: [
            {
              scope: "title.class.inherited",
              match: typeIdentifier
            },
            ...KEYWORD_MODES
          ],
          relevance: 0
        }
      ]
    };
    for (const variant of STRING.variants) {
      const interpolation = variant.contains.find((mode) => mode.label === "interpol");
      interpolation.keywords = KEYWORDS3;
      const submodes = [
        ...KEYWORD_MODES,
        ...BUILT_INS3,
        ...OPERATORS,
        NUMBER,
        STRING,
        ...IDENTIFIERS
      ];
      interpolation.contains = [
        ...submodes,
        {
          begin: /\(/,
          end: /\)/,
          contains: [
            "self",
            ...submodes
          ]
        }
      ];
    }
    return {
      name: "Swift",
      keywords: KEYWORDS3,
      contains: [
        ...COMMENTS,
        FUNCTION_OR_MACRO,
        INIT_SUBSCRIPT,
        CLASS_FUNC_DECLARATION,
        CLASS_VAR_DECLARATION,
        TYPE_DECLARATION,
        OPERATOR_DECLARATION,
        PRECEDENCEGROUP,
        {
          beginKeywords: "import",
          end: /$/,
          contains: [...COMMENTS],
          relevance: 0
        },
        REGEXP,
        ...KEYWORD_MODES,
        ...BUILT_INS3,
        ...OPERATORS,
        NUMBER,
        STRING,
        ...IDENTIFIERS,
        ...ATTRIBUTES5,
        TYPE,
        TUPLE
      ]
    };
  }

  // node_modules/highlight.js/es/languages/thrift.js
  function thrift(hljs) {
    const TYPES3 = [
      "bool",
      "byte",
      "i16",
      "i32",
      "i64",
      "double",
      "string",
      "binary"
    ];
    const KEYWORDS3 = [
      "namespace",
      "const",
      "typedef",
      "struct",
      "enum",
      "service",
      "exception",
      "void",
      "oneway",
      "set",
      "list",
      "map",
      "required",
      "optional"
    ];
    return {
      name: "Thrift",
      keywords: {
        keyword: KEYWORDS3,
        type: TYPES3,
        literal: "true false"
      },
      contains: [
        hljs.QUOTE_STRING_MODE,
        hljs.NUMBER_MODE,
        hljs.C_LINE_COMMENT_MODE,
        hljs.C_BLOCK_COMMENT_MODE,
        {
          className: "class",
          beginKeywords: "struct enum service exception",
          end: /\{/,
          illegal: /\n/,
          contains: [
            hljs.inherit(hljs.TITLE_MODE, {
              // hack: eating everything after the first title
              starts: {
                endsWithParent: true,
                excludeEnd: true
              }
            })
          ]
        },
        {
          begin: "\\b(set|list|map)\\s*<",
          keywords: { type: [
            ...TYPES3,
            "set",
            "list",
            "map"
          ] },
          end: ">",
          contains: ["self"]
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/typescript.js
  var IDENT_RE2 = "[A-Za-z$_][0-9A-Za-z$_]*";
  var KEYWORDS2 = [
    "as",
    // for exports
    "in",
    "of",
    "if",
    "for",
    "while",
    "finally",
    "var",
    "new",
    "function",
    "do",
    "return",
    "void",
    "else",
    "break",
    "catch",
    "instanceof",
    "with",
    "throw",
    "case",
    "default",
    "try",
    "switch",
    "continue",
    "typeof",
    "delete",
    "let",
    "yield",
    "const",
    "class",
    // JS handles these with a special rule
    // "get",
    // "set",
    "debugger",
    "async",
    "await",
    "static",
    "import",
    "from",
    "export",
    "extends",
    // It's reached stage 3, which is "recommended for implementation":
    "using"
  ];
  var LITERALS2 = [
    "true",
    "false",
    "null",
    "undefined",
    "NaN",
    "Infinity"
  ];
  var TYPES2 = [
    // Fundamental objects
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    // numbers and dates
    "Math",
    "Date",
    "Number",
    "BigInt",
    // text
    "String",
    "RegExp",
    // Indexed collections
    "Array",
    "Float32Array",
    "Float64Array",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Int32Array",
    "Uint16Array",
    "Uint32Array",
    "BigInt64Array",
    "BigUint64Array",
    // Keyed collections
    "Set",
    "Map",
    "WeakSet",
    "WeakMap",
    // Structured data
    "ArrayBuffer",
    "SharedArrayBuffer",
    "Atomics",
    "DataView",
    "JSON",
    // Control abstraction objects
    "Promise",
    "Generator",
    "GeneratorFunction",
    "AsyncFunction",
    // Reflection
    "Reflect",
    "Proxy",
    // Internationalization
    "Intl",
    // WebAssembly
    "WebAssembly"
  ];
  var ERROR_TYPES2 = [
    "Error",
    "EvalError",
    "InternalError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError"
  ];
  var BUILT_IN_GLOBALS2 = [
    "setInterval",
    "setTimeout",
    "clearInterval",
    "clearTimeout",
    "require",
    "exports",
    "eval",
    "isFinite",
    "isNaN",
    "parseFloat",
    "parseInt",
    "decodeURI",
    "decodeURIComponent",
    "encodeURI",
    "encodeURIComponent",
    "escape",
    "unescape"
  ];
  var BUILT_IN_VARIABLES2 = [
    "arguments",
    "this",
    "super",
    "console",
    "window",
    "document",
    "localStorage",
    "sessionStorage",
    "module",
    "global"
    // Node.js
  ];
  var BUILT_INS2 = [].concat(
    BUILT_IN_GLOBALS2,
    TYPES2,
    ERROR_TYPES2
  );
  function javascript2(hljs) {
    const regex = hljs.regex;
    const hasClosingTag = (match, { after }) => {
      const tag = "</" + match[0].slice(1);
      const pos = match.input.indexOf(tag, after);
      return pos !== -1;
    };
    const IDENT_RE$1 = IDENT_RE2;
    const FRAGMENT = {
      begin: "<>",
      end: "</>"
    };
    const XML_SELF_CLOSING = /<[A-Za-z0-9\\._:-]+\s*\/>/;
    const XML_TAG = {
      begin: /<[A-Za-z0-9\\._:-]+/,
      end: /\/[A-Za-z0-9\\._:-]+>|\/>/,
      /**
       * @param {RegExpMatchArray} match
       * @param {CallbackResponse} response
       */
      isTrulyOpeningTag: (match, response) => {
        const afterMatchIndex = match[0].length + match.index;
        const nextChar = match.input[afterMatchIndex];
        if (
          // HTML should not include another raw `<` inside a tag
          // nested type?
          // `<Array<Array<number>>`, etc.
          nextChar === "<" || // the , gives away that this is not HTML
          // `<T, A extends keyof T, V>`
          nextChar === ","
        ) {
          response.ignoreMatch();
          return;
        }
        if (nextChar === ">") {
          if (!hasClosingTag(match, { after: afterMatchIndex })) {
            response.ignoreMatch();
          }
        }
        let m;
        const afterMatch = match.input.substring(afterMatchIndex);
        if (m = afterMatch.match(/^\s*=/)) {
          response.ignoreMatch();
          return;
        }
        if (m = afterMatch.match(/^\s+extends\s+/)) {
          if (m.index === 0) {
            response.ignoreMatch();
            return;
          }
        }
      }
    };
    const KEYWORDS$1 = {
      $pattern: IDENT_RE2,
      keyword: KEYWORDS2,
      literal: LITERALS2,
      built_in: BUILT_INS2,
      "variable.language": BUILT_IN_VARIABLES2
    };
    const decimalDigits3 = "[0-9](_?[0-9])*";
    const frac3 = `\\.(${decimalDigits3})`;
    const decimalInteger = `0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*`;
    const NUMBER = {
      className: "number",
      variants: [
        // DecimalLiteral
        { begin: `(\\b(${decimalInteger})((${frac3})|\\.)?|(${frac3}))[eE][+-]?(${decimalDigits3})\\b` },
        { begin: `\\b(${decimalInteger})\\b((${frac3})\\b|\\.)?|(${frac3})\\b` },
        // DecimalBigIntegerLiteral
        { begin: `\\b(0|[1-9](_?[0-9])*)n\\b` },
        // NonDecimalIntegerLiteral
        { begin: "\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b" },
        { begin: "\\b0[bB][0-1](_?[0-1])*n?\\b" },
        { begin: "\\b0[oO][0-7](_?[0-7])*n?\\b" },
        // LegacyOctalIntegerLiteral (does not include underscore separators)
        // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
        { begin: "\\b0[0-7]+n?\\b" }
      ],
      relevance: 0
    };
    const SUBST = {
      className: "subst",
      begin: "\\$\\{",
      end: "\\}",
      keywords: KEYWORDS$1,
      contains: []
      // defined later
    };
    const HTML_TEMPLATE = {
      begin: ".?html`",
      end: "",
      starts: {
        end: "`",
        returnEnd: false,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        subLanguage: "xml"
      }
    };
    const CSS_TEMPLATE = {
      begin: ".?css`",
      end: "",
      starts: {
        end: "`",
        returnEnd: false,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        subLanguage: "css"
      }
    };
    const GRAPHQL_TEMPLATE = {
      begin: ".?gql`",
      end: "",
      starts: {
        end: "`",
        returnEnd: false,
        contains: [
          hljs.BACKSLASH_ESCAPE,
          SUBST
        ],
        subLanguage: "graphql"
      }
    };
    const TEMPLATE_STRING = {
      className: "string",
      begin: "`",
      end: "`",
      contains: [
        hljs.BACKSLASH_ESCAPE,
        SUBST
      ]
    };
    const JSDOC_COMMENT = hljs.COMMENT(
      /\/\*\*(?!\/)/,
      "\\*/",
      {
        relevance: 0,
        contains: [
          {
            begin: "(?=@[A-Za-z]+)",
            relevance: 0,
            contains: [
              {
                className: "doctag",
                begin: "@[A-Za-z]+"
              },
              {
                className: "type",
                begin: "\\{",
                end: "\\}",
                excludeEnd: true,
                excludeBegin: true,
                relevance: 0
              },
              {
                className: "variable",
                begin: IDENT_RE$1 + "(?=\\s*(-)|$)",
                endsParent: true,
                relevance: 0
              },
              // eat spaces (not newlines) so we can find
              // types or variables
              {
                begin: /(?=[^\n])\s/,
                relevance: 0
              }
            ]
          }
        ]
      }
    );
    const COMMENT = {
      className: "comment",
      variants: [
        JSDOC_COMMENT,
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.C_LINE_COMMENT_MODE
      ]
    };
    const SUBST_INTERNALS = [
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      HTML_TEMPLATE,
      CSS_TEMPLATE,
      GRAPHQL_TEMPLATE,
      TEMPLATE_STRING,
      // Skip numbers when they are part of a variable name
      { match: /\$\d+/ },
      NUMBER
      // This is intentional:
      // See https://github.com/highlightjs/highlight.js/issues/3288
      // hljs.REGEXP_MODE
    ];
    SUBST.contains = SUBST_INTERNALS.concat({
      // we need to pair up {} inside our subst to prevent
      // it from ending too early by matching another }
      begin: /\{/,
      end: /\}/,
      keywords: KEYWORDS$1,
      contains: [
        "self"
      ].concat(SUBST_INTERNALS)
    });
    const SUBST_AND_COMMENTS = [].concat(COMMENT, SUBST.contains);
    const PARAMS_CONTAINS = SUBST_AND_COMMENTS.concat([
      // eat recursive parens in sub expressions
      {
        begin: /(\s*)\(/,
        end: /\)/,
        keywords: KEYWORDS$1,
        contains: ["self"].concat(SUBST_AND_COMMENTS)
      }
    ]);
    const PARAMS = {
      className: "params",
      // convert this to negative lookbehind in v12
      begin: /(\s*)\(/,
      // to match the parms with
      end: /\)/,
      excludeBegin: true,
      excludeEnd: true,
      keywords: KEYWORDS$1,
      contains: PARAMS_CONTAINS
    };
    const CLASS_OR_EXTENDS = {
      variants: [
        // class Car extends vehicle
        {
          match: [
            /class/,
            /\s+/,
            IDENT_RE$1,
            /\s+/,
            /extends/,
            /\s+/,
            regex.concat(IDENT_RE$1, "(", regex.concat(/\./, IDENT_RE$1), ")*")
          ],
          scope: {
            1: "keyword",
            3: "title.class",
            5: "keyword",
            7: "title.class.inherited"
          }
        },
        // class Car
        {
          match: [
            /class/,
            /\s+/,
            IDENT_RE$1
          ],
          scope: {
            1: "keyword",
            3: "title.class"
          }
        }
      ]
    };
    const CLASS_REFERENCE = {
      relevance: 0,
      match: regex.either(
        // Hard coded exceptions
        /\bJSON/,
        // Float32Array, OutT
        /\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,
        // CSSFactory, CSSFactoryT
        /\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,
        // FPs, FPsT
        /\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/
        // P
        // single letters are not highlighted
        // BLAH
        // this will be flagged as a UPPER_CASE_CONSTANT instead
      ),
      className: "title.class",
      keywords: {
        _: [
          // se we still get relevance credit for JS library classes
          ...TYPES2,
          ...ERROR_TYPES2
        ]
      }
    };
    const USE_STRICT = {
      label: "use_strict",
      className: "meta",
      relevance: 10,
      begin: /^\s*['"]use (strict|asm)['"]/
    };
    const FUNCTION_DEFINITION = {
      variants: [
        {
          match: [
            /function/,
            /\s+/,
            IDENT_RE$1,
            /(?=\s*\()/
          ]
        },
        // anonymous function
        {
          match: [
            /function/,
            /\s*(?=\()/
          ]
        }
      ],
      className: {
        1: "keyword",
        3: "title.function"
      },
      label: "func.def",
      contains: [PARAMS],
      illegal: /%/
    };
    const UPPER_CASE_CONSTANT = {
      relevance: 0,
      match: /\b[A-Z][A-Z_0-9]+\b/,
      className: "variable.constant"
    };
    function noneOf(list) {
      return regex.concat("(?!", list.join("|"), ")");
    }
    const FUNCTION_CALL = {
      match: regex.concat(
        /\b/,
        noneOf([
          ...BUILT_IN_GLOBALS2,
          "super",
          "import"
        ].map((x) => `${x}\\s*\\(`)),
        IDENT_RE$1,
        regex.lookahead(/\s*\(/)
      ),
      className: "title.function",
      relevance: 0
    };
    const PROPERTY_ACCESS = {
      begin: regex.concat(/\./, regex.lookahead(
        regex.concat(IDENT_RE$1, /(?![0-9A-Za-z$_(])/)
      )),
      end: IDENT_RE$1,
      excludeBegin: true,
      keywords: "prototype",
      className: "property",
      relevance: 0
    };
    const GETTER_OR_SETTER = {
      match: [
        /get|set/,
        /\s+/,
        IDENT_RE$1,
        /(?=\()/
      ],
      className: {
        1: "keyword",
        3: "title.function"
      },
      contains: [
        {
          // eat to avoid empty params
          begin: /\(\)/
        },
        PARAMS
      ]
    };
    const FUNC_LEAD_IN_RE = "(\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)|" + hljs.UNDERSCORE_IDENT_RE + ")\\s*=>";
    const FUNCTION_VARIABLE = {
      match: [
        /const|var|let/,
        /\s+/,
        IDENT_RE$1,
        /\s*/,
        /=\s*/,
        /(async\s*)?/,
        // async is optional
        regex.lookahead(FUNC_LEAD_IN_RE)
      ],
      keywords: "async",
      className: {
        1: "keyword",
        3: "title.function"
      },
      contains: [
        PARAMS
      ]
    };
    return {
      name: "JavaScript",
      aliases: ["js", "jsx", "mjs", "cjs"],
      keywords: KEYWORDS$1,
      // this will be extended by TypeScript
      exports: { PARAMS_CONTAINS, CLASS_REFERENCE },
      illegal: /#(?![$_A-z])/,
      contains: [
        hljs.SHEBANG({
          label: "shebang",
          binary: "node",
          relevance: 5
        }),
        USE_STRICT,
        hljs.APOS_STRING_MODE,
        hljs.QUOTE_STRING_MODE,
        HTML_TEMPLATE,
        CSS_TEMPLATE,
        GRAPHQL_TEMPLATE,
        TEMPLATE_STRING,
        COMMENT,
        // Skip numbers when they are part of a variable name
        { match: /\$\d+/ },
        NUMBER,
        CLASS_REFERENCE,
        {
          scope: "attr",
          match: IDENT_RE$1 + regex.lookahead(":"),
          relevance: 0
        },
        FUNCTION_VARIABLE,
        {
          // "value" container
          begin: "(" + hljs.RE_STARTERS_RE + "|\\b(case|return|throw)\\b)\\s*",
          keywords: "return throw case",
          relevance: 0,
          contains: [
            COMMENT,
            hljs.REGEXP_MODE,
            {
              className: "function",
              // we have to count the parens to make sure we actually have the
              // correct bounding ( ) before the =>.  There could be any number of
              // sub-expressions inside also surrounded by parens.
              begin: FUNC_LEAD_IN_RE,
              returnBegin: true,
              end: "\\s*=>",
              contains: [
                {
                  className: "params",
                  variants: [
                    {
                      begin: hljs.UNDERSCORE_IDENT_RE,
                      relevance: 0
                    },
                    {
                      className: null,
                      begin: /\(\s*\)/,
                      skip: true
                    },
                    {
                      begin: /(\s*)\(/,
                      end: /\)/,
                      excludeBegin: true,
                      excludeEnd: true,
                      keywords: KEYWORDS$1,
                      contains: PARAMS_CONTAINS
                    }
                  ]
                }
              ]
            },
            {
              // could be a comma delimited list of params to a function call
              begin: /,/,
              relevance: 0
            },
            {
              match: /\s+/,
              relevance: 0
            },
            {
              // JSX
              variants: [
                { begin: FRAGMENT.begin, end: FRAGMENT.end },
                { match: XML_SELF_CLOSING },
                {
                  begin: XML_TAG.begin,
                  // we carefully check the opening tag to see if it truly
                  // is a tag and not a false positive
                  "on:begin": XML_TAG.isTrulyOpeningTag,
                  end: XML_TAG.end
                }
              ],
              subLanguage: "xml",
              contains: [
                {
                  begin: XML_TAG.begin,
                  end: XML_TAG.end,
                  skip: true,
                  contains: ["self"]
                }
              ]
            }
          ]
        },
        FUNCTION_DEFINITION,
        {
          // prevent this from getting swallowed up by function
          // since they appear "function like"
          beginKeywords: "while if switch catch for"
        },
        {
          // we have to count the parens to make sure we actually have the correct
          // bounding ( ).  There could be any number of sub-expressions inside
          // also surrounded by parens.
          begin: "\\b(?!function)" + hljs.UNDERSCORE_IDENT_RE + "\\([^()]*(\\([^()]*(\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)\\s*\\{",
          // end parens
          returnBegin: true,
          label: "func.def",
          contains: [
            PARAMS,
            hljs.inherit(hljs.TITLE_MODE, { begin: IDENT_RE$1, className: "title.function" })
          ]
        },
        // catch ... so it won't trigger the property rule below
        {
          match: /\.\.\./,
          relevance: 0
        },
        PROPERTY_ACCESS,
        // hack: prevents detection of keywords in some circumstances
        // .keyword()
        // $keyword = x
        {
          match: "\\$" + IDENT_RE$1,
          relevance: 0
        },
        {
          match: [/\bconstructor(?=\s*\()/],
          className: { 1: "title.function" },
          contains: [PARAMS]
        },
        FUNCTION_CALL,
        UPPER_CASE_CONSTANT,
        CLASS_OR_EXTENDS,
        GETTER_OR_SETTER,
        {
          match: /\$[(.]/
          // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
        }
      ]
    };
  }
  function typescript(hljs) {
    const regex = hljs.regex;
    const tsLanguage = javascript2(hljs);
    const IDENT_RE$1 = IDENT_RE2;
    const TYPES3 = [
      "any",
      "void",
      "number",
      "boolean",
      "string",
      "object",
      "never",
      "symbol",
      "bigint",
      "unknown"
    ];
    const NAMESPACE = {
      begin: [
        /namespace/,
        /\s+/,
        hljs.IDENT_RE
      ],
      beginScope: {
        1: "keyword",
        3: "title.class"
      }
    };
    const INTERFACE = {
      beginKeywords: "interface",
      end: /\{/,
      excludeEnd: true,
      keywords: {
        keyword: "interface extends",
        built_in: TYPES3
      },
      contains: [tsLanguage.exports.CLASS_REFERENCE]
    };
    const USE_STRICT = {
      className: "meta",
      relevance: 10,
      begin: /^\s*['"]use strict['"]/
    };
    const TS_SPECIFIC_KEYWORDS = [
      "type",
      // "namespace",
      "interface",
      "public",
      "private",
      "protected",
      "implements",
      "declare",
      "abstract",
      "readonly",
      "enum",
      "override",
      "satisfies"
    ];
    const KEYWORDS$1 = {
      $pattern: IDENT_RE2,
      keyword: KEYWORDS2.concat(TS_SPECIFIC_KEYWORDS),
      literal: LITERALS2,
      built_in: BUILT_INS2.concat(TYPES3),
      "variable.language": BUILT_IN_VARIABLES2
    };
    const DECORATOR = {
      className: "meta",
      begin: "@" + IDENT_RE$1
    };
    const swapMode = (mode, label, replacement) => {
      const indx = mode.contains.findIndex((m) => m.label === label);
      if (indx === -1) {
        throw new Error("can not find mode to replace");
      }
      mode.contains.splice(indx, 1, replacement);
    };
    Object.assign(tsLanguage.keywords, KEYWORDS$1);
    tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR);
    const ATTRIBUTE_HIGHLIGHT = tsLanguage.contains.find((c2) => c2.scope === "attr");
    const OPTIONAL_KEY_OR_ARGUMENT = Object.assign(
      {},
      ATTRIBUTE_HIGHLIGHT,
      { match: regex.concat(IDENT_RE$1, regex.lookahead(/\s*\?:/)) }
    );
    tsLanguage.exports.PARAMS_CONTAINS.push([
      tsLanguage.exports.CLASS_REFERENCE,
      // class reference for highlighting the params types
      ATTRIBUTE_HIGHLIGHT,
      // highlight the params key
      OPTIONAL_KEY_OR_ARGUMENT
      // Added for optional property assignment highlighting
    ]);
    tsLanguage.contains = tsLanguage.contains.concat([
      DECORATOR,
      NAMESPACE,
      INTERFACE,
      OPTIONAL_KEY_OR_ARGUMENT
      // Added for optional property assignment highlighting
    ]);
    swapMode(tsLanguage, "shebang", hljs.SHEBANG());
    swapMode(tsLanguage, "use_strict", USE_STRICT);
    const functionDeclaration = tsLanguage.contains.find((m) => m.label === "func.def");
    functionDeclaration.relevance = 0;
    Object.assign(tsLanguage, {
      name: "TypeScript",
      aliases: [
        "ts",
        "tsx",
        "mts",
        "cts"
      ]
    });
    return tsLanguage;
  }

  // node_modules/highlight.js/es/languages/vbnet.js
  function vbnet(hljs) {
    const regex = hljs.regex;
    const CHARACTER = {
      className: "string",
      begin: /"(""|[^/n])"C\b/
    };
    const STRING = {
      className: "string",
      begin: /"/,
      end: /"/,
      illegal: /\n/,
      contains: [
        {
          // double quote escape
          begin: /""/
        }
      ]
    };
    const MM_DD_YYYY = /\d{1,2}\/\d{1,2}\/\d{4}/;
    const YYYY_MM_DD = /\d{4}-\d{1,2}-\d{1,2}/;
    const TIME_12H = /(\d|1[012])(:\d+){0,2} *(AM|PM)/;
    const TIME_24H = /\d{1,2}(:\d{1,2}){1,2}/;
    const DATE = {
      className: "literal",
      variants: [
        {
          // #YYYY-MM-DD# (ISO-Date) or #M/D/YYYY# (US-Date)
          begin: regex.concat(/# */, regex.either(YYYY_MM_DD, MM_DD_YYYY), / *#/)
        },
        {
          // #H:mm[:ss]# (24h Time)
          begin: regex.concat(/# */, TIME_24H, / *#/)
        },
        {
          // #h[:mm[:ss]] A# (12h Time)
          begin: regex.concat(/# */, TIME_12H, / *#/)
        },
        {
          // date plus time
          begin: regex.concat(
            /# */,
            regex.either(YYYY_MM_DD, MM_DD_YYYY),
            / +/,
            regex.either(TIME_12H, TIME_24H),
            / *#/
          )
        }
      ]
    };
    const NUMBER = {
      className: "number",
      relevance: 0,
      variants: [
        {
          // Float
          begin: /\b\d[\d_]*((\.[\d_]+(E[+-]?[\d_]+)?)|(E[+-]?[\d_]+))[RFD@!#]?/
        },
        {
          // Integer (base 10)
          begin: /\b\d[\d_]*((U?[SIL])|[%&])?/
        },
        {
          // Integer (base 16)
          begin: /&H[\dA-F_]+((U?[SIL])|[%&])?/
        },
        {
          // Integer (base 8)
          begin: /&O[0-7_]+((U?[SIL])|[%&])?/
        },
        {
          // Integer (base 2)
          begin: /&B[01_]+((U?[SIL])|[%&])?/
        }
      ]
    };
    const LABEL = {
      className: "label",
      begin: /^\w+:/
    };
    const DOC_COMMENT = hljs.COMMENT(/'''/, /$/, { contains: [
      {
        className: "doctag",
        begin: /<\/?/,
        end: />/
      }
    ] });
    const COMMENT = hljs.COMMENT(null, /$/, { variants: [
      { begin: /'/ },
      {
        // TODO: Use multi-class for leading spaces
        begin: /([\t ]|^)REM(?=\s)/
      }
    ] });
    const DIRECTIVES = {
      className: "meta",
      // TODO: Use multi-class for indentation once available
      begin: /[\t ]*#(const|disable|else|elseif|enable|end|externalsource|if|region)\b/,
      end: /$/,
      keywords: { keyword: "const disable else elseif enable end externalsource if region then" },
      contains: [COMMENT]
    };
    return {
      name: "Visual Basic .NET",
      aliases: ["vb"],
      case_insensitive: true,
      classNameAliases: { label: "symbol" },
      keywords: {
        keyword: "addhandler alias aggregate ansi as async assembly auto binary by byref byval call case catch class compare const continue custom declare default delegate dim distinct do each equals else elseif end enum erase error event exit explicit finally for friend from function get global goto group handles if implements imports in inherits interface into iterator join key let lib loop me mid module mustinherit mustoverride mybase myclass namespace narrowing new next notinheritable notoverridable of off on operator option optional order overloads overridable overrides paramarray partial preserve private property protected public raiseevent readonly redim removehandler resume return select set shadows shared skip static step stop structure strict sub synclock take text then throw to try unicode until using when where while widening with withevents writeonly yield",
        built_in: (
          // Operators https://docs.microsoft.com/dotnet/visual-basic/language-reference/operators
          "addressof and andalso await directcast gettype getxmlnamespace is isfalse isnot istrue like mod nameof new not or orelse trycast typeof xor cbool cbyte cchar cdate cdbl cdec cint clng cobj csbyte cshort csng cstr cuint culng cushort"
        ),
        type: (
          // Data types https://docs.microsoft.com/dotnet/visual-basic/language-reference/data-types
          "boolean byte char date decimal double integer long object sbyte short single string uinteger ulong ushort"
        ),
        literal: "true false nothing"
      },
      illegal: "//|\\{|\\}|endif|gosub|variant|wend|^\\$ ",
      contains: [
        CHARACTER,
        STRING,
        DATE,
        NUMBER,
        LABEL,
        DOC_COMMENT,
        COMMENT,
        DIRECTIVES
      ]
    };
  }

  // node_modules/highlight.js/es/languages/verilog.js
  function verilog(hljs) {
    const regex = hljs.regex;
    const KEYWORDS3 = {
      $pattern: /\$?[\w]+(\$[\w]+)*/,
      keyword: [
        "accept_on",
        "alias",
        "always",
        "always_comb",
        "always_ff",
        "always_latch",
        "and",
        "assert",
        "assign",
        "assume",
        "automatic",
        "before",
        "begin",
        "bind",
        "bins",
        "binsof",
        "bit",
        "break",
        "buf|0",
        "bufif0",
        "bufif1",
        "byte",
        "case",
        "casex",
        "casez",
        "cell",
        "chandle",
        "checker",
        "class",
        "clocking",
        "cmos",
        "config",
        "const",
        "constraint",
        "context",
        "continue",
        "cover",
        "covergroup",
        "coverpoint",
        "cross",
        "deassign",
        "default",
        "defparam",
        "design",
        "disable",
        "dist",
        "do",
        "edge",
        "else",
        "end",
        "endcase",
        "endchecker",
        "endclass",
        "endclocking",
        "endconfig",
        "endfunction",
        "endgenerate",
        "endgroup",
        "endinterface",
        "endmodule",
        "endpackage",
        "endprimitive",
        "endprogram",
        "endproperty",
        "endspecify",
        "endsequence",
        "endtable",
        "endtask",
        "enum",
        "event",
        "eventually",
        "expect",
        "export",
        "extends",
        "extern",
        "final",
        "first_match",
        "for",
        "force",
        "foreach",
        "forever",
        "fork",
        "forkjoin",
        "function",
        "generate|5",
        "genvar",
        "global",
        "highz0",
        "highz1",
        "if",
        "iff",
        "ifnone",
        "ignore_bins",
        "illegal_bins",
        "implements",
        "implies",
        "import",
        "incdir",
        "include",
        "initial",
        "inout",
        "input",
        "inside",
        "instance",
        "int",
        "integer",
        "interconnect",
        "interface",
        "intersect",
        "join",
        "join_any",
        "join_none",
        "large",
        "let",
        "liblist",
        "library",
        "local",
        "localparam",
        "logic",
        "longint",
        "macromodule",
        "matches",
        "medium",
        "modport",
        "module",
        "nand",
        "negedge",
        "nettype",
        "new",
        "nexttime",
        "nmos",
        "nor",
        "noshowcancelled",
        "not",
        "notif0",
        "notif1",
        "or",
        "output",
        "package",
        "packed",
        "parameter",
        "pmos",
        "posedge",
        "primitive",
        "priority",
        "program",
        "property",
        "protected",
        "pull0",
        "pull1",
        "pulldown",
        "pullup",
        "pulsestyle_ondetect",
        "pulsestyle_onevent",
        "pure",
        "rand",
        "randc",
        "randcase",
        "randsequence",
        "rcmos",
        "real",
        "realtime",
        "ref",
        "reg",
        "reject_on",
        "release",
        "repeat",
        "restrict",
        "return",
        "rnmos",
        "rpmos",
        "rtran",
        "rtranif0",
        "rtranif1",
        "s_always",
        "s_eventually",
        "s_nexttime",
        "s_until",
        "s_until_with",
        "scalared",
        "sequence",
        "shortint",
        "shortreal",
        "showcancelled",
        "signed",
        "small",
        "soft",
        "solve",
        "specify",
        "specparam",
        "static",
        "string",
        "strong",
        "strong0",
        "strong1",
        "struct",
        "super",
        "supply0",
        "supply1",
        "sync_accept_on",
        "sync_reject_on",
        "table",
        "tagged",
        "task",
        "this",
        "throughout",
        "time",
        "timeprecision",
        "timeunit",
        "tran",
        "tranif0",
        "tranif1",
        "tri",
        "tri0",
        "tri1",
        "triand",
        "trior",
        "trireg",
        "type",
        "typedef",
        "union",
        "unique",
        "unique0",
        "unsigned",
        "until",
        "until_with",
        "untyped",
        "use",
        "uwire",
        "var",
        "vectored",
        "virtual",
        "void",
        "wait",
        "wait_order",
        "wand",
        "weak",
        "weak0",
        "weak1",
        "while",
        "wildcard",
        "wire",
        "with",
        "within",
        "wor",
        "xnor",
        "xor"
      ],
      literal: ["null"],
      built_in: [
        "$finish",
        "$stop",
        "$exit",
        "$fatal",
        "$error",
        "$warning",
        "$info",
        "$realtime",
        "$time",
        "$printtimescale",
        "$bitstoreal",
        "$bitstoshortreal",
        "$itor",
        "$signed",
        "$cast",
        "$bits",
        "$stime",
        "$timeformat",
        "$realtobits",
        "$shortrealtobits",
        "$rtoi",
        "$unsigned",
        "$asserton",
        "$assertkill",
        "$assertpasson",
        "$assertfailon",
        "$assertnonvacuouson",
        "$assertoff",
        "$assertcontrol",
        "$assertpassoff",
        "$assertfailoff",
        "$assertvacuousoff",
        "$isunbounded",
        "$sampled",
        "$fell",
        "$changed",
        "$past_gclk",
        "$fell_gclk",
        "$changed_gclk",
        "$rising_gclk",
        "$steady_gclk",
        "$coverage_control",
        "$coverage_get",
        "$coverage_save",
        "$set_coverage_db_name",
        "$rose",
        "$stable",
        "$past",
        "$rose_gclk",
        "$stable_gclk",
        "$future_gclk",
        "$falling_gclk",
        "$changing_gclk",
        "$display",
        "$coverage_get_max",
        "$coverage_merge",
        "$get_coverage",
        "$load_coverage_db",
        "$typename",
        "$unpacked_dimensions",
        "$left",
        "$low",
        "$increment",
        "$clog2",
        "$ln",
        "$log10",
        "$exp",
        "$sqrt",
        "$pow",
        "$floor",
        "$ceil",
        "$sin",
        "$cos",
        "$tan",
        "$countbits",
        "$onehot",
        "$isunknown",
        "$fatal",
        "$warning",
        "$dimensions",
        "$right",
        "$high",
        "$size",
        "$asin",
        "$acos",
        "$atan",
        "$atan2",
        "$hypot",
        "$sinh",
        "$cosh",
        "$tanh",
        "$asinh",
        "$acosh",
        "$atanh",
        "$countones",
        "$onehot0",
        "$error",
        "$info",
        "$random",
        "$dist_chi_square",
        "$dist_erlang",
        "$dist_exponential",
        "$dist_normal",
        "$dist_poisson",
        "$dist_t",
        "$dist_uniform",
        "$q_initialize",
        "$q_remove",
        "$q_exam",
        "$async$and$array",
        "$async$nand$array",
        "$async$or$array",
        "$async$nor$array",
        "$sync$and$array",
        "$sync$nand$array",
        "$sync$or$array",
        "$sync$nor$array",
        "$q_add",
        "$q_full",
        "$psprintf",
        "$async$and$plane",
        "$async$nand$plane",
        "$async$or$plane",
        "$async$nor$plane",
        "$sync$and$plane",
        "$sync$nand$plane",
        "$sync$or$plane",
        "$sync$nor$plane",
        "$system",
        "$display",
        "$displayb",
        "$displayh",
        "$displayo",
        "$strobe",
        "$strobeb",
        "$strobeh",
        "$strobeo",
        "$write",
        "$readmemb",
        "$readmemh",
        "$writememh",
        "$value$plusargs",
        "$dumpvars",
        "$dumpon",
        "$dumplimit",
        "$dumpports",
        "$dumpportson",
        "$dumpportslimit",
        "$writeb",
        "$writeh",
        "$writeo",
        "$monitor",
        "$monitorb",
        "$monitorh",
        "$monitoro",
        "$writememb",
        "$dumpfile",
        "$dumpoff",
        "$dumpall",
        "$dumpflush",
        "$dumpportsoff",
        "$dumpportsall",
        "$dumpportsflush",
        "$fclose",
        "$fdisplay",
        "$fdisplayb",
        "$fdisplayh",
        "$fdisplayo",
        "$fstrobe",
        "$fstrobeb",
        "$fstrobeh",
        "$fstrobeo",
        "$swrite",
        "$swriteb",
        "$swriteh",
        "$swriteo",
        "$fscanf",
        "$fread",
        "$fseek",
        "$fflush",
        "$feof",
        "$fopen",
        "$fwrite",
        "$fwriteb",
        "$fwriteh",
        "$fwriteo",
        "$fmonitor",
        "$fmonitorb",
        "$fmonitorh",
        "$fmonitoro",
        "$sformat",
        "$sformatf",
        "$fgetc",
        "$ungetc",
        "$fgets",
        "$sscanf",
        "$rewind",
        "$ftell",
        "$ferror"
      ]
    };
    const BUILT_IN_CONSTANTS = [
      "__FILE__",
      "__LINE__"
    ];
    const DIRECTIVES = [
      "begin_keywords",
      "celldefine",
      "default_nettype",
      "default_decay_time",
      "default_trireg_strength",
      "define",
      "delay_mode_distributed",
      "delay_mode_path",
      "delay_mode_unit",
      "delay_mode_zero",
      "else",
      "elsif",
      "end_keywords",
      "endcelldefine",
      "endif",
      "ifdef",
      "ifndef",
      "include",
      "line",
      "nounconnected_drive",
      "pragma",
      "resetall",
      "timescale",
      "unconnected_drive",
      "undef",
      "undefineall"
    ];
    return {
      name: "Verilog",
      aliases: [
        "v",
        "sv",
        "svh"
      ],
      case_insensitive: false,
      keywords: KEYWORDS3,
      contains: [
        hljs.C_BLOCK_COMMENT_MODE,
        hljs.C_LINE_COMMENT_MODE,
        hljs.QUOTE_STRING_MODE,
        {
          scope: "number",
          contains: [hljs.BACKSLASH_ESCAPE],
          variants: [
            { begin: /\b((\d+'([bhodBHOD]))[0-9xzXZa-fA-F_]+)/ },
            { begin: /\B(('([bhodBHOD]))[0-9xzXZa-fA-F_]+)/ },
            {
              // decimal
              begin: /\b[0-9][0-9_]*/,
              relevance: 0
            }
          ]
        },
        /* parameters to instances */
        {
          scope: "variable",
          variants: [
            { begin: "#\\((?!parameter).+\\)" },
            {
              begin: "\\.\\w+",
              relevance: 0
            }
          ]
        },
        {
          scope: "variable.constant",
          match: regex.concat(/`/, regex.either(...BUILT_IN_CONSTANTS))
        },
        {
          scope: "meta",
          begin: regex.concat(/`/, regex.either(...DIRECTIVES)),
          end: /$|\/\/|\/\*/,
          returnEnd: true,
          keywords: DIRECTIVES
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/vhdl.js
  function vhdl(hljs) {
    const INTEGER_RE = "\\d(_|\\d)*";
    const EXPONENT_RE = "[eE][-+]?" + INTEGER_RE;
    const DECIMAL_LITERAL_RE = INTEGER_RE + "(\\." + INTEGER_RE + ")?(" + EXPONENT_RE + ")?";
    const BASED_INTEGER_RE = "\\w+";
    const BASED_LITERAL_RE = INTEGER_RE + "#" + BASED_INTEGER_RE + "(\\." + BASED_INTEGER_RE + ")?#(" + EXPONENT_RE + ")?";
    const NUMBER_RE = "\\b(" + BASED_LITERAL_RE + "|" + DECIMAL_LITERAL_RE + ")";
    const KEYWORDS3 = [
      "abs",
      "access",
      "after",
      "alias",
      "all",
      "and",
      "architecture",
      "array",
      "assert",
      "assume",
      "assume_guarantee",
      "attribute",
      "begin",
      "block",
      "body",
      "buffer",
      "bus",
      "case",
      "component",
      "configuration",
      "constant",
      "context",
      "cover",
      "disconnect",
      "downto",
      "default",
      "else",
      "elsif",
      "end",
      "entity",
      "exit",
      "fairness",
      "file",
      "for",
      "force",
      "function",
      "generate",
      "generic",
      "group",
      "guarded",
      "if",
      "impure",
      "in",
      "inertial",
      "inout",
      "is",
      "label",
      "library",
      "linkage",
      "literal",
      "loop",
      "map",
      "mod",
      "nand",
      "new",
      "next",
      "nor",
      "not",
      "null",
      "of",
      "on",
      "open",
      "or",
      "others",
      "out",
      "package",
      "parameter",
      "port",
      "postponed",
      "procedure",
      "process",
      "property",
      "protected",
      "pure",
      "range",
      "record",
      "register",
      "reject",
      "release",
      "rem",
      "report",
      "restrict",
      "restrict_guarantee",
      "return",
      "rol",
      "ror",
      "select",
      "sequence",
      "severity",
      "shared",
      "signal",
      "sla",
      "sll",
      "sra",
      "srl",
      "strong",
      "subtype",
      "then",
      "to",
      "transport",
      "type",
      "unaffected",
      "units",
      "until",
      "use",
      "variable",
      "view",
      "vmode",
      "vprop",
      "vunit",
      "wait",
      "when",
      "while",
      "with",
      "xnor",
      "xor"
    ];
    const BUILT_INS3 = [
      "boolean",
      "bit",
      "character",
      "integer",
      "time",
      "delay_length",
      "natural",
      "positive",
      "string",
      "bit_vector",
      "file_open_kind",
      "file_open_status",
      "std_logic",
      "std_logic_vector",
      "unsigned",
      "signed",
      "boolean_vector",
      "integer_vector",
      "std_ulogic",
      "std_ulogic_vector",
      "unresolved_unsigned",
      "u_unsigned",
      "unresolved_signed",
      "u_signed",
      "real_vector",
      "time_vector"
    ];
    const LITERALS3 = [
      // severity_level
      "false",
      "true",
      "note",
      "warning",
      "error",
      "failure",
      // textio
      "line",
      "text",
      "side",
      "width"
    ];
    return {
      name: "VHDL",
      case_insensitive: true,
      keywords: {
        keyword: KEYWORDS3,
        built_in: BUILT_INS3,
        literal: LITERALS3
      },
      illegal: /\{/,
      contains: [
        hljs.C_BLOCK_COMMENT_MODE,
        // VHDL-2008 block commenting.
        hljs.COMMENT("--", "$"),
        hljs.QUOTE_STRING_MODE,
        {
          className: "number",
          begin: NUMBER_RE,
          relevance: 0
        },
        {
          className: "string",
          begin: "'(U|X|0|1|Z|W|L|H|-)'",
          contains: [hljs.BACKSLASH_ESCAPE]
        },
        {
          className: "symbol",
          begin: "'[A-Za-z](_?[A-Za-z0-9])*",
          contains: [hljs.BACKSLASH_ESCAPE]
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/wasm.js
  function wasm(hljs) {
    hljs.regex;
    const BLOCK_COMMENT = hljs.COMMENT(/\(;/, /;\)/);
    BLOCK_COMMENT.contains.push("self");
    const LINE_COMMENT = hljs.COMMENT(/;;/, /$/);
    const KWS = [
      "anyfunc",
      "block",
      "br",
      "br_if",
      "br_table",
      "call",
      "call_indirect",
      "data",
      "drop",
      "elem",
      "else",
      "end",
      "export",
      "func",
      "global.get",
      "global.set",
      "local.get",
      "local.set",
      "local.tee",
      "get_global",
      "get_local",
      "global",
      "if",
      "import",
      "local",
      "loop",
      "memory",
      "memory.grow",
      "memory.size",
      "module",
      "mut",
      "nop",
      "offset",
      "param",
      "result",
      "return",
      "select",
      "set_global",
      "set_local",
      "start",
      "table",
      "tee_local",
      "then",
      "type",
      "unreachable"
    ];
    const FUNCTION_REFERENCE = {
      begin: [
        /(?:func|call|call_indirect)/,
        /\s+/,
        /\$[^\s)]+/
      ],
      className: {
        1: "keyword",
        3: "title.function"
      }
    };
    const ARGUMENT = {
      className: "variable",
      begin: /\$[\w_]+/
    };
    const PARENS = {
      match: /(\((?!;)|\))+/,
      className: "punctuation",
      relevance: 0
    };
    const NUMBER = {
      className: "number",
      relevance: 0,
      // borrowed from Prism, TODO: split out into variants
      match: /[+-]?\b(?:\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|0x[\da-fA-F](?:_?[\da-fA-F])*(?:\.[\da-fA-F](?:_?[\da-fA-D])*)?(?:[pP][+-]?\d(?:_?\d)*)?)\b|\binf\b|\bnan(?::0x[\da-fA-F](?:_?[\da-fA-D])*)?\b/
    };
    const TYPE = {
      // look-ahead prevents us from gobbling up opcodes
      match: /(i32|i64|f32|f64)(?!\.)/,
      className: "type"
    };
    const MATH_OPERATIONS = {
      className: "keyword",
      // borrowed from Prism, TODO: split out into variants
      match: /\b(f32|f64|i32|i64)(?:\.(?:abs|add|and|ceil|clz|const|convert_[su]\/i(?:32|64)|copysign|ctz|demote\/f64|div(?:_[su])?|eqz?|extend_[su]\/i32|floor|ge(?:_[su])?|gt(?:_[su])?|le(?:_[su])?|load(?:(?:8|16|32)_[su])?|lt(?:_[su])?|max|min|mul|nearest|neg?|or|popcnt|promote\/f32|reinterpret\/[fi](?:32|64)|rem_[su]|rot[lr]|shl|shr_[su]|store(?:8|16|32)?|sqrt|sub|trunc(?:_[su]\/f(?:32|64))?|wrap\/i64|xor))\b/
    };
    const OFFSET_ALIGN = {
      match: [
        /(?:offset|align)/,
        /\s*/,
        /=/
      ],
      className: {
        1: "keyword",
        3: "operator"
      }
    };
    return {
      name: "WebAssembly",
      keywords: {
        $pattern: /[\w.]+/,
        keyword: KWS
      },
      contains: [
        LINE_COMMENT,
        BLOCK_COMMENT,
        OFFSET_ALIGN,
        ARGUMENT,
        PARENS,
        FUNCTION_REFERENCE,
        hljs.QUOTE_STRING_MODE,
        TYPE,
        MATH_OPERATIONS,
        NUMBER
      ]
    };
  }

  // node_modules/highlight.js/es/languages/xml.js
  function xml(hljs) {
    const regex = hljs.regex;
    const TAG_NAME_RE = regex.concat(/[\p{L}_]/u, regex.optional(/[\p{L}0-9_.-]*:/u), /[\p{L}0-9_.-]*/u);
    const XML_IDENT_RE = /[\p{L}0-9._:-]+/u;
    const XML_ENTITIES = {
      className: "symbol",
      begin: /&[a-z]+;|&#[0-9]+;|&#x[a-f0-9]+;/
    };
    const XML_META_KEYWORDS = {
      begin: /\s/,
      contains: [
        {
          className: "keyword",
          begin: /#?[a-z_][a-z1-9_-]+/,
          illegal: /\n/
        }
      ]
    };
    const XML_META_PAR_KEYWORDS = hljs.inherit(XML_META_KEYWORDS, {
      begin: /\(/,
      end: /\)/
    });
    const APOS_META_STRING_MODE = hljs.inherit(hljs.APOS_STRING_MODE, { className: "string" });
    const QUOTE_META_STRING_MODE = hljs.inherit(hljs.QUOTE_STRING_MODE, { className: "string" });
    const TAG_INTERNALS = {
      endsWithParent: true,
      illegal: /</,
      relevance: 0,
      contains: [
        {
          className: "attr",
          begin: XML_IDENT_RE,
          relevance: 0
        },
        {
          begin: /=\s*/,
          relevance: 0,
          contains: [
            {
              className: "string",
              endsParent: true,
              variants: [
                {
                  begin: /"/,
                  end: /"/,
                  contains: [XML_ENTITIES]
                },
                {
                  begin: /'/,
                  end: /'/,
                  contains: [XML_ENTITIES]
                },
                { begin: /[^\s"'=<>`]+/ }
              ]
            }
          ]
        }
      ]
    };
    return {
      name: "HTML, XML",
      aliases: [
        "html",
        "xhtml",
        "rss",
        "atom",
        "xjb",
        "xsd",
        "xsl",
        "plist",
        "wsf",
        "svg"
      ],
      case_insensitive: true,
      unicodeRegex: true,
      contains: [
        {
          className: "meta",
          begin: /<![a-z]/,
          end: />/,
          relevance: 10,
          contains: [
            XML_META_KEYWORDS,
            QUOTE_META_STRING_MODE,
            APOS_META_STRING_MODE,
            XML_META_PAR_KEYWORDS,
            {
              begin: /\[/,
              end: /\]/,
              contains: [
                {
                  className: "meta",
                  begin: /<![a-z]/,
                  end: />/,
                  contains: [
                    XML_META_KEYWORDS,
                    XML_META_PAR_KEYWORDS,
                    QUOTE_META_STRING_MODE,
                    APOS_META_STRING_MODE
                  ]
                }
              ]
            }
          ]
        },
        hljs.COMMENT(
          /<!--/,
          /-->/,
          { relevance: 10 }
        ),
        {
          begin: /<!\[CDATA\[/,
          end: /\]\]>/,
          relevance: 10
        },
        XML_ENTITIES,
        // xml processing instructions
        {
          className: "meta",
          end: /\?>/,
          variants: [
            {
              begin: /<\?xml/,
              relevance: 10,
              contains: [
                QUOTE_META_STRING_MODE
              ]
            },
            {
              begin: /<\?[a-z][a-z0-9]+/
            }
          ]
        },
        {
          className: "tag",
          /*
          The lookahead pattern (?=...) ensures that 'begin' only matches
          '<style' as a single word, followed by a whitespace or an
          ending bracket.
          */
          begin: /<style(?=\s|>)/,
          end: />/,
          keywords: { name: "style" },
          contains: [TAG_INTERNALS],
          starts: {
            end: /<\/style>/,
            returnEnd: true,
            subLanguage: [
              "css",
              "xml"
            ]
          }
        },
        {
          className: "tag",
          // See the comment in the <style tag about the lookahead pattern
          begin: /<script(?=\s|>)/,
          end: />/,
          keywords: { name: "script" },
          contains: [TAG_INTERNALS],
          starts: {
            end: /<\/script>/,
            returnEnd: true,
            subLanguage: [
              "javascript",
              "handlebars",
              "xml"
            ]
          }
        },
        // we need this for now for jSX
        {
          className: "tag",
          begin: /<>|<\/>/
        },
        // open tag
        {
          className: "tag",
          begin: regex.concat(
            /</,
            regex.lookahead(regex.concat(
              TAG_NAME_RE,
              // <tag/>
              // <tag>
              // <tag ...
              regex.either(/\/>/, />/, /\s/)
            ))
          ),
          end: /\/?>/,
          contains: [
            {
              className: "name",
              begin: TAG_NAME_RE,
              relevance: 0,
              starts: TAG_INTERNALS
            }
          ]
        },
        // close tag
        {
          className: "tag",
          begin: regex.concat(
            /<\//,
            regex.lookahead(regex.concat(
              TAG_NAME_RE,
              />/
            ))
          ),
          contains: [
            {
              className: "name",
              begin: TAG_NAME_RE,
              relevance: 0
            },
            {
              begin: />/,
              relevance: 0,
              endsParent: true
            }
          ]
        }
      ]
    };
  }

  // node_modules/highlight.js/es/languages/yaml.js
  function yaml(hljs) {
    const LITERALS3 = "true false yes no null";
    const URI_CHARACTERS = "[\\w#;/?:@&=+$,.~*'()[\\]]+";
    const KEY = {
      className: "attr",
      variants: [
        // added brackets support and special char support
        { begin: /[\w*@][\w*@ :()\./-]*:(?=[ \t]|$)/ },
        {
          // double quoted keys - with brackets and special char support
          begin: /"[\w*@][\w*@ :()\./-]*":(?=[ \t]|$)/
        },
        {
          // single quoted keys - with brackets and special char support
          begin: /'[\w*@][\w*@ :()\./-]*':(?=[ \t]|$)/
        }
      ]
    };
    const TEMPLATE_VARIABLES = {
      className: "template-variable",
      variants: [
        {
          // jinja templates Ansible
          begin: /\{\{/,
          end: /\}\}/
        },
        {
          // Ruby i18n
          begin: /%\{/,
          end: /\}/
        }
      ]
    };
    const SINGLE_QUOTE_STRING = {
      className: "string",
      relevance: 0,
      begin: /'/,
      end: /'/,
      contains: [
        {
          match: /''/,
          scope: "char.escape",
          relevance: 0
        }
      ]
    };
    const STRING = {
      className: "string",
      relevance: 0,
      variants: [
        {
          begin: /"/,
          end: /"/
        },
        { begin: /\S+/ }
      ],
      contains: [
        hljs.BACKSLASH_ESCAPE,
        TEMPLATE_VARIABLES
      ]
    };
    const CONTAINER_STRING = hljs.inherit(STRING, { variants: [
      {
        begin: /'/,
        end: /'/,
        contains: [
          {
            begin: /''/,
            relevance: 0
          }
        ]
      },
      {
        begin: /"/,
        end: /"/
      },
      { begin: /[^\s,{}[\]]+/ }
    ] });
    const DATE_RE = "[0-9]{4}(-[0-9][0-9]){0,2}";
    const TIME_RE = "([Tt \\t][0-9][0-9]?(:[0-9][0-9]){2})?";
    const FRACTION_RE = "(\\.[0-9]*)?";
    const ZONE_RE = "([ \\t])*(Z|[-+][0-9][0-9]?(:[0-9][0-9])?)?";
    const TIMESTAMP = {
      className: "number",
      begin: "\\b" + DATE_RE + TIME_RE + FRACTION_RE + ZONE_RE + "\\b"
    };
    const VALUE_CONTAINER = {
      end: ",",
      endsWithParent: true,
      excludeEnd: true,
      keywords: LITERALS3,
      relevance: 0
    };
    const OBJECT = {
      begin: /\{/,
      end: /\}/,
      contains: [VALUE_CONTAINER],
      illegal: "\\n",
      relevance: 0
    };
    const ARRAY = {
      begin: "\\[",
      end: "\\]",
      contains: [VALUE_CONTAINER],
      illegal: "\\n",
      relevance: 0
    };
    const MODES5 = [
      KEY,
      {
        className: "meta",
        begin: "^---\\s*$",
        relevance: 10
      },
      {
        // multi line string
        // Blocks start with a | or > followed by a newline
        //
        // Indentation of subsequent lines must be the same to
        // be considered part of the block
        className: "string",
        begin: "[\\|>]([1-9]?[+-])?[ ]*\\n( +)[^ ][^\\n]*\\n(\\2[^\\n]+\\n?)*"
      },
      {
        // Ruby/Rails erb
        begin: "<%[%=-]?",
        end: "[%-]?%>",
        subLanguage: "ruby",
        excludeBegin: true,
        excludeEnd: true,
        relevance: 0
      },
      {
        // named tags
        className: "type",
        begin: "!\\w+!" + URI_CHARACTERS
      },
      // https://yaml.org/spec/1.2/spec.html#id2784064
      {
        // verbatim tags
        className: "type",
        begin: "!<" + URI_CHARACTERS + ">"
      },
      {
        // primary tags
        className: "type",
        begin: "!" + URI_CHARACTERS
      },
      {
        // secondary tags
        className: "type",
        begin: "!!" + URI_CHARACTERS
      },
      {
        // fragment id &ref
        className: "meta",
        begin: "&" + hljs.UNDERSCORE_IDENT_RE + "$"
      },
      {
        // fragment reference *ref
        className: "meta",
        begin: "\\*" + hljs.UNDERSCORE_IDENT_RE + "$"
      },
      {
        // array listing
        className: "bullet",
        // TODO: remove |$ hack when we have proper look-ahead support
        begin: "-(?=[ ]|$)",
        relevance: 0
      },
      hljs.HASH_COMMENT_MODE,
      {
        beginKeywords: LITERALS3,
        keywords: { literal: LITERALS3 }
      },
      TIMESTAMP,
      // numbers are any valid C-style number that
      // sit isolated from other words
      {
        className: "number",
        begin: hljs.C_NUMBER_RE + "\\b",
        relevance: 0
      },
      OBJECT,
      ARRAY,
      SINGLE_QUOTE_STRING,
      STRING
    ];
    const VALUE_MODES = [...MODES5];
    VALUE_MODES.pop();
    VALUE_MODES.push(CONTAINER_STRING);
    VALUE_CONTAINER.contains = VALUE_MODES;
    return {
      name: "YAML",
      case_insensitive: true,
      aliases: ["yml"],
      contains: MODES5
    };
  }

  // src/rich-diff/domain/diffRows.js
  function splitLines(text) {
    if (!text) return [];
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    if (normalized.endsWith("\n")) {
      lines.pop();
    }
    return lines;
  }
  function buildDiffRows(leftLines, rightLines) {
    const operations = diffLineOperations(leftLines, rightLines);
    const rows = [];
    let index = 0;
    while (index < operations.length) {
      const operation = operations[index];
      if (operation.type === "equal") {
        rows.push({
          type: "equal",
          left: operation.left,
          right: operation.right
        });
        index += 1;
        continue;
      }
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
          type: deleted[offset] && inserted[offset] ? "replace" : deleted[offset] ? "delete" : "insert",
          left: deleted[offset] || null,
          right: inserted[offset] || null
        });
      }
    }
    return rows;
  }
  function diffLineOperations(leftLines, rightLines) {
    const operations = [];
    let prefix = 0;
    while (prefix < leftLines.length && prefix < rightLines.length && leftLines[prefix] === rightLines[prefix]) {
      operations.push({
        type: "equal",
        left: createLine(leftLines[prefix], prefix + 1),
        right: createLine(rightLines[prefix], prefix + 1)
      });
      prefix += 1;
    }
    let leftEnd = leftLines.length - 1;
    let rightEnd = rightLines.length - 1;
    const suffix = [];
    while (leftEnd >= prefix && rightEnd >= prefix && leftLines[leftEnd] === rightLines[rightEnd]) {
      suffix.push({
        type: "equal",
        left: createLine(leftLines[leftEnd], leftEnd + 1),
        right: createLine(rightLines[rightEnd], rightEnd + 1)
      });
      leftEnd -= 1;
      rightEnd -= 1;
    }
    const leftMiddle = leftLines.slice(prefix, leftEnd + 1);
    const rightMiddle = rightLines.slice(prefix, rightEnd + 1);
    operations.push(
      ...diffMiddleLines(leftMiddle, rightMiddle, prefix, prefix),
      ...suffix.reverse()
    );
    return operations;
  }
  function diffMiddleLines(leftLines, rightLines, leftOffset, rightOffset) {
    if (leftLines.length === 0) {
      return rightLines.map((text, index) => ({
        type: "insert",
        right: createLine(text, rightOffset + index + 1)
      }));
    }
    if (rightLines.length === 0) {
      return leftLines.map((text, index) => ({
        type: "delete",
        left: createLine(text, leftOffset + index + 1)
      }));
    }
    const cellCount = (leftLines.length + 1) * (rightLines.length + 1);
    if (cellCount > 4e6) {
      return [
        ...leftLines.map((text, index) => ({
          type: "delete",
          left: createLine(text, leftOffset + index + 1)
        })),
        ...rightLines.map((text, index) => ({
          type: "insert",
          right: createLine(text, rightOffset + index + 1)
        }))
      ];
    }
    const width = rightLines.length + 1;
    const dp = new Uint32Array((leftLines.length + 1) * width);
    for (let leftIndex2 = leftLines.length - 1; leftIndex2 >= 0; leftIndex2 -= 1) {
      for (let rightIndex2 = rightLines.length - 1; rightIndex2 >= 0; rightIndex2 -= 1) {
        const current = leftIndex2 * width + rightIndex2;
        dp[current] = leftLines[leftIndex2] === rightLines[rightIndex2] ? dp[(leftIndex2 + 1) * width + rightIndex2 + 1] + 1 : Math.max(
          dp[(leftIndex2 + 1) * width + rightIndex2],
          dp[leftIndex2 * width + rightIndex2 + 1]
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
          right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1)
        });
        leftIndex += 1;
        rightIndex += 1;
        continue;
      }
      if (dp[(leftIndex + 1) * width + rightIndex] >= dp[leftIndex * width + rightIndex + 1]) {
        operations.push({
          type: "delete",
          left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1)
        });
        leftIndex += 1;
      } else {
        operations.push({
          type: "insert",
          right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1)
        });
        rightIndex += 1;
      }
    }
    while (leftIndex < leftLines.length) {
      operations.push({
        type: "delete",
        left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1)
      });
      leftIndex += 1;
    }
    while (rightIndex < rightLines.length) {
      operations.push({
        type: "insert",
        right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1)
      });
      rightIndex += 1;
    }
    return operations;
  }
  function createLine(text, number) {
    return { text, number };
  }
  function summarizeRows(rows) {
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
      { added: 0, deleted: 0, changed: 0 }
    );
  }

  // src/rich-diff/presentation/htmlEscape.js
  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  // src/rich-diff/presentation/highlight/tomlLanguage.js
  function tomlLanguage(hljs) {
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
          begin: /[+-]?(?:\d[\d_]*)(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?/
        }
      ]
    };
    const dateTime = {
      className: "number",
      begin: /\b\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?\b/
    };
    const literal = {
      className: "literal",
      begin: /\b(?:true|false|inf|nan)\b/
    };
    const string = {
      className: "string",
      contains: [hljs.BACKSLASH_ESCAPE],
      variants: [
        { begin: /"""/, end: /"""/ },
        { begin: /'''/, end: /'''/ },
        { begin: /"/, end: /"/ },
        { begin: /'/, end: /'/ }
      ]
    };
    const array = {
      begin: /\[/,
      end: /\]/,
      contains: [comment, string, dateTime, number, literal, "self"],
      relevance: 0
    };
    const bareKey = /[A-Za-z0-9_-]+/;
    const quotedKey = /"(?:\\.|[^"\\])*"|'[^']*'/;
    const key = regex.either(bareKey, quotedKey);
    const dottedKey = regex.concat(
      key,
      "(\\s*\\.\\s*",
      key,
      ")*",
      regex.lookahead(/\s*=/)
    );
    return {
      name: "TOML",
      aliases: ["toml"],
      contains: [
        comment,
        {
          className: "section",
          begin: /^\s*\[\[?/,
          end: /\]?\]/
        },
        {
          begin: dottedKey,
          className: "attr",
          starts: {
            end: /$/,
            contains: [comment, array, string, dateTime, number, literal]
          }
        }
      ]
    };
  }

  // src/markdown/tableCells.js
  function scanMarkdownTableRow(text) {
    const indent = text.match(/^[\t ]*/)?.[0] || "";
    let contentEnd = text.length;
    while (contentEnd > indent.length && /\s/.test(text[contentEnd - 1])) {
      contentEnd -= 1;
    }
    const usesLeadingPipe = text[indent.length] === "|";
    const contentStart = usesLeadingPipe ? indent.length + 1 : indent.length;
    const delimiterIndexes = findTableDelimiterPipes(text, contentStart, contentEnd);
    const usesTrailingPipe = delimiterIndexes.at(-1) === contentEnd - 1;
    const cells = [];
    let cellStart = contentStart;
    for (const delimiterIndex of delimiterIndexes) {
      cells.push({
        from: cellStart,
        to: delimiterIndex,
        text: text.slice(cellStart, delimiterIndex).trim()
      });
      cellStart = delimiterIndex + 1;
    }
    if (!usesTrailingPipe) {
      cells.push({
        from: cellStart,
        to: contentEnd,
        text: text.slice(cellStart, contentEnd).trim()
      });
    }
    return {
      indent,
      usesLeadingPipe,
      usesTrailingPipe,
      cells
    };
  }
  function splitMarkdownTableCells(text, options = {}) {
    return scanMarkdownTableRow(text).cells.map(
      (cell) => options.unescapePipes ? unescapeMarkdownTableCellPipes(cell.text) : cell.text
    );
  }
  function unescapeMarkdownTableCellPipes(text) {
    let result = "";
    let codeFenceLength = 0;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === "`" && !isEscapedCharacter(text, index)) {
        const runLength = countCharacterRun(text, index, "`");
        if (codeFenceLength === 0 && hasClosingBacktickRun(text, index + runLength, runLength)) {
          codeFenceLength = runLength;
        } else if (runLength === codeFenceLength) {
          codeFenceLength = 0;
        }
        result += text.slice(index, index + runLength);
        index += runLength - 1;
        continue;
      }
      if (character === "|" && codeFenceLength === 0 && isEscapedCharacter(text, index)) {
        result = result.slice(0, -1);
      }
      result += character;
    }
    return result;
  }
  function findTableDelimiterPipes(text, start, end) {
    const indexes = [];
    let codeFenceLength = 0;
    for (let index = start; index < end; index += 1) {
      const character = text[index];
      if (character === "`" && !isEscapedCharacter(text, index)) {
        const runLength = countCharacterRun(text, index, "`");
        if (codeFenceLength === 0 && hasClosingBacktickRun(text, index + runLength, runLength, end)) {
          codeFenceLength = runLength;
        } else if (runLength === codeFenceLength) {
          codeFenceLength = 0;
        }
        index += runLength - 1;
        continue;
      }
      if (character === "|" && codeFenceLength === 0 && !isEscapedCharacter(text, index)) {
        indexes.push(index);
      }
    }
    return indexes;
  }
  function isEscapedCharacter(text, index) {
    let backslashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
      backslashCount += 1;
    }
    return backslashCount % 2 === 1;
  }
  function countCharacterRun(text, start, character) {
    let end = start + 1;
    while (end < text.length && text[end] === character) {
      end += 1;
    }
    return end - start;
  }
  function hasClosingBacktickRun(text, start, runLength, end = text.length) {
    for (let index = start; index < end; index += 1) {
      if (text[index] !== "`" || isEscapedCharacter(text, index)) {
        continue;
      }
      const candidateLength = countCharacterRun(text, index, "`");
      if (candidateLength === runLength) {
        return true;
      }
      index += candidateLength - 1;
    }
    return false;
  }

  // src/rich-diff/presentation/markdownRenderer.js
  var LANGUAGE_ALIASES = /* @__PURE__ */ new Map([
    ["bf", "brainfuck"],
    ["c++", "cpp"],
    ["c#", "csharp"],
    ["cc", "cpp"],
    ["cl", "lisp"],
    ["clj", "clojure"],
    ["cljc", "clojure"],
    ["cljs", "clojure"],
    ["commonlisp", "lisp"],
    ["cr", "crystal"],
    ["cs", "csharp"],
    ["cxx", "cpp"],
    ["dartlang", "dart"],
    ["ex", "elixir"],
    ["exs", "elixir"],
    ["erl", "erlang"],
    ["f#", "fsharp"],
    ["f90", "fortran"],
    ["f95", "fortran"],
    ["fish", "bash"],
    ["flutter", "dart"],
    ["fs", "fsharp"],
    ["fsi", "fsharp"],
    ["fsx", "fsharp"],
    ["gql", "graphql"],
    ["golang", "go"],
    ["h", "cpp"],
    ["hh", "cpp"],
    ["hs", "haskell"],
    ["hpp", "cpp"],
    ["hxx", "cpp"],
    ["jl", "julia"],
    ["kt", "kotlin"],
    ["kts", "kotlin"],
    ["make", "makefile"],
    ["md", "markdown"],
    ["ml", "ocaml"],
    ["mli", "ocaml"],
    ["mysql", "sql"],
    ["objc", "objectivec"],
    ["objective-c", "objectivec"],
    ["octave", "matlab"],
    ["postgres", "sql"],
    ["postgresql", "sql"],
    ["proto", "protobuf"],
    ["ps1", "powershell"],
    ["pwsh", "powershell"],
    ["py", "python"],
    ["rb", "ruby"],
    ["rs", "rust"],
    ["rscript", "r"],
    ["sass", "scss"],
    ["scm", "scheme"],
    ["sh", "bash"],
    ["shell", "bash"],
    ["sqlite", "sql"],
    ["sv", "verilog"],
    ["systemverilog", "verilog"],
    ["terminal", "bash"],
    ["tex", "latex"],
    ["ttl", "turtle"],
    ["vb", "vbnet"],
    ["vhd", "vhdl"],
    ["visualbasic", "vbnet"],
    ["wat", "wasm"],
    ["wast", "wasm"],
    ["yml", "yaml"],
    ["zsh", "bash"]
  ]);
  function createMarkdownRenderer({ hljs, registerCopyPayload: registerCopyPayload2 }) {
    function analyzeMarkdownLines2(lines) {
      const meta = /* @__PURE__ */ new Map();
      collectCodeBlockMeta(lines, meta);
      collectTableMeta(lines, meta);
      return meta;
    }
    function collectCodeBlockMeta(lines, meta) {
      let block = null;
      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index];
        const fence = text.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
        if (!block && fence) {
          const language = normalizeLanguage(
            fence[2].trim().split(/\s+/)[0] || ""
          );
          block = {
            marker: fence[1][0],
            length: fence[1].length,
            start: index + 1,
            language,
            code: []
          };
          meta.set(index + 1, {
            kind: "codeFence",
            role: "open",
            language,
            code: ""
          });
          continue;
        }
        if (block) {
          const closing = fence && fence[1][0] === block.marker && fence[1].length >= block.length && !fence[2].trim();
          if (closing) {
            const code = block.code.join("\n");
            meta.set(block.start, {
              ...meta.get(block.start),
              code
            });
            meta.set(index + 1, {
              kind: "codeFence",
              role: "close",
              language: block.language,
              code
            });
            block = null;
            continue;
          }
          block.code.push(text);
          meta.set(index + 1, {
            kind: "code",
            language: block.language
          });
        }
      }
      if (block) {
        const code = block.code.join("\n");
        meta.set(block.start, {
          ...meta.get(block.start),
          code
        });
      }
    }
    function collectTableMeta(lines, meta) {
      let index = 0;
      while (index < lines.length - 1) {
        if (!isTableContentLine(lines[index]) || !isTableDelimiterLine(lines[index + 1])) {
          index += 1;
          continue;
        }
        meta.set(index + 1, { kind: "table", role: "header" });
        meta.set(index + 2, { kind: "table", role: "delimiter" });
        index += 2;
        while (index < lines.length && isTableRowLine(lines[index])) {
          meta.set(index + 1, { kind: "table", role: "body" });
          index += 1;
        }
      }
    }
    function normalizeLanguage(language) {
      const lower = language.toLowerCase().replace(/^language-/, "");
      if (lower === "jsx" || lower === "mjs" || lower === "cjs") return "javascript";
      if (lower === "json5") return "json";
      if (lower === "tsx") return "typescript";
      return LANGUAGE_ALIASES.get(lower) || lower;
    }
    function renderMarkdownLine2(text, meta) {
      if (!text.trim()) {
        return '<span class="rdiff-blank-line" aria-hidden="true">&nbsp;</span>';
      }
      if (meta?.kind === "codeFence") {
        return renderCodeFence(text, meta);
      }
      if (meta?.kind === "code") {
        return renderCodeLine(text, meta.language);
      }
      if (meta?.kind === "table") {
        return renderTableLine(text, meta.role);
      }
      if (isThematicBreakLine(text)) {
        return '<hr class="rdiff-hr">';
      }
      const heading = text.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (heading) {
        return `<div class="rdiff-heading rdiff-heading-${heading[1].length}">${renderInlineMarkdown(heading[2].trim())}</div>`;
      }
      const quote = text.match(/^\s{0,3}>\s?(.*)$/);
      if (quote) {
        return `<blockquote class="rdiff-quote">${renderInlineMarkdown(quote[1])}</blockquote>`;
      }
      const task = text.match(/^(\s*)[-+*]\s+\[([ xX])\]\s+(.*)$/);
      if (task) {
        const depth = Math.min(Math.floor(countIndentColumns(task[1]) / 2), 4);
        const checked = task[2].toLowerCase() === "x";
        return `<div class="rdiff-list rdiff-list-depth-${depth}"><span class="rdiff-task ${checked ? "is-checked" : ""}"></span><span>${renderInlineMarkdown(task[3])}</span></div>`;
      }
      const listMarker = parseListMarker(text);
      if (listMarker) {
        const content = text.slice(listMarker.markerTo);
        const markerClass = listMarker.ordered ? "is-ordered" : "is-unordered";
        return `<div class="rdiff-list rdiff-list-depth-${Math.min(listMarker.level, 4)}"><span class="rdiff-list-marker ${markerClass}">${escapeHtml(listMarker.marker)}</span><span>${renderInlineMarkdown(content)}</span></div>`;
      }
      return renderInlineMarkdown(text);
    }
    function renderCodeFence(text, meta) {
      const copyId = registerCopyPayload2(meta.code || "");
      const label = meta.role === "open" && meta.language ? meta.language : "";
      return `
      <div class="rdiff-code-fence">
        <span>${escapeHtml(text.trim())}</span>
        ${label ? `<span class="rdiff-code-lang">${escapeHtml(label)}</span>` : ""}
        ${meta.role === "open" && meta.code ? `<button type="button" class="rdiff-copy" data-copy-id="${copyId}">Copy</button>` : ""}
      </div>
    `;
    }
    function renderCodeLine(text, language) {
      return `<pre class="rdiff-code-line"><code>${highlightCode(text, language)}</code></pre>`;
    }
    function highlightCode(text, language) {
      if (!language) {
        return escapeHtml(text);
      }
      try {
        if (hljs.getLanguage(language)) {
          return hljs.highlight(text, { language, ignoreIllegals: true }).value;
        }
      } catch (error) {
      }
      return escapeHtml(text);
    }
    function renderTableLine(text, role) {
      if (role === "delimiter") {
        return '<div class="rdiff-table-rule"></div>';
      }
      const cells = splitTableCells(text);
      const tag = role === "header" ? "th" : "td";
      return `
      <table class="rdiff-table rdiff-table-${role}">
        <tbody>
          <tr>${cells.map((cell) => `<${tag}>${renderInlineMarkdown(cell.trim())}</${tag}>`).join("")}</tr>
        </tbody>
      </table>
    `;
    }
    function renderInlineMarkdown(text) {
      const pattern = /!\[(?<imageAlt>[^\]]*)\]\(\s*(?:<(?<imageSrcAngle>[^>]+)>|(?<imageSrc>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|`(?<code>[^`]+)`|\*\*(?<boldStar>[^*]+)\*\*|__(?<boldUnderscore>[^_]+)__|\*(?<italicStar>[^*\s][^*]*?)\*|_(?<italicUnderscore>[^_\s][^_]*?)_|~~(?<strike>[^~]+)~~|\[(?<linkText>[^\]]+)\]\(\s*(?:<(?<linkHrefAngle>[^>]+)>|(?<linkHref>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|(?<bareUrl>https?:\/\/[^\s<>"')\]]+)/g;
      let html = "";
      let lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const groups = match.groups || {};
        html += escapeHtml(text.slice(lastIndex, match.index));
        if (groups.imageAlt !== void 0) {
          const src = groups.imageSrcAngle || groups.imageSrc || "";
          html += `<span class="rdiff-image" data-image-src="${escapeAttribute(src)}" data-image-alt="${escapeAttribute(groups.imageAlt)}"><span class="rdiff-image-loading">${escapeHtml(groups.imageAlt || "Loading image")}</span></span>`;
        } else if (groups.code !== void 0) {
          html += `<code>${escapeHtml(groups.code)}</code>`;
        } else if (groups.boldStar !== void 0 || groups.boldUnderscore !== void 0) {
          html += `<strong>${escapeHtml(groups.boldStar ?? groups.boldUnderscore)}</strong>`;
        } else if (groups.italicStar !== void 0 || groups.italicUnderscore !== void 0) {
          html += `<em>${escapeHtml(groups.italicStar ?? groups.italicUnderscore)}</em>`;
        } else if (groups.strike !== void 0) {
          html += `<del>${escapeHtml(groups.strike)}</del>`;
        } else if (groups.linkText !== void 0 || groups.bareUrl !== void 0) {
          const href = groups.bareUrl || groups.linkHrefAngle || groups.linkHref || "";
          const label = groups.bareUrl || groups.linkText || href;
          html += `<a href="#" data-href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
        }
        lastIndex = match.index + match[0].length;
      }
      html += escapeHtml(text.slice(lastIndex));
      return html;
    }
    function isThematicBreakLine(text) {
      return /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(text);
    }
    function parseListMarker(text) {
      const match = text.match(/^(\s*)((?:[-+*])|(?:\d+[.)]))(\s+)/);
      if (!match) return null;
      const indentColumns = countIndentColumns(match[1]);
      return {
        marker: match[2],
        ordered: /^\d/.test(match[2]),
        level: Math.max(0, Math.floor(indentColumns / 2)),
        markerTo: match[1].length + match[2].length + match[3].length
      };
    }
    function countIndentColumns(text) {
      let columns = 0;
      for (const character of text) {
        columns += character === "	" ? 4 - columns % 4 : 1;
      }
      return columns;
    }
    function isTableContentLine(text) {
      if (!isTableRowLine(text)) {
        return false;
      }
      return splitTableCells(text).some((cell) => cell.trim());
    }
    function isTableRowLine(text) {
      if (!text.includes("|") || isTableDelimiterLine(text)) {
        return false;
      }
      return splitTableCells(text).length >= 1;
    }
    function isTableDelimiterLine(text) {
      if (!text.includes("|")) {
        return false;
      }
      return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(text);
    }
    function splitTableCells(text) {
      return splitMarkdownTableCells(text, { unescapePipes: true });
    }
    return {
      analyzeMarkdownLines: analyzeMarkdownLines2,
      renderMarkdownLine: renderMarkdownLine2
    };
  }

  // src/rich-diff/presentation/styles.js
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
    :root {
      --rdiff-add-bg: color-mix(in srgb, var(--rip-syntax-green) 16%, transparent);
      --rdiff-add-border: color-mix(in srgb, var(--rip-syntax-green) 52%, transparent);
      --rdiff-delete-bg: color-mix(in srgb, var(--rip-danger) 15%, transparent);
      --rdiff-delete-border: color-mix(in srgb, var(--rip-danger) 46%, transparent);
      --rdiff-empty-bg: color-mix(in srgb, var(--rip-panel) 48%, transparent);
    }
    .rdiff-shell {
      height: 100%;
      display: grid;
      grid-template-rows: auto auto 1fr;
      color: var(--rip-fg);
      background: var(--rip-bg);
      font-family: var(--vscode-font-family);
      font-size: 14px;
    }
    .rdiff-header {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid var(--rip-border);
      padding: 10px 14px;
      background: var(--rip-panel);
    }
    .rdiff-title {
      min-width: 0;
      display: grid;
      gap: 2px;
    }
    .rdiff-file {
      color: var(--rip-heading);
      font-weight: 760;
    }
    .rdiff-path {
      color: var(--rip-muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rdiff-stats {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
      flex: 0 0 auto;
    }
    .rdiff-stat {
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      padding: 3px 8px;
      color: var(--rip-muted);
      background: var(--rip-bg);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .rdiff-stat-add {
      color: var(--rip-syntax-green);
      border-color: var(--rdiff-add-border);
      background: var(--rdiff-add-bg);
    }
    .rdiff-stat-delete {
      color: var(--rip-danger);
      border-color: var(--rdiff-delete-border);
      background: var(--rdiff-delete-bg);
    }
    .rdiff-column-header {
      display: grid;
      grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
      border-bottom: 1px solid var(--rip-border);
      color: var(--rip-muted);
      background: color-mix(in srgb, var(--rip-panel) 82%, var(--rip-bg));
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .rdiff-column-header > div {
      min-width: 0;
      border-right: 1px solid var(--rip-border);
      padding: 7px 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rdiff-column-header > div:last-child {
      border-right: 0;
    }
    .rdiff-body {
      min-height: 0;
      overflow: auto;
      background: var(--rip-bg);
    }
    .rdiff-row {
      min-width: 760px;
      display: grid;
      grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
      border-bottom: 1px solid color-mix(in srgb, var(--rip-border) 48%, transparent);
    }
    .rdiff-side {
      min-width: 0;
      display: grid;
      grid-template-columns: 52px 26px minmax(0, 1fr);
      border-right: 1px solid var(--rip-border);
      background: var(--rip-bg);
    }
    .rdiff-side:last-child {
      border-right: 0;
    }
    .rdiff-side.is-insert {
      background: var(--rdiff-add-bg);
    }
    .rdiff-side.is-delete {
      background: var(--rdiff-delete-bg);
    }
    .rdiff-side.is-empty {
      background:
        repeating-linear-gradient(
          -45deg,
          var(--rdiff-empty-bg) 0,
          var(--rdiff-empty-bg) 8px,
          transparent 8px,
          transparent 16px
        );
    }
    .rdiff-line-number,
    .rdiff-marker {
      min-height: 28px;
      padding: 4px 6px;
      color: var(--rip-muted);
      background: color-mix(in srgb, var(--rip-panel) 58%, transparent);
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: 12px;
      line-height: 1.55;
      user-select: none;
    }
    .rdiff-line-number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .rdiff-marker {
      text-align: center;
      font-weight: 760;
    }
    .rdiff-side.is-insert .rdiff-marker {
      color: var(--rip-syntax-green);
    }
    .rdiff-side.is-delete .rdiff-marker {
      color: var(--rip-danger);
    }
    .rdiff-content {
      min-width: 0;
      min-height: 28px;
      padding: 4px 10px;
      line-height: 1.55;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .rdiff-heading {
      color: var(--rip-heading);
      font-weight: 780;
      line-height: 1.28;
    }
    .rdiff-heading-1 {
      border-bottom: 1px solid var(--rip-border);
      padding-bottom: 0.08em;
      font-size: 1.64rem;
    }
    .rdiff-heading-2 { font-size: 1.36rem; }
    .rdiff-heading-3 { font-size: 1.16rem; }
    .rdiff-heading-4,
    .rdiff-heading-5,
    .rdiff-heading-6 { font-size: 1rem; }
    .rdiff-quote {
      margin: 0;
      border-left: 4px solid var(--rip-quote-border);
      padding-left: 0.8em;
      color: var(--rip-muted);
    }
    .rdiff-list {
      display: flex;
      align-items: baseline;
      gap: 0.45em;
      padding-left: calc(var(--depth, 0) * 1.25em);
    }
    .rdiff-list-depth-1 { --depth: 1; }
    .rdiff-list-depth-2 { --depth: 2; }
    .rdiff-list-depth-3 { --depth: 3; }
    .rdiff-list-depth-4 { --depth: 4; }
    .rdiff-list-marker {
      min-width: 1.35em;
      color: var(--rip-heading);
      font-weight: 760;
      text-align: center;
    }
    .rdiff-list-marker.is-ordered {
      min-width: 2em;
      color: var(--rip-muted);
      text-align: right;
    }
    .rdiff-task {
      width: 1em;
      height: 1em;
      flex: 0 0 auto;
      display: inline-grid;
      place-items: center;
      border: 1.5px solid var(--rip-border);
      border-radius: 4px;
      background: var(--rip-input-bg);
      transform: translateY(0.14em);
    }
    .rdiff-task.is-checked {
      border-color: var(--rip-accent);
      background: var(--rip-accent);
    }
    .rdiff-task.is-checked::after {
      content: "\\2713";
      color: var(--rip-button-fg);
      font-size: 0.78em;
    }
    .rdiff-hr {
      height: 1px;
      margin: 0.7em 0;
      border: 0;
      background: var(--rip-border);
    }
    .rdiff-content code {
      border: 1px solid var(--rip-border);
      border-radius: 4px;
      padding: 0.08em 0.3em;
      background: var(--rip-code-bg);
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: 0.92em;
    }
    .rdiff-code-line,
    .rdiff-code-fence {
      margin: 0;
      border-left: 1px solid var(--rip-border);
      border-right: 1px solid var(--rip-border);
      padding: 3px 10px;
      background: color-mix(in srgb, var(--rip-panel) 92%, var(--rip-code-bg));
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: 0.92em;
      white-space: pre-wrap;
    }
    .rdiff-code-fence {
      min-height: 28px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-top: 1px solid var(--rip-border);
      border-top-left-radius: 7px;
      border-top-right-radius: 7px;
      color: var(--rip-muted);
      background: color-mix(in srgb, var(--rip-panel) 86%, var(--rip-bg));
    }
    .rdiff-code-lang {
      color: var(--rip-heading);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .rdiff-copy {
      margin-left: auto;
      border: 1px solid var(--rip-border);
      border-radius: 5px;
      padding: 2px 7px;
      color: var(--rip-muted);
      background: var(--rip-panel);
      font: 11px var(--vscode-font-family);
      cursor: pointer;
    }
    .rdiff-copy:hover {
      color: var(--rip-heading);
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .rdiff-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--rip-border);
      border-radius: 7px;
      overflow: hidden;
      background: var(--rip-panel);
      font-size: 0.95em;
    }
    .rdiff-table th,
    .rdiff-table td {
      border-right: 1px solid var(--rip-border);
      padding: 6px 9px;
      text-align: left;
      vertical-align: top;
    }
    .rdiff-table th:last-child,
    .rdiff-table td:last-child {
      border-right: 0;
    }
    .rdiff-table th {
      color: var(--rip-heading);
      background: color-mix(in srgb, var(--rip-heading) 10%, var(--rip-panel));
      font-weight: 760;
    }
    .rdiff-table-rule {
      height: 1px;
      margin: 4px 0;
      background: color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .rdiff-image {
      max-width: 100%;
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      vertical-align: top;
    }
    .rdiff-image img {
      width: auto;
      height: auto;
      max-width: min(100%, 520px);
      max-height: 320px;
      display: block;
      border: 1px solid var(--rip-border);
      border-radius: 7px;
      background: var(--rip-panel);
      aspect-ratio: auto;
      object-fit: contain;
    }
    .rdiff-image-loading,
    .rdiff-image-error {
      color: var(--rip-muted);
      font-size: 12px;
    }
    .rdiff-content a {
      color: var(--rip-link);
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .rdiff-content strong { font-weight: 760; }
    .rdiff-content em { font-style: italic; }
    .rdiff-content del { color: var(--rip-muted); }
    .rdiff-blank-line {
      display: inline-block;
      min-height: 1.55em;
    }
    .rdiff-empty {
      height: 100%;
      display: grid;
      place-content: center;
      gap: 6px;
      color: var(--rip-muted);
      text-align: center;
    }
    .rdiff-empty-title {
      color: var(--rip-heading);
      font-weight: 760;
    }
    .hljs-keyword,
    .hljs-built_in,
    .hljs-selector-tag {
      color: var(--rip-syntax-purple);
    }
    .hljs-string,
    .hljs-attr,
    .hljs-attribute {
      color: var(--rip-syntax-orange);
    }
    .hljs-number,
    .hljs-literal {
      color: var(--rip-syntax-green);
    }
    .hljs-title,
    .hljs-name,
    .hljs-property {
      color: var(--rip-syntax-blue);
    }
    .hljs-comment {
      color: var(--rip-muted);
      font-style: italic;
    }
    @media (max-width: 860px) {
      .rdiff-header {
        align-items: flex-start;
        flex-direction: column;
      }
      .rdiff-column-header,
      .rdiff-row {
        grid-template-columns: minmax(360px, 1fr);
      }
      .rdiff-side {
        border-right: 0;
      }
      .rdiff-left {
        border-bottom: 1px solid var(--rip-border);
      }
    }
  `;
    document.head.appendChild(style);
  }

  // src/rich-diff/presentation/theme.js
  var richThemeValues = [
    "default",
    "midnight",
    "graphite",
    "forest",
    "ivory",
    "paper",
    "solar"
  ];
  function normalizeSettings(nextSettings = {}) {
    return {
      richTheme: richThemeValues.includes(nextSettings.richTheme) ? nextSettings.richTheme : "default"
    };
  }
  function applyTheme(themeName) {
    const theme = getTheme(themeName);
    const rootStyle = document.documentElement.style;
    document.documentElement.dataset.richTheme = themeName || "default";
    for (const [key, value] of Object.entries(theme)) {
      rootStyle.setProperty(
        `--rip-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
        value
      );
    }
  }
  function getTheme(themeName) {
    const themes = {
      default: {
        bg: "var(--vscode-editor-background)",
        fg: "var(--vscode-editor-foreground)",
        muted: "var(--vscode-descriptionForeground)",
        border: "var(--vscode-panel-border)",
        panel: "var(--vscode-editorWidget-background)",
        inputBg: "var(--vscode-input-background)",
        codeBg: "var(--vscode-textCodeBlock-background)",
        hover: "color-mix(in srgb, var(--vscode-editor-selectionBackground) 16%, transparent)",
        focus: "var(--vscode-focusBorder)",
        accent: "var(--vscode-button-background)",
        buttonFg: "var(--vscode-button-foreground)",
        heading: "var(--vscode-textLink-foreground)",
        link: "var(--vscode-textLink-foreground)",
        quoteBorder: "var(--vscode-textBlockQuote-border)",
        syntaxPurple: "var(--vscode-charts-purple, #c586c0)",
        syntaxOrange: "var(--vscode-charts-orange, #ce9178)",
        syntaxGreen: "var(--vscode-charts-green, #b5cea8)",
        syntaxBlue: "var(--vscode-charts-blue, #9cdcfe)",
        danger: "var(--vscode-errorForeground, #f14c4c)"
      },
      midnight: {
        bg: "#0b1020",
        fg: "#d9e4ff",
        muted: "#8796b8",
        border: "#26314f",
        panel: "#111936",
        inputBg: "#0f1730",
        codeBg: "#070b16",
        hover: "rgba(93, 144, 255, 0.14)",
        focus: "#7aa2ff",
        accent: "#6f9cff",
        buttonFg: "#081120",
        heading: "#8fb4ff",
        link: "#8fb4ff",
        quoteBorder: "#5e7fd6",
        syntaxPurple: "#d7a7ff",
        syntaxOrange: "#ffc08a",
        syntaxGreen: "#9ce6b3",
        syntaxBlue: "#8bd7ff",
        danger: "#ff8a8a"
      },
      graphite: {
        bg: "#151617",
        fg: "#e5e1d8",
        muted: "#9b9891",
        border: "#343536",
        panel: "#202224",
        inputBg: "#1b1d1f",
        codeBg: "#101112",
        hover: "rgba(229, 225, 216, 0.08)",
        focus: "#d0a85c",
        accent: "#d0a85c",
        buttonFg: "#171717",
        heading: "#e2bd72",
        link: "#e2bd72",
        quoteBorder: "#8e7a55",
        syntaxPurple: "#cfa8ff",
        syntaxOrange: "#e6b17e",
        syntaxGreen: "#9bcf9d",
        syntaxBlue: "#8ebbdc",
        danger: "#ff8f8f"
      },
      forest: {
        bg: "#0f1712",
        fg: "#dce8dc",
        muted: "#8ea08f",
        border: "#263529",
        panel: "#17231a",
        inputBg: "#121d15",
        codeBg: "#0a100c",
        hover: "rgba(121, 184, 136, 0.12)",
        focus: "#79b888",
        accent: "#79b888",
        buttonFg: "#071008",
        heading: "#a4d8a9",
        link: "#9fd6b3",
        quoteBorder: "#5b936a",
        syntaxPurple: "#d0a8ff",
        syntaxOrange: "#e9bd8c",
        syntaxGreen: "#93d79b",
        syntaxBlue: "#8fcbd4",
        danger: "#ff8a8a"
      },
      ivory: {
        bg: "#fbf5e8",
        fg: "#2f2b25",
        muted: "#776f62",
        border: "#ded3bf",
        panel: "#f1e7d5",
        inputBg: "#fffaf0",
        codeBg: "#f2eadc",
        hover: "rgba(107, 78, 42, 0.09)",
        focus: "#a46c28",
        accent: "#a46c28",
        buttonFg: "#fff8ee",
        heading: "#7a4f1e",
        link: "#8a5a24",
        quoteBorder: "#bc8f55",
        syntaxPurple: "#8a4fb0",
        syntaxOrange: "#a75d17",
        syntaxGreen: "#3f7a3f",
        syntaxBlue: "#2e6f9f",
        danger: "#b42318"
      },
      paper: {
        bg: "#ffffff",
        fg: "#202124",
        muted: "#6b7280",
        border: "#d7dbe2",
        panel: "#f3f5f8",
        inputBg: "#ffffff",
        codeBg: "#f5f7fa",
        hover: "rgba(31, 111, 235, 0.08)",
        focus: "#1f6feb",
        accent: "#1f6feb",
        buttonFg: "#ffffff",
        heading: "#0b5cad",
        link: "#0b5cad",
        quoteBorder: "#8aa6c8",
        syntaxPurple: "#7c3aed",
        syntaxOrange: "#b45309",
        syntaxGreen: "#15803d",
        syntaxBlue: "#0369a1",
        danger: "#b42318"
      },
      solar: {
        bg: "#fdf6e3",
        fg: "#3b3a32",
        muted: "#7b7662",
        border: "#d8ceb0",
        panel: "#eee5c8",
        inputBg: "#fff9e8",
        codeBg: "#f4edcf",
        hover: "rgba(181, 137, 0, 0.1)",
        focus: "#b58900",
        accent: "#b58900",
        buttonFg: "#fff8df",
        heading: "#9b6d00",
        link: "#0f6c8c",
        quoteBorder: "#b58900",
        syntaxPurple: "#6c54a3",
        syntaxOrange: "#b85c00",
        syntaxGreen: "#5f7f00",
        syntaxBlue: "#227894",
        danger: "#b42318"
      }
    };
    return themes[themeName] || themes.default;
  }

  // src/richDiff.js
  function registerCodeLanguage(name, language, aliases = []) {
    core_default.registerLanguage(name, language);
    if (aliases.length) {
      core_default.registerAliases(aliases, { languageName: name });
    }
  }
  registerCodeLanguage("bash", bash, [
    "console",
    "fish",
    "sh",
    "shell",
    "terminal",
    "zsh"
  ]);
  registerCodeLanguage("brainfuck", brainfuck, ["bf"]);
  registerCodeLanguage("c", c);
  registerCodeLanguage("clojure", clojure, ["clj", "cljs", "cljc"]);
  registerCodeLanguage("cmake", cmake);
  registerCodeLanguage("cpp", cpp, ["c++", "cc", "cxx", "h", "hh", "hpp", "hxx"]);
  registerCodeLanguage("crystal", crystal, ["cr"]);
  registerCodeLanguage("css", css);
  registerCodeLanguage("csharp", csharp, ["c#", "cs"]);
  registerCodeLanguage("d", d);
  registerCodeLanguage("dart", dart);
  registerCodeLanguage("diff", diff, ["patch"]);
  registerCodeLanguage("dockerfile", dockerfile, ["docker"]);
  registerCodeLanguage("elixir", elixir, ["ex", "exs"]);
  registerCodeLanguage("elm", elm);
  registerCodeLanguage("erlang", erlang, ["erl"]);
  registerCodeLanguage("fortran", fortran, ["f90", "f95"]);
  registerCodeLanguage("fsharp", fsharp, ["f#", "fs", "fsi", "fsx"]);
  registerCodeLanguage("gherkin", gherkin, ["cucumber", "feature"]);
  registerCodeLanguage("go", go, ["golang"]);
  registerCodeLanguage("gradle", gradle);
  registerCodeLanguage("graphql", graphql, ["gql"]);
  registerCodeLanguage("groovy", groovy);
  registerCodeLanguage("haskell", haskell, ["hs"]);
  registerCodeLanguage("http", http);
  registerCodeLanguage("ini", ini);
  registerCodeLanguage("java", java);
  registerCodeLanguage("javascript", javascript, ["cjs", "js", "jsx", "mjs"]);
  registerCodeLanguage("json", json, ["json5", "jsonc"]);
  registerCodeLanguage("julia", julia, ["jl"]);
  registerCodeLanguage("kotlin", kotlin, ["kt", "kts"]);
  registerCodeLanguage("latex", latex, ["tex"]);
  registerCodeLanguage("less", less);
  registerCodeLanguage("lisp", lisp, ["cl", "commonlisp"]);
  registerCodeLanguage("lua", lua);
  registerCodeLanguage("makefile", makefile, ["make"]);
  registerCodeLanguage("markdown", markdown, ["md"]);
  registerCodeLanguage("matlab", matlab, ["octave"]);
  registerCodeLanguage("nginx", nginx);
  registerCodeLanguage("objectivec", objectivec, ["objc", "objective-c"]);
  registerCodeLanguage("ocaml", ocaml, ["ml", "mli"]);
  registerCodeLanguage("php", php);
  registerCodeLanguage("powershell", powershell, ["ps1", "pwsh"]);
  registerCodeLanguage("properties", properties, ["conf"]);
  registerCodeLanguage("protobuf", protobuf, ["proto"]);
  registerCodeLanguage("puppet", puppet, ["pp"]);
  registerCodeLanguage("python", python, ["py"]);
  registerCodeLanguage("r", r, ["rscript"]);
  registerCodeLanguage("ruby", ruby, ["rb"]);
  registerCodeLanguage("rust", rust, ["rs"]);
  registerCodeLanguage("sas", sas);
  registerCodeLanguage("scala", scala);
  registerCodeLanguage("scheme", scheme, ["scm"]);
  registerCodeLanguage("scss", scss, ["sass"]);
  registerCodeLanguage("smalltalk", smalltalk, ["st"]);
  registerCodeLanguage("sql", sql, ["mysql", "postgres", "postgresql", "sqlite"]);
  registerCodeLanguage("stylus", stylus, ["styl"]);
  registerCodeLanguage("swift", swift);
  registerCodeLanguage("thrift", thrift);
  registerCodeLanguage("toml", tomlLanguage);
  registerCodeLanguage("typescript", typescript, ["ts", "tsx"]);
  registerCodeLanguage("vbnet", vbnet, ["vb", "visualbasic"]);
  registerCodeLanguage("verilog", verilog, ["sv", "systemverilog"]);
  registerCodeLanguage("vhdl", vhdl, ["vhd"]);
  registerCodeLanguage("wasm", wasm, ["wat", "wast"]);
  registerCodeLanguage("xml", xml, ["html", "svg"]);
  registerCodeLanguage("yaml", yaml, ["yml"]);
  var vscode = acquireVsCodeApi();
  var root = document.querySelector("#diff");
  var initialDiff = JSON.parse(
    document.querySelector("#initial-diff").textContent
  );
  var initialSettings = JSON.parse(
    document.querySelector("#initial-settings").textContent
  );
  var diffData = {
    leftText: initialDiff.leftText || "",
    rightText: initialDiff.rightText || "",
    leftLabel: initialDiff.leftLabel || "Base",
    rightLabel: initialDiff.rightLabel || "Working Tree",
    fileName: initialDiff.fileName || "Markdown",
    filePath: initialDiff.filePath || ""
  };
  var settings = normalizeSettings(initialSettings);
  var imageRequestId = 0;
  var copyPayloadId = 0;
  var copyPayloads = /* @__PURE__ */ new Map();
  var pendingImageRequests = /* @__PURE__ */ new Map();
  var { analyzeMarkdownLines, renderMarkdownLine } = createMarkdownRenderer({
    hljs: core_default,
    registerCopyPayload
  });
  injectStyles();
  applyTheme(settings.richTheme);
  renderDiff();
  window.addEventListener("message", (event) => {
    if (!event.data) return;
    if (event.data.type === "resolvedImage") {
      const pending = pendingImageRequests.get(event.data.requestId);
      if (!pending) return;
      window.clearTimeout(pending.timeout);
      pendingImageRequests.delete(event.data.requestId);
      if (event.data.uri) {
        pending.element.innerHTML = `<img alt="${escapeAttribute(pending.alt)}" src="${escapeAttribute(event.data.uri)}">`;
      } else {
        pending.element.innerHTML = `<span class="rdiff-image-error">${escapeHtml(pending.alt || "Image could not be loaded")}</span>`;
      }
      return;
    }
    if (event.data.type === "settings") {
      settings = normalizeSettings({
        ...settings,
        ...event.data.settings
      });
      applyTheme(settings.richTheme);
      renderDiff();
      return;
    }
    if (event.data.type === "updateRight" && typeof event.data.text === "string") {
      diffData = {
        ...diffData,
        rightText: event.data.text
      };
      renderDiff();
    }
  });
  root.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-id]");
    if (copyButton) {
      const text = copyPayloads.get(copyButton.dataset.copyId);
      if (typeof text === "string") {
        vscode.postMessage({ type: "copyText", text });
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 900);
      }
      return;
    }
    const link = event.target.closest("a[data-href]");
    if (link) {
      event.preventDefault();
      vscode.postMessage({ type: "openLink", href: link.dataset.href });
    }
  });
  function renderDiff() {
    copyPayloadId = 0;
    copyPayloads = /* @__PURE__ */ new Map();
    pendingImageRequests.forEach((pending) => window.clearTimeout(pending.timeout));
    pendingImageRequests.clear();
    const leftLines = splitLines(diffData.leftText);
    const rightLines = splitLines(diffData.rightText);
    const rows = buildDiffRows(leftLines, rightLines);
    const stats = summarizeRows(rows);
    const leftMeta = analyzeMarkdownLines(leftLines);
    const rightMeta = analyzeMarkdownLines(rightLines);
    root.innerHTML = `
    <div class="rdiff-shell">
      <header class="rdiff-header">
        <div class="rdiff-title">
          <div class="rdiff-file">${escapeHtml(diffData.fileName)}</div>
          <div class="rdiff-path">${escapeHtml(diffData.filePath)}</div>
        </div>
        <div class="rdiff-stats" aria-label="Diff summary">
          <span class="rdiff-stat rdiff-stat-add">+${stats.added}</span>
          <span class="rdiff-stat rdiff-stat-delete">-${stats.deleted}</span>
          <span class="rdiff-stat">${stats.changed} changed lines</span>
        </div>
      </header>
      <div class="rdiff-column-header" aria-hidden="true">
        <div>${escapeHtml(diffData.leftLabel)}</div>
        <div>${escapeHtml(diffData.rightLabel)}</div>
      </div>
      <main class="rdiff-body">
        ${rows.length ? rows.map((row) => renderDiffRow(row, leftMeta, rightMeta)).join("") : renderEmptyDiff()}
      </main>
    </div>
  `;
    resolveImages();
  }
  function renderEmptyDiff() {
    return `
    <div class="rdiff-empty">
      <div class="rdiff-empty-title">No changes</div>
      <div class="rdiff-empty-copy">The Markdown content matches the selected base.</div>
    </div>
  `;
  }
  function renderDiffRow(row, leftMeta, rightMeta) {
    const rowClass = `rdiff-row is-${row.type}`;
    return `
    <div class="${rowClass}">
      ${renderSide(row.left, leftMeta, "left", row.type)}
      ${renderSide(row.right, rightMeta, "right", row.type)}
    </div>
  `;
  }
  function renderSide(line, metaByLine, side, rowType) {
    const sideType = getSideType(side, rowType);
    const lineNumber = line ? String(line.number) : "";
    const marker = getSideMarker(side, rowType);
    const meta = line ? metaByLine.get(line.number) : null;
    const content = line ? renderMarkdownLine(line.text, meta) : "";
    return `
    <section class="rdiff-side rdiff-${side} is-${sideType}">
      <div class="rdiff-line-number">${lineNumber}</div>
      <div class="rdiff-marker">${marker}</div>
      <div class="rdiff-content">${content}</div>
    </section>
  `;
  }
  function getSideType(side, rowType) {
    if (rowType === "equal") return "equal";
    if (rowType === "delete") return side === "left" ? "delete" : "empty";
    if (rowType === "insert") return side === "right" ? "insert" : "empty";
    return side === "left" ? "delete" : "insert";
  }
  function getSideMarker(side, rowType) {
    if (rowType === "delete" && side === "left") return "-";
    if (rowType === "insert" && side === "right") return "+";
    if (rowType === "replace" && side === "left") return "-";
    if (rowType === "replace" && side === "right") return "+";
    return "";
  }
  function registerCopyPayload(text) {
    copyPayloadId += 1;
    const id = String(copyPayloadId);
    copyPayloads.set(id, text);
    return id;
  }
  function resolveImages() {
    root.querySelectorAll("[data-image-src]").forEach((element) => {
      const src = element.dataset.imageSrc;
      if (!src) return;
      const requestId = imageRequestId += 1;
      const timeout = window.setTimeout(() => {
        pendingImageRequests.delete(requestId);
        element.innerHTML = '<span class="rdiff-image-error">Image could not be loaded</span>';
      }, 4e3);
      pendingImageRequests.set(requestId, {
        element,
        alt: element.dataset.imageAlt || "",
        timeout
      });
      vscode.postMessage({ type: "resolveImage", requestId, src });
    });
  }
})();
