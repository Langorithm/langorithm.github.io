// Prints what completion offers at each cursor position (marked |), using a
// small fake sound map. Run after building: node test/completions.mjs

import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { ensureSyntaxTree } from "@codemirror/language";
import { strudel, strudelLearn } from "@flok-editor/lang-strudel";

const sounds = [
  { name: "bd", type: "sample", count: 24 },
  { name: "sd", type: "sample", count: 8 },
  { name: "hh", type: "sample", count: 13 },
  { name: "cr", type: "sample", count: 3 },
  { name: "bass", type: "sample", count: 4 },
  { name: "sine", type: "synth" },
  { name: "snare_modern", type: "sample", count: 2 },
  { name: "tr909_bd", type: "sample", count: 2 },
  { name: "tr909_sd", type: "sample", count: 2 },
];
const bankNames = { tr909: "RolandTR909" };
const ext = strudel({ sounds: () => sounds, bankNames: () => bankNames });

const run = (src, { explicit = true } = {}) => {
  const pos = src.indexOf("|");
  const doc = src.slice(0, pos) + src.slice(pos + 1);
  const state = EditorState.create({ doc, extensions: ext, selection: { anchor: pos } });
  ensureSyntaxTree(state, doc.length, 5000);
  const [source] = state.languageDataAt("autocomplete", pos);
  const r = source(new CompletionContext(state, pos, explicit));
  if (!r) return `${src.padEnd(30)} → null`;
  const typed = doc.slice(r.from, pos);
  const opts =
    r.filter === false ? r.options : r.options.filter((o) => o.label.startsWith(typed));
  return (
    `${src.padEnd(30)} → ` +
    opts
      .slice(0, 7)
      .map((o) => `${o.label}${o.detail ? ` (${o.detail})` : ""}`)
      .join(", ")
  );
};

const cases = [
  // sounds, searched by name or meaning
  ['s("|")'], ['s("kick|")'], ['s("cym|")'], ['s("sn|")'], ['s("bd:|")'],
  ['s(|)'], ['s("rol|")'], ['s("tr|")'], ['s("|").bank("tr909")'], ['s("bd").bank("rol|")'],
  // symbols: after a step, at a step start, between steps
  ['s("bd|")'], ['s("bd |")'], ['s("[bd sd]|")'], ['n("0 2|")'], ['n("<|")'],
  ['note("c e|")'], ["s('bd|')"],
  // symbols only when asked for
  ['s("bd |")', { explicit: false }],
  // functions
  ['s("x").ju|'], ['si|'],
];
for (const [src, opts] of cases) console.log(run(src, opts));

// Alt-hover: what's underlined and the tip, with the mouse at |.
const hover = (src, mode = "learn") => {
  const pos = src.indexOf("|");
  const doc = src.slice(0, pos) + src.slice(pos + 1);
  const state = EditorState.create({ doc, extensions: ext });
  ensureSyntaxTree(state, doc.length, 5000);
  const hit = strudelLearn(state, pos, mode);
  return `${(mode === "outline" ? "Ctrl " : "Alt  ") + src.padEnd(32)} → ${hit ? `"${doc.slice(hit.from, hit.to)}" ${hit.tip}${hit.url ? " [" + hit.url.split("#")[1] + "]" : ""}` : "null"}`;
};
console.log();
for (const src of [
  'note("c3 |<b3 a3> e3")', 'note("c3 <b|3 a3> e3")', 's("bd [sd |hh]*2")', 's("bd [sd hh]|*2")',
  's("|bd sd")', 's("b|d(3,8)")', '|note("c3").lpf(800)', 'note("c3").l|pf(800)', 'note("c3")\n  .ro|om(3)', 'n(si|ne)', 'foo|bar()', 's("bd(3,|8)")', 's("bd sd, hh| hh")', "s('b|d')", 'n("0 2!|3")', 'note("c").lpf(8|00)',
]) console.log(hover(src));

// Ctrl-hover: what a modifier applies to.
for (const src of [
  'note("c3").l|pf(800).room(3)', 'note("c3").lpf(800).ro|om(3)', '|note("c3").lpf(800)',
  'stack(note("c").l|pf(800), s("bd"))',
  's("bd [sd hh]|*2")', 's("<a |b> c")',
]) console.log(hover(src, "outline"));

// Whole-word rule: the word is the query, prefix matches only.
console.log();
for (const src of ['no|te("c")', 'not|', 'modu|late', 's("x").fa|st(2)', 's("b|d")', 's("s|")']) console.log(run(src));
