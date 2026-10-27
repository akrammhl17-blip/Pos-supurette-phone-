// منطق البيع والحساب والتقارير — دوال نقية بلا واجهة
(function (root) {
  'use strict';
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const r3 = n => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
  const UNITS = ['قطعة', 'كغ', 'غ', 'لتر'];
  const isDec = u => u !== 'قطعة';
  const DIG = '٠١٢٣٤٥٦٧٨٩';

  function parseNum(v) {
    if (typeof v === 'number') return v;
    const s = String(v == null ? '' : v).trim().replace(/[٠-٩]/g, d => DIG.indexOf(d)).replace(',', '.');
    return s === '' ? NaN : Number(s);
  }
  function normQty(unit, q) {
    q = parseNum(q);
    if (!isFinite(q) || q <= 0) return NaN;
    return isDec(unit) ? r3(q) : Math.round(q);
  }
  function cartTotals(lines) {
    let total = 0, cost = 0;
    for (const l of lines) { total += l.price * l.qty; cost += (l.cost || 0) * l.qty; }
    return { total: r2(total), cost: r2(cost), count: lines.length };
  }
  function settle(total, paidRaw) {
    let paid = (paidRaw === '' || paidRaw == null) ? total : parseNum(paidRaw);
    if (!isFinite(paid) || paid < 0) return { ok: false, err: 'المبلغ المدفوع غير صالح' };
    paid = r2(paid);
    if (paid + 1e-9 < total) return { ok: false, paid, short: r2(total - paid), err: 'المبلغ المدفوع أقل من الإجمالي' };
    return { ok: true, paid, change: r2(paid - total) };
  }
  function canAdd(stock, inCart, add, allowNeg) {
    return !!allowNeg || r3(inCart + add) <= r3(stock) + 1e-9;
  }
  function validateProduct(p) {
    const e = [];
    if (!p.name || !String(p.name).trim()) e.push('اسم المنتج مطلوب');
    for (const [k, lbl] of [['buy', 'سعر الشراء'], ['sell', 'سعر البيع'], ['qty', 'الكمية'], ['alert', 'حد التنبيه']]) {
      if (!isFinite(p[k]) || p[k] < 0) e.push(lbl + ' غير صالح (يجب أن يكون رقمًا لا يقل عن 0)');
    }
    if (!isDec(p.unit) && isFinite(p.qty) && !Number.isInteger(p.qty)) e.push('وحدة «قطعة» لا تقبل كسورًا');
    return e;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function rangeFor(kind, now, from, to) {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    if (kind === 'day') { const e = new Date(d); e.setDate(e.getDate() + 1); return [d.getTime(), e.getTime()]; }
    if (kind === 'week') { d.setDate(d.getDate() - d.getDay()); const s = d.getTime(); const e = new Date(d); e.setDate(e.getDate() + 7); return [s, e.getTime()]; }
    if (kind === 'month') { d.setDate(1); const s = d.getTime(); const e = new Date(d); e.setMonth(e.getMonth() + 1); return [s, e.getTime()]; }
    const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
    if (isNaN(a) || isNaN(b) || b < a) return null;
    b.setDate(b.getDate() + 1);
    return [a.getTime(), b.getTime()];
  }
  function report(sales, lo, hi) {
    let total = 0, cost = 0, count = 0; const top = {};
    for (const s of sales) {
      if (s.status === 'cancelled' || s.t < lo || s.t >= hi) continue;
      total += s.total; cost += s.cost; count++;
      for (const l of s.lines) {
        const o = top[l.pid] || (top[l.pid] = { name: l.name, unit: l.unit, qty: 0, amount: 0 });
        o.qty = r3(o.qty + l.qty); o.amount = r2(o.amount + l.price * l.qty);
      }
    }
    return { total: r2(total), cost: r2(cost), profit: r2(total - cost), count, top: Object.values(top).sort((a, b) => b.amount - a.amount).slice(0, 10) };
  }
  function validateBackup(o, schema) {
    if (!o || typeof o !== 'object') return 'الملف ليس نسخة احتياطية صالحة';
    if (o.app !== 'POS Supérette') return 'هذا الملف لا يخص برنامج POS Supérette';
    if (!Number.isInteger(o.schema) || o.schema > schema) return 'إصدار النسخة غير متوافق مع هذا التطبيق';
    const d = o.data;
    if (!d || !['products', 'sales', 'holds', 'moves'].every(k => Array.isArray(d[k]))) return 'بنية الملف ناقصة أو تالفة';
    for (const p of d.products) if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !isFinite(p.sell) || !isFinite(p.buy) || !isFinite(p.qty)) return 'بيانات المنتجات تالفة';
    for (const s of d.sales) if (!s || !Number.isInteger(s.id) || !isFinite(s.total) || !Array.isArray(s.lines)) return 'بيانات المبيعات تالفة';
    return null;
  }
  const api = { r2, r3, UNITS, isDec, parseNum, normQty, cartTotals, settle, canAdd, validateProduct, rangeFor, report, validateBackup, dayStr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.POSLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
