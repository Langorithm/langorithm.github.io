// Generated from hydra-synth@1.4.0 by script/generate.js — do not edit.
// Regenerate with: npm run generate

/** Where a function can appear and what its implicit arguments are:
 * - src: standalone source (osc, noise, ...)
 * - coord, color: chainable transform, all-float arguments
 * - combine, combineCoord: chainable transform whose first JS argument is a
 *   texture (an output/source buffer or another source chain)
 */
export type HydraFnType =
  | "src"
  | "coord"
  | "color"
  | "combine"
  | "combineCoord";

export interface HydraFnInput {
  name: string;
  type: string;
  default: number | string | null;
}

export interface HydraFn {
  name: string;
  type: HydraFnType;
  inputs: HydraFnInput[];
}

export const hydraFunctions: HydraFn[] = [
  {
    name: "noise",
    type: "src",
    inputs: [
      {
        name: "scale",
        type: "float",
        default: 10,
      },
      {
        name: "offset",
        type: "float",
        default: 0.1,
      },
    ],
  },
  {
    name: "voronoi",
    type: "src",
    inputs: [
      {
        name: "scale",
        type: "float",
        default: 5,
      },
      {
        name: "speed",
        type: "float",
        default: 0.3,
      },
      {
        name: "blending",
        type: "float",
        default: 0.3,
      },
    ],
  },
  {
    name: "osc",
    type: "src",
    inputs: [
      {
        name: "frequency",
        type: "float",
        default: 60,
      },
      {
        name: "sync",
        type: "float",
        default: 0.1,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "shape",
    type: "src",
    inputs: [
      {
        name: "sides",
        type: "float",
        default: 3,
      },
      {
        name: "radius",
        type: "float",
        default: 0.3,
      },
      {
        name: "smoothing",
        type: "float",
        default: 0.01,
      },
    ],
  },
  {
    name: "gradient",
    type: "src",
    inputs: [
      {
        name: "speed",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "src",
    type: "src",
    inputs: [
      {
        name: "tex",
        type: "sampler2D",
        default: null,
      },
    ],
  },
  {
    name: "solid",
    type: "src",
    inputs: [
      {
        name: "r",
        type: "float",
        default: 0,
      },
      {
        name: "g",
        type: "float",
        default: 0,
      },
      {
        name: "b",
        type: "float",
        default: 0,
      },
      {
        name: "a",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "rotate",
    type: "coord",
    inputs: [
      {
        name: "angle",
        type: "float",
        default: 10,
      },
      {
        name: "speed",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "scale",
    type: "coord",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 1.5,
      },
      {
        name: "xMult",
        type: "float",
        default: 1,
      },
      {
        name: "yMult",
        type: "float",
        default: 1,
      },
      {
        name: "offsetX",
        type: "float",
        default: 0.5,
      },
      {
        name: "offsetY",
        type: "float",
        default: 0.5,
      },
    ],
  },
  {
    name: "pixelate",
    type: "coord",
    inputs: [
      {
        name: "pixelX",
        type: "float",
        default: 20,
      },
      {
        name: "pixelY",
        type: "float",
        default: 20,
      },
    ],
  },
  {
    name: "posterize",
    type: "color",
    inputs: [
      {
        name: "bins",
        type: "float",
        default: 3,
      },
      {
        name: "gamma",
        type: "float",
        default: 0.6,
      },
    ],
  },
  {
    name: "shift",
    type: "color",
    inputs: [
      {
        name: "r",
        type: "float",
        default: 0.5,
      },
      {
        name: "g",
        type: "float",
        default: 0,
      },
      {
        name: "b",
        type: "float",
        default: 0,
      },
      {
        name: "a",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "repeat",
    type: "coord",
    inputs: [
      {
        name: "repeatX",
        type: "float",
        default: 3,
      },
      {
        name: "repeatY",
        type: "float",
        default: 3,
      },
      {
        name: "offsetX",
        type: "float",
        default: 0,
      },
      {
        name: "offsetY",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "modulateRepeat",
    type: "combineCoord",
    inputs: [
      {
        name: "repeatX",
        type: "float",
        default: 3,
      },
      {
        name: "repeatY",
        type: "float",
        default: 3,
      },
      {
        name: "offsetX",
        type: "float",
        default: 0.5,
      },
      {
        name: "offsetY",
        type: "float",
        default: 0.5,
      },
    ],
  },
  {
    name: "repeatX",
    type: "coord",
    inputs: [
      {
        name: "reps",
        type: "float",
        default: 3,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "modulateRepeatX",
    type: "combineCoord",
    inputs: [
      {
        name: "reps",
        type: "float",
        default: 3,
      },
      {
        name: "offset",
        type: "float",
        default: 0.5,
      },
    ],
  },
  {
    name: "repeatY",
    type: "coord",
    inputs: [
      {
        name: "reps",
        type: "float",
        default: 3,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "modulateRepeatY",
    type: "combineCoord",
    inputs: [
      {
        name: "reps",
        type: "float",
        default: 3,
      },
      {
        name: "offset",
        type: "float",
        default: 0.5,
      },
    ],
  },
  {
    name: "kaleid",
    type: "coord",
    inputs: [
      {
        name: "nSides",
        type: "float",
        default: 4,
      },
    ],
  },
  {
    name: "modulateKaleid",
    type: "combineCoord",
    inputs: [
      {
        name: "nSides",
        type: "float",
        default: 4,
      },
    ],
  },
  {
    name: "scroll",
    type: "coord",
    inputs: [
      {
        name: "scrollX",
        type: "float",
        default: 0.5,
      },
      {
        name: "scrollY",
        type: "float",
        default: 0.5,
      },
      {
        name: "speedX",
        type: "float",
        default: 0,
      },
      {
        name: "speedY",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "scrollX",
    type: "coord",
    inputs: [
      {
        name: "scrollX",
        type: "float",
        default: 0.5,
      },
      {
        name: "speed",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "modulateScrollX",
    type: "combineCoord",
    inputs: [
      {
        name: "scrollX",
        type: "float",
        default: 0.5,
      },
      {
        name: "speed",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "scrollY",
    type: "coord",
    inputs: [
      {
        name: "scrollY",
        type: "float",
        default: 0.5,
      },
      {
        name: "speed",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "modulateScrollY",
    type: "combineCoord",
    inputs: [
      {
        name: "scrollY",
        type: "float",
        default: 0.5,
      },
      {
        name: "speed",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "add",
    type: "combine",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "sub",
    type: "combine",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "layer",
    type: "combine",
    inputs: [],
  },
  {
    name: "blend",
    type: "combine",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 0.5,
      },
    ],
  },
  {
    name: "mult",
    type: "combine",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "diff",
    type: "combine",
    inputs: [],
  },
  {
    name: "modulate",
    type: "combineCoord",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 0.1,
      },
    ],
  },
  {
    name: "modulateScale",
    type: "combineCoord",
    inputs: [
      {
        name: "multiple",
        type: "float",
        default: 1,
      },
      {
        name: "offset",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "modulatePixelate",
    type: "combineCoord",
    inputs: [
      {
        name: "multiple",
        type: "float",
        default: 10,
      },
      {
        name: "offset",
        type: "float",
        default: 3,
      },
    ],
  },
  {
    name: "modulateRotate",
    type: "combineCoord",
    inputs: [
      {
        name: "multiple",
        type: "float",
        default: 1,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "modulateHue",
    type: "combineCoord",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "invert",
    type: "color",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "contrast",
    type: "color",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 1.6,
      },
    ],
  },
  {
    name: "brightness",
    type: "color",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 0.4,
      },
    ],
  },
  {
    name: "mask",
    type: "combine",
    inputs: [],
  },
  {
    name: "luma",
    type: "color",
    inputs: [
      {
        name: "threshold",
        type: "float",
        default: 0.5,
      },
      {
        name: "tolerance",
        type: "float",
        default: 0.1,
      },
    ],
  },
  {
    name: "thresh",
    type: "color",
    inputs: [
      {
        name: "threshold",
        type: "float",
        default: 0.5,
      },
      {
        name: "tolerance",
        type: "float",
        default: 0.04,
      },
    ],
  },
  {
    name: "color",
    type: "color",
    inputs: [
      {
        name: "r",
        type: "float",
        default: 1,
      },
      {
        name: "g",
        type: "float",
        default: 1,
      },
      {
        name: "b",
        type: "float",
        default: 1,
      },
      {
        name: "a",
        type: "float",
        default: 1,
      },
    ],
  },
  {
    name: "saturate",
    type: "color",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 2,
      },
    ],
  },
  {
    name: "hue",
    type: "color",
    inputs: [
      {
        name: "hue",
        type: "float",
        default: 0.4,
      },
    ],
  },
  {
    name: "colorama",
    type: "color",
    inputs: [
      {
        name: "amount",
        type: "float",
        default: 0.005,
      },
    ],
  },
  {
    name: "prev",
    type: "src",
    inputs: [],
  },
  {
    name: "sum",
    type: "color",
    inputs: [
      {
        name: "scale",
        type: "vec4",
        default: 1,
      },
    ],
  },
  {
    name: "r",
    type: "color",
    inputs: [
      {
        name: "scale",
        type: "float",
        default: 1,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "g",
    type: "color",
    inputs: [
      {
        name: "scale",
        type: "float",
        default: 1,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "b",
    type: "color",
    inputs: [
      {
        name: "scale",
        type: "float",
        default: 1,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
  {
    name: "a",
    type: "color",
    inputs: [
      {
        name: "scale",
        type: "float",
        default: 1,
      },
      {
        name: "offset",
        type: "float",
        default: 0,
      },
    ],
  },
];

/** Names accepted by Array.prototype.ease */
export const easingNames: string[] = [
  "linear",
  "easeInQuad",
  "easeOutQuad",
  "easeInOutQuad",
  "easeInCubic",
  "easeOutCubic",
  "easeInOutCubic",
  "easeInQuart",
  "easeOutQuart",
  "easeInOutQuart",
  "easeInQuint",
  "easeOutQuint",
  "easeInOutQuint",
  "sin",
];
