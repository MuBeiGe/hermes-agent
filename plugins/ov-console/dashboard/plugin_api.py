"""OV Console Dashboard Plugin — Unified OV Server proxy (no Console dependency)."""
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["ov-console"])

OV_SERVER = "http://127.0.0.1:1933"
OV_USER_KEY = "54e368f7bf13142d9c5a37f48000d0b6ad4ec5bdc3e3eab6d9fa18a9c08a3f69"
OV_ROOT_KEY = "L0kAJzPLpSDopOT7KRAcGdEVm-KsSK4h08_Y5p4z9fY"
OV_ACCOUNT = "default"
OV_USER = "yao"

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={
                "X-API-Key": OV_USER_KEY,
                "X-OpenViking-Account": OV_ACCOUNT,
                "X-OpenViking-User": OV_USER,
            },
        )
    return _client


async def _call(method: str, path: str, *, params: dict | None = None,
                json_body: Any = None) -> Any:
    """Single unified proxy — all requests go directly to OV Server (1933)."""
    url = f"{OV_SERVER}{path}"
    try:
        resp = await _get_client().request(method, url, params=params, json=json_body)
        data = resp.json()
        if resp.status_code >= 400:
            logger.error("OV error: %s %s → %d %s", method, path,
                         resp.status_code, str(data)[:200])
            raise HTTPException(resp.status_code, detail=data)
        return data
    except httpx.ConnectError:
        raise HTTPException(502, detail="OV Server (1933) 不可达")
    except httpx.TimeoutException:
        raise HTTPException(504, detail="OV Server 请求超时")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("OV unexpected: %s %s → %s", method, path, e)
        raise HTTPException(502, detail=str(e))


# ── Health ──────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    try:
        return await _call("GET", "/api/v1/system/status")
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/system/status")
async def system_status():
    return await _call("GET", "/api/v1/system/status")


# ── Capabilities ────────────────────────────────────────────────────────────

@router.get("/capabilities")
async def capabilities():
    """Runtime info — OV Console unique, but OV Server has similar info."""
    return await _call("GET", "/api/v1/observer/system")


# ── File System ─────────────────────────────────────────────────────────────

@router.get("/fs/ls")
async def fs_ls(uri: str = Query(default="")):
    return await _call("GET", "/api/v1/fs/ls", params={"uri": uri})


@router.get("/fs/tree")
async def fs_tree(uri: str = Query(default=""), depth: int = Query(default=2)):
    return await _call("GET", "/api/v1/fs/tree", params={"uri": uri, "depth": depth})


@router.get("/fs/stat")
async def fs_stat(uri: str = Query(default="")):
    if not uri:
        raise HTTPException(400, detail="需要指定 uri 参数")
    return await _call("GET", "/api/v1/fs/stat", params={"uri": uri})


