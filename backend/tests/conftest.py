import os

# Set test environment variables BEFORE any app imports so pydantic-settings
# doesn't fail on missing required fields and get_settings() cache is seeded
# with test values.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-32-chars-minimum!")

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.deps import get_db, get_authenticated_user
from app.auth import get_optional_user

# Clear the lru_cache so our env vars above take effect
get_settings.cache_clear()

TEST_USER_ID = "test-user-id"
OTHER_USER_ID = "other-user-id"
TEST_POST_ID = "test-post-id"
TEST_BLOCK_ID = "test-block-id"
TEST_NOTIF_ID = "test-notif-id"


# ---------------------------------------------------------------------------
# Mock Supabase response/builder/client
# ---------------------------------------------------------------------------

class MockResponse:
    def __init__(self, data=None, count=None):
        self.data = data if data is not None else []
        self.count = count


class MockQueryBuilder:
    """Chainable stand-in for Supabase PostgREST query builder."""

    def __init__(self, client, table_name=""):
        self._client = client
        self._table = table_name
        self._single = False
        self._order: list[tuple[str, bool]] = []

    # --- chainable filters (all return self) ---
    def select(self, *args, **kwargs): return self
    def eq(self, col, val): return self
    def neq(self, col, val): return self
    def in_(self, col, vals): return self
    def is_(self, col, val): return self
    def not_(self, col, op, val): return self
    def order(self, col, **kwargs):
        # Track ordering so execute() can sort the mocked data, matching
        # how real PostgREST applies .order() server-side.
        self._order.append((col, bool(kwargs.get("desc", False))))
        return self
    def range(self, start, end): return self
    def limit(self, n): return self

    def single(self):
        self._single = True
        return self

    def insert(self, data):
        self._client._last_insert = data
        self._client._last_insert_table = self._table
        return self

    def update(self, data):
        self._client._last_update = data
        self._client._last_update_table = self._table
        return self

    def delete(self):
        self._client._last_delete_table = self._table
        return self

    def upsert(self, data):
        self._client._last_insert = data
        return self

    def execute(self):
        resp = self._client._pop_response()
        if self._order and isinstance(resp.data, list) and resp.data:
            for col, desc in reversed(self._order):
                resp.data = sorted(
                    resp.data,
                    key=lambda row, c=col: (row.get(c) is None, row.get(c)),
                    reverse=desc,
                )
        if self._single and isinstance(resp.data, list):
            resp.data = resp.data[0] if resp.data else None
        return resp


class MockRpcBuilder:
    def __init__(self, client):
        self._client = client

    def execute(self):
        return self._client._pop_response()


class MockStorageFileBuilder:
    def __init__(self):
        self.uploaded_paths: list[str] = []
        self.removed_paths: list[str] = []

    def upload(self, path, content, options=None):
        self.uploaded_paths.append(path)
        return MockResponse(data=[])

    def remove(self, paths):
        self.removed_paths.extend(paths)
        return MockResponse(data=[])


class MockStorageBuckets:
    def __init__(self):
        self._builders: dict[str, MockStorageFileBuilder] = {}

    def get_bucket(self, name):
        return MockResponse()

    def create_bucket(self, name, options=None):
        return MockResponse()

    def from_(self, bucket):
        if bucket not in self._builders:
            self._builders[bucket] = MockStorageFileBuilder()
        return self._builders[bucket]


class MockSupabaseClient:
    def __init__(self):
        self._responses: list[MockResponse] = []
        self.storage = MockStorageBuckets()
        self._rpc_calls: list[dict] = []
        # last operation tracking for assertions
        self._last_insert = None
        self._last_insert_table: str | None = None
        self._last_update = None
        self._last_update_table: str | None = None
        self._last_delete_table: str | None = None

    # --- configuration helpers ---
    def set_response(self, data, count=None):
        self._responses.append(MockResponse(data, count))

    def set_responses(self, items):
        for item in items:
            if isinstance(item, MockResponse):
                self._responses.append(item)
            elif isinstance(item, dict) and "data" in item:
                self._responses.append(MockResponse(item["data"], item.get("count")))
            else:
                self._responses.append(MockResponse(item))

    def _pop_response(self) -> MockResponse:
        if self._responses:
            return self._responses.pop(0)
        return MockResponse(data=[])

    def reset(self):
        self._responses.clear()
        self._rpc_calls.clear()
        self._last_insert = None
        self._last_insert_table = None
        self._last_update = None
        self._last_update_table = None
        self._last_delete_table = None

    # --- Supabase client API ---
    def table(self, name: str) -> MockQueryBuilder:
        return MockQueryBuilder(self, name)

    def rpc(self, name: str, params=None) -> MockRpcBuilder:
        self._rpc_calls.append({"name": name, "params": params or {}})
        return MockRpcBuilder(self)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_db():
    db = MockSupabaseClient()
    yield db
    db.reset()


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_authenticated_user] = lambda: TEST_USER_ID
    # Mirror authenticated_user → optional_user so endpoints that branch on
    # caller identity (e.g. /api/posts/{id} for an owner-as-viewer) see the
    # same TEST_USER_ID instead of falling through the anonymous path.
    app.dependency_overrides[get_optional_user] = lambda: TEST_USER_ID
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client(mock_db):
    """Like `client` but with no authenticated user — caller_id is None.

    Use for endpoints that must serve anonymous visitors (public profile
    pages, anonymous /api/posts/{id} requests against revealed posts).
    """
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_optional_user] = lambda: None
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Shared sample data
# ---------------------------------------------------------------------------

SAMPLE_PROFILE = {
    "id": TEST_USER_ID,
    "username": "testuser",
    "display_name": "Test User",
    "bio": "Test bio",
    "is_public": True,
    "avatar_url": None,
    "avatar_color": "#223843",
    "streak_count": 0,
    "created_at": "2025-01-01T00:00:00",
}

SAMPLE_POST = {
    "id": TEST_POST_ID,
    "user_id": TEST_USER_ID,
    "week_number": 10,
    "year": 2025,
    "title": "Test Post",
    "is_published": False,
    "is_late": False,
    "word_count": 0,
    "cover_color": None,
    "tags": [],
    "published_at": None,
    "created_at": "2025-01-06T00:00:00",
    "updated_at": "2025-01-06T00:00:00",
}

PUBLISHED_POST = {**SAMPLE_POST, "is_published": True, "word_count": 150}

SAMPLE_BLOCK = {
    "id": TEST_BLOCK_ID,
    "post_id": TEST_POST_ID,
    "parent_block_id": None,
    "type": "markdown",
    "content": {"markdown": "Hello world " * 20},
    "grid_layout_desktop": {"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 2},
    "grid_layout_mobile": {"colStart": 1, "colSpan": 1, "rowStart": 1, "rowSpan": 2},
    "float_position": None,
    "z_index": 0,
    "sort_order": 0,
    "created_at": "2025-01-06T00:00:00",
    "updated_at": "2025-01-06T00:00:00",
}

SAMPLE_NOTIFICATION = {
    "id": TEST_NOTIF_ID,
    "user_id": TEST_USER_ID,
    "actor_id": OTHER_USER_ID,
    "type": "new_follower",
    "reference_id": None,
    "is_read": False,
    "created_at": "2025-01-06T00:00:00",
    "profiles": {
        "id": OTHER_USER_ID,
        "username": "otheruser",
        "display_name": "Other User",
        "avatar_url": None,
    },
}
