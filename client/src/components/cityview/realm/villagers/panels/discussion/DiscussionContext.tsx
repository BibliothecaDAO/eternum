import { ReactNode, createContext, useContext, useState } from "react";

interface DiscussionContextType {
  selectedDiscussion: number | null;
  setSelectedDiscussion: (newIndex: number | null) => void;
  lastMessageDisplayedIndex: number;
  setLastMessageDisplayedIndex: (newIndex: number) => void;
}

interface Props extends DiscussionContextType {
  children: ReactNode;
}

const DiscussionContext = createContext<DiscussionContextType | null>(null);

export const DiscussionProvider = ({
  children,
  selectedDiscussion,
  setSelectedDiscussion,
  lastMessageDisplayedIndex,
  setLastMessageDisplayedIndex,
}: Props) => {
  const currentValue = useContext(DiscussionContext);
  if (currentValue) throw new Error("DiscussionProvider can only be used once");
  return (
    <DiscussionContext.Provider
      value={{
        selectedDiscussion: selectedDiscussion,
        setSelectedDiscussion: setSelectedDiscussion,
        lastMessageDisplayedIndex: lastMessageDisplayedIndex,
        setLastMessageDisplayedIndex: setLastMessageDisplayedIndex,
      }}
    >
      {children}
    </DiscussionContext.Provider>
  );
};

export const useDiscussion = () => {
  const contextValue = useContext(DiscussionContext);
  if (!contextValue) throw new Error("The `useDiscussion` hook must be used within a `useDiscussion` provider");

  return {
    selectedDiscussion: contextValue.selectedDiscussion,
    setSelectedDiscussion: contextValue.setSelectedDiscussion,
    lastMessageDisplayedIndex: contextValue.lastMessageDisplayedIndex,
    setLastMessageDisplayedIndex: contextValue.setLastMessageDisplayedIndex,
  };
};
