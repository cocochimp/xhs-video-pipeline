import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, clamp, pop } from "../../../shared/ui";

const STEPS = 5;
const SX = 420, SY = 960, W = 170, H = 110; // 第 k 格台阶左上角 = (SX + k*W, SY - (k+1)*H)

const Cloud: React.FC<{ x: number; y: number; at: number; text: string }> = ({ x, y, at, text }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const drift = (frame - at) * 1.2;
  return (
    <div style={{ position: "absolute", left: x - drift, top: y + 6 * Math.sin(frame / 9), transform: `translate(-50%,-50%) scale(${pop(frame, at)})`,
      background: "#8f97a6", color: "#fff", border: `5px solid ${INK}`, borderRadius: 80, padding: "20px 46px", fontFamily: FONT, fontSize: 52,
      fontWeight: 900, whiteSpace: "nowrap", boxShadow: "-30px 18px 0 -10px #8f97a6, 34px 16px 0 -12px #8f97a6" }}>{text}</div>
  );
};

/** 远处「目标」小山，阿牛一格格往上爬，每格亮「+1年」；「被裁」「跳槽空档」乌云飘过，阿牛竖大拇指 */
const S09: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const span = at(2) - at(1);
  const stepAt = (k: number) => at(1) + Math.round((span * (k + 0.5)) / STEPS);
  const reached = [...Array(STEPS)].filter((_, k) => frame >= stepAt(k)).length;
  // 当前位置在相邻两格之间平滑过渡
  const pos = reached === 0 ? -1 : reached - 1 + 0;
  const prev = reached - 2;
  const t = reached === 0 ? 1 : interpolate(frame, [stepAt(reached - 1), stepAt(reached - 1) + 8], [0, 1], clamp);
  const ax = (k: number) => (k < 0 ? SX - 140 : SX + k * W + W / 2);
  const ay = (k: number) => (k < 0 ? SY : SY - (k + 1) * H);
  const px = interpolate(t, [0, 1], [ax(prev), ax(pos)]);
  const py = interpolate(t, [0, 1], [ay(prev), ay(pos)]) - 10 * Math.sin(t * Math.PI);
  const thumbs = frame >= at(2) + 8;
  return (
    <AbsoluteFill>
      {/* 远处小山 + 旗子 */}
      <svg width={520} height={360} viewBox="0 0 520 360" style={{ position: "absolute", left: 900, top: 40 }}>
        <path d="M20 340 L260 60 L500 340 Z" fill="#cfe3c4" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
        <line x1="260" y1="60" x2="260" y2="0" stroke={INK} strokeWidth="6" />
        <path d="M260 4 L320 22 L260 40 Z" fill={ORANGE} stroke={INK} strokeWidth="4" />
      </svg>
      <BigText x={1160} y={300} at={at(0)} size={64} color={ORANGE}>目标</BigText>
      {/* 台阶 */}
      {[...Array(STEPS)].map((_, k) => {
        const lit = frame >= stepAt(k);
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: SX + k * W, top: SY - (k + 1) * H, width: W, height: (k + 1) * H, background: lit ? ORANGE : "#fff",
              border: `5px solid ${INK}`, boxSizing: "border-box" }} />
            {lit && (
              <div style={{ position: "absolute", left: SX + k * W + W / 2, top: SY - (k + 1) * H + 50, transform: `translate(-50%,-50%) scale(${pop(frame, stepAt(k))})`,
                fontFamily: FONT, fontSize: 40, fontWeight: 900, color: "#fff" }}>+1年</div>
            )}
          </React.Fragment>
        );
      })}
      {!thumbs ? (
        <Pose name="run" x={px} bottom={py} h={300} at={0} />
      ) : (
        <Pose name="thumb" x={ax(STEPS - 1)} bottom={ay(STEPS - 1)} h={320} at={0} />
      )}
      <Card x={330} y={150} at={at(1)} size={52}>多一年<span style={{ color: ORANGE }}>底气</span></Card>
      <Cloud x={720} y={300} at={at(2)} text="被裁" />
      <Cloud x={560} y={470} at={at(2) + 10} text="跳槽空档" />
    </AbsoluteFill>
  );
};
export default S09;
