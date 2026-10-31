"""AI 改一片 / 撤销 / 缩略图。网站后端调用，结果以一行 JSON 打印。

  python -m studio.edit edit  episodes/ep001 s06 "150万砸下来再慢一点"
  python -m studio.edit undo  episodes/ep001 s06 2
  python -m studio.edit thumbs episodes/ep001 [s06]
"""

import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from studio.guard import backup, capture, changed, check_boundary, restore, revert, snapshot, write_episode  # noqa: E402

TIMEOUT = 300
COST_WARN = 1.0


def load(ep_dir: Path) -> dict:
    return json.loads((ep_dir / "episode.json").read_text())


def scene_of(ep: dict, sid: str) -> dict:
    return next(sc for sc in ep["scenes"] if sc["id"] == sid)


def set_scene(ep_dir: Path, sid: str, **kw) -> None:
    ep = load(ep_dir)
    scene_of(ep, sid).update(kw)
    write_episode(ep_dir, ep)


def total_cost(ep: dict) -> float:
    c = ep.get("cost", {})
    return c.get("tts", 0) + c.get("image", 0)


def build_prompt(ep_dir: Path, sid: str, issue: str, error: str = "") -> str:
    ep = load(ep_dir)
    sc = scene_of(ep, sid)
    tl = json.loads((ep_dir / "audio/timeline.json").read_text())
    span = tl["scenes"][sid]
    assets = sorted(p.stem for p in (ROOT / "assets").glob("*.png"))
    return "\n\n".join([
        (ROOT / "studio/rules.md").read_text(),
        f"## 本片\n期：{ep_dir.relative_to(ROOT)}　场景：{sid}「{sc.get('name', '')}」　时长 {span['end'] - span['start']:.2f} 秒",
        f"画面大意：{sc.get('visual', '')}",
        "台词和音效（episode.json 里本片的数据）：\n" + json.dumps({k: sc.get(k) for k in ("lines", "sfx")}, ensure_ascii=False, indent=1),
        f"场景代码 scenes/{sid}.tsx：\n```tsx\n{(ep_dir / 'scenes' / f'{sid}.tsx').read_text()}\n```",
        "可用素材：" + "、".join(assets),
        f"## 用户的问题\n{issue}",
        f"## 上一次修改没通过检查，请修正\n{error}" if error else "",
    ])


def claude_runner(prompt: str) -> dict:
    """调用本机 Claude Code，返回最后一行 JSON：{"summary", "ask"}。"""
    from studio.ai import claude, last_json
    text, _ = claude(prompt, "edit")
    return last_json(text) or {"summary": text.strip()[-120:], "ask": None}


def check_code(ep_dir: Path, sid: str) -> str:
    """类型检查 + 渲染本片缩略图；返回错误信息，空字符串表示通过。"""
    r = subprocess.run(["npx", "tsc", "-p", "."], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        return (r.stdout + r.stderr)[-1500:]
    try:
        thumb(ep_dir, sid)
    except subprocess.CalledProcessError as e:
        return (e.stderr or str(e))[-1500:]
    return ""


def thumb(ep_dir: Path, sid: str) -> None:
    from tools.sync_public import sync
    sync(ROOT)
    tl = json.loads((ep_dir / "audio/timeline.json").read_text())
    span = tl["scenes"][sid]
    frame = int((span["start"] + span["end"]) / 2 * tl["fps"])
    out = ROOT / "public" / "thumbs" / ep_dir.name / f"{sid}.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["npx", "remotion", "still", "shared/index.ts", ep_dir.name, str(out), f"--frame={frame}",
                    "--scale=0.25", "--image-format=jpeg", "--log=error"], cwd=ROOT, check=True, capture_output=True, text=True)


def revoice_if_needed(ep_dir: Path, sid: str, lines_before) -> None:
    ep = load(ep_dir)
    if scene_of(ep, sid)["lines"] == lines_before:
        return
    from tools.build_audio import build
    _, _, revoiced = build(ep_dir)
    ep = load(ep_dir)
    for sc in ep["scenes"]:
        if sc["id"] != sid and sc.get("status") == "approved" and {l["seg"] for l in sc["lines"]} & set(revoiced):
            sc["voiceUpdated"] = True
    write_episode(ep_dir, ep)


