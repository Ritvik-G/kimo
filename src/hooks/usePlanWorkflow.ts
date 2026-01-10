import { useCallback } from "react";
import type { AgentBlock, Connection, ToolNode, PlanningBlock, ViewMode, Selection, LinkTarget, LinkSource } from "../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function usePlanWorkflow(args: {
  activePlanId: string | null;
  setActivePlanId: SetState<string | null>;
  blocks: AgentBlock[];
  tools: ToolNode[];
  connections: Connection[];
  selectedEvals: string[];
  setPlans: SetState<PlanningBlock[]>;
  setViewMode: SetState<ViewMode>;
  setBlocks: SetState<AgentBlock[]>;
  setTools: SetState<ToolNode[]>;
  setConnections: SetState<Connection[]>;
  setSelectedEvals: SetState<string[]>;
  setSelected: SetState<Selection>;
  setHoveredInput: SetState<LinkTarget | null>;
  setHoveredOutput: SetState<LinkSource | null>;
  setHoveredBlockId: SetState<string | null>;
  setHoveredToolId: SetState<string | null>;
  setLinking: SetState<{
    origin: "output";
    from: LinkSource;
    current: { x: number; y: number };
  } | {
    origin: "input";
    target: LinkTarget;
    current: { x: number; y: number };
  } | null>;
  linkingRef: React.MutableRefObject<boolean>;
  recalcBlockPorts: (connections: Connection[], blocks: AgentBlock[]) => AgentBlock[];
  bumpIdCounters: (args: {
    blocks?: Array<{ id: string }>;
    tools?: Array<{ id: string }>;
    connections?: Array<{ id: string }>;
  }) => void;
  applyPlanJson: (src: unknown) => void;
  agentPlanTemplateRef: React.MutableRefObject<unknown | null>;
}) {
  const {
    activePlanId,
    agentPlanTemplateRef,
    applyPlanJson,
    blocks,
    bumpIdCounters,
    connections,
    linkingRef,
    recalcBlockPorts,
    selectedEvals,
    setActivePlanId,
    setBlocks,
    setConnections,
    setHoveredBlockId,
    setHoveredInput,
    setHoveredOutput,
    setHoveredToolId,
    setLinking,
    setPlans,
    setSelected,
    setSelectedEvals,
    setTools,
    setViewMode,
    tools,
  } = args;

  const buildPlanWorkflowSnapshot = useCallback(
    () => ({
      blocks,
      tools,
      connections,
      evals: selectedEvals,
      notes: [],
      uploads: [],
      outputs: [],
    }),
    [blocks, connections, selectedEvals, tools]
  );

  const saveActivePlanWorkflow = useCallback(() => {
    if (!activePlanId) return;
    const snapshot = buildPlanWorkflowSnapshot();
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === activePlanId ? { ...plan, workflow: snapshot } : plan
      )
    );
  }, [activePlanId, buildPlanWorkflowSnapshot, setPlans]);

  const clearWorkspaceUIState = useCallback(() => {
    setSelected(null);
    setHoveredInput(null);
    setHoveredOutput(null);
    setHoveredBlockId(null);
    setHoveredToolId(null);
    setLinking(null);
    linkingRef.current = false;
  }, [
    linkingRef,
    setHoveredBlockId,
    setHoveredInput,
    setHoveredOutput,
    setHoveredToolId,
    setLinking,
    setSelected,
  ]);

  const handleEnterPlanWorkflow = useCallback(
    (plan: PlanningBlock) => {
      saveActivePlanWorkflow();
      setActivePlanId(plan.id);
      clearWorkspaceUIState();

      const hasNewSchema = Boolean(plan.task_id || plan.main_task || plan.sub_tasks);
      agentPlanTemplateRef.current = {
        ...(hasNewSchema ? { task_id: plan.task_id ?? plan.id } : { plan_id: plan.id }),
        ...(plan.main_task ? { main_task: plan.main_task } : {}),
        ...(plan.sub_tasks ? { sub_tasks: plan.sub_tasks } : {}),
        query: plan.query,
        triples: plan.triples,
      };

      if (plan.workflow) {
        const loadedBlocks = plan.workflow.blocks ?? [];
        const loadedTools = plan.workflow.tools ?? [];
        const loadedConnections = plan.workflow.connections ?? [];

        setBlocks(loadedBlocks);
        setTools(loadedTools);
        setSelectedEvals(plan.workflow.evals ?? []);
        setConnections(loadedConnections);
        setBlocks((prev) => recalcBlockPorts(loadedConnections, prev));

        bumpIdCounters({
          blocks: loadedBlocks,
          tools: loadedTools,
          connections: loadedConnections,
        });
      } else {
        applyPlanJson({
          ...(hasNewSchema ? { task_id: plan.task_id ?? plan.id } : { plan_id: plan.id }),
          ...(plan.main_task ? { main_task: plan.main_task } : {}),
          ...(plan.sub_tasks ? { sub_tasks: plan.sub_tasks } : {}),
          query: plan.query,
          triples: plan.triples,
        });
        return;
      }

      setViewMode("agent");
    },
    [
      agentPlanTemplateRef,
      applyPlanJson,
      bumpIdCounters,
      clearWorkspaceUIState,
      recalcBlockPorts,
      saveActivePlanWorkflow,
      setActivePlanId,
      setBlocks,
      setConnections,
      setSelectedEvals,
      setTools,
      setViewMode,
    ]
  );

  return {
    buildPlanWorkflowSnapshot,
    saveActivePlanWorkflow,
    clearWorkspaceUIState,
    handleEnterPlanWorkflow,
  };
}
