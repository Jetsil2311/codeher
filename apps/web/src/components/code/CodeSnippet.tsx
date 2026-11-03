// Read-only, server-rendered syntax highlighting with the same brand palette as the editor.
import { lex, RESERVED } from "@codeher/grader/pseudo";
import type { CodeLanguage } from "@codeher/core";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

const C = { kw: "text-[#c9a6f5] font-semibold", str: "text-mint", num: "text-sun", com: "text-[#9488b3] italic", op: "text-pink", fn: "text-sky", id: "text-paper" };
const PY_KW = new Set(["def", "return", "if", "elif", "else", "for", "while", "in", "and", "or", "not", "import", "from", "True", "False", "None", "break", "continue", "pass", "class", "with", "as", "try", "except"]);
const PY_FN = new Set(["print", "input", "int", "float", "str", "len", "range", "sum", "max", "min", "round", "list"]);

function highlightPseudoLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const commentAt = line.indexOf("//");
  const codePart = commentAt >= 0 ? line.slice(0, commentAt) : line;
  const toks = lex(codePart).tokens.filter((t) => t.t !== "nl" && t.t !== "eof");
  let pos = 1;
  toks.forEach((t, i) => {
    if (t.col > pos) out.push(codePart.slice(pos - 1, t.col - 1));
    const cls = t.t === "kw" ? (["y", "o", "no", "mod"].includes(t.v) ? C.op : ["verdadero", "falso"].includes(t.v) ? C.num : C.kw) : t.t === "str" ? C.str : t.t === "num" ? C.num : t.t === "op" ? C.op : t.norm && RESERVED[t.norm] ? C.kw : C.id;
    out.push(
      <span key={i} className={cls}>
        {codePart.slice(t.col - 1, t.endCol - 1)}
      </span>,
    );
    pos = t.endCol;
  });
  if (pos - 1 < codePart.length) out.push(codePart.slice(pos - 1));
  if (commentAt >= 0) out.push(<span key="c" className={C.com}>{line.slice(commentAt)}</span>);
  return out;
}

function highlightPythonLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|([=+\-*/<>!%:]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [tok] = m;
    const cls = m[1] ? C.com : m[2] ? C.str : m[3] ? C.num : m[4] ? (PY_KW.has(tok) ? C.kw : PY_FN.has(tok) ? C.fn : C.id) : C.op;
    out.push(
      <span key={k++} className={cls}>
        {tok}
      </span>,
    );
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeSnippet({ code, language, className, highlightLine, numbers = true }: { code: string; language: CodeLanguage; className?: string; highlightLine?: number; numbers?: boolean }) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <pre className={cx("overflow-x-auto font-mono text-[0.84rem] leading-[1.75] text-paper md:text-sm", className)}>
      <code>
        {lines.map((l, i) => (
          <span key={i} className={cx("block pr-4", highlightLine === i + 1 && "bg-pink/20 shadow-[inset_3px_0_0_#f15bb5]")}>
            {numbers ? <span className="inline-block w-8 select-none pr-3 text-right text-[#6f6390]" aria-hidden>{i + 1}</span> : null}
            {language === "python" ? highlightPythonLine(l) : highlightPseudoLine(l)}
          </span>
        ))}
      </code>
    </pre>
  );
}
