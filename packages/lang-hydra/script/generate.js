// Generates src/hydra-api.ts from hydra-synth's own function definitions.
// hydra-synth builds its JS API at runtime from these same data files, so
// completions generated here always match the installed hydra-synth version.
//
// Run with: npm run generate

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

// hydra-synth's `exports` map only exposes ./src/glsl/glsl-functions.js, so
// resolve the other data files relative to it.
const glslFunctionsPath = require.resolve(
  "hydra-synth/src/glsl/glsl-functions.js",
);
const srcDir = dirname(dirname(glslFunctionsPath));
const version = require(join(dirname(srcDir), "package.json")).version;

const glslFunctions = (
  await import(pathToFileURL(glslFunctionsPath))
).default();
const easingFunctions = (
  await import(pathToFileURL(join(srcDir, "lib", "easing-functions.js")))
).default;

const functions = glslFunctions.map(({ name, type, inputs }) => ({
  name,
  type,
  inputs: inputs.map(({ name, type, default: def }) => ({
    name,
    type,
    default: def,
  })),
}));

const easingNames = Object.keys(easingFunctions);

const out = `// Generated from hydra-synth@${version} by script/generate.js — do not edit.
// Regenerate with: npm run generate

/** Where a function can appear and what its implicit arguments are:
 * - src: standalone source (osc, noise, ...)
 * - coord, color: chainable transform, all-float arguments
 * - combine, combineCoord: chainable transform whose first JS argument is a
 *   texture (an output/source buffer or another source chain)
 */
export type HydraFnType = "src" | "coord" | "color" | "combine" | "combineCoord";

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

export const hydraFunctions: HydraFn[] = ${JSON.stringify(functions, null, 2)};

/** Names accepted by Array.prototype.ease */
export const easingNames: string[] = ${JSON.stringify(easingNames, null, 2)};
`;

const dest = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "hydra-api.ts",
);
writeFileSync(dest, out);
console.log(
  `Wrote ${functions.length} functions, ${easingNames.length} easing names (hydra-synth@${version}) to src/hydra-api.ts`,
);
