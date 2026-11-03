// Shared engine and domain types. Used by the web app, the grader and the MCP server.

export type CodeLanguage = "python" | "pseudocode_es";

export type TestKind =
  | "stdout"
  | "function_call"
  | "assert_code"
  | "construct_rule"
  | "final_variable";

export interface StdoutSpec {
  stdin?: string[];
  expected: string;
  match?: "exact" | "trimmed" | "regex";
}
export interface FunctionCallSpec {
  function: string;
  args: unknown[];
  kwargs?: Record<string, unknown>;
  expected: unknown;
  compare?: "equal" | "approx";
  tolerance?: number;
}
export interface AssertCodeSpec {
  code: string;
  message_es: string;
}
export interface ConstructRuleSpec {
  must_contain?: string[];
  must_not_contain?: string[];
  message_es: string;
}
export interface FinalVariableSpec {
  variables: Record<string, unknown>;
  compare?: "equal" | "approx";
  tolerance?: number;
  message_es?: string;
  stdin?: string[];
}

export type TestSpec =
  | StdoutSpec
  | FunctionCallSpec
  | AssertCodeSpec
  | ConstructRuleSpec
  | FinalVariableSpec;

export interface Test {
  id: string;
  kind: TestKind;
  description: string;
  spec: TestSpec;
  hidden?: boolean;
}

export interface RunRequest {
  id: string;
  code: string;
  tests: Test[];
  stdin?: string[];
  timeoutMs: number;
  seed?: number;
}

export interface RawError {
  type: string;
  message: string;
  line: number | null;
  column?: number | null;
  params?: Record<string, string | number>;
}

export interface TestResult {
  testId: string;
  kind: TestKind;
  passed: boolean;
  skipped?: boolean;
  messageEs?: string;
  expected?: unknown;
  actual?: unknown;
}

export interface RunReport {
  ok: boolean;
  stdout: string;
  truncated: boolean;
  error: RawError | null;
  tests: TestResult[];
  runtimeMs: number;
  language: CodeLanguage;
}

export interface Diagnostic {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export type VariableSnapshot = Record<
  string,
  { type: string; value: unknown; truncated?: boolean }
>;

export interface StepEvent {
  line: number;
  kind: "step" | "input" | "output" | "done" | "error";
  variables: VariableSnapshot;
  output: string;
  error?: RawError | null;
  traceTruncated?: boolean;
}

export interface FriendlyError {
  title: string;
  explanation: string;
  suggestion: string;
  original: string;
  line: number | null;
}

export interface ErrorTranslationRow {
  id?: string;
  language: CodeLanguage | null;
  error_type: string;
  pattern: string | null;
  message_es: string;
  explanation_es: string;
  suggestion_es: string;
  priority: number;
  enabled: boolean;
}
