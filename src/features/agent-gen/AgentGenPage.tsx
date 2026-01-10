import { useMemo, useState } from "react";
import type { AgentRegistryEntry, PlanningBlock } from "../../shared/types";
import { AGENT_REGISTRY_AGENTS, PENDING_PLAN_STORAGE_KEY } from "../../shared/constants";
import { readCustomAgents, writeCustomAgents } from "../../shared/utils/customAgents";
import { parsePlanningJSON } from "../../shared/planning/parsePlan";
import {
  buildUniqueId,
  isRecord,
  normalizeStreams,
  slugify,
  toStringArray,
} from "../../shared/utils";

const SAMPLE_JSON = `{
  "agents": [
    {
      "id": "st-001",
      "name": "Market Research",
      "description": "Analyze target audience and competitive landscape",
      "knowledge_dependencies": ["kg-market-data", "kg-competitor-intel"],
      "required_skills": ["market_analysis", "data_interpretation"]
    },
    {
      "id": "st-002",
      "name": "Define Positioning",
      "description": "Create unique value proposition and messaging framework",
      "knowledge_dependencies": ["kg-brand-guidelines", "kg-customer-personas"],
      "required_skills": ["brand_strategy", "copywriting"]
    }
  ],
  "triples": [
    {
      "from": "st-001",
      "op": "seq",
      "to": "st-002"
    }
  ]
}`;

type TripleGraph = {
  inboundById: Map<string, string[]>;
  outboundById: Map<string, string[]>;
};

function isPlanLike(value: unknown): value is Record<string, unknown> & { triples: unknown[] } {
  return isRecord(value) && Array.isArray(value.triples);
}

function extractPlanEntries(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isPlanLike) as Record<string, unknown>[];
  }
  if (isRecord(value) && Array.isArray(value.plans)) {
    return value.plans.filter(isPlanLike) as Record<string, unknown>[];
  }
  if (isRecord(value) && isPlanLike(value.plan)) {
    return [value.plan as Record<string, unknown>];
  }
  if (isPlanLike(value)) return [value];
  return [];
}

function buildTripleGraph(plans: PlanningBlock[]): TripleGraph | null {
  if (!plans.length) return null;
  const inboundById = new Map<string, string[]>();
  const outboundById = new Map<string, string[]>();
  const pushUnique = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };
  const ensureList = (map: Map<string, string[]>, key: string) => {
    const existing = map.get(key);
    if (existing) return existing;
    const next: string[] = [];
    map.set(key, next);
    return next;
  };

  plans.forEach((plan) => {
    plan.triples.forEach((triple) => {
      const from = triple.from.trim();
      const to = triple.to.trim();
      if (!from || !to) return;
      pushUnique(ensureList(outboundById, from), to);
      pushUnique(ensureList(inboundById, to), from);
    });
  });

  return { inboundById, outboundById };
}

function mergeUnique(base: string[], additions: string[]) {
  const seen = new Set(base);
  const merged = [...base];
  additions.forEach((item) => {
    if (!seen.has(item)) {
      merged.push(item);
      seen.add(item);
    }
  });
  return merged;
}

function parsePlanEntry(
  value: Record<string, unknown>,
  index: number
): { plan: PlanningBlock; payload: Record<string, unknown> } | null {
  let parsed: PlanningBlock;
  try {
    const hasId =
      typeof value.task_id === "string" ||
      typeof value.plan_id === "string" ||
      typeof value.id === "string";
    parsed = parsePlanningJSON(
      hasId ? value : { ...value, plan_id: `plan-${index + 1}` }
    );
  } catch {
    return null;
  }

  const rawTaskId = typeof value.task_id === "string" ? value.task_id.trim() : "";
  const rawMainTask = typeof value.main_task === "string" ? value.main_task.trim() : "";
  const rawId =
    rawTaskId ||
    (typeof value.plan_id === "string"
      ? value.plan_id.trim()
      : typeof value.id === "string"
        ? value.id.trim()
        : "");
  const planId = rawId || parsed.id;
  const query =
    typeof value.query === "string"
      ? value.query.trim()
      : typeof value.intent === "string"
        ? value.intent.trim()
        : rawMainTask || parsed.query;
  const subTasks = parsed.sub_tasks?.length ? parsed.sub_tasks : undefined;
  const hasNewSchema =
    rawTaskId.length > 0 ||
    rawMainTask.length > 0 ||
    Array.isArray(value.sub_tasks) ||
    Boolean(subTasks?.length);

  const payload: Record<string, unknown> = {
    ...value,
    query: query ?? "",
    triples: parsed.triples,
  };
  if (rawMainTask) payload.main_task = rawMainTask;
  if (subTasks) payload.sub_tasks = subTasks;
  if (hasNewSchema) {
    payload.task_id = planId;
  } else {
    payload.plan_id = planId;
  }

  return { plan: parsed, payload };
}

