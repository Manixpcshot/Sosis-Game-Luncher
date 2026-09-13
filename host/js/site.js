/* Sosis Web Platform — shared front logic (i18n, config, auth state, boards) */
'use strict';

const DICT = {
  fa: {
    'nav.features': 'امکانات', 'nav.leaderboard': 'لیدربورد', 'nav.profile': 'پروفایل', 'nav.login': 'ورود',
    'nav.register': 'ثبت‌نام', 'nav.logout': 'خروج',
    'hero.title': 'لانچر نسل جدید بازی‌های شما',
    'hero.sub': 'Sosis Launcher یک لانچر مدرن، دوزبانه و سبک برای ویندوز است: کتابخانه بازی‌ها، ثبت دقیق زمان بازی، اورلی شفاف داخل بازی، دستیار هوش مصنوعی و همگام‌سازی آنلاین پروفایل و لیدربورد.',
    'hero.download': 'دانلود Sosis Launcher', 'hero.github': 'ریلیزهای GitHub',
    'hero.disabled': 'دانلود موقتاً توسط مدیر غیرفعال شده است.',
    'hero.version': 'نسخه {v} · ویندوز ۱۰/۱۱ x64',
    'features.title': 'همه چیز یک لانچر حرفه‌ای',
    'features.f1t': 'کتابخانه هوشمند', 'features.f1d': 'افزودن هر exe، استخراج آیکون، کاور و بنر، جستجو، مرتب‌سازی و علاقه‌مندی‌ها.',
    'features.f2t': 'ثبت زمان بازی', 'features.f2d': 'زمان هر جلسه به‌صورت امن ثبت و با مجموع کل و لیدربورد آنلاین همگام می‌شود.',
    'features.f3t': 'اورلی داخل بازی', 'features.f3d': 'پنجره شفاف مستقل با FPS و زمان جلسه — بدون تزریق، بدون افت عملکرد.',
    'features.f4t': 'دستیار هوش مصنوعی', 'features.f4d': 'اتصال به هر API سازگار با OpenAI؛ پاسخ‌ها بر اساس کتابخانه خود شما.',
    'features.f5t': 'دوزبانه و RTL واقعی', 'features.f5d': 'فارسی راست‌به‌چپ کامل و انگلیسی چپ‌به‌راست، با یک کلیک.',
    'features.f6t': 'آپدیت خودکار', 'features.f6d': 'بررسی نسخه هنگام شروع، دانلود خودکار ستاپ، تأیید SHA-256 و اعمال تغییرات.',
    'home.topPlayers': 'برترین بازیکنان', 'home.popular': 'محبوب‌ترین بازی‌ها',
    'home.viewAll': 'مشاهده کامل', 'home.viewAll2': 'مشاهده کامل',
    'home.empty': 'هنوز داده‌ای ثبت نشده؛ اولین نفر باشید!',
    'home.players': 'بازیکن ثبت‌شده', 'home.sessions': 'جلسه بازی', 'home.games': 'بازی ردیابی‌شده',
    'install.title': 'نصب در سه قدم',
    'install.s1t': 'دانلود ستاپ', 'install.s1d': 'SosisLauncherSetup.exe را از همین صفحه یا ادمین دریافت کنید.',
    'install.s2t': 'نصب و میان‌بر', 'install.s2d': 'مسیر نصب را انتخاب کنید؛ میان‌بر دسکتاپ و استارت‌منو ساخته می‌شود.',
    'install.s3t': 'افزودن بازی‌ها', 'install.s3d': 'exe بازی را اضافه کنید؛ بقیه چیزها به‌صورت خودکار کار می‌کنند.',
    'footer.rights': '© 2026 Sosis Launcher — همه حقوق محفوظ است.', 'footer.admin': 'ادمین',
    'auth.loginTitle': 'ورود به حساب', 'auth.registerTitle': 'ساخت حساب کاربری',
    'auth.username': 'نام کاربری', 'auth.password': 'رمز عبور', 'auth.email': 'ایمیل (اختیاری)',
    'auth.loginBtn': 'ورود', 'auth.registerBtn': 'ثبت‌نام',
    'auth.toRegister': 'حساب ندارید؟ ثبت‌نام کنید', 'auth.toLogin': 'حساب دارید؟ وارد شوید',
    'auth.err.bad-username': 'نام کاربری باید ۳ تا ۲۴ کاراکتر (حروف/عدد/ـ/ـ) باشد.',
    'auth.err.weak-password': 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
    'auth.err.username-taken': 'این نام کاربری قبلاً گرفته شده است.',
    'auth.err.invalid-credentials': 'نام کاربری یا رمز عبور اشتباه است.',
    'profile.title': 'پروفایل من', 'profile.avatar': 'تغییر عکس', 'profile.playtime': 'مجموع زمان بازی',
    'profile.sessions': 'تعداد جلسه‌ها', 'profile.launches': 'تعداد اجراها', 'profile.joined': 'تاریخ عضویت',
    'profile.logout': 'خروج از حساب', 'profile.sync': 'همگام‌سازی از اپ انجام می‌شود؛ اینجا نمای کلی شماست.',
    'profile.notLogged': 'برای دیدن پروفایل وارد شوید یا حساب بسازید.',
    'board.title': 'لیدربورد زمان بازی', 'board.popular': 'محبوب‌ترین بازی‌ها',
    'board.players': 'بازیکنان', 'board.launches': 'اجرا', 'board.hours': 'ساعت',
    'common.hours': 'ساعت'
  },
  en: {
    'nav.features': 'Features', 'nav.leaderboard': 'Leaderboard', 'nav.profile': 'Profile', 'nav.login': 'Sign in',
    'nav.register': 'Register', 'nav.logout': 'Sign out',
    'hero.title': 'The next-generation launcher for your games',
    'hero.sub': 'Sosis Launcher is a modern, bilingual and lightweight Windows launcher: game library, accurate play-time tracking, transparent in-game overlay, AI assistant and online profile/leaderboard sync.',
    'hero.download': 'Download Sosis Launcher', 'hero.github': 'GitHub Releases',
    'hero.disabled': 'Downloads are temporarily disabled by the administrator.',
    'hero.version': 'Version {v} · Windows 10/11 x64',
    'features.title': 'Everything a pro launcher needs',
    'features.f1t': 'Smart library', 'features.f1d': 'Add any exe, icon extraction, covers & banners, search, sorting and favorites.',
    'features.f2t': 'Play-time tracking', 'features.f2d': 'Every session is recorded safely and synced with your total and the online leaderboard.',
    'features.f3t': 'In-game overlay', 'features.f3d': 'Independent transparent window with FPS and session time — no injection, no performance hit.',
    'features.f4t': 'AI assistant', 'features.f4d': 'Connect any OpenAI-compatible API; answers grounded in your own library.',
    'features.f5t': 'Bilingual with true RTL', 'features.f5d': 'Full right-to-left Persian and left-to-right English, one click apart.',
    'features.f6t': 'Auto update', 'features.f6d': 'Version check on start, automatic setup download, SHA-256 verification and apply.',
    'home.topPlayers': 'Top players', 'home.popular': 'Most popular games',
    'home.viewAll': 'View all', 'home.viewAll2': 'View all',
    'home.empty': 'No data yet — be the first!',
    'home.players': 'registered players', 'home.sessions': 'game sessions', 'home.games': 'tracked games',
    'install.title': 'Install in three steps',
    'install.s1t': 'Download setup', 'install.s1d': 'Get SosisLauncherSetup.exe from this page or the admin panel.',
    'install.s2t': 'Install & shortcuts', 'install.s2d': 'Pick the install directory; desktop and start-menu shortcuts are created.',
    'install.s3t': 'Add your games', 'install.s3d': 'Add a game exe; everything else just works.',
    'footer.rights': '© 2026 Sosis Launcher — All rights reserved.', 'footer.admin': 'Admin',
    'auth.loginTitle': 'Sign in', 'auth.registerTitle': 'Create account',
    'auth.username': 'Username', 'auth.password': 'Password', 'auth.email': 'Email (optional)',
    'auth.loginBtn': 'Sign in', 'auth.registerBtn': 'Register',
    'auth.toRegister': 'No account? Register', 'auth.toLogin': 'Have an account? Sign in',
    'auth.err.bad-username': 'Username must be 3-24 characters (letters/digits/_/-).',
    'auth.err.weak-password': 'Password must be at least 6 characters.',
    'auth.err.username-taken': 'This username is already taken.',
    'auth.err.invalid-credentials': 'Wrong username or password.',
    'profile.title': 'My profile', 'profile.avatar': 'Change photo', 'profile.playtime': 'Total play time',
    'profile.sessions': 'Sessions', 'profile.launches': 'Launches', 'profile.joined': 'Joined',
    'profile.logout': 'Sign out', 'profile.sync': 'Sync happens from the app; this is your overview.',
    'profile.notLogged': 'Sign in or register to see your profile.',
    'board.title': 'Play-time leaderboard', 'board.popular': 'Most popular games',
    'board.players': 'players', 'board.launches': 'launches', 'board.hours': 'hours',
    'common.hours': 'hours'
  }
};

