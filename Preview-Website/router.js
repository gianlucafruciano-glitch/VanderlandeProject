(function (global) {
  'use strict';

  const ROUTES = ['login', 'twofa', 'blocked', 'dashboard', 'detail', 'comment', 'history'];
  let currentKey = null;
  const listeners = [];

  function parse() {
    const hash = (location.hash || '').replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    const name = parts[0] || 'login';
    const params = parts.slice(1);
    return { name: name, params: params };
  }

  function resolve() {
    const r = parse();
    const name = ROUTES.indexOf(r.name) !== -1 ? r.name : 'login';
    return { name: name, params: r.params };
  }

  function go(name, params) {
    const suffix = (params && params.length) ? '/' + params.join('/') : '';
    const newHash = '#/' + name + suffix;
    if (location.hash === newHash) {
      emit();
    } else {
      location.hash = newHash;
    }
  }

  function emit() {
    const r = resolve();
    const key = r.name + '|' + r.params.join('/');
    if (key === currentKey) return;
    currentKey = key;
    listeners.forEach(fn => fn(r));
  }

  function start(onChange) {
    listeners.push(onChange);
    window.addEventListener('hashchange', emit);
    emit();
  }

  function getCurrent() {
    return currentKey ? currentKey.split('|')[0] : null;
  }

  global.Router = { go: go, start: start, getCurrent: getCurrent };
})(window);