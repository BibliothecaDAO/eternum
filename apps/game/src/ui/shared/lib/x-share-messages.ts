import { APP_HOST } from "@/config/app-address";
import { X_HANDLE } from "@/shell/community";

type TemplateVariables = {
  // player name and tribe
  attackerNameText: string;
  // player name and tribe
  defenderNameText: string;
  // ex: 5940 T1 Knight
  attackerTroopsText: string;
  // ex: 5940 T1 Knight
  defenderTroopsText: string;
  // game url
  url: string;
  // player name
  addressName: string;
  // 300 diamonds, 100 donkeys, 2000 gold
  raidResources: string;
  // tribe name
  tribeName: string;
};

export const formatSocialText = (template: string, variables: Partial<TemplateVariables>): string => {
  return Object.entries(variables).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{${key}}`, "g"), String(value)),
    template,
  );
};

const tweetFooterLines = [X_HANDLE, "The most insane fully onchain game, live on Starknet", APP_HOST] as const;

const tweetFooter = tweetFooterLines.join("\n");

export const twitterTemplates = {
  combat: `⚔️ BATTLE DECLARED! ⚔️\n\n{attackerNameText} with {attackerTroopsText}\n\n🗡️ VS 🛡️\n\n{defenderNameText} with {defenderTroopsText}\n\n${tweetFooter}`,
  raid: `🔥 SUCCESSFUL RAID! 🔥\n\n{attackerNameText}\n\n🗡️ VS 🛡️\n\n{defenderNameText} \n\nSpoils of war: {raidResources} 💰\n\n${tweetFooter}`,
  joinedTribe: `⚔️ NEW ALLIANCE FORGED! ⚔️\n\nI, {addressName}, have pledged allegiance to the mighty {tribeName} tribe!\n\n${tweetFooter}`,
  createdTribe: `⚔️ A NEW POWER RISES! ⚔️\n\nI, {addressName}, have founded the {tribeName} tribe!\n\n${tweetFooter}`,
};
