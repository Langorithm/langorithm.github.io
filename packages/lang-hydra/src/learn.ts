import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  argumentAt,
  callScopeAt,
  isDecided,
  signatureCard,
  wordAt,
} from "@flok-editor/cm-learn";
import type {
  Card,
  CardLookup,
  LearnHit,
  LearnMode,
} from "@flok-editor/cm-learn";
import { formatDefault, formatSignature, signatures } from "./completions";
import { hydraFunctions } from "./hydra-api";

const typeOf = new Map(hydraFunctions.map((fn) => [fn.name, fn.type]));

/** The known function named at `pos`, with its name's span. */
const nameAt = (state: EditorState, pos: number) => {
  const node = syntaxTree(state).resolveInner(pos, 1);
  if (node.name !== "VariableName" && node.name !== "PropertyName") return null;
  const sig = signatures[state.sliceDoc(node.from, node.to)];
  return sig ? { node, sig } : null;
};

/**
 * Hover help. Learning (Alt): the name, with its signature and defaults.
 * Outlining (Ctrl): what it covers, so .rotate in osc(60).rotate(0.5) shows
 * the whole chain it rotates.
 */
export const hydraLearn = (
  state: EditorState,
  pos: number,
  mode: LearnMode,
): LearnHit | null => {
  const named = nameAt(state, pos);
  if (!named) return argumentHit(state, pos);
  const { node, sig } = named;
  if (mode === "outline") {
    const scope = callScopeAt(state, pos);
    return {
      from: scope?.from ?? node.from,
      to: scope?.to ?? node.to,
      tip: "",
    };
  }
  return { from: node.from, to: node.to, tip: formatSignature(sig) };
};

/** The argument card: osc( **frequency = 60**, sync = 0.1, offset = 0 ). */
export const argumentCardFor = (callee: string, index: number) => {
  const sig = signatures[callee];
  if (!sig) return null;
  const params = sig.params.map((p) => `${p.name}${formatDefault(p.default)}`);
  return () => signatureCard(sig.name, params, index);
};

/** An argument value under the mouse: underline it, show the argument card. */
const argumentHit = (state: EditorState, pos: number): LearnHit | null => {
  const arg = argumentAt(state, pos);
  const card = arg && argumentCardFor(arg.callee, arg.index);
  if (!arg || !card) return null;
  const param = signatures[arg.callee].params[arg.index];
  return { from: arg.from, to: arg.to, tip: param?.name ?? "", card };
};

/** Alt-Space on a written argument value: the same card, underlining it. */
const argumentCard = (state: EditorState, pos: number): Card | null => {
  const arg = argumentAt(state, pos) ?? argumentAt(state, pos - 1);
  const dom = arg && argumentCardFor(arg.callee, arg.index);
  if (!arg || !dom) return null;
  return { pos: arg.from, dom, underline: { from: arg.from, to: arg.to } };
};

/**
 * Cards for names that are already decided (o|sc): Ctrl-Space shows the
 * signature, Alt-Space the signature with its type and each parameter.
 * Alt-Space inside parentheses shows which argument you're on.
 */
export const hydraCards: CardLookup = {
  short: (state, pos) => {
    const word = wordAt(state, pos);
    const named = word.text && nameAt(state, word.from);
    if (!named || !isDecided(word.text, Object.keys(signatures))) return null;
    // The same line as the header over the argument list, nothing in bold.
    return card(word.from, argumentCardFor(named.sig.name, -1)!);
  },
  detail: (state, pos) => {
    const word = wordAt(state, pos);
    const named = word.text && nameAt(state, word.from);
    // Inside parentheses with no name under the cursor: the argument card.
    if (!named) return argumentCard(state, pos);
    if (!isDecided(word.text, Object.keys(signatures))) return null;
    const { sig } = named;
    return card(word.from, () => {
      const dom = document.createElement("div");
      const head = dom.appendChild(document.createElement("div"));
      head.style.fontWeight = "bold";
      head.textContent = formatSignature(sig);
      const type = typeOf.get(sig.name);
      if (type)
        dom.appendChild(document.createElement("div")).textContent =
          `type: ${type}`;
      for (const p of sig.params) {
        const row = dom.appendChild(document.createElement("div"));
        row.appendChild(document.createElement("b")).textContent = p.name;
        if (p.default !== undefined && p.default !== null)
          row.appendChild(document.createTextNode(`: default ${p.default}`));
      }
      return dom;
    });
  },
};

const card = (pos: number, dom: () => HTMLElement): Card => ({ pos, dom });