function queuePlansForBench(plans: Record<string, unknown>[]) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PENDING_PLAN_STORAGE_KEY, JSON.stringify({ mode: "plan", plans }));
  } catch {
    // Ignore storage failures (e.g., quota or private mode).
  }
}

function normalizeAgent(
  value: unknown,
  index: number,
  usedIds: Set<string>,
  graph?: TripleGraph | null
): AgentRegistryEntry | null {
  if (!isRecord(value)) return null;
  const rawId =
    typeof value.id === "string"
      ? value.id.trim()
      : typeof value.agent_id === "string"
        ? value.agent_id.trim()
        : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const fallbackName = rawId ? rawId.replace(/[-_]+/g, " ") : `Custom Agent ${index + 1}`;
  const name = rawName || fallbackName;
  const baseId = rawId || slugify(rawName) || `custom-agent-${index + 1}`;
  const id = buildUniqueId(baseId, usedIds, "custom-agent");
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const knowledgeDependencies = toStringArray(value.knowledge_dependencies);
  const requiredSkills = toStringArray(value.required_skills);
  const explicitCapabilities = toStringArray(value.capabilities);
  const capabilities = mergeUnique(explicitCapabilities, requiredSkills);
  const graphKey = rawId || rawName;
  const inbound =
    graph?.inboundById.get(graphKey) ??
    (rawId ? graph?.inboundById.get(rawName) : undefined) ??
    [];
  const outbound =
    graph?.outboundById.get(graphKey) ??
    (rawId ? graph?.outboundById.get(rawName) : undefined) ??
    [];
  const inputStreams = normalizeStreams(value.input_data_streams);
  const outputStreams = normalizeStreams(value.output_data_streams);
  const mergedInputMandatory = mergeUnique(inputStreams.mandatory, inbound);
  const mergedInputOptional = mergeUnique(
    inputStreams.optional,
    knowledgeDependencies
  ).filter((item) => !mergedInputMandatory.includes(item));
  const mergedOutputMandatory = mergeUnique(outputStreams.mandatory, outbound);

  return {
    id,
    name,
    description,
    capabilities,
    input_data_streams: {
      mandatory: mergedInputMandatory,
      optional: mergedInputOptional,
    },
    output_data_streams: {
      mandatory: mergedOutputMandatory,
      optional: outputStreams.optional,
    },
  };
}

function extractAgents(value: unknown): unknown[] {
  if (isRecord(value) && Array.isArray(value.agents)) return value.agents;
  if (isRecord(value) && isRecord(value.agent) && !isPlanLike(value.agent)) return [value.agent];
  if (Array.isArray(value)) return value.filter((entry) => !isPlanLike(entry));
  if (isPlanLike(value)) return [];
  if (isRecord(value) && (typeof value.id === "string" || typeof value.name === "string")) return [value];
  return [];
}

function extractAgentsFromPlans(entries: Record<string, unknown>[]) {
  const agents: unknown[] = [];
  entries.forEach((entry) => {
    if (Array.isArray(entry.agents)) {
      agents.push(...entry.agents);
    } else if (isRecord(entry.agent) && !isPlanLike(entry.agent)) {
      agents.push(entry.agent);
    }
  });
  return agents;
}

