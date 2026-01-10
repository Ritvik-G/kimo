import type { PlanHierarchy, PlanSubTask, PlanTemplate, PlanningWorkflowSnapshot } from "../types/planning";
import type { AgentBlock, Connection, ToolNode, ToolPreset } from "../types";
import {
  findAgentRegistryEntryByIdOrName,
  getAgentRegistryEntryById,
  listMandatoryOptional,
  TOOL_PALETTE,
  TOOL_PORT_OFFSET,
} from "../constants";

const BLOCK_WIDTH = 220;
const TOOL_WIDTH = 180;
const TOOL_GAP = 28;
const TOOL_ROW_GAP = 40;
const BLOCK_BASE_HEIGHT = 120;
const BLOCK_TOP_PADDING = 18;
const BLOCK_SLOT_GAP = 28;

const FALLBACK_TOOL_PRESET: ToolPreset = {
  name: "Tool",
  tagline: "",
  gradient: "from-slate-50 via-white to-cyan-100",
  ring: "ring-cyan-200",
  accent: "bg-cyan-600",
  inputCount: 1,
  outputCount: 1,
  inputRequired: [false],
  outputRequired: [false],
};

type LayoutOptions = {
  startX: number;
  gapX: number;
  y: number;
};

function ensureToolPreset(name: string): ToolPreset {
  const preset = TOOL_PALETTE.find((tool) => tool.name === name);
  return preset ?? FALLBACK_TOOL_PRESET;
}

function blockFromRegistry(agentIdOrName: string, x: number, y: number): AgentBlock {
  const registry =
    getAgentRegistryEntryById(agentIdOrName) ?? findAgentRegistryEntryByIdOrName(agentIdOrName);
  const input = registry ? listMandatoryOptional(registry.input_data_streams) : { mandatory: [], optional: [] };
  const output = registry ? listMandatoryOptional(registry.output_data_streams) : { mandatory: [], optional: [] };

  const inputNames = [...input.mandatory, ...input.optional];
  const outputNames = [...output.mandatory, ...output.optional];

  const inputCount = Math.max(1, Math.min(5, inputNames.length || 1));
  const outputCount = Math.max(1, Math.min(5, outputNames.length || 1));
  const mandatoryInputCount = Math.min(input.mandatory.length, inputCount);
  const mandatoryOutputCount = Math.min(output.mandatory.length, outputCount);

  const name = registry?.name ?? agentIdOrName;
  const description = registry?.description ?? "";

  return {
    id: "",
    x,
    y,
    name,
    description,
    agentId: registry?.id,
    inputCount,
    outputCount,
    inputRequired: Array.from({ length: inputCount }, (_, idx) => idx < mandatoryInputCount),
    outputRequired: Array.from({ length: outputCount }, (_, idx) => idx < mandatoryOutputCount),
    inputNames: inputNames.length ? inputNames.slice(0, inputCount) : undefined,
    outputNames: outputNames.length ? outputNames.slice(0, outputCount) : undefined,
    presetId: registry?.id ?? "custom",
    mandatoryInputCount,
    mandatoryOutputCount,
  };
}

function toolNodeFromPreset(name: string, x: number, y: number): ToolNode {
  const preset = ensureToolPreset(name);
  return {
    ...preset,
    id: "",
    x,
    y,
  };
}

function getBlockHeight(block: AgentBlock): number {
  const maxSlots = Math.max(block.inputCount ?? 1, block.outputCount ?? 1);
  if (maxSlots <= 1) return BLOCK_BASE_HEIGHT;
  return Math.max(BLOCK_BASE_HEIGHT, BLOCK_TOP_PADDING * 2 + BLOCK_SLOT_GAP * (maxSlots - 1));
}

