// Prints what completion and hover offer at each cursor position (marked |).
// Run after building: node test/completions.mjs

import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { ensureSyntaxTree } from "@codemirror/language";
import { isDecided, wordAt } from "@flok-editor/cm-learn";
import { hydra } from "@flok-editor/lang-hydra";

const ext = hydra();
const setup = (src) => {
  const pos = src.indexOf("|");
  const doc = src.slice(0, pos) + src.slice(pos + 1);
  const state = EditorState.create({ doc, extensions: ext, selection: { anchor: pos } });
  ensureSyntaxTree(state, doc.length, 5000);
  return { pos, doc, state };
};

const complete = (src) => {
  const { pos, doc, state } = setup(src);
  const [source] = state.languageDataAt("autocomplete", pos);
  const r = source(new CompletionContext(state, pos, true));
  if (!r) return `${src.padEnd(34)} → null`;
  const names = r.options.slice(0, 6).map((o) => o.label).join(" ");
  return `${src.padEnd(34)} → replaces "${doc.slice(r.from, r.to ?? pos)}": ${names}`;
};

console.log("Completion (Ctrl-Space when the word isn't decided):");
for (const src of ["o|sc(10)", "osc().modu|late(noise())", "osc().|", "osc(|", "osc().blend(o|)", "sr|"])
  console.log(complete(src));

console.log("\nDecided words (Ctrl-Space shows a card instead):");
const names = ["osc", "modulate", "modulateRepeat", "noise", "o0"];
for (const src of ["o|sc(10)", "osc().modu|late()", "noi|se()"]) {
  const { pos, state } = setup(src);
  const w = wordAt(state, pos).text;
  console.log(`${src.padEnd(34)} → "${w}" decided: ${isDecided(w, names)}`);
}

import { hydraLearn } from "@flok-editor/lang-hydra";
console.log("\nHover (Alt = learn, Ctrl = outline):");
for (const [src, mode] of [
  ["os|c(60).rotate(0.5).out()", "learn"],
  ["osc(60).rot|ate(0.5).out()", "learn"],
  ["osc(60).rot|ate(0.5).out()", "outline"],
  ["osc(60).rotate(0.5).modulate(noi|se(3)).out()", "outline"],
  ["osc(60).rotate(0.5).modu|late(noise(3)).out()", "outline"],
  ["osc(60).modulate(noise(3).rot|ate(1)).out()", "outline"],
  ["osc(60)\n  .rotate(0.5)\n  .kaleid(4)\n  .o|ut()", "outline"],
  ["osc(6|0, 0.1)", "learn"],
  ["osc(60, 0.|1)", "learn"],
  ["osc().blend(o|0, 0.5)", "learn"],
]) {
  const { pos, doc, state } = setup(src);
  const hit = hydraLearn(state, pos, mode);
  console.log(`${mode.padEnd(8)}${src.padEnd(48)} → ${hit ? `"${doc.slice(hit.from, hit.to)}" ${hit.tip}` : "null"}`);
}
