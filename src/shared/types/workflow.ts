export type Note = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type AgentBlock = {
  id: string;
  x: number;
  y: number;
  name: string;
  description: string;
  agentId?: string;
  sourceAgentId?: string;
  inputCount: number;
  outputCount: number;
  inputRequired: boolean[];
  outputRequired: boolean[];
  inputNames?: string[];
  outputNames?: string[];
  presetId?: string;
  mandatoryInputCount?: number;
  mandatoryOutputCount?: number;
};

export type ToolNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  tagline: string;
  gradient: string;
  ring: string;
  accent: string;
  inputCount: number;
  outputCount: number;
  inputRequired: boolean[];
  outputRequired: boolean[];
  inputNames?: string[];
  outputNames?: string[];
  mandatoryInputCount?: number;
  mandatoryOutputCount?: number;
};

export type ToolPreset = Omit<ToolNode, "id" | "x" | "y">;

export type UploadNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  status: "idle" | "ready";
  fileName?: string;
  fileSize?: number;
  fileType?: string;
};

export type OutputNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  format: string;
};

export type ClipboardItem =
  | { type: "block"; data: AgentBlock }
  | { type: "tool"; data: ToolNode }
  | { type: "upload"; data: UploadNode }
  | { type: "output"; data: OutputNode }
  | { type: "note"; data: Note };

export type Connection = {
  id: string;
  from:
    | { type: "block"; id: string; port: number }
    | { type: "tool"; id: string; port: number }
    | { type: "upload"; id: string; port: number };
  to: { type: "block" | "tool" | "output"; id: string; inputIndex?: number };
};

export type LinkSource = Connection["from"];
export type LinkTarget = Connection["to"];
export type AnchorPoint = { x: number; y: number; dir?: "left" | "right" | "up" | "down" };

export type BlockHandles = {
  width: number;
  height: number;
  inputAnchors: AnchorPoint[];
  outputAnchors: AnchorPoint[];
  toolAnchors: { anchor: AnchorPoint; slot: number }[];
};

export type ToolHandles = {
  width: number;
  height: number;
  output: AnchorPoint;
  input: AnchorPoint;
};

export type Selection =
  | { type: "note"; id: string }
  | { type: "block"; id: string }
  | { type: "tool"; id: string }
  | { type: "upload"; id: string }
  | { type: "output"; id: string }
  | { type: "connection"; id: string }
  | null;

export type PanelKey = "blocks" | "tools" | "settings";

export type EvalOption = {
  id: string;
  name: string;
  description: string;
  category: string;
};

export type LinkingState =
  | {
      origin: "output";
      from: LinkSource;
      current: { x: number; y: number };
    }
  | {
      origin: "input";
      target: LinkTarget;
      current: { x: number; y: number };
    }
  | null;

export type ThemeMode = "light" | "dark";
export type Theme = ThemeMode;
export type ViewMode = "agent" | "plan";

export type WorkspaceSnapshot = {
  notes: Note[];
  blocks: AgentBlock[];
  tools: ToolNode[];
  uploads: UploadNode[];
  outputs: OutputNode[];
  connections: Connection[];
  evals?: string[];
  theme?: ThemeMode;
  nextBlockId?: number;
  nextToolId?: number;
  nextUploadId?: number;
  nextOutputId?: number;
  nextConnectionId?: number;
};
