import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import { clamp, pop } from "../../../shared/ui";

/** 头顶思考气泡 */
export const Bubble: React.FC<{ x: number; y: number; at: number; size?: number; color?: string; children: React.ReactNode }> = ({
  x, y, at, size = 64, color = ORANGE, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at)})` }}>
      <div style={{ background: "#fff", border: `5px solid ${INK}`, borderRadius: 60, padding: "18px 40px", fontFamily: FONT, fontSize: size,
        fontWeight: 900, color, whiteSpace: "nowrap" }}>{children}</div>
      <div style={{ position: "absolute", left: 40, bottom: -44, width: 30, height: 30, borderRadius: "50%", background: "#fff", border: `5px solid ${INK}` }} />
      <div style={{ position: "absolute", left: 20, bottom: -74, width: 18, height: 18, borderRadius: "50%", background: "#fff", border: `4px solid ${INK}` }} />
    </div>
  );
};

/** 流程里的一张卡：位置、缩放、颜色都由调用方逐帧给出 */
export const FlowCard: React.FC<{ x: number; y: number; s?: number; fill?: string; color?: string; size?: number; opacity?: number; children: React.ReactNode }> = ({
  x, y, s = 1, fill = "#fff", color = INK, size = 72, opacity = 1, children,
}) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, opacity,
    background: fill, color, border: `5px solid ${INK}`, borderRadius: 26, boxShadow: `8px 8px 0 ${fill === ORANGE ? INK : fill === "#fff" ? ORANGE : "#bbb"}`,
    width: 190, padding: "16px 0", fontFamily: FONT, fontSize: size, fontWeight: 900, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>
    {children}
  </div>
);

/** 流程箭头 */
export const Arrow: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at)})`, fontFamily: FONT,
      fontSize: 64, fontWeight: 900, color: INK }}>→</div>
  );
};

/** 流程三格的横坐标 */
export const SLOTS = [620, 900, 1180];
export const ROW_Y = 520;

/** 金币沿弧线从 a 飞到 b，到达后消失 */
export const FlyCoin: React.FC<{ from: [number, number]; to: [number, number]; at: number; d?: number; h?: number; arc?: number }> = ({
  from, to, at, d = 18, h = 70, arc = 160,
}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + d) return null;
  const p = interpolate(frame, [at, at + d], [0, 1], clamp);
  const x = from[0] + (to[0] - from[0]) * p;
  const y = from[1] + (to[1] - from[1]) * p - arc * Math.sin(p * Math.PI);
  return <Img src={staticFile("assets/prop_coin.png")} style={{ position: "absolute", left: x - h / 2, top: y - h / 2, height: h,
    transform: `rotate(${p * 360}deg)`, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.15))" }} />;
};

/** 盖章式红叉 */
export const RedX: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 160 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, 14);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", left: x - size / 2, top: y - size / 2,
      transform: `scale(${interpolate(p, [0, 1], [2.2, 1])})`, opacity: Math.min(1, p * 2) }}>
      <path d="M16 16 L84 84 M84 16 L16 84" stroke="#e2352b" strokeWidth="13" strokeLinecap="round" />
    </svg>
  );
};

/** 手绘玻璃罐：标签写在罐下，罐身中间可放比例数字 */
export const Jar: React.FC<{ x: number; y: number; at: number; label: string; w?: number; level?: number; opacity?: number; children?: React.ReactNode }> = ({
  x, y, at, label, w = 220, level = 0.4, opacity = 1, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const h = w * 1.15;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at)})`, opacity }}>
      <div style={{ width: w * 0.6, height: 26, margin: "0 auto", background: "#bbb", border: `5px solid ${INK}`, borderRadius: 8 }} />
      <div style={{ position: "relative", width: w, height: h, marginTop: -4, background: "rgba(220,235,245,.7)", border: `5px solid ${INK}`,
        borderRadius: "30px 30px 40px 40px", overflow: "hidden", boxShadow: `6px 6px 0 ${ORANGE}` }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${level * 100}%`, background: "#ffd27a" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT,
          fontWeight: 900, fontSize: w * 0.3, color: INK }}>{children}</div>
      </div>
      <div style={{ marginTop: 12, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: w * 0.17, color: INK,
        whiteSpace: "nowrap", WebkitTextStroke: "8px #fff", paintOrder: "stroke fill" }}>{label}</div>
    </div>
  );
};

/** 挂锁：从上方落下 */
export const Lock: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 130 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, 10);
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" style={{ position: "absolute", left: x - size / 2, top: y - size * 0.6 - (1 - p) * 160,
      opacity: Math.min(1, p * 2), filter: "drop-shadow(0 6px 6px rgba(0,0,0,.18))" }}>
      <path d="M28 54 V36 a22 22 0 0 1 44 0 V54" fill="none" stroke={INK} strokeWidth="11" />
      <rect x="10" y="50" width="80" height="62" rx="12" fill={ORANGE} stroke={INK} strokeWidth="6" />
      <circle cx="50" cy="76" r="8" fill={INK} />
      <rect x="46" y="78" width="8" height="18" rx="3" fill={INK} />
    </svg>
  );
};

/** 购物车图标 */
export const Cart: React.FC<{ size?: number }> = ({ size = 150 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M6 18 H22 L32 66 H82 L92 30 H26" fill="#fff" stroke={INK} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx="38" cy="82" r="8" fill={ORANGE} stroke={INK} strokeWidth="5" />
    <circle cx="74" cy="82" r="8" fill={ORANGE} stroke={INK} strokeWidth="5" />
  </svg>
);

/** 手机外壳，内容居中 */
export const Phone: React.FC<{ x: number; y: number; at: number; w?: number; h?: number; tilt?: number; children?: React.ReactNode }> = ({
  x, y, at, w = 260, h = 420, tilt = 0, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `translate(-50%,-50%) scale(${pop(frame, at)}) rotate(${tilt}deg)`,
      background: INK, borderRadius: 40, padding: 16, boxSizing: "border-box" }}>
      <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 28, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", fontFamily: FONT, fontWeight: 900, color: INK }}>{children}</div>
    </div>
  );
};
