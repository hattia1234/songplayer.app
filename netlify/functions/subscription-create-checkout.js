// netlify/functions/subscription-create-checkout.js
export default async function handler(request) {
  const url = new URL(request.url);
  const artistKey = url.searchParams.get('artist');

  if (!artistKey) {
    return new Response(JSON.stringify({ error: "Missing artist" }), { status: 400 });
  }

  const priceId = process.env[`STRIPE_PRICE_${artistKey.toUpperCase()}`];
  if (!priceId) {
    return new Response(JSON.stringify({ error: "Price not configured for this artist" }), { status: 400 });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${url.origin}/?artist=${encodeURIComponent(artistKey)}&success=1`,
      cancel_url: `${url.origin}/?artist=${encodeURIComponent(artistKey)}`,
    });

    console.log(`[CHECKOUT] Success for ${artistKey} using price ${priceId}`);
    return Response.redirect(session.url, 303);
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: "Failed to create checkout" }), { status: 500 });
  }
}