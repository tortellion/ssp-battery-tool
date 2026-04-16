/**
 * SSP Battery Layout DXF Generator
 * Outputs DXF R12 ASCII — imports into SolidWorks, Fusion 360, AutoCAD, CATIA, Inventor
 * All units: mm (model space)
 *
 * Two views in one file:
 *   Top-down (L × W) at origin (0, 0)
 *   Cross-section (W × D) offset right by (encL + 80)
 */

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const CELL = { L: 247.3, W: 112.5, T: 16.8 };
const BMS_SMALL = { W: 50, H: 12 };
const BMS_LARGE = { W: 80, H: 15 };
const WALL_CLR  = 2;    // DR-002: min cell-to-wall clearance mm
const CELL_GAP  = 3;    // DR-001: min gap between adjacent cells mm
const THERMAL_T = 1.5;  // thermal pad thickness mm
const BMS_GAP   = 2;    // gap between BMS bottom and cell stack top mm

// DXF layer → color number
const LAYERS = {
  ENCLOSURE:      { color: 7  },  // white/black (adapts to bg)
  WALL_CLEARANCE: { color: 9  },  // light gray
  CELLS:          { color: 5  },  // blue
  THERMAL_PADS:   { color: 3  },  // green
  BMS:            { color: 2  },  // yellow
  DIMENSIONS:     { color: 1  },  // red
  ANNOTATIONS:    { color: 7  },  // white/black
  TITLE_BLOCK:    { color: 7  },
};

// ── DXF PRIMITIVES ─────────────────────────────────────────────────────────

function dxfHeader(extMin, extMax) {
  return [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSUNITS', '70', '4',  // 4 = mm
    '9', '$EXTMIN',
    '10', extMin[0].toFixed(4),
    '20', extMin[1].toFixed(4),
    '9', '$EXTMAX',
    '10', extMax[0].toFixed(4),
    '20', extMax[1].toFixed(4),
    '9', '$LIMMIN', '10', '0.0', '20', '0.0',
    '9', '$LIMMAX',
    '10', extMax[0].toFixed(4),
    '20', extMax[1].toFixed(4),
    '0', 'ENDSEC',
  ].join('\n');
}

function dxfTables() {
  const layerEntries = Object.entries(LAYERS).map(([name, { color }]) => [
    '0', 'LAYER',
    '2', name,
    '70', '0',
    '62', color,
    '6', 'CONTINUOUS',
  ].join('\n')).join('\n');

  return [
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'LTYPE',
    '70', '1',
    '0', 'LTYPE',
    '2', 'CONTINUOUS',
    '70', '0',
    '3', 'Solid line',
    '72', '65',
    '73', '0',
    '40', '0.0',
    '0', 'ENDTAB',
    '0', 'TABLE',
    '2', 'LAYER',
    '70', Object.keys(LAYERS).length,
    layerEntries,
    '0', 'ENDTAB',
    '0', 'TABLE',
    '2', 'STYLE',
    '70', '1',
    '0', 'STYLE',
    '2', 'STANDARD',
    '70', '0',
    '40', '0.0',
    '41', '1.0',
    '50', '0.0',
    '71', '0',
    '42', '2.5',
    '3', 'txt',
    '4', '',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
  ].join('\n');
}

function dxfEntitiesSection(entities) {
  return [
    '0', 'SECTION',
    '2', 'ENTITIES',
    entities,
    '0', 'ENDSEC',
  ].join('\n');
}

// Closed rectangle as 4 lines
function rect(x, y, w, h, layer) {
  const x2 = x + w, y2 = y + h;
  return [
    line(x,  y,  x2, y,  layer),
    line(x2, y,  x2, y2, layer),
    line(x2, y2, x,  y2, layer),
    line(x,  y2, x,  y,  layer),
  ].join('\n');
}

function line(x1, y1, x2, y2, layer, linetype = 'CONTINUOUS') {
  return [
    '0', 'LINE',
    '8', layer,
    '6', linetype,
    '10', x1.toFixed(4),
    '20', y1.toFixed(4),
    '11', x2.toFixed(4),
    '21', y2.toFixed(4),
  ].join('\n');
}

function dashedLine(x1, y1, x2, y2, layer) {
  return line(x1, y1, x2, y2, layer, 'DASHED');
}

function text(x, y, content, height, layer, angle = 0, halign = 1) {
  // halign: 0=left, 1=center, 2=right
  return [
    '0', 'TEXT',
    '8', layer,
    '10', x.toFixed(4),
    '20', y.toFixed(4),
    '40', height.toFixed(4),
    '1',  String(content),
    '50', angle.toFixed(2),
    '72', halign,
    '11', x.toFixed(4),
    '21', y.toFixed(4),
  ].join('\n');
}

