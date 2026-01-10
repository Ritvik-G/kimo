// =============================================================================
// Agent Block Component - Main agent node on canvas
// =============================================================================

import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  AgentBlock as AgentBlockType,
  BlockHandles,
  LinkSource,
  LinkTarget,
} from "../../shared/types";
import { iconPaths } from "../../shared/assets";
import HandleDot from "./HandleDot";

type Props = {
  block: AgentBlockType;
  handles: BlockHandles;
  isActive: boolean;
  isDragging: boolean;
  showConnections: boolean;
  toolCount: number;
  mode: string | null;
  onPointerDown: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onDetailsClick: (id: string) => void;
  onHoverEnter: (id: string) => void;
  onHoverLeave: (id: string) => void;
  onInputEnter: (target: { type: "block"; id: string; inputIndex: number }) => () => void;
  onInputLeave: (target: { type: "block"; id: string; inputIndex: number }) => () => void;
  onOutputEnter: (source: LinkSource) => () => void;
  onOutputLeave: (source: LinkSource) => () => void;
  onStartLinkingFromInput: (target: LinkTarget) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onStartLinkingFromOutput: (source: LinkSource) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  onFinalizeLinking: (target?: LinkTarget) => void;
  onMoveLinking: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onChangeInputs: (blockId: string, delta: number) => void;
  onChangeOutputs: (blockId: string, delta: number) => void;
};

export default function AgentBlock({
  block,
  handles,
  isActive,
  isDragging,
  showConnections,
  toolCount,
  mode,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRemove,
  onDetailsClick,
  onHoverEnter,
  onHoverLeave,
  onInputEnter,
  onInputLeave,
  onOutputEnter,
  onOutputLeave,
  onStartLinkingFromInput,
  onStartLinkingFromOutput,
  onFinalizeLinking,
  onMoveLinking,
  onChangeInputs,
  onChangeOutputs,
}: Props) {
  return (
    <div
      className="absolute"
      style={{ left: block.x, top: block.y }}
      onPointerEnter={() => onHoverEnter(block.id)}
      onPointerLeave={() => onHoverLeave(block.id)}
    >
      <div
        className={`canvas-agent-card min-h-[120px] scale-[0.97] ${
          showConnections ? "canvas-agent-card-active" : ""
        } ${isDragging ? "scale-[1.01]" : ""}`}
        data-block
        style={{ width: 220, height: handles.height }}
        onPointerDown={onPointerDown(block.id)}
        onPointerMove={onPointerMove(block.id)}
        onPointerUp={onPointerUp(block.id)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {/* Remove button */}
        <button
          className={`canvas-remove-btn canvas-remove-btn-lg ${
            isActive ? "canvas-remove-btn-visible" : "canvas-remove-btn-hidden"
          }`}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={() => onRemove(block.id)}
          aria-label="Remove block"
        >
          <img
            src={iconPaths.close}
            alt=""
            className="h-3.5 w-3.5 invert"
            draggable={false}
          />
        </button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-slate-900">{block.name}</p>
            {mode && (
              <p className="text-[11px] text-slate-600 leading-snug">
                Mode: {mode}
              </p>
            )}
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Agent
          </span>
        </div>

        {/* Stats */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {handles.inputAnchors.length} inputs
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 ring-1 ring-sky-100">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            {handles.outputAnchors.length} outputs
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 ring-1 ring-indigo-100">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            {toolCount} tools
          </span>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDetailsClick(block.id);
            }}
          >
            Details
          </button>
        </div>
      </div>

      {/* Tool connection handles (bottom) */}
      {handles.toolAnchors.map((toolAnchor, idx) => (
        <div
          key={toolAnchor.slot}
          className={`absolute -translate-x-1/2 flex h-8 w-8 items-center justify-center transition-all duration-150 z-10 ${
            showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            top: toolAnchor.anchor.y - block.y - 12,
            left: toolAnchor.anchor.x - block.x - 12,
            width: 24,
            height: 24,
            pointerEvents: "auto",
          }}
          data-input
          data-connector
          onPointerEnter={onInputEnter({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerLeave={onInputLeave({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerDownCapture={onStartLinkingFromInput({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerDown={onStartLinkingFromInput({
            type: "block",
            id: block.id,
            inputIndex: toolAnchor.slot,
          })}
          onPointerUp={() =>
            onFinalizeLinking({
              type: "block",
              id: block.id,
              inputIndex: toolAnchor.slot,
            })
          }
          aria-label={`Attach tool ${idx + 1}`}
        >
          <HandleDot />
        </div>
      ))}

      {/* Input handles (left side) */}
      {handles.inputAnchors.map((anchor, idx) => (
        <div
          key={idx}
          className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
            showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            top: anchor.y - block.y - 12,
            left: anchor.x - block.x - 12,
            width: 24,
            height: 24,
            pointerEvents: "auto",
          }}
          data-input
          data-connector
          onPointerDownCapture={onStartLinkingFromInput({
            type: "block",
            id: block.id,
            inputIndex: idx,
          })}
          onPointerEnter={onInputEnter({
            type: "block",
            id: block.id,
            inputIndex: idx,
          })}
          onPointerLeave={onInputLeave({
            type: "block",
            id: block.id,
            inputIndex: idx,
          })}
          onPointerDown={onStartLinkingFromInput({
            type: "block",
            id: block.id,
            inputIndex: idx,
          })}
          onPointerUp={() =>
            onFinalizeLinking({
              type: "block",
              id: block.id,
              inputIndex: idx,
            })
          }
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChangeInputs(block.id, e.altKey ? -1 : 1);
          }}
        >
          <HandleDot />
        </div>
      ))}

      {/* Output handles (right side) */}
      {handles.outputAnchors.map((anchor, idx) => (
        <div
          key={idx}
          className={`absolute flex items-center justify-center transition-all duration-150 z-10 ${
            showConnections ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            top: anchor.y - block.y - 12,
            left: anchor.x - block.x - 12,
            width: 24,
            height: 24,
            pointerEvents: "auto",
          }}
          data-output
          data-connector
          data-port={idx}
          onPointerDownCapture={onStartLinkingFromOutput({
            type: "block",
            id: block.id,
            port: idx,
          })}
          onPointerDown={onStartLinkingFromOutput({
            type: "block",
            id: block.id,
            port: idx,
          })}
          onPointerEnter={onOutputEnter({ type: "block", id: block.id, port: idx })}
          onPointerLeave={onOutputLeave({ type: "block", id: block.id, port: idx })}
          onPointerMove={onMoveLinking}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChangeOutputs(block.id, e.altKey ? -1 : 1);
          }}
        >
          <HandleDot />
        </div>
      ))}
    </div>
  );
}
