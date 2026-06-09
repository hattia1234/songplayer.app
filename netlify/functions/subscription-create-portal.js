// netlify/functions/subscription-create-portal.js
export default async function handler(request) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const email = request.headers.get('x-user-email');

    if (!email) {
      return new Response(JSON.stringify({ error: "No email provided" }), { status: 400 });
    }

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return new Response(JSON.stringify({ error: "Customer not found" }), { status: 404 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: request.headers.get('referer') || 'https://yourdomain.com',
    });

    return Response.redirect(portalSession.url, 303);
  } catch (error) {
    console.error("Portal error:", error);
    return new Response(JSON.stringify({ error: "Failed to open portal" }), { status: 500 });
  }
}