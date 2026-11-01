"""封面风格候选：4 种风格 × 2 期示例（flash 0.12 元/张）。
  ../../.venv/bin/python make_styles.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import pipeline as P  # noqa: E402

OUT = Path(__file__).resolve().parent / "styles"
REF = ROOT / "aniu/raw/character.jpg"
ANIU = ("主角是参考图里的「阿牛」：拟人化黑白花奶牛打工人，Q版大头，米色小角，粉色大鼻子，黑色豆豆眼，白衬衫深灰西裤，"
        "脖子挂橙色挂绳白色工牌，造型配色必须和参考图完全一致。")
HAND = "手绘马克笔漫画风，粗黑色略带抖动的轮廓线，马克笔上色能看到笔触。竖版 3:4 小红书封面。"

EXAMPLES = {
    "ep001": ("月薪8千", "要攒多少钱", "才能退休？", "阿牛双手抱头被吓到，眼睛瞪圆", "桌上一台计算器和一摞账单"),
    "ep002": ("FIRE是什么？", "普通人", "真能提前退休吗", "阿牛一手托腮思考，头顶一个问号", "桌上一个粉色存钱罐和一本打开的笔记本"),
}

STYLES = {
    "A-场景手写": lambda l1, l2, l3, pose, props: (
        f"{HAND}{ANIU}画面上方 40% 是手写马克笔大字标题，分三行：第一行黑字「{l1}」，第二行橙红色加粗大字「{l2}」，第三行黑字「{l3}」，"
        f"字大清楚、略带手写抖动、白色描边。下方是温暖的办公室场景（木书架、窗户、绿植），{pose}，{props}。暖米色调，除了标题不要写其他字。"),
    "B-橙底大字": lambda l1, l2, l3, pose, props: (
        f"{HAND}{ANIU}纯色亮橙色背景（#FF8A3D），没有场景。上方 60% 是超大的粗黑手写体标题，分三行「{l1}」「{l2}」「{l3}」，"
        f"其中「{l2}」是白字黑描边。右下角是阿牛半身，{pose}。左上角一个白色小圆牌写「第1期」。除这些字外不要写其他字。"),
    "C-笔记本": lambda l1, l2, l3, pose, props: (
        f"{HAND}{ANIU}背景是一页摊开的横线笔记本纸，纸上用黑色马克笔手写标题三行「{l1}」「{l2}」「{l3}」，"
        f"「{l2}」下面画一道橙色荧光笔划线。右下角贴一张橙色便利贴，阿牛从便利贴后面探出上半身，{pose}。纸面边上有回形针和铅笔。除标题外不要写其他字。"),
    "D-大数字": lambda l1, l2, l3, pose, props: (
        f"{HAND}{ANIU}白色纸张背景加淡淡的网格。画面正中是超大的橙色手写粗体字「{l2}」，占画面宽度 80%，黑色粗描边；"
        f"上方一行小一点的黑字「{l1}」，下方一行黑字「{l3}」。底部阿牛全身但较小，{pose}，旁边散落几枚金币。除这些字外不要写其他字。"),
}

SKETCH = ("彩色铅笔加马克笔的手绘素描插画，粗黑钢笔轮廓线略带抖动，阴影用细密的交叉排线，纸张颗粒感，暖色调（原木色、米黄、砖红、蓝），"
          "竖版 3:4 小红书封面。画面上方约 30% 是手写马克笔大标题：粗壮圆润、略带手写抖动的黑色大字，关键词用红色，字很大很清楚，"
          "标题下面一行较小的黑色手写副标题。除标题和副标题不要写其他字。")
EX2 = {
    "ep001": ("「月薪8千」黑色，「要攒多少钱」红色，「才能退休？」黑色，分两行", "每月5000 × 12 × 25 = 150万",
              "地上散落着账单和一大摞金币，旁边一台蓝色计算器，阿牛握笔在本子上算账，表情吃惊"),
    "ep002": ("「FIRE是什么？」黑色，「普通人」红色，「能提前退休吗」黑色，分两行", "年支出 × 25 = 退休自由",
              "身边一个粉色存钱罐、一本打开的书和一个沙漏，阿牛托着下巴思考，头顶亮着一个小灯泡"),
}
STYLES2 = {
    "E-俯视房间": lambda t, sub, act: (
        f"{SKETCH}{ANIU}标题：{t}；副标题「{sub}」。镜头从高处 45 度俯视一间温馨的小书房：木地板、红色地毯、靠墙的木书架、"
        f"墙上软木板贴着便签、窗外是城市楼房。阿牛盘腿坐在地毯中央，{act}。阿牛在画面中下部，约占画面高度 35%。"),
    "E2-俯视房间满版": lambda t, sub, act: (
        f"{SKETCH}{ANIU}标题：{t}；副标题「{sub}」。整张画面从上到下都是同一个房间场景，没有任何留白或纯色块："
        f"标题直接写在房间上半部分的墙面上（暖米黄色、带素描排线的墙），标题文字有一圈白色描边，压在墙、书架顶和窗户上面也能看清。"
        f"镜头从高处 45 度俯视一间温馨的小书房：木地板、红色地毯、靠墙的木书架、墙上软木板贴着便签、窗外是城市楼房。"
        f"阿牛盘腿坐在地毯中央，{act}。阿牛在画面中下部，约占画面高度 35%。整张图颜色统一。"),
    "F-书桌俯拍": lambda t, sub, act: (
        f"{SKETCH}{ANIU}标题：{t}；副标题「{sub}」。镜头从斜上方俯拍一张堆满东西的木书桌：台灯、笔记本电脑、马克杯、一摞文件，"
        f"背景是书架和窗户。阿牛坐在桌前，{act}。阿牛约占画面高度 40%。"),
    "G-房间全景": lambda t, sub, act: (
        f"{SKETCH}{ANIU}标题：{t}；副标题「{sub}」。广角镜头拍下一整个房间：一侧是开着的木门和挂衣钩，另一侧是窗户和绿植，"
        f"地上铺着地毯，墙上挂着日历和时钟。阿牛站在房间中间，{act}。阿牛约占画面高度 40%。"),
}

if __name__ == "__main__" and "--sketch" in sys.argv:
    P.load_env()
    P.IMAGE_SIZE = "1080x1440"
    OUT.mkdir(exist_ok=True)
    for style, make in STYLES2.items():
        for ep, args in EX2.items():
            out = OUT / f"{style}_{ep}.jpg"
            if not out.exists():
                P.seedream(make(*args), out, ref=REF)
                print("  生成", out.name, flush=True)
    sys.exit()

if __name__ == "__main__":
    P.load_env()
    P.IMAGE_SIZE = "1080x1440"
    OUT.mkdir(exist_ok=True)
    for style, make in STYLES.items():
        for ep, args in EXAMPLES.items():
            out = OUT / f"{style}_{ep}.jpg"
            if not out.exists():
                P.seedream(make(*args), out, ref=REF)
                print("  生成", out.name, flush=True)
