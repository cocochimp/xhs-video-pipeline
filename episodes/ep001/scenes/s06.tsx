import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, Sticker } from "../../../shared/ui";

/** 5000×12=6万，6万×25=150万 */
const S06: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const shake = frame >= at(2) && frame < at(2) + 10 ? Math.sin(frame * 3.1) * 12 : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <BigText x={720} y={200} at={at(0)} size={76}>5000 × 12 = <span style={{ color: ORANGE }}>6万</span></BigText>
      <BigText x={720} y={330} at={at(1)} size={76}>6万 × 25 =</BigText>
      <BigText x={660} y={600} at={at(2)} size={240} color={ORANGE} slam>150万</BigText>
      <Sticker src="moneybag" x={250} y={720} h={260} at={at(2) + 3} rot={-8} />
      <Pose name="shock" x={1210} h={540} at={at(2)} />
    </AbsoluteFill>
  );
};
export default S06;
