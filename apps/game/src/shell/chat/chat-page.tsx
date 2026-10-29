import { CHAT_WORDS } from "@/ui/design-system/kit/words";

import { PageFrame } from "../frame/page-frame";
import { AppChatPage } from "./app-chat";

/** Chat, a tab of its own on a phone (`/chat`): Global and Messages, as in a game, filling the page over the tabs. */
export const ChatPage = () => (
  <PageFrame title={CHAT_WORDS.chat} fill>
    <AppChatPage />
  </PageFrame>
);
