'use strict';
/*
 * npm run build
 *   1. Minify src/dripfinder.js -> dist/dripfinder.min.js (terser, ASCII only, banner kept).
 *   2. Regenerate embeds/<slug>/ from every config in configs/ (skips _template.json etc.):
 *        <slug>-embed-block.html, <slug>-chips.html, <slug>-strip.html,
 *        <slug>-crawlable.html, <slug>-all-snippets.html
 */
var fs = require('fs');
var path = require('path');
var terser = require('terser');
var embeds = require('./lib/embeds');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'src', 'dripfinder.js');
var DIST_DIR = path.join(ROOT, 'dist');
var DIST = path.join(DIST_DIR, 'dripfinder.min.js');
var CONFIG_DIR = path.join(ROOT, 'configs');
var EMBED_DIR = path.join(ROOT, 'embeds');

function readVersion(srcText) {
  var m = /VERSION\s*=\s*'([^']+)'/.exec(srcText);
  if (!m) throw new Error('Could not find VERSION in src/dripfinder.js');
  return m[1];
}

function listConfigs() {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs.readdirSync(CONFIG_DIR)
    .filter(function (f) { return /\.json$/.test(f) && f[0] !== '_'; })
    .map(function (f) { return { slug: f.replace(/\.json$/, ''), file: path.join(CONFIG_DIR, f) }; });
}

function cleanHtml(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (f) {
    if (/\.html$/.test(f)) fs.unlinkSync(path.join(dir, f));
  });
}

function nonAscii(text) {
  var out = [];
  for (var i = 0; i < text.length; i++) if (text.charCodeAt(i) > 127) out.push(i);
  return out;
}

async function build() {
  var srcText = fs.readFileSync(SRC, 'utf8');
  var version = readVersion(srcText);
  console.log('DripFinder build - version ' + version);

  // 1) Minify
  var result = await terser.minify(srcText, {
    ecma: 5,
    compress: { passes: 2 },
    mangle: true,
    format: { ascii_only: true, comments: /^!/ }
  });
  if (result.error) throw result.error;
  var min = result.code;

  var bad = nonAscii(min);
  if (bad.length) throw new Error('Build is not ASCII only: ' + bad.length + ' non-ASCII chars (first at index ' + bad[0] + ')');

  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(DIST, min + '\n');
  console.log('  dist/dripfinder.min.js  (' + min.length + ' bytes, ASCII only)');

  // 2) Embeds per config
  var configs = listConfigs();
  if (!configs.length) { console.log('  (no client configs found)'); return; }

  configs.forEach(function (c) {
    var cfg;
    try { cfg = JSON.parse(fs.readFileSync(c.file, 'utf8')); }
    catch (e) { throw new Error('Invalid JSON in configs/' + c.slug + '.json: ' + e.message); }
    cfg.version = version;
    if (!cfg.clinic) cfg.clinic = { name: c.slug };
    // engine normalize() also runs client-side; mirror the brand default used by the embed templates.
    cfg.brand = Object.assign({
      accent: '#0e7c86', button: null, accentInk: '#ffffff', soft: '#e6f4f6', bg: '#ffffff', surface: '#f6f9fa',
      fg: '#14232a', muted: '#55666d', line: '#d7e2e6', radius: '12px', font: 'inherit', headingFont: 'inherit', headingWeight: '700'
    }, cfg.brand || {});
    if (!cfg.brand.button) cfg.brand.button = cfg.brand.accent;

    var dir = path.join(EMBED_DIR, c.slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cleanHtml(dir);

    var files = {};
    files[c.slug + '-embed-block.html'] = embeds.embedBlock(c.slug, cfg, min);
    files[c.slug + '-chips.html'] = embeds.chipsBlock(cfg);
    files[c.slug + '-strip.html'] = embeds.stripBlock(cfg);
    files[c.slug + '-crawlable.html'] = embeds.crawlable(cfg);
    files[c.slug + '-all-snippets.html'] = embeds.allSnippets(c.slug, cfg, min);

    Object.keys(files).forEach(function (name) {
      fs.writeFileSync(path.join(dir, name), files[name]);
    });
    console.log('  embeds/' + c.slug + '/  (' + Object.keys(files).length + ' files)');
  });

  console.log('Build complete.');
}

build().catch(function (e) {
  console.error('BUILD FAILED: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
