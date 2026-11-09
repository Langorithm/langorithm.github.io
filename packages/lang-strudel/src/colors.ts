import { syntaxTree } from "@codemirror/language";
import {
  colorSettings,
  depthRoles,
  miniDepthSpans,
} from "@flok-editor/cm-learn";
import type { RoleClassifier, RoleSpan, RoleSpec } from "@flok-editor/cm-learn";
import { fnByName } from "./completions";

// What gets its own colour in Strudel code: patterns by nesting level, and
// functions by what they're for (from the same groups as the lists).

export const strudelRoles: RoleSpec[] = [
  // Patterns: by nesting level (see miniDepthSpans).
  ...depthRoles,
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
  const settings = state.facet(colorSettings);
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
            ...miniDepthSpans(
              state.sliceDoc(node.from + 1, node.to - 1),
              node.from + 1,
              settings,
            ),
          );
        return false;
      }
      if (node.name === "VariableName" || node.name === "PropertyName") {
        const fn = fnByName.get(state.sliceDoc(node.from, node.to));
        const role = fn && (roleByGroup[fn.group] ?? "fn-other");
        // Quiet functions: only the ones starting a chain keep a colour.
        if (role && (!settings.quietFunctions || role === "fn-start"))
          spans.push({ from: node.from, to: node.to, role });
      }
    },
  });
  return spans;
};
