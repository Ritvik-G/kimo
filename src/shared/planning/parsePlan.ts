// src/shared/planning/parsePlan.ts

import type { PlanningBlock, PlanSubTask, PlanTriple } from "../types/planning";
import { normalizePlanOp } from "./planOps";
import { isRecord, toStringArray } from "../utils";

export function normalizeSubTasks(value: unknown): PlanSubTask[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const subTaskId = String(entry["sub_task_id"] ?? "").trim();
      const name = String(entry["name"] ?? "").trim();
      if (!subTaskId || !name) return null;
      const description = typeof entry["description"] === "string" ? entry["description"].trim() : "";
      const knowledgeDependencies = toStringArray(entry["knowledge_dependencies"]);
      const requiredSkills = toStringArray(entry["required_skills"]);
      const tools = Array.from(
        new Set([
          ...toStringArray(entry["Tools"]),
          ...toStringArray(entry["tools"]),
        ])
      );
      const subTask: PlanSubTask = {
        sub_task_id: subTaskId,
        name,
      };
      if (description) subTask.description = description;
      if (knowledgeDependencies.length) subTask.knowledge_dependencies = knowledgeDependencies;
      if (requiredSkills.length) subTask.required_skills = requiredSkills;
      if (tools.length) subTask.Tools = tools;
      return subTask;
    })
    .filter((entry): entry is PlanSubTask => Boolean(entry));
}

export function parsePlanningJSON(raw: unknown): PlanningBlock {
  if (!isRecord(raw)) {
    throw new Error("Invalid planning JSON");
  }

  const triplesRaw = raw["triples"];
  if (!Array.isArray(triplesRaw)) {
    throw new Error("Planning JSON must contain triples");
  }

  const triples: PlanTriple[] = triplesRaw.map((t, index) => {
    if (!isRecord(t)) {
      throw new Error(`Invalid triple entry at index ${index}`);
    }
    const from = String(t["from"] ?? "").trim();
    const to = String(t["to"] ?? "").trim();
    if (!from || !to) {
      throw new Error(`Invalid triple entry at index ${index}`);
    }
    return {
      from,
      op: normalizePlanOp(t["op"]),
      to,
    };
  });

  const rawTaskId = typeof raw["task_id"] === "string" ? raw["task_id"].trim() : "";
  const rawPlanId = typeof raw["plan_id"] === "string" ? raw["plan_id"].trim() : "";
  const rawId = typeof raw["id"] === "string" ? raw["id"].trim() : "";
  const planId = rawTaskId || rawPlanId || rawId || crypto.randomUUID();

  const rawName = typeof raw["name"] === "string" ? raw["name"].trim() : "";
  const rawMainTask = typeof raw["main_task"] === "string" ? raw["main_task"].trim() : "";
  const rawQuery = typeof raw["query"] === "string" ? raw["query"].trim() : "";
  const rawIntent = typeof raw["intent"] === "string" ? raw["intent"].trim() : "";
  const subTasks = normalizeSubTasks(raw["sub_tasks"]);

  return {
    id: String(planId),
    x: 200,
    y: 200,
    name: rawName || rawMainTask || String(planId),
    query: rawQuery || rawIntent || rawMainTask || "",
    triples,
    task_id: rawTaskId || undefined,
    main_task: rawMainTask || undefined,
    sub_tasks: subTasks.length ? subTasks : undefined,
  };
}
