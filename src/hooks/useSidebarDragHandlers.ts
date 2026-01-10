import { useCallback } from "react";
import type { DragEvent } from "react";
import type { PlanTemplate } from "../shared/types/planning";

export function useSidebarDragHandlers() {
  const handleAgentDragStart = useCallback(
    (agentId: string) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({ type: "agent-block", agentId })
      );
    },
    []
  );

  const handlePlanDragStart = useCallback(
    (template?: PlanTemplate) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      const payload = template
        ? { type: "plan-template", template }
        : { type: "plan-block" };
      e.dataTransfer.setData("application/json", JSON.stringify(payload));
    },
    []
  );

  const handleToolDragStart = useCallback(
    (toolName: string) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("application/json", JSON.stringify({ type: "tool", name: toolName }));
    },
    []
  );

  return { handleAgentDragStart, handlePlanDragStart, handleToolDragStart };
}
