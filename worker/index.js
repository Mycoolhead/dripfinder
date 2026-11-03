/*
 * DripFinder host Worker.
 *  - Serves static assets from site/ (the engine at /v0/ and /v<version>/, configs at /configs/).
 *    Static files are matched and returned before this Worker runs; the Worker only handles
 *    the two dynamic routes below plus anything that is not a file.
 *  - POST /e            anonymous usage events -> D1. Never stores IP or anything identifying.
 *  - GET  /stats/<slug> a phone-readable stats page, gated by a per-client ?key=.
 */

var ALLOWED = ['view', 'start', 'result', 'stop_emergency', 'stop_talk', 'book_click', 'text_click'];
var CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var p = url.pathname;
    if (p === '/e') return ingest(request, env);
    if (p === '/stats' || p.indexOf('/stats/') === 0) return stats(request, env, url);
    // Configs are fetched cross-origin by the client's own site, so they need CORS.
    // (run_worker_first in wrangler.jsonc routes /configs/* here before static serving.)
    if (p.indexOf('/configs/') === 0) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      var r = await env.ASSETS.fetch(request);
      r = new Response(r.body, r);
      r.headers.set('Access-Control-Allow-Origin', '*');
      return r;
    }
    if (p === '/' || p === '') return new Response('DripFinder host OK', { headers: { 'content-type': 'text/plain' } });
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};

/* ---------- event ingest ---------- */

