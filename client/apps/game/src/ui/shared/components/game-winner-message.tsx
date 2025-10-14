import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { currencyIntlFormat, displayAddress, getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import { getAddressName, getGuildFromPlayerAddress, getIsBlitz, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { Copy, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import eternumLogoWhite from "../../../../../eternum-mobile/public/images/eternum-logo-white.svg";

type TopPlayer = {
  rank: number;
  name: string;
  guildName?: string;
  points: number;
  address: ContractAddress;
};

const formatOrdinal = (rank: number): string => {
  const remainder = rank % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${rank}th`;
  }

  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
};

const truncateText = (value: string, maxLength: number = 32): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
};

const CARD_DIMENSIONS = {
  width: 640,
  height: 360,
};

const CARD_RADII = [40, 88, 136, 184, 232];

const COVER_IMAGES = [
  "/images/covers/blitz/01.png",
  "/images/covers/blitz/02.png",
  "/images/covers/blitz/03.png",
  "/images/covers/blitz/04.png",
  "/images/covers/blitz/05.png",
  "/images/covers/blitz/06.png",
  "/images/covers/blitz/07.png",
  "/images/covers/blitz/08.png",
];

const getSecondaryLabel = (player: TopPlayer) => {
  if (player.guildName) return player.guildName;
  return displayAddress(player.address.toString(16));
};

export const GameWinnerMessage = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { currentBlockTimestamp } = useBlockTimestamp();

  const gameWinner = useUIStore((state) => state.gameWinner);
  const gameEndAt = useUIStore((state) => state.gameEndAt);

  void currentBlockTimestamp; // DEBUG: remove once hasGameEnded hook restored
  void gameEndAt; // DEBUG: remove once hasGameEnded hook restored

  const isBlitz = getIsBlitz();

  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const [topThreePlayers, setTopThreePlayers] = useState<TopPlayer[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<TopPlayer | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const leaderboardSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const hasGameEnded = true; // DEBUG: force banner while refining UI

  useEffect(() => {
    if (!hasGameEnded) return;

    try {
      const manager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());
      manager.updatePoints();

      const rankedPlayers = manager.playersByRank;
      const createTopPlayer = (address: ContractAddress, rank: number, points: number): TopPlayer => {
        const displayName =
          getAddressName(address, components) || displayAddress(address.toString(16)) || "Unknown player";
        const guildName = getGuildFromPlayerAddress(address, components)?.name;

        return {
          rank,
          name: displayName,
          guildName: guildName || undefined,
          points,
          address,
        } satisfies TopPlayer;
      };

      const formattedTopThree = rankedPlayers
        .slice(0, 3)
        .map(([address, points], index) => createTopPlayer(address, index + 1, points));

      const playerAddress = ContractAddress(account.address);
      const myIndex = rankedPlayers.findIndex(([address]) => address === playerAddress);
      let myPlayer: TopPlayer | null = null;

      if (myIndex >= 0) {
        const [address, points] = rankedPlayers[myIndex];
        myPlayer = createTopPlayer(address, myIndex + 1, points);
      }

      setTopThreePlayers(formattedTopThree);
      setPlayerRank(myIndex >= 0 ? myIndex + 1 : null);
      setHighlightedPlayer(myPlayer ?? formattedTopThree[0] ?? null);
    } catch (error) {
      console.error("Failed to load final leaderboard", error);
      setTopThreePlayers([]);
      setPlayerRank(null);
      setHighlightedPlayer(null);
    }
  }, [account.address, components, hasGameEnded]);

  const copyLeaderboardImage = useCallback(async () => {
    if (topThreePlayers.length === 0 || !leaderboardSvgRef.current) {
      toast.error("Final standings are still loading.");
      return;
    }

    if (typeof window === "undefined" || typeof navigator === "undefined" || !("ClipboardItem" in window)) {
      toast.error("Copying images is not supported in this environment.");
      return;
    }

    if (!navigator.clipboard || typeof navigator.clipboard.write !== "function") {
      toast.error("Clipboard access is not available.");
      return;
    }

    setIsCopying(true);

    let objectUrl: string | null = null;

    try {
      if (typeof document !== "undefined") {
        const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
        if (fontSet && "ready" in fontSet) {
          try {
            await fontSet.ready;
          } catch (error) {
            console.warn("Font loading check failed", error);
          }
        }
      }

      const svgElement = leaderboardSvgRef.current;
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

      const toDataUrl = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to encode asset"));
          reader.readAsDataURL(blob);
        });

      const inlineImagePromises = Array.from(clone.querySelectorAll("image")).map(async (imageNode) => {
        const href = imageNode.getAttribute("href") ?? imageNode.getAttribute("xlink:href");
        if (!href || href.startsWith("data:")) return;

        const absoluteHref = href.match(/^https?:/) ? href : new URL(href, window.location.origin).toString();

        const response = await fetch(absoluteHref, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error(`Failed to fetch asset: ${href}`);
        }

        const blob = await response.blob();
        const dataUrl = await toDataUrl(blob);
        imageNode.setAttribute("href", dataUrl);
        imageNode.setAttribute("xlink:href", dataUrl);
      });

      await Promise.all(inlineImagePromises);

      const serializer = new XMLSerializer();
      const svgMarkup = serializer.serializeToString(clone);
      const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      objectUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      const bounding = svgElement.getBoundingClientRect();
      const width = bounding.width || Number(svgElement.getAttribute("width")) || CARD_DIMENSIONS.width;
      const height = bounding.height || Number(svgElement.getAttribute("height")) || CARD_DIMENSIONS.height;
      const scale = window.devicePixelRatio || 2;

      image.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Canvas context is not available");
          }

          context.scale(scale, scale);
          context.drawImage(image, 0, 0, width, height);

          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((result) => resolve(result), "image/png");
          });

          if (!blob) {
            throw new Error("Failed to encode image");
          }

          const ClipboardItemConstructor = (window as typeof window & { ClipboardItem: typeof ClipboardItem })
            .ClipboardItem;
          await navigator.clipboard.write([new ClipboardItemConstructor({ [blob.type]: blob })]);
          toast.success("Blitz highlight copied to your clipboard.");
        } catch (error) {
          console.error("Failed to copy highlight image", error);
          toast.error("Unable to copy the highlight image.");
        } finally {
          setIsCopying(false);
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
        }
      };

      image.onerror = () => {
        setIsCopying(false);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        toast.error("Unable to prepare the highlight image.");
      };

      if (!objectUrl) {
        throw new Error("Failed to create image URL");
      }

      image.src = objectUrl;
    } catch (error) {
      console.error("Failed to prepare highlight image", error);
      toast.error("Unable to prepare the highlight image.");
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setIsCopying(false);
    }
  }, [topThreePlayers]);

  const handleShareOnX = useCallback(() => {
    if (topThreePlayers.length === 0) {
      toast.error("Final standings are still loading.");
      return;
    }

    const placeText = playerRank ? formatOrdinal(playerRank) : "a top spot";
    const eventLabel = isBlitz ? "Realms Blitz" : "the Realms leaderboard";
    const mainLine = `Secured ${placeText} on ${eventLabel} with ${currencyIntlFormat(highlightedPlayer?.points ?? 0, 0)} pts 👑`;

    // Share message on multiple lines, separating the link to its own line
    const tweetText = `${mainLine}\n\nParticipate in the most insane fully onchain game powered by Starknet here:\n${typeof window !== "undefined" ? window.location.origin : "https://localhost:5175"}`;

    const shareIntent = new URL("https://twitter.com/intent/tweet");
    shareIntent.searchParams.set("text", tweetText);

    if (typeof window !== "undefined") {
      window.open(shareIntent.toString(), "_blank", "noopener,noreferrer");
    }
  }, [isBlitz, playerRank, topThreePlayers]);

  if (!hasGameEnded || !isVisible) return null;

  const highlight = highlightedPlayer;
  const cardTitle = isBlitz ? "Realms Blitz" : "Realms";
  const cardSubtitle = isBlitz ? "Blitz Leaderboard" : "Final Leaderboard";
  const championName = topThreePlayers[0]?.name || gameWinner?.name;
  const championGuild = topThreePlayers[0]?.guildName || gameWinner?.guildName;
  const winnerLine = championName ? (championGuild ? `${championName} — ${championGuild}` : championName) : null;
  const highlightOrdinal = highlight ? formatOrdinal(highlight.rank).toUpperCase() : "--";
  const highlightPointsValue = highlight ? `${currencyIntlFormat(highlight.points, 0)} pts` : "--";
  const highlightName = highlight ? truncateText(highlight.name, 30) : null;
  const highlightSecondaryLabel = highlight ? truncateText(getSecondaryLabel(highlight), 32) : null;
  const coverImage = highlight ? COVER_IMAGES[Math.max(0, highlight.rank - 1) % COVER_IMAGES.length] : COVER_IMAGES[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[54px]">
      <div
        className={`absolute inset-0 z-0 cursor-pointer bg-[rgba(3,8,11,0.75)] backdrop-blur-sm transition-opacity duration-500 ${
          isAnimating ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
        }`}
        onClick={() => setIsVisible(false)}
      />

      <div
        className={`relative z-10 w-full max-w-[760px] transform transition-all duration-500 ${
          isAnimating ? "pointer-events-none -translate-y-4 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
        }`}
      >
        <div className="relative overflow-hidden rounded-[60px] border border-[#123947]/70 bg-[#030d14] text-cyan-50 shadow-[0_34px_80px_rgba(2,12,20,0.72)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-12%,rgba(64,200,233,0.35),transparent_65%)]" />

          <div className="relative flex flex-col gap-6 px-6 pb-8 pt-12 md:px-12 md:pt-16">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.42em] text-cyan-200/70 md:text-sm">
                {cardTitle}
              </p>
              <h2 className="text-3xl font-semibold uppercase tracking-[0.24em] text-white md:text-[36px]">
                {cardSubtitle}
              </h2>
              {winnerLine && (
                <p className="text-sm font-medium text-cyan-100/70 md:text-base">Champion · {winnerLine}</p>
              )}
            </div>

            <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-[3px] md:px-8 md:py-7">
              <p className="text-center text-[11px] uppercase tracking-[0.28em] text-white/60 md:text-xs">
                Capture the moment and share your Blitz flex.
              </p>

              <div className="flex justify-center">
                {topThreePlayers.length > 0 ? (
                  <svg
                    ref={leaderboardSvgRef}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={`0 0 ${CARD_DIMENSIONS.width} ${CARD_DIMENSIONS.height}`}
                    width={CARD_DIMENSIONS.width}
                    height={CARD_DIMENSIONS.height}
                    className="h-auto w-full max-w-[720px]"
                    role="img"
                    aria-label={`${cardSubtitle} highlight card`}
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      filter: "drop-shadow(0 32px 70px rgba(1, 11, 18, 0.64))",
                    }}
                  >
                    <defs>
                      <linearGradient id="blitz-cover-overlay" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(4, 17, 25, 0.82)" />
                        <stop offset="52%" stopColor="rgba(4, 17, 25, 0.44)" />
                        <stop offset="100%" stopColor="rgba(4, 17, 25, 0.24)" />
                      </linearGradient>
                      <radialGradient id="blitz-radial-glow" cx="0.22" cy="0.2" r="0.9">
                        <stop offset="0%" stopColor="rgba(118, 255, 242, 0.45)" />
                        <stop offset="100%" stopColor="rgba(118, 255, 242, 0)" />
                      </radialGradient>
                      <linearGradient id="blitz-rank-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f7fffe" />
                        <stop offset="100%" stopColor="#b8fff2" />
                      </linearGradient>
                      <clipPath id="blitz-card-clip">
                        <rect width="640" height="360" rx="44" />
                      </clipPath>
                    </defs>

                    <g clipPath="url(#blitz-card-clip)">
                      <rect width="640" height="360" fill="#04131f" />
                      <image
                        href={coverImage}
                        x="0"
                        y="0"
                        width="640"
                        height="360"
                        preserveAspectRatio="xMidYMid slice"
                      />
                      <rect width="640" height="360" fill="url(#blitz-cover-overlay)" />
                      <rect width="640" height="360" fill="url(#blitz-radial-glow)" opacity="0.68" />
                      {CARD_RADII.map((radius, index) => (
                        <circle
                          key={radius}
                          cx="320"
                          cy="180"
                          r={radius}
                          fill="none"
                          stroke="rgba(111, 250, 255, 0.18)"
                          strokeWidth={index === 0 ? 1.6 : 1}
                        />
                      ))}

                      <image
                        href={eternumLogoWhite}
                        x="40"
                        y="64"
                        width="60"
                        height="60"
                        preserveAspectRatio="xMidYMid meet"
                        opacity="0.96"
                      />

                      <rect
                        x="404"
                        y="134"
                        width="192"
                        height="130"
                        rx="26"
                        fill="rgba(6, 22, 30, 0.58)"
                        stroke="rgba(120, 255, 242, 0.34)"
                        strokeWidth="1.4"
                      />

                      <text
                        x="108"
                        y="70"
                        fontSize="12"
                        letterSpacing="0.32em"
                        fontWeight="600"
                        fill="rgba(202, 255, 255, 0.78)"
                        style={{ textTransform: "uppercase" }}
                      >
                        {cardTitle}
                      </text>
                      <text
                        x="108"
                        y="98"
                        fontSize="24"
                        fontWeight="600"
                        letterSpacing="0.18em"
                        fill="#efffff"
                        style={{ textTransform: "uppercase" }}
                      >
                        {cardSubtitle}
                      </text>
                      {winnerLine && (
                        <text x="108" y="122" fontSize="13" fill="rgba(198, 244, 255, 0.78)">
                          {truncateText(`Champion · ${winnerLine}`, 56)}
                        </text>
                      )}

                      <text x="86" y="242" fontSize="104" fontWeight="600" fill="url(#blitz-rank-gradient)">
                        {highlightOrdinal}
                      </text>
                      <text
                        x="94"
                        y="272"
                        fontSize="14"
                        letterSpacing="0.28em"
                        fill="rgba(190, 240, 255, 0.74)"
                        style={{ textTransform: "uppercase" }}
                      >
                        Leaderboard Spot
                      </text>

                      <text
                        x="500"
                        y="170"
                        fontSize="13"
                        letterSpacing="0.3em"
                        fill="rgba(198, 248, 255, 0.78)"
                        textAnchor="middle"
                        style={{ textTransform: "uppercase" }}
                      >
                        Points Secured
                      </text>
                      <text x="500" y="214" fontSize="46" fontWeight="600" fill="#7bffe6" textAnchor="middle">
                        {highlightPointsValue}
                      </text>
                      <text x="500" y="244" fontSize="14" fill="rgba(178, 234, 247, 0.78)" textAnchor="middle">
                        Blitz Performance
                      </text>

                      {highlightName && (
                        <text x="94" y="308" fontSize="20" fontWeight="600" fill="#f1fffb">
                          {highlightName}
                        </text>
                      )}
                      {highlightSecondaryLabel && (
                        <text x="94" y={highlightName ? 330 : 308} fontSize="14" fill="rgba(200, 242, 255, 0.78)">
                          {highlightSecondaryLabel}
                        </text>
                      )}

                      <text
                        x="560"
                        y="312"
                        fontSize="12"
                        fill="rgba(160, 236, 255, 0.58)"
                        textAnchor="end"
                        letterSpacing="0.28em"
                        style={{ textTransform: "uppercase" }}
                      >
                        Realms Blitz
                      </text>
                      <image
                        href="/images/logos/starknet-logo.png"
                        x="560"
                        y="322"
                        width="30"
                        height="30"
                        preserveAspectRatio="xMidYMid meet"
                        opacity="0.9"
                      />
                      <text
                        x="560"
                        y="340"
                        fontSize="12"
                        fill="rgba(144, 224, 255, 0.72)"
                        textAnchor="end"
                        letterSpacing="0.1em"
                      >
                        Powered by Starknet
                      </text>
                    </g>

                    <rect
                      width="640"
                      height="360"
                      rx="44"
                      fill="none"
                      stroke="rgba(115, 244, 255, 0.38)"
                      strokeWidth="1.5"
                    />
                  </svg>
                ) : (
                  <div className="flex h-[220px] w-full max-w-[720px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/60">
                    Final standings are syncing…
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Button
                  onClick={copyLeaderboardImage}
                  disabled={isCopying || topThreePlayers.length === 0}
                  className="w-full flex-1 justify-center gap-2 !px-4 !py-3 md:!px-6"
                  variant="gold"
                  aria-busy={isCopying}
                  forceUppercase={false}
                >
                  <Copy className="h-4 w-4" />
                  <span>{isCopying ? "Preparing image…" : "Copy highlight image"}</span>
                </Button>
                <Button
                  onClick={handleShareOnX}
                  disabled={topThreePlayers.length === 0}
                  className="w-full flex-1 justify-center gap-2 !px-4 !py-3 md:!px-6"
                  variant="outline"
                  forceUppercase={false}
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share on X</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
