import type { AgentRegistryEntry } from "../types";
import { CUSTOM_AGENT_STORAGE_KEY } from "../constants";
import { isRecord, normalizeStreams, toStringArray } from "./index";

function normalizeStoredAgent(value: unknown, index: number): AgentRegistryEntry | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === "string" ? value.id.trim() : "";
  const rawName = typeof value.name === "string" ? value.name.trim() : "";
  const id = rawId || `custom-agent-${index + 1}`;
  const name = rawName || id;
  const description = typeof value.description === "string" ? value.description : "";
  const capabilities = toStringArray(value.capabilities);

  return {
    id,
    name,
    description,
    capabilities,
    input_data_streams: normalizeStreams(value.input_data_streams),
    output_data_streams: normalizeStreams(value.output_data_streams),
  };
}

export function readCustomAgents(): AgentRegistryEntry[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(CUSTOM_AGENT_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.agents)
        ? parsed.agents
        : [];
    return list
      .map((entry, index) => normalizeStoredAgent(entry, index))
      .filter((entry): entry is AgentRegistryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

export function writeCustomAgents(agents: AgentRegistryEntry[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_AGENT_STORAGE_KEY, JSON.stringify(agents));
  } catch {
    // Ignore storage failures (e.g., quota or private mode).
  }
}
