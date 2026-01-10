import PlanningCanvas from "./PlanningCanvas";
import type { PlanConnections, PlanningBlock, Theme } from "../../shared/types";

type Props = {
  theme: Theme;
  plans: PlanningBlock[];
  connections: PlanConnections;
  planPillLabel?: string;
  planLinkFromRef: React.MutableRefObject<string | null>;
  setPlans: React.Dispatch<React.SetStateAction<PlanningBlock[]>>;
  setPlanConnections: React.Dispatch<React.SetStateAction<PlanConnections>>;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
  activePlanId: string | null;
  nextPlanIdRef: React.MutableRefObject<number>;
  onEnterWorkflow: (plan: PlanningBlock) => void;
};

export default function PlanCanvasView({
  theme,
  plans,
  connections,
  planPillLabel,
  planLinkFromRef,
  setPlans,
  setPlanConnections,
  setActivePlanId,
  activePlanId,
  nextPlanIdRef,
  onEnterWorkflow,
}: Props) {
  return (
    <PlanningCanvas
      theme={theme}
      plans={plans}
      connections={connections}
      planPillLabel={planPillLabel}
      onStartLink={(fromId) => {
        planLinkFromRef.current = fromId;
      }}
      onCompleteLink={(toId) => {
        const fromId = planLinkFromRef.current;
        planLinkFromRef.current = null;
        if (!fromId || fromId === toId) return;
        setPlanConnections((prev) => {
          if (prev.some((c) => c.from === fromId && c.to === toId)) return prev;
          return [...prev, { from: fromId, to: toId, op: "seq" }];
        });
      }}
      onCancelLink={() => {
        planLinkFromRef.current = null;
      }}
      onPlanMove={(id, x, y) => {
        setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
      }}
      onRemovePlan={(id) => {
        setPlans((prev) => prev.filter((p) => p.id !== id));
        setPlanConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
        if (planLinkFromRef.current === id) planLinkFromRef.current = null;
        if (activePlanId === id) setActivePlanId(null);
      }}
      onDropPlanBlock={(point, payload) => {
        const id = `plan-${nextPlanIdRef.current++}`;
        const template = payload?.type === "plan-template" ? payload.template : null;
        setPlans((prev) => [
          ...prev,
          {
            id,
            x: point.x,
            y: point.y,
            name: template?.name ?? "Plan",
            query: template?.query ?? "",
            triples: template?.triples ?? [],
            task_id: template?.task_id,
            main_task: template?.main_task,
            sub_tasks: template?.sub_tasks,
            sub_plans: template?.sub_plans,
            workflow: template?.workflow,
          },
        ]);
      }}
      onEnterWorkflow={onEnterWorkflow}
    />
  );
}
