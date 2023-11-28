import React, { ReactNode, useMemo, useState } from "react";
import { ReactComponent as FightLost } from "../assets/icons/common/fight-lost.svg";
import { ReactComponent as FightWaiting } from "../assets/icons/common/fight-waiting.svg";
import { ReactComponent as FightWin } from "../assets/icons/common/fight-win.svg";
import { ReactComponent as FightReject } from "../assets/icons/common/fight-reject.svg";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross-circle.svg";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import { Headline } from "../elements/Headline";
import Button from "../elements/Button";
import { useDojo } from "../DojoContext";
import { NumberInput } from "../elements/NumberInput";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useGetRealms } from "../hooks/helpers/useRealm";
import { useChat } from "../ChatContext";
import TextInput from "../elements/TextInput";
import clsx from "clsx";
import {CreateRoomParams} from "@web3mq/client";

type GuildType = "public" | "request";

export const CreateGuildComponent = () => {
  const { client } = useChat();
  const [showModal, setShowModal] = useState(false);
  const [toastState, setToastState] = useState<any>();
  const [guildType, setGuildType] = useState<GuildType>();
  const [guildName, setGuildName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    console.log(client, 'client')
    console.log(client.channel)
    setIsLoading(true)
    const params: CreateRoomParams = {
      groupName: guildName,
      permissions: {
        'group:join': {
          type: 'enum',
          value: guildType === 'request'
              ? 'creator_invite_friends'
              : 'public',
        },
      },
    }
    console.log(params, 'params')
    // client.channel.createRoom(params)
    // console.log("submit create guild");
    // console.log(client, "client");
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

  const isDisable = !guildName || isLoading || toastState;

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
        <SecondaryPopup className="top-1/3" name="settings">
          <SecondaryPopup.Head>
            <div className="flex items-center">
              <div className="mr-0.5">Create a Guild</div>
              <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={() => setShowModal(false)} />
            </div>
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px">
            {toastState && <div className="bg-red w-full h-full relative">{toastState}</div>}

            <div className="flex flex-col p-3 gap-3">
              <div className="text-xs text-white">Guild Name:</div>
              <TextInput
                placeholder="Please enter your guild name"
                className={"border !py-1 mr-2 border-gray-gold"}
                value={guildName}
                onChange={setGuildName}
              />
              {/*<TextInput*/}
              {/*    placeholder="Attach Name to Address"*/}
              {/*    className={"border !py-1 !my-1 mr-2"}*/}
              {/*    maxLength={12}*/}
              {/*    value={inputName}*/}
              {/*    onChange={setInputName}*/}
              {/*></TextInput>*/}
              <div className="w-full h-2 border-b border-gray-gold mt-px mb-1"></div>
              <div className="text-xs text-white">Guild Permission:</div>
              <div className=" flex justify-center items-center gap-3">
                {Btns.map((item, index) => (
                  <Button
                    variant="outline"
                    key={index}
                    className={clsx("w-1/2 text-xxs !py-1 !px-2", !item.isSelected ? "!text-gray-gold border-gray-gold" : '')}
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
                Create
              </Button>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
  );
};