def run_edit(ep_dir: Path, sid: str, issue: str, runner=claude_runner, checker=check_code) -> dict:
    ep_dir = ep_dir.resolve()
    rd = backup(ep_dir, sid)
    saved = capture(ROOT, ep_dir)
    before, ep_before = snapshot(ROOT, ep_dir), load(ep_dir)
    lines_before = scene_of(ep_before, sid)["lines"]
    cost_before = total_cost(ep_before)
    set_scene(ep_dir, sid, status="working")
    t0 = time.time()

    def fail(reason: str) -> dict:
        ep_rel = str((ep_dir / "episode.json").relative_to(ROOT))
        revert(ROOT, saved, [p for p in changed(before, snapshot(ROOT, ep_dir)) if p != ep_rel])
        restore(rd, ep_dir, sid)
        record(ep_dir, sid, rd, issue, f"❌ {reason}", cost_before, "error")
        return {"ok": False, "error": reason}

    error = ""
    for attempt in range(2):
        try:
            out = runner(build_prompt(ep_dir, sid, issue, error))
        except subprocess.TimeoutExpired:
            return fail(f"超过 {TIMEOUT // 60} 分钟未完成")
        except Exception as e:  # noqa: BLE001
            return fail(str(e))
        bad = check_boundary(ROOT, ep_dir, before, snapshot(ROOT, ep_dir), ep_before, load(ep_dir), sid)
        if bad:
            return fail("；".join(bad))
        if out.get("ask"):
            restore(rd, ep_dir, sid)
            record(ep_dir, sid, rd, issue, f"❓ {out['ask']}", cost_before, "asking")
            return {"ok": True, "ask": out["ask"]}
        try:
            revoice_if_needed(ep_dir, sid, lines_before)
        except Exception as e:  # noqa: BLE001
            return fail(f"重新配音失败：{e}")
        error = checker(ep_dir, sid)
        if not error:
            record(ep_dir, sid, rd, issue, out.get("summary", ""), cost_before, "pending", updated=True)
            return {"ok": True, "summary": out.get("summary", ""), "seconds": round(time.time() - t0)}
    return fail(f"检查未通过：{error[-300:]}")


def record(ep_dir: Path, sid: str, rd: Path, issue: str, summary: str, cost_before: float, status: str, **extra) -> None:
    ep = load(ep_dir)
    sc = scene_of(ep, sid)
    cost = round(total_cost(ep) - cost_before, 4)
    sc.setdefault("rounds", []).append({"n": int(rd.name[1:]), "issue": issue, "summary": summary, "cost": cost,
                                       "at": datetime.now().isoformat(timespec="seconds")})
    sc.update(status=status, costWarn=cost > COST_WARN, **extra)
    write_episode(ep_dir, ep)


def run_undo(ep_dir: Path, sid: str, n: int, checker=check_code) -> dict:
    """恢复到第 n 轮修改之前；之后的轮次标为已撤销。"""
    ep_dir = ep_dir.resolve()
    lines_before = scene_of(load(ep_dir), sid)["lines"]
    restore(ep_dir / "history" / sid / f"r{n}", ep_dir, sid)
    ep = load(ep_dir)
    sc = scene_of(ep, sid)
    for r in sc.get("rounds", []):
        if r["n"] >= n:
            r["undone"] = True
    sc.update(status="pending", updated=True)
    write_episode(ep_dir, ep)
    revoice_if_needed(ep_dir, sid, lines_before)
    err = checker(ep_dir, sid)
    return {"ok": not err, "error": err}


def main():
    cmd, ep_dir = sys.argv[1], Path(sys.argv[2])
    if cmd in ("edit", "undo"):
        import pipeline
        pipeline.load_env()
    if cmd == "edit":
        res = run_edit(ep_dir, sys.argv[3], sys.argv[4])
    elif cmd == "undo":
        res = run_undo(ep_dir, sys.argv[3], int(sys.argv[4]))
    elif cmd == "thumbs":
        ids = sys.argv[3:] or [sc["id"] for sc in load(ep_dir)["scenes"]]
        for sid in ids:
            thumb(ep_dir.resolve(), sid)
        res = {"ok": True, "count": len(ids)}
    else:
        sys.exit(f"未知命令 {cmd}")
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
