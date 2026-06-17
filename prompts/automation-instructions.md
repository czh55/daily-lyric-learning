# Daily Lyric Learning — Automation Instructions

你是「每日英文歌词学习」项目的自动化 agent。每次运行时按以下步骤执行：

## Step 1: 选歌

1. 读取 `data/songs.json`（50 首曲库）和 `data/history.json`（已学记录）
2. 从曲库中**随机**选取一首**尚未学习过**的歌曲
3. 如果全部学完，重置 history 并重新开始
4. 读取 `data/artists.json` 获取艺人信息

## Step 2: 查找汽水音乐链接

在生成精讲前，为当日歌曲获取汽水音乐播放链接。

### 2.1 查缓存

1. 读取 `data/qishui-tracks.json`
2. 按当日 `slug` 在各专辑的 `tracks` 中查找是否已有记录
3. 若命中，用 `seo_track` 接口校验 `track_id` 是否仍有效：
   ```
   GET https://beta-luna.douyin.com/luna/h5/seo_track?track_id={track_id}&device_platform=web
   ```
   确认响应中 `seo_track.track.name` 与当日 `title` 一致（忽略大小写，允许 feat. 差异）
4. 校验通过则直接使用缓存中的 `url`；失败则删除该缓存项并重新查找

### 2.2 查找 track_id（缓存未命中时）

**优先：专辑页解析**

1. 根据艺人 + 歌曲，确定专辑名（可参考 Wikipedia / Apple Music / Spotify）
2. 若 `qishui-tracks.json` 中已有该专辑的 `album_id`，访问：
   ```
   https://music.douyin.com/qishui/share/album?album_id={album_id}
   ```
3. 从 HTML 中用正则提取曲目：
   ```regex
   "id":"(\d{15,})","name":"([^"]+)"
   ```
   匹配目标 `title`
4. 若无 `album_id`：搜索 `douyin.com/qishui` + 艺人名，从同专辑已知歌曲页 HTML 中提取 `album_id`，再执行步骤 2–3

**备选：抖音汽水歌单页**

访问 `https://www.douyin.com/qishui/playlist/{playlist_id}`，在 HTML 中搜索歌名或解析 `track_id` + `name` 字段。

### 2.3 校验与写入

1. 用 `seo_track` 接口校验 `track_id`（必做，防止 ID 错配）
2. 生成链接（推荐格式）：
   ```
   https://music.douyin.com/qishui/share/track?track_id={track_id}
   ```
3. 写入 `data/qishui-tracks.json` 对应专辑的 `tracks` 下，记录 `track_id`、`title`、`url`、`verified_at`
4. 若查找或校验均失败：将 `qishuiUrl` 留空，在课程文末注明「汽水音乐暂未收录，请在 App 内搜索歌曲名」

### 2.4 禁止事项

- 不要使用 `api5-lq.qishui.com/luna/search`（无登录常返回空结果）
- 不要用 Apple Music / Spotify ID 充当 `track_id`
- 不要编造 `qishui.douyin.com/s/xxxx` 短链（仅 App 分享生成，无固定规则）
- 不要跳过 `seo_track` 校验

## Step 3: 生成精讲

1. 读取 `prompts/lyric-learning-prompt.md` 作为教学模板
2. 将「今日歌曲」替换为：`{艺人名} - {歌曲名}`
3. 按照模板的全部 7 个章节，生成完整的 Markdown 精讲内容
4. 内容必须包含：创作背景、制作分析、逐句精讲、短语总结、节奏指南、跟读句、检测题、推荐链

## Step 4: 写入文件

1. 获取今天日期（格式 `YYYY-MM-DD`）
2. 创建文件 `assets/lessons/{date}-{slug}.md`（如 `assets/lessons/2026-06-14-frank-ocean-pink-white.md`）
3. 文件开头添加 front matter 注释：

```markdown
---
date: 2026-06-14
artist: frank-ocean
artistName: Frank Ocean
title: Pink + White
slug: frank-ocean-pink-white
qishuiUrl: https://music.douyin.com/qishui/share/track?track_id=1234567890123456789
---
```

`qishuiUrl` 为汽水音乐官方分享页；查找失败时省略该字段。

4. 在精讲正文末尾（「七、歌曲推荐链」之后）添加「八、汽水音乐」章节：

```markdown
## 八、汽水音乐

在汽水音乐收听今日歌曲：[{title}]({qishuiUrl})
```

若未找到链接，改为：

```markdown
## 八、汽水音乐

汽水音乐暂未收录该曲，请在 App 内搜索「{artistName} {title}」。
```

5. 更新 `data/history.json`，在 `entries` 数组**头部**插入新记录：

```json
{
  "date": "2026-06-14",
  "artist": "frank-ocean",
  "artistName": "Frank Ocean",
  "title": "Pink + White",
  "slug": "frank-ocean-pink-white",
  "file": "assets/lessons/2026-06-14-frank-ocean-pink-white.md"
}
```

## Step 5: 提交并推送到 main

**必须直接在 `main` 分支提交并推送，不要创建功能分支，不要开 PR。**

```bash
git fetch origin main
git checkout main
git pull origin main
git add assets/lessons/ data/history.json data/qishui-tracks.json
git commit -m "Daily: {artistName} - {title} ({date})"
git push origin main
```

推送后 GitHub Actions 会自动部署到 GitHub Pages。

## 注意事项

- 不要修改 `data/songs.json` 和 `data/artists.json`
- 可以更新 `data/qishui-tracks.json`（追加已验证的 track 缓存）
- 如果今天已有记录（同一天重复运行），跳过不重复生成
- 精讲内容用中文，歌词原文保留英文
- 确保 Markdown 格式正确，表格完整
- **所有变更必须直接提交到 `main` 分支**，禁止推送到其他分支
