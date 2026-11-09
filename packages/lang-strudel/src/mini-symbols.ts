import { Completion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";

// Mini-notation symbols, offered by where the cursor is in a pattern string:
// modifiers right after a step, step starters at the start of one, and
// combiners between steps. Each has a short name for the list, a longer
// explanation for the learning list (Alt-Space) and Alt-hover, and the
// section of Strudel's mini-notation page that covers it (Alt-click).

export const miniNotationDocs = "https://strudel.cc/learn/mini-notation/";

export interface MiniSymbol {
  label: string;
  /** Text to insert; `|` marks where the cursor goes */
  insert: string;
  name: string;
  explain: string;
  /** Section id on the mini-notation page */
  anchor?: string;
  /** The function it's an alias of: * is .fast() */
  alias?: string;
}

/** Right after a step (a word, [group], <alternation>...): change it. */
const modifiers: MiniSymbol[] = [
  {
    label: "*",
    insert: "*|",
    name: "faster",
    explain: "faster: bd*2 plays bd twice in its step",
    anchor: "multiplication",
    alias: ".fast()",
  },
  {
    label: "/",
    insert: "/|",
    name: "slower",
    explain: "slower: bd/2 plays bd every other cycle",
    anchor: "division",
    alias: ".slow()",
  },
  {
    label: "!",
    insert: "!|",
    name: "repeat",
    explain: "repeat: bd!3 is bd bd bd",
    anchor: "replication",
  },
  {
    label: "@",
    insert: "@|",
    name: "longer",
    explain: "longer: bd@3 takes 3 steps of time",
    anchor: "elongation",
  },
  {
    label: "?",
    insert: "?|",
    name: "random drop",
    explain: "random drop: bd? plays about half the time",
    anchor: "randomness",
    alias: ".degradeBy()",
  },
  {
    label: "(",
    insert: "(|3,8)",
    name: "rhythm",
    explain: "rhythm: bd(3,8) spreads 3 hits evenly over 8 steps",
    anchor: "euclidian-rhythms",
    alias: ".euclid()",
  },
];

/** After a sound: pick one of its recordings. */
const variation: MiniSymbol = {
  label: ":",
  insert: ":|",
  name: "variation",
  explain: "variation: bd:3 plays the 4th recording of bd",
};

/** At the start of a step. */
const starters: MiniSymbol[] = [
  {
    label: "[ ]",
    insert: "[|]",
    name: "group",
    explain: "group: [bd sd] squeezes several steps into one",
    anchor: "subdividing-time-with-bracket-nesting",
    alias: "seq()",
  },
  {
    label: "< >",
    insert: "<|>",
    name: "alternate",
    explain: "alternate: <bd sd> plays one item per cycle, in turn",
    anchor: "angle-brackets",
    alias: "cat()",
  },
  {
    label: "~",
    insert: "~",
    name: "rest",
    explain: "rest: ~ is a step of silence",
    anchor: "rests",
  },
];

/** Between steps. */
const combiners: MiniSymbol[] = [
  {
    label: ",",
    insert: ", |",
    name: "layer",
    explain: "layer: bd sd, hh hh hh plays both sequences at once",
    anchor: "parallel--polyphony",
    alias: "stack()",
  },
  {
    label: "|",
    insert: " | ",
    name: "random choice",
    explain: "random choice: [bd | sd] picks one side each cycle",
    anchor: "randomness",
    alias: "randcat()",
  },
];

/** The learning list's panel: the explanation and a docs link. */
const infoOf = (sym: MiniSymbol) => (): Node => {
  const dom = document.createElement("div");
  dom.className = "cm-strudel-info";
  dom.appendChild(document.createElement("div")).textContent = sym.explain;
  if (sym.anchor) {
    const link = dom.appendChild(document.createElement("a"));
    link.className = "cm-strudel-info-link";
    link.textContent = "docs ↗";
    link.href = miniNotationDocs + "#" + sym.anchor;
    link.target = "_blank";
    link.rel = "noopener";
  }
  return dom;
};

const completionOf = (sym: MiniSymbol): Completion => ({
  label: sym.label,
  detail: sym.name,
  info: infoOf(sym),
  type: "keyword",
  // Symbols never replace the word before them: bd| → bd*|, not *|.
  apply: (view: EditorView, _c: Completion, _from: number, to: number) => {
    const cursor = sym.insert.indexOf("|");
    const text = sym.insert.replace("|", "");
    view.dispatch({
      changes: { from: to, insert: text },
      selection: { anchor: to + (cursor < 0 ? text.length : cursor) },
    });
  },
});

export type StepPosition = "afterStep" | "stepStart";

/**
 * Where the cursor is, from the pattern text before it:
 * afterStep for "bd|", "[bd sd]|", "bd*2|"; stepStart for "|", "bd |", "[|".
 */
export const stepPosition = (before: string): StepPosition =>
  /[\w\]>)~.#^-]$/.test(before) ? "afterStep" : "stepStart";

/** Symbols that fit at `position`. */
export const symbolCompletions = (
  position: StepPosition,
  {
    afterSound,
    hasStepBefore,
  }: { afterSound: boolean; hasStepBefore: boolean },
): Completion[] => {
  const symbols =
    position === "afterStep"
      ? [...modifiers, ...(afterSound ? [variation] : [])]
      : [...starters, ...(hasStepBefore ? combiners : [])];
  return symbols.map(completionOf);
};

/** A plain step: one event of the sequence. */
export const stepSymbol: MiniSymbol = {
  label: "step",
  insert: "",
  name: "step",
  explain: "step: one event; the steps of a sequence share its cycle evenly",
  anchor: "sequences-of-events-in-a-cycle",
};

/** Closing brackets and the rest dash, which share a symbol with another. */
const aliases: Record<string, string> = {
  "]": "[",
  ">": "<",
  ")": "(",
  "-": "~",
};

/** The symbol a mini-notation character belongs to, for Alt-hover. */
export function symbolFor(char: string): MiniSymbol | undefined {
  const key = aliases[char] || char;
  const all = [...modifiers, variation, ...starters, ...combiners];
  return all.find((s) => s.label.split(" ").includes(key));
}

/** The tip for a symbol: its explanation, then its alias. */
export const symbolTip = (sym: MiniSymbol): string =>
  sym.alias ? `${sym.explain} · = ${sym.alias}` : sym.explain;

/**
 * Pattern symbols by the function they're an alias of, shown alongside the
 * function's other names: fast → *.
 */
export const symbolAliases: Record<string, string> = {
  fast: "*",
  slow: "/",
  degradeBy: "?",
  euclid: "(k,n)",
  seq: "[ ]",
  slowcat: "< >",
  stack: ",",
  chooseCycles: "|",
};
