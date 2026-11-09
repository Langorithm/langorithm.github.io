import { Completion, snippetCompletion } from "@codemirror/autocomplete";
import { HydraFn, easingNames, hydraFunctions } from "./hydra-api";

/** A function signature shown by signature help: name(param = default, ...) */
export interface Signature {
  name: string;
  params: { name: string; default?: number | string | null }[];
}

export const formatDefault = (
  def: number | string | null | undefined,
): string =>
  def === undefined || def === null ? "" : ` = ${JSON.stringify(def)}`;

const formatParams = (sig: Signature): string =>
  sig.params.map((p) => `${p.name}${formatDefault(p.default)}`).join(", ");

/** name(param = default, ...) */
export const formatSignature = (sig: Signature): string =>
  `${sig.name}(${formatParams(sig)})`;

// combine/combineCoord functions take a texture as their first JS argument
// (the shader's _c0), which is implicit in hydra-synth's input list.
const takesTexture = (fn: HydraFn) =>
  fn.type === "combine" || fn.type === "combineCoord";

const signatureOf = (fn: HydraFn): Signature => ({
  name: fn.name,
  params: [
    ...(takesTexture(fn) ? [{ name: "texture" }] : []),
    ...fn.inputs.map((i) => ({ name: i.name, default: i.default })),
  ],
});

/** List sections, named as in Hydra's docs, by hydra-synth's function types. */
const sectionByType = {
  src: { name: "source", rank: 0 },
  coord: { name: "geometry", rank: 1 },
  color: { name: "color", rank: 2 },
  combine: { name: "blend", rank: 3 },
  combineCoord: { name: "modulate", rank: 4 },
};

const completionOf = (fn: HydraFn, type: string): Completion => ({
  label: fn.name,
  type,
  section: sectionByType[fn.type],
  detail: `(${formatParams(signatureOf(fn))})`,
  info: () => functionCard(fn),
});

/** A function's detail panel: its signature with defaults and its type. */
const functionCard = (fn: HydraFn): HTMLElement => {
  const dom = document.createElement("div");
  const head = dom.appendChild(document.createElement("div"));
  head.style.fontWeight = "bold";
  head.textContent = formatSignature(signatureOf(fn));
  dom.appendChild(document.createElement("div")).textContent =
    `type: ${fn.type}`;
  return dom;
};

// --- Generated from hydra-synth ---

const sourceFns = hydraFunctions.filter((fn) => fn.type === "src");
const methodFns = hydraFunctions.filter((fn) => fn.type !== "src");

export const sourceCompletions: Completion[] = sourceFns.map((fn) =>
  completionOf(fn, "function"),
);

export const methodCompletions: Completion[] = [
  ...methodFns.map((fn) => completionOf(fn, "method")),
  {
    label: "out",
    type: "method",
    section: { name: "output", rank: 5 },
    detail: "(output = o0)",
    info: "Send the chain to an output buffer.",
  },
];

/** Methods whose first argument is a texture, plus texture-taking globals. */
export const textureSlotFns = new Set([
  ...methodFns.filter(takesTexture).map((fn) => fn.name),
  "src",
  "out",
  "render",
]);

// --- Methods hydra-synth adds to Array.prototype (lib/array-utils.js) ---

const arrayMethods: Signature[] = [
  { name: "fast", params: [{ name: "speed", default: 1 }] },
  { name: "smooth", params: [{ name: "smooth", default: 1 }] },
  { name: "ease", params: [{ name: "ease", default: "linear" }] },
  { name: "offset", params: [{ name: "offset", default: 0.5 }] },
  {
    name: "fit",
    params: [
      { name: "low", default: 0 },
      { name: "high", default: 1 },
    ],
  },
];

const arrayMethodInfo: { [name: string]: string } = {
  fast: "Multiply the speed the array is stepped through at. 1 = the global bpm rate.",
  smooth:
    "Interpolate between values instead of jumping. Argument controls smoothness.",
  ease: "Easing function for interpolation between values. Implies smooth(1).",
  offset: "Shift the switching phase. Wrapped modulo 1.",
  fit: "Rescale the array's values linearly into [low, high].",
};

export const arrayMethodCompletions: Completion[] = arrayMethods.map((m) => ({
  label: m.name,
  type: "method",
  detail: `(${formatParams(m)})`,
  info: arrayMethodInfo[m.name],
}));

export const arrayMethodNames = new Set(arrayMethods.map((m) => m.name));

export const easingCompletions: Completion[] = easingNames.map((name) => ({
  label: name,
  type: "constant",
}));

// --- External source buffer methods (hydra-synth hydra-source.js) ---

const sourceBufferMethods: Signature[] = [
  { name: "initCam", params: [{ name: "index", default: 0 }] },
  { name: "initVideo", params: [{ name: "url", default: "" }] },
  { name: "initImage", params: [{ name: "url", default: "" }] },
  { name: "initScreen", params: [{ name: "index", default: 0 }] },
  { name: "initStream", params: [{ name: "streamName" }] },
  { name: "clear", params: [] },
];

export const sourceBufferMethodCompletions: Completion[] =
  sourceBufferMethods.map((m) => ({
    label: m.name,
    type: "method",
    detail: `(${formatParams(m)})`,
  }));

