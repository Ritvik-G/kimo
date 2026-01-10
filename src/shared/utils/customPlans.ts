import type {
  PlanConnections,
  PlanHierarchy,
  PlanningBlock,
  PlanningWorkflowSnapshot,
  PlanTemplate,
} from "../types/planning";
import { normalizePlanOp } from "../planning/planOps";
import { normalizeSubTasks } from "../planning/parsePlan";
import { buildDefaultPlanTemplates } from "../planning/defaultPlanTemplates";
import { CUSTOM_PLAN_SEEDED_KEY, CUSTOM_PLAN_STORAGE_KEY } from "../constants";
import { isRecord } from "./index";

function normalizeTriples(value: unknown): PlanTemplate["triples"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const from = String(entry.from ?? "").trim();
      const to = String(entry.to ?? "").trim();
      if (!from || !to) return null;
      return {
        from,
        to,
        op: normalizePlanOp(entry.op),
      };
    })
    .filter((entry): entry is PlanTemplate["triples"][number] => Boolean(entry));
}

function normalizePlanConnections(
  value: unknown,
  planIds?: Set<string>
): PlanConnections {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const from = String(entry.from ?? "").trim();
      const to = String(entry.to ?? "").trim();
      if (!from || !to) return null;
      if (planIds && (!planIds.has(from) || !planIds.has(to))) return null;
      return {
        from,
        to,
        op: normalizePlanOp(entry.op),
      };
    })
    .filter((entry): entry is PlanConnections[number] => Boolean(entry));
}

function normalizeWorkflowSnapshot(value: unknown): PlanningWorkflowSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const blocks = Array.isArray(value.blocks) ? value.blocks : null;
  const connections = Array.isArray(value.connections) ? value.connections : null;
  const tools = Array.isArray(value.tools) ? value.tools : null;
  if (!blocks && !connections && !tools) return undefined;
  return {
    blocks: blocks ?? [],
    tools: tools ?? [],
    connections: connections ?? [],
    evals: Array.isArray(value.evals) ? value.evals : [],
    notes: Array.isArray(value.notes) ? value.notes : [],
    uploads: Array.isArray(value.uploads) ? value.uploads : [],
    outputs: Array.isArray(value.outputs) ? value.outputs : [],
  };
}

function normalizePlanningBlock(value: unknown, index: number): PlanningBlock | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const rawPlanId = typeof value.plan_id === "string" ? value.plan_id.trim() : "";
  const rawTaskId = typeof value.task_id === "string" ? value.task_id.trim() : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const rawMainTask = typeof value.main_task === "string" ? value.main_task.trim() : "";
  const id = rawId || rawPlanId || rawTaskId || `sub-plan-${index + 1}`;
  if (!id) return null;
  const name = rawName || rawMainTask || id;
  const query = typeof value.query === "string" ? value.query : rawMainTask || "";
  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : 200;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : 200;
  const triples = normalizeTriples(value.triples);
  const subTasks = normalizeSubTasks(value.sub_tasks);
  const subPlans = normalizePlanHierarchy(value.sub_plans);
  const workflow = normalizeWorkflowSnapshot(value.workflow);
  const hasNewSchema =
    rawTaskId.length > 0 || rawMainTask.length > 0 || subTasks.length > 0 || Boolean(subPlans);
  const taskId = hasNewSchema ? (rawTaskId || id) : "";
  return {
    id,
    x,
    y,
    name,
    query,
    triples,
    ...(hasNewSchema && taskId ? { task_id: taskId } : {}),
    ...(rawMainTask ? { main_task: rawMainTask } : {}),
    ...(subTasks.length ? { sub_tasks: subTasks } : {}),
    ...(subPlans ? { sub_plans: subPlans } : {}),
    ...(workflow ? { workflow } : {}),
  };
}

