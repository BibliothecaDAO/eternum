import ChatForm from "../components/chat/ChatForm"
import ChatHistory from "../components/chat/ChatHistory"
import { ChatTabs } from "../components/chat/ChatTabs";
import { ChatMessageProps } from "../elements/ChatMessage";

const dummyMessages: ChatMessageProps[] = [
    {
        sender: "loaf.stark",
        message: "GM, Adventurers",
        avatar: "/images/avatars/1.png",
        timestamp: "10:00",
    },
    {
        sender: "jane.stark",
        message: "Hi everyone!",
        avatar: "/images/avatars/2.png",
        timestamp: "10:05",
    },
    {
        sender: "bob.stark",
        message: "What's the plan?",
        avatar: "/images/avatars/3.png",
        timestamp: "10:10",
    },
    {
        sender: "sally.stark",
        message: "Let's go to the forest!",
        avatar: "/images/avatars/4.png",
        timestamp: "10:15",
    },
    {
        sender: "john.stark",
        message: "Sounds like a plan!",
        avatar: "/images/avatars/5.png",
        timestamp: "10:20",
    },
    {
        sender: "loaf.stark",
        message: "Let's get going!",
        avatar: "/images/avatars/1.png",
        timestamp: "10:25",
    },
    {
        sender: "jane.stark",
        message: "Wait for me!",
        avatar: "/images/avatars/2.png",
        timestamp: "10:30",
    },
    {
        sender: "bob.stark",
        message: "I'm ready!",
        avatar: "/images/avatars/3.png",
        timestamp: "10:35",
    },
    {
        sender: "sally.stark",
        message: "Me too!",
        avatar: "/images/avatars/4.png",
        timestamp: "10:40",
    },
    {
        sender: "john.stark",
        message: "Let's go!",
        avatar: "/images/avatars/5.png",
        timestamp: "10:45",
    },
    {
        sender: "loaf.stark",
        message: "Onward!",
        avatar: "/images/avatars/1.png",
        timestamp: "10:50",
    },
    {
        sender: "jane.stark",
        message: "Be careful out there!",
        avatar: "/images/avatars/2.png",
        timestamp: "10:55",
    },
    {
        sender: "bob.stark",
        message: "Don't worry, I got this!",
        avatar: "/images/avatars/3.png",
        timestamp: "11:00",
    },
    {
        sender: "sally.stark",
        message: "Watch out for monsters!",
        avatar: "/images/avatars/4.png",
        timestamp: "11:05",
    },
    {
        sender: "john.stark",
        message: "We'll be fine!",
        avatar: "/images/avatars/5.png",
        timestamp: "11:10",
    },
];

const ChatModule = () => {
    return (<>
        <ChatTabs />
        <ChatHistory messages={dummyMessages} />
        <ChatForm />
    </>)
}

export default ChatModule