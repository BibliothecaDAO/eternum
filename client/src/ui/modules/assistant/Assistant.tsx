import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { assistant } from "@/ui/components/navigation/Config";
import { useState, useEffect } from "react";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";

export const Assistant = () => {
  const { togglePopup } = useUIStore();
  const isOpen = useUIStore((state) => state.isPopupOpen(assistant));
  const [chunks, setChunks] = useState<{ answer: string }[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const newWs = new WebSocket("ws://localhost:3000");

    newWs.onopen = () => {
      console.log("WebSocket connection established");
    };

    newWs.onmessage = (event) => {
      console.log("Message from server ", event.data);
      const data = JSON.parse(event.data);
      if (data.output === "END_OF_STREAM") {
        console.log("No more data from server");
        newWs.close();
        setIsLoading(false); // Stop loading when no more data is expected
      } else if (data.error) {
        console.error("Error from server: ", data.details);
        setIsLoading(false); // Stop loading on error
      } else {
        setChunks((prevChunks) => {
          const newChunks = [...prevChunks];
          for (const key of Object.keys(data)) {
            const existingChunkIndex = newChunks.findIndex((chunk) => chunk.hasOwnProperty(key));
            if (existingChunkIndex !== -1) {
              // Ensure the existing data is treated as a string
              const existingData = String(newChunks[existingChunkIndex][key]);
              const newData = String(data[key]);
              // Check if the new data is already appended
              if (!existingData.endsWith(newData)) {
                newChunks[existingChunkIndex][key] = existingData + newData;
              }
            } else {
              // Add new chunk if key does not exist, ensuring data is treated as a string
              const newChunk = {};
              newChunk[key] = String(data[key]);
              newChunks.push(newChunk);
            }
          }
          return newChunks;
        });
        setIsLoading(false); // Stop loading after processing the data
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
    if (ws) {
      setIsLoading(true);
      ws.send(JSON.stringify({ text: text }));
    }
  };
  console.log(chunks);
  return (
    <OSWindow width="600px" onClick={() => togglePopup(assistant)} show={isOpen} title={assistant}>
      <div className="p-5">
        {chunks.reduce((acc, chunk) => {
          const cleanAnswer = chunk.answer ? chunk.answer.trim() : "";

          return acc + (acc && cleanAnswer.match(/^\w/) ? " " : "") + cleanAnswer;
        }, "")}
        <TextInput
          className="border my-4"
          placeholder="Write something..."
          value={message}
          onChange={setMessage}
          onKeyPress={(event) => {
            if (event.key === "Enter") {
              callChunks(message);
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
