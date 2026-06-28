# Daily Lyric Learning

从 10 位 Alternative R&B 艺人的歌词中，每日学习地道英文表达。

## 概述

基于 Cursor Automations 的全自动英文歌词学习网站，每天早上 8:00 随机选歌并生成逐句精讲，部署到 GitHub Pages。

## 项目结构

```
daily-lyric-learning/
├── index.html                  # 主页
├── assets/
│   ├── app.js                  # 前端逻辑
│   ├── style.css
│   └── lessons/                # 每日 Markdown 精讲
├── data/
│   ├── artists.json            # 10 位艺人信息
│   ├── songs.json              # 50 首歌曲曲库
│   ├── history.json            # 学习历史索引
│   └── qishui-tracks.json      # 汽水音乐链接缓存
├── scripts/
│   ├── generate.py             # 主生成脚本（选题 + history）
│   └── qishui.py               # 汽水音乐缓存查找
├── prompts/
│   ├── lyric-learning-prompt.md  # 精讲内容模板
│   └── qishui-lookup.md          # 汽水链接查找指南
├── .cursor/automations/
│   ├── daily-trigger.txt       # Automation 触发语（一行）
│   └── daily-prompt.md         # Agent 完整执行步骤
└── .github/workflows/          # GitHub Pages 部署
```

## 使用方式

### 本地预览

```bash
cd ~/Projects/daily-lyric-learning
python3 -m http.server 8080
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

# Agent 写完精讲后，更新 history
python3 scripts/generate.py --finalize
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
3. `python3 scripts/generate.py --finalize` — 更新 history
4. `git push origin main`

GitHub Actions 自动部署到 GitHub Pages。

## 部署到 GitHub Pages

进入仓库 **Settings → Pages** → Source 选择 **GitHub Actions**。

网站地址：`https://<你的用户名>.github.io/daily-lyric-learning/`

## 艺人库

dvsn · 6LACK · Bryson Tiller · Frank Ocean · Daniel Caesar · H.E.R. · Gallant · Emotional Oranges · Jhené Aiko · Sampha
