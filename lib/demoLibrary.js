export const DEMO_LIBRARY = {
  cells: [
    { id:'ULTRA-HC-001', name:'ULTRA High Capacity Solid-State Cell', type:'ULTRA HC', status:'Volume Production', length_mm:247.3, width_mm:112.5, thickness_mm:16.8, weight_g:500, nominal_voltage_v:3.6, capacity_ah:39, energy_wh:164, min_temp_c:-20, max_temp_c:70, cost_usd: null },
    { id:'HC-001', name:'High Capacity Solid-State Cell', type:'HC', status:'High Volume Production', length_mm:247.3, width_mm:112.5, thickness_mm:16.8, weight_g:500, nominal_voltage_v:3.6, capacity_ah:31, energy_wh:111, min_temp_c:-20, max_temp_c:70, cost_usd: null },
    { id:'HD-001', name:'High Discharge Solid-State Cell', type:'HD', status:'High Volume Production', length_mm:247.3, width_mm:112.5, thickness_mm:16.8, weight_g:500, nominal_voltage_v:3.6, capacity_ah:30, energy_wh:111, min_temp_c:-20, max_temp_c:70, cost_usd: null }
  ],
  bms_boards: [
    { id:'BMS-S-001', name:'BMS Small (1–4 cells)', min_cells:1, max_cells:4, length_mm:80, width_mm:50, height_mm:12, weight_g:45, cost_usd: null },
    { id:'BMS-L-001', name:'BMS Large (5–14 cells)', min_cells:5, max_cells:14, length_mm:120, width_mm:80, height_mm:15, weight_g:95, cost_usd: null }
  ],
  thermal: [
    { id:'THERM-PAD-001', name:'Inter-cell Thermal Pad', type:'Pad', thickness_mm:1.5, weight_g:18, cost_usd: null },
    { id:'THERM-BAR-001', name:'Cell-to-Case Thermal Barrier', type:'Barrier', thickness_mm:2.0, weight_g:22, cost_usd: null }
  ],
  connectors: [
    { id:'CONN-POWER-001', name:'Power Connector', type:'Power', weight_g:30, cost_usd: null },
    { id:'CONN-SIG-001', name:'Signal Connector', type:'Signal', weight_g:15, cost_usd: null }
  ],
  cases: [
    { id:'CASE-S-001', name:'Small Case (1–2 cells)', internal_length_mm:270, internal_width_mm:130, internal_depth_mm:45, wall_thickness_mm:3, weight_g:180, cost_usd:0 },
    { id:'CASE-M-001', name:'Medium Case (3–8 cells)', internal_length_mm:400, internal_width_mm:250, internal_depth_mm:80, wall_thickness_mm:3, weight_g:320, cost_usd:120 },
    { id:'CASE-L-001', name:'Large Case (9–14 cells)', internal_length_mm:600, internal_width_mm:350, internal_depth_mm:120, wall_thickness_mm:4, weight_g:580, cost_usd:185 }
  ],
  wiring: [
    { id:'WIRE-POWER-001', name:'Power Leads', gauge_awg:10, weight_g:25, cost_usd: null },
    { id:'WIRE-SIG-001', name:'Signal Wires', gauge_awg:22, weight_g:12, cost_usd: null },
    { id:'WIRE-BAL-001', name:'Balance Leads', gauge_awg:24, weight_g:18, cost_usd: null }
  ],
  design_rules: [
    { id:'DR-001', category:'Clearance', description:'Minimum gap between adjacent cells', value:3, unit:'mm', mandatory:'Mandatory', reason:'Thermal expansion and assembly tolerance' },
    { id:'DR-002', category:'Clearance', description:'Minimum clearance between cell and case wall', value:2, unit:'mm', mandatory:'Mandatory', reason:'Thermal dissipation and vibration isolation' },
    { id:'DR-003', category:'Thermal', description:'Thermal pad required between every pair of adjacent cells', value:null, unit:'—', mandatory:'Mandatory', reason:'Prevents localized hot spots' },
    { id:'DR-004', category:'Thermal', description:'Max sustained cell surface temperature under load', value:60, unit:'°C', mandatory:'Mandatory', reason:'Cell datasheet limit' },
    { id:'DR-005', category:'Placement', description:'BMS board placed on top of cell stack', value:null, unit:'—', mandatory:'Preferred', reason:'Serviceability' },
    { id:'DR-006', category:'Electrical', description:'Max cells in series without mid-pack voltage tap', value:4, unit:'cells', mandatory:'Mandatory', reason:'BMS balancing limitation' },
    { id:'DR-007', category:'Safety', description:'Max stack height without intermediate structural support', value:6, unit:'cells', mandatory:'Mandatory', reason:'Vibration — unsupported stacks flex' },
    { id:'DR-008', category:'Safety', description:'Minimum distance from cell tab to case wall', value:5, unit:'mm', mandatory:'Mandatory', reason:'Arc/short prevention' }
  ]
};
