import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { FONT, FPS, INK, ORANGE } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const pop = (frame: number, at: number, damping = 11) =>
  spring({ frame: frame - at, fps: FPS, config: { damping, stiffness: 170, mass: 0.7 } });

/** 阿牛姿势：底部中点对齐 (x, bottom)，弹出 + 呼吸感；sign 写在举牌姿势的空白牌子上 */
export const Pose: React.FC<{ name: string; x: number; bottom?: number; h: number; at: number; sign?: React.ReactNode }> = ({
  name, x, bottom = 890, h, at, sign,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const s = (0.85 + 0.15 * pop(frame, at, 9)) * (1 + 0.012 * Math.sin(frame / 7));
  return (
    <div style={{ position: "absolute", left: x, top: bottom, transform: `translate(-50%,-100%) scale(${s})`, transformOrigin: "50% 100%" }}>
      <div style={{ position: "relative", height: h }}>
        <Img src={staticFile(`assets/pose_${name}.png`)} style={{ height: h, display: "block", filter: "drop-shadow(0 8px 10px rgba(0,0,0,.15))" }} />
        {sign && (
          <div style={{ position: "absolute", left: "4.8%", top: "2.4%", width: "87.8%", height: "25.1%", display: "flex",
            alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900, fontSize: h * 0.085, color: INK }}>
            {sign}
          </div>
        )}
      </div>
    </div>
  );
};

/** 道具贴纸，中心对齐 */
export const Sticker: React.FC<{ src: string; x: number; y: number; h: number; at: number; rot?: number; style?: React.CSSProperties }> = ({
  src, x, y, h, at, rot = 0, style,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <Img src={staticFile(`assets/prop_${src}.png`)} style={{ position: "absolute", left: x, top: y, height: h,
      transform: `translate(-50%,-50%) scale(${pop(frame, at)}) rotate(${rot}deg)`, filter: "drop-shadow(0 6px 8px rgba(0,0,0,.15))", ...style }} />
  );
};

/** 白底黑框卡片，右下橙色硬阴影 */
export const Card: React.FC<{ x: number; y: number; at: number; size?: number; fill?: string; color?: string; tilt?: number; children: React.ReactNode }> = ({
  x, y, at, size = 64, fill = "#fff", color = INK, tilt = 0, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at)}) rotate(${tilt}deg)`,
      background: fill, color, border: `5px solid ${INK}`, borderRadius: 26, boxShadow: `8px 8px 0 ${fill === ORANGE ? INK : ORANGE}`,
      padding: "16px 36px", fontFamily: FONT, fontSize: size, fontWeight: 900, whiteSpace: "nowrap", textAlign: "center", lineHeight: 1.25 }}>
      {children}
    </div>
  );
};

/** 无框大字，白色描边 */
export const BigText: React.FC<{ x: number; y: number; at: number; size: number; color?: string; slam?: boolean; children: React.ReactNode }> = ({
  x, y, at, size, color = INK, slam, children,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, slam ? 13 : 11);
  const s = slam ? interpolate(p, [0, 1], [2.6, 1]) : p;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, opacity: slam ? Math.min(1, p * 2) : 1,
      fontFamily: FONT, fontSize: size, fontWeight: 900, color, whiteSpace: "nowrap", WebkitTextStroke: `${Math.max(8, size * 0.07)}px #fff`,
      paintOrder: "stroke fill", textShadow: `0 ${size * 0.04}px 0 rgba(0,0,0,.12)` }}>
      {children}
    </div>
  );
};

export const Check: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 120 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + 8], [0, 1], clamp);
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 120 110" style={{ position: "absolute", left: x - size / 2, top: y - size * 0.45 }}>
      <path d="M12 58 L44 90 L108 14" fill="none" stroke="#22b14c" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="160" strokeDashoffset={160 * (1 - p)} />
    </svg>
  );
};

/** 从左到右画出的划线（划掉旧数字） */
export const Strike: React.FC<{ x: number; y: number; w: number; at: number }> = ({ x, y, w, at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + 7], [0, 1], clamp);
  return <div style={{ position: "absolute", left: x - w / 2, top: y - 7, width: w * p, height: 14, background: "#e2352b", borderRadius: 7, transform: "rotate(-6deg)", transformOrigin: "0 50%" }} />;
};
