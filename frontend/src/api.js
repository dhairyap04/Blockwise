const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return null;
  let data;
  try { data = await response.json(); }
  catch { throw new Error("The server returned an unreadable response. Check that the backend is running."); }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export function describeFilter(filter) {
  if (!filter) return "";
  if (filter.conditions) return filter.conditions.map(describeFilter).join(` ${filter.logic.toUpperCase()} `);
  const labels = { height: "Height (ft)", height_m: "Height (m)", assessed_value: "Parcel assessment (CAD)", zoning: "Zoning", address: "Address", stage: "Stage", assessment_class: "Assessment class" };
  return `${labels[filter.attribute] || filter.attribute} ${filter.operator === "category" ? "category =" : filter.operator} ${typeof filter.value === "number" ? filter.value.toLocaleString("en-CA") : filter.value}`;
}
