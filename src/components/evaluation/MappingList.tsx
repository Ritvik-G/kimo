import type { EvalOption } from "../../shared/types";
import type { CategoryStyle, MappingRow } from "../../features/evaluation/types";

type MappingChangeHandler = <K extends keyof MappingRow>(
  id: string,
  key: K,
  value: MappingRow[K]
) => void;

type Props = {
  mappings: MappingRow[];
  inputs: string[];
  outputs: string[];
  metricGroups: Record<string, EvalOption[]>;
  categoryStyles: Record<string, CategoryStyle>;
  onAddMapping: () => void;
  onRemoveMapping: (id: string) => void;
  onMappingChange: MappingChangeHandler;
  onToggleMetric: (id: string, metricId: string) => void;
};

export default function MappingList({
  mappings,
  inputs,
  outputs,
  metricGroups,
  categoryStyles,
  onAddMapping,
  onRemoveMapping,
  onMappingChange,
  onToggleMetric,
}: Props) {
  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Mapping table
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            Input to evaluation to output
          </h2>
        </div>
        <button
          className="rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-500"
          onClick={onAddMapping}
        >
          Add mapping
        </button>
      </div>

      {!mappings.length && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
          No mappings yet. Add one to connect inputs to evaluation outputs.
        </div>
      )}

      {mappings.map((row, index) => (
        <div
          key={row.id}
          className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Mapping {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {row.input || "Unassigned input"}
                {" -> "}
                {row.output || "Unassigned output"}
              </p>
            </div>
            <button
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              onClick={() => onRemoveMapping(row.id)}
            >
              Remove
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_minmax(0,0.9fr)]">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Input stream
              </p>
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                value={row.input}
                onChange={(event) => onMappingChange(row.id, "input", event.target.value)}
              >
                {!inputs.length && <option value="">No inputs available</option>}
                {inputs.map((input) => (
                  <option key={input} value={input}>
                    {input}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Tie the evaluation to the incoming stream.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Evaluation metrics
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {row.metrics.length} selected
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {Object.entries(metricGroups).map(([category, metrics]) => {
                  const style = categoryStyles[category] ?? categoryStyles.Default;
                  return (
                    <div key={`${row.id}-${category}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {category}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {metrics.map((metric) => {
                          const isSelected = row.metrics.includes(metric.id);
                          return (
                            <button
                              key={`${row.id}-${metric.id}`}
                              type="button"
                              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                isSelected ? style.selected : style.idle
                              }`}
                              onClick={() => onToggleMetric(row.id, metric.id)}
                            >
                              {metric.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Output channel
              </p>
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                value={row.output}
                onChange={(event) => onMappingChange(row.id, "output", event.target.value)}
              >
                {!outputs.length && <option value="">No outputs available</option>}
                {outputs.map((output) => (
                  <option key={output} value={output}>
                    {output}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Owner
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={row.owner}
                  onChange={(event) => onMappingChange(row.id, "owner", event.target.value)}
                />
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Threshold
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={row.threshold}
                  onChange={(event) => onMappingChange(row.id, "threshold", event.target.value)}
                />
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Cadence
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={row.cadence}
                  onChange={(event) => onMappingChange(row.id, "cadence", event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
