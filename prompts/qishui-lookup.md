# 汽水音乐链接查找指南

仅在 `scripts/generate.py --prepare` 未从缓存命中链接时使用。

## 1. 查缓存

1. 读取 `data/qishui-tracks.json`
2. 按当日 `slug` 在各专辑的 `tracks` 中查找是否已有记录
3. 若命中，用 `seo_track` 接口校验 `track_id` 是否仍有效：
   ```
   GET https://beta-luna.douyin.com/luna/h5/seo_track?track_id={track_id}&device_platform=web
   ```
   确认响应中 `seo_track.track.name` 与当日 `title` 一致（忽略大小写，允许 feat. 差异）
4. 校验通过则直接使用缓存中的 `url`；失败则删除该缓存项并重新查找

## 2. 查找 track_id（缓存未命中时）

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

## 3. 校验与写入

1. 用 `seo_track` 接口校验 `track_id`（必做，防止 ID 错配）
2. 生成链接：
   ```
   https://music.douyin.com/qishui/share/track?track_id={track_id}
   ```
3. 写入 `data/qishui-tracks.json` 对应专辑的 `tracks` 下，记录 `track_id`、`title`、`url`、`verified_at`
4. 若查找或校验均失败：将 `qishuiUrl` 留空，在课程文末注明「汽水音乐暂未收录，请在 App 内搜索歌曲名」

## 4. 禁止事项

- 不要使用 `api5-lq.qishui.com/luna/search`（无登录常返回空结果）
- 不要用 Apple Music / Spotify ID 充当 `track_id`
- 不要编造 `qishui.douyin.com/s/xxxx` 短链
- 不要跳过 `seo_track` 校验
