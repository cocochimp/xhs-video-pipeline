import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker, pop } from "../../../shared/ui";

/** 固定结尾：阿牛看手机问「你每月花多少？」→ 挥手「关注阿牛，一起早日退休！」+ 头像 + 免责小字 */
const S10: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const ask = frame < at(2);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(2)}>
        <Pose name="phone" x={350} h={620} at={0} />
      </Sequence>
      <Sequence from={at(2)} durationInFrames={dur - at(2)}>
        <Pose name="wave" x={360} h={660} at={0} />
      </Sequence>
      {ask ? (
        <>
          <Card x={980} y={260} at={at(0)} size={72}>你每月花<span style={{ color: ORANGE }}>多少？</span></Card>
          <Card x={980} y={500} at={at(1)} size={54}>评论区算算你的<br /><span style={{ color: ORANGE, fontSize: 80 }}>退休数字</span></Card>
          <Sticker src="calc" x={980} y={770} h={170} at={at(1) + 8} rot={6} />
        </>
      ) : (
        <>
          <BigText x={1020} y={300} at={at(2)} size={100}>关注阿牛</BigText>
          <BigText x={1020} y={450} at={at(3)} size={96} color={ORANGE}>一起早日退休！</BigText>
          <Img src={staticFile("assets/avatar.jpg")} style={{ position: "absolute", left: 1020 - 90, top: 580, width: 180, height: 180, borderRadius: "50%",
            border: `5px solid ${INK}`, transform: `scale(${pop(frame, at(2) + 6)})` }} />
        </>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: FONT, fontSize: 22, color: "#8a8378" }}>
        虚拟角色 · 模拟测算 · 未计入养老金 · 不构成投资建议
      </div>
    </AbsoluteFill>
  );
};
export default S10;
