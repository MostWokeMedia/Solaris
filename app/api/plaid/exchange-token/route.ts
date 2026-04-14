import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient } from '@/lib/plaid/client';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { public_token, institution } = await request.json();

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = response.data;

    // Store the connection in Supabase
    await supabase.from('bank_connections').insert({
      user_id: user.id,
      plaid_item_id: item_id,
      plaid_access_token: access_token,
      institution_name: institution?.name || 'Unknown Bank',
    });

    return NextResponse.json({ success: true, institution_name: institution?.name });
  } catch (error) {
    console.error('Plaid exchange error:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
