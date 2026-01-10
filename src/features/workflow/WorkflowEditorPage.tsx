// =============================================================================
// Workflow Editor Page - Main canvas page component
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, Toolbar } from "../../components/ui";
import { AgentCanvasView, PlanCanvasView } from "../../components/canvas";
import { BlockDetailsModal, ToolDetailsModal, EvalsModal } from "../../components/modals";
import AgentViewLoadingScreen from "./AgentViewLoadingScreen";
import PlanViewLoadingScreen from "./PlanViewLoadingScreen";
import { usePanZoom, useWorkspace } from "../../hooks";
import { usePlanBench } from "../../hooks/usePlanBench";
import { usePlanWorkflow } from "../../hooks/usePlanWorkflow";
import { useWorkflowDownload, useWorkflowImport } from "../../shared/planning/handleIO";
import { useNodeHandles } from "../../hooks/useNodeHandles";
import { useBlockIO } from "../../hooks/useBlockIO";
import { useCanvasDrop } from "../../hooks/useCanvasDrop";
import { useCanvasDragHandlers } from "../../hooks/useCanvasDragHandlers";
import { useCanvasLinking } from "../../hooks/useCanvasLinking";
import { useCanvasSelection } from "../../hooks/useCanvasSelection";
import { useWorkspaceActions } from "../../hooks/useWorkspaceActions";
import { useWorkflowHotkeys } from "../../hooks/useWorkflowHotkeys";
import { useIdCounters } from "../../hooks/useIdCounters";
import { useSidebarDragHandlers } from "../../hooks/useSidebarDragHandlers";
import { useHandleVisibility } from "../../hooks/useHandleVisibility";
import { useWorkflowReset } from "../../hooks/useWorkflowReset";
import {
  TOOL_PALETTE,
  EVAL_OPTIONS,
  AGENT_REGISTRY_AGENTS,
  PLAN_WORKSPACE_STORAGE_KEY,
} from "../../shared/constants";
import { isRecord } from "../../shared/utils";
import { readCustomAgents } from "../../shared/utils/customAgents";
import { readCustomPlans } from "../../shared/utils/customPlans";
import type { PlanConnections, PlanningBlock, ViewMode } from "../../shared/types";

type PlanConnection = PlanConnections[number];

type PlanContextSnapshot = {
  plans: PlanningBlock[];
  planConnections: PlanConnection[];
  activePlanId: string | null;
  parentPlanId: string | null;
};

type PlanWorkspaceSnapshot = {
  plans: PlanningBlock[];
  planConnections: PlanConnection[];
  activePlanId: string | null;
  viewMode: ViewMode;
  nextPlanId: number;
  planStack?: PlanContextSnapshot[];
};

const getNextPlanId = (plans: PlanningBlock[], fallback = 1) => {
  const maxPlanId = plans.reduce((max, plan) => {
    if (!plan.id.startsWith("plan-")) return max;
    const next = Number.parseInt(plan.id.slice(5), 10);
    return Number.isFinite(next) ? Math.max(max, next) : max;
  }, 0);
  return Math.max(fallback, maxPlanId + 1);
};

const normalizePlanConnections = (plans: PlanningBlock[], connections: PlanConnection[]) => {
  const planIds = new Set(plans.map((plan) => plan.id));
  return connections.filter((conn) => planIds.has(conn.from) && planIds.has(conn.to));
};

