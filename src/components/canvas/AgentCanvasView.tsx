import Background from "../background";
import { AgentBlock, ConnectionLines, ToolNode } from ".";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import type {
  AgentBlock as AgentBlockType,
  BlockHandles,
  Connection,
  LinkingState,
  LinkSource,
  LinkTarget,
  Selection,
  Theme,
  ToolHandles,
  ToolNode as ToolNodeType,
} from "../../shared/types";
import { TOOL_PORT_OFFSET } from "../../shared/constants";

const getToolIdsConnectedToBlock = (blockId: string, connections: Connection[]): Set<string> => {
  const directToolIds = connections
    .filter(
      (c) =>
        c.from.type === "tool" &&
        c.to.type === "block" &&
        c.to.id === blockId &&
        (c.to.inputIndex ?? 0) >= TOOL_PORT_OFFSET
    )
    .map((c) => c.from.id);

  if (directToolIds.length === 0) return new Set();

  const incomingByToolId = new Map<string, Set<string>>();
  connections.forEach((c) => {
    if (c.from.type !== "tool") return;
    if (c.to.type !== "tool") return;
    const toId = c.to.id;
    const set = incomingByToolId.get(toId);
    if (set) set.add(c.from.id);
    else incomingByToolId.set(toId, new Set([c.from.id]));
  });

  const seen = new Set<string>();
  const stack = [...directToolIds];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const incoming = incomingByToolId.get(current);
    if (!incoming) continue;
    incoming.forEach((upstreamId) => {
      if (!seen.has(upstreamId)) stack.push(upstreamId);
    });
  }

  return seen;
};

