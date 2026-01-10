import { useCallback } from "react";
import type { AgentBlock, Connection, ToolNode, ToolPreset } from "../shared/types";
import { clamp, clampNames, resizeRequired } from "../shared/utils";
import { MAX_IO, MIN_IO, TOOL_PORT_OFFSET } from "../shared/constants";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useBlockIO(args: {
  blocks: AgentBlock[];
  toolPalette: ToolPreset[];
  setBlocks: SetState<AgentBlock[]>;
  setTools: SetState<ToolNode[]>;
  setConnections: SetState<Connection[]>;
  getBlockHandles: (block: AgentBlock) => { width: number; height: number };
  nextToolIdRef: React.MutableRefObject<number>;
  nextConnectionIdRef: React.MutableRefObject<number>;
  recalcBlockPorts: (connections: Connection[], blocks: AgentBlock[]) => AgentBlock[];
}) {
  const {
    blocks,
    toolPalette,
    setBlocks,
    setTools,
    setConnections,
    getBlockHandles,
    nextToolIdRef,
    nextConnectionIdRef,
    recalcBlockPorts,
  } = args;

  const addToolToBlock = useCallback(
    (blockId: string, toolName: string) => {
      const block = blocks.find((b) => b.id === blockId);
      const palette = toolPalette.find((t) => t.name === toolName);
      if (!block || !palette) return;

      const handles = getBlockHandles(block);
      const toolWidth = 180;
      const toolId = `tool-${nextToolIdRef.current++}`;
      const toolX = block.x + handles.width / 2 - toolWidth / 2;
      const toolY = block.y + handles.height + 60;
      const newTool = { ...palette, id: toolId, x: toolX, y: toolY };

      setTools((prev) => [...prev, newTool]);
      const connId = `conn-${nextConnectionIdRef.current++}`;
      setConnections((prev) => {
        const next: Connection[] = [
          ...prev,
          {
            id: connId,
            from: { type: "tool", id: toolId, port: 0 },
            to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
          },
        ];
        setBlocks((state) => recalcBlockPorts(next, state));
        return next;
      });
    },
    [blocks, getBlockHandles, nextConnectionIdRef, nextToolIdRef, recalcBlockPorts, setBlocks, setConnections, setTools, toolPalette]
  );

  const applyBlockIO = useCallback(
    (blockId: string, nextInputCount: number, nextOutputCount: number) => {
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
                presetId: "custom",
              }
            : b
        )
      );

      setConnections((prev) => {
        let next = prev.filter(
          (conn) => !(conn.from.type === "block" && conn.from.id === blockId && conn.from.port >= newOutputs)
        );
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
    [setBlocks, setConnections]
  );

  const changeBlockInputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      applyBlockIO(blockId, block.inputCount + delta, block.outputCount);
    },
    [applyBlockIO, blocks]
  );

  const changeBlockOutputs = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      applyBlockIO(blockId, block.inputCount, block.outputCount + delta);
    },
    [applyBlockIO, blocks]
  );

  return { addToolToBlock, changeBlockInputs, changeBlockOutputs };
}
