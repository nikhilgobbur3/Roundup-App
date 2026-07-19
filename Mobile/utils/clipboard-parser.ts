export interface DetectedTransaction {
  amount: number;
  merchant?: string;
  raw: string;
}

interface AmountMatch {
  value: number;
  index: number;
}

function extractAmount(text: string): AmountMatch | null {
  const patterns = [
    /(?:Rs|₹|INR|Rs\.)\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*(?:Rs|₹|INR)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(num) && num > 0) {
        return { value: num, index: m.index ?? 0 };
      }
    }
  }
  return null;
}

function extractMerchant(text: string, amountIdx: number): string | undefined {
  const keywords = /(?:at|to|for|payment\s*(?:at|to|for)|merchant\s*[:]?)\s*([A-Za-z0-9\s.&'-]+?)(?:\s*(?:on|via|upi|ref|txn|on\s|$))/i;
  const m = text.slice(amountIdx).match(keywords);
  if (m) {
    const name = m[1].trim();
    if (name.length > 0 && name.length < 50) {
      return name;
    }
  }
  return undefined;
}

const seenTexts = new Set<string>();

export function parseClipboard(text: string): DetectedTransaction | null {
  const trimmed = text.trim();
  if (!trimmed || seenTexts.has(trimmed)) {
    return null;
  }

  const amount = extractAmount(trimmed);
  if (!amount) return null;

  const merchant = extractMerchant(trimmed, amount.index);
  return { amount: amount.value, merchant, raw: trimmed };
}

export function markAsSeen(text: string) {
  seenTexts.add(text.trim());
}
