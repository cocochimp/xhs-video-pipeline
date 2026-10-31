import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, Sticker } from "../../../shared/ui";

/** 算式逐行出现，150万砸下来画面震动，阿牛受惊，旁边一个钱袋 */
const S06: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const shake = frame >= at(2) && frame < at(2) + 10 ? Math.sin(frame * 3.1) * 12 : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <Pose name="shock" x={1160} h={600} at={0} />
      <BigText x={520} y={210} at={at(0)} size={72}>5000 × 12 = <span style={{ color: ORANGE }}>6万</span></BigText>
      <BigText x={520} y={340} at={at(1)} size={72}>6万 × 25 =</BigText>
      <BigText x={540} y={590} at={at(2)} size={220} color={ORANGE} slam>150万</BigText>
      <Sticker src="moneybag" x={190} y={830} h={210} at={at(2) + 4} rot={-8} />
    </AbsoluteFill>
  );
};
export default S06;
