# 计划 1：分场景的期数结构 + 第 1 期迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把一期视频拆成「一个 `episode.json` + 每场景一个 `.tsx` 文件 + 按段增量配音」的结构，并把现有第 1 期迁移过去，渲染结果与旧版一致。

**Architecture:** Python 工具（`tools/`）读 `episode.json`，按配音段调用豆包 TTS（台词没变的段走缓存），算出每句台词和每个场景的起止时间写入 `audio/timeline.json`。Remotion 工程（仓库根目录，入口 `shared/index.ts`）为每期注册一个 composition，把每个场景放进各自的 `<Sequence>`，场景代码只用相对时间 `at(i)`。静态文件统一由 `tools/sync_public.py` 同步到 `public/`。

**Tech Stack:** Python 3.12（`.venv`，pytest），Remotion 4.0.539 + React 19 + TypeScript 5.8，豆包语音合成 2.0（`tts_doubao.py`），ffmpeg（`imageio_ffmpeg`）。

**设计文档：** `docs/superpowers/specs/2026-10-31-review-site-design.md`（本计划对应第 1、4、6 节）。

**后续计划：** 计划 2 = 审片网站（任务队列、Claude Code 改片与越界检查、逐片审片页）；计划 3 = 新建一期四步流程（选题、文本、生成）。


> **执行记录（2026-10-31）：** 本计划已按子代理方式执行完毕，分支 `plan1-episode-structure`。执行中经审查修正、与最初计划不同的地方：
> - 逐字对齐改为 `difflib` 全局序列匹配；台词开始时间吸附到配音停顿结束（`snap_start`，停顿由 ffmpeg 检测并缓存在 `words_<段>.json` 的 `silences`）。
> - `build()` 先用假音频校验再计费，失败时也记录已花费用，重配前删除旧缓存；新增 `detect=` 参数。
> - 同步跳过隐藏文件；`.gitignore` 只忽略根目录 `/public/`；删除重复的 `aniu/public/`。
> - 混音给人声补静音（`apad`），背景音乐不再在最后一句后中断；渲染前校验时间轴与台词一致。
> - 下面的代码块已同步为最终代码。迁移校验的旧时间轴用 `git show bc96c1b:episode/public/timeline.json > /tmp/old_timeline.json` 取回。
> - 留给计划 2：配音按内容寻址保留多个版本（撤销/预览需要）、单句结束时间、`build()` 返回重配了哪些段。

---

## 文件结构

| 路径 | 职责 |
|---|---|
| `tools/__init__.py` | 让 `tools` 可被导入 |
| `tools/audio_timeline.py` | 纯计算：拼接各段朗读文本、逐字对齐、算句子/场景/选题滚动时间、展开音效。不读写文件、不联网 |
| `tools/sync_public.py` | 把 `assets/*` 和 `episodes/*/audio/*.mp3` 同步到 `public/`，只复制有变化的文件 |
| `tools/build_audio.py` | 读 `episode.json` + `studio/config.json`，按段调用 TTS（带缓存），写 `audio/vo_<段>.mp3`、`words_<段>.json`、`timeline.json`，累计配音花费 |
| `tools/render.py` | 同步静态文件 → Remotion 渲染画面 → `opening/make_audio.py` 混音，输出 `out/<id>/<id>.mp4` |
| `tools/compare_frames.py` | 迁移校验：旧版 `ep1.mp4` 与新版成片逐场景取帧并排对比 |
| `tests/` | pytest：`helpers.py`（测试用的期数数据）、三个工具的测试 |
| `studio/config.json` | 全局配置：配音音色和语速 |
| `assets/` | 素材：`pose_*.png`、`prop_*.png`、`avatar.jpg` |
| `package.json`、`tsconfig.json`、`remotion.config.ts` | 根目录 Remotion 工程 |
| `shared/theme.ts` | 颜色、字体、帧率、`f()` 秒转帧 |
| `shared/types.ts` | `EpisodeJson`、`Timeline`、`SceneProps`、`EpisodeModule` 类型 |
| `shared/context.ts` | `useEp()`：场景里读取本期数据和时间轴 |
| `shared/ui.tsx` | Pose、Sticker、Card、BigText、Check、Strike、pop、clamp（从 `episode/src/ui.tsx` 迁移） |
| `shared/Frame.tsx` | Paper 背景、TopBar 进度条、Subtitles 字幕 |
| `shared/Episode.tsx` | 把一期的场景、字幕、进度条、配音拼成一个视频 |
| `shared/Root.tsx`、`shared/index.ts` | 为每期注册 composition |
| `episodes/index.ts` | 所有期数的列表 |
| `episodes/ep001/episode.json` | 第 1 期数据：台词、画面大意、音效、状态 |
| `episodes/ep001/scenes/s01.tsx … s10.tsx` | 第 1 期的 10 个场景 |
| `episodes/ep001/index.ts` | 把第 1 期的数据、时间轴、场景组装成 `EpisodeModule` |

迁移完成后删除旧的 `episode/` 目录（任务 10）。`opening/` 保留（`make_audio.py` 继续使用）。

### 关键约定

- **配音段**：`episode.json` 的 `segments` 按播放顺序列出段名和段前停顿；每句台词用 `seg` 指明所属段。同一段的台词在场景顺序里必须连续。段名 `title` 的台词不显示字幕（画面上已有标题卡）。
- **场景时间**：场景从它第一句台词开始，到下一个场景第一句台词开始结束；第一个场景从 0 开始，最后一个场景到全片结束。
- **`at(i)`**：本场景第 `i` 句台词开始的帧，相对场景开头；`at(台词数)` 等于场景总帧数 `dur`。
- **音效**：写在每个场景的 `sfx` 里，`line` 是本场景内的台词序号，`offset` 是相对这句开始的秒数（可为负）。选题滚动的嘀嗒声由 `roll` 自动生成。
- **配音缓存**：每段的缓存键是 `sha1(音色|语速|朗读文本)` 前 12 位，存在 `words_<段>.json` 里。键不变就不调用 TTS。

---

### Task 1: 时间轴纯计算模块

**Files:**
- Create: `tools/__init__.py`
- Create: `tools/audio_timeline.py`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Create: `tests/helpers.py`
- Test: `tests/test_audio_timeline.py`

- [ ] **Step 1: 安装 pytest**

Run: `cd /Users/Doc/agent/xhs-video-pipeline && uv pip install -q --python .venv/bin/python pytest && .venv/bin/python -m pytest --version`
Expected: 输出 `pytest 8.x.x` 或更高

- [ ] **Step 2: 写测试辅助文件**

`tests/__init__.py`：空文件。

`tests/conftest.py`：

```python
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
```

`tests/helpers.py`：

```python
"""测试用的小型期数数据：3 个配音段、3 个场景、一个选题滚动。"""

import copy

from tools.audio_timeline import norm, segment_speech

_EP = {
    "id": "ep999",
    "title": "标题",
    "segments": [{"id": "open", "gap": 0.3}, {"id": "title", "gap": 1.4}, {"id": "body", "gap": 0.5}],
    "roll": {"after": "open", "dur": 1.2, "topics": ["甲", "乙"]},
    "scenes": [
        {"id": "s01", "lines": [{"seg": "open", "zh": "开场", "say": "开场。"}],
         "sfx": [{"line": 0, "kind": "pop", "vol": 0.8}]},
        {"id": "s02", "lines": [{"seg": "open", "zh": "这期", "say": "这期："},
                                {"seg": "title", "zh": "标题", "say": "标题？"}], "sfx": []},
        {"id": "s03", "lines": [{"seg": "body", "zh": "一二", "say": "一二，"},
                                {"seg": "body", "zh": "三", "say": "三。"}],
         "sfx": [{"line": 1, "kind": "stamp", "vol": 1.0, "offset": -0.1}]},
    ],
    "cost": {"tts": 0, "image": 0},
}


def make_episode() -> dict:
    return copy.deepcopy(_EP)


def words_for(text: str, per: float = 0.2) -> list[tuple[float, float, str]]:
    """假的逐字时间：每个字（不含标点）0.2 秒。"""
    chars = [c for c in text if norm(c)]
    return [(i * per, (i + 1) * per, c) for i, c in enumerate(chars)]


def fake_seg_audio(ep: dict) -> dict:
    return {seg: {"duration": len(norm(t)) * 0.2 + 0.25, "words": words_for(t), "hash": "h"}
            for seg, t in segment_speech(ep).items()}
```

- [ ] **Step 3: 写失败的测试**

`tests/test_audio_timeline.py`：

