// =============================================================================
// IO Streams
// - Plan View IO streams: TODO (rework later)
// - Agent View IO streams: shared hydration/sanitization helpers
// =============================================================================

import { useCallback } from "react";
import type { PlanConnections, PlanSubTask, PlanningBlock } from "../types/planning";
import type {
	AgentBlock,
	AgentRegistryEntry,
	Connection,
	LinkSource,
	LinkTarget,
	Selection,
	ToolNode,
	ViewMode,
} from "../types";
import {
	findAgentRegistryEntryByIdOrName,
	getAgentRegistryEntryById,
	listMandatoryOptional,
	MAX_IO,
	MIN_IO,
	TOOL_PORT_OFFSET,
} from "../constants";
import { parsePlanningJSON } from "./parsePlan";
import { normalizePlanOp } from "./planOps";
import { isRecord } from "../utils";
import { clamp } from "../utils";
import { downloadWorkflow } from "../utils";
import { buildIoFromStreams, detectWorkflowType } from "./workflowIO";

export type AgentViewHydration = {
	blocks: AgentBlock[];
	connections: Connection[];
};

export type HydratedWorkflow = {
	blocks: AgentBlock[];
	tools: ToolNode[];
	connections: Connection[];
};

export type PlanJsonTriple = { from: string; op: string; to: string };

export type PlanJson = {
	plan_id?: string;
	task_id?: string;
	main_task?: string;
	query?: string;
	intent?: string;
	sub_tasks?: PlanSubTask[];
	triples: PlanJsonTriple[];
	metadata?: Record<string, unknown>;
	// allow passthrough of unknown extra fields
	[key: string]: unknown;
};

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

const START_X = 200;
const START_Y = 200;
const X_GAP = 320;
const Y_GAP = 200;

type TripleLike = { from: string; to: string };

function normalizeTriples(plan: PlanningBlock): TripleLike[] {
	const triples = plan.triples ?? [];
	const taskNameById = new Map<string, string>();
	plan.sub_tasks?.forEach((task) => {
		const taskId = task.sub_task_id?.trim();
		const taskName = task.name?.trim();
		if (taskId && taskName) taskNameById.set(taskId, taskName);
	});
	const resolveLabel = (value: string) => taskNameById.get(value) ?? value;
	return triples
		.filter((t) => Boolean(t?.from) && Boolean(t?.to))
		.map((t) => {
			const from = String(t.from ?? "").trim();
			const to = String(t.to ?? "").trim();
			return { from: resolveLabel(from), to: resolveLabel(to) };
		});
}

