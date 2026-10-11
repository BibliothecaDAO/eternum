import { GameplayAccountSync } from "@/hooks/context/gameplay-account-sync";

/**
 * The shell's account runtime: the gameplay account sync, one lazy chunk that AppShell mounts once a session exists
 * on either layout; it loads no wallet.
 */
export default function AccountRuntime() {
  return <GameplayAccountSync>{null}</GameplayAccountSync>;
}
