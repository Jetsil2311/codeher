# CODEHER Python harness (tech spec 6.4). Runs inside Pyodide (browser worker or Node).
# Receives a JSON RunRequest, returns a JSON RunReport. Messages for students are Spanish.
import ast
import builtins
import io
import json
import math
import sys
import time
import traceback

MAX_OUT = 20000
STUDENT = "<student>"


class OutputTooLarge(Exception):
    pass


class CappedIO(io.TextIOBase):
    def __init__(self, cap=MAX_OUT):
        self.parts = []
        self.size = 0
        self.cap = cap
        self.truncated = False

    def writable(self):
        return True

    def write(self, s):
        s = str(s)
        if self.size + len(s) > self.cap:
            room = max(0, self.cap - self.size)
            self.parts.append(s[:room])
            self.size = self.cap
            self.truncated = True
            raise OutputTooLarge()
        self.parts.append(s)
        self.size += len(s)
        return len(s)

    def getvalue(self):
        return "".join(self.parts)


def _line_of(exc):
    if isinstance(exc, SyntaxError) and exc.filename == STUDENT:
        return exc.lineno
    line = None
    tb = exc.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == STUDENT:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _error_info(exc):
    if isinstance(exc, OutputTooLarge):
        return {"type": "OutputTooLarge", "message": "output too large", "line": None}
    msg = exc.msg if isinstance(exc, SyntaxError) else str(exc)
    info = {"type": type(exc).__name__, "message": msg, "line": _line_of(exc)}
    if isinstance(exc, SyntaxError) and exc.offset:
        info["column"] = exc.offset
    if isinstance(exc, EOFError):
        info["type"] = "EOFError"
    return info


def _plain(value, depth=0):
    if depth > 6:
        return repr(value)
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return repr(value)
        return value
    if isinstance(value, (list, tuple, set, frozenset)):
        items = sorted(value, key=repr) if isinstance(value, (set, frozenset)) else value
        return [_plain(v, depth + 1) for v in items]
    if isinstance(value, dict):
        return {str(k): _plain(v, depth + 1) for k, v in value.items()}
    return repr(value)


def _show(value):
    if isinstance(value, str):
        return repr(value)
    if isinstance(value, bool):
        return "True" if value else "False"
    if value is None:
        return "None"
    if isinstance(value, list):
        return "[" + ", ".join(_show(v) for v in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(f"{_show(k)}: {_show(v)}" for k, v in value.items()) + "}"
    return str(value)


def _same(a, b, approx=False, tol=1e-6):
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b or a == b and type(a) is type(b)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= tol if approx else a == b
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_same(x, y, approx, tol) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_same(a[k], b[k], approx, tol) for k in a)
    return a == b


def _normalize(s, mode):
    if mode == "exact":
        return s
    lines = s.replace("\r\n", "\n").split("\n")
    return "\n".join(l.rstrip() for l in lines).rstrip("\n")


def _matches(actual, expected, mode):
    if mode == "regex":
        import re
        try:
            return re.search(expected, actual) is not None
        except re.error:
            return False
    return _normalize(actual, mode) == _normalize(expected, mode)


def _execute(compiled, stdin_lines):
    out = CappedIO()
    g = {"__name__": "__main__", "__builtins__": builtins}
    pending = list(stdin_lines or [])

    def fake_input(prompt=""):
        if prompt:
            out.write(str(prompt))
        if not pending:
            raise EOFError("EOF when reading a line")
        return pending.pop(0)

    g["input"] = fake_input
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = out
    sys.stderr = out
    err = None
    try:
        exec(compiled, g)
    except SystemExit:
        pass
    except BaseException as exc:  # noqa: BLE001 - every student error is reported
        err = _error_info(exc)
    finally:
        sys.stdout, sys.stderr = old_out, old_err
    return g, out, err


def _constructs(tree):
    return {type(node).__name__ for node in ast.walk(tree)}


