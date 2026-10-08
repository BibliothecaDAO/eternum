import type { Session } from "@realms-world/identity";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { fetchLauncherStatus } from "@/ui/features/factory-v2/api/factory-worker";

import { PageFrame } from "./frame/page-frame";
import { useDirectory } from "./herald";
import { Loading } from "./loading";
import { NothingHere } from "./not-found";
import { ShardUrlForm } from "./shard-url-form";
import { APP_STATE_WORDS } from "./words";

const FactoryV2Content = lazy(() =>
  import("@/ui/features/factory-v2/components/factory-v2-content").then((module) => ({
    default: module.FactoryV2Content,
  })),
);

/**
 * The operators' page (spec 15): scheduling seasons, Blitz windows and Eternum games, following launches, and opening
 * another shard by its URL. Only a launcher sees it; a player, signed in or not, gets Nothing here. The launch service
 * answers who launches (the same rule that refuses every write), so the page holds no list of its own.
 */
export const FactoryPage = () => {
  const { status, session } = useIdentitySession();
  return (
    <PageFrame back="/" title={APP_STATE_WORDS.factory}>
      {status === "loading" ? <Loading /> : session ? <LauncherGate session={session} /> : <NothingHere />}
    </PageFrame>
  );
};

/**
 * The launch service answers for the cookie's caller, so the answer is keyed by that caller: the verified identity
 * and its linked wallet. Another caller, or a newly linked wallet, asks again, and an answer nobody shows any more is
 * dropped at once rather than kept for whoever signs in next.
 */
const LauncherGate = ({ session }: { session: Session }) => {
  const launcher = useQuery({
    queryKey: ["factory", "launcher", session.user.id, session.user.address ?? null],
    queryFn: fetchLauncherStatus,
    retry: false,
    gcTime: 0,
  });
  if (launcher.isPending) return <Loading />;
  return launcher.data?.launcher ? <FactoryBody /> : <NothingHere />;
};

const FactoryBody = () => {
  const directory = useDirectory();
  return (
    <div className="flex flex-col gap-4">
      <section className="plate p-3.5">
        <ShardUrlForm failures={directory.data?.failures ?? []} />
      </section>
      <Suspense fallback={<Loading />}>
        <FactoryV2Content />
      </Suspense>
    </div>
  );
};
