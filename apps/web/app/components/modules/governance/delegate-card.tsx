import type { RouterOutputs } from "@/router";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ReadMore } from "@/components/ui/read-more";
import { useCurrentDelegate } from "@/hooks/governance/use-current-delegate";
import { useDelegateRealms } from "@/hooks/governance/use-delegate-realms";
import { useStarkDisplayName } from "@/hooks/use-stark-name";
import { toast } from "@/hooks/use-toast";
import { formatAddress, formatNumber } from "@/utils/utils";
import { UserPen } from "lucide-react";
import { num } from "starknet";

export function DelegateCard({
  delegate,
}: {
  delegate: RouterOutputs["delegates"]["all"]["items"][number];
}) {
  const { data: currentDelegate } = useCurrentDelegate();
  const isCurrentDelegate =
    currentDelegate &&
    formatAddress(num.toHex(currentDelegate)) === delegate.user;

  const { sendAsync: delegateRealms } = useDelegateRealms({
    delegatee: delegate.user,
  });
  // Handler function when a delegate button is clicked.
  const handleDelegate = async () => {
    await delegateRealms();
    toast({
      title: "Delegation successful",
      description: "You have successfully delegated your Realms",
    });
  };

  // Utility function to return the proper React icon for each platform
  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      /*case "twitter":
        return <FaTwitter className="text-blue-500" />;
      case "linkedin":
        return <FaLinkedin className="text-blue-700" />;
      case "github":
        return <FaGithub className="text-gray-800" />;*/
      default:
        return null;
    }
  };

  const socialMedia = {
    twitter: delegate.delegateProfile?.twitter,
    github: delegate.delegateProfile?.github,
    telegram: delegate.delegateProfile?.telegram,
    discord: delegate.delegateProfile?.discord,
  };

  const name = useStarkDisplayName(delegate.user as `0x${string}`);

  return (
    <Card key={delegate.id} className="">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage
                alt={name}
                src={`https://cdn.stamp.fyi/avatar/${delegate.user}?s=64`}
              />
            </Avatar>
            <h2 className="text-xl font-bold">{name}</h2>
          </div>
          {isCurrentDelegate ? <Badge>Current Delegate</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xl">
          {formatNumber(Number(delegate.delegatedVotes), 0)}{" "}
          <span className="text-muted-foreground text-sm uppercase">
            Votes Delegated
          </span>
        </p>

        <div className="flex flex-wrap gap-2">
          {delegate.delegateProfile?.interests
            ?.slice(0, 3)
            .map((interest, index) => (
              <Badge
                key={index}
                variant={"outline"}
                className="px-1 py-0.5 text-xs"
              >
                {interest}
              </Badge>
            ))}
          {delegate.delegateProfile?.interests &&
            delegate.delegateProfile.interests.length > 3 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Badge
                    variant={"outline"}
                    className="cursor-pointer px-1 py-0.5 text-xs"
                  >
                    +{delegate.delegateProfile.interests.length - 3}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-96">
                  <div className="flex flex-wrap gap-1">
                    {delegate.delegateProfile.interests
                      .slice(3)
                      .map((interest, index) => (
                        <Badge
                          key={index}
                          variant={"outline"}
                          className="px-1 py-0.5 text-xs"
                        >
                          {interest}
                        </Badge>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
        </div>

        <div className="mt-2 text-lg">
          <ReadMore
            id={delegate.id}
            text={delegate.delegateProfile?.statement ?? ""}
          />
        </div>

        <div className="flex items-center">
          {Object.entries(socialMedia).map(([platform, url]) => (
            <a
              key={platform}
              href={url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-4"
            >
              {getSocialIcon(platform)}
            </a>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          disabled={isCurrentDelegate}
          onClick={() => handleDelegate()}
          className=""
        >
          <UserPen className="h-4 w-4" />
          Choose Delegate
        </Button>
      </CardFooter>
    </Card>
  );
}
