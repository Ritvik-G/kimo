// =============================================================================
// Evals Modal Component - Evaluation metrics selection
// =============================================================================

import type { EvalOption } from "../../shared/types";
import { iconPaths } from "../../shared/assets";

type Props = {
  evalOptions: EvalOption[];
  selectedEvals: string[];
  onClose: () => void;
  onToggleEval: (evalId: string) => void;
  onClearAll: () => void;
};

export default function EvalsModal({
  evalOptions,
  selectedEvals,
  onClose,
  onToggleEval,
  onClearAll,
}: Props) {
  const categories = Array.from(new Set(evalOptions.map((opt) => opt.category)));

  const CATEGORY_STYLES: Record<
    string,
    { dot: string; selected: string; title: string; active: string }
  > = {
    Performance: {
      dot: "bg-emerald-500",
      selected: "bg-emerald-50 border border-emerald-200",
      title: "text-emerald-900",
      active: "text-emerald-600",
    },
    Quality: {
      dot: "bg-sky-500",
      selected: "bg-sky-50 border border-sky-200",
      title: "text-sky-900",
      active: "text-sky-600",
    },
    Safety: {
      dot: "bg-rose-500",
      selected: "bg-rose-50 border border-rose-200",
      title: "text-rose-900",
      active: "text-rose-600",
    },
    Efficiency: {
      dot: "bg-amber-500",
      selected: "bg-amber-50 border border-amber-200",
      title: "text-amber-900",
      active: "text-amber-600",
    },
    Default: {
      dot: "bg-slate-500",
      selected: "bg-slate-50 border border-slate-200",
      title: "text-slate-900",
      active: "text-slate-600",
    },
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-card w-[680px] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="modal-close-wrap">
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <img
              src={iconPaths.close}
              alt=""
              className="h-4 w-4 invert"
              draggable={false}
            />
          </button>
        </div>

        <div className="max-h-[85vh] overflow-y-auto p-6 text-slate-900">
          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Evaluation Metrics
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Select metrics to monitor agent performance and quality
                </p>
              </div>
              <span className="pill-tag text-xs bg-indigo-50 text-indigo-700">
                {selectedEvals.length} Selected
              </span>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-5">
            {categories.map((category) => {
              const categoryOptions = evalOptions.filter(
                (opt) => opt.category === category
              );
              const styles = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.Default;

              return (
                <div
                  key={category}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      {category}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {categoryOptions.map((option) => {
                      const isSelected = selectedEvals.includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? styles.selected
                              : "bg-slate-50 border border-transparent hover:border-slate-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleEval(option.id)}
                            className="mt-0.5 h-4 w-4 rounded border-2 border-slate-300 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-sm font-semibold ${
                                  isSelected ? styles.title : "text-slate-800"
                                }`}
                              >
                                {option.name}
                              </span>
                              {isSelected && (
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wide ${styles.active}`}
                                >
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {option.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClearAll}
            >
              Clear All
            </button>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                onClick={onClose}
              >
                Apply Metrics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
