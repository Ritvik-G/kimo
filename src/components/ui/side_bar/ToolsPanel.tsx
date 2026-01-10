// =============================================================================
// Tools Panel Component - Tool palette panel
// =============================================================================

import type { DragEvent } from "react";
import type { ToolPreset } from "../../../shared/types";

type Props = {
  toolPalette: ToolPreset[];
  onToolDragStart: (toolName: string) => (e: DragEvent<HTMLDivElement>) => void;
};

export default function ToolsPanel({ toolPalette, onToolDragStart }: Props) {
  return (
    <div className="mt-4 flex-1 space-y-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Tools</p>
        </div>
      </div>
      <div className="mt-3 h-[calc(100vh-240px)] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-3 auto-rows-max">
          {toolPalette.map((tool) => (
            <div
              key={tool.name}
              className="group relative flex items-center justify-center cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={onToolDragStart(tool.name)}
            >
              <div
                className={`relative h-[110px] w-[180px] rounded-lg bg-gradient-to-br ${tool.gradient} ring-1 ring-inset ${tool.ring} shadow-sm transition duration-150 group-hover:shadow-md group-hover:-translate-y-0.5`}
                aria-label={tool.name}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <p className="text-sm font-semibold text-slate-900 drop-shadow-sm">{tool.name}</p>
                  <p className="text-[11px] text-slate-700 leading-tight">{tool.tagline}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
