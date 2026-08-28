import { isConnectedGameplayAccount, useGameplayAccountAddress } from "@/hooks/use-gameplay-account";

export const NotLoggedInMessage = () => {
  const address = useGameplayAccountAddress();

  if (isConnectedGameplayAccount(address)) return null;

  return (
    <>
      <div className="border border-gold/30 bg-[#1a1410]/95 p-3 fixed left-1/2 transform -translate-x-1/2 text-green text-center text-xxs md:text-base textpy-1 md:py-2 z-50 w-[200px] md:w-[300px] top-[60px] rounded-lg animate-pulse pointer-events-none">
        You are not logged in. The displayed realm is in view-only mode.
      </div>
    </>
  );
};
