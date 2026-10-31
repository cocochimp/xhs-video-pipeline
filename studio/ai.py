"""调用本机 Claude Code，并记账：每次调用的花费（美元，按官方价折算）写进 studio/usage.json。
packyapi 余额：~/.config/xhs-video/.env 里有 PACKY_ACCESS_TOKEN 和 PACKY_USER_ID 时才查询。
"""

import json
import os
import subprocess
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USAGE = ROOT / "studio/usage.json"
TIMEOUT = 300
EDIT_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep", "Bash(.venv/bin/python tools/gen_asset.py:*)"]
READ_TOOLS = ["Read", "Glob", "Grep"]


def record(kind: str, usd: float) -> None:
    rows = json.loads(USAGE.read_text()) if USAGE.exists() else []
    rows.append({"at": datetime.now().isoformat(timespec="seconds"), "kind": kind, "usd": round(usd, 4)})
    USAGE.write_text(json.dumps(rows[-2000:], ensure_ascii=False))


def claude(prompt: str, kind: str, tools=EDIT_TOOLS, resume: str | None = None, timeout: int = TIMEOUT) -> tuple[str, str]:
    """返回 (回复文本, session_id)。"""
    args = ["claude", "-p", prompt, "--output-format", "json", "--permission-mode", "acceptEdits", "--allowedTools", *tools]
    if resume:
        args += ["--resume", resume]
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"Claude Code 失败：{(r.stderr or r.stdout).strip()[-300:]}")
    out = json.loads(r.stdout)
    record(kind, out.get("total_cost_usd") or 0)
    return out.get("result", ""), out.get("session_id", "")


def last_json(text: str) -> dict | None:
    for line in reversed(text.strip().splitlines()):
        line = line.strip().strip("`")
        if line.startswith("{"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                return None
    return None


def packy_balance() -> float | None:
    """packyapi（NewAPI）余额，美元。没配置或查询失败返回 None。"""
    token, uid = os.environ.get("PACKY_ACCESS_TOKEN"), os.environ.get("PACKY_USER_ID")
    if not (token and uid):
        return None
    req = urllib.request.Request("https://www.packyapi.ai/api/user/self",
                                 headers={"Authorization": f"Bearer {token}", "New-Api-User": uid})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())["data"]
        return round(data["quota"] / 500000, 2)  # NewAPI 默认 50 万额度 = 1 美元
    except Exception:  # noqa: BLE001
        return None


def summary() -> dict:
    rows = json.loads(USAGE.read_text()) if USAGE.exists() else []
    month = datetime.now().strftime("%Y-%m")
    return {"aiMonthUsd": round(sum(r["usd"] for r in rows if r["at"].startswith(month)), 2),
            "aiTotalUsd": round(sum(r["usd"] for r in rows), 2), "packyUsd": packy_balance()}


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(ROOT))
    import pipeline
    pipeline.load_env()
    print(json.dumps(summary()))
