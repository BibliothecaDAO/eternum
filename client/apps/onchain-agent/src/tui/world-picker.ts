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
    const maxVisible = Math.min(worlds.length, process.stdout.rows ? process.stdout.rows - 2 : 20);
    const selectList = new SelectList(items, maxVisible, theme);
    let resolved = false;
    let lineCount = 0;

    const render = () => {
      const width = process.stdout.columns || 80;
      const lines = selectList.render(width);
      // Erase previous render, then write new lines
      if (lineCount > 0) {
        process.stdout.write(`\x1b[${lineCount}A\x1b[J`);
      }
      process.stdout.write(lines.join("\n") + "\n");
      lineCount = lines.length;
    };

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      process.stdin.setRawMode(false);
      process.stdin.removeListener("data", onData);
      process.stdout.write("\x1b[?25h"); // show cursor
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
    process.stdout.write("\x1b[?25l"); // hide cursor
    render();
  });
}
