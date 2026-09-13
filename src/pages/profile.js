/**
 * Profile page — Sosis account: login/register, avatar upload, stats overview.
 * Synced with the Sosis Web Platform (app.sosis-shop.top).
 */
import { h, clear, icon } from '../lib/dom.js';
import { t, applyToDocument } from '../lib/i18n.js';
import { toast } from '../lib/toast.js';
import { playTime } from '../lib/format.js';

export function profilePage(root) {
  const host = h('div', { class: 'page-enter' });
  root.appendChild(host);
  render();

  async function render() {
    clear(host);
    const st = await window.sosis.account.state();
    const ping = await window.sosis.account.ping();

    host.appendChild(
      h('div', { class: 'page-header' }, [
        h('div', { class: 'page-heading' }, [
          h('h1', { 'data-i18n': 'profile.title' }),
          h('p', { 'data-i18n': 'profile.subtitle' })
        ]),
        h(
          'span',
          { class: 'session-pill', style: ping.ok ? '' : 'color:var(--danger)' },
          [
            h('span', { class: 'dot', style: ping.ok ? '' : 'background:var(--danger);box-shadow:none' }),
            h('span', { text: ping.ok ? t('profile.serverOnline') : t('profile.serverOffline') })
          ]
        )
      ])
    );

    if (!st.loggedIn) return renderAuth();
    return renderProfile(st);
  }

  function renderAuth() {
    let mode = 'login';
    const msg = h('div', { class: 'muted small', style: { minHeight: '20px' } });
    const username = h('input', { class: 'text-input', autocomplete: 'username' });
    const password = h('input', { class: 'text-input', type: 'password', autocomplete: 'current-password' });
    const email = h('input', { class: 'text-input', type: 'email' });
    const emailRow = h('div', { class: 'col', style: { gap: '6px' } }, [
      h('label', { class: 'small muted', 'data-i18n': 'profile.email' }),
      email
    ]);
    emailRow.classList.add('hidden');

    const submit = h('button', { class: 'btn btn-primary', onclick: () => go() }, [
      icon('user', 15),
      h('span', { 'data-i18n': 'profile.login' })
    ]);
    const switchBtn = h('button', { class: 'btn btn-ghost', onclick: () => toggleMode() }, [
      h('span', { 'data-i18n': 'profile.toRegister' })
    ]);

    function toggleMode() {
      mode = mode === 'login' ? 'register' : 'login';
      emailRow.classList.toggle('hidden', mode === 'login');
      submit.querySelector('span').setAttribute('data-i18n', mode === 'login' ? 'profile.login' : 'profile.register');
      switchBtn.querySelector('span').setAttribute('data-i18n', mode === 'login' ? 'profile.toRegister' : 'profile.toLogin');
      applyToDocument(host);
    }

    async function go() {
      msg.textContent = '…';
      const res =
        mode === 'login'
          ? await window.sosis.account.login(username.value.trim(), password.value)
          : await window.sosis.account.register(username.value.trim(), password.value, email.value.trim());
      if (res.ok) {
        toast.success(mode === 'login' ? t('profile.loginOk') : t('profile.registerOk'));
        render();
      } else {
        msg.textContent = t('profile.err.' + res.error) !== 'profile.err.' + res.error ? t('profile.err.' + res.error) : res.error;
      }
    }

    host.appendChild(
      h('div', { class: 'panel', style: { maxWidth: '440px' } }, [
        h('h3', { 'data-i18n': 'profile.notLogged' }),
        h('div', { class: 'col', style: { marginTop: '12px' } }, [
          h('label', { class: 'small muted', 'data-i18n': 'profile.username' }),
          username,
          mode === 'register' ? null : null,
          h('label', { class: 'small muted', 'data-i18n': 'profile.password' }),
          password,
          emailRow,
          h('div', { class: 'row' }, [submit, switchBtn]),
          msg
        ])
      ])
    );
    applyToDocument(host);
  }

  function renderProfile(st) {
    const u = st.user;
    const server = st.server || '';
    const avatarUrl = u.avatar ? server + u.avatar : null;
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/webp',
      style: { display: 'none' },
      onchange: async () => {
        const f = fileInput.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const res = await window.sosis.account.uploadAvatar(reader.result);
          if (res.ok) {
            toast.success(t('profile.avatarUpdated'));
            render();
          } else toast.error(res.error);
        };
        reader.readAsDataURL(f);
      }
    });

    const avatarBox = h('div', { style: { position: 'relative', width: '92px', height: '92px' } }, [
      avatarUrl
        ? h('img', {
            src: avatarUrl,
            alt: '',
            style: { width: '92px', height: '92px', borderRadius: '24px', border: '1px solid var(--border-strong)', objectFit: 'cover' },
            onerror: (e) => (e.target.style.display = 'none')
          })
        : h('div', {
            style: {
              width: '92px',
              height: '92px',
              borderRadius: '24px',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              fontSize: '34px',
              fontWeight: '800',
              color: 'var(--accent)'
            },
            text: (u.username || '?')[0].toUpperCase()
          }),
      h(
        'button',
        {
          class: 'icon-btn',
          style: { position: 'absolute', bottom: '-8px', insetInlineEnd: '-8px', width: '32px', height: '32px', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: '#06131a', border: '0' },
          onclick: () => fileInput.click(),
          'data-i18n-title': 'profile.changeAvatar'
        },
        [icon('edit', 14)]
      ),
      fileInput
    ]);

    host.appendChild(
      h('div', { class: 'panel' }, [
        h('div', { class: 'row', style: { gap: '18px', flexWrap: 'wrap' } }, [
          avatarBox,
          h('div', { class: 'col', style: { gap: '4px' } }, [
            h('div', { style: { fontSize: '20px', fontWeight: '800' }, text: u.username }),
            h('div', { class: 'muted small', text: server.replace('https://', '') }),
            h('div', { class: 'row', style: { marginTop: '8px' } }, [
              h('button', {
                class: 'btn btn-sm btn-danger',
                onclick: async () => {
                  await window.sosis.account.logout();
                  toast.info(t('profile.loggedOut'));
                  render();
                }
              }, [h('span', { 'data-i18n': 'profile.logout' })])
            ])
          ])
        ]),
        h('div', { class: 'stat-cards', style: { marginTop: '18px' } }, [
          h('div', { class: 'stat-card' }, [
            h('div', { class: 'num', text: playTime(u.totalPlayTime) }),
            h('div', { class: 'lbl', 'data-i18n': 'profile.playtime' })
          ]),
          h('div', { class: 'stat-card' }, [
            h('div', { class: 'num', text: String(u.totalSessions || 0) }),
            h('div', { class: 'lbl', 'data-i18n': 'profile.sessions' })
          ]),
          h('div', { class: 'stat-card' }, [
            h('div', { class: 'num', text: String(u.launchCount || 0) }),
            h('div', { class: 'lbl', 'data-i18n': 'profile.launches' })
          ])
        ]),
        h('p', { class: 'muted small', 'data-i18n': 'profile.syncNote' })
      ])
    );
    applyToDocument(host);
  }
}
