# Daily Lyric Learning — Automation Instructions

你是「每日英文歌词学习」项目的自动化 agent。每次运行时按以下步骤执行。

---

## Step 0: 同步 main 分支（必须）

**目标：每次运行都直接合并到 `main`，触发 GitHub Pages 自动部署。**

```bash
git fetch origin main
git checkout main
git pull origin main
```

- 如果当前在 feature 分支，先切到 main 并拉取最新代码
- **不要**在 feature 分支上积累多天内容后再合并
- 推送目标始终是 `main`：

```bash
git push origin main
```

### 同一天重复运行

1. 读取 `data/history.json`
2. 若 `entries[0].date` 等于今天（`YYYY-MM-DD`），**跳过生成**，不要重复写入

---

## Step 1: 选歌

1. 读取 `data/songs.json`（50 首曲库）和 `data/history.json`（已学记录）
2. 从曲库中**随机**选取一首**尚未学习过**的歌曲
3. 如果全部学完，重置 `history.json` 的 `entries` 为空数组并重新开始
4. 读取 `data/artists.json` 获取艺人信息

---

## Step 2: 生成精讲

1. 读取 `prompts/lyric-learning-prompt.md` 作为教学模板
2. 将「今日歌曲」替换为：`{艺人名} - {歌曲名}`
3. 按照模板的全部 7 个章节，生成完整的 Markdown 精讲内容
4. 内容必须包含：创作背景、制作分析、逐句精讲、短语总结、节奏指南、跟读句、检测题、推荐链

### Prompt 适应性修改指南

只需修改 `prompts/lyric-learning-prompt.md`，**不要改** `data/songs.json` 和 `data/artists.json`（除非用户明确要求扩曲库）。

| 想调整的内容 | 修改位置 | 示例 |
|-------------|---------|------|
| 讲解风格/语气 | 模板开头「角色」段落 | 更幽默 / 更学术 |
| 章节结构 | 「任务要求」各章节 | 增加「发音对比」章节 |
| 逐句精讲维度 | 「二、逐句精讲」字段 | 增加「同义词替换」 |
| 检测题数量 | 「六、今日学习检测」 | 3 道 → 5 道 |
| 推荐链逻辑 | 「七、歌曲推荐链」 | 按难度递进而非情绪 |
| 艺人库说明 | 「可选艺人库」 | 更新某位艺人的学习重点 |
| 敏感词规则 | 「额外要求」 | 增加标注类型 |

**修改原则：**

- 保持 Markdown 标题层级稳定（`## 一、…` 到 `## 七、…`），网站目录依赖 h2 解析
- 检测题格式保持 blockquote 结构，以便网站「显示答案」按钮正常工作：

```markdown
> **1. 中文**：我以为她会放弃，但我大错特错。
> **答案**：I thought she'd give up, but I was dead wrong.
```

- 逐句精讲标签保持 `**▸ 原句**` 格式，网站会自动渲染为卡片
- front matter 字段名不要改（`date`, `artist`, `artistName`, `title`, `slug`）

---

## Step 3: 写入文件

1. 获取今天日期（格式 `YYYY-MM-DD`）
2. 创建文件 `entries/{date}-{slug}.md`

```markdown
---
date: 2026-06-14
artist: frank-ocean
artistName: Frank Ocean
title: Pink + White
slug: frank-ocean-pink-white
---
```

3. 更新 `data/history.json`，在 `entries` 数组**头部**插入：

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

---

## Step 4: 提交并推送到 main

```bash
git add entries/ data/history.json
git commit -m "Daily: {artistName} - {title} ({date})"
git push origin main
```

推送后 GitHub Actions 会自动部署到 GitHub Pages。

### 如果只能推送到 feature 分支

部分 Cursor Automation 环境会创建临时分支。此时：

```bash
git push -u origin HEAD
```

然后创建 PR 到 `main`。仓库已配置 `.github/workflows/auto-merge-daily.yml`，标题以 `Daily:` 开头的 PR 会自动 squash 合并到 main。

**Agent 不要手动 merge**——推送 PR 即可，CI 会自动处理。

---

## 注意事项

- 不要修改 `data/songs.json` 和 `data/artists.json`（除非用户明确要求）
- 精讲内容用中文，歌词原文保留英文
- 词汇音标用 IPA 美式
- 敏感表达用 ⚠️ 标注
- 若同时修改网站代码（`index.html`, `assets/`），可单独 commit，或与 Daily commit 分开
