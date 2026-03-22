/**
 * Parse a CLI resource shorthand string into typed resource amounts.
 *
 * Format: `"resourceId:amount,resourceId:amount,..."` e.g. `"38:100,3:500"`
 */
export function parseResources(input: string): Array<{ resourceId: number; amount: number }> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty resource string. Use format: '38:100,3:500'");

  return trimmed.split(",").map((pair) => {
    const [idStr, amountStr] = pair.trim().split(":");
    const resourceId = Number(idStr);
    const amount = Number(amountStr);
    if (!Number.isFinite(resourceId) || !Number.isFinite(amount) || !amountStr) {
      throw new Error(`Invalid resource format: "${pair.trim()}". Use format: 'resourceId:amount'`);
    }
    return { resourceId, amount };
  });
}
