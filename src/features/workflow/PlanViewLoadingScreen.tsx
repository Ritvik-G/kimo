import type { ReactElement } from "react";

type Props = {
  theme: "light" | "dark";
};

export default function PlanViewLoadingScreen({ theme }: Props): ReactElement {
  const surfaceClass =
    theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const spinnerClass =
    theme === "dark"
      ? "border-slate-800 border-t-slate-100"
      : "border-slate-200 border-t-slate-700";

  return (
    <div className={`absolute inset-0 z-50 flex items-center justify-center ${surfaceClass}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`h-10 w-10 animate-spin rounded-full border-4 ${spinnerClass}`} />
        <div className="text-sm font-semibold tracking-wide">Loading plan view…</div>
      </div>
    </div>
  );
}
