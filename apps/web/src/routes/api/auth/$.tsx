import { handleApiCors } from "@/lib/api-cors";
import { auth } from "@/utils/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      ANY: ({ request }) => {
        return handleApiCors(request, () => auth.handler(request));
      },
    },
  },
});
