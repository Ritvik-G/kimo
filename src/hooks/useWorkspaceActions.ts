import { useCallback } from "react";
import type { AgentBlock, Connection, Selection, ToolNode } from "../shared/types";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export function useWorkspaceActions(args: {
  selected: Selection;
  setBlocks: SetState<AgentBlock[]>;
  setTools: SetState<ToolNode[]>;
  setConnections: SetState<Connection[]>;
  setSelected: SetState<Selection>;
  setSelectedEvals: SetState<string[]>;
  recalcBlockPorts: (connections: Connection[], blocks: AgentBlock[]) => AgentBlock[];
}) {
  const {
    selected,
    setBlocks,
    setTools,
    setConnections,
    setSelected,
    setSelectedEvals,
    recalcBlockPorts,
  } = args;

  const handleRemoveBlock = useCallback(
    (id: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      setConnections((prev) => prev.filter((c) => !(c.from.type === "block" && c.from.id === id) && !(c.to.type === "block" && c.to.id === id)));
      if (selected?.type === "block" && selected.id === id) setSelected(null);
    },
    [selected, setBlocks, setConnections, setSelected]
  );

  const handleRemoveTool = useCallback(
    (id: string) => {
      setTools((prev) => prev.filter((t) => t.id !== id));
      setConnections((prev) => prev.filter((c) => !(c.from.type === "tool" && c.from.id === id) && !(c.to.type === "tool" && c.to.id === id)));
      if (selected?.type === "tool" && selected.id === id) setSelected(null);
    },
    [selected, setConnections, setSelected, setTools]
  );

  const handleRemoveConnection = useCallback(
    (connectionId: string) => {
      setConnections((prev) => {
        const next = prev.filter((conn) => conn.id !== connectionId);
        setBlocks((state) => recalcBlockPorts(next, state));
        return next;
      });
      setSelected((prev) => (prev?.type === "connection" && prev.id === connectionId ? null : prev));
    },
    [recalcBlockPorts, setBlocks, setConnections, setSelected]
  );

  const toggleInputRequired = useCallback(
    (blockId: string, index: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          const mandatoryCount = b.mandatoryInputCount ?? 0;
          if (index < mandatoryCount) return b;
          const next = [...b.inputRequired];
          next[index] = !next[index];
          return { ...b, inputRequired: next };
        })
      );
    },
    [setBlocks]
  );

  const toggleOutputRequired = useCallback(
    (blockId: string, index: number) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          const mandatoryCount = b.mandatoryOutputCount ?? 0;
          if (index < mandatoryCount) return b;
          const next = [...b.outputRequired];
          next[index] = !next[index];
          return { ...b, outputRequired: next };
        })
      );
    },
    [setBlocks]
  );

  const toggleToolInputRequired = useCallback(
    (toolId: string, index: number) => {
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== toolId) return t;
          const mandatoryCount = t.mandatoryInputCount ?? 0;
          if (index < mandatoryCount) return t;
          const next = [...t.inputRequired];
          next[index] = !next[index];
          return { ...t, inputRequired: next };
        })
      );
    },
    [setTools]
  );

  const toggleToolOutputRequired = useCallback(
    (toolId: string, index: number) => {
      setTools((prev) =>
        prev.map((t) => {
          if (t.id !== toolId) return t;
          const mandatoryCount = t.mandatoryOutputCount ?? 0;
          if (index < mandatoryCount) return t;
          const next = [...t.outputRequired];
          next[index] = !next[index];
          return { ...t, outputRequired: next };
        })
      );
    },
    [setTools]
  );

  const toggleEval = useCallback(
    (evalId: string) => {
      setSelectedEvals((prev) =>
        prev.includes(evalId) ? prev.filter((id) => id !== evalId) : [...prev, evalId]
      );
    },
    [setSelectedEvals]
  );

  return {
    handleRemoveBlock,
    handleRemoveTool,
    handleRemoveConnection,
    toggleInputRequired,
    toggleOutputRequired,
    toggleToolInputRequired,
    toggleToolOutputRequired,
    toggleEval,
  };
}
