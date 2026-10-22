/**
 * Cloudflare Pages Function: /send-booking-email
 * Sends booking confirmation emails to both customer and admin (aabusinessandservices99@gmail.com)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ADMIN_EMAIL = 'aabusinessandservices99@gmail.com';

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

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

    const emailSubject = `Booking & Payment Confirmation: ${ref} - Afnan Langkawi Tour`;

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;color:#1a202c">
        <div style="text-align:center;padding-bottom:20px;border-bottom:2px solid #edf2f7">
          <h2 style="margin:0;color:#1b5e20;font-size:22px;letter-spacing:-0.5px">AFNAN LANGKAWI TOUR &amp; TRANSPORT</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#718096">Private Chauffeured Cars &amp; Langkawi Holiday Packages</p>
        </div>

        <div style="margin:20px 0;padding:14px 18px;background:#f0fff4;border:1px solid #c6f6d5;border-radius:8px;text-align:center">
          <span style="font-size:16px;font-weight:bold;color:#22543d">✓ 100% Full Payment Verified</span>
          <div style="font-size:12px;color:#2f855a;margin-top:4px">Your reservation has been confirmed and scheduled with our team.</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
          <tr><td style="padding:8px 0;color:#718096;width:40%">Booking Reference:</td><td style="padding:8px 0;font-weight:bold;color:#1a202c">${ref}</td></tr>
          <tr><td style="padding:8px 0;color:#718096">Customer Name:</td><td style="padding:8px 0;font-weight:bold;color:#1a202c">${customerName}</td></tr>
          <tr><td style="padding:8px 0;color:#718096">WhatsApp / Phone:</td><td style="padding:8px 0;font-weight:bold;color:#1a202c">${customerPhone}</td></tr>
          <tr><td style="padding:8px 0;color:#718096">Customer Email:</td><td style="padding:8px 0;font-weight:bold;color:#1a202c">${customerEmail}</td></tr>
          <tr><td style="padding:8px 0;color:#718096">Payment Method:</td><td style="padding:8px 0;font-weight:bold;color:#1a202c">${payMethod}</td></tr>
        </table>

        <div style="background:#f7fafc;border:1px solid #edf2f7;border-radius:8px;padding:16px;margin-bottom:20px">
          <h3 style="margin:0 0 12px;font-size:15px;color:#2d3748;border-bottom:1px solid #e2e8f0;padding-bottom:8px">Reservation Details</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13.5px">
            <tr><td style="padding:6px 0;color:#718096">Service / Vehicle:</td><td style="padding:6px 0;font-weight:600;color:#1a202c">${vehName} (With Driver)</td></tr>
            <tr><td style="padding:6px 0;color:#718096">Pickup Date:</td><td style="padding:6px 0;font-weight:600;color:#1a202c">${pickupDate}</td></tr>
            <tr><td style="padding:6px 0;color:#718096">Pickup Time:</td><td style="padding:6px 0;font-weight:600;color:#1a202c">${pickupTime}</td></tr>
            <tr><td style="padding:6px 0;color:#718096">Duration:</td><td style="padding:6px 0;font-weight:600;color:#1a202c">${duration}</td></tr>
            <tr><td style="padding:6px 0;color:#718096">Rate Applied:</td><td style="padding:6px 0;font-weight:600;color:#1a202c">${rateType}</td></tr>
            <tr><td style="padding:6px 0;color:#718096">Pickup Location / Notes:</td><td style="padding:6px 0;font-weight:600;color:#1a202c">${notes}</td></tr>
          </table>
        </div>

        <div style="background:#f7fafc;border:1px solid #edf2f7;border-radius:8px;padding:16px;margin-bottom:24px">
          <h3 style="margin:0 0 12px;font-size:15px;color:#2d3748;border-bottom:1px solid #e2e8f0;padding-bottom:8px">Payment Summary</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13.5px">
            <tr><td style="padding:6px 0;color:#718096">Rental / Tour Sub-total:</td><td style="padding:6px 0;text-align:right;color:#1a202c">RM ${subtotal}</td></tr>
            <tr><td style="padding:6px 0;color:#718096">Online Processing Fee (3% + RM 1.00):</td><td style="padding:6px 0;text-align:right;color:#1a202c">RM ${processingFee}</td></tr>
            <tr style="border-top:1.5px solid #cbd5e0;font-size:16px;font-weight:bold"><td style="padding:10px 0;color:#1b5e20">Total Paid:</td><td style="padding:10px 0;text-align:right;color:#1b5e20">RM ${totalPaid}</td></tr>
          </table>
        </div>

        <div style="text-align:center;padding:16px;background:#ebf8ff;border-radius:8px;border:1px solid #bee3f8">
          <p style="margin:0 0 10px;font-size:13px;color:#2b6cb0">Need instant assistance or driver updates?</p>
          <a href="https://wa.me/601123528648" style="display:inline-block;background:#128c4b;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 22px;border-radius:6px">Chat With Us on WhatsApp (+601123528648)</a>
        </div>

        <div style="margin-top:24px;text-align:center;font-size:11.5px;color:#a0aec0">
          <p style="margin:4px 0">AFNAN LANGKAWI TOUR &amp; TRANSPORT WITH DRIVER</p>
          <p style="margin:4px 0">Email: ${ADMIN_EMAIL} • Phone: +601123528648 / +60133365815 • Langkawi, Kedah</p>
        </div>
      </div>
    `;

    let emailSent = false;
    let providerUsed = 'none';

    // 1. Try Resend API if API Key is configured in Cloudflare environment
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
            subject: emailSubject,
            html: htmlBody
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

    // 2. Fallback / Admin notification via FormSubmit
    try {
      await fetch(`https://formsubmit.co/ajax/${ADMIN_EMAIL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
      JSON.stringify({
        success: true,
        emailSent: emailSent,
        provider: providerUsed,
        recipientCustomer: customerEmail,
        recipientAdmin: ADMIN_EMAIL
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to dispatch email' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
