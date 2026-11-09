import {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { javascriptLanguage } from "@codemirror/lang-javascript";
import type { Extension } from "@codemirror/state";
import { ArgContext, argContextAt, chainBanks, isMemberDot } from "./context";
import {
  isDecided,
  argumentAt,
  learnHover,
  learnKeymap,
  roleHighlighting,
  shapeForMode,
  signatureCard,
  wordAt,
  wordCompletion,
} from "@flok-editor/cm-learn";
import type { ArgumentInfo, Card, CardLookup } from "@flok-editor/cm-learn";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { argumentCardFor, strudelLearn } from "./learn";
import { strudelColors, strudelRoles } from "./colors";
import { stepPosition, symbolCompletions } from "./mini-symbols";
import { strudelTheme } from "./theme";
import { SoundInfo, SoundIndex, searchEntries, soundIndexer } from "./sounds";
import {
  chordCompletions,
  fnByName,
  infoOf,
  signatureOf,
  globalCompletions,
  methodCompletions,
  slotCompletions,
  pitchCompletions,
  scaleCompletions,
  voicingModeCompletions,
} from "./completions";

export type { SoundInfo } from "./sounds";
export { strudelLearn } from "./learn";

export interface StrudelOptions {
  /**
   * Sounds currently registered in Strudel, for completing s("...") and
   * bank("..."). Called on every completion, so it should be cheap; return
   * the same array while nothing changed. Null when Strudel isn't loaded.
   */
  sounds?: () => SoundInfo[] | null;
  /**
   * Readable machine names for banks, keyed by lower-case bank name or
   * alias: { tr909: "RolandTR909" }. Same caching rules as `sounds`.
   */
  bankNames?: () => Record<string, string> | null;
}

const word = /^\w*$/;
const soundCallees = new Set(["s", "sound"]);

/**
 * Completions inside a string. Double-quoted and backtick strings are
 * mini-notation, so complete the word under the cursor, whatever
 * mini-notation surrounds it: s("bd [hh <sd cp>]").
 */
const stringOptions = (
  context: CompletionContext,
  stringFrom: number,
  sounds: SoundIndex | null,
): CompletionResult | null => {
  const { state, pos } = context;
  const arg = argContextAt(state, stringFrom);
  const text = state.sliceDoc(stringFrom + 1, pos);
  // The mini-notation word being typed, including ":" for "C:major" and
  // chord characters for "Eb^7".
  const token = /[\w#^+:-]*$/.exec(text)![0];
  const tokenFrom = pos - token.length;
  // The rest of the word after the cursor: b|d is the word "bd".
  const rest = /^[\w#^+:-]*/.exec(state.sliceDoc(pos, pos + 100))![0];
  const whole = token + rest;
  const tokenTo = pos + rest.length;
  const result = (from: number, options: Completion[], validFor = word) =>
    options.length ? { from, options, validFor } : null;

  const special = arg && arg.argIndex === 0 ? arg.callee : null;
  if (special === "bank")
    return sounds
      ? soundResult(tokenFrom, searchEntries(sounds.banks, whole), tokenTo)
      : null;
  if (special === "scale") {
    // "C:minor:blues": tonic first, then the scale name.
    const colon = token.indexOf(":");
    if (colon < 0) return result(tokenFrom, pitchCompletions);
    return result(tokenFrom + colon + 1, scaleCompletions, /^[\w:]*$/);
  }
  if (special === "chord") {
    // "Eb^7": root, then the chord symbol right after it.
    const root = /^[A-Ga-g][#b]?/.exec(token)?.[0];
    if (!root) return result(tokenFrom, pitchCompletions);
    return result(tokenFrom + root.length, chordCompletions, /^[\w#^+-]*$/);
  }
  if (special === "mode") {
    const colon = token.indexOf(":"); // "above:c4" — the rest is the anchor
    return colon < 0 ? result(tokenFrom, voicingModeCompletions) : null;
  }

  // Sounds in s("..."), and mini-notation symbols in any pattern string.
  const isSound = !!special && soundCallees.has(special);
  if (isSound && !sounds) return null;
  if (whole.includes(":")) return null; // bd:3 — an index
  const words =
    isSound && arg ? soundOptions(context, arg.call, sounds!, whole) : [];
  const quote = state.sliceDoc(stringFrom, stringFrom + 1);
  if (!context.explicit || (quote !== '"' && quote !== "`"))
    return soundResult(tokenFrom, words, tokenTo);

  // Symbols only when asked for (Ctrl-Space, Alt-Space): after a step its
  // modifiers (bd → bd*2), at the start of a step the starters ([, <, ~).
  const before = text.slice(0, text.length - token.length);
  const position = whole
    ? isSound && words[0]?.label !== whole
      ? null // a partly typed sound name: no step to modify yet
      : "afterStep"
    : stepPosition(before);
  const symbols = position
    ? symbolCompletions(position, {
        // ":" picks a recording of a sound name, not of a [group]
        afterSound: isSound && /\w$/.test(before + word),
        hasStepBefore: /\S/.test(before) && !/[[<{(,|]\s*$/.test(before),
      })
    : [];
  // Right after "[bd sd]" only a modifier fits; a new sound needs a space.
  const afterGroup = position === "afterStep" && !whole;
  return soundResult(
    tokenFrom,
    [...symbols, ...(afterGroup ? [] : words)],
    tokenTo,
  );
};

/**
 * Sounds for s(), searched by name or meaning: the selected bank's sounds
 * when the chain sets one (s("...").bank("tr909")), otherwise all of them.
 */
const soundOptions = (
  context: CompletionContext,
  call: ArgContext["call"],
  sounds: SoundIndex,
  typed: string,
): Completion[] => {
  const banks = chainBanks(context.state, call);
  const inBanks = banks.flatMap((b) => sounds.bankSounds.get(b) ?? []);
  return searchEntries(inBanks.length ? inBanks : sounds.sounds, typed);
};

// Sound lists are searched by meaning too ("kick" finds bd), which
// CodeMirror's own filtering can't do, so they come pre-filtered and are
// recomputed on every keystroke. `to` covers the rest of the word.
const soundResult = (from: number, options: Completion[], to?: number) =>
  options.length ? { from, to, options, filter: false } : null;

/**
 * Shape the list for its mode (see shapeForMode): writing shows where you
 * are, lpf( **frequency** ), over the options' shapes; learning opens on the
 * argument itself.
 */
const forMode = (
  context: CompletionContext,
  result: CompletionResult | null,
): CompletionResult | null => {
  const arg = argContextAt(context.state, context.pos);
  const fn = arg && fnByName.get(arg.callee);
  const index = fn ? Math.min(arg!.argIndex, fn.params.length - 1) : -1;
  const info: ArgumentInfo | null =
    arg && fn && index >= 0
      ? {
          name: fn.params[index].name,
          header: () =>
            signatureCard(
              arg.callee,
              fn.params.map((p) => p.name),
              index,
            ),
          detail: argumentCardFor(arg.callee, arg.argIndex)!,
        }
      : null;
  return shapeForMode(context, result, info);
};

const completionSource =
  (sounds: () => SoundIndex | null) =>
  (context: CompletionContext): CompletionResult | null => {
    return forMode(context, completions(sounds, context));
  };

const completions = (
  sounds: () => SoundIndex | null,
  context: CompletionContext,
): CompletionResult | null => {
  const token = context.tokenBefore([
    "String",
    "TemplateString",
    "LineComment",
    "BlockComment",
  ]);
  if (token) {
    if (token.type.name !== "String" && token.type.name !== "TemplateString")
      return null;
    return stringOptions(context, token.from, sounds());
  }

  // Method completion after a dot.
  const dot = context.matchBefore(/\.\w*/);
  if (dot) {
    if (!isMemberDot(context.state, dot.from)) return null; // .5
    return wordCompletion(context, dot.from + 1, methodCompletions);
  }

  const prefix = context.matchBefore(/\w*/);
  const from = prefix ? prefix.from : context.pos;
  if (from === context.pos && !context.explicit) return null;

  // s(| with no string yet: list sounds to browse; picking one adds the
  // quotes, since a bare name there isn't valid code.
  const arg = argContextAt(context.state, from);
  const index = sounds();
  if (arg && arg.argIndex === 0 && soundCallees.has(arg.callee) && index) {
    const typed = context.state.sliceDoc(from, context.pos);
    const options = soundOptions(context, arg.call, index, typed).map((o) => ({
      ...o,
      apply: JSON.stringify(o.label),
    }));
    return soundResult(from, options);
  }

  // An empty argument slot: the forms a value takes, not every name.
  const inSlot = argContextAt(context.state, context.pos);
  const word = wordAt(context.state, context.pos).text;
  if (inSlot && !word) return wordCompletion(context, from, slotCompletions);

  return wordCompletion(context, from, globalCompletions);
};

export function strudel(options: StrudelOptions = {}): Extension {
  const sounds = soundIndexer(
    options.sounds ?? (() => null),
    options.bankNames ?? (() => null),
  );
  return [
    javascriptLanguage,
    javascriptLanguage.data.of({ autocomplete: completionSource(sounds) }),
    strudelTheme,
    learnKeymap(strudelCards(sounds)),
    learnHover(strudelLearn),
    roleHighlighting(strudelColors, strudelRoles),
  ];
}

/**
 * Cards for names that are already decided (o|sc, b|d): Ctrl-Space shows
 * the short one, Alt-Space the detailed one, instead of a list.
 */
const strudelCards = (sounds: () => SoundIndex | null): CardLookup => {
  const decided = (state: EditorState, pos: number) => {
    const word = wordAt(state, pos);
    if (!word.text) return null;
    const node = syntaxTree(state).resolveInner(word.from, 1);
    // A function or value name in code.
    if (node.name === "VariableName" || node.name === "PropertyName") {
      const fn = fnByName.get(word.text);
      return fn && isDecided(word.text, fnByName.keys())
        ? { word, fn, sound: null }
        : null;
    }
    // A sound name in s("...").
    if (node.name === "String" || node.name === "TemplateString") {
      const arg = argContextAt(state, node.from);
      const index = sounds();
      if (!arg || !soundCallees.has(arg.callee) || !index) return null;
      const sound = index.sounds.find((e) => e.label === word.text);
      const labels = index.sounds.map((e) => e.label);
      return sound && isDecided(word.text, labels)
        ? { word, fn: null, sound }
        : null;
    }
    return null;
  };
  // Alt-Space on a written value that isn't a pattern (800 in .lpf(800)):
  // the argument card, underlining the value.
  const argumentCard = (state: EditorState, pos: number): Card | null => {
    const arg = argumentAt(state, pos) ?? argumentAt(state, pos - 1);
    if (!arg || /^["'`]/.test(state.sliceDoc(arg.from, arg.from + 1)))
      return null;
    const dom = argumentCardFor(arg.callee, arg.index);
    return dom
      ? { pos: arg.from, dom, underline: { from: arg.from, to: arg.to } }
      : null;
  };
  const card = (pos: number, build: () => HTMLElement): Card => ({
    pos,
    dom: build,
  });
  const text = (content: string) => () => {
    const dom = document.createElement("div");
    dom.textContent = content;
    return dom;
  };
  return {
    short: (state, pos) => {
      const d = decided(state, pos);
      if (!d) return null;
      if (d.fn) return card(d.word.from, () => signatureOf(d.fn!, d.word.text));
      return card(
        d.word.from,
        text([d.sound!.label, d.sound!.short].filter(Boolean).join("  ")),
      );
    },
    detail: (state, pos) => {
      const d = decided(state, pos);
      if (!d) return argumentCard(state, pos);
      if (d.fn) return card(d.word.from, infoOf(d.fn, d.word.text));
      return card(d.word.from, text(d.sound!.info ?? d.sound!.label));
    },
  };
};
export { strudelColors } from "./colors";
