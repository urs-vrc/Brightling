import { RouteBases, Routes } from "discord-api-types/rest-v10";
import { loadPyodide } from "pyodide";
import type { ModalHandler, ModalHandlerResponse, ModalSubmitContext } from "../modal/types.ts";

export const REPL_MODAL_PREFIX = "repl_modal_";
export const REPL_MODAL_CODE_FIELD_ID = "code";
const DEFERRED_RESPONSE_TYPE = 5;

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<string>;
};

type ReplExecutionResult = {
  text: string;
  image: string | null;
};

type ModalComponent = {
  custom_id?: string;
  value?: string;
};

type ModalRow = {
  type?: number;
  components?: ModalComponent[];
};

type ModalData = {
  components?: ModalRow[];
};

let pyodidePromise: Promise<PyodideLike> | null = null;

export function isReplModal(customId: string): boolean {
  return customId.startsWith(REPL_MODAL_PREFIX);
}

function extractCodeFromReplModal(data: ModalData): string {
  return data.components
    ?.find((row) => row.type === 1)
    ?.components?.find((component) => component.custom_id === REPL_MODAL_CODE_FIELD_ID)?.value ?? "";
}

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({
      fullStdLib: true,
      packages: ["numpy", "matplotlib", "matplotlib-inline", "requests", "pyyaml"],
      stdout: (text: string) => console.log("[py]", text),
      stderr: (text: string) => console.error("[py]", text),
    }) as Promise<PyodideLike>;
  }
  return pyodidePromise;
}

async function runRepl(code: string): Promise<ReplExecutionResult> {
  const trimmedCode = code.trim();
  if (!trimmedCode) return { text: "(no code provided)", image: null };

  try {
    const py = await getPyodide();

    const escapedCode = trimmedCode
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");

    const wrapper = `
import sys
import os
import json
import base64
import warnings
from io import StringIO, BytesIO
import traceback

# Force Matplotlib to use the headless Agg backend
os.environ["MPLBACKEND"] = "Agg"

warnings.filterwarnings(
    action="ignore",
    message=r"FigureCanvasAgg is non-interactive.*cannot be shown"
            r"|Matplotlib is currently using agg.*cannot show the figure",
    category=UserWarning
)

old_stdout = sys.stdout
old_stderr = sys.stderr
stdout_buf = StringIO()
stderr_buf = StringIO()
sys.stdout = stdout_buf
sys.stderr = stderr_buf

result = None
exc = None

try:
    namespace = {}
    exec("""${escapedCode}""", namespace, namespace)
    if "_" in namespace and namespace["_"] is not None:
        result = repr(namespace["_"])
    elif "result" in namespace:
        result = repr(namespace["result"])
except Exception as e:
    exc = traceback.format_exc()
finally:
    sys.stdout = old_stdout
    sys.stderr = old_stderr

output = stdout_buf.getvalue().rstrip()
stderr = stderr_buf.getvalue().rstrip()

if stderr: output += "\\n[stderr]\\n" + stderr
if result is not None: output += "\\n→ " + result
if exc: output += "\\n" + exc
if not output: output = "(no output (*/ω＼*))"

img_b64 = None
if "matplotlib.pyplot" in sys.modules:
    plt = sys.modules["matplotlib.pyplot"]
    if plt.get_fignums():
        buf = BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close('all')

json.dumps({
    "text": output,
    "image": img_b64
})
    `.trim();

    const captured = await py.runPythonAsync(wrapper);
    const parsed = JSON.parse(captured) as ReplExecutionResult;
    const finalOutput = parsed.text.replace(/```/g, "\\`\\`\\`").trim().replace(/\n+$/, "");

    return {
      text: finalOutput || "(no output (*/ω＼*))",
      image: parsed.image,
    };
  } catch (error) {
    const message = String(error).replace(/```/g, "\\`\\`\\`");
    return { text: `Pyodide crashed (┬┬﹏┬┬): ${message}`, image: null };
  }
}

async function sendDiscordResponse(
  applicationId: string,
  token: string,
  content: string,
  imageBase64: string | null,
): Promise<void> {
  const url = `${RouteBases.api}${Routes.webhookMessage(applicationId, token, "@original")}?wait=true`;
  const form = new FormData();

  form.append("payload_json", JSON.stringify({
    content,
    flags: 0,
  }));

  if (imageBase64) {
    const byteCharacters = atob(imageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/png" });
    form.append("files[0]", blob, "plot.png");
  }

  const response = await fetch(url, {
    method: "PATCH",
    body: form,
  });

  if (!response.ok) {
    console.error("Failed to send to Discord:", await response.text());
  }
}

function handleReplModalSubmit(input: ModalSubmitContext): ModalHandlerResponse {
  const codeInput = extractCodeFromReplModal(input.data);

  queueMicrotask(async () => {
    try {
      const { text, image } = await runRepl(codeInput);

      let message = "```prolog\n" + text + "\n```";
      if (message.length > 1990) {
        message = message.slice(0, 1780) + "\n... (truncated)\n```";
      }

      await sendDiscordResponse(input.applicationId, input.token, message, image);
    } catch (error) {
      await sendDiscordResponse(
        input.applicationId,
        input.token,
        `Execution failed: ${String(error).slice(0, 1000)}`,
        null,
      );
    }
  });

  return {
    type: DEFERRED_RESPONSE_TYPE,
    data: { flags: 0 },
  };
}

export const replModalHandler: ModalHandler = {
  name: "repl",
  canHandle: isReplModal,
  handle: handleReplModalSubmit,
};