```python
import pytest

from tests.helpers import fake_seg_audio, make_episode
from tools.audio_timeline import char_times, layout, segment_hash, segment_speech

VOICE = {"speaker": "x", "rate": 15}


def test_char_times_ignores_punctuation():
    st, en = char_times("一二，三。", [(0, 0.2, "一"), (0.2, 0.4, "二"), (0.4, 0.6, "三")])
    assert st == [0, 0.2, 0.4]
    assert en == [0.2, 0.4, 0.6]


def test_char_times_fills_missing_char_with_previous_end():
    st, en = char_times("一二三", [(0, 0.2, "一"), (0.4, 0.6, "三")])
    assert st[1] == en[1] == 0.2


def test_segment_speech_concatenates_in_order():
    assert segment_speech(make_episode()) == {"open": "开场。这期：", "title": "标题？", "body": "一二，三。"}


def test_segment_speech_rejects_noncontiguous_segment():
    ep = make_episode()
    ep["scenes"][2]["lines"][0]["seg"] = "open"
    with pytest.raises(ValueError, match="不连续"):
        segment_speech(ep)


def test_segment_speech_rejects_unknown_segment():
    ep = make_episode()
    ep["scenes"][2]["lines"][0]["seg"] = "nope"
    with pytest.raises(ValueError, match="未定义"):
        segment_speech(ep)


def test_layout_times():
    ep = make_episode()
    tl = layout(ep, fake_seg_audio(ep), VOICE)
    # open：0.3 起，4 个字 → 0.8 + 0.25 = 1.05；结束于 1.35
    assert tl["segments"]["open"]["start"] == pytest.approx(0.3)
    assert tl["roll"] == {"start": pytest.approx(1.4), "dur": 1.2, "topics": ["甲", "乙", "标题"]}
    assert tl["segments"]["title"]["start"] == pytest.approx(2.75)
    assert tl["segments"]["body"]["start"] == pytest.approx(3.9)
    assert tl["duration"] == pytest.approx(5.95)
    starts = [(l["scene"], l["i"], l["start"]) for l in tl["lines"]]
    assert starts == [("s01", 0, pytest.approx(0.3)), ("s02", 0, pytest.approx(0.7)),
                      ("s02", 1, pytest.approx(2.75)), ("s03", 0, pytest.approx(3.9)), ("s03", 1, pytest.approx(4.3))]
    assert tl["scenes"]["s01"] == {"start": 0.0, "end": pytest.approx(0.7)}
    assert tl["scenes"]["s02"] == {"start": pytest.approx(0.7), "end": pytest.approx(3.9)}
    assert tl["scenes"]["s03"] == {"start": pytest.approx(3.9), "end": pytest.approx(5.95)}
    assert tl["voice"] == VOICE


def test_sfx_expansion_includes_roll_ticks():
    ep = make_episode()
    sfx = layout(ep, fake_seg_audio(ep), VOICE)["sfx"]
    assert [s[1] for s in sfx] == ["pop", "pop", "stamp", "stamp"]
    assert sfx[0][0] == pytest.approx(0.3)      # s01 第 0 句
    assert sfx[1][0] == pytest.approx(1.648)    # 选题滚过第 1 张
    assert sfx[2] == [pytest.approx(2.6), "stamp", 0.8]   # 停在本期标题
    assert sfx[3][0] == pytest.approx(4.2)      # s03 第 1 句提前 0.1 秒


def test_segment_hash_changes_with_rate():
    assert segment_hash("x", 15, "文本") != segment_hash("x", 16, "文本")
    assert segment_hash("x", 15, "文本") == segment_hash("x", 15, "文本")


def test_char_times_limits_skip_ahead():
    words = [(0.0, 0.1, "十"), (0.1, 0.2, "个"), (0.2, 0.3, "人"),
             (0.3, 0.4, "十"), (0.4, 0.5, "分"), (0.5, 0.6, "好")]
    st, en = char_times("10个人，十分好", words)
    chars = "10个人十分好"
    assert st[chars.index("个")] == pytest.approx(0.1)
    assert st == sorted(st)


def test_char_times_splits_multichar_word_evenly():
    st, en = char_times("一二三", [(0, 0.4, "一二")])
    assert st[:2] == pytest.approx([0, 0.2])
    assert en[:2] == pytest.approx([0.2, 0.4])


def test_char_times_is_case_insensitive():
    st, en = char_times("Hello", [(0, 0.5, "hello")])
    assert en[-1] == pytest.approx(0.5)


def test_layout_rejects_unknown_roll_target():
    ep = make_episode()
    ep["roll"]["after"] = "nope"
    with pytest.raises(ValueError, match="nope"):
        layout(ep, fake_seg_audio(ep), VOICE)


def test_char_times_recovers_after_unmatched_word():
    words = [(0.0, 0.2, "二零二四"), (0.2, 0.4, "年"), (0.4, 0.6, "的"), (0.6, 0.8, "春"),
             (0.8, 1.0, "天"), (1.0, 1.2, "来"), (1.2, 1.4, "了")]
    st, en = char_times("2024年的春天来了", words)
    assert st[4] == pytest.approx(0.2)
    assert en[-1] == pytest.approx(1.4)
    assert st == sorted(st)


def test_snap_start_moves_start_to_pause_end():
    from tools.audio_timeline import snap_start
    assert snap_start(19.04, [[19.14, 19.69]]) == 19.69   # 停顿在开始后不久出现
    assert snap_start(5.46, [[4.97, 5.55]]) == 5.55       # 开始落在停顿里
    assert snap_start(2.48, [[2.02, 2.45]]) == 2.48       # 停顿已经结束，不动
    assert snap_start(1.0, [[1.5, 2.0]]) == 1.0           # 停顿太远，不动


def test_layout_snaps_line_start_to_silence_end():
    ep = make_episode()
    audio = fake_seg_audio(ep)
    before = layout(ep, audio, VOICE)
    audio["body"]["silences"] = [[0.35, 0.55]]
    after = layout(ep, audio, VOICE)
    b = {(l["scene"], l["i"]): l["start"] for l in before["lines"]}
    a = {(l["scene"], l["i"]): l["start"] for l in after["lines"]}
    moved = {k for k in a if a[k] != b[k]}
    assert moved == {("s03", 1)}
    assert a[("s03", 1)] == pytest.approx(b[("s03", 1)] - 0.4 + 0.55)


def test_layout_snap_past_tts_end_extends_end():
    ep = make_episode()
    audio = fake_seg_audio(ep)
    before = {(l["scene"], l["i"]): l for l in layout(ep, audio, VOICE)["lines"]}[("s03", 1)]
    audio["body"]["silences"] = [[0.45, 0.65]]   # 停顿在 TTS 开始后 0.05s 出现，TTS 结束落在停顿里
    after = {(l["scene"], l["i"]): l for l in layout(ep, audio, VOICE)["lines"]}[("s03", 1)]
    base = before["start"] - 0.4
    assert before["end"] == pytest.approx(base + 0.6)
    assert after["start"] == pytest.approx(base + 0.65)
    assert after["end"] >= after["start"]
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `.venv/bin/python -m pytest tests/test_audio_timeline.py -q`
Expected: FAIL，`ModuleNotFoundError: No module named 'tools.audio_timeline'`

- [ ] **Step 5: 写实现**

`tools/__init__.py`：空文件。

`tools/audio_timeline.py`：

```python
"""配音时间轴的纯计算部分：不读写文件、不联网，供 build_audio.py 使用。"""

import difflib
import hashlib
import re

FPS = 30
TAIL = 0.25        # 每段最后一个字之后留的余量（秒）
END_PAD = 1.2      # 全片最后留白（秒）
ROLL_LEAD = 0.05   # 选题滚动在前一段配音结束后多久开始（秒）
SNAP_AHEAD = 0.2   # 台词开始后这么短的时间内若出现停顿，说明 TTS 时间戳偏早，吸附到停顿结束


def norm(s: str) -> str:
    return re.sub(r"[\W_]+", "", s).lower()


def char_times(speech: str, words) -> tuple[list[float], list[float]]:
    """把 TTS 返回的逐字时间对齐到朗读文本的每个字（标点不计）。没对上的字沿用前一个字的结束时间。"""
    chars = norm(speech)
    st: list = [None] * len(chars)
    en: list = [None] * len(chars)
    tts_chars, tts_st, tts_en = [], [], []
    for s, e, w in words:
        w = norm(w)
        for i, c in enumerate(w):
            tts_chars.append(c)
            tts_st.append(s + (e - s) * i / len(w))
            tts_en.append(s + (e - s) * (i + 1) / len(w))
    sm = difflib.SequenceMatcher(None, chars, "".join(tts_chars), autojunk=False)
    for i, j, n in sm.get_matching_blocks():
        for d in range(n):
            st[i + d], en[i + d] = tts_st[j + d], tts_en[j + d]
    last = 0.0
    for i in range(len(chars)):
        if st[i] is None:
            st[i] = en[i] = last
        last = en[i]
    return st, en


def snap_start(t: float, silences: list[list[float]]) -> float:
    """t 落在某段停顿里，或某段停顿在 t 之后 SNAP_AHEAD 秒内开始 → 返回该停顿的结束时间；否则原样返回。"""
    for s, e in silences:
        if s - SNAP_AHEAD <= t <= e:
            return e
    return t


def segment_speech(episode: dict) -> dict[str, str]:
    """按 segments 的顺序返回 {段名: 整段朗读文本}。同一段的台词必须连续，段名必须已定义。"""
    known = [s["id"] for s in episode["segments"]]
    speech: dict[str, str] = {}
    appeared: list[str] = []
    last = None
    for sc in episode["scenes"]:
        if not sc["lines"]:
            raise ValueError(f"场景 {sc['id']} 没有台词")
        for ln in sc["lines"]:
            seg = ln["seg"]
            if seg not in known:
                raise ValueError(f"场景 {sc['id']} 的台词用了未定义的配音段：{seg}")
            if seg != last:
                if seg in appeared:
                    raise ValueError(f"配音段 {seg} 的台词不连续（场景 {sc['id']}）")
                appeared.append(seg)
                last = seg
            speech[seg] = speech.get(seg, "") + ln["say"]
    if appeared != [s for s in known if s in appeared]:
        raise ValueError(f"台词出现的段顺序 {appeared} 与 segments 顺序 {known} 不一致")
    return {s: speech[s] for s in appeared}


def segment_hash(speaker: str, rate: int, speech: str) -> str:
    return hashlib.sha1(f"{speaker}|{rate}|{speech}".encode()).hexdigest()[:12]


def expand_sfx(episode: dict, lines: list[dict], roll: dict | None) -> list[list]:
    """场景里按台词序号写的音效 → [[绝对秒, 种类, 音量], ...]，加上选题滚动的嘀嗒声，按时间排序。"""
    starts: dict[str, list[float]] = {}
    for ln in lines:
        starts.setdefault(ln["scene"], []).append(ln["start"])
    out = []
    for sc in episode["scenes"]:
        for s in sc.get("sfx", []):
            if not 0 <= s["line"] < len(starts[sc["id"]]):
                raise ValueError(f"场景 {sc['id']} 的音效指向不存在的第 {s['line']} 句")
            t = starts[sc["id"]][s["line"]] + s.get("offset", 0.0)
            out.append([round(max(0.0, t), 3), s["kind"], s["vol"]])
    if roll:
        n = len(roll["topics"])
        for j in range(1, n):
            p = 1 - (1 - j / (n - 1)) ** (1 / 3)   # 与画面同一条缓动曲线的反函数
            final = j == n - 1
            out.append([round(roll["start"] + roll["dur"] * p, 3), "stamp" if final else "pop", 0.8 if final else 0.35])
    return sorted(out)


def layout(episode: dict, seg_audio: dict, voice: dict) -> dict:
    """seg_audio: {段名: {"duration": 秒, "words": [(开始, 结束, 字), ...], "hash": str}} → timeline。"""
    speech = segment_speech(episode)
    gaps = {s["id"]: s["gap"] for s in episode["segments"]}
    roll_cfg = episode.get("roll")
    if roll_cfg and roll_cfg["after"] not in speech:
        raise ValueError(f"选题滚动的目标配音段不存在：{roll_cfg['after']}")
    t0, segs, tables, roll = 0.0, {}, {}, None
    for seg, text in speech.items():
        t0 += gaps[seg]
        a = seg_audio[seg]
        st, en = char_times(text, a["words"])
        segs[seg] = {"start": round(t0, 3), "duration": round(a["duration"], 3), "hash": a["hash"]}
        tables[seg] = (t0, st, en)
        t0 += a["duration"]
        if roll_cfg and roll_cfg["after"] == seg:
            roll = {"start": round(t0 + ROLL_LEAD, 3), "dur": roll_cfg["dur"],
                    "topics": roll_cfg["topics"] + [episode["title"]]}
    duration = round(t0 + END_PAD, 3)

    lines, pos = [], {seg: 0 for seg in speech}
    for sc in episode["scenes"]:
        for i, ln in enumerate(sc["lines"]):
            seg = ln["seg"]
            base, st, en = tables[seg]
            n, k = len(norm(ln["say"])), pos[seg]
            if n == 0:
                raise ValueError(f"场景 {sc['id']} 第 {i} 句朗读文本为空")
            start = base + snap_start(st[k], seg_audio[seg].get("silences", []))
            end = max(base + en[k + n - 1], start)   # TTS 的结束时间可能和开始一样偏早
            lines.append({"scene": sc["id"], "i": i, "seg": seg, "zh": ln["zh"],
                          "start": round(start, 3), "end": round(end, 3)})
            pos[seg] = k + n

    first: dict[str, float] = {}
    for ln in lines:
        first.setdefault(ln["scene"], ln["start"])
    ids = [sc["id"] for sc in episode["scenes"]]
    scenes = {sid: {"start": 0.0 if j == 0 else first[sid],
                    "end": first[ids[j + 1]] if j + 1 < len(ids) else duration}
              for j, sid in enumerate(ids)}

    return {"fps": FPS, "duration": duration, "voice": voice, "segments": segs, "lines": lines,
            "scenes": scenes, "roll": roll, "sfx": expand_sfx(episode, lines, roll)}
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `.venv/bin/python -m pytest tests/test_audio_timeline.py -q`
Expected: `13 passed`（含审查后补的对齐测试）

