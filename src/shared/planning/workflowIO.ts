import { MAX_IO, MIN_IO, listMandatoryOptional } from "../constants";
import { clamp, isRecord } from "../utils";

export function buildIoFromStreams(args: {
	input: { mandatory: string[]; optional?: string[] };
	output: { mandatory: string[]; optional?: string[] };
}) {
	const input = listMandatoryOptional(args.input);
	const output = listMandatoryOptional(args.output);

	const desiredInputs = clamp(input.mandatory.length + input.optional.length, MIN_IO, MAX_IO);
	const desiredOutputs = clamp(output.mandatory.length + output.optional.length, MIN_IO, MAX_IO);

	const mandatoryInputCount = Math.min(input.mandatory.length, desiredInputs);
	const mandatoryOutputCount = Math.min(output.mandatory.length, desiredOutputs);

	const inputNames = [...input.mandatory, ...input.optional].slice(0, desiredInputs);
	const outputNames = [...output.mandatory, ...output.optional].slice(0, desiredOutputs);

	const inputRequired = Array.from({ length: desiredInputs }, (_, i) => i < mandatoryInputCount);
	const outputRequired = Array.from({ length: desiredOutputs }, (_, i) => i < mandatoryOutputCount);

	return {
		inputCount: desiredInputs,
		outputCount: desiredOutputs,
		mandatoryInputCount,
		mandatoryOutputCount,
		inputRequired,
		outputRequired,
		inputNames,
		outputNames,
	};
}

export function detectWorkflowType(src: unknown): "planning" | "agent" | "unknown" {
	if (!isRecord(src)) return "unknown";

	// Plan JSON schema: { plan_id, triples, ... }
	if (typeof src.plan_id === "string" || Array.isArray(src.triples)) return "planning";

	// Agent workflow snapshot: { blocks, tools, connections, ... }
	if (Array.isArray(src.blocks) && Array.isArray(src.connections)) return "agent";

	return "unknown";
}
