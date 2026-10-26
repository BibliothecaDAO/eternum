import { type IconMeaning } from "@/ui/design-system/icon";

/** Each depth's mark, the one picture every Frontier surface shows of it; the surface (0) has none. */
const DEPTH_MARKS: readonly IconMeaning[] = ["depth-1", "depth-2", "depth-3"];

export const reachMark = (depth: 1 | 2 | 3): IconMeaning => DEPTH_MARKS[depth - 1];
