import React, { useRef, useState } from "react";
import { STAGES, Steps4, ago, api, stageIndex, useApp, usePoll, yuan, type Overview } from "./lib";

type Ep = Overview["episodes"][number];

const Title: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="titlerow"><h1>{children}</h1><span className="sp" />{right}</div>
);

/** 进行中和作品库共用的作品卡片：封面 + 内容 */
const WorkCard: React.FC<{ e: Ep; onCover?: () => void; cover?: React.ReactNode; info: React.ReactNode; actions: React.ReactNode }> = ({ e, onCover, cover, info, actions }) => {
  const src = e.cover;
  return (
    <article className="work">
      <div className="cover">
        {cover ?? (
          <button className="coverbtn" onClick={onCover} aria-label={`打开第 ${e.no} 期`}>
            {src ? <img src={src} alt="" /> : <span className="coverempty small">未选封面</span>}
          </button>
        )}
      </div>
      <div className="meta">
        <div className="small muted num">第 {e.no} 期</div>
        <h2>{e.title}</h2>
        {e.firstLine && <div className="small muted clip">{e.firstLine}</div>}
        <div className="small muted num" style={{ marginTop: 4 }}>{info}</div>
        <div className="acts">{actions}</div>
      </div>
    </article>
  );
};

export const TodoPage: React.FC<{ eps: Ep[] }> = ({ eps }) => {
  const { toast } = useApp();
  const del = (e: Ep) => confirm(`删除第 ${e.no} 期「${e.title}」？会移到 episodes/.trash，可以手动找回。`) &&
    api(`episodes/${e.id}/delete`, {}).then(() => toast("已删除"));
  const open = (e: Ep) => (location.hash = `work/${e.id}`);
  return (
    <>
      <Title right={<a className="btn primary" href="#new" style={{ display: "inline-flex", alignItems: "center" }}>新建作品</a>}>进行中 <span className="muted small num">{eps.length}</span></Title>
      {eps.length === 0 ? <div className="empty">没有进行中的作品。<a className="link" href="#new">新建一个</a></div> : (
        <div className="works">
          {[...eps].sort((a, b) => b.updated - a.updated).map((e) => (
            <WorkCard key={e.id} e={e} onCover={() => open(e)}
              info={<><Steps4 stage={e.stage} /> {STAGES[stageIndex(e.stage)][1]} · {e.duration ? `${Math.round(e.duration)} 秒 · ` : ""}{yuan(e.cost)} · {ago(e.updated)}</>}
              actions={<><button className="btn primary" onClick={() => open(e)}>继续{STAGES[stageIndex(e.stage)][1]}</button>
                <button className="btn" onClick={() => del(e)}>删除</button></>} />
          ))}
        </div>
      )}
    </>
  );
};

type Cat = { id: string; name: string; target?: number };
type TopicRow = { id: string; title: string; angle?: string; fav?: boolean; cat: string; status: "ok" | "pending"; ep?: string; no?: number; stage?: string };

