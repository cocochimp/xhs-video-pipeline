import React, { createContext, useContext, useEffect, useState } from "react";

export const api = <T = any,>(p: string, body?: object): Promise<T> =>
  fetch(`/api/${p}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.statusText); return j; });

/** 每 ms 毫秒拉一次 */
export function usePoll<T>(p: string | null, ms = 2000): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!p) return;
    let alive = true;
    const load = () => api<T>(p).then((d) => alive && setData(d)).catch(() => {});
    load();
    const t = setInterval(load, ms);
    return () => { alive = false; clearInterval(t); };
  }, [p, ms, tick]);
  return [data, () => setTick((n) => n + 1)];
}

export type Overview = {
  episodes: { id: string; no: number; title: string; stage: string; cost: number; updated: number; scenes: number; video: boolean; hd: boolean; duration: number | null; doneAt?: string; cover: string | null; firstLine: string }[];
  usage: { aiMonthUsd: number; aiTotalUsd: number; packyUsd: number | null } | null;
};
export type Job = { id: number; ep?: string; kind: string; scene?: string; state: string; progress?: string; result?: { ok?: boolean; error?: string; summary?: string } };

export const STAGES = [["topic", "选题"], ["text", "文本"], ["gen", "生成"], ["review", "审片"]] as const;
export const stageIndex = (s: string) => Math.max(0, STAGES.findIndex(([k]) => k === s));

export const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  if (m < 1440) return `${Math.round(m / 60)} 小时前`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
export const yuan = (n: number) => `¥${n.toFixed(2)}`;

type Ctx = { ask: (text: string) => void; toast: (t: string) => void; page: string };
export const AppCtx = createContext<Ctx>({ ask: () => {}, toast: () => {}, page: "" });
export const useApp = () => useContext(AppCtx);

export const Steps4: React.FC<{ stage: string }> = ({ stage }) => {
  const i = stageIndex(stage);
  return <span className="steps4" aria-label={`第 ${i + 1} 步，共 4 步`}>{STAGES.map((_, k) => <i key={k} className={k < i ? "d" : k === i ? "c" : ""} />)}</span>;
};
