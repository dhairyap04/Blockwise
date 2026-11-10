import { useState } from "react";
import { api } from "./api";
export default function ProjectList({ projects, username, disabled, onLoad, onRefresh, areas, onNotice }) {
  const [editing,setEditing]=useState(null);const [deleting,setDeleting]=useState(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState(null);
  function notify(value) {if(onNotice) onNotice(value);else setMessage(value);}
  async function update(event) {
    event.preventDefault(); setBusy(true);notify(null);
    try { await api(`/api/projects/${editing.id}?username=${encodeURIComponent(username)}`,{method:"PATCH",body:{name:editing.name,notes:editing.notes}});setEditing(null);onRefresh();notify({type:"success",text:"Project updated."}); }
    catch(error){notify({type:"error",text:error.message});} finally{setBusy(false);}
  }
  async function remove(id) {
    setBusy(true);notify(null);
    try {await api(`/api/projects/${id}?username=${encodeURIComponent(username)}`,{method:"DELETE"});setDeleting(null);onRefresh();notify({type:"success",text:"Project deleted."});}
    catch(error){notify({type:"error",text:error.message});} finally{setBusy(false);}
  }
  return <><ul className="project-list">{projects.map(project => <li key={project.id} className="saved-project">
    <button className="project-item" disabled={disabled || busy} onClick={() => onLoad(project.id)}>{project.name}</button>
    <small>{areas.find(a => a.id===(project.area || "downtown"))?.name || project.area || "Downtown"}</small>
    {project.notes && <p className="project-notes">{project.notes}</p>}
    <div className="form-row"><button className="text-button" disabled={disabled || busy} onClick={() => {setEditing({...project,notes:project.notes || ""});setDeleting(null);}}>Edit {project.name}</button><button className="text-button" disabled={disabled || busy} onClick={() => {setDeleting(project.id);setEditing(null);}}>Delete {project.name}</button></div>
    {editing?.id===project.id && <form onSubmit={update}><label>Rename project<input className="input-text" required maxLength={120} value={editing.name} onChange={e => setEditing({...editing,name:e.target.value})} /></label><label>Project notes<textarea aria-label="Project notes" className="input-text" maxLength={4000} value={editing.notes} onChange={e => setEditing({...editing,notes:e.target.value})} /></label><div className="form-row"><button className="btn btn-primary" disabled={busy}>Save changes</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel edit</button></div></form>}
    {deleting===project.id && <div className="delete-confirm"><p>Delete “{project.name}”? This cannot be undone.</p><button className="btn btn-secondary" disabled={busy} onClick={() => remove(project.id)}>Confirm delete</button><button className="text-button" disabled={busy} onClick={() => setDeleting(null)}>Cancel delete</button></div>}
  </li>)}</ul>{message && <p className={`message message-${message.type}`} role={message.type==="error" ? "alert" : "status"}>{message.text}</p>}</>;
}
