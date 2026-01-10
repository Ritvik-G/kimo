import {
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Background from "./components/background";
import { usePanZoom } from "./hooks/zoom";
import "./App.css";

type Note = {
  id: string;
  x: number;
  y: number;
  text: string;
};

type AgentBlock = {
  id: string;
  x: number;
  y: number;
  name: string;
  description: string;
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

type ToolNode = {
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

type ToolPreset = Omit<ToolNode, "id" | "x" | "y">;

type UploadNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  status: "idle" | "ready";
  fileName?: string;
  fileSize?: number;
  fileType?: string;
};

type OutputNode = {
  id: string;
  x: number;
  y: number;
  name: string;
  format: string;
};

type ClipboardItem =
  | { type: "block"; data: AgentBlock }
  | { type: "tool"; data: ToolNode }
  | { type: "upload"; data: UploadNode }
  | { type: "output"; data: OutputNode }
  | { type: "note"; data: Note };

type Connection = {
  id: string;
  from:
    | { type: "block"; id: string; port: number }
    | { type: "tool"; id: string; port: number }
    | { type: "upload"; id: string; port: number };
  to: { type: "block" | "tool" | "output"; id: string; inputIndex?: number };
};

type LinkSource = Connection["from"];
type LinkTarget = Connection["to"];
type AnchorPoint = { x: number; y: number; dir?: "left" | "right" | "up" | "down" };

type Selection =
  | { type: "note"; id: string }
  | { type: "block"; id: string }
  | { type: "tool"; id: string }
  | { type: "upload"; id: string }
  | { type: "output"; id: string }
  | { type: "connection"; id: string }
  | null;

type PanelKey = "blocks" | "tools" | "settings";

// Kevin

const WORKFLOW_VERSION = 1;
function downloadWorkflow(snapshot: any, filename = 'c3an-workflow.json') {
const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = filename;
document.body.appendChild(a); a.click();
document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function App() {
  const linkingRef = useRef(false);
  // Kevin 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { containerRef, containerEl, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      if (linkingRef.current) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest("[data-note],[data-block],[data-tool],[data-upload],[data-output]");
    },
    isPanDisabled: () => linkingRef.current,
  });
  const [activePanel, setActivePanel] = useState<PanelKey | null>("blocks");
  const [notes, setNotes] = useState<Note[]>([]);
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [tools, setTools] = useState<ToolNode[]>([]);
  const [uploads, setUploads] = useState<UploadNode[]>([]);
  const [outputs, setOutputs] = useState<OutputNode[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userThemeLocked, setUserThemeLocked] = useState(false);
  const [backgroundPreset, setBackgroundPreset] = useState<"grid" | "aurora" | "blueprint">("grid");
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [showStart, setShowStart] = useState(true);
  const [startExiting, setStartExiting] = useState(false);
  const startTimeoutRef = useRef<number | null>(null);
  const agentPresets = useMemo(
    () => [
      { id: "solo", name: "Solo", description: "Single in / out", inputCount: 1, outputCount: 1 },
      { id: "fanout", name: "Fan-out", description: "Broadcast to three", inputCount: 1, outputCount: 3 },
      { id: "collector", name: "Collector", description: "Merge two inputs", inputCount: 2, outputCount: 1 },
      { id: "triage", name: "Triage", description: "Route with fallback", inputCount: 1, outputCount: 4 },
      { id: "analysis", name: "Analysis", description: "Ingest two, emit two", inputCount: 2, outputCount: 2 },
      { id: "expander", name: "Expander", description: "Multi-branch", inputCount: 1, outputCount: 5 },
    ],
    [],
  );
  const evalOptions = useMemo(
    () => [
      { id: "accuracy", name: "Accuracy", description: "Measure prediction correctness", category: "Performance" },
      { id: "latency", name: "Latency", description: "Response time metrics", category: "Performance" },
      { id: "throughput", name: "Throughput", description: "Requests per second", category: "Performance" },
      { id: "coherence", name: "Coherence", description: "Logical consistency of outputs", category: "Quality" },
      { id: "relevance", name: "Relevance", description: "Output relevance to input", category: "Quality" },
      { id: "fluency", name: "Fluency", description: "Natural language quality", category: "Quality" },
      { id: "toxicity", name: "Toxicity", description: "Harmful content detection", category: "Safety" },
      { id: "bias", name: "Bias", description: "Fairness and bias detection", category: "Safety" },
      { id: "hallucination", name: "Hallucination", description: "Factual accuracy check", category: "Safety" },
      { id: "cost", name: "Cost", description: "Token usage and cost tracking", category: "Efficiency" },
      { id: "reliability", name: "Reliability", description: "Success rate and uptime", category: "Efficiency" },
    ],
    [],
  );
  const [agentJsonInput, setAgentJsonInput] = useState<string>("input json here");
  const [agentParseError, setAgentParseError] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [linking, setLinking] = useState<{
    origin: "output";
    from: LinkSource;
    current: { x: number; y: number };
  } | {
    origin: "input";
    target: LinkTarget;
    current: { x: number; y: number };
  } | null>(null);
  useEffect(() => {
    linkingRef.current = Boolean(linking);
  }, [linking]);
  const [hoveredInput, setHoveredInput] = useState<{
    type: "block" | "tool" | "output";
    id: string;
    inputIndex?: number;
  } | null>(null);
  const [hoveredOutput, setHoveredOutput] = useState<LinkSource | null>(null);
  const nextIdRef = useRef(1);
  const nextBlockIdRef = useRef(1);
  const nextToolIdRef = useRef(1);
  const nextUploadIdRef = useRef(1);
  const nextOutputIdRef = useRef(1);
  const nextConnectionIdRef = useRef(1);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const toolDragOffsetRef = useRef({ x: 0, y: 0 });
  const outputDragOffsetRef = useRef({ x: 0, y: 0 });
  const uploadDragOffsetRef = useRef({ x: 0, y: 0 });
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [draggingUploadId, setDraggingUploadId] = useState<string | null>(null);
  const [draggingOutputId, setDraggingOutputId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [modalBlockId, setModalBlockId] = useState<string | null>(null);
  const [modalToolId, setModalToolId] = useState<string | null>(null);
  const [modalToolChoice, setModalToolChoice] = useState<string>("");
  const [showEvalsModal, setShowEvalsModal] = useState(false);
  const [selectedEvals, setSelectedEvals] = useState<string[]>([]);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);
  const [hoveredUploadId, setHoveredUploadId] = useState<string | null>(null);
  const [hoveredOutputId, setHoveredOutputId] = useState<string | null>(null);

  const panelTitles: Record<PanelKey, string> = {
    blocks: "Blocks",
    tools: "Tools",
    settings: "Settings",
  };
  const panelTabs: { id: PanelKey; label: string; symbol: string }[] = [
    { id: "blocks", label: "Blocks", symbol: "[]" },
    { id: "tools", label: "Tools", symbol: "TL" },
    { id: "settings", label: "Settings", symbol: ":" },
  ];
  const handleCircle = useCallback(
    () => ({
      width: 12,
      height: 12,
      borderRadius: "9999px",
      backgroundColor: "rgba(250, 204, 21, 0.9)",
      boxShadow: "0 0 0 1px rgba(234, 179, 8, 0.5), 0 3px 8px rgba(234, 179, 8, 0.22)",
    }),
    [],
  );
  const handleHalo = useCallback(
    () => ({
      width: 18,
      height: 18,
      borderRadius: "9999px",
      backgroundColor: "rgba(250, 204, 21, 0.12)",
      boxShadow: "0 0 0 1.5px rgba(234, 179, 8, 0.6)",
    }),
    [],
  );
  const HandleDot = useCallback(
    () => (
      <div className="relative flex items-center justify-center w-full h-full">
        <div className="absolute" style={handleHalo()} />
        <div style={handleCircle()} />
      </div>
    ),
    [handleCircle, handleHalo],
  );
  const toolPalette = useMemo<ToolPreset[]>(
    () => [
      { name: "Lumen Trace", tagline: "Quick spotlight", gradient: "from-sky-50 via-white to-indigo-100", ring: "ring-sky-200", accent: "bg-sky-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
      { name: "Drift Beacon", tagline: "Signal check", gradient: "from-emerald-50 via-white to-teal-100", ring: "ring-emerald-200", accent: "bg-emerald-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
      { name: "Quartz Forge", tagline: "Shape drafts", gradient: "from-amber-50 via-white to-orange-100", ring: "ring-amber-200", accent: "bg-amber-600", inputCount: 1, outputCount: 2, inputRequired: [false], outputRequired: [false, false] },
      { name: "Echo Loom", tagline: "Thread replies", gradient: "from-slate-50 via-white to-cyan-100", ring: "ring-cyan-200", accent: "bg-cyan-600", inputCount: 2, outputCount: 1, inputRequired: [true, false], outputRequired: [false] },
      { name: "Prism Warden", tagline: "Guard rails", gradient: "from-fuchsia-50 via-white to-purple-100", ring: "ring-fuchsia-200", accent: "bg-fuchsia-600", inputCount: 1, outputCount: 2, inputRequired: [true], outputRequired: [true, false] },
      { name: "Static Tuner", tagline: "Noise filter", gradient: "from-gray-50 via-white to-slate-100", ring: "ring-slate-200", accent: "bg-slate-700", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
      { name: "Nova Draft", tagline: "Fresh canvas", gradient: "from-rose-50 via-white to-amber-100", ring: "ring-rose-200", accent: "bg-rose-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
      { name: "Polar Kite", tagline: "Flow navigator", gradient: "from-blue-50 via-white to-sky-100", ring: "ring-blue-200", accent: "bg-blue-600", inputCount: 2, outputCount: 2, inputRequired: [true, false], outputRequired: [false, false] },
      { name: "Ember Chisel", tagline: "Quick trim", gradient: "from-orange-50 via-white to-amber-100", ring: "ring-orange-200", accent: "bg-orange-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
      { name: "Cipher Lens", tagline: "Inspect payloads", gradient: "from-violet-50 via-white to-indigo-100", ring: "ring-violet-200", accent: "bg-indigo-600", inputCount: 1, outputCount: 3, inputRequired: [true], outputRequired: [true, false, false] },
      { name: "Vapor Prism", tagline: "Soft preview", gradient: "from-lime-50 via-white to-emerald-100", ring: "ring-lime-200", accent: "bg-lime-600", inputCount: 1, outputCount: 1, inputRequired: [false], outputRequired: [false] },
    ],
    [],
  );
  const formatBytes = useCallback((size?: number) => {
    if (size === undefined || size === null) return "";
    if (size < 1024) return `${size} B`;
    const units = ["KB", "MB", "GB"];
    let value = size / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return `${formatted} ${units[unitIndex]}`;
  }, []);

  const toWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerEl;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      return {
        x: (localX - transform.x) / transform.zoom,
        y: (localY - transform.y) / transform.zoom,
      };
    },
    [containerEl, transform.x, transform.y, transform.zoom],
  );

  const handleBlockDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "agent-block" }),
    );
    event.dataTransfer.setData("text/plain", "agent-block");
  }, []);

  const handleToolDragStart =
    useCallback(
      (toolName: string) => (event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify({ type: "tool", name: toolName }),
        );
        event.dataTransfer.setData("text/plain", `tool-${toolName}`);
      },
      [],
    );
  const handleUploadDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "upload-block" }),
    );
    event.dataTransfer.setData("text/plain", "upload-block");
  }, []);
  const handleOutputDragStart = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "output-block" }),
    );
    event.dataTransfer.setData("text/plain", "output-block");
  }, []);

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const el = containerEl;
      if (!el) return;

      const payloadRaw =
        event.dataTransfer.getData("application/json") ||
        event.dataTransfer.getData("text/plain");

      let payloadType: string | null = null;
      let payloadToolName: string | null = null;
      try {
        const parsed = payloadRaw ? JSON.parse(payloadRaw) : null;
        payloadType = parsed?.type ?? null;
        payloadToolName = parsed?.name ?? null;
      } catch {
        // ignore JSON parse errors, fall back to plain text matching
      }

      if (!payloadType && payloadRaw?.includes("sticky-note")) payloadType = "sticky-note";
      if (!payloadType && payloadRaw?.includes("agent-block")) payloadType = "agent-block";
      if (!payloadType && payloadRaw?.includes("upload-block")) payloadType = "upload-block";
      if (!payloadType && payloadRaw?.includes("output-block")) payloadType = "output-block";
      if (!payloadType && payloadRaw?.includes("tool")) payloadType = "tool";
      if (payloadType === "tool" && !payloadToolName && payloadRaw) {
        payloadToolName = payloadRaw.replace(/^tool-/, "");
      }
      if (!payloadType) return;

      const rect = el.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - transform.x) / transform.zoom;
      const worldY = (localY - transform.y) / transform.zoom;

      if (payloadType === "sticky-note") {
        const id = nextIdRef.current++;
        setNotes((prev) => [
          ...prev,
          {
            id: `note-${id}`,
            x: worldX,
            y: worldY,
            text: "Sticky note",
          },
        ]);
      }

      if (payloadType === "agent-block") {
        const id = nextBlockIdRef.current++;
        const preset = agentPresets[0];
        const inCount = preset?.inputCount ?? 1;
        const outCount = preset?.outputCount ?? 1;
        setBlocks((prev) => [
          ...prev,
          {
            id: `block-${id}`,
            x: worldX,
            y: worldY,
            name: preset?.name ?? "Agent Block",
            description: preset?.description ?? "1 input, 2 outputs",
            inputCount: inCount,
            outputCount: outCount,
            inputRequired: Array(inCount).fill(false),
            outputRequired: Array(outCount).fill(false),
            inputNames: [],
            outputNames: [],
            presetId: preset?.id,
          },
        ]);
      }

      if (payloadType === "upload-block") {
        const id = nextUploadIdRef.current++;
        setUploads((prev) => [
          ...prev,
          {
            id: `upload-${id}`,
            x: worldX,
            y: worldY,
            name: "Upload data",
            status: "idle",
          },
        ]);
      }

      if (payloadType === "output-block") {
        const id = nextOutputIdRef.current++;
        setOutputs((prev) => [
          ...prev,
          {
            id: `output-${id}`,
            x: worldX,
            y: worldY,
            name: "Output",
            format: "Describe the format here (e.g., JSON summary, Markdown bullets, CSV schema).",
          },
        ]);
      }

      if (payloadType === "tool") {
        const paletteItem = toolPalette.find((tool) => tool.name === payloadToolName);
        if (!paletteItem) return;
        const id = nextToolIdRef.current++;
        setTools((prev) => [
          ...prev,
          {
            ...paletteItem,
            id: `tool-${id}`,
            x: worldX,
            y: worldY,
          },
        ]);
      }
    },
    [agentPresets, containerEl, toolPalette, transform.x, transform.y, transform.zoom],
  );

  const handleGenerateAgentsFromJson = useCallback(() => {
    setAgentParseError(null);
    let parsed: any;
    try {
      parsed = JSON.parse(agentJsonInput);
    } catch (error) {
      setAgentParseError("Invalid JSON: please check formatting.");
      return;
    }
    const agents: any[] | null = Array.isArray(parsed?.agents) ? parsed.agents : null;
    if (!agents || agents.length === 0) {
      setAgentParseError("No agents found in JSON (expected an `agents` array).");
      return;
    }

    const newBlocks: AgentBlock[] = [];
    const newTools: ToolNode[] = [];
    const newConnections: Connection[] = [];
    const baseX = 140 + blocks.length * 40;
    const baseY = 200;
    const blockSpacing = 340;
    const toolSpacingX = 150;
    const toolSpacingY = 150;

    agents.forEach((agent, idx) => {
      const mandatoryInputs = Array.isArray(agent?.input_data_streams?.mandatory) ? agent.input_data_streams.mandatory : [];
      const optionalInputs = Array.isArray(agent?.input_data_streams?.optional) ? agent.input_data_streams.optional : [];
      const mandatoryOutputs = Array.isArray(agent?.output_data_streams?.mandatory) ? agent.output_data_streams.mandatory : [];
      const optionalOutputs = Array.isArray(agent?.output_data_streams?.optional) ? agent.output_data_streams.optional : [];
      const inputCount = mandatoryInputs.length + optionalInputs.length;
      const outputCount = mandatoryOutputs.length + optionalOutputs.length;
      const blockId = `block-${nextBlockIdRef.current++}`;
      const blockX = baseX + idx * blockSpacing;
      const blockY = baseY;

      newBlocks.push({
        id: blockId,
        x: blockX,
        y: blockY,
        name: agent?.name ?? agent?.id ?? `Agent ${idx + 1}`,
        description: agent?.description ?? "Generated from JSON",
        inputCount: Math.max(1, inputCount || 1),
        outputCount: Math.max(1, outputCount || 1),
        inputRequired: [
          ...Array(mandatoryInputs.length).fill(true),
          ...Array(Math.max(0, inputCount - mandatoryInputs.length)).fill(false),
        ].slice(0, Math.max(1, inputCount || 1)),
        outputRequired: [
          ...Array(mandatoryOutputs.length).fill(true),
          ...Array(Math.max(0, outputCount - mandatoryOutputs.length)).fill(false),
        ].slice(0, Math.max(1, outputCount || 1)),
        inputNames: [...mandatoryInputs, ...optionalInputs].slice(0, Math.max(1, inputCount || 1)),
        outputNames: [...mandatoryOutputs, ...optionalOutputs].slice(0, Math.max(1, outputCount || 1)),
        mandatoryInputCount: mandatoryInputs.length,
        mandatoryOutputCount: mandatoryOutputs.length,
      });

      const capabilities: string[] = Array.isArray(agent?.capabilities) ? agent.capabilities : [];
      capabilities.forEach((cap, capIdx) => {
        const palette = toolPalette[capIdx % toolPalette.length];
        const toolId = `tool-${nextToolIdRef.current++}`;
        const toolX = blockX + (capIdx % 2) * toolSpacingX - 40;
        const toolY = blockY + 220 + Math.floor(capIdx / 2) * toolSpacingY;
        newTools.push({
          ...palette,
          id: toolId,
          x: toolX,
          y: toolY,
          name: typeof cap === "string" ? cap : `Capability ${capIdx + 1}`,
          tagline: "Capability tool",
        });
        const connId = `conn-${nextConnectionIdRef.current++}`;
        newConnections.push({
          id: connId,
          from: { type: "tool", id: toolId, port: 0 },
          to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
        });
      });
    });

    setBlocks((prev) => [...prev, ...newBlocks]);
    setTools((prev) => [...prev, ...newTools]);
    setConnections((prev) => [...prev, ...newConnections]);
  }, [agentJsonInput, blocks.length, toolPalette]);

  const clamp = useCallback((value: number, min: number, max: number) => Math.min(max, Math.max(min, value)), []);
  const MIN_IO = 1;
  const MAX_IO = 5;
  const TOOL_PORT_OFFSET = 1000;
  const resizeRequired = useCallback((arr: boolean[], count: number) => {
    const next = arr.slice(0, count);
    while (next.length < count) next.push(false);
    return next;
  }, []);
  const clampNames = useCallback((arr: string[] | undefined, count: number) => (arr ?? []).slice(0, count), []);

  const getBlockMode = useCallback(
    (block: AgentBlock) => {
      const inbound = connections.filter(
        (conn) => conn.to.type === "block" && conn.to.id === block.id && (conn.to.inputIndex ?? 0) < TOOL_PORT_OFFSET,
      ).length;
      const outbound = connections.filter((conn) => conn.from.type === "block" && conn.from.id === block.id).length;
      if (block.inputCount > 1 || inbound > 1) return "aggregate";
      if (block.outputCount > 1 || outbound > 1) return "branch";
      return "sequential";
    },
    [TOOL_PORT_OFFSET, connections],
  );

  const recalcBlockPorts = useCallback(
    (conns: Connection[], blocksState: AgentBlock[]) => {
      const maxInputs: Record<string, number> = {};
      const maxOutputs: Record<string, number> = {};
      conns.forEach((conn) => {
        if (conn.to.type === "block") {
          const idx = conn.to.inputIndex ?? 0;
          if (idx < TOOL_PORT_OFFSET) {
            maxInputs[conn.to.id] = Math.max(maxInputs[conn.to.id] ?? -1, idx);
          }
        }
        if (conn.from.type === "block") {
          maxOutputs[conn.from.id] = Math.max(maxOutputs[conn.from.id] ?? -1, conn.from.port);
        }
      });
      return blocksState.map((b) => {
        const desiredInputs = clamp((maxInputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO);
        const desiredOutputs = clamp((maxOutputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO);
        if (b.inputCount === desiredInputs && b.outputCount === desiredOutputs) return b;
        return {
          ...b,
          inputCount: desiredInputs,
          outputCount: desiredOutputs,
          inputRequired: resizeRequired(b.inputRequired, desiredInputs),
          outputRequired: resizeRequired(b.outputRequired, desiredOutputs),
          inputNames: clampNames(b.inputNames, desiredInputs),
          outputNames: clampNames(b.outputNames, desiredOutputs),
          presetId: "custom",
        };
      });
    },
    [MAX_IO, MIN_IO, TOOL_PORT_OFFSET, clamp, clampNames, resizeRequired],
  );

  const toggleInputRequired = useCallback(
    (blockId: string, index: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          if (index < 0 || index >= b.inputCount) return b;
          // Prevent toggling mandatory inputs (those within mandatoryInputCount)
          const mandatoryCount = b.mandatoryInputCount ?? 0;
          if (index < mandatoryCount) return b;
          const next = [...b.inputRequired];
          next[index] = !next[index];
          return { ...b, inputRequired: next };
        }),
      );
    },
    [],
  );

  const toggleOutputRequired = useCallback(
    (blockId: string, index: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          if (index < 0 || index >= b.outputCount) return b;
          // Prevent toggling mandatory outputs (those within mandatoryOutputCount)
          const mandatoryCount = b.mandatoryOutputCount ?? 0;
          if (index < mandatoryCount) return b;
          const next = [...b.outputRequired];
          next[index] = !next[index];
          return { ...b, outputRequired: next };
        }),
      );
    },
    [],
  );

  const toggleEval = useCallback((evalId: string) => {
    setSelectedEvals((prev) => 
      prev.includes(evalId) 
        ? prev.filter((id) => id !== evalId)
        : [...prev, evalId]
    );
  }, []);

  const toggleToolInputRequired = useCallback(
    (toolId: string, index: number) => {
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== toolId) return t;
          if (index < 0 || index >= t.inputCount) return t;
          const mandatoryCount = t.mandatoryInputCount ?? 0;
          if (index < mandatoryCount) return t;
          const next = [...t.inputRequired];
          next[index] = !next[index];
          return { ...t, inputRequired: next };
        }),
      );
    },
    [],
  );

  const toggleToolOutputRequired = useCallback(
    (toolId: string, index: number) => {
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== toolId) return t;
          if (index < 0 || index >= t.outputCount) return t;
          const mandatoryCount = t.mandatoryOutputCount ?? 0;
          if (index < mandatoryCount) return t;
          const next = [...t.outputRequired];
          next[index] = !next[index];
          return { ...t, outputRequired: next };
        }),
      );
    },
    [],
  );

  const getBlockHandles = useCallback(
    (block: AgentBlock) => {
      const width = 220;
      const baseHeight = 120;
      const baseInputs = Math.max(1, block.inputCount);
      const baseOutputs = Math.max(1, block.outputCount);

      const maxConnectedInput = connections
        .filter(
          (conn) =>
            conn.to.type === "block" &&
            conn.to.id === block.id &&
            (conn.to.inputIndex ?? -1) < TOOL_PORT_OFFSET,
        )
        .reduce((max, conn) => Math.max(max, conn.to.inputIndex ?? 0), -1);

      const hasToolConnection = connections.some(
        (conn) => conn.to.type === "block" && conn.to.id === block.id && (conn.to.inputIndex ?? -1) >= TOOL_PORT_OFFSET,
      );

      const maxConnectedOutput = connections
        .filter((conn) => conn.from.type === "block" && conn.from.id === block.id)
        .reduce((max, conn) => Math.max(max, conn.from.port), -1);

      const hasInputConnections = maxConnectedInput >= 0;
      const hoverIsOnLeft =
        linking?.origin === "output" &&
        linking.from.type !== "tool" &&
        ((hoveredInput?.type === "block" && hoveredInput.id === block.id) || hoveredBlockId === block.id);
      const showInputPreview = hasInputConnections && hoverIsOnLeft;
      const desiredInputs = Math.max(baseInputs, maxConnectedInput + 1);
      const previewInputs =
        showInputPreview && desiredInputs < MAX_IO ? desiredInputs + 1 : desiredInputs;
      const inputSlots = Math.min(MAX_IO, previewInputs);

      const hasOutputConnections = maxConnectedOutput >= 0;
      const hoverIsOnRight =
        linking?.origin === "output" &&
        linking.from.type === "block" &&
        linking.from.id === block.id;
      const showOutputPreview = hasOutputConnections && hoverIsOnRight;
      const desiredOutputs = Math.max(baseOutputs, maxConnectedOutput + 1);
      const effectiveOutputs = Math.max(1, desiredOutputs);
      const outputSlots = Math.min(MAX_IO, showOutputPreview ? effectiveOutputs + 1 : effectiveOutputs);

      const hoverIsOnBottom =
        linking?.origin === "output" &&
        linking.from.type === "tool" &&
        hoveredBlockId === block.id;
      const showToolPreview = !hasToolConnection && hoverIsOnBottom;
      const toolSlots = 1 + (showToolPreview ? 1 : 0);

      const maxSlots = Math.max(inputSlots, outputSlots);
      const topPadding = 18;
      const slotGap = 28;
      const height =
        maxSlots > 1
          ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1))
          : baseHeight;

      const buildAnchors = (count: number, side: "left" | "right"): AnchorPoint[] => {
        if (count <= 1) {
          return [
            {
              x: side === "left" ? block.x : block.x + width,
              y: block.y + height / 2,
              dir: side,
            },
          ];
        }
        const gap = (height - topPadding * 2) / (count - 1);
        return Array.from({ length: count }, (_, idx) => ({
          x: side === "left" ? block.x : block.x + width,
          y: block.y + topPadding + idx * gap,
          dir: side,
        }));
      };

      const buildBottomAnchors = (count: number): { anchor: AnchorPoint; slot: number }[] => {
        const slots = Math.max(1, count);
        return Array.from({ length: slots }, (_, idx) => ({
          anchor: { x: block.x + width / 2 + 4, y: block.y + height, dir: "down" },
          slot: TOOL_PORT_OFFSET + idx,
        }));
      };

      const inputAnchors = buildAnchors(inputSlots, "left");
      const outputAnchors = buildAnchors(outputSlots, "right");
      const toolAnchors = buildBottomAnchors(toolSlots);
      return { width, height, inputAnchors, outputAnchors, toolAnchors };
    },
    [MAX_IO, TOOL_PORT_OFFSET, connections, draggingBlockId, hoveredBlockId, hoveredInput, linking],
  );

  const addToolToBlock = useCallback(
    (blockId: string, toolName: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const palette = toolPalette.find((t) => t.name === toolName) ?? toolPalette[0];
      if (!palette) return;
      const handles = getBlockHandles(block);
      const toolWidth = 180;
      const toolId = `tool-${nextToolIdRef.current++}`;
      const toolX = block.x + handles.width / 2 - toolWidth / 2;
      const toolY = block.y + handles.height + 60;
      const newTool: ToolNode = { ...palette, id: toolId, x: toolX, y: toolY };
      setTools((prev) => [...prev, newTool]);
      const connId = `conn-${nextConnectionIdRef.current++}`;
      setConnections((prev) => {
        const next: Connection[] = [
          ...prev,
          { id: connId, from: { type: "tool", id: toolId, port: 0 }, to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET } },
        ];
        setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
        return next;
      });
    },
    [blocks, getBlockHandles, recalcBlockPorts, toolPalette],
  );

  const getToolHandles = useCallback((tool: ToolNode) => {
    const width = 180;
    const height = 110;
    const output: AnchorPoint = { x: tool.x + width / 2, y: tool.y - 6, dir: "up" };
    const input: AnchorPoint = output; // single connector used for both directions
    return { width, height, output, input };
  }, []);
  const getUploadHandles = useCallback((upload: UploadNode) => {
    const width = 240;
    const height = 210;
    const output: AnchorPoint = { x: upload.x + width, y: upload.y + height / 2, dir: "right" };
    return { width, height, output };
  }, []);
  const getOutputHandles = useCallback((output: OutputNode) => {
    const width = 240;
    const height = 240;
    const input: AnchorPoint = { x: output.x, y: output.y + height / 2, dir: "left" };
    return { width, height, input };
  }, []);
  const applyBlockIO = useCallback(
    (
      blockId: string,
      nextInputCount: number,
      nextOutputCount: number,
      extra?: Partial<Pick<AgentBlock, "name" | "description" | "presetId">>,
    ) => {
      const targetBlock = blocks.find((b) => b.id === blockId);
      if (!targetBlock) return;
      const newInputs = clamp(nextInputCount, MIN_IO, MAX_IO);
      const newOutputs = clamp(nextOutputCount, MIN_IO, MAX_IO);

      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                inputCount: newInputs,
                outputCount: newOutputs,
                inputRequired: resizeRequired(b.inputRequired, newInputs),
                outputRequired: resizeRequired(b.outputRequired, newOutputs),
                inputNames: clampNames(b.inputNames, newInputs),
                outputNames: clampNames(b.outputNames, newOutputs),
                ...extra,
              }
            : b,
        ),
      );

      setConnections((prev) => {
        // drop output connections past new output count
        let next = prev.filter(
          (conn) => !(conn.from.type === "block" && conn.from.id === blockId && conn.from.port >= newOutputs),
        );

        // drop input connections past new input count (ignore tool ports)
        next = next.filter((conn) => {
          if (conn.to.type === "block" && conn.to.id === blockId) {
            const idx = conn.to.inputIndex ?? 0;
            if (idx >= TOOL_PORT_OFFSET) return true;
            return idx < newInputs;
          }
          return true;
        });

        return next;
      });
    },
    [MAX_IO, MIN_IO, TOOL_PORT_OFFSET, blocks, clamp],
  );
  const changeBlockInputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newInputs = clamp(block.inputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, newInputs, block.outputCount, { presetId: "custom" });
    },
    [MAX_IO, MIN_IO, applyBlockIO, blocks, clamp],
  );
  const changeBlockOutputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      const newOutputs = clamp(block.outputCount + delta, MIN_IO, MAX_IO);
      applyBlockIO(blockId, block.inputCount, newOutputs, { presetId: "custom" });
    },
    [MAX_IO, MIN_IO, applyBlockIO, blocks, clamp],
  );

  const handleEnterWorkspace = useCallback(() => {
    if (startExiting) return;
    setStartExiting(true);
    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    startTimeoutRef.current = window.setTimeout(() => {
      setShowStart(false);
      setStartExiting(false);
      startTimeoutRef.current = null;
    }, 450);
  }, [startExiting]);

  const handleResetWorkspace = useCallback(() => {
    reset();
    setNotes([]);
    setBlocks([]);
    setTools([]);
    setUploads([]);
    setOutputs([]);
    setConnections([]);
    setLinking(null);
    setHoveredInput(null);
    setHoveredOutput(null);
    setSelected(null);
    setDraggingNoteId(null);
    setDraggingBlockId(null);
    setDraggingToolId(null);
    setDraggingUploadId(null);
    setDraggingOutputId(null);
    setHoveredBlockId(null);
    setHoveredToolId(null);
    setHoveredUploadId(null);
    setHoveredOutputId(null);
    dragOffsetRef.current = { x: 0, y: 0 };
    blockDragOffsetRef.current = { x: 0, y: 0 };
    toolDragOffsetRef.current = { x: 0, y: 0 };
    uploadDragOffsetRef.current = { x: 0, y: 0 };
    outputDragOffsetRef.current = { x: 0, y: 0 };
    linkingRef.current = false;
    nextIdRef.current = 1;
    nextBlockIdRef.current = 1;
    nextToolIdRef.current = 1;
    nextUploadIdRef.current = 1;
    nextOutputIdRef.current = 1;
    nextConnectionIdRef.current = 1;
    localStorage.removeItem("c3an-workspace");
  }, [reset]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const src = JSON.parse(ev.target?.result as string);

      // 1.  If it’s already our native format, just load it
      if (Array.isArray(src.blocks) && Array.isArray(src.connections)) {
        setNotes(src.notes ?? []);
        setBlocks(src.blocks ?? []);
        setTools(src.tools ?? []);
        setUploads(src.uploads ?? []);
        setOutputs(src.outputs ?? []);
        setConnections(src.connections ?? []);
        setSelectedEvals(src.evals ?? []);
        return;
      }

      // 2.  Otherwise assume it’s a “plan” file and convert
      if (!src.triples || !src.metadata) {
        alert('Unrecognised JSON format');
        return;
      }

      const newBlocks: AgentBlock[] = [];
      const newConnections: Connection[] = [];
      const newTools: ToolNode[] = [];

      // create one agent block per unique agent mentioned
      const agentIds = Array.from(
        new Set(
          src.triples.flatMap((t: any) => [t.from, t.to])
        )
      );
      agentIds.forEach((id, idx) => {
        newBlocks.push({
          id: `block-${idx}`,
          x: 200 + idx * 260,
          y: 200,
          name: id as string,
          description: 'Imported from plan',
          inputCount: 1,
          outputCount: 1,
          inputRequired: [false],
          outputRequired: [false],
          inputNames: [],
          outputNames: [],
        });
      });

      // create connections that mirror the triples
      src.triples.forEach((t: any, idx: number) => {
        const fromIdx = agentIds.indexOf(t.from);
        const toIdx = agentIds.indexOf(t.to);
        if (fromIdx === -1 || toIdx === -1) return;
        newConnections.push({
          id: `conn-${idx}`,
          from: { type: 'block', id: `block-${fromIdx}`, port: 0 },
          to: { type: 'block', id: `block-${toIdx}`, inputIndex: 0 },
        });
      });

      setNotes([]);
      setBlocks(newBlocks);
      setTools(newTools);
      setUploads([]);
      setOutputs([]);
      setConnections(newConnections);
      setSelectedEvals([]);
    } catch {
      alert('Invalid workflow file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

  const handleRun = useCallback(() => {
    setActivePanel(null);
    setSelected(null);
    setShowStart(false);
    setStartExiting(false);
  }, []);

  const getOutputAnchor = useCallback(
    (endpoint: LinkSource) => {
      if (endpoint.type === "block") {
        const block = blocks.find((b) => b.id === endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const index = Math.min(
          handles.outputAnchors.length - 1,
          Math.max(0, endpoint.port),
        );
        return handles.outputAnchors[index];
      }
      if (endpoint.type === "tool") {
        const tool = tools.find((t) => t.id === endpoint.id);
        if (!tool) return null;
        const handles = getToolHandles(tool);
        return handles.output;
      }
      if (endpoint.type === "upload") {
        const upload = uploads.find((u) => u.id === endpoint.id);
        if (!upload) return null;
        const handles = getUploadHandles(upload);
        return handles.output;
      }
    },
    [blocks, getBlockHandles, getToolHandles, getUploadHandles, tools, uploads],
  );

  const getInputAnchor = useCallback(
    (target: LinkTarget) => {
      if (target.type === "block") {
        const block = blocks.find((b) => b.id === target.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const inputIndex = target.inputIndex ?? 0;
        const toolAnchor = handles.toolAnchors.find((item) => item.slot === inputIndex);
        if (toolAnchor) return toolAnchor.anchor;
        const boundedIndex = Math.min(
          handles.inputAnchors.length - 1,
          Math.max(0, inputIndex),
        );
        return handles.inputAnchors[boundedIndex];
      }
      if (target.type === "tool") {
        const tool = tools.find((t) => t.id === target.id);
        if (!tool) return null;
        const handles = getToolHandles(tool);
        return handles.input;
      }
      if (target.type === "output") {
        const output = outputs.find((o) => o.id === target.id);
        if (!output) return null;
        const handles = getOutputHandles(output);
        return handles.input;
      }
    },
    [blocks, getBlockHandles, getOutputHandles, getToolHandles, outputs, tools],
  );

  const buildConnectionPath = useCallback(
    (start: AnchorPoint, end: AnchorPoint) => {
      const dx = end.x - start.x;
      const offset = Math.max(Math.abs(dx) * 0.5, 40);
      const c1x = start.x + offset;
      const c2x = end.x - offset;
      return `M ${start.x} ${start.y} C ${c1x} ${start.y} ${c2x} ${end.y} ${end.x} ${end.y}`;
    },
    [],
  );

  const handleNotePointerDown = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "note" && prev.id === noteId ? null : { type: "note", id: noteId },
      );
      const note = notes.find((n) => n.id === noteId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!note || !world) return;
      dragOffsetRef.current = { x: world.x - note.x, y: world.y - note.y };
      setDraggingNoteId(noteId);
      setSelected({ type: "note", id: noteId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [notes, toWorldPoint],
  );

  const handleNotePointerMove = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingNoteId !== noteId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - dragOffsetRef.current.x;
      const newY = world.y - dragOffsetRef.current.y;
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, x: newX, y: newY } : n)),
      );
    },
    [draggingNoteId, toWorldPoint],
  );

  const handleNotePointerUp = useCallback(
    (noteId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingNoteId !== noteId) return;
      setDraggingNoteId(null);
      dragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingNoteId],
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (draggingNoteId === noteId) setDraggingNoteId(null);
      if (selected?.type === "note" && selected.id === noteId) setSelected(null);
    },
    [draggingNoteId, selected],
  );

  const handleBlockPointerDown = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "block" && prev.id === blockId ? null : { type: "block", id: blockId },
      );
      const block = blocks.find((b) => b.id === blockId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!block || !world) return;
      blockDragOffsetRef.current = { x: world.x - block.x, y: world.y - block.y };
      setDraggingBlockId(blockId);
      setSelected({ type: "block", id: blockId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [blocks, toWorldPoint],
  );

  const handleBlockPointerMove = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - blockDragOffsetRef.current.x;
      const newY = world.y - blockDragOffsetRef.current.y;
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, x: newX, y: newY } : b)),
      );
    },
    [draggingBlockId, toWorldPoint],
  );

  const handleBlockPointerUp = useCallback(
    (blockId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingBlockId !== blockId) return;
      setDraggingBlockId(null);
      blockDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingBlockId],
  );

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (draggingBlockId === blockId) setDraggingBlockId(null);
      if (selected?.type === "block" && selected.id === blockId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              (conn.from.type === "block" && conn.from.id === blockId) ||
              (conn.to.type === "block" && conn.to.id === blockId)
            ),
        ),
      );
    },
    [draggingBlockId, selected],
  );

  const handleToolPointerDown = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (linkingRef.current || target?.closest("[data-connector]")) return;
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "tool" && prev.id === toolId ? null : { type: "tool", id: toolId },
      );
      const tool = tools.find((t) => t.id === toolId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!tool || !world) return;
      toolDragOffsetRef.current = { x: world.x - tool.x, y: world.y - tool.y };
      setDraggingToolId(toolId);
      setSelected({ type: "tool", id: toolId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [tools, toWorldPoint],
  );

  const handleToolPointerMove = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - toolDragOffsetRef.current.x;
      const newY = world.y - toolDragOffsetRef.current.y;
      setTools((prev) =>
        prev.map((tool) => (tool.id === toolId ? { ...tool, x: newX, y: newY } : tool)),
      );
    },
    [draggingToolId, toWorldPoint],
  );

  const handleToolPointerUp = useCallback(
    (toolId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingToolId !== toolId) return;
      setDraggingToolId(null);
      toolDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingToolId],
  );

  const handleRemoveTool = useCallback(
    (toolId: string) => {
      setTools((prev) => prev.filter((t) => t.id !== toolId));
      if (draggingToolId === toolId) setDraggingToolId(null);
      if (selected?.type === "tool" && selected.id === toolId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              (conn.from.type === "tool" && conn.from.id === toolId) ||
              (conn.to.type === "tool" && conn.to.id === toolId)
            ),
        ),
      );
    },
    [draggingToolId, selected],
  );
  const handleUploadPointerDown = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        linkingRef.current ||
        target?.closest("[data-connector]") ||
        target?.closest("[data-upload-control]")
      ) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "upload" && prev.id === uploadId ? null : { type: "upload", id: uploadId },
      );
      const upload = uploads.find((u) => u.id === uploadId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!upload || !world) return;
      uploadDragOffsetRef.current = { x: world.x - upload.x, y: world.y - upload.y };
      setDraggingUploadId(uploadId);
      setSelected({ type: "upload", id: uploadId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [uploads, toWorldPoint],
  );

  const handleUploadPointerMove = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingUploadId !== uploadId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - uploadDragOffsetRef.current.x;
      const newY = world.y - uploadDragOffsetRef.current.y;
      setUploads((prev) =>
        prev.map((upload) => (upload.id === uploadId ? { ...upload, x: newX, y: newY } : upload)),
      );
    },
    [draggingUploadId, toWorldPoint],
  );

  const handleUploadPointerUp = useCallback(
    (uploadId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingUploadId !== uploadId) return;
      setDraggingUploadId(null);
      uploadDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingUploadId],
  );

  const handleRemoveUpload = useCallback(
    (uploadId: string) => {
      setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
      if (draggingUploadId === uploadId) setDraggingUploadId(null);
      if (selected?.type === "upload" && selected.id === uploadId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              conn.from.type === "upload" && conn.from.id === uploadId
            ),
        ),
      );
    },
    [draggingUploadId, selected],
  );

  const handleUploadFileChange = useCallback(
    (uploadId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId
            ? {
                ...upload,
                status: file ? "ready" : "idle",
                fileName: file?.name,
                fileSize: file?.size,
                fileType: file?.type || (file?.name ? `.${file.name.split(".").pop() ?? ""}` : undefined),
              }
            : upload,
        ),
      );
      event.target.value = "";
    },
    [],
  );

  const handleOutputPointerDown = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        linkingRef.current ||
        target?.closest("[data-connector]") ||
        target?.closest("[data-output-control]")
      ) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      setSelected((prev) =>
        prev?.type === "output" && prev.id === outputId ? null : { type: "output", id: outputId },
      );
      const output = outputs.find((o) => o.id === outputId);
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!output || !world) return;
      outputDragOffsetRef.current = { x: world.x - output.x, y: world.y - output.y };
      setDraggingOutputId(outputId);
      setSelected({ type: "output", id: outputId });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [outputs, toWorldPoint],
  );

  const handleOutputPointerMove = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOutputId !== outputId) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      const newX = world.x - outputDragOffsetRef.current.x;
      const newY = world.y - outputDragOffsetRef.current.y;
      setOutputs((prev) =>
        prev.map((output) => (output.id === outputId ? { ...output, x: newX, y: newY } : output)),
      );
    },
    [draggingOutputId, toWorldPoint],
  );

  const handleOutputPointerUp = useCallback(
    (outputId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingOutputId !== outputId) return;
      setDraggingOutputId(null);
      outputDragOffsetRef.current = { x: 0, y: 0 };
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [draggingOutputId],
  );

  const handleRemoveOutput = useCallback(
    (outputId: string) => {
      setOutputs((prev) => prev.filter((output) => output.id !== outputId));
      if (draggingOutputId === outputId) setDraggingOutputId(null);
      if (selected?.type === "output" && selected.id === outputId) setSelected(null);
      setConnections((prev) =>
        prev.filter(
          (conn) =>
            !(
              (conn.to.type === "output" && conn.to.id === outputId)
            ),
        ),
      );
    },
    [draggingOutputId, selected],
  );

  const handleOutputFormatChange = useCallback(
    (outputId: string) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setOutputs((prev) =>
        prev.map((output) => (output.id === outputId ? { ...output, format: value } : output)),
      );
    },
    [],
  );
  const handleOutputFormatBlur = useCallback((outputId: string) => () => {
    // delay so clicks on other elements can set selection first
    setTimeout(() => {
      setSelected((prev) => (prev?.type === "output" && prev.id === outputId ? null : prev));
    }, 0);
  }, []);

  const handleRemoveConnection = useCallback((connectionId: string) => {
    setConnections((prev) => {
      const next = prev.filter((conn) => conn.id !== connectionId);
      setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
      return next;
    });
    setSelected((prev) => (prev?.type === "connection" && prev.id === connectionId ? null : prev));
  }, [recalcBlockPorts]);

  const handleInputEnter = useCallback(
    (target: { type: "block" | "tool" | "output"; id: string; inputIndex?: number }) => () => {
      if (linking?.origin === "output" && linking.from.type === "tool" && (target.inputIndex ?? 0) < TOOL_PORT_OFFSET) {
        return;
      }
      if (linking) setHoveredInput(target);
    },
    [TOOL_PORT_OFFSET, linking],
  );

  const handleInputLeave = useCallback(
    (target: { type: "block" | "tool" | "output"; id: string; inputIndex?: number }) => () => {
      if (
        hoveredInput &&
        hoveredInput.type === target.type &&
        hoveredInput.id === target.id &&
        (hoveredInput.inputIndex ?? null) === (target.inputIndex ?? null)
      ) {
        setHoveredInput(null);
      }
    },
    [hoveredInput],
  );

  const handleOutputEnter = useCallback(
    (source: LinkSource) => () => {
      if (linking) setHoveredOutput(source);
    },
    [linking],
  );

  const handleOutputLeave = useCallback(
    (source: LinkSource) => () => {
      if (
        hoveredOutput &&
        hoveredOutput.type === source.type &&
        hoveredOutput.id === source.id &&
        hoveredOutput.port === source.port
      ) {
        setHoveredOutput(null);
      }
    },
    [hoveredOutput],
  );

  const handleConnectionPointerDown = useCallback(
    (conn: Connection) => (event: ReactPointerEvent<SVGPathElement>) => {
      event.stopPropagation();
      event.preventDefault();
      const removeAndMaybeLink = (shouldLink: boolean) => {
        setConnections((prev) => {
          const next = prev.filter((c) => c.id !== conn.id);
          setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
          return next;
        });
        if (!shouldLink) return;
        const startAnchor = getOutputAnchor(conn.from);
        const world = toWorldPoint(event.clientX, event.clientY);
        const currentPoint = world ?? startAnchor ?? { x: 0, y: 0 };
        linkingRef.current = true;
        setLinking({ origin: "output", from: conn.from, current: currentPoint });
        setHoveredInput(null);
        setHoveredOutput(null);
      };

      if (event.detail >= 2) {
        removeAndMaybeLink(true);
        return;
      }

      // Single click: just disconnect
      removeAndMaybeLink(false);
    },
    [getOutputAnchor, toWorldPoint],
  );

  const startLinkingFromInput = useCallback(
    (target: LinkTarget) =>
      (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
        event.stopPropagation();
        event.preventDefault();
        if (event.detail >= 2) return;
        const anchor = getInputAnchor(target);
        if (!anchor) return;
        linkingRef.current = true;
        setLinking({ origin: "input", target, current: anchor });
      },
    [getInputAnchor],
  );

  const startLinkingFromOutput = useCallback(
    (from: LinkSource) =>
      (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        if (event.detail >= 2) return;
        setHoveredInput(null);
        setHoveredOutput(null);
        let effectiveFrom = from;
        if (from.type === "block") {
          const ports = connections
            .filter((conn) => conn.from.type === "block" && conn.from.id === from.id)
            .map((conn) => conn.from.port);
          const hasPort = ports.includes(from.port);
          const maxPort = ports.reduce((max, p) => Math.max(max, p), -1);
          const nextPort = Math.min(MAX_IO - 1, Math.max(maxPort + 1, from.port));
          if (hasPort) {
            effectiveFrom = { ...from, port: nextPort };
          }
        }
        const computeOutputAnchorWithPreview = (block: AgentBlock, port: number): AnchorPoint => {
          const width = 220;
          const baseHeight = 120;
          const baseInputs = Math.max(1, block.inputCount);
          const baseOutputs = Math.max(1, block.outputCount);
          const maxConnectedInput = connections
            .filter((conn) => conn.to.type === "block" && conn.to.id === block.id && (conn.to.inputIndex ?? -1) < TOOL_PORT_OFFSET)
            .reduce((max, conn) => Math.max(max, conn.to.inputIndex ?? 0), -1);
          const inputSlots = Math.min(MAX_IO, Math.max(baseInputs, maxConnectedInput + 1));
          const maxConnectedOutput = connections
            .filter((conn) => conn.from.type === "block" && conn.from.id === block.id)
            .reduce((max, conn) => Math.max(max, conn.from.port), -1);
          const hasOutputConnections = maxConnectedOutput >= 0;
          const desiredOutputs = Math.max(baseOutputs, maxConnectedOutput + 1);
          const effectiveOutputs = Math.max(1, desiredOutputs);
          const outputSlots = Math.min(MAX_IO, hasOutputConnections ? effectiveOutputs + 1 : effectiveOutputs);
          const maxSlots = Math.max(inputSlots, outputSlots);
          const topPadding = 18;
          const slotGap = 28;
          const height =
            maxSlots > 1 ? Math.max(baseHeight, topPadding * 2 + slotGap * (maxSlots - 1)) : baseHeight;
          const count = outputSlots;
          if (count <= 1) {
            return { x: block.x + width, y: block.y + height / 2, dir: "right" };
          }
          const gap = (height - topPadding * 2) / (count - 1);
          const idx = Math.min(count - 1, Math.max(0, port));
          return { x: block.x + width, y: block.y + topPadding + idx * gap, dir: "right" };
        };
        let anchor = getOutputAnchor(effectiveFrom);
        if (!anchor && effectiveFrom.type === "block") {
          const block = blocks.find((b) => b.id === effectiveFrom.id);
          if (block) {
            anchor = computeOutputAnchorWithPreview(block, effectiveFrom.port);
          }
        }
        if (!anchor) return;
        linkingRef.current = true;
        setLinking({ origin: "output", from: effectiveFrom, current: anchor });
      },
    [MAX_IO, TOOL_PORT_OFFSET, blocks, connections, getOutputAnchor],
  );

  const moveLinking = useCallback(
    (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      if (!linking) return;
      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;
      setLinking((prev) => (prev ? { ...prev, current: world } : prev));
    },
    [linking, toWorldPoint],
  );

  const finalizeLinking = useCallback((overrideTarget?: LinkTarget) => {
    if (!linking) return;
    const autoToolTarget =
      linking.origin === "output" &&
      linking.from.type === "tool" &&
      hoveredBlockId
        ? { type: "block" as const, id: hoveredBlockId, inputIndex: TOOL_PORT_OFFSET }
        : null;
    const target =
      overrideTarget ??
      (linking.origin === "output"
        ? linking.from.type === "tool"
          ? autoToolTarget || hoveredInput
          : hoveredInput
        : linking.target);
    const from = linking.origin === "output" ? linking.from : hoveredOutput;

    if (
      target &&
      from &&
      !(target.type === from.type && target.id === from.id)
    ) {
      const isToolPortTarget = target.type === "block" && (target.inputIndex ?? 0) >= TOOL_PORT_OFFSET;
      if (isToolPortTarget && from.type !== "tool") {
        setLinking(null);
        linkingRef.current = false;
        setHoveredInput(null);
        setHoveredOutput(null);
        return;
      }
      if (
        from.type === "tool" &&
        target.type === "block" &&
        (target.inputIndex ?? 0) < TOOL_PORT_OFFSET
      ) {
        setLinking(null);
        linkingRef.current = false;
        setHoveredInput(null);
        setHoveredOutput(null);
        return;
      }

      // Check for duplicate connections
      const isDuplicate = connections.some((conn) => {
        const sameSource = conn.from.type === from.type && conn.from.id === from.id && conn.from.port === from.port;
        const sameTarget = conn.to.type === target.type && conn.to.id === target.id && (conn.to.inputIndex ?? 0) === (target.inputIndex ?? 0);
        return sameSource && sameTarget;
      });

      if (isDuplicate) {
        setLinking(null);
        linkingRef.current = false;
        setHoveredInput(null);
        setHoveredOutput(null);
        return;
      }

      const id = nextConnectionIdRef.current++;
      const targetBlock =
        target.type === "block" ? blocks.find((b) => b.id === target.id) : null;
      const targetHandles = targetBlock ? getBlockHandles(targetBlock) : null;
      const isBlockToolTarget =
        target.type === "block" &&
        (target.inputIndex ?? -1) >= TOOL_PORT_OFFSET;
      const sourceBlock = from && from.type === "block" ? blocks.find((b) => b.id === from.id) : null;
      if (
        sourceBlock &&
        from &&
        from.type === "block" &&
        from.port >= sourceBlock.outputCount &&
        sourceBlock.outputCount < MAX_IO
      ) {
        applyBlockIO(sourceBlock.id, sourceBlock.inputCount, sourceBlock.outputCount + 1, { presetId: "custom" });
      }
      if (
        target.type === "block" &&
        targetBlock &&
        !isBlockToolTarget &&
        (target.inputIndex ?? 0) >= targetBlock.inputCount &&
        targetBlock.inputCount < MAX_IO
      ) {
        applyBlockIO(targetBlock.id, targetBlock.inputCount + 1, targetBlock.outputCount, { presetId: "custom" });
      }
      setConnections((prev) => {
        if (isBlockToolTarget) {
          const desiredSlot =
            targetHandles?.toolAnchors.find((item) => item.slot === target.inputIndex)?.slot ??
            TOOL_PORT_OFFSET + Math.max(0, (target.inputIndex ?? TOOL_PORT_OFFSET) - TOOL_PORT_OFFSET);
          const slot = Math.min(TOOL_PORT_OFFSET + MAX_IO - 1, desiredSlot);

          // Check for duplicate before adding
          const wouldBeDuplicate = prev.some((conn) =>
            conn.from.type === from.type &&
            conn.from.id === from.id &&
            conn.from.port === from.port &&
            conn.to.type === target.type &&
            conn.to.id === target.id &&
            (conn.to.inputIndex ?? 0) === slot
          );
          
          if (wouldBeDuplicate) {
            return prev;
          }

          const withoutTool = prev.filter(
            (conn) => !(conn.from.type === "tool" && conn.from.id === from.id),
          );
          const withoutDuplicate = withoutTool.filter(
            (conn) =>
              !(
                conn.from.type === from.type &&
                conn.from.id === from.id &&
                conn.to.type === target.type &&
                conn.to.id === target.id &&
                (conn.to.inputIndex ?? 0) === slot
              ),
          );
          return [...withoutDuplicate, { id: `conn-${id}`, from, to: { ...target, inputIndex: slot } }];
        }
        const targetSlot = target.inputIndex ?? 0;

        // Check for duplicate connection before adding
        const wouldBeDuplicate = prev.some((conn) =>
          conn.from.type === from.type &&
          conn.from.id === from.id &&
          conn.from.port === from.port &&
          conn.to.type === target.type &&
          conn.to.id === target.id &&
          (conn.to.inputIndex ?? 0) === targetSlot
        );

        if (wouldBeDuplicate) {
          return prev;
        }

        // enforce single connection per target slot (block/tool/output inputs)
        const next = [
          ...prev.filter(
            (conn) =>
              !(
                conn.to.type === target.type &&
                conn.to.id === target.id &&
                (conn.to.inputIndex ?? 0) === targetSlot
              ),
          ),
          { id: `conn-${id}`, from, to: target },
        ];
        setBlocks((blocksState) => recalcBlockPorts(next, blocksState));
        return next;
      });
    }
    setLinking(null);
    linkingRef.current = false;
    setHoveredInput(null);
    setHoveredOutput(null);
  }, [MAX_IO, applyBlockIO, blocks, getBlockHandles, hoveredInput, hoveredOutput, linking]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note],[data-block],[data-tool],[data-upload],[data-output]")) return;
      setSelected(null);
      setHoveredInput(null);
      setHoveredOutput(null);
      setHoveredBlockId(null);
      setHoveredToolId(null);
      setHoveredUploadId(null);
      setHoveredOutputId(null);
      setLinking(null);
      linkingRef.current = false;
    },
    [],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modKey && key === "c" && selected) {
        event.preventDefault();
        if (selected.type === "block") {
          const block = blocks.find((b) => b.id === selected.id);
          if (block) setClipboard({ type: "block", data: block });
        } else if (selected.type === "tool") {
          const tool = tools.find((t) => t.id === selected.id);
          if (tool) setClipboard({ type: "tool", data: tool });
        } else if (selected.type === "upload") {
          const upload = uploads.find((u) => u.id === selected.id);
          if (upload) setClipboard({ type: "upload", data: upload });
        } else if (selected.type === "output") {
          const output = outputs.find((o) => o.id === selected.id);
          if (output) setClipboard({ type: "output", data: output });
        } else if (selected.type === "note") {
          const note = notes.find((n) => n.id === selected.id);
          if (note) setClipboard({ type: "note", data: note });
        }
        return;
      }

      if (modKey && key === "v" && clipboard) {
        event.preventDefault();
        const OFFSET = 26;
        if (clipboard.type === "block") {
          const base = clipboard.data;
          const id = nextBlockIdRef.current++;
          const newBlock: AgentBlock = {
            ...base,
            id: `block-${id}`,
            x: base.x + OFFSET,
            y: base.y + OFFSET,
            inputCount: clamp(base.inputCount, MIN_IO, MAX_IO),
            outputCount: clamp(base.outputCount, MIN_IO, MAX_IO),
          };
          setBlocks((prev) => [...prev, newBlock]);
          setSelected({ type: "block", id: newBlock.id });
        } else if (clipboard.type === "tool") {
          const base = clipboard.data;
          const id = nextToolIdRef.current++;
          const newTool: ToolNode = { ...base, id: `tool-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setTools((prev) => [...prev, newTool]);
          setSelected({ type: "tool", id: newTool.id });
        } else if (clipboard.type === "upload") {
          const base = clipboard.data;
          const id = nextUploadIdRef.current++;
          const newUpload: UploadNode = { ...base, id: `upload-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setUploads((prev) => [...prev, newUpload]);
          setSelected({ type: "upload", id: newUpload.id });
        } else if (clipboard.type === "output") {
          const base = clipboard.data;
          const id = nextOutputIdRef.current++;
          const newOutput: OutputNode = { ...base, id: `output-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setOutputs((prev) => [...prev, newOutput]);
          setSelected({ type: "output", id: newOutput.id });
        } else if (clipboard.type === "note") {
          const base = clipboard.data;
          const id = nextIdRef.current++;
          const newNote: Note = { ...base, id: `note-${id}`, x: base.x + OFFSET, y: base.y + OFFSET };
          setNotes((prev) => [...prev, newNote]);
          setSelected({ type: "note", id: newNote.id });
        }
        return;
      }

      if (!selected) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      event.preventDefault();
      if (selected.type === "note") {
        handleRemoveNote(selected.id);
      } else if (selected.type === "block") {
        handleRemoveBlock(selected.id);
      } else if (selected.type === "tool") {
        handleRemoveTool(selected.id);
      } else if (selected.type === "upload") {
        handleRemoveUpload(selected.id);
      } else if (selected.type === "output") {
        handleRemoveOutput(selected.id);
      } else if (selected.type === "connection") {
        handleRemoveConnection(selected.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    MAX_IO,
    MIN_IO,
    blocks,
    clipboard,
    clamp,
    handleRemoveBlock,
    handleRemoveNote,
    handleRemoveOutput,
    handleRemoveTool,
    handleRemoveUpload,
    handleRemoveConnection,
    notes,
    outputs,
    selected,
    tools,
    uploads,
  ]);

  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (modalBlockId) {
      setModalToolChoice(toolPalette[0]?.name ?? "");
    }
  }, [modalBlockId, toolPalette]);

  // persistence
  useEffect(() => {
    const saved = localStorage.getItem("c3an-workspace");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setNotes(parsed.notes ?? []);
      setBlocks(parsed.blocks ?? []);
      setTools(parsed.tools ?? []);
      setUploads(parsed.uploads ?? []);
      setOutputs(parsed.outputs ?? []);
      setConnections(parsed.connections ?? []);
      setTheme(parsed.theme ?? "light");
      setBackgroundPreset(parsed.backgroundPreset ?? "grid");
      nextBlockIdRef.current = parsed.nextBlockId ?? nextBlockIdRef.current;
      nextToolIdRef.current = parsed.nextToolId ?? nextToolIdRef.current;
      nextUploadIdRef.current = parsed.nextUploadId ?? nextUploadIdRef.current;
      nextOutputIdRef.current = parsed.nextOutputId ?? nextOutputIdRef.current;
      nextConnectionIdRef.current = parsed.nextConnectionId ?? nextConnectionIdRef.current;
      nextIdRef.current = parsed.nextNoteId ?? nextIdRef.current;
    } catch {
      // ignore bad saves
    }
  }, []);

  useEffect(() => {
    const snapshot = {
      notes,
      blocks,
      tools,
      uploads,
      outputs,
      connections,
      theme,
      backgroundPreset,
      nextBlockId: nextBlockIdRef.current,
      nextToolId: nextToolIdRef.current,
      nextUploadId: nextUploadIdRef.current,
      nextOutputId: nextOutputIdRef.current,
      nextConnectionId: nextConnectionIdRef.current,
      nextNoteId: nextIdRef.current,
    };
    localStorage.setItem("c3an-workspace", JSON.stringify(snapshot));
  }, [notes, blocks, tools, uploads, outputs, connections, theme, backgroundPreset]);

  const appThemeClass =
    theme === "dark"
      ? "bg-slate-950 text-slate-100"
      : "bg-slate-50 text-slate-900";
  const actionButtonClass =
    theme === "dark"
      ? "rounded-full border border-slate-700 bg-slate-800/90 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-700"
      : "rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = (prefersDark: boolean) => {
      if (userThemeLocked) return;
      setTheme(prefersDark ? "dark" : "light");
    };
    applySystemTheme(media.matches);
    const listener = (event: MediaQueryListEvent) => applySystemTheme(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [userThemeLocked]);

  return (
    <div className={`relative h-screen w-screen overflow-hidden transition-colors duration-200 ${appThemeClass}`}>
      <div className="absolute left-0 top-0 bottom-0 z-30 flex">
        <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
          {panelTabs.map((item) => (
            <button
              key={item.id}
              className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
                activePanel === item.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-slate-800/70 text-white hover:bg-slate-800"
              }`}
              onClick={() => setActivePanel((prev) => (prev === item.id ? null : item.id))}
              aria-pressed={activePanel === item.id}
              aria-label={item.label}
            >
              {item.symbol}
            </button>
          ))}
        </div>

        {activePanel && (
          <div
            className={`w-72 backdrop-blur px-4 py-5 shadow-xl transition-all flex flex-col overflow-hidden ${
              theme === "dark"
                ? "border-r border-slate-800 bg-slate-900/90 text-slate-100"
                : "border-r border-slate-200 bg-white/95 text-slate-900"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {activePanel ? panelTitles[activePanel] : ""}
                </h2>
              </div>
              <button
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                onClick={() => setActivePanel(null)}
              >
                Close
              </button>
            </div>

            {activePanel === "blocks" && (
              <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">Agent & IO Blocks</p>
                <div className="space-y-4">
                  <div
                    className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm active:cursor-grabbing"
                    draggable
                    onDragStart={handleBlockDragStart}
                  >
                  <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold text-slate-900">Agent: Solo</p>
                        <p className="text-xs text-slate-600 leading-snug">Starter block that adapts as you connect.</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Drag
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        1 input
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                        1 output
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        0 tools
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-600">
                      Drag to canvas and add links; inputs/outputs grow as you connect more wires.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div
                      className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-100 p-4 shadow-sm ring-1 ring-inset ring-indigo-100 active:cursor-grabbing"
                      draggable
                      onDragStart={handleUploadDragStart}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Upload block</p>
                          <p className="text-xs text-slate-600">PDF, CSV, Excel, JSON, TXT and more</p>
                        </div>
                        <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                          Drag
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-[auto,1fr,auto] gap-3 items-center text-[11px] text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                          <span className="text-[11px] font-medium text-emerald-900">Input</span>
                        </div>
                        <div className="h-px bg-gradient-to-r from-emerald-200 via-emerald-100 to-transparent" />
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-[11px] font-medium text-slate-700">Output</span>
                          <div className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-200" />
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] text-slate-600">
                        Use this as a data source before branching into agents or tools.
                      </p>
                    </div>

                    <div
                      className="cursor-grab rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-amber-100 p-4 shadow-sm ring-1 ring-inset ring-emerald-100 active:cursor-grabbing"
                      draggable
                      onDragStart={handleOutputDragStart}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Output block</p>
                          <p className="text-xs text-slate-600">Define response/formatting requirements</p>
                        </div>
                        <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                          Drag
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-[auto,1fr,auto] gap-3 items-center text-[11px] text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                          <span className="text-[11px] font-medium text-emerald-900">Input</span>
                        </div>
                        <div className="h-px bg-gradient-to-r from-emerald-200 via-emerald-100 to-transparent" />
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-[11px] font-medium text-slate-700">Output</span>
                          <div className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-200" />
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] text-slate-600">
                        Collect results and specify final format.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Generate from JSON</p>
                        <p className="text-xs text-slate-600">Build agents, inputs, outputs, and capability tools.</p>
                      </div>
                      <span className="rounded-full bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                        Beta
                      </span>
                    </div>
                    <textarea
                      className="mt-3 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      rows={6}
                      value={agentJsonInput}
                      onChange={(e) => setAgentJsonInput(e.target.value)}
                      spellCheck={false}
                    />
                    {agentParseError && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">{agentParseError}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-[11px] text-slate-600">
                        Agents become blocks with matching input/output counts; capabilities become tools linked underneath.
                      </p>
                      <button
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                        onClick={handleGenerateAgentsFromJson}
                      >
                        Generate agents
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePanel === "tools" && (
              <div className="mt-4 flex-1 space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Tools</p>
                  </div>
                </div>
                <div className="mt-3 h-[calc(100vh-240px)] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-3 auto-rows-max">
                    {toolPalette.map((tool) => (
                      <div
                        key={tool.name}
                        className="group relative flex items-center justify-center cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={handleToolDragStart(tool.name)}
                      >
                        <div
                          className={`relative h-[110px] w-[180px] rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition duration-150 group-hover:shadow-md group-hover:-translate-y-0.5`}
                          aria-label={tool.name}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                            <p className="text-sm font-semibold text-slate-900 drop-shadow-sm">{tool.name}</p>
                            <p className="text-[11px] text-slate-700 leading-tight">{tool.tagline}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activePanel === "settings" && (
              <div className="mt-4 space-y-5 text-sm">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Theme</p>
                  <div className="flex items-center gap-2">
                    {(["light", "dark"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          theme === mode
                            ? "bg-slate-900 text-white border-slate-700 shadow-sm"
                            : "bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                        onClick={() => {
                          setUserThemeLocked(true);
                          setTheme(mode);
                        }}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            mode === "light" ? "bg-amber-400" : "bg-emerald-400"
                          }`}
                        />
                        {mode === "light" ? "Light" : "Dark"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Canvas background</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "grid", name: "Soft grid", accent: "from-slate-100 via-white to-slate-200" },
                      { id: "aurora", name: "Aurora", accent: "from-emerald-100 via-teal-100 to-indigo-100" },
                      { id: "blueprint", name: "Blueprint", accent: "from-sky-100 via-blue-100 to-indigo-200" },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        className={`relative h-24 rounded-xl border text-left p-3 shadow-sm transition ${
                          backgroundPreset === preset.id
                            ? "border-slate-900 ring-2 ring-slate-900"
                            : "border-slate-200 hover:border-slate-300"
                        } bg-gradient-to-br ${preset.accent}`}
                        onClick={() => setBackgroundPreset(preset.id as typeof backgroundPreset)}
                      >
                        <span className="text-xs font-semibold text-slate-800">{preset.name}</span>
                        {backgroundPreset === preset.id && (
                          <span className="absolute right-2 top-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Backgrounds apply to the canvas; theme updates surrounding UI chrome.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Links</p>
                  <div className="flex flex-wrap gap-2">
                    {["Docs", "Changelog", "Support"].map((label) => (
                      <button
                        key={label}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => setSelected(null)}
                      >
                        Add {label} link
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <main className="relative z-0 h-full w-full">
        <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
          <button
            className={actionButtonClass}
            onClick={() => {
              if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
              setStartExiting(false);
              setShowStart(true);
            }}
          >
            C3AN
          </button>
          <button
            className={actionButtonClass}
            onClick={() => setActivePanel("settings")}
          >
            About
          </button>
          <button
            className={actionButtonClass}
            onClick={() => setShowEvalsModal(true)}
          >
            Evals
          </button>
          <button
            className={actionButtonClass}
            onClick={() => {
              const snapshot = {
                version: WORKFLOW_VERSION,
                plan_id: `plan-${Date.now().toString(36)}`,
                query: '', intent: 'custom',
                notes, blocks, tools, uploads, outputs, connections,
                evals: selectedEvals,
                metadata: {
                  total_agents: blocks.length,
                  total_triples: connections.length,
                  operator_counts: { seq: 0, brn: 0, agg: 0 }, // quick stub
                  max_parallelism: 0,
                  estimated_latency_ms: 0,
                  estimated_cost: 0,
                },
              };
              downloadWorkflow(snapshot);
            }}
          >
            Download JSON
          </button>

          <button
            className={actionButtonClass}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            className={actionButtonClass}
            onClick={handleRun}
          >
            Run
          </button>
          <button
            className={actionButtonClass}
            onClick={handleResetWorkspace}
          >
            Reset
          </button>
        </div>
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onPointerDownCapture={handleCanvasPointerDown}
        >
          <Background transform={transform} theme={theme} preset={backgroundPreset} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
              transition: "none",
              willChange: "transform",
              pointerEvents: "auto",
            }}
            onPointerMove={moveLinking}
            onPointerUp={() => {
              if (linking) finalizeLinking();
            }}
          >
            {/* existing connections */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              overflow="visible"
            >
              <defs>
                {/* Gradients for data stream styling - Databricks inspired */}
                <linearGradient id="gradient-required" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(244, 63, 94, 0.9)" />
                  <stop offset="50%" stopColor="rgba(251, 113, 133, 0.9)" />
                  <stop offset="100%" stopColor="rgba(244, 63, 94, 0.9)" />
                </linearGradient>
                <linearGradient id="gradient-upload" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(234, 179, 8, 0.85)" />
                  <stop offset="50%" stopColor="rgba(250, 204, 21, 0.85)" />
                  <stop offset="100%" stopColor="rgba(234, 179, 8, 0.85)" />
                </linearGradient>
                <linearGradient id="gradient-tool" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(99, 102, 241, 0.85)" />
                  <stop offset="50%" stopColor="rgba(129, 140, 248, 0.85)" />
                  <stop offset="100%" stopColor="rgba(99, 102, 241, 0.85)" />
                </linearGradient>
                <linearGradient id="gradient-default" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(56, 189, 248, 0.8)" />
                  <stop offset="50%" stopColor="rgba(14, 165, 233, 0.8)" />
                  <stop offset="100%" stopColor="rgba(56, 189, 248, 0.8)" />
                </linearGradient>
                <linearGradient id="gradient-preview" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(59, 130, 246, 0.7)" />
                  <stop offset="50%" stopColor="rgba(96, 165, 250, 0.7)" />
                  <stop offset="100%" stopColor="rgba(59, 130, 246, 0.7)" />
                </linearGradient>

                {/* Glow filters for data streams */}
                <filter id="glow-required" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="glow-upload" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="glow-tool" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="glow-default" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>

                {/* Arrow markers with gradients */}
                <marker
                  id="arrowhead-required"
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,7 L10,3.5 z" fill="url(#gradient-required)" />
                </marker>
                <marker
                  id="arrowhead-upload"
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,7 L10,3.5 z" fill="url(#gradient-upload)" />
                </marker>
                <marker
                  id="arrowhead-tool"
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,7 L10,3.5 z" fill="url(#gradient-tool)" />
                </marker>
                <marker
                  id="arrowhead-default"
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,7 L10,3.5 z" fill="url(#gradient-default)" />
                </marker>
                <marker
                  id="arrowhead-preview"
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,7 L10,3.5 z" fill="url(#gradient-preview)" />
                </marker>
              </defs>
                  {connections.map((conn) => {
                    const start = getOutputAnchor(conn.from);
                    const end = getInputAnchor(conn.to);
                    if (!start || !end) return null;
                    const d = buildConnectionPath(start, end);
                    const isRequiredInput =
                      conn.to.type === "block" &&
                      (() => {
                        const blk = blocks.find((b) => b.id === conn.to.id);
                        if (!blk) return false;
                        const idx = conn.to.inputIndex ?? 0;
                        return idx < blk.inputRequired.length && blk.inputRequired[idx];
                      })();
                    const isRequiredOutput =
                      conn.from.type === "block" &&
                      (() => {
                        const blk = blocks.find((b) => b.id === conn.from.id);
                        if (!blk) return false;
                        const idx = conn.from.port;
                        return idx < blk.outputRequired.length && blk.outputRequired[idx];
                      })();
                    
                    const connectionType = isRequiredInput || isRequiredOutput
                      ? "required"
                      : conn.from.type === "upload"
                        ? "upload"
                        : conn.from.type === "tool"
                          ? "tool"
                          : "default";
                    
                    const stroke = connectionType === "required"
                      ? "url(#gradient-required)"
                      : connectionType === "upload"
                        ? "url(#gradient-upload)"
                        : connectionType === "tool"
                          ? "url(#gradient-tool)"
                          : "url(#gradient-default)";
                    
                    const filter = connectionType === "required"
                      ? "url(#glow-required)"
                      : connectionType === "upload"
                        ? "url(#glow-upload)"
                        : connectionType === "tool"
                          ? "url(#glow-tool)"
                          : "url(#glow-default)";
                    
                    const markerEnd = connectionType === "required"
                      ? "url(#arrowhead-required)"
                      : connectionType === "upload"
                        ? "url(#arrowhead-upload)"
                        : connectionType === "tool"
                          ? "url(#arrowhead-tool)"
                          : "url(#arrowhead-default)";
                    
                    const isSelected = selected?.type === "connection" && selected.id === conn.id;
                return (
                  <g key={conn.id}>
                    {/* Background glow layer */}
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isSelected ? 8 : 6}
                      strokeLinecap="round"
                      opacity={0.3}
                      style={{ pointerEvents: "none" }}
                    />
                    {/* Main connection path */}
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isSelected ? 4 : 3}
                      strokeLinecap="round"
                      markerEnd={markerEnd}
                      filter={filter}
                      className={`transition-all duration-200 ${isSelected ? "drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]" : ""}`}
                      style={{ 
                        pointerEvents: "visibleStroke", 
                        cursor: "pointer",
                      }}
                      onPointerDown={handleConnectionPointerDown(conn)}
                    />
                    {/* Animated flow particles for active connections */}
                    {!isSelected && (
                      <path
                        d={d}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.8)"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeDasharray="4 20"
                        style={{ pointerEvents: "none" }}
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="0"
                          to="24"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </path>
                    )}
                  </g>
                );
              })}

              {linking && (() => {
                const start =
                  linking.origin === "output"
                    ? getOutputAnchor(linking.from)
                    : getInputAnchor(linking.target);
                if (!start) return null;
                const end = linking.current;
                const d = buildConnectionPath(start, end);
                return (
                  <g>
                    {/* Background glow for preview */}
                    <path
                      d={d}
                      fill="none"
                      stroke="url(#gradient-preview)"
                      strokeWidth={6}
                      strokeLinecap="round"
                      opacity={0.3}
                    />
                    {/* Main preview path */}
                    <path
                      d={d}
                      fill="none"
                      stroke="url(#gradient-preview)"
                      strokeDasharray="8 8"
                      strokeWidth={3}
                      strokeLinecap="round"
                      markerEnd="url(#arrowhead-preview)"
                      filter="url(#glow-default)"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="16"
                        dur="0.8s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </g>
                );
              })()}
            </svg>

            {blocks.map((block) => {
              const isActive = selected?.type === "block" && selected.id === block.id;
              const linkingActive = Boolean(linking);
              const showConnections =
            isActive ||
            draggingBlockId === block.id ||
            linkingActive ||
            hoveredBlockId === block.id;

              const directToolIds = connections
                .filter(
                  (conn) =>
                    conn.from.type === "tool" &&
                    conn.to.type === "block" &&
                    conn.to.id === block.id &&
                    (conn.to.inputIndex ?? 0) >= TOOL_PORT_OFFSET
                )
                .map((conn) => conn.from.id);

              const incomingByToolId = new Map<string, Set<string>>();
              connections.forEach((conn) => {
                if (conn.from.type !== "tool") return;
                if (conn.to.type !== "tool") return;
                const toId = conn.to.id;
                const set = incomingByToolId.get(toId);
                if (set) set.add(conn.from.id);
                else incomingByToolId.set(toId, new Set([conn.from.id]));
              });

              const seenTools = new Set<string>();
              const stack = [...directToolIds];
              while (stack.length > 0) {
                const current = stack.pop();
                if (!current || seenTools.has(current)) continue;
                seenTools.add(current);
                const incoming = incomingByToolId.get(current);
                if (!incoming) continue;
                incoming.forEach((upstreamId) => {
                  if (!seenTools.has(upstreamId)) stack.push(upstreamId);
                });
              }

              const toolCount = seenTools.size;
          const handles = getBlockHandles(block);
          return (
            <div
                  key={block.id}
                  className="absolute"
                  style={{ left: block.x, top: block.y }}
                  onPointerEnter={() => setHoveredBlockId(block.id)}
                  onPointerLeave={() =>
                    setHoveredBlockId((prev) => (prev === block.id ? null : prev))
                  }
                >
                  <div
                    className={`relative rounded-lg border border-slate-200 bg-white/90 shadow-md backdrop-blur-sm transition-all duration-150 w-[220px] px-3 pt-2 pb-3 scale-[0.97] min-h-[120px] ${
                      showConnections ? "ring-2 ring-emerald-300" : ""
                    } cursor-grab active:cursor-grabbing select-none`}
                    data-block
                    style={{ width: 220, height: handles.height }}
                    onPointerDown={handleBlockPointerDown(block.id)}
                    onPointerMove={handleBlockPointerMove(block.id)}
                    onPointerUp={handleBlockPointerUp(block.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSelected(null);
                    }}
                  >
                    <button
                      className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => handleRemoveBlock(block.id)}
                      aria-label="Remove block"
                    >
                      ×
                    </button>
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold text-slate-900">{block.name}</p>
                        <p className="text-[11px] text-slate-600 leading-snug">Mode: {getBlockMode(block)}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Agent
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        {handles.inputAnchors.length} inputs
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                        {handles.outputAnchors.length} outputs
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        {toolCount} tools
                      </span>
                      <button
                        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalBlockId(block.id);
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>

                  {/* connection handles for visual targeting */}
                  {handles.toolAnchors.map((toolAnchor, idx) => (
                    <div
                      key={toolAnchor.slot}
                      className={`absolute -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                        showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{
                        top: toolAnchor.anchor.y - block.y - 12,
                        left: toolAnchor.anchor.x - block.x - 12,
                        width: 24,
                        height: 24,
                        pointerEvents: "auto",
                      }}
                      data-input
                      data-connector
                      onPointerEnter={handleInputEnter({
                        type: "block",
                        id: block.id,
                        inputIndex: toolAnchor.slot,
                      })}
                      onPointerLeave={handleInputLeave({
                        type: "block",
                        id: block.id,
                        inputIndex: toolAnchor.slot,
                      })}
                      onPointerDownCapture={startLinkingFromInput({
                        type: "block",
                        id: block.id,
                        inputIndex: toolAnchor.slot,
                      })}
                      onPointerDown={startLinkingFromInput({
                        type: "block",
                        id: block.id,
                        inputIndex: toolAnchor.slot,
                      })}
                      onPointerUp={() =>
                        finalizeLinking({
                          type: "block",
                          id: block.id,
                          inputIndex: toolAnchor.slot,
                        })
                      }
                      aria-label={`Attach tool ${idx + 1}`}
                    >
                      <HandleDot />
                    </div>
                  ))}
                  {handles.inputAnchors.map((anchor, idx) => (
                    <div
                      key={idx}
                      className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
                        showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{
                        top: anchor.y - block.y - 12,
                        left: anchor.x - block.x - 12,
                        width: 24,
                        height: 24,
                        pointerEvents: "auto",
                      }}
                      data-input
                      data-connector
                      onPointerDownCapture={startLinkingFromInput({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerEnter={handleInputEnter({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerLeave={handleInputLeave({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerDown={startLinkingFromInput({ type: "block", id: block.id, inputIndex: idx })}
                      onPointerUp={() =>
                        finalizeLinking({
                          type: "block",
                          id: block.id,
                          inputIndex: idx,
                        })
                      }
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        changeBlockInputs(block.id, e.altKey ? -1 : 1);
                      }}
                    >
                      <HandleDot />
                    </div>
                  ))}
                  {handles.outputAnchors.map((anchor, idx) => (
                    <div
                      key={idx}
                      className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
                        showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{
                        top: anchor.y - block.y - 12,
                        left: anchor.x - block.x - 12,
                        width: 24,
                        height: 24,
                        pointerEvents: "auto",
                      }}
                      data-output
                      data-connector
                      data-port={idx}
                      onPointerDownCapture={startLinkingFromOutput({ type: "block", id: block.id, port: idx })}
                      onPointerDown={startLinkingFromOutput({ type: "block", id: block.id, port: idx })}
                      onPointerEnter={handleOutputEnter({ type: "block", id: block.id, port: idx })}
                      onPointerLeave={handleOutputLeave({ type: "block", id: block.id, port: idx })}
                      onPointerMove={moveLinking}
                      onPointerUp={() => finalizeLinking()}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        changeBlockOutputs(block.id, e.altKey ? -1 : 1);
                      }}
                    >
                      <HandleDot />
                    </div>
                  ))}
                </div>
              );
            })}
            {uploads.map((upload) => {
              const isActive = selected?.type === "upload" && selected.id === upload.id;
              const isDragging = draggingUploadId === upload.id;
              const handles = getUploadHandles(upload);
              const showHandles =
                isActive ||
                isDragging ||
                hoveredUploadId === upload.id ||
                Boolean(linking);
              const fileLabel = upload.fileName ?? "No file attached";
              const fileMeta =
                upload.status === "ready"
                  ? `${upload.fileType ?? "File"}${upload.fileSize ? ` • ${formatBytes(upload.fileSize)}` : ""}`
                  : "Accepted: PDF, CSV, Excel, JSON, TXT";
              return (
                <div
                  key={upload.id}
                  className="absolute"
                  style={{ left: upload.x, top: upload.y }}
                  onPointerEnter={() => setHoveredUploadId(upload.id)}
                  onPointerLeave={() =>
                    setHoveredUploadId((prev) => (prev === upload.id ? null : prev))
                  }
                >
                  <div
                    className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
                      isActive ? "ring-2 ring-indigo-300" : ""
                    } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none`}
                    data-upload
                    style={{ width: handles.width, height: handles.height }}
                    onPointerDown={handleUploadPointerDown(upload.id)}
                    onPointerMove={handleUploadPointerMove(upload.id)}
                    onPointerUp={handleUploadPointerUp(upload.id)}
                  >
                    <button
                      className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => handleRemoveUpload(upload.id)}
                      aria-label="Remove upload block"
                    >
                      ×
                    </button>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{upload.name}</p>
                        <p className="text-xs text-slate-600">Attach data to feed the flow</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                          upload.status === "ready"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-amber-50 text-amber-700 ring-amber-100"
                        }`}
                      >
                        {upload.status === "ready" ? "Ready" : "No file"}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3 text-left">
                      <p className="text-xs font-semibold text-slate-800 break-words">{fileLabel}</p>
                      <p className="text-[11px] text-slate-600">{fileMeta}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          id={`upload-input-${upload.id}`}
                          type="file"
                          className="hidden"
                          onChange={handleUploadFileChange(upload.id)}
                          accept=".pdf,.csv,.xlsx,.xls,.json,.txt,.doc,.docx,.xml,.zip"
                          data-upload-control
                        />
                        <label
                          htmlFor={`upload-input-${upload.id}`}
                          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 cursor-pointer"
                          data-upload-control
                        >
                          Choose file
                        </label>
                        {upload.fileName && (
                          <button
                            className="text-[11px] font-semibold text-slate-600 underline decoration-dotted underline-offset-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploads((prev) =>
                                prev.map((item) =>
                                  item.id === upload.id
                                    ? { ...item, status: "idle", fileName: undefined, fileSize: undefined, fileType: undefined }
                                    : item,
                                ),
                              );
                            }}
                            data-upload-control
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`absolute flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                      showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    }`}
                    style={{
                      top: handles.output.y - upload.y - 12,
                      left: handles.output.x - upload.x - 12,
                      width: 24,
                      height: 24,
                      pointerEvents: "auto",
                    }}
                    data-output
                    data-connector
                    onPointerDownCapture={startLinkingFromOutput({ type: "upload", id: upload.id, port: 0 })}
                    onPointerDown={startLinkingFromOutput({ type: "upload", id: upload.id, port: 0 })}
                    onPointerEnter={handleOutputEnter({ type: "upload", id: upload.id, port: 0 })}
                    onPointerLeave={handleOutputLeave({ type: "upload", id: upload.id, port: 0 })}
                    onPointerMove={moveLinking}
                    onPointerUp={() => finalizeLinking()}
                  >
                    <HandleDot />
                  </div>
                </div>
              );
            })}
            {outputs.map((output) => {
              const isActive = selected?.type === "output" && selected.id === output.id;
              const isDragging = draggingOutputId === output.id;
              const handles = getOutputHandles(output);
              const showHandles =
                isActive ||
                isDragging ||
                hoveredOutputId === output.id ||
                Boolean(linking);
              return (
                <div
                  key={output.id}
                  className="absolute"
                  style={{ left: output.x, top: output.y }}
                  onPointerEnter={() => setHoveredOutputId(output.id)}
                  onPointerLeave={() =>
                    setHoveredOutputId((prev) => (prev === output.id ? null : prev))
                  }
                >
                  <div
                    className={`relative rounded-xl border border-slate-200 bg-white/90 p-4 shadow-md backdrop-blur-sm transition-all duration-150 ${
                      isActive ? "ring-2 ring-amber-300" : ""
                    } ${isDragging ? "scale-[1.01]" : "scale-[0.98]"} cursor-grab active:cursor-grabbing select-none flex flex-col gap-3`}
                    data-output
                    style={{ width: handles.width, height: handles.height }}
                    onPointerDown={handleOutputPointerDown(output.id)}
                    onPointerMove={handleOutputPointerMove(output.id)}
                    onPointerUp={handleOutputPointerUp(output.id)}
                  >
                    <button
                      className={`absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                      }`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={() => handleRemoveOutput(output.id)}
                      aria-label="Remove output block"
                    >
                      ×
                    </button>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{output.name}</p>
                        <p className="text-xs text-slate-600">Describe the final response shape</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                        Sink
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 flex flex-col gap-2">
                      <p className="text-[11px] font-semibold text-slate-800 mb-2">Output format</p>
                      <textarea
                        className="w-full rounded-md border border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none min-h-[88px]"
                        rows={3}
                        value={output.format}
                        onChange={handleOutputFormatChange(output.id)}
                        spellCheck={false}
                        data-output-control
                        onBlur={handleOutputFormatBlur(output.id)}
                      />
                    </div>
                  </div>
                  <div
                    className={`absolute flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                      showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
                    }`}
                    style={{
                      top: handles.input.y - output.y - 12,
                      left: handles.input.x - output.x - 12,
                      width: 24,
                      height: 24,
                      pointerEvents: "auto",
                    }}
                    data-input
                    data-connector
                    onPointerDownCapture={startLinkingFromInput({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerEnter={handleInputEnter({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerLeave={handleInputLeave({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerDown={startLinkingFromInput({ type: "output", id: output.id, inputIndex: 0 })}
                    onPointerUp={() =>
                      finalizeLinking({
                        type: "output",
                        id: output.id,
                        inputIndex: 0,
                      })
                    }
                  >
                    <HandleDot />
                  </div>
                </div>
              );
            })}
            {tools.map((tool) => {
              const isActive = selected?.type === "tool" && selected.id === tool.id;
              const isDragging = draggingToolId === tool.id;
              const handles = getToolHandles(tool);
              const width = handles.width;
              const height = handles.height;
              const showHandles =
                isActive ||
                isDragging ||
                hoveredToolId === tool.id ||
                (linking?.origin === "output" && linking.from.id === tool.id) ||
                (linking?.origin === "input" && linking.target.id === tool.id) ||
                (linking
                  ? Math.hypot(linking.current.x - (tool.x + width / 2), linking.current.y - (tool.y + height / 2)) < 140
                  : false);
              return (
                <div
                  key={tool.id}
                  className="absolute"
                  style={{ left: tool.x, top: tool.y }}
                  onPointerEnter={() => setHoveredToolId(tool.id)}
                  onPointerLeave={() =>
                    setHoveredToolId((prev) => (prev === tool.id ? null : prev))
                  }
                >
                  <div
                    className={`relative overflow-visible ${isActive ? "ring-2 ring-offset-2 ring-offset-white shadow-lg" : ""} ${
                      isDragging ? "scale-[1.01]" : ""
                    } cursor-grab active:cursor-grabbing select-none`}
                    data-tool
                    style={{ width, height }}
                    onPointerDown={handleToolPointerDown(tool.id)}
                    onPointerMove={handleToolPointerMove(tool.id)}
                    onPointerUp={handleToolPointerUp(tool.id)}
                  >
                    <div
                      className={`absolute inset-0 rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition-all duration-150 pointer-events-none`}
                    />
                    <div className="relative h-full w-full flex flex-col items-center justify-center px-4 text-center gap-2">
                      <button
                        className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                          isActive ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none"
                        }`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onClick={() => handleRemoveTool(tool.id)}
                        aria-label="Remove tool"
                      >
                        ×
                      </button>
                      <p className="text-base font-semibold text-slate-900">{tool.name}</p>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalToolId(tool.id);
                          }}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                    <div
                      className={`absolute left-1/2 -top-4 -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
                        showHandles ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      }`}
                      style={{ top: handles.output.y - tool.y - 16, pointerEvents: "auto" }}
                      data-output
                      data-input
                      data-connector
                      onPointerDown={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
                      onPointerDownCapture={startLinkingFromOutput({ type: "tool", id: tool.id, port: 0 })}
                      onPointerEnter={handleOutputEnter({ type: "tool", id: tool.id, port: 0 })}
                      onPointerLeave={handleOutputLeave({ type: "tool", id: tool.id, port: 0 })}
                      onPointerMove={moveLinking}
                      onPointerUp={() => finalizeLinking({ type: "tool", id: tool.id })}
                    >
                      <HandleDot />
                    </div>
                  </div>
                </div>
              );
            })}
            {notes.map((note) => (
              <div
                key={note.id}
                className="absolute"
                style={{ left: note.x, top: note.y }}
              >
                <div
                  className={`relative w-48 rounded border border-yellow-200 bg-yellow-100/90 p-3 shadow ${
                    draggingNoteId === note.id || (selected?.type === "note" && selected.id === note.id)
                      ? "ring-2 ring-yellow-300"
                      : ""
                  } cursor-grab active:cursor-grabbing select-none`}
                  data-note
                  onPointerDown={handleNotePointerDown(note.id)}
                  onPointerMove={handleNotePointerMove(note.id)}
                  onPointerUp={handleNotePointerUp(note.id)}
                >
                  <button
                    className={`absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-xs shadow-md transition-all duration-150 ${
                      selected?.type === "note" && selected.id === note.id
                        ? "scale-100 opacity-100"
                        : "scale-75 opacity-0 pointer-events-none"
                    }`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={() => handleRemoveNote(note.id)}
                    aria-label="Remove note"
                  >
                    ×
                  </button>
                  <div className="text-sm font-semibold text-slate-800">
                    {note.text}
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    Add your quick reminder here.
                  </p>
                </div>
              </div>
            ))}
            <div style={{ padding: 40 }}>
              {/* canvas placeholder card removed per request */}
            </div>
          </div>
        </div>
      </main>
      {(showStart || startExiting) && (
        <div
          className={`absolute inset-0 z-40 transition-opacity duration-500 ease-out ${
            showStart && !startExiting ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{
            background:
              theme === "dark"
                ? "radial-gradient(120% 140% at 25% 18%, rgba(15,23,42,0.2), rgba(15,23,42,0)), radial-gradient(120% 140% at 80% 75%, rgba(255,255,255,0.04), rgba(255,255,255,0)), linear-gradient(135deg, #0f172a 0%, #0b1224 52%, #0f172a 100%)"
                : "radial-gradient(120% 140% at 25% 18%, rgba(0,0,0,0.05), rgba(0,0,0,0)), radial-gradient(120% 140% at 80% 75%, rgba(15,23,42,0.08), rgba(15,23,42,0)), linear-gradient(135deg, #f8f5ed 0%, #f2ede4 52%, #ebe6de 100%)",
          }}
        >
          <div className="relative w-full h-full">
            <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-emerald-100 blur-3xl opacity-60 pointer-events-none" />
            <div
              className={`absolute -bottom-12 -left-12 h-28 w-28 rounded-full blur-3xl opacity-40 pointer-events-none ${
                theme === "dark" ? "bg-slate-800" : "bg-slate-200"
              }`}
            />  {/* title */}
            <div className="absolute top-1/2 left-[48.5%] -translate-y-1/2">
              <div className="flex flex-col items-start gap-4">
                {[
                  { letter: "C", word: "" },
                  { letter: "3", word: "" },
                  { letter: "A", word: "" },
                  { letter: "N", word: "" },
                ].map((item, idx) => (
                  <div
                    key={item.letter}
                    className="flex items-center gap-4 letter-cycle"
                    style={{
                      animationDelay: `${0.6 + idx * 1.5}s`,
                      animationDuration: "8s",
                      fontFamily: "'Playfair Display', 'Times New Roman', serif",
                    }}
                  >
                    <span
                      className={`text-6xl font-black leading-none tracking-tight ${
                        theme === "dark" ? "text-slate-100" : "text-slate-800"
                      }`}
                    >
                      {item.letter}
                    </span>
                    <span
                      className={`text-lg font-semibold tracking-wide uppercase ${
                        theme === "dark" ? "text-slate-200" : "text-slate-600"
                      }`}
                    >
                      {item.word}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-16">
              <button
                className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg shadow-slate-300/60 ${
                  theme === "dark"
                    ? "bg-white text-slate-900 hover:bg-slate-100"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
                onClick={handleEnterWorkspace}
              >
                Enter workspace
              </button>
            </div>
          </div>
        </div>
      )}
      {modalBlockId && (() => {
        const block = blocks.find((b) => b.id === modalBlockId);
        if (!block) return null;
        const inbound = connections.filter((c) => c.to.type === "block" && c.to.id === block.id);
        const outbound = connections.filter((c) => c.from.type === "block" && c.from.id === block.id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModalBlockId(null)}>
            <div
              className="relative w-[520px] max-h-[80vh] overflow-visible rounded-xl bg-white shadow-2xl border border-slate-200 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -right-5 -top-5 z-[9999]">
                <button
                  className="h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg"
                  onClick={() => setModalBlockId(null)}
                >
                  ×
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{block.name}</p>
                  <p className="text-sm text-slate-600">Mode: {getBlockMode(block)}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Agent
                </span>
              </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Inputs</p>
                      <div className="mt-2 space-y-1.5">
                        {Array.from({ length: block.inputCount }, (_, idx) => {
                          const isMandatory = idx < (block.mandatoryInputCount ?? 0);
                          const isRequired = block.inputRequired[idx];
                          return (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm text-black">
                        <div className="flex items-center gap-2 text-black flex-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          <span className="text-black truncate">{block.inputNames?.[idx] ?? `Input ${idx + 1}`}</span>
                          {isMandatory && (
                            <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">Required</span>
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isRequired}
                            disabled={isMandatory}
                            onChange={() => toggleInputRequired(block.id, idx)}
                            className={`h-4 w-4 rounded border-2 ${
                              isMandatory
                                ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                                : "border-slate-300 cursor-pointer"
                            }`}
                          />
                          <span className={`text-[11px] font-semibold ${
                            isMandatory ? "text-rose-600" : "text-slate-600"
                          }`}>
                            {isMandatory ? "Mandatory" : "Optional"}
                          </span>
                        </label>
                      </div>
                          );
                        })}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Outputs</p>
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: block.outputCount }, (_, idx) => {
                      const isMandatory = idx < (block.mandatoryOutputCount ?? 0);
                      const isRequired = block.outputRequired[idx];
                      return (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm text-black">
                        <div className="flex items-center gap-2 text-black flex-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                          <span className="text-black truncate">{block.outputNames?.[idx] ?? `Output ${idx + 1}`}</span>
                          {isMandatory && (
                            <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">Required</span>
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isRequired}
                            disabled={isMandatory}
                            onChange={() => toggleOutputRequired(block.id, idx)}
                            className={`h-4 w-4 rounded border-2 ${
                              isMandatory
                                ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                                : "border-slate-300 cursor-pointer"
                            }`}
                          />
                          <span className={`text-[11px] font-semibold ${
                            isMandatory ? "text-rose-600" : "text-slate-600"
                          }`}>
                            {isMandatory ? "Mandatory" : "Optional"}
                          </span>
                        </label>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Inbound</p>
                  <div className="space-y-1 text-sm text-slate-700">
                    {inbound.length === 0 && <p className="text-xs text-slate-500">No incoming links.</p>}
                    {inbound.map((c) => (
                      <p key={c.id}>
                        {c.from.type} → input {c.to.inputIndex ?? 0}
                      </p>
                    ))}
                  </div>
                </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Outbound</p>
                <div className="space-y-1 text-sm text-slate-700">
                      {outbound.length === 0 && <p className="text-xs text-slate-500">No outgoing links.</p>}
                  {outbound.map((c) => (
                    <p key={c.id}>
                      port {c.from.port} → {c.to.type}
                    </p>
                  ))}
                </div>
              </div>
            </div>
              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Attach tool</p>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    value={modalToolChoice}
                    onChange={(e) => setModalToolChoice(e.target.value)}
                  >
                    {toolPalette.map((tool) => (
                      <option key={tool.name} value={tool.name}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                    onClick={() => {
                      if (modalToolChoice) addToolToBlock(block.id, modalToolChoice);
                    }}
                  >
                    Add tool
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-600">Tool will be placed below this agent and linked to its bottom port.</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tool Details Modal */}
      {modalToolId && (() => {
        const tool = tools.find((t) => t.id === modalToolId);
        if (!tool) return null;
        const inbound = connections.filter((c) => c.to.type === "tool" && c.to.id === tool.id);
        const outbound = connections.filter((c) => c.from.type === "tool" && c.from.id === tool.id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setModalToolId(null)}>
            <div
              className="relative w-[520px] max-h-[80vh] overflow-visible rounded-xl bg-white shadow-2xl border border-slate-200 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -right-5 -top-5 z-[9999]">
                <button
                  className="h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg"
                  onClick={() => setModalToolId(null)}
                >
                  ×
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{tool.name}</p>
                  <p className="text-sm text-slate-600">{tool.tagline}</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Tool
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Inputs</p>
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: tool.inputCount }, (_, idx) => {
                      const isMandatory = idx < (tool.mandatoryInputCount ?? 0);
                      const isRequired = tool.inputRequired[idx];
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 text-sm text-black">
                          <div className="flex items-center gap-2 text-black flex-1">
                            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                            <span className="text-black truncate">{tool.inputNames?.[idx] ?? `Input ${idx + 1}`}</span>
                            {isMandatory && (
                              <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">Required</span>
                            )}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isRequired}
                              disabled={isMandatory}
                              onChange={() => toggleToolInputRequired(tool.id, idx)}
                              className={`h-4 w-4 rounded border-2 ${
                                isMandatory
                                  ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                                  : "border-slate-300 cursor-pointer"
                              }`}
                            />
                            <span className={`text-[11px] font-semibold ${
                              isMandatory ? "text-rose-600" : "text-slate-600"
                            }`}>
                              {isMandatory ? "Mandatory" : "Optional"}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Outputs</p>
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: tool.outputCount }, (_, idx) => {
                      const isMandatory = idx < (tool.mandatoryOutputCount ?? 0);
                      const isRequired = tool.outputRequired[idx];
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 text-sm text-black">
                          <div className="flex items-center gap-2 text-black flex-1">
                            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                            <span className="text-black truncate">{tool.outputNames?.[idx] ?? `Output ${idx + 1}`}</span>
                            {isMandatory && (
                              <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">Required</span>
                            )}
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isRequired}
                              disabled={isMandatory}
                              onChange={() => toggleToolOutputRequired(tool.id, idx)}
                              className={`h-4 w-4 rounded border-2 ${
                                isMandatory
                                  ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                                  : "border-slate-300 cursor-pointer"
                              }`}
                            />
                            <span className={`text-[11px] font-semibold ${
                              isMandatory ? "text-rose-600" : "text-slate-600"
                            }`}>
                              {isMandatory ? "Mandatory" : "Optional"}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Inbound</p>
                  <div className="space-y-1 text-sm text-slate-700">
                    {inbound.length === 0 && <p className="text-xs text-slate-500">No incoming links.</p>}
                    {inbound.map((c) => (
                      <p key={c.id}>
                        {c.from.type} → input {c.to.inputIndex ?? 0}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Outbound</p>
                  <div className="space-y-1 text-sm text-slate-700">
                    {outbound.length === 0 && <p className="text-xs text-slate-500">No outgoing links.</p>}
                    {outbound.map((c) => (
                      <p key={c.id}>
                        port {c.from.port} → {c.to.type}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Evals Modal */}
      {showEvalsModal && (() => {
        const categories = Array.from(new Set(evalOptions.map((opt) => opt.category)));
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowEvalsModal(false)}
          >
            <div
              className="relative w-[680px] max-h-[85vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-slate-200 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -right-5 -top-5 z-[9999]">
                <button
                  className="h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg"
                  onClick={() => setShowEvalsModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Evaluation Metrics</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Select metrics to monitor agent performance and quality
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    {selectedEvals.length} Selected
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                {categories.map((category) => {
                  const categoryOptions = evalOptions.filter((opt) => opt.category === category);
                  const categoryColor = 
                    category === "Performance" ? "emerald" :
                    category === "Quality" ? "sky" :
                    category === "Safety" ? "rose" :
                    "amber";
                  
                  return (
                    <div key={category} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`h-2.5 w-2.5 rounded-full bg-${categoryColor}-500`} />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                          {category}
                        </h3>
                      </div>
                      
                      <div className="space-y-2">
                        {categoryOptions.map((option) => {
                          const isSelected = selectedEvals.includes(option.id);
                          return (
                            <label
                              key={option.id}
                              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? `bg-${categoryColor}-50 border border-${categoryColor}-200`
                                  : "bg-slate-50 border border-transparent hover:border-slate-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleEval(option.id)}
                                className="mt-0.5 h-4 w-4 rounded border-2 border-slate-300 cursor-pointer"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className={`text-sm font-semibold ${
                                    isSelected ? `text-${categoryColor}-900` : "text-slate-800"
                                  }`}>
                                    {option.name}
                                  </span>
                                  {isSelected && (
                                    <span className={`text-[10px] font-semibold uppercase tracking-wide text-${categoryColor}-600`}>
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  {option.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <button
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setSelectedEvals([])}
                >
                  Clear All
                </button>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setShowEvalsModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                    onClick={() => setShowEvalsModal(false)}
                  >
                    Apply Metrics
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="absolute bottom-3 right-4 z-20 text-xs font-semibold text-slate-400">
        © 2025 All rights reserved
      </div>
    </div>
  );
}
