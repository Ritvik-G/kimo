// =============================================================================
// useWorkspace Hook - Manages workspace state and persistence
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentBlock,
  ToolNode,
  Connection,
  Selection,
  ClipboardItem,
  Theme,
  PanelKey,
  LinkingState,
  LinkSource,
} from "../shared/types";
import {
  STORAGE_KEY,
  MIN_IO,
  MAX_IO,
  TOOL_PORT_OFFSET,
} from "../shared/constants";
import { clamp, clampNames, resizeRequired } from "../shared/utils";

type WorkspaceSnapshot = {
  blocks: AgentBlock[];
  tools: ToolNode[];
  connections: Connection[];
  theme: Theme;
  nextBlockId: number;
  nextToolId: number;
  nextConnectionId: number;
};

function readWorkspaceSnapshot(): WorkspaceSnapshot | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;

    const blocks = Array.isArray(obj["blocks"]) ? (obj["blocks"] as AgentBlock[]) : [];
    const tools = Array.isArray(obj["tools"]) ? (obj["tools"] as ToolNode[]) : [];
    const connections = Array.isArray(obj["connections"]) ? (obj["connections"] as Connection[]) : [];
    const theme = obj["theme"] === "light" || obj["theme"] === "dark" ? (obj["theme"] as Theme) : "dark";

    const nextBlockId = typeof obj["nextBlockId"] === "number" ? (obj["nextBlockId"] as number) : 1;
    const nextToolId = typeof obj["nextToolId"] === "number" ? (obj["nextToolId"] as number) : 1;
    const nextConnectionId = typeof obj["nextConnectionId"] === "number" ? (obj["nextConnectionId"] as number) : 1;

    return { blocks, tools, connections, theme, nextBlockId, nextToolId, nextConnectionId };
  } catch {
    return null;
  }
}

