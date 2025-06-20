import { Toaster, TransactionNotification, WorldLoading } from "@/ui/shared";
import { useAutomation } from "./hooks/use-automation";
import "./index.css";
import { World } from "./ui/layouts/world";

function App({ backgroundImage }: { backgroundImage: string }) {
  useAutomation();
  return (
    <>
      <Toaster />
      <TransactionNotification />
      <World backgroundImage={backgroundImage} />
      <WorldLoading />
    </>
  );
}

export default App;
