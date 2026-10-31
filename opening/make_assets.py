"""开头复刻所需素材：一张图画多个素材再自动切开，用 flash 控制成本。

  ../.venv/bin/python make_assets.py            # 生成缺失的素材
  ../.venv/bin/python make_assets.py --force poses props   # 重做指定的图
产物在 public/：pose_1..3.png、prop_<名字>.png、cover_1..6.png、title.png（透明底贴纸）
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
import pipeline as P  # noqa: E402  复用 Seedream 调用和 key 读取

REF = ROOT.parent / "projects/payday-3-things/character.jpg"
RAW, PUB = ROOT / "raw", ROOT / "public"
STYLE = (
    "手绘彩色马克笔漫画插画，纯白背景，粗黑色略带抖动的手绘轮廓线，Q版大头小身体比例，表情夸张生动，"
    "马克笔上色能看到笔触，配色：芥末黄、雾蓝、砖红、黑、浅灰、米色。没有背景、没有阴影地面。"
)
CHAR = "主角就是参考图里的女生「小柚」，发型、脸型、雀斑、芥末黄连帽卫衣、牛仔裤必须与参考图完全一致。"

PROPS = [  # 3 行 4 列，顺序即网格位置
    "coin", "bill", "card", "paper",
    "house", "bulb", "growth", "piggy",
    "wallet", "tea", "calc", "book",
]
PROP_DESC = "金币（印着¥）、一张纸币、一张银行卡、一张写满字的账单纸、一栋小房子、一个发光的灯泡、一株发芽的小苗和向上的折线箭头、一个粉色存钱罐、一个装着钱的工资信封、一杯珍珠奶茶、一个计算器、一本红色封面的书"
COVERS = ["工资怎么分", "复利的力量", "存钱的顺序", "基金是什么", "保险怎么买", "信用卡的坑"]

JOBS = {
    "poses": (True, "1440x1080",
              f"{STYLE}\n{CHAR}\n同一张图里从左到右并排画三个互不接触的全身姿势，彼此之间留出大片空白："
              "①低头看着手里的手机，表情平静；②被吓到，双臂张开，眼睛瞪大，嘴巴张开；"
              "③盘腿坐在一摞书上，双手捧着一本打开的红色书，开心地看书。不要写任何文字。"),
    "props": (False, "1440x1080",
              f"{STYLE}\n道具素材表：排成整齐的3行4列网格，每个物品单独居中在自己的格子里，物品之间留大量空白，互不重叠，"
              f"按从左到右、从上到下的顺序依次是：{PROP_DESC}。不要写任何文字（金币上的¥除外），不要画格子线。"),
    "covers": (False, "1440x1080",
               f"{STYLE}\n一张排成3列2行整齐网格的系列封面缩略图，共6格，格子之间留白、不画格子线。每格上方用黑色手写马克笔字写标题，"
               f"标题下方画两三个相关的简单物件（不要画人物）。按从左到右、从上到下依次是：" +
               "；".join(f"「{t}」" for t in COVERS) + "。除了这6个标题不要写其他字。"),
    "title": (True, "1440x1080",
              f"{STYLE}\n{CHAR}\n画面上方用黑色手写马克笔字分两行写：第一行「工资到手」，第二行「先做这3件事」，字大而清楚。"
              "下方画小柚坐在一张小木桌前，桌上有笔记本电脑、一张账单和一小摞金币，她握着笔认真记账。只写这两行字。"),
}


# ---------- 抠图 ----------

def cutout(img: Image.Image, outline: int = 9) -> Image.Image:
    """白底手绘图 → 透明底贴纸：从四周泛洪找出外部白色，内部白色（眼白、纸面）保留，再加白色描边。"""
    rgb = img.convert("RGB")
    hsv = rgb.convert("HSV")
    bw = Image.new("L", rgb.size, 0)
    px_rgb, px_hsv, px = rgb.load(), hsv.load(), bw.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = px_rgb[x, y]
            if min(r, g, b) > 228 and px_hsv[x, y][1] < 30:
                px[x, y] = 255  # 接近纯白
    pad = Image.new("L", (rgb.width + 2, rgb.height + 2), 255)
    pad.paste(bw, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    ext = pad.crop((1, 1, rgb.width + 1, rgb.height + 1)).point(lambda v: 255 if v == 128 else 0)
    alpha = ext.point(lambda v: 0 if v else 255).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    if outline:
        ring = alpha.filter(ImageFilter.MaxFilter(outline * 2 + 1)).filter(ImageFilter.GaussianBlur(1))
        sticker = Image.new("RGBA", rgb.size, (255, 255, 255, 0))
        sticker.putalpha(ring)
        sticker.alpha_composite(out)
        out = sticker
    bbox = out.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def components(img: Image.Image, n: int) -> list[Image.Image]:
    """按非白像素的列投影把一张横排多姿势图切成 n 块。
    优先用姿势之间的空白竖带；姿势挨在一起时，退回到在每个 k/n 位置附近找最窄的缝切开。"""
    g = img.convert("L").resize((img.width // 4, img.height // 4))
    cols = [sum(1 for y in range(g.height) if g.getpixel((x, y)) < 225) for x in range(g.width)]
    runs, start = [], None
    for x, c in enumerate(cols + [0]):
        if c > 2 and start is None:
            start = x
        elif c <= 2 and start is not None:
            runs.append((start, x))
            start = None
    runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:n])
    if len(runs) == n:
        return [img.crop((max(0, a * 4 - 12), 0, min(img.width, b * 4 + 12), img.height)) for a, b in runs]
    w, cuts = len(cols), [0]
    for k in range(1, n):
        lo, hi = int(w * (k / n - 0.12)), int(w * (k / n + 0.12))
        cuts.append(min(range(lo, hi), key=lambda x: cols[x]))
    cuts.append(w)
    return [img.crop((a * 4, 0, b * 4, img.height)) for a, b in zip(cuts, cuts[1:])]


def grid(img: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    w, h = img.width / cols, img.height / rows
    return [img.crop((int(c * w), int(r * h), int((c + 1) * w), int((r + 1) * h))) for r in range(rows) for c in range(cols)]


# ---------- 主流程 ----------

def generate(name: str, force: bool):
    with_ref, size, prompt = JOBS[name]
    raw = RAW / f"{name}.jpg"
    if raw.exists() and not force:
        return raw
    P.IMAGE_SIZE = size
    P.seedream(prompt, raw, ref=REF if with_ref else None)
    print("  生成", raw.name)
    return raw


def split(name: str, raw: Path):
    img = Image.open(raw).convert("RGB")
    if name == "poses":
        for i, part in enumerate(components(img, 3), 1):
            cutout(part).save(PUB / f"pose_{i}.png")
    elif name == "props":
        for label, cell in zip(PROPS, grid(img, 4, 3)):
            cutout(cell, outline=7).save(PUB / f"prop_{label}.png")
    elif name == "covers":
        for i, cell in enumerate(grid(img, 3, 2), 1):
            cell.save(PUB / f"cover_{i}.png")  # 封面快闪保留整格（含白底）
    elif name == "title":
        img.save(PUB / "title.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", nargs="*", default=[], help="重做这些图：poses props covers title")
    a = ap.parse_args()
    P.load_env()
    RAW.mkdir(exist_ok=True)
    PUB.mkdir(exist_ok=True)
    for name in JOBS:
        split(name, generate(name, name in a.force))
    print("素材 →", PUB)


if __name__ == "__main__":
    main()
