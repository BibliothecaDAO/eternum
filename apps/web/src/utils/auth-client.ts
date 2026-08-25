import { siwsClientPlugin } from "@/utils/auth/auth-siws-client";
import { createAuthClient } from "better-auth/react";

// Use type assertion to tell TypeScript this is safe
export const authClient = createAuthClient({
  baseURL:
    (import.meta.env.VITE_BASE_URL as string | undefined) ??
    "http://localhost:3000",
  plugins: [siwsClientPlugin()],
});
