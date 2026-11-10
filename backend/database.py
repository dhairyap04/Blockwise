"""SQLite storage for username-identified, named map filters (no authentication)."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.getenv("DATABASE_PATH", str(Path(__file__).with_name("dashboard.db")))


@contextmanager
def get_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute('''CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS project (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
            name TEXT NOT NULL, filters TEXT NOT NULL, query TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES user(id))''')
        if "query" not in {r["name"] for r in conn.execute("PRAGMA table_info(project)")}:
            conn.execute("ALTER TABLE project ADD COLUMN query TEXT DEFAULT ''")
        columns = {r["name"] for r in conn.execute("PRAGMA table_info(project)")}
        for name, definition in [("area", "TEXT NOT NULL DEFAULT 'downtown'"), ("notes", "TEXT NOT NULL DEFAULT ''"), ("reference_id", "TEXT")]:
            if name not in columns:
                conn.execute(f"ALTER TABLE project ADD COLUMN {name} {definition}")
        conn.execute("CREATE INDEX IF NOT EXISTS project_user ON project(user_id)")
        conn.execute("CREATE TABLE IF NOT EXISTS study_area (id TEXT PRIMARY KEY, descriptor TEXT NOT NULL)")


def validate_name(value, label, limit=80):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise ValueError(f"{label} must contain 1–{limit} characters.")
    if any(ord(c) < 32 for c in value) or (label == "Username" and "/" in value):
        raise ValueError(f"{label} contains unsupported characters.")
    return value.strip()


def get_user(username):
    name = validate_name(username, "Username")
    with get_db() as conn:
        row = conn.execute("SELECT id, username FROM user WHERE username = ?", (name,)).fetchone()
    return dict(row) if row else None


def get_or_create_user(username):
    name = validate_name(username, "Username")
    with get_db() as conn:
        conn.execute("INSERT INTO user(username) VALUES (?) ON CONFLICT(username) DO NOTHING", (name,))
        return dict(conn.execute("SELECT id, username FROM user WHERE username = ?", (name,)).fetchone())


def _project(row):
    if row is None:
        return None
    result = dict(row)
    result["filters"] = json.loads(result["filters"])
    return result


def list_projects(user_id):
    with get_db() as conn:
        rows = conn.execute("SELECT id,name,filters,query,area,notes,reference_id,created_at FROM project WHERE user_id=? ORDER BY id DESC", (user_id,)).fetchall()
    return [_project(row) for row in rows]


def save_project(user_id, name, filters, query="", area="downtown", notes="", reference_id=None):
    name = validate_name(name, "Project name", 120)
    if not isinstance(query, str) or len(query) > 1000:
        raise ValueError("Query must be text of at most 1,000 characters.")
    notes = validate_notes(notes)
    with get_db() as conn:
        cursor = conn.execute("INSERT INTO project(user_id,name,filters,query,area,notes,reference_id) VALUES (?,?,?,?,?,?,?)",
                              (user_id, name, json.dumps(filters, allow_nan=False), query, area, notes, reference_id))
        row = conn.execute("SELECT id,name,filters,query,area,notes,reference_id,created_at FROM project WHERE id=?", (cursor.lastrowid,)).fetchone()
    return _project(row)


def get_project(project_id, user_id):
    with get_db() as conn:
        row = conn.execute("SELECT id,name,filters,query,area,notes,reference_id,created_at FROM project WHERE id=? AND user_id=?", (project_id, user_id)).fetchone()
    return _project(row)


def validate_notes(notes):
    if not isinstance(notes, str) or len(notes) > 4000:
        raise ValueError("Notes must be text of at most 4,000 characters.")
    return notes.strip()


def update_project(project_id, user_id, name, notes):
    with get_db() as conn:
        conn.execute("UPDATE project SET name=?,notes=? WHERE id=? AND user_id=?", (name, notes, project_id, user_id))
    return get_project(project_id,user_id)


def delete_project(project_id,user_id):
    with get_db() as conn:
        conn.execute("DELETE FROM project WHERE id=? AND user_id=?",(project_id,user_id))


def save_study_area(area):
    with get_db() as conn:
        conn.execute("INSERT INTO study_area(id,descriptor) VALUES (?,?) ON CONFLICT(id) DO NOTHING",(area['id'],json.dumps(area,allow_nan=False)))
    return get_study_area(area['id'])


def get_study_area(area_id):
    with get_db() as conn:
        row=conn.execute("SELECT descriptor FROM study_area WHERE id=?",(area_id,)).fetchone()
    return json.loads(row['descriptor']) if row else None
