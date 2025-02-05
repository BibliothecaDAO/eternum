import App from "@/app/app.tsx";
import "@/app/index.css";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