- [ ] **Step 7: Commit**

```bash
git add tools/__init__.py tools/audio_timeline.py tests/__init__.py tests/conftest.py tests/helpers.py tests/test_audio_timeline.py
git commit -m "时间轴纯计算模块：按段拼接朗读文本、逐字对齐、场景和音效时间"
```

---

### Task 2: 静态文件同步

**Files:**
- Create: `tools/sync_public.py`
- Modify: `.gitignore`
- Test: `tests/test_sync_public.py`

- [ ] **Step 1: 写失败的测试**

`tests/test_sync_public.py`：

```python
from tools.sync_public import sync


def _setup(root):
    (root / "assets").mkdir()
    (root / "assets" / "a.png").write_bytes(b"png")
    (root / "assets" / "fonts").mkdir()   # 子目录不同步
    audio = root / "episodes" / "ep001" / "audio"
    audio.mkdir(parents=True)
    (audio / "vo_body.mp3").write_bytes(b"mp3")
    (audio / "timeline.json").write_text("{}")   # 只同步 mp3


def test_sync_copies_then_skips_unchanged(tmp_path):
    _setup(tmp_path)
    assert sync(tmp_path) == 2
    assert (tmp_path / "public/assets/a.png").read_bytes() == b"png"
    assert (tmp_path / "public/episodes/ep001/audio/vo_body.mp3").read_bytes() == b"mp3"
    assert not (tmp_path / "public/episodes/ep001/audio/timeline.json").exists()
    assert sync(tmp_path) == 0


def test_sync_recopies_changed_file(tmp_path):
    _setup(tmp_path)
    sync(tmp_path)
    (tmp_path / "assets" / "a.png").write_bytes(b"png-v2")
    assert sync(tmp_path) == 1
    assert (tmp_path / "public/assets/a.png").read_bytes() == b"png-v2"


def test_sync_recopies_same_size_file_with_older_mtime(tmp_path):
    import os
    _setup(tmp_path)
    sync(tmp_path)
    src = tmp_path / "assets" / "a.png"
    src.write_bytes(b"pnx")
    old = (tmp_path / "public/assets/a.png").stat().st_mtime - 100
    os.utime(src, (old, old))
    assert sync(tmp_path) == 1
    assert (tmp_path / "public/assets/a.png").read_bytes() == b"pnx"


def test_sync_skips_hidden_files(tmp_path):
    _setup(tmp_path)
    (tmp_path / "assets" / ".DS_Store").write_bytes(b"x")
    (tmp_path / "episodes/ep001/audio/.hidden.mp3").write_bytes(b"x")
    assert sync(tmp_path) == 2
    assert not (tmp_path / "public/assets/.DS_Store").exists()
    assert not (tmp_path / "public/episodes/ep001/audio/.hidden.mp3").exists()
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `.venv/bin/python -m pytest tests/test_sync_public.py -q`
Expected: FAIL，`ModuleNotFoundError: No module named 'tools.sync_public'`

- [ ] **Step 3: 写实现**

`tools/sync_public.py`：

```python
"""把 assets/ 和各期配音同步到 public/（Remotion 和网站都从 public/ 读静态文件）。只复制有变化的文件。

  .venv/bin/python tools/sync_public.py
"""

import shutil
from pathlib import Path


def _copy_if_changed(src: Path, dst: Path) -> bool:
    if dst.exists() and dst.stat().st_size == src.stat().st_size and dst.stat().st_mtime == src.stat().st_mtime:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def sync(root: Path) -> int:
    pub, n = root / "public", 0
    for f in sorted((root / "assets").glob("*")):
        if f.is_file() and not f.name.startswith("."):
            n += _copy_if_changed(f, pub / "assets" / f.name)
    for ep in sorted(p for p in (root / "episodes").glob("ep*") if p.is_dir()):
        for f in sorted(p for p in (ep / "audio").glob("*.mp3") if not p.name.startswith(".")):
            n += _copy_if_changed(f, pub / "episodes" / ep.name / "audio" / f.name)
    return n


if __name__ == "__main__":
    print("同步了", sync(Path(__file__).resolve().parent.parent), "个文件")
```

在 `.gitignore` 的「生成物」一节末尾加一行：

```
public/
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `.venv/bin/python -m pytest tests/test_sync_public.py -q`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/sync_public.py tests/test_sync_public.py .gitignore
git commit -m "静态文件同步：assets 和各期配音 → public/，只复制变化的文件"
```

---

### Task 3: 按段增量配音

**Files:**
- Create: `tools/build_audio.py`
- Create: `studio/config.json`
- Test: `tests/test_build_audio.py`

- [ ] **Step 1: 写失败的测试**

`tests/test_build_audio.py`：

```python
import json
from pathlib import Path

import pytest

from tests.helpers import make_episode, words_for
from tools.build_audio import PRICE, build

VOICE = {"speaker": "x", "rate": 15}


@pytest.fixture
def ep_dir(tmp_path):
    d = tmp_path / "ep999"
    d.mkdir()
    (d / "episode.json").write_text(json.dumps(make_episode(), ensure_ascii=False))
    return d


def fake_synth(calls):
    def synth(text, out_path, speaker, speech_rate):
        calls.append((text, speaker, speech_rate))
        Path(out_path).write_bytes(b"ID3fake")
        return words_for(text)
    return synth


def test_first_build_synthesizes_every_segment(ep_dir):
    calls = []
    tl, billed = build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    assert [c[0] for c in calls] == ["开场。这期：", "标题？", "一二，三。"]
    assert all(c[1:] == ("x", 15) for c in calls)
    assert (ep_dir / "audio/timeline.json").exists()
    assert (ep_dir / "audio/vo_body.mp3").exists()
    assert billed == len("开场。这期：标题？一二，三。")
    cost = json.loads((ep_dir / "episode.json").read_text())["cost"]["tts"]
    assert cost == pytest.approx(billed * PRICE)
    assert tl["duration"] == pytest.approx(5.95)


def test_rebuild_uses_cache(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    _, billed = build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    assert len(calls) == 3
    assert billed == 0


def test_line_change_only_revoices_its_segment(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    ep = json.loads((ep_dir / "episode.json").read_text())
    ep["scenes"][2]["lines"][1]["say"] = "三四。"
    (ep_dir / "episode.json").write_text(json.dumps(ep, ensure_ascii=False))
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    assert [c[0] for c in calls[3:]] == ["一二，三四。"]


def test_voice_change_revoices_all(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    build(ep_dir, synth=fake_synth(calls), voice={"speaker": "x", "rate": 20}, sync_root=None, detect=lambda p: [])
    assert len(calls) == 6


def test_failed_revoice_leaves_no_stale_words(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])

    def bad_synth(text, out_path, speaker, speech_rate):
        Path(out_path).write_bytes(b"ID3new")
        return [] if text == "一二，三。" else words_for(text)

    with pytest.raises(RuntimeError):
        build(ep_dir, force=True, synth=bad_synth, voice=VOICE, sync_root=None, detect=lambda p: [])
    assert not (ep_dir / "audio/words_body.json").exists()
    calls.clear()
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    assert [c[0] for c in calls] == ["一二，三。"]


def test_invalid_episode_fails_before_any_tts(ep_dir):
    ep = json.loads((ep_dir / "episode.json").read_text())
    ep["scenes"][0]["sfx"][0]["line"] = 5
    (ep_dir / "episode.json").write_text(json.dumps(ep, ensure_ascii=False))
    calls = []
    with pytest.raises(ValueError):
        build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    assert calls == []


def test_cost_recorded_when_later_segment_fails(ep_dir):
    def flaky(text, out_path, speaker, speech_rate):
        if text != "开场。这期：":
            raise OSError("network")
        Path(out_path).write_bytes(b"ID3fake")
        return words_for(text)

    with pytest.raises(OSError):
        build(ep_dir, synth=flaky, voice=VOICE, sync_root=None, detect=lambda p: [])
    cost = json.loads((ep_dir / "episode.json").read_text())["cost"]["tts"]
    assert cost == pytest.approx(len("开场。这期：") * PRICE)


def test_cached_words_without_silences_detects_without_resynthesis(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None, detect=lambda p: [])
    wfile = ep_dir / "audio/words_body.json"
    d = json.loads(wfile.read_text())
    del d["silences"]
    wfile.write_text(json.dumps(d))
    seen = []
    _, billed = build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None,
                      detect=lambda p: seen.append(p.name) or [[0.1, 0.2]])
    assert len(calls) == 3
    assert billed == 0
    assert seen == ["vo_body.mp3"]
    assert json.loads(wfile.read_text())["silences"] == [[0.1, 0.2]]
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `.venv/bin/python -m pytest tests/test_build_audio.py -q`
Expected: FAIL，`ModuleNotFoundError: No module named 'tools.build_audio'`

- [ ] **Step 3: 写全局配置**

`studio/config.json`：

```json
{
  "voice": {"speaker": "zh_male_wennuanahu_uranus_bigtts", "rate": 15}
}
```

- [ ] **Step 4: 写实现**

`tools/build_audio.py`：

```python
"""按 episode.json 生成整期配音和时间轴。台词和音色都没变的段直接用缓存，不调用 TTS。

  .venv/bin/python tools/build_audio.py episodes/ep001
  .venv/bin/python tools/build_audio.py episodes/ep001 --force   # 全部重配

产物（episodes/<id>/audio/）：vo_<段>.mp3、words_<段>.json（逐字时间 + 缓存键）、timeline.json
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.audio_timeline import TAIL, layout, segment_hash, segment_speech  # noqa: E402
from tools.sync_public import sync  # noqa: E402

PRICE = 0.0003  # 豆包语音合成 2.0，元/字（标点也算字）


def load_voice() -> dict:
    return json.loads((ROOT / "studio/config.json").read_text())["voice"]


def detect_silences(mp3: Path) -> list[list[float]]:
    """用 ffmpeg silencedetect 找出音频里的停顿 [[开始, 结束], ...]（秒）；末尾没结束的停顿丢弃。"""
    import imageio_ffmpeg
    r = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-i", str(mp3),
                        "-af", "silencedetect=noise=-40dB:d=0.12", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    out, start = [], None
    for m in re.finditer(r"silence_(start|end): (-?[\d.]+)", r.stderr):
        if m.group(1) == "start":
            start = float(m.group(2))
        elif start is not None:
            out.append([round(start, 3), round(float(m.group(2)), 3)])
            start = None
    return out


def build(ep_dir: Path, force: bool = False, synth=None, voice: dict | None = None, sync_root: Path | None = ROOT,
          detect=detect_silences):
    """返回 (timeline, 本次计费字数)。"""
    if synth is None:
        import tts_doubao
        synth = tts_doubao.synth
    voice = voice or load_voice()
    episode = json.loads((ep_dir / "episode.json").read_text())
    audio = ep_dir / "audio"
    audio.mkdir(exist_ok=True)
    speech = segment_speech(episode)
    # 先用假音频走一遍排版，音效越界、空台词等错误在计费前暴露
    layout(episode, {seg: {"duration": 1.0, "words": [], "hash": ""} for seg in speech}, voice)
    seg_audio, billed = {}, 0
    try:
        for seg, text in speech.items():
            key = segment_hash(voice["speaker"], voice["rate"], text)
            wfile, mp3 = audio / f"words_{seg}.json", audio / f"vo_{seg}.mp3"
            cached = json.loads(wfile.read_text()) if wfile.exists() and mp3.exists() else None
            if force or not cached or cached["hash"] != key:
                wfile.unlink(missing_ok=True)  # 合成失败时不能留下与新 mp3 不配套的旧缓存
                words = synth(text, mp3, speaker=voice["speaker"], speech_rate=voice["rate"])
                if not words:
                    raise RuntimeError(f"配音段 {seg} 没有返回逐字时间")
                cached = {"hash": key, "words": [list(w) for w in words]}
                wfile.write_text(json.dumps(cached, ensure_ascii=False))
                billed += len(text)
                print(f"  配音 {seg}：{len(text)} 字")
            if "silences" not in cached:
                cached["silences"] = detect(mp3)
                wfile.write_text(json.dumps(cached, ensure_ascii=False))
            words = [tuple(w) for w in cached["words"]]
            seg_audio[seg] = {"duration": words[-1][1] + TAIL, "words": words, "hash": key, "silences": cached["silences"]}
        tl = layout(episode, seg_audio, voice)
        (audio / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1))
    finally:
        if billed:
            tts = episode.setdefault("cost", {}).setdefault("tts", 0)
            episode["cost"]["tts"] = round(tts + billed * PRICE, 4)
            (ep_dir / "episode.json").write_text(json.dumps(episode, ensure_ascii=False, indent=2) + "\n")
    if sync_root:
        sync(sync_root)
    return tl, billed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", type=Path)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    import pipeline
    pipeline.load_env()
    tl, billed = build(a.episode.resolve(), force=a.force)
    print(f"时长 {tl['duration']:.1f}s，{len(tl['scenes'])} 个场景，本次配音 {billed} 字（约 {billed * PRICE:.2f} 元）")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: 运行全部测试，确认通过**

Run: `.venv/bin/python -m pytest tests -q`
Expected: `23 passed`

- [ ] **Step 6: Commit**

```bash
git add tools/build_audio.py studio/config.json tests/test_build_audio.py
git commit -m "按段增量配音：台词或音色没变的段走缓存，配音花费记入 episode.json"
```

---

### Task 4: 根目录 Remotion 工程 + 素材迁移

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `remotion.config.ts`
- Create: `assets/pose_*.png`、`assets/prop_*.png`、`assets/avatar.jpg`（复制）
- Modify: `aniu/make_assets.py`（产物目录改为 `assets/`）

- [ ] **Step 1: 写工程配置**

`package.json`：

```json
{
  "name": "xhs-video-pipeline",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc -p .",
    "video:studio": "remotion studio shared/index.ts"
  },
  "dependencies": {
    "@remotion/cli": "4.0.539",
    "remotion": "4.0.539",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@types/react": "19.1.0",
    "typescript": "5.8.3"
  }
}
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["shared", "episodes"]
}
```

`remotion.config.ts`：

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 2: 安装依赖**

Run: `npm install --registry=https://registry.npmmirror.com 2>&1 | tail -2 && ls node_modules/.bin/remotion`
Expected: 最后一行输出 `node_modules/.bin/remotion`

