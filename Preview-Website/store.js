(function (global) {
  'use strict';

  const STORAGE_KEY = 'issue-tracker.state.v1';
  const DEVICE_KEY = 'issue-tracker.blocked';

  const CATEGORIES = [
    { value: 'lay-out', label: 'Lay-out fout' },
    { value: 'functioneel', label: 'Functionele fout' },
    { value: 'data', label: 'Data fout' },
    { value: 'performance', label: 'Performance' },
    { value: 'overig', label: 'Overig' }
  ];

  const STATUSES = {
    open:    { label: 'Open',       class: 'badge-open' },
    claimed: { label: 'Geclaimd',   class: 'badge-claimed' },
    fixed:   { label: 'Gefixt',     class: 'badge-fixed' },
    closed:  { label: 'Afgesloten', class: 'badge-closed' }
  };

  const USERS = [
    { email: 'demo@demo.nl',  password: 'demo123',  name: 'Demo Gebruiker' },
    { email: 'admin@demo.nl', password: 'admin123', name: 'Beheerder' }
  ];

  const TWO_FA_CODE = '123456';
  const MAX_2FA_ATTEMPTS = 3;

  let state = null;

  function isDeviceBlockedRaw() {
    try { return localStorage.getItem(DEVICE_KEY) === '1'; }
    catch (e) { return false; }
  }

  function setDeviceBlockedRaw(blocked) {
    try {
      if (blocked) localStorage.setItem(DEVICE_KEY, '1');
      else localStorage.removeItem(DEVICE_KEY);
    } catch (e) {}
  }

  function seed() {
    const now = Date.now();

    const issues = [
      {
        id: 'ISS-001',
        title: 'Plaats fout op homepage',
        description: 'Element verschijnt op de verkeerde positie in de header.',
        traject: 'Traject A',
        positie: 1,
        active: true,
        category: 'lay-out',
        status: 'open',
        claimedBy: null,
        createdAt: now,
        updatedAt: now,
        notes: []
      },
      {
        id: 'ISS-002',
        title: 'Welke fout bij inloggen',
        description: 'Foutmelding wordt niet correct doorgegeven aan de gebruiker.',
        traject: 'Traject A',
        positie: 2,
        active: true,
        category: 'functioneel',
        status: 'open',
        claimedBy: null,
        createdAt: now,
        updatedAt: now,
        notes: []
      },
      {
        id: 'ISS-003',
        title: 'Tijd/DVD fout in rapport',
        description: 'Rapport toont verkeerde tijdzone bij export.',
        traject: 'Traject A',
        positie: 3,
        active: true,
        category: 'data',
        status: 'open',
        claimedBy: null,
        createdAt: now,
        updatedAt: now,
        notes: []
      },
      {
        id: 'ISS-004',
        title: 'Erhend/fout in overzicht',
        description: 'Overzichtscomponent laadt niet bij grote datasets.',
        traject: 'Traject B',
        positie: 1,
        active: true,
        category: 'performance',
        status: 'open',
        claimedBy: null,
        createdAt: now,
        updatedAt: now,
        notes: []
      }
    ];

    return {
      version: 1,
      user: null,
      pendingUser: null,
      twoFAAttempts: 0,
      deviceBlocked: isDeviceBlockedRaw(),
      issues: issues,
      activity: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seed();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return seed();
      const base = seed();
      return Object.assign(base, parsed);
    } catch (e) {
      return seed();
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) {}
  }

  function init() {
    if (!state) state = load();
    return state;
  }

  function get() { init(); return state; }

  function reset() {
    state = seed();
    save();
    return state;
  }

  // ---- Auth ----
  function findUser(email, password) {
    const e = String(email || '').toLowerCase().trim();
    return USERS.find(u => u.email.toLowerCase() === e && u.password === password) || null;
  }

  function login(email, password) {
    const user = findUser(email, password);
    if (!user) return { ok: false, error: 'Gebruiker bestaat niet of wachtwoord onjuist.' };
    state.pendingUser = { email: user.email, name: user.name };
    state.twoFAAttempts = 0;
    save();
    return { ok: true };
  }

  function verify2FA(code) {
    if (!state.pendingUser) return { ok: false, error: 'Geen lopende login.' };
    if (String(code || '').trim() === TWO_FA_CODE) {
      state.user = state.pendingUser;
      state.pendingUser = null;
      state.twoFAAttempts = 0;
      save();
      return { ok: true };
    }
    state.twoFAAttempts += 1;
    if (state.twoFAAttempts >= MAX_2FA_ATTEMPTS) {
      state.deviceBlocked = true;
      state.pendingUser = null;
      state.twoFAAttempts = 0;
      setDeviceBlockedRaw(true);
      save();
      return { ok: false, blocked: true, error: 'Te veel foute pogingen. Apparaat geblokkeerd.' };
    }
    save();
    return {
      ok: false,
      error: 'Onjuiste code.',
      attemptsLeft: MAX_2FA_ATTEMPTS - state.twoFAAttempts
    };
  }

  function unblockDevice() {
    state.deviceBlocked = false;
    state.twoFAAttempts = 0;
    setDeviceBlockedRaw(false);
    save();
  }

  function logout() {
    state.user = null;
    state.pendingUser = null;
    state.twoFAAttempts = 0;
    save();
  }

  // ---- Issues ----
  function getIssue(id) {
    return state.issues.find(i => i.id === id) || null;
  }

  function touch(issue) { issue.updatedAt = Date.now(); }

  function logActivity(issueId, action, detail) {
    state.activity.unshift({
      id: 'A' + Date.now() + Math.random().toString(36).slice(2, 6),
      issueId: issueId,
      action: action,
      detail: detail || '',
      user: state.user ? state.user.name : 'Onbekend',
      timestamp: Date.now()
    });
    if (state.activity.length > 200) state.activity.length = 200;
  }

  function setActive(issueId, active) {
    const issue = getIssue(issueId);
    if (!issue) return false;
    issue.active = !!active;
    touch(issue);
    save();
    return true;
  }

  function excludeNeighbors(issueId, radius) {
    const issue = getIssue(issueId);
    if (!issue || !issue.traject) return [];
    const r = Math.max(0, Math.min(10, parseInt(radius, 10) || 0));
    const affected = [];
    state.issues.forEach(function (i) {
      if (i.id === issue.id) return;
      if (i.traject !== issue.traject) return;
      const dist = Math.abs((i.positie || 0) - (issue.positie || 0));
      if (dist <= r && i.active) {
        i.active = false;
        touch(i);
        affected.push(i);
      }
    });
    if (affected.length) {
      touch(issue);
      logActivity(issueId, 'Buren uitgezet', affected.length + ' blokje(s) uitgezet in ' + issue.traject);
      save();
    }
    return affected;
  }

  function resetIssue(issueId) {
    const issue = getIssue(issueId);
    if (!issue) return false;
    issue.active = true;
    issue.status = 'open';
    issue.claimedBy = null;
    touch(issue);
    logActivity(issueId, 'Reset', 'Blokje gereset');
    save();
    return true;
  }

  function claim(issueId) {
    const issue = getIssue(issueId);
    if (!issue || !state.user) return false;
    if (issue.status !== 'open') return false;
    issue.status = 'claimed';
    issue.claimedBy = state.user.name;
    touch(issue);
    logActivity(issueId, 'Geclaimd', 'Door ' + state.user.name);
    save();
    return true;
  }

  function addNote(issueId, text) {
    const issue = getIssue(issueId);
    if (!issue || !state.user) return null;
    const note = {
      id: 'N' + Date.now(),
      text: text,
      user: state.user.name,
      timestamp: Date.now()
    };
    issue.notes.push(note);
    issue.status = 'fixed';
    touch(issue);
    logActivity(issueId, 'Gefixt', text);
    save();
    return note;
  }

  function closeIssue(issueId) {
    const issue = getIssue(issueId);
    if (!issue) return false;
    if (issue.status !== 'fixed') return false;
    issue.status = 'closed';
    touch(issue);
    logActivity(issueId, 'Afgesloten', 'Issue afgesloten');
    save();
    return true;
  }

  function setCategory(issueId, category) {
    const issue = getIssue(issueId);
    if (!issue) return;
    issue.category = category;
    touch(issue);
    save();
  }

  function categoryLabel(value) {
    const c = CATEGORIES.find(c => c.value === value);
    return c ? c.label : value;
  }

  function statusMeta(status) {
    return STATUSES[status] || { label: status, class: 'badge-open' };
  }

  global.Store = {
    CATEGORIES: CATEGORIES,
    STATUSES: STATUSES,
    init: init,
    get: get,
    reset: reset,
    save: save,
    login: login,
    verify2FA: verify2FA,
    unblockDevice: unblockDevice,
    logout: logout,
    getIssue: getIssue,
    setActive: setActive,
    excludeNeighbors: excludeNeighbors,
    resetIssue: resetIssue,
    claim: claim,
    addNote: addNote,
    closeIssue: closeIssue,
    setCategory: setCategory,
    categoryLabel: categoryLabel,
    statusMeta: statusMeta
  };
})(window);