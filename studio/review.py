"""全局审核标准（docs/口播与审核标准.md）里程序能查的部分。返回问题列表，空表示通过。

  python -m studio.review episodes/ep003
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_SAY = 18
SLOGAN = "关注阿牛，一起早日退休！"
HOST_WORDS = ["评论区说说", "欢迎留言", "感谢收看", "感谢观看", "大家好", "家人们", "宝子们", "点赞收藏"]
BOOK_WORDS = ["综上所述", "因此", "此外", "首先", "其次", "总而言之"]


def check_text(ep: dict) -> list[str]:
    bad = []
    for sc in ep["scenes"]:
        for i, ln in enumerate(sc["lines"]):
            say = ln["say"]
            n = len(re.sub(r"[\W_]+", "", say))
            where = f"{sc['id']} 第{i + 1}句「{ln['zh'][:14]}」"
            if n > MAX_SAY and ln["seg"] == "body":
                bad.append(f"{where} 朗读 {n} 字，超过 {MAX_SAY} 字，拆成两句")
            if re.search(r"\d", say):
                bad.append(f"{where} 朗读里有阿拉伯数字，写成汉字")
            for w in HOST_WORDS:
                if w in say:
                    bad.append(f"{where} 用了主持人口吻「{w}」，改成阿牛跟朋友聊天的说法")
            for w in BOOK_WORDS:
                if w in say:
                    bad.append(f"{where} 用了书面词「{w}」，换成口语")
            if ln["seg"] == "end" and say.strip() != SLOGAN:
                bad.append(f"{where} 放在 end 段：end 段只放「{SLOGAN}」，互动提问改成 seg=body 放到前面")
    ends = [ln for sc in ep["scenes"] for ln in sc["lines"] if ln["seg"] == "end"]
    if not ends or ends[-1]["say"].strip() != SLOGAN:
        bad.append(f"最后一句必须是「{SLOGAN}」(seg=end)")
    return bad


def check_code(ep_dir: Path) -> list[str]:
    bad = []
    for f in sorted((ep_dir / "scenes").glob("*.tsx")):
        s = f.read_text()
        if re.search(r"木杆|#8a6a4a|stem|pole", s):
            bad.append(f"{f.name} 画了木杆/连接线之类的装饰线，去掉")
    return bad


def review(ep_dir: Path, code: bool = False) -> list[str]:
    ep = json.loads((ep_dir / "episode.json").read_text())
    return check_text(ep) + (check_code(ep_dir) if code else [])


if __name__ == "__main__":
    d = Path(sys.argv[1]).resolve()
    out = review(d, code=True)
    print("\n".join(out) or "通过")
