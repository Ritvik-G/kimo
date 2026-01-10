import { useCallback } from "react";
import type { LinkingState, Selection } from "../shared/types";

export function useHandleVisibility(args: {
  linking: LinkingState;
  hoveredBlockId: string | null;
  hoveredToolId: string | null;
  draggingBlockId: string | null;
  draggingToolId: string | null;
  selected: Selection;
}) {
  const {
    linking,
    hoveredBlockId,
    hoveredToolId,
    draggingBlockId,
    draggingToolId,
    selected,
  } = args;

  const showHandlesForId = useCallback(
    (id: string) =>
      Boolean(
        linking ||
          hoveredBlockId === id ||
          hoveredToolId === id ||
          draggingBlockId === id ||
          draggingToolId === id ||
          Boolean(selected?.id === id)
      ),
    [draggingBlockId, draggingToolId, hoveredBlockId, hoveredToolId, linking, selected]
  );

  return { showHandlesForId };
}
