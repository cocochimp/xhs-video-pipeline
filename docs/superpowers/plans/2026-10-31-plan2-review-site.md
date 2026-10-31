# 计划 2：审片网站

**Goal:** 逐片审片：用户对某个场景写一句问题 → 后台 Claude Code 只改这一片 → 浏览器预览立即更新 → 通过 / 撤销。全部通过后渲染整期。

**Architecture:** 一个进程：`npm run studio` 启动 Vite（端口 4100）。Vite 插件提供 `/api/*`，并串行执行任务队列；每个任务调用 Python `studio/edit.py`。改片逻辑全部在 Python 里（可用 pytest 测）。前端 React + `@remotion/player` 直接 import `episodes/index.ts`，场景文件被改后靠 Vite 热更新刷新预览。

**设计文档：** `docs/superpowers/specs/2026-10-31-review-site-design.md`。本计划不含新建一期的四步流程（计划 3）。

**执行方式：** 在 `main` 上直接做，主会话执行，每个任务跑测试后提交，最后统一审查一次。

---

### Task 1：配音按内容保存版本

撤销时恢复旧台词不能再付费重配，预览也不能被浏览器缓存的旧音频干扰。

- `tools/build_audio.py`：文件名改为 `vo_<段>_<hash>.mp3` / `words_<段>_<hash>.json`。缓存命中 = 对应 hash 的两个文件都存在。旧版本文件保留。
- `build()` 返回 `(timeline, billed, revoiced)`，`revoiced` 是本次实际合成的段名列表。CLI 用法不变。
- `shared/Episode.tsx`：音频路径用 `timeline.segments[id].hash`。
- `tools/render.py` 跟着改返回值解包。
- 迁移 ep001：把现有 `vo_<段>.mp3` / `words_<段>.json` 按各自 `hash` 重命名，不重新合成。
- 测试：已有测试改成新文件名；新增「台词改了再改回来 → 第二次不合成、不计费」「`revoiced` 正确」。

### Task 2：改片的边界检查和备份（`studio/edit.py` 纯函数部分）

- `snapshot(root, ep_dir) -> dict[path, sha1]`：本期目录、`shared/`、`assets/`、`studio/config.json`。忽略 `audio/`、`history/`。
- `check_boundary(before, after, ep_before, ep_after, scene_id) -> list[str]`：返回违规说明。
  - 允许：`scenes/<scene_id>.tsx` 变化；`assets/` 新增文件（不允许改已有的）。
  - `episode.json` 只允许这一片的 `lines`、`visual`、`sfx` 变化，其他场景和顶层字段（`cost` 除外）必须完全一致。
  - 其他任何文件变化都违规。
- `backup(ep_dir, scene_id) -> round_dir`：把 `scenes/<id>.tsx` 和 `episode.json` 复制到 `history/<id>/r<N>/`。`restore(round_dir, ep_dir, scene_id)`：拷回场景文件，`episode.json` 只恢复这一片的 `lines/visual/sfx`，保留 `rounds`、`status`、`cost`。
- 测试：`tests/test_edit.py` 覆盖越界改别的场景、改 `shared/`、改顶层字段、只改本片（通过）、新增素材（通过）、改已有素材（违规）、备份后恢复。

### Task 3：改片任务（`studio/edit.py run_edit`）

`python -m studio.edit <ep_dir> <scene_id> <issue>`，输出一行 JSON 结果。流程：

1. `backup` → `snapshot`，`episode.json` 中本片 `status=working`。
2. 调 Claude Code：`claude -p <prompt> --output-format json --permission-mode acceptEdits --allowedTools Read Edit Write "Bash(.venv/bin/python tools/gen_asset.py:*)"`，超时 300 秒。提示词 = `studio/rules.md` + 本片场景代码 + 本片台词和 `visual` + 本片时间 + 素材清单 + 用户问题。要求最后一行输出 `{"summary": "...", "ask": null|"问题"}`。
3. `check_boundary`。违规或超时：`restore`，`status=error`，记录原因。
4. 本片台词变了：`build_audio.build()`；同段其他已通过的场景加 `voiceUpdated: true`。
5. 检查：`npx tsc -p .`，然后渲染本片中间一帧到 `episodes/<id>/thumbs/<scene>.jpg`。失败则把错误交给 Claude 重试一次，仍失败就 `restore` 并设为 `error`。
6. 成功：`status=pending`、`updated=true`；`rounds` 追加 `{n, issue, summary, cost, at}`。`ask` 非空时设为 `asking`。单轮花费 > 1 元时追加 `costWarn=true`，照常完成。
- `claude` 调用可注入（`runner=` 参数），测试用假 runner 模拟正常修改、越界修改、超时、ask。
- `studio/rules.md`：可改什么、不可改什么、`at(i)` 用法、可用组件和素材、要新素材时调 `tools/gen_asset.py`。
- `tools/gen_asset.py <名字> "<描述>"`：flash 生成并抠图，写入 `assets/`，费用加到本期 `cost.image`。复用 `aniu/make_assets.py` 的抠图函数。

### Task 4：撤销和缩略图

- `python -m studio.edit --undo <ep_dir> <scene_id> <round>`：用 `history/<id>/r<round>/` 恢复，之后的轮次标 `undone: true`，台词变了就 `build()`（命中旧 hash 时不计费），重新出缩略图。
- `python -m studio.edit --thumbs <ep_dir>`：为所有场景生成缩略图（首次打开用）。

### Task 5：网站

- 依赖：`vite@8`、`@vitejs/plugin-react@6`、`@remotion/player@4.0.539`。
- `studio/vite.config.ts`：root=`studio/web`，`publicDir` 指向根 `public/`，`server.fs.allow` 含仓库根目录，端口 4100，插件 `studio/api.ts`。
- `studio/api.ts`（Vite 插件）：
  - `GET /api/episodes`、`GET /api/episodes/:id`（读 `episode.json`）。
  - `POST /api/episodes/:id/scenes/:sid/edit {issue}` → 入队，`status=queued`。
  - `POST .../approve`、`POST .../undo {round}`、`POST /api/episodes/:id/render {draft}`。
  - 队列：内存数组 + `studio/jobs.json` 持久化，一次跑一个，`child_process.spawn` Python，重启后把 `working` 的改回 `queued`。
- `studio/web/`：`index.html`、`main.tsx`、`App.tsx`。
  - 首页：期数列表。
  - 单期页：左侧卡片（缩略图、名字、时长、首句、状态、提示标记），右侧 Player（本片 ±0.5 秒 / 整期）、问题输入框、两个按钮、修改记录（每轮可撤销），顶栏（进度、花费、渲染整期 / 强制草稿）。
  - 每 2 秒轮询当前期数的 `episode.json`。
- `package.json` 加 `"studio": "vite --config studio/vite.config.ts"`。
- 验证：`npm run studio`，用 ego 浏览器打开 `http://localhost:4100`，看到第 1 期 10 张卡片，Player 能播放。

### Task 6：端到端

在 ep001 上实测：
- s06 只改动画：「150万砸下来再慢一点」。
- s03 改台词：触发重配一段。
- 撤销 s06 到改之前。
- 越界：问题里要求「顺便把 s05 也改了」，应被还原并显示出错。

最后渲染整期，确认成片正常。完成后派一个审查代理通读计划 2 的全部改动。
