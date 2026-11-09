import { Completion } from "@codemirror/autocomplete";
import { signatureCard } from "@flok-editor/cm-learn";
import {
  StrudelFn,
  chordSymbols,
  scaleNames,
  strudelFunctions,
} from "./strudel-api";
import { symbolAliases } from "./mini-symbols";

/** Look up a function's docs by its name or any of its synonyms. */
export const fnByName = new Map<string, StrudelFn>();
for (const fn of strudelFunctions)
  for (const name of [fn.name, ...fn.synonyms])
    if (!fnByName.has(name)) fnByName.set(name, fn);

/** Parameter names, cut short after `max` (pianoroll has 25 options). */
export const formatParams = (fn: StrudelFn, max = 3): string => {
  const names = fn.params.map((p) => p.name);
  return names.length > max
    ? `${names.slice(0, max).join(", ")}, …`
    : names.join(", ");
};

/** First sentence of a description: the one-line summary. */
export const summaryOf = (fn: StrudelFn, max = 70): string => {
  const first = fn.description.split(/(?<=\.)\s|\n/)[0].replace(/\.$/, "");
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
};

/**
 * The detail panel for the selected item in the learning list (Alt-Space), read top to bottom: what it does, how to call it, each
 * parameter, one example, other names, and a link to its docs.
 */
export const infoOf = (fn: StrudelFn, label: string) => (): HTMLElement => {
  const dom = document.createElement("div");
  dom.className = "cm-strudel-info";
  const add = (tag: string, cls: string, text = "") => {
    const el = dom.appendChild(document.createElement(tag));
    el.className = cls;
    el.textContent = text;
    return el;
  };
  if (fn.description) add("div", "cm-strudel-info-description", fn.description);
  if (!fn.value)
    add(
      "div",
      "cm-strudel-info-call",
      `${label}(${formatParams(fn, Infinity)})`,
    );
  for (const p of fn.params) {
    const row = add("div", "cm-strudel-info-param");
    row.appendChild(document.createElement("b")).textContent = p.name;
    if (p.description)
      row.appendChild(document.createTextNode(`: ${p.description}`));
  }
  if (fn.examples[0]) add("pre", "cm-strudel-info-example", fn.examples[0]);
  const others = [
    ...[fn.name, ...fn.synonyms].filter((n) => n !== label),
    ...(symbolAliases[fn.name] ? [symbolAliases[fn.name]] : []),
  ];
  if (others.length)
    add("div", "cm-strudel-info-synonyms", `also called ${others.join(", ")}`);
  if (fn.url) {
    const link = add(
      "a",
      "cm-strudel-info-link",
      "docs ↗",
    ) as HTMLAnchorElement;
    link.href = fn.url;
    link.target = "_blank";
    link.rel = "noopener";
  }
  return dom;
};

/** The short card (Ctrl-Space on a decided name): just how to call it. */
export const signatureOf = (fn: StrudelFn, label: string): HTMLElement => {
  if (!fn.value)
    // The same line as the header over the argument list, nothing in bold.
    return signatureCard(
      label,
      fn.params.map((p) => p.name),
      -1,
    );
  const dom = document.createElement("div");
  dom.textContent = `${label}: ${summaryOf(fn)}`;
  return dom;
};

/**
 * Completions for each name of each function, with both its shape (detail,
 * for writing: lpf(frequency)) and its detail panel (info, for learning).
 * shapeForMode keeps the one the list is for.
 */
/**
 * List sections, in the order a sound chain is usually built: a sound, its
 * effects, then time, pitch, ... and devices and setup last. The groups
 * themselves come from Strudel's docs pages (see script/generate.js).
 */
const groupOrder = [
  "sound",
  "effects",
  "time",
  "pitch",
  "patterns",
  "random",
  "conditional",
  "accumulation",
  "values",
  "signals",
  "visuals",
  "devices",
  "setup",
];
const sections = new Map(
  groupOrder.map((name, rank) => [name, { name, rank }] as const),
);

const completionsOf = (fns: StrudelFn[], type: string): Completion[] =>
  fns.flatMap((fn) =>
    [fn.name, ...fn.synonyms].map((label) => ({
      label,
      section: sections.get(fn.group),
      type: fn.value ? "constant" : type,
      detail:
        fn.value || !fn.params.length ? undefined : `(${formatParams(fn)})`,
      info: infoOf(fn, label),
    })),
  );

const methodFns = strudelFunctions.filter((fn) => !fn.value);

/** Everything, for the top level and inside argument lists. */
export const globalCompletions = completionsOf(strudelFunctions, "function");

/** After a dot: functions only, values like sine aren't methods. */
export const methodCompletions = completionsOf(methodFns, "method");

/**
 * What an empty argument slot takes, before any name is typed: a pattern
 * string, then the signals (sine, saw, rand...).
 */
export const slotCompletions: Completion[] = [
  {
    label: '"…"',
    detail: "pattern",
    type: "keyword",
    boost: 1,
    info: () => {
      const dom = document.createElement("div");
      dom.textContent =
        'A mini-notation pattern: "0 2 [4 7]" plays its steps evenly across each cycle.';
      return dom;
    },
    apply: (view, _c, from, to) =>
      view.dispatch({
        changes: { from, to, insert: '""' },
        selection: { anchor: from + 1 },
      }),
  },
  ...completionsOf(
    strudelFunctions.filter((fn) => fn.value),
    "constant",
  ).map((c) => ({ ...c, detail: "signal" })),
];

export const pitchCompletions: Completion[] = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
].map((label) => ({ label, type: "pitch" }));

export const chordCompletions: Completion[] = chordSymbols.map((label) => ({
  label,
  type: "chord",
}));

export const scaleCompletions: Completion[] = scaleNames.map((label) => ({
  label,
  type: "scale",
}));

/** voicing() modes, as in .mode("below") or .mode("above:c4") */
export const voicingModeCompletions: Completion[] = [
  ["below", "top note ≤ anchor"],
  ["above", "bottom note ≥ anchor"],
  ["duck", "top note ≤ anchor, anchor note dropped"],
  ["root", "root position, bottom note at the anchor"],
].map(([label, detail]) => ({ label, type: "mode", detail }));
