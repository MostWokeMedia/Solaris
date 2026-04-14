import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient } from '@/lib/plaid/client';
import { categorizeTransactions } from '@/lib/ai/claude';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connection_id } = await request.json();

    // Get the bank connection
    const { data: connection } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Fetch transactions from Plaid (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const response = await plaidClient.transactionsGet({
      access_token: connection.plaid_access_token,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset: 0 },
    });

    const plaidTxns = response.data.transactions;

    // Get existing plaid transaction IDs to deduplicate
    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('plaid_transaction_id')
      .eq('user_id', user.id)
      .not('plaid_transaction_id', 'is', null);

    const existingIds = new Set((existingTxns || []).map((t) => t.plaid_transaction_id));

    // Filter out already-imported transactions
    const newTxns = plaidTxns.filter((t) => !existingIds.has(t.transaction_id));

    if (newTxns.length === 0) {
      // Update last_synced even if no new transactions
      await supabase
        .from('bank_connections')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', connection_id);

      return NextResponse.json({ imported: 0, message: 'No new transactions' });
    }

    // Get user's categories for AI categorization
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user.id);

    // Prepare transactions for AI categorization
    const forAi = newTxns.map((t) => ({
      description: t.name || t.merchant_name || 'Unknown',
      // Plaid: positive = money leaving account (expense), negative = money coming in (income)
      amount: -(t.amount),
    }));

    // AI categorize
    let aiResults: { cleaned_description: string; suggested_category: string }[] = [];
    try {
      const batchSize = 50;
      for (let i = 0; i < forAi.length; i += batchSize) {
        const batch = forAi.slice(i, i + batchSize);
        const results = await categorizeTransactions(batch, categories || []);
        aiResults.push(...results);
      }
    } catch {
      // If AI fails, proceed without categorization
      aiResults = forAi.map((t) => ({
        cleaned_description: t.description,
        suggested_category: 'Uncategorized',
      }));
    }

    // Map category names to IDs
    const catMap = new Map((categories || []).map((c) => [c.name.toLowerCase(), c.id]));

    // Build transaction rows
    const batch = new Date().toISOString();
    const rows = newTxns.map((t, i) => {
      const ai = aiResults[i];
      const categoryId = catMap.get(ai?.suggested_category?.toLowerCase() || '') || null;

      return {
        user_id: user.id,
        date: t.date,
        description: ai?.cleaned_description || t.name || 'Unknown',
        original_description: t.name || t.merchant_name || 'Unknown',
        amount: -(t.amount), // Plaid convention flip
        category_id: categoryId,
        bank_account: connection.institution_name,
        plaid_transaction_id: t.transaction_id,
        import_batch: batch,
        is_recurring: false,
      };
    });

    // Insert in batches
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('transactions').insert(rows.slice(i, i + 500));
    }

    // Update last_synced
    await supabase
      .from('bank_connections')
      .update({ last_synced: new Date().toISOString() })
      .eq('id', connection_id);

    return NextResponse.json({
      imported: rows.length,
      total_available: plaidTxns.length,
      duplicates_skipped: plaidTxns.length - newTxns.length,
    });
  } catch (error) {
    console.error('Plaid sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
