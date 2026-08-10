/**
 * Runs student Python code in-browser via Pyodide (Python compiled to
 * WebAssembly), inside a dedicated Web Worker.
 *
 * Why a worker: Pyodide executes synchronously on whatever thread it's given.
 * An infinite loop (`while True: pass`) in student code would otherwise
 * freeze the entire tab with no way to recover. Running it in a worker lets
 * us hard-terminate on timeout without touching the main UI thread.
 *
 * The worker + Pyodide runtime are loaded lazily (only when a student opens
 * a Python assignment) and reused across runs within the session.
 */

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const EXECUTION_TIMEOUT_MS = 10_000;

const WORKER_SOURCE = `
  self.pyodideReadyPromise = null;

  async function ensurePyodide() {
    if (self.pyodideReadyPromise) return self.pyodideReadyPromise;
    self.pyodideReadyPromise = (async () => {
      importScripts("${PYODIDE_CDN_BASE}pyodide.js");
      const pyodide = await self.loadPyodide({ indexURL: "${PYODIDE_CDN_BASE}" });
      let buffer = "";
      pyodide.setStdout({ batched: (msg) => { buffer += msg + "\\n"; } });
      pyodide.setStderr({ batched: (msg) => { buffer += msg + "\\n"; } });
      self.__getBuffer = () => buffer;
      self.__resetBuffer = () => { buffer = ""; };
      return pyodide;
    })();
    return self.pyodideReadyPromise;
  }

  self.onmessage = async (e) => {
    const { code } = e.data;
    try {
      const pyodide = await ensurePyodide();
      self.__resetBuffer();
      await pyodide.runPythonAsync(code);
      self.postMessage({ ok: true, output: self.__getBuffer() });
    } catch (err) {
      self.postMessage({ ok: false, output: self.__getBuffer ? self.__getBuffer() : "", error: err && err.message ? err.message : String(err) });
    }
  };
`;

let worker: Worker | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
  worker = new Worker(URL.createObjectURL(blob));
  return worker;
}

/** Terminates and discards the current worker (used after a timeout, forcing a clean restart). */
function killWorker() {
  worker?.terminate();
  worker = null;
}

export interface RunResult {
  output: string;
  error: string | null;
  timedOut: boolean;
}

/** Runs Python code in-browser via a Pyodide Web Worker and captures stdout/stderr. */
export function runPython(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const w = getWorker();
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      killWorker();
      resolve({
        output: "",
        error: `Execution stopped after ${EXECUTION_TIMEOUT_MS / 1000}s — check for an infinite loop.`,
        timedOut: true,
      });
    }, EXECUTION_TIMEOUT_MS);

    w.onmessage = (e: MessageEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      const { ok, output, error } = e.data;
      resolve({ output: (output || "").trim(), error: ok ? null : error || "Unknown error", timedOut: false });
    };

    w.onerror = (e: ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      killWorker();
      resolve({ output: "", error: e.message || "Python runtime failed to load.", timedOut: false });
    };

    w.postMessage({ code });
  });
}