/** 新建作品 = 选题库：分类、增删改、AI 出选题（先进「待审核」）、选一个开做 */
export const NewPage: React.FC = () => {
  const { toast } = useApp();
  const [db, reload] = usePoll<{ categories: Cat[]; topics: TopicRow[] }>("topics", 5000);
  const [jobs] = usePoll<{ kind: string; state: string; result?: { error?: string; added?: string[] } }[]>("jobs", 3000);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [own, setOwn] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string; angle: string; cat: string } | null>(null);
  const [adding, setAdding] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  if (!db) return null;
  const run = (path: string, body: object, msg?: string) => api(`topics/${path}`, body).then(() => { reload(); if (msg) toast(msg); }).catch((e) => toast(e.message));
  const sj = [...(jobs ?? [])].reverse().find((j) => j.kind === "topics");
  const suggesting = sj && (sj.state === "queued" || sj.state === "running");
  const ok = db.topics.filter((t) => t.status === "ok");
  const pending = db.topics.filter((t) => t.status === "pending");
  const name = (id: string) => db.categories.find((c) => c.id === id)?.name ?? "未分类";
  const favs = ok.filter((t) => t.fav);
  const list = (cat === "pending" ? pending : cat === "fav" ? favs : ok.filter((t) => cat === "all" || t.cat === cat))
    .filter((t) => !q || t.title.includes(q));
  const title = own.trim() || ok.find((t) => t.id === pick)?.title || "";
  const create = () => { setBusy(true); api<{ id: string }>("episodes", { title }).then((r) => (location.hash = `work/${r.id}/text`)).catch((e) => { toast(e.message); setBusy(false); }); };
  const addCat = () => { const n = prompt("新分类的名字"); if (n) run("cat", { name: n }); };
  const renameCat = (c: Cat) => { const n = prompt("分类改名", c.name); if (n && n !== c.name) run("cat", { id: c.id, name: n }); };
  const status = (t: TopicRow) => t.ep ? <a className={`pill ${t.stage === "done" ? "pos" : "acc"}`} href={`#work/${t.ep}`}>第{t.no}期 · {t.stage === "done" ? "已完结" : STAGES[stageIndex(t.stage!)][1] + "中"}</a> : <span className="small muted">未使用</span>;

  return (
    <>
      <Title>新建作品</Title>
      <div className="topiclib">
        <nav className="cats" aria-label="分类">
          {[{ id: "all", name: "全部", n: ok.length }, { id: "fav", name: "收藏", n: favs.length }, ...db.categories.map((c) => ({ ...c, n: ok.filter((t) => t.cat === c.id).length }))].map((c) => {
            return (
              <button key={c.id} className={`cat ${cat === c.id ? "on" : ""}`} onClick={() => setCat(c.id)} onDoubleClick={() => c.id !== "all" && c.id !== "fav" && renameCat(c as Cat)} title={c.id === "all" || c.id === "fav" ? "" : "双击改名"}>
                <span>{c.name}</span><span className="num small muted">{c.n}</span>
              </button>
            );
          })}
          <button className={`cat ${cat === "pending" ? "on" : ""}`} onClick={() => setCat("pending")}><span>待审核</span><span className="num small muted">{pending.length}</span></button>
          <button className="link small" style={{ margin: "8px 10px" }} onClick={addCat}>+ 新分类</button>
        </nav>

        <section className="tlist">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {db.topics.some((t) => !t.angle) && <button className="btn" disabled={suggesting} onClick={() => run("angles", {}, "AI 正在给没有方向的选题补方向")}>AI 补齐方向</button>}
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索选题" style={{ maxWidth: 260 }} />
            <span className="sp" />
            <input type="text" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="AI 出选题的方向（可不填）" style={{ maxWidth: 260 }} />
            <button className="btn" disabled={suggesting} onClick={() => run("suggest", { cat: db.categories.some((c) => c.id === cat) ? cat : "", hint }, "AI 正在出 5 个选题，好了会出现在「待审核」").then(() => setHint(""))}>
              {suggesting ? "AI 出选题中…" : "让 AI 出 5 个"}</button>
          </div>
          {sj?.state === "error" && <div className="notice neg" style={{ marginBottom: 12 }}>{sj.result?.error ?? "AI 没出成"}</div>}
          {cat === "pending" && pending.length > 0 && <div className="small muted" style={{ marginBottom: 8 }}>AI 出的选题，通过后才进选题库。</div>}
          <table>
            <thead><tr><th style={{ width: 28 }} /><th>选题</th><th>分类</th><th>状态</th><th /></tr></thead>
            <tbody>
              {list.map((t) => editing?.id === t.id ? (
                <tr key={t.id}>
                  <td />
                  <td><input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} autoFocus />
                    <input type="text" value={editing.angle} onChange={(e) => setEditing({ ...editing, angle: e.target.value })} placeholder="选题方向：这期从哪个角度讲" style={{ marginTop: 6 }} /></td>
                  <td><select value={editing.cat} onChange={(e) => setEditing({ ...editing, cat: e.target.value })}>{db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                  <td />
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn primary" onClick={() => run(t.id, { title: editing.title, angle: editing.angle, cat: editing.cat, ...(t.status === "pending" ? { status: "ok" } : {}) }, t.status === "pending" ? "已通过" : "已保存").then(() => setEditing(null))}>{t.status === "pending" ? "保存并通过" : "保存"}</button>
                    <button className="btn ghost" onClick={() => setEditing(null)}>取消</button></td>
                </tr>
              ) : (
                <tr key={t.id} className={t.status === "ok" && !t.ep ? "click" : ""} onClick={() => t.status === "ok" && !t.ep && (setPick(t.id), setOwn(""))}>
                  <td>{t.status === "ok" && !t.ep && <input type="radio" name="tp" checked={!own && pick === t.id} onChange={() => { setPick(t.id); setOwn(""); }} aria-label="选这个" />}</td>
                  <td>{t.title}{t.angle && <div className="small muted">{t.angle}</div>}</td>
                  <td className="small muted">{name(t.cat)}</td>
                  <td>{t.status === "pending" ? <span className="pill warn">待审核</span> : status(t)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(ev) => ev.stopPropagation()}>
                    {t.status === "pending" && <button className="btn" onClick={() => run(t.id, { status: "ok" }, "已通过")}>通过</button>}
                    <button className="btn ghost" onClick={() => setEditing({ id: t.id, title: t.title, angle: t.angle ?? "", cat: t.cat })}>{t.status === "pending" ? "改一下" : "编辑"}</button>
                    {t.status === "ok" && <button className={`star ${t.fav ? "on" : ""}`} onClick={() => run(t.id, { fav: !t.fav }, t.fav ? "已取消收藏" : "已收藏")} aria-label={t.fav ? "取消收藏" : "收藏"} title={t.fav ? "取消收藏" : "收藏，想发的先存这里"}>{t.fav ? "★" : "☆"}</button>}
                    {!t.ep && <button className="btn ghost" onClick={() => confirm(`删除「${t.title}」？`) && run(`${t.id}/delete`, {}, "已删除")}>{t.status === "pending" ? "放弃" : "删除"}</button>}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="muted small" style={{ height: 80, textAlign: "center" }}>{cat === "pending" ? "没有待审核的选题。点「让 AI 出 5 个」。" : cat === "fav" ? "还没有收藏。点选题后面的 ☆，想发的先存这里。" : "这个分类还没有选题。"}</td></tr>}
            </tbody>
          </table>
          {cat !== "pending" && cat !== "fav" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input type="text" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="加一个选题" style={{ maxWidth: 360 }}
                onKeyDown={(e) => e.key === "Enter" && adding.trim() && run("add", { title: adding, cat: db.categories.some((c) => c.id === cat) ? cat : "" }, "已加入").then(() => setAdding(""))} />
              <button className="btn" disabled={!adding.trim()} onClick={() => run("add", { title: adding, cat: db.categories.some((c) => c.id === cat) ? cat : "" }, "已加入").then(() => setAdding(""))}>加入选题库</button>
            </div>
          )}
        </section>

        <aside className="card newbox">
          <h2>新建作品</h2>
          <div className="small muted" style={{ margin: "4px 0 12px" }}>在左边选一个未使用的选题，或者自己写一句。</div>
          <div style={{ minHeight: 44, fontWeight: 500 }}>{title || <span className="muted">还没选</span>}</div>
          <input type="text" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="自己写一句" style={{ marginTop: 8 }} />
          <button className="btn primary" style={{ width: "100%", marginTop: 12 }} disabled={!title || busy} onClick={create}>{busy ? "创建中…" : "确定选题，写文本"}</button>
        </aside>
      </div>
    </>
  );
};