- [ ] **Step 3: 复制素材**

Run:

```bash
cp aniu/public/pose_*.png aniu/public/prop_*.png assets/ && cp "ip/avatar/A-橙底大头.jpg" assets/avatar.jpg && ls assets | grep -cE "^(pose|prop)_.*\.png$|^avatar\.jpg$"
```

Expected: `22`（9 个姿势 + 12 个道具 + 1 个头像）

- [ ] **Step 4: 让素材生成脚本直接写进 assets/**

`aniu/make_assets.py` 中把：

```python
"""阿牛素材库：角色设定图 → 姿势库 / 道具库（一张图多个素材，自动抠图切开，flash 0.12 元/张）。

  ../.venv/bin/python make_assets.py                 # 生成缺失的
  ../.venv/bin/python make_assets.py --force poses1  # 重画某一张
产物：raw/*.jpg（原图）、public/pose_<名>.png、public/prop_<名>.png（透明底贴纸）
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
sys.path.insert(0, str(ROOT.parent / "opening"))
import pipeline as P  # noqa: E402
from make_assets import components, cutout, grid  # noqa: E402  复用抠图/切分

RAW, PUB = ROOT / "raw", ROOT.parent / "assets"
CONCEPT = ROOT.parent / "ip/concepts/A-奶牛打工人.jpg"
SHEET = RAW / "character.jpg"

STYLE = ("手绘马克笔漫画风，粗黑色略带抖动的轮廓线，马克笔上色能看到笔触，纯白背景，没有地面阴影。"
         "配色只用：黑、白、橙色(#FF8A3D)、浅灰、粉色(鼻子和耳朵内侧)。")
ANIU = ("角色「阿牛」：拟人化的黑白花纹小奶牛，像人一样站立，Q版大头小身体（头约占身高的五分之二），"
        "圆头，两只米色小短角，粉色大鼻子，黑色豆豆眼，身上黑色斑块的位置固定（左耳周围一块、右眼上方一块），"
        "穿略皱的白衬衫和深灰色西裤，黑色蹄子，脖子上挂橙色挂绳的白色工牌。")
SAME = "必须与参考图中的阿牛完全一致：花纹位置、角、鼻子、衬衫、工牌都不能变。"

POSES = {  # 每张图从左到右三个姿势，名字按顺序
    "poses1": (["sign", "shock", "point"],
               "①双手在头顶举着一块空白的白色长方形牌子（牌子正对前方、上面什么都不写），开心；"
               "②被吓到，双手抱头，眼睛瞪圆，嘴巴张大；③侧身伸出一只手指向画面右侧，自信地讲解"),
    "poses2": (["think", "cheer", "calc"],
               "①一只手托着下巴思考，眼睛看向上方；②双手高举欢呼，开心大笑；③双手捧着一个计算器认真按着，表情专注"),
    "poses3": (["tired", "wave", "shrug"],
               "①抱着笔记本电脑，弯腰驼背，有黑眼圈，很疲惫；②面向观众笑着挥手打招呼；③双手摊开耸肩，表情无奈"),
}
PROPS = ["piggy", "moneybag", "coin", "calc", "calendar", "house",
         "takeout", "tea", "jar", "chart", "hourglass", "creditcard"]
PROP_DESC = ("粉色存钱罐、装满钱的钱袋（印着¥）、金币（印着¥）、计算器、撕页日历、一栋小房子、"
             "外卖纸袋、一杯珍珠奶茶、一个装着一半硬币的玻璃罐、向上增长的柱状图、沙漏、一张信用卡")


def jobs():
    j = {"character": (CONCEPT, f"{STYLE}\n{ANIU}\n角色设定图：同一张图从左到右并排画阿牛的正面、侧面、背面三个全身站姿，"
                                f"彼此之间留出大片空白，表情平静微笑。参考图是这个角色的概念设计，严格沿用它的造型。不要写任何文字。")}
    for name, (_, desc) in POSES.items():
        j[name] = (SHEET, f"{STYLE}\n{ANIU}\n{SAME}\n同一张图从左到右并排画三个互不接触的全身姿势，彼此之间留出大片空白：{desc}。"
                          "不要写任何文字。")
    j["props"] = (None, f"{STYLE}\n道具素材表：排成整齐的3行4列网格，每个物品单独居中在自己的格子里，物品之间留大量空白、互不重叠，"
                        f"按从左到右、从上到下依次是：{PROP_DESC}。除了¥符号不要写任何文字，不要画格子线。")
    return j


def largest_blob(cell: Image.Image) -> Image.Image:
    """只保留格子里最大的一块图形，去掉邻格伸进来的碎片（比如存钱罐的尾巴）。"""
    s = 4
    g = cell.convert("L").resize((cell.width // s, cell.height // s))
    w, h = g.size
    ink = [[g.getpixel((x, y)) < 230 for x in range(w)] for y in range(h)]
    seen, best = [[False] * w for _ in range(h)], []
    for y0 in range(h):
        for x0 in range(w):
            if not ink[y0][x0] or seen[y0][x0]:
                continue
            stack, comp = [(x0, y0)], []
            seen[y0][x0] = True
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for dx in range(-2, 3):  # 允许 2 像素的缝，线条断开处不会被切成两块
                    for dy in range(-2, 3):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and ink[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    xs, ys = [x for x, _ in best], [y for _, y in best]
    box = (max(0, min(xs) * s - 6), max(0, min(ys) * s - 6), min(cell.width, max(xs) * s + 10), min(cell.height, max(ys) * s + 10))
    out = Image.new("RGB", cell.size, "white")
    out.paste(cell.crop(box), box[:2])
    return out


def split(name: str, raw: Path):
    img = Image.open(raw).convert("RGB")
    if name in POSES:
        for label, part in zip(POSES[name][0], components(img, 3)):
            cutout(part).save(PUB / f"pose_{label}.png")
    elif name == "props":
        for label, cell in zip(PROPS, grid(img, 4, 3)):
            cutout(largest_blob(cell), outline=7).save(PUB / f"prop_{label}.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", nargs="*", default=[])
    ap.add_argument("--only", nargs="*", help="只处理这些图")
    a = ap.parse_args()
    P.load_env()
    RAW.mkdir(exist_ok=True)
    PUB.mkdir(exist_ok=True)
    for name, (ref, prompt) in jobs().items():
        if a.only and name not in a.only:
            continue
        raw = RAW / f"{name}.jpg"
        if not raw.exists() or name in a.force:
            P.seedream(prompt, raw, ref=ref)
            print("  生成", raw.name)
        split(name, raw)
    print("素材 →", PUB)


if __name__ == "__main__":
    main()
```

改为：

```python
RAW, PUB = ROOT / "raw", ROOT.parent / "assets"
```

Run: `grep -n "RAW, PUB" aniu/make_assets.py`
Expected: `RAW, PUB = ROOT / "raw", ROOT.parent / "assets"`

- [ ] **Step 5: 同步到 public/**

Run: `.venv/bin/python tools/sync_public.py`
Expected: `同步了 22 个文件`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json remotion.config.ts assets/ aniu/make_assets.py
git commit -m "根目录 Remotion 工程；阿牛素材迁移到 assets/"
```

---

### Task 5: 公共组件

**Files:**
- Create: `shared/theme.ts`
- Create: `shared/types.ts`
- Create: `shared/context.ts`
- Create: `shared/ui.tsx`
- Create: `shared/Frame.tsx`
- Create: `shared/Episode.tsx`

- [ ] **Step 1: 主题和类型**

`shared/theme.ts`：

```ts
export const FPS = 30;
/** 秒 → 帧 */
export const f = (sec: number) => Math.round(sec * FPS);

export const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
export const INK = "#1f1f1f";
export const ORANGE = "#FF8A3D";
export const PAPER = "#FFFBF3";
```

`shared/types.ts`：

```ts
import type React from "react";

export type Line = { seg: string; zh: string; say: string };
export type Sfx = { line: number; kind: "pop" | "stamp" | "whoosh"; vol: number; offset?: number };

export type SceneData = {
  id: string;
  name: string;
  visual: string;
  lines: Line[];
  sfx: Sfx[];
  textStatus: string;
  status: string;
  rounds: unknown[];
};

export type EpisodeJson = {
  id: string;
  no: number;
  total: number;
  stage: string;
  title: string;
  topic?: unknown;
  roll?: { after: string; dur: number; topics: string[] };
  segments: { id: string; gap: number }[];
  scenes: SceneData[];
  cost: { tts: number; image: number };
};

