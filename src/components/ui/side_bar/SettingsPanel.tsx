// =============================================================================
// Settings Panel Component - Theme and settings panel
// =============================================================================

import type { Theme } from "../../../shared/types";

type Props = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export default function SettingsPanel({ theme, onThemeChange }: Props) {
  return (
    <div className="mt-4 space-y-5 text-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Theme</p>
        <div className="flex items-center gap-2">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                theme === mode
                  ? "bg-slate-900 text-white border-slate-700 shadow-sm"
                  : "bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => onThemeChange(mode)}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  mode === "light" ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              {mode === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Links</p>
        <div className="flex flex-wrap gap-2">
          {["Docs", "Changelog", "Support"].map((label) => (
            <button
              key={label}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Add {label} link
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
