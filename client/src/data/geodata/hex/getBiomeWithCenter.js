// get the noise
// get the center of the map to allow islands
export const getBiomeWithCenter = (col, row) => {
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

  elevation = elevation / 100;

  let moisture = 0;

  MOISTURE_OCTAVES.forEach((octave) => {
    moisture +=
      octave *
      Math.floor(
        ((seedsnoise([((1 / octave) * col) / MAP_AMPLITUDE, 0, ((1 / octave) * row) / MAP_AMPLITUDE], 1) +
          MOISTURE_SEED_NOISE) /
          2) *
          100,
      );
  });

  moisture = moisture / MOISTURE_OCTAVES.reduce((a, b) => a + b, 0);

  moisture = moisture / 100;

  // ISLANDS
  // determine the distance between col, row and the center of the map
  const center = [COLS / 2, ROWS / 2];
  const distance = Math.sqrt(Math.pow(col - center[0], 2) + Math.pow(row - center[1], 2));
  // range from -1 to 1
  const distanceFactor = (distance / Math.sqrt(Math.pow(center[0], 2) + Math.pow(center[1], 2))) * 2 - 1;
  // new elevation based on this forumula e = lerp(e, 1-d, mix)
  const newElevation = lerp(elevation, 1 - distanceFactor, MIX);

  return determineEnvironment(newElevation, moisture);
};
