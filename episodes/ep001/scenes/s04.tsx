import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Check, Pose, Sticker, clamp } from "../../../shared/ui";

/** 阿牛抱存钱罐；存钱罐每年漏出几枚金币，卡片：每年只花4%，打勾 */
const S04: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const coins = [0, 1, 2, 3].map((k) => {
    const t = at(1) + 6 + k * 14;
    if (t >= dur || frame < t) return null;
    const p = interpolate(frame, [t, t + 20], [0, 1], clamp);
    return <Sticker key={k} src="coin" x={760 + (k % 2) * 50} y={650 + 200 * p} h={66} at={t} style={{ opacity: 1 - p }} />;
  });
  return (
    <AbsoluteFill>
      <Pose name="piggy" x={290} h={640} at={0} />
      <Card x={960} y={190} at={at(0)} size={84}>4% 法则</Card>
      <Sticker src="jar" x={780} y={500} h={240} at={at(0) + 8} rot={-6} />
      {coins}
      <Card x={1170} y={470} at={at(1)} size={54}>每年只花 <span style={{ color: ORANGE }}>4%</span></Card>
      <Card x={1060} y={770} at={at(2)} size={54}>钱基本花不完</Card>
      <Check x={1340} y={760} at={at(2) + 6} size={110} />
    </AbsoluteFill>
  );
};
export default S04;
