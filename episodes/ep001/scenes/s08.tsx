import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Check, Pose, Sticker, Strike, clamp } from "../../../shared/ui";

/** 阿牛伸手喊停，外卖和奶茶飞走；150万被划掉改成120万，打勾，阿牛欢呼 */
const S08: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const t0 = at(0) + 12, t1 = Math.max(t0 + 6, at(1) - 2);
  const fly = interpolate(frame, [t0, t1], [0, 1], clamp);
  const gone = fly >= 1;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(1)}>
        <Pose name="stop" x={300} h={600} at={0} />
      </Sequence>
      <Sequence from={at(1)} durationInFrames={dur - at(1)}>
        <Pose name="cheer" x={300} h={620} at={0} />
      </Sequence>
      {!gone && <Sticker src="takeout" x={720 + 900 * fly} y={680 - 120 * fly} h={180} at={at(0) + 2} rot={-10 + 40 * fly} />}
      {!gone && <Sticker src="tea" x={900 + 800 * fly} y={760 - 160 * fly} h={160} at={at(0) + 5} rot={8 + 40 * fly} />}
      <BigText x={950} y={230} at={at(0)} size={150}>150万</BigText>
      <Strike x={950} y={230} w={480} at={at(1) - 4} />
      <Card x={950} y={420} at={at(0) + 4} size={52}>每月少花 <span style={{ color: ORANGE }}>¥1000</span></Card>
      <BigText x={950} y={630} at={at(1)} size={170} color={ORANGE}>120万</BigText>
      <Card x={950} y={830} at={at(1) + 8} size={52} fill={ORANGE} color="#fff">目标 -30万</Card>
      <Check x={1320} y={630} at={at(1) + 12} size={120} />
    </AbsoluteFill>
  );
};
export default S08;