async function ingest(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: CORS });

  var b;
  try { b = JSON.parse(await request.text()); } catch (e) { return ok204(); }
  if (!b || typeof b !== 'object') return ok204();

  var slug = String(b.s || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  var evt = String(b.e || '');
  if (!slug || ALLOWED.indexOf(evt) === -1) return ok204();

  var item = String(b.i || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  var src = String(b.src || '').replace(/[^a-z0-9_.-]/gi, '').slice(0, 64);
  var pth = String(b.p || '').slice(0, 256);
  var day = /^\d{4}-\d{2}-\d{2}$/.test(b.d || '') ? b.d : new Date().toISOString().slice(0, 10);

  // We deliberately do not read request.cf or cf-connecting-ip. Nothing here identifies a person.
  if (env.DB) {
    try {
      await env.DB.prepare(
        'INSERT INTO events (slug,event,item,src,path,day,ts) VALUES (?,?,?,?,?,?,?)'
      ).bind(slug, evt, item, src, pth, day, Date.now()).run();
    } catch (e) { /* a failed write must never surface to the quiz */ }
  }
  return ok204();
}

function ok204() { return new Response(null, { status: 204, headers: CORS }); }

/* ---------- stats page ---------- */

async function stats(request, env, url) {
  var slug = url.pathname.replace(/^\/stats\/?/, '').replace(/[^a-z0-9_-]/gi, '');
  var key = url.searchParams.get('key') || '';
  var keys = {};
  try { keys = JSON.parse(env.STATS_KEYS || '{}'); } catch (e) {}

  if (!slug || !keys[slug] || keys[slug] !== key) {
    return html(page('Stats', '<p class="muted">This link is not valid. Check the full web address, including the key after <code>?key=</code>.</p>'), 401);
  }
  if (!env.DB) return html(page('Stats', '<p class="muted">No database connected yet.</p>'), 200);

  var byMonth = pivot((await env.DB.prepare(
    "SELECT substr(day,1,7) k, event e, COUNT(*) n FROM events WHERE slug=? GROUP BY k,e"
  ).bind(slug).all()).results);
  var byWeek = pivot((await env.DB.prepare(
    "SELECT strftime('%Y-W%W', day) k, event e, COUNT(*) n FROM events WHERE slug=? GROUP BY k,e"
  ).bind(slug).all()).results);
  var topItems = (await env.DB.prepare(
    "SELECT item k, COUNT(*) n FROM events WHERE slug=? AND event='result' AND item<>'' GROUP BY item ORDER BY n DESC LIMIT 6"
  ).bind(slug).all()).results;
  var topSrc = (await env.DB.prepare(
    "SELECT src k, COUNT(*) n FROM events WHERE slug=? AND src<>'' GROUP BY src ORDER BY n DESC LIMIT 6"
  ).bind(slug).all()).results;
  var totals = pivot((await env.DB.prepare(
    "SELECT 'all' k, event e, COUNT(*) n FROM events WHERE slug=? GROUP BY e"
  ).bind(slug).all()).results).all || {};

  return html(renderStats(slug, totals, byMonth, byWeek, topItems, topSrc), 200);
}

// rows of {k,e,n} -> { <k>: { <event>: n, ... } }
function pivot(rows) {
  var out = {};
  (rows || []).forEach(function (r) {
    out[r.k] = out[r.k] || {};
    out[r.k][r.e] = r.n;
  });
  return out;
}

function monthName(ym) {
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? names[+m[2] - 1] + ' ' + m[1] : ym;
}

function n(obj, key) { return (obj && obj[key]) || 0; }

function sentence(label, row) {
  var used = n(row, 'start');
  var booked = n(row, 'book_click');
  return 'In ' + label + ', ' + used + ' ' + (used === 1 ? 'person' : 'people') +
    ' used Help Me Choose on your site and ' + booked + ' tapped Book.';
}

function periodRow(label, key, row, withCopy) {
  var used = n(row, 'start'), seen = n(row, 'view'), matched = n(row, 'result');
  var book = n(row, 'book_click'), text = n(row, 'text_click');
  var stops = n(row, 'stop_talk') + n(row, 'stop_emergency');
  return '<tr>' +
    '<th scope="row">' + esc(label) + '</th>' +
    '<td>' + seen + '</td><td>' + used + '</td><td>' + matched + '</td>' +
    '<td>' + book + '</td><td>' + text + '</td><td>' + stops + '</td>' +
    (withCopy ? '<td><button class="copy" data-s="' + esc(sentence(label, row)) + '">Copy</button></td>' : '') +
    '</tr>';
}

function table(title, caption, map, labelOf, withCopy) {
  var keys = Object.keys(map).sort().reverse();
  if (!keys.length) return '<section><h2>' + esc(title) + '</h2><p class="muted">No data yet.</p></section>';
  var head = '<tr><th scope="col">' + esc(caption) + '</th><th>Views</th><th>Started</th><th>Matched</th><th>Book</th><th>Text</th><th>Stops</th>' + (withCopy ? '<th></th>' : '') + '</tr>';
  var body = keys.map(function (k) { return periodRow(labelOf(k), k, map[k], withCopy); }).join('');
  return '<section><h2>' + esc(title) + '</h2><div class="scroll"><table>' + head + body + '</table></div></section>';
}

function list(title, rows) {
  if (!rows || !rows.length) return '<section><h2>' + esc(title) + '</h2><p class="muted">No data yet.</p></section>';
  var li = rows.map(function (r) { return '<li><span>' + esc(r.k) + '</span><b>' + r.n + '</b></li>'; }).join('');
  return '<section><h2>' + esc(title) + '</h2><ul class="bars">' + li + '</ul></section>';
}

function renderStats(slug, totals, byMonth, byWeek, topItems, topSrc) {
  var seen = n(totals, 'view'), used = n(totals, 'start'), matched = n(totals, 'result');
  var book = n(totals, 'book_click'), text = n(totals, 'text_click');
  var rate = used ? Math.round((matched / used) * 100) : 0;

  var months = Object.keys(byMonth).sort().reverse();
  var latestLabel = months.length ? monthName(months[0]) : '';
  var latestSentence = months.length ? sentence(latestLabel, byMonth[months[0]]) : 'No data yet.';

  var cards =
    tile('Views', seen) + tile('Started', used) + tile('Completion', rate + '%') +
    tile('Book taps', book) + tile('Text taps', text) + tile('Matched', matched);

  var weekLabel = function (k) { return k.replace('-W', ' wk '); };

  var body =
    '<header><h1>Help Me Choose &mdash; ' + esc(slug) + '</h1>' +
    '<p class="muted">First-party, anonymous. No visitor answers are stored.</p></header>' +
    '<div class="report"><p id="line">' + esc(latestSentence) + '</p>' +
    '<button class="copy primary" data-s="' + esc(latestSentence) + '">Copy for report</button></div>' +
    '<div class="tiles">' + cards + '</div>' +
    table('By month', 'Month', byMonth, monthName, true) +
    table('By week', 'Week', byWeek, weekLabel, false) +
    list('Top matches', topItems) +
    list('Top sources', topSrc);

  return page('Help Me Choose stats - ' + slug, body);
}

function tile(label, val) {
  return '<div class="tile"><div class="tv">' + esc(String(val)) + '</div><div class="tl">' + esc(label) + '</div></div>';
}

/* ---------- html shell ---------- */

function page(title, body) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    '<title>' + esc(title) + '</title><style>' +
    ':root{color-scheme:light}*{box-sizing:border-box}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f6f9fa;color:#14232a;line-height:1.5;padding:16px;max-width:760px;margin:0 auto}' +
    'h1{font-size:1.3rem;margin:0 0 2px}h2{font-size:1rem;margin:22px 0 8px}' +
    '.muted{color:#55666d;font-size:.9rem;margin:2px 0}' +
    'code{background:#e6f4f6;padding:1px 5px;border-radius:5px}' +
    '.report{background:#fff;border:1.5px solid #0e7c86;border-radius:12px;padding:14px;margin:14px 0}' +
    '.report p{margin:0 0 10px;font-size:1.05rem}' +
    '.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.tile{background:#fff;border:1px solid #d7e2e6;border-radius:10px;padding:12px 10px;text-align:center}' +
    '.tv{font-size:1.5rem;font-weight:700;font-variant-numeric:tabular-nums}.tl{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#55666d;margin-top:2px}' +
    '.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.86rem;background:#fff;border:1px solid #d7e2e6;border-radius:10px;overflow:hidden}' +
    'th,td{padding:8px 10px;text-align:right;border-bottom:1px solid #eef3f4;white-space:nowrap}th[scope=row]{text-align:left;font-weight:600}tr th:first-child{text-align:left}' +
    'thead,tr:first-child th{background:#eef3f4}td:first-child{text-align:left}' +
    'button{font:inherit;cursor:pointer;border-radius:8px;border:1.5px solid #0e7c86;background:#fff;color:#0e7c86;padding:7px 12px;font-weight:600}' +
    'button.primary{background:#0e7c86;color:#fff}button.copy{min-height:36px}' +
    'ul.bars{list-style:none;padding:0;margin:0}ul.bars li{display:flex;justify-content:space-between;background:#fff;border:1px solid #d7e2e6;border-radius:8px;padding:8px 12px;margin-bottom:6px}' +
    '</style></head><body>' + body +
    '<script>document.addEventListener("click",function(ev){var b=ev.target.closest&&ev.target.closest("button.copy");if(!b)return;var s=b.getAttribute("data-s")||"";try{navigator.clipboard.writeText(s);b.textContent="Copied";setTimeout(function(){b.textContent=b.classList.contains("primary")?"Copy for report":"Copy";},1400);}catch(e){}});<\/script>' +
    '</body></html>';
}

function html(s, status) { return new Response(s, { status: status || 200, headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } }); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
