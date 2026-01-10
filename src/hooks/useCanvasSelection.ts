import { useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LinkSource, LinkTarget, Selection } from "../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useCanvasSelection(args: {
  linkingRef: React.MutableRefObject<boolean>;
  setSelected: SetState<Selection>;
  setHoveredInput: SetState<LinkTarget | null>;
  setHoveredOutput: SetState<LinkSource | null>;
  setHoveredBlockId: SetState<string | null>;
  setHoveredToolId: SetState<string | null>;
  setLinking: SetState<{
    origin: "output";
    from: LinkSource;
    current: { x: number; y: number };
  } | {
    origin: "input";
    target: LinkTarget;
    current: { x: number; y: number };
  } | null>;
}) {
  const {
    linkingRef,
    setHoveredBlockId,
    setHoveredInput,
    setHoveredOutput,
    setHoveredToolId,
    setLinking,
    setSelected,
  } = args;

  const handleCanvasPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-block],[data-tool],[data-connector]")) return;
      setSelected(null);
      setHoveredInput(null);
      setHoveredOutput(null);
      setHoveredBlockId(null);
      setHoveredToolId(null);
      setLinking(null);
      linkingRef.current = false;
    },
    [linkingRef, setHoveredBlockId, setHoveredInput, setHoveredOutput, setHoveredToolId, setLinking, setSelected]
  );

  return { handleCanvasPointerDown };
}
