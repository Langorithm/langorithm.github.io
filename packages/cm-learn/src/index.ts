export { learnHover } from "./hover";
export type { LearnHit, LearnMode, LearnProvider } from "./hover";
export { explainField, isExplaining, learnKeymap } from "./explain";
export type { Card, CardLookup } from "./explain";
export type { ArgumentInfo } from "./structure";
export {
  argumentAt,
  callScopeAt,
  isDecided,
  shapeForMode,
  signatureCard,
  withHeader,
  wordAt,
  wordCompletion,
} from "./structure";
export {
  depthRoles,
  miniDepthSpans,
  miniSpans,
  roleHighlighting,
} from "./roles";
export type { RoleClassifier, RoleSpan, RoleSpec } from "./roles";
