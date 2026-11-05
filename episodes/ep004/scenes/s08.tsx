import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, clamp, pop } from "../../../shared/ui";

/** 一张钞票 */
const Bill: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <div style={{ position: "absolute", left: x - 150, top: y - 14, width: 300, height: 28, background: "#9fd39a", border: `4px solid ${INK}`, borderRadius: 6 }} />
);

/** 阿牛数钱，从一沓工资里抽出薄薄一小沓；「10%」大字砸下，旁边小字「几乎感觉不到」 */
const S08: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const stackAt = at(1);
  const pull = interpolate(frame, [at(1) + 14, at(1) + 30], [0, 1], clamp);
  const e = pull * pull * (3 - 2 * pull);
  const sp = frame >= stackAt ? pop(frame, stackAt) : 0;
  const tip = frame >= at(3) ? pop(frame, at(3)) : 0;
  return (
    <AbsoluteFill>
      <Pose name="money" x={300} h={640} at={0} />
      <Sequence durationInFrames={at(2)}>
        <BigText x={960} y={260} at={at(0) + 4} size={96}>转多少？</BigText>
      </Sequence>
      <BigText x={960} y={290} at={at(2)} size={230} color={ORANGE} slam>10%</BigText>

      {frame >= stackAt && (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 1080, transform: `scale(${sp})`, transformOrigin: "820px 700px" }}>
          {/* 一沓工资 */}
          {[...Array(10)].map((_, k) => <Bill key={k} x={820} y={800 - k * 22} />)}
          <div style={{ position: "absolute", left: 820, top: 860, transform: "translateX(-50%)", fontFamily: FONT, fontWeight: 900, fontSize: 40, color: INK }}>工资</div>
          {/* 抽出的一小沓 */}
          <Bill x={820 + 380 * e} y={580 + 40 * e} />
        </div>
      )}
      {frame >= at(3) && (
        <div style={{ position: "absolute", left: 1200, top: 700, transform: `translate(-50%,-50%) scale(${tip})`, fontFamily: FONT, fontWeight: 900,
          fontSize: 48, color: "#8a8378", whiteSpace: "nowrap" }}>几乎感觉不到</div>
      )}
    </AbsoluteFill>
  );
};
export default S08;
