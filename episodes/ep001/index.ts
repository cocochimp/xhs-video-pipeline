import type { EpisodeJson, EpisodeModule, Timeline } from "../../shared/types";
import timeline from "./audio/timeline.json";
import episode from "./episode.json";
import s01 from "./scenes/s01";
import s02 from "./scenes/s02";
import s03 from "./scenes/s03";
import s04 from "./scenes/s04";
import s05 from "./scenes/s05";
import s06 from "./scenes/s06";
import s07 from "./scenes/s07";
import s08 from "./scenes/s08";
import s09 from "./scenes/s09";
import s10 from "./scenes/s10";
import s11 from "./scenes/s11";

const ep: EpisodeModule = {
  episode: episode as unknown as EpisodeJson,
  timeline: timeline as unknown as Timeline,
  scenes: { s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11 },
};
export default ep;
