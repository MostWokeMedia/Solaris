import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTransactions } from '@/lib/teller/client';
import { categorizeTransactions } from '@/lib/ai/claude';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connection_id } = await request.json();

    const { data: connection } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Fetch all accounts for this enrollment
    const accounts = await getAccounts(connection.access_token);

    // Fetch transactions from all accounts
    const allTxns: Array<{ accountName: string; txn: Awaited<ReturnType<typeof getTransactions>>[number] }> = [];
    for (const account of accounts) {
      const txns = await getTransactions(connection.access_token, account.id);
      txns.forEach((txn) => allTxns.push({ accountName: account.name, txn }));
    }

    // Deduplicate against existing transactions
    const { data: existingTxns } = await supabase
      .from('transactions')
      .select('external_transaction_id')
      .eq('user_id', user.id)
      .not('external_transaction_id', 'is', null);

    const existingIds = new Set((existingTxns || []).map((t) => t.external_transaction_id));
    const newTxns = allTxns.filter((t) => !existingIds.has(t.txn.id));

    if (newTxns.length === 0) {
      await supabase
        .from('bank_connections')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', connection_id);
      return NextResponse.json({ imported: 0, message: 'No new transactions' });
    }

    // Get user's categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user.id);

    // Teller sign convention: positive = money leaving account (expense), so flip
    const forAi = newTxns.map(({ txn }) => ({
      description: txn.description,
      amount: -parseFloat(txn.amount),
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
      aiResults = forAi.map((t) => ({
        cleaned_description: t.description,
        suggested_category: 'Uncategorized',
      }));
    }

    const catMap = new Map((categories || []).map((c) => [c.name.toLowerCase(), c.id]));
    const batch = new Date().toISOString();

    const rows = newTxns.map(({ accountName, txn }, i) => {
      const ai = aiResults[i];
      const categoryId = catMap.get(ai?.suggested_category?.toLowerCase() || '') || null;
      return {
        user_id: user.id,
        date: txn.date,
        description: ai?.cleaned_description || txn.description,
        original_description: txn.description,
        amount: -parseFloat(txn.amount),
        category_id: categoryId,
        bank_account: accountName,
        external_transaction_id: txn.id,
        import_batch: batch,
        is_recurring: false,
      };
    });

    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from('transactions').insert(rows.slice(i, i + 500));
    }

    await supabase
      .from('bank_connections')
      .update({ last_synced: new Date().toISOString() })
      .eq('id', connection_id);

    return NextResponse.json({
      imported: rows.length,
      duplicates_skipped: allTxns.length - newTxns.length,
    });
  } catch (error: unknown) {
    console.error('Teller sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
