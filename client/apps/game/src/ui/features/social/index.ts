// Social Feature - Chat, guilds, player interactions
// This feature handles all social systems and multiplayer interactions

// Chat System - Exports used externally
export { ChatModule } from "./chat/chat";
export * from "./chat/hooks/use-socket-events";
export * from "./chat/types";
export { useChatStore } from "./chat/use-chat-store";
export * from "./chat/utils";
export * from "./realtime-chat";

// Guild Management - Exports used externally
export { CreateGuildButton } from "./guilds/create-guild-button";
export { GuildListHeader, GuildRow } from "./guilds/guild-list";
export { GuildMemberList } from "./guilds/guild-member-list";
export { GuildMembers } from "./guilds/guild-members";
export { Guilds } from "./guilds/guilds";

// Player Interactions - Exports used externally
export { PlayerList, type PlayerCustom } from "./player/player-list";
export { PlayersPanel } from "./player/players-panel";

// Social Components - Exports used externally
export { EndSeasonButton } from "./components/end-season-button";
export { RegisterPointsButton } from "./components/register-points-button";
export { Social } from "./components/social";
export { useSocialStore } from "./components/use-social-store";
