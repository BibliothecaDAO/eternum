import { useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";
import { ChatMessageProps } from "../../elements/ChatMessage";
import ChatHistory from "./ChatHistory";
// import { ChatAccount } from "./ChatAccount";
// import { ReactComponent as RedDot } from "../../assets/icons/common/red-dot.svg";

type ChatTabsProps = {};

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

export const ChatTabs = ({ }: ChatTabsProps) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        label: (
          <div className="flex flex-col items-center">
            <div>World Chat</div>
          </div>
        ),
        component: <ChatHistory messages={dummyMessages} />,
      },
      // {
      //   label: (
      //     <div className="flex flex-col items-center">
      //       <div>Account</div>
      //     </div>
      //   ),
      //   component: <ChatAccount />,
      // },
      // {
      //   label: (
      //     <div className="flex flex-col items-center" title="Not implemented">
      //       <div>PM</div>
      //       <RedDot className="absolute right-0 top-1" />
      //     </div>
      //   ),
      //   component: <div></div>,
      // },
    ],
    [selectedTab],
  );

  return (
    <Tabs
      selectedIndex={selectedTab}
      onChange={(index: any) => setSelectedTab(index as number)}
      variant="primary"
      className="flex-1 -mx-2 overflow-hidden relative z-0"
    >
      <Tabs.List className="!justify-start relative !pointer-events-autopx-0">
        {tabs.map((tab, index) => (
          <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panels className="overflow-hidden">
        {tabs.map((tab, index) => (
          <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
        ))}
        <div className="border-t -mx-2 border-gray-gold bg-gradient-to-b from-[#151515] to-transparent absolute w-full h-16 top-[39px] left-0" />
      </Tabs.Panels>
    </Tabs>
  );
};
