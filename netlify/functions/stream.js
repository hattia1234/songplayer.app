export default async function handler(request) {
  const url = new URL(request.url);
  const artist = url.searchParams.get('artist');
  const album = url.searchParams.get('album');
  const track = url.searchParams.get('track');

  console.log(`[REQUEST] album=${album}, track=${track}`);

  if (!artist || !album || !track) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
  }

  // Images (ImgBB)
  if (track.startsWith('http')) {
    return new Response(JSON.stringify({ url: track, coverArt: track }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Audio from B2
  const filePath = `${album}/${track}`;

  try {
    const authString = btoa(`${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`);
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { Authorization: `Basic ${authString}` }
    });

    if (!authRes.ok) {
      const errorText = await authRes.text();
      console.error(`[B2 AUTH ERROR] ${authRes.status} - ${errorText}`);
      return new Response(JSON.stringify({ error: errorText }), { status: authRes.status });
    }

    const auth = await authRes.json();

    const downloadAuthRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: "POST",
      headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        bucketId: process.env.B2_BUCKET_ID,
        fileNamePrefix: filePath,
        validDurationInSeconds: 604800
      })
    });

    if (!downloadAuthRes.ok) {
      const errorText = await downloadAuthRes.text();
      console.error(`[B2 DOWNLOAD AUTH ERROR] ${downloadAuthRes.status} - ${errorText}`);
      return new Response(JSON.stringify({ error: errorText }), { 
        status: downloadAuthRes.status 
      });
    }

    const downloadAuth = await downloadAuthRes.json();

    const signedUrl = `${auth.downloadUrl}/file/${process.env.B2_BUCKET}/${encodeURIComponent(filePath)}?Authorization=${downloadAuth.authorizationToken}`;

    return new Response(JSON.stringify({ url: signedUrl }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚨 CRITICAL ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message || "Unknown B2 error" }), { 
      status: 500 
    });
  }
}