// Dimension line with arrows and text
function dimLine(x1, y1, x2, y2, label, layer = 'DIMENSIONS', textH = 3.5) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const entities = [];

  // Leader line
  entities.push(line(x1, y1, x2, y2, layer));

  // Small tick marks at ends
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len > 0.001) {
    const nx = -dy/len * 2, ny = dx/len * 2; // normal, 2mm ticks
    entities.push(line(x1 + nx, y1 + ny, x1 - nx, y1 - ny, layer));
    entities.push(line(x2 + nx, y2 + ny, x2 - nx, y2 - ny, layer));
  }

  // Label (offset perpendicular to line)
  const perpX = len > 0.001 ? -(y2-y1)/len * (textH * 1.5) : 0;
  const perpY = len > 0.001 ?  (x2-x1)/len * (textH * 1.5) : textH * 1.5;
  entities.push(text(mx + perpX, my + perpY, label, textH, 'ANNOTATIONS', 0, 1));

  return entities.join('\n');
}

// ── LAYOUT CALCULATIONS ────────────────────────────────────────────────────

function calcLayout(encL, encW, encD, S, P) {
  const bms = (S * P) <= 4 ? BMS_SMALL : BMS_LARGE;
  const cellStackW = P * CELL.W + (P - 1) * CELL_GAP;
  const stackD = S * CELL.T + (S > 1 ? (S - 1) * THERMAL_T : 0);
  const marginL = (encL - 2 * WALL_CLR - CELL.L) / 2;
  const marginW = (encW - 2 * WALL_CLR - cellStackW) / 2;
  const marginD = encD - 2 * WALL_CLR - bms.H - BMS_GAP - stackD;
  return { bms, cellStackW, stackD, marginL, marginW, marginD };
}

// ── TOP-DOWN VIEW ─────────────────────────────────────────────────────────
// Origin: (offsetX, offsetY) — bottom-left of enclosure in DXF coords

function drawTopDown(encL, encW, S, P, lay, offsetX, offsetY) {
  const entities = [];
  const { marginL, marginW } = lay;

  // Enclosure outline
  entities.push(rect(offsetX, offsetY, encL, encW, 'ENCLOSURE'));

  // Wall clearance boundary (dashed)
  entities.push(rect(
    offsetX + WALL_CLR, offsetY + WALL_CLR,
    encL - 2 * WALL_CLR, encW - 2 * WALL_CLR,
    'WALL_CLEARANCE'
  ));

  // Cell start positions
  const cellX = offsetX + WALL_CLR + Math.max(marginL, 0);
  const cellBaseY = offsetY + WALL_CLR + Math.max(marginW, 0);

  // P cells side by side in width direction
  for (let p = 0; p < P; p++) {
    const cellY = cellBaseY + p * (CELL.W + CELL_GAP);
    entities.push(rect(cellX, cellY, CELL.L, CELL.W, 'CELLS'));

    // Cell label
    entities.push(text(
      cellX + CELL.L / 2,
      cellY + CELL.W / 2 + 2,
      `ULTRA HC ${CELL.L}x${CELL.W}mm`,
      3.5, 'ANNOTATIONS', 0, 1
    ));
    entities.push(text(
      cellX + CELL.L / 2,
      cellY + CELL.W / 2 - 2,
      `${S}S${P}P`,
      3.5, 'ANNOTATIONS', 0, 1
    ));

    // Thermal pad between parallel cells
    if (p < P - 1) {
      const padY = cellY + CELL.W;
      entities.push(rect(cellX, padY, CELL.L, CELL_GAP, 'THERMAL_PADS'));
    }
  }

  // ── DIMENSION LINES ──
  const dimY = offsetY - 12; // above enclosure

  // Length margins (if they fit)
  if (marginL > 0.5) {
    entities.push(dimLine(
      offsetX + WALL_CLR, dimY,
      cellX, dimY,
      `${marginL.toFixed(1)}mm`
    ));
    entities.push(dimLine(
      cellX + CELL.L, dimY,
      offsetX + encL - WALL_CLR, dimY,
      `${marginL.toFixed(1)}mm`
    ));
  }
  // Total enclosure length
  entities.push(dimLine(
    offsetX, dimY - 10,
    offsetX + encL, dimY - 10,
    `ENCLOSURE L = ${encL}mm`
  ));

  // Width margin (right of enclosure)
  const dimX = offsetX + encL + 12;
  if (marginW > 0.5) {
    entities.push(dimLine(
      dimX, offsetY + WALL_CLR,
      dimX, cellBaseY,
      `${marginW.toFixed(1)}mm`
    ));
  }
  // Total enclosure width
  entities.push(dimLine(
    dimX + 10, offsetY,
    dimX + 10, offsetY + encW,
    `ENCLOSURE W = ${encW}mm`
  ));

  // View title
  entities.push(text(
    offsetX + encL / 2,
    offsetY + encW + 20,
    `TOP-DOWN VIEW (L x W)  |  ${S}S${P}P Configuration`,
    5, 'TITLE_BLOCK', 0, 1
  ));

  return entities.join('\n');
}

