import { useEffect, useState } from "react";
const ATTRIBUTES = {height_m:"Height (metres)",height:"Height (feet)",assessed_value:"Parcel assessment (CAD)",zoning:"Zoning",address:"Address",stage:"Stage",assessment_class:"Assessment class"};
const numeric = attr => ["height_m","height","assessed_value"].includes(attr);
const initial = () => ({attribute:"height_m",operator:">",value:"30"});
export default function FilterEditor({ filter, onApply, disabled }) {
  const [rows,setRows] = useState([initial()]); const [logic,setLogic] = useState("and"); const [dirty,setDirty] = useState(false);
  useEffect(() => {
    if (filter) { setRows((filter.conditions || [filter]).map(r => ({...r,value:String(r.value)}))); setLogic(filter.logic || "and"); }
    else setRows([initial()]);
    setDirty(false);
  },[filter]);
  function change(index,patch) { setRows(current => current.map((row,i) => i===index ? {...row,...patch} : row)); setDirty(true); }
  return <details className="filter-editor" open><summary>Filter controls</summary><form onSubmit={e => {
    e.preventDefault(); const conditions=rows.map(r => ({...r,value:numeric(r.attribute) ? Number(r.value) : r.value}));
    onApply(conditions.length===1 ? conditions[0] : {logic,conditions});
  }}><fieldset disabled={disabled}>
    {rows.length>1 && <label>Combine conditions<select className="input-text" value={logic} onChange={e => {setLogic(e.target.value);setDirty(true);}}><option value="and">Match all (AND)</option><option value="or">Match any (OR)</option></select></label>}
    {rows.map((row,index) => <div className="filter-row" key={index}>
      <label className="sr-only" htmlFor={`attribute-${index}`}>Condition {index+1} attribute</label>
      <select id={`attribute-${index}`} className="input-text" value={row.attribute} onChange={e => change(index,{attribute:e.target.value,operator:numeric(e.target.value) ? ">" : "=",value:""})}>{Object.entries(ATTRIBUTES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
      <div className="filter-values"><label className="sr-only" htmlFor={`operator-${index}`}>Condition {index+1} operator</label><select id={`operator-${index}`} className="input-text" value={row.operator} onChange={e => change(index,{operator:e.target.value,value:e.target.value==="category" ? "commercial" : row.value})}>
        {(numeric(row.attribute) ? [">",">=","=","<","<="] : row.attribute==="zoning" ? ["=","contains","category"] : ["=","contains"]).map(op => <option key={op} value={op}>{op==="category" ? "Category" : op}</option>)}</select>
        <label className="sr-only" htmlFor={`value-${index}`}>Condition {index+1} value</label>{row.operator==="category" ? <select id={`value-${index}`} className="input-text" value={row.value} onChange={e => change(index,{value:e.target.value})}>{["commercial","residential","industrial","mixed"].map(v => <option key={v}>{v}</option>)}</select> : <input id={`value-${index}`} className="input-text" type={numeric(row.attribute) ? "number" : "text"} min={numeric(row.attribute) ? 0 : undefined} step="any" required maxLength={200} value={row.value} onChange={e => change(index,{value:e.target.value})} />}
        {rows.length>1 && <button type="button" className="text-button" aria-label={`Remove condition ${index+1}`} onClick={() => {setRows(current => current.filter((_,i) => i!==index));setDirty(true);}}>×</button>}
      </div></div>)}
    <div className="form-row"><button type="submit" className="btn btn-primary">Apply controls</button><button type="button" className="btn btn-secondary" disabled={rows.length>=8} onClick={() => {setRows(current => [...current,initial()]);setDirty(true);}}>Add condition</button></div>
    {dirty && <p className="data-note" role="status">Changes not yet applied.</p>}
  </fieldset></form></details>;
}
