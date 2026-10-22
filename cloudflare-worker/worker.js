/**
 * Cloudflare Worker for Stripe Checkout
 * AFNAN LANGKAWI TOUR & TRANSPORT WITH DRIVER
 *
 * Supported Payment Methods:
 * - Credit & Debit Cards (Visa, Mastercard, Amex)
 * - FPX (Malaysian Online Banking - Maybank, CIMB, Public Bank, RHB, etc.)
 * - Apple Pay & Google Pay
 *
 * Environment Variable / Secret required in Cloudflare:
 * - STRIPE_SECRET_KEY = sk_live_... (or sk_test_...)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // 2. Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'Afnan Langkawi Stripe Checkout Worker',
        hasStripeKey: !!env.STRIPE_SECRET_KEY
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 3. Create Checkout Session endpoint
    if (url.pathname === '/create-checkout-session' && request.method === 'POST') {
      return handleCreateCheckout(request, env);
    }

    // 4. Verify Session status endpoint
    if (url.pathname === '/verify-session' && request.method === 'GET') {
      return handleVerifySession(url, env);
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  },
};

async function handleCreateCheckout(request, env) {
  try {
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured in Cloudflare Worker secrets.' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { items, customerName, customerPhone, customerEmail, tripDates, returnUrl } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Cart is empty. Please add items before checking out.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const origin = returnUrl || request.headers.get('Origin') || 'https://afnanlangkawi.com';
    const baseUrl = origin.replace(/\/+$/, '');

    // Build standard Stripe x-www-form-urlencoded payload
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${baseUrl}/?payment=cancelled`);

    // Dynamic Payment Methods: Payment methods (Cards, FPX, Apple Pay, Google Pay)
    // are automatically managed from your Stripe Dashboard settings for MYR.

    if (customerEmail && customerEmail.trim()) {
      params.append('customer_email', customerEmail.trim());
    }

    // Attach Customer Metadata to Stripe Transaction
    params.append('metadata[customer_name]', customerName || 'Guest Customer');
    params.append('metadata[customer_phone]', customerPhone || '-');
    params.append('metadata[trip_dates]', tripDates || '-');

    // Add each cart item as a line item in MYR (Stripe expects amount in sen: RM1 = 100 sen)
    items.forEach((item, index) => {
      const priceInMyr = Number(item.price) || 0;
      const unitAmountInSen = Math.round(priceInMyr * 100);

      params.append(`line_items[${index}][price_data][currency]`, 'myr');
      params.append(`line_items[${index}][price_data][product_data][name]`, String(item.title || 'Tour / Transport Item'));
      params.append(`line_items[${index}][price_data][unit_amount]`, unitAmountInSen.toString());
      params.append(`line_items[${index}][quantity]`, (Number(item.qty) || 1).toString());
    });

    // Make request to Stripe API
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok || session.error) {
      const errMsg = session.error ? session.error.message : 'Stripe API returned an error';
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: stripeRes.status || 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ url: session.url, id: session.id }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal worker error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleVerifySession(url, env) {
  try {
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id parameter' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY.trim()}` },
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok || session.error) {
      return new Response(
        JSON.stringify({ error: session.error?.message || 'Failed to fetch session' }),
        { status: stripeRes.status || 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency,
        customer_name: session.metadata?.customer_name,
        customer_phone: session.metadata?.customer_phone,
        trip_dates: session.metadata?.trip_dates,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
