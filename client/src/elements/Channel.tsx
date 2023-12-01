import { GroupPermissionValueType } from "@web3mq/client";
import Button from "./Button";
import { JoinGuildComponent } from "../components/JoinGuildComponent";
// import { OrderIcon } from "./OrderIcon";
// import { useDojo } from "../DojoContext";

export interface ChannelType {
  groupid: string;
  groupName: string;
  avatar?: string;
  isJoined?: boolean;
  memberCount: number;
  creator: string;
  creatorId: string;
  permissionType: GroupPermissionValueType;
}

const Channel = (props: { channel: ChannelType; handleChat: any }) => {
  const { channel, handleChat } = props;
  const { groupName, isJoined = false, memberCount, creator } = channel;

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center">
        <div className="flex flex-col w-full">
          <div className="flex text-[10px] justify-between">
            <div className="flex">
              <div className="text-white/30">{groupName}</div>
              <div>owned by {creator}</div>
              {/* <OrderIcon order="power" size="xs" className="scale-75" /> */}
            </div>
            <div className="mr-3 text-[8px] text-white/30">
              {isJoined ? (
                <Button
                  onClick={() => {
                    handleChat(channel);
                  }}
                  variant="outline"
                  className="p-1 !h-4 text-xxs !rounded-md"
                >
                  Chat
                </Button>
              ) : (
                <JoinGuildComponent handleJoinSuccess={() => {
                  handleChat(channel)
                }} guild={channel} />
              )}
            </div>
          </div>
          <div className="mt-1 text-xs text-white/70">member: {memberCount}</div>
        </div>
      </div>
    </div>
  );
};

export default Channel;
