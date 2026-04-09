/**
 * Address normalization for cache key consistency.
 * Produces identical output for common formatting variations of the same address.
 * Follows USPS standard abbreviations.
 */

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bSTREET\b/g, 'ST'],
  [/\bAVENUE\b/g, 'AVE'],
  [/\bBOULEVARD\b/g, 'BLVD'],
  [/\bDRIVE\b/g, 'DR'],
  [/\bLANE\b/g, 'LN'],
  [/\bROAD\b/g, 'RD'],
  [/\bCOURT\b/g, 'CT'],
  [/\bCIRCLE\b/g, 'CIR'],
  [/\bPLACE\b/g, 'PL'],
  [/\bAPARTMENT\b/g, 'APT'],
  [/\bSUITE\b/g, 'STE'],
  [/\bNORTH\b/g, 'N'],
  [/\bSOUTH\b/g, 'S'],
  [/\bEAST\b/g, 'E'],
  [/\bWEST\b/g, 'W'],
];

export function normalizeAddress(address: string): string {
  let result = address
    // 1. Uppercase everything
    .toUpperCase()
    // 2. Remove periods (handles "St." -> "ST")
    .replace(/\./g, '')
    // 3. Normalize comma spacing: ensure ", " after commas
    .replace(/\s*,\s*/g, ', ')
    // 4. Collapse multiple spaces to single space
    .replace(/\s+/g, ' ')
    // 5. Trim leading/trailing whitespace
    .trim();

  // 6. Apply abbreviation substitutions
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }

  return result;
}
