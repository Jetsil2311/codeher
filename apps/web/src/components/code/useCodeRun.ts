"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CodeLanguage, RawError, VariableSnapshot } from "@codeher/core";
import type { PythonStatus } from "@codeher/grader/python";
import { getPseudoClient, getPythonEngine } from "./engines";

export type RunState = "idle" | "running" | "waiting" | "stepping" | "done" | "error";

export interface RunSnapshot {
  state: RunState;
  output: string;
  error: RawError | null;
  line: number | null;
  variables: VariableSnapshot;
  inputPrompt: string | null;
  runtimeMs: number | null;
}

const initial: RunSnapshot = { state: "idle", output: "", error: null, line: null, variables: {}, inputPrompt: null, runtimeMs: null };

/** Playground runner for both engines: run, interactive Leer, Paso a paso, stop. */
export function useCodeRun(language: CodeLanguage) {
  const [snap, setSnap] = useState<RunSnapshot>(initial);
  const [pyStatus, setPyStatus] = useState<PythonStatus>("idle");
  const [speed, setSpeed] = useState(2); // statements per second while playing
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"run" | "debug">("run");
  const runId = useRef<string>("");
  const started = useRef(0);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (language !== "python") return;
    const off = getPythonEngine().onStatus((s) => setPyStatus(s));
    return () => {
      off();
    };
  }, [language]);

  useEffect(() => {
    if (language !== "pseudocode_es") return;
    const client = getPseudoClient();
    const off = client.on((m) => {
      if (m.type !== "event" || m.id !== runId.current) return;
      const ev = m.event;
      if (ev.type === "compileError") {
        setPlaying(false);
        setSnap((s) => ({ ...s, state: "error", error: ev.error, line: ev.error.line }));
        return;
      }
      if (ev.type === "paused") setSnap((s) => ({ ...s, output: ev.output }));
      else if (ev.type === "needInput") setSnap((s) => ({ ...s, state: "waiting", output: ev.output, inputPrompt: ev.name, line: ev.line, variables: ev.variables }));
      else if (ev.type === "step") setSnap((s) => ({ ...s, state: "stepping", output: ev.output, line: ev.line, variables: ev.variables, inputPrompt: null }));
      else if (ev.type === "done") {
        setPlaying(false);
        setSnap((s) => ({ ...s, state: "done", output: ev.output, variables: ev.variables, line: null, inputPrompt: null, runtimeMs: Date.now() - started.current }));
      } else if (ev.type === "error") {
        setPlaying(false);
        setSnap((s) => ({ ...s, state: "error", output: ev.output, variables: ev.variables, error: ev.error, line: ev.error.line, inputPrompt: null }));
      }
    });
    return () => {
      off();
    };
  }, [language]);

  const stopPlay = () => {
    if (playTimer.current) clearInterval(playTimer.current);
    playTimer.current = null;
    setPlaying(false);
  };
  useEffect(() => stopPlay, []);

  const run = useCallback(
    async (code: string, stdin: string[] = []) => {
      stopPlay();
      setMode("run");
      started.current = Date.now();
      if (language === "pseudocode_es") {
        const client = getPseudoClient();
        runId.current = client.nextId("run");
        setSnap({ ...initial, state: "running" });
        client.post({ type: "run", id: runId.current, code, interactive: true, stdin, timeoutMs: 8000 });
        return;
      }
      setSnap({ ...initial, state: "running" });
      const report = await getPythonEngine().run({ code, tests: [], stdin, timeoutMs: 8000 });
      setSnap({ ...initial, state: report.error ? "error" : "done", output: report.stdout, error: report.error, line: report.error?.line ?? null, runtimeMs: report.runtimeMs });
    },
    [language],
  );

  const debug = useCallback((code: string, stdin: string[] = []) => {
    stopPlay();
    setMode("debug");
    const client = getPseudoClient();
    runId.current = client.nextId("dbg");
    started.current = Date.now();
    setSnap({ ...initial, state: "stepping" });
    client.post({ type: "debug", id: runId.current, code, stdin });
  }, []);

  const step = useCallback(() => getPseudoClient().post({ type: "step", id: runId.current }), []);

  const play = useCallback(() => {
    stopPlay();
    setPlaying(true);
    playTimer.current = setInterval(() => getPseudoClient().post({ type: "step", id: runId.current }), Math.round(1000 / speed));
  }, [speed]);

  useEffect(() => {
    if (playing) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  const pause = useCallback(() => stopPlay(), []);

  const provideInput = useCallback((value: string) => {
    setSnap((s) => ({ ...s, inputPrompt: null, state: s.state === "waiting" ? "running" : s.state }));
    getPseudoClient().post({ type: "input", id: runId.current, value });
  }, []);

  const stop = useCallback(() => {
    stopPlay();
    if (language === "pseudocode_es") getPseudoClient().restart();
    runId.current = "";
    setSnap((s) => ({ ...s, state: "idle", inputPrompt: null, line: null }));
  }, [language]);

  const reset = useCallback(() => {
    stopPlay();
    runId.current = "";
    setSnap(initial);
  }, []);

  useEffect(() => {
    if (snap.state !== "stepping" && snap.state !== "waiting") stopPlay();
  }, [snap.state]);

  return { snap, mode, run, debug, step, play, pause, playing, speed, setSpeed, provideInput, stop, reset, pyStatus };
}
