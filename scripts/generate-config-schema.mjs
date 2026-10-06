// Writes schemas/richdownrc.schema.json from the formatter and lint rule
// definitions, so .richdownrc.json completion always lists the current rules.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { buildConfigSchema } = require("../src/host/markdownQualityConfig.js");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(repoRoot, "schemas", "richdownrc.schema.json");
writeFileSync(target, `${JSON.stringify(buildConfigSchema(), null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, target)}`);
