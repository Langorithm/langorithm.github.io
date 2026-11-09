import {
  EditorState,
  Extension,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  showTooltip,
} from "@codemirror/view";

// Hover help. Holding Alt ("learn") over code underlines the thing under the
// mouse and shows a one-line tip; Alt-click opens its docs. Holding Ctrl
// ("outline") underlines the structure it belongs to, with no text: what a
// modifier applies to, a whole [group] in a pattern.
// Language-agnostic: each language supplies a provider that says what's at
// a position, for either gesture.

export interface LearnHit {
  /** Document span to underline */
  from: number;
  to: number;
  /** One-line explanation; empty for an underline alone (Ctrl-hover) */
  tip: string;
  /** A richer tip to show instead of the text, e.g. an argument card */
  card?: () => HTMLElement;
  /** Docs page opened by Alt-click */
  url?: string;
}

/** learn: Alt-hover, with a tip. outline: Ctrl-hover, structure only. */
export type LearnMode = "learn" | "outline";

export type LearnProvider = (
  state: EditorState,
  pos: number,
  mode: LearnMode,
) => LearnHit | null;

const setHit = StateEffect.define<LearnHit | null>();

const sameHit = (a: LearnHit | null, b: LearnHit | null) =>
  a === b ||
  (!!a && !!b && a.from === b.from && a.to === b.to && a.tip === b.tip);

const underline = Decoration.mark({ class: "cm-learn-target" });

const hitField = StateField.define<LearnHit | null>({
  create: () => null,
  update(hit, tr) {
    for (const e of tr.effects) if (e.is(setHit)) return e.value;
    // Editing moves or invalidates the span; drop it.
    return tr.docChanged ? null : hit;
  },
  provide: (field) => [
    EditorView.decorations.from(field, (hit) =>
      hit
        ? Decoration.set([underline.range(hit.from, hit.to)])
        : Decoration.none,
    ),
    showTooltip.from(field, (hit) =>
      hit?.tip
        ? {
            pos: hit.from,
            above: true,
            arrow: false,
            create: () => {
              const dom = document.createElement("div");
              dom.className = "cm-learn-tip";
              if (hit.card) dom.appendChild(hit.card());
              else dom.textContent = hit.tip;
              if (hit.url) {
                const more = dom.appendChild(document.createElement("span"));
                more.className = "cm-learn-more";
                more.textContent = " · Alt-click to learn more";
              }
              return { dom };
            },
          }
        : null,
    ),
  ],
});

/** The document position of the character under the mouse, or null. */
const charAt = (view: EditorView, x: number, y: number): number | null => {
  const pos = view.posAtCoords({ x, y });
  if (pos === null) return null;
  // posAtCoords gives the nearest boundary; step back if the mouse is over
  // the character before it.
  const coords = view.coordsAtPos(pos);
  if (coords && x < coords.left && pos > 0) return pos - 1;
  return pos < view.state.doc.length ? pos : null;
};

class HoverView {
  view: EditorView;
  provider: LearnProvider;
  mouse: { x: number; y: number } | null = null;
  down: { x: number; y: number } | null = null;

  constructor(view: EditorView, provider: LearnProvider) {
    this.view = view;
    this.provider = provider;
    this.onKey = this.onKey.bind(this);
    this.clear = this.clear.bind(this);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    window.addEventListener("blur", this.clear);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("blur", this.clear);
  }

  /** Alt: learn (underline and tip). Ctrl: outline (underline only). */
  show(e: { altKey: boolean; ctrlKey: boolean }) {
    const { view } = this;
    let hit: LearnHit | null = null;
    if ((e.altKey || e.ctrlKey) && this.mouse) {
      const pos = charAt(view, this.mouse.x, this.mouse.y);
      const mode: LearnMode = e.altKey ? "learn" : "outline";
      if (pos !== null) hit = this.provider(view.state, pos, mode);
      if (hit && mode === "outline")
        hit = { from: hit.from, to: hit.to, tip: "" };
    }
    if (!sameHit(hit, view.state.field(hitField)))
      view.dispatch({ effects: setHit.of(hit) });
  }

  clear() {
    if (this.view.state.field(hitField))
      this.view.dispatch({ effects: setHit.of(null) });
  }

  // Pressing or releasing Alt or Ctrl over a still mouse shows or hides it.
  onKey(e: KeyboardEvent) {
    if (e.key === "Alt" || e.key === "Control") this.show(e);
  }

  mousemove(e: MouseEvent) {
    this.mouse = { x: e.clientX, y: e.clientY };
    this.show(e);
  }

  mouseleave() {
    this.mouse = null;
    this.clear();
  }

  mousedown(e: MouseEvent) {
    this.down = e.altKey ? { x: e.clientX, y: e.clientY } : null;
  }

  // Alt-click opens the docs. Alt-drag still makes a column selection: only
  // a click that didn't move counts.
  mouseup(e: MouseEvent) {
    const down = this.down;
    this.down = null;
    if (!e.altKey || !down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
    const hit = this.view.state.field(hitField);
    if (hit?.url) window.open(hit.url, "_blank", "noopener");
  }
}

const hoverPlugin = (provider: LearnProvider) =>
  ViewPlugin.define((view) => new HoverView(view, provider), {
    eventHandlers: {
      mousemove(e) {
        this.mousemove(e);
      },
      mouseleave() {
        this.mouseleave();
      },
      mousedown(e) {
        this.mousedown(e);
      },
      mouseup(e) {
        this.mouseup(e);
      },
    },
  });

const theme = EditorView.baseTheme({
  // An underline takes the colour of the element that sets it, so set it on
  // the syntax-highlighted tokens inside too: each is underlined in its own
  // theme colour.
  ".cm-learn-target, .cm-learn-target *": {
    textDecoration: "underline 1px",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip.cm-learn-tip": {
    padding: "2px 6px",
    fontFamily: "inherit",
    maxWidth: "40em",
  },
  ".cm-learn-more": { opacity: "0.6" },
  // The "where you are" header over the writing list.
  ".cm-learn-section": {
    padding: "2px 8px",
    opacity: "0.85",
    borderBottom: "1px solid rgba(127, 127, 127, 0.3)",
  },
  // In the learning list the panel is the point: give it room.
  ".cm-tooltip.cm-completionInfo": {
    maxWidth: "36em",
    padding: "6px 10px",
  },
  ".cm-learn-header": {
    paddingBottom: "0.4em",
    marginBottom: "0.4em",
    borderBottom: "1px solid rgba(127, 127, 127, 0.3)",
  },
});

export const learnHover = (provider: LearnProvider): Extension => [
  hitField,
  hoverPlugin(provider),
  theme,
];