function extractAgentsFromTriples(entries: Record<string, unknown>[]) {
  const agentsById = new Map<string, Record<string, unknown>>();
  entries.forEach((entry) => {
    if (!Array.isArray(entry.triples)) return;
    entry.triples.forEach((triple) => {
      if (!isRecord(triple)) return;
      const fromId = typeof triple.from === "string" ? triple.from.trim() : "";
      const agentId =
        typeof triple.agent_id === "string"
          ? triple.agent_id.trim()
          : typeof triple.id === "string"
            ? triple.id.trim()
            : typeof triple.sub_task_id === "string"
              ? triple.sub_task_id.trim()
              : fromId;
      if (!agentId) return;

      const name = typeof triple.name === "string" ? triple.name.trim() : "";
      const description = typeof triple.description === "string" ? triple.description.trim() : "";
      const knowledgeDependencies = toStringArray(triple.knowledge_dependencies);
      const requiredSkills = toStringArray(triple.required_skills);

      if (!name && !description && knowledgeDependencies.length === 0 && requiredSkills.length === 0) {
        return;
      }

      const existing = agentsById.get(agentId) ?? { id: agentId };
      if (name && typeof existing.name !== "string") existing.name = name;
      if (description && typeof existing.description !== "string") existing.description = description;
      if (
        knowledgeDependencies.length &&
        (!Array.isArray(existing.knowledge_dependencies) || existing.knowledge_dependencies.length === 0)
      ) {
        existing.knowledge_dependencies = knowledgeDependencies;
      }
      if (
        requiredSkills.length &&
        (!Array.isArray(existing.required_skills) || existing.required_skills.length === 0)
      ) {
        existing.required_skills = requiredSkills;
      }
      agentsById.set(agentId, existing);
    });
  });
  return Array.from(agentsById.values());
}

