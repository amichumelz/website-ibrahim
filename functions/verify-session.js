/**
 * Cloudflare Pages Function: /verify-session
 * Verifies status of Stripe Checkout Session
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
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
