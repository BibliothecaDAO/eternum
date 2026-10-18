import { type IconMeaning } from "@/ui/design-system/icon";
import type { Price } from "./button";

import type { Reason } from "./reasons";

/** The step that fixes a refusal: its word, its price where it has one, and its way. */
export type Fix = { word: string; icon?: IconMeaning; prices?: readonly Price[]; onFix: () => void };

/** Why a verb cannot run, and the fix where there is one. */
export type Refusal = { reason: Reason; fix?: Fix };
