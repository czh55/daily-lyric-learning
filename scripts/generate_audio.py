#!/usr/bin/env python3
"""
从歌词精讲 Markdown 生成语音讲解 MP3。
使用 edge-tts（微软 Edge 语音，免费、中文自然）。

用法：
  python3 scripts/generate_audio.py --date=2026-06-28
  python3 scripts/generate_audio.py --date=2026-06-28 --print-script
  python3 scripts/generate_audio.py --all
"""

from __future__ import annotations

import asyncio
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DOCS = ROOT / "docs"
AUDIO_DIR = DOCS / "audio"
LINES_DIR = AUDIO_DIR / "lines"
LESSONS = DOCS / "assets" / "lessons"
DATA = ROOT / "data"

DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
EN_VOICE_US = "en-US-JennyNeural"
EN_VOICE_GB = "en-GB-SoniaNeural"
MAX_CHUNK_LEN = 2000

SECTION_ORDER = [
    ("一、歌曲概览", "歌曲背景与风格"),
    ("三、歌曲高频短语总结", "高频短语"),
    ("四、整首节奏学习指南", "节奏跟读指南"),
    ("五、跟读重点句", "跟读重点"),
    ("六、今日学习检测", "学习检测"),
    ("七、歌曲推荐链", "推荐下一首"),
]


def strip_markdown(text: str) -> str:
    """将 Markdown 片段转为适合朗读的纯文本"""
    if not text:
        return ""
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.M)
    text = re.sub(r"^>\s*", "", text, flags=re.M)
    text = re.sub(r"^[-*]\s+", "", text, flags=re.M)
    text = re.sub(r"^\d+\.\s+", "", text, flags=re.M)
    text = re.sub(r"[📌💬✍️❤️🎤⚠️▸]", "", text)
    # 跳过 Markdown 表格
    lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("|") or stripped.startswith("---"):
            continue
        lines.append(line)
    text = "\n".join(lines)
    text = text.replace("→", "到").replace("—", "，")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_lesson_sections(md: str) -> dict[str, str]:
    """按 ## 标题切分精讲章节"""
    body = re.sub(r"^---[\s\S]*?---\s*", "", md, count=1).strip()
    sections: dict[str, str] = {}
    current: str | None = None
    buf: list[str] = []

    for line in body.split("\n"):
        match = re.match(r"^## (.+)$", line)
        if match:
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current = match.group(1)
            buf = []
        elif current is not None:
            buf.append(line)

    if current is not None:
        sections[current] = "\n".join(buf).strip()
    return sections


def extract_all_lyric_lines(lesson_md: str) -> list[str]:
    """提取逐句精讲中全部英文原句"""
    sections = parse_lesson_sections(lesson_md)
    section = sections.get("二、逐句精讲", "")
    lines: list[str] = []
    for match in re.finditer(r"\*\*▸ 原句\*\*[：:]\s*(.+)", section):
        text = strip_markdown(match.group(1))
        if text:
            lines.append(text)
    return lines


def line_voice_for_artist(artist_id: str) -> str:
    return EN_VOICE_GB if artist_id == "sampha" else EN_VOICE_US


async def _generate_line_mp3(text: str, output: Path, voice: str) -> bool:
    try:
        await _synthesize_chunk(text, output, voice)
        return output.exists()
    except Exception:
        return False


async def _generate_lines_async(
    lines: list[str], date_str: str, voice: str
) -> list[dict]:
    LINES_DIR.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []

    async def one(i: int, text: str) -> dict | None:
        out = LINES_DIR / f"{date_str}-{i}.mp3"
        ok = await _generate_line_mp3(text, out, voice)
        if ok:
            return {"index": i, "text": text, "url": f"audio/lines/{date_str}-{i}.mp3"}
        return None

    results = await asyncio.gather(*(one(i, t) for i, t in enumerate(lines)))
    return [r for r in results if r]


