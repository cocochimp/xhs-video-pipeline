"""生成一个新素材贴纸（flash 0.12 元/张），写入 assets/，费用记入本期 cost.image。

  .venv/bin/python tools/gen_asset.py prop_umbrella "一把橙色雨伞" [--episode episodes/ep001]
名字以 pose_ 开头时按阿牛姿势生成（带角色参考图），否则按道具生成。
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "opening"))

PRICE = 0.12
STYLE = ("手绘马克笔漫画风，粗黑色略带抖动的轮廓线，马克笔上色能看到笔触，纯白背景，没有地面阴影，单个物体居中。"
         "配色只用：黑、白、橙色(#FF8A3D)、浅灰、粉色。不要写任何文字。")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("desc")
    ap.add_argument("--episode", type=Path)
    a = ap.parse_args()
    import pipeline as P
    from make_assets import cutout
    from PIL import Image
    out = ROOT / "assets" / f"{a.name}.png"
    if out.exists():
        sys.exit(f"素材已存在：{out.name}，换个名字")
    P.load_env()
    P.IMAGE_MODEL, P.IMAGE_SIZE = "doubao-seedream-5-0-flash-260915", "1024x1024"
    raw = ROOT / "aniu/raw" / f"{a.name}.jpg"
    pose = a.name.startswith("pose_")
    prompt = f"{STYLE}\n" + (f"参考图里的阿牛，造型配色完全一致，全身：{a.desc}" if pose else a.desc)
    P.seedream(prompt, raw, ref=ROOT / "aniu/raw/character.jpg" if pose else None)
    cutout(Image.open(raw), outline=9 if pose else 7).save(out)
    if a.episode:
        f = a.episode / "episode.json"
        ep = json.loads(f.read_text())
        c = ep.setdefault("cost", {})
        c["image"] = round(c.get("image", 0) + PRICE, 4)
        f.write_text(json.dumps(ep, ensure_ascii=False, indent=2) + "\n")
    print(out.relative_to(ROOT))


if __name__ == "__main__":
    main()
