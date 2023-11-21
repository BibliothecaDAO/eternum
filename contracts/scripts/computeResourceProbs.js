
let resourcesProbs = [
    ["WOOD", 0.2018109],
    ["STONE", 0.1585915],
    ["COAL", 0.1542455],
    ["COPPER", 0.1063581],
    ["OBSIDIAN", 0.0891751],
    ["SILVER", 0.0700604],
    ["IRONWOOD", 0.0474447],
    ["COLD_IRON", 0.0385111],
    ["GOLD", 0.0367807],
    ["HARTWOOD", 0.0239034],
    ["DIAMONDS", 0.0120724],
    ["SAPPHIRE", 0.0099396],
    ["RUBY", 0.0096177],
    ["DEEP_CRYSTAL", 0.0096177],
    ["IGNIUM", 0.0069215],
    ["ETHEREAL_SILICA", 0.0065191],
    ["TRUE_ICE", 0.0055936],
    ["TWILIGHT_QUARTZ", 0.0044668],
    ["ALCHEMICAL_SILVER", 0.0037425],
    ["ADAMANTINE", 0.0022133],
    ["MITHRAL", 0.0014889],
    ["DRAGONHIDE", 0.0009256]
  ]

  let sum = 0;
  for (let i = 0; i < resourcesProbs.length; i++ ) {
    let multiplier = 10_000_000;
    let res = parseInt(resourcesProbs[i][1] * multiplier);
    console.log(`(ResourceTypes::${resourcesProbs[i][0]}, ${res}),`);
    sum += res;

  }

  console.log("\n\nsum is ", sum,"\n\n" )
