"""
SQLite persistence for users and saved projects (filter state).
"""
import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "dashboard.db")


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Create tables if they do not exist."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS project (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                filters TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES user (id)
            )
        """)


def get_or_create_user(username: str) -> Dict[str, Any]:
    """Return user row by username; create if not exists."""
    if not (username or str(username).strip()):
        raise ValueError("Username is required")
    name = str(username).strip()
    with get_db() as conn:
        row = conn.execute("SELECT id, username FROM user WHERE username = ?", (name,)).fetchone()
        if row:
            return {"id": row["id"], "username": row["username"]}
        cur = conn.execute("INSERT INTO user (username) VALUES (?)", (name,))
        return {"id": cur.lastrowid, "username": name}


def list_projects(user_id: int) -> List[Dict[str, Any]]:
    """List projects for a user (id, name, filters, created_at)."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, filters, created_at FROM project WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [
        {"id": r["id"], "name": r["name"], "filters": r["filters"], "created_at": r["created_at"]}
        for r in rows
    ]


def save_project(user_id: int, name: str, filters: Dict[str, Any]) -> Dict[str, Any]:
    """Save a project; returns { id, name, filters, created_at }."""
    if not (name or str(name).strip()):
        raise ValueError("Project name is required")
    filters_json = json.dumps(filters)
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO project (user_id, name, filters) VALUES (?, ?, ?)",
            (user_id, str(name).strip(), filters_json),
        )
        row = conn.execute(
            "SELECT id, name, filters, created_at FROM project WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    return {"id": row["id"], "name": row["name"], "filters": row["filters"], "created_at": row["created_at"]}


def get_project(project_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    """Get one project by id for the given user."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, name, filters, created_at FROM project WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        ).fetchone()
    if not row:
        return None
    return {"id": row["id"], "name": row["name"], "filters": row["filters"], "created_at": row["created_at"]}
