import Channel, { ChannelProps } from "../../elements/Channel";
import {CreateGuildComponent} from "../CreateGuildComponent";

interface GuildListProps {
  guildList: ChannelProps[];
  createGuild: any;
}

const GuildList = (props: GuildListProps) => {
  const { guildList } = props;

  return (
      //relative flex flex-col h-full overflow-auto p-3
    <div className="relative flex flex-col space-y-2 px-2 mb-2 ">
      <div className="flex p-2 rounded-md border-gray-gold text-xxs text-gray-gold justify-between items-center">
        <div className="text-xs text-white">Guild List</div>
        <CreateGuildComponent />
      </div>
      {/* <Button onClick={() => createRoom('world')}>create</Button> */}
      {guildList.map((guild, index) => (
        <Channel key={index} {...guild} />
      ))}
      {/*{loggedIn && chann && <span className="h-[0px]" ref={bottomRef}></span>}*/}
    </div>
  );
};

export default GuildList;
