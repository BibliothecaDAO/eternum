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
  // resource type for village
  resourceType: string;
  // resource probability for village
  resourceProbability: number;
  // resource tier for village
  resourceTier: string;
  // realm resources
  realmResources: string;
};

export const formatSocialText = (template: string, variables: Partial<TemplateVariables>): string => {
  return Object.entries(variables).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{${key}}`, "g"), String(value)),
    template,
  );
};

export const twitterTemplates = {
  combat: `⚔️ LAUNCHING AN ASSAULT! ⚔️\n\nLeading {attackerTroops} valiant warriors to conquer {enemyName}'s realm in @RealmsEternum!\n\nTheir {defenderTroops} defenders stand in our way...\n\nJoin the siege at {url} and claim glory! 🏰🔥`,
  raid: `🏰 SUCCESSFUL RAID! 🏰\n\nI, {addressName}, have plundered {enemyName}'s realm in @RealmsEternum!\n\nSpoils of war: {resources} 💰\n\nJoin the conquest at {url} and claim your share of glory! ⚔️`,
  realmSettled: `🏰 REALM SETTLED! 🏰\n\nI, {addressName}, have settled {realmName} in @RealmsEternum!\n\nThis realm produces: {realmResources} ⛏️\n\nJoin the conquest at {url} and claim your share of glory! ⚔️`,
  villageResourceReveal: `🛖 NEW VILLAGE SETTLED! 🛖\n\nI, {addressName}, have settled a {resourceType} village in @RealmsEternum!\n\nWith a {resourceProbability}% chance of finding this {resourceTier} tier resource!\n\nSettle your village at {url} and join the conquest! 🏰💎`,
  joinedTribe: `⚔️ NEW ALLIANCE FORGED! ⚔️\n\nI, {addressName}, have pledged allegiance to the mighty {tribeName} tribe in @RealmsEternum!\n\nUnited we stand, ready to forge our legacy across the lands!\n\nJoin our ranks at {url}! 🏰✨`,
  createdTribe: `⚔️ A NEW POWER RISES! ⚔️\n\nI, {addressName}, have founded the {tribeName} tribe in @RealmsEternum!\n\nOur banners now fly over these lands as we forge our destiny!\n\nJoin our ranks at {url}! 🏰👑`,
};
