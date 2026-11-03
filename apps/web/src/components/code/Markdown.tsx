"use client";
// Sanitized GitHub-flavored Markdown (no raw HTML). A fence tagged `pseudo run` or
// `python run` becomes a runnable snippet in the lesson's engine (tech spec 6.2).
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { CodeLanguage } from "@codeher/core";
import { cx } from "@/components/ui";
import { Playground } from "./Playground";

const schema = {
  ...defaultSchema,
  attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-[\w-]+$/]] },
};

function prepare(src: string) {
  return src.replace(/```(pseudo|python)\s+run\b/g, "```$1-run");
}

export function Markdown({ source, language, className, runnable = true }: { source: string; language: CodeLanguage; className?: string; runnable?: boolean }) {
  return (
    <div className={cx("prose-codeher", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ href, children }) => (
            <a href={href} rel="noopener noreferrer" target={href?.startsWith("http") ? "_blank" : undefined}>
              {children}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className: cls, children }) => {
            const m = /language-([\w-]+)/.exec(cls ?? "");
            const text = String(children ?? "").replace(/\n$/, "");
            if (!m) return <code>{children}</code>;
            const tag = m[1];
            const fenceLang: CodeLanguage | null = tag.startsWith("pseudo") ? "pseudocode_es" : tag.startsWith("python") ? "python" : null;
            if (runnable && tag.endsWith("-run") && fenceLang === language) {
              return (
                <div className="not-prose my-4">
                  <Playground language={fenceLang} code={text} minHeight={Math.min(320, 40 + text.split("\n").length * 25)} compact />
                </div>
              );
            }
            return (
              <pre>
                <code>{text}</code>
              </pre>
            );
          },
        }}
      >
        {prepare(source)}
      </ReactMarkdown>
    </div>
  );
}