export type TimelineLine = { scene: string; i: number; seg: string; zh: string; start: number; end: number };

export type Timeline = {
  fps: number;
  duration: number;
  voice: { speaker: string; rate: number };
  segments: Record<string, { start: number; duration: number; hash: string }>;
  lines: TimelineLine[];
  scenes: Record<string, { start: number; end: number }>;
  roll: { start: number; dur: number; topics: string[] } | null;
  sfx: [number, string, number][];
};

/** 场景组件只拿到相对时间：at(i) = 本场景第 i 句开始的帧（相对场景开头），at(台词数) = dur */
export type SceneProps = { at: (i: number) => number; dur: number; from: number };

export type EpisodeModule = {
  episode: EpisodeJson;
  timeline: Timeline;
  scenes: Record<string, React.FC<SceneProps>>;
};
```

`shared/context.ts`：

```ts
import { createContext, useContext } from "react";
import type { EpisodeJson, Timeline } from "./types";

export const EpisodeCtx = createContext<{ episode: EpisodeJson; timeline: Timeline } | null>(null);

export const useEp = () => {
  const v = useContext(EpisodeCtx);
  if (!v) throw new Error("useEp 只能在 <Episode> 里面使用");
  return v;
};
```

- [ ] **Step 2: 公共动画组件**

`shared/ui.tsx`（由 `episode/src/ui.tsx` 迁移，素材路径加 `assets/` 前缀）：

```tsx
import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { FONT, FPS, INK, ORANGE } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const pop = (frame: number, at: number, damping = 11) =>
  spring({ frame: frame - at, fps: FPS, config: { damping, stiffness: 170, mass: 0.7 } });

/** 阿牛姿势：底部中点对齐 (x, bottom)，弹出 + 呼吸感；sign 写在举牌姿势的空白牌子上 */
export const Pose: React.FC<{ name: string; x: number; bottom?: number; h: number; at: number; sign?: React.ReactNode }> = ({
  name, x, bottom = 890, h, at, sign,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const s = (0.85 + 0.15 * pop(frame, at, 9)) * (1 + 0.012 * Math.sin(frame / 7));
  return (
    <div style={{ position: "absolute", left: x, top: bottom, transform: `translate(-50%,-100%) scale(${s})`, transformOrigin: "50% 100%" }}>
      <div style={{ position: "relative", height: h }}>
        <Img src={staticFile(`assets/pose_${name}.png`)} style={{ height: h, display: "block", filter: "drop-shadow(0 8px 10px rgba(0,0,0,.15))" }} />
        {sign && (
          <div style={{ position: "absolute", left: "4.8%", top: "2.4%", width: "87.8%", height: "25.1%", display: "flex",
            alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900, fontSize: h * 0.085, color: INK }}>
            {sign}
          </div>
        )}
      </div>
    </div>
  );
};

/** 道具贴纸，中心对齐 */
export const Sticker: React.FC<{ src: string; x: number; y: number; h: number; at: number; rot?: number; style?: React.CSSProperties }> = ({
  src, x, y, h, at, rot = 0, style,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <Img src={staticFile(`assets/prop_${src}.png`)} style={{ position: "absolute", left: x, top: y, height: h,
      transform: `translate(-50%,-50%) scale(${pop(frame, at)}) rotate(${rot}deg)`, filter: "drop-shadow(0 6px 8px rgba(0,0,0,.15))", ...style }} />
  );
};

/** 白底黑框卡片，右下橙色硬阴影 */
export const Card: React.FC<{ x: number; y: number; at: number; size?: number; fill?: string; color?: string; tilt?: number; children: React.ReactNode }> = ({
  x, y, at, size = 64, fill = "#fff", color = INK, tilt = 0, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at)}) rotate(${tilt}deg)`,
      background: fill, color, border: `5px solid ${INK}`, borderRadius: 26, boxShadow: `8px 8px 0 ${fill === ORANGE ? INK : ORANGE}`,
      padding: "16px 36px", fontFamily: FONT, fontSize: size, fontWeight: 900, whiteSpace: "nowrap", textAlign: "center", lineHeight: 1.25 }}>
      {children}
    </div>
  );
};

/** 无框大字，白色描边 */
export const BigText: React.FC<{ x: number; y: number; at: number; size: number; color?: string; slam?: boolean; children: React.ReactNode }> = ({
  x, y, at, size, color = INK, slam, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, slam ? 13 : 11);
  const s = slam ? interpolate(p, [0, 1], [2.6, 1]) : p;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, opacity: slam ? Math.min(1, p * 2) : 1,
      fontFamily: FONT, fontSize: size, fontWeight: 900, color, whiteSpace: "nowrap", WebkitTextStroke: `${Math.max(8, size * 0.07)}px #fff`,
      paintOrder: "stroke fill", textShadow: `0 ${size * 0.04}px 0 rgba(0,0,0,.12)` }}>
      {children}
    </div>
  );
};

export const Check: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 120 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + 8], [0, 1], clamp);
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 120 110" style={{ position: "absolute", left: x - size / 2, top: y - size * 0.45 }}>
      <path d="M12 58 L44 90 L108 14" fill="none" stroke="#22b14c" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="160" strokeDashoffset={160 * (1 - p)} />
    </svg>
  );
};

/** 从左到右画出的划线（划掉旧数字） */
export const Strike: React.FC<{ x: number; y: number; w: number; at: number }> = ({ x, y, w, at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + 7], [0, 1], clamp);
  return <div style={{ position: "absolute", left: x - w / 2, top: y - 7, width: w * p, height: 14, background: "#e2352b", borderRadius: 7, transform: "rotate(-6deg)", transformOrigin: "0 50%" }} />;
};
```

- [ ] **Step 3: 背景、进度条、字幕**

`shared/Frame.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useEp } from "./context";
import { FONT, FPS, INK, ORANGE, PAPER } from "./theme";

/** 米白底 + 浅灰点阵 + 四角橙色小涂鸦 */
export const Paper: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(#d9d2c4 2.2px, transparent 2.4px)", backgroundSize: "40px 40px", opacity: 0.7 }} />
    {[[40, 110, 0], [1380, 130, 40], [60, 1000, -30], [1370, 990, 15]].map(([x, y, r], i) => (
      <div key={i} style={{ position: "absolute", left: x, top: y, width: 34, height: 10, borderRadius: 5, background: ORANGE,
        transform: `rotate(${r}deg)`, opacity: 0.8 }} />
    ))}
  </AbsoluteFill>
);

/** 顶部常驻进度条：阿牛FIRE计划 ▓░░ 第x/100期 */
export const TopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { episode } = useEp();
  const grow = interpolate(frame, [6, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const trackW = 700;
  const fillW = Math.max(18, (trackW * episode.no) / episode.total) * grow;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 74, background: "#fff", borderBottom: `4px solid ${INK}`,
      display: "flex", alignItems: "center", gap: 26, padding: "0 34px", fontFamily: FONT }}>
      <div style={{ fontSize: 34, fontWeight: 900, color: INK }}>
        阿牛<span style={{ color: ORANGE }}>FIRE</span>计划
      </div>
      <div style={{ position: "relative", width: trackW, height: 24, border: `3px solid ${INK}`, borderRadius: 14, background: "#f1ece2", overflow: "hidden" }}>
        <div style={{ width: fillW, height: "100%", background: ORANGE, borderRadius: 12 }} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: INK }}>
        第 <span style={{ color: ORANGE }}>{episode.no}</span>/{episode.total} 期
      </div>
      <div style={{ marginLeft: "auto", fontSize: 24, fontWeight: 700, color: "#8a8378" }}>目标：早日退休</div>
    </div>
  );
};

/** 底部字幕：【】内的字标橙色；配音段 title 的台词不显示（画面上已有标题卡） */
export const Subtitles: React.FC = () => {
  const { timeline } = useEp();
  const t = useCurrentFrame() / FPS;
  const L = timeline.lines;
  const i = L.findIndex((s, k) => t >= s.start && t < (L[k + 1]?.start ?? timeline.duration));
  const sub = L[i];
  if (!sub || sub.seg === "title") return null;
  const parts = sub.zh.split(/(【[^】]+】)/).filter(Boolean);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, textAlign: "center", fontFamily: FONT, fontSize: 50,
      fontWeight: 900, color: INK, WebkitTextStroke: "11px #fff", paintOrder: "stroke fill", letterSpacing: 2 }}>
      {parts.map((p, k) => (p.startsWith("【") ? <span key={k} style={{ color: ORANGE }}>{p.slice(1, -1)}</span> : <span key={k}>{p}</span>))}
    </div>
  );
};
```

- [ ] **Step 4: 把一期拼成视频**

`shared/Episode.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { EpisodeCtx } from "./context";
import { Paper, Subtitles, TopBar } from "./Frame";
import { f, FPS } from "./theme";
import type { EpisodeModule } from "./types";

