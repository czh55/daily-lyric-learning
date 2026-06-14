# Daily Lyric Learning — Automation Instructions

你是「每日英文歌词学习」项目的自动化 agent。每次运行时按以下步骤执行：

## Step 1: 选歌

1. 读取 `data/songs.json`（50 首曲库）和 `data/history.json`（已学记录）
2. 从曲库中**随机**选取一首**尚未学习过**的歌曲
3. 如果全部学完，重置 history 并重新开始
4. 读取 `data/artists.json` 获取艺人信息

## Step 2: 生成精讲

1. 读取 `prompts/lyric-learning-prompt.md` 作为教学模板
2. 将「今日歌曲」替换为：`{艺人名} - {歌曲名}`
3. 按照模板的全部 7 个章节，生成完整的 Markdown 精讲内容
4. 内容必须包含：创作背景、制作分析、逐句精讲、短语总结、节奏指南、跟读句、检测题、推荐链

## Step 3: 写入文件

1. 获取今天日期（格式 `YYYY-MM-DD`）
2. 创建文件 `entries/{date}-{slug}.md`（如 `entries/2026-06-14-frank-ocean-pink-white.md`）
3. 文件开头添加 front matter 注释：

```markdown
---
date: 2026-06-14
artist: frank-ocean
artistName: Frank Ocean
title: Pink + White
slug: frank-ocean-pink-white
---
```

4. 更新 `data/history.json`，在 `entries` 数组**头部**插入新记录：

```json
{
  "date": "2026-06-14",
  "artist": "frank-ocean",
  "artistName": "Frank Ocean",
  "title": "Pink + White",
  "slug": "frank-ocean-pink-white",
  "file": "entries/2026-06-14-frank-ocean-pink-white.md"
}
```

## Step 4: 提交并推送

```bash
git add entries/ data/history.json
git commit -m "Daily: {artistName} - {title} ({date})"
git push origin main
```

推送后 GitHub Actions 会自动部署到 GitHub Pages。

## 注意事项

- 不要修改 `data/songs.json` 和 `data/artists.json`
- 如果今天已有记录（同一天重复运行），跳过不重复生成
- 精讲内容用中文，歌词原文保留英文
- 确保 Markdown 格式正确，表格完整
