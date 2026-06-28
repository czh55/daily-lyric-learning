"""汽水音乐链接缓存查找（仅读本地 data/qishui-tracks.json）。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
QISHUI_FILE = ROOT / "data" / "qishui-tracks.json"


def load_cache() -> dict:
    if not QISHUI_FILE.exists():
        return {}
    with open(QISHUI_FILE, encoding="utf-8") as f:
        return json.load(f)


def lookup_url(slug: str) -> Optional[str]:
    """按 slug 在缓存中查找已验证的汽水音乐链接。"""
    cache = load_cache()
    for album in cache.values():
        track = album.get("tracks", {}).get(slug)
        if track and track.get("url"):
            return track["url"]
    return None


def track_url(track_id: str) -> str:
    return f"https://music.douyin.com/qishui/share/track?track_id={track_id}"
