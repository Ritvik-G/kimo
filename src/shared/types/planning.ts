import type { WorkspaceSnapshot } from "./index";

// src/types/planning.ts

export type PlanOp = "seq" | "brn" | "agg";

export type PlanSubTask = {
  sub_task_id: string;
  name: string;
  description?: string;
  knowledge_dependencies?: string[];
  required_skills?: string[];
  // Keep both casings for JSON compatibility with demo/task-decomposition payloads.
  // Canonical export format for this app is `Tools`.
  Tools?: string[];
  tools?: string[];
};

export type PlanConnections = Array<{ from: string; to: string; op?: PlanOp }>;

export type PlanningWorkflowSnapshot = Pick<
  WorkspaceSnapshot,
  "blocks" | "tools" | "connections" | "evals" | "notes" | "uploads" | "outputs"
>;

export type PlanningBlock = {
  id: string;
  x: number;
  y: number;
  name: string;
  query: string;
  triples: { from: string; op: PlanOp; to: string }[];
  task_id?: string;
  main_task?: string;
  sub_tasks?: PlanSubTask[];
  sub_plans?: PlanHierarchy;
  workflow?: PlanningWorkflowSnapshot;
};

export type PlanHierarchy = {
  plans: PlanningBlock[];
  connections: PlanConnections;
};

export type PlanTemplate = {
  id: string;
  name: string;
  query: string;
  triples: { from: string; op: PlanOp; to: string }[];
  task_id?: string;
  main_task?: string;
  sub_tasks?: PlanSubTask[];
  sub_plans?: PlanHierarchy;
  workflow?: PlanningWorkflowSnapshot;
};

export type PlanTriple = {
  from: string;
  op: PlanOp;
  label?: string;
  to: string;
};