// Agent-view hydration from a plan is intentionally simple:
// - Create a block per unique agent name.
// - Build deterministic input/output slot allocation based on first-seen ordering.
// - Ignore plan ops for now (seq/brn/agg semantics are plan-view concerns).
export function hydrateAgentViewFromPlan(plan: PlanningBlock): AgentViewHydration {
	const blocks: AgentBlock[] = [];
	const connections: Connection[] = [];

	const mergeUnique = (base: string[], additions: string[], seed: string[] = []) => {
		const seen = new Set([...seed, ...base]);
		const merged = [...base];
		additions.forEach((item) => {
			const trimmed = item.trim();
			if (!trimmed || seen.has(trimmed)) return;
			merged.push(trimmed);
			seen.add(trimmed);
		});
		return merged;
	};

	const taskDescriptionByLabel = new Map<string, string>();
	plan.sub_tasks?.forEach((task) => {
		const description = typeof task.description === "string" ? task.description.trim() : "";
		if (!description) return;
		const id = task.sub_task_id?.trim();
		if (id) taskDescriptionByLabel.set(id.toLowerCase(), description);
		const name = task.name?.trim();
		if (name) taskDescriptionByLabel.set(name.toLowerCase(), description);
	});

	const skillMetadataByLabel = new Map<
		string,
		{ label: string; description: string; knowledgeDependencies: string[] }
	>();
	const skillOrder: string[] = [];
	const shouldUseSkillAgents =
		(plan.sub_tasks?.length ?? 0) === 1 &&
		(plan.triples?.length ?? 0) === 0 &&
		Array.isArray(plan.sub_tasks?.[0]?.required_skills) &&
		plan.sub_tasks?.[0]?.required_skills?.length > 0;

	if (shouldUseSkillAgents) {
		const task = plan.sub_tasks?.[0];
		if (task) {
			const description = typeof task.description === "string" ? task.description.trim() : "";
			const knowledgeDependencies = Array.isArray(task.knowledge_dependencies)
				? task.knowledge_dependencies.map((item) => String(item).trim()).filter(Boolean)
				: [];
			const skills = Array.isArray(task.required_skills) ? task.required_skills : [];
			const seen = new Set<string>();
			skills.forEach((skill) => {
				const label = String(skill).trim();
				if (!label) return;
				const key = label.toLowerCase();
				if (!seen.has(key)) {
					skillOrder.push(label);
					seen.add(key);
				}
				skillMetadataByLabel.set(key, {
					label,
					description,
					knowledgeDependencies,
				});
			});
		}
	}

	const blockIdByKey = new Map<string, string>();
	const indexByKey = new Map<string, number>();
	const indexById = new Map<string, number>();

	let blockCount = 0;

	const ensureBlock = (label: string) => {
		const normalizedLabel = label.trim().toLowerCase();
		const resolved = findAgentRegistryEntryByIdOrName(label);
		const skillMeta = skillMetadataByLabel.get(normalizedLabel);
		const fallbackDescription =
			skillMeta?.description ?? taskDescriptionByLabel.get(normalizedLabel) ?? "";
		const key = resolved?.id ?? label;

		const existing = blockIdByKey.get(key);
		if (existing) return existing;

		const id = `block-${++blockCount}`;
		blockIdByKey.set(key, id);
		indexByKey.set(key, indexByKey.size);
		const index = indexByKey.get(key)!;
		indexById.set(id, index);

		const input = resolved ? listMandatoryOptional(resolved.input_data_streams) : { mandatory: [], optional: [] };
		const output = resolved ? listMandatoryOptional(resolved.output_data_streams) : { mandatory: [], optional: [] };
		const knowledgeDependencies = skillMeta?.knowledgeDependencies ?? [];
		const optionalInputs = mergeUnique(input.optional, knowledgeDependencies, input.mandatory);
		const inputNames = [...input.mandatory, ...optionalInputs];
		const outputNames = [...output.mandatory, ...output.optional];

		const inputCount = Math.min(MAX_IO, Math.max(MIN_IO, inputNames.length || 1));
		const outputCount = Math.min(MAX_IO, Math.max(MIN_IO, outputNames.length || 1));
		const mandatoryInputCount = Math.min(resolved ? input.mandatory.length : 0, inputCount);
		const mandatoryOutputCount = Math.min(resolved ? output.mandatory.length : 0, outputCount);

		blocks.push({
			id,
			x: START_X,
			y: START_Y,
			agentId: resolved?.id,
			name: resolved?.name ?? label,
			description: resolved?.description ?? fallbackDescription,
			inputCount,
			outputCount,
			inputRequired: Array.from({ length: inputCount }, (_, i) => i < mandatoryInputCount),
			outputRequired: Array.from({ length: outputCount }, (_, i) => i < mandatoryOutputCount),
			inputNames,
			outputNames,
			presetId: resolved?.id ?? "custom",
			mandatoryInputCount,
			mandatoryOutputCount,
		});

		return id;
	};

	if (shouldUseSkillAgents) {
		skillOrder.forEach((label) => {
			ensureBlock(label);
		});
	} else {
		plan.sub_tasks?.forEach((task) => {
			const label = task.name?.trim() || task.sub_task_id?.trim();
			if (label) ensureBlock(label);
		});
	}

	const triples = shouldUseSkillAgents
		? skillOrder.slice(0, -1).map((skill, index) => ({
			from: skill,
			to: skillOrder[index + 1],
		}))
		: normalizeTriples(plan);

	// Allocate input slots per target based on distinct inbound sources.
	const inboundOrder = new Map<string, string[]>();
	for (const t of triples) {
		const list = inboundOrder.get(t.to) ?? [];
		if (!list.includes(t.from)) list.push(t.from);
		inboundOrder.set(t.to, list);
	}

	// Allocate output ports per source based on distinct outbound targets.
	const outboundOrder = new Map<string, string[]>();
	for (const t of triples) {
		const list = outboundOrder.get(t.from) ?? [];
		if (!list.includes(t.to)) list.push(t.to);
		outboundOrder.set(t.from, list);
	}

	for (const triple of triples) {
		const fromId = ensureBlock(triple.from);
		const toId = ensureBlock(triple.to);

		const inbound = inboundOrder.get(triple.to) ?? [];
		const inputIndex = Math.max(0, inbound.indexOf(triple.from));

		const outbound = outboundOrder.get(triple.from) ?? [];
		const port = Math.max(0, outbound.indexOf(triple.to));

		connections.push({
			id: `conn-${connections.length + 1}`,
			from: { type: "block", id: fromId, port },
			to: { type: "block", id: toId, inputIndex },
		});
	}

	const adjacency = new Map<string, Set<string>>();
	const indegree = new Map<string, number>();
	for (const block of blocks) {
		adjacency.set(block.id, new Set());
		indegree.set(block.id, 0);
	}
	for (const conn of connections) {
		if (conn.from.type !== "block" || conn.to.type !== "block") continue;
		const neighbors = adjacency.get(conn.from.id);
		if (!neighbors) continue;
		if (!neighbors.has(conn.to.id)) {
			neighbors.add(conn.to.id);
			indegree.set(conn.to.id, (indegree.get(conn.to.id) ?? 0) + 1);
		}
	}

	const depthById = new Map<string, number>();
	const queue = Array.from(blocks)
		.filter((block) => (indegree.get(block.id) ?? 0) === 0)
		.sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0))
		.map((block) => block.id);

	queue.forEach((id) => depthById.set(id, 0));

	while (queue.length) {
		const currentId = queue.shift();
		if (!currentId) break;
		const currentDepth = depthById.get(currentId) ?? 0;
		const neighbors = adjacency.get(currentId);
		if (!neighbors) continue;
		for (const nextId of neighbors) {
			const nextDepth = currentDepth + 1;
			depthById.set(nextId, Math.max(depthById.get(nextId) ?? 0, nextDepth));
			const nextDegree = (indegree.get(nextId) ?? 0) - 1;
			indegree.set(nextId, nextDegree);
			if (nextDegree === 0) queue.push(nextId);
		}
	}

	const columns = new Map<number, string[]>();
	for (const block of blocks) {
		const depth = depthById.get(block.id) ?? 0;
		const list = columns.get(depth) ?? [];
		list.push(block.id);
		columns.set(depth, list);
	}

	const xById = new Map<string, number>();
	const yById = new Map<string, number>();
	for (const [depth, ids] of columns.entries()) {
		ids.sort((a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0));
		const gap = ids.length > 1 ? Y_GAP : 0;
		const startY = START_Y - ((ids.length - 1) * gap) / 2;
		ids.forEach((id, row) => {
			xById.set(id, START_X + depth * X_GAP);
			yById.set(id, startY + row * gap);
		});
	}

	const laidOutBlocks = blocks.map((block) => ({
		...block,
		x: xById.get(block.id) ?? block.x,
		y: yById.get(block.id) ?? block.y,
	}));

	return { blocks: laidOutBlocks, connections };
}