def generate_line_audio(meta: dict, lesson_md: str, date_str: str) -> bool:
    """为逐句精讲中的英文原句生成朗读 MP3"""
    lines = extract_all_lyric_lines(lesson_md)
    if not lines:
        return False

    voice = line_voice_for_artist(meta.get("artist", ""))
    try:
        manifest_lines = asyncio.run(_generate_lines_async(lines, date_str, voice))
        if not manifest_lines:
            print(f"⚠ 歌词朗读生成失败：{date_str}")
            return False

        manifest_path = LINES_DIR / f"{date_str}.json"
        import json

        manifest_path.write_text(
            json.dumps(
                {
                    "date": date_str,
                    "artist": meta.get("artist", ""),
                    "lines": manifest_lines,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"✓ 已生成 {len(manifest_lines)} 条歌词朗读 docs/audio/lines/{date_str}.json")
        return True
    except Exception as e:
        print(f"⚠ 歌词朗读生成失败: {e}")
        return False


def extract_lyric_highlights(section_text: str, limit: int = 3) -> list[str]:
    """从逐句精讲提取原句 + 中文释义摘要"""
    highlights: list[str] = []
    blocks = re.split(r"\n---+\n", section_text)
    for block in blocks:
        original = re.search(r"\*\*▸ 原句\*\*[：:]\s*(.+)", block)
        meaning = re.search(r"\*\*中文释义\*\*[：:]\s*(.+)", block)
        if original:
            line = strip_markdown(original.group(1))
            if meaning:
                line += f"。中文释义：{strip_markdown(meaning.group(1))}"
            highlights.append(line)
        if len(highlights) >= limit:
            break
    return highlights


def extract_quiz_questions(section_text: str) -> list[str]:
    """提取学习检测题目（不含答案）"""
    questions: list[str] = []
    for match in re.finditer(r">\s*\*\*(\d+\.\s*[^*]+)\*\*", section_text):
        questions.append(strip_markdown(match.group(1)))
    return questions


def estimate_duration_label(char_count: int) -> str:
    minutes = char_count / 280
    low = max(1, int(minutes))
    high = max(low, int(minutes + 0.99))
    if low == high:
        return f"约 {low} 分钟"
    return f"约 {low} 到 {high} 分钟"


def _ordinal(n: int) -> str:
    names = ["一", "二", "三", "四", "五", "六", "七", "八"]
    if 1 <= n <= len(names):
        return f"第{names[n - 1]}"
    return f"第{n}"


def collect_narration_sections(
    meta: dict, sections: dict[str, str]
) -> list[tuple[str, str, list[str]]]:
    """收集讲解各章节：(章节名, 大纲描述, 正文段落列表)"""
    result: list[tuple[str, str, list[str]]] = []

    overview = sections.get("一、歌曲概览", "")
    if overview:
        parts = [strip_markdown(p) for p in re.split(r"\n\n+", overview) if strip_markdown(p)]
        if parts:
            result.append(("歌曲概览", "创作背景、主题风格与制作分析", parts))

    lyric_section = sections.get("二、逐句精讲", "")
    highlights = extract_lyric_highlights(lyric_section)
    if highlights:
        parts = ["接下来精讲几句核心歌词。"] + highlights
        label = f"核心歌词，共 {len(highlights)} 句"
        result.append(("核心歌词", label, parts))

    for key, label in SECTION_ORDER[1:]:
        content = sections.get(key, "")
        if not content:
            continue
        if key == "六、今日学习检测":
            questions = extract_quiz_questions(content)
            if questions:
                parts = ["最后是今日学习检测，请尝试中译英。"] + questions
                result.append((key.split("、", 1)[-1], label, parts))
            continue
        parts = [strip_markdown(p) for p in re.split(r"\n\n+", content) if strip_markdown(p)]
        if parts:
            result.append((key.split("、", 1)[-1], label, parts))

    return result


def build_opening_intro(
    meta: dict, sections: list[tuple[str, str, list[str]]], body_char_count: int
) -> str:
    artist = meta.get("artistName", meta.get("artist", ""))
    title = meta.get("title", "")
    duration = estimate_duration_label(body_char_count + 200)
    outline = "；".join(f"{_ordinal(i)}，{label}" for i, (_, label, _) in enumerate(sections, 1))
    section_count = len(sections)
    return (
        f"欢迎收听每日英文歌词学习。今天是 {artist} 的 {title}。"
        f"本次讲解预计时长 {duration}，共 {section_count} 个部分。"
        f"内容结构如下：{outline}。"
        f"好，我们开始。"
    )


def build_narration_script(meta: dict, lesson_md: str) -> str:
    """将精讲 Markdown 组装为完整语音旁白稿"""
    sections_map = parse_lesson_sections(lesson_md)
    sections = collect_narration_sections(meta, sections_map)

    body_parts: list[str] = []
    for _, _, parts in sections:
        body_parts.extend(parts)

    body_parts.append(
        "讲解完毕。建议回到网页查看完整逐句精讲与词汇表，跟读练习加深记忆。祝学习顺利！"
    )

    body_text = "\n\n".join(p.strip() for p in body_parts if p.strip())
    intro = build_opening_intro(meta, sections, len(body_text))
    return f"{intro}\n\n{body_text}"


def split_text(text: str, max_len: int = MAX_CHUNK_LEN) -> list[str]:
    if len(text) <= max_len:
        return [text]

    chunks: list[str] = []
    current = ""
    for para in text.split("\n\n"):
        if len(para) > max_len:
            if current:
                chunks.append(current.strip())
                current = ""
            for i in range(0, len(para), max_len):
                chunks.append(para[i : i + max_len])
            continue
        candidate = f"{current}\n\n{para}".strip() if current else para
        if len(candidate) <= max_len:
            current = candidate
        else:
            if current:
                chunks.append(current.strip())
            current = para
    if current:
        chunks.append(current.strip())
    return chunks


async def _synthesize_chunk(text: str, output: Path, voice: str) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output))


