"""In-memory Supabase stand-in for EDITION_TEST_MODE.

Implements the subset of the Supabase Python client + PostgREST query builder
that Edition's routers and services actually use. Backed by simple
dict-of-list tables; no persistence, no concurrency safety. Process-local.

Why not the real Supabase client?
- E2E specs need to drive the live app through publish → unlock → reveal
  flows. Canned-response mocks (tests/conftest.py::MockSupabaseClient) can't
  do that — they don't track state between queries.
- A real Supabase project requires credentials + cleanup; local Supabase
  needs Docker. The user opted to keep things mock-backed (see plan).

Scope: covers what app/routers/* and app/services/* actually call. Embeds
follow the PostgREST `foreign_table(...)` and `foreign_table!fk(...)` syntax
the routers use; FKs are hardcoded below to match the supabase/ schema.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# Schema: foreign keys we know how to embed.
# Mapping: child_table -> {alias: (column_on_child, parent_table)}
# Embed clauses like "profiles!posts_user_id_fkey(...)" resolve via alias.
# Embed clauses like "blocks(*)" use the default child-of-parent map below.
# ---------------------------------------------------------------------------

FK_BY_ALIAS = {
    "posts_user_id_fkey": ("user_id", "profiles"),
    "follows_follower_id_fkey": ("follower_id", "profiles"),
    "follows_following_id_fkey": ("following_id", "profiles"),
    "notifications_actor_id_fkey": ("actor_id", "profiles"),
}

# child_table -> (foreign_key_on_child, parent_table) when alias is unspecified
CHILD_BY_PARENT = {
    # parent → list of (child_table, child_fk_col)
    "posts": [("blocks", "post_id")],
    "profiles": [("posts", "user_id")],
}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Response envelope (mirrors supabase.PostgrestResponse just enough)
# ---------------------------------------------------------------------------

class _Response:
    def __init__(self, data: Any = None, count: int | None = None):
        self.data = data if data is not None else []
        self.count = count


# ---------------------------------------------------------------------------
# Embed parsing
# ---------------------------------------------------------------------------

_EMBED_RE = re.compile(r"(\w+)(?:!(\w+))?\(([^)]*)\)")


def _parse_select(select: str) -> tuple[list[str], list[dict]]:
    """Returns (top_level_cols, embeds).

    top_level_cols: ["*"] or ["id", "user_id", ...]
    embeds: [{"table": "profiles", "alias": "posts_user_id_fkey"|None, "cols": ["username", ...]}]
    """
    if not select or select == "*":
        return ["*"], []

    embeds: list[dict] = []
    for m in _EMBED_RE.finditer(select):
        child = m.group(1)
        alias = m.group(2)
        cols_str = m.group(3).strip()
        cols = [c.strip() for c in cols_str.split(",")] if cols_str else ["*"]
        embeds.append({"table": child, "alias": alias, "cols": cols})

    # Strip embed clauses, then parse remaining top-level cols.
    remaining = _EMBED_RE.sub("", select)
    cols = [c.strip() for c in remaining.split(",") if c.strip()]
    if not cols:
        cols = ["*"]
    return cols, embeds


def _project(row: dict, cols: list[str]) -> dict:
    if cols == ["*"]:
        return dict(row)
    return {c: row.get(c) for c in cols}


# ---------------------------------------------------------------------------
# Filtering / ordering
# ---------------------------------------------------------------------------

def _match(row: dict, ops: list[tuple]) -> bool:
    for op, col, val in ops:
        if op == "eq":
            if row.get(col) != val:
                return False
        elif op == "neq":
            if row.get(col) == val:
                return False
        elif op == "in":
            if row.get(col) not in val:
                return False
        elif op == "is":
            # supabase Python client uses .is_(col, "null") with the literal
            # string "null" to match SQL IS NULL.
            target = None if val in ("null", None) else val
            if row.get(col) is not target:
                return False
        elif op == "not_is":
            target = None if val in ("null", None) else val
            if row.get(col) is target:
                return False
        elif op == "lt":
            if not (row.get(col) is not None and row[col] < val):
                return False
        elif op == "gt":
            if not (row.get(col) is not None and row[col] > val):
                return False
        else:
            raise NotImplementedError(f"filter op {op!r} not supported in in-memory store")
    return True


def _sorted(rows: list[dict], order: list[tuple[str, bool]]) -> list[dict]:
    out = list(rows)
    for col, desc in reversed(order):
        out.sort(key=lambda r, c=col: (r.get(c) is None, r.get(c)), reverse=desc)
    return out


# ---------------------------------------------------------------------------
# Query builder
# ---------------------------------------------------------------------------

class _Query:
    def __init__(self, store: "InMemorySupabase", table: str):
        self._store = store
        self._table = table
        self._select_cols: list[str] = ["*"]
        self._embeds: list[dict] = []
        self._filters: list[tuple] = []
        self._order: list[tuple[str, bool]] = []
        self._single = False
        self._limit: int | None = None
        self._range: tuple[int, int] | None = None
        self._count_mode: str | None = None
        self._action: str = "select"
        self._data: Any = None

    # ---- chainable filters ----
    def select(self, *args, count: str | None = None, **kw):
        if args:
            self._select_cols, self._embeds = _parse_select(args[0])
        self._count_mode = count
        # select() following insert/update/delete shouldn't switch action; in
        # supabase-py it just chooses returning columns. We treat it as a noop
        # for state-mutating ops because tests only read .data afterwards.
        return self

    def eq(self, col, val):
        self._filters.append(("eq", col, val)); return self
    def neq(self, col, val):
        self._filters.append(("neq", col, val)); return self
    def in_(self, col, vals):
        self._filters.append(("in", col, list(vals))); return self
    def is_(self, col, val):
        self._filters.append(("is", col, val)); return self
    def not_(self, op, col, val):
        # supabase-py signature is .not_(filter, col, val); the conftest mock
        # uses .not_(col, op, val). Support both: detect which arg looks like
        # a filter name.
        if op in {"is", "eq", "neq", "in"}:
            self._filters.append((f"not_{op}", col, val))
        else:
            # called as not_(col, op, val) — swap
            self._filters.append((f"not_{col}", op, val))
        return self
    def lt(self, col, val):
        self._filters.append(("lt", col, val)); return self
    def gt(self, col, val):
        self._filters.append(("gt", col, val)); return self
    def order(self, col, desc: bool = False, **kw):
        self._order.append((col, desc or kw.get("desc", False))); return self
    def limit(self, n):
        self._limit = n; return self
    def range(self, start, end):
        self._range = (start, end); return self
    def single(self):
        self._single = True; return self
    def maybe_single(self):
        self._single = True; return self

    # ---- mutations ----
    def insert(self, data):
        self._action = "insert"; self._data = data; return self
    def update(self, data):
        self._action = "update"; self._data = data; return self
    def delete(self):
        self._action = "delete"; return self
    def upsert(self, data, on_conflict=None):
        self._action = "upsert"; self._data = data
        self._on_conflict = on_conflict
        return self

    # ---- execute ----
    def execute(self) -> _Response:
        rows = self._store._rows(self._table)
        if self._action == "select":
            return self._do_select(rows)
        if self._action == "insert":
            return self._do_insert(rows)
        if self._action == "update":
            return self._do_update(rows)
        if self._action == "delete":
            return self._do_delete(rows)
        if self._action == "upsert":
            return self._do_upsert(rows)
        raise NotImplementedError(self._action)

    # ---- select implementation (with embeds) ----
    def _do_select(self, rows: list[dict]) -> _Response:
        filtered = [r for r in rows if _match(r, self._filters)]
        ordered = _sorted(filtered, self._order)
        if self._range is not None:
            a, b = self._range
            ordered = ordered[a : b + 1]
        elif self._limit is not None:
            ordered = ordered[: self._limit]

        # Project + attach embeds.
        projected = []
        for row in ordered:
            base = _project(row, self._select_cols) if self._select_cols != ["*"] else dict(row)
            for embed in self._embeds:
                self._attach_embed(base, row, embed)
            projected.append(base)

        count = len(filtered) if self._count_mode == "exact" else None

        if self._single:
            data = projected[0] if projected else None
            return _Response(data=data, count=count)
        return _Response(data=projected, count=count)

    def _attach_embed(self, target: dict, source: dict, embed: dict) -> None:
        child_table = embed["table"]
        alias = embed["alias"]
        cols = embed["cols"]

        # Parent-on-row embed (e.g., posts has user_id, embed profiles by FK)
        if alias and alias in FK_BY_ALIAS:
            fk_col, parent_table = FK_BY_ALIAS[alias]
            parent_id = source.get(fk_col)
            parent_rows = [r for r in self._store._rows(parent_table) if r.get("id") == parent_id]
            target[child_table] = _project(parent_rows[0], cols) if parent_rows else None
            return

        # Child-of-parent (one-to-many: e.g., posts → blocks(*) by post_id)
        # or parent embed without alias (e.g., blocks → posts(user_id)).
        # Decide by comparing the embed table to known child relations.
        my_table = self._table
        if my_table in CHILD_BY_PARENT:
            for (ct, fk) in CHILD_BY_PARENT[my_table]:
                if ct == child_table:
                    children = [r for r in self._store._rows(child_table) if r.get(fk) == source.get("id")]
                    target[child_table] = [_project(c, cols) for c in children]
                    return

        # Fallback: parent embed by convention {child}_id on source.
        candidate_fk = f"{child_table.rstrip('s')}_id"
        if candidate_fk in source:
            parent_id = source[candidate_fk]
            parent_rows = [r for r in self._store._rows(child_table) if r.get("id") == parent_id]
            target[child_table] = _project(parent_rows[0], cols) if parent_rows else None
            return

        # Unknown embed shape — leave key empty rather than blow up so the
        # store stays useful for partial coverage.
        target[child_table] = None if alias else []

    # ---- mutation implementations ----
    def _do_insert(self, rows: list[dict]) -> _Response:
        items = self._data if isinstance(self._data, list) else [self._data]
        inserted: list[dict] = []
        for item in items:
            new = self._store._stamp_new(self._table, dict(item))
            rows.append(new)
            inserted.append(new)
        return _Response(data=inserted)

    def _do_upsert(self, rows: list[dict]) -> _Response:
        items = self._data if isinstance(self._data, list) else [self._data]
        affected: list[dict] = []
        for item in items:
            # If a row matches every filter, update. Otherwise, insert.
            existing = [r for r in rows if _match(r, self._filters)]
            if existing and "id" in item:
                existing = [r for r in existing if r.get("id") == item.get("id")]
            if existing:
                for r in existing:
                    r.update(item)
                    r["updated_at"] = _utcnow_iso()
                    affected.append(r)
            else:
                new = self._store._stamp_new(self._table, dict(item))
                rows.append(new)
                affected.append(new)
        return _Response(data=affected)

    def _do_update(self, rows: list[dict]) -> _Response:
        affected = [r for r in rows if _match(r, self._filters)]
        for r in affected:
            r.update(self._data or {})
            r["updated_at"] = _utcnow_iso()
        return _Response(data=[dict(r) for r in affected])

    def _do_delete(self, rows: list[dict]) -> _Response:
        keep = [r for r in rows if not _match(r, self._filters)]
        removed = [r for r in rows if _match(r, self._filters)]
        rows.clear()
        rows.extend(keep)
        return _Response(data=removed)


# ---------------------------------------------------------------------------
# Storage shim — emulates client.storage just enough for upload routes
# ---------------------------------------------------------------------------

class _StorageBucket:
    def __init__(self):
        self.uploaded: list[str] = []
        self.removed: list[str] = []

    def upload(self, path, content, options=None):
        self.uploaded.append(path)
        return _Response(data=[])

    def remove(self, paths):
        self.removed.extend(paths)
        return _Response(data=[])

    def create_signed_url(self, path, expires_in):
        return {"signedURL": f"https://signed.test/{path}?exp={expires_in}"}

    def get_public_url(self, path):
        return f"https://public.test/{path}"


class _Storage:
    def __init__(self):
        self._buckets: dict[str, _StorageBucket] = {}

    def get_bucket(self, name):
        return _Response(data={"name": name})

    def create_bucket(self, name, options=None):
        self._buckets.setdefault(name, _StorageBucket())
        return _Response()

    def from_(self, bucket):
        return self._buckets.setdefault(bucket, _StorageBucket())


# ---------------------------------------------------------------------------
# Top-level client
# ---------------------------------------------------------------------------

class InMemorySupabase:
    """A best-effort, in-memory replacement for the Supabase client."""

    def __init__(self):
        self._tables: dict[str, list[dict]] = {}
        self.storage = _Storage()

    # ---- state helpers (used by /__test__ router) ----
    def _rows(self, table: str) -> list[dict]:
        return self._tables.setdefault(table, [])

    def reset(self) -> None:
        self._tables.clear()
        self.storage = _Storage()

    def seed(self, table: str, rows: Iterable[dict]) -> list[dict]:
        out: list[dict] = []
        for r in rows:
            row = self._stamp_new(table, dict(r))
            self._rows(table).append(row)
            out.append(row)
        return out

    def _stamp_new(self, table: str, row: dict) -> dict:
        if "id" not in row or row["id"] is None:
            row["id"] = str(uuid.uuid4())
        now = _utcnow_iso()
        row.setdefault("created_at", now)
        row["updated_at"] = now
        # Sensible defaults so PUT-then-GET reads see a stable shape.
        if table == "posts":
            row.setdefault("is_published", False)
            row.setdefault("is_late", False)
            row.setdefault("word_count", 0)
            row.setdefault("title", None)
            row.setdefault("published_at", None)
            row.setdefault("tags", [])
        elif table == "blocks":
            row.setdefault("sort_order", 0)
            row.setdefault("parent_block_id", None)
            row.setdefault("float_position", None)
            row.setdefault("z_index", 0)
            row.setdefault("style", {})
        elif table == "profiles":
            row.setdefault("is_public", True)
            row.setdefault("display_name", None)
            row.setdefault("avatar_url", None)
            row.setdefault("avatar_color", "#223843")
            row.setdefault("streak_count", 0)
            row.setdefault("bio", None)
        elif table == "follows":
            row.setdefault("status", "pending")
        elif table == "notifications":
            row.setdefault("is_read", False)
        return row

    # ---- supabase client API ----
    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, name: str, params=None) -> _Query:
        # No stored procs used in test flows — return an empty-response query.
        return _Query(self, f"_rpc:{name}")


# Process-wide singleton, attached to the FastAPI app at startup when
# EDITION_TEST_MODE=1. Kept module-level so the /__test__ router and
# get_db override share the same instance.
STORE = InMemorySupabase()
