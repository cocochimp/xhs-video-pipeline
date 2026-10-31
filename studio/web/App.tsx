import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppCtx, api, usePoll, type Overview } from "./lib";
import { AudioPage, ComponentsPage, LibraryPage, NewPage, TodoPage, TopicsPage } from "./pages";
import { WorkPage } from "./Work";

const NAV = [
  ["审片台", [["new", "新建作品"], ["todo", "进行中"], ["done", "作品库"]]],
  ["素材库", [["audio", "音效库"], ["comp", "组件库"], ["topics", "选题库"]]],
] as const;
const NAMES: Record<string, string> = { new: "新建作品", todo: "进行中", done: "作品库", audio: "音效库", comp: "组件库", topics: "选题库", work: "作品" };

const useHash = () => {
  const [h, setH] = useState(location.hash.slice(1) || "todo");
  useEffect(() => { const f = () => setH(location.hash.slice(1) || "todo"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h.split("/");
};

export const App: React.FC = () => {
  const [page, arg, sub] = useHash();
  const [ov] = usePoll<Overview>("overview", 3000);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [toastMsg, setToast] = useState("");
  const toast = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); }, []);
  const ask = useCallback((t: string) => { setDraft(t); setChatOpen(true); }, []);

  const eps = ov?.episodes ?? [];
  const todo = eps.filter((e) => e.stage !== "done");
  const done = eps.filter((e) => e.stage === "done");
  const ep = page === "work" ? eps.find((e) => e.id === arg) : undefined;
  const where = ep ? `第 ${ep.no} 期 · ${ep.title}` : NAMES[page] ?? "";
  const imgCost = eps.reduce((s, e) => s + e.cost, 0);
  const u = ov?.usage;

  const content = {
    todo: <TodoPage eps={todo} />, new: <NewPage />, done: <LibraryPage eps={done} />,
    audio: <AudioPage tab={arg} />, comp: <ComponentsPage />, topics: <TopicsPage />,
    work: <WorkPage id={arg} tab={sub} />,
  }[page] ?? <TodoPage eps={todo} />;

  return (
    <AppCtx.Provider value={{ ask, toast, page: where }}>
      <div className="app">
        <aside className="side">
          <div className="brand"><img src="/assets/avatar.jpg" alt="" /><div><b>阿牛要退休</b><span className="small muted">阿牛工作台</span></div></div>
          <div className="fire small muted">
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>FIRE 计划</span><span className="num">{done.length} / 100 期</span></div>
            <div className="bar"><i style={{ width: `${done.length}%` }} /></div>
          </div>
          {NAV.map(([g, items]) => (
            <React.Fragment key={g}>
              <div className="group">{g}</div>
              {items.map(([k, n]) => (
                <a key={k} href={`#${k}`} className={`nav ${(page === k || (page === "work" && k === (ep?.stage === "done" ? "done" : "todo"))) ? "on" : ""}`}>
                  {n}{k === "todo" && todo.length > 0 && <span className="count num">{todo.length}</span>}
                </a>
              ))}
            </React.Fragment>
          ))}
          <div className="spend">
            <div><span>画面 + 配音（累计）</span><b className="num">¥{imgCost.toFixed(2)}</b></div>
            <div><span>AI（本月，官方价折算）</span><b className="num">{u ? `$${u.aiMonthUsd.toFixed(2)}` : "—"}</b></div>
            <div><span>packyapi 余额</span><b className="num">{u?.packyUsd != null ? `$${u.packyUsd.toFixed(2)}` : "未配置"}</b></div>
          </div>
        </aside>
        <header className="topbar">
          <span className="crumb">{page === "work" && ep ? <><a href={ep.stage === "done" ? "#done" : "#todo"}>{ep.stage === "done" ? "作品库" : "进行中"}</a> / <b>第 {ep.no} 期</b></> : <b>{NAMES[page] ?? "进行中"}</b>}</span>
          <span className="sp" />
          <button className={`btn ${chatOpen ? "" : "primary"}`} onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? "收起 AI 助手" : "问 AI"}</button>
        </header>
        <div className="body">
          <main className="sheet">{content}</main>
          {chatOpen && <Chat where={where} draft={draft} setDraft={setDraft} onClose={() => setChatOpen(false)} />}
        </div>
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
};

type Msg = { role: "me" | "ai"; text: string; plan?: string | null; page?: string };

const Chat: React.FC<{ where: string; draft: string; setDraft: (s: string) => void; onClose: () => void }> = ({ where, draft, setDraft, onClose }) => {
  const [data, reload] = usePoll<{ busy: boolean; messages: Msg[] }>("chat", 1500);
  const [jobs] = usePoll<{ kind: string; state: string }[]>("jobs", 2000);
  const box = useRef<HTMLDivElement>(null);
  const msgs = data?.messages ?? [];
  const applying = jobs?.some((j) => j.kind === "apply" && (j.state === "queued" || j.state === "running"));
  useEffect(() => { box.current?.scrollTo(0, 1e9); }, [msgs.length, data?.busy]);
  const send = () => { if (!draft.trim() || data?.busy) return; api("chat", { msg: draft, page: where }).then(() => { setDraft(""); reload(); }); };
  const lastPlan = [...msgs].reverse().find((m) => m.role === "ai");

  return (
    <aside className="chat" aria-label="AI 助手">
      <header><h2>AI 助手</h2><span className="sp" /><button className="btn ghost" onClick={() => api("chat/new", {}).then(reload)}>新对话</button><button className="btn ghost" onClick={onClose} aria-label="收起">收起</button></header>
      <div className="ctx">正在看：{where || "工作台"}</div>
      <div className="msgs" ref={box}>
        {msgs.length === 0 && <div className="muted small">可以让 AI 换音效、重画阿牛的姿势、加选题、调整配音。要改文件时，它会先说明改什么、花多少钱，你确认后才执行。</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
            {m.plan && m === lastPlan && (
              <div className="plan"><div className="small muted">要执行的改动</div>{m.plan}
                <div className="acts"><button className="btn primary" disabled={applying} onClick={() => api("chat/apply", {})}>{applying ? "执行中…" : "确认执行"}</button>
                  <button className="btn" onClick={() => setDraft("先不改，")}>先不改</button></div></div>
            )}
          </div>
        ))}
        {data?.busy && <div className="msg ai muted">思考中…</div>}
      </div>
      <div className="composer">
        <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="比如：把片尾的音效换成更轻的叮一声"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
        <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}><span className="small muted">⌘ + 回车发送</span><span className="sp" /><button className="btn primary" disabled={!draft.trim() || data?.busy} onClick={send}>发送</button></div>
      </div>
    </aside>
  );
};
