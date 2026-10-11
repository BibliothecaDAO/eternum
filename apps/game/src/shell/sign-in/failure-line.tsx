/** An identity action's failure, the one line under the field it concerns; typing clears it. */
export const FailureLine = ({ line }: { line: string | null }) =>
  line ? (
    <p role="alert" className="text-center text-[15px] text-kit-red">
      {line}
    </p>
  ) : null;
