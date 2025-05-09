import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { socials } from "@/data/socials";
import { WaveformBackground } from "@/components/WaveformBackground";
import { TokenomicsChart } from "@/components/TokenomicsChart";
import { stats } from "./data/stats";
import { Badge } from "@/components/ui/badge";
import { Game, games } from "@/data/games";
import { getProposalsQueryOptions } from "./lib/getProposals";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ProposalQuery } from "./gql/graphql";
import { getTreasuryBalance } from "./lib/getTreasuryBalance";
import { EthplorerToken, getLordsInfo } from "./lib/getLordsPrice";
import { getLordsBalance } from "./lib/getLordsBalance";

import { ModeToggle } from "./components/ui/mode-toggle";
import { AnimatedStat } from "./components/animated-stat";

function BackgroundSlideshow({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="absolute inset-0">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={currentIndex}
          className="absolute inset-0 bg-cover bg-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.5,
            ease: [0.4, 0, 0.2, 1], // Custom easing function for smoother transition
          }}
          style={{
            backgroundImage: `url(${images[currentIndex]})`,
          }}
        />
        <motion.div
          key={`prev-${currentIndex}`}
          className="absolute inset-0 bg-cover bg-center"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{
            duration: 1.5,
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{
            backgroundImage: `url(${
              images[(currentIndex - 1 + images.length) % images.length]
            })`,
          }}
        />
      </AnimatePresence>

      {/* Optional: Add slide indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {images.map((_, index) => (
          <motion.div
            key={index}
            className={`w-2 h-2 rounded-full ${
              index === currentIndex ? "bg-primary" : "bg-muted"
            }`}
            initial={{ scale: 0.8 }}
            animate={{ scale: index === currentIndex ? 1 : 0.8 }}
            transition={{ duration: 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

function AnimatedBackground({ selectedGame }: { selectedGame: Game | null }) {
  return (
    <div className="absolute inset-0 bg-background">
      <AnimatePresence initial={false}>
        {selectedGame ? (
          selectedGame.backgroundImages ? (
            <BackgroundSlideshow images={selectedGame.backgroundImages} />
          ) : (
            <motion.div
              key={selectedGame.id}
              className="absolute inset-0 "
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              style={{
                backgroundImage: `url(${selectedGame.backgroundImage})`,
              }}
            />
          )
        ) : (
          <WaveformBackground />
        )}
      </AnimatePresence>
    </div>
  );
}

function TopBar({
  onTitleClick,
  lordsPrice,
}: {
  onTitleClick: () => void;
  lordsPrice: string | undefined;
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-2 sm:mx-4 mt-2 sm:mt-4">
        <Card className="backdrop-blur-md">
          <CardContent className="py-2 sm:py-4">
            <div className="container mx-auto flex items-center justify-between px-2 sm:px-4">
              <div className="flex items-center space-x-2 sm:space-x-8">
                <h1
                  className="text-xl sm:text-2xl font-bold cursor-pointer text-primary transition-colors"
                  onClick={onTitleClick}
                >
                  <img
                    src="/rw-logo.svg"
                    alt="Realms.World"
                    className="w-14 sm:w-18"
                  />
                </h1>
                <div className="hidden sm:flex items-center space-x-2 text-muted-foreground">
                  <span className="text-xs sm:text-sm">
                    {time.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="h-4 w-px bg-border" />
                  <motion.div
                    className="flex items-center space-x-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <span className="text-xs sm:text-sm">LORDS:</span>
                    <span className="text-xs sm:text-sm">
                      ${lordsPrice?.toLocaleString()}
                    </span>
                  </motion.div>
                  <ModeToggle />
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-6">
                {/* Social Links */}
                <div className="hidden sm:flex items-center space-x-4">
                  {socials.map((social) => (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 fill-current"
                        aria-hidden="true"
                      >
                        <path d={social.icon} />
                      </svg>
                      <span className="sr-only">{social.name}</span>
                    </a>
                  ))}
                </div>
                <span className="hidden sm:block h-6 w-px bg-border" />

                {/* Auth Buttons */}
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <a
                    href="https://account.realms.world/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" className="cursor-pointer">
                      Log In
                    </Button>
                  </a>
                  <ModeToggle />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FooterSection() {
  return (
    <section className="min-h-[50vh] flex items-end w-full">
      <div className="w-full">
        {/* Main Footer Content */}
        <div className="container mx-auto px-4 py-10 sm:py-20">
          <motion.div
            className="space-y-12 sm:space-y-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Top Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
              {/* Brand Column */}
              <div className="space-y-6">
                <h3 className="text-xl sm:text-2xl font-bold">LORDS</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  The future of gaming is onchain. Join us in building the next
                  generation of games.
                </p>
                <div className="flex space-x-4">
                  {socials.map((social) => (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 fill-current"
                        aria-hidden="true"
                      >
                        <path d={social.icon} />
                      </svg>
                      <span className="sr-only">{social.name}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-6">
                <h3 className="text-xl sm:text-2xl font-bold">Resources</h3>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="https://bibliothecadao.xyz/"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Bibliotheca DAO
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.coingecko.com/en/coins/lords"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Coin Gecko
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Frontinus House
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://shop.realms.world"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Realms World Shop
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://dev.realms.world"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Developer Docs
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://drive.google.com/drive/folders/17vrwIjwqifxBVTkHmxoK1VhQ31hVSbDH"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Brand Assets
                    </a>
                  </li>
                </ul>
              </div>
              <div></div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar - Full Width */}
        <div className="w-full border-t">
          <div className="container mx-auto px-4">
            <div className="py-4 sm:py-6 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                © {new Date().getFullYear()} BiblioDAO. All rights reserved.
              </p>
              <div className="flex space-x-4 sm:space-x-6 text-xs sm:text-sm text-muted-foreground">
                <a href="#" className="hover:text-primary transition-colors">
                  Privacy Policy
                </a>
                <a href="#" className="hover:text-primary transition-colors">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TokenomicsSection() {
  return (
    <section className=" flex items-center container mx-auto px-4 py-8 sm:py-16">
      <motion.div
        className="w-full space-y-6 sm:space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <motion.div
          className="max-w-2xl space-y-3 sm:space-y-4 text-center sm:text-left mx-auto sm:mx-0"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold">Tokenomics</h2>
          <p className="text-lg sm:text-xl text-muted-foreground">
            LORDS token powers the entire gaming ecosystem, providing value
            through staking, gameplay rewards, and governance.
          </p>
        </motion.div>

        {/* Large Tokenomics Chart */}
        <div className="grid gap-8 items-center">
          <motion.div
            className="w-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <TokenomicsChart />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function TreasurySection() {
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

function IntroSection({
  lordsInfo,
}: {
  lordsInfo: EthplorerToken | undefined;
}) {
  const { data: veLordsSupply } = useQuery(
    queryOptions({
      queryKey: ["veLordsSupply"],
      queryFn: getLordsBalance,
    })
  );

  console.log(lordsInfo);

  return (
    <motion.div
      className="min-h-[70vh] container mx-auto px-2 sm:px-4 py-8 sm:py-12 md:py-20 grid grid-cols-1 gap-6 sm:gap-8 md:gap-16 items-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Heading and Players Section - now spans full width and text is centered */}
      <div className="space-y-6 sm:space-y-8 md:space-y-12 text-center">
        {/* Title Section */}
        <div className="space-y-3 sm:space-y-4">
          <motion.div
            className="text-3xl sm:text-4xl md:text-6xl font-bold"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <motion.h1
              className="block text-primary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              onchain gaming
            </motion.h1>
          </motion.div>

          <motion.p
            className="text-md sm:text-lg md:text-xl text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            powered by $LORDS
          </motion.p>
        </div>
      </div>

      {/* Stats Section - now appears below the heading section */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
        initial="hidden"
        animate="show"
      >
        {stats.map((baseStat) => {
          let displayValue: number = 0;
          let displayTrend: string = "";

          const priceInfo = lordsInfo?.price as any;
          const lordsInfoData = lordsInfo as any;

          switch (baseStat.id) {
            case "marketCap":
              if (priceInfo?.marketCapUsd) {
                displayValue =
                  typeof priceInfo.marketCapUsd === "string"
                    ? parseFloat(priceInfo.marketCapUsd)
                    : priceInfo.marketCapUsd;
                const trendVal = priceInfo.diff7d;
                if (typeof trendVal === "number") {
                  displayTrend = `${trendVal > 0 ? "+" : ""}${trendVal.toFixed(
                    2
                  )}%`;
                }
              }
              break;
            case "staked":
              if (veLordsSupply !== undefined) {
                displayValue = veLordsSupply;
              }
              displayTrend = baseStat.trend || "";
              break;
            case "volume24h":
              if (priceInfo?.volume24h) {
                displayValue =
                  typeof priceInfo.volume24h === "string"
                    ? parseFloat(priceInfo.volume24h)
                    : priceInfo.volume24h;
                const trendVal = priceInfo.volDiff1;
                if (typeof trendVal === "number") {
                  displayTrend = `${trendVal > 0 ? "+" : ""}${trendVal.toFixed(
                    2
                  )}%`;
                }
              }
              break;
            case "priceChange7d":
              if (priceInfo?.diff7d) {
                const trendValNum =
                  typeof priceInfo.diff7d === "string"
                    ? parseFloat(priceInfo.diff7d)
                    : priceInfo.diff7d;
                displayValue = trendValNum;
                if (typeof trendValNum === "number") {
                  displayTrend = `${
                    trendValNum > 0 ? "+" : ""
                  }${trendValNum.toFixed(2)}%`;
                }
              }
              break;
            case "availableSupply":
              if (priceInfo?.availableSupply) {
                displayValue =
                  typeof priceInfo.availableSupply === "string"
                    ? parseFloat(priceInfo.availableSupply)
                    : priceInfo.availableSupply;
              }
              break;
            case "totalSupply":
              if (lordsInfoData?.totalSupply && lordsInfoData?.decimals) {
                const totalSupplyNum = parseFloat(lordsInfoData.totalSupply);
                const decimalsNum = parseInt(lordsInfoData.decimals);
                if (!isNaN(totalSupplyNum) && !isNaN(decimalsNum)) {
                  displayValue = totalSupplyNum / 10 ** decimalsNum;
                }
              }
              break;
            case "currentPrice":
              if (priceInfo?.rate) {
                displayValue =
                  typeof priceInfo.rate === "string"
                    ? parseFloat(priceInfo.rate)
                    : priceInfo.rate;
                const trendVal = priceInfo.diff;
                if (typeof trendVal === "number") {
                  displayTrend = `${trendVal > 0 ? "+" : ""}${trendVal.toFixed(
                    2
                  )}%`;
                }
              }
              break;
            case "priceChange24h":
              if (priceInfo?.diff) {
                const trendValNum =
                  typeof priceInfo.diff === "string"
                    ? parseFloat(priceInfo.diff)
                    : priceInfo.diff;
                displayValue = trendValNum;
                if (typeof trendValNum === "number") {
                  displayTrend = `${
                    trendValNum > 0 ? "+" : ""
                  }${trendValNum.toFixed(2)}%`;
                }
              }
              break;
            case "tokenHolders":
              if (lordsInfoData?.holdersCount) {
                displayValue =
                  typeof lordsInfoData.holdersCount === "string"
                    ? parseFloat(lordsInfoData.holdersCount)
                    : lordsInfoData.holdersCount;
              }
              break;
            default:
              displayValue = baseStat.value ?? 0;
              displayTrend = baseStat.trend ?? "";
          }

          return (
            <motion.div
              key={baseStat.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    type: "spring",
                    duration: 0.8,
                    bounce: 0.4,
                  },
                },
              }}
            >
              <AnimatedStat
                value={displayValue}
                label={baseStat.label}
                prefix={baseStat.prefix}
                suffix={baseStat.suffix}
                icon={baseStat.icon}
                trend={displayTrend}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

function LiveIndicator() {
  return (
    <motion.div
      className="inline-flex items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="w-2 h-2 rounded-full bg-positive mr-2" />
      <span className="text-sm text-positive">Live</span>
    </motion.div>
  );
}

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleTitleClick = () => {
    setSelectedGame(null);
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += 424; // 400px (card width) + 24px (spacing)
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft -= 424; // 400px (card width) + 24px (spacing)
    }
  };
  const { data: lordsInfo } = useQuery(
    queryOptions({
      queryKey: ["lordsPrice"],
      queryFn: getLordsInfo,
    })
  );
  const { data: veLordsSupply } = useQuery(
    queryOptions({
      queryKey: ["veLordsSupply"],
      queryFn: getLordsBalance,
    })
  );
  return (
    <motion.div>
      {/* Fixed position background */}
      <div className="fixed inset-0 bg-background">
        <AnimatedBackground selectedGame={selectedGame} />
        <div className="absolute inset-x-0 bottom-0 h-[70vh]" />
      </div>

      {/* Scrollable content */}
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <TopBar
          lordsPrice={lordsInfo?.price?.rate}
          onTitleClick={handleTitleClick}
        />

        <div className="min-h-screen pt-12 sm:pt-16 md:pt-24 mx-1 sm:mx-2 md:mx-4">
          {/* Intro Section */}
          {!selectedGame && <IntroSection lordsInfo={lordsInfo} />}
          {/* Games Section */}
          <section
            className={`relative z-10 transition-all duration-500 ${
              selectedGame ? "mt-0" : "mt-6 sm:mt-8 md:mt-20"
            }`}
          >
            <div className="container mx-auto px-1 sm:px-2 md:px-4 mb-3 sm:mb-4 md:mb-8">
              <motion.h2
                className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2 md:mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                Featured Games
              </motion.h2>
            </div>
            <motion.div
              className="relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative">
                <div
                  className="flex space-x-3 sm:space-x-4 md:space-x-6 overflow-x-auto scrollbar-hide py-2 sm:py-4 px-1 sm:px-2 md:px-4 scroll-smooth"
                  ref={scrollContainerRef}
                  style={{ scrollBehavior: "smooth" }}
                >
                  {games.map((game, index) => (
                    <motion.div
                      key={game.id}
                      layoutId={`game-${game.id}`}
                      className={`game-tile flex-shrink-0 w-[240px] sm:w-[320px] md:w-[400px] relative aspect-video bg-card overflow-hidden 
                        hover:ring-2 hover:ring-primary transition-all cursor-pointer rounded-md sm:rounded-lg
                        ${
                          selectedGame?.id === game.id
                            ? "ring-2 ring-primary scale-105"
                            : ""
                        }`}
                      onClick={() => setSelectedGame(game)}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: index * 0.1,
                        type: "spring",
                        damping: 20,
                        stiffness: 100,
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.img
                        src={game.image}
                        alt={game.title}
                        className="w-full h-full object-cover"
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5 }}
                      />
                      {/* Status and Player Count Overlay - Top */}
                      {game.isLive && (
                        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex items-center space-x-2">
                          <motion.div
                            className="flex items-center bg-card/80 backdrop-blur-sm px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + 0.3 }}
                          >
                            <motion.div
                              className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-positive mr-1 sm:mr-2"
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <span className="text-xs sm:text-sm font-medium text-foreground">
                              Live
                            </span>
                          </motion.div>
                        </div>
                      )}

                      {/* Title and Player Count Overlay - Bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2 md:p-4 bg-gradient-to-t from-background/90 to-transparent">
                        <motion.div
                          className="space-y-0.5 sm:space-y-1 md:space-y-2"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: index * 0.1 + 0.3 }}
                        >
                          <h2 className="text-sm sm:text-base md:text-lg font-semibold text-foreground">
                            {game.title}
                          </h2>
                          {game.players && (
                            <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-2.5 h-2.5 sm:w-3 md:w-4 mr-1"
                              >
                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
                              </svg>
                              {game.players.toLocaleString()} players
                            </div>
                          )}
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <button
                  onClick={scrollLeft}
                  className="absolute left-0 top-1/2 -translate-y-1/2 hover:bg-muted/70 backdrop-blur-sm p-1 sm:p-1.5 md:p-2 rounded-full transition-all duration-300 z-10 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4 sm:w-6 sm:h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>
                <button
                  onClick={scrollRight}
                  className="absolute right-0 top-1/2 -translate-y-1/2 hover:bg-muted/70 backdrop-blur-sm p-1 sm:p-1.5 md:p-2 rounded-full transition-all duration-300 z-10 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4 sm:w-6 sm:h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>
          </section>
          {/* Add Tokenomics Section */}
          {!selectedGame && <TokenomicsSection />}
          {/* Add Treasury Section */}
          {!selectedGame && <TreasurySection />}
          {/* Footer Section - Only show when no game is selected */}
          {!selectedGame && <FooterSection />}
          {/* Game Details Section */}
          <AnimatePresence mode="wait">
            {selectedGame && (
              <motion.div
                key={`details-${selectedGame.id}`}
                className="fixed bottom-0 left-0 right-0 z-20 pb-2 sm:pb-4 md:pb-8"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <div className="container mx-auto px-1 sm:px-2 md:px-4">
                  <Card className="backdrop-blur-md border-border">
                    <CardContent className="py-3 sm:py-4 md:py-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-8">
                        {/* Left Column - Basic Info */}
                        <div className="space-y-3 sm:space-y-4 md:space-y-6">
                          <div className="space-y-1 sm:space-y-2">
                            <div className="flex items-center space-x-2 sm:space-x-4 text-foreground">
                              <motion.h2
                                className="text-2xl sm:text-3xl md:text-5xl font-bold"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                              >
                                {selectedGame.title}
                              </motion.h2>
                              {selectedGame.isLive && <LiveIndicator />}
                            </div>
                            <motion.p
                              className="text-sm sm:text-base md:text-lg text-muted-foreground"
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.3 }}
                            >
                              {selectedGame.description}
                            </motion.p>
                          </div>

                          <motion.div
                            className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 md:space-x-4"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                          >
                            <Button
                              size="sm"
                              onClick={() =>
                                window.open(
                                  selectedGame.links?.homepage,
                                  "_blank"
                                )
                              }
                            >
                              Play Now
                            </Button>
                            {selectedGame.whitepaper && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(selectedGame.whitepaper, "_blank")
                                }
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="w-3 h-3 sm:w-4 mr-1 sm:mr-2"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Whitepaper
                              </Button>
                            )}
                          </motion.div>
                        </div>

                        {/* Right Column - Stats & Details */}
                        <div className="space-y-3 sm:space-y-4 md:space-y-6">
                          <motion.div
                            className="grid grid-cols-2 gap-1.5 sm:gap-2 md:gap-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                          >
                            <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                Status
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-xs sm:text-sm
                                  ${
                                    selectedGame.status === "mainnet" &&
                                    "border-positive text-positive"
                                  }
                                  ${
                                    selectedGame.status === "testnet" &&
                                    "border-warning text-warning"
                                  }
                                  ${
                                    selectedGame.status === "development" &&
                                    "border-info text-info"
                                  }
                                `}
                              >
                                {selectedGame.status.toUpperCase()}
                              </Badge>
                            </div>

                            <div className="space-y-0.5 sm:space-y-1 md:space-y-2">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                Studio
                              </div>
                              <Badge
                                variant="default"
                                className="text-xs sm:text-sm"
                              >
                                {selectedGame.studio}
                              </Badge>
                            </div>

                            {selectedGame.players && (
                              <div className="space-y-0.5 sm:space-y-1 md:space-y-2 text-foreground">
                                <div className="text-xs sm:text-sm text-muted-foreground">
                                  Active Players
                                </div>
                                <div className="text-lg sm:text-xl md:text-2xl font-bold">
                                  {selectedGame.players.toLocaleString()}
                                </div>
                              </div>
                            )}

                            {selectedGame.tvl && (
                              <div className="space-y-0.5 sm:space-y-1 md:space-y-2 text-foreground">
                                <div className="text-xs sm:text-sm text-muted-foreground">
                                  TVL
                                </div>
                                <div className="text-lg sm:text-xl md:text-2xl font-bold">
                                  ${selectedGame.tvl.toLocaleString()}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default App;
