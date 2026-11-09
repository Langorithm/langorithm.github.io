import { EditorView } from "@codemirror/view";

/** Styles for the detail panel beside the learning list (Alt-Space). */
export const strudelTheme = EditorView.baseTheme({
  ".cm-strudel-info": {
    maxWidth: "32em",
    maxHeight: "24em",
    overflowY: "auto",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  ".cm-strudel-info > div + div, .cm-strudel-info > pre": {
    marginTop: "0.4em",
  },
  ".cm-strudel-info-synonyms": { opacity: "0.75" },
  ".cm-strudel-info-call": { fontWeight: "bold" },
  ".cm-strudel-info-link": {
    display: "inline-block",
    marginTop: "0.4em",
    textDecoration: "underline",
  },
  ".cm-strudel-info-example": {
    margin: "0.4em 0 0",
    padding: "0.3em 0.5em",
    background: "rgba(127, 127, 127, 0.15)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontFamily: "inherit",
  },
});