def _concat_mp3(files: list[Path], output: Path) -> None:
    list_file = output.parent / f".concat_{output.stem}.txt"
    try:
        with open(list_file, "w", encoding="utf-8") as f:
            for p in files:
                f.write(f"file '{p.resolve()}'\n")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c",
                "copy",
                str(output),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        if list_file.exists():
            list_file.unlink()


async def synthesize_speech(text: str, output_path: Path, voice: str = DEFAULT_VOICE) -> bool:
    chunks = split_text(text)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if len(chunks) == 1:
        await _synthesize_chunk(chunks[0], output_path, voice)
        return output_path.exists()

    temp_files: list[Path] = []
    try:
        for i, chunk in enumerate(chunks):
            tmp = output_path.parent / f".tmp_{output_path.stem}_{i}.mp3"
            await _synthesize_chunk(chunk, tmp, voice)
            temp_files.append(tmp)
        _concat_mp3(temp_files, output_path)
        return output_path.exists()
    finally:
        for f in temp_files:
            if f.exists():
                f.unlink()


def generate_audio(
    meta: dict,
    lesson_md: str,
    date_str: str,
    voice: str = DEFAULT_VOICE,
) -> bool:
    """生成指定日期的语音讲解与歌词朗读，返回是否成功"""
    script = build_narration_script(meta, lesson_md)
    output_mp3 = AUDIO_DIR / f"{date_str}.mp3"
    output_txt = AUDIO_DIR / f"{date_str}.txt"

    ok = False
    try:
        ok = asyncio.run(synthesize_speech(script, output_mp3, voice))
        if ok:
            output_txt.write_text(script, encoding="utf-8")
            print(f"✓ 已生成语音讲解 docs/audio/{date_str}.mp3")
    except Exception as e:
        print(f"⚠ 语音讲解生成失败: {e}")

    line_ok = generate_line_audio(meta, lesson_md, date_str)
    return ok or line_ok


def audio_exists(date_str: str) -> bool:
    return (AUDIO_DIR / f"{date_str}.mp3").exists()


