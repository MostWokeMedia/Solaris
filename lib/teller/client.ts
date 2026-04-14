const TELLER_API_BASE = 'https://api.teller.io';

export type TellerTransaction = {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: string; // Teller returns amounts as strings
  type: string;
  status: 'pending' | 'posted';
  category?: string;
  details?: {
    category?: string;
    processing_status?: string;
    counterparty?: { name?: string; type?: string };
  };
};

export type TellerAccount = {
  id: string;
  name: string;
  type: string;
  subtype: string;
  institution: { id: string; name: string };
  last_four: string;
  currency: string;
  enrollment_id: string;
  links: { self: string; balances: string; transactions: string };
};

function authHeader(accessToken: string): string {
  // Teller uses HTTP Basic Auth with access_token as username, no password
  const encoded = Buffer.from(accessToken + ':').toString('base64');
  return 'Basic ' + encoded;
}

export async function getAccounts(accessToken: string): Promise<TellerAccount[]> {
  const res = await fetch(`${TELLER_API_BASE}/accounts`, {
    headers: { Authorization: authHeader(accessToken) },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Teller getAccounts failed: ${res.status} ${err}`);
  }
  return res.json();
}

export async function getTransactions(accessToken: string, accountId: string): Promise<TellerTransaction[]> {
  const res = await fetch(`${TELLER_API_BASE}/accounts/${accountId}/transactions`, {
    headers: { Authorization: authHeader(accessToken) },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Teller getTransactions failed: ${res.status} ${err}`);
  }
  return res.json();
}
