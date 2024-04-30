import { ChatProvider } from "@/hooks/context/ChatContext";
import ChatForm from "@/ui/components/chat/ChatForm";
import { ChatTabs } from "@/ui/components/chat/ChatTabs";
import { BaseContainer } from "@/ui/containers/BaseContainer";

const ChatModule = () => {
  return (
    <BaseContainer className="w-full mt-auto" expandedClassName="h-[550px]" collapsedClassName="h-[100px]" expandable>
      <ChatProvider>
        <ChatTabs />
        <ChatForm />
      </ChatProvider>
    </BaseContainer>
  );
};

export default ChatModule;
