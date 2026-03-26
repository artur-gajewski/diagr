/**
 * SVG <defs> containing all arrow / diamond markers used by relationship arrows.
 * Uses CSS currentColor so they adapt to dark / light mode via the parent SVG's color property.
 */
export function SvgDefs() {
  return (
    <defs>
      {/* Drop shadow for label pills */}
      <filter id="shadow" x="-20%" y="-40%" width="140%" height="180%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
      </filter>
      {/* Open arrowhead — association / dependency */}
      <marker
        id="mk-arrow-open"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="8"
        markerHeight="8"
        orient="auto"
      >
        <path
          d="M0,1 L9,5 L0,9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>

      {/* Hollow triangle — inheritance / realization */}
      <marker
        id="mk-arrow-hollow"
        viewBox="0 0 12 12"
        refX="11"
        refY="6"
        markerWidth="10"
        markerHeight="10"
        orient="auto"
      >
        <polygon
          points="0,0 12,6 0,12"
          fill="var(--bg-fill)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </marker>

      {/* Filled diamond — composition (at source) */}
      <marker
        id="mk-diamond-filled"
        viewBox="0 0 22 10"
        refX="1"
        refY="5"
        markerWidth="16"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <polygon
          points="1,5 11,0 21,5 11,10"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </marker>

      {/* Hollow diamond — aggregation (at source) */}
      <marker
        id="mk-diamond-hollow"
        viewBox="0 0 22 10"
        refX="1"
        refY="5"
        markerWidth="16"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <polygon
          points="1,5 11,0 21,5 11,10"
          fill="var(--bg-fill)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </marker>
    </defs>
  );
}

