import { syntaxTree } from "@codemirror/language";
import { miniSpans } from "@flok-editor/cm-learn";
import type { RoleClassifier, RoleSpan, RoleSpec } from "@flok-editor/cm-learn";
import { tags as t } from "@lezer/highlight";
import { hydraFunctions } from "./hydra-api";

// What gets its own colour in Hydra code: functions by hydra-synth's types
// (named as in Hydra's docs), output buffers and sources, and the parts of
// P("...") patterns.

export const hydraRoles: RoleSpec[] = [
  { name: "mini-number", group: "pattern", prefer: t.number },
  { name: "mini-operator", group: "pattern", prefer: t.operator },
  { name: "mini-bracket", group: "pattern", prefer: t.bracket },
  { name: "mini-separator", group: "pattern", prefer: t.separator },
  { name: "rest", group: "rest", prefer: t.comment },
  // A source starts a chain, as a sound does in Strudel: same role name.
  { name: "fn-start", group: "function" },
  { name: "fn-geometry", group: "function" },
  { name: "fn-color", group: "function" },
  { name: "fn-blend", group: "function" },
  { name: "fn-modulate", group: "function" },
  { name: "fn-output", group: "function" },
  { name: "buffer", group: "function" },
];

const roleByType: Record<string, string> = {
  src: "fn-start",
  coord: "fn-geometry",
  color: "fn-color",
  combine: "fn-blend",
  combineCoord: "fn-modulate",
};
const roleOf = new Map<string, string>([
  ...hydraFunctions.map((fn) => [fn.name, roleByType[fn.type]] as const),
  ["out", "fn-output"],
  ["render", "fn-output"],
]);

export const hydraColors: RoleClassifier = (state, from, to) => {
  const spans: RoleSpan[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const text = () => state.sliceDoc(node.from, node.to);
      if (node.name === "VariableName" || node.name === "PropertyName") {
        const name = text();
        const role = /^[os][0-3]$/.test(name) ? "buffer" : roleOf.get(name);
        if (role) spans.push({ from: node.from, to: node.to, role });
      } else if (node.name === "String") {
        // P("...") takes a Strudel pattern.
        const call = node.node.parent?.parent;
        const callee = call?.name === "CallExpression" ? call.firstChild : null;
        if (callee && state.sliceDoc(callee.from, callee.to) === "P")
          spans.push(
            ...miniSpans(
              state.sliceDoc(node.from + 1, node.to - 1),
              node.from + 1,
            ),
          );
        return false;
      }
    },
  });
  return spans;
};
