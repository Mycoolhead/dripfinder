'use strict';
/*
 * npm run assemble
 *   Builds site/ - the folder Cloudflare serves as static assets. Run after build.
 *     site/v0/dripfinder.min.js           the latest passing 0.x build
 *     site/v<version>/dripfinder.min.js    every frozen release (so a client can be pinned)
 *     site/configs/<slug>.json             runtime config, APPROVED configs only
 *
 *   A config whose "approved" block is empty is skipped and listed by name, so an
 *   answer-to-item map a medical director has not signed off never goes live. When a
 *   client's config is skipped, the hosted embed falls back to its Book button.
 */
var fs = require('fs');
var path = require('path');
var embeds = require('./lib/embeds');

var ROOT = path.join(__dirname, '..');
var RELEASES_DIR = path.join(ROOT, 'releases');
var CONFIG_DIR = path.join(ROOT, 'configs');
var SITE = path.join(ROOT, 'site');

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copy(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }

function semverCmp(a, b) {
  var pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (var i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

function listReleases() {
  if (!fs.existsSync(RELEASES_DIR)) return [];
  return fs.readdirSync(RELEASES_DIR).filter(function (d) {
    return /^\d+\.\d+\.\d+$/.test(d) && fs.existsSync(path.join(RELEASES_DIR, d, 'dripfinder.min.js'));
  });
}

function approved(cfg) { return !!(cfg.approved && cfg.approved.by && cfg.approved.date); }

function main() {
  var releases = listReleases();
  if (!releases.length) { console.error('assemble: no releases found. Run "npm run build" first.'); process.exit(1); }

  rmrf(SITE);
  fs.mkdirSync(SITE, { recursive: true });

  // Frozen, pinnable copies of every release.
  releases.forEach(function (v) {
    copy(path.join(RELEASES_DIR, v, 'dripfinder.min.js'), path.join(SITE, 'v' + v, 'dripfinder.min.js'));
    console.log('  site/v' + v + '/dripfinder.min.js');
  });

  // /v0/ = the latest 0.x release.
  var zeroX = releases.filter(function (v) { return v.split('.')[0] === '0'; }).sort(semverCmp);
  var latest = zeroX.length ? zeroX[zeroX.length - 1] : releases.slice().sort(semverCmp).pop();
  copy(path.join(RELEASES_DIR, latest, 'dripfinder.min.js'), path.join(SITE, 'v0', 'dripfinder.min.js'));
  console.log('  site/v0/dripfinder.min.js  -> ' + latest);

  // Configs, approved only.
  var cfgOut = path.join(SITE, 'configs');
  fs.mkdirSync(cfgOut, { recursive: true });
  var files = fs.existsSync(CONFIG_DIR)
    ? fs.readdirSync(CONFIG_DIR).filter(function (f) { return /\.json$/.test(f) && f[0] !== '_'; })
    : [];
  var published = 0, skipped = [];
  files.forEach(function (f) {
    var slug = f.replace(/\.json$/, '');
    var cfg = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, f), 'utf8'));
    if (!approved(cfg)) { skipped.push(slug); return; }
    cfg.version = latest;
    fs.writeFileSync(path.join(cfgOut, slug + '.json'), JSON.stringify(embeds.runtimeConfig(cfg)));
    published++;
    console.log('  site/configs/' + slug + '.json  (approved by ' + cfg.approved.by + ' ' + cfg.approved.date + ')');
  });

  console.log('');
  console.log('assemble: published ' + published + ' config(s); /v0/ = ' + latest + '.');
  if (skipped.length) {
    console.log('assemble: SKIPPED (approved block empty, will NOT go live): ' + skipped.join(', '));
    console.log('          Hosted embeds for these show the data-fallback Book button until approved.');
  }
}

main();