function buildSingleAgentWorkflowSnapshot(args: {
  agentId: string;
  tools?: string[];
}): PlanningWorkflowSnapshot {
  const blocks: AgentBlock[] = [];
  const tools: ToolNode[] = [];
  const connections: Connection[] = [];
  let nextTool = 1;
  let nextConn = 1;

  const block = blockFromRegistry(args.agentId, 460, 160);
  const blockId = "block-1";
  blocks.push({ ...block, id: blockId });

  const toolItems = Array.isArray(args.tools) ? args.tools : [];
  if (toolItems.length > 0) {
    const blockHeight = getBlockHeight(block);
    const rowY = block.y + blockHeight + TOOL_ROW_GAP;
    const blockCenter = block.x + BLOCK_WIDTH / 2;
    const totalWidth = toolItems.length * TOOL_WIDTH + (toolItems.length - 1) * TOOL_GAP;
    const startX = blockCenter - totalWidth / 2;

    toolItems.forEach((toolName, index) => {
      const toolId = `tool-${nextTool++}`;
      tools.push({ ...toolNodeFromPreset(toolName, startX + index * (TOOL_WIDTH + TOOL_GAP), rowY), id: toolId });
      connections.push({
        id: `conn-${nextConn++}`,
        from: { type: "tool", id: toolId, port: 0 },
        to: { type: "block", id: blockId, inputIndex: TOOL_PORT_OFFSET },
      });
    });
  }

  return {
    blocks,
    tools,
    connections,
    evals: [],
    notes: [],
    uploads: [],
    outputs: [],
  };
}

function buildSubPlanHierarchy(args: {
  subTasks: PlanSubTask[];
  triples: PlanTemplate["triples"];
  workflows: Record<string, PlanningWorkflowSnapshot | undefined>;
  layout?: Partial<LayoutOptions>;
}): PlanHierarchy {
  const startX = args.layout?.startX ?? 220;
  const gapX = args.layout?.gapX ?? 360;
  const y = args.layout?.y ?? 220;

  const plans = args.subTasks
    .map((task, index) => {
      const id = task.sub_task_id;
      if (!id) return null;
      const workflow = args.workflows[id];
      return {
        id,
        x: startX + index * gapX,
        y,
        name: task.name,
        query: task.description ?? "",
        triples: [],
        task_id: id,
        main_task: task.name,
        sub_tasks: [task],
        ...(workflow ? { workflow } : {}),
      };
    })
    .filter((plan): plan is PlanHierarchy["plans"][number] => Boolean(plan));

  const planIds = new Set(plans.map((plan) => plan.id));
  const connections = args.triples
    .filter((triple) => planIds.has(triple.from) && planIds.has(triple.to))
    .map((triple) => ({
      from: triple.from,
      to: triple.to,
      op: triple.op,
    }));

  return { plans, connections };
}

function buildTemplate(args: {
  id: string;
  name: string;
  query: string;
  taskId: string;
  subTasks: PlanSubTask[];
  triples: PlanTemplate["triples"];
  workflows: Record<string, PlanningWorkflowSnapshot | undefined>;
  layout?: Partial<LayoutOptions>;
  mainTask?: string;
}): PlanTemplate {
  return {
    id: args.id,
    name: args.name,
    query: args.query,
    triples: args.triples,
    task_id: args.taskId,
    main_task: args.mainTask ?? args.query,
    sub_tasks: args.subTasks,
    sub_plans: buildSubPlanHierarchy({
      subTasks: args.subTasks,
      triples: args.triples,
      workflows: args.workflows,
      layout: args.layout,
    }),
  };
}

