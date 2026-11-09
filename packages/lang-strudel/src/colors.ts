import { syntaxTree } from "@codemirror/language";
import { miniSpans } from "@flok-editor/cm-learn";
import type { RoleClassifier, RoleSpan, RoleSpec } from "@flok-editor/cm-learn";
import { tags as t } from "@lezer/highlight";
import { fnByName } from "./completions";

// What gets its own colour in Strudel code: the parts of a pattern, and
// functions by what they're for (from the same groups as the lists).

export const strudelRoles: RoleSpec[] = [
  { name: "mini-number", group: "pattern", prefer: t.number },
  { name: "mini-operator", group: "pattern", prefer: t.operator },
  { name: "mini-bracket", group: "pattern", prefer: t.bracket },
  { name: "mini-separator", group: "pattern", prefer: t.separator },
  // A rest is silence: it gets the comment colour.
  { name: "rest", group: "rest", prefer: t.comment },
  { name: "fn-start", group: "function" },
  { name: "fn-effect", group: "function" },
  { name: "fn-time", group: "function" },
  { name: "fn-pitch", group: "function" },
  { name: "fn-other", group: "function" },
];

const roleByGroup: Record<string, string> = {
  sound: "fn-start",
  effects: "fn-effect",
  time: "fn-time",
  pitch: "fn-pitch",
};

export const strudelColors: RoleClassifier = (state, from, to) => {
  const spans: RoleSpan[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.name === "String" || node.name === "TemplateString") {
        // Only double-quoted and backtick strings are mini-notation.
        const quote = state.sliceDoc(node.from, node.from + 1);
        if (quote === '"' || quote === "`")
          spans.push(
            ...miniSpans(
              state.sliceDoc(node.from + 1, node.to - 1),
              node.from + 1,
            ),
          );
        return false;
      }
      if (node.name === "VariableName" || node.name === "PropertyName") {
        const fn = fnByName.get(state.sliceDoc(node.from, node.to));
        if (fn)
          spans.push({
            from: node.from,
            to: node.to,
            role: roleByGroup[fn.group] ?? "fn-other",
          });
      }
    },
  });
  return spans;
};
