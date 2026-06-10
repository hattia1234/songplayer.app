// netlify/functions/subscription-create-portal.js
export default async function handler(request) {
  try {
    const url = new URL(request.url);
    let email = url.searchParams.get('email') || request.headers.get('x-user-email');

    if (!email) {
      return new Response(JSON.stringify({ error: "No email provided" }), { status: 400 });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    let customer = (await stripe.customers.list({ 
      email: email.trim().toLowerCase(), 
      limit: 1 
    })).data[0];

    if (!customer) {
      customer = await stripe.customers.create({ email: email.trim().toLowerCase() });
    }

    // Dynamic return URL - works in both local and production
    const origin = request.headers.get('origin') || 
                   `https://${request.headers.get('host')}` ||
                   'http://localhost:8888';

    const returnUrl = `${origin}?artist=${url.searchParams.get('artist') || ''}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl,
    });

    return Response.redirect(session.url, 303);

  } catch (error) {
    console.error("[PORTAL ERROR]", error);
    return new Response(JSON.stringify({ 
      error: "Failed to open management portal", 
      details: error.message 
    }), { status: 500 });
  }
}