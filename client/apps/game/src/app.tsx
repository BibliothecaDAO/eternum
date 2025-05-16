import { useAutomation } from "./hooks/use-automation";
import "./index.css";
import { Toaster } from "./ui/components/toaster";
import { TransactionNotification } from "./ui/components/tx-emit";
import { WorldLoading } from "./ui/components/world-loading";
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
