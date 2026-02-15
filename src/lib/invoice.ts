import { type Address, stringToHex, pad } from "viem";
import { TOKEN_BY_ADDRESS, type TokenInfo } from "@/constants";

// ── Invoice Type ──────────────────────────────────────────────────────
export interface Invoice {
  /** Merchant wallet address */
  merchant: Address;
  /** Payment amount in human-readable units (e.g. "50.00") */
  amount: string;
  /** Merchant's preferred token address */
  token: Address;
  /** Invoice description (e.g. "Web design services") */
  description: string;
  /** Unique reference ID (e.g. "INV-001") */
  reference: string;
  /** Optional merchant display name */
  merchantName?: string;
}

// ── Encoding / Decoding ───────────────────────────────────────────────

/** Encode invoice data as a URL-safe base64 string */
export function encodeInvoice(invoice: Invoice): string {
  const json = JSON.stringify(invoice);
  // Use btoa for base64, then make URL-safe
  const base64 = btoa(json);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url string back to an Invoice */
export function decodeInvoice(encoded: string): Invoice | null {
  try {
    // Restore standard base64 from URL-safe variant
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    const json = atob(base64);
    const parsed = JSON.parse(json);

    // Validate required fields
    if (
      !parsed.merchant ||
      !parsed.amount ||
      !parsed.token ||
      !parsed.reference
    ) {
      return null;
    }

    return parsed as Invoice;
  } catch {
    return null;
  }
}

// ── Memo Derivation ───────────────────────────────────────────────────

/** Derive a deterministic 32-byte memo from an invoice reference string */
export function invoiceMemo(reference: string): `0x${string}` {
  return pad(stringToHex(reference), { size: 32 });
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Get token info from an invoice's token address */
export function getInvoiceToken(invoice: Invoice): TokenInfo | undefined {
  return TOKEN_BY_ADDRESS[invoice.token.toLowerCase()];
}

/** Build the full payment URL for an invoice */
export function buildPayUrl(invoice: Invoice): string {
  const encoded = encodeInvoice(invoice);
  return `/pay/${encoded}`;
}

/** Build the full receipt URL for an invoice */
export function buildReceiptUrl(invoice: Invoice): string {
  const encoded = encodeInvoice(invoice);
  return `/receipt/${encoded}`;
}

/** Truncate an address for display: 0x1234...5678 */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
