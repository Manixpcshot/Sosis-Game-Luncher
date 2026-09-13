/* Sosis Web Platform — admin panel logic (cookie-authenticated) */
'use strict';

(function () {
  let T = (k) => k;
  let API = null;
  let state = null;
  let activeTab = 'publish';

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
    if (activeTab === 'store') renderStore(host);
    if (activeTab === 'payments') renderPayments(host);
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
      <div class="field"><label>Release notes</label><textarea id="pubNotes" rows="3">${esc(s.notes)}</textarea></div>
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
      <h2 style="margin-top:0">🗂 Download files (datasetup/)</h2>
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
      <h3 style="margin:0 0 10px">Site texts (leave empty = built-in default)</h3>
      <div class="field"><label>Site name / brand</label><input id="cfgSiteName" value="${esc(s.siteName)}" placeholder="Sosis Launcher" /></div>
      <div class="field"><label>Landing title (hero H1)</label><input id="cfgHeroTitle" value="${esc(s.heroTitle)}" placeholder="default title" /></div>
      <div class="field"><label>Landing subtitle</label><textarea id="cfgHeroSub" rows="2" placeholder="default subtitle">${esc(s.heroSub)}</textarea></div>
      <div class="field"><label>Download button label</label><input id="cfgDownloadLabel" value="${esc(s.downloadLabel)}" placeholder="Download Sosis Launcher" /></div>
      <div class="field"><label>Footer text</label><input id="cfgFooterText" value="${esc(s.footerText)}" placeholder="© 2026 Sosis Launcher" /></div>
      <div class="field"><label>Release notes (served in /latest.json and /datasetup)</label><textarea id="cfgNotes" rows="3">${esc(s.notes)}</textarea></div>
      <h3 style="margin:18px 0 10px">Payment gateway (card-to-card)</h3>
      <div class="field"><label>Card number</label><input id="cfgCardNumber" value="${esc(s.cardNumber)}" placeholder="6037-XXXX-XXXX-XXXX" /></div>
      <div class="field"><label>Card holder</label><input id="cfgCardHolder" value="${esc(s.cardHolder)}" placeholder="Name on the card" /></div>
      <div class="field"><label>Payment instructions (shown in the purchase dialog)</label><textarea id="cfgPaymentNote" rows="2" placeholder="Pay to the card above and send the receipt photo.">${esc(s.paymentNote)}</textarea></div>
      <div class="row"><button class="btn primary" id="siteSaveBtn">Save site settings</button><span class="form-msg" id="siteMsg"></span></div>
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
    $('siteSaveBtn').onclick = async () => {
      const msg = $('siteMsg');
      msg.className = 'form-msg';
      msg.textContent = '…';
      const { data } = await API('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify({
          siteName: $('cfgSiteName').value.trim(),
          heroTitle: $('cfgHeroTitle').value.trim(),
          heroSub: $('cfgHeroSub').value.trim(),
          downloadLabel: $('cfgDownloadLabel').value.trim(),
          footerText: $('cfgFooterText').value.trim(),
          notes: $('cfgNotes').value,
          cardNumber: $('cfgCardNumber').value.trim(),
          cardHolder: $('cfgCardHolder').value.trim(),
          paymentNote: $('cfgPaymentNote').value
        })
      });
      if (data && data.ok) {
        msg.className = 'form-msg ok';
        msg.textContent = '✓ Saved';
        await refresh();
      } else {
        msg.className = 'form-msg err';
        msg.textContent = '✕ ' + (data ? data.error : 'network');
      }
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
        tr.innerHTML = `<td>${i + 1}</td><td>${esc(u.username)}</td><td>${Math.round(u.totalPlayTime / 3600 * 10) / 10}h</td><td>${u.totalSessions}</td><td><b>${(u.credit || 0).toLocaleString()}</b></td><td><input type="number" min="0" step="1000" placeholder="amount" style="width:90px" /><button class="btn small">+ add</button></td><td>${new Date(u.createdAt).toLocaleDateString()}</td>`;
        const btn = tr.querySelector('button');
        const inp = tr.querySelector('input');
        btn.onclick = async () => {
          const delta = parseInt(inp.value, 10);
          if (!delta || delta <= 0) return;
          await API('/api/admin/users/credit', { method: 'POST', body: JSON.stringify({ userId: u.id, delta }) });
          await refresh(); renderTab();
        };
        tb.appendChild(tr);
      });
  }


  /* ------------------------------------------------ store (game upload) */
  let storeGames = null;

  async function loadStoreGames() {
    const { data } = await API('/api/admin/games');
    if (data && data.ok) storeGames = data.games;
    return storeGames || [];
  }

  function fileToDataUrl(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function renderStore(host) {
    host.innerHTML = `
      <h2 style="margin-top:0">🎮 Store games (upload / link)</h2>
      <p class="muted small">Two ways: <b>direct upload</b> (up to 2GB, served from <code>/gamedl/</code> with ownership check) or an <b>external download link</b>. Price 0 = free. Paid games need an approved payment (credit) before download.</p>
      <div id="storeForm"></div>
      <div class="progress hidden" id="gameUpProg"><span></span></div>
      <div id="storeList" style="margin-top:16px"></div>`;
    drawStoreForm(host, null);
    loadStoreGames().then((games) => drawStoreList(games));
  }

  function drawStoreForm(host, g) {
    g = g || {};
    const wrap = $('storeForm');
    wrap.innerHTML = `
      <h3 style="margin:8px 0 10px">${g.id ? 'Edit game: ' + esc(g.name) : 'Add a new game'}</h3>
      <div class="field"><label>Name *</label><input id="gName" value="${esc(g.name || '')}" /></div>
      <div class="field"><label>Description (shown in the app store page)</label><textarea id="gDesc" rows="3">${esc(g.description || '')}</textarea></div>
      <div class="field"><label>Price (Toman — 0 = free)</label><input id="gPrice" type="number" min="0" step="1000" value="${g.price || 0}" /></div>
      <div class="row" style="gap:18px">
        <label><input type="radio" name="gKind" value="upload" ${g.kind !== 'link' ? 'checked' : ''} /> Direct upload (file)</label>
        <label><input type="radio" name="gKind" value="link" ${g.kind === 'link' ? 'checked' : ''} /> External download link</label>
      </div>
      <div class="field" id="gLinkWrap" style="display:${g.kind === 'link' ? 'block' : 'none'}"><label>Download link (https://…)</label><input id="gLink" value="${esc(g.linkUrl || '')}" placeholder="https://example.com/game.zip" /></div>
      <div class="field" id="gFileWrap" style="display:${g.kind === 'link' ? 'none' : 'block'}"><label>Game file (zip/exe, up to 2GB) ${g.file ? '— current: ' + esc(g.file) + ' (' + fmtBytes(g.size) + ')' : ''}</label><input type="file" id="gFile" /></div>
      <div class="row" style="gap:14px">
        <div class="field" style="flex:1"><label>Cover image (portrait card)</label><input type="file" id="gCover" accept="image/*" /></div>
        <div class="field" style="flex:1"><label>Banner image (details / hover)</label><input type="file" id="gBanner" accept="image/*" /></div>
        <div class="field" style="flex:1"><label>Hover image (optional)</label><input type="file" id="gHover" accept="image/*" /></div>
      </div>
      <div class="row">
        <label><input type="checkbox" id="gPublished" ${g.published === false ? '' : 'checked'} /> Published (visible in the app)</label>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" id="gSave">${g.id ? 'Save changes' : 'Create game'}</button>
        ${g.id ? '<button class="btn" id="gCancel">Cancel edit</button>' : ''}
        <span class="form-msg" id="gMsg"></span>
      </div>`;
    document.querySelectorAll('input[name="gKind"]').forEach((r) => (r.onchange = () => {
      const link = document.querySelector('input[name="gKind"]:checked').value === 'link';
      $('gLinkWrap').style.display = link ? 'block' : 'none';
      $('gFileWrap').style.display = link ? 'none' : 'block';
    }));
    if (g.id) $('gCancel').onclick = () => renderTab();
    $('gSave').onclick = async () => {
      const msg = $('gMsg');
      msg.className = 'form-msg'; msg.textContent = '…';
      const kind = document.querySelector('input[name="gKind"]:checked').value;
      const body = {
        name: $('gName').value.trim(),
        description: $('gDesc').value,
        price: parseInt($('gPrice').value, 10) || 0,
        kind,
        linkUrl: $('gLink').value.trim(),
        published: $('gPublished').checked
      };
      if (g.id) body.id = g.id;
      for (const [key, id] of [['coverDataUrl', 'gCover'], ['bannerDataUrl', 'gBanner'], ['hoverDataUrl', 'gHover']]) {
        const f = $(id).files[0];
        if (f) body[key] = await fileToDataUrl(f);
      }
      const { data } = await API('/api/admin/games', { method: 'POST', body: JSON.stringify(body) });
      if (!data || !data.ok) { msg.className = 'form-msg err'; msg.textContent = '✕ ' + (data ? data.error : 'network'); return; }
      const game = data.game;
      const fileInput = $('gFile');
      if (kind === 'upload' && fileInput.files.length) {
        const fd = new FormData();
        fd.append('gameId', game.id);
        fd.append('file', fileInput.files[0]);
        const prog = $('gameUpProg');
        prog.classList.remove('hidden');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/games/upload');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) prog.firstElementChild.style.width = Math.round((e.loaded / e.total) * 100) + '%';
          msg.textContent = 'uploading… ' + fmtBytes(e.loaded) + ' / ' + fmtBytes(e.total);
        };
        xhr.onload = async () => {
          prog.classList.add('hidden');
          if (xhr.status === 200) { msg.className = 'form-msg ok'; msg.textContent = '✓ saved + uploaded'; }
          else { msg.className = 'form-msg err'; msg.textContent = '✕ upload failed (' + xhr.status + ')'; }
          await refresh(); renderTab();
        };
        xhr.send(fd);
      } else {
        msg.className = 'form-msg ok'; msg.textContent = '✓ saved';
        await refresh(); renderTab();
      }
    };
  }

  function drawStoreList(games) {
    const list = $('storeList');
    if (!list) return;
    list.innerHTML = '<h3 style="margin:8px 0">Games (' + games.length + ')</h3>';
    if (!games.length) { list.innerHTML += '<p class="muted small">No games yet — add the first one above.</p>'; return; }
    games.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      const thumb = g.cover ? `<img src="/assets/store/${esc(g.cover)}" style="width:34px;height:44px;object-fit:cover;border-radius:6px" alt="" />` : '';
      row.innerHTML = `${thumb}<span class="name">${esc(g.name)}</span>
        <span class="small muted">${g.price > 0 ? g.price.toLocaleString() + ' T' : 'FREE'} · ${g.kind === 'link' ? 'link' : (g.file ? fmtBytes(g.size) : 'NO FILE')} · ${g.downloads || 0} dl</span>`;
      const pub = document.createElement('button');
      pub.className = 'btn small';
      pub.textContent = g.published ? 'Unpublish' : 'Publish';
      pub.onclick = async () => {
        await API('/api/admin/games', { method: 'POST', body: JSON.stringify({ id: g.id, name: g.name, description: g.description, price: g.price, kind: g.kind, linkUrl: g.linkUrl || '', published: !g.published }) });
        storeGames = await loadStoreGames(); drawStoreList(storeGames);
      };
      row.appendChild(pub);
      const edit = document.createElement('button');
      edit.className = 'btn small';
      edit.textContent = 'Edit';
      edit.onclick = () => drawStoreForm(null, g);
      row.appendChild(edit);
      const del = document.createElement('button');
      del.className = 'btn danger';
      del.textContent = 'Delete';
      del.onclick = async () => {
        if (!confirm('Delete "' + g.name + '" and all its files?')) return;
        await API('/api/admin/games/' + encodeURIComponent(g.id), { method: 'DELETE' });
        storeGames = await loadStoreGames(); drawStoreList(storeGames);
      };
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  /* ------------------------------------------------ payments review */
  function renderPayments(host) {
    host.innerHTML = `<h2 style="margin-top:0">🧾 Payments (receipt review)</h2>
      <p class="muted small">Users pay card-to-card and send the receipt photo. Approve → the amount is added to their <b>credit</b>; they then buy the game inside the app.</p>
      <div id="payList"><p class="muted small">loading…</p></div>`;
    API('/api/admin/payments').then(({ data }) => {
      const list = $('payList');
      if (!data || !data.ok) { list.innerHTML = '<p class="muted small">failed to load</p>'; return; }
      if (!data.payments.length) { list.innerHTML = '<p class="muted small">No payments yet.</p>'; return; }
      list.innerHTML = '';
      data.payments.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.style.flexWrap = 'wrap';
        row.innerHTML = `<a href="${esc(p.receipt)}" target="_blank" rel="noopener"><img src="${esc(p.receipt)}" style="width:52px;height:52px;object-fit:cover;border-radius:8px" alt="receipt" /></a>
          <span class="name">${esc(p.username)} → ${esc(p.gameName)}</span>
          <span class="small muted">${(p.amount || 0).toLocaleString()} T · ${p.status} · ${new Date(p.createdAt).toLocaleString()}${p.note ? ' · ' + esc(p.note) : ''}</span>`;
        if (p.status === 'pending') {
          const amt = document.createElement('input');
          amt.type = 'number'; amt.value = p.amount; amt.style.width = '100px'; amt.min = '0';
          row.appendChild(amt);
          const okB = document.createElement('button');
          okB.className = 'btn small'; okB.textContent = 'Approve (+credit)';
          okB.onclick = async () => {
            await API('/api/admin/payments', { method: 'POST', body: JSON.stringify({ paymentId: p.id, action: 'approve', amount: parseInt(amt.value, 10) || p.amount }) });
            await refresh(); renderTab();
          };
          row.appendChild(okB);
          const noB = document.createElement('button');
          noB.className = 'btn danger'; noB.textContent = 'Reject';
          noB.onclick = async () => {
            if (!confirm('Reject this payment?')) return;
            await API('/api/admin/payments', { method: 'POST', body: JSON.stringify({ paymentId: p.id, action: 'reject' }) });
            await refresh(); renderTab();
          };
          row.appendChild(noB);
        }
        list.appendChild(row);
      });
    });
  }

  /* ------------------------------------------------ security */
  function renderSecurity(host) {
    host.innerHTML = `
      <h2 style="margin-top:0">🔑 Change admin password</h2>
      <div class="field"><label>Current password</label><input id="curPass" type="password" /></div>
      <div class="field"><label>New password (min 8 chars)</label><input id="newPass" type="password" minlength="8" /></div>
      <div class="row"><button class="btn primary" id="pwBtn">Change password</button><span class="form-msg" id="pwMsg"></span></div>
      <p class="muted small">Passwords are stored as bcrypt hashes. Sessions are HMAC-signed httpOnly cookies.</p>`;
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
