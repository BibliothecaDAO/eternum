import ChatForm from "../components/chat/ChatForm";
import { ChatTabs } from "../components/chat/ChatTabs";
import { BaseContainer } from "../containers/BaseContainer";

const ChatModule = () => {
  return (
    <BaseContainer className="w-full mt-auto" expandedClassName="h-[550px]" collapsedClassName="h-[100px]" expandable>
      <ChatTabs />
      <ChatForm />
    </BaseContainer>
  );
};

export default ChatModule;
