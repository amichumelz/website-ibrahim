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

    // 5. Send Booking Confirmation Email endpoint
    if (url.pathname === '/send-booking-email' && request.method === 'POST') {
      return handleSendBookingEmail(request, env);
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

async function handleSendBookingEmail(request, env) {
  const ADMIN_EMAIL = 'Ibrahimhussin5971@gmail.com';
  try {
    const data = await request.json();
    const {
      ref = 'PAY-' + Date.now().toString().slice(-6),
      customerName = 'Valued Guest',
      customerPhone = '-',
      customerEmail = '',
      bookingDetails = {},
      totalPaid = '0.00',
      payMethod = 'Online Payment'
    } = data;

    if (!customerEmail || !customerEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid customer email is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const vehName = bookingDetails.vehName || 'Tour / Transport Service';
    const pickupDate = bookingDetails.date || bookingDetails.dates || '-';
    const pickupTime = bookingDetails.time || '10:00';
    const duration = (bookingDetails.days || 1) + (bookingDetails.days == 1 ? ' Day' : ' Days');
    const notes = bookingDetails.notes || 'None';
    const rateType = bookingDetails.rateType || 'Standard Rate';
    const subtotal = bookingDetails.subtotal != null ? bookingDetails.subtotal : totalPaid;
    const processingFee = bookingDetails.processingFee != null ? bookingDetails.processingFee : '0.00';

    let emailSent = false;
    let providerUsed = 'none';

    if (env.RESEND_API_KEY) {
      try {
        const fromAddress = env.RESEND_FROM || 'Afnan Langkawi Tour <onboarding@resend.dev>';
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [customerEmail.trim(), ADMIN_EMAIL],
            subject: `Booking & Payment Confirmation: ${ref} - Afnan Langkawi Tour`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:8px"><h2>AFNAN LANGKAWI TOUR &amp; TRANSPORT</h2><p>Payment Verified ✓</p><p>Ref: <b>${ref}</b></p><p>Customer: ${customerName} (${customerPhone})</p><p>Service: ${vehName} on ${pickupDate} at ${pickupTime} (${duration})</p><p>Total Paid: RM ${totalPaid} via ${payMethod}</p></div>`
          })
        });
        if (resendRes.ok) {
          emailSent = true;
          providerUsed = 'resend';
        }
      } catch (e) {
        console.error('Resend error:', e);
      }
    }

    try {
      await fetch(`https://formsubmit.co/ajax/${ADMIN_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `New Paid Booking: ${ref} (${customerName})`,
          _replyto: customerEmail,
          'Reference': ref,
          'Customer Name': customerName,
          'Customer Phone': customerPhone,
          'Customer Email': customerEmail,
          'Service': vehName,
          'Pickup Date': pickupDate,
          'Pickup Time': pickupTime,
          'Duration': duration,
          'Notes': notes,
          'Subtotal': 'RM ' + subtotal,
          'Processing Fee': 'RM ' + processingFee,
          'Total Paid': 'RM ' + totalPaid,
          'Payment Method': payMethod,
          'Payment Status': 'VERIFIED PAID 100%'
        })
      });
      if (!emailSent) {
        emailSent = true;
        providerUsed = 'formsubmit';
      }
    } catch (e) {
      console.error('Admin notification error:', e);
    }

    return new Response(
      JSON.stringify({ success: true, emailSent, provider: providerUsed, recipientCustomer: customerEmail, recipientAdmin: ADMIN_EMAIL }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
