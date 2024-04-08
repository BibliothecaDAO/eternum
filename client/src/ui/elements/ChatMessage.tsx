import Avatar from "./Avatar";
// import { OrderIcon } from "./OrderIcon";
// import { useDojo } from "../DojoContext";

export interface ChatMessageProps {
  sender: string;
  message: string;
  avatar: string;
  timestamp: string;
}

const ChatMessage = (props: ChatMessageProps) => {
  const { sender, message, avatar, timestamp } = props;

  // const name = useMemo(() =>
  // (sender.includes('stark') ?
  //     <div>
  //         <span className="text-white/50">{sender.split('.')[0]}</span>
  //         <span className="text-white/30">.{sender.split('.')[1]}</span>
  //     </div> : <span className="text-white/30">{sender}</span>)
  //     , [sender]);

  return (
    <div className="flex flex-col px-2 mb-3 select-none py-1">
      <div className="flex items-center">
        <Avatar src={avatar} size="lg" className="mr-3" />
        <div className="flex flex-col w-full">
          <div className="flex text-[10px] justify-between">
            <div className="flex">
              <div className="text-white/30">{sender}</div>
              {/* <OrderIcon order="power" size="xs" className="scale-75" /> */}
            </div>
            <div className="mr-3 text-[8px] text-white/30">{timestamp}</div>
          </div>
          <div className="mt-1 text-xs text-white/70">{message}</div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
