type TemplateVariables = {
  enemyName: string;
  attackerTroops: string;
  defenderTroops: string;
  // game url
  url: string;
  realmName: string;
  // player name
  addressName: string;
  // 300 diamonds, 100 donkeys, 2000 gold
  resources: string;
  tribeName: string;
};

export const formatSocialText = (template: string, variables: Partial<TemplateVariables>): string => {
  return Object.entries(variables).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{${key}}`, "g"), String(value)),
    template,
  );
};

export const twitterTemplates = {
  battling: `⚔️ CLASH OF ARMIES IN ETERNUM! ⚔️\n\nMy mighty force of {attackerTroops} troops engages {enemyName}'s {defenderTroops} troops in an epic battle for supremacy in @RealmsEternum!\n\nWatch the carnage at {url} 🗡️`,
  underSiege: `🚨 REALM UNDER SIEGE! 🚨\n\n{enemyName}'s army of {attackerTroops} troops lays siege to my {defenderTroops} brave defenders in @RealmsEternum!\n\nRally to my defense at {url} ⚔️\n\nThe fate of my realm hangs in the balance! 🏰`,
  attacking: `⚔️ LAUNCHING AN ASSAULT! ⚔️\n\nLeading {attackerTroops} valiant warriors to conquer {enemyName}'s realm in @RealmsEternum!\n\nTheir {defenderTroops} defenders stand in our way...\n\nJoin the siege at {url} and claim glory! 🏰🔥`,
  settle: `I've joined the @RealmsEternum battle for glory.\n\nWars will be fought, tears will be shed.\n\n{realmName} has been settled. ⚔️\n\nSettle your realm at {url} and join the conquest! 🏰`,
  pillage: `🏰 SUCCESSFUL RAID! 🏰\n\nI, {addressName}, have plundered {enemyName}'s realm in @RealmsEternum!\n\nSpoils of war: {resources} 💰\n\nJoin the conquest at {url} and claim your share of glory! ⚔️`,
  joinedTribe: `⚔️ NEW ALLIANCE FORGED! ⚔️\n\nI, {addressName}, have pledged allegiance to the mighty {tribeName} tribe in @RealmsEternum!\n\nUnited we stand, ready to forge our legacy across the lands!\n\nJoin our ranks at {url}! 🏰✨`,
  createdTribe: `⚔️ A NEW POWER RISES! ⚔️\n\nI, {addressName}, have founded the {tribeName} tribe in @RealmsEternum!\n\nOur banners now fly over these lands as we forge our destiny!\n\nJoin our ranks at {url}! 🏰👑`,
};
