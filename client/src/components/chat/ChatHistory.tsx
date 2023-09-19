import { useEffect } from "react";
import ChatMessage, { ChatMessageProps } from "../../elements/ChatMessage";
import { useLogin } from "./Login";
import { Client } from "@web3mq/client";
import Button from "../../elements/Button";

interface ChatHistoryProps {
    messages: ChatMessageProps[];
}

const ChatHistory = (props: ChatHistoryProps) => {

    const { login,
        init,
        connect,
        createKeyPairs,
        register } = useLogin();

    return (
        <div className="relative flex flex-col h-full overflow-auto">

            <div className="sticky -m-2 z-10 top-0 left-0 w-full h-20 bg-gradient-to-b from-[#1B1B1B] to-transparent">
                &nbsp;
            </div>
            <Button onClick={() => init()}>init</Button>
            <Button onClick={() => connect()}>connect</Button>
            <Button onClick={() => createKeyPairs()}>createKeyPairs</Button>
            <Button onClick={() => register()}>register</Button>
            <Button onClick={() => login()}>login</Button>
            {/* {props.messages.map((message, index) => (
                <ChatMessage key={index} {...message} />
            ))} */}
        </div>
    )
}

export default ChatHistory