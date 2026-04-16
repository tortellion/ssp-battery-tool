import { useState, useEffect, useCallback } from 'react';
import BatteryLayout from '../components/BatteryLayout';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { validateSpecSheet } from '../lib/guardrails';

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const NUMERIC_COLS = new Set(['length_mm','width_mm','thickness_mm','weight_g','nominal_voltage_v','capacity_ah','energy_wh','min_temp_c','max_temp_c','cost_usd','min_cells','max_cells','height_mm','internal_length_mm','internal_width_mm','internal_depth_mm','wall_thickness_mm','value','gauge_awg']);
const SECTION_LABELS = { cells:'Cells', bms_boards:'BMS Boards', connectors:'Connectors', thermal:'Thermal', cases:'Cases', wiring:'Wiring', design_rules:'Design Rules' };
const SCHEMAS = {
  cells:['id','name','type','status','length_mm','width_mm','thickness_mm','weight_g','nominal_voltage_v','capacity_ah','energy_wh','min_temp_c','max_temp_c','cost_usd'],
  bms_boards:['id','name','min_cells','max_cells','length_mm','width_mm','height_mm','weight_g','cost_usd'],
  connectors:['id','name','type','cost_usd'],
  thermal:['id','name','type','thickness_mm','weight_g','cost_usd'],
  cases:['id','name','internal_length_mm','internal_width_mm','internal_depth_mm','wall_thickness_mm','weight_g','cost_usd'],
  wiring:['id','name','application','gauge_awg','cost_usd'],
  design_rules:['id','category','description','value','unit','mandatory','reason']
};
const BANNED_INJECTION = ['ignore previous instructions','ignore all instructions','disregard','new instruction','system:','you are now','forget your instructions','override','jailbreak'];

function nm(s){ if(typeof s!=='string')return ''; return s.normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim(); }

function sanitizeText(v,field,onWarn){
  if(!v) return v;
  if(BANNED_INJECTION.some(p=>nm(v).includes(p))){ onWarn(field); return '[Input sanitized — review before use]'; }
  return v;
}

function checkNDAA(v,onWarn){
  if(['ndaa','section 154'].some(p=>nm(v||'').includes(p))){ onWarn(); return '[Removed — verify with engineering team]'; }
  return v;
}

// ── COGS ───────────────────────────────────────────────────────────────────
function calcCOGS(cfg, library, settings) {
  const cell = library.cells?.find(c=>c.id===cfg.cell_id);
  const bms  = library.bms_boards?.find(b=>b.id===cfg.bms_id);
  const cas  = library.cases?.find(c=>c.id===cfg.case_id);
  if(!cell || cell.cost_usd===null || !bms || bms.cost_usd===null) return null;
  const margin = Math.min(99, Math.max(0, Number(settings.margin_percent) || 0));
  if ((1 - margin / 100) <= 0) return null;
  const padCost=8, barCost=6, connCost=22, wireCost=38;
  const pads=Math.max(0,cfg.total_cells-1);
  const caseCost=cas?.cost_usd||0;
  const laborHrs=settings.base_hours+(settings.per_cell_hours*cfg.total_cells);
  const labor=laborHrs*settings.labor_rate;
  const cogs=(cell.cost_usd*cfg.total_cells)+bms.cost_usd+(padCost*pads)+barCost+connCost+wireCost+caseCost+labor;
  return { cogs, quote:cogs/(1-(margin/100)), margin_pct:margin,
    lines:[{label:`Cells (${cfg.total_cells}× ${cell.name})`,cost:cell.cost_usd*cfg.total_cells},{label:'BMS',cost:bms.cost_usd},{label:'Thermal management',cost:(padCost*pads)+barCost},{label:'Connectors & wiring',cost:connCost+wireCost},{label:'Case',cost:caseCost},{label:`Labor (${laborHrs.toFixed(1)}h @ $${settings.labor_rate}/hr)`,cost:labor}]
  };
}

