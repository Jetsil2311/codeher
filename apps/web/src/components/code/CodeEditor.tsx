"use client";
// One editor component with a language prop (brief section 8). Python and pseudocode
// share the editor; pseudocode adds keyword snippets, auto-indent, instant Spanish lint,
// a phone keyboard helper strip and the Paso a paso current-line highlight.
import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { EditorState, StateEffect, StateField, Compartment, type Extension } from "@codemirror/state";
import { EditorView, Decoration, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder as cmPlaceholder, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, indentUnit } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { linter, lintGutter, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";
import type { CodeLanguage } from "@codeher/core";
import { lint as pseudoLint } from "@codeher/grader/pseudo";
import { pseudoCompletions, pseudoLanguage } from "./pseudo-language";

// Syntax colors from the brand tokens (brief 2.4): keywords Violet, strings Mint,
// numbers Sun, comments muted, current line Pink. Violet 300 is the small-text violet on Midnight.
const brandHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: "#c9a6f5", fontWeight: "600" },
  { tag: [t.operatorKeyword, t.operator], color: "#f15bb5" },
  { tag: [t.string, t.special(t.string)], color: "#00f5d4" },
  { tag: [t.number, t.bool, t.atom], color: "#fee440" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#9488b3", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#00bbf9" },
  { tag: [t.typeName, t.className], color: "#ffb3dd" },
  { tag: [t.variableName, t.propertyName], color: "#f7f7f7" },
  { tag: t.self, color: "#c9a6f5" },
]);

const midnightTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#1a1036", color: "#f7f7f7" },
    ".cm-content": { caretColor: "#f15bb5", padding: "14px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#f15bb5", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgba(155, 93, 229, 0.38) !important" },
    ".cm-gutters": { backgroundColor: "#1a1036", color: "#6f6390", border: "none", paddingLeft: "6px" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.035)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#c9a6f5" },
    ".cm-line": { padding: "0 14px 0 6px" },
    ".cm-tooltip": { backgroundColor: "#231848", border: "1px solid #3a2d6b", color: "#f7f7f7", borderRadius: "12px", overflow: "hidden" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#9b5de5", color: "#fff" },
    ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)" },
    ".cm-completionDetail": { color: "#b8acd6", fontStyle: "normal", marginLeft: "0.75em" },
    ".cm-diagnostic-error": { borderLeft: "3px solid #f15bb5", padding: "6px 10px", fontFamily: "var(--font-sans)" },
    ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy #f15bb5", textUnderlineOffset: "4px" },
    ".cm-step-line": { backgroundColor: "rgba(241, 91, 181, 0.22)", boxShadow: "inset 3px 0 0 #f15bb5" },
    ".cm-error-line": { backgroundColor: "rgba(241, 91, 181, 0.12)" },
    ".cm-placeholder": { color: "#7d70a3" },
  },
  { dark: true },
);

// Current line highlight for Paso a paso (and the error line).
const setLines = StateEffect.define<{ step: number | null; error: number | null }>();
const linesField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setLines)) continue;
      const ranges = [];
      const { step, error } = e.value;
      const doc = tr.state.doc;
      if (error && error >= 1 && error <= doc.lines) ranges.push(Decoration.line({ class: "cm-error-line" }).range(doc.line(error).from));
      if (step && step >= 1 && step <= doc.lines) ranges.push(Decoration.line({ class: "cm-step-line" }).range(doc.line(step).from));
      deco = Decoration.set(ranges.sort((a, b) => a.from - b.from));
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const pseudoLinter = linter(
  (view) => {
    const code = view.state.doc.toString();
    const out: CmDiagnostic[] = [];
    for (const d of pseudoLint(code)) {
      if (d.line > view.state.doc.lines) continue;
      const line = view.state.doc.line(d.line);
      const from = Math.min(line.from + Math.max(0, d.column - 1), line.to);
      const to = Math.max(from + 1, Math.min(line.from + Math.max(0, (d.endColumn ?? d.column + 1) - 1), line.to));
      out.push({ from, to: Math.min(to, view.state.doc.length), severity: "error", message: d.message });
    }
    return out;
  },
  { delay: 450 },
);

export interface CodeEditorProps {
  value: string;
  onChange?: (v: string) => void;
  language: CodeLanguage;
  readOnly?: boolean;
  stepLine?: number | null;
  errorLine?: number | null;
  minHeight?: number;
  label: string;
  onRun?: () => void;
  className?: string;
  /** Grow to the parent's height (fullscreen workspace). */
  fill?: boolean;
}

export function CodeEditor({ value, onChange, language, readOnly, stepLine = null, errorLine = null, minHeight = 220, label, onRun, className, fill }: CodeEditorProps) {
  const t = useTranslations("learn.editor");
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const langComp = useMemo(() => new Compartment(), []);
  const roComp = useMemo(() => new Compartment(), []);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  const languageExtensions = (lang: CodeLanguage): Extension =>
    lang === "python"
      ? [python()]
      : [pseudoLanguage, autocompletion({ override: [pseudoCompletions], icons: false }), pseudoLinter, lintGutter()];

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        syntaxHighlighting(brandHighlight),
        midnightTheme,
        linesField,
        cmPlaceholder(t("placeholder")),
        keymap.of([
          { key: "Mod-Enter", run: () => (onRunRef.current?.(), true) },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": label, autocapitalize: "off", autocorrect: "off", spellcheck: "false" }),
        langComp.of(languageExtensions(language)),
        roComp.of([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: langComp.reconfigure(languageExtensions(language)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);
  useEffect(() => {
    view.current?.dispatch({ effects: roComp.reconfigure([EditorState.readOnly.of(!!readOnly), EditorView.editable.of(!readOnly)]) });
  }, [readOnly, roComp]);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch({ effects: setLines.of({ step: stepLine, error: errorLine }) });
    if (stepLine && stepLine <= v.state.doc.lines) v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(stepLine).from, { y: "nearest" }) });
  }, [stepLine, errorLine]);

  const insert = (text: string) => {
    const v = view.current;
    if (!v || readOnly) return;
    const { from, to } = v.state.selection.main;
    const cursorBack = text.endsWith('""') ? 1 : 0;
    v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length - cursorBack } });
    v.focus();
  };

  const HELPER = ["<-", "<>", "<=", ">=", ";", '""', "Si", "Para", "Mientras", "Segun"];

  return (
    <div className={`flex min-w-0 flex-col overflow-hidden bg-midnight ${fill ? "h-full" : ""} ${className ?? "rounded-[1.25rem] ring-1 ring-white/5"}`}>
      <div ref={host} style={fill ? undefined : { minHeight }} className={fill ? "min-h-0 flex-1 overflow-hidden [&_.cm-editor]:h-full" : "[&_.cm-editor]:min-h-[inherit]"} />
      {language === "pseudocode_es" && !readOnly && (
        <div role="toolbar" aria-label={t("helper")} className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-white/10 bg-midnight-2 px-2 py-2 md:hidden">
          {HELPER.map((h) => (
            <button
              key={h}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(/^[A-Z]/.test(h) ? `${h} ` : h)}
              className="min-h-10 min-w-11 shrink-0 rounded-xl bg-white/8 px-3 font-mono text-sm text-paper [font-variant-ligatures:none] active:scale-95"
            >
              {h === '""' ? "“ ”" : h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
