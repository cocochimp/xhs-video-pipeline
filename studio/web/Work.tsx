import { Player } from "@remotion/player";
import React, { useMemo, useState } from "react";
import { EPISODES } from "../../episodes";
import { Episode } from "../../shared/Episode";
import { FPS, f } from "../../shared/theme";
import type { EpisodeJson, EpisodeModule } from "../../shared/types";
import { STAGES, api, stageIndex, useApp, usePoll, yuan, type Job } from "./lib";

type Round = { n: number; issue: string; summary: string; cost: number; at: string; undone?: boolean };
type Scene = Omit<EpisodeJson["scenes"][number], "rounds"> & { updated?: boolean; voiceUpdated?: boolean; costWarn?: boolean; rounds: Round[] };
type Ep = Omit<EpisodeJson, "scenes"> & { scenes: Scene[]; textRounds?: { issue: string; summary: string; at: string }[] };

const STATUS: Record<string, [string, string]> = {
  pending: ["待审", ""], queued: ["排队中", "warn"], working: ["AI 修改中", "warn"], approved: ["已通过", "pos"], asking: ["等你回复", "warn"], error: ["出错", "neg"],
};
const running = (j?: Job) => j && (j.state === "queued" || j.state === "running");

export const WorkPage: React.FC<{ id: string; tab?: string }> = ({ id, tab }) => {
  const [ep] = usePoll<Ep>(`episodes/${id}`, 2000);
  const [jobs] = usePoll<Job[]>("jobs", 2000);
  if (!ep) return <div className="empty">加载中…</div>;
  const myJobs = (jobs ?? []).filter((j) => j.ep === id);
  const last = (k: string) => [...myJobs].reverse().find((j) => j.kind === k);
  const cur = ep.stage === "done" ? 3 : stageIndex(ep.stage);
  const i = tab ? STAGES.findIndex(([k]) => k === tab) : cur;
  const go = (k: string) => (location.hash = `work/${id}/${k}`);
  const cost = ep.cost.tts + ep.cost.image;
  return (
    <>
      <div className="titlerow"><h1>{ep.title}</h1><span className="sp" /><span className="small muted num">第 {ep.no} 期 · 花费 {yuan(cost)}</span></div>
      <div className="tabs" role="tablist">
        {STAGES.map(([k, n], k2) => (
          <button key={k} role="tab" className={`tab ${k2 === i ? "on" : ""}`} disabled={k2 > cur} onClick={() => go(k)}>{n}</button>
        ))}
      </div>
      {i === 0 && <TopicStep ep={ep} />}
      {i === 1 && <TextStep ep={ep} job={last("text")} />}
      {i === 2 && <GenStep ep={ep} job={last("gen")} />}
      {i === 3 && <ReviewStep ep={ep} renderJob={last("render")} />}
    </>
  );
};

