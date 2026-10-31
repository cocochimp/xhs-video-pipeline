import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BigText, Card, Check, Pose, Sticker, Strike, clamp } from "./ui";
import { B, INK, ORANGE, segStart } from "./tl";

const mid = (a: number, b: number) => Math.round((a + b) / 2);

/** 到手8000，每月花5000，到底要攒多少？ */
const SceneIncome: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Card x={480} y={320} at={B(0)} size={52}>到手<br /><span style={{ fontSize: 110 }}>¥8000</span></Card>
      <Card x={480} y={640} at={mid(B(0), B(1))} size={52}>每月花<br /><span style={{ fontSize: 110, color: ORANGE }}>¥5000</span></Card>
      <Pose name={frame < B(1) ? "point" : "think"} x={1080} h={640} at={frame < B(1) ? segStart("body") : B(1)} />
      <Card x={1080} y={170} at={B(2)} size={60} fill={ORANGE} color="#fff" tilt={-4}>要攒多少？</Card>
    </AbsoluteFill>
  );
};

/** 4%法则：每年只花4%，钱基本花不完 */
const SceneRule: React.FC = () => {
  const frame = useCurrentFrame();
  const coins = [0, 1, 2].map((k) => {
    const at = B(4) + 8 + k * 16;
    if (frame < at) return null;
    const p = interpolate(frame, [at, at + 22], [0, 1], clamp);
    return <Sticker key={k} src="coin" x={470 + k * 30} y={640 + 200 * p} h={70} at={at} style={{ opacity: 1 - p }} />;
  });
  return (
    <AbsoluteFill>
      <Card x={720} y={180} at={B(3)} size={88}>4% 法则</Card>
      <Sticker src="piggy" x={500} y={520} h={300} at={B(4)} />
      {coins}
      <Card x={930} y={430} at={B(4) + 6} size={54}>每年只花 <span style={{ color: ORANGE }}>4%</span></Card>
      <Card x={930} y={620} at={B(5)} size={54}>钱基本花不完</Card>
      <Check x={1210} y={600} at={B(5) + 6} />
      <Pose name="point" x={1270} h={420} at={B(3)} />
    </AbsoluteFill>
  );
};

/** 年支出 × 25 = 退休数字 */
const SceneFormula: React.FC = () => (
  <AbsoluteFill>
    <BigText x={720} y={190} at={B(6)} size={70}>反过来算</BigText>
    <Card x={300} y={420} at={B(7)} size={66}>年支出</Card>
    <BigText x={560} y={420} at={B(7) + 6} size={90}>×</BigText>
    <Card x={760} y={420} at={B(7) + 10} size={80} fill={ORANGE} color="#fff">25</Card>
    <BigText x={960} y={420} at={B(8)} size={90}>=</BigText>
    <Card x={1180} y={420} at={B(8) + 4} size={66}>退休数字</Card>
    <Pose name="calc" x={720} h={360} at={B(6)} />
  </AbsoluteFill>
);

/** 5000×12=6万，6万×25=150万 */
const SceneAnswer: React.FC = () => {
  const frame = useCurrentFrame();
  const shake = frame >= B(11) && frame < B(11) + 10 ? Math.sin(frame * 3.1) * 12 : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <BigText x={720} y={200} at={B(9)} size={76}>5000 × 12 = <span style={{ color: ORANGE }}>6万</span></BigText>
      <BigText x={720} y={330} at={B(10)} size={76}>6万 × 25 =</BigText>
      <BigText x={660} y={600} at={B(11)} size={240} color={ORANGE} slam>150万</BigText>
      <Sticker src="moneybag" x={250} y={720} h={260} at={B(11) + 3} rot={-8} />
      <Pose name="shock" x={1210} h={540} at={B(11)} />
    </AbsoluteFill>
  );
};

/** 很吓人？好消息：花得越少，要攒的就越少 */
const SceneGoodNews: React.FC = () => {
  const frame = useCurrentFrame();
  const shrug = frame < B(13);
  return (
    <AbsoluteFill>
      {shrug && <BigText x={720} y={190} at={B(12)} size={84}>很吓人？</BigText>}
      <Pose name={shrug ? "shrug" : "point"} x={shrug ? 720 : 300} h={shrug ? 620 : 600} at={shrug ? B(12) : B(13)} />
      {!shrug && <Card x={880} y={230} at={B(13)} size={70} fill={ORANGE} color="#fff" tilt={-3}>好消息</Card>}
      {!shrug && <Card x={880} y={470} at={B(14)} size={60}>花得越少 ↓</Card>}
      {!shrug && <Card x={880} y={660} at={mid(B(14), B(15))} size={60}>要攒的越少 <span style={{ color: ORANGE }}>↓</span></Card>}
    </AbsoluteFill>
  );
};

/** 每月少花1000，目标少30万 */
const SceneLess: React.FC = () => {
  const frame = useCurrentFrame();
  const fly = interpolate(frame, [B(15) + 18, B(15) + 32], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <BigText x={600} y={260} at={B(15)} size={170}>150万</BigText>
      <Strike x={600} y={260} w={560} at={B(16) - 6} />
      <Sticker src="takeout" x={210 - 500 * fly} y={620} h={190} at={B(15) + 4} rot={-10} />
      <Sticker src="tea" x={380 - 500 * fly} y={700} h={170} at={B(15) + 8} rot={8} />
      <Card x={300} y={470} at={B(15) + 2} size={48}>每月少花 <span style={{ color: ORANGE }}>¥1000</span></Card>
      <BigText x={680} y={560} at={B(16)} size={190} color={ORANGE}>120万</BigText>
      <Card x={700} y={760} at={B(16) + 8} size={52} fill={ORANGE} color="#fff">目标 -30万</Card>
      <Check x={1010} y={540} at={B(16) + 12} size={140} />
      <Pose name="cheer" x={1260} h={520} at={B(16)} />
    </AbsoluteFill>
  );
};

/** 第一步：先算清楚每月花多少 */
const SceneFirstStep: React.FC = () => (
  <AbsoluteFill>
    <Pose name="calc" x={260} h={600} at={B(17)} />
    <Card x={860} y={190} at={B(17)} size={56}>第一步不是赚更多</Card>
    <Strike x={940} y={190} w={330} at={B(17) + 14} />
    <Card x={860} y={400} at={B(18)} size={92} fill={ORANGE} color="#fff" tilt={-2}>先算清楚</Card>
    <Sticker src="calendar" x={720} y={640} h={190} at={B(19)} rot={-6} />
    <Sticker src="calc" x={1000} y={640} h={190} at={B(19) + 5} rot={6} />
    <BigText x={860} y={810} at={B(19) + 8} size={50} color={INK}>一个月到底花多少？</BigText>
  </AbsoluteFill>
);

const SCENES: [number, React.FC][] = [
  [B(3), SceneIncome], [B(6), SceneRule], [B(9), SceneFormula], [B(12), SceneAnswer],
  [B(15), SceneGoodNews], [B(17), SceneLess], [Infinity, SceneFirstStep],
];

export const BodyPart: React.FC = () => {
  const frame = useCurrentFrame();
  const Scene = SCENES.find(([until]) => frame < until)![1];
  return <Scene />;
};
