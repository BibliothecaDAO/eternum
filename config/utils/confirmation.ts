/**
 * Prompts for confirmation when deploying to non-local environments
 * @param chain The target deployment chain
 * @throws {Error} If deployment is cancelled by user
 */
export function confirmNonLocalDeployment(chain: string): void {
  if (chain === "local") return;

  // Color mapping for different chains
  const chainColors: Record<string, string> = {
    mainnet: "31", // Red
    sepolia: "34", // Blue
    slot: "35", // Magenta
    default: "33", // Yellow
  };

  const chainColor = chainColors[chain.toLowerCase()] || chainColors.default;

  const warningBox = `
    \x1b[1;33m╔════════════════════ WARNING ════════════════════╗
    ║                                                 ║
    ║          SETTING CONFIGURATIONS FOR:            ║
    ║                                                 ║
    ║            \x1b[1;${chainColor}m>>> ${chain.toUpperCase()} NETWORK <<<\x1b[1;33m              
    ║                                                 ║
    ║   \x1b[1;36mAre you sure you want to proceed? (yes/no)\x1b[1;33m   ║
    ║                                                 ║
    ╚═================================================╝\x1b[0m
    `;

  const userConfirmation = prompt(warningBox);

  const validResponses = ["yes", "y"];
  if (!validResponses.includes(userConfirmation?.toLowerCase() ?? "")) {
    console.log("\x1b[1;31m❌ Deployment cancelled by user\x1b[0m");
    process.exit(0);
  }
}
