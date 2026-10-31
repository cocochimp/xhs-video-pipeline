from tools.sync_public import sync


def _setup(root):
    (root / "assets").mkdir()
    (root / "assets" / "a.png").write_bytes(b"png")
    (root / "assets" / "fonts").mkdir()   # 子目录不同步
    audio = root / "episodes" / "ep001" / "audio"
    audio.mkdir(parents=True)
    (audio / "vo_body.mp3").write_bytes(b"mp3")
    (audio / "timeline.json").write_text("{}")   # 只同步 mp3


def test_sync_copies_then_skips_unchanged(tmp_path):
    _setup(tmp_path)
    assert sync(tmp_path) == 2
    assert (tmp_path / "public/assets/a.png").read_bytes() == b"png"
    assert (tmp_path / "public/episodes/ep001/audio/vo_body.mp3").read_bytes() == b"mp3"
    assert not (tmp_path / "public/episodes/ep001/audio/timeline.json").exists()
    assert sync(tmp_path) == 0


def test_sync_recopies_changed_file(tmp_path):
    _setup(tmp_path)
    sync(tmp_path)
    (tmp_path / "assets" / "a.png").write_bytes(b"png-v2")
    assert sync(tmp_path) == 1
    assert (tmp_path / "public/assets/a.png").read_bytes() == b"png-v2"


def test_sync_recopies_same_size_file_with_older_mtime(tmp_path):
    import os
    _setup(tmp_path)
    sync(tmp_path)
    src = tmp_path / "assets" / "a.png"
    src.write_bytes(b"pnx")
    old = (tmp_path / "public/assets/a.png").stat().st_mtime - 100
    os.utime(src, (old, old))
    assert sync(tmp_path) == 1
    assert (tmp_path / "public/assets/a.png").read_bytes() == b"pnx"


def test_sync_skips_hidden_files(tmp_path):
    _setup(tmp_path)
    (tmp_path / "assets" / ".DS_Store").write_bytes(b"x")
    (tmp_path / "episodes/ep001/audio/.hidden.mp3").write_bytes(b"x")
    assert sync(tmp_path) == 2
    assert not (tmp_path / "public/assets/.DS_Store").exists()
    assert not (tmp_path / "public/episodes/ep001/audio/.hidden.mp3").exists()
