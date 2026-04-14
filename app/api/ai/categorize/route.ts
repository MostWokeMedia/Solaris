import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categorizeTransactions } from '@/lib/ai/claude';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transactions } = await request.json() as {
      transactions: { description: string; amount: number }[];
    };

    if (!transactions?.length) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
    }

    // Get user's existing categories
    const { data: categories } = await supabase
      .from('categories')
      .select('name, type')
      .eq('user_id', user.id);

    // Batch in groups of 50 to stay within token limits
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchResults = await categorizeTransactions(batch, categories || []);
      results.push(...batchResults);
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Categorization error:', error);
    return NextResponse.json({ error: 'Categorization failed' }, { status: 500 });
  }
}
