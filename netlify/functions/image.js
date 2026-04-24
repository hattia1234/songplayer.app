// netlify/functions/image.js
export default async function handler(request) {
  const url = new URL(request.url);
  const track = url.searchParams.get('track');

  console.log(`[IMAGE REQUEST] track=${track}`);

  if (!track) {
    return new Response(JSON.stringify({ error: "Missing track parameter" }), { status: 400 });
  }

  // If it's already a full URL (ImgBB), return it directly
  if (track.startsWith('http')) {
    console.log(`[IMAGE] Direct URL: ${track}`);
    return new Response(JSON.stringify({ 
      url: track, 
      coverArt: track 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Invalid image request" }), { status: 400 });
}