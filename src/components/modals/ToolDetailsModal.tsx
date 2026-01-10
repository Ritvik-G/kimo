// =============================================================================
// Tool Details Modal Component
// =============================================================================

import type { ToolNode, Connection, AgentBlock } from "../../shared/types";
import { iconPaths } from "../../shared/assets";
import { TOOL_PORT_OFFSET } from "../../shared/constants";

type Props = {
  tool: ToolNode;
  connections: Connection[];
  blocks: AgentBlock[];
  onClose: () => void;
  onToggleInputRequired: (toolId: string, index: number) => void;
  onToggleOutputRequired: (toolId: string, index: number) => void;
};

export default function ToolDetailsModal({
  tool,
  connections,
  blocks,
  onClose,
  onToggleInputRequired,
  onToggleOutputRequired,
}: Props) {
  const connectedAgentIds = Array.from(
    new Set(
      connections
        .filter(
          (c) =>
            c.from.type === "tool" &&
            c.from.id === tool.id &&
            c.to.type === "block" &&
            (c.to.inputIndex ?? 0) >= TOOL_PORT_OFFSET
        )
        .map((c) => c.to.id)
    )
  );
  const connectedAgentNames = connectedAgentIds.map((id) => {
    const block = blocks.find((b) => b.id === id);
    return block?.name ?? id;
  });

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-card w-[520px] max-h-[80vh] p-5"
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

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{tool.name}</p>
            <p className="text-sm text-slate-600">{tool.tagline}</p>
          </div>
          <span className="pill-tag text-xs bg-indigo-50 text-indigo-700">
            Tool
          </span>
        </div>

        <div className="mt-4 panel-sm">
          <p className="label-xs">Connected Agents</p>
          {connectedAgentNames.length ? (
            <p className="mt-2 text-sm text-slate-800">
              {connectedAgentNames.join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No agent connections yet.</p>
          )}
        </div>

        {/* Inputs/Outputs Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {/* Inputs */}
          <div className="panel-sm">
            <p className="label-xs">
              Inputs
            </p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: tool.inputCount }, (_, idx) => {
                const isMandatory = idx < (tool.mandatoryInputCount ?? 0);
                const isRequired = tool.inputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      <span className="text-black truncate">
                        {tool.inputNames?.[idx] ?? `Input ${idx + 1}`}
                      </span>
                      {isMandatory && (
                        <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => onToggleInputRequired(tool.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold ${
                          isMandatory ? "text-rose-600" : "text-slate-600"
                        }`}
                      >
                        {isMandatory ? "Mandatory" : "Optional"}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outputs */}
          <div className="panel-sm">
            <p className="label-xs">
              Outputs
            </p>
            <div className="mt-2 space-y-1.5">
              {Array.from({ length: tool.outputCount }, (_, idx) => {
                const isMandatory = idx < (tool.mandatoryOutputCount ?? 0);
                const isRequired = tool.outputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                      <span className="text-black truncate">
                        {tool.outputNames?.[idx] ?? `Output ${idx + 1}`}
                      </span>
                      {isMandatory && (
                        <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => onToggleOutputRequired(tool.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold ${
                          isMandatory ? "text-rose-600" : "text-slate-600"
                        }`}
                      >
                        {isMandatory ? "Mandatory" : "Optional"}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
