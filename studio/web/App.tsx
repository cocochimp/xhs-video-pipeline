import { Player, type PlayerRef } from "@remotion/player";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { EPISODES } from "../../episodes";
import { Episode } from "../../shared/Episode";
import { FPS, f } from "../../shared/theme";
import type { EpisodeJson, EpisodeModule } from "../../shared/types";

type Round = { n: number; issue: string; summary: string; cost: number; at: string; undone?: boolean };
type Scene = Omit<EpisodeJson["scenes"][number], "rounds"> & { updated?: boolean; voiceUpdated?: boolean; costWarn?: boolean; rounds: Round[] };

const STATUS: Record<string, string> = { pending: "⏳ 待审", queued: "🕒 排队中", working: "🔄 AI 修改中", approved: "✅ 已通过", asking: "💬 待你回复", error: "⚠️ 出错" };
const api = (p: string, body?: object) => fetch(`/api/${p}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
const box: React.CSSProperties = { background: "#fff", borderRadius: 10, border: "1px solid #e4ddcf" };
const btn = (bg: string): React.CSSProperties => ({ background: bg, color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer" });

export const App: React.FC = () => {
  const [id, setId] = useState(location.hash.slice(1));
  useEffect(() => { const h = () => setId(location.hash.slice(1)); addEventListener("hashchange", h); return () => removeEventListener("hashchange", h); }, []);
  return id ? <EpisodePage id={id} /> : <Home />;
};

const Home: React.FC = () => {
  const [eps, setEps] = useState<EpisodeJson[]>([]);
  useEffect(() => { api("episodes").then(setEps); }, []);
  return (
    <div style={{ maxWidth: 800, margin: "40px auto" }}>
      <h2>阿牛审片台</h2>
      {eps.map((e) => {
        const ok = e.scenes.filter((s) => s.status === "approved").length;
        return (
          <a key={e.id} href={`#${e.id}`} style={{ ...box, display: "block", padding: 16, marginBottom: 10, color: "#222", textDecoration: "none" }}>
            <b>第 {e.no} 期</b>　{e.title}　<span style={{ color: "#888" }}>已通过 {ok}/{e.scenes.length} · ¥{(e.cost.tts + e.cost.image).toFixed(2)}</span>
          </a>
        );
      })}
    </div>
  );
};

