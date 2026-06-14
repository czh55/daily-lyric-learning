# Daily Lyric Learning

从 10 位 Alternative R&B 艺人的歌词中，每日学习地道英文表达。

## 功能

- **每日推荐**：Cursor Automation 每天早上 8:00 随机选歌并生成逐句精讲
- **历史查看**：GitHub Pages 网站展示所有学习记录，支持按艺人筛选和搜索
- **50 首曲库**：10 位艺人 × 5 首经典曲目

## 本地预览

```bash
cd ~/Projects/daily-lyric-learning
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 部署到 GitHub Pages

### 1. 创建 GitHub 仓库

在 GitHub 上新建仓库 `daily-lyric-learning`（Public），然后：

```bash
cd ~/Projects/daily-lyric-learning
git add .
git commit -m "Initial setup: GitHub Pages site and song catalog"
git remote add origin https://github.com/<你的用户名>/daily-lyric-learning.git
git branch -M main
git push -u origin main
```

### 2. 启用 GitHub Pages

进入仓库 **Settings → Pages**：
- Source 选择 **GitHub Actions**
- 推送后 Actions 会自动部署

网站地址：`https://<你的用户名>.github.io/daily-lyric-learning/`

### 3. 创建 Cursor Automation

在 Cursor 中打开 Automations，创建定时自动化：

| 配置项 | 值 |
|--------|-----|
| 名称 | Daily Lyric Learning |
| 触发 | 每天 8:00（cron: `0 8 * * *`） |
| 仓库 | 你的 `daily-lyric-learning` 仓库，main 分支 |
| 工具 | Git push（需要 Cloud Agent 权限） |

自动化指令见 `prompts/automation-instructions.md`。

## 目录结构

```
daily-lyric-learning/
├── index.html              # 主页
├── assets/                 # 样式和脚本
├── data/
│   ├── artists.json        # 10 位艺人信息
│   ├── songs.json          # 50 首歌曲曲库
│   └── history.json        # 学习历史索引
├── entries/                # 每日生成的 Markdown 精讲
├── prompts/
│   ├── lyric-learning-prompt.md
│   └── automation-instructions.md
└── .github/workflows/      # GitHub Pages 部署
```

## 艺人库

dvsn · 6LACK · Bryson Tiller · Frank Ocean · Daniel Caesar · H.E.R. · Gallant · Emotional Oranges · Jhené Aiko · Sampha
