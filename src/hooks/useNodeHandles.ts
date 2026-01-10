import { useCallback } from "react";
import type { AgentBlock, AnchorPoint, BlockHandles, Connection, LinkingState, ToolHandles, ToolNode } from "../shared/types";
import { MAX_IO, TOOL_PORT_OFFSET } from "../shared/constants";

export function useNodeHandles(args: {
  connections: Connection[];
  linking: LinkingState;
  hoveredBlockId: string | null;
}) {
  const getBlockHandles = useCallback(
    (block: AgentBlock): BlockHandles => {
      const width = 220;
      const lastRequiredInputIndex = Math.max(
        block.inputRequired?.lastIndexOf(true) ?? -1,
        (block.mandatoryInputCount ?? 0) - 1
      );
      const lastRequiredOutputIndex = Math.max(
        block.outputRequired?.lastIndexOf(true) ?? -1,
        (block.mandatoryOutputCount ?? 0) - 1
      );

      const baseInputs = Math.max(1, lastRequiredInputIndex + 1);
      const baseOutputs = Math.max(1, lastRequiredOutputIndex + 1);

      const maxConnectedInput = args.connections
        .filter(
          (conn) =>
            conn.to.type === "block" &&
            conn.to.id === block.id &&
            (conn.to.inputIndex ?? -1) < TOOL_PORT_OFFSET
        )
        .reduce((max, conn) => Math.max(max, conn.to.inputIndex ?? 0), -1);

      const hasToolConnection = args.connections.some(
        (conn) =>
          conn.to.type === "block" &&
          conn.to.id === block.id &&
          (conn.to.inputIndex ?? -1) >= TOOL_PORT_OFFSET
      );

      const maxConnectedOutput = args.connections
        .filter((conn) => conn.from.type === "block" && conn.from.id === block.id)
        .reduce((max, conn) => Math.max(max, conn.from.port), -1);

      const desiredInputs = Math.max(baseInputs, maxConnectedInput + 1);
      const inputSlots = Math.min(MAX_IO, desiredInputs);

      const desiredOutputs = Math.max(baseOutputs, maxConnectedOutput + 1);
      const outputSlots = Math.min(MAX_IO, desiredOutputs);

      const hoverIsOnBottom =
        args.linking?.origin === "output" && args.linking.from.type === "tool" && args.hoveredBlockId === block.id;
      const toolSlots = hasToolConnection ? 1 : hoverIsOnBottom ? 1 : 0;

      const baseHeight = 120;
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

      const buildBottomAnchors = (count: number) =>
        Array.from({ length: Math.max(0, count) }, (_, idx) => ({
          anchor: { x: block.x + width / 2 + 4, y: block.y + height, dir: "down" as const },
          slot: TOOL_PORT_OFFSET + idx,
        }));

      return {
        width,
        height,
        inputAnchors: buildAnchors(inputSlots, "left"),
        outputAnchors: buildAnchors(outputSlots, "right"),
        toolAnchors: buildBottomAnchors(toolSlots),
      };
    },
    [args.connections, args.hoveredBlockId, args.linking]
  );

  const getToolHandles = useCallback(
    (tool: ToolNode): ToolHandles => {
      const width = 180;
      const height = 110;
      const output: AnchorPoint = {
        x: tool.x + width / 2,
        y: tool.y - 6,
        dir: "up",
      };
      return { width, height, output, input: output };
    },
    []
  );

  return { getBlockHandles, getToolHandles };
}