/** 每个场景放进自己的 <Sequence>，场景里 useCurrentFrame() 从 0 开始 */
export const Episode: React.FC<{ ep: EpisodeModule }> = ({ ep }) => {
  const { episode, timeline, scenes } = ep;
  if (timeline.fps !== FPS) throw new Error(`timeline.json 帧率 ${timeline.fps} 与 FPS ${FPS} 不一致`);
  return (
    <EpisodeCtx.Provider value={{ episode, timeline }}>
      <AbsoluteFill>
        <Paper />
        {episode.scenes.map((sc) => {
          const span = timeline.scenes[sc.id];
          if (!span) throw new Error(`场景 ${sc.id} 不在 timeline.json 里，先运行 tools/build_audio.py`);
          if (!scenes[sc.id]) throw new Error(`场景 ${sc.id} 没有对应的场景组件`);
          const from = f(span.start);
          const dur = Math.max(1, f(span.end) - from);
          const starts = timeline.lines.filter((l) => l.scene === sc.id).map((l) => f(l.start) - from);
          const at = (i: number) => {
            if (i < 0 || i > starts.length) throw new Error(`场景 ${sc.id} 没有第 ${i} 句（共 ${starts.length} 句）`);
            return i < starts.length ? starts[i] : dur;
          };
          const Scene = scenes[sc.id];
          return (
            <Sequence key={sc.id} from={from} durationInFrames={dur} name={`${sc.id} ${sc.name}`}>
              <Scene at={at} dur={dur} from={from} />
            </Sequence>
          );
        })}
        <Subtitles />
        <TopBar />
        {Object.entries(timeline.segments).map(([id, s]) => (
          <Sequence key={id} from={f(s.start)} name={`配音 ${id}`}>
            <Audio src={staticFile(`episodes/${episode.id}/audio/vo_${id}.mp3`)} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </EpisodeCtx.Provider>
  );
};
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc -p . && echo TSC_OK`
Expected: `TSC_OK`（此时 `episodes/` 还不存在，`include` 里缺目录不会报错）

- [ ] **Step 6: Commit**

```bash
git add shared/theme.ts shared/types.ts shared/context.ts shared/ui.tsx shared/Frame.tsx shared/Episode.tsx
git commit -m "公共组件：主题、类型、动画组件、背景/进度条/字幕、按场景拼接一期"
```

---

### Task 6: 第 1 期数据 + 配音

**Files:**
- Create: `episodes/ep001/episode.json`
- Create（由工具生成）: `episodes/ep001/audio/vo_*.mp3`、`words_*.json`、`timeline.json`

台词逐字取自 `episode/make_timeline.py` 的 `SEGMENTS`；音效取自其中的 `sfx` 列表，换算成场景内序号。

- [ ] **Step 1: 写 episode.json**

`episodes/ep001/episode.json`：

```json
{
  "id": "ep001",
  "no": 1,
  "total": 100,
  "stage": "review",
  "topic": {"candidates": [], "chosen": null, "rounds": []},
  "title": "月薪8千，想退休到底要攒多少钱？",
  "roll": {
    "after": "open",
    "dur": 1.2,
    "topics": ["应急金存几个月才够？", "看懂工资条：税前1万到手多少", "外卖vs带饭：一个月差多少钱", "花呗分期：利率到底多高", "存款100万，每月能有多少被动收入", "想裸辞又不敢？先存够这一笔钱"]
  },
  "segments": [
    {"id": "open", "gap": 0.3},
    {"id": "title", "gap": 1.4},
    {"id": "body", "gap": 0.5},
    {"id": "end", "gap": 0.6}
  ],
  "scenes": [
    {"id": "s01", "name": "开头举牌", "visual": "阿牛举牌，牌上写「第1期」",
     "lines": [{"seg": "open", "zh": "阿牛FIRE计划，第1期", "say": "阿牛Fire计划，第一期。"}],
     "sfx": [{"line": 0, "kind": "pop", "vol": 0.8}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s02", "name": "选题滚动", "visual": "阿牛指向右侧，选题卡片像老虎机一样滚动，停在本期标题",
     "lines": [{"seg": "open", "zh": "这一期聊：", "say": "这一期聊："},
               {"seg": "title", "zh": "月薪8千，想退休到底要攒多少钱？", "say": "月薪八千，想退休，到底要攒多少钱？"}],
     "sfx": [], "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s03", "name": "工资卡", "visual": "到手8000和每月花5000两张卡，阿牛从指向变成思考",
     "lines": [{"seg": "body", "zh": "到手【8000】，每月花【5000】", "say": "到手八千，每月花五千。"},
               {"seg": "body", "zh": "想不上班也有钱花", "say": "想不上班也有钱花，"},
               {"seg": "body", "zh": "到底要攒多少？", "say": "到底要攒多少？"}],
     "sfx": [{"line": 0, "kind": "whoosh", "vol": 0.7, "offset": -0.15}, {"line": 0, "kind": "pop", "vol": 0.7}, {"line": 2, "kind": "pop", "vol": 0.7}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s04", "name": "4%法则", "visual": "存钱罐每年漏出几枚金币，卡片写每年只花4%，打勾",
     "lines": [{"seg": "body", "zh": "有个简单的算法，叫【4%法则】", "say": "有个简单的算法，叫百分之四法则："},
               {"seg": "body", "zh": "每年只花存款的【4%】", "say": "每年只花存款的百分之四，"},
               {"seg": "body", "zh": "钱基本就花不完", "say": "钱基本就花不完。"}],
     "sfx": [{"line": 0, "kind": "pop", "vol": 0.7}, {"line": 1, "kind": "pop", "vol": 0.7}, {"line": 2, "kind": "pop", "vol": 0.7}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s05", "name": "年支出×25", "visual": "公式卡：年支出 × 25 = 退休数字，阿牛按计算器",
     "lines": [{"seg": "body", "zh": "反过来算", "say": "反过来算："},
               {"seg": "body", "zh": "一年花多少，【乘以25】", "say": "一年花多少，乘以二十五，"},
               {"seg": "body", "zh": "就是你的【退休数字】", "say": "就是你的退休数字。"}],
     "sfx": [{"line": 1, "kind": "pop", "vol": 0.7}, {"line": 2, "kind": "pop", "vol": 0.7}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s06", "name": "150万", "visual": "算式逐行出现，150万砸下来画面震动，阿牛受惊，旁边一个钱袋",
     "lines": [{"seg": "body", "zh": "每月5000，一年【6万】", "say": "每月五千，一年六万，"},
               {"seg": "body", "zh": "再乘以25", "say": "再乘以二十五，"},
               {"seg": "body", "zh": "【150万】", "say": "一百五十万。"}],
     "sfx": [{"line": 0, "kind": "pop", "vol": 0.7}, {"line": 1, "kind": "pop", "vol": 0.7}, {"line": 2, "kind": "stamp", "vol": 1.0}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s07", "name": "好消息", "visual": "阿牛先摊手「很吓人？」，再指向「好消息」卡片：花得越少，要攒的越少",
     "lines": [{"seg": "body", "zh": "很吓人？", "say": "很吓人？"},
               {"seg": "body", "zh": "别急，这个公式藏着一个【好消息】", "say": "别急，这个公式藏着一个好消息："},
               {"seg": "body", "zh": "花得越少，要攒的就【越少】", "say": "花得越少，要攒的就越少。"}],
     "sfx": [{"line": 1, "kind": "pop", "vol": 0.7}, {"line": 2, "kind": "pop", "vol": 0.7}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s08", "name": "少花1000", "visual": "150万被划掉改成120万，外卖和奶茶飞走，打勾，阿牛欢呼",
     "lines": [{"seg": "body", "zh": "每月少花【1000】", "say": "每月少花一千，"},
               {"seg": "body", "zh": "目标直接少【30万】", "say": "目标直接少三十万。"}],
     "sfx": [{"line": 0, "kind": "pop", "vol": 0.7}, {"line": 1, "kind": "pop", "vol": 0.9}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s09", "name": "先算清楚", "visual": "「第一步不是赚更多」被划掉，「先算清楚」橙色卡，日历和计算器",
     "lines": [{"seg": "body", "zh": "所以第一步不是赚更多", "say": "所以第一步不是赚更多，"},
               {"seg": "body", "zh": "而是先【算清楚】", "say": "而是先算清楚："},
               {"seg": "body", "zh": "你一个月到底花多少钱", "say": "你一个月到底花多少钱。"}],
     "sfx": [{"line": 0, "kind": "whoosh", "vol": 0.6, "offset": -0.1}],
     "textStatus": "approved", "status": "pending", "rounds": []},
    {"id": "s10", "name": "结尾", "visual": "阿牛举牌「你的数字是？」，再挥手：关注阿牛，一起早日退休！加头像和免责小字",
     "lines": [{"seg": "end", "zh": "你每月花多少？", "say": "你每月花多少？"},
               {"seg": "end", "zh": "评论区算算你的【退休数字】", "say": "评论区算算你的退休数字。"},
               {"seg": "end", "zh": "关注阿牛", "say": "关注阿牛，"},
               {"seg": "end", "zh": "一起【早日退休】！", "say": "一起早日退休！"}],
     "sfx": [{"line": 0, "kind": "whoosh", "vol": 0.7, "offset": -0.15}, {"line": 1, "kind": "pop", "vol": 0.6}, {"line": 2, "kind": "pop", "vol": 0.8}, {"line": 3, "kind": "stamp", "vol": 0.6}],
     "textStatus": "approved", "status": "pending", "rounds": []}
  ],
  "cost": {"tts": 0, "image": 0}
}
```

- [ ] **Step 2: 生成配音和时间轴**

这一步真实调用豆包 TTS，约 254 字（0.08 元，先扣免费额度）。

Run: `.venv/bin/python tools/build_audio.py episodes/ep001`
Expected: 打印 4 行 `配音 <段>：N 字`，最后一行形如 `时长 4x.xs，10 个场景，本次配音 254 字（约 0.08 元）`

- [ ] **Step 3: 再跑一次，确认走缓存**

Run: `.venv/bin/python tools/build_audio.py episodes/ep001`
Expected: 不打印「配音」行，最后一行为 `…本次配音 0 字（约 0.00 元）`

- [ ] **Step 4: 检查时间轴**

Run:

```bash
.venv/bin/python -c "
import json; t = json.load(open('episodes/ep001/audio/timeline.json'))
print(len(t['lines']), 'lines', len(t['sfx']), 'sfx', 'roll', t['roll']['start'])
for k, v in t['scenes'].items(): print(k, round(v['start'], 2), '→', round(v['end'], 2))"
```

Expected: `27 lines 27 sfx roll 3.xx`（21 个场景音效 + 6 个选题嘀嗒声），10 个场景首尾相接：s01 从 0.0 开始，每个场景的结束时间等于下一个场景的开始时间

- [ ] **Step 5: Commit**

```bash
git add episodes/ep001/episode.json episodes/ep001/audio/
git commit -m "第 1 期迁移：episode.json（10 个场景的台词、画面大意、音效）+ 配音和时间轴"
```

---

### Task 7: 第 1 期的 10 个场景 + composition 注册

**Files:**
- Create: `episodes/ep001/scenes/s01.tsx` … `s10.tsx`
- Create: `episodes/ep001/index.ts`
- Create: `episodes/index.ts`
- Create: `shared/Root.tsx`
- Create: `shared/index.ts`

场景代码由 `episode/src/Open.tsx`、`Body.tsx`、`End.tsx` 迁移。换算规则：旧代码里 `B(k)` 改为 `at(k − 本场景第一句的正文序号)`；`segStart(...)` 改为 `0`；引用下一个场景第一句的 `B(k)` 改为 `at(本场景台词数)`。

- [ ] **Step 1: 开头两个场景**

`episodes/ep001/scenes/s01.tsx`：

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { useEp } from "../../../shared/context";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Pose } from "../../../shared/ui";

/** 固定开头：阿牛举牌「第x期」 */
const S01: React.FC<SceneProps> = ({ at }) => {
  const { episode } = useEp();
  return (
    <AbsoluteFill>
      <Pose name="sign" x={720} h={760} at={Math.max(0, at(0) - 4)}
        sign={<span>第<span style={{ color: ORANGE }}>{episode.no}</span>期</span>} />
    </AbsoluteFill>
  );
};
export default S01;
```

`episodes/ep001/scenes/s02.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useEp } from "../../../shared/context";
import { FONT, INK, ORANGE, f } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Pose, pop } from "../../../shared/ui";

/** 固定开头：选题像老虎机一样滚动，先快后慢，停在本期选题 */
const S02: React.FC<SceneProps> = ({ from }) => {
  const frame = useCurrentFrame();
  const { timeline } = useEp();
  const roll = timeline.roll!;
  const topics = roll.topics;
  const n = topics.length;
  const s = f(roll.start) - from, d = f(roll.dur);
  const u = Math.min(1, Math.max(0, (frame - s) / d));
  const idx = (n - 1) * (1 - Math.pow(1 - u, 3)); // 缓出：与音效时间点同一条曲线
  const speed = frame >= s && u < 1 ? (3 * (n - 1) * Math.pow(1 - u, 2)) / d : 0; // 每帧滚过的卡片数
  const settled = frame >= s + d;
  const sp = settled ? pop(frame, s + d, 8) : 0;
  const CY = 470, GAP = 176;
  return (
    <AbsoluteFill>
      <Pose name="point" x={250} h={600} at={0} />
      <div style={{ position: "absolute", left: 440, top: 120, fontFamily: FONT, fontSize: 52, fontWeight: 900, color: INK }}>
        这一期聊<span style={{ color: ORANGE }}>：</span>
      </div>
      <div style={{ position: "absolute", left: 440, top: CY - 300, width: 940, height: 600, overflow: "hidden",
        maskImage: "linear-gradient(transparent, #000 22%, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(transparent, #000 22%, #000 78%, transparent)" }}>
        {topics.map((t, k) => {
          const off = (k - idx) * GAP;
          if (Math.abs(off) > 420) return null;
          const final = k === n - 1;
          const far = Math.min(1, Math.abs(off) / 360);
          const scale = (1 - far * 0.12) * (final && settled ? 1 + 0.07 * Math.sin(Math.min(1, sp) * Math.PI) : 1);
          return (
            <div key={k} style={{ position: "absolute", left: 20, top: 300 + off - 66, width: 900, height: 132, borderRadius: 24,
              background: final && settled ? ORANGE : "#fff", border: `5px solid ${INK}`, boxShadow: `8px 8px 0 ${final && settled ? INK : ORANGE}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900,
              fontSize: t.length > 14 ? 44 : 52, color: final && settled ? "#fff" : INK, opacity: 1 - far * 0.6,
              transform: `scale(${scale})`, filter: `blur(${Math.min(5, speed * 9)}px)` }}>
              {t}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
export default S02;
```

- [ ] **Step 2: 正文前三个场景**

`episodes/ep001/scenes/s03.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose } from "../../../shared/ui";

const mid = (a: number, b: number) => Math.round((a + b) / 2);

/** 到手8000，每月花5000，到底要攒多少？ */
const S03: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Card x={480} y={320} at={at(0)} size={52}>到手<br /><span style={{ fontSize: 110 }}>¥8000</span></Card>
      <Card x={480} y={640} at={mid(at(0), at(1))} size={52}>每月花<br /><span style={{ fontSize: 110, color: ORANGE }}>¥5000</span></Card>
      <Pose name={frame < at(1) ? "point" : "think"} x={1080} h={640} at={frame < at(1) ? 0 : at(1)} />
      <Card x={1080} y={170} at={at(2)} size={60} fill={ORANGE} color="#fff" tilt={-4}>要攒多少？</Card>
    </AbsoluteFill>
  );
};
export default S03;
```

`episodes/ep001/scenes/s04.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Check, Pose, Sticker, clamp } from "../../../shared/ui";

/** 4%法则：每年只花4%，钱基本花不完 */
const S04: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const coins = [0, 1, 2].map((k) => {
    const t = at(1) + 8 + k * 16;
    if (frame < t) return null;
    const p = interpolate(frame, [t, t + 22], [0, 1], clamp);
    return <Sticker key={k} src="coin" x={470 + k * 30} y={640 + 200 * p} h={70} at={t} style={{ opacity: 1 - p }} />;
  });
  return (
    <AbsoluteFill>
      <Card x={720} y={180} at={at(0)} size={88}>4% 法则</Card>
      <Sticker src="piggy" x={500} y={520} h={300} at={at(1)} />
      {coins}
      <Card x={930} y={430} at={at(1) + 6} size={54}>每年只花 <span style={{ color: ORANGE }}>4%</span></Card>
      <Card x={930} y={620} at={at(2)} size={54}>钱基本花不完</Card>
      <Check x={1210} y={600} at={at(2) + 6} />
      <Pose name="point" x={1270} h={420} at={at(0)} />
    </AbsoluteFill>
  );
};
export default S04;
```

`episodes/ep001/scenes/s05.tsx`：

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose } from "../../../shared/ui";

/** 年支出 × 25 = 退休数字 */
const S05: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <BigText x={720} y={190} at={at(0)} size={70}>反过来算</BigText>
    <Card x={300} y={420} at={at(1)} size={66}>年支出</Card>
    <BigText x={560} y={420} at={at(1) + 6} size={90}>×</BigText>
    <Card x={760} y={420} at={at(1) + 10} size={80} fill={ORANGE} color="#fff">25</Card>
    <BigText x={960} y={420} at={at(2)} size={90}>=</BigText>
    <Card x={1180} y={420} at={at(2) + 4} size={66}>退休数字</Card>
    <Pose name="calc" x={720} h={360} at={at(0)} />
  </AbsoluteFill>
);
export default S05;
```

- [ ] **Step 3: 正文后四个场景**

`episodes/ep001/scenes/s06.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, Sticker } from "../../../shared/ui";

/** 5000×12=6万，6万×25=150万 */
const S06: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const shake = frame >= at(2) && frame < at(2) + 10 ? Math.sin(frame * 3.1) * 12 : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <BigText x={720} y={200} at={at(0)} size={76}>5000 × 12 = <span style={{ color: ORANGE }}>6万</span></BigText>
      <BigText x={720} y={330} at={at(1)} size={76}>6万 × 25 =</BigText>
      <BigText x={660} y={600} at={at(2)} size={240} color={ORANGE} slam>150万</BigText>
      <Sticker src="moneybag" x={250} y={720} h={260} at={at(2) + 3} rot={-8} />
      <Pose name="shock" x={1210} h={540} at={at(2)} />
    </AbsoluteFill>
  );
};
export default S06;
```

`episodes/ep001/scenes/s07.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose } from "../../../shared/ui";

const mid = (a: number, b: number) => Math.round((a + b) / 2);

/** 很吓人？好消息：花得越少，要攒的就越少 */
const S07: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const shrug = frame < at(1);
  return (
    <AbsoluteFill>
      {shrug && <BigText x={720} y={190} at={at(0)} size={84}>很吓人？</BigText>}
      <Pose name={shrug ? "shrug" : "point"} x={shrug ? 720 : 300} h={shrug ? 620 : 600} at={shrug ? at(0) : at(1)} />
      {!shrug && <Card x={880} y={230} at={at(1)} size={70} fill={ORANGE} color="#fff" tilt={-3}>好消息</Card>}
      {!shrug && <Card x={880} y={470} at={at(2)} size={60}>花得越少 ↓</Card>}
      {!shrug && <Card x={880} y={660} at={mid(at(2), at(3))} size={60}>要攒的越少 <span style={{ color: ORANGE }}>↓</span></Card>}
    </AbsoluteFill>
  );
};
export default S07;
```

`episodes/ep001/scenes/s08.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Check, Pose, Sticker, Strike, clamp } from "../../../shared/ui";

/** 每月少花1000，目标少30万 */
const S08: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const fly = interpolate(frame, [at(0) + 18, at(0) + 32], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <BigText x={600} y={260} at={at(0)} size={170}>150万</BigText>
      <Strike x={600} y={260} w={560} at={at(1) - 6} />
      <Sticker src="takeout" x={210 - 500 * fly} y={620} h={190} at={at(0) + 4} rot={-10} />
      <Sticker src="tea" x={380 - 500 * fly} y={700} h={170} at={at(0) + 8} rot={8} />
      <Card x={300} y={470} at={at(0) + 2} size={48}>每月少花 <span style={{ color: ORANGE }}>¥1000</span></Card>
      <BigText x={680} y={560} at={at(1)} size={190} color={ORANGE}>120万</BigText>
      <Card x={700} y={760} at={at(1) + 8} size={52} fill={ORANGE} color="#fff">目标 -30万</Card>
      <Check x={1010} y={540} at={at(1) + 12} size={140} />
      <Pose name="cheer" x={1260} h={520} at={at(1)} />
    </AbsoluteFill>
  );
};
export default S08;
```

`episodes/ep001/scenes/s09.tsx`：

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker, Strike } from "../../../shared/ui";

/** 第一步：先算清楚每月花多少 */
const S09: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <Pose name="calc" x={260} h={600} at={at(0)} />
    <Card x={860} y={190} at={at(0)} size={56}>第一步不是赚更多</Card>
    <Strike x={940} y={190} w={330} at={at(0) + 14} />
    <Card x={860} y={400} at={at(1)} size={92} fill={ORANGE} color="#fff" tilt={-2}>先算清楚</Card>
    <Sticker src="calendar" x={720} y={640} h={190} at={at(2)} rot={-6} />
    <Sticker src="calc" x={1000} y={640} h={190} at={at(2) + 5} rot={6} />
    <BigText x={860} y={810} at={at(2) + 8} size={50} color={INK}>一个月到底花多少？</BigText>
  </AbsoluteFill>
);
export default S09;
```

- [ ] **Step 4: 结尾场景**

`episodes/ep001/scenes/s10.tsx`：

```tsx
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, pop } from "../../../shared/ui";

