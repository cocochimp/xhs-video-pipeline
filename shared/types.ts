import type React from "react";

export type Line = { seg: string; zh: string; say: string };
export type Sfx = { line: number; kind: "pop" | "stamp" | "whoosh"; vol: number; offset?: number };

export type SceneData = {
  id: string;
  name: string;
  visual: string;
  lines: Line[];
  sfx: Sfx[];
  textStatus: string;
  status: string;
  rounds: unknown[];
};

export type EpisodeJson = {
  id: string;
  no: number;
  total: number;
  stage: string;
  title: string;
  topic?: unknown;
  roll?: { after: string; dur: number; topics: string[] };
  segments: { id: string; gap: number }[];
  scenes: SceneData[];
  cost: { tts: number; image: number };
};

export type TimelineLine = { scene: string; i: number; seg: string; zh: string; start: number; end: number };

export type Timeline = {
  fps: number;
  duration: number;
  voice: { speaker: string; rate: number };
  segments: Record<string, { start: number; duration: number; hash: string }>;
  lines: TimelineLine[];
  scenes: Record<string, { start: number; end: number }>;
  roll: { start: number; dur: number; topics: string[] } | null;
  sfx: [number, string, number][];
};

/** 场景组件只拿到相对时间：at(i) = 本场景第 i 句开始的帧（相对场景开头），at(台词数) = dur */
export type SceneProps = { at: (i: number) => number; dur: number; from: number };

export type EpisodeModule = {
  episode: EpisodeJson;
  timeline: Timeline;
  scenes: Record<string, React.FC<SceneProps>>;
};
