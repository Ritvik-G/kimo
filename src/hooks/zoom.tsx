// used to handle the zoom and movement and pass to the background
import { useCallback, useEffect, useRef, useState } from "react";

export type Transform = { x: number; y: number; zoom: number };

type Options = {
  initial?: Transform;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  shouldAllowPan?: (event: PointerEvent) => boolean;
  isPanDisabled?: () => boolean;
};

export function usePanZoom({
  initial = { x: 0, y: 0, zoom: 1 },
  minZoom = 0.1,
  maxZoom = 3,
  zoomStep = 0.02,
  shouldAllowPan,
  isPanDisabled,
}: Options = {}) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerEl(node);
  }, []);
  const draggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<Transform | null>(null);
  const [transform, setTransform] = useState<Transform>(initial);
  const transformRef = useRef<Transform>(initial);

  const applyTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    pendingRef.current = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current) {
          setTransform(pendingRef.current);
          pendingRef.current = null;
        }
      });
    }
  }, []);

  // pointer down = start dragging
  useEffect(() => {
    const el = containerEl;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if (isPanDisabled && isPanDisabled()) return;
      // bail if consumer wants to ignore pan (e.g., on note drag)
      if (shouldAllowPan && !shouldAllowPan(e)) return;
      e.preventDefault();
      draggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current || !lastPosRef.current) return;
      if (isPanDisabled && isPanDisabled()) {
        draggingRef.current = false;
        lastPosRef.current = null;
        return;
      }
      e.preventDefault();
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      const base = transformRef.current;
      applyTransform({ ...base, x: base.x + dx, y: base.y + dy });
    }

    function onPointerUp() {
      draggingRef.current = false;
      lastPosRef.current = null;
    }

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [applyTransform, containerEl, isPanDisabled, shouldAllowPan]);

  // wheel to zoom (centered on the cursor)
  useEffect(() => {
    const el = containerEl;
    if (!el) return;
    const element: HTMLDivElement = el;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      const factor = 1 + direction * zoomStep;

      const current = transformRef.current;
      const newZoomUnclamped = current.zoom * factor;
      const newZoom = Math.min(maxZoom, Math.max(minZoom, newZoomUnclamped));

      const rect = element.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const newX = cx - ((cx - current.x) * newZoom) / current.zoom;
      const newY = cy - ((cy - current.y) * newZoom) / current.zoom;
      applyTransform({ x: newX, y: newY, zoom: newZoom });
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [applyTransform, containerEl, maxZoom, minZoom, zoomStep]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    transformRef.current = initial;
    setTransform(initial);
  }, [initial]);

  const getTransform = useCallback(() => transformRef.current, []);

  return { containerRef, containerEl, transform, setTransform: applyTransform, reset, getTransform };
}
