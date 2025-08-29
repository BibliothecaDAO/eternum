import { ROUTES } from "@/shared/consts/routes";
import { useWallet } from "@/shared/hooks/use-wallet";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { TermsOfService } from "./terms-of-service";

const TOS_ACCEPTED_KEY = "eternum_tos_accepted";

export function LoginPage() {
  const navigate = useNavigate();
  const { connectWallet, isConnecting, isConnected, displayAddress } = useWallet();
  const [hasAcceptedTS, setHasAcceptedToS] = useState(false);
  const [showToS, setShowToS] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(TOS_ACCEPTED_KEY) === "true";
    setHasAcceptedToS(accepted);
  }, []);

  const handleAcceptToS = () => {
    localStorage.setItem(TOS_ACCEPTED_KEY, "true");
    setHasAcceptedToS(true);
    setShowToS(false);
  };

  const handleConnect = async () => {
    if (!hasAcceptedTS) {
      setShowToS(true);
      return;
    }

    try {
      await connectWallet();
      navigate({ to: ROUTES.HOME });
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-4">
      <img src="/images/eternum-logo-words.svg" alt="Eternum Logo" className="w-3/4 my-12" />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome to Eternum</CardTitle>
          <CardDescription>
            {isConnected ? `Connected with wallet: ${displayAddress}` : "Connect your wallet to start playing"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
            {isConnecting
              ? "Connecting..."
              : isConnected
                ? "Start Game"
                : hasAcceptedTS
                  ? "Connect Wallet"
                  : "Accept Terms of Service"}
          </Button>
        </CardContent>
      </Card>

      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          The mobile client is designed as a companion app and does not provide the full game experience. For the
          complete experience, including all features and content, please use the desktop application.
        </AlertDescription>
      </Alert>

      <p className="text-sm text-center text-muted-foreground mt-4 max-w-md">
        By continuing you are agreeing to Eternum's{" "}
        <button onClick={() => setShowToS(true)} className="underline hover:text-gold transition-colors">
          Terms of Service
        </button>
        {hasAcceptedTS && " (Accepted)"}
      </p>

      <Dialog open={showToS} onOpenChange={setShowToS}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0">
          <TermsOfService onAccept={handleAcceptToS} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
