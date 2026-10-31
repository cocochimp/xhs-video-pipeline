import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT, FPS, Sub, T } from "./timeline";

/** 把字幕拆成普通段和高亮段，返回每个字是否高亮 */
const highlightMask = (zh: string, hl: string[]) => {
  const mask = Array(zh.length).fill(false);
  for (const w of hl) {
    const i = zh.indexOf(w);
    if (i >= 0) for (let k = i; k < i + w.length; k++) mask[k] = true;
  }
  return mask;
};

/** 片头/标题段：逐字打出的卡拉 OK 字幕，关键词橙色，末尾白色光标 */
const Karaoke: React.FC<{ sub: Sub; t: number }> = ({ sub, t }) => {
  const mask = highlightMask(sub.zh, sub.hl);
  const shown = sub.chars.filter((c) => c <= t).length;
  const typing = shown < sub.zh.length;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center", fontFamily: FONT,
      fontSize: 64, fontWeight: 800, letterSpacing: 4, color: "#fff",
      WebkitTextStroke: "10px #1d2233", paintOrder: "stroke fill", textShadow: "0 6px 14px rgba(0,0,0,.45)" }}>
      {[...sub.zh].slice(0, shown).map((ch, i) => (
        <span key={i} style={{ color: mask[i] ? "#ff8a2a" : "#fff" }}>{ch}</span>
      ))}
      {typing && <span style={{ display: "inline-block", width: 14, height: 58, marginLeft: 6, background: "#fff",
        verticalAlign: "-8px", boxShadow: "0 0 4px #222" }} />}
    </div>
  );
};

/** 正片段：底部中英双语字幕 */
const Bilingual: React.FC<{ sub: Sub }> = ({ sub }) => {
  const mask = highlightMask(sub.zh, sub.hl);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, textAlign: "center", fontFamily: FONT }}>
      <div style={{ fontSize: 44, fontWeight: 800, color: "#fff", letterSpacing: 2,
        WebkitTextStroke: "8px #13244a", paintOrder: "stroke fill" }}>
        {[...sub.zh].map((ch, i) => <span key={i} style={{ color: mask[i] ? "#ffd23f" : "#fff" }}>{ch}</span>)}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, fontStyle: "italic", color: "#fff", marginTop: 4,
        WebkitTextStroke: "5px #13244a", paintOrder: "stroke fill" }}>{sub.en}</div>
    </div>
  );
};

export const Subtitles: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const sub = T.subs.find((s) => t >= s.chars[0] && t < s.end);
  if (!sub) return null;
  return sub.seg === "main" ? <Bilingual sub={sub} /> : <Karaoke sub={sub} t={t} />;
};
