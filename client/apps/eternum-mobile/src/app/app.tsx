import { useAuthSync } from "@/shared/hooks/use-auth";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./config/router";

function App() {
  useAuthSync();
  const showBgImage = localStorage.getItem("showBackgroundImage") === "true";
  const randomCover = String(Math.floor(Math.random() * 7 + 1)).padStart(2, "0");
  const bgImage = `/images/covers/${randomCover}.png`;

  return (
    <div className={`min-h-screen text-foreground relative ${!showBgImage ? "bg-background" : ""}`}>
      {showBgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50 -z-10"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
