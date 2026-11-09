import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { javascriptLanguage } from "@codemirror/lang-javascript";
import {
  learnHover,
  learnKeymap,
  roleHighlighting,
  shapeForMode,
  signatureCard,
  wordCompletion,
} from "@flok-editor/cm-learn";
import type { ArgumentInfo } from "@flok-editor/cm-learn";
import type { Extension } from "@codemirror/state";
import { argContextAt, receiverBefore } from "./context";
import { argumentCardFor, hydraCards, hydraLearn } from "./learn";
import { hydraColors, hydraRoles } from "./colors";
import {
  arrayMethodCompletions,
  arrayMethodNames,
  arrowSlotCompletions,
  bufferCompletions,
  easingCompletions,
  globalCompletions,
  methodCompletions,
  numericSlotCompletions,
  signatures,
  sourceBufferMethodCompletions,
  sourceCompletions,
  textureSlotFns,
} from "./completions";

const word = /^\w*$/;

/**
 * Shape the list for its mode (see shapeForMode): writing shows where you
 * are, rotate( **angle**, speed ), over the options' shapes; learning opens
 * on the argument itself.
 */
function learningSource(context: CompletionContext): CompletionResult | null {
  const result = hydraCompletionSource(context);
  const arg = argContextAt(context.state, context.pos);
  const sig = arg && signatures[arg.callee];
  const param = arg && sig?.params[arg.argIndex];
  const info: ArgumentInfo | null =
    arg && sig && param
      ? {
          name: param.name,
          header: argumentCardFor(arg.callee, arg.argIndex)!,
          detail: argumentCardFor(arg.callee, arg.argIndex)!,
        }
      : null;
  return shapeForMode(context, result, info);
}

function hydraCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  const { state, pos } = context;

  const token = context.tokenBefore([
    "String",
    "TemplateString",
    "LineComment",
    "BlockComment",
  ]);
  if (token) {
    // Inside a string, only easing names in ease('...') complete.
    if (token.type.name !== "String") return null;
    const arg = argContextAt(state, token.from);
    if (arg?.callee !== "ease" || arg.argIndex !== 0) return null;
    return { from: token.from + 1, options: easingCompletions, validFor: word };
  }

  // Method completion: after a dot, on whatever the dot follows.
  const dot = context.matchBefore(/\.\w*/);
  if (dot) {
    if (/^\.\d/.test(dot.text)) return null; // a number like .5
    const receiver = receiverBefore(state, dot.from, arrayMethodNames);
    if (!receiver) return null;
    const options =
      receiver.kind === "array"
        ? arrayMethodCompletions
        : receiver.kind === "sourceBuffer"
          ? sourceBufferMethodCompletions
          : methodCompletions;
    return wordCompletion(context, dot.from + 1, options);
  }

  const prefix = context.matchBefore(/\w*/);
  const from = prefix ? prefix.from : pos;
  if (from === pos && !context.explicit) return null;

  // Inside a function call: complete by what the slot accepts.
  const arg = argContextAt(state, pos);
  if (arg) {
    // Texture slots: blend/modulate-family first argument, src(), out(), render().
    if (arg.argIndex === 0 && textureSlotFns.has(arg.callee)) {
      return wordCompletion(context, from, [
        ...bufferCompletions,
        ...sourceCompletions,
      ]);
    }
    // Numeric slots: per-frame values only exist inside an arrow function;
    // outside one, offer the forms that wrap a per-frame value.
    if (arg.inArrowFn)
      return wordCompletion(context, from, arrowSlotCompletions);
    // Its default first, then the forms that make a number move.
    const def = signatures[arg.callee]?.params[arg.argIndex]?.default;
    const options =
      typeof def === "number"
        ? [
            {
              label: String(def),
              detail: "default",
              boost: 4,
              type: "constant",
              info: `The default for this argument: ${def}`,
            },
            ...numericSlotCompletions,
          ]
        : numericSlotCompletions;
    return wordCompletion(context, from, options);
  }

  // Top level.
  return wordCompletion(context, from, globalCompletions);
}

export function hydra(): Extension {
  return [
    javascriptLanguage,
    javascriptLanguage.data.of({ autocomplete: learningSource }),
    learnKeymap(hydraCards),
    learnHover(hydraLearn),
    roleHighlighting(hydraColors, hydraRoles),
  ];
}
export { hydraLearn } from "./learn";
export { hydraColors } from "./colors";
