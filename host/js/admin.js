/* Sosis Web Platform — admin panel logic (cookie-authenticated) */
'use strict';

(function () {
  let T = (k) => k;
  let API = null;
  let state = null;
  let activeTab = 'publish';

  const $ = (id) => document.getElementById(id);

  window.adminInit = async function (t, api) {
    T = t; API = api;
    $('adminLoginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { status, data } = await API('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: $('adminPass').value })
      });
      if (data && data.ok) enter();
      else {
        $('adminLoginMsg').className = 'form-msg err';
        $('adminLoginMsg').textContent = status === 401 ? '✕ Wrong password' : '✕ ' + status;
      }
    });
    $('adminLogout').addEventListener('click', async () => {
      await API('/api/admin/logout', { method: 'POST' });
      location.reload();
    });
    document.querySelectorAll('#adminTabs button[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        activeTab = b.dataset.tab;
        document.querySelectorAll('#adminTabs button[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
        renderTab();
      })
    );
    const { status } = await API('/api/admin/state');
    if (status === 200) enter();
  };

  async function enter() {
    $('adminLoginWrap').classList.add('hidden');
    $('adminPanelWrap').classList.remove('hidden');
    await refresh();
    renderTab();
  }

  async function refresh() {
    const { data } = await API('/api/admin/state');
    if (data && data.ok) state = data;
  }

  function fmtBytes(n) {
    if (!n) return '0 B';
    const mb = n / 1048576;
    return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(1) + ' MB';
  }

  function renderTab() {
    const host = $('adminContent');
    host.innerHTML = '';
    if (!state) return;
    if (activeTab === 'publish') renderPublish(host);
    if (activeTab === 'files') renderFiles(host);
    if (activeTab === 'site') renderSite(host);
    if (activeTab === 'users') renderUsers(host);
    if (activeTab === 'security') renderSecurity(host);
  }

  /* ------------------------------------------------ publish */
  function renderPublish(host) {
    const s = state.site;
    host.innerHTML = `
      <h2 style="margin-top:0">📦 Publish a new version</h2>
      <p class="muted small">When the published version is higher than the app's version, every client downloads the setup automatically on next start, verifies SHA-256, restarts and applies the update.</p>
      <div class="stat-cards">
        <div class="stat-card"><b>${s.latestVersion}</b><span>current published</span></div>
        <div class="stat-card"><b>${s.installerFile}</b><span>active installer</span></div>
        <div class="stat-card"><b>${s.downloadEnabled ? 'ON' : 'OFF'}</b><span>downloads</span></div>
      </div>
      <div class="field"><label>Version (semver)</label><input id="pubVersion" placeholder="1.2.0" value="${s.latestVersion}" /></div>
      <div class="field"><label>Installer file (from Files tab)</label><select id="pubFile">${state.files
        .map((f) => `<option value="${f.name}" ${f.name === s.installerFile ? 'selected' : ''}>${f.name} · ${fmtBytes(f.size)}</option>`)
        .join('')}</select></div>
      <div class="field"><label>Release notes</label><textarea id="pubNotes" rows="3">${s.notes || ''}</textarea></div>
      <div class="row">
        <button class="btn primary" id="pubBtn">Publish update</button>
        <span class="form-msg" id="pubMsg"></span>
      </div>
      <div class="progress hidden" id="pubProg"><span></span></div>`;
    $('pubBtn').onclick = async () => {
      const msg = $('pubMsg');
      msg.className = 'form-msg';
      msg.textContent = '…';
      const { data } = await API('/api/admin/publish', {
        method: 'POST',
        body: JSON.stringify({ version: $('pubVersion').value.trim(), file: $('pubFile').value, notes: $('pubNotes').value })
      });
      if (data && data.ok) {
        msg.className = 'form-msg ok';
        msg.textContent = '✓ Published v' + data.site.latestVersion + ' — apps will auto-update on next launch.';
        await refresh();
      } else {
        msg.className = 'form-msg err';
        msg.textContent = '✕ ' + (data ? data.error : 'network');
      }
    };
  }

  /* ------------------------------------------------ files */
  function renderFiles(host) {
    host.innerHTML = `
      <h2 style="margin-top:0">🗂 Download files (server/data/downloads)</h2>
      <p class="muted small">These files are served from <code>/datasetup/&lt;name&gt;</code>. Upload the new SosisLauncherSetup.exe here, then publish it.</p>
      <div class="row" style="margin-bottom:14px">
        <input type="file" id="fileInput" />
        <button class="btn primary" id="uploadBtn">Upload</button>
        <span class="small muted" id="upStatus"></span>
      </div>
      <div class="progress hidden" id="upProg"><span></span></div>
      <div id="fileList"></div>`;
    const list = $('fileList');
    const draw = () => {
      list.innerHTML = '';
      state.files.forEach((f) => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.innerHTML = `<span class="name">${f.name}</span><span class="small muted">${fmtBytes(f.size)}</span>`;
        const dl = document.createElement('a');
        dl.className = 'btn small';
        dl.href = '/datasetup/' + encodeURIComponent(f.name);
        dl.textContent = 'GET';
        row.appendChild(dl);
        if (f.name !== state.site.installerFile) {
          const del = document.createElement('button');
          del.className = 'btn danger';
          del.textContent = 'Delete';
          del.onclick = async () => {
            if (!confirm('Delete ' + f.name + '?')) return;
            await API('/api/admin/files/' + encodeURIComponent(f.name), { method: 'DELETE' });
            await refresh();
            draw();
          };
          row.appendChild(del);
        } else {
          const tag = document.createElement('span');
          tag.className = 'small';
          tag.style.color = 'var(--success)';
          tag.textContent = 'active';
          row.appendChild(tag);
        }
        list.appendChild(row);
      });
    };
    draw();
    $('uploadBtn').onclick = async () => {
      const input = $('fileInput');
      if (!input.files.length) return;
      const fd = new FormData();
      fd.append('file', input.files[0]);
      const prog = $('upProg');
      prog.classList.remove('hidden');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/files/upload');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) prog.firstElementChild.style.width = Math.round((e.loaded / e.total) * 100) + '%';
        $('upStatus').textContent = fmtBytes(e.loaded) + ' / ' + fmtBytes(e.total);
      };
      xhr.onload = async () => {
        prog.classList.add('hidden');
        if (xhr.status === 200) {
          $('upStatus').textContent = '✓ uploaded';
          await refresh();
          draw();
        } else $('upStatus').textContent = '✕ upload failed (' + xhr.status + ')';
      };
      xhr.send(fd);
    };
  }

  /* ------------------------------------------------ site config */
  function renderSite(host) {
    const s = state.site;
    host.innerHTML = `
      <h2 style="margin-top:0">⚙ Site & download button</h2>
      <div class="row" style="justify-content:space-between">
        <div>
          <div style="font-weight:700">Landing download button</div>
          <div class="muted small">When OFF, the site hides/disables the download button and /datasetup files return 403.</div>
        </div>
        <label class="switch"><input type="checkbox" id="dlToggle" ${s.downloadEnabled ? 'checked' : ''} /><span class="tr"><span class="th"></span></span></label>
      </div>
      <hr style="border-color:var(--border);margin:18px 0" />
      <div class="stat-cards">
        <div class="stat-card"><b>${state.stats.users}</b><span>users</span></div>
        <div class="stat-card"><b>${state.stats.sessions}</b><span>sessions synced</span></div>
        <div class="stat-card"><b>${state.stats.games}</b><span>games tracked</span></div>
      </div>
      <p class="muted small">Endpoints: <code>GET /datasetup</code> (manifest) · <code>GET /latest.json</code> (update) · files under <code>/datasetup/&lt;file&gt;</code></p>`;
    $('dlToggle').onchange = async (e) => {
      await API('/api/admin/config', { method: 'POST', body: JSON.stringify({ downloadEnabled: e.target.checked }) });
      await refresh();
    };
  }

  /* ------------------------------------------------ users */
  function renderUsers(host) {
    host.innerHTML = `<h2 style="margin-top:0">👥 Users (${state.users.length})</h2>
      <table class="users"><thead><tr><th>#</th><th>User</th><th>Play time</th><th>Sessions</th><th>Joined</th></tr></thead><tbody></tbody></table>`;
    const tb = host.querySelector('tbody');
    state.users
      .slice()
      .sort((a, b) => b.totalPlayTime - a.totalPlayTime)
      .forEach((u, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i + 1}</td><td>${u.username}</td><td>${Math.round(u.totalPlayTime / 3600 * 10) / 10}h</td><td>${u.totalSessions}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td>`;
        tb.appendChild(tr);
      });
  }

  /* ------------------------------------------------ security */
  function renderSecurity(host) {
    host.innerHTML = `
      <h2 style="margin-top:0">🔑 Change admin password</h2>
      <div class="field"><label>Current password</label><input id="curPass" type="password" /></div>
      <div class="field"><label>New password (min 8 chars)</label><input id="newPass" type="password" minlength="8" /></div>
      <div class="row"><button class="btn primary" id="pwBtn">Change password</button><span class="form-msg" id="pwMsg"></span></div>
      <p class="muted small">Passwords are stored as scrypt hashes. Sessions are HMAC-signed httpOnly cookies.</p>`;
    $('pwBtn').onclick = async () => {
      const msg = $('pwMsg');
      const { data } = await API('/api/admin/password', {
        method: 'POST',
        body: JSON.stringify({ current: $('curPass').value, next: $('newPass').value })
      });
      msg.className = 'form-msg ' + (data && data.ok ? 'ok' : 'err');
      msg.textContent = data && data.ok ? '✓ Password changed' : '✕ ' + (data ? data.error : 'network');
    };
  }
})();