// -----------------------------------------------------------------------------
// Agent view download helpers (keep output minimal)
// -----------------------------------------------------------------------------

type PlanSubTaskFromBlock = NonNullable<PlanningBlock["sub_tasks"]>[number];

type PlanDownloadEntry = {
	task_id: string;
	main_task: string;
	sub_tasks: PlanSubTaskFromBlock[];
	triples: PlanningBlock["triples"];
};

type PlanSubPlanBundle = {
	sub_plans: PlanSubTaskFromBlock[];
};

type PlanSubPlanDownload = {
	sub_tasks: PlanSubTaskFromBlock[];
	triples: PlanningBlock["triples"];
};

const normalizeStringList = (value: string[] | undefined) =>
	Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

function normalizePlanTriples(triples: PlanningBlock["triples"] | undefined) {
	return (triples ?? [])
		.map((triple) => {
			const from = String(triple?.from ?? "").trim();
			const to = String(triple?.to ?? "").trim();
			if (!from || !to) return null;
			return {
				from,
				op: normalizePlanOp(triple?.op),
				to,
			} satisfies PlanningBlock["triples"][number];
		})
		.filter((triple): triple is PlanningBlock["triples"][number] => Boolean(triple));
}

function buildSubTasks(
	triples: PlanningBlock["triples"],
	existing: PlanningBlock["sub_tasks"] | undefined
) {
	const seen = new Set<string>();
	const result: PlanSubTaskFromBlock[] = [];

	const addTask = (task: PlanSubTaskFromBlock) => {
		const subTaskId = String(task.sub_task_id ?? "").trim();
		if (!subTaskId || seen.has(subTaskId)) return;
		const name = String(task.name ?? "").trim() || subTaskId;
		const description = typeof task.description === "string" ? task.description.trim() : "";
		const knowledgeDependencies = normalizeStringList(task.knowledge_dependencies);
		const requiredSkills = normalizeStringList(task.required_skills);
		const tools = normalizeStringList((task as any).Tools ?? (task as any).tools);

		const next: PlanSubTaskFromBlock = { sub_task_id: subTaskId, name };
		if (description) next.description = description;
		if (knowledgeDependencies.length) next.knowledge_dependencies = knowledgeDependencies;
		if (requiredSkills.length) next.required_skills = requiredSkills;
		if (tools.length) (next as any).Tools = tools;

		seen.add(subTaskId);
		result.push(next);
	};

	existing?.forEach((task) => addTask(task));

	const addId = (value: string) => {
		const subTaskId = String(value ?? "").trim();
		if (!subTaskId || seen.has(subTaskId)) return;
		seen.add(subTaskId);
		result.push({ sub_task_id: subTaskId, name: subTaskId });
	};

	triples.forEach((triple) => {
		addId(triple.from);
		addId(triple.to);
	});

	return result;
}

