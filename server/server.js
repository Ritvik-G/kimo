import http from "node:http";

const PORT = Number(process.env.PORT || 3333);
const EXECUTION_MODE = (process.env.EXECUTION_MODE || "demo").toLowerCase();

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

async function runFinalPipeline(prompt) {
  // Delegates to a tiny Python wrapper that uses the user's MLX test harness.
  // If weights aren't present, the python script will return a useful error.
  const { spawn } = await import("node:child_process");

  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PYTHON_BIN || "python3",
      ["server/python/plan_from_mlx.py"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          // Provide a default MODEL_PATH, but allow override.
          MODEL_PATH: process.env.MODEL_PATH || "./rafted/granite-4.0-h-1b-8bit-toollm",
        },
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (buf) => {
      stdout += buf.toString("utf8");
    });

    child.stderr.on("data", (buf) => {
      stderr += buf.toString("utf8");
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Invalid python output. ${stderr}`));
      }
    });

    child.stdin.write(JSON.stringify({ prompt }));
    child.stdin.end();
  });
}

const server = http.createServer(async (req, res) => {
  try {
    // Minimal CORS for local dev.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/api/generate-plan") {
      const body = await readJson(req);
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      const fallback = body.fallback_plan;

      if (!prompt.trim()) {
        sendText(res, 400, "Missing prompt");
        return;
      }

      if (EXECUTION_MODE !== "final") {
        // Demo mode: return exactly what the current frontend already generates.
        if (!fallback || typeof fallback !== "object") {
          sendText(res, 400, "Missing fallback_plan");
          return;
        }
        sendJson(res, 200, { plan: fallback });
        return;
      }

      const result = await runFinalPipeline(prompt);
      if (!result || typeof result !== "object" || !result.plan) {
        sendText(res, 500, "Final pipeline returned an invalid response");
        return;
      }
      sendJson(res, 200, result);
      return;
    }

    sendText(res, 404, "Not found");
  } catch (err) {
    sendText(res, 500, err instanceof Error ? err.message : "Internal error");
  }
});

server.listen(PORT, () => {
  // Intentionally minimal logs.
  console.log(`[server] listening on http://localhost:${PORT} (mode=${EXECUTION_MODE})`);
});
