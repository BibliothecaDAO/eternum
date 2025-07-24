import { ErrorBoundary, Toaster, TransactionNotification, WorldLoading } from "@/ui/shared";
import "./index.css";
import { World } from "./ui/layouts/world";

function App({ backgroundImage }: { backgroundImage: string }) {
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
