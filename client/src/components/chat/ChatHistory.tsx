import ChatMessage, { ChatMessageProps } from "../../elements/ChatMessage";

interface ChatHistoryProps {
    messages: ChatMessageProps[];
}

const ChatHistory = (props: ChatHistoryProps) => {

    return (
        <div className="relative flex flex-col h-full overflow-auto">
            <div className="sticky -m-2 z-10 top-0 left-0 w-full h-20 bg-gradient-to-b from-[#1B1B1B] to-transparent">
                &nbsp;
            </div>
            {props.messages.map((message, index) => (
                <ChatMessage key={index} {...message} />
            ))}
        </div>
    )
}

export default ChatHistory