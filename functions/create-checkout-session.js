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

    let subtotal = 0;
    items.forEach((item, index) => {
      const priceInMyr = Number(item.price) || 0;
      const qty = Number(item.qty) || 1;
      subtotal += priceInMyr * qty;
      const unitAmountInSen = Math.round(priceInMyr * 100);

      params.append(`line_items[${index}][price_data][currency]`, 'myr');
      params.append(`line_items[${index}][price_data][product_data][name]`, String(item.title || 'Tour / Transport Item'));
      params.append(`line_items[${index}][price_data][unit_amount]`, unitAmountInSen.toString());
      params.append(`line_items[${index}][quantity]`, qty.toString());
    });

    // Add Online Payment Processing Fee (3% + RM 1.00 gross-up) so merchant receives 100% net amount
    if (subtotal > 0) {
      const totalWithFee = Math.round(((subtotal + 1.00) / 0.97) * 100) / 100;
      const feeInMyr = Math.round((totalWithFee - subtotal) * 100) / 100;
      const feeIndex = items.length;

      params.append(`line_items[${feeIndex}][price_data][currency]`, 'myr');
      params.append(`line_items[${feeIndex}][price_data][product_data][name]`, 'Online Payment Processing Fee (3% + RM 1.00)');
      params.append(`line_items[${feeIndex}][price_data][unit_amount]`, Math.round(feeInMyr * 100).toString());
      params.append(`line_items[${feeIndex}][quantity]`, '1');

      params.append('metadata[subtotal_myr]', subtotal.toFixed(2));
      params.append('metadata[processing_fee_myr]', feeInMyr.toFixed(2));
      params.append('metadata[total_paid_myr]', totalWithFee.toFixed(2));
    }

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
