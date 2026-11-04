import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import { clamp, pop } from "../../../shared/ui";

/** 本期 5 件事的路牌文字 */
export const ROADS = ["①卖技能", "②做内容", "③倒二手", "④配资产", "⑤用人脉"];

/** 路牌（只有牌子）；label 为空时是空白牌，lit 帧之后变橙色亮起 */
export const Signpost: React.FC<{ x: number; y: number; at: number; w?: number; label?: string; lit?: number; size?: number; dim?: boolean }> = ({
  x, y, at, w = 220, label, lit, size = 40, dim,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const on = lit !== undefined && frame >= lit;
  const s = pop(frame, at) * (on ? 1 + 0.1 * Math.sin(Math.min(1, pop(frame, lit!, 8)) * Math.PI) : 1);
  const h = size * 1.9;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, opacity: dim ? 0.45 : 1 }}>
      <div style={{ position: "relative", width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, background: on ? ORANGE : "#fff",
        border: `5px solid ${INK}`, borderRadius: 14, boxShadow: `6px 6px 0 ${on ? INK : ORANGE}`, display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: FONT, fontWeight: 900, fontSize: size, color: on ? "#fff" : INK, whiteSpace: "nowrap" }}>
        {label}
      </div>
    </div>
  );
};

/** 顶部五块小路牌：前面的已讲过（灰），第 n 块在 lit 帧亮起 */
export const RoadStrip: React.FC<{ n: number; lit: number }> = ({ n, lit }) => (
  <>
    {ROADS.map((r, k) => (
      <Signpost key={k} x={250 + k * 235} y={140} at={0} w={200} size={34} label={k <= n ? r : undefined}
        lit={k === n ? lit : undefined} dim={k < n} />
    ))}
  </>
);

/** 第 n 件事的大路牌（第一句） */
export const BigSign: React.FC<{ n: number; at: number }> = ({ n, at }) => (
  <Signpost x={960} y={470} at={at} w={460} size={84} label={ROADS[n]} lit={at + 4} />
);

/** 手机通知条：从上方滑入 */
export const Toast: React.FC<{ x: number; y: number; at: number; w?: number; size?: number; children: React.ReactNode }> = ({
  x, y, at, w = 460, size = 40, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, 12);
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - 50, width: w, transform: `translateY(${(1 - p) * -60}px)`, opacity: Math.min(1, p * 1.5),
      background: "#fff", border: `5px solid ${INK}`, borderRadius: 22, boxShadow: `6px 6px 0 ${ORANGE}`, padding: "14px 22px",
      display: "flex", alignItems: "center", gap: 16, fontFamily: FONT, fontWeight: 900, fontSize: size, color: INK, whiteSpace: "nowrap" }}>
      <div style={{ width: size * 1.2, height: size * 1.2, borderRadius: 10, background: ORANGE, flexShrink: 0 }} />
      <div>{children}</div>
    </div>
  );
};

/** 金币沿弧线从 a 飞到 b，到达后停住 */
export const FlyCoin: React.FC<{ from: [number, number]; to: [number, number]; at: number; d?: number; h?: number; arc?: number }> = ({
  from, to, at, d = 18, h = 80, arc = 160,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + d], [0, 1], clamp);
  const x = from[0] + (to[0] - from[0]) * p;
  const y = from[1] + (to[1] - from[1]) * p - arc * Math.sin(p * Math.PI);
  return <Img src={staticFile("assets/prop_coin.png")} style={{ position: "absolute", left: x - h / 2, top: y - h / 2, height: h,
    transform: `rotate(${p * 360}deg)`, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.15))" }} />;
};

/** 盖章式大红叉 */
export const RedX: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 300 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, 14);
  const s = interpolate(p, [0, 1], [2.2, 1]);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", left: x - size / 2, top: y - size / 2,
      transform: `scale(${s})`, opacity: Math.min(1, p * 2) }}>
      <path d="M14 14 L86 86 M86 14 L14 86" stroke="#e2352b" strokeWidth="13" strokeLinecap="round" />
    </svg>
  );
};

/** 从 a 到 b 逐渐画出的线 */
export const Wire: React.FC<{ a: [number, number]; b: [number, number]; at: number; d?: number; color?: string; width?: number; dash?: boolean }> = ({
  a, b, at, d = 12, color = INK, width = 7, dash,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + d], [0, 1], clamp);
  return (
    <svg width={1440} height={1080} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <line x1={a[0]} y1={a[1]} x2={a[0] + (b[0] - a[0]) * p} y2={a[1] + (b[1] - a[1]) * p} stroke={color} strokeWidth={width}
        strokeLinecap="round" strokeDasharray={dash ? "4 18" : undefined} />
    </svg>
  );
};

/** 玻璃罐：level 0~1 为装满程度，标签写在罐身 */
export const Jar: React.FC<{ x: number; y: number; at: number; label: string; level?: number; w?: number; hot?: boolean; children?: React.ReactNode }> = ({
  x, y, at, label, level = 0, w = 220, hot, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const h = w * 1.15;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at)})` }}>
      <div style={{ width: w * 0.6, height: 26, margin: "0 auto", background: "#bbb", border: `5px solid ${INK}`, borderRadius: 8 }} />
      <div style={{ position: "relative", width: w, height: h, marginTop: -4, background: "rgba(220,235,245,.7)", border: `5px solid ${INK}`,
        borderRadius: "30px 30px 40px 40px", overflow: "hidden", boxShadow: `6px 6px 0 ${hot ? ORANGE : "#ccc"}` }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${level * 100}%`, background: "#ffd27a" }} />
        {children}
      </div>
      <div style={{ marginTop: 14, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: w * 0.19, color: hot ? ORANGE : INK,
        whiteSpace: "nowrap", WebkitTextStroke: "8px #fff", paintOrder: "stroke fill" }}>{label}</div>
    </div>
  );
};

/** 本句内第 k/n 个位置的帧（按台词时长均分，用来对上念到的词） */
export const split = (s: number, e: number, k: number, n: number) => Math.round(s + ((e - s) * k) / n);
