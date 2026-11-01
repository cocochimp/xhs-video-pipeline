import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose, clamp, pop } from "../../../shared/ui";

/** 从 (x1,y1) 画到 (x2,y2) 的箭头 */
const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; at: number; color: string }> = ({ x1, y1, x2, y2, at, color }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + 10], [0, 1], clamp);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <div style={{ position: "absolute", left: x1, top: y1, width: len * p, height: 14, background: color, borderRadius: 7,
      transform: `translateY(-50%) rotate(${ang}deg)`, transformOrigin: "0 50%" }}>
      {p > 0.9 && <div style={{ position: "absolute", right: -18, top: -16, width: 0, height: 0, borderTop: "23px solid transparent",
        borderBottom: "23px solid transparent", borderLeft: `36px solid ${color}` }} />}
    </div>
  );
};

/** 「赚多少」变灰，「花多少」放大变橙；阿牛托腮；箭头分别指向「攒得快不快」「要攒多少」 */
const S04: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const t = at(0) + 14;
  const k = interpolate(frame, [t, t + 10], [0, 1], clamp);
  const box = (): React.CSSProperties => ({
    position: "absolute", top: 260, transform: "translate(-50%,-50%)", border: `5px solid ${INK}`, borderRadius: 26,
    padding: "18px 40px", fontFamily: FONT, fontWeight: 900, whiteSpace: "nowrap",
  });
  const earnScale = 1 - 0.12 * k, spendScale = 1 + 0.18 * k;
  return (
    <AbsoluteFill>
      <Pose name="ponder" x={240} h={600} at={0} />
      {frame >= at(0) && (
        <>
          <div style={{ ...box(), left: 640, fontSize: 64, transform: `translate(-50%,-50%) scale(${pop(frame, at(0)) * earnScale})`,
            background: k > 0.5 ? "#d9d6d0" : "#fff", color: k > 0.5 ? "#8a8378" : INK, boxShadow: `8px 8px 0 ${k > 0.5 ? "#aaa59c" : ORANGE}` }}>赚多少</div>
          <div style={{ ...box(), left: 1100, fontSize: 64, transform: `translate(-50%,-50%) scale(${pop(frame, at(0) + 4) * spendScale})`,
            background: k > 0.5 ? ORANGE : "#fff", color: k > 0.5 ? "#fff" : INK, boxShadow: `8px 8px 0 ${k > 0.5 ? INK : ORANGE}` }}>花多少</div>
        </>
      )}
      <Arrow x1={640} y1={350} x2={640} y2={560} at={at(1) + 4} color="#aaa59c" />
      <Card x={640} y={660} at={at(1) + 12} size={54} color="#8a8378">攒得快不快</Card>
      <Arrow x1={1100} y1={370} x2={1100} y2={560} at={at(2) + 4} color={ORANGE} />
      <Card x={1100} y={660} at={at(2) + 12} size={66} fill={ORANGE} color="#fff">要攒多少</Card>
    </AbsoluteFill>
  );
};
export default S04;
