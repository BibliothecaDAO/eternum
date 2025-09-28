import { ErrorBoundary, TransactionNotification, WorldLoading } from "@/ui/shared";
import "./index.css";
import { StoryEventToastBridge, StoryEventToastProvider } from "./ui/features/story-events";
import { World } from "./ui/layouts/world";

function App({ backgroundImage }: { backgroundImage: string }) {
  return (
    <ErrorBoundary>
      <StoryEventToastProvider>
        <StoryEventToastBridge />
        {/* <Toaster /> */}
        <TransactionNotification />
        <World backgroundImage={backgroundImage} />
        <WorldLoading />
      </StoryEventToastProvider>
    </ErrorBoundary>
  );
}

export default App;
