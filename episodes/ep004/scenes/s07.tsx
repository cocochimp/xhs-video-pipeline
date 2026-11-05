import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker } from "../../../shared/ui";
import { FlyCoin } from "./_kit";

/** 阿牛拿手机，屏幕「定时转账：每月发薪日」；金币从「工资卡」飞进存钱罐，罐上写「不常用账户」 */
const S07: React.FC<SceneProps> = ({ at }) => {
  const from: [number, number] = [700, 560], to: [number, number] = [1180, 520];
  return (
    <AbsoluteFill>
      <Pose name="phone" x={290} h={640} at={0} />
      <Sequence durationInFrames={at(1)}>
        <BigText x={880} y={190} at={at(0) + 4} size={84}>怎么做？</BigText>
      </Sequence>
      <Card x={880} y={190} at={at(1)} size={46}>定时转账：<span style={{ color: ORANGE }}>每月发薪日</span></Card>

      <Card x={700} y={560} at={at(2)} size={52}>工资卡</Card>
      <Sticker src="jar" x={1180} y={540} h={320} at={at(2) + 4} />
      {[0, 1, 2, 3, 4].map((k) => (
        <FlyCoin key={k} from={from} to={to} at={at(2) + 10 + k * 7} d={18} h={64} arc={170} />
      ))}
      <Card x={1180} y={790} at={at(3)} size={44} fill={ORANGE} color="#fff">不常用账户</Card>
    </AbsoluteFill>
  );
};
export default S07;
