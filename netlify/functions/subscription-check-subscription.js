// netlify/functions/subscription-check-subscription.js
export default async function handler(request) {
  const url = new URL(request.url);
  const artistKey = url.searchParams.get('artist');
  const email = request.headers.get('x-user-email');

  console.log(`[CHECK] artist="${artistKey}", email="${email || 'NONE'}"`);

  if (!artistKey) {
    return new Response(JSON.stringify({ isActive: false }), { status: 400 });
  }

  const expectedPriceId = process.env[`STRIPE_PRICE_${artistKey.toUpperCase()}`];

  if (!expectedPriceId) {
    console.error(`[CHECK] No price ID configured for ${artistKey}`);
    return new Response(JSON.stringify({ isActive: false }), { status: 400 });
  }

  if (!email) {
    return new Response(JSON.stringify({ isActive: false }), { status: 200 });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const customers = await stripe.customers.list({ 
      email: email.trim().toLowerCase(), 
      limit: 10 
    });

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 20
      });

      for (const sub of subscriptions.data) {
        const priceId = sub.items?.data[0]?.price?.id;
        if (priceId === expectedPriceId) {
          console.log(`[CHECK] MATCH FOUND using price_id for ${artistKey}`);
          return new Response(JSON.stringify({ isActive: true }));
        }
      }
    }

    return new Response(JSON.stringify({ isActive: false }));

  } catch (error) {
    console.error("[CHECK ERROR]", error);
    return new Response(JSON.stringify({ isActive: false }));
  }
}