// ── CROSS-SECTION VIEW ────────────────────────────────────────────────────
// Origin: (offsetX, offsetY) — bottom-left of enclosure

function drawCrossSection(encW, encD, S, P, lay, offsetX, offsetY) {
  const entities = [];
  const { marginW, marginD, bms, cellStackW, stackD } = lay;

  // Enclosure outline
  entities.push(rect(offsetX, offsetY, encW, encD, 'ENCLOSURE'));

  // Wall clearance boundary
  entities.push(rect(
    offsetX + WALL_CLR, offsetY + WALL_CLR,
    encW - 2 * WALL_CLR, encD - 2 * WALL_CLR,
    'WALL_CLEARANCE'
  ));

  // In cross-section (W × D): BMS at top, cells below
  // DXF Y increases upward — top of enclosure = offsetY + encD
  const innerTop  = offsetY + encD - WALL_CLR;   // inner top (Y max, BMS starts here going down)
  const bmsTop    = innerTop - bms.H;             // BMS top edge Y
  const stackTop  = bmsTop - BMS_GAP - stackD;    // cell stack top Y
  const innerBot  = offsetY + WALL_CLR;           // inner bottom

  // Cell horizontal centering
  const cellTotalW = P * CELL.W + (P - 1) * CELL_GAP;
  const cellX = offsetX + (encW - cellTotalW) / 2;

  // BMS
  const bmsW = Math.min(bms.W * P, cellTotalW + 8);
  const bmsX = offsetX + (encW - bmsW) / 2;
  entities.push(rect(bmsX, bmsTop, bmsW, bms.H, 'BMS'));
  entities.push(text(
    bmsX + bmsW / 2,
    bmsTop + bms.H / 2,
    `BMS ${bms.W}x${bms.H}mm`,
    3, 'ANNOTATIONS', 0, 1
  ));

  // S cells stacked (bottom of stack = stackTop, each cell CT tall)
  // stackTop is the BOTTOM of the stack going upward
  for (let i = 0; i < S; i++) {
    const cellBotY = stackTop + i * (CELL.T + (i < S - 1 ? THERMAL_T : 0));

    // P cells side by side
    for (let p = 0; p < P; p++) {
      const cx = cellX + p * (CELL.W + CELL_GAP);
      entities.push(rect(cx, cellBotY, CELL.W, CELL.T, 'CELLS'));
      if (P <= 2) {
        entities.push(text(
          cx + CELL.W / 2, cellBotY + CELL.T / 2,
          `C${i + 1}`, 2.5, 'ANNOTATIONS', 0, 1
        ));
      }
    }

    // Thermal pad above this cell (between cells)
    if (i < S - 1) {
      const padY = cellBotY + CELL.T;
      entities.push(rect(cellX, padY, cellTotalW, THERMAL_T, 'THERMAL_PADS'));
    }
  }

  // ── DIMENSION LINES ──
  const dimX = offsetX + encW + 12;

  // BMS height
  entities.push(dimLine(
    dimX, bmsTop,
    dimX, bmsTop + bms.H,
    `BMS ${bms.H}mm`
  ));

  // Stack depth
  if (S > 0) {
    entities.push(dimLine(
      dimX + 14, stackTop,
      dimX + 14, stackTop + stackD,
      `Stack ${stackD.toFixed(1)}mm`
    ));
  }

  // Depth margin (or overflow)
  if (Math.abs(marginD) > 0.3) {
    const dBot = stackTop, dTop = innerBot;
    const label = marginD >= 0
      ? `Margin ${marginD.toFixed(1)}mm`
      : `OVERFLOW ${Math.abs(marginD).toFixed(1)}mm`;
    entities.push(dimLine(
      dimX + 28, Math.min(dBot, dTop),
      dimX + 28, Math.max(dBot, dTop),
      label
    ));
  }

  // Total depth
  entities.push(dimLine(
    dimX + 42, offsetY,
    dimX + 42, offsetY + encD,
    `D = ${encD}mm`
  ));

  // Width margin
  if (Math.abs(marginW) > 0.3) {
    const dimY = offsetY - 10;
    entities.push(dimLine(
      offsetX + WALL_CLR, dimY,
      cellX, dimY,
      `${marginW.toFixed(1)}mm`
    ));
  }

  // Total width
  entities.push(dimLine(
    offsetX, offsetY - 20,
    offsetX + encW, offsetY - 20,
    `W = ${encW}mm`
  ));

  // View title
  entities.push(text(
    offsetX + encW / 2,
    offsetY + encD + 20,
    `CROSS-SECTION (W x D)  |  ${S}S${P}P  |  ${S} cells stacked`,
    5, 'TITLE_BLOCK', 0, 1
  ));

  return entities.join('\n');
}

