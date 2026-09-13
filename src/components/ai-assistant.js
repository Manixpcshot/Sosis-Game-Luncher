/**
 * AI Assistant chat (spec §15, §18). Streaming responses, library-aware
 * context handled in the main process, localized suggestion chips.
 */
import { h, icon, clear } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { state } from '../lib/store.js';
import { toast } from '../lib/toast.js';

let requestId = 0;

export function aiAssistant(root) {
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const input = h('textarea', {
    class: 'text-input',
    rows: 1,
    'data-i18n-placeholder': 'ai.chatPlaceholder',
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    }
  });
  const history = [];
  let activeBubble = null;
  let activeReq = null;

  const suggestions = ['ai.suggest1', 'ai.suggest2', 'ai.suggest3'].map((key) =>
    h('button', { class: 'chip', onclick: () => {
        input.value = t(key);
        send();
      } }, h('span', { 'data-i18n': key }))
  );

  const sendBtn = h('button', { class: 'btn btn-primary', onclick: () => send() }, [
    icon('send', 15),
    h('span', { 'data-i18n': 'ai.send' })
  ]);

  function addMsg(role, text, isError = false) {
    const bubble = h('div', { class: 'chat-bubble' + (isError ? ' error' : ''), text });
    const msg = h('div', { class: 'chat-msg ' + role }, [
      h('div', { class: 'avatar' }, [icon(role === 'user' ? 'gamepad' : 'ai', 15)]),
      bubble
    ]);
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    if (!state.settings.ai.hasKey && !state.settings.ai.baseUrl) {
      toast.info(t('ai.notConfigured'));
      location.hash = '#/settings';
      return;
    }
    input.value = '';
    addMsg('user', text);
    history.push({ role: 'user', content: text });
    activeBubble = addMsg('assistant', '');
    sendBtn.setAttribute('disabled', 'disabled');
    const req = 'req-' + ++requestId;
    activeReq = req;

    const offChunk = window.sosis.ai.onChunk((payload) => {
      if (payload.requestId !== req || !activeBubble) return;
      activeBubble.textContent += payload.delta;
      log.scrollTop = log.scrollHeight;
    });

    const res = await window.sosis.ai.chat(req, history.slice(-12));
    offChunk();
    sendBtn.removeAttribute('disabled');
    if (!res.ok) {
      const msgKey = res.code && res.error && res.error.startsWith('ai.') ? res.error : res.error;
      activeBubble.classList.add('error');
      activeBubble.textContent = t('ai.chatFailed', { error: translateError(msgKey, res) });
    } else if (activeBubble && !activeBubble.textContent) {
      activeBubble.textContent = t('ai.emptyResponse');
    }
    if (activeBubble) history.push({ role: 'assistant', content: activeBubble.textContent });
    activeBubble = null;
    activeReq = null;
  }

  function translateError(msgKey, res) {
    const translated = t(msgKey);
    if (translated !== msgKey) return translated;
    return res.error || msgKey || t('errors.generic');
  }

  const shell = h('div', { class: 'chat-shell page-enter' }, [
    h('div', { class: 'chat-suggestions' }, suggestions),
    log,
    h('div', { class: 'chat-input-row' }, [input, sendBtn])
  ]);

  root.appendChild(shell);
  addMsg('assistant', t('ai.greeting'));
  input.focus();
  return { abort: () => activeReq && window.sosis.ai.abort(activeReq) };
}
