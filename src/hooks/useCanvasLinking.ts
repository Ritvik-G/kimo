import { useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  AgentBlock,
  Connection,
  LinkSource,
  LinkTarget,
  ToolNode,
  LinkingState,
} from "../shared/types";
import { TOOL_PORT_OFFSET } from "../shared/constants";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useCanvasLinking(args: {
  blocks: AgentBlock[];
  tools: ToolNode[];
  linking: LinkingState;
  hoveredBlockId: string | null;
  hoveredInput: LinkTarget | null;
  hoveredOutput: LinkSource | null;
  setLinking: SetState<LinkingState>;
  setHoveredInput: SetState<LinkTarget | null>;
  setHoveredOutput: SetState<LinkSource | null>;
  setConnections: SetState<Connection[]>;
  setBlocks: SetState<AgentBlock[]>;
  recalcBlockPorts: (connections: Connection[], blocks: AgentBlock[]) => AgentBlock[];
  linkingRef: React.MutableRefObject<boolean>;
  nextConnectionIdRef: React.MutableRefObject<number>;
  getBlockHandles: (block: AgentBlock) => {
    inputAnchors: { x: number; y: number }[];
    outputAnchors: { x: number; y: number }[];
    toolAnchors: { anchor: { x: number; y: number }; slot: number }[];
  };
  getToolHandles: (tool: ToolNode) => { output: { x: number; y: number }; input: { x: number; y: number } };
  toWorldPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
}) {
  const {
    blocks,
    getBlockHandles,
    getToolHandles,
    hoveredBlockId,
    hoveredInput,
    hoveredOutput,
    linking,
    linkingRef,
    nextConnectionIdRef,
    recalcBlockPorts,
    setBlocks,
    setConnections,
    setHoveredInput,
    setHoveredOutput,
    setLinking,
    tools,
    toWorldPoint,
  } = args;

  const getOutputAnchor = useCallback(
    (endpoint: LinkSource) => {
      if (endpoint.type === "block") {
        const block = blocks.find((b) => b.id === endpoint.id);
        if (!block) return null;
        const handles = getBlockHandles(block);
        const index = Math.min(handles.outputAnchors.length - 1, Math.max(0, endpoint.port));
        return handles.outputAnchors[index];
      }
      if (endpoint.type === "tool") {
        const tool = tools.find((t) => t.id === endpoint.id);
        return tool ? getToolHandles(tool).output : null;
      }
      return null;
    },
    [blocks, getBlockHandles, getToolHandles, tools]
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
        const boundedIndex = Math.min(handles.inputAnchors.length - 1, Math.max(0, inputIndex));
        return handles.inputAnchors[boundedIndex];
      }
      if (target.type === "tool") {
        const tool = tools.find((t) => t.id === target.id);
        return tool ? getToolHandles(tool).input : null;
      }
      return null;
    },
    [blocks, getBlockHandles, getToolHandles, tools]
  );

  const handleConnectionPointerDown = useCallback(
    (conn: Connection) => (e: ReactPointerEvent<SVGPathElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const isDouble = e.detail >= 2;
      setConnections((prev) => {
        const next = prev.filter((c) => c.id !== conn.id);
        setBlocks((state) => recalcBlockPorts(next, state));
        return next;
      });

      if (isDouble) {
        const anchor = getOutputAnchor(conn.from);
        const world = toWorldPoint(e.clientX, e.clientY);
        const currentPoint = world ?? anchor ?? { x: 0, y: 0 };
        linkingRef.current = true;
        setLinking({ origin: "output", from: conn.from, current: currentPoint });
        setHoveredInput(null);
        setHoveredOutput(null);
      }
    },
    [
      getOutputAnchor,
      linkingRef,
      recalcBlockPorts,
      setBlocks,
      setConnections,
      setHoveredInput,
      setHoveredOutput,
      setLinking,
      toWorldPoint,
    ]
  );

  const startLinkingFromInput = useCallback(
    (target: LinkTarget) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.detail >= 2) return;
      setHoveredInput(null);
      setHoveredOutput(null);
      const anchor = getInputAnchor(target);
      if (!anchor) return;
      linkingRef.current = true;
      setLinking({ origin: "input", target, current: anchor });
    },
    [getInputAnchor, linkingRef, setHoveredInput, setHoveredOutput, setLinking]
  );

  const startLinkingFromOutput = useCallback(
    (from: LinkSource) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.detail >= 2) return;
      setHoveredInput(null);
      setHoveredOutput(null);

      if (from.type === "block") {
        const sourceBlock = blocks.find((b) => b.id === from.id);
        if (!sourceBlock) return;

        const enabledPorts = (sourceBlock.outputRequired ?? [])
          .map((enabled, idx) => (enabled ? idx : null))
          .filter((idx): idx is number => typeof idx === "number");

        if (enabledPorts.length === 0) return;
        if (!enabledPorts.includes(from.port)) return;
      }

      const anchor = getOutputAnchor(from);
      if (!anchor) return;
      linkingRef.current = true;
      setLinking({ origin: "output", from, current: anchor });
    },
    [blocks, getOutputAnchor, linkingRef, setHoveredInput, setHoveredOutput, setLinking]
  );

  const moveLinking = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!linking) return;
      const world = toWorldPoint(e.clientX, e.clientY);
      if (!world) return;
      setLinking((prev) => (prev ? { ...prev, current: world } : prev));
    },
    [linking, setLinking, toWorldPoint]
  );

  const finalizeLinking = useCallback(
    (overrideTarget?: LinkTarget) => {
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

      if (target && from && !(target.type === from.type && target.id === from.id)) {
        const normalizedTarget: LinkTarget =
          target.type === "block" && (target.inputIndex ?? 0) < TOOL_PORT_OFFSET
            ? { ...target, inputIndex: target.inputIndex ?? 0 }
            : target;

        const isToolPortTarget =
          normalizedTarget.type === "block" && (normalizedTarget.inputIndex ?? 0) >= TOOL_PORT_OFFSET;
        if (isToolPortTarget && from.type !== "tool") {
          setLinking(null);
          linkingRef.current = false;
          return;
        }
        if (
          from.type === "tool" &&
          normalizedTarget.type === "block" &&
          (normalizedTarget.inputIndex ?? 0) < TOOL_PORT_OFFSET
        ) {
          setLinking(null);
          linkingRef.current = false;
          return;
        }

        const id = nextConnectionIdRef.current++;
        setConnections((prev) => {
          const base =
            from.type === "tool"
              ? prev.filter((c) => !(c.from.type === "tool" && c.from.id === from.id))
              : prev;

          const finalTarget = normalizedTarget;

          const isDuplicate = base.some(
            (conn) =>
              conn.from.type === from.type &&
              conn.from.id === from.id &&
              conn.from.port === from.port &&
              conn.to.type === finalTarget.type &&
              conn.to.id === finalTarget.id &&
              (conn.to.inputIndex ?? 0) === (finalTarget.inputIndex ?? 0)
          );
          if (isDuplicate) return prev;

          const next = [...base, { id: `conn-${id}`, from, to: finalTarget }];
          setBlocks((state) => recalcBlockPorts(next, state));
          return next;
        });
      }

      setLinking(null);
      linkingRef.current = false;
      setHoveredInput(null);
      setHoveredOutput(null);
    },
    [
      hoveredBlockId,
      hoveredInput,
      hoveredOutput,
      linking,
      linkingRef,
      nextConnectionIdRef,
      recalcBlockPorts,
      setBlocks,
      setConnections,
      setHoveredInput,
      setHoveredOutput,
      setLinking,
    ]
  );

  return {
    getOutputAnchor,
    getInputAnchor,
    handleConnectionPointerDown,
    startLinkingFromInput,
    startLinkingFromOutput,
    moveLinking,
    finalizeLinking,
  };
}
