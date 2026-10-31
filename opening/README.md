# 开头复刻（Remotion）

复刻「小明的账本」最新视频开头的三段结构：品牌片头 → 往期封面快闪 + 本期标题卡 → 蓝色方格模板动画。

```bash
../.venv/bin/python make_assets.py      # 素材：4 张 flash 图 → 自动切成姿势/道具/封面/标题卡（约 0.5 元）
../.venv/bin/python make_timeline.py    # 台词 + 配音 + 逐字时间轴（台词改这里的 SEGMENTS / MARKS）
npx remotion studio src/index.ts        # 浏览器里实时预览、拖时间轴
npx remotion render src/index.ts Opening out/opening.mp4
```

| 文件 | 内容 |
|---|---|
| `src/Intro.tsx` | 品牌片头（姿势切换、道具飞入、纸张炸开、发光大字）、封面快闪、圆形转场标题卡 |
| `src/Main.tsx` | 蓝色方格模板：卡片弹出/飞走、逐字标题 + 黄色马克笔高亮、打勾、盖章、暗场大字 |
| `src/Subtitles.tsx` | 片头卡拉 OK 逐字字幕（关键词橙色 + 光标）；正片中英双语字幕 |
| `public/timeline.json` | 由 make_timeline.py 生成，动画触发点都对齐到具体的字 |
