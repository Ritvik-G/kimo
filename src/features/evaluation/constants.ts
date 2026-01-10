import type { CategoryStyle, MappingRow } from "./types";

export const DEFAULT_INPUTS = ["User prompt", "Agent output", "Tool response", "Knowledge base snippet"];
export const DEFAULT_OUTPUTS = ["Evaluation dashboard", "Scored response report", "Alert log"];

export const DEFAULT_MAPPINGS: MappingRow[] = [
  {
    id: "map-1",
    input: "User prompt",
    output: "Scored response report",
    metrics: ["relevance", "coherence", "fluency"],
    owner: "Quality Analyst",
    threshold: ">= 0.85",
    cadence: "Per release",
  },
  {
    id: "map-2",
    input: "Agent output",
    output: "Evaluation dashboard",
    metrics: ["accuracy", "hallucination", "cost"],
    owner: "Performance Lead",
    threshold: "P95 latency < 1200ms",
    cadence: "Weekly",
  },
  {
    id: "map-3",
    input: "Tool response",
    output: "Alert log",
    metrics: ["toxicity", "bias"],
    owner: "Safety Reviewer",
    threshold: "Zero critical flags",
    cadence: "Daily",
  },
];

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Performance: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    selected: "bg-emerald-100 border-emerald-200 text-emerald-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-emerald-200",
  },
  Quality: {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700",
    selected: "bg-sky-100 border-sky-200 text-sky-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-sky-200",
  },
  Safety: {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700",
    selected: "bg-rose-100 border-rose-200 text-rose-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-rose-200",
  },
  Efficiency: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700",
    selected: "bg-amber-100 border-amber-200 text-amber-800",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-amber-200",
  },
  Default: {
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600",
    selected: "bg-slate-200 border-slate-300 text-slate-700",
    idle: "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
  },
};
