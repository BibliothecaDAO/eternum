import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface ChatInputProps {
  message: string;
  setMessage: (value: string) => void;
  onSend: () => void;
}

export const ChatInput = ({ message, setMessage, onSend }: ChatInputProps) => {
  return (
    <div className="border-t p-4 flex gap-2">
      <Input
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
      />
      <Button onClick={onSend}>Send</Button>
    </div>
  );
};
