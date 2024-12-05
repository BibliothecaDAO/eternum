import "./index.css";
import { Toaster } from "./ui/components/Toaster";
import { TransactionNotification } from "./ui/components/TxEmit";
import { World } from "./ui/layouts/World";

function App({ backgroundImage }: { backgroundImage: string }) {
  return (
    <>
      <Toaster />
      <TransactionNotification />
      <World backgroundImage={backgroundImage} />
    </>
  );
}

export default App;
