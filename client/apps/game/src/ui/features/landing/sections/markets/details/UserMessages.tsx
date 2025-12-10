import { useAccount } from "@starknet-react/core";
import { useState } from "react";

import { useMarketUserMessages } from "@/pm/hooks/social/useMarketUserMessages";
import { HStack, VStack } from "@pm/ui";

import { MaybeController } from "../MaybeController";

const Input = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
}) => (
  <input
    className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-gold/60"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    placeholder={placeholder}
  />
);

const AvatarImage = ({ address, className }: { address: string; className?: string }) => {
  const initial = address ? address.slice(2, 4).toUpperCase() : "??";
  return (
    <div
      className={`flex h-[32px] w-[32px] items-center justify-center rounded-full bg-white/10 text-xs text-white ${className ?? ""}`}
    >
      {initial}
    </div>
  );
};

const Button = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    className="rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

const TimeAgo = ({ date, className }: { date: Date; className?: string }) => {
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  const label = minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
  return <span className={className}>{label}</span>;
};

export const UserMessages = ({ marketId }: { marketId: string }) => {
  const [message, setMessage] = useState("");
  const { account } = useAccount();
  const { messages, sendMessage } = useMarketUserMessages(marketId);

  const onSend = async () => {
    if (!account || !message.trim()) return;
    await sendMessage(account, message.trim());
    setMessage("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === "Enter") onSend();
  };

  return (
    <VStack className="w-full items-start gap-6">
      <HStack className="w-full items-center gap-3">
        <AvatarImage address={account?.address || "0x0"} className="bg-primary" />
        <div className="flex w-full items-center gap-2">
          <Input
            placeholder="Add a comment"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <Button onClick={onSend} disabled={!account}>
            Send
          </Button>
        </div>
      </HStack>

      <VStack className="w-full items-start gap-6">
        {messages.length === 0 ? (
          <div className="text-sm text-gold/70">No comments yet.</div>
        ) : (
          messages.map((msg, idx) => (
            <HStack className="items-start gap-3" key={`${msg.identity}-${msg.timestamp}-${idx}`}>
              <AvatarImage address={msg.identity} />
              <VStack className="items-start gap-1">
                <HStack className="text-xs text-white/60">
                  <MaybeController address={msg.identity} />
                  <TimeAgo date={new Date(Number(msg.timestamp))} className="ml-2" />
                </HStack>
                <div className="break-all text-sm text-white/80">{msg.message}</div>
              </VStack>
            </HStack>
          ))
        )}
      </VStack>
    </VStack>
  );
};
