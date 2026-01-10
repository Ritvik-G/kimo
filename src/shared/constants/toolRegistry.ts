import type { ToolPreset } from "../types";
import raw from "./registries/tool_registry.json";

type ToolRegistryFile = {
  metadata?: Record<string, unknown>;
  tools: ToolPreset[];
};

export const TOOL_REGISTRY: ToolRegistryFile = raw as ToolRegistryFile;
export const TOOL_REGISTRY_TOOLS: ToolPreset[] = Array.isArray(TOOL_REGISTRY.tools)
  ? TOOL_REGISTRY.tools
  : [];
