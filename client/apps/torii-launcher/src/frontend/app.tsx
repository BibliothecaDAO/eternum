import { AppProvider } from "./context";
import { Launcher } from "./launcher";

export const App = () => {
  return (
    <AppProvider>
      <Launcher />
    </AppProvider>
  );
};
