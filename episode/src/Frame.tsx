import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT, FPS, INK, ORANGE, PAPER, T } from "./tl";

/** 米白底 + 浅灰点阵 + 四角橙色小涂鸦 */
export const Paper: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    <AbsoluteFill style={{ backgroundImage: "radial-gradient(#d9d2c4 2.2px, transparent 2.4px)", backgroundSize: "40px 40px", opacity: 0.7 }} />
    {[[40, 110, 0], [1380, 130, 40], [60, 1000, -30], [1370, 990, 15]].map(([x, y, r], i) => (
      <div key={i} style={{ position: "absolute", left: x, top: y, width: 34, height: 10, borderRadius: 5, background: ORANGE,
        transform: `rotate(${r}deg)`, opacity: 0.8 }} />
    ))}
  </AbsoluteFill>
);

/** 顶部常驻进度条：阿牛FIRE计划 ▓░░ 第x/100期 */
export const TopBar: React.FC = () => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [6, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const trackW = 700;
  const fillW = Math.max(18, (trackW * T.no) / T.total) * grow;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 74, background: "#fff", borderBottom: `4px solid ${INK}`,
      display: "flex", alignItems: "center", gap: 26, padding: "0 34px", fontFamily: FONT }}>
      <div style={{ fontSize: 34, fontWeight: 900, color: INK }}>
        阿牛<span style={{ color: ORANGE }}>FIRE</span>计划
      </div>
      <div style={{ position: "relative", width: trackW, height: 24, border: `3px solid ${INK}`, borderRadius: 14, background: "#f1ece2", overflow: "hidden" }}>
        <div style={{ width: fillW, height: "100%", background: ORANGE, borderRadius: 12 }} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: INK }}>
        第 <span style={{ color: ORANGE }}>{T.no}</span>/{T.total} 期
      </div>
      <div style={{ marginLeft: "auto", fontSize: 24, fontWeight: 700, color: "#8a8378" }}>目标：早日退休</div>
    </div>
  );
};

/** 底部字幕：【】内的字标橙色；本期标题段不显示（画面上已有标题卡） */
export const Subtitles: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const i = T.subs.findIndex((s, k) => t >= s.start && t < (T.subs[k + 1]?.start ?? T.duration));
  const sub = T.subs[i];
  if (!sub || sub.seg === "title") return null;
  const parts = sub.zh.split(/(【[^】]+】)/).filter(Boolean);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, textAlign: "center", fontFamily: FONT, fontSize: 50,
      fontWeight: 900, color: INK, WebkitTextStroke: "11px #fff", paintOrder: "stroke fill", letterSpacing: 2 }}>
      {parts.map((p, k) => (p.startsWith("【") ? <span key={k} style={{ color: ORANGE }}>{p.slice(1, -1)}</span> : <span key={k}>{p}</span>))}
    </div>
  );
};
