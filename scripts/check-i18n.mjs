#!/usr/bin/env node
// Checks that every namespace exists in az/ru/en with the same keys and the same {{placeholders}}.
// Plural forms only Russian needs (_few/_many) may be missing in az/en. Run: npm run i18n:check
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..", "src", "lib", "i18n", "messages");
const LOCALES = ["az", "ru", "en"];
const OPTIONAL_PLURALS = /_(zero|two|few|many)$/;

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const placeholders = (s) => (typeof s === "string" ? [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",") : "");

let problems = 0;
const namespaces = new Set(LOCALES.flatMap((l) => readdirSync(path.join(ROOT, l)).filter((f) => f.endsWith(".json"))));
for (const file of [...namespaces].sort()) {
  const data = {};
  for (const l of LOCALES) {
    try {
      data[l] = flatten(JSON.parse(readFileSync(path.join(ROOT, l, file), "utf8")));
    } catch (e) {
      console.error(`✗ ${l}/${file}: ${e.message}`);
      problems += 1;
    }
  }
  const all = new Set(LOCALES.flatMap((l) => Object.keys(data[l] ?? {})));
  for (const key of all) {
    for (const l of LOCALES) {
      const value = data[l]?.[key];
      if (value === undefined) {
        if (OPTIONAL_PLURALS.test(key)) continue;
        console.error(`✗ ${file}: "${key}" missing in ${l}`);
        problems += 1;
      } else if (typeof value === "string" && !value.trim()) {
        console.error(`✗ ${file}: "${key}" is empty in ${l}`);
        problems += 1;
      }
    }
    const ref = data.az?.[key];
    for (const l of ["ru", "en"]) {
      const v = data[l]?.[key];
      if (ref !== undefined && v !== undefined && placeholders(ref) !== placeholders(v)) {
        console.error(`✗ ${file}: "${key}" placeholders differ (az: ${placeholders(ref)} / ${l}: ${placeholders(v)})`);
        problems += 1;
      }
    }
  }
}
if (problems) {
  console.error(`\n${problems} problem(s).`);
  process.exit(1);
}
console.log(`✓ ${namespaces.size} namespaces × ${LOCALES.length} locales are in sync.`);
