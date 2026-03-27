export function readNamedArgumentValue(args, flag) {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  if (index + 1 >= args.length) {
    throw new Error(`Missing value for ${flag}`);
  }

  return args[index + 1];
}

export function readNamedListArgument(args, flag) {
  const value = readNamedArgumentValue(args, flag);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
