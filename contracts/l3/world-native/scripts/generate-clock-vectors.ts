import { writeFileSync } from "node:fs";
import { ResourcesIds } from "@bibliothecadao/types";
import { seasonOneReleaseDefinition } from "../../../../config/deployer/clean/config/native-preset";
import { gameClockScale, scaleGameClocks } from "../../../../config/source/common/season-clock";
import { FRONTIER_REHEARSAL_PRESET_ID } from "../../../../config/source/common/native-preset-modes";
import { nativePresetForId } from "../../../../config/source/native";

const scale = gameClockScale(nativePresetForId(FRONTIER_REHEARSAL_PRESET_ID));
const rehearsal = scaleGameClocks(seasonOneReleaseDefinition(), scale);
const wheat = rehearsal.resources.resources.find(({ resource_type }) => resource_type === ResourcesIds.Wheat)!;

writeFileSync(
  new URL("../tests/fixtures/clock-scale.txt", import.meta.url),
  [
    scale,
    rehearsal.rules.tick_config.armies_tick_in_seconds,
    rehearsal.rules.day_unit_seconds,
    rehearsal.rules.relic_seconds_per_rank,
    wheat.realm_rate,
  ].join("\n") + "\n",
);
