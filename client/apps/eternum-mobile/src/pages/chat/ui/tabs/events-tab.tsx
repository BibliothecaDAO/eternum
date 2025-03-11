import { ScrollArea } from "@/shared/ui/scroll-area";

interface Event {
  id: string;
  sender: string;
  timestamp: string;
  message: string;
}

const dummyEvents: Event[] = [
  {
    id: "1",
    sender: "System",
    timestamp: "09:55 AM",
    message: "Guild War has started!",
  },
  {
    id: "2",
    sender: "System",
    timestamp: "10:00 AM",
    message: "Your army has arrived at the destination.",
  },
  {
    id: "3",
    sender: "System",
    timestamp: "10:05 AM",
    message: "Resource production increased by 10%",
  },
];

export function EventsTab() {
  return (
    <ScrollArea className="h-full p-4">
      <div className="space-y-4">
        {dummyEvents.map((event) => (
          <div key={event.id} className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-orange-500">{event.sender}</span>
              <span className="text-sm text-muted-foreground">{event.timestamp}</span>
            </div>
            <p className="text-sm">{event.message}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
