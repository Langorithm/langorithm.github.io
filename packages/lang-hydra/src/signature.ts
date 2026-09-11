import { EditorState, StateField } from "@codemirror/state";
import { EditorView, Tooltip, showTooltip } from "@codemirror/view";
import { formatDefault, signatures } from "./completions";
import { argContextAt } from "./context";

// Signature help: while the cursor is inside the argument list of a known
// function, show its signature with defaults above the call, with the
// argument the cursor is in highlighted.

const signatureTooltip = (state: EditorState): Tooltip | null => {
  const sel = state.selection.main;
  if (!sel.empty) return null;
  const arg = argContextAt(state, sel.head);
  if (!arg) return null;
  const sig = signatures[arg.callee];
  if (!sig) return null;
  const active = Math.min(arg.argIndex, sig.params.length - 1);
  return {
    pos: arg.argListFrom,
    above: true,
    arrow: false,
    create: () => {
      const dom = document.createElement("div");
      dom.className = "cm-hydra-signature";
      dom.appendChild(document.createTextNode(`${sig.name}(`));
      sig.params.forEach((param, i) => {
        if (i > 0) dom.appendChild(document.createTextNode(", "));
        const span = dom.appendChild(document.createElement("span"));
        if (i === active) span.className = "cm-hydra-signature-active";
        span.textContent = `${param.name}${formatDefault(param.default)}`;
      });
      dom.appendChild(document.createTextNode(")"));
      return { dom };
    },
  };
};

const signatureField = StateField.define<Tooltip | null>({
  create: signatureTooltip,
  update(tooltip, tr) {
    if (!tr.docChanged && !tr.selection) return tooltip;
    return signatureTooltip(tr.state);
  },
  provide: (field) => showTooltip.from(field),
});

const signatureTheme = EditorView.baseTheme({
  ".cm-tooltip.cm-hydra-signature": {
    padding: "2px 6px",
    fontFamily: "inherit",
  },
  ".cm-hydra-signature-active": {
    fontWeight: "bold",
    textDecoration: "underline",
  },
});

export const hydraSignatureHelp = () => [signatureField, signatureTheme];
