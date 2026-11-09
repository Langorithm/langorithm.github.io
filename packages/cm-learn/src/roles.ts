import { highlightingFor, syntaxTree } from "@codemirror/language";
import {
  EditorState,
  Extension,
  Facet,
  RangeSetBuilder,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { Tag, tags as t } from "@lezer/highlight";
import { notCursors } from "./hover";

// Colour by role: what a piece of code is for, beyond what the JavaScript
// parser can tell (a pattern's operators and brackets, a time function versus
// an effect). Each role is a CSS class coloured by a variable,
// --cm-role-<name>. For now the variables are filled from the active theme's
// own palette, picking colours so that roles in the same group differ; a
// theme can later set them itself instead.

/** Ways to tone the colouring down, each on its own. */
export interface ColorSettings {
  /** Nested levels as shades of the string colour, not other colours. */
  shades: boolean;
  /** Only two looks: top level and "inside brackets". */
  twoLevels: boolean;
  /** Colour only the brackets; their contents keep the string colour. */
  bracketsOnly: boolean;
  /** Only chain-starting functions (s, note, osc...) get a colour. */
  quietFunctions: boolean;
  /** Operators (*2 , !) in their level's colour, not dimmed. */
  evenOperators: boolean;
  /** Hue shift per nesting level, in degrees. */
  hueStep: number;
}

// Chosen on Tokyo Night: quiet functions, even operators, 30° hue steps.
export const defaultColorSettings: ColorSettings = {
  shades: false,
  twoLevels: false,
  bracketsOnly: false,
  quietFunctions: true,
  evenOperators: true,
  hueStep: 30,
};

export const colorSettings = Facet.define<
  Partial<ColorSettings>,
  ColorSettings
>({ combine: (values) => ({ ...defaultColorSettings, ...values[0] }) });

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
  /**
   * A nesting level: level 0 is the theme's string colour, each deeper level
   * its hue nudged a small step further (see depthPalette).
   */
  depth?: number;
  /** Share another role's colour instead of getting one. */
  colorOf?: string;
  /** Extra CSS for the role, e.g. a dimmer opacity. */
  style?: Record<string, string>;
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
  const settings = view.state.facet(colorSettings);
  const depthColors = string
    ? settings.shades
      ? depthShades(string)
      : depthPalette(string, palette, 6, settings.hueStep)
    : [];
  for (const role of roles) {
    if (role.colorOf) continue;
    if (role.depth !== undefined) {
      const color = depthColors[role.depth % Math.max(depthColors.length, 1)];
      if (color) colors.set(role.name, color);
      continue;
    }
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

const rgbOf = (color: string): [number, number, number] | null => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const hslOf = ([r, g, b]: [number, number, number]) => {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === rr
      ? ((gg - bb) / d + 6) % 6
      : max === gg
        ? (bb - rr) / d + 2
        : (rr - gg) / d + 4;
  return { h: h * 60, s, l };
};

/**
 * Colours for nesting levels: the base (string) colour, then the same colour
 * with its hue nudged a small step per level, so levels stay one family
 * (green never drifts to yellow). The direction follows the theme: towards
 * its colour nearest in hue to the base.
 */
const depthPalette = (
  base: string,
  palette: string[],
  levels = 6,
  step = 6,
): string[] => {
  const rgb = rgbOf(base);
  if (!rgb) return [base];
  const { h, s, l } = hslOf(rgb);
  // Signed hue offset from the base to the theme's nearest coloured hue.
  const offsets = palette
    .map((c) => rgbOf(c) && hslOf(rgbOf(c)!))
    .filter((x): x is { h: number; s: number; l: number } => !!x && x.s > 0.15)
    .map((x) => ((x.h - h + 540) % 360) - 180)
    .filter((d) => Math.abs(d) > 4)
    .sort((a, b) => Math.abs(a) - Math.abs(b));
  const direction = (offsets[0] ?? 1) < 0 ? -1 : 1;
  return Array.from({ length: levels }, (_, d) =>
    d === 0
      ? base
      : `hsl(${Math.round((h + direction * step * d + 360) % 360)}, ${Math.round(
          s * 100,
        )}%, ${Math.round(l * 100)}%)`,
  );
};

/**
 * Nesting levels as shades of the base colour: same hue, each level a little
 * dimmer and less saturated, so a pattern reads as one colour family.
 */
const depthShades = (base: string, levels = 6): string[] => {
  const rgb = rgbOf(base);
  if (!rgb) return [base];
  const { h, s, l } = hslOf(rgb);
  return Array.from({ length: levels }, (_, d) =>
    d === 0
      ? base
      : `hsl(${Math.round(h)}, ${Math.round(s * 100 * (1 - 0.12 * d))}%, ${Math.round(
          l * 100 * (1 - 0.1 * d),
        )}%)`,
  );
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
        const reconfigured = update.transactions.some((tr) => tr.reconfigured);
        if (
          reconfigured ||
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.state) !== syntaxTree(update.startState)
        )
          this.decorations = this.build(update.view);
        // A new theme: borrow its colours.
        // A new theme or new settings: pick colours again.
        if (reconfigured) this.paint(update.view);
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
            const even = view.state.facet(colorSettings).evenOperators;
            view.dom.style.setProperty(
              "--cm-role-op-opacity",
              even ? "1" : "0.7",
            );
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
        `.cm-role-${r.name}, .cm-role-${r.name} *:not(${notCursors})`,
        {
          color: `var(--cm-role-${r.colorOf ?? r.name}) !important`,
          ...r.style,
        },
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

const maxDepth = 6;

/**
 * Roles for colouring a pattern by nesting: depth-0 … depth-5 (level 0 is
 * the string colour), the same dimmed for operators (depth-N-op), and rests.
 */
export const depthRoles: RoleSpec[] = [
  ...Array.from({ length: maxDepth }, (_, d) => ({
    name: `depth-${d}`,
    group: "depth",
    depth: d,
  })),
  ...Array.from({ length: maxDepth }, (_, d) => ({
    name: `depth-${d}-op`,
    group: "depth",
    colorOf: `depth-${d}`,
    style: { opacity: "var(--cm-role-op-opacity, 0.7)" },
  })),
  { name: "rest", group: "rest", prefer: t.comment },
];

/**
 * A Strudel mini-notation pattern coloured by nesting, at document offset
 * `start`: everything inside a [ ] or < > takes its level's colour, the
 * brackets included, so a group reads as one block. Operators (*2, !, ,)
 * take their level's colour, dimmed; rests are dimmed like comments.
 * Level 0 words keep the plain string colour.
 */
export const miniDepthSpans = (
  text: string,
  start: number,
  settings: ColorSettings = defaultColorSettings,
): RoleSpan[] => {
  const spans: RoleSpan[] = [];
  const level = (d: number) =>
    `depth-${settings.twoLevels ? Math.min(d, 1) : d % maxDepth}`;
  const add = (from: number, to: number, role: string) =>
    spans.push({ from: start + from, to: start + to, role });
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const token = /^[\w#.^'-]+/.exec(text.slice(i))?.[0];
    if ("[<{(".includes(c)) {
      depth++;
      add(i, i + 1, level(depth));
      i++;
    } else if ("]>})".includes(c)) {
      add(i, i + 1, level(depth));
      depth = Math.max(depth - 1, 0);
      i++;
    } else if ("*/!@?:%".includes(c)) {
      // The operator and the number it takes: *2, @3.
      const arg = /^[\d.]*/.exec(text.slice(i + 1))![0];
      add(i, i + 1 + arg.length, `${level(depth)}-op`);
      i += 1 + arg.length;
    } else if (",|".includes(c)) {
      add(i, i + 1, `${level(depth)}-op`);
      i++;
    } else if (c === "~" || (c === "-" && !/[\w.]/.test(text[i + 1] ?? ""))) {
      add(i, i + 1, "rest");
      i++;
    } else if (token) {
      if (depth > 0 && !settings.bracketsOnly)
        add(i, i + token.length, level(depth));
      i += token.length;
    } else {
      i++;
    }
  }
  return spans;
};
