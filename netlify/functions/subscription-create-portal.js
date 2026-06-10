// netlify/functions/subscription-create-portal.js
export default async function handler(request) {
  try {
    const url = new URL(request.url);
    let email = url.searchParams.get('email') || request.headers.get('x-user-email');

    console.log(`[PORTAL] Looking for email: ${email}`);

    if (!email) {
      return new Response(JSON.stringify({ error: "No email provided" }), { status: 400 });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Find customer by email
    const customers = await stripe.customers.list({
      email: email.trim().toLowerCase(),
      limit: 5
    });

    if (customers.data.length === 0) {
      console.log(`[PORTAL] No customer found for ${email}`);
      return new Response(JSON.stringify({ error: "No subscription found for this email" }), { status: 404 });
    }

    const customer = customers.data[0];
    console.log(`[PORTAL] Found customer ${customer.id}`);

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${request.headers.get('origin') || 'http://localhost:8888'}?artist=${url.searchParams.get('artist') || ''}`,
    });

    console.log(`[PORTAL] Redirecting to portal`);
    return Response.redirect(session.url, 303);

  } catch (error) {
    console.error("[PORTAL ERROR]", error);
    return new Response(JSON.stringify({ 
      error: "Failed to open management portal", 
      details: error.message 
    }), { status: 500 });
  }
}