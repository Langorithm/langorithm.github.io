import { StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  sliderPlugin,
  sliderValues,
  updateSliderWidgets,
} from "@strudel/codemirror";

// Inline slider widgets for slider(value, min, max) in Strudel documents.
//
// Strudel's transpiler turns each slider(...) into a value the pattern reads
// at query time, keyed by the position of its first argument. The widget
// itself rewrites that number in the code as it's dragged. Here, whenever
// the number inside a slider(...) changes, by dragging, by typing, or by a
// remote edit synced from another user, the new value is posted to the
// Strudel frame, so everyone in the session hears the slider move live.

export interface SliderConfig {
  type: "slider";
  /** Position of the value argument, at eval time */
  from: number;
  to: number;
  value: string;
  min: number;
  max: number;
  step?: number;
}

interface TrackedSlider {
  /** Matches the id the transpiler gave this slider */
  id: string;
  /** Current position of the value argument */
  pos: number;
  value: number;
}

const setSliders = StateEffect.define<SliderConfig[]>();

const number = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?/i;

const numberAt = (view: EditorView, pos: number): string | null =>
  number.exec(view.state.doc.sliceString(pos, pos + 32))?.[0] ?? null;

/**
 * Point the slider widget at `pos` to the number now in the code. The widget
 * replaces `originalValue.length` characters on each drag, so after a typed
 * or remote edit changes the number's length it would otherwise overwrite
 * the wrong span: slider(291.1, ...) edited to 3200 then dragged ate the comma.
 */
const syncWidgetAt = (view: EditorView, pos: number, text: string) => {
  view.dom.querySelectorAll<HTMLInputElement>(".cm-slider input").forEach(
    (input: any) => {
      if (input.from !== pos || input.originalValue === text) return;
      input.originalValue = text;
      input.value = text;
    },
  );
};

const postToStrudel = (id: string, value: number) => {
  window.strudel?.postMessage({ type: "cm-slider", id, value }, "*");
};

const trackedSliders = StateField.define<TrackedSlider[]>({
  create: () => [],
  update(sliders, tr) {
    for (const e of tr.effects)
      if (e.is(setSliders))
        return e.value.map((w) => ({
          id: `slider_${w.from}`,
          pos: w.from,
          value: Number(w.value),
        }));
    if (!tr.docChanged) return sliders;
    // assoc -1 keeps a slider on the start of its number when the number is
    // replaced, as the widget does on every drag.
    return sliders.map((s) => ({ ...s, pos: tr.changes.mapPos(s.pos, -1) }));
  },
});

const forwardValues = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return;
  for (const slider of update.state.field(trackedSliders)) {
    const text = numberAt(update.view, slider.pos);
    if (text === null) continue;
    syncWidgetAt(update.view, slider.pos, text);
    const value = Number(text);
    if (value === slider.value) continue;
    slider.value = value;
    postToStrudel(slider.id, value);
  }
});

export const strudelSliders = () => [sliderPlugin, trackedSliders, forwardValues];

const appliedWidgets = new WeakMap<EditorView, SliderConfig[]>();

/** Show the sliders from the latest eval, if they changed. */
export const syncSliderWidgets = (
  view: EditorView,
  widgets: SliderConfig[] | undefined,
) => {
  if (!widgets || appliedWidgets.get(view) === widgets) return;
  appliedWidgets.set(view, widgets);
  // The widget also posts each drag to this window, where @strudel/codemirror
  // warns about ids it doesn't know. The real values live in the Strudel
  // frame; registering the ids here just keeps the console quiet.
  for (const w of widgets) sliderValues[`slider_${w.from}`] = Number(w.value);
  updateSliderWidgets(view, widgets);
  view.dispatch({ effects: setSliders.of(widgets) });
};
