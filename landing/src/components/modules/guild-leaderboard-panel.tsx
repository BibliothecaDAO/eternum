import { Guild } from "@/types";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { ResourceIcon } from "../ui/elements/ResourceIcon";
import { Input } from "../ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface GuildLeaderboardPanelProps {
  /** Title displayed at the top of the leaderboard */
  title?: string;
  /** Array of players to display in the leaderboard */
  guilds: Guild[];
  /** Custom class name for the card container */
  className?: string;
  /** Whether to show player rankings */
  showRank?: boolean;
  /** Custom points suffix (e.g. "pts", "points", etc) */
  pointsSuffix?: string;
}

export const GuildLeaderboardPanel = ({
  guilds,
  showRank = true,
  pointsSuffix = "pts",
}: GuildLeaderboardPanelProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const elementsPerPage = 10;

  const filteredGuilds = guilds.filter((guild) => guild.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalPages = Math.ceil(filteredGuilds.length / elementsPerPage);
  const startIndex = currentPage * elementsPerPage;
  const displayedGuilds = filteredGuilds.slice(startIndex, startIndex + elementsPerPage);

  return (
    <CardContent>
      <Input
        type="text"
        placeholder="Search guild..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
        }}
      />
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] items-center p-2 border-b border-gold/15 gap-x-8">
          {showRank && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="text-xl font-bold text-center w-8 hover:text-gold/80 transition-colors">#</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Guilds ranking position</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="font-medium truncate text-left hover:text-gold/80 transition-colors w-full">Guild</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Guild's name</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-right font-medium w-20 hover:text-gold/80 transition-colors tabular-nums">
                  Realms
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of realms owned</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-right font-medium w-20 hover:text-gold/80 transition-colors tabular-nums">
                  Mines
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of mines owned</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-right font-medium w-20 hover:text-gold/80 transition-colors tabular-nums">
                  Hypers
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of hyperstructures owned</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-right font-medium hover:text-gold/80 transition-colors tabular-nums w-32">
                  Points
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total points earned in the game</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-right font-medium w-20 hover:text-gold/80 transition-colors tabular-nums">
                  Share
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Percentage share of the prize pool</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-right font-medium w-32 hover:text-gold/80 transition-colors tabular-nums">
                  <div className="flex flex-row items-center justify-end w-full gap-1">
                    LORDS
                    <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>$LORDS tokens earned if game ends now</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {displayedGuilds.map((guild, index) => (
          <div
            key={startIndex + index}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] items-center p-2 border border-gold/15 rounded gap-x-8 ${
              index % 2 === 1 ? "bg-gold/5" : ""
            } hover:bg-gold/10 transition-colors cursor-pointer`}
          >
            {showRank && <div className="text-xl font-bold text-center w-8">{startIndex + index + 1}</div>}
            <div className="truncate w-20 text-left">{guild.name}</div>
            <div className="text-right w-20 tabular-nums">{guild.realms}</div>
            <div className="text-right w-20 tabular-nums">{guild.mines}</div>
            <div className="text-right w-20 tabular-nums">{guild.hyperstructures}</div>
            <div className="text-right w-36 tabular-nums">
              {guild.points.toLocaleString()} {pointsSuffix}
            </div>
            <div className="text-right w-20 tabular-nums">{guild.percentage.toFixed(2)}%</div>
            <div className="text-right w-32 tabular-nums flex items-center justify-end gap-1">
              {guild.lords.toLocaleString()}
              <ResourceIcon size="md" resource={ResourcesIds[ResourcesIds.Lords]} className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="hover:bg-gold/10 hover:border-gold/30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="hover:bg-gold/10 hover:border-gold/30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm text-gold/70 hover:text-gold transition-colors">
            {startIndex + 1}-{Math.min(startIndex + elementsPerPage, filteredGuilds.length)} of {filteredGuilds.length}
          </span>
        </div>
      )}
    </CardContent>
  );
};
