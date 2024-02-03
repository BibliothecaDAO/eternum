// experminental, no promising results yet
// get the noise
// roundtrip if bigger than CLIFFS (go from highest mountain to deepest ocean to mimic cliffs and continents)
// with mountains actually being close to the see (mimic continental drift)
export const getBiomeWithCliffs = (col, row) => {
  // const elevation = Math.floor(((snoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE]) + 1) / 2) * 100);

  // try out octaves
  let elevation = 0;
  ELEVATION_OCTAVES.forEach((octave) => {
    elevation +=
      octave *
      Math.floor(
        ((snoise([((1 / octave) * col) / MAP_AMPLITUDE, 0, ((1 / octave) * row) / MAP_AMPLITUDE]) + 1) / 2) * 100,
      );
  });
  // divide by sum of octaves to have a value between 0 and 1
  elevation = elevation / ELEVATION_OCTAVES.reduce((a, b) => a + b, 0);

  // add redistribution
  // if 1 then same
  // if > 1 then more mountains
  // if < 1 then more flat
  elevation = elevation / 100;

  const moisture =
    Math.floor(
      ((snoise([
        (1 / MOISTURE_OCTAVES[0]) * (col / MAP_AMPLITUDE),
        0,
        (1 / MOISTURE_OCTAVES[0]) * (row / MAP_AMPLITUDE),
      ]) +
        1) /
        2) *
        100,
    ) / 100;

  // roundtrip if bigger than CLIFFS (go from highest mountain to deepest ocean to mimic cliffs and continents)
  // with mountains actually being close to the see (mimic continental drift)
  if (moisture > CLIFF_LIMIT) {
    elevation = elevation % CLIFFS;
  }

  return determineEnvironment(elevation, moisture);
};
