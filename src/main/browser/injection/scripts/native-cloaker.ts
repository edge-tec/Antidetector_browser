// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Native Function Cloaker Script Builder
// Transparently cloaks modified functions and getters to return
// "function () { [native code] }" in Function.prototype.toString
// and Function.prototype.toSource to defeat Botguard / anti-bot inspection.
// ──────────────────────────────────────────────────────────────────

export function buildNativeCloakerScript(): string {
  return `
// ═══ Native Function Cloaking Engine ═══
(function() {
  'use strict';

  try {
    var loc = window.location || {};
    var h = (loc.hostname || '').toLowerCase();
    var href = (loc.href || '').toLowerCase();
    if (
      h.indexOf('accounts.google.') !== -1 ||
      h.indexOf('myaccount.google.') !== -1 ||
      h === 'x.com' ||
      h.endsWith('.x.com') ||
      h === 'twitter.com' ||
      h.endsWith('.twitter.com') ||
      h === 'facebook.com' ||
      h.endsWith('.facebook.com') ||
      h === 'instagram.com' ||
      h.endsWith('.instagram.com') ||
      h === 'linkedin.com' ||
      h.endsWith('.linkedin.com') ||
      h === 'github.com' ||
      h.endsWith('.github.com') ||
      href.indexOf('/signin') !== -1 ||
      href.indexOf('/v3/signin') !== -1 ||
      href.indexOf('/i/flow/login') !== -1 ||
      href.indexOf('/login') !== -1 ||
      href.indexOf('/oauth') !== -1
    ) {
      window.__cloakFunction = function(f) { return f; };
      window.__cloakGetter = function(f) { return f; };
      return;
    }
  } catch(e) {}

  if (window.__antiprofiles_cloaker_installed) return;
  window.__antiprofiles_cloaker_installed = true;

  const nativeToString = Function.prototype.toString;
  const cloakedFunctions = new WeakMap();

  function makeNativeString(name) {
    return 'function ' + (name || '') + '() { [native code] }';
  }

  function makeNativeGetterString(name) {
    return 'function get ' + (name || '') + '() { [native code] }';
  }

  function customToString() {
    if (this === customToString) {
      return 'function toString() { [native code] }';
    }
    if (cloakedFunctions.has(this)) {
      return cloakedFunctions.get(this);
    }
    return nativeToString.call(this);
  }

  try {
    Object.defineProperty(Function.prototype, 'toString', {
      value: customToString,
      writable: true,
      configurable: true,
      enumerable: false
    });
    cloakedFunctions.set(customToString, 'function toString() { [native code] }');
  } catch (e) {}

  // Expose global helper within page context
  window.__cloakFunction = function(fn, name) {
    if (typeof fn === 'function') {
      cloakedFunctions.set(fn, makeNativeString(name || fn.name));
    }
    return fn;
  };

  window.__cloakGetter = function(fn, name) {
    if (typeof fn === 'function') {
      cloakedFunctions.set(fn, makeNativeGetterString(name || fn.name));
    }
    return fn;
  };
})();
`
}
