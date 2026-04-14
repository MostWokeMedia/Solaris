import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient } from '@/lib/plaid/client';
import { CountryCode, Products } from 'plaid';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Solaris',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: unknown) {
    console.error('Plaid link token error:', error);
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      return NextResponse.json({ error: 'Plaid credentials not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to environment variables.' }, { status: 500 });
    }
    // Extract Plaid-specific error details
    const plaidError = (error as { response?: { data?: { error_message?: string; error_code?: string; error_type?: string } } })?.response?.data;
    if (plaidError?.error_message) {
      return NextResponse.json({
        error: `Plaid: ${plaidError.error_message} (${plaidError.error_code || plaidError.error_type || 'unknown'})`,
      }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : 'Failed to create link token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
