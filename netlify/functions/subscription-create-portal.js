// netlify/functions/subscription-create-portal.js
export default async function handler(request) {
  try {
    const url = new URL(request.url);
    let email = url.searchParams.get('email') || request.headers.get('x-user-email');
    const artistKey = url.searchParams.get('artist');

    console.log(`[PORTAL] artist="${artistKey}", email="${email}"`);

    if (!email || !artistKey) {
      return new Response(JSON.stringify({ error: "Missing email or artist" }), { status: 400 });
    }

    const expectedPriceId = process.env[`STRIPE_PRICE_${artistKey.toUpperCase()}`];
    console.log(`[PORTAL] Expected priceId for ${artistKey}: ${expectedPriceId}`);

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const customers = await stripe.customers.list({ 
      email: email.trim().toLowerCase(), 
      limit: 10 
    });

    console.log(`[PORTAL] Found ${customers.data.length} customers`);

    let matchingCustomer = null;

    // Search through ALL customers for the matching price_id
    for (const customer of customers.data) {
      console.log(`[PORTAL] Checking customer ${customer.id}`);

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 50
      });

      for (const sub of subscriptions.data) {
        const priceId = sub.items?.data[0]?.price?.id;
        console.log(`[PORTAL]   Sub priceId="${priceId}"`);

        if (priceId === expectedPriceId) {
          matchingCustomer = customer;
          console.log(`[PORTAL] MATCH FOUND! Using customer ${customer.id} for ${artistKey}`);
          break;
        }
      }
      if (matchingCustomer) break;
    }

    if (!matchingCustomer) {
      console.log(`[PORTAL] No exact match found, using first customer`);
      matchingCustomer = customers.data[0];
    }

    const returnUrl = `${request.headers.get('origin') || 'http://localhost:8888'}?artist=${artistKey}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: matchingCustomer.id,
      return_url: returnUrl,
    });

    console.log(`[PORTAL] Redirecting to portal for customer ${matchingCustomer.id}`);
    return Response.redirect(session.url, 303);

  } catch (error) {
    console.error("[PORTAL ERROR]", error);
    return new Response(JSON.stringify({ error: "Failed to open portal" }), { status: 500 });
  }
}