// ── SPEC SHEET COMPONENT ───────────────────────────────────────────────────
function SpecSheet({ content }) {
  return (
    <div id="spec-print">
      <div className="spec-header">
        <span style={{color:'#fff',fontWeight:700,fontSize:12,letterSpacing:2,textTransform:'uppercase'}}>SOLID STATE POWER</span>
        <div style={{textAlign:'right'}}>
          <div style={{color:'#C4A03C',fontSize:11,fontWeight:600}}>{content.product_name}</div>
          <div style={{color:'#94a3b8',fontSize:10}}>{content.company_name} · Custom Battery Product Sheet</div>
        </div>
      </div>
      <div style={{border:'0.5px solid #e2e8f0',borderTop:'none',padding:'12px 16px',background:'#fff'}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'#0B1E3D',marginBottom:8}}>Battery Specifications</div>
        <div className="spec-grid">
          {[['Capacity',content.spec_block.capacity_wh+' Wh'],['System voltage',content.spec_block.system_voltage_v+' V'],['Weight',content.spec_block.weight_kg+' kg ('+content.spec_block.weight_lbs+' lbs)'],['Dimensions mm',content.spec_block.dimensions_mm],['Dimensions in',content.spec_block.dimensions_inches],['Operating temp',content.spec_block.temp_range],['Discharge vs. LFP',content.spec_block.discharge_rate_vs_lfp],['Charge vs. LFP',content.spec_block.charge_rate_vs_lfp],['Fire safety',content.spec_block.fire_safety],['Cell construction',content.spec_block.cell_construction]].map(([l,v])=>(
            <div key={l}><div style={{fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:0.5}}>{l}</div><div style={{fontSize:11,color:'#0B1E3D',fontWeight:500,marginTop:1}}>{v}</div></div>
          ))}
        </div>
      </div>
      <div className="comparison-section">
        <div style={{padding:'10px 16px 6px',fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'#0B1E3D'}}>Performance vs. LFP (Lithium Iron Phosphate)</div>
        <table className="comp-table">
          <thead><tr><th>Metric</th><th>SSP claim</th><th>Your application</th><th>LFP baseline</th><th>LFP consequence</th><th>Δ</th></tr></thead>
          <tbody>{(content.comparison_rows||[]).map(r=>(
            <tr key={r.metric}>
              <td className="comp-metric">{r.metric}</td>
              <td className="comp-ssp">{r.ssp_claim}</td>
              <td className="comp-app" data-field="ssp_application">{r.ssp_application}</td>
              <td className="comp-lfp-base">{r.lfp_baseline}</td>
              <td className="comp-lfp-cons" data-field="lfp_consequence">{r.lfp_consequence}</td>
              <td className="comp-delta">{r.improvement}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="proof-grid">{(content.proof_points||[]).map((p,i)=><div key={i} className="proof-item">{p}</div>)}</div>
      </div>
      <div className="compliance-strip">
        <strong>Compliance: </strong>{content.compliance_strip}<br/>
        <strong>Manufacturing: </strong>{content.manufacturing}
      </div>
      <div className="spec-footer">
        <span style={{fontSize:10,color:'#94a3b8'}}>Tom Calef, CEO · tom@solidstatepower.com · 508-326-7546</span>
        <span style={{fontSize:10,color:'#C4A03C',fontWeight:600}}>solidstatepower.com</span>
      </div>
    </div>
  );
}

// ── CONFIGURE TAB ──────────────────────────────────────────────────────────
function ConfigureTab({ library, settings, userEmail }) {
  const [form, setForm] = useState({
    company:'SpectrEdge Wireless Inc.', product:'PulsarEdge-Tactical', vertical:'Defense/Autonomy',
    length:'265', width:'125', depth:'28', max_weight:'900',
    voltage:'12V', min_wh:'140', target_wh:'164',
    min_temp:'-20', max_temp:'70', ip:'IP65', vibe:'Severe', salt:true,
    itar:true, dfars:true, ba:true, un38:true, ul:false, ce:false, comp_other:'',
    app:'AI-powered 5G tactical network. Soldier-portable, backpack/vehicle/drone mountable. Target under 8 lbs total device weight.',
    priority:'High'
  });
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const [configResult, setConfigResult] = useState(null);
  const [selectedCfg, setSelectedCfg] = useState(null);
  const [specContent, setSpecContent] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [quoteMarginkUsed, setQuoteMarginkUsed] = useState(null);
  const [quoteStale, setQuoteStale] = useState(false);

  const [configLoading, setConfigLoading] = useState(false);
  const [specLoading, setSpecLoading] = useState(false);
  const [configErr, setConfigErr] = useState('');
  const [specErr, setSpecErr] = useState('');
  const [specViolations, setSpecViolations] = useState([]);
  const [ndaaWarn, setNdaaWarn] = useState(false);
  const [injectionWarnFields, setInjectionWarnFields] = useState([]);

  useEffect(()=>{ if(quoteMarginkUsed!==null&&settings.margin_percent!==quoteMarginkUsed) setQuoteStale(true); },[settings.margin_percent]);

  const VERTICALS=['Defense/Autonomy','Ground Robotics','Defense Primes','EV & Powersports','Aviation & eVTOL','Rehab & Medical','Ag Tech & OPE','Maritime & Naval','Construction','Soldier-Worn Power','Underground Mining','Hazardous Area','Energy Storage / Critical Buildings'];

  const handleConfigure = async () => {
    setConfigErr(''); setConfigResult(null); setSelectedCfg(null); setSpecContent(null); setQuoteData(null); setSpecViolations([]);
    if(!library?.cells?.length){ setConfigErr('No cells in library — import your component catalog in the Library tab first.'); return; }
    setConfigLoading(true);
    try {
      const compOther = checkNDAA(form.comp_other, ()=>setNdaaWarn(true));
      const warnField = f => setInjectionWarnFields(prev => prev.includes(f)?prev:[...prev,f]);
      const payload = {
        company: sanitizeText(form.company,'company_name',warnField),
        product: sanitizeText(form.product,'product_name',warnField),
        vertical: form.vertical,
        dimensions:{ length_mm:+form.length, width_mm:+form.width, depth_mm:+form.depth },
        max_weight_g:+form.max_weight||null,
        system_voltage:form.voltage,
        min_capacity_wh:+form.min_wh,
        target_capacity_wh:+form.target_wh||null,
        temp_range:{ min_c:+form.min_temp, max_c:+form.max_temp },
        ip:form.ip, vibration:form.vibe,
        application: sanitizeText(form.app,'application',warnField),
        compliance:['ITAR','DFARS','Buy American','UN-38','UL','CE'].filter((_,i)=>[form.itar,form.dfars,form.ba,form.un38,form.ul,form.ce][i]),
        compliance_other: compOther
      };
      const res = await fetch('/api/configure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,library,design_rules:library.design_rules})});
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||(data.details||[]).join('\n'));
      setConfigResult(data);
    } catch(e) {
      setConfigErr(e.message||'Configuration engine unavailable. Check your connection.');
    } finally { setConfigLoading(false); }
  };

  const handleGenSpec = async (cfg) => {
    setSpecErr(''); setSpecContent(null); setSpecViolations([]); setQuoteData(null);
    setSpecLoading(true);
    try {
      const res = await fetch('/api/specsheet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({configuration:cfg,customerInfo:{company:form.company,product:form.product,application:form.app,vertical:form.vertical}})});
      const data = await res.json();
      if(res.status===422){ setSpecViolations(data.violations||[]); return; }
      if(!res.ok) throw new Error(data.error);
      setSpecContent(data);
      const qd = calcCOGS(cfg,library,settings);
      setQuoteData(qd); setQuoteMarginkUsed(settings.margin_percent); setQuoteStale(false);
      // Save to history
      await fetch('/api/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company:form.company,product:form.product,vertical:form.vertical,voltage:form.voltage,capacity_wh:cfg.total_energy_wh,spec_content:data,cfg_summary:{total_cells:cfg.total_cells,cell_id:cfg.cell_id,nominal_voltage_v:cfg.nominal_voltage_v}})});
    } catch(e) {
      setSpecErr(e.message||'Spec sheet engine unavailable.');
    } finally { setSpecLoading(false); }
  };

  const recalc = (cfg) => {
    const qd=calcCOGS(cfg,library,settings);
    if(qd){ setQuoteData(qd); setQuoteMarginkUsed(settings.margin_percent); setQuoteStale(false); }
  };

  return (
    <div className="grid2">
      {/* LEFT — Form */}
      <div>
        {ndaaWarn && <div className="warn-box">⚠ NDAA language removed. Confirm SSP's position with engineering before customer-facing use. <button onClick={()=>setNdaaWarn(false)} style={{float:'right',background:'none',border:'none',cursor:'pointer',fontSize:14,color:'inherit'}}>×</button></div>}
        {injectionWarnFields.length>0 && <div className="warn-box">⚠ Input sanitized in: {injectionWarnFields.join(', ')}. <button onClick={()=>setInjectionWarnFields([])} style={{float:'right',background:'none',border:'none',cursor:'pointer',fontSize:14,color:'inherit'}}>×</button></div>}

        <div className="card">
          <div className="section-title">Customer</div>
          <div className="grid2" style={{gap:8}}>
            <div className="form-group"><label className="fl">Company *</label><input type="text" value={form.company} onChange={e=>sf('company',e.target.value)}/></div>
            <div className="form-group"><label className="fl">Product *</label><input type="text" value={form.product} onChange={e=>sf('product',e.target.value)}/></div>
          </div>
          <div className="form-group"><label className="fl">Vertical *</label>
            <select value={form.vertical} onChange={e=>sf('vertical',e.target.value)}>{VERTICALS.map(v=><option key={v}>{v}</option>)}</select>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Enclosure</div>
          <div className="grid4">
            {[['length','L mm *'],['width','W mm *'],['depth','D mm *'],['max_weight','Max g']].map(([k,l])=>(
              <div key={k} className="form-group"><label className="fl">{l}</label><input type="number" value={form[k]} onChange={e=>sf(k,e.target.value)}/></div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-title">Electrical</div>
          <div className="grid3">
            <div className="form-group"><label className="fl">Voltage *</label>
              <select value={form.voltage} onChange={e=>sf('voltage',e.target.value)}>{['3.6V','7.2V','12V','14.4V','24V','36V','48V','Other'].map(v=><option key={v}>{v}</option>)}</select>
            </div>
            <div className="form-group"><label className="fl">Min Wh *</label><input type="number" value={form.min_wh} onChange={e=>sf('min_wh',e.target.value)}/></div>
            <div className="form-group"><label className="fl">Target Wh</label><input type="number" value={form.target_wh} onChange={e=>sf('target_wh',e.target.value)}/></div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Environment</div>
          <div className="grid4">
            <div className="form-group"><label className="fl">Min °C</label><input type="number" value={form.min_temp} onChange={e=>sf('min_temp',e.target.value)}/></div>
            <div className="form-group"><label className="fl">Max °C</label><input type="number" value={form.max_temp} onChange={e=>sf('max_temp',e.target.value)}/></div>
            <div className="form-group"><label className="fl">IP Rating</label>
              <select value={form.ip} onChange={e=>sf('ip',e.target.value)}>{['None','IP44','IP54','IP65','IP67','IP68','MIL-STD'].map(v=><option key={v}>{v}</option>)}</select>
            </div>
            <div className="form-group"><label className="fl">Vibration</label>
              <select value={form.vibe} onChange={e=>sf('vibe',e.target.value)}>{['None','Low','Moderate','Severe','Military Spec'].map(v=><option key={v}>{v}</option>)}</select>
            </div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',marginTop:4}}><input type="checkbox" checked={form.salt} onChange={e=>sf('salt',e.target.checked)}/> Salt spray</label>
        </div>

        <div className="card">
          <div className="section-title">Compliance</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:10}}>
            {[['itar','ITAR'],['dfars','DFARS'],['ba','Buy American'],['un38','UN-38'],['ul','UL'],['ce','CE']].map(([k,l])=>(
              <label key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,cursor:'pointer'}}><input type="checkbox" checked={form[k]} onChange={e=>sf(k,e.target.checked)}/> {l}</label>
            ))}
          </div>
          <div className="form-group"><label className="fl">Other Compliance</label><input type="text" value={form.comp_other} onChange={e=>{sf('comp_other',e.target.value);checkNDAA(e.target.value,()=>setNdaaWarn(true));}}/></div>
        </div>

        <div className="card">
          <div className="section-title">Application *</div>
          <textarea rows={3} value={form.app} onChange={e=>sf('app',e.target.value)} style={{marginBottom:8}}/>
          <div className="form-group"><label className="fl">Priority</label>
            <select value={form.priority} onChange={e=>sf('priority',e.target.value)}>{['Low','Medium','High','Critical'].map(v=><option key={v}>{v}</option>)}</select>
          </div>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleConfigure} disabled={configLoading}>
          {configLoading ? <><span className="spinner"/>Running configuration engine…</> : 'Generate Configuration'}
        </button>
      </div>

      {/* RIGHT — Results */}
      <div>
        {configErr && <div className="error-box">{configErr}</div>}

        {configResult && !configResult.viable && (
          <div className="card" style={{borderLeft:'3px solid var(--red)'}}>
            <div style={{fontWeight:700,color:'var(--red)',marginBottom:6}}>No viable configuration</div>
            {(configResult.rejected_reasons||[]).map((r,i)=><div key={i} style={{fontSize:11,color:'#64748b',marginBottom:3}}>· {r}</div>)}
          </div>
        )}

        {configResult?.viable && configResult.configurations.map((cfg,i)=>(
          <div key={cfg.id} className={`cfg-card${selectedCfg?.id===cfg.id?' selected':''}`} onClick={()=>setSelectedCfg(cfg)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div><span style={{fontSize:9,color:'#94a3b8',display:'block'}}>Option {i+1}</span><span style={{fontSize:13,fontWeight:600,color:'#0B1E3D'}}>{cfg.name}</span></div>
              <span className={cfg.fits?'success-tag':'fail-tag'}>{cfg.fits?'FITS':'OVERSIZED'}</span>
            </div>
            <div className="cfg-meta">
              {[['Cells',`${cfg.total_cells} (${cfg.series_count}S${cfg.parallel_count}P)`],['Energy',`${cfg.total_energy_wh} Wh`],['Voltage',`${cfg.nominal_voltage_v}V`],['Weight',`${(cfg.total_weight_g/1000).toFixed(2)} kg`],['Margins',`L:${cfg.margin_length_mm} W:${cfg.margin_width_mm} D:${cfg.margin_depth_mm}`],['Cell',cfg.cell_id]].map(([l,v])=>(
                <div key={l}><span className="cfg-meta-label">{l}</span>{v}</div>
              ))}
            </div>
            <div className="notes-text">{cfg.notes}</div>
            {selectedCfg?.id===cfg.id && (
              <div style={{marginTop:10}}>
                <button className="btn btn-gold" onClick={e=>{e.stopPropagation();handleGenSpec(cfg);}} disabled={specLoading}>
                  {specLoading?<><span className="spinner"/>Generating…</>:'Generate Spec Sheet & Quote ↓'}
                </button>
              </div>
            )}
          </div>
        ))}

        {specErr && <div className="error-box">{specErr}</div>}
        {specViolations.length>0 && (
          <div className="error-box">
            <strong>Spec sheet failed guardrail validation — not rendered.</strong><br/>
            {specViolations.map((v,i)=><div key={i}>· <strong>{v.field}</strong>: {v.phrase}</div>)}
          </div>
        )}

        {specContent && (
          <div style={{marginTop:14}}>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button className="btn btn-ghost" onClick={()=>window.print()}>Print / Save as PDF</button>
            </div>
            <SpecSheet content={specContent}/>

            {quoteData ? (
              <div className="quote-box">
                <div style={{background:'#fef2f2',border:'0.5px solid #fca5a5',borderRadius:4,padding:'6px 10px',textAlign:'center',marginBottom:10}}>
                  <span style={{fontWeight:700,color:'#991b1b',fontSize:11}}>PRELIMINARY — REQUIRES ENGINEERING REVIEW BEFORE COMMITMENT</span>
                </div>
                {quoteStale && (
                  <div className="warn-box" style={{marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>Quote at {quoteMarginkUsed}% margin. Current: {settings.margin_percent}%.</span>
                    <button className="btn btn-gold btn-sm" onClick={()=>recalc(selectedCfg)}>Recalculate</button>
                  </div>
                )}
                <table className="quote-table">
                  <tbody>
                    {quoteData.lines.map((l,i)=><tr key={i}><td>{l.label}</td><td style={{textAlign:'right',color:'#64748b'}}>${l.cost.toFixed(2)}</td></tr>)}
                    <tr style={{borderTop:'1px solid #0B1E3D'}}><td style={{fontWeight:700}}>COGS</td><td style={{textAlign:'right',fontWeight:700}}>${quoteData.cogs.toFixed(2)}</td></tr>
                    <tr><td style={{color:'#64748b'}}>Margin ({quoteData.margin_pct}%)</td><td style={{textAlign:'right',color:'#64748b'}}>${(quoteData.quote-quoteData.cogs).toFixed(2)}</td></tr>
                    <tr style={{background:'#0B1E3D'}}><td style={{color:'#C4A03C',fontWeight:700,fontSize:13,padding:'8px 6px'}}>Quote price</td><td style={{textAlign:'right',color:'#C4A03C',fontWeight:700,fontSize:13,padding:'8px 6px'}}>${quoteData.quote.toFixed(2)}</td></tr>
                  </tbody>
                </table>
                <div style={{marginTop:8,fontSize:10,color:'var(--amber)',fontWeight:600}}>Preliminary quote — valid 30 days — subject to engineering validation</div>
              </div>
            ) : (
              <div className="warn-box" style={{marginTop:12}}>Cost data incomplete — add <strong>cost_usd</strong> values to cells and BMS boards in the Library tab. Contact Derek Stewart for COGS figures.</div>
            )}
          </div>
        )}

        {selectedCfg && (
          <BatteryLayout
            config={selectedCfg}
            enclosure={{ length_mm: +form.length, width_mm: +form.width, depth_mm: +form.depth }}
          />
        )}
      </div>
    </div>
  );
}

// ── LIBRARY TAB ────────────────────────────────────────────────────────────
function LibraryTab({ library, setLibrary, toast }) {
  const [section, setSection] = useState('cells');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const isDemo = library?.is_demo !== false;

  const saveLibrary = async (newLib, isDemo_=false) => {
    setSaving(true);
    try {
      await fetch('/api/library',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({library:newLib,is_demo:isDemo_})});
      setLibrary({...newLib,is_demo:isDemo_});
      toast('Library saved — all team members will see the update');
    } catch { toast('Save failed'); }
    finally { setSaving(false); }
  };

  const handleImport = async (file) => {
    if(!file) return;
    setImporting(true);
    setImportMsg(null);
    const XLSX = (await import('xlsx')).default;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result,{type:'array'});
        const lib = parseWorkbook(wb,XLSX);
        await saveLibrary(lib, false);
        setImportMsg({type:'success',text:`Imported: ${lib.cells.length} cells, ${lib.bms_boards.length} BMS boards, ${lib.design_rules.length} design rules`});
      } catch(err) { setImportMsg({type:'error',text:'Parse error: '+err.message}); }
      finally { setImporting(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseWorkbook = (wb,XLSX) => {
    const getRows = (sheetName) => {
      const s=wb.Sheets[sheetName]; return s?XLSX.utils.sheet_to_json(s,{header:1,defval:''}):[];
    };
    const num = v => { const n=parseFloat(v); return isNaN(n)?null:n; };

    const cells=[];
    const cellRows=getRows('Cells'); const cellHdr=cellRows.find(r=>String(r[0]).includes('Cell Name'));
    if(cellHdr){ cellRows.slice(cellRows.indexOf(cellHdr)+1).forEach((r,i)=>{ const name=String(r[0]||'').trim(); if(!name)return; cells.push({id:'CELL-'+String(i+1).padStart(3,'0'),name,type:String(r[1]||''),status:String(r[2]||''),length_mm:num(r[3]),width_mm:num(r[4]),thickness_mm:num(r[5]),weight_g:num(r[6]),nominal_voltage_v:num(r[7])||3.6,capacity_ah:num(r[8]),energy_wh:num(r[9]),min_temp_c:num(r[15]),max_temp_c:num(r[16]),cost_usd:null}); }); }

    const bms=[]; const bmsRows=getRows('BMS Boards'); const bmsHdr=bmsRows.find(r=>String(r[0]).includes('BMS Name'));
    if(bmsHdr){ bmsRows.slice(bmsRows.indexOf(bmsHdr)+1).forEach((r,i)=>{ const name=String(r[0]||'').trim(); if(!name)return; const m=String(r[1]||'').match(/(\d+)[–-](\d+)/); bms.push({id:'BMS-'+String(i+1).padStart(3,'0'),name,min_cells:m?+m[1]:1,max_cells:m?+m[2]:4,length_mm:num(r[3]),width_mm:num(r[4]),height_mm:num(r[5]),weight_g:num(r[6]),cost_usd:null}); }); }

    const design_rules=[]; const drRows=getRows('Design Rules'); const drHdr=drRows.find(r=>String(r[0]).includes('Rule ID'));
    if(drHdr){ drRows.slice(drRows.indexOf(drHdr)+1).forEach(r=>{ const id=String(r[0]||'').trim(); if(!id||!String(r[2]||'').trim())return; design_rules.push({id,category:String(r[1]||''),description:String(r[2]||''),value:typeof r[3]==='number'?r[3]:null,unit:String(r[4]||''),mandatory:String(r[5]||'Preferred'),reason:String(r[6]||'')}); }); }

    return {
      cells:cells.length?cells:(library?.cells||[]),
      bms_boards:bms.length?bms:(library?.bms_boards||[]),
      thermal:library?.thermal||[], connectors:library?.connectors||[], cases:library?.cases||[], wiring:library?.wiring||[],
      design_rules:design_rules.length?design_rules:(library?.design_rules||[])
    };
  };

  const updateCell = (ri, col, val) => {
    const newLib = JSON.parse(JSON.stringify(library));
    newLib[section][ri][col] = val;
    saveLibrary(newLib, newLib.is_demo||false);
  };

  const addRow = () => {
    const newLib = JSON.parse(JSON.stringify(library));
    const cols = SCHEMAS[section]; const idx = newLib[section].length+1;
    const row = {}; cols.forEach(c=>{row[c]=c==='id'?(section.toUpperCase().slice(0,4)+'-'+String(idx).padStart(3,'0')):'';});
    newLib[section].push(row);
    saveLibrary(newLib, newLib.is_demo||false);
  };

  const deleteRow = (ri) => {
    if(!confirm('Delete this row?')) return;
    const newLib = JSON.parse(JSON.stringify(library));
    newLib[section].splice(ri,1);
    saveLibrary(newLib, newLib.is_demo||false);
  };

  const items = library?.[section]||[];
  const cols = SCHEMAS[section]||[];

  return (
    <div>
      <div className="card">
        <div className="section-title">Import Component Catalog</div>
        <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:280}}>
            <label className="import-zone" style={{display:'block'}}>
              <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>handleImport(e.target.files[0])}/>
              <div style={{fontSize:13,fontWeight:600,color:'#0B1E3D',marginBottom:6}}>
                {importing?<><span className="spinner"/>Importing…</>:'Drop or click to import Excel catalog'}
              </div>
              <div style={{fontSize:11,color:'#64748b'}}>SSP_Component_Catalog_Intake.xlsx</div>
            </label>
            {importMsg && <div className={importMsg.type==='success'?'info-box':'error-box'} style={{marginTop:8}}>{importMsg.text}</div>}
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:'#475569',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8}}>Library Status</div>
            {Object.entries(SECTION_LABELS).map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',gap:24,fontSize:11,color:'#64748b',lineHeight:2}}>
                <span>{v}</span><strong style={{color:'#0B1E3D'}}>{library?.[k]?.length||0}</strong>
              </div>
            ))}
            <div style={{marginTop:6,fontSize:9,color:isDemo?'var(--amber)':'var(--green)',fontWeight:600}}>{isDemo?'⚠ Demo data':'✓ Imported catalog'}</div>
            {saving && <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}><span className="spinner"/>Saving…</div>}
          </div>
        </div>
      </div>

      {isDemo && <div className="warn-box">Using demo library. Import your completed catalog — changes sync to all team members instantly.</div>}

      <div className="lib-tabs">
        {Object.entries(SECTION_LABELS).map(([k,v])=>(
          <button key={k} className={`lib-tab${k===section?' active':''}`} onClick={()=>setSection(k)}>
            {v} <span style={{opacity:.6}}>({library?.[k]?.length||0})</span>
          </button>
        ))}
      </div>

      <div className="lib-wrap">
        <table className="lib-table">
          <thead><tr>{cols.map(c=><th key={c}>{c.replace(/_/g,' ')}</th>)}<th style={{width:30}}/></tr></thead>
          <tbody>
            {items.map((item,ri)=>(
              <tr key={ri}>
                {cols.map(col=>{
                  const v=item[col]!==undefined&&item[col]!==null?item[col]:'';
                  const isNum=NUMERIC_COLS.has(col);
                  return (
                    <td key={col}>
                      <InlineEdit value={v} isNum={isNum} onCommit={val=>updateCell(ri,col,val)}/>
                    </td>
                  );
                })}
                <td><button style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:12,opacity:0,transition:'opacity .15s'}} className="del-btn" onClick={()=>deleteRow(ri)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-row-btn" onClick={addRow}>+ Add {SECTION_LABELS[section]?.slice(0,-1)||'row'}</button>
      </div>
    </div>
  );
}

