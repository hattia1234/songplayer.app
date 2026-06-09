// netlify/functions/subscription-check-subscription.js
export default async function handler(request) {
  const url = new URL(request.url);
  const artistKey = url.searchParams.get('artist');
  const email = request.headers.get('x-user-email');

  console.log(`[CHECK] artist="${artistKey}", email="${email}"`);

  if (!artistKey || !email) {
    return new Response(JSON.stringify({ isActive: false }), { status: 400 });
  }

  const expectedPriceId = process.env[`STRIPE_PRICE_${artistKey.toUpperCase()}`];
  if (!expectedPriceId) {
    console.error(`No price ID configured for ${artistKey}`);
    return new Response(JSON.stringify({ isActive: false }), { status: 400 });
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
        const subPriceId = sub.items?.data[0]?.price?.id;
        console.log(`[CHECK] Found priceId="${subPriceId}"`);

        if (subPriceId === expectedPriceId) {
          console.log(`[CHECK] MATCH FOUND using priceId for ${artistKey}`);
          return new Response(JSON.stringify({ isActive: true }));
        }
      }
    }

    console.log(`[CHECK] No match found using priceId`);
    return new Response(JSON.stringify({ isActive: false }));

  } catch (error) {
    console.error("[CHECK ERROR]", error);
    return new Response(JSON.stringify({ isActive: false }));
  }
}