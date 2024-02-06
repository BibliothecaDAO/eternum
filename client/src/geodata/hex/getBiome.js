// import { snoise, recursiveSNoise } from "@dojoengine/utils";
import { snoise } from "./snoise.js";
import { ELEVATION_OCTAVES, MAP_AMPLITUDE, MOISTURE_OCTAVE, determineEnvironment } from "./params.js";

// get the noise
export const getBiome = (col, row) => {
  // try out octaves
  let elevation = 0;
  ELEVATION_OCTAVES.forEach((octave) => {
    const noise = snoise([((1 / octave) * col) / MAP_AMPLITUDE, 0, ((1 / octave) * row) / MAP_AMPLITUDE]);
    const x = ((1 / octave) * col) / MAP_AMPLITUDE;
    const y = ((1 / octave) * row) / MAP_AMPLITUDE;
    console.log({ col, row });
    console.log({ noise, x, y });
    elevation +=
      octave *
      Math.floor(
        ((snoise([((1 / octave) * col) / MAP_AMPLITUDE, 0, ((1 / octave) * row) / MAP_AMPLITUDE]) + 1) / 2) * 100,
      );
  });
  // divide by sum of octaves to have a value between 0 and 1
  elevation = elevation / ELEVATION_OCTAVES.reduce((a, b) => a + b, 0);

  elevation = elevation / 100;

  console.log({ elevation });

  let moisture = 0;

  // don't use seedsnoise because no seeds in contracts
  // MOISTURE_OCTAVES.forEach((octave) => {
  //   moisture +=
  //     octave *
  //     Math.floor(
  //       ((seedsnoise(
  //         [((1 / octave) * col) / MAP_AMPLITUDE, 0, ((1 / octave) * row) / MAP_AMPLITUDE],
  //         MOISTURE_SEED_NOISE,
  //       ) +
  //         1) /
  //         2) *
  //         100,
  //     );
  // });
  // moisture = moisture / MOISTURE_OCTAVES.reduce((a, b) => a + b, 0);
  // moisture = moisture / 100;
  // moisture = elevation;
  moisture =
    Math.floor(
      ((snoise([(MOISTURE_OCTAVE * col) / MAP_AMPLITUDE, 0, (MOISTURE_OCTAVE * row) / MAP_AMPLITUDE]) + 1) / 2) * 100,
    ) / 100;

  console.log({ moisture });

  return determineEnvironment(elevation, moisture);
};
