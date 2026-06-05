export default async function handler(request) {
  const url = new URL(request.url);
  const artist = url.searchParams.get('artist');
  const album = url.searchParams.get('album');
  const track = url.searchParams.get('track');
  const proxy = url.searchParams.get('proxy');   // ← NEW

  console.log(`[REQUEST] album=${album}, track=${track}, proxy=${proxy}`);

  if (!artist || !album || !track) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
  }

  // Images (ImgBB)
  if (track.startsWith('http')) {
    return new Response(JSON.stringify({ url: track, coverArt: track }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const filePath = `${album}/${track}`;

  try {
    const authString = btoa(`${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`);
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { Authorization: `Basic ${authString}` }
    });

    if (!authRes.ok) throw new Error("B2 auth failed");

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

    if (!downloadAuthRes.ok) throw new Error("Download auth failed");

    const downloadAuth = await downloadAuthRes.json();
    const signedUrl = `${auth.downloadUrl}/file/${process.env.B2_BUCKET}/${encodeURIComponent(filePath)}?Authorization=${downloadAuth.authorizationToken}`;

    // === NEW: Proxy mode for full file download (avoids CORS) ===
    if (proxy === 'true') {
      const fileRes = await fetch(signedUrl);
      if (!fileRes.ok) throw new Error(`File fetch failed: ${fileRes.status}`);

      return new Response(fileRes.body, {
        headers: {
          'Content-Type': fileRes.headers.get('Content-Type') || 'audio/mpeg',
          'Content-Length': fileRes.headers.get('Content-Length'),
        }
      });
    }

    // Default: Return signed URL (for normal use)
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