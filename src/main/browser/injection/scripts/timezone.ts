// ──────────────────────────────────────────────────────────────────
// AntiProfiles — Timezone Injection Script Builder
// Seamlessly spoofs Intl and Date APIs to guarantee 100% match with Proxy IP
// ──────────────────────────────────────────────────────────────────

import { TimezoneFingerprint } from '../../../fingerprint/types'

export function buildTimezoneScript(tzFp?: TimezoneFingerprint | { timezone: string }): string {
  const targetTz = tzFp?.timezone || 'America/New_York'

  return `
// ═══ Timezone & Clock Integrity Override (Target: ${targetTz}) ═══
(function() {
  'use strict';
  const TARGET_TZ = ${JSON.stringify(targetTz)};

  try {
    // 1. Intl.DateTimeFormat.prototype.resolvedOptions override
    const origResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function() {
      const res = origResolvedOptions.apply(this, arguments);
      try {
        if (!this.__explicitUserTz) {
          res.timeZone = TARGET_TZ;
        }
      } catch(e) {}
      return res;
    };

    // 2. Default timeZone in Intl.DateTimeFormat constructor if none specified
    const OrigDateTimeFormat = Intl.DateTimeFormat;
    const PatchedDateTimeFormat = function(locales, options) {
      const opts = Object.assign({}, options);
      const hadExplicitTz = !!opts.timeZone;
      if (!hadExplicitTz) {
        opts.timeZone = TARGET_TZ;
      }
      const instance = new OrigDateTimeFormat(locales, opts);
      try {
        Object.defineProperty(instance, '__explicitUserTz', {
          value: hadExplicitTz,
          enumerable: false,
          configurable: true,
          writable: true
        });
      } catch(e) {}
      return instance;
    };

    PatchedDateTimeFormat.prototype = OrigDateTimeFormat.prototype;
    PatchedDateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;
    if (typeof OrigDateTimeFormat.supportedValuesOf === 'function') {
      PatchedDateTimeFormat.supportedValuesOf = OrigDateTimeFormat.supportedValuesOf;
    }

    try {
      Object.defineProperty(Intl, 'DateTimeFormat', {
        value: PatchedDateTimeFormat,
        configurable: true,
        writable: true
      });
    } catch(e) {}

    // 3. Date.prototype.getTimezoneOffset override
    // Accurately calculates target timezone offset in minutes for any date (including DST transitions)
    const formatter = new OrigDateTimeFormat('en-US', {
      timeZone: TARGET_TZ,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    function getTargetTimezoneOffset(date) {
      try {
        const parts = formatter.formatToParts(date);
        let y = 1970, m = 0, d = 1, h = 0, min = 0, s = 0;
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p.type === 'year') y = parseInt(p.value, 10);
          else if (p.type === 'month') m = parseInt(p.value, 10) - 1;
          else if (p.type === 'day') d = parseInt(p.value, 10);
          else if (p.type === 'hour') h = parseInt(p.value, 10) % 24;
          else if (p.type === 'minute') min = parseInt(p.value, 10);
          else if (p.type === 'second') s = parseInt(p.value, 10);
        }
        const targetUtcMs = Date.UTC(y, m, d, h, min, s);
        return Math.round((date.getTime() - targetUtcMs) / 60000);
      } catch (e) {
        return 0;
      }
    }

    Date.prototype.getTimezoneOffset = function() {
      return getTargetTimezoneOffset(this);
    };
  } catch(e) {}
})();`
}
