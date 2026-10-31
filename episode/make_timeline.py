"""第 1 期：台词 → 豆包配音（逐字时间戳）→ public/vo_<段>.mp3 + public/timeline.json

  ../.venv/bin/python make_timeline.py

字幕用显示文本（数字用阿拉伯数字，【】里的字标橙色），配音用朗读文本（数字写成汉字，读得准）。
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
import pipeline  # noqa: E402
import tts_doubao  # noqa: E402

PUB = ROOT / "public"
FPS = 30
RATE = 15  # 豆包语速 -50..100，比开头样片的 8 稍快
ROLL_DUR = 1.2  # 选题滚动时长（秒），停住后读本期标题

EP_NO, EP_TOTAL = 1, 100
EP_TITLE = "月薪8千，想退休到底要攒多少钱？"
ROLL = ["应急金存几个月才够？", "看懂工资条：税前1万到手多少", "外卖vs带饭：一个月差多少钱",
        "花呗分期：利率到底多高", "存款100万，每月能有多少被动收入", "想裸辞又不敢？先存够这一笔钱"]

# (段名, 段前停顿秒, [(字幕, 朗读), ...])
SEGMENTS = [
    ("open", 0.3, [("阿牛FIRE计划，第1期", "阿牛Fire计划，第一期。"), ("这一期聊：", "这一期聊：")]),
    ("title", ROLL_DUR + 0.2, [(EP_TITLE, "月薪八千，想退休，到底要攒多少钱？")]),
    ("body", 0.5, [
        ("到手【8000】，每月花【5000】", "到手八千，每月花五千。"),          # 0
        ("想不上班也有钱花", "想不上班也有钱花，"),                          # 1
        ("到底要攒多少？", "到底要攒多少？"),                                # 2
        ("有个简单的算法，叫【4%法则】", "有个简单的算法，叫百分之四法则："),  # 3
        ("每年只花存款的【4%】", "每年只花存款的百分之四，"),                  # 4
        ("钱基本就花不完", "钱基本就花不完。"),                              # 5
        ("反过来算", "反过来算："),                                          # 6
        ("一年花多少，【乘以25】", "一年花多少，乘以二十五，"),                # 7
        ("就是你的【退休数字】", "就是你的退休数字。"),                        # 8
        ("每月5000，一年【6万】", "每月五千，一年六万，"),                    # 9
        ("再乘以25", "再乘以二十五，"),                                      # 10
        ("【150万】", "一百五十万。"),                                       # 11
        ("很吓人？", "很吓人？"),                                            # 12
        ("别急，这个公式藏着一个【好消息】", "别急，这个公式藏着一个好消息："),  # 13
        ("花得越少，要攒的就【越少】", "花得越少，要攒的就越少。"),            # 14
        ("每月少花【1000】", "每月少花一千，"),                              # 15
        ("目标直接少【30万】", "目标直接少三十万。"),                         # 16
        ("所以第一步不是赚更多", "所以第一步不是赚更多，"),                    # 17
        ("而是先【算清楚】", "而是先算清楚："),                               # 18
        ("你一个月到底花多少钱", "你一个月到底花多少钱。"),                    # 19
    ]),
    ("end", 0.6, [
        ("你每月花多少？", "你每月花多少？"),
        ("评论区算算你的【退休数字】", "评论区算算你的退休数字。"),
        ("关注阿牛", "关注阿牛，"),
        ("一起【早日退休】！", "一起早日退休！"),
    ]),
]


def norm(s: str) -> str:
    return re.sub(r"[\W_]+", "", s)


def char_times(speech: str, words):
    """把豆包返回的逐字时间对齐到朗读文本的每个字（标点不计），返回 (开始列表, 结束列表)。"""
    chars = norm(speech)
    st, en = [None] * len(chars), [None] * len(chars)
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
    for i in range(len(chars)):  # 没对上的字沿用前一个字的时间
        if st[i] is None:
            st[i] = en[i] = last
        last = en[i]
    return st, en


def main():
    pipeline.load_env()
    PUB.mkdir(exist_ok=True)
    t0, segs, cl, subs, roll, chars_billed = 0.0, {}, {}, [], None, 0
    for name, gap, clauses in SEGMENTS:
        if name == "title":
            roll = {"start": round(t0 + 0.05, 3), "dur": ROLL_DUR, "topics": ROLL + [EP_TITLE]}
        t0 += gap
        speech = "".join(sp for _, sp in clauses)
        chars_billed += len(speech)
        words = tts_doubao.synth(speech, PUB / f"vo_{name}.mp3", speech_rate=RATE)
        st, en = char_times(speech, words)
        dur = (words[-1][1] if words else 0) + 0.25
        segs[name] = {"start": round(t0, 3), "duration": round(dur, 3)}
        cl[name], i = [], 0
        for disp, sp in clauses:
            n = len(norm(sp))
            s, e = st[i], en[i + n - 1]
            cl[name].append(round(t0 + s, 3))
            subs.append({"seg": name, "zh": disp, "start": round(t0 + s, 3), "end": round(t0 + e, 3)})
            i += n
        t0 += dur
    duration = round(t0 + 1.2, 3)

    # 音效：[时刻, 种类, 音量]
    sfx = [[cl["open"][0], "pop", 0.8]]
    n = len(roll["topics"])
    for j in range(1, n):  # 选题滚过每一张卡的时刻（和画面同一条缓动曲线：1-(1-p)^3）
        p = 1 - (1 - j / (n - 1)) ** (1 / 3)
        sfx.append([round(roll["start"] + roll["dur"] * p, 3), "stamp" if j == n - 1 else "pop", 0.8 if j == n - 1 else 0.35])
    b = cl["body"]
    sfx.append([round(b[0] - 0.15, 3), "whoosh", 0.7])
    sfx += [[b[i], "pop", 0.7] for i in (0, 2, 3, 4, 5, 7, 8, 9, 10, 13, 14, 15)]
    sfx += [[b[11], "stamp", 1.0], [b[16], "pop", 0.9], [round(b[17] - 0.1, 3), "whoosh", 0.6]]
    e = cl["end"]
    sfx += [[round(e[0] - 0.15, 3), "whoosh", 0.7], [e[1], "pop", 0.6], [e[2], "pop", 0.8], [e[3], "stamp", 0.6]]

    data = {"fps": FPS, "duration": duration, "no": EP_NO, "total": EP_TOTAL, "title": EP_TITLE,
            "roll": roll, "segs": segs, "cl": cl, "subs": subs, "sfx": sfx}
    (PUB / "timeline.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"总时长 {duration:.1f}s，配音 {chars_billed} 字（约 {chars_billed * 0.0003:.2f} 元，先扣免费额度）")
    for k, v in segs.items():
        print(f"  {k}: {v['start']:.2f}s 起，{v['duration']:.2f}s")
    print("  roll:", roll["start"], "→", round(roll["start"] + roll["dur"], 2))


if __name__ == "__main__":
    main()
