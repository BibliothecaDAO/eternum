import { Hourglass } from "@/ui/design-system/atoms/game-icons";
import { Chip } from "@/ui/features/frontier/frontier-chips";

/** A finished game stays listed while its records cannot be read (results, until they move to the failure owner). */
export const UnavailableChip = () => <Chip small label="Game" icon={<Hourglass />} value="Unavailable" />;
