import { AttributeFilters } from "@/components/modules/filters";
import { SeasonPassRow } from "@/components/modules/season-pass-row";
import { TypeH2 } from "@/components/typography/type-h2";
import { Button } from "@/components/ui/button";
import { createLazyFileRoute } from "@tanstack/react-router";

// TODO: Move to backend
const seasonPasses = [
  {
    title: "l'unpik",
    description: "1000 Lords",
    owner: "0x1234...5678",
    name: "Crimson Blade",
  },
  {
    title: "l'éclaireur",
    description: "500 Scouts",
    owner: "0xabcd...ef01",
    name: "Shadow Walker",
  },
  {
    title: "le gardien",
    description: "750 Guardians",
    owner: "0x2468...ace0",
    name: "Iron Shield",
  },
  
];

export const Route = createLazyFileRoute("/passes")({
  component: Passes,
});

function Passes() {
/*
  const [sortBy, setSortBy] = useQueryState(
    collectionSortByKey,
    collectionSortByParser,
  );
  const [sortDirection, setSortDirection] = useQueryState(
    collectionSortDirectionKey,
    collectionSortDirectionsParser,
  );
  const [buyNow, setBuyNow] = useQueryState(
    "buy_now",
    parseAsBoolean.withDefault(false),
  );
  const [filters, setFilters] = useQueryState<Filters>(
    "filters",
    parseAsJson<Filters>().withDefault({
      traits: {},
    }),
  );
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCollectionTokens({ collectionAddress: import.meta.env.VITE_SEASON_PASS_ADDRESS, filters, sortBy, sortDirection, buyNow })

  const collectionTokens: CollectionToken[] = useMemo(
    () => infiniteData.pages.flatMap((page) => page.data),
    [infiniteData],
  );
*/
  //const [selectedSeasonPass, setSelectedSeasonPass] = useState<SeasonPass | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10">
        <AttributeFilters />
      </div>
      <div className="flex-grow overflow-y-auto">
        <div className="flex flex-col gap-2">
          <SeasonPassRow seasonPasses={seasonPasses} />
        </div>
      </div>
      <div className="flex justify-end border border-gold/15 p-4 rounded-xl mt-4 sticky bottom-0 bg-brown gap-8">
        <TypeH2>10 Selected</TypeH2>
        <Button variant="cta">Buy a Season Pass</Button>
      </div>
    </div>
  );
}