const readPlanContextSnapshot = (value: unknown): PlanContextSnapshot | null => {
  if (!isRecord(value)) return null;
  const rawPlans = Array.isArray(value.plans) ? value.plans : [];
  const plans = rawPlans.filter(
    (plan): plan is PlanningBlock =>
      isRecord(plan) && typeof plan.id === "string"
  );
  const rawConnections = Array.isArray(value.planConnections)
    ? value.planConnections
    : Array.isArray(value.connections)
      ? value.connections
      : [];
  const connections = rawConnections.filter(
    (conn): conn is PlanConnection =>
      isRecord(conn) && typeof conn.from === "string" && typeof conn.to === "string"
  );
  const planConnections = normalizePlanConnections(plans, connections);
  const activePlanId =
    typeof value.activePlanId === "string" && plans.some((plan) => plan.id === value.activePlanId)
      ? value.activePlanId
      : null;
  const parentPlanId =
    typeof value.parentPlanId === "string" && plans.some((plan) => plan.id === value.parentPlanId)
      ? value.parentPlanId
      : null;
  return {
    plans,
    planConnections,
    activePlanId,
    parentPlanId,
  };
};

const readPlanWorkspaceSnapshot = (): PlanWorkspaceSnapshot | null => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  const saved = localStorage.getItem(PLAN_WORKSPACE_STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!isRecord(parsed)) return null;
    const rawPlans = Array.isArray(parsed.plans) ? parsed.plans : [];
    const plans = rawPlans.filter(
      (plan): plan is PlanningBlock =>
        isRecord(plan) && typeof plan.id === "string"
    );
    const rawConnections = Array.isArray(parsed.planConnections)
      ? parsed.planConnections
      : Array.isArray(parsed.connections)
        ? parsed.connections
        : [];
    const connections = rawConnections.filter(
      (conn): conn is PlanConnection =>
        isRecord(conn) && typeof conn.from === "string" && typeof conn.to === "string"
    );
    const planConnections = normalizePlanConnections(plans, connections);
    const viewMode =
      parsed.viewMode === "plan" || parsed.viewMode === "agent" ? parsed.viewMode : "agent";
    const activePlanId =
      typeof parsed.activePlanId === "string" && plans.some((plan) => plan.id === parsed.activePlanId)
        ? parsed.activePlanId
        : null;
    const nextPlanIdFallback = getNextPlanId(plans);
    const nextPlanId =
      typeof parsed.nextPlanId === "number" && Number.isFinite(parsed.nextPlanId)
        ? Math.max(parsed.nextPlanId, nextPlanIdFallback)
        : nextPlanIdFallback;
    const rawStack = Array.isArray(parsed.planStack) ? parsed.planStack : [];
    const planStack = rawStack
      .map((entry) => readPlanContextSnapshot(entry))
      .filter((entry): entry is PlanContextSnapshot => Boolean(entry));
    return {
      plans,
      planConnections,
      activePlanId,
      viewMode,
      nextPlanId,
      planStack,
    };
  } catch {
    return null;
  }
};

