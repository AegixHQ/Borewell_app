/**
 * Vertical depth ruler - the signature graphic of the approved design.
 * Shows the quoted depth RANGE (never a single number) plus the service
 * area's water-table estimate, which UI/UX doc section 7 makes a required
 * element on every quotation view, not optional decoration.
 */
export default function DepthGauge({
  min,
  max,
  water,
  top = 0,
  bottom,
  height = 280,
  width = 120,
  dark = false,
  labels = true,
}) {
  const lo = Number(min);
  const hi = Number(max);
  const end = bottom || Math.max(600, Math.ceil((hi || 500) * 1.25 / 100) * 100);
  const y = (v) => 14 + ((v - top) / (end - top)) * (height - 28);
  const tickColor = dark ? "#5B6068" : "#B9B6AE";
  const labelColor = dark ? "#9A9EA5" : "#7D8188";
  const markColor = dark ? "#FFFFFF" : "#141619";
  const x0 = 44;
  const step = end > 800 ? 50 : 25;
  const ticks = [];
  for (let v = top; v <= end; v += step) ticks.push(v);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Depth estimate between ${lo} and ${hi} feet`} style={{ display: "block", flexShrink: 0 }}>
      {Number.isFinite(lo) && Number.isFinite(hi) && (
        <rect x={x0} y={y(lo)} width={width - x0 - 6} height={Math.max(4, y(hi) - y(lo))} rx="6" fill="#F0A73A" fillOpacity={dark ? 0.92 : 0.85} />
      )}
      {ticks.map((v) => {
        const major = v % 100 === 0;
        const inRange = Number.isFinite(lo) && v >= lo && v <= hi;
        return (
          <g key={v}>
            <line x1={x0} x2={x0 + (major ? 22 : 11)} y1={y(v)} y2={y(v)}
              stroke={inRange && !dark ? "#141619" : tickColor} strokeWidth={major ? 1.6 : 1} />
            {major && labels && (
              <text x={x0 - 8} y={y(v) + 4} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill={labelColor}>
                {v}
              </text>
            )}
          </g>
        );
      })}
      {Number.isFinite(Number(water)) && (
        <g>
          <line x1={x0} x2={width - 6} y1={y(Number(water))} y2={y(Number(water))} stroke={markColor} strokeWidth="2" strokeDasharray="4 3" />
          <path d={`M${width - 20} ${y(Number(water)) - 16} c0 0 -6 7 -6 10.5 a6 6 0 0 0 12 0 c0 -3.5 -6 -10.5 -6 -10.5z`} fill={markColor} />
        </g>
      )}
    </svg>
  );
}
