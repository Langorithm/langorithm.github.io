import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

export interface ArgContext {
  /** Name of the function being called: "s", "bank", "lpf", ... */
  callee: string;
  /** 0-based index of the argument the position is in. */
  argIndex: number;
  /** Position of the ArgList's opening paren. */
  argListFrom: number;
  /** The CallExpression node of the call. */
  call: SyntaxNode;
}

const calleeName = (
  state: EditorState,
  callExpr: SyntaxNode,
): string | null => {
  const callee = callExpr.firstChild;
  if (!callee) return null;
  if (callee.name === "VariableName")
    return state.sliceDoc(callee.from, callee.to);
  if (callee.name === "MemberExpression") {
    const prop = callee.getChild("PropertyName");
    if (prop) return state.sliceDoc(prop.from, prop.to);
  }
  return null;
};

/**
 * Describe the innermost function call argument list containing `pos`,
 * or null when the position is not inside one.
 */
export const argContextAt = (
  state: EditorState,
  pos: number,
): ArgContext | null => {
  let args: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1);
  // Right after a closing paren is outside that call: lpf(800)| is not in lpf.
  const closedBefore = (node: SyntaxNode) =>
    node.lastChild?.name === ")" && pos >= node.lastChild.to;
  while (args && (args.name !== "ArgList" || closedBefore(args)))
    args = args.parent;
  if (!args) return null;
  const call = args.parent;
  if (!call || call.name !== "CallExpression") return null;
  const callee = calleeName(state, call);
  if (!callee) return null;
  let argIndex = 0;
  for (let ch = args.firstChild; ch; ch = ch.nextSibling)
    if (ch.name === "," && ch.to <= pos) argIndex++;
  return { callee, argIndex, argListFrom: args.from, call };
};

/** Is the dot at `dotPos` a member access (not inside a number like .5)? */
export const isMemberDot = (state: EditorState, dotPos: number): boolean =>
  syntaxTree(state).resolveInner(dotPos, 1).name !== "Number";

const bankCall = /\bbank\(\s*["'`]([^"'`]*)["'`]/g;

/**
 * Bank names set anywhere in the method chain `call` belongs to, so that
 * s("...") in s("bd sd").bank("tr909") completes that bank's sounds.
 * A patterned bank like "<tr909 tr808>" yields every name in it.
 */
export const chainBanks = (state: EditorState, call: SyntaxNode): string[] => {
  let chain = call;
  while (
    chain.parent &&
    (chain.parent.name === "MemberExpression" ||
      chain.parent.name === "CallExpression")
  )
    chain = chain.parent;
  const text = state.sliceDoc(chain.from, chain.to);
  const banks = new Set<string>();
  for (const m of text.matchAll(bankCall))
    for (const name of m[1].match(/[\w]+/g) ?? [])
      banks.add(name.toLowerCase());
  return [...banks];
};
