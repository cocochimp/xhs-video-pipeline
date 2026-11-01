import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, clamp, pop } from "../../../shared/ui";

/** 阿牛摊手「很吓人？」→ 放大镜对准「支出」；一枚1块硬币飞走，「目标 -25」弹出 */
const S07: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const lens = interpolate(frame, [at(1) + 6, at(1) + 22], [0, 1], clamp);
  const fs = at(2) + 10;
  const fly = interpolate(frame, [fs, fs + 20], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(1)}>
        <Pose name="shrug" x={300} h={620} at={0} />
        <Card x={940} y={420} at={at(0) + 4} size={90}>很吓人<span style={{ color: ORANGE }}>？</span></Card>
      </Sequence>
      <Sequence from={at(1)} durationInFrames={dur - at(1)}>
        <Pose name="point" x={260} h={600} at={0} />
        {/* 公式 + 放大镜 */}
        <div style={{ position: "absolute", left: 930, top: 260, transform: `translate(-50%,-50%) scale(${pop(frame, at(1))})`,
          fontFamily: FONT, fontSize: 72, fontWeight: 900, color: INK, whiteSpace: "nowrap" }}>
          <span style={{ color: lens > 0.6 ? ORANGE : INK, fontSize: 72 + 36 * lens, display: "inline-block" }}>支出</span> × 25
        </div>
        {frame >= at(1) + 6 && (
          <svg width={300} height={300} viewBox="0 0 100 100" style={{ position: "absolute", left: 640 + 140 * lens, top: 330 - 230 * lens,
            transform: `rotate(${-20 + 20 * lens}deg)` }}>
            <circle cx="40" cy="40" r="28" fill="rgba(255,255,255,.25)" stroke={INK} strokeWidth="7" />
            <line x1="61" y1="61" x2="90" y2="90" stroke={INK} strokeWidth="12" strokeLinecap="round" />
          </svg>
        )}
        <BigText x={940} y={480} at={at(1) + 24} size={96} color={ORANGE}>放大器</BigText>
      </Sequence>
      {/* 1块硬币飞走 */}
      {frame >= at(2) && fly < 1 && (
        <div style={{ position: "absolute", left: 760 + 640 * fly, top: 720 - 520 * fly + 200 * fly * fly, transform: `translate(-50%,-50%) scale(${pop(frame, at(2))}) rotate(${fly * 540}deg)` }}>
          <Img src={staticFile("assets/prop_coin.png")} style={{ height: 140, display: "block" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 40,
            fontWeight: 900, color: INK }}>1块</div>
        </div>
      )}
      <Card x={1060} y={760} at={fs + 12} size={76} fill={ORANGE} color="#fff">目标 -25</Card>
    </AbsoluteFill>
  );
};
export default S07;
