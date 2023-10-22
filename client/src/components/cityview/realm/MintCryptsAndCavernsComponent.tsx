import { useState } from "react";
import Button from "../../../elements/Button";

import { useDojo } from "../../../DojoContext";

export const MintCryptsAndCavernsComponent = () => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    setup: {
      systemCalls: { mint_cc },
    },
    account: { account },
  } = useDojo();


  const mintCC = async () => {
    await mint_cc({
      signer: account
    });
    setIsLoading(false);
  };

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="text-xxs mb-2 italic text-gold">
          {`Mint belongs to your Crypts and Caverns`}
        </div>
        <Button
          isLoading={isLoading}
          onClick={() => (!isLoading ? mintCC() : null)}
          className="mr-auto !h-6 mt-2 text-xxs !rounded-md !p-2"
          variant={!isLoading ? "success" : "danger"}
        >
          {!isLoading ? "Mint Crypts and Caverns " : ""}
        </Button>
      </div>
    </>
  );
};

export default MintCryptsAndCavernsComponent;