const TopicStep: React.FC<{ ep: Ep }> = ({ ep }) => {
  const { toast, ask } = useApp();
  const [t, setT] = useState(ep.title);
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>选题</h2>
      <input type="text" value={t} onChange={(e) => setT(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn" onClick={() => ask(`第 ${ep.no} 期的选题「${ep.title}」，帮我换几个更抓人的说法`)}>让 AI 改说法</button>
        <span className="sp" />
        <button className="btn primary" disabled={t.trim() === ep.title || !t.trim()} onClick={() => api(`episodes/${ep.id}/title`, { title: t }).then(() => toast("选题已更新"))}>保存</button>
      </div>
      {ep.scenes.length > 0 && <div className="small muted" style={{ marginTop: 12 }}>改了选题之后，可以到「文本」里让 AI 按新选题改稿。</div>}
    </div>
  );
};

const zh = (s: string) => s.split(/(【[^】]*】)/).map((p, i) => (p.startsWith("【") ? <em key={i}>{p.slice(1, -1)}</em> : p));

const TextStep: React.FC<{ ep: Ep; job?: Job }> = ({ ep, job }) => {
  const [issue, setIssue] = useState("");
  const busy = running(job);
  const chars = ep.scenes.reduce((s, sc) => s + sc.lines.reduce((a, l) => a + l.say.length, 0), 0);
  const locked = ep.stage !== "text";
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 340px", alignItems: "start" }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}><h2>整期文本</h2><span className="sp" />
          {ep.scenes.length > 0 && <span className="small muted num">{ep.scenes.length} 个分镜 · {chars} 字</span>}</div>
        {ep.scenes.length === 0 ? <div className="empty">{busy ? "AI 正在写初稿，大约 1 分钟…" : job?.state === "error" ? "初稿没写成。" : "还没有文本。"}</div> : (
          <div className="script">
            {ep.scenes.map((sc) => (
              <div key={sc.id} className="row">
                <span className="mono small muted">{sc.id}</span>
                <div>{sc.lines.map((l, k) => <div key={k}>{zh(l.zh)}</div>)}<div className="small muted" style={{ marginTop: 4 }}>画面：{sc.visual}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        {locked ? <div className="small muted">文本已通过。要改台词，到「审片」里对单个分镜提问题。</div> : (
          <>
            <h2>哪里要改？</h2>
            <textarea rows={5} value={issue} onChange={(e) => setIssue(e.target.value)} disabled={busy} placeholder="比如：第三段的数字太突然，前面先铺垫一下" />
            {job?.state === "error" && <div className="notice neg" style={{ marginTop: 10 }}>{job.result?.error ?? "AI 没写成"}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" disabled={busy || (!issue.trim() && ep.scenes.length > 0)} onClick={() => api(`episodes/${ep.id}/text`, { issue }).then(() => setIssue(""))}>
                {busy ? "AI 写作中…" : ep.scenes.length ? "交给 AI 改" : "重新写初稿"}</button>
              <span className="sp" />
              <button className="btn primary" disabled={busy || !ep.scenes.length} onClick={() => api(`episodes/${ep.id}/text-ok`, {}).then(() => (location.hash = `work/${ep.id}/gen`))}>文本通过，开始生成</button>
            </div>
            {ep.scenes.length > 0 && <div className="small muted" style={{ marginTop: 10 }}>通过后开始花钱：配音约 {yuan(chars * 0.0003)}，需要新画面时每张 ¥0.12。</div>}
          </>
        )}
        {(ep.textRounds ?? []).length > 0 && (
          <div className="rounds" style={{ marginTop: 16 }}>
            {[...ep.textRounds!].reverse().map((r, k) => <div key={k}><span className="muted">{r.issue}</span><br />{r.summary}</div>)}
          </div>
        )}
      </div>
    </div>
  );
};

const GenStep: React.FC<{ ep: Ep; job?: Job }> = ({ ep, job }) => {
  const busy = running(job);
  if (ep.stage === "review" || ep.stage === "done") return <div className="card" style={{ maxWidth: 640 }}>已生成。<a className="link" href={`#work/${ep.id}/review`}>去审片</a></div>;
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>{busy ? "生成中" : job?.state === "error" ? "生成没完成" : "等待生成"}</h2>
      <p className="muted" style={{ margin: "4px 0 16px" }}>依次做：配音和时间轴 → AI 写每个分镜的动画 → 类型检查 → 缩略图。通常 3～8 分钟，可以先去做别的。</p>
      {busy && <div className="notice">{job?.state === "queued" ? "排队中，前面还有任务" : job?.progress ?? "开始"}</div>}
      {job?.state === "error" && <div className="notice neg">{job.result?.error ?? "出错了"}</div>}
      <div style={{ display: "flex", marginTop: 16 }}><span className="small muted num">已花 {yuan(ep.cost.tts + ep.cost.image)}</span><span className="sp" />
        {!busy && <button className="btn primary" onClick={() => api(`episodes/${ep.id}/gen`, {})}>{job ? "重试" : "开始生成"}</button>}</div>
    </div>
  );
};

const ReviewStep: React.FC<{ ep: Ep; renderJob?: Job }> = ({ ep, renderJob }) => {
  const mod = EPISODES.find((m) => m.episode.id === ep.id);
  const [sel, setSel] = useState(ep.scenes[0]?.id);
  const [whole, setWhole] = useState(false);
  const [issue, setIssue] = useState("");
  if (!mod) return <div className="empty">这一期的分镜代码还没注册。到「生成」里重试一次。</div>;
  const sc = ep.scenes.find((s) => s.id === sel) ?? ep.scenes[0];
  const ok = ep.scenes.filter((s) => s.status === "approved").length;
  const span = mod.timeline.scenes[sc.id];
  const busy = sc.status === "queued" || sc.status === "working";
  const rendering = running(renderJob);
  const dur = mod.timeline.duration;
  const submit = () => issue.trim() && api(`episodes/${ep.id}/scenes/${sc.id}/edit`, { issue }).then(() => setIssue(""));
  const next = () => { const n = ep.scenes.find((s) => s.status !== "approved" && s.id !== sc.id); if (n) setSel(n.id); };
  const [label, cls] = STATUS[sc.status] ?? [sc.status, ""];

  return (
    <>
      <div className="strip" role="tablist" aria-label="分镜">
        {ep.scenes.map((s) => {
          const sp = mod.timeline.scenes[s.id];
          return <button key={s.id} style={{ flex: sp ? sp.end - sp.start : 1 }} className={`${s.status} ${s.id === sc.id ? "on" : ""}`} onClick={() => setSel(s.id)} title={`${s.id} ${s.name}`}>{s.id}</button>;
        })}
      </div>
      <div className="stripmeta num"><span>已通过 {ok} / {ep.scenes.length} 片</span><span>{dur.toFixed(1)} 秒</span></div>

      <div className="grid" style={{ gridTemplateColumns: "300px 1fr", alignItems: "start" }}>
        <div className="scenes">
          {ep.scenes.map((s) => {
            const sp = mod.timeline.scenes[s.id];
            const [l, c] = STATUS[s.status] ?? [s.status, ""];
            return (
              <div key={s.id} className={`scene ${s.id === sc.id ? "on" : ""}`} onClick={() => setSel(s.id)}>
                <img src={`/thumbs/${ep.id}/${s.id}.jpg?${s.rounds?.length ?? 0}`} alt="" />
                <div className="t">
                  <div><b>{s.name}</b> <span className="muted num small">{sp ? (sp.end - sp.start).toFixed(1) : "?"}s</span></div>
                  <div style={{ display: "flex", gap: 4, margin: "2px 0" }}><span className={`pill ${c}`}>{l}</span>{s.voiceUpdated && <span className="pill warn">配音已更新</span>}{s.updated && s.status === "pending" && <span className="pill acc">已改</span>}</div>
                  <div>{s.lines[0]?.zh.replace(/[【】]/g, "")}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <Preview mod={mod} start={whole ? 0 : Math.max(0, span.start - 0.5)} end={whole ? dur : Math.min(dur, span.end + 0.5)} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 var(--gap)" }}>
            <label className="small"><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> 整期播放</label>
            <span className="sp" />
            <button className="btn" disabled={rendering} onClick={() => api(`episodes/${ep.id}/render`, { draft: true })}>渲染草稿</button>
            <button className="btn primary" disabled={ok < ep.scenes.length || rendering} onClick={() => api(`episodes/${ep.id}/render`, {})}>
              {rendering ? "渲染中…" : "全部通过 · 渲染成片"}</button>
          </div>
          {renderJob?.state === "error" && <div className="notice neg" style={{ marginBottom: 12 }}>渲染失败：{renderJob.result?.error}</div>}

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h2>{sc.id} {sc.name}</h2><span className={`pill ${cls}`}>{label}</span>
              {sc.costWarn && <span className="pill neg">本轮 {yuan(sc.rounds.at(-1)?.cost ?? 0)}</span>}</div>
            <div className="small muted" style={{ margin: "6px 0 10px" }}>画面：{sc.visual}</div>
            {sc.lines.map((l, k) => <div key={k}>{zh(l.zh)}</div>)}
            {sc.status === "error" && <div className="notice neg" style={{ marginTop: 12 }}>{sc.rounds.at(-1)?.summary.replace(/^❌ /, "上一轮没改成：")}</div>}
            {sc.status === "asking" && <div className="notice" style={{ marginTop: 12 }}>{sc.rounds.at(-1)?.summary.replace(/^❓ /, "AI 想确认：")}</div>}
            <textarea rows={3} style={{ marginTop: 12 }} value={issue} onChange={(e) => setIssue(e.target.value)} disabled={busy}
              placeholder={sc.status === "asking" ? "回答 AI 的问题" : "这一片哪里不满意？比如：150万砸下来再慢一点"} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" disabled={busy || !issue.trim()} onClick={submit}>{busy ? STATUS[sc.status][0] + "…" : "交给 AI 修改"}</button>
              <span className="sp" />
              <button className="btn primary" disabled={busy || sc.status === "approved"} onClick={() => api(`episodes/${ep.id}/scenes/${sc.id}/approve`, {}).then(next)}>通过，下一片</button>
            </div>
            {(sc.rounds ?? []).length > 0 && (
              <div className="rounds" style={{ marginTop: 16 }}>
                {[...sc.rounds].reverse().map((r) => (
                  <div key={r.n} style={{ opacity: r.undone ? 0.5 : 1 }}>
                    <span className="muted">第 {r.n} 轮 · {r.issue}</span>{r.cost ? <span className="muted num"> · {yuan(r.cost)}</span> : null}{r.undone && <span className="muted"> · 已撤销</span>}<br />
                    {r.summary || "（无说明）"}
                    {!r.undone && !busy && <> <button className="link small" onClick={() => api(`episodes/${ep.id}/scenes/${sc.id}/undo`, { round: r.n })}>撤销到这一轮之前</button></>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const Preview: React.FC<{ mod: EpisodeModule; start: number; end: number }> = ({ mod, start, end }) => {
  const C = useMemo(() => () => <Episode ep={mod} />, [mod]);
  return (
    <div className="player" data-ui>
      <Player component={C} durationInFrames={f(mod.timeline.duration)} fps={FPS} compositionWidth={1440} compositionHeight={1080}
        style={{ width: "100%" }} controls loop initialFrame={Math.round((f(start) + f(end)) / 2)} inFrame={f(start)} outFrame={Math.max(f(start) + 1, f(end) - 1)} key={`${start}-${end}`} />
    </div>
  );
};
