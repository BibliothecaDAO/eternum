import { ErrorBoundary, Toaster, TransactionNotification, WorldLoading } from "@/ui/shared";
import { useAutomation } from "./hooks/use-automation";
import "./index.css";
import { World } from "./ui/layouts/world";

function App({ backgroundImage }: { backgroundImage: string }) {
  useAutomation();
  return (
    <ErrorBoundary>
      <Toaster />
      <TransactionNotification />
      <World backgroundImage={backgroundImage} />
      <WorldLoading />
    </ErrorBoundary>
  );
}

export default App;
