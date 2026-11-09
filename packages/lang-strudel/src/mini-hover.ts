import { MiniSymbol, symbolFor } from "./mini-symbols";

// Find what a character of a mini-notation pattern belongs to, and the span
// to underline: over a bracket or operator, the whole construct it makes
// (<b3 a3>, [e3 g3]*2, bd(3,8)); over a word, just the word. Works on the raw
// text, so a half-typed pattern still gets help.

export interface MiniHit {
  /** Span within the pattern text */
  from: number;
  to: number;
  /** The construct, or null for a plain word */
  symbol: MiniSymbol | null;
}

const pairs: Record<string, string> = {
  "[": "]",
  "<": ">",
  "(": ")",
  "{": "}",
};
const closers: Record<string, string> = {
  "]": "[",
  ">": "<",
  ")": "(",
  "}": "{",
};
const wordChar = /[\w#.^'-]/;

/** Index of the bracket matching the one at `i`, or -1. */
const matching = (text: string, i: number): number => {
  const open = pairs[text[i]] ? text[i] : closers[text[i]];
  const close = pairs[open];
  const dir = text[i] === open ? 1 : -1;
  let depth = 0;
  for (let j = i; j >= 0 && j < text.length; j += dir) {
    if (text[j] === open) depth += dir;
    else if (text[j] === close) depth -= dir;
    if (depth === 0) return j;
  }
  return -1;
};

const wordAt = (text: string, i: number): [number, number] => {
  let a = i;
  let b = i;
  while (a > 0 && wordChar.test(text[a - 1])) a--;
  while (b < text.length && wordChar.test(text[b])) b++;
  return [a, b];
};

/** Start of the step that ends right before `end`: a word or a bracket. */
const stepStart = (text: string, end: number): number => {
  const last = text[end - 1];
  if (closers[last]) {
    const open = matching(text, end - 1);
    // A rhythm's (3,8) belongs to the word before it.
    return open > 0 && last === ")" ? stepStart(text, open) : Math.max(open, 0);
  }
  return wordAt(text, end - 1)[0];
};

/** End of an operator's argument: a number, or a bracketed pattern. */
const argEnd = (text: string, i: number): number => {
  if (pairs[text[i]]) {
    const close = matching(text, i);
    return close < 0 ? text.length : close + 1;
  }
  let j = i;
  while (j < text.length && /[\d.]/.test(text[j])) j++;
  return j;
};

/** The innermost group that contains `i`, or the whole pattern. */
const enclosing = (text: string, i: number): [number, number] => {
  for (let j = i - 1; j >= 0; j--) {
    if (!pairs[text[j]] || text[j] === "(") continue;
    const close = matching(text, j);
    if (close < 0 || close > i) return [j, close < 0 ? text.length : close + 1];
  }
  return [0, text.length];
};

const insideRhythm = (text: string, i: number): number => {
  for (let j = i - 1; j >= 0; j--) {
    if (text[j] === "(") return j;
    if (/[)\]>\s]/.test(text[j]) && text[j] !== " ") return -1;
  }
  return -1;
};

export const miniHit = (text: string, i: number): MiniHit | null => {
  const c = text[i];
  if (c === undefined || /\s/.test(c)) return null;

  // Brackets: the whole group, plus a rhythm's word.
  if (pairs[c] || closers[c]) {
    const other = matching(text, i);
    const open = pairs[c] ? i : other;
    const close = pairs[c] ? other : i;
    if (open < 0) return null;
    const end = close < 0 ? text.length : close + 1;
    const from = text[open] === "(" ? stepStart(text, open) : open;
    return { from, to: end, symbol: symbolFor(text[open]) ?? null };
  }

  // Operators: the step they modify, the operator and its argument.
  if ("*/!@?".includes(c)) {
    return {
      from: stepStart(text, i),
      to: argEnd(text, i + 1),
      symbol: symbolFor(c) ?? null,
    };
  }

  if (c === ",") {
    const paren = insideRhythm(text, i);
    if (paren >= 0) return miniHit(text, paren);
    const [from, to] = enclosing(text, i);
    return { from, to, symbol: symbolFor(",") ?? null };
  }
  if (c === "|") {
    const [from, to] = enclosing(text, i);
    return { from, to, symbol: symbolFor("|") ?? null };
  }
  if (c === ":") {
    const [from] = wordAt(text, i - 1);
    return { from, to: argEnd(text, i + 1), symbol: symbolFor(":") ?? null };
  }
  if (c === "~" || (c === "-" && !wordChar.test(text[i + 1] ?? ""))) {
    return { from: i, to: i + 1, symbol: symbolFor("~") ?? null };
  }

  if (wordChar.test(c)) {
    const [from, to] = wordAt(text, i);
    // A number that belongs to an operator (the 2 in *2): that operator.
    const before = text[from - 1];
    if (before && "*/!@?:".includes(before)) return miniHit(text, from - 1);
    if (insideRhythm(text, i) >= 0) return miniHit(text, insideRhythm(text, i));
    return { from, to, symbol: null };
  }
  return null;
};
