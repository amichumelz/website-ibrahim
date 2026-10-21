export async function onRequestGet(context) {
  const { env } = context;
  return new Response(JSON.stringify({
    status: 'online',
    service: 'Afnan Langkawi Stripe Checkout Pages Function',
    hasStripeKey: !!env.STRIPE_SECRET_KEY
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
