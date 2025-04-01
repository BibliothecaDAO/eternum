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
import { Proposal } from "./gql/graphql";
import { getTreasuryBalance } from "./lib/getTreasuryBalance";
import { EthplorerToken, getLordsInfo } from "./lib/getLordsPrice";
import { getLordsBalance } from "./lib/getLordsBalance";

function useCountAnimation(end: number, duration: number = 2) {
  const [count, setCount] = useState(0);
  const nodeRef = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const progress = Math.min(
        (now - startTime.current) / (duration * 1000),
        1
      );

      if (progress < 1) {
        nodeRef.current = Math.floor(end * progress);
        setCount(nodeRef.current);
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
    return () => {
      nodeRef.current = 0;
      startTime.current = Date.now();
    };
  }, [end, duration]);

  return count;
}

function AnimatedStat({
  value,
  label,
  prefix = "",
  suffix = "",
  icon,
  trend,
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  icon: string;
  trend: string;
}) {
  const count = useCountAnimation(value);
  const isPositiveTrend = trend.startsWith("+");

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card className="backdrop-blur-md bg-black/20 border-white/5 hover:bg-black/30 transition-all duration-300 text-white group">
        <CardHeader className="pb-2 uppercase">
          <div className="flex items-center justify-between mb-8">
            <CardDescription className="text-lg font-medium">
              <motion.h3
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {label}
              </motion.h3>
            </CardDescription>
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </motion.svg>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <motion.div initial="initial" whileHover="hover" animate="initial">
            <motion.div
              variants={{
                initial: { y: 0 },
                hover: { y: -5 },
              }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <CardTitle className="text-2xl font-bold">
                {prefix}
                {count.toLocaleString()}
                {suffix}
              </CardTitle>
            </motion.div>
            <motion.div
              variants={{
                initial: { opacity: 0.7, y: 0 },
                hover: { opacity: 1, y: -5 },
              }}
              transition={{ type: "spring", stiffness: 400 }}
              className={`text-sm ${
                isPositiveTrend ? "text-green-400" : "text-red-400"
              }`}
            >
              {trend}
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
          animate={{ opacity: 1 }}
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
          initial={{ opacity: 1 }}
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
              index === currentIndex ? "bg-primary" : "bg-white/50"
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
    <div className="absolute inset-0">
      <AnimatePresence initial={false}>
        {selectedGame ? (
          selectedGame.backgroundImages ? (
            <BackgroundSlideshow images={selectedGame.backgroundImages} />
          ) : (
            <motion.div
              key={selectedGame.id}
              className="absolute inset-0 bg-cover bg-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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

function TopBar({ onTitleClick, lordsPrice }: { onTitleClick: () => void, lordsPrice: string | undefined }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-4 mt-4">
        <Card className="backdrop-blur-md bg-black/30 border-white/10">
          <CardContent className="py-4">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <h1
                  className="text-2xl font-bold cursor-pointer text-primary transition-colors"
                  onClick={onTitleClick}
                >
                  Realms World
                </h1>
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <span className="text-sm">
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
                    <span className="text-sm">LORDS:</span>
                    <span className="text-sm">${lordsPrice?.toLocaleString()}</span>
                     {/* className={`text-sm ${
                        lordsPrice.startsWith("+")
                          ? "text-green-400"
                          : "text-red-400"
                      }`}*/}
                  

                  </motion.div>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                {/* Social Links */}
                <div className="flex items-center space-x-4">
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

                <span className="h-6 w-px bg-border" />

                {/* Auth Buttons */}
                <div className="flex items-center space-x-4">
                  <Button variant="ghost">Sign In</Button>
                  <Button>Join Now</Button>
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
        <div className="container mx-auto px-4 py-20">
          <motion.div
            className="space-y-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Top Section */}
            <div className="grid grid-cols-4 gap-8">
              {/* Brand Column */}
              <div className="space-y-6">
                <h3 className="text-2xl font-bold">LORDS</h3>
                <p className="text-muted-foreground">
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

              {/* Quick Links */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Quick Links</h3>
                <ul className="space-y-3">
                  {["Games", "Staking", "Docs", "Blog"].map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resources */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Resources</h3>
                <ul className="space-y-3">
                  {["Whitepaper", "Token", "FAQ", "Support"].map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Newsletter */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Stay Updated</h3>
                <p className="text-muted-foreground">
                  Subscribe to our newsletter for the latest updates and
                  announcements.
                </p>
                <Card className="backdrop-blur-md bg-black/20 border-white/10">
                  <CardContent className="pt-6">
                    <div className="flex space-x-2">
                      <input
                        type="email"
                        placeholder="Enter your email"
                        className="flex-1 bg-transparent border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <Button size="sm" className="shrink-0">
                        Subscribe
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar - Full Width */}
        <div className="w-full border-t border-white/10">
          <div className="container mx-auto px-4">
            <div className="py-6 flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                © 2024 LORDS. All rights reserved.
              </p>
              <div className="flex space-x-6 text-sm text-muted-foreground">
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
    <section className="min-h-[50vh] flex items-center container mx-auto px-4 py-16">
      <motion.div
        className="w-full space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <motion.div
          className="max-w-2xl space-y-4"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <h2 className="text-4xl font-bold">Tokenomics</h2>
          <p className="text-xl text-muted-foreground">
            LORDS token powers the entire gaming ecosystem, providing value
            through staking, gameplay rewards, and governance.
          </p>
        </motion.div>

        {/* Large Tokenomics Chart */}
        <div className="grid grid-cols-2 gap-8 items-center">
          <motion.div
            className="aspect-square w-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <Card className="w-full h-full backdrop-blur-md bg-background/30 border-border">
              <CardContent className="p-8 h-full">
                <TokenomicsChart />
              </CardContent>
            </Card>
          </motion.div>

          {/* Token Distribution Summary 
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            {[
              { label: "Staking Rewards", value: "40%" },
              { label: "Game Rewards", value: "35%" },
              { label: "Development", value: "15%" },
              { label: "Community", value: "10%" },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                className="flex items-center justify-between"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
              >
                <div className="text-lg text-muted-foreground">
                  {item.label}total
                  {item.value}
                </div>
              </motion.div>
            ))}
          </motion.div>*/}
        </div>
      </motion.div>
    </section>
  );
}

function TreasurySection() {

  const { data: proposalsQuery } = useQuery(
    getProposalsQueryOptions({
      limit: 5,
      skip: 0,
      current: 1,
      searchQuery: "",
    }),
  );

  const isActive = (proposal: Proposal) => proposal.max_end * 1000 > Date.now();

  const { data: treasuryBalance } = useQuery(
    queryOptions({
      queryKey: ["treasuryBalance"],
      queryFn: getTreasuryBalance,
    }),
  );

  const totalTreasuryBalance = (treasuryBalance?.LORDS.usdValue ?? 0) + (treasuryBalance?.ETH.usdValue ?? 0) + (treasuryBalance?.WETH.usdValue ?? 0) + (treasuryBalance?.USDC.usdValue ?? 0);
  const getProposalStatus = (proposal: Proposal) => {

    if (
      (proposal.scores_total ?? 0) >= 1500 &&
      Number(proposal.scores_1 ?? 0) > Number(proposal.scores_2 ?? 0)
    ) {
      return   "Passed";
      
    } else if ((proposal.scores_total ?? 0) < 1500) {
      return "Quorum not met";
    } else {
      return "Failed"
    }
  };
  return (
    <section className="min-h-screen flex items-center container mx-auto px-4 py-32">
      <motion.div
        className="grid grid-cols-2 gap-16 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Left Column - Governance */}
        <div className="space-y-6">
          <h2 className="text-4xl font-bold">DAO Treasury</h2>
          <p className="text-xl text-muted-foreground">
            Decentralized governance powered by Realms. Each Realm represents
            one vote in the DAO.
          </p>

          <Card className="backdrop-blur-md bg-black/20 border-white/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-lg font-medium text-muted-foreground">
                  Governance Model
                </CardDescription>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6 text-muted-foreground"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                  />
                </svg>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold">1 Realm = 1 Vote</h4>
                <p className="text-muted-foreground">
                  Each Realm holder gets one vote in governance decisions,
                  ensuring fair representation in the DAO.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-semibold">Treasury Control</h4>
                <p className="text-muted-foreground">
                  Vote on treasury allocations, protocol upgrades, and ecosystem
                  development.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Treasury Balance */}
        <div className="space-y-6">
          <Card className="backdrop-blur-md bg-black/20 border-white/10">
            <CardHeader>
              <CardTitle>Treasury Balance</CardTitle>
              <CardDescription>
                Current allocation of treasury assets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* LORDS Balance */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">LORDS</span>
                    <span>{treasuryBalance?.LORDS.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-white/5">
                    <div className="bg-primary h-2" style={{ width: `${(treasuryBalance?.LORDS.usdValue ?? 0) / totalTreasuryBalance * 100}%` }} />
                  </div>
                </div>

                {/* ETH Balance */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ETH + WETH</span>
                    <span>{((treasuryBalance?.ETH.amount ?? 0) + (treasuryBalance?.WETH.amount ?? 0)).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-white/5">
                    <div className="bg-blue-500 h-2" style={{ width: `${((treasuryBalance?.ETH.usdValue ?? 0) + (treasuryBalance?.WETH.usdValue ?? 0)) / totalTreasuryBalance * 100}%` }} />
                  </div>
                </div>

                {/* USDC Balance */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">USDC</span>
                    <span>{treasuryBalance?.USDC.amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-white/5">
                    <div
                      className="bg-green-500 h-2"
                      style={{ width: `${(treasuryBalance?.USDC.usdValue ?? 0) / totalTreasuryBalance * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Total Value */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Value</span>
                  <span className="text-2xl font-bold">${totalTreasuryBalance.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Proposals */}
          <Card className="backdrop-blur-md bg-black/20 border-white/10">
            <CardHeader>
              <CardTitle>Recent Proposals</CardTitle>
              <CardDescription>Latest governance activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proposalsQuery?.proposals?.map((proposal) => (
                  <div
                    key={proposal?.metadata?.title}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{proposal?.metadata?.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {proposal ? isActive(proposal) ? "Active" : getProposalStatus(proposal) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{proposal?.scores_total}</div>
                      <div className="text-sm text-muted-foreground">Votes</div>
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

function IntroSection({ lordsInfo }: { lordsInfo: EthplorerToken | undefined }) {
  const {data: veLordsSupply} = useQuery(queryOptions({
    queryKey: ["veLordsSupply"],
    queryFn: getLordsBalance,
  }));
  return (
    <motion.div
      className="min-h-[70vh] container mx-auto px-4 py-20 grid grid-cols-2 gap-16 items-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Left Column - Heading and Players */}
      <div className="space-y-12">
        {/* Title Section */}
        <div className="space-y-4">
          <motion.div
            className="text-6xl font-bold"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <h1>Forever Gaming</h1>
            <motion.h1
              className="block text-primary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              onchain
            </motion.h1>
          </motion.div>

          <motion.p
            className="text-xl text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Onchain gaming, powered by LORDS.
          </motion.p>
        </div>
      </div>

      {/* Right Column - Stats */}
      <motion.div
        className="grid grid-cols-3 gap-4"
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
        {stats.map((stat) => {
          // Calculate market cap if this is the market cap stat
          if (stat.id === "marketCap" && lordsInfo?.price?.marketCapUsd) {
            stat.value = parseFloat(lordsInfo.price.marketCapUsd);
            stat.trend = lordsInfo.price.diff7d ? `${lordsInfo.price.diff7d}%` : "";
          }
          if (stat.id === "staked" && veLordsSupply) {
            stat.value = veLordsSupply;
            //stat.trend = lordsInfo.price.diff7d ? `${lordsInfo.price.diff7d}%` : "";
          }
          if (stat.id === "volume24h" && lordsInfo?.price?.volume24h) {
            stat.value = parseFloat(lordsInfo.price.volume24h);
          }
          if (stat.id === "priceChange7d" && lordsInfo?.price?.diff7d) {
            stat.value = parseFloat(lordsInfo.price.diff7d);
            //stat.trend = lordsInfo.price.diff7d ? `${lordsInfo.price.diff7d}%` : "";
          }
          return (
            <motion.div
              key={stat.id}
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
                value={stat.value}
                label={stat.label}
                prefix={stat.prefix}
                suffix={stat.suffix}
                icon={stat.icon}
                trend={stat.trend}
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
      <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
      <span className="text-sm text-emerald-500">Live</span>
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
  const { data: lordsInfo } = useQuery(queryOptions({
    queryKey: ["lordsPrice"],
    queryFn: getLordsInfo,
  }));
  return (
    <motion.div className="font-body text-foreground bg-background/95 relative">
      {/* Fixed position background */}
      <div className="fixed inset-0">
        <AnimatedBackground selectedGame={selectedGame} />
        <div className="absolute inset-x-0 bottom-0 h-[70vh] bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      </div>

      {/* Border Frame */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        <div className="mx-4 mt-4 h-full flex flex-col">
          {/* Top spacer for header */}
          {/* <div className="h-[72px]" /> */}
          {/* Border frame with bottom border */}
          <div className="flex-1 relative">
            {/* Side borders */}
            <div className="absolute inset-0 border-l border-r border-white/20" />
            {/* Bottom border */}
            <div className="absolute bottom-0 left-0 right-0 border-b border-white/20" />
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <TopBar lordsPrice={lordsInfo?.price?.rate} onTitleClick={handleTitleClick} />

        <div className="min-h-screen pt-24 mx-4">
          {/* Intro Section */}
          {!selectedGame && <IntroSection lordsInfo={lordsInfo} />}
          {/* Games Section */}
          <section
            className={`relative z-10 transition-all duration-500 ${
              selectedGame ? "mt-0" : "mt-20"
            }`}
          >
            <div className="container mx-auto px-4 mb-8">
              <motion.h2
                className="text-2xl font-bold mb-4"
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
                  className="flex space-x-6 overflow-x-auto scrollbar-hide py-4 px-4 scroll-smooth" 
                  ref={scrollContainerRef}
                  style={{ scrollBehavior: 'smooth' }}
                >
                  {games.map((game, index) => (
                    <motion.div
                      key={game.id}
                      layoutId={`game-${game.id}`}
                      className={`game-tile flex-shrink-0 w-[400px] relative aspect-video bg-card overflow-hidden 
                        hover:ring-2 hover:ring-primary transition-all cursor-pointer rounded-lg
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
                        <div className="absolute top-4 left-4 flex items-center space-x-2">
                          <motion.div
                            className="flex items-center bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + 0.3 }}
                          >
                            <motion.div
                              className="w-2 h-2 rounded-full bg-emerald-500 mr-2"
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              Live
                            </span>
                          </motion.div>
                        </div>
                      )}

                      {/* Title and Player Count Overlay - Bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
                        <motion.div
                          className="space-y-2"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: index * 0.1 + 0.3 }}
                        >
                          <h2 className="text-lg font-semibold text-foreground">
                            {game.title}
                          </h2>
                          {game.players && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-4 h-4 mr-1"
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 backdrop-blur-sm p-2 rounded-full text-white transition-all duration-300 z-10 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
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
                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 backdrop-blur-sm p-2 rounded-full text-white transition-all duration-300 z-10 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
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
                className="fixed bottom-0 left-0 right-0 z-20 pb-8"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <div className="container mx-auto px-4">
                  <Card className="backdrop-blur-md bg-background/30 border-border">
                    <CardContent className="py-6">
                      <div className="grid grid-cols-2 gap-8">
                        {/* Left Column - Basic Info */}
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-4 text-foreground">
                              <motion.h2
                                className="text-5xl font-bold"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                              >
                                {selectedGame.title}
                              </motion.h2>
                              {selectedGame.isLive && <LiveIndicator />}
                            </div>
                            <motion.p
                              className="text-lg text-muted-foreground"
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.3 }}
                            >
                              {selectedGame.description}
                            </motion.p>
                          </div>

                          <motion.div
                            className="flex space-x-4"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                          >
                            <Button onClick={() => window.open(selectedGame.links?.homepage, "_blank")} >Play Now</Button>
                            {selectedGame.whitepaper && (
                              <Button variant="outline" onClick={() => window.open(selectedGame.whitepaper, "_blank")}>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="w-4 h-4 mr-2"
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
                        <div className="space-y-6">
                          <motion.div
                            className="grid grid-cols-2 gap-4"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                          >
                            <div className="space-y-2">
                              <div className="text-sm text-gray-400">
                                Status
                              </div>
                              <Badge
                                variant="outline"
                                className={`
                                  ${
                                    selectedGame.status === "mainnet" &&
                                    "border-emerald-500 text-emerald-500"
                                  }
                                  ${
                                    selectedGame.status === "testnet" &&
                                    "border-amber-500 text-amber-500"
                                  }
                                  ${
                                    selectedGame.status === "development" &&
                                    "border-sky-500 text-sky-500"
                                  }
                                `}
                              >
                                {selectedGame.status.toUpperCase()}
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm text-gray-400">
                                Studio
                              </div>
                              <Badge variant="default" className="text-white">
                                {selectedGame.studio}
                              </Badge>
                            </div>

                            {selectedGame.players && (
                              <div className="space-y-2 text-foreground">
                                <div className="text-sm text-gray-400">
                                  Active Players
                                </div>
                                <div className="text-2xl font-bold">
                                  {selectedGame.players.toLocaleString()}
                                </div>
                              </div>
                            )}

                            {selectedGame.tvl && (
                              <div className="space-y-2 text-foreground">
                                <div className="text-sm text-gray-400">TVL</div>
                                <div className="text-2xl font-bold">
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
