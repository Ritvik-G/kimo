import type { AgentRegistryEntry, AgentRegistryFile, AgentBlock } from "../types";
import raw from "./registries/agent_registry.json";

export const AGENT_REGISTRY: AgentRegistryFile = raw as AgentRegistryFile;
export const AGENT_REGISTRY_AGENTS: AgentRegistryEntry[] = Array.isArray(AGENT_REGISTRY.agents)
  ? AGENT_REGISTRY.agents
  : [];

export function getAgentRegistryEntryById(
  agentId: string | undefined | null,
  agents: AgentRegistryEntry[] = AGENT_REGISTRY_AGENTS
): AgentRegistryEntry | null {
  if (!agentId) return null;
  return agents.find((a) => a.id === agentId) ?? null;
}

export function findAgentRegistryEntryByIdOrName(
  label: string | undefined | null,
  agents: AgentRegistryEntry[] = AGENT_REGISTRY_AGENTS
): AgentRegistryEntry | null {
  if (!label) return null;
  const exact = agents.find((a) => a.id === label);
  if (exact) return exact;
  const normalized = label.trim().toLowerCase();
  return agents.find((a) => a.name.trim().toLowerCase() === normalized) ?? null;
}

export function getRegistryAgentForBlock(
  block: AgentBlock,
  agents: AgentRegistryEntry[] = AGENT_REGISTRY_AGENTS
): AgentRegistryEntry | null {
  return getAgentRegistryEntryById(block.agentId, agents) ?? findAgentRegistryEntryByIdOrName(block.name, agents);
}

export function listMandatoryOptional(streams: { mandatory: string[]; optional?: string[] } | undefined) {
  return {
    mandatory: Array.isArray(streams?.mandatory) ? streams!.mandatory : [],
    optional: Array.isArray(streams?.optional) ? streams!.optional! : [],
  };
}
