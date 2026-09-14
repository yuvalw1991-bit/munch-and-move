// Serverless lookup of real nutritional values from foodsdictionary.co.il.
// Searches the public site, opens the first product page, and extracts the
// per-100g macros. The site is windows-1255 (Hebrew) encoded.

// Encode a Hebrew/ASCII string to windows-1255 bytes, percent-encoded.
// Hebrew letters U+05D0..U+05EA map linearly to 0xE0..0xFA.
function toWin1255Percent(str) {
  let out = '';
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    let byte;
    if (cp >= 0x05d0 && cp <= 0x05ea) byte = cp - 0x04f0;       // Hebrew letters
    else if (cp === 0x05f3) byte = 0x27;                         // geresh → '
    else if (cp === 0x05f4) byte = 0x22;                         // gershayim → "
    else if (cp < 0x80) byte = cp;                               // ASCII
    else continue;                                               // drop niqqud / others
    out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}

async function fetchWin1255(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'he' },
    redirect: 'follow',
  });
  if (!r.ok) throw new Error('fetch_failed_' + r.status);
  const buf = await r.arrayBuffer();
  return new TextDecoder('windows-1255').decode(buf);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { name, qty } = body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'no_name' });
  }

  try {
    const q = toWin1255Percent(String(name).trim());
    const searchHtml = await fetchWin1255(
      'https://www.foodsdictionary.co.il/FoodsSearch.php?q=' + q
    );

    const linkM = searchHtml.match(/href="(\/Products\/\d+\/[^"]+)"/i);
    if (!linkM) return res.status(200).json({ found: false });

    const prodUrl = 'https://www.foodsdictionary.co.il' + linkM[1];
    const prodHtml = await fetchWin1255(prodUrl);

    // currentValue0=kcal, 1=protein, 2=carbs, 4=fat — values are per 100g.
    const vals = {};
    const re = /id="currentValue(\d+)"[^>]*data-start="([\d.]+)"/gi;
    let m;
    while ((m = re.exec(prodHtml))) vals[m[1]] = parseFloat(m[2]);

    const p100 = vals['1'], c100 = vals['2'], f100 = vals['4'];
    if (p100 == null && c100 == null && f100 == null) {
      return res.status(200).json({ found: false });
    }

    // Product display name (the <h1> / page title), best effort.
    let prodName = String(name).trim();
    const titleM = prodHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleM) prodName = decodeEntities(titleM[1]).trim();

    const grams = Number(qty);
    const factor = (!isNaN(grams) && grams > 0) ? grams / 100 : 1;
    const round = (v) => (v == null ? null : Math.round(v * factor * 10) / 10);

    return res.status(200).json({
      found: true,
      name: prodName,
      kcal: vals['0'] != null ? Math.round(vals['0'] * factor) : null,
      p: round(p100),
      c: round(c100),
      f: round(f100),
      per100: { p: p100 ?? null, c: c100 ?? null, f: f100 ?? null, kcal: vals['0'] ?? null },
      qty: (!isNaN(grams) && grams > 0) ? grams : 100,
      unit: 'גרם',
      source: prodUrl,
    });
  } catch (e) {
    return res.status(502).json({ error: 'lookup_failed', detail: String(e).slice(0, 200) });
  }
}
