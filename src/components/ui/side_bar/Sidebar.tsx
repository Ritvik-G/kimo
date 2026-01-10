// =============================================================================
// Sidebar Component - Main sidebar with tabs and panels
// =============================================================================

import type { DragEvent } from "react";
import type { AgentRegistryEntry, PanelKey, Theme, ToolPreset, ViewMode } from "../../../shared/types";
import type { PlanTemplate } from "../../../shared/types/planning";
import { PANEL_TABS, PANEL_TITLES } from "../../../shared/constants";
import { iconPaths } from "../../../shared/assets";
import BlocksPanel from "./BlocksPanel";
import ToolsPanel from "./ToolsPanel";
import SettingsPanel from "./SettingsPanel";

type Props = {
  activePanel: PanelKey | null;
  theme: Theme;
  viewMode: ViewMode;
  registryAgents: AgentRegistryEntry[];
  customAgents: AgentRegistryEntry[];
  planTemplates: PlanTemplate[];
  toolPalette: ToolPreset[];
  onPanelChange: (panel: PanelKey | null) => void;
  onThemeChange: (theme: Theme) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onAgentDragStart: (agentId: string) => (e: DragEvent<HTMLDivElement>) => void;
  onPlanDragStart: (template?: PlanTemplate) => (e: DragEvent<HTMLDivElement>) => void;
  onToolDragStart: (toolName: string) => (e: DragEvent<HTMLDivElement>) => void;
};

export default function Sidebar({
  activePanel,
  theme,
  viewMode,
  registryAgents,
  customAgents,
  planTemplates,
  toolPalette,
  onPanelChange,
  onThemeChange,
  onViewModeChange,
  onAgentDragStart,
  onPlanDragStart,
  onToolDragStart,
}: Props) {
  const visibleTabs = viewMode === "plan" ? PANEL_TABS.filter((t) => t.id !== "tools") : PANEL_TABS;

  return (
    <div className="absolute left-0 top-0 bottom-0 z-30 flex">
      <div className="flex flex-col items-center gap-2 bg-slate-900/95 px-2 py-3 text-white shadow-xl">
        <button
          className={`h-12 w-12 rounded-md border border-slate-700 text-[11px] font-semibold transition whitespace-pre-line leading-tight ${
            viewMode === "plan"
              ? "bg-white text-slate-900 shadow-sm"
              : "bg-slate-800/70 text-white hover:bg-slate-800"
          }`}
          onClick={() => onViewModeChange(viewMode === "plan" ? "agent" : "plan")}
          aria-label={viewMode === "plan" ? "Switch to agent view" : "Switch to plan view"}
          title={viewMode === "plan" ? "Plan view" : "Agent view"}
        >
          {viewMode === "plan" ? "PLAN" : "AGENT"}
        </button>

        {visibleTabs.map((item) => {
          const isActive = activePanel === item.id;
          const isSettings = item.id === "settings";
          return (
            <button
              key={item.id}
              className={`h-12 w-12 rounded-md border border-slate-700 text-sm font-semibold transition ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-slate-800/70 text-white hover:bg-slate-800"
              }`}
              onClick={() =>
                onPanelChange(activePanel === item.id ? null : (item.id as PanelKey))
              }
              aria-pressed={isActive}
              aria-label={item.label}
            >
              {isSettings ? (
                <img
                  src={iconPaths.settings}
                  alt=""
                  draggable={false}
                  className={`mx-auto h-5 w-5 ${isActive ? "" : "invert"}`}
                />
              ) : (
                item.symbol
              )}
            </button>
          );
        })}
      </div>

      {activePanel && (
        <div
          className={`w-72 backdrop-blur px-4 py-5 shadow-xl transition-all flex flex-col overflow-hidden ${
            theme === "dark"
              ? "border-r border-slate-800 bg-slate-900/90 text-slate-100"
              : "border-r border-slate-200 bg-white/95 text-slate-900"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {PANEL_TITLES[activePanel]}
              </h2>
            </div>
            <button
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => onPanelChange(null)}
              aria-label="Close"
              title="Close"
            >
              <img src={iconPaths.close} alt="" className="h-4 w-4" draggable={false} />
            </button>
          </div>

          {activePanel === "blocks" && (
            <BlocksPanel
              viewMode={viewMode}
              registryAgents={registryAgents}
              customAgents={customAgents}
              planTemplates={planTemplates}
              onAgentDragStart={onAgentDragStart}
              onPlanDragStart={onPlanDragStart}
            />
          )}

          {viewMode !== "plan" && activePanel === "tools" && (
            <ToolsPanel toolPalette={toolPalette} onToolDragStart={onToolDragStart} />
          )}

          {activePanel === "settings" && (
            <SettingsPanel theme={theme} onThemeChange={onThemeChange} />
          )}
        </div>
      )}
    </div>
  );
}