def run_request(req_json):
    t0 = time.time()
    req = json.loads(req_json)
    code = req.get("code", "")
    tests = req.get("tests", []) or []
    report = {
        "ok": False,
        "stdout": "",
        "truncated": False,
        "error": None,
        "tests": [],
        "runtimeMs": 0,
        "language": "python",
    }

    def finish():
        report["runtimeMs"] = int((time.time() - t0) * 1000)
        return json.dumps(report, ensure_ascii=False)

    try:
        tree = ast.parse(code, STUDENT)
        compiled = compile(tree, STUDENT, "exec")
    except SyntaxError as exc:
        report["error"] = _error_info(exc)
        report["tests"] = [{"testId": t["id"], "kind": t["kind"], "passed": False, "skipped": True} for t in tests]
        return finish()

    results = []
    first_error = None

    # Playground mode: no tests, just run.
    if not tests:
        _, out, err = _execute(compiled, req.get("stdin") or [])
        report["stdout"] = out.getvalue()
        report["truncated"] = out.truncated
        report["error"] = err
        report["ok"] = err is None
        return finish()

    # construct_rule is static (ast only), so it never needs an execution.
    shared_kinds = {"function_call", "assert_code", "final_variable"}
    shared = None
    shared_err = None
    if any(t["kind"] in shared_kinds for t in tests):
        stdin = req.get("stdin") or []
        for t in tests:
            if t["kind"] == "final_variable" and t["spec"].get("stdin") is not None:
                stdin = t["spec"]["stdin"]
                break
        shared, out, shared_err = _execute(compiled, stdin)
        report["stdout"] = out.getvalue()
        report["truncated"] = out.truncated
        if shared_err:
            first_error = shared_err

    for t in tests:
        kind = t["kind"]
        spec = t.get("spec") or {}
        res = {"testId": t["id"], "kind": kind, "passed": False}
        try:
            if kind == "stdout":
                _, out, err = _execute(compiled, spec.get("stdin") or [])
                actual = out.getvalue()
                if not report["stdout"]:
                    report["stdout"] = actual
                    report["truncated"] = out.truncated
                res["expected"] = spec.get("expected", "")
                res["actual"] = actual
                if err:
                    first_error = first_error or err
                    res["messageEs"] = "Tu programa se detuvo por un error antes de terminar."
                else:
                    res["passed"] = _matches(actual, spec.get("expected", ""), spec.get("match", "trimmed"))
                    if not res["passed"]:
                        res["messageEs"] = "Lo que escribió tu programa no es lo que se esperaba."
            elif kind == "construct_rule":
                used = _constructs(tree)
                must = spec.get("must_contain") or []
                must_not = spec.get("must_not_contain") or []
                res["passed"] = all(c in used for c in must) and not any(c in used for c in must_not)
                if not res["passed"]:
                    res["messageEs"] = spec.get("message_es", "")
            elif shared_err is not None:
                res["skipped"] = True
            elif kind == "function_call":
                name = spec.get("function", "")
                fn = shared.get(name)
                if not callable(fn):
                    res["messageEs"] = f"No encontré la función {name}. Revisa que se llame exactamente así."
                else:
                    args = spec.get("args") or []
                    kwargs = spec.get("kwargs") or {}
                    sink = CappedIO()
                    old = sys.stdout
                    sys.stdout = sink
                    try:
                        value = _plain(fn(*args, **kwargs))
                    finally:
                        sys.stdout = old
                    expected = spec.get("expected")
                    approx = spec.get("compare") == "approx"
                    res["passed"] = _same(value, expected, approx, spec.get("tolerance", 1e-6))
                    res["expected"] = expected
                    res["actual"] = value
                    if not res["passed"]:
                        shown = ", ".join(_show(a) for a in args)
                        res["messageEs"] = f"Con {name}({shown}) esperaba {_show(expected)} pero obtuve {_show(value)}."
            elif kind == "assert_code":
                sink = CappedIO()
                old = sys.stdout
                sys.stdout = sink
                try:
                    exec(compile(spec.get("code", ""), "<test>", "exec"), shared)
                    res["passed"] = True
                except AssertionError:
                    res["messageEs"] = spec.get("message_es", "")
                finally:
                    sys.stdout = old
            elif kind == "final_variable":
                variables = spec.get("variables") or {}
                approx = spec.get("compare") == "approx"
                ok = True
                msg = None
                actual = {}
                for name, expected in variables.items():
                    if name not in shared:
                        ok = False
                        msg = msg or f"No encontré la variable {name}."
                        continue
                    value = _plain(shared[name])
                    actual[name] = value
                    if not _same(value, expected, approx, spec.get("tolerance", 1e-6)):
                        ok = False
                        msg = msg or f"Esperaba que {name} valiera {_show(expected)} pero vale {_show(value)}."
                res["passed"] = ok
                res["expected"] = variables
                res["actual"] = actual
                if not ok:
                    res["messageEs"] = ((spec.get("message_es") or "") + " " + (msg or "")).strip()
        except BaseException as exc:  # noqa: BLE001
            err = _error_info(exc)
            if err.get("line") is None and exc.__traceback__ is not None:
                # Errors raised inside student functions called by the harness.
                err["line"] = _line_of(exc)
            first_error = first_error or err
            res["messageEs"] = "Tu código produjo un error durante esta prueba."
        results.append(res)

    report["tests"] = results
    report["error"] = first_error
    report["ok"] = first_error is None and all(r.get("passed") for r in results)
    return finish()


def check_syntax(code):
    try:
        ast.parse(code, STUDENT)
        return json.dumps(None)
    except SyntaxError as exc:
        return json.dumps(_error_info(exc), ensure_ascii=False)
