// components/BatteryLayout.jsx
// SVG battery pack layout diagrams — top-down and cross-section end views

// ── Cell constants (ULTRA HC) ─────────────────────────────────────────────
const CL = 247.3;   // mm length
const CW = 112.5;   // mm width
const CT = 16.8;    // mm thickness (depth per cell)

// ── Design rule constants ─────────────────────────────────────────────────
const WALL    = 2;    // wall clearance mm
const GAP     = 3;    // inter-cell gap mm
const PAD     = 1.5;  // thermal pad thickness mm
const BMS_GAP = 2;    // gap between cell stack top and BMS mm

// ── BMS board dimensions ──────────────────────────────────────────────────
const BMS_DIMS = {
  'BMS-S-001': { w: 50, h: 12 },
  'BMS-L-001': { w: 80, h: 15 },
};

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtMarg = (v) =>
  typeof v === 'number' ? (v >= 0 ? '+' : '') + v.toFixed(1) + 'mm' : '?mm';

const dimCol    = (v) => (v >= 0 ? '#1D9E75' : '#E24B4A');
const chipColor = (v) => (v >= 5 ? '#16a34a' : v >= 0 ? '#d97706' : '#dc2626');

// Arrow marker pair (forward + reverse) for a dimension line
function ArrowDefs({ prefix, color }) {
  const d = 'M0,0.5 L0,5.5 L5,3z';
  return (
    <>
      <marker id={`${prefix}-fwd`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d={d} fill={color} />
      </marker>
      <marker id={`${prefix}-rev`} markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
        <path d={d} fill={color} />
      </marker>
    </>
  );
}

// Double-headed dimension annotation line
function DimLine({ x1, y1, x2, y2, label, color, prefix, horiz }) {
  const mid = horiz
    ? { x: (x1 + x2) / 2, y: y1 + 11 }
    : { x: x1 - 4,         y: (y1 + y2) / 2 };
  return (
    <g>
      {/* tick extensions */}
      {horiz ? (
        <>
          <line x1={x1} y1={y1 - 18} x2={x1} y2={y1 + 2} stroke={color} strokeWidth={0.75} strokeDasharray="2,2" />
          <line x1={x2} y1={y1 - 18} x2={x2} y2={y1 + 2} stroke={color} strokeWidth={0.75} strokeDasharray="2,2" />
        </>
      ) : (
        <>
          <line x1={x1 - 18} y1={y1} x2={x1 + 2} y2={y1} stroke={color} strokeWidth={0.75} strokeDasharray="2,2" />
          <line x1={x1 - 18} y1={y2} x2={x1 + 2} y2={y2} stroke={color} strokeWidth={0.75} strokeDasharray="2,2" />
        </>
      )}
      {/* arrow line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={1}
        markerStart={`url(#${prefix}-rev)`}
        markerEnd={`url(#${prefix}-fwd)`}
      />
      {/* label */}
      <text
        x={mid.x} y={mid.y}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fill={color} fontFamily="Courier New,monospace"
        transform={horiz ? undefined : `rotate(-90,${mid.x},${mid.y})`}
      >
        {label}
      </text>
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function BatteryLayout({ config, enclosure }) {
  const {
    series_count:   S   = 1,
    parallel_count: P   = 1,
    margin_length_mm: mL = 0,
    margin_width_mm:  mW = 0,
    margin_depth_mm:  mD = 0,
    bms_id,
  } = config || {};

  const {
    length_mm: EL = 265,
    width_mm:  EW = 125,
    depth_mm:  ED = 28,
  } = enclosure || {};

  const bms    = BMS_DIMS[bms_id] || { w: 80, h: 15 };
  const allFit = mL >= 0 && mW >= 0 && mD >= 0;

  // Cell/BMS colors
  const topFit = mL >= 0 && mW >= 0;
  const cFill   = topFit  ? '#B5D4F4' : '#F09595';
  const cStroke = topFit  ? '#185FA5' : '#E24B4A';
  const cText   = topFit  ? '#0C447C' : '#791F1F';
  const cFillD  = mD >= 0 ? '#B5D4F4' : '#F09595';
  const cStrD   = mD >= 0 ? '#185FA5' : '#E24B4A';
  const bmsFill = mD >= 0 ? '#FAC775' : '#F09595';
  const bmsStr  = mD >= 0 ? '#BA7517' : '#E24B4A';
  const bmsText = mD >= 0 ? '#633806' : '#791F1F';

  // ── TOP-DOWN geometry (viewBox 680×260) ──────────────────────────────
  // Drawing area with padding: top=30 left=70 right=20 bottom=50
  const tdSc  = Math.min(590 / EL, 180 / EW);
  const tdEW  = EL * tdSc;
  const tdEH  = EW * tdSc;
  const tdX   = 70 + (590 - tdEW) / 2;
  const tdY   = 30 + (180 - tdEH) / 2;

  // P cell footprints along width, CL along length
  const tdCells = Array.from({ length: P }, (_, i) => ({
    x: tdX + WALL * tdSc,
    y: tdY + (WALL + i * (CW + GAP)) * tdSc,
    w: CL  * tdSc,
    h: CW  * tdSc,
  }));

  // ── CROSS-SECTION geometry (viewBox 680×220) ──────────────────────────
  // Drawing area: top=30 left=70 right=20 bottom=50
  const csSc  = Math.min(590 / EW, 130 / ED);
  const csEW  = EW * csSc;
  const csEH  = ED * csSc;
  const csX   = 70 + (590 - csEW) / 2;
  const csY   = 30 + (130 - csEH) / 2;

  // S layers × P cells; thermal pads between series layers
  const csCells = [];
  const csPads  = [];
  for (let s = 0; s < S; s++) {
    const cellY = csY + (WALL + s * (CT + PAD)) * csSc;
    for (let p = 0; p < P; p++) {
      csCells.push({
        x: csX + (WALL + p * (CW + GAP)) * csSc,
        y: cellY,
        w: CW * csSc,
        h: CT * csSc,
      });
    }
    if (s < S - 1) {
      csPads.push({
        x: csX + WALL * csSc,
        y: csY + (WALL + s * (CT + PAD) + CT) * csSc,
        w: (P * CW + (P - 1) * GAP) * csSc,
        h: PAD * csSc,
      });
    }
  }

  // BMS — centered above cell stack (in cross-section, drawn after last cell layer)
  const stackBottom = WALL + (S - 1) * (CT + PAD) + CT;
  const stackW      = P * CW + (P - 1) * GAP;
  const bmsX = csX + (WALL + stackW / 2 - bms.w / 2) * csSc;
  const bmsY = csY + (stackBottom + BMS_GAP)          * csSc;
  const bmsW = bms.w * csSc;
  const bmsH = bms.h * csSc;

  return (
    <div style={{ marginTop: 16 }}>

      {/* ── Status chips ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{
          background:   allFit ? '#f0fdf4'  : '#fef2f2',
          color:        allFit ? '#166534'  : '#991b1b',
          border:      `1px solid ${allFit ? '#bbf7d0' : '#fca5a5'}`,
          borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 700,
        }}>
          {allFit ? '✓ fits' : '✗ does not fit'}
        </span>
        {[['Length', mL], ['Width', mW], ['Depth', mD]].map(([lbl, v]) => (
          <span key={lbl} style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 10, padding: '2px 8px', fontSize: 10,
            color: chipColor(v), fontWeight: 600,
          }}>
            {lbl}: {fmtMarg(v)}
          </span>
        ))}
      </div>

      {/* ── Top-down SVG ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '10px 12px', marginBottom: 12 }}>
        <div className="section-title">Top-Down View — Length × Width</div>
        <svg viewBox="0 0 680 260" width="100%" style={{ display: 'block', maxWidth: 680 }}>
          <defs>
            <ArrowDefs prefix="td-g" color="#1D9E75" />
            <ArrowDefs prefix="td-r" color="#E24B4A" />
            <clipPath id="clip-td">
              <rect x={tdX} y={tdY} width={tdEW} height={tdEH} />
            </clipPath>
          </defs>

          {/* Enclosure */}
          <rect x={tdX} y={tdY} width={tdEW} height={tdEH}
            fill="#F1EFE8" stroke="#5F5E5A" strokeWidth={1.5} />

          {/* Cell footprints (clipped to enclosure) */}
          <g clipPath="url(#clip-td)">
            {tdCells.map((c, i) => (
              <g key={i}>
                <rect x={c.x} y={c.y} width={c.w} height={c.h}
                  fill={cFill} stroke={cStroke} strokeWidth={1} />
                {c.h > 14 && c.w > 50 && (
                  <text
                    x={c.x + c.w / 2} y={c.y + c.h / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(10, c.h * 0.45)}
                    fill={cText} fontFamily="Courier New,monospace"
                  >
                    {i === 0 ? 'ULTRA HC' : `P${i + 1}`}
                  </text>
                )}
              </g>
            ))}
          </g>

          {/* Config label */}
          <text x={tdX + tdEW / 2} y={tdY - 8}
            textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="Courier New,monospace">
            {S}S{P}P · {S * P} cells
          </text>

          {/* Length dim line — below enclosure */}
          <DimLine
            x1={tdX}       y1={tdY + tdEH + 22}
            x2={tdX + tdEW} y2={tdY + tdEH + 22}
            label={`${EL}mm (${fmtMarg(mL)})`}
            color={dimCol(mL)}
            prefix={mL >= 0 ? 'td-g' : 'td-r'}
            horiz={true}
          />

          {/* Width dim line — left of enclosure */}
          <DimLine
            x1={tdX - 22} y1={tdY}
            x2={tdX - 22} y2={tdY + tdEH}
            label={`${EW}mm (${fmtMarg(mW)})`}
            color={dimCol(mW)}
            prefix={mW >= 0 ? 'td-g' : 'td-r'}
            horiz={false}
          />
        </svg>
      </div>

      {/* ── Cross-section SVG ─────────────────────────────────────────── */}
      <div className="card" style={{ padding: '10px 12px' }}>
        <div className="section-title">Cross-Section End View — Width × Depth</div>
        <svg viewBox="0 0 680 220" width="100%" style={{ display: 'block', maxWidth: 680 }}>
          <defs>
            <ArrowDefs prefix="cs-g" color="#1D9E75" />
            <ArrowDefs prefix="cs-r" color="#E24B4A" />
            <clipPath id="clip-cs">
              <rect x={csX} y={csY} width={csEW} height={csEH} />
            </clipPath>
          </defs>

          {/* Enclosure */}
          <rect x={csX} y={csY} width={csEW} height={csEH}
            fill="#F1EFE8" stroke="#5F5E5A" strokeWidth={1.5} />

          {/* Cells, thermal pads, BMS — all clipped to enclosure */}
          <g clipPath="url(#clip-cs)">
            {/* Series × parallel cell grid */}
            {csCells.map((c, i) => (
              <g key={i}>
                <rect x={c.x} y={c.y} width={c.w} height={c.h}
                  fill={cFillD} stroke={cStrD} strokeWidth={1} />
                {c.h > 12 && c.w > 30 && i === 0 && (
                  <text
                    x={c.x + c.w / 2} y={c.y + c.h / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(9, c.h * 0.5)}
                    fill={cStrD} fontFamily="Courier New,monospace"
                  >
                    S1
                  </text>
                )}
              </g>
            ))}

            {/* Thermal pads between series layers */}
            {csPads.map((p, i) => (
              <rect key={i} x={p.x} y={p.y} width={p.w} height={Math.max(p.h, 1)}
                fill="#9FE1CB" stroke="#0F6E56" strokeWidth={0.5} />
            ))}

            {/* BMS */}
            <rect x={bmsX} y={bmsY} width={bmsW} height={bmsH}
              fill={bmsFill} stroke={bmsStr} strokeWidth={1} />
            {bmsH > 8 && bmsW > 24 && (
              <text
                x={bmsX + bmsW / 2} y={bmsY + bmsH / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(9, bmsH * 0.65)}
                fill={bmsText} fontFamily="Courier New,monospace"
              >
                {bms_id || 'BMS'}
              </text>
            )}
          </g>

          {/* Config label */}
          <text x={csX + csEW / 2} y={csY - 8}
            textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="Courier New,monospace">
            {S}S stack · {P}P wide · BMS above
          </text>

          {/* Width dim line — below enclosure */}
          <DimLine
            x1={csX}       y1={csY + csEH + 22}
            x2={csX + csEW} y2={csY + csEH + 22}
            label={`${EW}mm (${fmtMarg(mW)})`}
            color={dimCol(mW)}
            prefix={mW >= 0 ? 'cs-g' : 'cs-r'}
            horiz={true}
          />

          {/* Depth dim line — left of enclosure */}
          <DimLine
            x1={csX - 22} y1={csY}
            x2={csX - 22} y2={csY + csEH}
            label={`${ED}mm (${fmtMarg(mD)})`}
            color={dimCol(mD)}
            prefix={mD >= 0 ? 'cs-g' : 'cs-r'}
            horiz={false}
          />
        </svg>
      </div>

    </div>
  );
}
