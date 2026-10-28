(function () {
  'use strict';

  const S = window.Store;
  const R = window.Router;

  S.init();

  // ---------- Helpers ----------
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' }) + ' ' +
           d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function formatRelative(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'net nu';
    if (diff < 3600) return Math.floor(diff / 60) + ' min geleden';
    if (diff < 86400) return Math.floor(diff / 3600) + ' u geleden';
    const days = Math.floor(diff / 86400);
    return days === 1 ? 'gisteren' : days + ' dagen geleden';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function canClaim(issue) {
    if (!issue) return false;
    return issue.status !== 'claimed' &&
           issue.status !== 'fixed' &&
           issue.status !== 'closed';
  }

  function isClaimed(issue) {
    return !!issue && issue.status === 'claimed';
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(message, type) {
    const el = $('#toast');
    el.textContent = message;
    el.className = 'toast is-visible' + (type ? ' toast--' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 3000);
  }

  // ---------- Header / bottom bar ----------
  function syncHeader() {
    const st = S.get();
    const header = $('#app-header');
    const bottomBar = $('#app-bottom-bar');
    const show = !!st.user;

    header.classList.toggle('is-hidden', !show);
    bottomBar.classList.toggle('is-hidden', !show);
  }

  // ---------- Screens ----------
  function showScreen(name) {
    $$('.screen').forEach(function (s) {
      s.classList.toggle('is-active', s.dataset.screen === name);
    });
    window.scrollTo(0, 0);
  }

  // ---------- Login ----------
  function renderLogin() {
    $('#login-form').reset();
    $('#login-error').textContent = '';
    $('[data-error="email"]').textContent = '';
    $('[data-error="password"]').textContent = '';
    setTimeout(function () { $('#login-email').focus(); }, 50);
  }

  function onLoginSubmit(e) {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;

    $('[data-error="email"]').textContent = '';
    $('[data-error="password"]').textContent = '';
    $('#login-error').textContent = '';

    let ok = true;
    if (!email) {
      $('[data-error="email"]').textContent = 'E-mail is verplicht.';
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('[data-error="email"]').textContent = 'Ongeldig e-mailadres.';
      ok = false;
    }
    if (!password) {
      $('[data-error="password"]').textContent = 'Wachtwoord is verplicht.';
      ok = false;
    }
    if (!ok) return;

    const result = S.login(email, password);
    if (!result.ok) {
      $('#login-error').textContent = result.error;
      return;
    }
    R.go('twofa');
  }

  // ---------- 2FA ----------
  function renderTwoFA() {
    const st = S.get();
    if (!st.pendingUser) { R.go('login'); return; }
    $$('.otp-box').forEach(function (b) { b.value = ''; });
    $('#twofa-error').textContent = '';
    $('#twofa-attempts').textContent = Math.min(st.twoFAAttempts + 1, 3);
    setTimeout(function () { $('.otp-box').focus(); }, 50);
  }

  function getOtpValue() {
    return $$('.otp-box').map(function (b) { return b.value.trim(); }).join('');
  }

  function onOtpInput(e) {
    const input = e.target;
    const cleaned = input.value.replace(/\D/g, '');
    const boxes = $$('.otp-box');
    const idx = boxes.indexOf(input);

    if (cleaned.length > 1) {
      for (let i = 0; i < cleaned.length && idx + i < boxes.length; i++) {
        boxes[idx + i].value = cleaned[i];
      }
      const next = Math.min(idx + cleaned.length, boxes.length - 1);
      boxes[next].focus();
      return;
    }

    input.value = cleaned;
    if (input.value && input.nextElementSibling) {
      input.nextElementSibling.focus();
    }
  }

  function onOtpKeydown(e) {
    const input = e.target;
    if (e.key === 'Backspace') {
      if (input.value) {
        input.value = '';
        e.preventDefault();
      } else if (input.previousElementSibling) {
        input.previousElementSibling.focus();
        input.previousElementSibling.value = '';
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && input.previousElementSibling) {
      input.previousElementSibling.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && input.nextElementSibling) {
      input.nextElementSibling.focus();
      e.preventDefault();
    }
  }

  function onOtpPaste(e) {
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;
    const text = (cd.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const boxes = $$('.otp-box');
    boxes.forEach(function (b, i) { b.value = text[i] || ''; });
    boxes[Math.min(text.length, boxes.length - 1)].focus();
  }

  function onTwoFASubmit(e) {
    e.preventDefault();
    const code = getOtpValue();
    $('#twofa-error').textContent = '';

    if (code.length !== 6) {
      $('#twofa-error').textContent = 'Voer alle 6 cijfers in.';
      return;
    }

    const result = S.verify2FA(code);
    if (result.ok) { R.go('dashboard'); return; }
    if (result.blocked) { R.go('blocked'); return; }

    $('#twofa-error').textContent = result.error + ' Pogingen over: ' + result.attemptsLeft + '.';
    $$('.otp-box').forEach(function (b) { b.value = ''; });
    $('.otp-box').focus();
    $('#twofa-attempts').textContent = Math.min(S.get().twoFAAttempts + 1, 3);
  }

  function onTwoFABack() {
    S.logout();
    R.go('login');
  }

  // ---------- Blocked ----------
  function onUnlockDevice() {
    S.unblockDevice();
    R.go('login');
    toast('Apparaat ontgrendeld', 'success');
  }

  // ---------- Dashboard ----------
  function renderDashboard() {
    renderIssues();
  }

  function renderIssues() {
    const list = $('#issue-list');
    const items = S.get().issues.filter(function (i) {
      return i.status !== 'fixed' && i.status !== 'closed';
    });
    const empty = $('#issue-empty');

    if (!items.length) {
      list.innerHTML = '';
      empty.classList.remove('is-hidden');
      empty.textContent = 'Geen open issues.';
      return;
    }
    empty.classList.add('is-hidden');

    list.innerHTML = items.map(function (i) {
      const status = S.statusMeta(i.status);
      const cat = S.categoryLabel(i.category);
      const activeBadge = i.active
        ? '<span class="badge badge-active">Actief</span>'
        : '<span class="badge badge-off">Uit</span>';
      return '' +
        '<li class="issue-item" data-issue-id="' + escapeHtml(i.id) + '">' +
          '<div class="issue-item__head">' +
            '<span class="issue-id">' + escapeHtml(i.id) + '</span>' +
            '<span>' + activeBadge + ' <span class="badge ' + status.class + '">' + escapeHtml(status.label) + '</span></span>' +
          '</div>' +
          '<h3 class="issue-item__title">' + escapeHtml(i.title) + '</h3>' +
          '<div class="issue-item__meta">' +
            '<span>' + escapeHtml(cat) + '</span>' +
            '<span>' + escapeHtml(i.traject || '-') + ' &middot; positie ' + (i.positie || 0) + '</span>' +
            '<span>Bijgewerkt ' + formatRelative(i.updatedAt) + '</span>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  function onIssueListClick(e) {
    const li = e.target.closest('[data-issue-id]');
    if (!li) return;
    R.go('detail', [li.dataset.issueId]);
  }

  // ---------- Detail ----------
  function getDetailIdFromHash() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
    if (parts[0] !== 'detail') return '';
    return parts[1] || '';
  }

  function renderDetail(issueId) {
    const issue = S.getIssue(issueId);
    if (!issue) { R.go('dashboard'); return; }

    const status = S.statusMeta(issue.status);
    const claimed = isClaimed(issue);

    $('#detail-id').textContent = issue.id;
    $('#detail-title').textContent = issue.title;
    $('#detail-description').textContent = issue.description;
    $('#detail-badge').textContent = status.label;
    $('#detail-badge').className = 'badge ' + status.class;
    $('#detail-claimed').textContent = issue.claimedBy || '-';
    $('#detail-traject-name').textContent = issue.traject || '-';

    const activeEl = $('#detail-active');
    activeEl.textContent = issue.active ? 'Actief' : 'Uit';
    activeEl.style.color = issue.active ? 'var(--success)' : 'var(--danger)';

    const catSel = $('#detail-category');
    catSel.innerHTML = S.CATEGORIES.map(function (c) {
      return '<option value="' + c.value + '">' + escapeHtml(c.label) + '</option>';
    }).join('');
    catSel.value = issue.category;

    const btnStart = $('#btn-start');
    const btnStop  = $('#btn-stop');
    const btnReset = $('#btn-reset');

    btnStart.disabled = !claimed || issue.active;
    btnStop.disabled  = !claimed || !issue.active;
    btnReset.disabled = !claimed;

    const btnClaim  = $('#btn-claim');
    const btnFixed  = $('#btn-fixed');
    const btnClosed = $('#btn-closed');

    const claimable = canClaim(issue);
    btnClaim.disabled = !claimable;
    btnClaim.textContent = claimable ? 'Claim' : 'Geclaimd';

    btnFixed.disabled  = issue.status !== 'claimed';
    btnClosed.disabled = issue.status !== 'fixed';

    renderTraject(issue);
    renderNotes(issue);
  }

  function renderTraject(issue) {
    const container = $('#detail-traject');
    if (!issue.traject) {
      container.innerHTML = '<span class="muted">Geen traject</span>';
      return;
    }
    const siblings = S.get().issues
      .filter(function (i) { return i.traject === issue.traject; })
      .sort(function (a, b) { return (a.positie || 0) - (b.positie || 0); });

    container.innerHTML = siblings.map(function (i) {
      const isCurrent = i.id === issue.id;
      const cls = 'blokje ' + (i.active ? 'is-active' : 'is-off') + (isCurrent ? ' is-current' : '');
      const lock = !isClaimed(i) ? ' blokje--locked' : '';
      return '' +
        '<button type="button" class="' + cls + lock + '" data-blok-id="' + escapeHtml(i.id) + '" title="' + escapeHtml(i.title) + '">' +
          '<span class="blokje__pos">' + (i.positie || 0) + '</span>' +
          '<span class="blokje__id">' + escapeHtml(i.id) + '</span>' +
        '</button>';
    }).join('');
  }

  function renderNotes(issue) {
    const list = $('#detail-notes');
    const empty = $('#detail-notes-empty');

    if (!issue.notes.length) {
      list.innerHTML = '';
      empty.classList.remove('is-hidden');
      return;
    }
    empty.classList.add('is-hidden');

    list.innerHTML = issue.notes.map(function (n) {
      return '' +
        '<li class="note">' +
          '<div class="note__head">' +
            '<strong>' + escapeHtml(n.user) + '</strong>' +
            '<span class="muted">' + formatDate(n.timestamp) + '</span>' +
          '</div>' +
          '<p class="note__text">' + escapeHtml(n.text) + '</p>' +
        '</li>';
    }).join('');
  }

  function onDetailAction(action) {
    const id = getDetailIdFromHash();
    if (!id) return;

    const issue = S.getIssue(id);
    if (!issue) return;

    if (action === 'start' || action === 'stop' || action === 'reset') {
      if (!isClaimed(issue)) {
        toast('Claim eerst dit blokje voordat je het kan starten of stoppen');
        renderDetail(id);
        return;
      }
    }

    if (action === 'claim') {
      if (!canClaim(issue)) {
        toast('Dit issue is al geclaimd');
        renderDetail(id);
        return;
      }
    }

    if (action === 'start') {
      S.setActive(id, true);
      toast('Blokje gestart', 'success');
    } else if (action === 'stop') {
      S.setActive(id, false);
      toast('Blokje gestopt', 'success');
    } else if (action === 'reset') {
      S.resetIssue(id);
      toast('Blokje gereset', 'success');
    } else if (action === 'claim') {
      if (S.claim(id)) toast('Issue geclaimd', 'success');
    } else if (action === 'fixed') {
      R.go('comment', [id]);
      return;
    } else if (action === 'closed') {
      if (S.closeIssue(id)) toast('Issue afgesloten', 'success');
    }
    renderDetail(id);
  }

  function onCategoryChange(e) {
    const id = getDetailIdFromHash();
    if (!id) return;
    S.setCategory(id, e.target.value);
    toast('Categorie opgeslagen', 'success');
  }

  function onExcludeNeighbors() {
    const id = getDetailIdFromHash();
    if (!id) return;
    const count = parseInt($('#neighbor-count').value, 10) || 1;
    const affected = S.excludeNeighbors(id, count);

    if (!affected.length) {
      toast('Geen actieve blokjes in de buurt om uit te zetten');
    } else {
      toast(affected.length + ' blokje(s) uitgezet', 'success');
    }
    renderDetail(id);
  }

  function onTrajectClick(e) {
    const btn = e.target.closest('[data-blok-id]');
    if (!btn) return;
    const clickedId = btn.dataset.blokId;
    const detailId = getDetailIdFromHash();
    if (clickedId === detailId) return;

    const issue = S.getIssue(clickedId);
    if (!issue) return;

    if (!isClaimed(issue)) {
      toast('Claim eerst dit blokje voordat je het kan starten of stoppen');
      return;
    }

    S.setActive(clickedId, !issue.active);
    renderDetail(detailId);
    toast(issue.active ? 'Blokje uitgezet' : 'Blokje aangezet', 'success');
  }

  // ---------- Comment ----------
  function renderComment(issueId) {
    const issue = S.getIssue(issueId);
    if (!issue) { R.go('dashboard'); return; }
    $('#comment-issue').textContent = issue.id + ' - ' + issue.title;
    $('#comment-text').value = '';
    $('#comment-error').textContent = '';
    setTimeout(function () { $('#comment-text').focus(); }, 50);
  }

  function onCommentSubmit(e) {
    e.preventDefault();
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
    const id = parts[1];
    if (!id || !S.getIssue(id)) { R.go('dashboard'); return; }

    const text = $('#comment-text').value.trim();
    if (!text) {
      $('#comment-error').textContent = 'Opmerking mag niet leeg zijn.';
      return;
    }
    S.addNote(id, text);
    toast('Verstuurd + aangekondigd op dashboard', 'success');
    R.go('dashboard');
  }

  function onCommentBack() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
    const id = parts[1];
    if (id) R.go('detail', [id]);
    else R.go('dashboard');
  }

  // ---------- History (alleen gefixt) ----------
  function renderHistory() {
    const list = $('#history-list');
    const empty = $('#history-empty');

    const activity = S.get().activity.filter(function (a) {
      return a.action === 'Gefixt';
    });

    if (!activity.length) {
      list.innerHTML = '';
      empty.classList.remove('is-hidden');
      empty.textContent = 'Nog geen gefixte issues.';
      return;
    }
    empty.classList.add('is-hidden');

    list.innerHTML = activity.map(function (a) {
      const issue = S.getIssue(a.issueId);
      const title = issue ? issue.title : 'Onbekend';
      return '' +
        '<li class="history-item">' +
          '<div class="history-item__head">' +
            '<span class="badge badge-fixed">Gefixt</span>' +
            '<span class="muted">' + formatDate(a.timestamp) + '</span>' +
          '</div>' +
          '<div class="history-item__body">' +
            '<span class="issue-id">' + escapeHtml(a.issueId) + '</span>' +
            '<strong>' + escapeHtml(title) + '</strong>' +
          '</div>' +
          (a.detail ? '<p class="history-item__detail">' + escapeHtml(a.detail) + '</p>' : '') +
          '<span class="muted">door ' + escapeHtml(a.user) + '</span>' +
        '</li>';
    }).join('');
  }

  // ---------- Blocked ----------
  function renderBlocked() { /* statisch */ }

  // ---------- QR Scanner ----------
  let qrInstance = null;
  let qrRunning = false;
  let qrStarting = false;

  function openQrScanner() {
    const modal = $('#qr-modal');
    modal.classList.remove('is-hidden');
    modal.setAttribute('aria-hidden', 'false');

    const resultEl = $('#qr-result');
    const resultValue = $('#qr-result-value');
    const errorEl = $('#qr-error');

    resultEl.classList.add('is-hidden');
    resultValue.textContent = '';
    errorEl.textContent = '';
    errorEl.classList.add('is-hidden');

    if (typeof window.Html5Qrcode === 'undefined') {
      errorEl.textContent = 'QR library is niet geladen. Controleer je internetverbinding.';
      errorEl.classList.remove('is-hidden');
      return;
    }

    if (qrStarting || qrRunning) return;
    qrStarting = true;

    try {
      qrInstance = new window.Html5Qrcode('qr-reader', { verbose: false });
      qrInstance.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: function (viewfinderWidth, viewfinderHeight) {
            const min = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(min * 0.7);
            return { width: size, height: size };
          }
        },
        function onSuccess(decodedText) {
          resultValue.textContent = decodedText;
          resultEl.classList.remove('is-hidden');
          toast('QR-code gescand', 'success');
          stopQrScanner();
        },
        function onFrameError(/* errorMessage */) { /* negeren */ }
      ).then(function () {
        qrRunning = true;
      }).catch(function (err) {
        const msg = (err && err.message) ? err.message : String(err);
        errorEl.textContent = 'Camera kon niet worden gestart: ' + msg;
        errorEl.classList.remove('is-hidden');
        qrInstance = null;
      }).finally(function () {
        qrStarting = false;
      });
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      errorEl.textContent = 'QR scanner fout: ' + msg;
      errorEl.classList.remove('is-hidden');
      qrInstance = null;
      qrStarting = false;
    }
  }

  function stopQrScanner() {
    if (!qrInstance) return Promise.resolve();
    const inst = qrInstance;
    qrInstance = null;
    const wasRunning = qrRunning;
    qrRunning = false;

    const doStop = wasRunning ? inst.stop() : Promise.resolve();
    return doStop.then(function () {
      try { inst.clear(); } catch (e) {}
    }).catch(function () {
      try { inst.clear(); } catch (e) {}
    });
  }

  function closeQrScanner() {
    stopQrScanner();
    const modal = $('#qr-modal');
    modal.classList.add('is-hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  // ---------- Guard + Route ----------
  function applyGuard(route) {
    const st = S.get();

    if (st.deviceBlocked && route.name !== 'blocked') {
      return { name: 'blocked', params: [] };
    }
    if (!st.deviceBlocked && route.name === 'blocked') {
      return { name: 'login', params: [] };
    }
    if (!st.user && !st.pendingUser && route.name !== 'login') {
      return { name: 'login', params: [] };
    }
    if (st.pendingUser && !st.user && route.name !== 'twofa') {
      return { name: 'twofa', params: [] };
    }
    if (st.user && (route.name === 'login' || route.name === 'twofa')) {
      return { name: 'dashboard', params: [] };
    }
    if (route.name === 'detail' && !S.getIssue(route.params[0] || '')) {
      return { name: 'dashboard', params: [] };
    }
    if (route.name === 'comment' && !S.getIssue(route.params[0] || '')) {
      return { name: 'dashboard', params: [] };
    }
    return route;
  }

  function handleRoute(route) {
    const safe = applyGuard(route);
    const changed = safe.name !== route.name ||
                    safe.params.join('/') !== route.params.join('/');
    if (changed) {
      R.go(safe.name, safe.params);
      return;
    }

    syncHeader();
    showScreen(route.name);

    switch (route.name) {
      case 'login':     renderLogin(); break;
      case 'twofa':     renderTwoFA(); break;
      case 'blocked':   renderBlocked(); break;
      case 'dashboard': renderDashboard(); break;
      case 'detail':    renderDetail(route.params[0]); break;
      case 'comment':   renderComment(route.params[0]); break;
      case 'history':   renderHistory(); break;
    }
  }

  // ---------- Events ----------
  function bindEvents() {
    $('#login-form').addEventListener('submit', onLoginSubmit);

    $('#twofa-form').addEventListener('submit', onTwoFASubmit);
    $('#twofa-back').addEventListener('click', onTwoFABack);
    $$('.otp-box').forEach(function (b) {
      b.addEventListener('input', onOtpInput);
      b.addEventListener('keydown', onOtpKeydown);
      b.addEventListener('paste', onOtpPaste);
    });

    $('#blocked-unlock').addEventListener('click', onUnlockDevice);

    $('#issue-list').addEventListener('click', onIssueListClick);

    $('#btn-start').addEventListener('click', function () { onDetailAction('start'); });
    $('#btn-stop').addEventListener('click', function () { onDetailAction('stop'); });
    $('#btn-reset').addEventListener('click', function () { onDetailAction('reset'); });
    $('#btn-claim').addEventListener('click', function () { onDetailAction('claim'); });
    $('#btn-fixed').addEventListener('click', function () { onDetailAction('fixed'); });
    $('#btn-closed').addEventListener('click', function () { onDetailAction('closed'); });
    $('#detail-category').addEventListener('change', onCategoryChange);

    $('#btn-exclude').addEventListener('click', onExcludeNeighbors);
    $('#detail-traject').addEventListener('click', onTrajectClick);

    $('#comment-form').addEventListener('submit', onCommentSubmit);
    $('#comment-back').addEventListener('click', onCommentBack);

    $$('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { R.go(b.dataset.nav); });
    });

    $('#scan-qr-btn').addEventListener('click', openQrScanner);
    $('#qr-close').addEventListener('click', closeQrScanner);
    $('#qr-backdrop').addEventListener('click', closeQrScanner);

    $('#logout-btn').addEventListener('click', function () {
      S.logout();
      R.go('login');
      toast('Uitgelogd', 'success');
    });

    $('#reset-demo').addEventListener('click', function () {
      if (confirm('Weet je zeker dat je alle demo data wilt resetten?')) {
        S.reset();
        S.unblockDevice();
        R.go('login');
        toast('Demo data gereset', 'success');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;

      const modal = $('#qr-modal');
      if (modal && !modal.classList.contains('is-hidden')) {
        closeQrScanner();
        return;
      }

      const current = R.getCurrent();
      if (current === 'detail') R.go('dashboard');
      else if (current === 'comment') onCommentBack();
      else if (current === 'history') R.go('dashboard');
    });
  }

  // ---------- Boot ----------
  function boot() {
    bindEvents();
    R.start(handleRoute);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();