# 手绘口播视频流水线（SOP）

一句口播 = 一张手绘插画，固定主角，4:3 纸张模板 + 蓝色标题条 + 中英双语字幕 + AI 配音。设计说明见 `docs/design.md`。

## 环境（已配好）

- 生图：火山方舟 Seedream 5.0 pro，key 在 `~/.config/xhs-video/.env`（`ARK_API_KEY`）
- 配音：edge-tts（免费）
- 合成：Pillow + ffmpeg（系统没装 ffmpeg 时自动用 `imageio-ffmpeg` 自带的）
- Python 环境：`.venv/`

## 做一条新视频

1. **写稿**（人工检查点 1）：在 Claude Code 里说「按 projects/payday-3-things/storyboard.json 的格式，写一条《xxx》的分镜」，
   生成 `projects/<slug>/storyboard.json`。改到满意为止——每个镜头一句话，以。？！结尾。
2. **出图**：
   ```bash
   .venv/bin/python pipeline.py projects/<slug> character   # 角色设定图（换主角时才需要；同一个主角可直接复制 character.jpg）
   .venv/bin/python pipeline.py projects/<slug> images      # 每句一张，4 张并发
   ```
3. **挑图**（人工检查点 2）：看 `shots/*.jpg`，不满意的单张重画：`... images --only 3,7`。
4. **配音 + 合成**：
   ```bash
   .venv/bin/python pipeline.py projects/<slug> tts
   .venv/bin/python pipeline.py projects/<slug> compose
   ```
   产出 `out/video.mp4`（1440×1080）和 `out/cover.jpg`（1080×1440 封面）。

一次跑完：`.venv/bin/python pipeline.py projects/<slug> all`。已存在的产物会跳过，加 `--force` 全部重做。

## 可调项

| 想改什么 | 改哪里 |
|---|---|
| 主角 / 画风 | `storyboard.json` 的 `character` / `style`，然后 `character --force` |
| 配音音色 / 语速 | `voice`（如 `zh-CN-YunxiNeural` 男声）/ `rate` |
| 模板颜色、字号、版式 | `pipeline.py` 的 `paper_background` / `draw_title` / `draw_subtitles` |
| 生图模型 | `pipeline.py` 顶部 `IMAGE_MODEL` |

## 成本

Seedream 5.0 pro 每张 0.3–0.6 元。14 个镜头的 1 分钟视频约 5–9 元，配音和合成免费。
