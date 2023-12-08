import { useMemo, useState } from "react";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross-circle.svg";
import { ReactComponent as FailedIcon } from "../assets/icons/common/close-toast.svg";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import Button from "../elements/Button";
import { useChat } from "../ChatContext";
import TextInput from "../elements/TextInput";
import clsx from "clsx";
import { CreateRoomParams } from "@web3mq/client";
import { ToastStateType, ToastState } from "../elements/ToastState";
import { useDojo } from "../DojoContext";

type GuildType = "public" | "request";

export const CreateGuildComponent = () => {
  const {
    setup: {
      systemCalls: { create_guild },
    },
    account: { account },
  } = useDojo();
  const { client } = useChat();
  const [showModal, setShowModal] = useState(false);
  const [toastState, setToastState] = useState<ToastStateType>();
  const [guildType, setGuildType] = useState<GuildType>("public");
  const [guildName, setGuildName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    setIsLoading(true);
    const params: CreateRoomParams = {
      groupName: guildName,
      permissions: {
        "group:join": {
          type: "enum",
          value: guildType === "request" ? "creator_invite_friends" : "public",
        },
      },
    };
    try {
      const res = await client.channel.createRoom(params);
      const guild_id = res.groupid.replace('group:', '0x')
      await create_guild({
        signer: account,
        guild_id
      });
      setIsLoading(false);
      setShowModal(false);
    } catch (e) {
      console.log(e, "e");
      setIsLoading(false);
      setToastState({
        btnText: "Retry",
        content: e.message || "Failed to create guild",
        icon: <FailedIcon />,
        handler: () => {
          setToastState(undefined);
          setIsLoading(false);
        },
      });
    }
  };

  const Btns: {
    label: string;
    type: GuildType;
    isSelected: boolean;
  }[] = useMemo(() => {
    return [
      {
        label: "Public",
        type: "public",
        isSelected: guildType === "public",
      },
      {
        label: "Verification required",
        type: "request",
        isSelected: guildType === "request",
      },
    ];
  }, [guildType]);

  const isDisable = !guildName || isLoading || !!toastState;

  return (
    <div className="flex items-center text-white">
      <div className=" text-gold flex ml-auto ">
        <Button
          onClick={() => {
            setShowModal(true);
          }}
          variant="outline"
          className="text-xxs !py-1 !px-2"
        >
          + Create a Guild
        </Button>
      </div>
      {showModal && (
        <SecondaryPopup className="top-1/3 border !border-gold rounded-xl overflow-hidden" name="guild-create">
          <SecondaryPopup.Head
            className={
              "w-full flex items-center h-10 px-4 px-3 justify-between min-w-full border-x-0 border-b !border-gold"
            }
          >
            <div className="mr-0.5 !text-gold">Create a Guild</div>
            <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={() => setShowModal(false)} />
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px" className="!border-gold border-0 relative">
            {toastState && <ToastState {...toastState} />}
            <div className="flex flex-col p-3 gap-3">
              <div className="text-xs text-white">Guild Name:</div>
              <TextInput
                placeholder="Please enter your guild name"
                className={"border !py-1 mr-2 border-gray-gold"}
                value={guildName}
                onChange={setGuildName}
              />
              <div className="w-full h-2 border-b border-gray-gold mt-px mb-1"></div>
              <div className="text-xs text-white">Guild Permission:</div>
              <div className=" flex justify-center items-center gap-3">
                {Btns.map((item, index) => (
                  <Button
                    variant="outline"
                    key={index}
                    className={clsx(
                      "w-1/2 text-xxs !py-1 !px-2",
                      !item.isSelected ? "!text-gray-gold border-gray-gold" : "",
                    )}
                    onClick={() => setGuildType(item.type)}
                  >
                    {item.label}
                  </Button>
                ))}

                {/*<Button*/}
                {/*    variant="outline"  className="w-1/2 text-xxs !py-1 !px-2" onClick={() => setGuildType("request")}>Verification required</Button>*/}
              </div>
              <Button
                disabled={isDisable}
                onClick={submit}
                variant="outline"
                className="text-xxs !py-1 !px-2 mr-auto w-full mt-2"
              >
                {isLoading ? "Creating..." : "Create"}
              </Button>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
  );
};
