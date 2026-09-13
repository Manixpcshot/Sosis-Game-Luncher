'use strict';
/* Sosis Launcher Setup UI state machine: intro -> download -> verify -> install -> done */
const $ = (id) => document.getElementById(id);
const steps = ['stepIntro', 'stepDownload', 'stepError', 'stepVerifyFail', 'stepInstall', 'stepDone'];

let manifest = null;
let currentFile = null;

function show(id) {
  for (const s of steps) $(s).classList.toggle('hidden', s !== id);
}
function fmtBytes(n) {
  if (!n) return '0 MB';
  const mb = n / 1048576;
  return (mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)) + ' MB';
}
function fmtSpeed(b) {
  return fmtBytes(b) + '/s';
}
function fmtEta(s) {
  if (!s || !isFinite(s) || s <= 0) return '--:--';
  const m = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

document.getElementById('btnClose').onclick = () => window.setup.quit();
$('btnCancel1').onclick = () => window.setup.quit();
$('btnCancel2').onclick = async () => {
  await window.setup.cancel();
  window.setup.quit();
};
$('btnCancel3').onclick = () => window.setup.quit();
$('btnCancel4').onclick = () => window.setup.quit();
$('btnRetry').onclick = () => startDownload();
$('btnRetry2').onclick = () => startDownload();
$('btnStart').onclick = () => start();
$('btnFinish').onclick = () => window.setup.quit();
$('btnLaunch').onclick = async () => {
  await window.setup.launch();
  window.setup.quit();
};

window.setup.onProgress((p) => {
  $('barFill').style.width = (p.percent || 0) + '%';
  $('dlPercent').textContent = Math.round(p.percent || 0) + '%';
  $('dlBytes').textContent = fmtBytes(p.bytes) + ' / ' + fmtBytes(p.total);
  $('dlSpeed').textContent = p.speed ? fmtSpeed(p.speed) : '';
  $('dlEta').textContent = p.speed ? 'ETA ' + fmtEta(p.etaSeconds) : '';
});

async function start() {
  show('stepDownload');
  $('dlTitle').textContent = 'Contacting Launcher Download Endpoint…';
  const res = await window.setup.fetchManifest();
  if (!res.ok) return error('Could not fetch the download manifest: ' + res.error);
  manifest = res.manifest;
  startDownload();
}

async function startDownload() {
  if (!manifest) return error('No manifest loaded.');
  show('stepDownload');
  currentFile = manifest.files[0];
  $('dlTitle').textContent = 'Downloading Sosis Launcher…';
  $('dlFile').textContent = 'Current file: ' + currentFile.name;
  $('barFill').style.width = '0%';
  const res = await window.setup.download({
    url: currentFile.url,
    sha256: currentFile.sha256,
    size: currentFile.size
  });
  if (!res.ok) {
    if (res.error === 'sha256-mismatch') return show('stepVerifyFail');
    if (res.error === 'cancelled') return window.setup.quit();
    return error(res.error);
  }
  show('stepInstall');
  const inst = await window.setup.install({ file: res.file });
  if (!inst.ok) return error('Installer failed to start: ' + inst.error);
  // give the silent installer a moment, then offer launch
  setTimeout(() => show('stepDone'), 2500);
}

function error(detail) {
  $('errDetail').textContent = String(detail || 'Unknown error');
  show('stepError');
}

(async function init() {
  const cfg = await window.setup.config();
  $('endpointLabel').textContent = cfg.endpoint;
})();