function buildPlanDownloadEntry(plan: PlanningBlock): PlanDownloadEntry {
	const normalizedTriples = normalizePlanTriples(plan.triples);
	const taskId = plan.task_id?.trim() || plan.id;
	const mainTask =
		plan.main_task?.trim() || plan.name?.trim() || plan.query?.trim() || plan.id;
	const subTasks = buildSubTasks(normalizedTriples, plan.sub_tasks);

	return {
		task_id: taskId,
		main_task: mainTask,
		sub_tasks: subTasks,
		triples: normalizedTriples,
	};
}

function buildPlanSubPlanBundle(plans: PlanningBlock[]): PlanSubPlanBundle {
	const extracted: PlanSubTaskFromBlock[] = [];
	const seen = new Set<string>();
	plans.forEach((plan) => {
		const task = plan.sub_tasks?.[0];
		if (!task) return;
		const subTaskId = String(task.sub_task_id ?? "").trim();
		if (!subTaskId || seen.has(subTaskId)) return;
		seen.add(subTaskId);
		extracted.push(task);
	});
	return { sub_plans: extracted };
}

function buildSubPlanDownload(
	plans: PlanningBlock[],
	connections: PlanConnections
): PlanSubPlanDownload {
	const subTasks: PlanSubTaskFromBlock[] = [];
	const seenIds = new Set<string>();
	const idByPlanId = new Map<string, string>();

	plans.forEach((plan) => {
		const existing = plan.sub_tasks?.[0];
		const mappedId = String(existing?.sub_task_id ?? plan.task_id ?? plan.id).trim() || plan.id;
		if (!mappedId) return;
		idByPlanId.set(plan.id, mappedId);
		if (seenIds.has(mappedId)) return;

		const name = String(existing?.name ?? plan.name ?? mappedId).trim() || mappedId;
		const description =
			typeof existing?.description === "string"
				? existing.description.trim()
				: plan.query?.trim() ?? "";

		const next: PlanSubTaskFromBlock = { sub_task_id: mappedId, name };
		if (description) next.description = description;

		seenIds.add(mappedId);
		subTasks.push(next);
	});

	const mappedConnections = (connections ?? [])
		.map((conn) => ({
			from: String(idByPlanId.get(conn.from) ?? conn.from ?? "").trim(),
			to: String(idByPlanId.get(conn.to) ?? conn.to ?? "").trim(),
			op: typeof conn.op === "string" ? normalizePlanOp(conn.op) : undefined,
		}))
		.filter((conn) => conn.from && conn.to);

	const inboundById = new Map<string, Set<string>>();
	const outboundById = new Map<string, Set<string>>();
	mappedConnections.forEach((conn) => {
		const inbound = inboundById.get(conn.to);
		if (inbound) inbound.add(conn.from);
		else inboundById.set(conn.to, new Set([conn.from]));
		const outbound = outboundById.get(conn.from);
		if (outbound) outbound.add(conn.to);
		else outboundById.set(conn.from, new Set([conn.to]));
	});

	const triples: PlanningBlock["triples"] = [];
	const seenTriples = new Set<string>();
	mappedConnections.forEach((conn) => {
		const key = `${conn.from}::${conn.to}`;
		if (seenTriples.has(key)) return;
		seenTriples.add(key);
		const inboundCount = inboundById.get(conn.to)?.size ?? 0;
		const outboundCount = outboundById.get(conn.from)?.size ?? 0;
		const fallbackOp = inboundCount > 1 ? "agg" : outboundCount > 1 ? "brn" : "seq";
		const op = conn.op ?? normalizePlanOp(fallbackOp);
		triples.push({ from: conn.from, op: normalizePlanOp(op), to: conn.to });
	});

	return { sub_tasks: subTasks, triples };
}

