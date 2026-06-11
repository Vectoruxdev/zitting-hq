/**
 * Receipt scanning — reads merchant, date, total, and line items off a
 * receipt photo with Claude vision (claude-haiku-4-5: cheap, fast, excellent
 * at receipts). Plain fetch against the Messages API — no SDK dependency.
 * Server-only (uses ANTHROPIC_API_KEY). Never throws: returns null when the
 * key is missing, the call fails, or the model can't read the image — the
 * caller degrades to manual entry.
 */

export const isScanConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export interface ScannedLine {
  name: string;
  qty: number | null;
  price: number | null;
}

export interface ScannedReceipt {
  merchant: string | null;
  dateISO: string | null; // YYYY-MM-DD as printed on the receipt
  total: number | null;
  lines: ScannedLine[];
}

// Structured-output schema (output_config.format): every object closed with
// additionalProperties:false, no unsupported constraints.
const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    is_receipt: { type: "boolean", description: "False when the image is not a purchase receipt." },
    merchant: { anyOf: [{ type: "string" }, { type: "null" }], description: "Store/merchant name as printed." },
    date: { anyOf: [{ type: "string" }, { type: "null" }], description: "Purchase date as YYYY-MM-DD, null if unreadable." },
    total: { anyOf: [{ type: "number" }, { type: "null" }], description: "Grand total actually charged (after tax/discounts)." },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Item name, cleaned up (e.g. 'Whole milk 2%' not 'WHL MLK 2PCT')." },
          qty: { anyOf: [{ type: "number" }, { type: "null" }] },
          price: { anyOf: [{ type: "number" }, { type: "null" }], description: "Extended line price (qty x unit), as charged." },
        },
        required: ["name", "qty", "price"],
        additionalProperties: false,
      },
    },
  },
  required: ["is_receipt", "merchant", "date", "total", "items"],
  additionalProperties: false,
} as const;

const PROMPT = `Read this receipt photo. Extract the merchant, the purchase date, the grand total actually charged, and every line item with its quantity and extended price. Clean up abbreviated item names into plain words. Include discounts as negative-price lines. Exclude subtotal/tax/total/change rows from items (tax is part of the total, not an item). If the image is not a receipt, set is_receipt to false.`;

/** Scan a receipt image (base64-encoded). ~1-2s, well under a cent per call. */
export async function scanReceiptImage(
  base64Data: string,
  mediaType: string
): Promise<ScannedReceipt | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        output_config: { format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[receiptScan] API error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const msg = (await res.json()) as {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    };
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") return null;
    const text = (msg.content || []).find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as {
      is_receipt: boolean;
      merchant: string | null;
      date: string | null;
      total: number | null;
      items: { name: string; qty: number | null; price: number | null }[];
    };
    if (!parsed.is_receipt) return null;
    const dateISO = parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
    return {
      merchant: parsed.merchant?.trim() || null,
      dateISO,
      total: typeof parsed.total === "number" && isFinite(parsed.total) ? Math.round(parsed.total * 100) / 100 : null,
      lines: (parsed.items || [])
        .filter((i) => i.name && i.name.trim())
        .slice(0, 200)
        .map((i) => ({
          name: i.name.trim(),
          qty: typeof i.qty === "number" && isFinite(i.qty) ? i.qty : null,
          price: typeof i.price === "number" && isFinite(i.price) ? Math.round(i.price * 100) / 100 : null,
        })),
    };
  } catch (err) {
    console.error("[receiptScan] failed", err);
    return null;
  }
}
