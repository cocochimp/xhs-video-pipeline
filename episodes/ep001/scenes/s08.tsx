import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Check, Pose, Sticker, Strike, clamp } from "../../../shared/ui";

/** 每月少花1000，目标少30万 */
const S08: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const fly = interpolate(frame, [at(0) + 18, at(0) + 32], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <BigText x={600} y={260} at={at(0)} size={170}>150万</BigText>
      <Strike x={600} y={260} w={560} at={at(1) - 6} />
      <Sticker src="takeout" x={210 - 500 * fly} y={620} h={190} at={at(0) + 4} rot={-10} />
      <Sticker src="tea" x={380 - 500 * fly} y={700} h={170} at={at(0) + 8} rot={8} />
      <Card x={300} y={470} at={at(0) + 2} size={48}>每月少花 <span style={{ color: ORANGE }}>¥1000</span></Card>
      <BigText x={680} y={560} at={at(1)} size={190} color={ORANGE}>120万</BigText>
      <Card x={700} y={760} at={at(1) + 8} size={52} fill={ORANGE} color="#fff">目标 -30万</Card>
      <Check x={1010} y={540} at={at(1) + 12} size={140} />
      <Pose name="cheer" x={1260} h={520} at={at(1)} />
    </AbsoluteFill>
  );
};
export default S08;