export default function WorkflowEditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialPlanSnapshot = useMemo(() => readPlanWorkspaceSnapshot(), []);
  const [viewMode, setViewMode] = useState<ViewMode>(() => initialPlanSnapshot?.viewMode ?? "agent");

  const STARTUP_LOADING_MS = 900;
  const VIEW_SWITCH_LOADING_MS = 650;
  const startupLoadingKey = "c3an_workflow_startup_loading_shown";

  const [showStartupLoading, setShowStartupLoading] = useState(() => {
    try {
      return sessionStorage.getItem(startupLoadingKey) !== "1";
    } catch {
      return true;
    }
  });

  const [isViewSwitchLoading, setIsViewSwitchLoading] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<ViewMode | null>(null);
  const viewSwitchTimeoutRef = useRef<number | null>(null);
  const [isSubplanLoading, setIsSubplanLoading] = useState(false);
  const subplanLoadingTimeoutRef = useRef<number | null>(null);
  const [plans, setPlans] = useState<PlanningBlock[]>(() => initialPlanSnapshot?.plans ?? []);
  const nextPlanIdRef = useRef(
    initialPlanSnapshot?.nextPlanId ?? getNextPlanId(initialPlanSnapshot?.plans ?? [])
  );
  const [planCanvasKey, setPlanCanvasKey] = useState(0);
  const [activePlanId, setActivePlanId] = useState<string | null>(
    () => initialPlanSnapshot?.activePlanId ?? null
  );

  useEffect(() => {
    if (!showStartupLoading) return;

    // Per request: on first load, show a loading page and land in agent view.
    setViewMode("agent");

    const timeout = window.setTimeout(() => {
      try {
        sessionStorage.setItem(startupLoadingKey, "1");
      } catch {
        // ignore
      }
      setShowStartupLoading(false);
    }, STARTUP_LOADING_MS);

    return () => window.clearTimeout(timeout);
  }, [showStartupLoading]);

  const beginViewSwitchLoading = useCallback((nextMode: ViewMode) => {
    if (viewSwitchTimeoutRef.current !== null) {
      window.clearTimeout(viewSwitchTimeoutRef.current);
      viewSwitchTimeoutRef.current = null;
    }

    setPendingViewMode(nextMode);
    setIsViewSwitchLoading(true);

    viewSwitchTimeoutRef.current = window.setTimeout(() => {
      setViewMode(nextMode);
      setIsViewSwitchLoading(false);
      setPendingViewMode(null);
      viewSwitchTimeoutRef.current = null;
    }, VIEW_SWITCH_LOADING_MS);
  }, []);

  const beginSubplanLoading = useCallback(() => {
    if (subplanLoadingTimeoutRef.current !== null) {
      window.clearTimeout(subplanLoadingTimeoutRef.current);
      subplanLoadingTimeoutRef.current = null;
    }

    setIsSubplanLoading(true);

    subplanLoadingTimeoutRef.current = window.setTimeout(() => {
      setIsSubplanLoading(false);
      subplanLoadingTimeoutRef.current = null;
    }, VIEW_SWITCH_LOADING_MS);
  }, [VIEW_SWITCH_LOADING_MS]);

  useEffect(() => {
    return () => {
      if (viewSwitchTimeoutRef.current !== null) {
        window.clearTimeout(viewSwitchTimeoutRef.current);
      }
      if (subplanLoadingTimeoutRef.current !== null) {
        window.clearTimeout(subplanLoadingTimeoutRef.current);
      }
    };
  }, []);

  const [planConnections, setPlanConnections] = useState<PlanConnection[]>(
    () => initialPlanSnapshot?.planConnections ?? []
  );
  const [planStack, setPlanStack] = useState<PlanContextSnapshot[]>(
    () => initialPlanSnapshot?.planStack ?? []
  );
  const planLinkFromRef = useRef<string | null>(null);

  // Agent-view-only IO: when the user uploads a plan JSON while in agent view,
  // we keep the original payload as a template so download keeps the same schema.
  const agentPlanTemplateRef = useRef<unknown | null>(null);

  const {
    blocks,
    setBlocks,
    tools,
    setTools,
    connections,
    setConnections,
    theme,
    setTheme,
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
    resetWorkspace,
    recalcBlockPorts,
    getBlockMode,
  } = useWorkspace();

  const toolPalette = useMemo(() => TOOL_PALETTE, []);
  const evalOptions = useMemo(() => EVAL_OPTIONS, []);
  const customAgents = useMemo(() => readCustomAgents(), []);
  const customPlans = useMemo(() => readCustomPlans(), []);
  const availableAgents = useMemo(() => [...AGENT_REGISTRY_AGENTS, ...customAgents], [customAgents]);

  const { bumpIdCounters } = useIdCounters({ nextBlockIdRef, nextToolIdRef, nextConnectionIdRef });

  const { applyPlanJson, handleUpload } = useWorkflowImport({
    availableAgents,
    agentPlanTemplateRef,
    bumpIdCounters,
    linkingRef,
    recalcBlockPorts,
    setBlocks,
    setTools,
    setConnections,
    setSelectedEvals,
    setSelected,
    setHoveredInput,
    setHoveredOutput,
    setHoveredBlockId,
    setHoveredToolId,
    setLinking,
    setViewMode,
  });

  const {
    buildPlanWorkflowSnapshot,
    saveActivePlanWorkflow,
    clearWorkspaceUIState,
    handleEnterPlanWorkflow,
  } = usePlanWorkflow({
    activePlanId,
    setActivePlanId,
    blocks,
    tools,
    connections,
    selectedEvals,
    setPlans,
    setViewMode,
    setBlocks,
    setTools,
    setConnections,
    setSelectedEvals,
    setSelected,
    setHoveredInput,
    setHoveredOutput,
    setHoveredBlockId,
    setHoveredToolId,
    setLinking,
    linkingRef,
    recalcBlockPorts,
    bumpIdCounters,
    applyPlanJson,
    agentPlanTemplateRef,
  });

  const handleEnterPlanNode = useCallback(
    (plan: PlanningBlock) => {
      const nestedPlans = plan.sub_plans?.plans ?? [];
      if (nestedPlans.length > 0) {
        beginSubplanLoading();
        setPlanCanvasKey((prev) => prev + 1);
        const nextPlans = nestedPlans.map((entry) => ({ ...entry }));
        const nextConnections = [...(plan.sub_plans?.connections ?? [])];
        setPlanStack((prev) => [
          ...prev,
          {
            plans,
            planConnections,
            activePlanId,
            parentPlanId: plan.id,
          },
        ]);
        setPlans(nextPlans);
        setPlanConnections(nextConnections);
        setActivePlanId(null);
        planLinkFromRef.current = null;
        setViewMode("plan");
        clearWorkspaceUIState();
        return;
      }
      if (planStack.length > 0) {
        beginViewSwitchLoading("agent");
      }
      handleEnterPlanWorkflow(plan);
    },
    [
      activePlanId,
      beginSubplanLoading,
      beginViewSwitchLoading,
      clearWorkspaceUIState,
      handleEnterPlanWorkflow,
      planConnections,
      planStack.length,
      plans,
      setActivePlanId,
      setPlanCanvasKey,
      setPlanConnections,
      setPlanStack,
      setPlans,
      setViewMode,
    ]
  );

  const loadingViewMode = isSubplanLoading ? "plan" : (pendingViewMode ?? viewMode);

  const handlePlanBack = useCallback(() => {
    if (!planStack.length) return;
    beginSubplanLoading();
    setPlanCanvasKey((prev) => prev + 1);
    const parentContext = planStack[planStack.length - 1];
    const nextStack = planStack.slice(0, -1);
    const parentPlanId = parentContext.parentPlanId;
    setPlans((currentPlans) => {
      if (!parentPlanId) return parentContext.plans;
      return parentContext.plans.map((plan) =>
        plan.id === parentPlanId
          ? {
              ...plan,
              sub_plans: {
                plans: currentPlans,
                connections: planConnections,
              },
            }
          : plan
      );
    });
    setPlanConnections([...parentContext.planConnections]);
    setActivePlanId(parentContext.activePlanId);
    setPlanStack(nextStack);
    planLinkFromRef.current = null;
    setViewMode("plan");
    clearWorkspaceUIState();
  }, [
    beginSubplanLoading,
    clearWorkspaceUIState,
    planConnections,
    planStack,
    setActivePlanId,
    setPlanCanvasKey,
    setPlanConnections,
    setPlanStack,
    setPlans,
    setViewMode,
  ]);

  const handleAgentBack = useCallback(() => {
    if (planStack.length === 0) return;
    setActivePanel((prev) => (prev === "tools" ? "blocks" : prev));
    saveActivePlanWorkflow();
    planLinkFromRef.current = null;
    setModalBlockId(null);
    setModalToolId(null);
    clearWorkspaceUIState();
    if (!showStartupLoading && viewMode !== "plan") {
      beginViewSwitchLoading("plan");
    } else {
      setViewMode("plan");
    }
  }, [
    beginViewSwitchLoading,
    clearWorkspaceUIState,
    planStack.length,
    saveActivePlanWorkflow,
    setActivePanel,
    setModalBlockId,
    setModalToolId,
    setViewMode,
    showStartupLoading,
    viewMode,
  ]);

  usePlanBench({
    applyPlanJson,
    nextPlanIdRef,
    planLinkFromRef,
    setPlans,
    setPlanConnections,
    setPlanStack,
    setActivePlanId,
    setViewMode,
    setActivePanel,
  });

  useEffect(() => {
    const activePlan = activePlanId ? plans.find((plan) => plan.id === activePlanId) : null;
    if (!activePlan) return;
    const hasNewSchema = Boolean(activePlan.task_id || activePlan.main_task || activePlan.sub_tasks);
    agentPlanTemplateRef.current = {
      ...(hasNewSchema ? { task_id: activePlan.task_id ?? activePlan.id } : { plan_id: activePlan.id }),
      ...(activePlan.main_task ? { main_task: activePlan.main_task } : {}),
      ...(activePlan.sub_tasks ? { sub_tasks: activePlan.sub_tasks } : {}),
      query: activePlan.query,
      triples: activePlan.triples,
    };
  }, [activePlanId, plans]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const plansForStorage =
      activePlanId && viewMode === "agent"
        ? plans.map((plan) =>
            plan.id === activePlanId
              ? { ...plan, workflow: buildPlanWorkflowSnapshot() }
              : plan
          )
        : plans;
    const planConnectionsForStorage = normalizePlanConnections(plansForStorage, planConnections);
    const planStackForStorage = planStack.map((entry) => {
      const normalizedConnections = normalizePlanConnections(entry.plans, entry.planConnections);
      const normalizedActivePlanId =
        entry.activePlanId && entry.plans.some((plan) => plan.id === entry.activePlanId)
          ? entry.activePlanId
          : null;
      const normalizedParentPlanId =
        entry.parentPlanId && entry.plans.some((plan) => plan.id === entry.parentPlanId)
          ? entry.parentPlanId
          : null;
      return {
        ...entry,
        activePlanId: normalizedActivePlanId,
        parentPlanId: normalizedParentPlanId,
        planConnections: normalizedConnections,
      };
    });
    const snapshot: PlanWorkspaceSnapshot = {
      plans: plansForStorage,
      planConnections: planConnectionsForStorage,
      activePlanId,
      viewMode,
      nextPlanId: nextPlanIdRef.current,
      planStack: planStackForStorage,
    };
    localStorage.setItem(PLAN_WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    activePlanId,
    buildPlanWorkflowSnapshot,
    planConnections,
    plans,
    planStack,
    viewMode,
  ]);

  const handleC3ANClick = useCallback(() => {
    window.open("https://c3an.aiisc.ai/", "_blank", "noopener,noreferrer");
  }, []);

  const { handleAgentDragStart, handlePlanDragStart, handleToolDragStart } = useSidebarDragHandlers();


  const { containerRef, containerEl, transform, setTransform, reset, getTransform } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
    shouldAllowPan: (event) => {
      if (linkingRef.current) return false;
      const target = event.target as HTMLElement | null;
      return !target?.closest(
        "[data-block],[data-tool]"
      );
    },
    isPanDisabled: () => linkingRef.current,
  });

  const toWorldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerEl;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const base = getTransform();
      return {
        x: (localX - base.x) / base.zoom,
        y: (localY - base.y) / base.zoom,
      };
    },
    [containerEl, getTransform]
  );

  const { getBlockHandles, getToolHandles } = useNodeHandles({
    connections,
    linking,
    hoveredBlockId,
  });

  const toWorldPointDuringDrag = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerEl;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const margin = 140;
      const maxSpeed = 22;
      const base = getTransform();
      let dx = 0;
      let dy = 0;

      const bounds = (() => {
        if (draggingBlockId) {
          const block = blocks.find((item) => item.id === draggingBlockId);
          if (!block) return null;
          const handles = getBlockHandles(block);
          return {
            left: base.x + block.x * base.zoom,
            right: base.x + (block.x + handles.width) * base.zoom,
            top: base.y + block.y * base.zoom,
            bottom: base.y + (block.y + handles.height) * base.zoom,
          };
        }
        if (draggingToolId) {
          const tool = tools.find((item) => item.id === draggingToolId);
          if (!tool) return null;
          const handles = getToolHandles(tool);
          return {
            left: base.x + tool.x * base.zoom,
            right: base.x + (tool.x + handles.width) * base.zoom,
            top: base.y + tool.y * base.zoom,
            bottom: base.y + (tool.y + handles.height) * base.zoom,
          };
        }
        return null;
      })();

      const leftEdge = bounds?.left ?? clientX;
      const rightEdge = bounds?.right ?? clientX;
      const topEdge = bounds?.top ?? clientY;
      const bottomEdge = bounds?.bottom ?? clientY;
      const overflowRight = rightEdge - (rect.right - margin);
      const overflowLeft = (rect.left + margin) - leftEdge;
      const overflowBottom = bottomEdge - (rect.bottom - margin);
      const overflowTop = (rect.top + margin) - topEdge;

      if (overflowRight > 0) {
        dx = -Math.min(maxSpeed, overflowRight);
      } else if (overflowLeft > 0) {
        dx = Math.min(maxSpeed, overflowLeft);
      }

      if (overflowBottom > 0) {
        dy = -Math.min(maxSpeed, overflowBottom);
      } else if (overflowTop > 0) {
        dy = Math.min(maxSpeed, overflowTop);
      }

      const nextX = base.x + dx;
      const nextY = base.y + dy;
      if (dx || dy) {
        setTransform({ x: nextX, y: nextY, zoom: base.zoom });
      }
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      return {
        x: (localX - nextX) / base.zoom,
        y: (localY - nextY) / base.zoom,
      };
    },
    [
      blocks,
      containerEl,
      draggingBlockId,
      draggingToolId,
      getBlockHandles,
      getToolHandles,
      getTransform,
      setTransform,
      tools,
    ]
  );

  const { addToolToBlock, changeBlockInputs, changeBlockOutputs } = useBlockIO({
    blocks,
    toolPalette,
    setBlocks,
    setTools,
    setConnections,
    getBlockHandles,
    nextToolIdRef,
    nextConnectionIdRef,
    recalcBlockPorts,
  });

  const { handleCanvasDragOver, handleCanvasDrop } = useCanvasDrop({
    availableAgents,
    toolPalette,
    nextBlockIdRef,
    nextToolIdRef,
    setBlocks,
    setTools,
    toWorldPoint,
  });

  const { blockDrag, toolDrag } = useCanvasDragHandlers({
    blocks,
    tools,
    setBlocks,
    setTools,
    setSelected,
    draggingBlockId,
    draggingToolId,
    setDraggingBlockId,
    setDraggingToolId,
    blockDragOffsetRef,
    toolDragOffsetRef,
    linkingRef,
    toWorldPoint,
    toWorldPointDuringDrag,
  });

  const {
    getOutputAnchor,
    getInputAnchor,
    handleConnectionPointerDown,
    startLinkingFromInput,
    startLinkingFromOutput,
    moveLinking,
    finalizeLinking,
  } = useCanvasLinking({
    blocks,
    tools,
    linking,
    hoveredBlockId,
    hoveredInput,
    hoveredOutput,
    setLinking,
    setHoveredInput,
    setHoveredOutput,
    setConnections,
    setBlocks,
    recalcBlockPorts,
    linkingRef,
    nextConnectionIdRef,
    getBlockHandles,
    getToolHandles,
    toWorldPoint,
  });

  const { handleCanvasPointerDown } = useCanvasSelection({
    linkingRef,
    setSelected,
    setHoveredInput,
    setHoveredOutput,
    setHoveredBlockId,
    setHoveredToolId,
    setLinking,
  });

  const {
    handleRemoveBlock,
    handleRemoveTool,
    handleRemoveConnection,
    toggleInputRequired,
    toggleOutputRequired,
    toggleToolInputRequired,
    toggleToolOutputRequired,
    toggleEval,
  } = useWorkspaceActions({
    selected,
    setBlocks,
    setTools,
    setConnections,
    setSelected,
    setSelectedEvals,
    recalcBlockPorts,
  });

  useWorkflowHotkeys({
    blocks,
    tools,
    selected,
    clipboard,
    setBlocks,
    setTools,
    setClipboard,
    nextBlockIdRef,
    nextToolIdRef,
    handleRemoveBlock,
    handleRemoveTool,
    handleRemoveConnection,
  });

  const { downloadLabel, handleDownload } = useWorkflowDownload({
    viewMode,
    activePlanId,
    plans,
    planConnections,
    buildPlanWorkflowSnapshot,
    planStackDepth: planStack.length,
    agentPlanTemplateRef,
  });

  const { handleReset } = useWorkflowReset({
    reset,
    resetWorkspace,
    setPlans,
    setPlanCanvasKey,
    setActivePlanId,
    setPlanStack,
    agentPlanTemplateRef,
    setSelectedEvals,
  });

  const { showHandlesForId } = useHandleVisibility({
    linking,
    hoveredBlockId,
    hoveredToolId,
    draggingBlockId,
    draggingToolId,
    selected,
  });

  const appThemeClass = theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";

  const modalBlock = modalBlockId ? blocks.find((b) => b.id === modalBlockId) ?? null : null;
  const modalTool = modalToolId ? tools.find((t) => t.id === modalToolId) ?? null : null;
  const toolbarBackHandler =
    planStack.length > 0
      ? viewMode === "plan"
        ? handlePlanBack
        : viewMode === "agent"
          ? handleAgentBack
          : undefined
      : undefined;

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${appThemeClass}`}>
      {showStartupLoading ? (
        <AgentViewLoadingScreen theme={theme} />
      ) : isViewSwitchLoading || isSubplanLoading ? (
        loadingViewMode === "plan" ? (
          <PlanViewLoadingScreen theme={theme} />
        ) : (
          <AgentViewLoadingScreen theme={theme} />
        )
      ) : null}

      <Sidebar
        activePanel={activePanel}
        theme={theme}
        viewMode={viewMode}
        registryAgents={AGENT_REGISTRY_AGENTS}
        customAgents={customAgents}
        planTemplates={customPlans}
        toolPalette={toolPalette}
        onPanelChange={setActivePanel}
        onThemeChange={(value) => {
          setTheme(value);
          setUserThemeLocked(true);
        }}
        onViewModeChange={(mode) => {
          if (mode === "plan" && activePanel === "tools") setActivePanel("blocks");
          if (mode === "plan") {
            saveActivePlanWorkflow();
            planLinkFromRef.current = null;
          }
          // Show a brief loading screen on any view switch.
          if (!showStartupLoading && mode !== viewMode) {
            beginViewSwitchLoading(mode);
          } else {
            setViewMode(mode);
          }
          setModalBlockId(null);
          setModalToolId(null);
          clearWorkspaceUIState();
        }}
        onAgentDragStart={handleAgentDragStart}
        onPlanDragStart={handlePlanDragStart}
        onToolDragStart={handleToolDragStart}
      />

      <Toolbar
        theme={theme}
        fileInputRef={fileInputRef}
        downloadLabel={downloadLabel}
        onPlanBackClick={toolbarBackHandler}
        onC3ANClick={handleC3ANClick}
        onAboutClick={() => setActivePanel((prev) => (prev === "settings" ? null : "settings"))}
        onPlanningClick={() => {
          window.location.hash = "#/planning";
        }}
        onAgentGenClick={() => {
          window.location.hash = "#/agentgen";
        }}
        onEvalsClick={() => setShowEvalsModal(true)}
        onDownloadClick={handleDownload}
        onUploadClick={() => fileInputRef.current?.click()}
        onRunClick={() => alert("Run triggered")}
        onResetClick={handleReset}
        onFileUpload={handleUpload}
      />

      <main className="relative z-0 h-full w-full">
        {showStartupLoading || isViewSwitchLoading || isSubplanLoading ? null : viewMode === "plan" ? (
          <PlanCanvasView
            key={planCanvasKey}
            theme={theme}
            plans={plans}
            connections={planConnections}
            planPillLabel={planStack.length > 0 ? "Subtask" : "Plan"}
            planLinkFromRef={planLinkFromRef}
            setPlans={setPlans}
            setPlanConnections={setPlanConnections}
            setActivePlanId={setActivePlanId}
            activePlanId={activePlanId}
            nextPlanIdRef={nextPlanIdRef}
            onEnterWorkflow={handleEnterPlanNode}
          />
        ) : (
          <AgentCanvasView
            containerRef={containerRef}
            transform={transform}
            theme={theme}
            blocks={blocks}
            tools={tools}
            connections={connections}
            linking={linking}
            selected={selected}
            draggingBlockId={draggingBlockId}
            draggingToolId={draggingToolId}
            getBlockHandles={getBlockHandles}
            getToolHandles={getToolHandles}
            getBlockMode={getBlockMode}
            showHandlesForId={showHandlesForId}
            blockDrag={blockDrag}
            toolDrag={toolDrag}
            onCanvasDragOver={handleCanvasDragOver}
            onCanvasDrop={handleCanvasDrop}
            onCanvasPointerDown={handleCanvasPointerDown}
            onMoveLinking={moveLinking}
            onFinalizeLinking={finalizeLinking}
            onConnectionPointerDown={handleConnectionPointerDown}
            onRemoveBlock={handleRemoveBlock}
            onRemoveTool={handleRemoveTool}
            onBlockDetailsClick={setModalBlockId}
            onToolDetailsClick={setModalToolId}
            onBlockHoverEnter={setHoveredBlockId}
            onBlockHoverLeave={() => setHoveredBlockId(null)}
            onToolHoverEnter={setHoveredToolId}
            onToolHoverLeave={() => setHoveredToolId(null)}
            onInputEnter={(target) => () => setHoveredInput(target)}
            onInputLeave={(target) => () => {
              void target;
              setHoveredInput(null);
            }}
            onOutputEnter={(source) => () => setHoveredOutput(source)}
            onOutputLeave={(source) => () => {
              void source;
              setHoveredOutput(null);
            }}
            onStartLinkingFromInput={startLinkingFromInput}
            onStartLinkingFromOutput={startLinkingFromOutput}
            onChangeInputs={changeBlockInputs}
            onChangeOutputs={changeBlockOutputs}
            getInputAnchor={getInputAnchor}
            getOutputAnchor={getOutputAnchor}
          />
        )}
      </main>

      {modalBlock && (
        <BlockDetailsModal
          block={modalBlock}
          registryAgents={availableAgents}
          tools={tools}
          connections={connections}
          onClose={() => setModalBlockId(null)}
          onToggleInputRequired={toggleInputRequired}
          onToggleOutputRequired={toggleOutputRequired}
          getBlockMode={getBlockMode}
        />
      )}

      {modalTool && (
        <ToolDetailsModal
          tool={modalTool}
          connections={connections}
          blocks={blocks}
          onClose={() => setModalToolId(null)}
          onToggleInputRequired={toggleToolInputRequired}
          onToggleOutputRequired={toggleToolOutputRequired}
        />
      )}

      {showEvalsModal && (
        <EvalsModal
          evalOptions={evalOptions}
          selectedEvals={selectedEvals}
          onClose={() => setShowEvalsModal(false)}
          onToggleEval={toggleEval}
          onClearAll={() => setSelectedEvals([])}
        />
      )}
    </div>
  );
}