export function buildWorkflowTriplesFromAgentWorkflow(args: {
	blocks: AgentBlock[];
	connections: Connection[];
}): PlanJsonTriple[] {
	const { blocks, connections } = args;
	const labelByBlockId = new Map(
		(blocks ?? []).map((block) => [
			block.id,
			block.agentId?.trim() || block.sourceAgentId?.trim() || block.name?.trim() || block.id,
		] as const)
	);

	const inbound = new Map<string, Set<string>>();
	const outbound = new Map<string, Set<string>>();
	const edges: Array<{ fromId: string; toId: string }> = [];
	const seen = new Set<string>();

	(connections ?? []).forEach((conn) => {
		if (conn.from.type !== "block" || conn.to.type !== "block") return;
		const inputIndex = conn.to.inputIndex ?? 0;
		if (inputIndex >= TOOL_PORT_OFFSET) return;
		const fromId = conn.from.id;
		const toId = conn.to.id;
		if (!fromId || !toId) return;
		const key = `${fromId}::${toId}`;
		if (seen.has(key)) return;
		seen.add(key);
		edges.push({ fromId, toId });
		if (!outbound.has(fromId)) outbound.set(fromId, new Set());
		if (!inbound.has(toId)) inbound.set(toId, new Set());
		outbound.get(fromId)!.add(toId);
		inbound.get(toId)!.add(fromId);
	});

	const triples: Array<PlanJsonTriple | null> = edges.map((edge) => {
			const from = String(labelByBlockId.get(edge.fromId) ?? edge.fromId).trim();
			const to = String(labelByBlockId.get(edge.toId) ?? edge.toId).trim();
			if (!from || !to) return null;
			const inboundCount = inbound.get(edge.toId)?.size ?? 0;
			const outboundCount = outbound.get(edge.fromId)?.size ?? 0;
			let op: "seq" | "agg" | "brn" = "seq";
			if (inboundCount > 1) op = "agg";
			else if (outboundCount > 1) op = "brn";
			return { from, op: String(normalizePlanOp(op)), to };
		});

	return triples.filter((t): t is PlanJsonTriple => t !== null);
}

export function buildToolBindingsFromAgentWorkflow(args: {
	blocks: AgentBlock[];
	tools: ToolNode[];
	connections: Connection[];
}): Record<string, string[]> {
	const { blocks, tools, connections } = args;
	const toolById = new Map((tools ?? []).map((t) => [t.id, t] as const));

	const incomingByToolId = new Map<string, Set<string>>();
	(connections ?? []).forEach((c) => {
		if (c.from.type !== "tool") return;
		if (c.to.type !== "tool") return;
		const set = incomingByToolId.get(c.to.id);
		if (set) set.add(c.from.id);
		else incomingByToolId.set(c.to.id, new Set([c.from.id]));
	});

	const bindings: Record<string, string[]> = {};

	(blocks ?? []).forEach((block) => {
		const directToolIds = (connections ?? [])
			.filter(
				(c) =>
					c.from.type === "tool" &&
					c.to.type === "block" &&
					c.to.id === block.id &&
					(c.to.inputIndex ?? 0) >= TOOL_PORT_OFFSET
			)
			.map((c) => c.from.id);

		if (directToolIds.length === 0) return;

		const seen = new Set<string>();
		const stack = [...directToolIds];
		while (stack.length > 0) {
			const current = stack.pop();
			if (!current || seen.has(current)) continue;
			seen.add(current);
			const incoming = incomingByToolId.get(current);
			if (!incoming) continue;
			incoming.forEach((upstreamId) => {
				if (!seen.has(upstreamId)) stack.push(upstreamId);
			});
		}

		const toolNames = Array.from(seen)
			.map((id) => toolById.get(id)?.name?.trim() || id)
			.filter(Boolean);
		toolNames.sort((a, b) => a.localeCompare(b));
		if (toolNames.length === 0) return;

		const key =
			block.agentId?.trim() ||
			block.sourceAgentId?.trim() ||
			block.name?.trim() ||
			block.id;

		bindings[key] = toolNames;
	});

	return bindings;
}

// Back-compat API (previously lived in src/workflow/hydrateFromPlan.ts)
// Agent-view only: tools/uploads/outputs are empty; plan-view IO is handled elsewhere.
export function hydrateWorkflowFromPlan(plan: PlanningBlock): HydratedWorkflow {
	const hydrated = hydrateAgentViewFromPlan(plan);
	return {
		blocks: hydrated.blocks,
		tools: [],
		connections: hydrated.connections,
	};
}

function cloneJson<T>(value: T): T {
	// structuredClone is available in modern browsers; fallback keeps behavior in older contexts.
	try {
		return structuredClone(value);
	} catch {
		return JSON.parse(JSON.stringify(value)) as T;
	}
}

export function importAgentViewPlanJson(raw: unknown): { template: PlanJson; workflow: HydratedWorkflow } {
	if (!isRecord(raw) || !Array.isArray(raw["triples"])) {
		throw new Error("Invalid plan JSON (missing triples)");
	}

	const template = cloneJson(raw) as PlanJson;
	const plan = parsePlanningJSON(template);
	const hasTaskId = typeof template.task_id === "string" && template.task_id.trim().length > 0;
	const hasNewSchema = hasTaskId || typeof template.main_task === "string" || Array.isArray(template.sub_tasks);
	if (hasNewSchema) {
		template.task_id = plan.id;
	} else {
		template.plan_id = plan.id;
	}
	template.triples = plan.triples.map((triple) => ({
		from: triple.from,
		op: triple.op,
		to: triple.to,
	}));
	const embeddedWorkflow = template["workflow"];
	const workflow =
		isRecord(embeddedWorkflow) &&
		Array.isArray(embeddedWorkflow["blocks"]) &&
		Array.isArray(embeddedWorkflow["connections"]) &&
		Array.isArray(embeddedWorkflow["tools"])
			? {
				blocks: embeddedWorkflow["blocks"] as AgentBlock[],
				tools: embeddedWorkflow["tools"] as ToolNode[],
				connections: embeddedWorkflow["connections"] as Connection[],
			}
			: hydrateWorkflowFromPlan(plan);
	return { template, workflow };
}

