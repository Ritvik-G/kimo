import { useCallback } from "react";
import { PLAN_WORKSPACE_STORAGE_KEY } from "../shared/constants";
import type { PlanConnections, PlanningBlock } from "../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useWorkflowReset(args: {
  reset: () => void;
  resetWorkspace: () => void;
  setPlans: SetState<PlanningBlock[]>;
  setPlanCanvasKey: SetState<number>;
  setActivePlanId: SetState<string | null>;
  setPlanStack: SetState<
    Array<{
      plans: PlanningBlock[];
      planConnections: PlanConnections;
      activePlanId: string | null;
      parentPlanId: string | null;
    }>
  >;
  agentPlanTemplateRef: React.MutableRefObject<unknown | null>;
  setSelectedEvals: SetState<string[]>;
}) {
  const {
    reset,
    resetWorkspace,
    setPlans,
    setPlanCanvasKey,
    setActivePlanId,
    setPlanStack,
    agentPlanTemplateRef,
    setSelectedEvals,
  } = args;

  const handleReset = useCallback(() => {
    reset();
    resetWorkspace();

    setPlans([]);
    setPlanCanvasKey((k) => k + 1);
    setActivePlanId(null);
    setPlanStack([]);

    agentPlanTemplateRef.current = null;
    setSelectedEvals([]);

    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.removeItem(PLAN_WORKSPACE_STORAGE_KEY);
    }
  }, [
    agentPlanTemplateRef,
    reset,
    resetWorkspace,
    setActivePlanId,
    setPlanCanvasKey,
    setPlanStack,
    setPlans,
    setSelectedEvals,
  ]);

  return { handleReset };
}
