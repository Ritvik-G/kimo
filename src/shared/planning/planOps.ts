// src/shared/planning/planOps.ts

import type { PlanOp } from "../types/planning";

export function normalizePlanOp(op: unknown): PlanOp {
  const raw = String(op ?? "").toLowerCase().trim();
  if (raw === "seq" || raw === "sequential") return "seq";
  if (raw === "brn" || raw === "branch" || raw === "bran" || raw === "branching")
    return "brn";
  if (raw === "agg" || raw === "aggregate" || raw === "aggregator" || raw === "merge")
    return "agg";
  return "seq";
}
