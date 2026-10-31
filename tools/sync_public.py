"""把 assets/ 和各期配音同步到 public/（Remotion 和网站都从 public/ 读静态文件）。只复制有变化的文件。

  .venv/bin/python tools/sync_public.py
"""

import shutil
from pathlib import Path


def _copy_if_changed(src: Path, dst: Path) -> bool:
    if dst.exists() and dst.stat().st_size == src.stat().st_size and dst.stat().st_mtime == src.stat().st_mtime:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def sync(root: Path) -> int:
    pub, n = root / "public", 0
    for f in sorted((root / "assets").glob("*")):
        if f.is_file():
            n += _copy_if_changed(f, pub / "assets" / f.name)
    for ep in sorted(p for p in (root / "episodes").glob("ep*") if p.is_dir()):
        for f in sorted((ep / "audio").glob("*.mp3")):
            n += _copy_if_changed(f, pub / "episodes" / ep.name / "audio" / f.name)
    return n


if __name__ == "__main__":
    print("同步了", sync(Path(__file__).resolve().parent.parent), "个文件")
