import { useMemo, useRef, useState } from "react";
import { EVAL_OPTIONS } from "../../shared/constants";
import { StreamPanel, MetricLibrary, MappingList } from "../../components/evaluation";
import { CATEGORY_STYLES, DEFAULT_INPUTS, DEFAULT_OUTPUTS, DEFAULT_MAPPINGS } from "./constants";
import { normalizeMappings, uniqueList } from "./utils";
import type { MappingRow } from "./types";

export default function EvaluationPage() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [outputs, setOutputs] = useState(DEFAULT_OUTPUTS);
  const [mappings, setMappings] = useState(DEFAULT_MAPPINGS);
  const [inputDraft, setInputDraft] = useState("");
  const [outputDraft, setOutputDraft] = useState("");
  const nextMappingId = useRef(DEFAULT_MAPPINGS.length + 1);

  const metricGroups = useMemo(() => {
    const groups: Record<string, typeof EVAL_OPTIONS> = {};
    EVAL_OPTIONS.forEach((option) => {
      if (!groups[option.category]) {
        groups[option.category] = [];
      }
      groups[option.category].push(option);
    });
    return groups;
  }, []);

  const metricsInUse = useMemo(() => {
    const metrics = new Set<string>();
    mappings.forEach((row) => row.metrics.forEach((metric) => metrics.add(metric)));
    return metrics;
  }, [mappings]);

  const inputsWithMappings = useMemo(() => {
    const mapped = new Set<string>();
    mappings.forEach((row) => {
      if (row.input) mapped.add(row.input);
    });
    return mapped;
  }, [mappings]);

  const summary = useMemo(() => {
    const mappingCount = mappings.length;
    const coverage = inputs.length ? Math.round((inputsWithMappings.size / inputs.length) * 100) : 0;
    const metricCoverage = EVAL_OPTIONS.length
      ? Math.round((metricsInUse.size / EVAL_OPTIONS.length) * 100)
      : 0;
    const activeMappings = mappings.filter((row) => row.metrics.length > 0).length;
    return {
      mappingCount,
      coverage,
      metricCoverage,
      activeMappings,
    };
  }, [inputs.length, inputsWithMappings.size, mappings, metricsInUse.size]);

  const handleAddInput = () => {
    const trimmed = inputDraft.trim();
    if (!trimmed || inputs.includes(trimmed)) return;
    const nextInputs = uniqueList([...inputs, trimmed]);
    setInputs(nextInputs);
    setMappings((prev) => normalizeMappings(prev, nextInputs, outputs));
    setInputDraft("");
  };

  const handleRemoveInput = (value: string) => {
    const nextInputs = inputs.filter((item) => item !== value);
    setInputs(nextInputs);
    setMappings((prev) => normalizeMappings(prev, nextInputs, outputs));
  };

  const handleAddOutput = () => {
    const trimmed = outputDraft.trim();
    if (!trimmed || outputs.includes(trimmed)) return;
    const nextOutputs = uniqueList([...outputs, trimmed]);
    setOutputs(nextOutputs);
    setMappings((prev) => normalizeMappings(prev, inputs, nextOutputs));
    setOutputDraft("");
  };

  const handleRemoveOutput = (value: string) => {
    const nextOutputs = outputs.filter((item) => item !== value);
    setOutputs(nextOutputs);
    setMappings((prev) => normalizeMappings(prev, inputs, nextOutputs));
  };

  const handleAddMapping = () => {
    const id = `map-${nextMappingId.current++}`;
    const nextRow: MappingRow = {
      id,
      input: inputs[0] ?? "",
      output: outputs[0] ?? "",
      metrics: [],
      owner: "Evaluation lead",
      threshold: "TBD",
      cadence: "Weekly",
    };
    setMappings((prev) => [...prev, nextRow]);
  };

  const handleRemoveMapping = (id: string) => {
    setMappings((prev) => prev.filter((row) => row.id !== id));
  };

  const handleMappingChange = <K extends keyof MappingRow>(
    id: string,
    key: K,
    value: MappingRow[K],
  ) => {
    setMappings((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  };

  const toggleMetric = (id: string, metricId: string) => {
    setMappings((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const hasMetric = row.metrics.includes(metricId);
        const nextMetrics = hasMetric
          ? row.metrics.filter((metric) => metric !== metricId)
          : [...row.metrics, metricId];
        return { ...row, metrics: nextMetrics };
      }),
    );
  };

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Evaluation page
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Input to evaluation to output map
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Define how each input stream is scored, which metrics fire, and what outputs should
              be produced.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/workflow";
              }}
            >
              Workflow builder
            </button>
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/agentgen";
              }}
            >
              AgentGen
            </button>
            <button
              className="btn-pill btn-pill-light"
              onClick={() => {
                window.location.hash = "#/planning";
              }}
            >
              Planning
            </button>
            <button
              className="btn-pill btn-pill-sky"
              onClick={handleAddMapping}
            >
              Add mapping
            </button>
          </div>
        </header>

        <section className="mt-10 panel bg-white/80">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Coverage
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Evaluation blueprint</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="badge font-semibold text-slate-700">
                Inputs: {inputs.length}
              </span>
              <span className="badge font-semibold text-slate-700">
                Outputs: {outputs.length}
              </span>
              <span className="badge font-semibold text-slate-700">
                Mappings: {summary.mappingCount}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Input coverage
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.coverage}%</p>
              <p className="mt-1 text-xs text-slate-600">
                {inputsWithMappings.size} of {inputs.length} inputs mapped
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                Metrics coverage
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.metricCoverage}%</p>
              <p className="mt-1 text-xs text-slate-600">
                {metricsInUse.size} of {EVAL_OPTIONS.length} metrics in use
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Active mappings
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.activeMappings}</p>
              <p className="mt-1 text-xs text-slate-600">Mappings with at least one metric</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <StreamPanel
            title="Inputs"
            countLabel={`${inputs.length} streams`}
            items={inputs}
            emptyLabel="No inputs yet. Add one below."
            placeholder="Add input stream"
            draft={inputDraft}
            onDraftChange={setInputDraft}
            onAdd={handleAddInput}
            onRemove={handleRemoveInput}
            inputFocusRingClass="focus:ring-sky-400"
          />

          <MetricLibrary metricGroups={metricGroups} categoryStyles={CATEGORY_STYLES} />

          <StreamPanel
            title="Outputs"
            countLabel={`${outputs.length} channels`}
            items={outputs}
            emptyLabel="No outputs yet. Add one below."
            placeholder="Add output channel"
            draft={outputDraft}
            onDraftChange={setOutputDraft}
            onAdd={handleAddOutput}
            onRemove={handleRemoveOutput}
            inputFocusRingClass="focus:ring-emerald-400"
          />
        </section>

        <MappingList
          mappings={mappings}
          inputs={inputs}
          outputs={outputs}
          metricGroups={metricGroups}
          categoryStyles={CATEGORY_STYLES}
          onAddMapping={handleAddMapping}
          onRemoveMapping={handleRemoveMapping}
          onMappingChange={handleMappingChange}
          onToggleMetric={toggleMetric}
        />
      </div>
    </div>
  );
}
