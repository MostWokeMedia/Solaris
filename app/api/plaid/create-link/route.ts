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
  } catch (error) {
    console.error('Plaid link token error:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
