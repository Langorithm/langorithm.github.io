import {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { isExplaining } from "./explain";

// How code nests, shared by the languages. Hydra chains, Strudel chains and
// Strudel's pattern strings are built the same way: a thing, modified by
// whatever comes after it, which can contain other things.

/** The whole word the cursor is in or touching: o|sc → "osc". */
export const wordAt = (
  state: EditorState,
  pos: number,
): { from: number; to: number; text: string } => {
  const line = state.doc.lineAt(pos);
  const before = /\w*$/.exec(line.text.slice(0, pos - line.from))![0];
  const after = /^\w*/.exec(line.text.slice(pos - line.from))![0];
  const from = pos - before.length;
  const to = pos + after.length;
  return { from, to, text: state.sliceDoc(from, to) };
};

/**
 * Does the whole word name exactly one of `names`, with no longer name
 * starting with it? Then it's already decided: osc yes, modulate no
 * (modulateRepeat...).
 */
export const isDecided = (word: string, names: Iterable<string>): boolean => {
  let exact = false;
  for (const name of names) {
    if (name === word) exact = true;
    else if (name.startsWith(word)) return false;
  }
  return exact;
};

/**
 * Completion for the word the cursor is in: the whole word is the query, only
 * names starting with it match (osc doesn't match o0), an exact match comes
 * first, then options by `boost`, then by name, and picking one replaces the
 * whole word (modu|late →
 * modulateRepeat, not modulateRepeatlate).
 */
export const wordCompletion = (
  context: CompletionContext,
  from: number,
  options: readonly Completion[],
): CompletionResult | null => {
  const after = /^\w*/.exec(
    context.state.sliceDoc(context.pos, context.pos + 100),
  )![0];
  const to = context.pos + after.length;
  const word = context.state.sliceDoc(from, to);
  const matches = options
    .filter((o) => o.label.startsWith(word))
    .sort(
      (a, b) =>
        Number(b.label === word) - Number(a.label === word) ||
        (b.boost ?? 0) - (a.boost ?? 0) ||
        a.label.localeCompare(b.label),
    );
  return matches.length ? { from, to, options: matches, filter: false } : null;
};

// Tree nodes are fresh objects on each lookup: compare spans, not identity.
const isCallee = (call: SyntaxNode | null, callee: SyntaxNode) =>
  call?.name === "CallExpression" &&
  call.firstChild?.from === callee.from &&
  call.firstChild?.to === callee.to;

/** Is `node` somewhere inside a function call's arguments? */
const isNested = (node: SyntaxNode): boolean => {
  for (let n = node.parent; n; n = n.parent)
    if (n.name === "ArgList") return true;
  return false;
};

/**
 * What the function named at `pos` covers. Inside an argument, a method
 * covers everything it modifies there: .rotate in modulate(noise(3).rotate(1))
 * → noise(3).rotate(1). At the top level that would be the whole program
 * above it, so there it covers just its own call: .out(), .rotate(0.5).
 * A function starting a chain covers its call: osc(60).
 * Null when `pos` isn't on a called name.
 */
export const callScopeAt = (
  state: EditorState,
  pos: number,
): { from: number; to: number; name: SyntaxNode } | null => {
  const node = syntaxTree(state).resolveInner(pos, 1);
  if (node.name === "PropertyName") {
    const member = node.parent;
    const call = member?.parent ?? null;
    if (member?.name !== "MemberExpression" || !isCallee(call, member))
      return null;
    if (isNested(call!)) return { from: member.from, to: call!.to, name: node };
    const dot = state.sliceDoc(node.from - 1, node.from) === "." ? 1 : 0;
    return { from: node.from - dot, to: call!.to, name: node };
  } else if (node.name === "VariableName") {
    const call = node.parent;
    if (isCallee(call, node))
      return { from: node.from, to: call!.to, name: node };
  }
  return null;
};

/**
 * The argument the position is in, for the innermost call around it:
 * 60 in osc(60, 0.1) → osc's argument 0, spanning "60".
 */
export const argumentAt = (
  state: EditorState,
  pos: number,
): { callee: string; index: number; from: number; to: number } | null => {
  let args: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
  while (args && args.name !== "ArgList") args = args.parent;
  const call = args?.parent;
  if (!args || call?.name !== "CallExpression") return null;
  const callee = call.firstChild!;
  const nameNode =
    callee.name === "MemberExpression"
      ? callee.getChild("PropertyName")
      : callee;
  if (
    !nameNode ||
    (nameNode.name !== "VariableName" && nameNode.name !== "PropertyName")
  )
    return null;
  let index = 0;
  for (let ch = args.firstChild; ch; ch = ch.nextSibling) {
    if (ch.name === ",") index++;
    else if (
      ch.name !== "(" &&
      ch.name !== ")" &&
      ch.from <= pos &&
      pos < ch.to
    )
      return {
        callee: state.sliceDoc(nameNode.from, nameNode.to),
        index,
        from: ch.from,
        to: ch.to,
      };
  }
  return null;
};

/**
 * A call's signature with the argument at `active` in bold:
 * osc( **frequency = 60**, sync = 0.1, offset = 0 ). An optional line under
 * it says more about that argument.
 */
export const signatureCard = (
  name: string,
  params: string[],
  active: number,
  note?: string,
): HTMLElement => {
  const dom = document.createElement("div");
  const line = dom.appendChild(document.createElement("div"));
  line.appendChild(document.createTextNode(`${name}(`));
  params.forEach((param, i) => {
    if (i > 0) line.appendChild(document.createTextNode(", "));
    line.appendChild(
      document.createElement(i === active ? "b" : "span"),
    ).textContent = param;
  });
  line.appendChild(document.createTextNode(")"));
  if (note) dom.appendChild(document.createElement("div")).textContent = note;
  return dom;
};

/**
 * Put `header` at the top of every option's detail panel: in the learning
 * list inside a call, the argument being written comes first.
 */
export const withHeader = (
  result: CompletionResult | null,
  header: () => HTMLElement,
): CompletionResult | null =>
  result && {
    ...result,
    options: result.options.map((option) => ({
      ...option,
      info: async () => {
        const dom = document.createElement("div");
        const top = dom.appendChild(header());
        top.classList.add("cm-learn-header");
        const own =
          typeof option.info === "function"
            ? await option.info(option)
            : option.info;
        if (typeof own === "string")
          dom.appendChild(document.createElement("div")).textContent = own;
        else if (own && "nodeType" in own) dom.appendChild(own);
        return dom;
      },
    })),
  };

/** The argument the cursor is in, for the lists. */
export interface ArgumentInfo {
  /** The argument's name: angle */
  name: string;
  /** For writing (Ctrl-Space): where you are, as a header over the list */
  header: () => HTMLElement;
  /** For learning (Alt-Space): what it is, as its detail panel */
  detail: () => HTMLElement;
}

/**
 * Shape a completion list for what it's for. Each language gives its options
 * both a shape (detail: how to write it) and a detail panel (info: how it
 * works); this keeps the one the mode needs.
 *
 * Writing (Ctrl-Space): "what goes here?" Each option shows its shape, with
 * no panels, under a header saying where you are: rotate( **angle**, speed ).
 *
 * Learning (Alt-Space): "how does this work?" Options are names only, and
 * the panel explains whichever one is selected. The first option is the
 * argument the cursor is in, so the list opens on learning about it.
 */
export const shapeForMode = (
  context: CompletionContext,
  result: CompletionResult | null,
  arg: ArgumentInfo | null,
): CompletionResult | null => {
  if (!result) return null;
  const learning = isExplaining(context.state);
  if (!learning) {
    const section = arg
      ? { name: arg.name, header: () => headerOf(arg) }
      : undefined;
    return {
      ...result,
      // Options grouped by what they're for keep their own sections.
      options: result.options.map((o) => ({
        ...o,
        info: undefined,
        section: o.section ?? section,
      })),
    };
  }
  const names: Completion[] = result.options.map((o) => ({
    ...o,
    detail: undefined,
  }));
  const typed = context.state.sliceDoc(result.from, context.pos);
  if (arg && !typed)
    names.unshift({
      label: arg.name,
      type: "variable",
      boost: 99,
      info: () => arg.detail(),
      // Choosing the argument itself inserts nothing.
      apply: () => {},
    });
  return { ...result, options: names };
};

const headerOf = (arg: ArgumentInfo) => {
  const dom = arg.header();
  dom.classList.add("cm-learn-section");
  return dom;
};
