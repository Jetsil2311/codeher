"use client";
// Runnable code without tests: lesson snippets, projects, Logros viewer, landing teaser,
// the educators' "probar código" panel. All of it is a CodeWorkspace.
import type { CodeLanguage } from "@codeher/core";
import { CodeWorkspace } from "./CodeWorkspace";

export interface PlaygroundProps {
  language: CodeLanguage;
  code: string;
  onCodeChange?: (code: string) => void;
  readOnly?: boolean;
  minHeight?: number;
  compact?: boolean;
  title?: string;
  className?: string;
  allowStep?: boolean;
  allowFullscreen?: boolean;
}

export function Playground({ language, code, onCodeChange, readOnly, minHeight = 200, title, className, allowStep = true, allowFullscreen = true }: PlaygroundProps) {
  return <CodeWorkspace language={language} code={code} onCodeChange={onCodeChange} readOnly={readOnly} minHeight={minHeight} title={title} className={className} allowStep={allowStep} allowFullscreen={allowFullscreen} />;
}
