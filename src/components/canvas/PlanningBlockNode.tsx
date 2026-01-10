// src/components/canvas/PlanningBlockNode.tsx

import { useEffect, useRef, useState } from "react";
import HandleDot from "./HandleDot";
import type { PlanningBlock } from "../../shared/types/planning";

type Props = {
  plan: PlanningBlock;
  modeOverride?: "sequential" | "branch" | "aggregate" | null;
  pillLabel?: string;
  onEnterWorkflow: () => void;
  onMove: (x: number, y: number) => void;
  toWorldPoint: (
    clientX: number,
    clientY: number
  ) => { x: number; y: number } | null;
  linkingFrom?: boolean;
  linkingTarget?: boolean;
  onStartLink?: (anchor: { x: number; y: number }) => void;
  onCompleteLink?: () => void;
  onRemove?: () => void;
  onHover?: (hover: boolean) => void;
  onSize?: (size: { width: number; height: number }) => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  showHandles?: boolean;
};

export default function PlanningBlockNode({
  plan,
  modeOverride,
  pillLabel = "Plan",
  onEnterWorkflow,
  onMove,
  toWorldPoint,
  linkingFrom,
  linkingTarget,
  onStartLink,
  onCompleteLink,
  onRemove,
  onHover,
  onSize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  showHandles = false,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const onSizeRef = useRef<Props["onSize"]>(onSize);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 260, height: 150 });
  const effectiveMode = modeOverride ?? null;
  const hasSubPlans = Boolean(plan.sub_plans?.plans?.length);

  // Touching props to satisfy usage and keep lints clean
  void onMove;
  void toWorldPoint;

  useEffect(() => {
    onSizeRef.current = onSize;
  }, [onSize]);

  useEffect(() => {
    if (!cardRef.current) return;
    const applySize = (width: number, height: number) => {
      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
      onSizeRef.current?.({ width, height });
    };
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      applySize(width, height);
    });
    observer.observe(cardRef.current);
    const initialWidth = Math.round(cardRef.current.offsetWidth);
    const initialHeight = Math.round(cardRef.current.offsetHeight);
    applySize(initialWidth, initialHeight);
    return () => observer.disconnect();
  }, []);

  const outputAnchor = { x: plan.x + size.width, y: plan.y + size.height / 2 };

  return (
    <div
      className="absolute"
      style={{ left: plan.x, top: plan.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      data-block
    >
      <div
        ref={cardRef}
        className={`plan-card group min-h-[120px] ${
          linkingFrom || linkingTarget ? "plan-card-active" : ""
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 break-words whitespace-pre-wrap leading-snug">{plan.name}</p>
            {effectiveMode && (
              <p className="text-[11px] text-slate-600 leading-snug">Mode: {effectiveMode}</p>
            )}
            <p className="mt-1 text-xs text-slate-700 break-words whitespace-pre-wrap leading-snug" title={plan.query}>{plan.query || "(no query)"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700 ring-1 ring-amber-100">
              {pillLabel}
            </span>
            {onRemove && (
              <button
                className={`h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-bold shadow transition-all duration-150 ${
                  linkingFrom || linkingTarget ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                aria-label="Remove plan"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <button
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
          data-interactive
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onEnterWorkflow();
          }}
        >
          {hasSubPlans ? "View Subplans →" : "Enter Workflow →"}
        </button>
      </div>

      {/* Connection handles (must be direct siblings so they are always clickable) */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 -left-4 h-8 w-8 flex items-center justify-center transition-all duration-150 ${
          showHandles ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none"
        }`}
        data-connector
        onPointerDownCapture={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onCompleteLink?.();
        }}
      >
        <HandleDot />
      </div>
      <div
        className={`absolute top-1/2 -translate-y-1/2 -right-4 h-8 w-8 flex items-center justify-center transition-all duration-150 ${
          showHandles ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none"
        }`}
        data-connector
        onPointerDownCapture={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onStartLink?.(outputAnchor);
        }}
      >
        <HandleDot />
      </div>
    </div>
  );
}