/** 固定结尾：举牌提问 → 挥手「关注阿牛，一起早日退休！」+ 免责小字 */
const S10: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const ask = frame < at(2);
  return (
    <AbsoluteFill>
      {ask ? (
        <Pose name="sign" x={720} h={760} at={at(0) - 4} sign={<span>你的数字<span style={{ color: ORANGE }}>是？</span></span>} />
      ) : (
        <>
          <Pose name="wave" x={420} h={680} at={at(2)} />
          <BigText x={1000} y={330} at={at(2)} size={100}>关注阿牛</BigText>
          <BigText x={1000} y={480} at={at(3)} size={100} color={ORANGE}>一起早日退休！</BigText>
          <Img src={staticFile("assets/avatar.jpg")} style={{ position: "absolute", left: 1000 - 90, top: 590, width: 180, height: 180, borderRadius: "50%",
            border: `5px solid ${INK}`, transform: `scale(${pop(frame, at(2) + 6)})` }} />
        </>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: FONT, fontSize: 22, color: "#8a8378" }}>
        虚拟角色 · 模拟测算 · 未计入养老金 · 不构成投资建议
      </div>
    </AbsoluteFill>
  );
};
export default S10;
```

- [ ] **Step 5: 组装第 1 期并注册 composition**

`episodes/ep001/index.ts`：

```ts
import type { EpisodeJson, EpisodeModule, Timeline } from "../../shared/types";
import timeline from "./audio/timeline.json";
import episode from "./episode.json";
import s01 from "./scenes/s01";
import s02 from "./scenes/s02";
import s03 from "./scenes/s03";
import s04 from "./scenes/s04";
import s05 from "./scenes/s05";
import s06 from "./scenes/s06";
import s07 from "./scenes/s07";
import s08 from "./scenes/s08";
import s09 from "./scenes/s09";
import s10 from "./scenes/s10";

const ep: EpisodeModule = {
  episode: episode as unknown as EpisodeJson,
  timeline: timeline as unknown as Timeline,
  scenes: { s01, s02, s03, s04, s05, s06, s07, s08, s09, s10 },
};
export default ep;
```

`episodes/index.ts`：

```ts
import type { EpisodeModule } from "../shared/types";
import ep001 from "./ep001";

export const EPISODES: EpisodeModule[] = [ep001];
```

`shared/Root.tsx`：

```tsx
import React from "react";
import { Composition } from "remotion";
import { EPISODES } from "../episodes";
import { Episode } from "./Episode";
import { FPS, f } from "./theme";

// 每期一个组件，避免把场景组件放进 defaultProps（defaultProps 必须可序列化）
const COMPS = EPISODES.map((ep) => ({ ep, C: () => <Episode ep={ep} /> }));

export const Root: React.FC = () => (
  <>
    {COMPS.map(({ ep, C }) => (
      <Composition key={ep.episode.id} id={ep.episode.id} component={C}
        durationInFrames={f(ep.timeline.duration)} fps={FPS} width={1440} height={1080} />
    ))}
  </>
);
```

`shared/index.ts`：

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
```

- [ ] **Step 6: 类型检查**

Run: `npx tsc -p . && echo TSC_OK`
Expected: `TSC_OK`

- [ ] **Step 7: 渲染一张截图核对**

Run:

```bash
FR=$(.venv/bin/python -c "import json;t=json.load(open('episodes/ep001/audio/timeline.json'));print(int((t['scenes']['s06']['end']-0.3)*30))")
npx remotion still shared/index.ts ep001 /tmp/ep001-s06.png --frame=$FR --log=error && ls -la /tmp/ep001-s06.png
```