// --- Buffers ---

export const bufferCompletions: Completion[] = [
  ...[0, 1, 2, 3].map((i) => ({
    label: `o${i}`,
    type: "variable",
    info: `Output buffer ${i}.${i === 0 ? " Default render target." : ""}`,
  })),
  ...[0, 1, 2, 3].map((i) => ({
    label: `s${i}`,
    type: "variable",
    info: `External source buffer ${i}. Initialize with s${i}.initCam(), .initVideo(), .initImage(), .initScreen() or .initStream().`,
  })),
];

// --- Hydra globals ---

const hydraGlobals: Completion[] = [
  {
    label: "render",
    type: "function",
    detail: "(output = o0)",
    info: "Render an output buffer to the screen. Call with no arguments to show all four in a grid.",
  },
  {
    label: "hush",
    type: "function",
    detail: "()",
    info: "Clear all outputs.",
  },
  {
    label: "setResolution",
    type: "function",
    detail: "(width, height)",
    info: "Set the render resolution in pixels.",
  },
  {
    label: "speed",
    type: "variable",
    info: "Global time multiplier. Default 1.",
  },
  {
    label: "bpm",
    type: "variable",
    info: "Rate at which arrays are stepped through, in beats per minute. Default 30.",
  },
  { label: "H", type: "variable", info: "The Hydra instance." },
];

// Only meaningful inside an arrow function: hydra evaluates plain arguments
// once at eval time, so outside `() =>` these are frozen at their current
// value instead of updating per frame.
export const dynamicGlobalCompletions: Completion[] = [
  { label: "time", type: "variable", info: "Seconds since hydra started." },
  {
    label: "mouse",
    type: "variable",
    info: "Mouse position in pixels: mouse.x, mouse.y.",
  },
  { label: "width", type: "variable", info: "Canvas width in pixels." },
  { label: "height", type: "variable", info: "Canvas height in pixels." },
];

// --- Flok-specific globals (defined in flok's hydra wrapper, not hydra) ---

const flokGlobals: Completion[] = [
  {
    label: "fft",
    type: "function",
    detail: "(index = 0, buckets = 1, options?)",
    info: "Read Strudel's FFT analyser, normalized to 0–1. index picks a bucket out of `buckets` bands. options: { min = -150, max = 0 (dB), scale = 1, analyzerId = 'flok-master' }. Returns 0.5 until Strudel is playing. Use inside an arrow function: () => fft(0, 4).",
  },
  {
    label: "P",
    type: "function",
    detail: "(pattern)",
    info: 'Sample a Strudel mini-notation pattern as a hydra parameter: osc(P("30 60 120")). Requires Strudel to be loaded.',
  },
  {
    label: "useStrudelCanvas",
    type: "function",
    detail: "(source)",
    info: "Stream Strudel's draw canvas into a source buffer: useStrudelCanvas(s0).",
  },
];

export const globalCompletions: Completion[] = [
  ...sourceCompletions,
  ...hydraGlobals,
  ...flokGlobals,
  ...bufferCompletions,
];

/** What makes sense inside `() =>` in an argument slot: per-frame values. */
export const arrowSlotCompletions: Completion[] = [
  ...dynamicGlobalCompletions,
  ...hydraGlobals.filter((c) => c.label === "speed" || c.label === "bpm"),
  ...flokGlobals.filter((c) => c.label === "fft" || c.label === "P"),
];

// --- Numeric argument slots ---

// In a numeric slot outside an arrow function, plain globals would be frozen
// at eval time, so offer the dynamic forms instead.
/**
 * The forms a number argument can take besides a plain number, shown by
 * shape when writing (detail) and explained when learning (info).
 */
export const numericSlotCompletions: Completion[] = [
  snippetCompletion("[${}]", {
    label: "[ ]",
    boost: 3,
    detail: "sequence",
    type: "keyword",
    info: "Steps through the values, one per beat (bpm, default 30): [0, 1.57]",
  }),
  snippetCompletion("() => ${}", {
    label: "() =>",
    boost: 2,
    detail: "every frame",
    type: "keyword",
    info: "Re-evaluated every frame. Use for time, mouse, fft, etc.: () => time * 0.1",
  }),
  snippetCompletion('P("${}")', {
    label: 'P("")',
    boost: 1,
    detail: "pattern",
    type: "function",
    info: 'Samples a Strudel mini-notation pattern every frame: P("0 1.57")',
  }),
];

// --- Signature table for signature help ---

export const signatures: { [name: string]: Signature } = Object.fromEntries(
  [
    ...hydraFunctions.map(signatureOf),
    { name: "out", params: [{ name: "output", default: null }] },
    { name: "render", params: [{ name: "output", default: null }] },
    {
      name: "setResolution",
      params: [{ name: "width" }, { name: "height" }],
    },
    {
      name: "fft",
      params: [
        { name: "index", default: 0 },
        { name: "buckets", default: 1 },
        { name: "options" },
      ],
    },
    { name: "P", params: [{ name: "pattern" }] },
    ...arrayMethods,
    ...sourceBufferMethods,
  ].map((sig) => [sig.name, sig]),
);
