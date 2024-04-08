// create 1 map per continent and concatenate them together afterwards (1 part = 1 continent)
export const getBiomeWithParts = (col, row, part) => {
  // use snoise with seed
  const elevation = Math.floor(((seedsnoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE], part) + 1) / 2) * 100);
  const moisture = Math.floor(((seedsnoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE]) + 1) / 2) * 100);

  // determine the distance between col, row and the center of the map
  const center = [COLS / (NPARTS * 2), ROWS / 2];

  // modify a bit the centers of the continents to add more variability
  // MANUALLY
  // put center a bit on the right if part is 1
  // put center a bit on bottom if part is 2
  // put center a bit on the left if part is 3
  // do this randomly with part as the seed to have the same result for each part
  // if (part === 1) {
  //   center[0] = center[0] * 1.3;
  //   center[1] = center[0] * 0.8;
  // } else if (part === 2) {
  //   center[1] = center[1] * 1.3;
  // } else {
  //   center[0] = center[0] * 0.5;
  // }

  // randomly with seed
  // move centers around to make it look more natural
  const seed1 = new SeededRandom(part);
  const random1 = seed1.nextInt(70, 130) / 100;
  const seed2 = new SeededRandom(part ** 2);
  const random2 = seed2.nextInt(70, 130) / 100;
  center[0] = center[0] * random1;
  center[1] = center[1] * random2;

  const distance = Math.sqrt(Math.pow(col - center[0], 2) + Math.pow(row - center[1], 2));
  // range from -1 to 1
  const distanceFactor = (distance / Math.sqrt(Math.pow(center[0], 2) + Math.pow(center[1], 2))) * 2 - 1;
  // new elevation based on this forumula e = lerp(e, 1-d, mix)
  const newElevation = lerp(elevation / 100, 1 - distanceFactor, MIX);

  return determineEnvironment(newElevation, moisture / 100);
};
