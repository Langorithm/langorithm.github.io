import { completionStatus, startCompletion } from "@codemirror/autocomplete";
import {
  EditorState,
  Extension,
  Prec,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, EditorView, keymap, showTooltip } from "@codemirror/view";

// Same look as the hover underline (cm-learn-target, styled in hover.ts).
const cardUnderline = Decoration.mark({ class: "cm-learn-target" });

// The keys. Ctrl-Space: what can go here (the option list). Alt-Space: the
// same, explained (the learning list). Alt-/ does what Alt-Space does where
// the system takes Alt-Space (the window menu on Windows); on a Mac taking it
// also stops Option-Space from typing an invisible non-breaking space.
//
// When the word under the cursor already names exactly one thing (o|sc,
// lp|f), there's nothing to choose: instead of a list, Ctrl-Space shows its
// short card (the signature) and Alt-Space its detailed card.

/** A card about one thing: where it points, and how to draw it. */
export interface Card {
  pos: number;
  dom: () => HTMLElement;
  /** What the card is about, underlined while it shows */
  underline?: { from: number; to: number };
}

export interface CardLookup {
  /** The short card for Ctrl-Space, when the word names one thing. */
  short?: (state: EditorState, pos: number) => Card | null;
  /** The detailed card for Alt-Space, when the word names one thing. */
  detail?: (state: EditorState, pos: number) => Card | null;
}

const setExplain = StateEffect.define<boolean>();

/** True while a list opened with Alt-Space is showing. */
export const explainField = StateField.define<boolean>({
  create: () => false,
  update(explain, tr) {
    for (const e of tr.effects) if (e.is(setExplain)) return e.value;
    // Back to the short list once this one closes.
    if (explain && completionStatus(tr.state) === null) return false;
    return explain;
  },
});

export const isExplaining = (state: EditorState): boolean =>
  state.field(explainField, false) ?? false;

const setCard = StateEffect.define<Card | null>();

const cardField = StateField.define<Card | null>({
  create: () => null,
  update(card, tr) {
    for (const e of tr.effects) if (e.is(setCard)) return e.value;
    // Moving or typing dismisses it.
    return tr.docChanged || tr.selection ? null : card;
  },
  provide: (field) => [
    EditorView.decorations.from(field, (card) =>
      card?.underline && card.underline.from < card.underline.to
        ? Decoration.set([
            cardUnderline.range(card.underline.from, card.underline.to),
          ])
        : Decoration.none,
    ),
    showTooltip.from(field, (card) =>
      card
        ? {
            pos: card.pos,
            above: true,
            arrow: false,
            create: () => {
              const dom = card.dom();
              dom.classList.add("cm-learn-card");
              return { dom };
            },
          }
        : null,
    ),
  ],
});

const showCard = (view: EditorView, card: Card | null) => {
  if (!card) return false;
  view.dispatch({ effects: setCard.of(card) });
  return true;
};

export const learnKeymap = (lookup: CardLookup = {}): Extension => {
  const head = (view: EditorView) => view.state.selection.main.head;
  const explained = (view: EditorView) => {
    if (showCard(view, lookup.detail?.(view.state, head(view)) ?? null))
      return true;
    view.dispatch({ effects: setExplain.of(true) });
    startCompletion(view);
    return true;
  };
  return [
    explainField,
    cardField,
    cardTheme,
    // Highest, like the autocompletion keymap that also binds Ctrl-Space;
    // this is registered earlier, so it gets the key first.
    Prec.highest(
      keymap.of([
        // Returning false falls through to the editor's own Ctrl-Space.
        {
          key: "Ctrl-Space",
          run: (view) =>
            showCard(view, lookup.short?.(view.state, head(view)) ?? null),
        },
        { key: "Alt-Space", run: explained },
        { key: "Alt-/", run: explained },
        {
          key: "Escape",
          run: (view) => {
            if (!view.state.field(cardField)) return false;
            view.dispatch({ effects: setCard.of(null) });
            return true;
          },
        },
      ]),
    ),
  ];
};

const cardTheme = EditorView.baseTheme({
  ".cm-tooltip.cm-learn-card": {
    padding: "4px 8px",
    fontFamily: "inherit",
    maxWidth: "36em",
    maxHeight: "28em",
    overflowY: "auto",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});