@router.post("/fs/mkdir")
async def fs_mkdir(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/fs/mkdir", json_body=body)


@router.post("/fs/mv")
async def fs_mv(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/fs/mv", json_body=body)


@router.delete("/fs")
async def fs_rm(uri: str = Query(default=""), recursive: bool = Query(default=False)):
    if not uri:
        raise HTTPException(400, detail="需要指定 uri 参数")
    return await _call("DELETE", "/api/v1/fs", params={"uri": uri, "recursive": recursive})


# ── Content ─────────────────────────────────────────────────────────────────

@router.get("/content/read")
async def content_read(uri: str = Query(default=""), mode: str = Query(default="overview")):
    if not uri:
        raise HTTPException(400, detail="需要指定 uri 参数")
    # First try direct read
    data = None
    try:
        data = await _call("GET", "/api/v1/content/read", params={"uri": uri, "mode": mode})
    except HTTPException as exc:
        if exc.status_code == 404:
            data = exc.detail
        else:
            raise
    # If NOT_FOUND, check if it's a directory and read first file inside
    err = (data.get("error") or {}) if isinstance(data, dict) else {}
    if isinstance(data, dict) and err.get("code") == "NOT_FOUND":
        try:
            ls = await _call("GET", "/api/v1/fs/ls", params={"uri": uri})
            items = ls.get("result", []) if isinstance(ls, dict) else []
            # Find first non-directory file
            for item in items:
                if isinstance(item, dict) and not item.get("isDir"):
                    return await _call("GET", "/api/v1/content/read", params={"uri": item["uri"], "mode": mode})
            # If all are dirs or empty, try appending the same name as .md
            basename = uri.rstrip("/").split("/")[-1]
            if basename and not basename.endswith(".md"):
                return await _call("GET", "/api/v1/content/read", params={"uri": uri.rstrip("/") + "/" + basename + ".md", "mode": mode})
        except Exception:
            pass
    return data


@router.post("/content/write")
async def content_write(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/content/write", json_body=body)


# ── Search ──────────────────────────────────────────────────────────────────

@router.post("/search")
async def search(request: Request):
    body = await request.json()
    data = await _call("POST", "/api/v1/search/search", json_body=body)
    result = data.get("result", {})
    total = result.get("total", 0) if isinstance(result, dict) else 0
    if isinstance(result, dict):
        memories = result.get("memories", [])
        resources = result.get("resources", [])
        skills = result.get("skills", [])
        return {"total": total, "memories": memories, "resources": resources, "skills": skills}
    return {"total": 0, "memories": [], "resources": [], "skills": [], "raw": result}


# ── Resources ───────────────────────────────────────────────────────────────

@router.post("/resources")
async def add_resource(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/resources", json_body=body)


@router.post("/resources/temp_upload")
async def temp_upload(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/resources/temp_upload", json_body=body)


# ── Sessions ────────────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(request: Request):
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else None
    return await _call("POST", "/api/v1/sessions", json_body=body)


@router.post("/sessions/{session_id}/messages")
async def session_messages(session_id: str, request: Request):
    body = await request.json()
    return await _call("POST", f"/api/v1/sessions/{session_id}/messages", json_body=body)


@router.get("/sessions")
async def list_sessions():
    return await _call("GET", "/api/v1/sessions")


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/accounts")
async def list_accounts():
    return await _call("GET", "/api/v1/admin/accounts")


@router.post("/admin/accounts")
async def create_account(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/admin/accounts", json_body=body)


@router.get("/admin/accounts/{account_id}/users")
async def list_users(account_id: str):
    return await _call("GET", f"/api/v1/admin/accounts/{account_id}/users")


@router.post("/admin/accounts/{account_id}/users")
async def register_user(account_id: str, request: Request):
    body = await request.json()
    return await _call("POST", f"/api/v1/admin/accounts/{account_id}/users", json_body=body)


# ── Search (grep/glob) ───────────────────────────────────────────────────────

@router.post("/search/grep")
async def search_grep(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/search/grep", json_body=body)


@router.post("/search/glob")
async def search_glob(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/search/glob", json_body=body)


# ── Relations ───────────────────────────────────────────────────────────────

@router.get("/relations")
async def get_relations(uri: str = Query(default="")):
    if not uri:
        raise HTTPException(400, detail="需要指定 uri 参数")
    return await _call("GET", "/api/v1/relations", params={"uri": uri})


@router.post("/relations/link")
async def create_relation(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/relations/link", json_body=body)


# ── Feedback ────────────────────────────────────────────────────────────────

@router.post("/feedback")
async def submit_feedback(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/memory/feedback", json_body=body)


# ── Observer ───────────────────────────────────────────────────────────────

@router.get("/observer/{component}")
async def observer_status(component: str):
    return await _call("GET", f"/api/v1/observer/{component}")


# ── Export/Import ───────────────────────────────────────────────────────────

@router.post("/export")
async def export_data(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/pack/export", json_body=body)


@router.post("/import")
async def import_data(request: Request):
    body = await request.json()
    return await _call("POST", "/api/v1/pack/import", json_body=body)
