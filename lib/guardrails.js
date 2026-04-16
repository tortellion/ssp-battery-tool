const BANNED = [
  'zero thermal propagation', 'zero fire events', "can't catch fire",
  "cannot catch fire", 'half the weight', 'solid state marine',
  'ndaa compliant', 'ndaa-compliant', 'sells cells', 'government customer'
];
const BANNED_RE = [/\d+\s*wh\/kg/i, /\b\d+(\.\d+)?c\s*(discharge|charge|rate)/i];

const REQUIRED_PROOFS_NM = [
  '2+ years of continuous deployment in marine environments',
  '6 mw shipped in 2025 across 30+ production skus',
  'customers include huntington ingalls industries, havocai, and vatn',
  'ibex 2025 innovation award (nmma)'
];

export function nm(s) {
  if (typeof s !== 'string') return '';
  return s.normalize('NFKC').toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function scanViolations(obj, path, out) {
  if (!obj) return;
  if (typeof obj === 'string') {
    const n = nm(obj);
    BANNED.forEach(p => { if (n.includes(p)) out.push({ field: path, phrase: p }); });
    BANNED_RE.forEach(r => { if (r.test(n)) out.push({ field: path, phrase: String(r) }); });
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => scanViolations(v, `${path}[${i}]`, out));
  } else if (typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => scanViolations(v, path ? `${path}.${k}` : k, out));
  }
}

export function validateSpecSheet(content) {
  const violations = [];
  scanViolations(content, '', violations);

  const proofs = content.proof_points || [];
  REQUIRED_PROOFS_NM.forEach(req => {
    if (!proofs.some(p => nm(p) === req))
      violations.push({ field: 'proof_points', phrase: `Missing: "${req.slice(0, 55)}…"` });
  });

  ['WEIGHT', 'SIZE', 'DISCHARGE', 'CHARGE', 'TEMPERATURE', 'FIRE SAFETY'].forEach(metric => {
    const row = (content.comparison_rows || []).find(r => r.metric === metric);
    if (!row) { violations.push({ field: 'comparison_rows', phrase: `Missing row: ${metric}` }); return; }
    ['ssp_claim', 'ssp_application', 'lfp_baseline', 'lfp_consequence', 'improvement'].forEach(f => {
      if (!row[f] || !String(row[f]).trim())
        violations.push({ field: `comparison_rows.${metric}.${f}`, phrase: 'Empty field' });
    });
  });

  return { ok: violations.length === 0, violations };
}

export function validateConfigResponse(parsed) {
  const errors = [];
  if (typeof parsed.viable !== 'boolean') return { valid: false, errors: ['viable not boolean'] };
  if (!Array.isArray(parsed.configurations)) return { valid: false, errors: ['configurations not array'] };

  parsed.configurations.forEach((c, i) => {
    const pre = `cfg[${i}]`;
    if (Number.isInteger(c.series_count) && Number.isInteger(c.parallel_count) && Number.isInteger(c.total_cells)) {
      if (c.series_count * c.parallel_count !== c.total_cells)
        errors.push(`${pre}: ${c.series_count}×${c.parallel_count}≠${c.total_cells}`);
    }
    if (c.fits === true && (c.margin_length_mm < 0 || c.margin_width_mm < 0 || c.margin_depth_mm < 0))
      errors.push(`${pre}: fits=true but negative margin`);
    const wb = c.weight_breakdown || {};
    if (!wb.bms_g || wb.bms_g <= 0) errors.push(`${pre}.bms_g must be >0`);
    if (!wb.thermal_g || wb.thermal_g <= 0) errors.push(`${pre}.thermal_g must be >0`);
    const notes = (c.notes || '').toLowerCase();
    if (!notes.includes('length') || !notes.includes('width') || !notes.includes('depth'))
      errors.push(`${pre}.notes missing dimension arithmetic`);
  });

  return { valid: errors.length === 0, errors };
}

