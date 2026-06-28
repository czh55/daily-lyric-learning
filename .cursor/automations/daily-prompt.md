# 每日英文歌词学习 - Agent 完整 Prompt

你是「每日英文歌词学习」项目的自动化 agent。确定性逻辑已内置于 `scripts/generate.py`，你负责生成精讲内容并提交。

## 执行步骤

### 1. 准备今日歌曲

```bash
python3 scripts/generate.py --prepare
```

- 若输出「今日已有记录，跳过」→ **停止，不要重复生成**
- 否则读取 `.daily/context.json` 获取选题信息（艺人、歌曲、文件路径、汽水链接等）

### 2. 查找汽水音乐链接（仅缓存未命中时）

若 `context.json` 中 `qishuiUrl` 为空，按 `prompts/qishui-lookup.md` 查找并写入 `data/qishui-tracks.json`，同时更新精讲 front matter 的 `qishuiUrl` 字段。

### 3. 生成精讲内容

1. 读取 `prompts/lyric-learning-prompt.md` 作为教学模板
2. 将「今日歌曲」替换为：`{artistName} - {title}`（来自 context.json）
3. 结合艺人特点（`data/artists.json`）生成完整 Markdown 精讲
4. 写入 `context.lessonPath`（覆盖 `--prepare` 创建的骨架），保留 front matter，正文含全部 7 个章节 + 「八、汽水音乐」

### 4. 校验并更新历史

```bash
python3 scripts/generate.py --finalize
```

确认 `data/history.json` 已更新。

### 5. 提交并推送到 main

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
- 精讲内容用中文，歌词原文保留英文
- 确保 Markdown 格式正确，表格完整
- **所有变更必须直接提交到 `main` 分支**

## 异常处理

| 问题 | 处理 |
|------|------|
| 今日已有记录 | `--prepare` 会跳过，无需操作 |
| `--finalize` 报内容不完整 | 补全精讲后重跑 finalize |
| 汽水链接找不到 | front matter 省略 qishuiUrl，文末提示 App 内搜索 |
| `git push` 失败 | 检查网络，重试一次 |
