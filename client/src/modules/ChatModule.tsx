import ChatForm from "../components/chat/ChatForm";
import ChatHistory from "../components/chat/ChatHistory";
import { ChatTabs } from "../components/chat/ChatTabs";

const ChatModule = () => {
  return (
    <>
      <ChatTabs />
      <ChatForm />
    </>
  );
};

export default ChatModule;
