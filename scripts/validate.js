'use strict';
/*
 * npm run validate
 * JSON Schema (schema/config.schema.json) + semantic rule checks (scripts/lib/rules.js)
 * for every config in configs/ (skips _template.json etc.). Exits non-zero on any failure.
 */
var fs = require('fs');
var path = require('path');
var Ajv = require('ajv');
var rules = require('./lib/rules');

var ROOT = path.join(__dirname, '..');
var CONFIG_DIR = path.join(ROOT, 'configs');
var SCHEMA = path.join(ROOT, 'schema', 'config.schema.json');

function listConfigs() {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs.readdirSync(CONFIG_DIR)
    .filter(function (f) { return /\.json$/.test(f) && f[0] !== '_'; })
    .map(function (f) { return { slug: f.replace(/\.json$/, ''), file: path.join(CONFIG_DIR, f) }; });
}

function main() {
  var schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  var ajv = new Ajv({ allErrors: true, strict: false });
  var validate = ajv.compile(schema);

  var configs = listConfigs();
  if (!configs.length) { console.log('No configs to validate.'); return; }

  var failed = 0;
  configs.forEach(function (c) {
    var errs = [];
    var cfg;
    try { cfg = JSON.parse(fs.readFileSync(c.file, 'utf8')); }
    catch (e) { console.error('FAIL ' + c.slug + ': invalid JSON - ' + e.message); failed++; return; }

    if (!validate(cfg)) {
      (validate.errors || []).forEach(function (e) {
        errs.push('schema ' + (e.instancePath || '/') + ' ' + e.message +
          (e.params && e.params.additionalProperty ? ' ("' + e.params.additionalProperty + '")' : ''));
      });
    }
    rules.runRules(cfg).forEach(function (m) { errs.push(m); });

    if (errs.length) {
      failed++;
      console.error('FAIL ' + c.slug + ' (' + errs.length + '):');
      errs.forEach(function (m) { console.error('  - ' + m); });
    } else {
      var note = (cfg.approved && cfg.approved.by) ? 'approved by ' + cfg.approved.by : 'NOT approved (will be skipped on deploy)';
      console.log('OK   ' + c.slug + '  [' + note + ']');
    }
  });

  if (failed) { console.error('\nvalidate: ' + failed + ' config(s) failed.'); process.exit(1); }
  console.log('\nvalidate: all configs passed.');
}

main();
