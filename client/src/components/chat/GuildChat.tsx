import { ChannelType } from "../../elements/Channel";
import ChatHistory from "./ChatHistory";
import { ReactComponent as ArrowLeft } from "../../assets/icons/common/arrow-left.svg";
import { useChat } from "../../ChatContext";
import { GuildSettingsComponent } from "../GuildSettingsComponent";

interface GuildChatProps {
  guild: ChannelType;
  handleBack: any;
}

const GuildChat = (props: GuildChatProps) => {
  const { guild, handleBack } = props;
  const { userId } = useChat();

  return (
    <>
      <div className="flex h-10 py-3 px-4 rounded-md border-gray-gold text-xxs text-gray-gold justify-between items-center">
        <div className="flex items-center justify-center h-full px-1 cursor-pointer " onClick={handleBack}>
          <ArrowLeft /> <span className="ml-1">Back</span>
        </div>
        <div className="text-xs text-white">{guild.groupName || "Guild Chat"}</div>
        <div className="min-w-1">{guild.creatorId === userId && <GuildSettingsComponent guild={guild} handleSuccess={() => {

        }} />}</div>
      </div>
      <div className="relative flex flex-col space-y-2 px-2 mb-2 overflow-auto">
        {<ChatHistory group={guild.groupid} messages={[]} isJoined={true} />}
      </div>
    </>
  );
};

export default GuildChat;
