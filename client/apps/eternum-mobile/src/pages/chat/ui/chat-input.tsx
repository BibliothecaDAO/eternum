import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onMentionClick: () => void;
}

export function ChatInput({ value, onChange, onSend, onMentionClick }: ChatInputProps) {
  return (
    <div className="p-4 border-t flex gap-2 fixed bottom-16 w-full bg-background">
      <Button variant="outline" size="icon" className="shrink-0" onClick={onMentionClick}>
        @
      </Button>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Type a message..."
        className="flex-1"
      />
      <Button onClick={onSend} className="shrink-0">
        Send
      </Button>
    </div>
  );
}