type DragHandlers = {
  onPointerDown: (id: string) => (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (id: string) => (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (id: string) => (event: ReactPointerEvent<HTMLDivElement>) => void;
};

type Props = {
  containerRef: React.Ref<HTMLDivElement>;
  transform: { x: number; y: number; zoom: number };
  theme: Theme;
  blocks: AgentBlockType[];
  tools: ToolNodeType[];
  connections: Connection[];
  linking: LinkingState;
  selected: Selection;
  draggingBlockId: string | null;
  draggingToolId: string | null;
  getBlockHandles: (block: AgentBlockType) => BlockHandles;
  getToolHandles: (tool: ToolNodeType) => ToolHandles;
  getBlockMode: (block: AgentBlockType) => "aggregate" | "branch" | "sequential" | null;
  showHandlesForId: (id: string) => boolean;
  blockDrag: DragHandlers;
  toolDrag: DragHandlers;
  onCanvasDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onCanvasDrop: (event: DragEvent<HTMLDivElement>) => void;
  onCanvasPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMoveLinking: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onFinalizeLinking: (overrideTarget?: LinkTarget) => void;
  onConnectionPointerDown: (conn: Connection) => (event: ReactPointerEvent<SVGPathElement>) => void;
  onRemoveBlock: (id: string) => void;
  onRemoveTool: (id: string) => void;
  onBlockDetailsClick: (id: string | null) => void;
  onToolDetailsClick: (id: string | null) => void;
  onBlockHoverEnter: (id: string) => void;
  onBlockHoverLeave: () => void;
  onToolHoverEnter: (id: string) => void;
  onToolHoverLeave: () => void;
  onInputEnter: (target: { type: "block"; id: string; inputIndex: number }) => () => void;
  onInputLeave: (target: { type: "block"; id: string; inputIndex: number }) => () => void;
  onOutputEnter: (source: LinkSource) => () => void;
  onOutputLeave: (source: LinkSource) => () => void;
  onStartLinkingFromInput: (target: LinkTarget) => (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStartLinkingFromOutput: (source: LinkSource) => (event: ReactPointerEvent<HTMLDivElement>) => void;
  onChangeInputs: (blockId: string, delta: number) => void;
  onChangeOutputs: (blockId: string, delta: number) => void;
  getInputAnchor: (target: LinkTarget) => { x: number; y: number } | null;
  getOutputAnchor: (source: LinkSource) => { x: number; y: number } | null;
};

export default function AgentCanvasView({
  containerRef,
  transform,
  theme,
  blocks,
  tools,
  connections,
  linking,
  selected,
  draggingBlockId,
  draggingToolId,
  getBlockHandles,
  getToolHandles,
  getBlockMode,
  showHandlesForId,
  blockDrag,
  toolDrag,
  onCanvasDragOver,
  onCanvasDrop,
  onCanvasPointerDown,
  onMoveLinking,
  onFinalizeLinking,
  onConnectionPointerDown,
  onRemoveBlock,
  onRemoveTool,
  onBlockDetailsClick,
  onToolDetailsClick,
  onBlockHoverEnter,
  onBlockHoverLeave,
  onToolHoverEnter,
  onToolHoverLeave,
  onInputEnter,
  onInputLeave,
  onOutputEnter,
  onOutputLeave,
  onStartLinkingFromInput,
  onStartLinkingFromOutput,
  onChangeInputs,
  onChangeOutputs,
  getInputAnchor,
  getOutputAnchor,
}: Props) {
  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ touchAction: "none" }}
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
      onPointerDownCapture={onCanvasPointerDown}
    >
      <Background transform={transform} theme={theme} />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          transformOrigin: "0 0",
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: "auto",
        }}
        onPointerMove={onMoveLinking}
        onPointerUp={() => linking && onFinalizeLinking()}
      >
        <ConnectionLines
          connections={connections}
          linking={linking}
          selected={selected}
          getOutputAnchor={getOutputAnchor}
          getInputAnchor={getInputAnchor}
          onConnectionPointerDown={onConnectionPointerDown}
        />

        {blocks.map((block) => {
          const handles = getBlockHandles(block);
          const toolCount = getToolIdsConnectedToBlock(block.id, connections).size;

          return (
            <AgentBlock
              key={block.id}
              block={block}
              handles={handles}
              isActive={selected?.type === "block" && selected.id === block.id}
              isDragging={draggingBlockId === block.id}
              showConnections={showHandlesForId(block.id)}
              toolCount={toolCount}
              mode={getBlockMode(block)}
              onPointerDown={blockDrag.onPointerDown}
              onPointerMove={blockDrag.onPointerMove}
              onPointerUp={blockDrag.onPointerUp}
              onRemove={onRemoveBlock}
              onDetailsClick={onBlockDetailsClick}
              onHoverEnter={onBlockHoverEnter}
              onHoverLeave={onBlockHoverLeave}
              onInputEnter={onInputEnter}
              onInputLeave={onInputLeave}
              onOutputEnter={onOutputEnter}
              onOutputLeave={onOutputLeave}
              onStartLinkingFromInput={onStartLinkingFromInput}
              onStartLinkingFromOutput={onStartLinkingFromOutput}
              onFinalizeLinking={onFinalizeLinking}
              onMoveLinking={onMoveLinking}
              onChangeInputs={onChangeInputs}
              onChangeOutputs={onChangeOutputs}
            />
          );
        })}

        {tools.map((tool) => {
          const handles = getToolHandles(tool);
          return (
            <ToolNode
              key={tool.id}
              tool={tool}
              handles={handles}
              isActive={selected?.type === "tool" && selected.id === tool.id}
              isDragging={draggingToolId === tool.id}
              showHandles={showHandlesForId(tool.id)}
              onPointerDown={toolDrag.onPointerDown}
              onPointerMove={toolDrag.onPointerMove}
              onPointerUp={toolDrag.onPointerUp}
              onRemove={onRemoveTool}
              onDetailsClick={onToolDetailsClick}
              onHoverEnter={onToolHoverEnter}
              onHoverLeave={onToolHoverLeave}
              onOutputEnter={onOutputEnter}
              onOutputLeave={onOutputLeave}
              onStartLinkingFromOutput={onStartLinkingFromOutput}
              onFinalizeLinking={onFinalizeLinking}
              onMoveLinking={onMoveLinking}
            />
          );
        })}
      </div>
    </div>
  );
}
