import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, pop } from "../../../shared/ui";

/** 结尾：阿牛思考「你的退休数字是？」→ 挥手「关注阿牛，一起早日退休！」+ 头像 + 免责小字 */
const S11: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(1)}>
        <Pose name="think" x={420} h={720} at={0} />
        <Card x={1060} y={420} at={at(0) + 8} size={56}>评论区说说你的<br /><span style={{ color: ORANGE, fontSize: 84 }}>退休数字</span></Card>
      </Sequence>
      <Sequence from={at(1)} durationInFrames={dur - at(1)}>
        <Pose name="wave" x={360} h={660} at={0} />
        <BigText x={1020} y={300} at={0} size={100}>关注阿牛</BigText>
        <BigText x={1020} y={450} at={10} size={96} color={ORANGE}>一起早日退休！</BigText>
      </Sequence>
      {frame >= at(1) + 6 && (
        <Img src={staticFile("assets/avatar.jpg")} style={{ position: "absolute", left: 1020 - 90, top: 580, width: 180, height: 180, borderRadius: "50%",
          border: `5px solid ${INK}`, transform: `scale(${pop(frame, at(1) + 6)})` }} />
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: FONT, fontSize: 22, color: "#8a8378" }}>
        虚拟角色 · 模拟测算 · 未计入养老金 · 不构成投资建议
      </div>
    </AbsoluteFill>
  );
};
export default S11;
