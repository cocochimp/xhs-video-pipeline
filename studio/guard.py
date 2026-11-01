"""改片的边界检查和备份：AI 只能改指定的那一片。"""

import hashlib
import json
import shutil
from pathlib import Path

SCENE_FIELDS = ("lines", "visual", "sfx")      # AI 可以改的场景字段
META_FIELDS = ("status", "rounds", "updated", "voiceUpdated", "costWarn", "textStatus")  # 场景级；期级的 cover/covers 由网站维护  # 网站维护的字段


def _files(root: Path, ep_dir: Path) -> list[Path]:
    files = [root / "studio/config.json"]
    for d in (root / "shared", root / "assets"):
        files += [p for p in d.rglob("*") if p.is_file()]
    files += [p for p in ep_dir.rglob("*") if p.is_file()
              and not {"audio", "history", "thumbs"} & set(p.relative_to(ep_dir).parts)]
    for d in ("tools", "opening", "aniu", "studio", "shared"):  # 代码也不许 AI 改
        files += [p for p in (root / d).rglob("*") if p.suffix in (".py", ".ts", ".tsx", ".md", ".css", ".html") and ".venv" not in p.parts]
    return sorted({p for p in files if p.exists() and not p.name.startswith(".")})


def capture(root: Path, ep_dir: Path) -> dict[str, bytes]:
    """改片前的文件内容，用于还原越界改动。"""
    return {str(p.relative_to(root)): p.read_bytes() for p in _files(root, ep_dir)}


def revert(root: Path, saved: dict[str, bytes], paths: list[str]) -> None:
    """把这些路径恢复成 saved 里的内容；saved 里没有的（新建的）删除。"""
    for rel in paths:
        p = root / rel
        if rel in saved:
            p.write_bytes(saved[rel])
        else:
            p.unlink(missing_ok=True)


def changed(before: dict[str, str], after: dict[str, str]) -> list[str]:
    return sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p))


def snapshot(root: Path, ep_dir: Path) -> dict[str, str]:
    """{相对路径: sha1}：本期目录（不含 audio/history/thumbs）、shared/、assets/、studio/config.json。"""
    return {str(p.relative_to(root)): hashlib.sha1(p.read_bytes()).hexdigest() for p in _files(root, ep_dir)}


def _strip(ep: dict, keep_scene: str | None = None) -> dict:
    """去掉允许变化的部分后的 episode，用于比较。"""
    e = {k: v for k, v in ep.items() if k != "cost"}
    e["scenes"] = [{k: v for k, v in sc.items() if k not in META_FIELDS
                    and not (sc["id"] == keep_scene and k in SCENE_FIELDS)} for sc in ep["scenes"]]
    return e


def check_boundary(root: Path, ep_dir: Path, before: dict, after: dict,
                   ep_before: dict, ep_after: dict, scene_id: str) -> list[str]:
    """返回违规说明列表；空列表表示改动都在允许范围内。"""
    ep_rel = str((ep_dir / "episode.json").relative_to(root))
    scene_rel = str((ep_dir / "scenes" / f"{scene_id}.tsx").relative_to(root))
    bad = []
    for path in sorted(set(before) | set(after)):
        if before.get(path) == after.get(path) or path in (ep_rel, scene_rel):
            continue
        if path.startswith("assets/") and path not in before:
            continue  # 新增素材允许
        bad.append(f"改动了不允许的文件：{path}")
    if _strip(ep_before, scene_id) != _strip(ep_after, scene_id):
        bad.append("episode.json 中本片 lines/visual/sfx 以外的内容被改动")
    return bad


def backup(ep_dir: Path, scene_id: str) -> Path:
    base = ep_dir / "history" / scene_id
    n = 1 + max([int(p.name[1:]) for p in base.glob("r*") if p.name[1:].isdigit()], default=0)
    rd = base / f"r{n}"
    rd.mkdir(parents=True)
    shutil.copy2(ep_dir / "scenes" / f"{scene_id}.tsx", rd / f"{scene_id}.tsx")
    shutil.copy2(ep_dir / "episode.json", rd / "episode.json")
    return rd


def restore(round_dir: Path, ep_dir: Path, scene_id: str) -> None:
    """拷回场景文件；episode.json 只恢复本片 lines/visual/sfx，保留状态、记录和花费。"""
    shutil.copy2(round_dir / f"{scene_id}.tsx", ep_dir / "scenes" / f"{scene_id}.tsx")
    old = {sc["id"]: sc for sc in json.loads((round_dir / "episode.json").read_text())["scenes"]}[scene_id]
    ep = json.loads((ep_dir / "episode.json").read_text())
    for sc in ep["scenes"]:
        if sc["id"] == scene_id:
            for k in SCENE_FIELDS:
                if k in old:
                    sc[k] = old[k]
    write_episode(ep_dir, ep)


def write_episode(ep_dir: Path, ep: dict) -> None:
    (ep_dir / "episode.json").write_text(json.dumps(ep, ensure_ascii=False, indent=2) + "\n")
