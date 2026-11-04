import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Check, Pose, pop } from "../../../shared/ui";
import { BigSign, FlyCoin, RoadStrip, Wire, split } from "./_kit";

/** 路牌「⑤用人脉」亮起 → 左边老板「找设计」、右边朋友「会设计」→ 阿牛中间牵线，金币飞向阿牛 →「靠谱」亮起 */
const S09: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const l1 = at(1), lf = at(2), l2 = at(3), lv = at(4), l3 = at(5);
  const person = (src: string, x: number, t: number) =>
    frame >= t ? <Img src={staticFile(`assets/prop_${src}.png`)} style={{ position: "absolute", left: x, top: 820, height: 400,
      transform: `translate(-50%,-100%) scale(${pop(frame, t)})`, transformOrigin: "50% 100%" }} /> : null;
  return (
    <AbsoluteFill>
      <RoadStrip n={4} lit={at(0) + 4} />
      <Sequence durationInFrames={l1}>
        <Pose name="point" x={300} h={600} at={0} />
        <BigSign n={4} at={at(0)} />
      </Sequence>

      {frame >= l1 && (
        <>
          {person("boss", 260, l1 + 2)}
          {person("friend", 1180, lf + 2)}
          <Card x={260} y={370} at={l1 + 12} size={46}>找设计</Card>
          <Card x={1180} y={370} at={lf + 12} size={46}>会设计</Card>
          {/* 牵线：老板 → 阿牛 → 朋友 */}
          <Wire a={[400, 620]} b={[640, 620]} at={l2 + 2} d={12} color={ORANGE} width={10} />
          <Wire a={[800, 620]} b={[1040, 620]} at={l2 + 12} d={12} color={ORANGE} width={10} />
        </>
      )}
      <Sequence from={l1} durationInFrames={l2 - l1}>
        <Pose name="ponder" x={720} h={520} at={0} />
      </Sequence>
      <Sequence from={l2} durationInFrames={dur - l2}>
        <Pose name="thumb" x={720} h={520} at={0} />
      </Sequence>
      <FlyCoin from={[260, 560]} to={[720, 380]} at={split(l2, lv, 1, 2)} d={20} h={90} arc={140} />
      {frame >= l2 && frame < l3 && <BigText x={720} y={240} at={lv + 4} size={90} color={ORANGE}>信任值钱</BigText>}

      {frame >= l3 && (
        <>
          <BigText x={720} y={250} at={split(l3, dur, 1, 2)} size={150} color={ORANGE} slam>靠谱</BigText>
          <Check x={920} y={240} at={split(l3, dur, 1, 2) + 10} size={110} />
        </>
      )}
    </AbsoluteFill>
  );
};
export default S09;