// Inline editable cell
function InlineEdit({ value, isNum, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  const start = () => { setEditing(true); setVal(String(value)); setErr(''); };
  const commit = () => {
    if(isNum && val.trim()!==''){
      const n=parseFloat(val);
      if(isNaN(n)){ setErr('Must be a number'); setEditing(false); return; }
      onCommit(n);
    } else { onCommit(val.trim()===''?null:val); }
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if(!editing) return (
    <span className={`cell-view${isNum?' numeric':''}`} title="Click to edit" onClick={start}>
      {String(value)}
      {err && <span className="field-err">{err}</span>}
    </span>
  );

  return <input type={isNum?'number':'text'} value={val} autoFocus
    style={{padding:'2px 5px',border:'1px solid #C4A03C',borderRadius:3,fontFamily:'inherit',fontSize:11,width:isNum?80:140}}
    onChange={e=>setVal(e.target.value)}
    onBlur={commit}
    onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')cancel();}}/>;
}

// ── HISTORY TAB ────────────────────────────────────────────────────────────
function HistoryTab() {
  const [configs, setConfigs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch('/api/history').then(r=>r.json()).then(d=>{ setConfigs(Array.isArray(d)?d:[]); setLoading(false); }).catch(()=>setLoading(false));
  },[]);

  const filtered = configs.filter(c=>!query||(c.company+c.product+c.vertical).toLowerCase().includes(query.toLowerCase()));
  const initials = (email) => email?email.slice(0,2).toUpperCase():'??';

  return (
    <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:16}}>
      <div>
        <div className="form-group"><input type="text" placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        {loading && <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:16}}><span className="spinner"/>Loading…</div>}
        {!loading && filtered.map(c=>(
          <div key={c.id} className={`hist-card${selected?.id===c.id?' selected':''}`} onClick={()=>setSelected(c)}>
            <div style={{fontWeight:600,fontSize:12,color:'#0B1E3D'}}>{c.product}</div>
            <div style={{fontSize:11,color:'#64748b'}}>{c.company}</div>
            <div className="hist-by">
              <span className="hist-avatar">{initials(c.user_email)}</span>
              <span>{c.voltage||''} · {c.capacity_wh||''}Wh · {new Date(c.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {!loading && !filtered.length && <div style={{fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:16}}>No records</div>}
      </div>
      <div>
        {!selected && <div style={{fontSize:12,color:'#94a3b8',textAlign:'center',marginTop:40}}>Select a record</div>}
        {selected?.spec_content && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div><strong>{selected.product}</strong><br/><span style={{fontSize:11,color:'#64748b'}}>{selected.company} · {new Date(selected.created_at).toLocaleDateString()}</span></div>
              <button className="btn btn-ghost" onClick={()=>window.print()}>Print</button>
            </div>
            {/* H-4: re-validate stored spec_content against current guardrails */}
            {(() => { const chk = validateSpecSheet(selected.spec_content); return !chk.ok && (
              <div style={{background:'#450a0a',border:'1px solid #dc2626',borderRadius:6,padding:'10px 14px',marginBottom:12,fontSize:11,color:'#fca5a5'}}>
                <strong>Guardrail warning:</strong> This historical record contains {chk.violations.length} violation{chk.violations.length !== 1 ? 's' : ''} under current rules — do not send to customers without engineering review.
              </div>
            ); })()}
            <SpecSheet content={selected.spec_content}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SETTINGS TAB ───────────────────────────────────────────────────────────
function SettingsTab({ settings, setSettings, toast }) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:local})});
    setSettings(local);
    toast('Settings saved');
    setSaving(false);
  };

  return (
    <div style={{maxWidth:420}}>
      <div className="card">
        <div className="section-title">Quote Settings</div>
        {[['margin_percent','Margin %'],['labor_rate','Labor Rate ($/hr)'],['base_hours','Base Assembly Hours'],['per_cell_hours','Hours Per Cell']].map(([k,l])=>(
          <div key={k} className="form-group">
            <label className="fl">{l}</label>
            <input type="number" value={local[k]}
              {...(k==='margin_percent' ? {min:0,max:99} : {})}
              onChange={e=>{
                let v=+e.target.value;
                if(k==='margin_percent') v=Math.min(99,Math.max(0,v));
                setLocal(s=>({...s,[k]:v}));
              }}/>
          </div>
        ))}
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save Settings'}</button>
      </div>
    </div>
  );
}

