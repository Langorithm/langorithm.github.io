// Generates src/strudel-api.ts from data shipped with the installed Strudel
// packages, so completions always match the Strudel version flok runs:
//
// - Function docs: Strudel's own doc.json (JSDoc of every documented
//   function). It isn't published on its own, but @strudel/codemirror bundles
//   it into its dist for the REPL's autocomplete, so we extract it from there.
// - Chord symbols: the default (ireal) voicing dictionary from @strudel/tonal.
// - Scale names: tonal's scale types, which @strudel/tonal's scale() uses.
//
// Run with: npm run generate

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const versionOf = (name) =>
  JSON.parse(readFileSync(join(pkgDir(name), "package.json"), "utf8")).version;

// --- Function docs ---

const extractDocs = () => {
  const dist = readFileSync(
    join(pkgDir("@strudel/codemirror"), "dist", "index.mjs"),
    "utf8",
  );
  // The bundler inlines doc.json as JSON.parse(`[...]`); find the literal
  // holding JSDoc entries.
  const marker = '"longname":';
  const at = dist.indexOf(marker);
  if (at < 0) throw new Error("doc data not found in @strudel/codemirror dist");
  const start = dist.lastIndexOf("JSON.parse(`", at);
  // The closing backtick is the first one not escaped inside the literal.
  const close = /(?<!\\)`\)/g;
  close.lastIndex = at;
  const end = close.exec(dist)?.index ?? -1;
  if (start < 0 || end < 0)
    throw new Error("unexpected doc data layout in @strudel/codemirror dist");
  const literal = dist.slice(start + "JSON.parse(".length, end + 1);
  return JSON.parse(Function(`return ${literal}`)());
};

const entities = {
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&nbsp;": " ",
};

const htmlToText = (html = "") =>
  html
    .replace(/<code>(.*?)<\/code>/gs, "`$1`")
    .replace(/<\/p>\s*<p>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<li>/g, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(quot|#39|lt|gt|amp|nbsp);/g, (e) => entities[e])
    .replace(/\n{2,}/g, "\n")
    .trim();

const hasTag = (doc, tag) => doc.tags?.some((t) => t.originalTitle === tag);

// The Strudel REPL's autocomplete filter, plus classes and internals.
const isCompletable = (doc) => {
  const name = doc.name || doc.longname;
  return (
    name &&
    !name.startsWith("_") &&
    doc.kind !== "package" &&
    doc.kind !== "class" &&
    !internalFiles.has(doc.meta?.filename) &&
    !hasTag(doc, "superdirtOnly") &&
    !hasTag(doc, "noAutocomplete")
  );
};

// Files whose JSDoc documents Strudel's internals rather than its API: the
// audio engine (dough.mjs documents its own attack, cutoff, note... which
// would shadow the real controls), worklet helpers and utilities.
const internalFiles = new Set([
  "dough.mjs",
  "ola-processor.js",
  "worklets.mjs",
  "util.mjs",
  "reverbGen.mjs",
]);

// Signals (sine, rand, time, ...) are values, not chainable methods. JSDoc's
// kind doesn't tell them apart (jux is a "constant", rand a "member"), so
// count only parameterless signals whose examples never call them.
const isValue = (doc) =>
  doc.meta?.filename === "signal.mjs" &&
  !doc.params?.length &&
  !(doc.examples ?? []).some((e) => e.includes(`${doc.name}(`));

const functions = [];
const seen = new Set();
for (const doc of extractDocs()) {
  if (!isCompletable(doc)) continue;
  const name = doc.name || doc.longname;
  if (seen.has(name)) continue;
  seen.add(name);
  functions.push({
    name,
    synonyms: (doc.synonyms ?? []).filter((s) => s !== name),
    value: isValue(doc),
    description: htmlToText(doc.description),
    params: (doc.params ?? [])
      .filter((p) => p.name)
      .map((p) => ({
        name: p.name,
        type: p.type?.names?.join(" | ") ?? "",
        description: htmlToText(p.description),
      })),
    examples: (doc.examples ?? []).slice(0, 2),
    file: doc.meta?.filename,
  });
}
functions.sort((a, b) => a.name.localeCompare(b.name));

// --- Docs links ---

// Strudel's reference pages give each function its own section, with the
// lower-cased name as its id (learn/effects#lpf). Collect those ids so
// Alt-click can open the right one. Needs the network; without it the links
// are left out and everything else still generates.
const docsPages = [
  "learn/effects", "learn/signals", "learn/time-modifiers",
  "learn/conditional-modifiers", "learn/accumulation", "learn/random-modifiers",
  "learn/tonal", "learn/synths", "learn/samples", "learn/factories",
  "learn/stepwise", "learn/lfo", "learn/visual-feedback", "learn/input-output",
  "learn/input-devices", "learn/devicemotion", "learn/xen", "learn/csound",
  "functions/value-modifiers",
];
const sectionUrls = new Map();
try {
  for (const page of docsPages) {
    const html = await (await fetch(`https://strudel.cc/${page}/`)).text();
    for (const [, id] of html.matchAll(/id="([a-z0-9-]+)"/g))
      if (!sectionUrls.has(id)) sectionUrls.set(id, `https://strudel.cc/${page}/#${id}`);
  }
} catch (err) {
  console.warn(`Couldn't fetch strudel.cc docs, leaving out links: ${err.message}`);
}
const urlOf = (fn) => {
  for (const name of [fn.name, ...fn.synonyms]) {
    const id = name.toLowerCase();
    if (sectionUrls.has(id)) return sectionUrls.get(id);
  }
  return undefined;
};
for (const fn of functions) fn.url = urlOf(fn);

