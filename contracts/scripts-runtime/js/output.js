const ANSI = {
  blue: "\u001b[34m",
  bold: "\u001b[1m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  reset: "\u001b[0m",
};

function shouldUseAnsiColors() {
  return process.stdout.isTTY && process.env.NO_COLOR === undefined;
}

function styleText(text, ...styles) {
  if (!shouldUseAnsiColors()) {
    return text;
  }

  return `${styles.join("")}${text}${ANSI.reset}`;
}

export function printRuntimeBanner(message) {
  console.log(`\n${styleText(`=== ${message} ===`, ANSI.bold, ANSI.cyan)}\n`);
}

export function printRuntimeStep(message) {
  console.log(`${styleText("->", ANSI.bold, ANSI.blue)} ${message}`);
}

export function printRuntimeAction(message) {
  console.log(`\n${styleText(message, ANSI.bold, ANSI.cyan)}\n`);
}

export function printRuntimeValue(label, value) {
  console.log(`${styleText(label, ANSI.dim)} ${value}`);
}

export function printRuntimeSuccess(message) {
  console.log(styleText(message, ANSI.green));
}
