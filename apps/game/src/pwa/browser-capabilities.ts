export function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isInstalledPwa(): boolean {
  return !!(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone
  );
}

export function pwaInstallInstructions(): string {
  if (isAppleMobile())
    return "In Safari, open Share, choose Add to Home Screen, then tap Add. If shown, leave Open as Web App enabled.";
  const safari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(navigator.userAgent);
  if (safari && /Mac/.test(navigator.platform)) return "In Safari, choose File → Add to Dock, then click Add.";
  if (/Android/.test(navigator.userAgent))
    return "In Chrome, open the ⋮ menu, choose Add to Home screen, then Install. Use a regular browsing tab.";
  if (/Firefox/.test(navigator.userAgent))
    return "Open this site in Chrome, Edge, or Safari to install Realms on your desktop.";
  return "Open your browser's menu and choose Install app or Save and share → Install page as app. Use a regular browsing window.";
}