// -----------------------------------------------------------------------------
// Upload + Download hooks (moved here to keep upload/download logic in planning)
// -----------------------------------------------------------------------------

function normalizeBlocksWithRegistry(blocks: AgentBlock[], availableAgents: AgentRegistryEntry[]) {
	return blocks.map((b) => {
		const maybeAgent =
			getAgentRegistryEntryById(b.agentId, availableAgents) ??
			findAgentRegistryEntryByIdOrName(b.name, availableAgents);

		if (!maybeAgent) return b;

		const io = buildIoFromStreams({
			input: maybeAgent.input_data_streams,
			output: maybeAgent.output_data_streams,
		});

		const rawInputCount = Number(b.inputCount);
		const rawOutputCount = Number(b.outputCount);
		const inputCount = Math.max(1, Number.isFinite(rawInputCount) ? rawInputCount : 1, io.inputCount);
		const outputCount = Math.max(1, Number.isFinite(rawOutputCount) ? rawOutputCount : 1, io.outputCount);

		const mergeNames = (existing: unknown, fallback: string[], length: number) => {
			const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => String(v)) : [];
			return Array.from({ length }, (_, i) => ex[i] ?? fallback[i] ?? "");
		};

		const ensureRequired = (existing: unknown, length: number, mandatoryCount: number) => {
			const ex = Array.isArray(existing) ? (existing as unknown[]).map((v) => Boolean(v)) : [];
			return Array.from({ length }, (_, i) => (i < mandatoryCount ? true : ex[i] ?? false));
		};

		return {
			...b,
			agentId: b.agentId ?? maybeAgent.id,
			name: maybeAgent.name ?? b.name,
			description: maybeAgent.description ?? b.description,
			inputCount,
			outputCount,
			mandatoryInputCount: io.mandatoryInputCount,
			mandatoryOutputCount: io.mandatoryOutputCount,
			inputNames: mergeNames(b.inputNames, io.inputNames, inputCount),
			outputNames: mergeNames(b.outputNames, io.outputNames, outputCount),
			inputRequired: ensureRequired(b.inputRequired, inputCount, io.mandatoryInputCount),
			outputRequired: ensureRequired(b.outputRequired, outputCount, io.mandatoryOutputCount),
		} satisfies AgentBlock;
	});
}

function enablePortsFromConnections(blocks: AgentBlock[], connections: Connection[]) {
	const blocksWithUsedPorts: AgentBlock[] = blocks.map((b) => ({
		...b,
		inputRequired: [...(b.inputRequired ?? [])],
		outputRequired: [...(b.outputRequired ?? [])],
	}));
	const mutableById = new Map(blocksWithUsedPorts.map((b) => [b.id, b] as const));
	for (const conn of connections) {
		if (conn.from.type === "block") {
			const b = mutableById.get(conn.from.id);
			if (b && conn.from.port >= 0 && conn.from.port < b.outputRequired.length) {
				b.outputRequired[conn.from.port] = true;
			}
		}
		if (conn.to.type === "block") {
			const idx = conn.to.inputIndex ?? 0;
			if (idx >= 0 && idx < TOOL_PORT_OFFSET) {
				const b = mutableById.get(conn.to.id);
				if (b && idx < b.inputRequired.length) b.inputRequired[idx] = true;
			}
		}
	}
	return blocksWithUsedPorts;
}