let lang = localStorage.getItem('sosis.lang') || 'fa';
const t = (key, vars) => {
  let s = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
  for (const k in vars || {}) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
  return s;
};

function applyI18n() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.body.dir = document.documentElement.dir;
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.getAttribute('data-i18n'))));
  const lb = document.getElementById('langBtn');
  if (lb) lb.textContent = lang === 'fa' ? 'EN' : 'فا';
}

function hoursLabel(seconds) {
  const h = Math.round((seconds || 0) / 360) / 10;
  return h + ' ' + t('common.hours');
}

async function api(path, opts) {
  const res = await fetch(path, Object.assign({ headers: { 'content-type': 'application/json' } }, opts));
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

function avatarImg(user, size) {
  const img = document.createElement('img');
  img.src = user && user.avatar ? user.avatar : 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="16" fill="#1e293b"/><text x="32" y="40" font-size="26" text-anchor="middle" fill="#22d3ee" font-family="sans-serif">${((user && user.username) || '?')[0]}</text></svg>`
  );
  img.width = size; img.height = size; img.alt = '';
  return img;
}

async function refreshAuthNav() {
  const { data } = await api('/api/auth/me');
  const nav = document.getElementById('navAuth');
  if (!nav) return data && data.user;
  if (data && data.ok && data.user) {
    nav.textContent = data.user.username;
    nav.setAttribute('href', '/profile.html');
  } else {
    nav.textContent = t('nav.login');
    nav.setAttribute('href', '/login.html');
  }
  return data && data.ok ? data.user : null;
}

/* ------------------------------------------------------------ pages */
let SITE_CFG = null;

function applySiteOverrides(cfg) {
  if (!cfg) return;
  const set = (sel, val) => {
    if (!val) return;
    document.querySelectorAll(sel).forEach((el) => (el.textContent = val));
  };
  if (cfg.siteName) {
    set('.brand span', cfg.siteName);
    if (document.title.indexOf('Sosis Launcher') !== -1) {
      document.title = document.title.split('Sosis Launcher').join(cfg.siteName);
    }
  }
  set('[data-i18n="hero.title"]', cfg.heroTitle);
  set('[data-i18n="hero.sub"]', cfg.heroSub);
  set('#downloadBtn', cfg.downloadLabel);
  set('[data-i18n="footer.rights"]', cfg.footerText);
}

async function homePage(cfg) {
  const btn = document.getElementById('downloadBtn');
  const note = document.getElementById('downloadNote');
  const chip = document.getElementById('versionChip');
  if (cfg) {
    chip.textContent = t('hero.version', { v: cfg.latestVersion });
    if (!cfg.downloadEnabled) {
      btn.setAttribute('disabled', 'disabled');
      btn.removeAttribute('href');
      note.textContent = t('hero.disabled');
    } else {
      btn.setAttribute('href', cfg.downloadUrl);
      btn.setAttribute('download', '');
    }
  }
  const [lb, pop] = await Promise.all([api('/api/leaderboard'), api('/api/games/popular')]);
  const board = document.getElementById('homeBoard');
  const popular = document.getElementById('homePopular');
  const stats = document.getElementById('heroStats');
  const users = (lb.data && lb.data.users) || [];
  const games = (pop.data && pop.data.games) || [];
  board.innerHTML = '';
  popular.innerHTML = '';
  if (!users.length) board.innerHTML = `<li class="muted small">${t('home.empty')}</li>`;
  users.slice(0, 5).forEach((u) => {
    const li = document.createElement('li');
    li.appendChild(Object.assign(document.createElement('span'), { className: 'rank' }));
    li.appendChild(avatarImg(u, 30));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'who', textContent: u.username }));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'val', textContent: hoursLabel(u.totalPlayTime) }));
    board.appendChild(li);
  });
  if (!games.length) popular.innerHTML = `<li class="muted small">${t('home.empty')}</li>`;
  games.slice(0, 5).forEach((g) => {
    const li = document.createElement('li');
    li.appendChild(Object.assign(document.createElement('span'), { className: 'rank' }));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'who', textContent: g.name }));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'val', textContent: g.launches + ' ' + t('board.launches') }));
    popular.appendChild(li);
  });
  const sessions = users.reduce((a, u) => a + (u.totalSessions || 0), 0);
  stats.innerHTML = '';
  [[users.length, t('home.players')], [sessions, t('home.sessions')], [games.length, t('home.games')]].forEach(([n, label]) => {
    const div = document.createElement('div');
    div.className = 'st';
    div.innerHTML = `<b>${n}</b><span>${label}</span>`;
    stats.appendChild(div);
  });
}

function authPage(mode) {
  const form = document.getElementById('authForm');
  const msg = document.getElementById('authMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    msg.textContent = '…';
    const body = {
      username: document.getElementById('username').value,
      password: document.getElementById('password').value
    };
    const emailEl = document.getElementById('email');
    if (emailEl) body.email = emailEl.value;
    const { status, data } = await api(mode === 'login' ? '/api/auth/weblogin' : '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (data && data.ok) {
      msg.className = 'form-msg ok';
      msg.textContent = '✓';
      location.href = '/profile.html';
    } else {
      const key = data && data.error ? 'auth.err.' + data.error : 'auth.err.invalid-credentials';
      msg.className = 'form-msg err';
      msg.textContent = t(key) + (status >= 500 ? ' (' + status + ')' : '');
    }
  });
}

async function profilePage() {
  const user = await refreshAuthNav();
  const wrap = document.getElementById('profileBody');
  if (!user) {
    wrap.innerHTML = `<div class="card"><p class="muted">${t('profile.notLogged')}</p>
      <div class="row"><a class="btn primary" href="/login.html">${t('auth.loginBtn')}</a>
      <a class="btn" href="/register.html">${t('auth.registerBtn')}</a></div></div>`;
    return;
  }
  wrap.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  const head = document.createElement('div');
  head.className = 'profile-head';
  const box = document.createElement('div');
  box.className = 'avatar-box';
  const img = avatarImg(user, 92);
  img.style.borderRadius = '26px';
  box.appendChild(img);
  const up = document.createElement('button');
  up.title = t('profile.avatar');
  up.textContent = '✎';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/png,image/jpeg,image/webp';
  file.style.display = 'none';
  up.onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const { data } = await api('/api/auth/avatar', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) });
      if (data && data.ok) location.reload();
    };
    reader.readAsDataURL(f);
  };
  box.appendChild(up);
  box.appendChild(file);
  head.appendChild(box);
  const who = document.createElement('div');
  who.innerHTML = `<h1 style="margin:0">${user.username}</h1><div class="muted small">${t('profile.joined')}: ${new Date(user.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}</div>`;
  head.appendChild(who);
  card.appendChild(head);
  const stats = document.createElement('div');
  stats.className = 'stat-cards';
  [[hoursLabel(user.totalPlayTime), t('profile.playtime')], [user.totalSessions, t('profile.sessions')], [user.launchCount, t('profile.launches')]].forEach(([v, l]) => {
    const d = document.createElement('div');
    d.className = 'stat-card';
    d.innerHTML = `<b>${v}</b><span>${l}</span>`;
    stats.appendChild(d);
  });
  card.appendChild(stats);
  card.appendChild(Object.assign(document.createElement('p'), { className: 'muted small', textContent: t('profile.sync') }));
  const out = document.createElement('button');
  out.className = 'btn danger';
  out.textContent = t('profile.logout');
  out.onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };
  card.appendChild(out);
  wrap.appendChild(card);
}

async function leaderboardPage() {
  const [lb, pop] = await Promise.all([api('/api/leaderboard'), api('/api/games/popular')]);
  const board = document.getElementById('board');
  const popular = document.getElementById('popular');
  (lb.data && lb.data.users || []).forEach((u) => {
    const li = document.createElement('li');
    li.appendChild(Object.assign(document.createElement('span'), { className: 'rank' }));
    li.appendChild(avatarImg(u, 34));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'who', textContent: u.username }));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'val', textContent: hoursLabel(u.totalPlayTime) }));
    board.appendChild(li);
  });
  if (!board.children.length) board.innerHTML = `<li class="muted small">${t('home.empty')}</li>`;
  (pop.data && pop.data.games || []).forEach((g) => {
    const li = document.createElement('li');
    li.appendChild(Object.assign(document.createElement('span'), { className: 'rank' }));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'who', textContent: g.name }));
    li.appendChild(Object.assign(document.createElement('span'), { className: 'val', textContent: `${g.launches} ${t('board.launches')} · ${g.players} ${t('board.players')}` }));
    popular.appendChild(li);
  });
  if (!popular.children.length) popular.innerHTML = `<li class="muted small">${t('home.empty')}</li>`;
}

/* ------------------------------------------------------------ boot */
document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  const lb = document.getElementById('langBtn');
  if (lb) lb.onclick = () => { lang = lang === 'fa' ? 'en' : 'fa'; localStorage.setItem('sosis.lang', lang); location.reload(); };
  const page = document.body.dataset.page;
  if (page !== 'admin') {
    const cfgRes = await api('/api/site/config');
    if (cfgRes.data && cfgRes.data.ok) { SITE_CFG = cfgRes.data; applySiteOverrides(SITE_CFG); }
    await refreshAuthNav();
  }
  if (page === 'home') homePage(SITE_CFG);
  if (page === 'login') authPage('login');
  if (page === 'register') authPage('register');
  if (page === 'profile') profilePage();
  if (page === 'leaderboard') leaderboardPage();
  if (page === 'admin' && window.adminInit) window.adminInit(t, api);
});
