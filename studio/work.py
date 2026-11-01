"""新作品流程和 AI 助手。网站后端调用，结果以一行 JSON 打印到 stdout，进度打印到 stderr。

  python -m studio.work text  episodes/ep002 ["第3段先铺垫一下"]   # AI 写 / 改整期文本
  python -m studio.work gen   episodes/ep002                       # 配音 → AI 写分镜代码 → 检查 → 缩略图
  python -m studio.work chat  <session|-> <页面> "<消息>"           # 只读讨论，给出方案
  python -m studio.work apply <session>                            # 执行刚才的方案
  python -m studio.work previews                                   # 生成音效试听文件
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from studio.ai import READ_TOOLS, claude, last_json  # noqa: E402
from studio.guard import capture, changed, revert, snapshot, write_episode  # noqa: E402

CHAT = ROOT / "studio/chat.json"
EXAMPLE = ROOT / "episodes/ep001"


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def load(ep_dir: Path) -> dict:
    return json.loads((ep_dir / "episode.json").read_text())


def check_text(ep: dict, before: dict) -> str:
    keep = ("id", "no", "total", "stage", "cost", "segments")
    for k in keep:
        if ep.get(k) != before.get(k):
            return f"不能改 {k}"
    segs = {s["id"] for s in ep["segments"]}
    if not ep.get("scenes"):
        return "没有分镜"
    for sc in ep["scenes"]:
        if not sc.get("lines"):
            return f"{sc.get('id')} 没有台词"
        if any(l.get("seg") not in segs or not l.get("zh") or not l.get("say") for l in sc["lines"]):
            return f"{sc['id']} 台词缺 seg/zh/say"
    return ""


def cmd_text(ep_dir: Path, issue: str = "") -> dict:
    ep_dir = ep_dir.resolve()
    before = load(ep_dir)
    rel = (ep_dir / "episode.json").relative_to(ROOT)
    example = json.dumps({k: load(EXAMPLE)[k] for k in ("roll", "scenes")}, ensure_ascii=False)
    task = (f"按用户意见修改 {rel} 的文本：{issue}" if issue else
            f"为选题「{before['title']}」写整期文本，写进 {rel}。")
    prompt = "\n\n".join([
        "你在给小红书账号「阿牛要退休」（系列：阿牛FIRE计划，主角是想早点退休的打工奶牛阿牛）写一期手绘解说短视频的文本。账号内容四类：搞钱 40%、认知 30%、理财基础 20%、退休/FIRE 10%，选题在 studio/topics.json。",
        task,
        "要求：全片至少 60 秒，所有 say 加起来至少 330 字（语速约每秒 5.5 字），上不封顶：内容完整、有逻辑最重要。"
        "清单类选题（比如「普通人还能靠这十条搞钱」）就把每一条讲完整，视频到 3～4 分钟也可以；不要为了凑时长灌水。"
        "分镜数随内容定，每个分镜 2～4 句，一个要点一个分镜；"
        "正文结构：痛点 → 要点（清单 / 对比 / 算一笔账）→ 结论 + 一个能照做的动作；量化不要多，每期最多一个核心数字；"
        "内容要有普适性，从打工人日常（加班、跳槽、月光、被裁、攒不下钱）讲起，不要硬扯到退休计算；"
        "固定开头：s01 两句，第一句 zh「普通人，要如何才能【提前退休】？」say「普通人要如何才能提前退休，」(seg=open)，"
        f"第二句 zh「这里是阿牛退休计划，第{before['no']}期」say「这里是阿牛退休计划第{before['no']}期！」(seg=open)；s02 第一句「本期我们要讲的是：」(seg=open)，第二句是选题 (seg=title)；"
        "正文 seg=body；最后一句固定为「关注阿牛，一起早日退休！」(seg=end)。结尾分镜的阿牛用思考姿势（think），不要举牌。"
        "每句 lines 有 seg、zh（字幕，重点词用【】标橙）、say（朗读，数字写汉字）；每个分镜有 id(s01…)、name、visual（画面描述）、"
        "sfx（[{line, kind: pop|stamp, vol}]，每分钟最多 8 个，pop 每分钟最多 4 个、stamp 每分钟最多 3 个，两个至少隔 1.5 秒，只放在最关键的数字或结论上）、status: pending、rounds: []。roll.topics 放 11 个别的选题，roll.dur 2.2。",
        "s01、s02 的 visual 和 sfx 照抄第 1 期。只改 scenes、roll、title 字段，其他字段保持原样。参考第 1 期的写法：\n" + example,
        '最后一行输出 {"summary": "<一句话说明>"}',
    ])
    saved, snap = capture(ROOT, ep_dir), snapshot(ROOT, ep_dir)
    text, _ = claude(prompt, "text", tools=["Read", "Edit", "Write"], timeout=900)
    others = [p for p in changed(snap, snapshot(ROOT, ep_dir)) if p != str(rel)]
    try:
        ep = load(ep_dir)
        err = check_text(ep, before) or ("改了别的文件：" + "、".join(others) if others else "")
    except json.JSONDecodeError as e:
        err = f"episode.json 格式坏了：{e}"
    if err:
        revert(ROOT, saved, others)
        write_episode(ep_dir, before)
        return {"ok": False, "error": err}
    out = last_json(text) or {}
    ep.setdefault("textRounds", []).append({"issue": issue or "初稿", "summary": out.get("summary", ""),
                                            "at": datetime.now().isoformat(timespec="seconds")})
    write_episode(ep_dir, ep)
    return {"ok": True, "summary": out.get("summary", "")}


def register_episodes() -> None:
    """episodes/index.ts 和每期 index.ts 按目录自动生成。"""
    eps = sorted(p for p in (ROOT / "episodes").glob("ep*") if (p / "scenes").is_dir() and (p / "audio/timeline.json").exists())
    for ep in eps:
        ids = sorted(f.stem for f in (ep / "scenes").glob("s*.tsx"))
        (ep / "index.ts").write_text(
            'import type { EpisodeJson, EpisodeModule, Timeline } from "../../shared/types";\n'
            'import timeline from "./audio/timeline.json";\nimport episode from "./episode.json";\n'
            + "".join(f'import {i} from "./scenes/{i}";\n' for i in ids)
            + "\nconst ep: EpisodeModule = {\n  episode: episode as unknown as EpisodeJson,\n"
            "  timeline: timeline as unknown as Timeline,\n  scenes: { " + ", ".join(ids) + " },\n};\nexport default ep;\n")
    (ROOT / "episodes/index.ts").write_text(
        'import type { EpisodeModule } from "../shared/types";\n'
        + "".join(f'import {e.name} from "./{e.name}";\n' for e in eps)
        + f"\nexport const EPISODES: EpisodeModule[] = [{', '.join(e.name for e in eps)}];\n")


def cmd_gen(ep_dir: Path) -> dict:
    from studio.edit import check_code, thumb
    from tools.build_audio import build
    ep_dir = ep_dir.resolve()
    log("配音和时间轴")
    build(ep_dir)
    ep = load(ep_dir)
    (ep_dir / "scenes").mkdir(exist_ok=True)
    keep = {sc["id"] for sc in ep["scenes"]}
    for f in (ep_dir / "scenes").glob("s*.tsx"):  # 文本重写后分镜变少：删掉旧的
        if f.stem not in keep:
            f.unlink()
    rel = ep_dir.relative_to(ROOT)
    prompt = "\n\n".join([
        (ROOT / "studio/rules.md").read_text().split("## 问题不清楚时")[0],
        f"## 任务\n为 {rel}/episode.json 的每个分镜写场景组件 {rel}/scenes/<id>.tsx（默认导出），按 visual 描述做动画。"
        f"参考 episodes/ep001/scenes/ 的写法。时间轴在 {rel}/audio/timeline.json。只写 {rel}/scenes/ 下的文件，可以生成新素材。",
        "分镜：" + json.dumps([{k: s[k] for k in ("id", "name", "visual")} | {"lines": [l["zh"] for l in s["lines"]]}
                              for s in ep["scenes"]], ensure_ascii=False),
        '最后一行输出 {"summary": "<一句话>"}',
    ])
    error = ""
    for attempt in range(2):
        log("AI 写分镜代码" if not attempt else "修正类型错误")
        claude(prompt + (f"\n\n## 上次的类型检查错误，请修正\n{error}" if error else ""), "gen", timeout=1800)
        register_episodes()
        log("类型检查")
        r = subprocess.run(["npx", "tsc", "-p", "."], cwd=ROOT, capture_output=True, text=True)
        error = (r.stdout + r.stderr)[-1500:] if r.returncode else ""
        if not error:
            break
    if error:
        return {"ok": False, "error": "类型检查没通过：" + error[-300:]}
    for sc in ep["scenes"]:
        log(f"缩略图 {sc['id']}")
        thumb(ep_dir, sc["id"])
    ep = load(ep_dir)
    ep["stage"] = "review"
    write_episode(ep_dir, ep)
    return {"ok": True}


CHAT_RULES = """你是「阿牛工作台」里的 AI 助手，帮用户管理小红书账号「阿牛要退休」的视频素材。用中文回答，简短。
项目结构：assets/（阿牛姿势 pose_*.png、道具 prop_*.png）、assets/audio/bgm/（背景音乐）、studio/config.json（配音音色 voice、背景音乐 bgm、音色列表 voices）、
studio/topics.json（选题库：categories 分类、topics 选题，AI 新出的选题 status 写 pending 等用户审核）、episodes/<期>/（episode.json 文本，scenes/*.tsx 分镜代码）、shared/ui.tsx（动画组件）。
画新素材：.venv/bin/python tools/gen_asset.py <英文名> "<中文描述>"，每张 0.12 元。
现在只讨论，不改文件。如果需要改动，说清楚改哪些文件、预计花费。
最后一行输出 JSON：{"reply": "<给用户看的回答>", "plan": "<要执行的改动，一句话；不需要改动则为 null>"}"""


def chat_log() -> list:
    return json.loads(CHAT.read_text()) if CHAT.exists() else []


def push(msg: dict) -> None:
    rows = chat_log()
    rows.append(msg | {"at": datetime.now().isoformat(timespec="seconds")})
    CHAT.write_text(json.dumps(rows[-300:], ensure_ascii=False, indent=1))


def cmd_chat(session: str, page: str, msg: str) -> dict:
    push({"role": "me", "text": msg, "page": page})
    prompt = (CHAT_RULES + f"\n\n用户当前在「{page}」页面。\n\n用户：{msg}") if session == "-" else f"（用户当前在「{page}」页面）\n用户：{msg}"
    text, sid = claude(prompt, "chat", tools=READ_TOOLS, resume=None if session == "-" else session)
    out = last_json(text) or {"reply": text.strip(), "plan": None}
    push({"role": "ai", "text": out.get("reply", ""), "plan": out.get("plan"), "session": sid})
    return {"ok": True, "session": sid}


def cmd_apply(session: str) -> dict:
    text, sid = claude('用户确认了，按刚才的方案执行。完成后最后一行输出 {"reply": "<改了什么>", "plan": null}', "chat", resume=session)
    out = last_json(text) or {"reply": text.strip()}
    from tools.sync_public import sync
    sync(ROOT)
    push({"role": "ai", "text": "✓ " + out.get("reply", "已执行"), "plan": None, "session": sid})
    return {"ok": True}


def cmd_previews() -> dict:
    sys.path.insert(0, str(ROOT / "opening"))
    import make_audio as ma
    out = ROOT / "public/library"
    out.mkdir(parents=True, exist_ok=True)
    for k, fn in ma.SFX.items():
        ma.write_wav(out / f"sfx_{k}.wav", fn())
    ma.write_wav(out / "bgm_builtin.wav", ma.bgm(12))
    return {"ok": True}


COVER_STYLE = (  # 定稿风格：满版俯视房间（ip/cover/styles/E2-俯视房间满版_*.jpg）
    "彩色铅笔加马克笔的手绘素描插画，粗黑钢笔轮廓线略带抖动，阴影用细密的交叉排线，纸张颗粒感，暖色调（原木色、米黄、砖红、蓝），竖版 3:4 小红书封面。"
    "主角是参考图里的「阿牛」：拟人化黑白花奶牛打工人，Q版大头，米色小角，粉色大鼻子，黑色豆豆眼，白衬衫深灰西裤，脖子挂橙色挂绳白色工牌，造型配色必须和参考图完全一致。"
    "整张画面从上到下都是同一个房间场景，没有任何留白或纯色块：标题直接写在房间上半部分的墙面上，粗壮圆润、略带手写抖动的黑色大字，"
    "最关键的几个字用红色，文字有一圈白色描边，字很大很清楚。镜头从高处 45 度俯视一间温馨的小书房：木地板、红色地毯、靠墙的木书架、"
    "墙上软木板贴着便签、窗外是城市楼房。阿牛在画面中下部，约占画面高度 35%。整张图颜色统一。除标题外不要写其他字。")
COVER_PRICE = 0.12


def cmd_cover(ep_dir: Path, n: int = 3) -> dict:
    """按定稿风格生成 n 张封面候选，写进 episode.json 的 covers；每张 0.12 元。"""
    import pipeline as P
    ep_dir = ep_dir.resolve()
    ep = load(ep_dir)
    body = [l["zh"].replace("【", "").replace("】", "") for sc in ep["scenes"][2:5] for l in sc["lines"]][:4]
    P.IMAGE_MODEL, P.IMAGE_SIZE = "doubao-seedream-5-0-flash-260915", "1080x1440"
    out_dir, pub = ep_dir / "covers", ROOT / "public/covers" / ep_dir.name
    out_dir.mkdir(exist_ok=True)
    pub.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%m%d%H%M%S")
    made = []
    for k in range(n):
        log(f"封面 {k + 1}/{n}")
        prompt = (f"{COVER_STYLE}\n标题「{ep['title']}」，按意思分成两到三行。"
                  f"阿牛在房间里做和这期内容相关的事，身边放着相关的道具；这期讲的是：{'；'.join(body)}。")
        f = out_dir / f"c{stamp}_{k + 1}.jpg"
        P.seedream(prompt, f, ref=ROOT / "aniu/raw/character.jpg")
        (pub / f.name).write_bytes(f.read_bytes())
        made.append({"file": f.name, "at": datetime.now().isoformat(timespec="seconds")})
        ep = load(ep_dir)
        ep.setdefault("cost", {})["image"] = round(ep["cost"].get("image", 0) + COVER_PRICE, 4)
        ep["covers"] = ep.get("covers", []) + [made[-1]]
        write_episode(ep_dir, ep)
    return {"ok": True, "files": [m["file"] for m in made]}


def cmd_topics(arg: str) -> dict:
    """AI 出 5 个新选题，放进选题库的「待审核」。"""
    req = json.loads(arg or "{}")
    db = json.loads((ROOT / "studio/topics.json").read_text())
    cats = {c["id"]: c["name"] for c in db["categories"]}
    have = [t["title"] for t in db["topics"]]
    counts = {c: sum(t["cat"] == c for t in db["topics"]) for c in cats}
    gap = req.get("cat") or min(cats, key=lambda c: counts[c] / max(1, next(x.get("target", 10) for x in db["categories"] if x["id"] == c)))
    prompt = "\n\n".join([
        "你在给小红书账号「阿牛要退休」出选题。主角是想早点退休的打工奶牛阿牛，观众是刚毕业、被工资困住的年轻人。",
        f"分类：{json.dumps(cats, ensure_ascii=False)}。这次出 5 个「{cats.get(gap, gap)}」（id={gap}）类的选题。",
        f"方向：{req['hint']}" if req.get("hint") else "",
        "要求：标题像小红书爆款标题，具体、有痛点，最好带数字或反问，20 字以内；有普适性，从打工人日常出发；不要和已有选题重复。",
        "已有选题：" + "；".join(have),
        '只输出一行 JSON：{"topics": [{"title": "...", "cat": "<分类 id>"}]}',
    ])
    text, _ = claude(prompt, "topics", tools=READ_TOOLS)
    out = (last_json(text) or {}).get("topics") or []
    norm = lambda s: "".join(ch for ch in s if ch not in "？?！!，,。. ：:")
    seen = {norm(t) for t in have}
    n = max([int(t["id"][1:]) for t in db["topics"]] or [0])
    added = []
    for t in out[:5]:
        title = str(t.get("title", "")).strip()
        if not title or norm(title) in seen:
            continue
        n += 1
        seen.add(norm(title))
        db["topics"].append({"id": f"t{n:03d}", "title": title, "cat": t.get("cat") if t.get("cat") in cats else gap,
                             "status": "pending", "at": datetime.now().isoformat(timespec="seconds")})
        added.append(title)
    (ROOT / "studio/topics.json").write_text(json.dumps(db, ensure_ascii=False, indent=1) + "\n")
    return {"ok": bool(added), "added": added, **({} if added else {"error": "AI 没给出新的选题"})}


def cmd_voice(speaker: str, rate: int) -> dict:
    """试听一个音色，按 音色+语速 缓存。约 0.01 元。"""
    import hashlib
    import pipeline
    import tts_doubao
    pipeline.load_env()
    text = "阿牛FIRE计划第一期，这一期聊：月薪八千，想退休到底要攒多少钱？"
    name = hashlib.sha1(f"{speaker}{rate}".encode()).hexdigest()[:10]
    mp3 = ROOT / f"public/library/voice_{name}.mp3"
    if not mp3.exists():
        mp3.parent.mkdir(parents=True, exist_ok=True)
        tts_doubao.synth(text, mp3, speaker=speaker, speech_rate=rate)
    return {"ok": True, "url": f"/library/{mp3.name}"}


def main():
    cmd, a = sys.argv[1], sys.argv[2:]
    if cmd in ("text", "gen", "voice", "cover"):
        import pipeline
        pipeline.load_env()
    res = {"text": lambda: cmd_text(Path(a[0]), a[1] if len(a) > 1 else ""), "gen": lambda: cmd_gen(Path(a[0])),
           "chat": lambda: cmd_chat(*a[:3]), "apply": lambda: cmd_apply(a[0]), "previews": cmd_previews,
           "voice": lambda: cmd_voice(a[0], int(a[1])), "cover": lambda: cmd_cover(Path(a[0])), "topics": lambda: cmd_topics(a[0]), "register": lambda: register_episodes() or {"ok": True}}[cmd]()
    print(json.dumps(res, ensure_ascii=False))
    sys.exit(0 if res.get("ok") else 1)


if __name__ == "__main__":
    main()
