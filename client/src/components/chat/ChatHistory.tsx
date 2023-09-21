import { useEffect, useRef, useState } from "react";
import ChatMessage, { ChatMessageProps } from "../../elements/ChatMessage";
import Button from "../../elements/Button";
import { useChat } from "../../ChatContext";

interface ChatHistoryProps {
    messages: ChatMessageProps[];
}

const ChatHistory = (props: ChatHistoryProps) => {

    const [messageList, setMessageList] = useState<ChatMessageProps[]>([]);

    // this should be moved
    const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messageList]);

    const {
        loginFlow,
        client,
        loading,
        loggedIn
    } = useChat();

    // Temp world chat
    const group = 'group:059a21162f236d0057bdb80b5a0ed263a417882b'

    // const createRoom = async (groupName: string) => {
    //     client?.channel.createRoom({ groupName })
    // }

    const setGroup = async (group: string) => {
        setLoadingMessages(true)

        const { channelList } = client?.channel as any;

        console.log('channelList', channelList)
        const channel = channelList?.find((channel: any) => channel.chatid === group)

        await client?.channel.setActiveChannel(channel);
        await client?.channel.queryChannels({
            page: 1,
            size: 20,
        });
        await client?.message.getMessageList({
            page: 1,
            size: 20,
        });

        setLoadingMessages(false)
    }

    const handleEvent = (event: { type: any }) => {

        const list = client?.message.messageList as any

        if (event.type === 'channel.updated') {
            console.log('message.getList', list)
            setMessageList(list.map((message: any) => ({
                sender: 'anon',
                message: message.content,
                avatar: "/images/avatars/1.png",
                timestamp: message.date,
            })) || [])
        }

        if (event.type == 'message.getList') {
            console.log('message.getList', list)
            setMessageList(list.map((message: any) => ({
                sender: 'anon',
                message: message.content,
                avatar: "/images/avatars/1.png",
                timestamp: message.date,
            })) || [])
        }
    };

    useEffect(() => {
        if (!client) return
        client?.channel.queryChannels({ page: 1, size: 20 });
        client?.on('channel.activeChange', handleEvent);
        client?.on('channel.created', handleEvent);
        client?.on('message.delivered', handleEvent);
        client?.on('channel.getList', handleEvent);
        client?.on('message.getList', handleEvent);
        client?.on('channel.updated', handleEvent);
    }, [client]);

    const isLoading = loading || loadingMessages

    return (
        <div className="relative flex flex-col h-full overflow-auto">
            <div className="sticky -m-2 z-10 top-0 left-0 w-full h-20 bg-gradient-to-b from-[#1B1B1B] to-transparent">
                &nbsp;
            </div>

            {isLoading && (
                <div className="absolute  h-full bg-black w-full text-white text-center flex justify-center">
                    <div className="self-center">
                        <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
                    </div>
                </div>
            )}


            {!loggedIn && (
                <div className="my-2 w-full p-2 flex">
                    <Button className="mx-auto" variant="outline" onClick={() => loginFlow()}>Connect</Button>
                </div>
            )}
            {loggedIn && !messageList.length && (
                <div className="my-2 w-full p-2 mx-auto flex">
                    <Button className="mx-auto" variant="outline" onClick={() => setGroup(group)}>World Chat</Button>
                </div>
            )}

            {messageList.map((message, index) => (
                <ChatMessage key={index} {...message} />
            ))}

            {loggedIn && messageList && <span className="h-[0px]" ref={bottomRef}></span>}

        </div>
    )
}

export default ChatHistory