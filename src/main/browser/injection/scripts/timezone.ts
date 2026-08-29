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
  let TARGET_TZ = ${JSON.stringify(targetTz)};

  try {
    const OrigDateTimeFormat = Intl.DateTimeFormat;

    // 1. Intl.DateTimeFormat.prototype.resolvedOptions override
    const origResolvedOptions = OrigDateTimeFormat.prototype.resolvedOptions;
    OrigDateTimeFormat.prototype.resolvedOptions = function() {
      const res = origResolvedOptions.apply(this, arguments);
      try {
        if (!this.__explicitUserTz) {
          res.timeZone = TARGET_TZ;
        }
      } catch(e) {}
      return res;
    };

    // 2. Default timeZone in Intl.DateTimeFormat constructor if none specified
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

    // Formatter used to compute exact target date/time components for any Date instance
    let formatter = new OrigDateTimeFormat('en-US', {
      timeZone: TARGET_TZ,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let tzShortName = '';
    let tzLongName = '';
    function refreshTzNames() {
      try {
        const tzParts = new OrigDateTimeFormat('en-US', { timeZone: TARGET_TZ, timeZoneName: 'short' }).formatToParts(new Date());
        const longParts = new OrigDateTimeFormat('en-US', { timeZone: TARGET_TZ, timeZoneName: 'long' }).formatToParts(new Date());
        for (let i = 0; i < tzParts.length; i++) { if (tzParts[i].type === 'timeZoneName') tzShortName = tzParts[i].value; }
        for (let i = 0; i < longParts.length; i++) { if (longParts[i].type === 'timeZoneName') tzLongName = longParts[i].value; }
      } catch(e) {}
      if (!tzLongName) tzLongName = TARGET_TZ;
    }
    refreshTzNames();

    function updateTargetTz(newTz) {
      if (!newTz || typeof newTz !== 'string') return;
      try {
        new OrigDateTimeFormat('en-US', { timeZone: newTz });
        TARGET_TZ = newTz;
        formatter = new OrigDateTimeFormat('en-US', {
          timeZone: TARGET_TZ,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: false
        });
        refreshTzNames();
      } catch(err) {}
    }

    try {
      Object.defineProperty(window, '__antiprofiles_set_tz', {
        value: updateTargetTz,
        enumerable: false,
        configurable: true,
        writable: true
      });
    } catch(e) {}

    function getTargetDateParts(date) {
      if (isNaN(date.getTime())) return null;
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
        return { year: y, month: m, day: d, hour: h, minute: min, second: s };
      } catch (e) {
        return null;
      }
    }

    function getTargetTimezoneOffset(date) {
      try {
        const p = getTargetDateParts(date);
        if (!p) return 0;
        const targetUtcMs = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
        return Math.round((date.getTime() - targetUtcMs) / 60000);
      } catch (e) {
        return 0;
      }
    }

    function formatOffsetString(offsetMinutes) {
      const sign = offsetMinutes <= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutes);
      const hours = String(Math.floor(abs / 60)).padStart(2, '0');
      const mins = String(abs % 60).padStart(2, '0');
      return 'GMT' + sign + hours + mins;
    }

    // 3. Date.prototype Timezone and Clock Overrides
    Date.prototype.getTimezoneOffset = function() {
      return getTargetTimezoneOffset(this);
    };

    Date.prototype.getHours = function() {
      const p = getTargetDateParts(this);
      return p ? p.hour : NaN;
    };

    Date.prototype.getMinutes = function() {
      const p = getTargetDateParts(this);
      return p ? p.minute : NaN;
    };

    Date.prototype.getSeconds = function() {
      const p = getTargetDateParts(this);
      return p ? p.second : NaN;
    };

    Date.prototype.getDate = function() {
      const p = getTargetDateParts(this);
      return p ? p.day : NaN;
    };

    Date.prototype.getMonth = function() {
      const p = getTargetDateParts(this);
      return p ? p.month : NaN;
    };

    Date.prototype.getFullYear = function() {
      const p = getTargetDateParts(this);
      return p ? p.year : NaN;
    };

    Date.prototype.getYear = function() {
      const p = getTargetDateParts(this);
      return p ? p.year - 1900 : NaN;
    };

    Date.prototype.getDay = function() {
      const p = getTargetDateParts(this);
      if (!p) return NaN;
      const temp = new Date(Date.UTC(p.year, p.month, p.day));
      return temp.getUTCDay();
    };

    Date.prototype.toTimeString = function() {
      if (isNaN(this.getTime())) return 'Invalid Date';
      const p = getTargetDateParts(this);
      const offset = getTargetTimezoneOffset(this);
      const timeStr = String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0') + ':' + String(p.second).padStart(2, '0');
      const gmtStr = formatOffsetString(offset);
      return timeStr + ' ' + gmtStr + (tzLongName ? ' (' + tzLongName + ')' : '');
    };

    Date.prototype.toString = function() {
      if (isNaN(this.getTime())) return 'Invalid Date';
      const p = getTargetDateParts(this);
      const offset = getTargetTimezoneOffset(this);
      const dayName = DAYS[this.getDay()];
      const monthName = MONTHS[p.month];
      const dayStr = String(p.day).padStart(2, '0');
      const timeStr = String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0') + ':' + String(p.second).padStart(2, '0');
      const gmtStr = formatOffsetString(offset);
      return dayName + ' ' + monthName + ' ' + dayStr + ' ' + p.year + ' ' + timeStr + ' ' + gmtStr + (tzLongName ? ' (' + tzLongName + ')' : '');
    };

    Date.prototype.toLocaleTimeString = function(locales, options) {
      const opts = Object.assign({ timeZone: TARGET_TZ }, options);
      return new OrigDateTimeFormat(locales || 'en-US', Object.assign({ hour: 'numeric', minute: 'numeric', second: 'numeric' }, opts)).format(this);
    };

    Date.prototype.toLocaleDateString = function(locales, options) {
      const opts = Object.assign({ timeZone: TARGET_TZ }, options);
      return new OrigDateTimeFormat(locales || 'en-US', Object.assign({ year: 'numeric', month: 'numeric', day: 'numeric' }, opts)).format(this);
    };

    Date.prototype.toLocaleString = function(locales, options) {
      const opts = Object.assign({ timeZone: TARGET_TZ }, options);
      return new OrigDateTimeFormat(locales || 'en-US', Object.assign({ year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }, opts)).format(this);
    };
  } catch(e) {}
})();`
}

