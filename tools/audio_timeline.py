"""配音时间轴的纯计算部分：不读写文件、不联网，供 build_audio.py 使用。"""

import hashlib
import re

FPS = 30
TAIL = 0.25        # 每段最后一个字之后留的余量（秒）
END_PAD = 1.2      # 全片最后留白（秒）
ROLL_LEAD = 0.05   # 选题滚动在前一段配音结束后多久开始（秒）


def norm(s: str) -> str:
    return re.sub(r"[\W_]+", "", s)


def char_times(speech: str, words) -> tuple[list[float], list[float]]:
    """把 TTS 返回的逐字时间对齐到朗读文本的每个字（标点不计）。没对上的字沿用前一个字的结束时间。"""
    chars = norm(speech)
    st: list = [None] * len(chars)
    en: list = [None] * len(chars)
    k = 0
    for s, e, w in words:
        w = norm(w)
        if not w:
            continue
        pos = chars.find(w, k)
        if pos < 0:
            continue
        for i in range(len(w)):
            st[pos + i] = s + (e - s) * i / len(w)
            en[pos + i] = s + (e - s) * (i + 1) / len(w)
        k = pos + len(w)
    last = 0.0
    for i in range(len(chars)):
        if st[i] is None:
            st[i] = en[i] = last
        last = en[i]
    return st, en


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
            lines.append({"scene": sc["id"], "i": i, "seg": seg, "zh": ln["zh"],
                          "start": round(base + st[k], 3), "end": round(base + en[k + n - 1], 3)})
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
