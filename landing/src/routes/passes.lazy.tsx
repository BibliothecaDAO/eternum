import { Filters } from "@/components/modules/filters";
import { SeasonPassRow } from "@/components/modules/season-pass-row";
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
  {
    title: "l'archimage",
    description: "300 Mages",
    owner: "0xfedc...ba98",
    name: "Mystic Weaver",
  },
  {
    title: "le chasseur",
    description: "600 Hunters",
    owner: "0x9876...5432",
    name: "Swift Arrow",
  },
  {
    title: "l'alchimiste",
    description: "400 Brewers",
    owner: "0x1357...9bdf",
    name: "Potion Master",
  },
  {
    title: "le bâtisseur",
    description: "800 Builders",
    owner: "0xaceg...ikmo",
    name: "Stone Shaper",
  },
  {
    title: "l'espion",
    description: "250 Spies",
    owner: "0x2468...0246",
    name: "Whisper",
  },
  {
    title: "le marchand",
    description: "450 Traders",
    owner: "0xbdfh...jlnp",
    name: "Golden Hand",
  },
  {
    title: "le diplomate",
    description: "350 Envoys",
    owner: "0x1357...9bdf",
    name: "Silver Tongue",
  },
  {
    title: "le forgeron",
    description: "550 Smiths",
    owner: "0xqrst...uvwx",
    name: "Hammer's Might",
  },
  {
    title: "l'érudit",
    description: "200 Scholars",
    owner: "0xyzab...cdef",
    name: "Sage Mind",
  },
  {
    title: "le guérisseur",
    description: "400 Healers",
    owner: "0xghij...klmn",
    name: "Life Bringer",
  },
  {
    title: "le barde",
    description: "300 Minstrels",
    owner: "0xopqr...stuv",
    name: "Melody Weaver",
  },
  {
    title: "le druide",
    description: "350 Nature Guardians",
    owner: "0xwxyz...2345",
    name: "Leaf Speaker",
  },
  {
    title: "le champion",
    description: "100 Heroes",
    owner: "0x6789...0123",
    name: "Legendary Warrior",
  },
];

export const Route = createLazyFileRoute("/passes")({
  component: Passes,
});

function Passes() {
  return (
    <div>
      <Filters />
      <SeasonPassRow seasonPasses={seasonPasses} />
    </div>
  );
}
