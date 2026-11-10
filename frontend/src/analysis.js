/** Pure result calculations. Parcel totals never count the same parcel twice. */
export function summarize(buildings) {
  const heights = buildings.map(b => b.height_m).filter(v => typeof v === "number" && Number.isFinite(v)).sort((a,b) => a-b);
  const median = values => !values.length ? null : (values[Math.floor((values.length-1)/2)] + values[Math.ceil((values.length-1)/2)]) / 2;
  const parcels = new Map(); const zones = new Map();
  const bins = [0,0,0,0]; let noOverlap = 0, lowOverlap = 0;
  for (const b of buildings) {
    if (b.parcel_id) parcels.set(b.parcel_id, b.assessed_value);
    else if (b.parcel_overlap != null) lowOverlap += 1;
    else noOverlap += 1;
    const codes = b.zoning_codes || (b.zoning ? b.zoning.split(",").map(v => v.trim()) : []);
    for (const code of new Set(codes)) zones.set(code, (zones.get(code) || 0) + 1);
    if (typeof b.height_m === "number" && Number.isFinite(b.height_m)) bins[b.height_m < 15 ? 0 : b.height_m < 30 ? 1 : b.height_m < 60 ? 2 : 3] += 1;
  }
  const values = [...parcels.values()].filter(v => typeof v === "number" && Number.isFinite(v)).sort((a,b) => a-b);
  return { count:buildings.length, medianHeight:median(heights), maxHeight:heights.length ? heights[heights.length-1] : null,
    missingHeights:buildings.length-heights.length, matched:buildings.filter(b => b.parcel_id).length,
    parcels:parcels.size, medianAssessment:median(values), assessedParcels:values.length, bins, noOverlap, lowOverlap,
    zones:[...zones].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])) };
}

export function sortBuildings(buildings, order) {
  return [...buildings].sort((a,b) => {
    if (order === "address") return (a.address || `Building ${a.id}`).localeCompare(b.address || `Building ${b.id}`, "en", {numeric:true}) || a.id.localeCompare(b.id);
    const field = order === "assessment" ? "assessed_value" : "height_m";
    if (a[field] == null && b[field] != null) return 1;
    if (b[field] == null && a[field] != null) return -1;
    return (order === "shortest" ? 1 : -1) * ((a[field] || 0)-(b[field] || 0)) || String(a.id).localeCompare(String(b.id));
  });
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  // Keep spreadsheet applications from evaluating exported text as formulas.
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
export function resultsCsv(buildings, context) {
  const fields = ["id","address","height_m","height","zoning","parcel_id","assessed_value","assessment_year","property_match","parcel_overlap","stage","latitude","longitude"];
  const header = [...fields,"area","scope","filters","address_search","dataset_version","fetched_at","sources"];
  const sources = (context.sources || []).map(s => s.url).join(" ");
  return [header.map(csvCell).join(","), ...buildings.map(b => [...fields.map(k => b[k]),context.area,context.scope || "results",JSON.stringify(context.filters || null),context.search || "",context.datasetVersion,context.fetchedAt ? new Date(context.fetchedAt*1000).toISOString() : "",sources].map(csvCell).join(","))].join("\r\n");
}
export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
