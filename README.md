# Daily Lyric Learning

从 10 位 Alternative R&B 艺人的歌词中，每日学习地道英文表达。

## 概述

基于 Cursor Automations 的全自动英文歌词学习网站，每天早上 8:00 随机选歌并生成逐句精讲，部署到 GitHub Pages。

## 项目结构

```
daily-lyric-learning/
├── docs/                       # GitHub Pages 根目录
│   ├── index.html              # 主页
│   ├── .nojekyll
│   ├── assets/
│   │   ├── app.js
│   │   ├── style.css
│   │   └── lessons/            # 每日 Markdown 精讲
│   └── data/                   # 前端运行时数据（由 scripts 同步）
├── data/                       # 数据源（脚本读写）
│   ├── artists.json
│   ├── songs.json
│   ├── history.json
│   └── qishui-tracks.json
├── scripts/
│   ├── generate.py             # 主生成脚本（选题 + history + 同步 docs）
│   ├── generate_audio.py       # edge-tts 语音讲解生成
│   └── qishui.py               # 汽水音乐缓存查找
├── requirements.txt            # edge-tts 等 Python 依赖
├── prompts/
│   ├── lyric-learning-prompt.md
│   └── qishui-lookup.md
├── .cursor/automations/
│   ├── daily-trigger.txt       # Automation 触发语（一行）
│   └── daily-prompt.md         # Agent 完整执行步骤
└── .github/workflows/          # GitHub Pages 部署
```

与 `daily-algo` 一致：`data/` 放数据源，`docs/` 放网站，`scripts/` 负责生成与同步。

## 使用方式

### 本地预览

```bash
cd ~/Projects/daily-lyric-learning
python3 -m http.server 8080 --directory docs
# 打开 http://localhost:8080
```

### 本地生成

```bash
# 选题并写入 .daily/context.json
python3 scripts/generate.py --prepare

# 预览选题（不写入）
python3 scripts/generate.py --prepare --dry-run

# 查看今日是否已生成
python3 scripts/generate.py --status

# 列出曲库
python3 scripts/generate.py --list

# Agent 写完精讲后，更新 history 并同步 docs/data/（含语音讲解）
python3 scripts/generate.py --finalize

# 跳过语音生成
python3 scripts/generate.py --finalize --skip-audio

# 单独生成语音讲解
python3 scripts/generate_audio.py --date=2026-06-28
python3 scripts/generate_audio.py --all

# 仅同步 data/ → docs/data/
python3 scripts/generate.py --sync
```

### 语音讲解

与 `daily-algo` 一致，使用 **edge-tts** 生成中文旁白 MP3，保存在 `docs/audio/{date}.mp3`。网页内置播放器，支持 0.75x–1.5x 变速；精讲页面每句歌词另有 🔊 按钮（Web Speech API 朗读英文原句）。

依赖安装：

```bash
pip install -r requirements.txt   # edge-tts
# ffmpeg 用于合并长音频片段（系统包管理器安装）
```

### Cursor Automation（推荐）

1. 创建 Automation，cron: `0 8 * * *`
2. **Prompt 仅填一行**（与 daily-algo 一致）：

   ```
   读取 .cursor/automations/daily-prompt.md 并严格执行其中的所有步骤。
   ```

3. 完整步骤见 `.cursor/automations/daily-prompt.md`

Agent 执行流程：
1. `python3 scripts/generate.py --prepare` — 自动选题
2. 按模板生成精讲 Markdown（LLM）
3. `python3 scripts/generate.py --finalize` — 更新 history + 同步 docs
4. `git push origin main`

GitHub Actions 自动部署 `docs/` 到 GitHub Pages。

## 部署到 GitHub Pages

进入仓库 **Settings → Pages** → Source 选择 **GitHub Actions**。

网站地址：`https://<你的用户名>.github.io/daily-lyric-learning/`

## 艺人库

dvsn · 6LACK · Bryson Tiller · Frank Ocean · Daniel Caesar · H.E.R. · Gallant · Emotional Oranges · Jhené Aiko · Sampha
