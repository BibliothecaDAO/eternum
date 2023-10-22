import { useMemo } from "react";

export interface NpcChatMessageProps {
  sender: string;
  message: string;
  //   avatar: string;
}

const NpcChatMessage = (props: NpcChatMessageProps) => {
  const { sender, message } = props;

  const name = useMemo(
    () =>
      sender.includes("stark") ? (
        <div>
          <span className="text-white/50">{sender.split(".")[0]}</span>
          <span className="text-white/30">.{sender.split(".")[1]}</span>
        </div>
      ) : (
        <span className="text-white/30">{sender}</span>
      ),
    [sender],
  );

  return (
    <div className="flex flex-col px-2 mb-3 select-none py-1">
      <div className="flex items-center">
        <div className="flex flex-col w-full">
          <div className="flex text-[10px] justify-between">
            <div className="flex">
              <div className="text-white/30">{sender}</div>
            </div>
          </div>
          <div className="mt-1 text-xs text-white/70">{message}</div>
        </div>
      </div>
    </div>
  );
};

export default NpcChatMessage;
