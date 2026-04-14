import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categorizeTransactions } from '@/lib/ai/claude';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all uncategorized transactions for this user
    const { data: uncategorized } = await supabase
      .from('transactions')
      .select('id, description, amount')
      .eq('user_id', user.id)
      .is('category_id', null);

    if (!uncategorized || uncategorized.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No uncategorized transactions' });
    }

    // Get user's categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user.id);

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        error: 'No categories defined. Create categories first so AI has something to match.',
      }, { status: 400 });
    }

    const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    // Batch through AI
    const batchSize = 50;
    let updated = 0;

    for (let i = 0; i < uncategorized.length; i += batchSize) {
      const batch = uncategorized.slice(i, i + batchSize);
      const forAi = batch.map((t) => ({
        description: t.description,
        amount: Number(t.amount),
      }));

      const results = await categorizeTransactions(forAi, categories);

      // Update each transaction with its AI-assigned category
      for (let j = 0; j < batch.length; j++) {
        const txn = batch[j];
        const ai = results[j];
        const categoryId = catMap.get(ai?.suggested_category?.toLowerCase() || '') || null;

        if (categoryId) {
          await supabase
            .from('transactions')
            .update({
              category_id: categoryId,
              // Also update description with AI's cleaned version
              description: ai.cleaned_description || txn.description,
            })
            .eq('id', txn.id);
          updated++;
        }
      }
    }

    return NextResponse.json({
      updated,
      total: uncategorized.length,
      still_uncategorized: uncategorized.length - updated,
    });
  } catch (error: unknown) {
    console.error('Recategorize error:', error);
    const message = error instanceof Error ? error.message : 'Recategorize failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