// ── NOTES BLOCK ───────────────────────────────────────────────────────────

function drawNotes(config, enclosure, lay, offsetX, offsetY) {
  const { S, P } = config;
  const { encL, encW, encD } = enclosure;
  const { marginL, marginW, marginD, bms } = lay;
  const totalCells = S * P;
  const fits = marginL >= 0 && marginW >= 0 && marginD >= 0;

  const lines = [
    `SSP BATTERY LAYOUT — ${S}S${P}P Configuration`,
    `Generated by SSP Battery Configuration Tool`,
    `─────────────────────────────────────────────`,
    `Enclosure: ${encL} x ${encW} x ${encD} mm`,
    `Cell: ULTRA HC Solid-State (${CELL.L} x ${CELL.W} x ${CELL.T} mm)`,
    `Total cells: ${totalCells}  |  BMS: ${bms.W} x ${bms.H} mm`,
    `─────────────────────────────────────────────`,
    `Length margin: ${marginL.toFixed(1)} mm  ${marginL >= 5 ? '(OK)' : marginL >= 0 ? '(TIGHT)' : '(OVERFLOW)'}`,
    `Width margin:  ${marginW.toFixed(1)} mm  ${marginW >= 5 ? '(OK)' : marginW >= 0 ? '(TIGHT)' : '(OVERFLOW)'}`,
    `Depth margin:  ${marginD.toFixed(1)} mm  ${marginD >= 5 ? '(OK)' : marginD >= 0 ? '(TIGHT)' : '(OVERFLOW)'}`,
    `─────────────────────────────────────────────`,
    fits ? `STATUS: FITS` : `STATUS: DOES NOT FIT — REVIEW REQUIRED`,
    `─────────────────────────────────────────────`,
    `Design rules applied:`,
    `  Wall clearance: ${WALL_CLR}mm (DR-002)`,
    `  Cell gap: ${CELL_GAP}mm (DR-001)`,
    `  Thermal pad: ${THERMAL_T}mm (DR-003)`,
    `  BMS gap: ${BMS_GAP}mm (DR-006)`,
    `─────────────────────────────────────────────`,
    `PRELIMINARY — REQUIRES ENGINEERING VALIDATION`,
  ];

  return lines.map((ln, i) =>
    text(offsetX, offsetY - i * 6, ln, 3.5, i === 0 ? 'TITLE_BLOCK' : 'ANNOTATIONS', 0, 0)
  ).join('\n');
}

// ── MAIN EXPORT FUNCTION ───────────────────────────────────────────────────

/**
 * generateDXF(config, enclosure) → string
 *
 * config:    { series_count, parallel_count, bms_id, total_cells }
 * enclosure: { length_mm, width_mm, depth_mm }
 *
 * Returns a complete DXF R12 ASCII string ready to save as .dxf
 */
export function generateDXF(config, enclosure) {
  const S   = config.series_count   || 1;
  const P   = config.parallel_count || 1;
  const encL = enclosure.length_mm;
  const encW = enclosure.width_mm;
  const encD = enclosure.depth_mm;

  const lay = calcLayout(encL, encW, encD, S, P);

  // Layout positions in DXF space
  // Top-down at origin (0, 0)
  // Cross-section offset right + gap
  const crossOffsetX = encL + 80;
  const crossOffsetY = 0;
  // Notes to the right of cross-section
  const notesX = crossOffsetX + encW + 70;
  const notesY = encD + 20;

  // Build entities
  const topDownEntities     = drawTopDown(encL, encW, S, P, lay, 0, 0);
  const crossSectionEntities = drawCrossSection(encW, encD, S, P, lay, crossOffsetX, crossOffsetY);
  const notesEntities       = drawNotes({ S, P }, { encL, encW, encD }, lay, notesX, notesY);

  const allEntities = [topDownEntities, crossSectionEntities, notesEntities].join('\n');

  // Compute extents for HEADER
  const extMinX = -5;
  const extMinY = -60;
  const extMaxX = notesX + 200;
  const extMaxY = Math.max(encW, encD) + 60;

  // Assemble DXF
  const sections = [
    dxfHeader([extMinX, extMinY], [extMaxX, extMaxY]),
    dxfTables(),
    dxfEntitiesSection(allEntities),
    '0\nEOF',
  ];

  return sections.join('\n');
}

/**
 * downloadDXF(config, enclosure, filename) — triggers browser download
 */
export function downloadDXF(config, enclosure, filename) {
  const dxf = generateDXF(config, enclosure);
  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename || `SSP_Layout_${config.series_count}S${config.parallel_count}P.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
