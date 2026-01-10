import json
import os
import sys

# This wrapper is intentionally tiny and mirrors the user's test harness
# style (mlx_lm load/generate). It reads JSON on stdin:
#   {"prompt": "..."}
# And prints a JSON object on stdout:
#   {"plan": {...}}

MODEL_PATH = os.environ.get("MODEL_PATH", "./rafted/granite-4.0-h-1b-8bit-toollm")

SYSTEM_INSTRUCTIONS = """You are a planning engine. Produce a plan in strict JSON with this schema:
{
  "task_id": string,
  "main_task": string,
  "sub_tasks": [
    {
      "sub_task_id": string,
      "name": string,
      "description": string (optional),
      "knowledge_dependencies": [string] (optional),
      "required_skills": [string] (optional)
    }
  ],
  "triples": [
    {"from": string, "op": "seq"|"brn"|"agg", "to": string}
  ]
}

Rules:
- Output ONLY valid JSON. No markdown.
- Use 5-10 subtasks.
- Include triples that connect tasks.
- Keep ids short like st-001, st-002, ...
"""


def die(msg: str, code: int = 1):
    sys.stderr.write(msg.strip() + "\n")
    sys.exit(code)


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        die(f"Invalid input JSON: {e}")

    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        die("Missing prompt")

    try:
        from mlx_lm import load, generate  # type: ignore
    except Exception as e:
        die(f"mlx_lm is not available: {e}")

    try:
        model, tokenizer = load(MODEL_PATH)
    except Exception as e:
        die(
            "Failed to load model. Set MODEL_PATH to your local weights folder. "
            f"(MODEL_PATH={MODEL_PATH})\n{e}"
        )

    full_prompt = (
        SYSTEM_INSTRUCTIONS
        + "\n\nUSER TASK:\n"
        + prompt.strip()
        + "\n\nJSON:\n"
    )

    try:
        # Conservative defaults; users can tune in the actual finetuning codebase.
        out = generate(
            model,
            tokenizer,
            prompt=full_prompt,
            max_tokens=int(os.environ.get("MAX_TOKENS", "900")),
            temp=float(os.environ.get("TEMP", "0.2")),
        )
    except Exception as e:
        die(f"Generation failed: {e}")

    # Best-effort extraction of JSON from the model output.
    text = out if isinstance(out, str) else str(out)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        die("Model did not return JSON.")

    candidate = text[start : end + 1]
    try:
        plan = json.loads(candidate)
    except Exception as e:
        die(f"Invalid JSON from model: {e}\n---\n{candidate}\n---")

    sys.stdout.write(json.dumps({"plan": plan}))


if __name__ == "__main__":
    main()
