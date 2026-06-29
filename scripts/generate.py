#!/usr/bin/env python3
"""
每日英文歌词学习 — 生成脚本
================================
用法：
  python3 scripts/generate.py --prepare    # 选题并写入 .daily/context.json
  python3 scripts/generate.py --finalize   # 校验精讲文件并更新 history.json
  python3 scripts/generate.py --dry-run    # 预览选题，不写入文件
  python3 scripts/generate.py --list       # 列出曲库
  python3 scripts/generate.py --sync       # 同步 data/ 到 docs/data/
"""

from __future__ import annotations

import json
import random
import re
import shutil
import sys
from argparse import ArgumentParser
from datetime import date
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.qishui import lookup_url  # noqa: E402

DATA = ROOT / "data"
DOCS = ROOT / "docs"
DOCS_DATA = DOCS / "data"
LESSONS = DOCS / "assets" / "lessons"
DAILY = ROOT / ".daily"
CONTEXT_FILE = DAILY / "context.json"

SONGS_FILE = DATA / "songs.json"
ARTISTS_FILE = DATA / "artists.json"
HISTORY_FILE = DATA / "history.json"


def load_json(path: Path) -> dict | list:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def get_artist_name(artist_id: str, artists: list) -> str:
    for artist in artists:
        if artist.get("id") == artist_id:
            return artist.get("name", artist_id)
    return artist_id


def load_history() -> dict:
    if not HISTORY_FILE.exists():
        return {"entries": []}
    return load_json(HISTORY_FILE)


def learned_slugs(history: dict) -> set[str]:
    return {entry.get("slug", "") for entry in history.get("entries", [])}


def entry_for_date(history: dict, date_str: str) -> Optional[dict]:
    for entry in history.get("entries", []):
        if entry.get("date") == date_str:
            return entry
    return None


def select_song(date_str: str) -> tuple[dict, dict, bool]:
    """返回 (song, history, history_was_reset)。"""
    songs = load_json(SONGS_FILE)
    history = load_history()
    learned = learned_slugs(history)

    unlearned = [song for song in songs if song["slug"] not in learned]
    history_was_reset = False

    if not unlearned:
        history = {"entries": []}
        learned = set()
        unlearned = songs
        history_was_reset = True
        print("曲库已全部学完，重置 history 并重新开始")

    random.seed(int(date_str.replace("-", "")))
    song = random.choice(unlearned)
    return song, history, history_was_reset


def build_context(song: dict, date_str: str) -> dict:
    artists = load_json(ARTISTS_FILE)
    artist_name = get_artist_name(song["artist"], artists)
    lesson_file = f"assets/lessons/{date_str}-{song['slug']}.md"
    qishui_url = lookup_url(song["slug"])

    return {
        "date": date_str,
        "artist": song["artist"],
        "artistName": artist_name,
        "title": song["title"],
        "slug": song["slug"],
        "difficulty": song.get("difficulty", ""),
        "bpm": song.get("bpm", ""),
        "file": lesson_file,
        "lessonPath": str(DOCS / lesson_file),
        "qishuiUrl": qishui_url or "",
        "promptTemplate": "prompts/lyric-learning-prompt.md",
        "skipped": False,
    }


def build_front_matter(context: dict) -> str:
    lines = [
        "---",
        f"date: {context['date']}",
        f"artist: {context['artist']}",
        f"artistName: {context['artistName']}",
        f"title: {context['title']}",
        f"slug: {context['slug']}",
    ]
    if context.get("qishuiUrl"):
        lines.append(f"qishuiUrl: {context['qishuiUrl']}")
    lines.extend(["---", ""])
    return "\n".join(lines)


def build_qishui_section(context: dict) -> str:
    title = context["title"]
    artist_name = context["artistName"]
    url = context.get("qishuiUrl") or ""
    if url:
        return f"## 八、汽水音乐\n\n在汽水音乐收听今日歌曲：[{title}]({url})\n"
    return (
        f"## 八、汽水音乐\n\n"
        f"汽水音乐暂未收录该曲，请在 App 内搜索「{artist_name} {title}」。\n"
    )


def lesson_has_body(path: Path) -> bool:
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    body = re.sub(r"^---[\s\S]*?---\s*", "", text, count=1).strip()
    return len(body) > 200 and "## 一、歌曲概览" in body


def sync_docs_data() -> None:
    """将 data/ 同步到 docs/data/，供 GitHub Pages 静态访问。"""
    DOCS_DATA.mkdir(parents=True, exist_ok=True)
    for name in ("history.json", "artists.json", "songs.json"):
        src = DATA / name
        if src.exists():
            shutil.copy2(src, DOCS_DATA / name)
    print(f"✓ 已同步 data/ → {DOCS_DATA.relative_to(ROOT)}/")


