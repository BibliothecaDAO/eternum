import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "../chat-input";
import MessageGroupComponent, { MessageGroup } from "../message-group";

interface Room {
  id: string;
  name?: string;
  userCount?: number;
}

interface Message {
  id: string;
  senderId: string;
  senderUsername?: string;
  message: string;
  timestamp: Date;
  type: "direct" | "room" | "global";
  roomId?: string;
  recipientId?: string;
}

interface RoomsTabProps {
  onMentionClick: () => void;
  rooms: Room[];
  activeRoom: string;
  onRoomSelect: (roomId: string) => void;
  messages: Message[];
  messageGroups: MessageGroup[];
  onSendMessage: (message: string) => void;
  isLoadingMessages: boolean;
  userId: string;
  selectRecipient: (userId: string) => void;
}

export function RoomsTab({
  onMentionClick,
  rooms,
  activeRoom,
  onRoomSelect,
  messages,
  messageGroups,
  onSendMessage,
  isLoadingMessages,
  userId,
  selectRecipient
}: RoomsTabProps) {
  const [inputValue, setInputValue] = useState("");
  const [newRoomId, setNewRoomId] = useState("");
  const [showRoomCreation, setShowRoomCreation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialScrollRef = useRef(true);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ 
        behavior: isInitialScrollRef.current ? "auto" : "smooth" 
      });
      isInitialScrollRef.current = false;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue("");
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomId.trim()) return;
    onRoomSelect(newRoomId);
    setNewRoomId("");
    setShowRoomCreation(false);
  };

  if (!activeRoom) {
    return (
      <div className="flex flex-col h-full p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Available Rooms</h2>
          <Button variant="outline" size="sm" onClick={() => setShowRoomCreation(!showRoomCreation)}>
            {showRoomCreation ? "Cancel" : "Create Room"}
          </Button>
        </div>

        {showRoomCreation && (
          <form onSubmit={handleJoinRoom} className="flex space-x-2">
            <Input
              type="text"
              placeholder="Room name"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Join</Button>
          </form>
        )}

        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {rooms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No rooms available. Create one to get started.
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => onRoomSelect(room.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <span className="text-lg">#</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{room.name || room.id}</span>
                      {room.userCount && (
                        <span className="text-sm text-muted-foreground">{room.userCount} members</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Join
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onRoomSelect("")}>
          Back
        </Button>
        <h2 className="font-medium">
          {rooms.find(r => r.id === activeRoom)?.name || activeRoom}
        </h2>
      </div>

      <ScrollArea className="flex-1 p-4 pb-16">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p>No messages in this room yet</p>
            <p className="text-sm">Be the first to send a message!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messageGroups.map((group, groupIndex) => {
              // Create a unique key based on the group's first message id and index
              const groupKey = `${group.messages[0]?.id || "empty"}-${groupIndex}`;
              return (
                <MessageGroupComponent
                  key={groupKey}
                  group={group}
                  userId={userId}
                  selectRecipient={selectRecipient}
                />
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      <ChatInput 
        value={inputValue} 
        onChange={setInputValue} 
        onSend={handleSend} 
        onMentionClick={onMentionClick} 
      />
    </div>
  );
}
