"""配音时间轴的纯计算部分：不读写文件、不联网，供 build_audio.py 使用。"""

import difflib
import hashlib
import math
import re

FPS = 30
TAIL = 0.25        # 每段最后一个字之后留的余量（秒）
END_PAD = 1.2      # 全片最后留白（秒）
ROLL_LEAD = 0.05
SFX_MAX = 8                       # 每分钟场景音效上限（选题滚动的咔哒不算），长视频按分钟数放大
SFX_KIND_MAX = {"pop": 4, "stamp": 3}
SFX_GAP = 1.5                     # 两个场景音效最少间隔（秒）   # 选题滚动在前一段配音结束后多久开始（秒）
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


def pace_plan(episode: dict) -> dict[str, list[tuple[int, float]]]:
    """配音节奏：episode["pace"] = {"line": 句间加停秒数, "scene": 换片加停秒数}。
    返回 {段名: [(这一句的字数, 之后加停多少秒), ...]}，每段最后一句不加。没有 pace 返回 {}。"""
    pace = episode.get("pace") if "pace" in episode else default_pace()
    pace = pace or {}
    if not (pace.get("line") or pace.get("scene")):
        return {}
    flat = [(sc["id"], ln) for sc in episode["scenes"] for ln in sc["lines"]]
    plan: dict[str, list] = {}
    for k, (sid, ln) in enumerate(flat):
        nxt = flat[k + 1] if k + 1 < len(flat) else None
        if not nxt or nxt[1]["seg"] != ln["seg"]:
            continue
        p = pace.get("scene", 0) if nxt[0] != sid else pace.get("line", 0)
        cum = sum(len(norm(x["say"])) for _, x in flat[:k + 1] if x["seg"] == ln["seg"])
        plan.setdefault(ln["seg"], []).append((cum, round(float(p), 3)))
    return plan


def default_pace() -> dict:
    """全局节奏：studio/config.json 的 pace（每期可在 episode.json 里写 pace 覆盖）。"""
    import json
    from pathlib import Path
    cfg = Path(__file__).resolve().parent.parent / "studio/config.json"
    return (json.loads(cfg.read_text()).get("pace") if cfg.exists() else None) or {}


def pace_tag(plan: list | None) -> str:
    return ("|pace:" + ",".join(f"{c}:{p}" for c, p in plan)) if plan else ""


def pace_cuts(speech: str, words, plan: list, silences=()) -> list[tuple[float, float]]:
    """只在句子之间真正的静音里切开加停，返回 [(切点秒, 加停秒), ...]。
    TTS 时间戳常比声音早，按时间戳切会切到上一个字的尾音（听起来像卡顿），所以句子边界附近没有静音就不加。"""
    st, en = char_times(speech, words)
    cuts = []
    for c, p in plan:
        if not (0 < c < len(st) and p > 0):
            continue
        b = (en[c - 1] + st[c]) / 2
        near = [(s, e) for s, e in silences if s - 0.25 <= b <= e + 0.25 and e - s >= 0.08]
        if near:
            s, e = min(near, key=lambda x: abs((x[0] + x[1]) / 2 - b))
            cuts.append((round((s + e) / 2, 3), p))
    return cuts


def shift_words(words, cuts) -> list[tuple[float, float, str]]:
    out = []
    for s, e, w in words:
        d = sum(p for t, p in cuts if t <= s)
        out.append((round(s + d, 3), round(e + d, 3), w))
    return out


def segment_hash(speaker: str, rate: int, speech: str) -> str:
    return hashlib.sha1(f"{speaker}|{rate}|{speech}".encode()).hexdigest()[:12]


def expand_sfx(episode: dict, lines: list[dict], roll: dict | None) -> list[list]:
    """场景里按台词序号写的音效 → [[绝对秒, 种类, 音量], ...]，加上选题滚动的咔哒声和停下时的叮，按时间排序。"""
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
    out = limit_sfx(sorted(out))
    if roll:
        n = len(roll["topics"])
        for j in range(1, n):
            p = 1 - (1 - j / (n - 1)) ** (1 / 3)   # 与画面同一条缓动曲线的反函数
            final = j == n - 1
            out.append([round(roll["start"] + roll["dur"] * p, 3), "ding" if final else "tick", 0.9 if final else 0.7])
    return sorted(out)


def limit_sfx(events: list[list]) -> list[list]:
    """音效不能密：按时间先到先得，离上一个太近、这种用满了、总数满了的都去掉。"""
    kept, used = [], {}
    k = max(1, math.ceil(events[-1][0] / 60)) if events else 1  # 视频有几分钟
    for t, kind, vol in events:
        if kind not in SFX_KIND_MAX and kind in ("whoosh",):
            continue  # 已停用的音效
        if kept and t - kept[-1][0] < SFX_GAP:
            continue
        if used.get(kind, 0) >= SFX_KIND_MAX.get(kind, SFX_MAX) * k or len(kept) >= SFX_MAX * k:
            continue
        kept.append([t, kind, vol])
        used[kind] = used.get(kind, 0) + 1
    return kept


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
            nxt = base + st[k + n] if k + n < len(st) else None
            if nxt is not None and start >= nxt - 0.05:  # 吸附越过了下一句的开头（短句后紧跟停顿），不吸附
                start = base + st[k]
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