export function useWorkspace() {
  const initialSnapshot = useMemo(() => readWorkspaceSnapshot(), []);

  // Refs for ID counters
  const nextBlockIdRef = useRef(initialSnapshot?.nextBlockId ?? 1);
  const nextToolIdRef = useRef(initialSnapshot?.nextToolId ?? 1);
  const nextConnectionIdRef = useRef(initialSnapshot?.nextConnectionId ?? 1);

  // Main state
  const [blocks, setBlocks] = useState<AgentBlock[]>(() => initialSnapshot?.blocks ?? []);
  const [tools, setTools] = useState<ToolNode[]>(() => initialSnapshot?.tools ?? []);
  const [connections, setConnections] = useState<Connection[]>(() => initialSnapshot?.connections ?? []);
  const [theme, setTheme] = useState<Theme>(() => initialSnapshot?.theme ?? "dark");
  const [userThemeLocked, setUserThemeLocked] = useState(false);
  const [selectedEvals, setSelectedEvals] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  // Linking state
  const [linking, setLinking] = useState<LinkingState>(null);
  const linkingRef = useRef(false);
  const [hoveredInput, setHoveredInput] = useState<{
    type: "block" | "tool" | "output";
    id: string;
    inputIndex?: number;
  } | null>(null);
  const [hoveredOutput, setHoveredOutput] = useState<LinkSource | null>(null);

  // Hover state
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);

  // Dragging state
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);

  // Drag offset refs
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const blockDragOffsetRef = useRef({ x: 0, y: 0 });
  const toolDragOffsetRef = useRef({ x: 0, y: 0 });

  // Modal state
  const [modalBlockId, setModalBlockId] = useState<string | null>(null);
  const [modalToolId, setModalToolId] = useState<string | null>(null);
  const [modalToolChoice, setModalToolChoice] = useState<string>("");
  const [showEvalsModal, setShowEvalsModal] = useState(false);

  // Update linkingRef when linking changes
  useEffect(() => {
    linkingRef.current = Boolean(linking);
  }, [linking]);

  // Save to localStorage
  useEffect(() => {
    const snapshot = {
      blocks,
      tools,
      connections,
      theme,
      nextBlockId: nextBlockIdRef.current,
      nextToolId: nextToolIdRef.current,
      nextConnectionId: nextConnectionIdRef.current,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [blocks, tools, connections, theme]);

  // System theme detection
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = (prefersDark: boolean) => {
      if (userThemeLocked) return;
      setTheme(prefersDark ? "dark" : "light");
    };
    applySystemTheme(media.matches);
    const listener = (event: MediaQueryListEvent) => applySystemTheme(event.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
    // Older browsers
    if (typeof media.addListener === "function") media.addListener(listener);
    return () => {
      if (typeof media.removeListener === "function") media.removeListener(listener);
    };
  }, [userThemeLocked]);

  // Reset workspace
  const resetWorkspace = useCallback((resetZoom?: () => void) => {
    resetZoom?.();
    setBlocks([]);
    setTools([]);
    setConnections([]);
    setLinking(null);
    setHoveredInput(null);
    setHoveredOutput(null);
    setSelected(null);
    setDraggingBlockId(null);
    setDraggingToolId(null);
    setHoveredBlockId(null);
    setHoveredToolId(null);
    dragOffsetRef.current = { x: 0, y: 0 };
    blockDragOffsetRef.current = { x: 0, y: 0 };
    toolDragOffsetRef.current = { x: 0, y: 0 };
    linkingRef.current = false;
    nextBlockIdRef.current = 1;
    nextToolIdRef.current = 1;
    nextConnectionIdRef.current = 1;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Recalculate block ports based on connections
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
          maxOutputs[conn.from.id] = Math.max(
            maxOutputs[conn.from.id] ?? -1,
            conn.from.port
          );
        }
      });
      return blocksState.map((b) => {
        const desiredFromConnectionsInputs = clamp((maxInputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO);
        const desiredFromConnectionsOutputs = clamp((maxOutputs[b.id] ?? -1) + 1, MIN_IO, MAX_IO);

        // IMPORTANT: Do not shrink port counts based purely on current connections.
        // Registry-backed agents (and optional ports toggled in Details) need their full
        // IO surface to remain visible/configurable after upload/import.
        const minInputs = clamp(b.mandatoryInputCount ?? MIN_IO, MIN_IO, MAX_IO);
        const minOutputs = clamp(b.mandatoryOutputCount ?? MIN_IO, MIN_IO, MAX_IO);

        const desiredInputs = Math.max(
          desiredFromConnectionsInputs,
          minInputs,
          clamp(b.inputCount ?? MIN_IO, MIN_IO, MAX_IO)
        );
        const desiredOutputs = Math.max(
          desiredFromConnectionsOutputs,
          minOutputs,
          clamp(b.outputCount ?? MIN_IO, MIN_IO, MAX_IO)
        );

        if (b.inputCount === desiredInputs && b.outputCount === desiredOutputs)
          return b;

        const nextInputRequired = resizeRequired(b.inputRequired, desiredInputs);
        const nextOutputRequired = resizeRequired(b.outputRequired, desiredOutputs);

        // Ensure mandatory ports remain required after any resize.
        for (let i = 0; i < Math.min(minInputs, nextInputRequired.length); i++) nextInputRequired[i] = true;
        for (let i = 0; i < Math.min(minOutputs, nextOutputRequired.length); i++) nextOutputRequired[i] = true;

        return {
          ...b,
          inputCount: desiredInputs,
          outputCount: desiredOutputs,
          inputRequired: nextInputRequired,
          outputRequired: nextOutputRequired,
          inputNames: clampNames(b.inputNames, desiredInputs),
          outputNames: clampNames(b.outputNames, desiredOutputs),
          presetId: "custom",
        };
      });
    },
    []
  );

  // Get block mode based on connections
  const getBlockMode = useCallback(
    (block: AgentBlock) => {
      const inboundSources = new Set(
        connections
          .filter(
            (conn) =>
              conn.to.type === "block" &&
              conn.to.id === block.id &&
              conn.from.type === "block" &&
              (conn.to.inputIndex ?? 0) < TOOL_PORT_OFFSET
          )
          .map((conn) => conn.from.id)
      );

      const outboundTargets = new Set(
        connections
          .filter((conn) => conn.from.type === "block" && conn.from.id === block.id)
          .map((conn) => `${conn.to.type}:${conn.to.id}:${conn.to.inputIndex ?? ""}`)
      );

      const inboundCount = inboundSources.size;
      const outboundCount = outboundTargets.size;

      if (inboundCount > 1) return "aggregate";
      if (outboundCount > 1) return "branch";
      if (inboundCount > 0 && outboundCount > 0) return "sequential";
      if (outboundCount > 0) return "sequential";
      return null;
    },
    [connections]
  );

  return {
    // State
    blocks,
    setBlocks,
    tools,
    setTools,
    connections,
    setConnections,
    theme,
    setTheme,
    userThemeLocked,
    setUserThemeLocked,
    selectedEvals,
    setSelectedEvals,
    clipboard,
    setClipboard,
    selected,
    setSelected,
    activePanel,
    setActivePanel,
    linking,
    setLinking,
    linkingRef,
    hoveredInput,
    setHoveredInput,
    hoveredOutput,
    setHoveredOutput,
    hoveredBlockId,
    setHoveredBlockId,
    hoveredToolId,
    setHoveredToolId,
    draggingBlockId,
    setDraggingBlockId,
    draggingToolId,
    setDraggingToolId,
    dragOffsetRef,
    blockDragOffsetRef,
    toolDragOffsetRef,
    modalBlockId,
    setModalBlockId,
    modalToolId,
    setModalToolId,
    modalToolChoice,
    setModalToolChoice,
    showEvalsModal,
    setShowEvalsModal,
    nextBlockIdRef,
    nextToolIdRef,
    nextConnectionIdRef,

    // Methods
    resetWorkspace,
    recalcBlockPorts,
    getBlockMode,
  };
}