def render_audio_player(date_str: str, base_path: str = "audio") -> str:
    """生成 HTML 音频播放器片段"""
    if not audio_exists(date_str):
        return ""
    src = f"{base_path}/{date_str}.mp3"
    return f"""
<div class="audio-section">
  <p class="audio-label">🎧 语音讲解</p>
  <p class="audio-hint">开车或通勤时可听，跟着讲解过一遍今日歌曲</p>
  <div class="audio-player-wrap">
    <audio id="audio-{date_str}" controls class="audio-player" preload="metadata" src="{src}">
      您的浏览器不支持音频播放
    </audio>
    <div class="playback-speed">
      <span class="speed-label">速度</span>
      <button type="button" class="speed-btn" onclick="setSpeed('{date_str}', 0.75)">0.75x</button>
      <button type="button" class="speed-btn active" onclick="setSpeed('{date_str}', 1)">1x</button>
      <button type="button" class="speed-btn" onclick="setSpeed('{date_str}', 1.25)">1.25x</button>
      <button type="button" class="speed-btn" onclick="setSpeed('{date_str}', 1.5)">1.5x</button>
    </div>
  </div>
</div>"""


AUDIO_SCRIPT_JS = """
function setSpeed(dateStr, rate) {
  var audio = document.getElementById('audio-' + dateStr);
  if (!audio) return;
  audio.playbackRate = rate;
  var wrap = audio.closest('.audio-player-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('.speed-btn').forEach(function(btn) {
    btn.classList.remove('active');
    if (parseFloat(btn.textContent) === rate) btn.classList.add('active');
  });
}
"""


def load_history_entries() -> list[dict]:
    history_file = DATA / "history.json"
    if not history_file.exists():
        return []
    import json

    with open(history_file, encoding="utf-8") as f:
        return json.load(f).get("entries", [])


def find_lesson_path(entry: dict) -> Path | None:
    file_path = entry.get("file", "")
    if not file_path:
        return None
    path = DOCS / file_path
    return path if path.exists() else None


def generate_audio_for_entry(entry: dict, voice: str = DEFAULT_VOICE) -> bool:
    date_str = entry.get("date", "")
    lesson_path = find_lesson_path(entry)
    if not date_str or not lesson_path:
        print(f"⚠ 找不到 {date_str} 的精讲文件")
        return False
    lesson_md = lesson_path.read_text(encoding="utf-8")
    return generate_audio(entry, lesson_md, date_str, voice=voice)


def main() -> None:
    from argparse import ArgumentParser

    parser = ArgumentParser(description="生成歌词精讲语音讲解")
    parser.add_argument("--date", type=str, help="日期 YYYY-MM-DD")
    parser.add_argument("--all", action="store_true", help="为全部历史记录生成音频")
    parser.add_argument("--voice", type=str, default=DEFAULT_VOICE, help="TTS 语音")
    parser.add_argument("--print-script", action="store_true", help="只打印旁白稿，不生成音频")
    parser.add_argument("--lines-only", action="store_true", help="仅生成歌词朗读 MP3")
    args = parser.parse_args()

    if args.all:
        entries = load_history_entries()
        ok_count = 0
        line_count = 0
        for entry in entries:
            if args.print_script:
                lesson_path = find_lesson_path(entry)
                if lesson_path:
                    print(build_narration_script(entry, lesson_path.read_text(encoding="utf-8")))
                    print("\n" + "=" * 40 + "\n")
                continue
            lesson_path = find_lesson_path(entry)
            if not lesson_path:
                continue
            lesson_md = lesson_path.read_text(encoding="utf-8")
            date_str = entry.get("date", "")
            if args.lines_only:
                if generate_line_audio(entry, lesson_md, date_str):
                    line_count += 1
                continue
            if generate_audio(entry, lesson_md, date_str, voice=args.voice):
                ok_count += 1
        if args.lines_only:
            print(f"✓ 完成 {line_count}/{len(entries)} 条歌词朗读")
        elif not args.print_script:
            print(f"✓ 完成 {ok_count}/{len(entries)} 条语音讲解")
        return

    if not args.date:
        parser.error("请指定 --date 或 --all")

    entry = next((e for e in load_history_entries() if e.get("date") == args.date), None)
    if not entry:
        print(f"找不到 {args.date} 的学习记录")
        sys.exit(1)

    lesson_path = find_lesson_path(entry)
    if not lesson_path:
        print(f"找不到精讲文件：{entry.get('file')}")
        sys.exit(1)

    lesson_md = lesson_path.read_text(encoding="utf-8")
    if args.print_script:
        print(build_narration_script(entry, lesson_md))
        return

    ok = generate_audio(entry, lesson_md, args.date, voice=args.voice)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
