import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";

export interface ArgContext {
  /** Name of the function being called: "osc", "blend", "ease", ... */
  callee: string;
  /** True when the callee is a method (osc().blend(...)) rather than a global. */
  isMethod: boolean;
  /** 0-based index of the argument the position is in. */
  argIndex: number;
  /** Position of the ArgList's opening paren. */
  argListFrom: number;
  /** True when the position is inside an arrow function within the argument. */
  inArrowFn: boolean;
}

const calleeName = (
  state: EditorState,
  callExpr: SyntaxNode,
): { name: string; isMethod: boolean } | null => {
  const callee = callExpr.firstChild;
  if (!callee) return null;
  if (callee.name === "VariableName")
    return { name: state.sliceDoc(callee.from, callee.to), isMethod: false };
  if (callee.name === "MemberExpression") {
    const prop = callee.getChild("PropertyName");
    if (prop)
      return { name: state.sliceDoc(prop.from, prop.to), isMethod: true };
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
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1);
  let inArrowFn = false;
  while (node) {
    const isArgList = node.name === "ArgList";
    // Right after a closing paren is outside that call: osc(60)| is not in
    // osc, and an arrow function inside it doesn't count either.
    const closedBefore =
      isArgList && node.lastChild?.name === ")" && pos >= node.lastChild.to;
    if (closedBefore) inArrowFn = false;
    else if (node.name === "ArrowFunction") inArrowFn = true;
    if (isArgList && !closedBefore) break;
    node = node.parent;
  }
  if (node) {
    const callExpr = node.parent;
    if (!callExpr || callExpr.name !== "CallExpression") return null;
    const callee = calleeName(state, callExpr);
    if (!callee) return null;
    let argIndex = 0;
    for (let ch = node.firstChild; ch; ch = ch.nextSibling)
      if (ch.name === "," && ch.to <= pos) argIndex++;
    return {
      callee: callee.name,
      isMethod: callee.isMethod,
      argIndex,
      argListFrom: node.from,
      inArrowFn,
    };
  }
  return null;
};

/**
 * Classify the expression ending right before the dot at `dotPos`:
 * the receiver of a method completion.
 */
export type Receiver =
  | { kind: "array" }
  | { kind: "sourceBuffer"; name: string }
  | { kind: "other" };

/** Null when the dot is not a member access (e.g. inside a number literal). */
export const receiverBefore = (
  state: EditorState,
  dotPos: number,
  arrayMethodNames: Set<string>,
): Receiver | null => {
  const tree = syntaxTree(state);
  if (tree.resolveInner(dotPos, 1).name === "Number") return null; // 0.5
  // The receiver ends at the dot, or before the newline and spaces of a
  // chain written one method per line.
  let end = dotPos;
  while (end > 0 && /\s/.test(state.sliceDoc(end - 1, end))) end--;
  let node: SyntaxNode | null = tree.resolveInner(end, -1);
  if (!node || node.to > end) return null;
  // Climb to the widest node ending exactly there.
  while (node.parent && node.parent.to === end) node = node.parent;
  if (node.name === "ArrayExpression") return { kind: "array" };
  if (node.name === "VariableName") {
    const name = state.sliceDoc(node.from, node.to);
    if (/^s[0-3]$/.test(name)) return { kind: "sourceBuffer", name };
    return { kind: "other" };
  }
  // A call chain keeps the receiver kind of its own callee:
  // [1, 2].fast(2).ease(...) is still an array.
  if (node.name === "CallExpression") {
    const callee = calleeName(state, node);
    if (callee?.isMethod && arrayMethodNames.has(callee.name))
      return { kind: "array" };
  }
  return { kind: "other" };
};
