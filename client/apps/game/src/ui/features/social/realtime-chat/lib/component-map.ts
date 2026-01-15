export interface RealtimeChatComponentDescriptor {
  id: "shell" | "world-panel" | "direct-panel" | "presence-sidebar" | "thread-list" | "message-composer";
  title: string;
  description: string;
  uses: Array<
    | "useRealtimeChatInitializer"
    | "useRealtimeConnection"
    | "useRealtimeWorldZone"
    | "useWorldChatControls"
    | "useRealtimeTotals"
    | "useDirectThread"
    | "useDirectMessageControls"
    | "useRealtimePresence"
    | "useRealtimeTypingIndicators"
  >;
  provides: Array<
    "chat-layout" | "world-feed" | "dm-feed" | "presence-summary" | "thread-switcher" | "compose-controls"
  >;
}

export const realtimeChatComponentMap: RealtimeChatComponentDescriptor[] = [
  {
    id: "shell",
    title: "RealtimeChatShell",
    description:
      "Owns layout, triggers client initialization, and wires world/direct sections with shared status banners.",
    uses: ["useRealtimeChatInitializer", "useRealtimeConnection", "useRealtimeTotals"],
    provides: ["chat-layout"],
  },
  {
    id: "world-panel",
    title: "WorldChatPanel",
    description: "Renders world chat timeline for the active zone with history loader and compose slot.",
    uses: ["useRealtimeWorldZone", "useWorldChatControls"],
    provides: ["world-feed", "compose-controls"],
  },
  {
    id: "direct-panel",
    title: "DirectMessagesPanel",
    description: "Displays selected DM thread, unread badges, and typing indicators.",
    uses: ["useDirectThread", "useDirectMessageControls", "useRealtimeTypingIndicators"],
    provides: ["dm-feed", "compose-controls"],
  },
  {
    id: "presence-sidebar",
    title: "PresenceSidebar",
    description: "Lists online players, last activity, and quick actions to start a DM.",
    uses: ["useRealtimePresence"],
    provides: ["presence-summary"],
  },
  {
    id: "thread-list",
    title: "ThreadListPanel",
    description: "Rows of DM threads with unread counts and selects active conversation.",
    uses: ["useRealtimePresence"],
    provides: ["thread-switcher"],
  },
  {
    id: "message-composer",
    title: "MessageComposer",
    description: "Shared text area + send button used by world and direct panels.",
    uses: [],
    provides: ["compose-controls"],
  },
];
