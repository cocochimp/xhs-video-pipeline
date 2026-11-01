import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose, clamp, pop } from "../../../shared/ui";

/** 深夜办公室：阿牛打字，时钟十点；手机弹出工资到账又清零，阿牛捂脸；头顶冒「不干了？」气泡 */
const S03: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const span = at(1) - at(0);
  const phoneAt = at(0) + Math.round(span * 0.25);
  const zeroFrom = at(0) + Math.round(span * 0.62), zeroTo = zeroFrom + 10;
  const money = Math.round(interpolate(frame, [zeroFrom, zeroTo], [8000, 0], clamp));
  const faceAt = zeroTo + 2;
  const bubble = pop(frame, at(1));
  return (
    <AbsoluteFill>
      {/* 夜色窗户 + 月亮 */}
      <div style={{ position: "absolute", left: 80, top: 70, width: 420, height: 300, background: "#24304a", border: `5px solid ${INK}`, borderRadius: 18 }}>
        <div style={{ position: "absolute", left: 290, top: 50, width: 80, height: 80, borderRadius: "50%", background: "#ffe9a8", boxShadow: "-18px 6px 0 0 #24304a inset" }} />
        <div style={{ position: "absolute", left: 205, top: 0, width: 6, height: "100%", background: INK }} />
      </div>
      {/* 时钟：十点 */}
      <svg width={190} height={190} viewBox="0 0 100 100" style={{ position: "absolute", left: 1180, top: 60 }}>
        <circle cx="50" cy="50" r="44" fill="#fff" stroke={INK} strokeWidth="6" />
        {[...Array(12)].map((_, k) => (
          <line key={k} x1="50" y1="12" x2="50" y2="18" stroke={INK} strokeWidth="3" transform={`rotate(${k * 30} 50 50)`} />
        ))}
        <line x1="50" y1="50" x2="50" y2="28" stroke={INK} strokeWidth="6" strokeLinecap="round" transform="rotate(-60 50 50)" />
        <line x1="50" y1="50" x2="50" y2="18" stroke={ORANGE} strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="50" r="4" fill={INK} />
      </svg>

      <Sequence durationInFrames={faceAt}>
        <Pose name="type" x={420} h={600} at={0} />
      </Sequence>
      <Sequence from={faceAt} durationInFrames={at(2) - faceAt}>
        <Pose name="facepalm" x={420} h={620} at={0} />
      </Sequence>
      <Sequence from={at(2)} durationInFrames={dur - at(2)}>
        <Pose name="ponder" x={420} h={620} at={0} />
      </Sequence>

      {/* 手机通知：工资到账 → 清零 */}
      {frame >= phoneAt && (
        <div style={{ position: "absolute", left: 1010, top: 450, width: 340, height: 520, transform: `translate(-50%,-50%) scale(${pop(frame, phoneAt)}) rotate(4deg)`,
          background: INK, borderRadius: 44, padding: 18 }}>
          <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 30, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", fontFamily: FONT, fontWeight: 900, color: INK }}>
            <div style={{ fontSize: 36 }}>工资到账</div>
            <div style={{ fontSize: money === 0 ? 96 : 72, color: money === 0 ? "#e2352b" : ORANGE, marginTop: 16 }}>¥{money}</div>
            {money === 0 && <div style={{ fontSize: 34, marginTop: 12, color: "#8a8378" }}>余额：没了</div>}
          </div>
        </div>
      )}

      {/* 思考气泡 */}
      {frame >= at(1) && (
        <div style={{ position: "absolute", left: 740, top: 190, transform: `translate(-50%,-50%) scale(${bubble})` }}>
          <div style={{ background: "#fff", border: `5px solid ${INK}`, borderRadius: 60, padding: "22px 44px", fontFamily: FONT, fontSize: 76, fontWeight: 900,
            color: ORANGE, whiteSpace: "nowrap" }}>不干了？</div>
          <div style={{ position: "absolute", left: 30, top: 150, width: 34, height: 34, borderRadius: "50%", background: "#fff", border: `5px solid ${INK}` }} />
          <div style={{ position: "absolute", left: 4, top: 196, width: 20, height: 20, borderRadius: "50%", background: "#fff", border: `4px solid ${INK}` }} />
        </div>
      )}
      <Card x={1000} y={900} at={at(2)} size={56}>要攒<span style={{ color: ORANGE }}>多少</span>才够？</Card>
    </AbsoluteFill>
  );
};
export default S03;
