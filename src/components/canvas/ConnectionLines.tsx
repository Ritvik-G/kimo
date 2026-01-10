// =============================================================================
// Connection Lines Component - SVG connection paths
// =============================================================================

import type { PointerEvent as ReactPointerEvent } from "react";
import { useId } from "react";
import type {
  Connection,
  AnchorPoint,
  Selection,
  LinkingState,
} from "../../shared/types";
import { buildConnectionPath } from "../../shared/utils";
import ConnectionArrowMarkers from "./ConnectionArrowMarkers";

type Props = {
  connections: Connection[];
  linking: LinkingState | null;
  selected: Selection | null;
  getOutputAnchor: (endpoint: Connection["from"]) => AnchorPoint | null | undefined;
  getInputAnchor: (target: Connection["to"]) => AnchorPoint | null | undefined;
  onConnectionPointerDown: (conn: Connection) => (e: ReactPointerEvent<SVGPathElement>) => void;
};

export default function ConnectionLines({
  connections,
  linking,
  selected,
  getOutputAnchor,
  getInputAnchor,
  onConnectionPointerDown,
}: Props) {
  const markerBaseId = useId().replace(/:/g, "");
  const defaultMarkerId = `arrowhead-default-${markerBaseId}`;
  const previewMarkerId = `arrowhead-preview-${markerBaseId}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      overflow="visible"
    >
      <defs>
        <ConnectionArrowMarkers
          defaultId={defaultMarkerId}
          previewId={previewMarkerId}
        />
      </defs>

      {/* Existing connections */}
      {connections.map((conn) => {
        const start = getOutputAnchor(conn.from);
        const end = getInputAnchor(conn.to);
        if (!start || !end) return null;
        const d = buildConnectionPath(start, end);
        const isSelected = selected?.type === "connection" && selected.id === conn.id;
        const isToolWire = conn.from.type === "tool" || conn.to.type === "tool";
        return (
          <g key={conn.id}>
            <path
              d={d}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={isSelected ? 3 : 2}
              strokeLinecap="round"
              markerEnd={isToolWire ? undefined : `url(#${defaultMarkerId})`}
              style={{
                pointerEvents: "visibleStroke",
                cursor: "pointer",
              }}
              onPointerDown={onConnectionPointerDown(conn)}
            />
          </g>
        );
      })}

      {/* Preview connection while linking */}
      {linking &&
        (() => {
          const start =
            linking.origin === "output"
              ? getOutputAnchor(linking.from)
              : getInputAnchor(linking.target);
          if (!start) return null;
          const end = linking.current;
          const d = buildConnectionPath(start, end);
          const isToolWire =
            linking.origin === "output"
              ? linking.from.type === "tool"
              : linking.target.type === "tool";
          return (
            <g>
              <path
                d={d}
                fill="none"
                stroke="#3b82f6"
                strokeDasharray="6 6"
                strokeWidth={2}
                strokeLinecap="round"
                markerEnd={isToolWire ? undefined : `url(#${previewMarkerId})`}
              />
            </g>
          );
        })()}
    </svg>
  );
}
