# 手绘口播视频半自动流水线 — 设计

目标：复刻「小明的账本」类账号的视频 SOP —— 一句口播一张手绘插画、固定主角、4:3 横版纸张模板、顶部标题条、底部中英双语字幕、AI 配音。

## 流程

```
storyboard.json（Claude 写稿 + 分镜）      ← 人工检查点 1：改稿
  └─ character  ：Seedream 文生图 → 角色设定图 character.jpg（锁定主角）
  └─ images     ：Seedream 图生图（带角色参考图）→ shots/NN.jpg  ← 人工检查点 2：挑图/单张重画
  └─ tts        ：edge-tts 整段合成 narration.mp3 + 每句时间戳 timings.json
  └─ compose    ：Pillow 套模板出每帧 PNG → ffmpeg 按时间戳拼接 + 配音 → out/video.mp4、out/cover.jpg
```

所有步骤都可重复执行：已存在的产物默认跳过，`--force` 或删除单个文件即可重做该项（例如重画第 7 张：删 `shots/07.jpg` 后重跑 images）。

## 组件

| 文件 | 职责 |
|---|---|
| `pipeline.py` | 命令行入口：`python pipeline.py <项目目录> {character,images,tts,compose,all}` |
| `projects/<slug>/storyboard.json` | 单条视频的全部输入：标题、角色设定、画风、配音音色、分镜列表 |
| `~/.config/xhs-video/.env` | `ARK_API_KEY`、`ARK_BASE_URL`（不进项目目录） |

### storyboard.json

```json
{
  "title": "顶部标题条文字",
  "voice": "zh-CN-XiaoxiaoNeural",
  "rate": "+8%",
  "style": "画风描述（所有图共用）",
  "character": "主角外观描述（所有图共用）",
  "shots": [
    {"text": "口播/中文字幕，一句，以。？！结尾", "en": "英文字幕", "keyword": "插画上方手写小标题", "scene": "画面内容"}
  ]
}
```

## 关键决策

- **生图**：火山方舟 `doubao-seedream-5-0-pro-260628`，2048×1536（4:3）。先出角色设定图，之后每张都把它作为参考图传入，保证主角一致。手写小标题由模型直接画进插画（系统无手写字体），出图后人工核对字形。
- **配音**：edge-tts 免费音色，**整段一次合成**（逐句拼接会在句尾卡顿），用 SentenceBoundary 时间戳把每句对齐到对应画面。后续可替换为火山/MiniMax 克隆音色，接口只需产出 `narration.mp3 + timings.json`。
- **合成**：Pillow 画模板（纸张底色 + 彩色短线边框 + 蓝色描边标题 + 双语字幕），插画用正片叠底贴到纸面上，去掉白底；ffmpeg concat 输出 H.264/AAC 30fps（优先用系统 ffmpeg，没有时用 imageio-ffmpeg 自带的二进制）。
- **英文字幕**：写稿时由 Claude 一并给出人工质量翻译，不用机翻。

## 错误处理

- 生图失败：单张重试 2 次，仍失败则记录并继续其余镜头，最后汇总失败列表；compose 前检查所有镜头图存在。
- 时间戳对齐：按句累加匹配文本长度；对不上时退回按字数比例分配时长，并打印警告。

## 验证

第一条样片：《工资到手，先做这 3 件事》，14 个镜头，约 70 秒。检查项：主角一致性、手写字正确、音画同步、字幕不溢出、成片可在小红书正常播放（H.264 + yuv420p）。
