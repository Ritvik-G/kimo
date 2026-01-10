export * from "./workflow";
export * from "./planning";

// Agent registry helpers (kept for compatibility with upstream data files)
export type AgentRegistryStreams = {
  mandatory: string[];
  optional?: string[];
};

export type AgentRegistryEntry = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  input_data_streams: AgentRegistryStreams;
  output_data_streams: AgentRegistryStreams;
};

export type AgentRegistryFile = {
  metadata?: Record<string, unknown>;
  global_protocols?: string[];
  agents: AgentRegistryEntry[];
};