def prepare(date_str: str, dry_run: bool = False, force: bool = False) -> bool:
    history = load_history()
    existing = entry_for_date(history, date_str)
    if existing and not force:
        print(f"今日 ({date_str}) 已有记录：{existing['artistName']} - {existing['title']}，跳过")
        context = {
            "date": date_str,
            "skipped": True,
            "reason": "already_generated",
            "existing": existing,
        }
        if not dry_run:
            DAILY.mkdir(parents=True, exist_ok=True)
            save_json(CONTEXT_FILE, context)
        return False

    song, history, history_was_reset = select_song(date_str)
    context = build_context(song, date_str)
    context["historyWasReset"] = history_was_reset
    context["pendingHistory"] = history

    artist_name = context["artistName"]
    print(f"今日歌曲：{artist_name} - {context['title']}")
    print(f"Slug：{context['slug']}")
    print(f"文件：{context['file']}")
    if context["qishuiUrl"]:
        print(f"汽水音乐：{context['qishuiUrl']}（缓存命中）")
    else:
        print("汽水音乐：缓存未命中，Agent 需按 prompts/qishui-lookup.md 查找")

    if dry_run:
        print("\n[Dry-run] 跳过文件写入")
        return True

    DAILY.mkdir(parents=True, exist_ok=True)
    save_json(CONTEXT_FILE, context)

    lesson_path = Path(context["lessonPath"])
    if not lesson_path.exists():
        header = f"# {artist_name} — {context['title']}\n\n"
        lesson_path.parent.mkdir(parents=True, exist_ok=True)
        lesson_path.write_text(build_front_matter(context) + header, encoding="utf-8")
        print(f"✓ 已创建精讲骨架：{context['file']}")

    print(f"✓ 已写入 {CONTEXT_FILE.relative_to(ROOT)}")
    return True


def generate_lesson_audio(context: dict, skip_audio: bool = False) -> bool:
    """为当日精讲生成语音讲解 MP3。"""
    if skip_audio:
        print("跳过语音生成（--skip-audio）")
        return False
    try:
        from scripts.generate_audio import generate_audio
    except ImportError:
        print("⚠ 未安装 edge-tts，跳过语音生成（pip install -r requirements.txt）")
        return False

    lesson_path = Path(context["lessonPath"])
    lesson_md = lesson_path.read_text(encoding="utf-8")
    meta = {
        "date": context["date"],
        "artist": context["artist"],
        "artistName": context["artistName"],
        "title": context["title"],
        "slug": context["slug"],
    }
    return generate_audio(meta, lesson_md, context["date"])


def finalize(date_str: str, force: bool = False, skip_audio: bool = False) -> bool:
    if not CONTEXT_FILE.exists():
        print("未找到 .daily/context.json，请先运行 --prepare")
        return False

    context = load_json(CONTEXT_FILE)
    if context.get("skipped"):
        print("今日已跳过，无需 finalize")
        return True

    lesson_path = Path(context["lessonPath"])
    if not lesson_has_body(lesson_path):
        print(f"精讲内容不完整：{context['file']}")
        print("请 Agent 按 prompts/lyric-learning-prompt.md 补全后再运行 --finalize")
        return False

    text = lesson_path.read_text(encoding="utf-8")
    if "## 八、汽水音乐" not in text:
        text = text.rstrip() + "\n\n---\n\n" + build_qishui_section(context)
        lesson_path.write_text(text, encoding="utf-8")
        print("✓ 已追加「八、汽水音乐」章节")

    history = context.get("pendingHistory") or load_history()
    if context.get("historyWasReset"):
        history = {"entries": []}

    entries = [e for e in history.get("entries", []) if e.get("date") != date_str]
    entries.insert(
        0,
        {
            "date": date_str,
            "artist": context["artist"],
            "artistName": context["artistName"],
            "title": context["title"],
            "slug": context["slug"],
            "file": context["file"],
        },
    )
    save_json(HISTORY_FILE, {"entries": entries})
    print(f"✓ 已更新 {HISTORY_FILE.relative_to(ROOT)}")
    sync_docs_data()
    generate_lesson_audio(context, skip_audio=skip_audio)
    return True


def show_status(date_str: str) -> None:
    history = load_history()
    existing = entry_for_date(history, date_str)
    if existing:
        print(f"今日 ({date_str}) 已生成：{existing['artistName']} - {existing['title']}")
        print(f"文件：{existing['file']}")
    else:
        print(f"今日 ({date_str}) 尚未生成")


def list_songs() -> None:
    songs = load_json(SONGS_FILE)
    history = load_history()
    learned = learned_slugs(history)
    print(f"=== 曲库（共 {len(songs)} 首，已学 {len(learned)} 首）===\n")
    for song in songs:
        mark = "✓" if song["slug"] in learned else " "
        print(f"  [{mark}] {song['artist']:20s} {song['title']}")


def main() -> None:
    parser = ArgumentParser(description="每日英文歌词学习生成器")
    parser.add_argument("--prepare", action="store_true", help="选题并写入 context")
    parser.add_argument("--finalize", action="store_true", help="校验精讲并更新 history")
    parser.add_argument("--dry-run", action="store_true", help="预览但不写入")
    parser.add_argument("--list", action="store_true", help="列出曲库")
    parser.add_argument("--status", action="store_true", help="查看今日状态")
    parser.add_argument("--date", type=str, help="指定日期 YYYY-MM-DD（默认今天）")
    parser.add_argument("--force", action="store_true", help="覆盖已有日期记录")
    parser.add_argument("--sync", action="store_true", help="同步 data/ 到 docs/data/")
    parser.add_argument("--skip-audio", action="store_true", help="跳过语音讲解生成")
    args = parser.parse_args()

    date_str = args.date or date.today().isoformat()

    if args.sync:
        sync_docs_data()
        return

    if args.list:
        list_songs()
        return

    if args.status:
        show_status(date_str)
        return

    if args.finalize:
        ok = finalize(date_str, force=args.force, skip_audio=args.skip_audio)
        sys.exit(0 if ok else 1)

    if args.prepare or not any([args.finalize, args.list, args.status]):
        ok = prepare(date_str, dry_run=args.dry_run, force=args.force)
        if CONTEXT_FILE.exists():
            context = load_json(CONTEXT_FILE)
            if context.get("skipped"):
                sys.exit(0)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
