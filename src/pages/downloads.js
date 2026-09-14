/**
 * Downloads page (spec §44): settings summary, live update/download progress
 * and the extensible queue view (empty state today).
 */
import { h, clear, icon } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state } from '../lib/store.js';
import { bytes, speed, eta } from '../lib/format.js';
import { emptyState } from '../components/empty-state.js';

export function downloadsPage(root) {
  const header = h('div', { class: 'page-header' }, [
    h('div', { class: 'page-heading' }, [h('h1', { 'data-i18n': 'nav.downloads' }), h('p', { 'data-i18n': 'downloads.subtitle' })])
  ]);

  const updatePanel = h('div', { class: 'panel' });
  const jobsPanel = h('div', { class: 'panel' });

  root.appendChild(h('div', { class: 'page-enter col' }, [header, updatePanel, jobsPanel]));

  renderUpdate();
  renderJobs([]);

  const offProgress = window.sosis.updates.onProgress(() => renderUpdate());
  const offState = window.sosis.updates.onState(() => renderUpdate());
  const offJobs = window.sosis.downloads.onChanged((jobs) => renderJobs(jobs));

  async function renderUpdate() {
    clear(updatePanel);
    const info = await window.sosis.downloads.get();
    const d = info.ok ? info.data.settings : state.settings.downloads;
    updatePanel.appendChild(h('h3', { 'data-i18n': 'downloads.updateSection' }));
    updatePanel.appendChild(
      h('div', { class: 'info-list' }, [
        h('div', { class: 'info-row' }, [h('span', { class: 'k', 'data-i18n': 'downloads.folder' }), h('span', { class: 'v path-chip', text: d.effectiveFolder || '—' })]),
        h('div', { class: 'info-row' }, [h('span', { class: 'k', 'data-i18n': 'downloads.concurrent' }), h('span', { class: 'v', text: String(d.concurrentDownloads) })]),
        h('div', { class: 'info-row' }, [h('span', { class: 'k', 'data-i18n': 'downloads.autoUpdate' }), h('span', { class: 'v', text: d.autoUpdate ? t('common.yes') : t('common.no') })])
      ])
    );
    updatePanel.appendChild(
      h('div', { class: 'action-row' }, [
        h('button', { class: 'btn btn-sm', onclick: async () => {
            const res = await window.sosis.updates.check();
            if (!res.ok) return;
            if (res.data.updateAvailable) renderProgress(res.data.info);
          } }, [icon('refresh', 14), h('span', { 'data-i18n': 'about.checkUpdates' })]),
        h('button', { class: 'btn btn-sm', onclick: () => window.sosis.downloads.openFolder() }, [
          icon('folder', 14),
          h('span', { 'data-i18n': 'downloads.openFolder' })
        ])
      ])
    );
    const progressHost = h('div', { id: 'updateProgressHost' });
    updatePanel.appendChild(progressHost);
  }

  function renderProgress(info) {
    const host = document.getElementById('updateProgressHost');
    if (!host) return;
    clear(host);
    const bar = h('div', { class: 'progress mt' }, [h('span')]);
    const meta = h('div', { class: 'progress-meta' }, [h('span'), h('span')]);
    host.appendChild(h('div', { class: 'small muted mt', text: t('updates.available', { version: info.latest }) }));
    host.appendChild(bar);
    host.appendChild(meta);
    window.sosis.updates.onProgress((p) => {
      bar.firstElementChild.style.width = (p.percent || 0) + '%';
      meta.children[0].textContent = `${bytes(p.bytes)} / ${bytes(p.total)}`;
      meta.children[1].textContent = `${speed(p.speed)} · ${t('updates.eta', { eta: eta(p.etaSeconds) })}`;
    });
    host.appendChild(
      h('div', { class: 'action-row' }, [
        h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
            const res = await window.sosis.updates.download();
            if (res.ok && res.data.ok) {
              const install = await window.sosis.updates.install();
              if (!install.ok) console.warn(install);
            }
          } }, [icon('downloads', 14), h('span', { 'data-i18n': 'updates.downloadAndInstall' })])
      ])
    );
  }

  function renderJobs(jobs) {
    clear(jobsPanel);
    jobsPanel.appendChild(h('h3', { 'data-i18n': 'downloads.queue' }));
    if (!jobs || !jobs.length) {
      jobsPanel.appendChild(emptyState({ iconName: 'downloads', titleKey: 'downloads.emptyTitle', bodyKey: 'downloads.emptyBody' }));
      return;
    }
    for (const job of jobs) {
      jobsPanel.appendChild(
        h('div', { class: 'setting-row' }, [
          h('div', { class: 'setting-info' }, [
            h('div', { class: 'setting-title', text: job.name }),
            h('div', { class: 'setting-desc', text: job.status + (job.progress ? ` · ${Math.round(job.progress.percent)}%` : '') })
          ]),
          job.status === 'failed' ? h('span', { class: 'small', style: { color: 'var(--danger)' }, text: job.error || '' }) : null
        ])
      );
    }
  }

  return {
    refresh: () => {
      renderUpdate();
    },
    dispose: () => {
      offProgress();
      offState();
      offJobs();
    }
  };
}
