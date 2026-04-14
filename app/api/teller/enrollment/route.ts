import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken, enrollmentId, institutionName } = await request.json();

    if (!accessToken || !enrollmentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('bank_connections').insert({
      user_id: user.id,
      provider: 'teller',
      access_token: accessToken,
      enrollment_id: enrollmentId,
      institution_name: institutionName || 'Unknown Bank',
    });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Teller enrollment error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save enrollment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