export const LibraryPage: React.FC<{ eps: Ep[] }> = ({ eps }) => {
  const { toast } = useApp();
  const [playing, setPlaying] = useState("");
  const [jobs] = usePoll<{ ep?: string; kind: string; state: string; arg?: string }[]>("jobs", 3000);
  const exporting = (id: string) => jobs?.some((j) => j.ep === id && j.kind === "render" && j.arg === "hd" && (j.state === "queued" || j.state === "running"));
  const reopen = (e: Ep) => api(`episodes/${e.id}/reopen`, {}).then(() => { toast("已拉回审片台"); location.hash = `work/${e.id}/review`; });
  const sorted = [...eps].sort((x, y) => y.no - x.no);
  return (
    <>
      <Title>作品库 <span className="muted small num">{eps.length}</span></Title>
      {eps.length === 0 ? <div className="empty">还没有完结的作品。审片全部通过并渲染成片后，作品会出现在这里。</div> : (
        <div className="works">
          {sorted.map((e) => (
            <WorkCard key={e.id} e={e} onCover={() => setPlaying(e.id)}
              cover={playing === e.id ? <video src={`/api/video/${e.id}`} controls autoPlay /> : undefined}
              info={<>{e.duration ? `${Math.round(e.duration)} 秒` : "—"} · {yuan(e.cost)} · {e.doneAt ? ago(Date.parse(e.doneAt)) + "完结" : "已完结"}</>}
              actions={<>{e.hd ? <a className="btn primary" href={`/api/video/${e.id}?hd=1&download=1`}>下载高清</a>
                : <button className="btn primary" disabled={exporting(e.id)} onClick={() => api(`episodes/${e.id}/export`, {}).then(() => toast("开始导出高清（2160×1620），约 5 分钟"))}>{exporting(e.id) ? "导出中…" : "导出高清"}</button>}
                {e.cover && <a className="btn" href={`/api/cover/${e.id}`}>下载封面</a>}
                <button className="btn" onClick={() => reopen(e)}>重新审片</button></>} />
          ))}
        </div>
      )}
    </>
  );
};