export function useWorkflowImport(args: {
	availableAgents: AgentRegistryEntry[];
	agentPlanTemplateRef: React.MutableRefObject<unknown | null>;
	bumpIdCounters: (args: {
		blocks?: Array<{ id: string }>;
		tools?: Array<{ id: string }>;
		connections?: Array<{ id: string }>;
	}) => void;
	linkingRef: React.MutableRefObject<boolean>;
	recalcBlockPorts: (connections: Connection[], blocks: AgentBlock[]) => AgentBlock[];
	setBlocks: SetState<AgentBlock[]>;
	setTools: SetState<ToolNode[]>;
	setConnections: SetState<Connection[]>;
	setSelectedEvals: SetState<string[]>;
	setSelected: SetState<Selection>;
	setHoveredInput: SetState<LinkTarget | null>;
	setHoveredOutput: SetState<LinkSource | null>;
	setHoveredBlockId: SetState<string | null>;
	setHoveredToolId: SetState<string | null>;
	setLinking: SetState<
		|
			{
				origin: "output";
				from: LinkSource;
				current: { x: number; y: number };
			}
		|
			{
				origin: "input";
				target: LinkTarget;
				current: { x: number; y: number };
			}
		| null
	>;
	setViewMode: SetState<ViewMode>;
}) {
	const {
		agentPlanTemplateRef,
		availableAgents,
		bumpIdCounters,
		linkingRef,
		recalcBlockPorts,
		setBlocks,
		setConnections,
		setHoveredBlockId,
		setHoveredInput,
		setHoveredOutput,
		setHoveredToolId,
		setLinking,
		setSelected,
		setSelectedEvals,
		setTools,
		setViewMode,
	} = args;

	const resetWorkspaceUi = useCallback(() => {
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

	const applyPlanJson = useCallback(
		(src: unknown) => {
			const imported = importAgentViewPlanJson(src);
			agentPlanTemplateRef.current = imported.template;

			resetWorkspaceUi();

			const loadedBlocks = imported.workflow.blocks;
			const loadedTools = imported.workflow.tools ?? [];
			const loadedConnections = imported.workflow.connections;

			const normalizedBlocks = normalizeBlocksWithRegistry(loadedBlocks, availableAgents);
			const normalizedConnections = loadedConnections.map((c: Connection) => {
				const next = { ...c } as Connection;
				if (next.from.type === "block") {
					next.from = { ...next.from, port: clamp(next.from.port, 0, MAX_IO - 1) };
				}
				if (next.to.type === "block") {
					const idx = next.to.inputIndex ?? 0;
					if (idx < TOOL_PORT_OFFSET) {
						next.to = { ...next.to, inputIndex: clamp(idx, 0, MAX_IO - 1) };
					}
				}
				return next;
			});

			const blocksWithUsedPorts = enablePortsFromConnections(normalizedBlocks, normalizedConnections);

			setBlocks(blocksWithUsedPorts);
			setTools(loadedTools);
			setSelectedEvals([]);
			setConnections(normalizedConnections);
			setBlocks((prev) => recalcBlockPorts(normalizedConnections, prev));

			bumpIdCounters({
				blocks: blocksWithUsedPorts,
				connections: normalizedConnections,
				tools: loadedTools,
			});

			setViewMode("agent");
		},
		[
			agentPlanTemplateRef,
			availableAgents,
			bumpIdCounters,
			recalcBlockPorts,
			resetWorkspaceUi,
			setBlocks,
			setConnections,
			setSelectedEvals,
			setTools,
			setViewMode,
		]
	);

	const handleUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (ev) => {
				try {
					const src = JSON.parse(ev.target?.result as string);
					const kind = detectWorkflowType(src);

					if (kind === "planning") {
						applyPlanJson(src);
						return;
					}

					if (kind === "agent") {
						resetWorkspaceUi();

						const loadedBlocks = Array.isArray(src.blocks) ? (src.blocks as AgentBlock[]) : [];
						const normalizedBlocks = normalizeBlocksWithRegistry(loadedBlocks, availableAgents);
						const normalizedBlockById = new Map(normalizedBlocks.map((b) => [b.id, b] as const));

						const loadedConnections = (src.connections ?? []).map((c: Connection) => {
							const next = { ...c } as Connection;
							if (next.from.type === "block") {
								const fromBlock = normalizedBlockById.get(next.from.id);
								const maxPort = Math.max(0, (fromBlock?.outputCount ?? 1) - 1);
								next.from = { ...next.from, port: Math.max(0, Math.min(maxPort, next.from.port)) };
							}
							if (next.to.type === "block") {
								const toBlock = normalizedBlockById.get(next.to.id);
								const idx = next.to.inputIndex ?? 0;
								if (idx < TOOL_PORT_OFFSET) {
									const maxIdx = Math.max(0, (toBlock?.inputCount ?? 1) - 1);
									next.to = { ...next.to, inputIndex: Math.max(0, Math.min(maxIdx, idx)) };
								}
							}
							return next;
						});

						const blocksWithUsedPorts = enablePortsFromConnections(normalizedBlocks, loadedConnections);

						setBlocks(blocksWithUsedPorts);
						setTools(src.tools ?? []);
						setSelectedEvals(src.evals ?? []);
						setConnections(loadedConnections);
						setBlocks((prev) => recalcBlockPorts(loadedConnections, prev));
						agentPlanTemplateRef.current = null;

						bumpIdCounters({
							blocks: blocksWithUsedPorts,
							tools: src.tools ?? [],
							connections: loadedConnections,
						});
						return;
					}

					throw new Error("Unsupported workflow");
				} catch {
					alert("Invalid workflow file");
				}
			};

			reader.readAsText(file);
			e.target.value = "";
		},
		[
			agentPlanTemplateRef,
			applyPlanJson,
			availableAgents,
			bumpIdCounters,
			recalcBlockPorts,
			resetWorkspaceUi,
			setBlocks,
			setConnections,
			setSelectedEvals,
			setTools,
		]
	);

	return { applyPlanJson, handleUpload };
}

