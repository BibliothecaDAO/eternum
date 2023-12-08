import { NotificationType } from "./useNotifications";
import {BlockChainMap, Client} from "@web3mq/client";
import { useCallback } from "react";
import Button from "../../elements/Button";
import {chatConfig, useChat} from "../../ChatContext";

export const useChatNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const { keys } = notification;
  const { client} = useChat();
  const { walletType } = chatConfig()
  const metadata = keys[3];

  const approveGuildRequest = async (params: {
    reason: string;
    groupid: string;
    requestUserid: string;
    isApprove: boolean;
  }) => {
    const { address } = await Client.register.getAccount(walletType);
    const { reason, groupid, requestUserid, isApprove } = params;
    const { requestTime, signContent } = await client?.channel.getApproveJoinGroupRequestSignContent({
      groupid,
      isApprove,
      didType: BlockChainMap[walletType],
      walletAddress: address,
      requestUserid,
      reason,
    });

    const { sign, publicKey } = await Client.register.sign(signContent, address, walletType);
    await client?.channel.approveJoinGroupRequestBySignature({
      didPubkey: publicKey,
      signature: sign,
      signContent,
      requestTimestamp: requestTime,
      groupid,
      requestReason: reason,
      didType: BlockChainMap[walletType],
      walletAddress: address,
      requestUserid: requestUserid,
      isApprove,
    });
  };

  const handleApprove = async (isApprove: boolean, onClose: any) => {
    const data = JSON.parse(metadata);
    try {
      await approveGuildRequest({
        isApprove,
        reason: keys[2],
        requestUserid: data.metadata.userid,
        groupid: data.metadata.groupid,
      });
      await client.notify.changeNotificationStatus([data.messageId], "read");
      onClose()
    } catch (e) {
      console.log(e);
    }
  };

  const Btns = useCallback(
    (props: { onClose: any }) => {
      const { onClose } = props;
      const data = JSON.parse(metadata);
      if (data.type === "system.group.join_request") {
        return (
          <div className="flex justify-between gap-3 w-full">
            <Button onClick={() => handleApprove(false, onClose)} variant="outline" className="w-1/2 h-8 p-2">
              Reject
            </Button>
            <Button onClick={() => handleApprove(true, onClose)} variant="outline" className="w-1/2 h-8 p-2">
              Approve
            </Button>
          </div>
        );
      }
      return null;
    },
    [metadata],
  );

  return {
    type: "success",
    time: "",
    title: <div className="flex items-center">{keys[0]}</div>,
    content: (onClose: any) => (
      <div className="mt-2 items-center italic flex flex-col gap-3">
        <div className="flex w-full items-start justify-between gap-2 flex-col">
          <h1 className="text-white">{keys[1]}</h1>
          <h2>{keys[2]}</h2>
        </div>
        <Btns onClose={onClose} />
      </div>
    ),
  };
};
