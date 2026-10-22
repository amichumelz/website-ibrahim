/**
 * Cloudflare Pages Function: /create-checkout-session
 * Handles Stripe Checkout Session creation for Cards and FPX in MYR.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured in Cloudflare Pages Environment Variables.' }),
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

    const origin = returnUrl || request.headers.get('Origin') || 'https://afnanlangkawitour.com';
    const baseUrl = origin.replace(/\/+$/, '');

    // Build Stripe payload
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${baseUrl}/?payment=cancelled`);

    // Dynamic Payment Methods: Payment methods (Cards, FPX, Apple Pay, Google Pay)
    // are automatically managed from your Stripe Dashboard settings for MYR.

    if (customerEmail && customerEmail.trim()) {
      params.append('customer_email', customerEmail.trim());
    }

    params.append('metadata[customer_name]', customerName || 'Guest Customer');
    params.append('metadata[customer_phone]', customerPhone || '-');
    params.append('metadata[trip_dates]', tripDates || '-');

    items.forEach((item, index) => {
      const priceInMyr = Number(item.price) || 0;
      const unitAmountInSen = Math.round(priceInMyr * 100);

      params.append(`line_items[${index}][price_data][currency]`, 'myr');
      params.append(`line_items[${index}][price_data][product_data][name]`, String(item.title || 'Tour / Transport Item'));
      params.append(`line_items[${index}][price_data][unit_amount]`, unitAmountInSen.toString());
      params.append(`line_items[${index}][quantity]`, (Number(item.qty) || 1).toString());
    });

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
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
