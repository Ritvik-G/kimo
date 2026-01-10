// =============================================================================
// Block Details Modal Component
// =============================================================================

import type { AgentBlock, AgentRegistryEntry, Connection, ToolNode } from "../../shared/types";
import { iconPaths } from "../../shared/assets";
import { getRegistryAgentForBlock } from "../../shared/constants";

type Props = {
  block: AgentBlock;
  registryAgents: AgentRegistryEntry[];
  tools: ToolNode[];
  connections: Connection[];
  onClose: () => void;
  onToggleInputRequired: (blockId: string, index: number) => void;
  onToggleOutputRequired: (blockId: string, index: number) => void;
  getBlockMode: (block: AgentBlock) => string | null;
};

export default function BlockDetailsModal({
  block,
  registryAgents,
  tools,
  connections,
  onClose,
  onToggleInputRequired,
  onToggleOutputRequired,
  getBlockMode,
}: Props) {
  const registryAgent = getRegistryAgentForBlock(block, registryAgents);
  const connectedToolIds = connections.reduce<string[]>((acc, conn) => {
    if (conn.from.type === "tool" && conn.to.type === "block" && conn.to.id === block.id) {
      if (!acc.includes(conn.from.id)) acc.push(conn.from.id);
    }
    if (conn.from.type === "block" && conn.from.id === block.id && conn.to.type === "tool") {
      if (!acc.includes(conn.to.id)) acc.push(conn.to.id);
    }
    return acc;
  }, []);
  const connectedToolNames = connectedToolIds.map(
    (toolId) => tools.find((tool) => tool.id === toolId)?.name ?? toolId
  );

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-card w-[680px] max-h-[80vh] p-5"
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
            <p className="text-lg font-semibold text-slate-900">{block.name}</p>
            {getBlockMode(block) && (
              <p className="text-sm text-slate-600">
                Mode: {getBlockMode(block)}
              </p>
            )}
          </div>
          <span className="pill-tag text-xs bg-emerald-50 text-emerald-700">
            Agent
          </span>
        </div>

        {/* Agent Registry Details */}
        <div className="mt-4 panel-sm">
          <p className="label-xs mb-2">Details</p>
          <div className="space-y-2 text-sm text-slate-800">
            <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">id</p>
              <p className="text-sm text-slate-900 break-words">{registryAgent?.id ?? block.agentId ?? ""}</p>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">name</p>
              <p className="text-sm text-slate-900 break-words">{registryAgent?.name ?? block.name}</p>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">description</p>
              <p className="text-sm text-slate-900 break-words">{registryAgent?.description ?? block.description}</p>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">capabilities</p>
              <p className="text-sm text-slate-900 break-words">
                {registryAgent?.capabilities?.length ? registryAgent.capabilities.join(", ") : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 panel-sm">
          <p className="label-xs">Connected Tools</p>
          {connectedToolNames.length ? (
            <p className="mt-2 text-sm text-slate-800">
              {connectedToolNames.join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No tool connections yet.</p>
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
              {Array.from({ length: block.inputCount }, (_, idx) => {
                const isMandatory = idx < (block.mandatoryInputCount ?? 0);
                const isRequired = block.inputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-black truncate">
                        {block.inputNames?.[idx] ?? `Input ${idx + 1}`}
                      </span>
                      {isMandatory && (
                        <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => onToggleInputRequired(block.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
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
              {Array.from({ length: block.outputCount }, (_, idx) => {
                const isMandatory = idx < (block.mandatoryOutputCount ?? 0);
                const isRequired = block.outputRequired[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-sm text-black"
                  >
                    <div className="flex items-center gap-2 text-black flex-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                      <span className="text-black truncate">
                        {block.outputNames?.[idx] ?? `Output ${idx + 1}`}
                      </span>
                      {isMandatory && (
                        <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                          Required
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        disabled={isMandatory}
                        onChange={() => onToggleOutputRequired(block.id, idx)}
                        className={`h-4 w-4 rounded border-2 ${
                          isMandatory
                            ? "border-rose-300 bg-rose-100 cursor-not-allowed opacity-60"
                            : "border-slate-300 cursor-pointer"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
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