function normalizePlanHierarchy(value: unknown): PlanHierarchy | undefined {
  if (!isRecord(value)) return undefined;
  const planList = Array.isArray(value.plans) ? value.plans : [];
  const plans = planList
    .map((entry, index) => normalizePlanningBlock(entry, index))
    .filter((entry): entry is PlanningBlock => Boolean(entry));
  if (!plans.length) return undefined;
  const planIds = new Set(plans.map((plan) => plan.id));
  const connections = normalizePlanConnections(value.connections, planIds);
  return { plans, connections };
}

function normalizeStoredPlan(value: unknown, index: number): PlanTemplate | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const rawPlanId = typeof value.plan_id === "string" ? value.plan_id.trim() : "";
  const rawTaskId = typeof value.task_id === "string" ? value.task_id.trim() : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const rawMainTask = typeof value.main_task === "string" ? value.main_task.trim() : "";
  const id = rawId || rawPlanId || rawTaskId || `custom-plan-${index + 1}`;
  const name = rawName || rawMainTask || id;
  const query = typeof value.query === "string" ? value.query : rawMainTask || "";
  const triples = normalizeTriples(value.triples);
  const subTasks = normalizeSubTasks(value.sub_tasks);
  const subPlans = normalizePlanHierarchy(value.sub_plans);
  const workflow = normalizeWorkflowSnapshot(value.workflow);
  const hasNewSchema =
    rawTaskId.length > 0 || rawMainTask.length > 0 || subTasks.length > 0 || Boolean(subPlans);
  const taskId = hasNewSchema ? (rawTaskId || id) : "";
  return {
    id,
    name,
    query,
    triples,
    ...(hasNewSchema && taskId ? { task_id: taskId } : {}),
    ...(rawMainTask ? { main_task: rawMainTask } : {}),
    ...(subTasks.length ? { sub_tasks: subTasks } : {}),
    ...(subPlans ? { sub_plans: subPlans } : {}),
    ...(workflow ? { workflow } : {}),
  };
}

function mergeDefaultPlans(existing: PlanTemplate[]): {
  merged: PlanTemplate[];
  didAdd: boolean;
} {
  const defaults = buildDefaultPlanTemplates();
  if (defaults.length === 0) return { merged: existing, didAdd: false };
  const seen = new Set(existing.map((plan) => plan.id));
  const merged = [...existing];
  let didAdd = false;
  defaults.forEach((plan) => {
    if (seen.has(plan.id)) return;
    merged.push(plan);
    didAdd = true;
  });
  return { merged, didAdd };
}

export function readCustomPlans(): PlanTemplate[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(CUSTOM_PLAN_STORAGE_KEY);
  const hasSeededDefaults = localStorage.getItem(CUSTOM_PLAN_SEEDED_KEY) === "true";
  if (!raw) {
    if (hasSeededDefaults) return [];
    const { merged } = mergeDefaultPlans([]);
    if (merged.length > 0) {
      try {
        localStorage.setItem(CUSTOM_PLAN_STORAGE_KEY, JSON.stringify(merged));
        localStorage.setItem(CUSTOM_PLAN_SEEDED_KEY, "true");
      } catch {
        // Ignore storage failures (e.g., quota or private mode).
      }
    }
    return merged;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.plans)
        ? parsed.plans
        : [];
    const normalized = list
      .map((entry, index) => normalizeStoredPlan(entry, index))
      .filter((entry): entry is PlanTemplate => Boolean(entry));
    if (hasSeededDefaults) return normalized;
    const { merged, didAdd } = mergeDefaultPlans(normalized);
    try {
      if (didAdd) {
        localStorage.setItem(CUSTOM_PLAN_STORAGE_KEY, JSON.stringify(merged));
      }
      localStorage.setItem(CUSTOM_PLAN_SEEDED_KEY, "true");
    } catch {
      // Ignore storage failures (e.g., quota or private mode).
    }
    return merged;
  } catch {
    return [];
  }
}

export function writeCustomPlans(plans: PlanTemplate[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_PLAN_STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // Ignore storage failures (e.g., quota or private mode).
  }
}
