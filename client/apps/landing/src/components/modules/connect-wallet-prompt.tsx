import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Connector } from "@starknet-react/core";
import { Wallet } from "lucide-react";

interface ConnectWalletPromptProps {
  connectors: Connector[];
  connect: (options: { connector: Connector }) => void;
  message?: string;
}

export function ConnectWalletPrompt({ connectors, connect, message }: ConnectWalletPromptProps) {
  const defaultMessage = "Please connect your Starknet wallet to proceed.";

  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center shadow-lg border-gold/30 animate-fade-in">
        <CardHeader>
          <div className="mx-auto bg-gradient-to-br from-amber-400 to-yellow-500 p-3 rounded-full mb-4 w-fit">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Connect Your Wallet</CardTitle>
          <CardDescription className="text-muted-foreground">
            {message || defaultMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {connectors.map((connector) => (
            <Button
              key={connector.id}
              onClick={() => connect({ connector })}
              variant="default"
              size="lg"
              className="w-full flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] font-semibold"
            >
              {connector.icon && typeof connector.icon === 'string' && (
                <img src={connector.icon} alt={`${connector.name} icon`} className="w-6 h-6" />
              )}
               {connector.icon && typeof connector.icon !== 'string' && connector.id !== 'argentX' && connector.id !== 'braavos' &&( // Handle potential ReactNode icons differently if needed
                 // Attempt to render ReactNode icon, may need adjustment based on actual structure
                 <span className="w-6 h-6 flex items-center justify-center">{connector.icon.light ?? connector.icon}</span>
               )}
              Connect {connector.name}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
} 