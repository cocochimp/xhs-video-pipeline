"""开头的台词、配音和时间轴。

每段整段合成一次（逐句拼接会卡顿），用 WordBoundary 拿到逐字时间，
输出 public/vo_<段>.mp3 和 public/timeline.json 给 Remotion 用。
  ../.venv/bin/python make_timeline.py
"""

import asyncio
import json
import re
import sys
from pathlib import Path

import edge_tts

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pipeline  # noqa: E402
import tts_doubao  # noqa: E402

ENGINE = "doubao" if "--doubao" in sys.argv else "edge"
DOUBAO_RATE = 8  # 语速 -50..100；参考账号约 6 字/秒

ROOT = Path(__file__).resolve().parent
PUB = ROOT / "public"
VOICE, RATE = "zh-CN-XiaoxiaoNeural", "+12%"
FPS = 30

# 每段：(段名, 段前停顿秒, [(中文字幕, 英文字幕, 高亮词), ...])
SEGMENTS = [
    ("intro", 0.3, [
        ("工资少不可怕", "A small salary isn't scary.", []),
        ("可怕的是不会管钱", "Not knowing how to manage it is.", ["管钱"]),
        ("一天一个理财小认知", "One money lesson a day.", ["理财"]),
    ]),
    ("title", 1.5, [  # 停顿期间播封面快闪
        ("今天聊聊", "Today:", []),
        ("工资到手先做的三件事", "three things to do on payday.", ["三件事"]),
    ]),
    ("main", 0.5, [
        ("很多人一发工资", "Most people get paid,", ["发工资"]),
        ("就先去花钱", "and spend first.", []),
        ("其实至少有三件事要先做", "But three things should come first:", ["三件事"]),
        ("存钱", "saving,", []),
        ("留固定支出", "fixed costs,", []),
        ("给花销定个上限", "and a cap on spending.", []),
        ("但大多数人顺序全做反了", "Yet most people do it backwards.", ["做反了"]),
        ("今天一次讲清楚", "Let's sort it out today.", []),
    ]),
]

# 动画触发点：(名字, 段名, 触发文字) → 该文字第一个字开始的时刻
MARKS = [
    ("scared", "intro", "可怕的是"),
    ("glow", "intro", "管钱"),
    ("read", "intro", "一天一个"),
    ("wallet", "main", "发工资"),
    ("spend", "main", "花钱"),
    ("title3", "main", "三件事要先做"),
    ("c1", "main", "存钱"),
    ("c2", "main", "留固定支出"),
    ("c3", "main", "给花销"),
    ("reverse", "main", "但大多数人"),
    ("trap", "main", "做反了"),
    ("clear", "main", "一次讲清楚"),
]


def norm(s: str) -> str:
    return re.sub(r"[\W_]+", "", s)


async def synth(seg: str, text: str) -> tuple[list[float], float]:
    """返回 (每个字的开始时刻, 音频总时长)，时间相对本段开头。"""
    words = []
    if ENGINE == "doubao":
        for s, e, w in tts_doubao.synth(text, PUB / f"vo_{seg}.mp3", speech_rate=DOUBAO_RATE):
            words.append((s, e - s, w))
    else:
        com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
        with (PUB / f"vo_{seg}.mp3").open("wb") as f:
            async for ch in com.stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    words.append((ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]))
    chars = norm(text)
    times, k = [], 0
    for start, dur, w in words:
        w = norm(w)
        if not w:
            continue
        pos = chars.find(w, k)
        if pos < 0:
            continue
        while len(times) < pos:  # 补齐被跳过的字
            times.append(start)
        for i in range(len(w)):
            times.append(start + dur * i / len(w))
        k = pos + len(w)
    end = words[-1][0] + words[-1][1] if words else 0
    while len(times) < len(chars):
        times.append(end)
    return times, end + 0.25


async def main():
    pipeline.load_env()
    PUB.mkdir(exist_ok=True)
    t0, subs, segs, char_times = 0.0, [], {}, {}
    for name, gap, clauses in SEGMENTS:
        t0 += gap
        text = "，".join(c[0] for c in clauses) + "。"
        times, dur = await synth(name, text)
        segs[name] = {"start": round(t0, 3), "duration": round(dur, 3)}
        char_times[name] = (norm(text), [t0 + t for t in times])
        i = 0
        for zh, en, hl in clauses:
            n = len(norm(zh))
            ct = char_times[name][1][i:i + n]
            subs.append({"seg": name, "zh": zh, "en": en, "hl": hl,
                         "chars": [round(t, 3) for t in ct]})
            i += n
        t0 += dur
    for a, b in zip(subs, subs[1:]):  # 每条字幕显示到下一条开始
        a["end"] = b["chars"][0]
    subs[-1]["end"] = round(t0 + 0.6, 3)
    marks = {}
    for key, seg, txt in MARKS:
        chars, times = char_times[seg]
        pos = chars.find(norm(txt))
        if pos < 0:
            sys.exit(f"找不到触发词：{txt}")
        marks[key] = round(times[pos], 3)
    total = t0 + 1.2
    data = {"fps": FPS, "duration": round(total, 3), "segments": segs, "subs": subs, "marks": marks}
    (PUB / "timeline.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"总时长 {total:.1f}s")
    for k, v in segs.items():
        print(f"  {k}: {v['start']:.2f}s 起，{v['duration']:.2f}s")
    print("  marks:", marks)


if __name__ == "__main__":
    asyncio.run(main())
