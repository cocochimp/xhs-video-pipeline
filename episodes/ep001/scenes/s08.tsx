import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker, clamp, pop } from "../../../shared/ui";

/** 盖章式红叉 */
const Cross: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 170 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const s = interpolate(pop(frame, at, 14), [0, 1], [2, 1]);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute", left: x - size / 2, top: y - size / 2,
      transform: `scale(${s})`, opacity: Math.min(1, (frame - at) / 4) }}>
      <path d="M18 18 L82 82 M82 18 L18 82" stroke="#e2352b" strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
};

/** 奶茶被轻轻推到一边；房租、分期、自动续费三张卡依次出现并打红叉；阿牛做「停」 */
const S08: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [at(0) + 14, at(0) + 30], [0, 1], clamp);
  const span = at(2) - at(1);
  const cards = ["房租", "分期", "自动续费"];
  const cardAt = (k: number) => at(1) + Math.round(span * (0.38 + k * 0.17));
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(1)}>
        <Pose name="point" x={280} h={600} at={0} />
      </Sequence>
      <Sequence from={at(1)} durationInFrames={dur - at(1)}>
        <Pose name="stop" x={280} h={620} at={0} />
      </Sequence>
      {/* 奶茶：先在中间，被推到右下角并变淡 */}
      <Sticker src="tea" x={860 + 420 * push} y={560 + 300 * push} h={260 - 110 * push} at={at(0) + 2} rot={14 * push}
        style={{ opacity: 1 - 0.45 * push }} />
      <BigText x={900} y={180} at={at(1)} size={100} color={ORANGE}>先砍固定大头</BigText>
      {cards.map((c, k) => (
        <React.Fragment key={c}>
          <Card x={620 + k * 290} y={480} at={cardAt(k)} size={c.length > 2 ? 48 : 64} tilt={(k - 1) * 3}>{c}</Card>
          <Cross x={620 + k * 290} y={480} at={cardAt(k) + 10} />
        </React.Fragment>
      ))}
      <Card x={900} y={720} at={at(2) + 6} size={60} fill={ORANGE} color="#fff">砍一次，每月都在省</Card>
    </AbsoluteFill>
  );
};
export default S08;
