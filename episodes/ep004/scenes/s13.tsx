import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, pop } from "../../../shared/ui";

/** 结尾：阿牛托腮「发工资那天，你的钱先去哪了？留言告诉阿牛」→ 挥手「关注阿牛，一起早日退休！」+ 头像 + 免责小字 */
const S13: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(2)}>
        <Pose name="think" x={400} h={720} at={0} />
        <Card x={1030} y={380} at={at(0) + 8} size={52}>发工资那天<br />你的钱<span style={{ color: ORANGE, fontSize: 76 }}>先去哪了</span>？</Card>
        <Card x={1030} y={640} at={at(1)} size={48} fill={ORANGE} color="#fff">留言告诉阿牛</Card>
      </Sequence>
      <Sequence from={at(2)} durationInFrames={dur - at(2)}>
        <Pose name="wave" x={360} h={660} at={0} />
        <BigText x={1020} y={300} at={0} size={100}>关注阿牛</BigText>
        <BigText x={1020} y={450} at={10} size={96} color={ORANGE}>一起早日退休！</BigText>
      </Sequence>
      {frame >= at(2) + 6 && (
        <Img src={staticFile("assets/avatar.jpg")} style={{ position: "absolute", left: 1020 - 90, top: 580, width: 180, height: 180, borderRadius: "50%",
          border: `5px solid ${INK}`, transform: `scale(${pop(frame, at(2) + 6)})` }} />
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: FONT, fontSize: 22, color: "#8a8378" }}>
        虚拟角色 · 个人经验分享 · 收入因人而异 · 不构成投资建议
      </div>
    </AbsoluteFill>
  );
};
export default S13;
