import json

import pytest

from studio.guard import backup, check_boundary, restore, snapshot, write_episode
from tests.helpers import make_episode


@pytest.fixture
def repo(tmp_path):
    (tmp_path / "studio").mkdir()
    (tmp_path / "studio/config.json").write_text("{}")
    (tmp_path / "shared").mkdir()
    (tmp_path / "shared/ui.tsx").write_text("ui")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets/a.png").write_bytes(b"a")
    ep = tmp_path / "episodes/ep999"
    (ep / "scenes").mkdir(parents=True)
    for s in ("s01", "s02", "s03"):
        (ep / f"scenes/{s}.tsx").write_text(s)
    write_episode(ep, make_episode())
    return tmp_path, ep


def _check(root, ep, mutate):
    before, epb = snapshot(root, ep), json.loads((ep / "episode.json").read_text())
    mutate()
    return check_boundary(root, ep, before, snapshot(root, ep), epb,
                          json.loads((ep / "episode.json").read_text()), "s03")


def _edit_ep(ep, fn):
    e = json.loads((ep / "episode.json").read_text())
    fn(e)
    write_episode(ep, e)


def test_own_scene_and_lines_allowed(repo):
    root, ep = repo
    def m():
        (ep / "scenes/s03.tsx").write_text("new")
        _edit_ep(ep, lambda e: e["scenes"][2]["lines"][0].update(zh="改"))
        _edit_ep(ep, lambda e: e.update(cost={"tts": 9}))
        (root / "assets/new.png").write_bytes(b"n")
    assert _check(root, ep, m) == []


def test_other_scene_file_rejected(repo):
    root, ep = repo
    assert _check(root, ep, lambda: (ep / "scenes/s01.tsx").write_text("x"))


def test_shared_and_existing_asset_rejected(repo):
    root, ep = repo
    assert len(_check(root, ep, lambda: [(root / "shared/ui.tsx").write_text("x"),
                                         (root / "assets/a.png").write_bytes(b"x")])) == 2


def test_other_scene_lines_and_top_level_rejected(repo):
    root, ep = repo
    assert _check(root, ep, lambda: _edit_ep(ep, lambda e: e["scenes"][0]["lines"][0].update(zh="x")))
    assert _check(root, ep, lambda: _edit_ep(ep, lambda e: e.update(title="x")))


def test_backup_restore_keeps_meta(repo):
    root, ep = repo
    rd = backup(ep, "s03")
    assert rd.name == "r1" and backup(ep, "s03").name == "r2"
    (ep / "scenes/s03.tsx").write_text("changed")
    _edit_ep(ep, lambda e: (e["scenes"][2]["lines"][0].update(zh="改"), e["scenes"][2].update(rounds=[1])))
    restore(rd, ep, "s03")
    sc = json.loads((ep / "episode.json").read_text())["scenes"][2]
    assert (ep / "scenes/s03.tsx").read_text() == "s03"
    assert sc["lines"][0]["zh"] == "一二" and sc["rounds"] == [1]