Expected: 生成 `/tmp/ep001-s06.png`。用图片查看工具打开：顶部进度条显示「第 1/100 期」，中间是橙色「150万」、左下钱袋、右侧受惊的阿牛，底部字幕「150万」为橙色

- [ ] **Step 8: Commit**

```bash
git add episodes/ep001/scenes/ episodes/ep001/index.ts episodes/index.ts shared/Root.tsx shared/index.ts
git commit -m "第 1 期拆成 10 个场景文件，按期注册 composition"
```

---

### Task 8: 渲染整期工具

**Files:**
- Create: `tools/render.py`

- [ ] **Step 1: 写实现**

`tools/render.py`：

```python
"""渲染整期：同步静态文件 → Remotion 渲染画面 → 混入背景音乐和音效。

  .venv/bin/python tools/render.py episodes/ep001           # → out/ep001/ep001.mp4
  .venv/bin/python tools/render.py episodes/ep001 --draft   # → out/ep001/ep001-draft.mp4
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.audio_timeline import segment_hash, segment_speech  # noqa: E402
from tools.sync_public import sync  # noqa: E402


def check_timeline(episode: dict, timeline: dict, voice: dict, dir_name: str) -> None:
    """时间轴必须和当前 episode.json、音色一致，否则渲染出来的字幕和配音会对不上。"""
    if episode["id"] != dir_name:
        raise RuntimeError(f"episode.json 的 id（{episode['id']}）与目录名（{dir_name}）不一致")
    stale = []
    for seg, text in segment_speech(episode).items():
        have = timeline.get("segments", {}).get(seg, {}).get("hash")
        if have != segment_hash(voice["speaker"], voice["rate"], text):
            stale.append(f"配音段 {seg}")
    want = [(sc["id"], i, ln["zh"]) for sc in episode["scenes"] for i, ln in enumerate(sc["lines"])]
    got = [(ln["scene"], ln["i"], ln["zh"]) for ln in timeline.get("lines", [])]
    if want != got:
        stale.append("台词/字幕")
    if stale:
        raise RuntimeError(f"timeline.json 已过期（{'、'.join(stale)}与 episode.json 不一致），先运行 tools/build_audio.py")


def render(ep_dir: Path, draft: bool = False) -> Path:
    episode = json.loads((ep_dir / "episode.json").read_text())
    timeline = json.loads((ep_dir / "audio/timeline.json").read_text())
    voice = json.loads((ROOT / "studio/config.json").read_text())["voice"]
    check_timeline(episode, timeline, voice, ep_dir.name)
    eid = episode["id"]
    out = ROOT / "out" / eid
    out.mkdir(parents=True, exist_ok=True)
    sync(ROOT)
    raw = out / f"{eid}_raw.mp4"
    subprocess.run(["npx", "remotion", "render", "shared/index.ts", eid, str(raw), "--log=error"], cwd=ROOT, check=True)
    final = out / f"{eid}{'-draft' if draft else ''}.mp4"
    subprocess.run([sys.executable, str(ROOT / "opening/make_audio.py"), str(raw), str(final),
                    str(ep_dir / "audio/timeline.json")], check=True)
    return final


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", type=Path)
    ap.add_argument("--draft", action="store_true")
    a = ap.parse_args()
    print("→", render(a.episode.resolve(), a.draft))
```

- [ ] **Step 2: 渲染第 1 期**

Run: `.venv/bin/python tools/render.py episodes/ep001`
Expected: 最后一行 `→ /Users/Doc/agent/xhs-video-pipeline/out/ep001/ep001.mp4`

- [ ] **Step 3: 检查成片的音视频参数**

Run:

```bash
F=$(.venv/bin/python -c "import imageio_ffmpeg as m; print(m.get_ffmpeg_exe())")
$F -hide_banner -i out/ep001/ep001.mp4 2>&1 | grep -E "Duration|Video:|Audio:"
$F -hide_banner -i out/ep001/ep001.mp4 -vn -af "ebur128=framelog=quiet" -f null - 2>&1 | grep -E "^\s+I:"
$F -hide_banner -i out/ep001/ep001.mp4 -vn -af "silencedetect=noise=-35dB:d=0.25" -f null - 2>&1 | grep -c silence_end
```

Expected: 视频 `1440x1080`、`30 fps`；音频 `48000 Hz`；响度 `I:` 在 -15 到 -13 LUFS 之间；静音段计数 `0`

- [ ] **Step 4: Commit**

```bash
git add tools/render.py
git commit -m "渲染整期工具：同步素材 → Remotion 渲染 → 混音"
```

---

### Task 9: 迁移校验（新旧逐场景对比）

**Files:**
- Create: `tools/compare_frames.py`

旧版成片 `episode/out/ep1.mp4` 和新版的配音是分别合成的，时间会有零点几秒的差别，所以不做逐帧比对，而是在每个场景结束前 0.3 秒（元素都已出现）各取一帧对比。

- [ ] **Step 1: 写实现**

`tools/compare_frames.py`：

```python
"""迁移校验：每个场景在旧版成片和新版成片里各取一帧（场景结束前 0.3 秒），并排对比。

  git show bc96c1b:episode/public/timeline.json > /tmp/old_timeline.json   # 旧时间轴（旧工程已删除，从 git 历史取）
  .venv/bin/python tools/compare_frames.py out/legacy/ep1.mp4 /tmp/old_timeline.json out/ep001/ep001.mp4 episodes/ep001

输出 out/ep001/compare.jpg；任一场景平均灰度差 > 14 时退出码为 1。
旧时间轴的 subs 与新 episode.json 的台词一一对应（共 27 句），据此算出旧版各场景的结束时间。
"""

import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

THRESHOLD = 14
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"


def grab(video: Path, t: float, path: Path) -> Image.Image:
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(video),
                    "-frames:v", "1", str(path)], check=True)
    return Image.open(path).convert("RGB")


def main():
    old_mp4, old_tl_path, new_mp4, ep_dir = map(Path, sys.argv[1:5])
    if not old_mp4.exists():
        sys.exit(f"找不到旧版成片 {old_mp4}")
    old = json.loads(old_tl_path.read_text())
    ep = json.loads((ep_dir / "episode.json").read_text())
    new = json.loads((ep_dir / "audio/timeline.json").read_text())
    firsts, k = [], 0
    for sc in ep["scenes"]:
        firsts.append(k)
        k += len(sc["lines"])
    if k != len(old["subs"]):
        sys.exit(f"台词数不一致：新版 {k} 句，旧版 {len(old['subs'])} 句")

    tmp = new_mp4.parent / "compare"
    tmp.mkdir(exist_ok=True)
    w, h = 480, 360
    font = ImageFont.truetype(FONT, 24, index=2)
    sheet = Image.new("RGB", (w * 2, h * len(firsts)), "white")
    d = ImageDraw.Draw(sheet)
    bad = []
    for j, sc in enumerate(ep["scenes"]):
        old_end = old["subs"][firsts[j + 1]]["start"] if j + 1 < len(firsts) else old["duration"]
        new_end = new["scenes"][sc["id"]]["end"]
        a = grab(old_mp4, old_end - 0.3, tmp / f"{sc['id']}_old.png").resize((w, h))
        b = grab(new_mp4, new_end - 0.3, tmp / f"{sc['id']}_new.png").resize((w, h))
        diff = float(np.abs(np.asarray(a.convert("L"), float) - np.asarray(b.convert("L"), float)).mean())
        flag = diff > THRESHOLD
        sheet.paste(a, (0, j * h))
        sheet.paste(b, (w, j * h))
        d.text((8, j * h + 84), f"{sc['id']} {sc['name']} · 旧", font=font, fill="red")
        d.text((w + 8, j * h + 84), f"新 · 差异 {diff:.1f}{' ⚠' if flag else ''}", font=font, fill="red")
        print(f"{sc['id']} {sc['name']:<8} 差异 {diff:5.1f}  {'⚠ 超出' if flag else 'ok'}")
        if flag:
            bad.append(sc["id"])
    out = new_mp4.parent / "compare.jpg"
    sheet.save(out, quality=85)
    print("对比图 →", out)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行对比**

Run: `.venv/bin/python tools/compare_frames.py out/legacy/ep1.mp4 /tmp/old_timeline.json out/ep001/ep001.mp4 episodes/ep001; echo "exit $?"`
Expected: 10 行 `s01 … s10 差异 x.x ok`，最后 `exit 0`

如果有场景标 `⚠ 超出`：打开 `out/ep001/compare.jpg` 看那一行左右两张图的差别，回到 Task 7 对照换算规则修正对应的场景文件，重新执行 Task 8 Step 2 和本步骤。

- [ ] **Step 3: 人工看一遍对比图**

用图片查看工具打开 `out/ep001/compare.jpg`，逐行确认左右两张图的元素和位置一致（阿牛的呼吸缩放、字幕所在句可能有轻微差别，属正常）。

- [ ] **Step 4: Commit**

```bash
git add tools/compare_frames.py
git commit -m "迁移校验工具：新旧成片逐场景取帧并排对比"
```

---

### Task 10: 清理旧工程 + 更新说明

**Files:**
- Delete: `episode/`（旧的单文件工程）
- Modify: `README.md`

- [ ] **Step 1: 保留旧样片，删除旧工程**

Run:

```bash
mkdir -p out/legacy && mv episode/out/ep1.mp4 out/legacy/ep1.mp4
git rm -r -q episode && rm -rf episode
ls out/legacy && test ! -e episode && echo REMOVED
```

Expected: 输出 `ep1.mp4` 和 `REMOVED`

- [ ] **Step 2: 确认没有地方还引用旧工程**

Run: `grep -rn --include=*.py --include=*.ts --include=*.tsx --include=*.json -E "(\.\./|/)episode/" tools shared episodes studio opening aniu pipeline.py 2>/dev/null | grep -v node_modules || echo NO_REFS`
Expected: `NO_REFS`

- [ ] **Step 3: 更新 README**

在 `README.md` 末尾追加：

````markdown
## 分场景的期数结构（2026-10-31 起）

```
studio/config.json        全局配音音色和语速
assets/                   阿牛姿势、道具、头像（aniu/make_assets.py 直接生成到这里）
shared/                   公共组件和 Remotion 入口（shared/index.ts）
episodes/ep001/
  episode.json            本期数据：台词（zh 字幕 / say 朗读）、画面大意、音效、状态
  scenes/s01.tsx …        每个场景一个文件，只用相对时间 at(i)
  audio/                  配音和时间轴（tools/build_audio.py 生成）
out/ep001/                成片（不进 git）
```

```bash
.venv/bin/python tools/build_audio.py episodes/ep001    # 只重配台词变了的段
.venv/bin/python tools/render.py episodes/ep001         # → out/ep001/ep001.mp4
npm run video:studio                                    # 在 Remotion Studio 里预览
.venv/bin/python -m pytest tests -q                     # 单元测试
```
````

- [ ] **Step 4: 全量验证**

Run: `.venv/bin/python -m pytest tests -q && npx tsc -p . && echo ALL_OK`
Expected: `33 passed` 和 `ALL_OK`

- [ ] **Step 5: Commit 并推送**

```bash
git add -A README.md episode
git commit -m "删除旧的单文件第 1 期工程，README 说明新结构"
git push
```
