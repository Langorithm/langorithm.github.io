import { highlightingFor, syntaxTree } from "@codemirror/language";
import { EditorState, Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { Tag, tags as t } from "@lezer/highlight";

// Colour by role: what a piece of code is for, beyond what the JavaScript
// parser can tell (a pattern's operators and brackets, a time function versus
// an effect). Each role is a CSS class coloured by a variable,
// --cm-role-<name>. For now the variables are filled from the active theme's
// own palette, picking colours so that roles in the same group differ; a
// theme can later set them itself instead.

/** A span of code and the role it plays. */
export interface RoleSpan {
  from: number;
  to: number;
  role: string;
}

/** Find the roles in `from`..`to`. Spans must not overlap. */
export type RoleClassifier = (
  state: EditorState,
  from: number,
  to: number,
) => RoleSpan[];

/**
 * Roles to colour. Roles in one group get different colours from each other
 * (the colours repeat only when the theme has too few). `prefer` names a
 * theme tag whose colour suits the role, used when the theme has one.
 */
export interface RoleSpec {
  name: string;
  group: string;
  prefer?: Tag;
}

// Theme tags to borrow colours from, roughly from most to least common.
const paletteTags: Tag[] = [
  t.keyword,
  t.number,
  t.atom,
  t.function(t.variableName),
  t.propertyName,
  t.typeName,
  t.className,
  t.operator,
  t.bool,
  t.special(t.variableName),
  t.labelName,
  t.variableName,
  t.macroName,
  t.meta,
  t.tagName,
  t.regexp,
  t.escape,
];

const probeColor = (view: EditorView, tag: Tag): string | null => {
  const cls = highlightingFor(view.state, [tag]);
  if (!cls) return null;
  const probe = document.createElement("span");
  probe.className = cls;
  probe.style.display = "none";
  view.contentDOM.parentElement!.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
};

/**
 * Pick a colour from the theme for each role: its preferred tag's colour if
 * the theme gives that tag one of its own, otherwise the next palette colour
 * not yet used in its group. Text, string and comment colours are kept out,
 * except that a role preferring the comment tag (a rest: silence) gets it.
 */
const pickColors = (view: EditorView, roles: RoleSpec[]) => {
  const text = getComputedStyle(view.contentDOM).color;
  const string = probeColor(view, t.string);
  const comment = probeColor(view, t.comment);
  const reserved = new Set([text, string, comment].filter(Boolean));
  const palette: string[] = [];
  for (const tag of paletteTags) {
    const color = probeColor(view, tag);
    if (color && !reserved.has(color) && !palette.includes(color))
      palette.push(color);
  }
  const usedInGroup = new Map<string, Set<string>>();
  const colors = new Map<string, string>();
  for (const role of roles) {
    const used = usedInGroup.get(role.group) ?? new Set<string>();
    usedInGroup.set(role.group, used);
    let color = role.prefer ? probeColor(view, role.prefer) : null;
    if (color === comment && role.prefer !== t.comment) color = null;
    if (!color || color === text || color === string || used.has(color))
      color =
        palette.find((c) => !used.has(c)) ??
        palette[used.size % Math.max(palette.length, 1)] ??
        null;
    if (color) {
      used.add(color);
      colors.set(role.name, color);
    }
  }
  return colors;
};

const markFor = new Map<string, Decoration>();
const mark = (role: string) => {
  let m = markFor.get(role);
  if (!m)
    markFor.set(role, (m = Decoration.mark({ class: `cm-role-${role}` })));
  return m;
};

export const roleHighlighting = (
  classify: RoleClassifier,
  roles: RoleSpec[],
): Extension => {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
        this.paint(view);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.state) !== syntaxTree(update.startState)
        )
          this.decorations = this.build(update.view);
        // A new theme: borrow its colours.
        if (update.transactions.some((tr) => tr.reconfigured))
          this.paint(update.view);
      }
      build(view: EditorView) {
        const spans: RoleSpan[] = [];
        for (const { from, to } of view.visibleRanges)
          spans.push(...classify(view.state, from, to));
        spans.sort((a, b) => a.from - b.from || a.to - b.to);
        const builder = new RangeSetBuilder<Decoration>();
        let last = -1;
        for (const s of spans) {
          if (s.from < last || s.from >= s.to) continue;
          builder.add(s.from, s.to, mark(s.role));
          last = s.to;
        }
        return builder.finish();
      }
      paint(view: EditorView) {
        view.requestMeasure({
          read: () => pickColors(view, roles),
          write: (colors) => {
            for (const role of roles) {
              const color = colors.get(role.name);
              if (color)
                view.dom.style.setProperty(`--cm-role-${role.name}`, color);
              else view.dom.style.removeProperty(`--cm-role-${role.name}`);
            }
          },
        });
      }
    },
    { decorations: (v) => v.decorations },
  );
  // The syntax highlighting's own colour sits on spans inside or around
  // these, so the role colour has to win over it.
  const theme = EditorView.baseTheme(
    Object.fromEntries(
      roles.map((r) => [
        `.cm-role-${r.name}, .cm-role-${r.name} *`,
        { color: `var(--cm-role-${r.name}) !important` },
      ]),
    ),
  );
  return [plugin, theme];
};

/**
 * The parts of a Strudel mini-notation pattern at document offset `start`:
 * numbers, operators, brackets, separators, rests. Words keep the string
 * colour. Used for Strudel strings and Hydra's P("...") patterns.
 */
export const miniSpans = (text: string, start: number): RoleSpan[] => {
  const spans: RoleSpan[] = [];
  const add = (from: number, to: number, role: string) =>
    spans.push({ from: start + from, to: start + to, role });
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const rest = text.slice(i);
    const word = /^[A-Za-z_#^][\w#.^']*/.exec(rest);
    const number = /^-?\d+(\.\d+)?/.exec(rest);
    if (word) {
      i += word[0].length; // words keep the string colour
    } else if (number && !(c === "-" && /\w/.test(text[i - 1] ?? ""))) {
      add(i, i + number[0].length, "mini-number");
      i += number[0].length;
    } else {
      if ("*/!@?:%".includes(c)) add(i, i + 1, "mini-operator");
      else if ("[]<>{}()".includes(c)) add(i, i + 1, "mini-bracket");
      else if (",|.".includes(c)) add(i, i + 1, "mini-separator");
      else if (c === "~" || c === "-") add(i, i + 1, "rest");
      i++;
    }
  }
  return spans;
};
