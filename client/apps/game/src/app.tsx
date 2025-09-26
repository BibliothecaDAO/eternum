import { ErrorBoundary, Toaster, TransactionNotification, WorldLoading } from "@/ui/shared";
import "./index.css";
import { World } from "./ui/layouts/world";
import { StoryEventToastBridge, StoryEventToastProvider } from "./ui/features/story-events";

function App({ backgroundImage }: { backgroundImage: string }) {
  return (
    <ErrorBoundary>
      <StoryEventToastProvider>
        <StoryEventToastBridge />
        <Toaster />
        <TransactionNotification />
        <World backgroundImage={backgroundImage} />
        <WorldLoading />
      </StoryEventToastProvider>
    </ErrorBoundary>
  );
}

export default App;
