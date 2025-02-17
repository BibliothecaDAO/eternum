// app/services/session.server.ts
//Zimport type { User } from "@prisma/client";
import { useSession } from "@tanstack/start/server";

type SessionUser = {
  address: string;
};

export function useAppSession() {
  return useSession<SessionUser>({
    password: "ChangeThisBeforeShippingToProdOrYouWillBeFired",
  });
}
