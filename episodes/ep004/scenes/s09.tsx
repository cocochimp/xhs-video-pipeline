import React from "react";
import { AbsoluteFill } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker } from "../../../shared/ui";
import { Bubble, Jar, Lock, RedX } from "./_kit";

/** 存钱罐挂上锁；银行卡旁「绑定支付」「快捷付款」盖红叉；阿牛躺平，头顶冒「懒得动」 */
const S09: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <Pose name="lie" x={320} h={440} at={0} />
    <BigText x={760} y={160} at={at(0) + 2} size={70} color={ORANGE}>看不见</BigText>
    <Jar x={760} y={440} at={at(0) + 4} label="不常用账户" w={200} level={0.35} />
    <Lock x={760} y={470} at={at(0) + 18} size={120} />

    <Sticker src="creditcard" x={1170} y={330} h={190} at={at(1)} rot={-6} />
    <Card x={1060} y={560} at={at(1) + 4} size={38}>绑定支付</Card>
    <Card x={1290} y={560} at={at(1) + 10} size={38}>快捷付款</Card>
    <RedX x={1060} y={560} at={at(1) + 16} size={130} />
    <RedX x={1290} y={560} at={at(1) + 26} size={130} />

    <Card x={1170} y={760} at={at(2) + 4} size={44}>多走<span style={{ color: ORANGE }}>好几步</span></Card>
    <Bubble x={420} y={330} at={at(3)} size={60}>懒得动</Bubble>
  </AbsoluteFill>
);
export default S09;
