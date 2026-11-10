import {useState} from "react";
import {apiBlob} from "./api";
import {downloadFile} from "./analysis";
export default function MeetingBriefForm({buildings,context,onNotesChange}) {
  const [title,setTitle]=useState("Neighbourhood comparison brief"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function submit(event) {
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try {
      const blob=await apiBlob("/api/brief",{area:context.area,buildingIds:buildings.map(b=>b.id),datasetVersion:context.datasetVersion,
        title:title.trim(),notes:context.notes || "",filters:context.filters || null,query:context.query || "",search:context.search || ""});
      downloadFile("calgary-comparison-brief.pdf",blob,"application/pdf");setMessage("Meeting brief downloaded. Review it before sharing or printing.");
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <details className="meeting-brief"><summary>Create meeting brief (PDF)</summary><p className="data-note">A printable comparison with a footprint diagram, selected buildings, notes, sources, retrieval date, and data limitations. Street-map tiles are not included.</p>
    <form aria-label="Meeting brief" onSubmit={submit}><fieldset disabled={busy || !buildings.length}>
      <label>Brief title<input className="input-text" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} /></label>
      <label>Brief discussion notes<textarea className="input-text" maxLength={4000} value={context.notes || ""} onChange={e=>onNotesChange(e.target.value)} placeholder="Observations and questions for the meeting" /></label>
      <p className="data-note">These are the same analysis notes shown in Projects.</p><button className="btn btn-primary" disabled={busy || !title.trim()}>{busy ? "Creating PDF…" : "Download meeting brief"}</button>
    </fieldset></form>
    {error && <p className="message message-error" role="alert">{error}</p>}{message && <p className="message message-success" role="status">{message}</p>}
  </details>;
}
