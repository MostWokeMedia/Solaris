import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type CategorizeResult = {
  description: string;
  cleaned_description: string;
  suggested_category: string;
  confidence: 'high' | 'medium' | 'low';
};

export async function categorizeTransactions(
  transactions: { description: string; amount: number }[],
  existingCategories: { name: string; type: string }[]
): Promise<CategorizeResult[]> {
  const categoryList = existingCategories.map((c) => `${c.name} (${c.type})`).join(', ');

  const txnList = transactions
    .map((t, i) => `${i}. "${t.description}" ${t.amount < 0 ? 'expense' : 'income'} $${Math.abs(t.amount).toFixed(2)}`)
    .join('\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a financial transaction categorizer. Given bank transactions and a list of existing categories, categorize each transaction and clean up messy bank descriptions.

EXISTING CATEGORIES: ${categoryList}

TRANSACTIONS:
${txnList}

For each transaction, respond with a JSON array where each element has:
- "index": the transaction number
- "cleaned_description": a clean, readable version of the bank description (capitalize properly, expand abbreviations like "HEB" → "HEB Grocery", "DG" → "Dollar General", keep it concise)
- "suggested_category": the best matching category name from the existing list (use EXACT name from the list). If no category fits, use "Uncategorized"
- "confidence": "high" if clearly matches, "medium" if reasonable guess, "low" if uncertain

Important rules:
- Gas purchases at gas stations go to "Gas" category if it exists, unless it's clearly ranch-related (then "Reimbursement")
- Coffee and ice cream go to "Dining Out"
- Dog food (BJ raw, etc.) and pet insurance (Lemonade) go to "Dog Food/insur/Supply" or similar pet category
- Reimbursement checks and ranch expenses go to "Reimbursement" or "Sale of Body"
- Crypto purchases go to "Crypto"
- Only respond with the JSON array, no other text.`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return transactions.map((t) => ({
      description: t.description,
      cleaned_description: t.description,
      suggested_category: 'Uncategorized',
      confidence: 'low' as const,
    }));

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      cleaned_description: string;
      suggested_category: string;
      confidence: string;
    }>;

    return transactions.map((t, i) => {
      const match = parsed.find((p) => p.index === i);
      return {
        description: t.description,
        cleaned_description: match?.cleaned_description || t.description,
        suggested_category: match?.suggested_category || 'Uncategorized',
        confidence: (match?.confidence as 'high' | 'medium' | 'low') || 'low',
      };
    });
  } catch {
    return transactions.map((t) => ({
      description: t.description,
      cleaned_description: t.description,
      suggested_category: 'Uncategorized',
      confidence: 'low' as const,
    }));
  }
}
