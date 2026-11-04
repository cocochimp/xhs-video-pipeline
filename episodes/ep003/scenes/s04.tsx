import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker, clamp } from "../../../shared/ui";
import { Signpost } from "./_kit";

/** 岔路：一条大路从左下分出五条小路，路口立空白路牌 */
const Roads: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 18], [0, 1], clamp);
  const ends = [210, 340, 470, 600, 730];
  return (
    <>
      <svg width={1440} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M560 1000 L720 820" stroke="#d9cbb4" strokeWidth="80" strokeLinecap="round" />
        {ends.map((y, k) => (
          <path key={k} d={`M720 820 Q900 ${820 + (y - 820) * 0.3} ${720 + 600 * p} ${820 + (y - 820) * p}`} fill="none"
            stroke="#d9cbb4" strokeWidth="34" strokeLinecap="round" />
        ))}
      </svg>
      {ends.map((y, k) => (
        <Signpost key={k} x={1300} y={y - 30} at={at + 14 + k * 4} w={150} size={30} label="" />
      ))}
    </>
  );
};

/** 阿牛把「时间」沙漏递给西装老板 → 大路分出五条岔路、空白路牌 → 阿牛托腮看着岔路 */
const S04: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const l1 = at(1);
  const give = interpolate(frame, [at(0) + 10, at(0) + 34], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={l1}>
        <Pose name="point" x={300} h={620} at={0} />
        <Img src={staticFile("assets/prop_boss.png")} style={{ position: "absolute", left: 1150 - 230, top: 300, height: 460 }} />
        <div style={{ position: "absolute", left: 470 + give * 420, top: 470 - Math.sin(give * Math.PI) * 80 }}>
          <Sticker src="hourglass" x={0} y={0} h={200} at={at(0)} />
          <Card x={0} y={150} at={at(0) + 4} size={44}><span style={{ color: ORANGE }}>时间</span></Card>
        </div>
        <BigText x={720} y={160} at={at(0) + 30} size={90}>卖给一个老板</BigText>
      </Sequence>

      <Sequence from={l1} durationInFrames={dur - l1}>
        <Roads at={0} />
        {frame < at(2) && <Pose name="point" x={300} h={600} at={0} />}
        <BigText x={760} y={150} at={18} size={96}>多开 <span style={{ color: ORANGE }}>一条路</span></BigText>
      </Sequence>
      <Pose name="think" x={300} h={600} at={at(2)} />
      <Card x={760} y={300} at={at(2) + 6} size={46}>从门槛最低的说起</Card>
    </AbsoluteFill>
  );
};
export default S04;
