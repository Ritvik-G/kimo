// =============================================================================
// Utility Functions for C3AN Workflow Builder
// =============================================================================

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// -----------------------------------------------------------------------------
// Math Utilities
// -----------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// -----------------------------------------------------------------------------
// Array Utilities
// -----------------------------------------------------------------------------

export function resizeRequired(existing: boolean[] | undefined, desired: number) {
  return Array.from({ length: desired }, (_, i) => Boolean(existing?.[i]));
}

export function clampNames(existing: string[] | undefined, desired: number) {
  return Array.from({ length: desired }, (_, i) => existing?.[i] ?? "");
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeStreams(value: unknown) {
  if (Array.isArray(value)) {
    return { mandatory: toStringArray(value), optional: [] };
  }
  if (isRecord(value)) {
    return {
      mandatory: toStringArray(value.mandatory),
      optional: toStringArray(value.optional),
    };
  }
  return { mandatory: [], optional: [] };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildUniqueId(base: string, used: Set<string>, fallback = "custom"): string {
  const root = base.trim() || fallback;
  let candidate = root;
  let counter = 1;
  while (used.has(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

// -----------------------------------------------------------------------------
// File Download Utility
// -----------------------------------------------------------------------------

export function downloadWorkflow(
  snapshot: unknown,
  filename = "workflow.json"
): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// Connection Path Builder
// -----------------------------------------------------------------------------

export function buildConnectionPath(
  start: { x: number; y: number },
  end: { x: number; y: number }
): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const offsetX = Math.max(Math.abs(dx) * 0.45, 40);
  const offsetY = Math.sign(dy) * Math.min(Math.abs(dy) * 0.25, 160);
  const c1x = start.x + offsetX;
  const c1y = start.y + offsetY;
  const c2x = end.x - offsetX;
  const c2y = end.y - offsetY;
  return `M ${start.x} ${start.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${end.x} ${end.y}`;
}
