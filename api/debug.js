export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const mfnRes = await fetch('https://www.mfn.se/all/s/nordic', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPO-Akuten/1.0)' }
    });
    const mfnHtml = await mfnRes.text();

    const cisionRes = await fetch('https://news.cision.com/se', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPO-Akuten/1.0)' }
    });
    const cisionHtml = await cisionRes.text();

    return new Response(JSON.stringify({
      mfn_status: mfnRes.status,
      mfn_length: mfnHtml.length,
      mfn_sample: mfnHtml.substring(0, 800),
      cision_status: cisionRes.status,
      cision_length: cisionHtml.length,
      cision_sample: cisionHtml.substring(0, 800),
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
