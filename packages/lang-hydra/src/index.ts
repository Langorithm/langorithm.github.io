import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { javascriptLanguage } from "@codemirror/lang-javascript";
import { argContextAt, receiverBefore } from "./context";
import {
  arrayMethodCompletions,
  arrayMethodNames,
  arrowSlotCompletions,
  bufferCompletions,
  easingCompletions,
  globalCompletions,
  methodCompletions,
  numericSlotCompletions,
  sourceBufferMethodCompletions,
  sourceCompletions,
  textureSlotFns,
} from "./completions";

const word = /^\w*$/;

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
    return { from: dot.from + 1, options, validFor: word };
  }

  const prefix = context.matchBefore(/\w*/);
  const from = prefix ? prefix.from : pos;
  if (from === pos && !context.explicit) return null;

  // Inside a function call: complete by what the slot accepts.
  const arg = argContextAt(state, pos);
  if (arg) {
    // Texture slots: blend/modulate-family first argument, src(), out(), render().
    if (arg.argIndex === 0 && textureSlotFns.has(arg.callee)) {
      return {
        from,
        options: [...bufferCompletions, ...sourceCompletions],
        validFor: word,
      };
    }
    // Numeric slots: per-frame values only exist inside an arrow function;
    // outside one, offer the forms that wrap a per-frame value.
    return {
      from,
      options: arg.inArrowFn ? arrowSlotCompletions : numericSlotCompletions,
      validFor: word,
    };
  }

  // Top level.
  return { from, options: globalCompletions, validFor: word };
}

export function hydra() {
  return [
    javascriptLanguage,
    javascriptLanguage.data.of({ autocomplete: hydraCompletionSource }),
  ];
}
