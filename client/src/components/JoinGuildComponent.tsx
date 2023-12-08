import { useState } from "react";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross-circle.svg";
import { ReactComponent as SuccessIcon } from "../assets/icons/common/success-toast.svg";
import { ReactComponent as FailedIcon } from "../assets/icons/common/close-toast.svg";
import { SecondaryPopup } from "../elements/SecondaryPopup";
import Button from "../elements/Button";
import {chatConfig, useChat} from "../ChatContext";
import TextInput from "../elements/TextInput";
import { BlockChainMap, Client } from "@web3mq/client";
import { ChannelType } from "../elements/Channel";
import { ToastState, ToastStateType } from "../elements/ToastState";

export const JoinGuildComponent = (props: { guild: ChannelType; handleJoinSuccess: any }) => {
  const { guild, handleJoinSuccess } = props;
  const { client } = useChat();
  const [showModal, setShowModal] = useState(false);
  const [toastState, setToastState] = useState<ToastStateType>();
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const { walletType } = chatConfig()

  const submit = async () => {
    setIsLoading(true);
    try {
      const { address } = await Client.register.getAccount(walletType);

      const { requestTime, signContent } = await client?.channel.getRequestJoinGroupSignContent({
        groupid: guild.groupid,
        requestReason: reason,
        didType: BlockChainMap[walletType],
        walletAddress: address,
      });

      const { sign, publicKey } = await Client.register.sign(signContent, address, walletType);

      const res = await client?.channel.requestJoinGroupBySignature({
        didPubkey: publicKey,
        signature: sign,
        signContent,
        requestTimestamp: requestTime,
        groupid: guild.groupid,
        requestReason: reason,
        didType: BlockChainMap[walletType],
        walletAddress: address,
      });
      console.log(res, "res");
      setIsLoading(false);
      setToastState({
        content: "Submit success",
        handler: () => setShowModal(false),
        icon: <SuccessIcon />,
        btnText: "Close",
      });
    } catch (e) {
      console.log(e, "e");
      setIsLoading(false);
      setToastState({
        icon: <FailedIcon />,
        content: e.message || "Failed to create guild, please try again",
        btnText: "Retry",
        handler: () => {
          setToastState(undefined);
          setIsLoading(false);
        },
      });
    }
  };

  const isDisable = !reason || isLoading || !!toastState;

  const handleJoinClick = async () => {
    console.log(guild, "guild");
    if (guild.permissionType === "public") {
      await client.channel.joinGroup(guild.groupid);
      await handleJoinSuccess();
    } else {
      setShowModal(true);
    }
  };

  return (
    <div className="flex items-center text-white">
      <div className=" text-gold flex ml-auto ">
        <Button onClick={handleJoinClick} variant="outline" className="text-xxs !py-1 !px-2">
          Join
        </Button>
      </div>
      {showModal && (
        <SecondaryPopup className="top-1/3 border !border-gold rounded-xl overflow-hidden" name="join-guild">
          <SecondaryPopup.Head
            className={
              "w-full flex items-center h-10 px-4 px-3 justify-between min-w-full border-x-0 border-b !border-gold"
            }
          >
            <div className="mr-0.5 !text-gold">Join a Guild</div>
            <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={() => setShowModal(false)} />
          </SecondaryPopup.Head>
          <SecondaryPopup.Body width="400px" className="!border-gold border-0 relative h-52">
            {toastState && <ToastState {...toastState} />}
            <div className="flex flex-col p-3 gap-3 h-full justify-end">
              <div className="flex flex-col gap-3 h-full justify-start">
                <div className="text-xs text-white">Apply to join Description</div>
                <div>
                  <TextInput
                    placeholder="Please enter your guild name"
                    className={"border !py-1 mr-2 border-gray-gold"}
                    value={reason}
                    onChange={setReason}
                  />
                </div>
              </div>
              <Button
                disabled={isDisable}
                onClick={submit}
                variant="outline"
                className="text-xxs !py-1 !px-2 mr-auto w-full mt-2"
              >
                Submit
              </Button>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </div>
  );
};
