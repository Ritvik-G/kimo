import type { MappingRow } from "./types";

export const normalizeMappings = (rows: MappingRow[], inputs: string[], outputs: string[]) =>
  rows.map((row) => ({
    ...row,
    input: inputs.includes(row.input) ? row.input : inputs[0] ?? "",
    output: outputs.includes(row.output) ? row.output : outputs[0] ?? "",
  }));

export const uniqueList = (value: string[]) =>
  Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
