import { SelectList, type SelectItem, type SelectListTheme } from "@mariozechner/pi-tui";
import type { DiscoveredWorld } from "../world/discovery";

const theme: SelectListTheme = {
  selectedPrefix: (text: string) => `> ${text}`,
  selectedText: (text: string) => `\x1b[1m${text}\x1b[0m`,
  description: (text: string) => text,
  scrollInfo: (text: string) => text,
  noMatch: (text: string) => text,
};

function buildItems(worlds: DiscoveredWorld[]): SelectItem[] {
  const labels = worlds.map((w) => `[${w.chain}] ${w.name}`);
  const maxLen = Math.max(...labels.map((l) => l.length));

  return worlds.map((w, i) => {
    const status = w.status !== "unknown" ? w.status : "";
    return {
      value: `${w.chain}:${w.name}`,
      label: labels[i].padEnd(maxLen + 2) + status,
    };
  });
}

export function createWorldPicker(worlds: DiscoveredWorld[]): Promise<DiscoveredWorld | null> {
  return new Promise((resolve) => {
    const items = buildItems(worlds);
    const termRows = typeof process.stdout.rows === "number" && process.stdout.rows > 0 ? process.stdout.rows : 24;
    const maxVisible = Math.min(worlds.length, termRows - 2, 30);
    const selectList = new SelectList(items, maxVisible, theme);
    let resolved = false;
    let lastLineCount = 0;

    const render = () => {
      const width = process.stdout.columns || 80;
      const lines = selectList.render(width);
      // Clear previous picker lines, then redraw in place
      let out = "";
      if (lastLineCount > 0) {
        // Move up to the start of the previous render and clear from there
        out += `\x1b[${lastLineCount}A\x1b[J`;
      }
      out += lines.join("\n") + "\n";
      lastLineCount = lines.length;
      process.stdout.write(out);
    };

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      process.stdin.setRawMode(false);
      process.stdin.removeListener("data", onData);
      // Clear picker lines and show cursor
      if (lastLineCount > 0) {
        process.stdout.write(`\x1b[${lastLineCount}A\x1b[J`);
      }
      process.stdout.write("\x1b[?25h");
    };

    selectList.onSelect = (item: SelectItem) => {
      cleanup();
      const [chain, ...rest] = item.value.split(":");
      const name = rest.join(":");
      const selected = worlds.find((w) => w.chain === chain && w.name === name) ?? null;
      resolve(selected);
    };

    selectList.onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onData = (data: Buffer) => {
      const str = data.toString();
      // Ctrl+C
      if (str === "\x03") {
        cleanup();
        process.exit(0);
      }
      selectList.handleInput(str);
      render();
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
    // Hide cursor, render picker below existing output
    process.stdout.write("\x1b[?25l");
    render();
  });
}
