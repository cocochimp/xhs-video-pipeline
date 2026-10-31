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

RAW, PUB = ROOT / "raw", ROOT / "public"
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
