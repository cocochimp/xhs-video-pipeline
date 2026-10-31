import json
import subprocess

import pytest

import studio.edit as E
from studio.guard import write_episode
from tests.helpers import make_episode


@pytest.fixture
def ep(tmp_path, monkeypatch):
    tmp_path = tmp_path.resolve()  # macOS: /var → /private/var，与 run_edit 里的 resolve() 一致
    for d in ("studio", "shared", "assets"):
        (tmp_path / d).mkdir()
    (tmp_path / "studio/config.json").write_text("{}")
    (tmp_path / "studio/rules.md").write_text("规则")
    (tmp_path / "assets/prop_a.png").write_bytes(b"a")
    d = tmp_path / "episodes/ep999"
    (d / "scenes").mkdir(parents=True)
    (d / "audio").mkdir()
    for s in ("s01", "s02", "s03"):
        (d / f"scenes/{s}.tsx").write_text(s)
    (d / "audio/timeline.json").write_text(json.dumps({"scenes": {s: {"start": 0, "end": 1} for s in ("s01", "s02", "s03")}}))
    write_episode(d, make_episode())
    monkeypatch.setattr(E, "ROOT", tmp_path)
    return d


def scene(d, sid="s03"):
    return E.scene_of(E.load(d), sid)


def ok_checker(d, sid):
    return ""


def test_edit_success_records_round(ep):
    def runner(prompt):
        assert "规则" in prompt and "慢一点" in prompt
        (ep / "scenes/s03.tsx").write_text("new")
        return {"summary": "放慢了", "ask": None}
    res = E.run_edit(ep, "s03", "慢一点", runner=runner, checker=ok_checker)
    sc = scene(ep)
    assert res["ok"] and sc["status"] == "pending" and sc["updated"]
    assert sc["rounds"][-1]["summary"] == "放慢了" and (ep / "scenes/s03.tsx").read_text() == "new"


def test_out_of_bounds_is_restored(ep):
    def runner(prompt):
        (ep / "scenes/s03.tsx").write_text("new")
        (ep / "scenes/s01.tsx").write_text("hacked")
        return {"summary": "", "ask": None}
    res = E.run_edit(ep, "s03", "顺便改 s01", runner=runner, checker=ok_checker)
    assert not res["ok"] and scene(ep)["status"] == "error"
    assert (ep / "scenes/s03.tsx").read_text() == "s03"
    assert "s01.tsx" in scene(ep)["rounds"][-1]["summary"]
    assert (ep / "scenes/s01.tsx").read_text() == "s01"


def test_timeout_restores(ep):
    def runner(prompt):
        (ep / "scenes/s03.tsx").write_text("half")
        raise subprocess.TimeoutExpired("claude", 300)
    res = E.run_edit(ep, "s03", "x", runner=runner, checker=ok_checker)
    assert not res["ok"] and (ep / "scenes/s03.tsx").read_text() == "s03"


def test_ask_sets_asking(ep):
    res = E.run_edit(ep, "s03", "改好看点", runner=lambda p: {"summary": "", "ask": "哪里不好看？"}, checker=ok_checker)
    assert res["ask"] and scene(ep)["status"] == "asking"


def test_checker_retry_then_fail(ep):
    calls = []
    def runner(prompt):
        calls.append(prompt)
        (ep / "scenes/s03.tsx").write_text("bad")
        return {"summary": "", "ask": None}
    res = E.run_edit(ep, "s03", "x", runner=runner, checker=lambda d, s: "TS2304 错误")
    assert len(calls) == 2 and "TS2304" in calls[1]
    assert not res["ok"] and (ep / "scenes/s03.tsx").read_text() == "s03"


def test_undo_restores_round(ep):
    def runner(prompt):
        (ep / "scenes/s03.tsx").write_text("v" + str(len(scene(ep).get("rounds", [])) + 1))
        return {"summary": "改", "ask": None}
    E.run_edit(ep, "s03", "a", runner=runner, checker=ok_checker)
    E.run_edit(ep, "s03", "b", runner=runner, checker=ok_checker)
    assert (ep / "scenes/s03.tsx").read_text() == "v2"
    E.run_undo(ep, "s03", 2, checker=ok_checker)
    assert (ep / "scenes/s03.tsx").read_text() == "v1"
    assert [r.get("undone", False) for r in scene(ep)["rounds"]] == [False, True]
