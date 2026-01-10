import { useCallback } from "react";
import type { DragEvent } from "react";
import type { AgentBlock, AgentRegistryEntry, ToolPreset, ToolNode } from "../shared/types";
import { getAgentRegistryEntryById } from "../shared/constants";
import { buildIoFromStreams } from "../shared/planning/workflowIO";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useCanvasDrop(args: {
  availableAgents: AgentRegistryEntry[];
  toolPalette: ToolPreset[];
  nextBlockIdRef: React.MutableRefObject<number>;
  nextToolIdRef: React.MutableRefObject<number>;
  setBlocks: SetState<AgentBlock[]>;
  setTools: SetState<ToolNode[]>;
  toWorldPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
}) {
  const {
    availableAgents,
    toolPalette,
    nextBlockIdRef,
    nextToolIdRef,
    setBlocks,
    setTools,
    toWorldPoint,
  } = args;

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/json");
      if (!raw) return;

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }

      if (typeof payload !== "object" || payload === null) return;

      const world = toWorldPoint(event.clientX, event.clientY);
      if (!world) return;

      const record = payload as Record<string, unknown>;
      if (record.type === "agent-block") {
        const agentId = typeof record.agentId === "string" ? record.agentId : "";
        const agent =
          getAgentRegistryEntryById(agentId, availableAgents) ??
          (availableAgents.length ? availableAgents[0] : null);

        const io = agent
          ? buildIoFromStreams({
              input: agent.input_data_streams,
              output: agent.output_data_streams,
            })
          : {
              inputCount: 1,
              outputCount: 1,
              mandatoryInputCount: 0,
              mandatoryOutputCount: 0,
              inputRequired: [false],
              outputRequired: [false],
              inputNames: [],
              outputNames: [],
            };

        const id = nextBlockIdRef.current++;
        setBlocks((prev) => [
          ...prev,
          {
            id: `block-${id}`,
            x: world.x,
            y: world.y,
            agentId: agent?.id,
            name: agent?.name ?? "Agent Block",
            description: agent?.description ?? "",
            inputCount: io.inputCount,
            outputCount: io.outputCount,
            inputRequired: io.inputRequired,
            outputRequired: io.outputRequired,
            inputNames: io.inputNames,
            outputNames: io.outputNames,
            presetId: agent?.id ?? "custom",
            mandatoryInputCount: io.mandatoryInputCount,
            mandatoryOutputCount: io.mandatoryOutputCount,
          },
        ]);
        return;
      }

      if (record.type === "tool") {
        const name = typeof record.name === "string" ? record.name : "";
        const paletteItem = toolPalette.find((t) => t.name === name);
        if (!paletteItem) return;
        const id = nextToolIdRef.current++;
        setTools((prev) => [...prev, { ...paletteItem, id: `tool-${id}`, x: world.x, y: world.y }]);
      }
    },
    [availableAgents, nextBlockIdRef, nextToolIdRef, setBlocks, setTools, toWorldPoint, toolPalette]
  );

  return { handleCanvasDragOver, handleCanvasDrop };
}