export const CONFIG_SYSTEM_PROMPT = `You are the SSP Battery Configuration Engine. RESPOND WITH ONLY VALID JSON, no markdown, no preamble.
RULES: series_count × parallel_count MUST equal total_cells exactly. fits=true ONLY if ALL margins >=0. bms_g and thermal_g must be >0. notes MUST show length/width/depth arithmetic with = signs. VOLTAGE: 12V→4S(14.4V), 24V→7S(25.2V), 36V→10S(36V), 48V→14S(50.4V). Only use cell IDs from provided library.
Schema: {"viable":boolean,"rejected_reasons":[],"configurations":[{"id":"","name":"","cell_id":"","series_count":int,"parallel_count":int,"total_cells":int,"nominal_voltage_v":number,"total_energy_wh":number,"total_weight_g":number,"weight_breakdown":{"cells_g":number,"bms_g":number,"thermal_g":number,"case_g":number,"connectors_g":number},"margin_length_mm":number,"margin_width_mm":number,"margin_depth_mm":number,"fits":boolean,"bms_id":"","case_id":"","notes":"length/width/depth arithmetic with = signs","cost_estimate":{"subtotal_usd":number,"quote_price_usd":number}}]}`;

export const SPEC_SYSTEM_PROMPT = `You are the SSP Spec Sheet Generator. RESPOND WITH ONLY VALID JSON, no markdown, no preamble.
NEVER SAY: any Wh/kg number, "half the weight", "zero thermal propagation", "zero fire events", "can't catch fire", "Solid State Marine", "NDAA compliant", any C-rate.
ALWAYS: fire safety = "Solid electrolyte — significantly reduced risk of thermal runaway". Compare vs "LFP (Lithium Iron Phosphate)". Reference customer's actual product name in ssp_application and lfp_consequence.
proof_points MUST contain EXACTLY: "2+ years of continuous deployment in marine environments","6 MW shipped in 2025 across 30+ production SKUs","Customers include Huntington Ingalls Industries, HAVOCAI, and VATN","IBEX 2025 Innovation Award (NMMA)"
ALL 6 rows (WEIGHT,SIZE,DISCHARGE,CHARGE,TEMPERATURE,FIRE SAFETY) must have non-empty content in all 5 fields.
Schema: {"product_name":"","company_name":"","spec_block":{"capacity_wh":0,"system_voltage_v":0,"weight_kg":0,"weight_lbs":0,"dimensions_mm":"","dimensions_inches":"","temp_range":"","charge_rate_vs_lfp":"","discharge_rate_vs_lfp":"","fire_safety":"","cell_construction":""},"comparison_rows":[{"metric":"WEIGHT","ssp_claim":"","ssp_application":"","lfp_baseline":"","lfp_consequence":"","improvement":"+48%"},{"metric":"SIZE","ssp_claim":"","ssp_application":"","lfp_baseline":"","lfp_consequence":"","improvement":"+55%"},{"metric":"DISCHARGE","ssp_claim":"","ssp_application":"","lfp_baseline":"","lfp_consequence":"","improvement":"6x faster"},{"metric":"CHARGE","ssp_claim":"","ssp_application":"","lfp_baseline":"","lfp_consequence":"","improvement":"6x faster"},{"metric":"TEMPERATURE","ssp_claim":"","ssp_application":"","lfp_baseline":"","lfp_consequence":"","improvement":"2x range"},{"metric":"FIRE SAFETY","ssp_claim":"","ssp_application":"","lfp_baseline":"","lfp_consequence":"","improvement":"Solid electrolyte"}],"proof_points":["2+ years of continuous deployment in marine environments","6 MW shipped in 2025 across 30+ production SKUs","Customers include Huntington Ingalls Industries, HAVOCAI, and VATN","IBEX 2025 Innovation Award (NMMA)"],"compliance_strip":"ITAR Registered · DFARS Qualifying Countries · Buy American Act · UN-38 · HubZone · UL/CE In Process · 13+ Patents","manufacturing":"Manufactured in Rhode Island, USA · 31,000 sq ft facility"}`;
