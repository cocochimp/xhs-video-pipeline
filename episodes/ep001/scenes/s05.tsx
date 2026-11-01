import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Check, Pose, Sticker, clamp } from "../../../shared/ui";

/** 存钱罐每年漏出几枚金币 →「每年只花4%」打勾；再翻成公式卡「年支出 × 25 = 退休数字」，阿牛按计算器 */
const S05: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const flip = at(2);
  // 翻卡：前 6 帧压扁，后 6 帧展开
  const sx = frame < flip ? 1 : Math.abs(interpolate(frame, [flip, flip + 12], [1, -1], clamp));
  const back = frame >= flip + 6;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={flip}>
        <Pose name="point" x={260} h={600} at={0} />
        <BigText x={900} y={160} at={at(0) + 6} size={110} color={ORANGE}>4%法则</BigText>
        <Sticker src="piggy" x={760} y={560} h={300} at={at(0) + 2} />
        {/* 每隔一段漏出一枚金币，落下消失 */}
        {[0, 1, 2, 3, 4].map((k) => {
          const s = at(1) + k * 12;
          if (frame < s) return null;
          const p = interpolate(frame, [s, s + 22], [0, 1], clamp);
          if (p >= 1) return null;
          return (
            <Img key={k} src={staticFile("assets/prop_coin.png")} style={{ position: "absolute", left: 790 + k * 14 - 35, top: 680 + 220 * p * p,
              height: 70, opacity: 1 - p * 0.6, transform: `rotate(${p * 200}deg)` }} />
          );
        })}
      </Sequence>
      <Sequence from={flip} durationInFrames={dur - flip}>
        <Pose name="calc" x={260} h={600} at={0} />
      </Sequence>

      <div style={{ position: "absolute", left: 0, top: 0, width: 1440, height: 1080, transform: `scaleX(${sx})`, transformOrigin: "1060px 50%" }}>
        {!back ? (
          <>
            <Card x={1120} y={480} at={at(1)} size={60}>每年只花 <span style={{ color: ORANGE }}>4%</span></Card>
            <Check x={1120} y={640} at={at(1) + 20} size={130} />
          </>
        ) : (
          <>
            <Card x={980} y={420} at={flip + 6} size={72}>年支出 <span style={{ color: ORANGE }}>× 25</span></Card>
            <BigText x={980} y={560} at={at(3)} size={80}>=</BigText>
            <Card x={980} y={700} at={at(3) + 4} size={80} fill={ORANGE} color="#fff">退休数字</Card>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
export default S05;
