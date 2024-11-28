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
};

export const formatSocialText = (template: string, variables: Partial<TemplateVariables>): string => {
  return Object.entries(variables).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{${key}}`, "g"), String(value)),
    template,
  );
};

export const twitterTemplates = {
  battling: `⚔️ My army is battling another army in Eternum! ⚔️\n\nI am battling against {enemyName} with {attackerTroops} troops on my side against {defenderTroops} troops on their side.\n\nJoin the battle at {url} 🛡️`,
  underSiege: `🏰 My realm is under siege in Eternum! 🏰\n\n{enemyName} is attacking with {attackerTroops} troops ⚔️ while I'm defending with {defenderTroops} troops 🛡️.\n\nHelp me keep my realm at {url} 👑`,
  attacking: `🔥 I'm attacking {enemyName}'s realm in Eternum! 🔥\n\nI have {attackerTroops} troops 🗡️ against their {defenderTroops} troops.\n\nHelp me conquer their realm at {url} 🏰`,
  settle: `I've joined the Eternum battle for glory.\nWars will be fought, tears will be shed.\n\n{realmName} has been settled. ⚔️\n\nSettle your realm at {url} and compete for 100K $LORDS`,
  pillage: `I, Ser {addressName}, have just raided {enemyName} from {resources} in @RealmsEternum.💰💰💰\n\nJoin the battle for victory at {url}`,
};
