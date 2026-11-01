import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, Sticker, clamp, pop } from "../../../shared/ui";

const Row: React.FC<{ y: number; at: number; children: React.ReactNode }> = ({ y, at, children }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at);
  return (
    <div style={{ position: "absolute", left: 620, top: y, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 60}px)`,
      fontFamily: FONT, fontSize: 64, fontWeight: 900, color: INK, whiteSpace: "nowrap" }}>{children}</div>
  );
};

/** 算式逐行出现：月花5千 → 一年6万 → × 25；「150万」砸下，画面震动，阿牛受惊，旁边一堆金币 */
const S06: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const span0 = at(1) - at(0);
  const hit = at(2) + 4;
  const shake = frame < hit ? 0 : interpolate(frame, [hit, hit + 12], [1, 0], clamp);
  const dx = shake * 16 * Math.sin(frame * 2.3), dy = shake * 12 * Math.cos(frame * 3.1);
  return (
    <AbsoluteFill style={{ transform: `translate(${dx}px,${dy}px)` }}>
      <Sequence durationInFrames={at(2)}>
        <Pose name="calc" x={280} h={600} at={0} />
      </Sequence>
      <Sequence from={at(2)} durationInFrames={dur - at(2)}>
        <Pose name="shock" x={280} h={640} at={0} />
      </Sequence>
      <Row y={110} at={at(0) + Math.round(span0 * 0.35)}>月花 <span style={{ color: ORANGE }}>5千</span></Row>
      <Row y={210} at={at(0) + Math.round(span0 * 0.7)}>→ 一年 <span style={{ color: ORANGE }}>6万</span></Row>
      <Row y={310} at={at(1)}>→ × 25</Row>
      <BigText x={940} y={620} at={at(2)} size={230} color={ORANGE} slam>150万</BigText>
      <Sticker src="goldpile" x={1240} y={880} h={260} at={hit + 4} />
    </AbsoluteFill>
  );
};
export default S06;