export function buildDefaultPlanTemplates(): PlanTemplate[] {
  const templates: PlanTemplate[] = [];

  const kimoQuery =
    "Develop a conversational chatbot that alerts an engineer when an anomaly occurs in the manufacturing pipeline, " +
    "suggests relevant mitigation strategies from existing manuals, and can answer any engineer's questions related to " +
    "the pipeline or the anomaly. The chatbot should also predict future anomalies using historical data.";
  const kimoSubTasks: PlanSubTask[] = [
    {
      sub_task_id: "ST-1",
      name: "Anomaly Prediction",
      description:
        "Build an agent that uses multimodal sensor data to detect and classify anomalies in real time.",
    },
    {
      sub_task_id: "ST-2",
      name: "Manuals Guide",
      description:
        "Build an agent that retrieves relevant mitigation steps from manufacturing manuals.",
      Tools: ["PDF Parser"],
    },
    {
      sub_task_id: "ST-3",
      name: "Conversational Chatbot",
      description:
        "Integrate ST-1 and ST-2 within an interactive conversational interface.",
      Tools: ["LLM"],
    },
  ];
  const kimoTriples: PlanTemplate["triples"] = [
    { from: "ST-1", op: "seq", to: "ST-3" },
    { from: "ST-2", op: "seq", to: "ST-3" },
  ];
  templates.push(
    buildTemplate({
      id: "default-manufacturing-copilot",
      name: "Manufacturing Copilot",
      query: kimoQuery,
      taskId: "kimo-demo-task",
      subTasks: kimoSubTasks,
      triples: kimoTriples,
      workflows: {
        "ST-1": buildSingleAgentWorkflowSnapshot({
          agentId: "anomaly-prediction-agent",
          tools: ["CNN Model", "LSTM Model"],
        }),
        "ST-2": buildSingleAgentWorkflowSnapshot({
          agentId: "manuals-guide-agent",
          tools: ["PDF Parser"],
        }),
        "ST-3": buildSingleAgentWorkflowSnapshot({
          agentId: "conversational-chatbot-agent",
          tools: ["LLM"],
        }),
      },
      layout: { startX: 200, gapX: 340, y: 220 },
      mainTask: kimoQuery,
    })
  );

  const fusionQuery = "Fuse vision and sensor signals to predict quality risk in production lines.";
  const fusionSubTasks: PlanSubTask[] = [
    {
      sub_task_id: "QS-1",
      name: "Vision Inspection",
      description: "Detect surface defects from camera feeds.",
      Tools: ["CNN Model"],
    },
    {
      sub_task_id: "QS-2",
      name: "Telemetry Diagnostics",
      description: "Analyze time-series telemetry to flag anomalies.",
      Tools: ["LSTM Model"],
    },
    {
      sub_task_id: "QS-3",
      name: "Fusion Forecast",
      description: "Combine signals to forecast quality risk and prioritize alerts.",
      Tools: ["Embedding Model"],
    },
  ];
  const fusionTriples: PlanTemplate["triples"] = [
    { from: "QS-1", op: "agg", to: "QS-3" },
    { from: "QS-2", op: "agg", to: "QS-3" },
  ];
  templates.push(
    buildTemplate({
      id: "default-quality-fusion",
      name: "Quality Signal Fusion",
      query: fusionQuery,
      taskId: "quality-signal-fusion",
      subTasks: fusionSubTasks,
      triples: fusionTriples,
      workflows: {
        "QS-1": buildSingleAgentWorkflowSnapshot({
          agentId: "vision-agent",
          tools: ["CNN Model"],
        }),
        "QS-2": buildSingleAgentWorkflowSnapshot({
          agentId: "timeseries-agent",
          tools: ["LSTM Model"],
        }),
        "QS-3": buildSingleAgentWorkflowSnapshot({
          agentId: "fusion-agent",
          tools: ["Embedding Model"],
        }),
      },
      layout: { startX: 180, gapX: 340, y: 220 },
      mainTask: fusionQuery,
    })
  );

  const responseQuery =
    "Build a response loop that retrieves context, forecasts issues, and synthesizes operator guidance.";
  const responseSubTasks: PlanSubTask[] = [
    {
      sub_task_id: "PR-1",
      name: "Context Retrieval",
      description: "Retrieve prior incidents and relevant procedures.",
      Tools: ["Vector DB"],
    },
    {
      sub_task_id: "PR-2",
      name: "Trend Forecasting",
      description: "Forecast emerging anomalies from historical signals.",
      Tools: ["LSTM Model"],
    },
    {
      sub_task_id: "PR-3",
      name: "Response Synthesis",
      description: "Craft operator-ready guidance and summaries.",
      Tools: ["LLM"],
    },
  ];
  const responseTriples: PlanTemplate["triples"] = [
    { from: "PR-1", op: "seq", to: "PR-2" },
    { from: "PR-2", op: "seq", to: "PR-3" },
  ];
  templates.push(
    buildTemplate({
      id: "default-predictive-response",
      name: "Predictive Response Loop",
      query: responseQuery,
      taskId: "predictive-response-loop",
      subTasks: responseSubTasks,
      triples: responseTriples,
      workflows: {
        "PR-1": buildSingleAgentWorkflowSnapshot({
          agentId: "rag-agent",
          tools: ["Vector DB"],
        }),
        "PR-2": buildSingleAgentWorkflowSnapshot({
          agentId: "foresight-agent",
          tools: ["LSTM Model"],
        }),
        "PR-3": buildSingleAgentWorkflowSnapshot({
          agentId: "response-agent",
          tools: ["LLM"],
        }),
      },
      layout: { startX: 160, gapX: 340, y: 220 },
      mainTask: responseQuery,
    })
  );

  return templates;
}