type Lib = {
  mix: { bgm: number; sfx: Record<string, number> };
  voice: { speaker: string; rate: number }; voices: { name: string; speaker: string }[]; bgm: string | null; bgmFiles: string[];
  sfx: { kind: string; name: string; uses: number }[]; poses: string[]; props: string[]; components: [string, string][];
};

const play = (url: string, volume = 1) => { const a = new Audio(url); a.volume = Math.min(1, volume); void a.play(); };

/** 音量倍数：0～2 倍，松手保存 */
const Volume: React.FC<{ value: number; onSave: (v: number) => void }> = ({ value, onSave }) => {
  const [v, setV] = useState<number | null>(null);
  const cur = v ?? value;
  return (
    <label className="small muted" style={{ marginRight: 16, whiteSpace: "nowrap" }}>音量{" "}
      <input type="range" min={0} max={2} step={0.05} value={cur} onChange={(e) => setV(+e.target.value)}
        onPointerUp={() => { if (v != null) { onSave(v); setV(null); } }} style={{ verticalAlign: "middle", width: 110 }} />{" "}
      <span className="num">{cur.toFixed(2)}×</span></label>
  );
};

export const AudioPage: React.FC<{ tab?: string }> = ({ tab = "voice" }) => {
  const { ask, toast } = useApp();
  const [lib, reload] = usePoll<Lib>("library", 10000);
  const [eps] = usePoll<Overview>("overview", 10000);
  const file = useRef<HTMLInputElement>(null);
  const [rate, setRate] = useState<number | null>(null);
  if (!lib) return null;
  const cur = lib.voice;
  const r = rate ?? cur.rate;
  const open = (eps?.episodes ?? []).filter((e) => e.stage !== "done" && e.stage !== "text" && e.stage !== "topic").length;
  const setVoice = (v: object, msg: string) => api("config", { voice: v }).then(() => { reload(); toast(msg); });
  const preview = (speaker: string) => { toast("合成试听中，约 ¥0.01"); api<{ url: string }>("voice", { speaker, rate: r }).then((x) => play(x.url)).catch((e) => toast(e.message)); };
  const upload = (f: File) => fetch(`/api/upload?name=${encodeURIComponent(f.name)}`, { method: "POST", body: f }).then(() => { reload(); toast("已上传"); });
  const addVoice = () => {
    const speaker = prompt("豆包语音 2.0 的音色 ID（在火山引擎音色列表里复制）"); if (!speaker) return;
    const name = prompt("给它起个名字") || speaker;
    api("config", { addVoice: { name, speaker } }).then(reload);
  };
  const tabs = [["voice", "配音"], ["bgm", "背景音乐"], ["sfx", "音效"]];
  return (
    <>
      <Title right={tab === "voice" ? <button className="btn" onClick={addVoice}>添加音色</button> : tab === "bgm" ?
        <><input ref={file} type="file" accept=".mp3,.wav,.m4a" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /><button className="btn" onClick={() => file.current?.click()}>上传</button></> : null}>音效库</Title>
      <div className="tabs" role="tablist">{tabs.map(([k, n]) => <button key={k} role="tab" className={`tab ${k === tab ? "on" : ""}`} onClick={() => (location.hash = `audio/${k}`)}>{n}</button>)}</div>
      {tab === "voice" && (
        <table>
          <thead><tr><th>音色</th><th>音色 ID</th><th /></tr></thead>
          <tbody>
            {lib.voices.map((v) => {
              const on = v.speaker === cur.speaker;
              return (
                <tr key={v.speaker}>
                  <td>{v.name}　{on && <span className="pill pos">当前使用</span>}</td>
                  <td className="mono small muted">{v.speaker}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {on && <label className="small muted" style={{ marginRight: 16 }}>语速 <input type="range" min={-50} max={50} value={r} onChange={(e) => setRate(+e.target.value)} onMouseUp={() => setVoice({ rate: r }, `语速改为 ${r}，之后新配的音生效`)} style={{ verticalAlign: "middle", width: 120 }} /> <span className="num">{r > 0 ? `+${r}` : r}</span></label>}
                    <button className="btn ghost" onClick={() => preview(v.speaker)}>试听</button>
                    {!on && <button className="btn ghost" onClick={() => confirm(`切换到「${v.name}」？${open ? `有 ${open} 个进行中的作品，下次改台词或生成时会按新音色重配。` : ""}`) && setVoice({ speaker: v.speaker }, `已切换到 ${v.name}`)}>设为当前</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {tab === "bgm" && (
        <table>
          <thead><tr><th>背景音乐</th><th /></tr></thead>
          <tbody>
            {[null, ...lib.bgmFiles].map((f) => (
              <tr key={f ?? "builtin"}>
                <td>{f ?? "木琴循环（程序合成，占位）"}　{lib.bgm === f && <span className="pill pos">当前使用</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {lib.bgm === f && <Volume value={lib.mix.bgm} onSave={(v) => api("config", { mix: { bgm: v } }).then(() => { reload(); toast(`背景音乐音量 ${v.toFixed(2)}×，下次渲染生效`); })} />}
                  <button className="btn ghost" onClick={() => play(f ? `/assets/audio/bgm/${encodeURIComponent(f)}` : "/library/bgm_builtin.wav", 0.5 * (lib.bgm === f ? lib.mix.bgm : 1))}>试听</button>
                  {lib.bgm !== f && <button className="btn ghost" onClick={() => api("config", { bgm: f }).then(() => { reload(); toast("下次渲染生效"); })}>设为当前</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === "sfx" && (
        <table>
          <thead><tr><th>音效</th><th /></tr></thead>
          <tbody>
            {lib.sfx.map((s) => (
              <tr key={s.kind}>
                <td>{s.name}　<span className="small muted">用在 {s.uses} 处</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <Volume value={lib.mix.sfx[s.kind] ?? 1} onSave={(v) => api("config", { mix: { sfx: { [s.kind]: v } } }).then(() => { reload(); toast(`「${s.name}」音量 ${v.toFixed(2)}×，下次渲染生效`); })} />
                  <button className="btn ghost" onClick={() => play(`/library/sfx_${s.kind}.wav`, 0.8 * (lib.mix.sfx[s.kind] ?? 1))}>试听</button>
                  <button className="btn ghost" onClick={() => ask(`「${s.name}」(${s.kind}) 这个音效我想换一下：`)}>让 AI 换</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(tab === "bgm" || tab === "sfx") && <FreeSources tab={tab} />}
    </>
  );
};

const SOURCES = {
  bgm: [
    ["Pixabay 音乐", "https://pixabay.com/music/", "可商用，不用署名；可按「欢快 / 轻松」筛选"],
    ["Mixkit 音乐", "https://mixkit.co/free-stock-music/", "可商用，不用署名；曲目少但质量稳定"],
    ["Uppbeat", "https://uppbeat.io/", "免费账号每月可下 3 首，发视频时按提示署名"],
    ["YouTube 音频库", "https://www.youtube.com/audiolibrary", "要登录 YouTube；标着「无需署名」的可直接用"],
  ],
  sfx: [
    ["Pixabay 音效", "https://pixabay.com/sound-effects/", "可商用，不用署名；搜 pop、ding、click"],
    ["Mixkit 音效", "https://mixkit.co/free-sound-effects/", "可商用，不用署名；按类别分好了"],
    ["Freesound", "https://freesound.org/search/?f=license:%22Creative+Commons+0%22", "链接已筛选 CC0（无需署名），要注册才能下载"],
  ],
} as const;

const FreeSources: React.FC<{ tab: "bgm" | "sfx" }> = ({ tab }) => (
  <section style={{ marginTop: 32 }}>
    <h2 style={{ marginBottom: 8 }}>免费素材去哪找</h2>
    <p className="small muted" style={{ margin: "0 0 8px" }}>下载前看一眼单个文件的授权，下载后点右上角「上传」加进来。</p>
    <table><tbody>{SOURCES[tab].map(([n, u, d]) => (
      <tr key={u}><td><a className="link" href={u} target="_blank" rel="noreferrer">{n}</a></td><td className="muted small">{d}</td></tr>
    ))}</tbody></table>
  </section>
);

export const ComponentsPage: React.FC = () => {
  const { ask } = useApp();
  const [lib] = usePoll<Lib>("library", 10000);
  if (!lib) return null;
  const label = (f: string) => f.replace(/^(pose|prop)_|\.png$/g, "");
  const Tiles: React.FC<{ files: string[]; kind: string }> = ({ files, kind }) => (
    <div className="tiles">
      {files.map((f) => (
        <div key={f} className="tile"><img src={`/assets/${f}`} alt={label(f)} loading="lazy" />
          <div className="row"><span className="mono small">{label(f)}</span><span className="sp" /><button className="link small" onClick={() => ask(`重画${kind}「${label(f)}」：`)}>重画</button></div></div>
      ))}
      <button className="tile add" onClick={() => ask(`新画一个${kind}：`)}>让 AI 画一个新的</button>
    </div>
  );
  return (
    <>
      <Title>组件库</Title>
      <div className="grid">
        <section><h2 style={{ marginBottom: 12 }}>阿牛姿势 <span className="muted small num">{lib.poses.length}</span></h2><Tiles files={lib.poses} kind="阿牛姿势" /></section>
        <section><h2 style={{ marginBottom: 12 }}>道具 <span className="muted small num">{lib.props.length}</span></h2><Tiles files={lib.props} kind="道具" /></section>
        <section><h2 style={{ marginBottom: 12 }}>动画组件</h2>
          <table><thead><tr><th>组件</th><th>效果</th></tr></thead>
            <tbody>{lib.components.map(([n, d]) => <tr key={n}><td className="mono small">{n}</td><td>{d}</td></tr>)}</tbody></table></section>
      </div>
    </>
  );
};
