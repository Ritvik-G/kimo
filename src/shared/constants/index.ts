// =============================================================================
// Constants and Presets for C3AN Workflow Builder
// =============================================================================

import type { EvalOption, ToolPreset } from "../types";
import { TOOL_REGISTRY_TOOLS } from "./toolRegistry";

export * from "./agentRegistry";
export * from "./toolRegistry";

// -----------------------------------------------------------------------------
// Node Configuration Constants
// -----------------------------------------------------------------------------

export const MIN_IO = 1;
export const MAX_IO = 5;
export const TOOL_PORT_OFFSET = 1000;

// -----------------------------------------------------------------------------
// Tool Palette Presets
// -----------------------------------------------------------------------------
export const TOOL_PALETTE: ToolPreset[] = TOOL_REGISTRY_TOOLS;

// -----------------------------------------------------------------------------
// Evaluation Options
// -----------------------------------------------------------------------------

export const EVAL_OPTIONS: EvalOption[] = [
  {
    id: "accuracy",
    name: "Accuracy",
    description: "Measure prediction correctness",
    category: "Performance",
  },
  {
    id: "latency",
    name: "Latency",
    description: "Response time metrics",
    category: "Performance",
  },
  {
    id: "throughput",
    name: "Throughput",
    description: "Requests per second",
    category: "Performance",
  },
  {
    id: "coherence",
    name: "Coherence",
    description: "Logical consistency of outputs",
    category: "Quality",
  },
  {
    id: "relevance",
    name: "Relevance",
    description: "Output relevance to input",
    category: "Quality",
  },
  {
    id: "fluency",
    name: "Fluency",
    description: "Natural language quality",
    category: "Quality",
  },
  {
    id: "toxicity",
    name: "Toxicity",
    description: "Harmful content detection",
    category: "Safety",
  },
  {
    id: "bias",
    name: "Bias",
    description: "Fairness and bias detection",
    category: "Safety",
  },
  {
    id: "hallucination",
    name: "Hallucination",
    description: "Factual accuracy check",
    category: "Safety",
  },
  {
    id: "cost",
    name: "Cost",
    description: "Token usage and cost tracking",
    category: "Efficiency",
  },
  {
    id: "reliability",
    name: "Reliability",
    description: "Success rate and uptime",
    category: "Efficiency",
  },
];

// -----------------------------------------------------------------------------
// Panel Configuration
// -----------------------------------------------------------------------------

export const PANEL_TITLES: Record<string, string> = {
  blocks: "Blocks",
  tools: "Tools",
  settings: "Settings",
};

export const PANEL_TABS: { id: string; label: string; symbol: string }[] = [
  { id: "blocks", label: "Blocks", symbol: "Blocks" },
  { id: "tools", label: "Tools", symbol: "Tools" },
  { id: "settings", label: "Settings", symbol: ":" },
];

// -----------------------------------------------------------------------------
// Accepted File Types for Upload
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Local Storage Keys
// -----------------------------------------------------------------------------

export const STORAGE_KEY = "c3an-workspace";
export const CUSTOM_AGENT_STORAGE_KEY = "c3an-custom-agents";
export const CUSTOM_PLAN_STORAGE_KEY = "c3an-custom-plans";
export const CUSTOM_PLAN_SEEDED_KEY = "c3an-custom-plans-seeded";
export const PENDING_PLAN_STORAGE_KEY = "c3an-pending-plan";
export const PLAN_WORKSPACE_STORAGE_KEY = "c3an-plan-workspace";
export const PLANNING_JSON_STORAGE_KEY = "c3an-planning-json";
