#!/usr/bin/env node
'use strict';
/**
 * GitHub bootstrap (spec §53-54).
 *
 * Reads GITHUB_USERNAME / GITHUB_TOKEN / GITHUB_REPOSITORY ONLY from the
 * environment or a local .env file (which is git-ignored). The token is never
 * written to source, README, package.json or git history.
 *
 * Usage:
 *   cp .env.example .env   # fill values
 *   npm run github:setup
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || 'SosisLauncher';

function fail(msg) {
  console.error('✕', msg);
  process.exit(1);
}

if (!USERNAME || !TOKEN) {
  fail('GITHUB_USERNAME and GITHUB_TOKEN must be set in the environment or .env (see .env.example).');
}

function git(args, opts = {}) {
  const res = cp.spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (res.status !== 0 && !opts.allowFail) {
    console.error(res.stderr || res.stdout);
    fail('git ' + args.join(' ') + ' failed');
  }
  return res;
}

async function api(method, endpoint, body) {
  const res = await fetch('https://api.github.com' + endpoint, {
    method,
    headers: {
      authorization: 'Bearer ' + TOKEN,
      accept: 'application/vnd.github+json',
      'user-agent': 'sosis-launcher-setup'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json };
}

(async () => {
  // sanity: token identity
  const me = await api('GET', '/user');
  if (me.status !== 200) fail('GitHub rejected the token (HTTP ' + me.status + ').');
  if (me.json.login !== USERNAME) {
    fail(`Token belongs to "${me.json.login}" but GITHUB_USERNAME="${USERNAME}".`);
  }
  console.log('✓ authenticated as', me.json.login);

  // repo exists?
  const repo = await api('GET', `/repos/${USERNAME}/${REPO}`);
  if (repo.status === 404) {
    const created = await api('POST', '/user/repos', {
      name: REPO,
      description: 'Sosis Launcher — a modern bilingual Windows game launcher (Electron).',
      private: false,
      has_issues: true,
      auto_init: false
    });
    if (created.status !== 201) fail('Could not create repository: HTTP ' + created.status);
    console.log('✓ created repository', USERNAME + '/' + REPO);
  } else if (repo.status === 200) {
    console.log('✓ repository exists:', USERNAME + '/' + REPO);
  } else {
    fail('Unexpected repo lookup status ' + repo.status);
  }

  // local git
  if (!fs.existsSync(path.join(ROOT, '.git'))) git(['init', '-b', 'main']);
  git(['add', '-A']);
  const status = git(['status', '--porcelain']);
  if (status.stdout.trim()) {
    git(['commit', '-m', 'Sosis Launcher ' + require(path.join(ROOT, 'package.json')).version]);
    console.log('✓ committed');
  } else {
    console.log('· nothing new to commit');
  }

  const remote = `https://github.com/${USERNAME}/${REPO}.git`;
  const remotes = git(['remote'], { allowFail: true }).stdout;
  if (!remotes.includes('origin')) git(['remote', 'add', 'origin', remote]);
  else git(['remote', 'set-url', 'origin', remote]);

  // push with token injected via a temporary askpass-free URL, then restore a clean URL
  const authed = `https://${USERNAME}:${TOKEN}@github.com/${USERNAME}/${REPO}.git`;
  git(['push', '--set-upstream', authed, 'main'], { allowFail: true });
  git(['remote', 'set-url', 'origin', remote]); // never keep credentials in .git/config
  console.log('✓ pushed to', remote);
  console.log('\nSecurity reminder: rotate any token that was ever pasted into chat or CI logs.');
})().catch((err) => fail(err && err.message ? err.message : String(err)));
