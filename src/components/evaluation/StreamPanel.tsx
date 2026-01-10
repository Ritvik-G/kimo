type Props = {
  title: string;
  countLabel: string;
  items: string[];
  emptyLabel: string;
  placeholder: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  inputFocusRingClass: string;
};

export default function StreamPanel({
  title,
  countLabel,
  items,
  emptyLabel,
  placeholder,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  inputFocusRingClass,
}: Props) {
  return (
    <div className="panel bg-white/85">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
          {title}
        </h3>
        <span className="badge text-[11px] font-semibold text-slate-600">
          {countLabel}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span key={item} className="group chip">
              {item}
              <button
                type="button"
                className="chip-close"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item}`}
              >
                x
              </button>
            </span>
          ))
        ) : (
          <p className="text-xs text-slate-500">{emptyLabel}</p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className={`flex-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 ${inputFocusRingClass}`}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <button
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
          onClick={onAdd}
        >
          Add
        </button>
      </div>
    </div>
  );
}
