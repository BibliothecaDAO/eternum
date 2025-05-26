import { motion } from "framer-motion";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getProposalsQueryOptions } from "@/lib/getProposals";
import { getTreasuryBalance } from "@/lib/getTreasuryBalance";
import { ProposalQuery } from "@/gql/graphql";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export function TreasurySection() {
  const { data: proposalsQuery } = useQuery(
    getProposalsQueryOptions({
      limit: 3,
      skip: 0,
      current: 1,
      searchQuery: "",
    })
  );

  const isActive = (proposal: ProposalQuery["proposal"]) =>
    proposal && proposal.max_end * 1000 > Date.now();

  const { data: treasuryBalance } = useQuery(
    queryOptions({
      queryKey: ["treasuryBalance"],
      queryFn: getTreasuryBalance,
    })
  );

  const totalTreasuryBalance =
    (treasuryBalance?.LORDS.usdValue ?? 0) +
    (treasuryBalance?.ETH.usdValue ?? 0) +
    (treasuryBalance?.WETH.usdValue ?? 0) +
    (treasuryBalance?.USDC.usdValue ?? 0);

  const getProposalStatus = (proposal: ProposalQuery["proposal"]) => {
    if (
      (proposal?.scores_total ?? 0) >= 1500 &&
      Number(proposal?.scores_1 ?? 0) > Number(proposal?.scores_2 ?? 0)
    ) {
      return "Passed";
    } else if ((proposal?.scores_total ?? 0) < 1500) {
      return "Quorum not met";
    } else {
      return "Failed";
    }
  };

  return (
    <section className="min-h-screen flex items-center container mx-auto px-2 sm:px-4 py-8 sm:py-16 md:py-32">
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-16 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Left Column - Governance */}
        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            DAO Treasury
          </h2>
          <p className="text-md sm:text-lg md:text-xl text-muted-foreground">
            Decentralized governance powered by Realms. Each Realm represents
            one vote in the DAO.
          </p>

          <Card className="backdrop-blur-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm sm:text-base md:text-lg font-medium text-muted-foreground">
                  Governance Model
                </CardDescription>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 sm:w-5 md:w-6 text-muted-foreground"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                  />
                </svg>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="space-y-1 sm:space-y-2">
                <h4 className="text-sm sm:text-base md:text-lg font-semibold">
                  1 Realm = 1 Vote
                </h4>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                  Each Realm holder gets one vote in governance decisions,
                  ensuring fair representation in the DAO.
                </p>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <h4 className="text-sm sm:text-base md:text-lg font-semibold">
                  Treasury Control
                </h4>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                  Vote on treasury allocations, protocol upgrades, and ecosystem
                  development.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Treasury Balance */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl md:text-2xl">
                Treasury Balance
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm md:text-base">
                Current allocation of treasury assets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                {/* LORDS Balance */}
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">LORDS</span>
                    <span>
                      {treasuryBalance?.LORDS.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted">
                    <div
                      className="bg-primary h-1.5 sm:h-2"
                      style={{
                        width: `${
                          ((treasuryBalance?.LORDS.usdValue ?? 0) /
                            totalTreasuryBalance) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* ETH Balance */}
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">ETH + WETH</span>
                    <span>
                      {(
                        (treasuryBalance?.ETH.amount ?? 0) +
                        (treasuryBalance?.WETH.amount ?? 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted">
                    <div
                      className="h-1.5 sm:h-2"
                      style={{
                        width: `${
                          (((treasuryBalance?.ETH.usdValue ?? 0) +
                            (treasuryBalance?.WETH.usdValue ?? 0)) /
                            totalTreasuryBalance) *
                          100
                        }%`,
                        backgroundColor: "hsl(var(--theme-blue-500))",
                      }}
                    />
                  </div>
                </div>

                {/* USDC Balance */}
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">USDC</span>
                    <span>{treasuryBalance?.USDC.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted">
                    <div
                      className="h-1.5 sm:h-2"
                      style={{
                        width: `${
                          ((treasuryBalance?.USDC.usdValue ?? 0) /
                            totalTreasuryBalance) *
                          100
                        }%`,
                        backgroundColor: "hsl(var(--theme-green-500))",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Total Value */}
              <div className="mt-3 sm:mt-4 md:mt-6 pt-3 sm:pt-4 md:pt-6 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base md:text-lg font-semibold">
                    Total Value
                  </span>
                  <span className="text-lg sm:text-xl md:text-2xl font-bold">
                    ${totalTreasuryBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Proposals */}
          <Card className="backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg sm:text-xl md:text-2xl">
                    Recent Proposals
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm md:text-base">
                    Latest governance activities
                  </CardDescription>
                </div>
                <a
                  href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size={"sm"} variant="outline">
                    View All
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                {proposalsQuery?.proposals?.map((proposal) => (
                  <div
                    key={proposal?.metadata?.title}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs sm:text-sm md:text-base font-medium">
                        {proposal?.metadata?.title}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {proposal
                          ? isActive(proposal)
                            ? "Active"
                            : getProposalStatus(proposal)
                          : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs sm:text-sm md:text-base font-medium">
                        {proposal?.scores_total}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        Votes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </section>
  );
}
