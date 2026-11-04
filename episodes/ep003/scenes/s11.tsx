import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, clamp } from "../../../shared/ui";
import { RedX } from "./_kit";

/** 「交999，教你月入过万」传单从右边飘进来，阿牛做「停」的手势；传单被盖上大红叉 */
const S11: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [at(0) + 4, at(1)], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const floating = frame < at(1) ? 1 : 0; // 盖章后停住
  const x = 1700 - 720 * drift, y = 300 + 160 * drift + Math.sin(frame / 9) * 14 * floating;
  const rot = -18 + 24 * drift + Math.sin(frame / 7) * 6 * floating;
  return (
    <AbsoluteFill>
      <Pose name="stop" x={340} h={640} at={0} />
      <div style={{ position: "absolute", left: x - 230, top: y - 190, width: 460, height: 380, background: "#fff6c9", border: `5px solid ${INK}`, borderRadius: 10,
        transform: `rotate(${rot}deg)`, boxShadow: "8px 10px 0 rgba(0,0,0,.12)", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 10, fontFamily: FONT, fontWeight: 900, color: INK }}>
        <div style={{ fontSize: 40, color: "#e2352b" }}>限时特惠！</div>
        <div style={{ fontSize: 60 }}>交 <span style={{ color: "#e2352b", fontSize: 84 }}>999</span></div>
        <div style={{ fontSize: 50 }}>教你月入过万</div>
      </div>
      <RedX x={980} y={460} at={at(1) + 3} size={420} />
      <BigText x={980} y={780} at={at(1) + Math.round((dur - at(1)) * 0.7)} size={120} color={ORANGE} slam>别碰</BigText>
    </AbsoluteFill>
  );
};
export default S11;
