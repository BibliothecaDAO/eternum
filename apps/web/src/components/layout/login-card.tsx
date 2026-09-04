import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { StarknetWalletButton } from "./starknet-wallet-button";

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-baseline gap-2 px-1">
      <span className="text-primary text-xs">&#x25C6;</span>
      <div>
        <h3 className="realm-card-title text-sm">{title}</h3>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

export function LoginCard() {
  return (
    <Card className="mx-auto mt-12 w-full max-w-md">
      <CardHeader className="pb-2 text-center">
        <p className="realm-eyebrow">Enter The Realm</p>
        <CardTitle className="text-2xl">Welcome to Realms Portal</CardTitle>
        <CardDescription>Connect your wallet to access the Realms ecosystem</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <FeatureItem title="Bridge Assets" description="Transfer assets between Ethereum and StarkNet" />
          <FeatureItem title="LORDS Claiming" description="Claim and manage your LORDS tokens" />
          <FeatureItem title="veLORDS Staking" description="Stake LORDS to earn rewards and voting power" />
          <FeatureItem title="Governance" description="Participate in shaping the future of Realms" />
        </div>

        <StarknetWalletButton className="w-full" variant="reference" />
      </CardContent>
    </Card>
  );
}
