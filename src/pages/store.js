/**
 * Store page — Steam-like game downloads from the Sosis Web Platform.
 * Free games: claim + download. Paid games: buy with wallet credit or pay
 * card-to-card and send the receipt photo (admin approves -> credit -> buy).
 * Works offline with the cached catalog (downloads disabled).
 */
import { h, clear, icon } from '../lib/dom.js';
import { t, currentLocale, applyToDocument } from '../lib/i18n.js';
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { bytes } from '../lib/format.js';
import { emptyState } from '../components/empty-state.js';
import { state } from '../lib/store.js';

export function storePage(root) {
  let catalog = null;
  let filter = '';

  const wrap = h('div', { class: 'page-enter col' });
  root.appendChild(wrap);
  load();

  async function load() {
    clear(wrap);
    wrap.appendChild(h('div', { class: 'panel store-loading' }, [h('div', { class: 'spinner' }), h('span', { class: 'muted', text: '…' })]));
    const res = await window.sosis.store.catalog();
    catalog = res && res.ok ? res : { ok: false, games: [], meta: null, offline: !!(res && res.offline), server: res && res.server, error: res && res.error };
    render();
  }

  function fmtPrice(p) {
    if (!p || p <= 0) return t('store.free');
    return Number(p).toLocaleString(currentLocale() === 'fa' ? 'fa-IR' : 'en-US') + ' ' + t('store.currency');
  }

  function img(src, cls, alt) {
    if (!src) return null;
    return h('img', {
      src,
      alt: alt || '',
      class: cls || '',
      loading: 'lazy',
      onerror: (e) => (e.target.style.display = 'none')
    });
  }

  function render() {
    clear(wrap);
    const meta = catalog.meta || {};

    const header = h('div', { class: 'page-header' }, [
      h('div', { class: 'page-heading' }, [
        h('h1', { 'data-i18n': 'store.title' }),
        h('p', { 'data-i18n': 'store.subtitle' })
      ]),
      h('div', { class: 'row', style: { gap: '8px' } }, [
        meta.loggedIn
          ? h('span', { class: 'session-pill', title: t('store.credit') }, [
              icon('wallet', 14),
              h('span', { text: Number(meta.credit || 0).toLocaleString(currentLocale() === 'fa' ? 'fa-IR' : 'en-US') + ' ' + t('store.currency') })
            ])
          : null,
        h('input', {
          class: 'text-input store-search',
          placeholder: t('store.searchPlaceholder'),
          oninput: (e) => {
            filter = e.target.value.trim().toLowerCase();
            renderGrid();
          }
        }),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => load(), 'data-i18n-title': 'store.refresh' }, [icon('refresh', 15)])
      ])
    ]);
    wrap.appendChild(header);

    if (catalog.offline) {
      wrap.appendChild(
        h('div', { class: 'panel store-offline-note' }, [
          icon('wifiOff', 16),
          h('span', { text: catalog.games.length ? t('store.offlineCached') : t('store.offline') })
        ])
      );
    }

    const gridHost = h('div', { class: 'store-grid-host' });
    wrap.appendChild(gridHost);
    renderGrid();

    function renderGrid() {
      clear(gridHost);
      const games = (catalog.games || []).filter((g) => !filter || String(g.name).toLowerCase().includes(filter));
      if (!games.length) {
        gridHost.appendChild(emptyState({ iconName: 'store', titleKey: 'store.empty', bodyKey: filter ? 'store.noMatch' : 'store.emptyHint' }));
        return;
      }
      const grid = h('div', { class: 'store-grid' });
      games.forEach((g) => grid.appendChild(card(g)));
      gridHost.appendChild(grid);
    }

    function card(g) {
      const cover = g.cover ? catalog.server + g.cover : null;
      const hover = (g.hoverImage || g.banner) ? catalog.server + (g.hoverImage || g.banner) : null;
      const priceBadge = g.owned
        ? h('span', { class: 'store-badge owned' }, [icon('check', 12), h('span', { text: t('store.owned') })])
        : g.price > 0
          ? h('span', { class: 'store-badge paid', text: fmtPrice(g.price) })
          : h('span', { class: 'store-badge free', text: t('store.free') });
      return h('div', { class: 'store-card', onclick: () => openDetails(g), tabindex: '0', onkeydown: (e) => e.key === 'Enter' && openDetails(g) }, [
        h('div', { class: 'store-cover' }, [
          cover
            ? img(cover, 'cover-img', g.name)
            : h('div', { class: 'cover-fallback' }, [h('span', { text: String(g.name || '?')[0].toUpperCase() })]),
          hover ? h('div', { class: 'store-hover' }, [img(hover, 'hover-img', ''), h('div', { class: 'hover-desc', text: String(g.description || '').slice(0, 140) })]) : null,
          priceBadge
        ]),
        h('div', { class: 'store-meta' }, [
          h('div', { class: 'store-name', text: g.name }),
          h('div', { class: 'store-sub muted' }, [
            g.size ? h('span', { text: bytes(g.size) }) : null,
            g.size ? h('span', { text: ' · ' }) : null,
            h('span', { text: t('store.downloadsCount', { n: String(g.downloads || 0) }) })
          ])
        ])
      ]);
    }
  }

  function errText(e) {
    const k = 'store.err.' + (e || 'unknown');
    const v = t(k);
    return v === k ? String(e || 'error') : v;
  }

  async function refreshCatalog() {
    const res = await window.sosis.store.catalog();
    if (res && res.ok) catalog = res;
    render();
  }

  async function doInstall(g) {
    const res = await window.sosis.store.install(g);
    if (res.ok) {
      toast.success(t('store.downloadStarted', { name: g.name }));
      setTimeout(() => (location.hash = '#/downloads'), 600);
    } else {
      toast.error(errText(res.error));
    }
  }

  async function claimAndInstall(g) {
    const res = await window.sosis.store.claim(g.id);
    if (!res.ok) {
      toast.error(errText(res.error));
      return;
    }
    toast.success(t('store.claimOk'));
    g.owned = true;
    await doInstall(g);
    refreshCatalog();
  }

  function openDetails(g) {
    const meta = catalog.meta || {};
    const bannerSrc = (g.banner || g.cover) ? catalog.server + (g.banner || g.cover) : null;

    const actions = h('div', { class: 'row store-actions' });
    const body = h('div', { class: 'col store-details' }, [
      bannerSrc ? img(bannerSrc, 'store-banner', g.name) : null,
      h('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
        h('span', { class: 'store-badge ' + (g.owned ? 'owned' : g.price > 0 ? 'paid' : 'free'), text: g.owned ? t('store.owned') : fmtPrice(g.price) }),
        g.size ? h('span', { class: 'muted small', text: bytes(g.size) }) : null,
        h('span', { class: 'muted small', text: t('store.downloadsCount', { n: String(g.downloads || 0) }) })
      ]),
      h('p', { class: 'store-desc', text: g.description || t('store.noDescription') }),
      actions
    ]);

    const close = openModal({ title: g.name, sub: t('store.details'), body, wide: true });
    applyToDocument(document.getElementById('modalRoot'));

    function setActions() {
      clear(actions);
      if (catalog.offline) {
        actions.appendChild(h('span', { class: 'muted small', text: t('store.offline') }));
        return;
      }
      if (!meta.loggedIn) {
        actions.appendChild(
          h('button', {
            class: 'btn btn-primary',
            onclick: () => {
              close();
              location.hash = '#/profile';
            }
          }, [icon('user', 15), h('span', { text: t('store.loginToGet') })])
        );
        return;
      }
      if (g.owned || g.price <= 0) {
        if (g.owned) {
          actions.appendChild(h('button', { class: 'btn btn-primary', onclick: () => doInstall(g) }, [icon('downloads', 15), h('span', { text: t('store.download') })]));
        } else {
          actions.appendChild(
            h('button', { class: 'btn btn-primary', onclick: async (e) => { e.target.disabled = true; await claimAndInstall(g); close(); } }, [
              icon('downloads', 15),
              h('span', { text: t('store.get') })
            ])
          );
        }
        if (!g.url && g.owned) actions.appendChild(h('span', { class: 'muted small', text: t('store.noFile') }));
        return;
      }
      // paid + not owned
      actions.appendChild(h('button', { class: 'btn btn-primary', onclick: () => openBuy(g) }, [icon('wallet', 15), h('span', { text: t('store.buy') })]));
    }
    setActions();
  }

  function openBuy(g) {
    const meta = catalog.meta || {};
    const credit = Number(meta.credit || 0);
    const price = Number(g.price || 0);
    const msg = h('div', { class: 'form-msg' });

    const cardRow = meta.cardNumber
      ? h('div', { class: 'panel pay-card' }, [
          h('div', { class: 'col', style: { gap: '4px' } }, [
            h('div', { class: 'muted small', 'data-i18n': 'store.cardNumber' }),
            h('div', { class: 'pay-card-number', text: String(meta.cardNumber).replace(/-/g, ' ') }),
            meta.cardHolder ? h('div', { class: 'muted small', text: String(meta.cardHolder) }) : null
          ]),
          h('button', {
            class: 'btn btn-sm btn-ghost',
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(String(meta.cardNumber));
                toast.success(t('store.copied'));
              } catch {
                toast.error(t('store.copyFailed'));
              }
            }
          }, [h('span', { 'data-i18n': 'store.copy' })])
        ])
      : h('p', { class: 'muted small', 'data-i18n': 'store.noCardConfigured' });

    let receiptData = null;
    const preview = h('img', { class: 'pay-preview hidden', alt: '' });
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/webp',
      onchange: () => {
        const f = fileInput.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) {
          toast.error(t('store.receiptTooLarge'));
          fileInput.value = '';
          return;
        }
        const r = new FileReader();
        r.onload = () => {
          receiptData = r.result;
          preview.src = receiptData;
          preview.classList.remove('hidden');
        };
        r.readAsDataURL(f);
      }
    });
    const noteInput = h('input', { class: 'text-input', placeholder: t('store.notePlaceholder') });

    const body = h('div', { class: 'col', style: { gap: '12px' } }, [
      h('div', { class: 'row pay-amount' }, [
        h('span', { 'data-i18n': 'store.amount' }),
        h('b', { text: Number(price).toLocaleString(currentLocale() === 'fa' ? 'fa-IR' : 'en-US') + ' ' + t('store.currency') })
      ]),
      credit >= price
        ? h('button', {
            class: 'btn btn-primary',
            onclick: async (e) => {
              e.target.disabled = true;
              msg.textContent = '…';
              const res = await window.sosis.store.buy(g.id);
              if (res.ok) {
                toast.success(t('store.buyOk', { name: g.name }));
                g.owned = true;
                closeBuy();
                refreshCatalog();
                doInstall(g);
              } else {
                e.target.disabled = false;
                msg.textContent = errText(res.error);
                msg.className = 'form-msg error';
              }
            }
          }, [icon('wallet', 15), h('span', { text: t('store.buyWithCredit', { credit: String(credit) }) })])
        : h('div', { class: 'panel pay-lowcredit' }, [
            h('span', { class: 'muted small', text: t('store.notEnoughCredit', { credit: String(credit), price: String(price) }) })
          ]),
      h('div', { class: 'pay-divider' }, [h('span', { class: 'muted small', 'data-i18n': 'store.payDivider' })]),
      h('p', { class: 'muted small', 'data-i18n': 'store.payIntro' }),
      cardRow,
      meta.paymentNote ? h('p', { class: 'muted small', text: String(meta.paymentNote) }) : null,
      h('label', { class: 'small muted', 'data-i18n': 'store.receipt' }),
      fileInput,
      preview,
      h('label', { class: 'small muted', 'data-i18n': 'store.noteLabel' }),
      noteInput,
      h('button', {
        class: 'btn',
        onclick: async (e) => {
          if (!receiptData) {
            msg.className = 'form-msg error';
            msg.textContent = t('store.receiptRequired');
            return;
          }
          e.target.disabled = true;
          msg.textContent = '…';
          const res = await window.sosis.store.payment(g.id, receiptData, noteInput.value.trim());
          if (res.ok) {
            toast.success(t('store.paymentSubmitted'));
            closeBuy();
          } else {
            e.target.disabled = false;
            msg.className = 'form-msg error';
            msg.textContent = errText(res.error);
          }
        }
      }, [icon('receipt', 15), h('span', { 'data-i18n': 'store.submitPayment' })]),
      msg
    ]);

    const closeBuy = openModal({ title: t('store.payTitle', { name: g.name }), body, wide: false });
    applyToDocument(document.getElementById('modalRoot'));
  }

  return { refresh: () => render() };
}