// Group functions by the docs page that covers them, so lists can show what
// a function is for: lpf is on learn/effects, so it's an effect.
const groupByPage = {
  "learn/samples": "sound",
  "learn/synths": "sound",
  "learn/effects": "effects",
  "learn/lfo": "effects",
  "learn/time-modifiers": "time",
  "learn/stepwise": "time",
  "learn/tonal": "pitch",
  "learn/xen": "pitch",
  "learn/random-modifiers": "random",
  "learn/conditional-modifiers": "conditional",
  "learn/accumulation": "accumulation",
  "functions/value-modifiers": "values",
  "learn/factories": "patterns",
  "learn/signals": "signals",
  "learn/visual-feedback": "visuals",
  "learn/input-output": "devices",
  "learn/input-devices": "devices",
  "learn/devicemotion": "devices",
  "learn/csound": "devices",
};
// Without a docs section, the source file says what it's for.
const groupByFile = {
  "controls.mjs": "effects",
  "tonal.mjs": "pitch",
  "voicings.mjs": "pitch",
  "signal.mjs": "signals",
  "pattern.mjs": "patterns",
  "euclid.mjs": "time",
  "pick.mjs": "conditional",
  "motion.mjs": "devices",
  "midi.mjs": "devices",
  "osc.mjs": "devices",
  "pianoroll.mjs": "visuals",
  "scope.mjs": "visuals",
  "drawLine.mjs": "visuals",
};
// The core of every sound chain, whatever page or file they come from.
const soundCore = new Set(["s", "sound", "n", "note", "bank"]);
for (const fn of functions) {
  const page = fn.url?.match(/strudel\.cc\/(.+?)\/#/)?.[1];
  fn.group = soundCore.has(fn.name)
    ? "sound"
    : (page && groupByPage[page]) || groupByFile[fn.file] || "setup";
  delete fn.file;
}

// --- Chords and scales ---

const tonalDir = pkgDir("@strudel/tonal");
const { complex } = await import(
  pathToFileURL(join(tonalDir, "ireal.mjs")).href
);
// The empty key is the plain major triad: chord("C").
const chordSymbols = Object.keys(complex).filter((s) => s !== "");

const scaleType = await import(
  pathToFileURL(require.resolve("@tonaljs/scale-type")).href
);
// In mini-notation spaces separate events, so scale() takes "C:minor:blues".
const scaleNames = (scaleType.names ?? scaleType.default.names)()
  .map((n) => n.replace(/ /g, ":"))
  .sort();

const out = `// Generated by script/generate.js from @strudel/codemirror@${versionOf("@strudel/codemirror")}
// (doc data), @strudel/tonal@${versionOf("@strudel/tonal")} (chords) and
// @tonaljs/scale-type@${versionOf("@tonaljs/scale-type")} (scales) — do not edit.
// Regenerate with: npm run generate

export interface StrudelParam {
  name: string;
  /** JSDoc type, e.g. "number | Pattern" */
  type: string;
  description: string;
}

export interface StrudelFn {
  name: string;
  /** Other names for the same function: lpf, cutoff, ctf, lp */
  synonyms: string[];
  /** True for values (sine, rand, ...) that are not chainable methods. */
  value: boolean;
  description: string;
  params: StrudelParam[];
  examples: string[];
  /** Its section in Strudel's docs, when it has one */
  url?: string;
  /** What it's for, from its docs page: sound, effects, time, ... setup */
  group: string;
}

export const strudelFunctions: StrudelFn[] = ${JSON.stringify(functions, null, 2)};

/** Chord symbols for chord(): written after the root, as in "C^7" */
export const chordSymbols: string[] = ${JSON.stringify(chordSymbols)};

/** Scale names for scale(): written after the tonic, as in "C:minor:blues" */
export const scaleNames: string[] = ${JSON.stringify(scaleNames)};
`;

const dest = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "strudel-api.ts",
);
writeFileSync(dest, out);
console.log(
  `Wrote ${functions.length} functions (${functions.filter((f) => f.url).length} with docs links), ${chordSymbols.length} chord symbols, ${scaleNames.length} scales to src/strudel-api.ts`,
);
