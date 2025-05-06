import { ROUTES } from "@/shared/consts/routes";
import { useWallet } from "@/shared/hooks/use-wallet";
import { useStore } from "@/shared/store";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { TermsOfService } from "./terms-of-service";

export function LoginPage() {
  const navigate = useNavigate();
  const { connectWallet, isConnecting, isConnected, displayAddress } = useWallet();
  const hasAcceptedToS = useStore((state) => state.hasAcceptedToS);
  const showToS = useStore((state) => state.showToS);
  const setShowToS = useStore((state) => state.setShowToS);

  const handleConnect = async () => {
    if (!hasAcceptedToS) {
      setShowToS(true);
      return;
    }

    try {
      await connectWallet();
      navigate({ to: ROUTES.REALM });
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-gradient-to-b from-background to-background/80">
      <img src="/images/eternum-logo-words.svg" alt="Eternum Logo" className="w-3/4 my-12 drop-shadow-lg" />

      <Card className="w-full max-w-md border-2 border-primary/20 shadow-xl bg-background/95 backdrop-blur-sm">
        <CardHeader className="space-y-4">
          <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Welcome to Eternum
          </CardTitle>
          <CardDescription className="text-center text-base">
            {isConnected
              ? `Connected with wallet: ${displayAddress}`
              : "Connect your wallet to access your Eternum companion app"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isConnecting
              ? "Connecting..."
              : isConnected
                ? "Connected"
                : hasAcceptedToS
                  ? "Connect Wallet"
                  : "Accept Terms of Service"}
          </Button>
        </CardContent>
      </Card>

      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          The mobile client is designed as a companion app and does not provide the full game experience. For the
          complete experience, including all features and content, please use the desktop application.
        </AlertDescription>
      </Alert>

      <p className="text-sm text-center text-muted-foreground mt-6 max-w-md">
        By continuing you are agreeing to Eternum's{" "}
        <button onClick={() => setShowToS(true)} className="underline hover:text-primary transition-colors">
          Terms of Service
        </button>
        {hasAcceptedToS && " (Accepted)"}
      </p>

      <Dialog open={showToS} onOpenChange={setShowToS}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0">
          <TermsOfService />
        </DialogContent>
      </Dialog>
    </div>
  );
}
