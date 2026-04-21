import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Gather financial context
    const [{ data: txns }, { data: cats }, { data: bills }, { data: accts }] = await Promise.all([
      supabase.from('transactions').select('date, description, amount, category_id').order('date', { ascending: false }).limit(100),
      supabase.from('categories').select('id, name, type'),
      supabase.from('recurring_bills').select('name, amount, status'),
      supabase.from('allocation_accounts').select('name, percentage, tag'),
    ]);

    const catMap = new Map((cats || []).map(c => [c.id, c]));
    const totalRev = (txns || []).filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    const totalExp = Math.abs((txns || []).filter(t => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0));
    const netIncome = totalRev - totalExp;

    // Build category summaries
    const catSummary: Record<string, number> = {};
    (txns || []).forEach(t => {
      const cat = catMap.get(t.category_id);
      const name = cat?.name || 'Uncategorized';
      catSummary[name] = (catSummary[name] || 0) + Math.abs(Number(t.amount));
    });
    const topCats = Object.entries(catSummary).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const goodBills = (bills || []).filter(b => b.status === 'good');
    const billsTotal = goodBills.reduce((s, b) => s + Number(b.amount), 0);

    const context = `You are Solaris AI, a financial assistant for a personal finance app.

User's YTD financial snapshot:
- Revenue: $${totalRev.toFixed(2)}
- Expenses: $${totalExp.toFixed(2)}
- Net Income: $${netIncome.toFixed(2)}
- Margin: ${totalRev > 0 ? ((netIncome / totalRev) * 100).toFixed(1) : '0'}%
- Active recurring bills: ${goodBills.length} totaling $${billsTotal.toFixed(2)}/month
- Allocation accounts: ${(accts || []).map(a => `${a.name} (${a.percentage}%${a.tag ? ', ' + a.tag : ''})`).join(', ') || 'None set up'}

Top spending categories:
${topCats.map(([name, amt]) => `- ${name}: $${amt.toFixed(2)}`).join('\n')}

Recent bills: ${goodBills.slice(0, 5).map(b => `${b.name} $${Number(b.amount).toFixed(2)}`).join(', ')}

Answer the user's question concisely in 3-5 sentences. Be confident and specific. Use dollar amounts when relevant.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: context,
      messages: [{ role: 'user', content: question }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ answer: text });
  } catch (error) {
    console.error('Ask AI error:', error);
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}
