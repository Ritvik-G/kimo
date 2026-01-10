import { useCallback } from "react";

export function useIdCounters(args: {
  nextBlockIdRef: React.MutableRefObject<number>;
  nextToolIdRef: React.MutableRefObject<number>;
  nextConnectionIdRef: React.MutableRefObject<number>;
}) {
  const { nextBlockIdRef, nextToolIdRef, nextConnectionIdRef } = args;

  const bumpIdCounters = useCallback(
    (items: {
      blocks?: Array<{ id: string }>;
      tools?: Array<{ id: string }>;
      connections?: Array<{ id: string }>;
    }) => {
      const maxSuffix = (list: Array<{ id: string }> | undefined, prefix: string) => {
        if (!list?.length) return 0;
        let max = 0;
        for (const item of list) {
          if (!item.id?.startsWith(prefix)) continue;
          const n = Number.parseInt(item.id.slice(prefix.length), 10);
          if (Number.isFinite(n) && n > max) max = n;
        }
        return max;
      };

      const maxBlock = maxSuffix(items.blocks, "block-");
      const maxTool = maxSuffix(items.tools, "tool-");
      const maxConn = maxSuffix(items.connections, "conn-");

      if (maxBlock > 0) nextBlockIdRef.current = Math.max(nextBlockIdRef.current, maxBlock + 1);
      if (maxTool > 0) nextToolIdRef.current = Math.max(nextToolIdRef.current, maxTool + 1);
      if (maxConn > 0) nextConnectionIdRef.current = Math.max(nextConnectionIdRef.current, maxConn + 1);
    },
    [nextBlockIdRef, nextConnectionIdRef, nextToolIdRef]
  );

  return { bumpIdCounters };
}
