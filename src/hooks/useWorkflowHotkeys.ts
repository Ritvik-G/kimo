import { useCallback, useEffect } from "react";
import type { AgentBlock, ClipboardItem, Selection, ToolNode } from "../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useWorkflowHotkeys(args: {
  blocks: AgentBlock[];
  tools: ToolNode[];
  selected: Selection;
  clipboard: ClipboardItem | null;
  setBlocks: SetState<AgentBlock[]>;
  setTools: SetState<ToolNode[]>;
  setClipboard: SetState<ClipboardItem | null>;
  nextBlockIdRef: React.MutableRefObject<number>;
  nextToolIdRef: React.MutableRefObject<number>;
  handleRemoveBlock: (id: string) => void;
  handleRemoveTool: (id: string) => void;
  handleRemoveConnection: (id: string) => void;
}) {
  const {
    blocks,
    tools,
    selected,
    clipboard,
    setBlocks,
    setClipboard,
    setTools,
    nextBlockIdRef,
    nextToolIdRef,
    handleRemoveBlock,
    handleRemoveConnection,
    handleRemoveTool,
  } = args;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modKey && key === "c" && selected) {
        event.preventDefault();
        if (selected.type === "block") {
          const block = blocks.find((b) => b.id === selected.id);
          if (block) setClipboard({ type: "block", data: block });
        }
        if (selected.type === "tool") {
          const tool = tools.find((t) => t.id === selected.id);
          if (tool) setClipboard({ type: "tool", data: tool });
        }
      }

      if (modKey && key === "v" && clipboard) {
        event.preventDefault();
        const OFFSET = 24;
        if (clipboard.type === "block") {
          const id = nextBlockIdRef.current++;
          setBlocks((prev) => [
            ...prev,
            {
              ...clipboard.data,
              id: `block-${id}`,
              x: clipboard.data.x + OFFSET,
              y: clipboard.data.y + OFFSET,
            },
          ]);
        }
        if (clipboard.type === "tool") {
          const id = nextToolIdRef.current++;
          setTools((prev) => [
            ...prev,
            { ...clipboard.data, id: `tool-${id}`, x: clipboard.data.x + OFFSET, y: clipboard.data.y + OFFSET },
          ]);
        }
      }

      if (selected && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        if (selected.type === "block") handleRemoveBlock(selected.id);
        if (selected.type === "tool") handleRemoveTool(selected.id);
        if (selected.type === "connection") handleRemoveConnection(selected.id);
      }
    },
    [
      blocks,
      clipboard,
      handleRemoveBlock,
      handleRemoveConnection,
      handleRemoveTool,
      nextBlockIdRef,
      nextToolIdRef,
      selected,
      setBlocks,
      setClipboard,
      setTools,
      tools,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
