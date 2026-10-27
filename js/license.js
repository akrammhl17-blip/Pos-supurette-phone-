// الترخيص والتجربة المجانية — حماية محلية أساسية (غير مضمونة ضد مستخدم متقدم)
(function (root) {
  'use strict';
  const C = root.POS_CONFIG, KEY = 'pos_lic';
  const b64uToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const newId = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(2, '0')).join('').toUpperCase().replace(/(.{4})(?=.)/g, '$1-'); };

  // حالة الترخيص — دالة نقية قابلة للاختبار
  function statusOf(s, now, licOk, cfg) {
    cfg = cfg || C;
    if (!s) return { code: 'none', readOnly: true };
    if (now < s.lastSeen - cfg.clockTolerance) return { code: 'tampered', readOnly: true };
    if (s.license && licOk) return { code: 'licensed', readOnly: false };
    const left = s.startServer + cfg.trialMs - (now - s.skew);
    if (left <= 0) return { code: 'expired', readOnly: true, left: 0 };
    return { code: 'trial', readOnly: false, left };
  }
  async function verifyToken(token, installId, pub) {
    pub = pub || (C && C.publicKey);
    if (!pub || !token) return false;
    try {
      const key = await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64uToBytes(token.trim()), new TextEncoder().encode(installId));
    } catch (_) { return false; }
  }
  // وقت موثوق من ترويسة Date للخادم المستضيف (لا يحتاج خلفية خاصة)
  async function serverTime() {
    const r = await fetch('./index.html?probe=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
    const d = r.headers.get('Date'); if (!d) throw new Error('الخادم لم يرسل الوقت');
    const t = Date.parse(d); if (isNaN(t)) throw new Error('وقت الخادم غير صالح');
    return t + (parseInt(r.headers.get('Age') || '0', 10) || 0) * 1000;
  }
  let st = null, licOk = false, lastSave = 0;
  async function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} await POSDB.setMeta('lic', st); }
  async function load() {
    let a = await POSDB.getMeta('lic'), b = null;
    try { b = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
    if (a && b) {
      const nw = b.lastSeen > a.lastSeen ? b : a, old = a.startServer <= b.startServer ? a : b;
      st = Object.assign({}, nw, { installId: old.installId, startServer: old.startServer, lastSeen: Math.max(a.lastSeen, b.lastSeen), license: a.license || b.license || null });
    } else st = a || b || null;
    if (st) { licOk = await verifyToken(st.license, st.installId); await save(); }
    return st;
  }
  async function activate() {
    const t = await serverTime(), now = Date.now();
    st = { v: 1, installId: newId(), startServer: t, skew: now - t, lastSeen: now, license: null };
    await save(); return st;
  }
  async function syncClock() {
    if (!st) return;
    const t = await serverTime(), now = Date.now();
    st.skew = now - t; st.lastSeen = now; await save();
  }
  async function touch(force) {
    if (!st) return; const now = Date.now();
    if (now < st.lastSeen - C.clockTolerance) return;
    if (!force && now - lastSave < 30000) return;
    st.lastSeen = Math.max(st.lastSeen, now); lastSave = now; await save();
  }
  async function applyLicense(token) {
    if (!C.publicKey) return { ok: false, err: 'لم يتم إعداد المفتاح العام للترخيص في js/config.js' };
    if (!st) return { ok: false, err: 'فعّل التطبيق أولًا' };
    if (!(await verifyToken(token, st.installId))) return { ok: false, err: 'كود الترخيص غير صحيح لهذا التثبيت' };
    st.license = token.trim(); licOk = true; await save(); return { ok: true };
  }
  const api = { statusOf, verifyToken, load, activate, syncClock, touch, applyLicense, status: () => statusOf(st, Date.now(), licOk), state: () => st };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.POSLicense = api;
})(typeof window !== 'undefined' ? window : globalThis);
