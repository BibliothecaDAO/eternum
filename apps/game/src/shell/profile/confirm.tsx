import { Button } from "@/ui/design-system/kit/button";
import { Sheet } from "@/ui/design-system/kit/sheet";

import { PROFILE_WORDS } from "../words";

/**
 * A destructive step asks first: the question, its cost in one sentence, Keep as the primary and the destructive verb
 * last, outline. A bottom sheet on a phone; on a desktop docked at the page's right and sized to its content, like
 * every panel.
 */
export const Confirm = ({
  question,
  cost,
  verb,
  doing,
  onConfirm,
  onKeep,
}: {
  question: string;
  cost: string;
  verb: string;
  /** The verb's step while it runs ("Removing…"). */
  doing?: string;
  onConfirm: () => void;
  onKeep: () => void;
}) => {
  const body = (
    <div className="flex flex-col gap-3 py-2">
      <h2 className="font-ui text-[20px] font-bold text-kit-cream">{question}</h2>
      <p className="text-[15px] text-kit-muted">{cost}</p>
      <Button role="primary" word={PROFILE_WORDS.keep} onClick={onKeep} />
      <Button role="outline" word={verb} loading={doing} onClick={onConfirm} />
    </div>
  );
  return (
    <Sheet label={question} onClose={onKeep} placement="page">
      {body}
    </Sheet>
  );
};