type SnapshotBuilder = () => PlanningBlock["workflow"];

export function useWorkflowDownload(args: {
	viewMode: ViewMode;
	activePlanId: string | null;
	plans: PlanningBlock[];
	planConnections: PlanConnections;
	buildPlanWorkflowSnapshot: SnapshotBuilder;
	planStackDepth?: number;
	agentPlanTemplateRef?: React.MutableRefObject<unknown | null>;
}) {
	const {
		viewMode,
		plans,
		planConnections,
		buildPlanWorkflowSnapshot,
		planStackDepth = 0,
		agentPlanTemplateRef,
	} = args;

	const downloadLabel = "Download Workflow";

	const handleDownload = useCallback(() => {
		if (viewMode === "plan") {
			if (planStackDepth > 0) {
				const payload = buildSubPlanDownload(plans, planConnections);
				downloadWorkflow(payload, "plans.json");
				return;
			}
			const rootPlan = plans.length === 1 ? plans[0] : null;
			const nestedPlans = rootPlan?.sub_plans?.plans ?? [];
			if (nestedPlans.length > 0) {
				// IMPORTANT: do not serialize sub_plans here; keep the accepted root-plan schema.
				const payload = buildPlanDownloadEntry(rootPlan!);
				downloadWorkflow(payload, "plans.json");
				return;
			}
			const single = plans.length === 1 ? plans[0] : null;
			if (single) {
				downloadWorkflow(buildPlanDownloadEntry(single), "plans.json");
				return;
			}
			downloadWorkflow(buildPlanSubPlanBundle(plans), "plans.json");
			return;
		}

		const workflowSnapshot = buildPlanWorkflowSnapshot();
		if (!workflowSnapshot) {
			downloadWorkflow({ triples: [] }, "triples.json");
			return;
		}

		const blocks = workflowSnapshot.blocks ?? [];
		const tools = workflowSnapshot.tools ?? [];
		const connections = workflowSnapshot.connections ?? [];

		if (agentPlanTemplateRef?.current && isRecord(agentPlanTemplateRef.current)) {
			const triples = buildWorkflowTriplesFromAgentWorkflow({ blocks, connections });
			const payload: Record<string, unknown> = {
				...agentPlanTemplateRef.current,
				triples,
			};
			if (Array.isArray((payload as any).sub_tasks)) {
				(payload as any).sub_tasks = (payload as any).sub_tasks.map((task: any) => {
					if (!isRecord(task)) return task;
					const tools = normalizeStringList((task as any).Tools ?? (task as any).tools);
					const next = { ...task } as any;
					if (tools.length) next.Tools = tools;
					if ("tools" in next) delete next.tools;
					return next;
				});
			}
			// keep output minimal
			if ("workflow" in payload) delete (payload as any).workflow;

			const toolBindings = buildToolBindingsFromAgentWorkflow({ blocks, tools, connections });

			// If we're exporting a single-subtask agent workflow, prefer the plan's declared Tools.
			// This keeps agent-view exports aligned with plan JSON when tools aren't explicitly modeled.
			const normalizedSubTasks = Array.isArray((payload as any).sub_tasks)
				? ((payload as any).sub_tasks as any[]).filter((t) => isRecord(t))
				: [];
			const declaredTools =
				normalizedSubTasks.length === 1
					? normalizeStringList((normalizedSubTasks[0] as any).Tools ?? (normalizedSubTasks[0] as any).tools)
					: [];
			if (blocks.length === 1 && declaredTools.length > 0) {
				const block = blocks[0];
				const key =
					block.agentId?.trim() ||
					block.sourceAgentId?.trim() ||
					block.name?.trim() ||
					block.id;
				payload.tool_bindings = { [key]: declaredTools };
			} else if (Object.keys(toolBindings).length > 0) {
				payload.tool_bindings = toolBindings;
			} else if ("tool_bindings" in payload) {
				delete (payload as any).tool_bindings;
			}

			downloadWorkflow(payload, "triples.json");
			return;
		}

		// Fallback export if we didn't come from an uploaded plan template.
		const triples = buildWorkflowTriplesFromAgentWorkflow({ blocks, connections });
		downloadWorkflow({ triples }, "triples.json");
	}, [
		agentPlanTemplateRef,
		buildPlanWorkflowSnapshot,
		planStackDepth,
		planConnections,
		plans,
		viewMode,
	]);

	return { downloadLabel, handleDownload };
}

// -----------------------------------------------------------------------------
// Plan View IO streams
// -----------------------------------------------------------------------------

// TODO: Plan-view upload/download will be reworked later.