const EpisodePage: React.FC<{ id: string }> = ({ id }) => {
  const mod = EPISODES.find((m) => m.episode.id === id);
  const [ep, setEp] = useState<EpisodeJson | null>(null);
  const [sel, setSel] = useState<string>("");
  const [whole, setWhole] = useState(false);
  const [issue, setIssue] = useState("");
  const player = useRef<PlayerRef>(null);

  useEffect(() => {
    const load = () => api(`episodes/${id}`).then((e: EpisodeJson) => { setEp(e); setSel((s) => s || e.scenes[0].id); });
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [id]);

  if (!mod || !ep) return <div style={{ padding: 40 }}>加载中…（找不到这一期的话，检查 episodes/index.ts）</div>;
  const scenes = ep.scenes as unknown as Scene[];
  const sc = scenes.find((s) => s.id === sel) ?? scenes[0];
  const ok = scenes.filter((s) => s.status === "approved").length;
  const span = mod.timeline.scenes[sc.id];
  const busy = sc.status === "queued" || sc.status === "working";
  const submit = () => issue.trim() && api(`episodes/${id}/scenes/${sc.id}/edit`, { issue }).then(() => setIssue(""));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ ...box, borderRadius: 0, display: "flex", alignItems: "center", gap: 16, padding: "10px 20px" }}>
        <a href="#">← 全部期数</a>
        <b>第 {ep.no} 期 · {ep.title}</b>
        <span style={{ color: "#888" }}>已通过 {ok}/{scenes.length} · 花费 ¥{(ep.cost.tts + ep.cost.image).toFixed(2)}</span>
        <span style={{ flex: 1 }} />
        <button style={btn(ok === scenes.length ? "#e2702b" : "#bbb")} disabled={ok !== scenes.length} onClick={() => api(`episodes/${id}/render`, {})}>渲染整期</button>
        <button style={btn("#888")} onClick={() => api(`episodes/${id}/render`, { draft: true })}>强制渲染草稿</button>
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 380, overflow: "auto", padding: 12 }}>
          {scenes.map((s) => {
            const sp = mod.timeline.scenes[s.id];
            return (
              <div key={s.id} onClick={() => setSel(s.id)} style={{ ...box, display: "flex", gap: 10, padding: 8, marginBottom: 8, cursor: "pointer",
                outline: s.id === sc.id ? "2px solid #e2702b" : "none", opacity: s.status === "approved" ? 0.55 : 1 }}>
                <img src={`/thumbs/${id}/${s.id}.jpg?${s.rounds?.length ?? 0}`} style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 6, background: "#eee" }} />
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <b>{s.id} {s.name}</b> · {sp ? (sp.end - sp.start).toFixed(1) : "?"}s<br />
                  {STATUS[s.status] ?? s.status}
                  {s.updated && " · 已更新"}{s.voiceUpdated && " · 配音已更新"}{s.costWarn && <span style={{ color: "#d33" }}> · 本轮 ¥{s.rounds.at(-1)?.cost}</span>}
                  <div style={{ color: "#888" }}>{s.lines[0]?.zh.replace(/[【】]/g, "")}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
          <Preview mod={mod} start={whole ? 0 : Math.max(0, span.start - 0.5)} end={whole ? mod.timeline.duration : Math.min(mod.timeline.duration, span.end + 0.5)} player={player} />
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> 整期播放</label>
          <div style={{ ...box, padding: 14, marginTop: 12 }}>
            <b>{sc.id} {sc.name}</b> · {STATUS[sc.status]}
            <div style={{ fontSize: 13, color: "#666", margin: "6px 0" }}>{sc.visual}</div>
            <div style={{ fontSize: 13 }}>{sc.lines.map((l, i) => <div key={i}>· {l.zh}</div>)}</div>
            <textarea value={issue} onChange={(e) => setIssue(e.target.value)} disabled={busy} placeholder="这一片哪里不满意？比如：150万砸下来再慢一点"
              style={{ width: "100%", height: 64, marginTop: 10, padding: 8, fontSize: 14, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={btn(busy ? "#bbb" : "#e2702b")} disabled={busy} onClick={submit}>交给 AI 修改</button>
              <button style={btn("#22a04b")} disabled={busy} onClick={() => api(`episodes/${id}/scenes/${sc.id}/approve`, {})}>通过</button>
            </div>
            <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.8 }}>
              <b>修改记录</b>
              {(sc.rounds ?? []).length === 0 && <div style={{ color: "#999" }}>还没有修改</div>}
              {[...(sc.rounds ?? [])].reverse().map((r) => (
                <div key={r.n} style={{ opacity: r.undone ? 0.45 : 1, color: r.cost > 1 ? "#d33" : undefined }}>
                  第 {r.n} 轮：你「{r.issue}」→ {r.summary || "（无说明）"}{r.cost ? ` · ¥${r.cost}` : ""}{r.undone ? " · 已撤销" : ""}
                  {!r.undone && !busy && <a href="#" onClick={(e) => { e.preventDefault(); api(`episodes/${id}/scenes/${sc.id}/undo`, { round: r.n }); }} style={{ marginLeft: 8 }}>撤销到此前</a>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Preview: React.FC<{ mod: EpisodeModule; start: number; end: number; player: React.RefObject<PlayerRef | null> }> = ({ mod, start, end, player }) => {
  const C = useMemo(() => () => <Episode ep={mod} />, [mod]);
  return (
    <div style={{ ...box, overflow: "hidden", maxWidth: 800 }}>
      <Player ref={player} component={C} durationInFrames={f(mod.timeline.duration)} fps={FPS} compositionWidth={1440} compositionHeight={1080}
        style={{ width: "100%" }} controls loop inFrame={f(start)} outFrame={Math.max(f(start) + 1, f(end) - 1)} key={`${start}-${end}`} />
    </div>
  );
};
