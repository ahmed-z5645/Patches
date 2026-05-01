import io
import pytest
from tests.conftest import TEST_USER_ID
from app.routers.upload import delete_image_by_url, _bucket_ensured
import app.routers.upload as upload_module


@pytest.fixture(autouse=True)
def reset_bucket_flag():
    upload_module._bucket_ensured = False
    yield
    upload_module._bucket_ensured = False


def _make_image_file(content=b"fake image data", filename="test.png", content_type="image/png"):
    return ("file", (filename, io.BytesIO(content), content_type))


def test_upload_image_success(client, mock_db):
    r = client.post(
        "/api/upload",
        files=[_make_image_file()],
    )
    assert r.status_code == 200
    url = r.json()["url"]
    assert url.startswith("https://test.supabase.co/storage/v1/object/public/images/")
    assert TEST_USER_ID in url
    assert url.endswith(".png")


def test_upload_non_image_rejected(client, mock_db):
    r = client.post(
        "/api/upload",
        files=[("file", ("doc.pdf", io.BytesIO(b"pdf content"), "application/pdf"))],
    )
    assert r.status_code == 400
    assert "image" in r.json()["detail"].lower()


def test_upload_oversized_file_rejected(client, mock_db):
    big_content = b"x" * (5 * 1024 * 1024 + 1)
    r = client.post(
        "/api/upload",
        files=[("file", ("big.png", io.BytesIO(big_content), "image/png"))],
    )
    assert r.status_code == 400
    assert "5MB" in r.json()["detail"]


def test_upload_uses_user_id_in_path(client, mock_db):
    r = client.post(
        "/api/upload",
        files=[_make_image_file()],
    )
    assert r.status_code == 200
    storage_builder = mock_db.storage._builders.get("images")
    assert storage_builder is not None
    assert len(storage_builder.uploaded_paths) == 1
    assert storage_builder.uploaded_paths[0].startswith(TEST_USER_ID + "/")


def test_delete_image_by_url_calls_storage_remove(mock_db):
    url = "https://test.supabase.co/storage/v1/object/public/images/user-id/photo.jpg"
    delete_image_by_url(mock_db, url)
    storage_builder = mock_db.storage._builders.get("images")
    assert storage_builder is not None
    assert "user-id/photo.jpg" in storage_builder.removed_paths


def test_delete_image_by_url_ignores_unrelated_urls(mock_db):
    delete_image_by_url(mock_db, "https://other-domain.com/image.png")
    # No storage calls made
    assert "images" not in mock_db.storage._builders
