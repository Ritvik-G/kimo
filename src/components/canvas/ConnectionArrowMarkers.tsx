type Props = {
  defaultId?: string;
  previewId?: string;
  defaultColor?: string;
  previewColor?: string;
};

export default function ConnectionArrowMarkers({
  defaultId = "arrowhead-default",
  previewId = "arrowhead-preview",
  defaultColor = "#38bdf8",
  previewColor = "#3b82f6",
}: Props) {
  return (
    <>
      <marker
        id={defaultId}
        viewBox="0 0 12 12"
        markerWidth="12"
        markerHeight="12"
        refX="6"
        refY="6"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,2 L12,6 L0,10 z" fill={defaultColor} />
      </marker>
      <marker
        id={previewId}
        viewBox="0 0 12 12"
        markerWidth="12"
        markerHeight="12"
        refX="6"
        refY="6"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,2 L12,6 L0,10 z" fill={previewColor} />
      </marker>
    </>
  );
}
