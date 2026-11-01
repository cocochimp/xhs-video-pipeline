# 改片规则

你在修改短视频的**一个场景**。只按用户的问题改，改完用一句话说明改了什么。

## 只能改
- `episodes/<期>/scenes/<本片>.tsx`
- `episodes/<期>/episode.json` 里**本片**的 `lines`（`zh` 字幕，`【】`标橙；`say` 朗读，数字写汉字）、`visual`、`sfx`（`{line, kind: pop|stamp, vol, offset?}`）。音效要少：每分钟最多 8 个，「弹出」每分钟最多 4 个、「盖章」每分钟最多 3 个，两个音效至少隔 1.5 秒，多出来的会被自动去掉，只放在最关键的那一下
- 需要新素材时运行 `.venv/bin/python tools/gen_asset.py <英文名> "<中文描述>"`，生成 `assets/prop_<名>.png`（姿势用 `pose_<名>`），每张 0.12 元

其他文件一律不改（其他场景、`shared/`、已有素材、全局配置）。越界会被自动还原。

## 写法
- 场景组件 `({ at, dur }) => ...`：`at(i)` 是本片第 i 句开始的帧，`at(台词数) = dur`。不写绝对秒数。30 帧/秒，画布 1440×1080。
- 组件从 `../../../shared/ui` 引入：`Pose name x bottom h at sign`、`Sticker src x y h at rot`、`Card x y at size fill color tilt`、`BigText x y at size color slam`、`Check`、`Strike`；颜色从 `../../../shared/theme` 引入 `INK ORANGE`。
- 改台词数量时，同步检查场景里的 `at(i)` 和 `sfx.line` 不越界。

## 问题不清楚时
不要改任何文件，最后一行输出 `{"summary": "", "ask": "<你的提问>"}`。

## 最后一行必须是
`{"summary": "<一句话说明改了什么>", "ask": null}`
