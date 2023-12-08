import { createContext, ReactNode, useContext } from "react";
import { useLogin } from "./components/chat/Login";
import { BlockChainType, Client, EnvTypes, WalletType } from "@web3mq/client";

type ChatSetup = {
  login: (didValue: string) => void;
  init: () => void;
  connect: () => void;
  createKeyPairs: (didValue: string) => void;
  register: (didValue: string) => void;
  client: Client | null;
  userId: string;
  loginFlow: () => void;
  loading: boolean;
  loggedIn: boolean;
};

const ChatContext = createContext<ChatSetup | null>(null);

export const chatConfig = (): {
  defaultWorldAddress: string;
  defaultPassword: string;
  env: EnvTypes;
  appKey: string;
  walletType: WalletType;
  chainType: BlockChainType;
} => {
  if (import.meta.env.VITE_DEV === "true") {
    return {
      defaultWorldAddress: "group:ef4557048e0342f1747c31656ac87d1fa6bb8e51",
      defaultPassword: "123456",
      env: "dev",
      appKey: "vAUJTFXbBZRkEDRE",
      walletType: "argentX",
      chainType: "starknet",
    };
  }
  return {
    defaultWorldAddress: "group:aaa83cddb7d563d2847d56247060cec696f3d425",
    defaultPassword: "123456",
    env: "test",
    appKey: "OVEEGLRxtqXcEIJN",
    walletType: "argentX",
    chainType: "starknet",
  };
};

type Props = {
  children: ReactNode;
};

export const ChatProvider = ({ children }: Props) => {
  const currentValue = useContext(ChatContext);
  if (currentValue) throw new Error("DojoProvider can only be used once");

  const { login, init, connect, createKeyPairs, register, client, userId, loginFlow, loading, loggedIn } = useLogin();

  const contextValue: ChatSetup = {
    login, // the provided setup
    init, // create a new account
    connect, // list all accounts
    createKeyPairs, // get an account by id
    register, // select an account by id
    client, // the selected account
    userId,
    loginFlow,
    loading,
    loggedIn,
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const value = useContext(ChatContext);
  if (!value) throw new Error("Must be used within a DojoProvider");
  return value;
};