// ── ROOT PAGE ──────────────────────────────────────────────────────────────
export default function Home() {
  const user = useUser();
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [tab, setTab] = useState('configure');
  const [library, setLibrary] = useState(null);
  const [settings, setSettings] = useState({ margin_percent:40, labor_rate:75, base_hours:2, per_cell_hours:0.5 });
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(''),3200); };

  useEffect(()=>{
    if(!user) return;
    // Load shared library
    fetch('/api/library').then(r=>r.json()).then(d=>setLibrary(d.library?{...d.library,is_demo:d.is_demo}:null)).catch(()=>{});
    // Load user settings
    fetch('/api/settings').then(r=>r.json()).then(d=>setSettings(d)).catch(()=>{});
  },[user]);

  if(!user) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f4f5f7'}}><span className="spinner"/>Loading…</div>;

  return (
    <>
      <div className="header">
        <span className="header-logo">Solid State Power</span>
        <span className="header-sub">· Battery Configuration Tool</span>
        <div className="header-right">
          <span className="header-user">{user.email}</span>
          <button className="signout-btn" onClick={async()=>{ await supabase.auth.signOut(); router.push('/login'); }}>Sign out</button>
        </div>
      </div>

      <div className="tabs">
        {['configure','library','settings','history'].map(t=>(
          <button key={t} className={`tab${tab===t?' active':''}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <div className="body">
        {tab==='configure' && <ConfigureTab library={library} settings={settings} userEmail={user.email}/>}
        {tab==='library' && <LibraryTab library={library} setLibrary={setLibrary} toast={showToast}/>}
        {tab==='settings' && <SettingsTab settings={settings} setSettings={setSettings} toast={showToast}/>}
        {tab==='history' && <HistoryTab/>}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