export default function AgentGenPage() {
  const [jsonInput, setJsonInput] = useState(SAMPLE_JSON);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Generating agents...");
  const [customAgents, setCustomAgents] = useState<AgentRegistryEntry[]>(() => readCustomAgents());
  const [lastAdded, setLastAdded] = useState<AgentRegistryEntry[]>([]);
  const [planQueued, setPlanQueued] = useState<{ count: number; triples: number } | null>(null);

  const usedIds = useMemo(() => {
    return new Set([...AGENT_REGISTRY_AGENTS, ...customAgents].map((agent) => agent.id));
  }, [customAgents]);

  const startLoading = (label: string) => {
    setLoadingLabel(label);
    setIsGenerating(true);
  };

  const stopLoading = () => {
    setIsGenerating(false);
  };

  const handleGenerate = () => {
    startLoading("Generating agents...");
    setTimeout(() => {
      if (!jsonInput.trim()) {
        setParseError("Paste JSON to generate agents.");
        setLastAdded([]);
        setPlanQueued(null);
        stopLoading();
        return;
      }
      try {
        const parsed = JSON.parse(jsonInput) as unknown;
        const planEntries = extractPlanEntries(parsed);
        const parsedPlans: PlanningBlock[] = [];
        const planPayloads: Record<string, unknown>[] = [];
        planEntries.forEach((entry, index) => {
          if (!isRecord(entry)) return;
          const parsedEntry = parsePlanEntry(entry, index);
          if (!parsedEntry) return;
          parsedPlans.push(parsedEntry.plan);
          planPayloads.push(parsedEntry.payload);
        });

        const directEntries = extractAgents(parsed);
        const planAgentEntries = extractAgentsFromPlans(planEntries);
        const tripleAgentEntries = extractAgentsFromTriples(planEntries);
        const entries = directEntries.length
          ? directEntries
          : planAgentEntries.length
            ? planAgentEntries
            : tripleAgentEntries;
        const nextUsed = new Set(usedIds);
        const tripleGraph = buildTripleGraph(parsedPlans);
        const normalized = entries
          .map((entry, index) => normalizeAgent(entry, index, nextUsed, tripleGraph))
          .filter((entry): entry is AgentRegistryEntry => Boolean(entry));
        const addedAgents = normalized;

        if (addedAgents.length === 0 && planPayloads.length === 0) {
          setParseError("No agents or plan triples found. Provide agents or plan JSON with agents and triples.");
          setLastAdded([]);
          setPlanQueued(null);
          stopLoading();
          return;
        }

        if (addedAgents.length > 0) {
          const nextAgents = [...customAgents, ...addedAgents];
          setCustomAgents(nextAgents);
          writeCustomAgents(nextAgents);
          setLastAdded(addedAgents);
        } else {
          setLastAdded([]);
        }

        if (planPayloads.length > 0) {
          queuePlansForBench(planPayloads);
          const totalTriples = parsedPlans.reduce((acc, plan) => acc + plan.triples.length, 0);
          setPlanQueued({ count: planPayloads.length, triples: totalTriples });
        } else {
          setPlanQueued(null);
        }

        setParseError(null);
      } catch (error) {
        setParseError(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
        setLastAdded([]);
        setPlanQueued(null);
      } finally {
        stopLoading();
      }
    }, 0);
  };

  const handleUseSample = () => {
    setJsonInput(SAMPLE_JSON);
    setParseError(null);
    setPlanQueued(null);
  };

  const handleClearInput = () => {
    setJsonInput("");
    setParseError(null);
    setLastAdded([]);
    setPlanQueued(null);
  };

  const handleRemoveAgent = (agentId: string) => {
    const next = customAgents.filter((agent) => agent.id !== agentId);
    setCustomAgents(next);
    writeCustomAgents(next);
    if (lastAdded.some((agent) => agent.id === agentId)) setLastAdded([]);
  };

  const handleClearAgents = () => {
    setCustomAgents([]);
    writeCustomAgents([]);
    setLastAdded([]);
  };

  const agentStats = useMemo(() => {
    const totalInputs = customAgents.reduce((acc, agent) => {
      const input = normalizeStreams(agent.input_data_streams);
      return acc + input.mandatory.length + input.optional.length;
    }, 0);
    const totalOutputs = customAgents.reduce((acc, agent) => {
      const output = normalizeStreams(agent.output_data_streams);
      return acc + output.mandatory.length + output.optional.length;
    }, 0);
    return { totalInputs, totalOutputs };
  }, [customAgents]);

  return (
    <div className="relative h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50 text-slate-900">
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white/90 px-6 py-5 shadow-lg">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
            <div className="text-sm font-semibold text-slate-700">{loadingLabel}</div>
          </div>
        </div>
      )}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Agent generator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              AgentGen palette builder
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Paste JSON to generate agent blocks and store them in the sidebar palette.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/workflow";
              }}
            >
              Workflow builder
            </button>
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/planning";
              }}
            >
              Planning
            </button>
            <button
              className="btn-pill btn-pill-emerald"
              onClick={handleGenerate}
            >
              Generate agents
            </button>
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="panel bg-white/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">JSON intake</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Supports {`{ agents: [...] }`}, an array, a single agent object, or plan JSON with agents + triples.
                </p>
              </div>
              <span className="pill-tag pill-tag-emerald">
                JSON
              </span>
            </div>

            <textarea
              className="mt-4 min-h-[320px] w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-mono text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              spellCheck={false}
            />

            {parseError && <p className="mt-3 text-xs font-semibold text-rose-600">{parseError}</p>}

            {lastAdded.length > 0 && (
              <p className="mt-3 text-xs font-semibold text-emerald-600">
                Added {lastAdded.length} agent{lastAdded.length === 1 ? "" : "s"} to the sidebar palette.
              </p>
            )}

            {planQueued && (
              <p className="mt-3 text-xs font-semibold text-sky-600">
                Queued {planQueued.count} plan{planQueued.count === 1 ? "" : "s"} with {planQueued.triples} triple{planQueued.triples === 1 ? "" : "s"} for workflow.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-sm btn-sm-solid-emerald px-4"
                onClick={handleGenerate}
              >
                Generate agents
              </button>
              <button
                className="btn-sm btn-sm-outline"
                onClick={handleUseSample}
              >
                Use sample
              </button>
              <button
                className="btn-sm btn-sm-outline"
                onClick={handleClearInput}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="panel bg-white/80">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Custom agent palette</h2>
                <p className="mt-1 text-xs text-slate-600">
                  These agents appear in the Blocks sidebar and persist across reloads.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                <span className="badge">Agents: {customAgents.length}</span>
                <span className="badge">Inputs: {agentStats.totalInputs}</span>
                <span className="badge">Outputs: {agentStats.totalOutputs}</span>
              </div>
            </div>

            {customAgents.length === 0 ? (
              <div className="mt-6 empty-state p-6 text-center text-sm text-slate-500">
                No custom agents yet. Generate some from JSON to populate the palette.
              </div>
            ) : (
              <div className="mt-6 space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {customAgents.map((agent, index) => {
                  const input = normalizeStreams(agent.input_data_streams);
                  const output = normalizeStreams(agent.output_data_streams);
                  return (
                    <div
                      key={`${agent.id}-${index}`}
                      className="card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {agent.description || "No description provided."}
                          </p>
                        </div>
                        <button
                          className="text-xs font-semibold text-rose-600 hover:text-rose-500"
                          onClick={() => handleRemoveAgent(agent.id)}
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                        <span className="badge-tight bg-emerald-50 text-emerald-700">
                          {input.mandatory.length + input.optional.length} inputs
                        </span>
                        <span className="badge-tight bg-sky-50 text-sky-700">
                          {output.mandatory.length + output.optional.length} outputs
                        </span>
                        <span className="badge-tight text-slate-700">
                          ID: {agent.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {customAgents.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  className="btn-sm btn-sm-rose"
                  onClick={handleClearAgents}
                >
                  Clear custom agents
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
