export function createPausedLabel() {
  const div = document.createElement("div");
  div.classList.add("rounded-md", "bg-black/50", "text-gold", "p-1", "-translate-x-1/2", "text-xs");
  div.textContent = `⚠️ Production paused`;
  return div;
}
