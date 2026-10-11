import type { IconCode } from "@/ui/design-system/kit/kit-icon";

/** Each Ethereal reach's mark, the one picture every Frontier surface shows of it; the surface (0) has none. */
const REACH_MARKS: readonly IconCode[] = ["E1", "E2", "E3"];

export const reachMark = (depth: 1 | 2 | 3): IconCode => REACH_MARKS[depth - 1];
