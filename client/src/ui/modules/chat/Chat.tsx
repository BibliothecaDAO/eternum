import { useDojo } from "@/hooks/context/DojoContext";
import { shortenHex } from "@dojoengine/utils";
import { useEffect, useState } from "react";

export const Chat = () => {
  const {
    network: { provider },
  } = useDojo();
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const handleMessageComplete = (data: any) => {
      console.log("Message completed:", data);
      setMessages((prevMessages) => {
        const exists = prevMessages.some((tx) => tx.message_hash === data.message_hash);
        if (!exists) {
          setTimeout(() => {
            setMessages((prevMessages) =>
              prevMessages.filter((tx) => tx.message_hash !== data.message_hash),
            );
          }, 20000);
          return [...prevMessages, data];
        }
        return prevMessages;
      });
    };

    provider.on("messageComplete", handleMessageComplete);

    return () => {
      provider.off("messageComplete", handleMessageComplete);
    };
  }, [provider]);

  return (
    <div style={{ zIndex: 100 }}>
      {messages.map((message, index) => (
        <div className={`${message.execution_status == "REVERTED" ? "text-red/40" : "text-green/70"}`} key={index}>
          Status: {message.execution_status} {shortenHex(message.message_hash)}
        </div>
      ))}
    </div>
  );
};
