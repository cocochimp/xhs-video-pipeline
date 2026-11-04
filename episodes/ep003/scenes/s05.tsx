import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, clamp } from "../../../shared/ui";
import { BigSign, FlyCoin, RoadStrip, Toast, split } from "./_kit";

/** 路牌「①卖技能」亮起 → 阿牛打字，屏幕飘出 PPT、文案、修图、剪辑 → 手机弹「接单+1」→ 金币落进阿牛手里 */
const S05: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const icons = ["PPT", "文案", "修图", "剪辑"];
  return (
    <AbsoluteFill>
      <RoadStrip n={0} lit={at(0) + 4} />
      <Sequence durationInFrames={at(1)}>
        <Pose name="point" x={300} h={600} at={0} />
        <BigSign n={0} at={at(0)} />
      </Sequence>

      {/* 第二句：图标按念到的顺序从电脑屏幕飘出；第三句「上班天天在用」 */}
      <Sequence from={at(1)} durationInFrames={at(3) - at(1)}>
        <Pose name="type" x={380} h={560} at={0} />
      </Sequence>
      {frame >= at(1) && frame < at(3) && icons.map((t, k) => {
        const s = split(at(1), at(2), k, 4);
        const p = interpolate(frame, [s, s + 16], [0, 1], clamp);
        return <Card key={k} x={440 + p * (360 + k * 140)} y={600 - p * (260 - (k % 2) * 90)} at={s} size={52} tilt={k % 2 ? 5 : -5}
          fill={k % 2 ? "#fff" : "#fff3e8"}>{t}</Card>;
      })}
      {frame < at(3) && <Card x={960} y={790} at={at(2) + 4} size={44}>上班天天在用</Card>}

      <Sequence from={at(3)} durationInFrames={at(4) - at(3)}>
        <Pose name="phone" x={380} h={600} at={0} />
        <Toast x={960} y={380} at={6} size={44}>闲鱼：接单 <span style={{ color: ORANGE }}>+1</span></Toast>
        <Card x={960} y={600} at={24} size={60}>按单收钱</Card>
      </Sequence>

      <Sequence from={at(4)} durationInFrames={dur - at(4)}>
        <Pose name="money" x={380} h={620} at={0} />
        <Card x={980} y={330} at={4} size={52}>不用从零学</Card>
        <BigText x={980} y={560} at={Math.round((dur - at(4)) * 0.45)} size={110} color={ORANGE}>第一笔钱</BigText>
      </Sequence>
      <FlyCoin from={[960, 420]} to={[400, 560]} at={at(4) + 10} d={22} h={100} arc={200} />
    </AbsoluteFill>
  );
};
export default S05;
