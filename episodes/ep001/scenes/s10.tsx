import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, pop } from "../../../shared/ui";

/** 固定结尾：举牌提问 → 挥手「关注阿牛，一起早日退休！」+ 免责小字 */
const S10: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const ask = frame < at(2);
  return (
    <AbsoluteFill>
      {ask ? (
        <Pose name="sign" x={720} h={760} at={Math.max(0, at(0) - 4)} sign={<span>你的数字<span style={{ color: ORANGE }}>是？</span></span>} />
      ) : (
        <>
          <Pose name="wave" x={420} h={680} at={at(2)} />
          <BigText x={1000} y={330} at={at(2)} size={100}>关注阿牛</BigText>
          <BigText x={1000} y={480} at={at(3)} size={100} color={ORANGE}>一起早日退休！</BigText>
          <Img src={staticFile("assets/avatar.jpg")} style={{ position: "absolute", left: 1000 - 90, top: 590, width: 180, height: 180, borderRadius: "50%",
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
