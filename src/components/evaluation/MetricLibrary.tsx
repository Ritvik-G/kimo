import type { EvalOption } from "../../shared/types";
import type { CategoryStyle } from "../../features/evaluation/types";

type Props = {
  metricGroups: Record<string, EvalOption[]>;
  categoryStyles: Record<string, CategoryStyle>;
};

export default function MetricLibrary({ metricGroups, categoryStyles }: Props) {
  return (
    <div className="panel bg-white/85">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
          Metrics library
        </h3>
        <span className="badge text-[11px] font-semibold text-slate-600">
          {Object.values(metricGroups).reduce((sum, list) => sum + list.length, 0)} metrics
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {Object.entries(metricGroups).map(([category, metrics]) => {
          const style = categoryStyles[category] ?? categoryStyles.Default;
          return (
            <div key={category} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {category}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {metrics.map((metric) => (
                  <span
                    key={metric.id}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${style.chip}`}
                  >
                    {metric.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
