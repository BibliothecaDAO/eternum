import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { assistant } from "@/ui/components/navigation/Config";
import { useState, useEffect } from "react";
import Button from "@/ui/elements/Button";
import { Textarea } from "@/ui/elements/TextArea";

export const Assistant = () => {
  const { togglePopup } = useUIStore();
  const isOpen = useUIStore((state) => state.isPopupOpen(assistant));
  const [chunks, setChunks] = useState<{ answer: string }[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const newWs = new WebSocket("wss://sensei-production-5c8f.up.railway.app/ws");

    newWs.onopen = () => {
      console.log("WebSocket connection established");
    };

    newWs.onmessage = (event) => {
      console.log("Message from server ", event);
      const data = JSON.parse(event.data);
      if (data.answer === "") {
        console.log("No more data from server");
        // newWs.close();
        setIsLoading(false);
      } else if (data.error) {
        console.error("Error from server: ", data.details);
        setIsLoading(false);
      } else {
        setChunks((prevChunks) => {
          const newChunks: any = [...prevChunks];
          for (const key of Object.keys(data)) {
            const existingChunkIndex = newChunks.findIndex((chunk: any) => chunk.hasOwnProperty(key));
            if (existingChunkIndex !== -1) {
              const existingData = String(newChunks[existingChunkIndex][key]);
              const newData = String(data[key]);

              if (!existingData.endsWith(newData)) {
                newChunks[existingChunkIndex][key] = existingData + newData;
              }
            } else {
              const newChunk: any = {};
              newChunk[key] = String(data[key]);
              newChunks.push(newChunk);
            }
          }
          return newChunks;
        });
      }
    };

    newWs.onerror = (error) => {
      console.error("WebSocket error: ", error);
      setIsLoading(false);
    };

    newWs.onclose = () => {
      console.log("WebSocket connection closed");
    };

    setWs(newWs);

    return () => {
      newWs.close();
    };
  }, []);

  const callChunks = (text: string) => {
    setMessage("");
    setChunks([]);
    if (ws) {
      setIsLoading(true);
      ws.send(JSON.stringify({ text: text }));
    }
  };
  console.log("chunks", chunks);
  return (
    <OSWindow width="600px" onClick={() => togglePopup(assistant)} show={isOpen} title={assistant}>
      <div className="p-5 ">
        <div className="flex ">
          <img src="./images/buildings/thumb/squire.png" className="rounded-full w-12 h-12 mr-4" alt="" />
          <div>
            <h5>Squire</h5>
            {chunks.reduce((acc, chunk) => {
              const cleanAnswer = chunk.answer ? chunk.answer.trim() : "";

              return acc + (acc && cleanAnswer.match(/^\w/) ? " " : "") + cleanAnswer;
            }, "")}
            {isLoading && <div className="animate-pulse">Thinking...</div>}
          </div>
        </div>

        <Textarea
          className="border my-4"
          placeholder="Write something..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              callChunks(message);
              event.preventDefault();
            }
          }}
        />
        <Button className="w-full" onClick={() => callChunks(message)} variant="primary" disabled={isLoading}>
          {isLoading ? "Loading..." : "Ask"}
        </Button>
      </div>
    </OSWindow>
  );
};
