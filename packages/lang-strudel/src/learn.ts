import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { argumentAt, callScopeAt, signatureCard } from "@flok-editor/cm-learn";
import type { LearnHit, LearnMode } from "@flok-editor/cm-learn";
import { fnByName, summaryOf } from "./completions";
import { argContextAt } from "./context";
import { miniHit } from "./mini-hover";
import {
  miniNotationDocs,
  stepSymbol,
  symbolAliases,
  symbolTip,
} from "./mini-symbols";
import { meaningOf } from "./sound-glossary";

const soundCallees = new Set(["s", "sound"]);

/**
 * A function or value name. Learning: the name and a summary. Outlining:
 * what it covers, so .lpf in note("c").lpf(800) shows the whole chain it
 * filters.
 */
const functionHit = (
  state: EditorState,
  pos: number,
  mode: LearnMode,
): LearnHit | null => {
  const node = syntaxTree(state).resolveInner(pos, 1);
  if (node.name !== "VariableName" && node.name !== "PropertyName") return null;
  const name = state.sliceDoc(node.from, node.to);
  const fn = fnByName.get(name);
  if (!fn) return null;
  if (mode === "outline") {
    const scope = callScopeAt(state, pos);
    return {
      from: scope?.from ?? node.from,
      to: scope?.to ?? node.to,
      tip: "",
    };
  }
  const alias = symbolAliases[fn.name];
  return {
    from: node.from,
    to: node.to,
    tip: `${name}: ${summaryOf(fn, 120)}${alias ? ` · = ${alias}` : ""}`,
    url: fn.url,
  };
};

/**
 * The argument card: lpf( **frequency** ) and, under it, what that argument
 * is ("frequency: audible between 0 and 20000").
 */
export const argumentCardFor = (callee: string, index: number) => {
  const fn = fnByName.get(callee);
  const param = fn?.params[Math.min(index, fn.params.length - 1)];
  if (!fn || !param) return null;
  const note = param.description
    ? `${param.name}: ${param.description}`
    : undefined;
  return () =>
    signatureCard(
      callee,
      fn.params.map((p) => p.name),
      fn.params.indexOf(param),
      note,
    );
};

/** An argument value under the mouse: underline it, show the argument card. */
const argumentHit = (state: EditorState, pos: number): LearnHit | null => {
  const arg = argumentAt(state, pos);
  const card = arg && argumentCardFor(arg.callee, arg.index);
  if (!arg || !card) return null;
  return {
    from: arg.from,
    to: arg.to,
    tip: arg.callee,
    card,
    url: fnByName.get(arg.callee)?.url,
  };
};

/** Hover help for Strudel: functions, mini-notation and sound names. */
export const strudelLearn = (
  state: EditorState,
  pos: number,
  mode: LearnMode,
): LearnHit | null => {
  const fnHit = functionHit(state, pos, mode);
  if (fnHit) return fnHit;

  // Only double-quoted and backtick strings are mini-notation.
  let node = syntaxTree(state).resolveInner(pos, 1);
  while (
    node.parent &&
    node.name !== "String" &&
    node.name !== "TemplateString"
  )
    node = node.parent;
  if (node.name !== "String" && node.name !== "TemplateString")
    return argumentHit(state, pos);
  const quote = state.sliceDoc(node.from, node.from + 1);
  if (quote !== '"' && quote !== "`") return null;

  const start = node.from + 1;
  const text = state.sliceDoc(start, node.to - 1);
  const hit = miniHit(text, pos - start);
  if (!hit) return null;
  const from = start + hit.from;
  const to = start + hit.to;

  if (hit.symbol) {
    return {
      from,
      to,
      tip: symbolTip(hit.symbol),
      url: hit.symbol.anchor
        ? miniNotationDocs + "#" + hit.symbol.anchor
        : undefined,
    };
  }

  // A word: in s("..."), the sound's meaning if we know it.
  const word = text.slice(hit.from, hit.to);
  const arg = argContextAt(state, node.from);
  const meaning =
    arg && soundCallees.has(arg.callee)
      ? meaningOf(word.toLowerCase())
      : undefined;
  if (meaning) return { from, to, tip: `${word}: ${meaning.meaning}` };
  return {
    from,
    to,
    tip: stepSymbol.explain,
    url: miniNotationDocs + "#" + stepSymbol.anchor,
  };
};
