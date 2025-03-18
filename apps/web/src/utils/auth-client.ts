import { siwsClientPlugin } from "@/utils/auth/auth-siws-client";
import { createAuthClient } from "better-auth/react";

// Use type assertion to tell TypeScript this is safe
export const authClient = createAuthClient({
  baseURL: "http://localhost:3000", //import.meta.env.VITE_BASE_URL,
  plugins: [siwsClientPlugin()],
});
