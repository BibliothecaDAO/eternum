/**
 * Properly formats an address by converting to bigint and padding to 64 hex characters
 * This ensures consistent address formatting for database queries by:
 * 1. Converting the input string to bigint (handles various formats)
 * 2. Converting back to hex string (normalizes the format)
 * 3. Padding with leading zeros to exactly 64 characters
 * 4. Adding the 0x prefix
 *
 * Example: "0x1234" -> "0x0000000000000000000000000000000000000000000000000000000000001234"
 */
export function formatAddressForQuery(address: string): string {
  // Convert string to bigint to normalize it
  const addressBigInt = BigInt(address);

  // Convert back to hex string (without 0x prefix)
  const hexString = addressBigInt.toString(16);

  // Pad with leading zeros to make it 64 characters
  const paddedHex = hexString.padStart(64, "0");

  // Add 0x prefix back
  return `0x${paddedHex}`;
}

/**
 * Safely encodes a query string for URL parameters
 */
export function encodeQuery(query: string): string {
  return encodeURIComponent(query);
}

/**
 * Constructs the full API URL with the encoded query
 */
export function buildApiUrl(baseUrl: string, query: string): string {
  return `${baseUrl}?query=${encodeQuery(query)}`;
}

/**
 * Generic function to handle API responses with error checking
 */
export async function fetchWithErrorHandling<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${errorMessage}: ${response.statusText}`);
  }

  return await response.json();
}
