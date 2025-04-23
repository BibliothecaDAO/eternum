import { useAccount } from "@starknet-react/core";

export const NotLoggedInMessage = () => {
  const { isConnected } = useAccount();

  if (isConnected) return null;

  return (
    <>
      <div className="bg-dark-wood panel-wood p-3 fixed left-1/2 transform -translate-x-1/2 bg-opacity-80 text-green text-center text-xxs md:text-base textpy-1 md:py-2 z-50 w-[200px] md:w-[300px] top-[60px] rounded-lg animate-pulse pointer-events-none">
        You are not logged in. The displayed realm is in view-only mode.
      </div>
    </>
  );
};
