// طبقة IndexedDB — كل عملية حساسة داخل معاملة واحدة (atomic)
(function (root) {
  'use strict';
  const NAME = 'pos-superette', VER = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error('المتصفح لا يدعم التخزين المحلي IndexedDB'));
      const rq = indexedDB.open(NAME, VER);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        d.createObjectStore('products', { keyPath: 'id' });
        d.createObjectStore('sales', { keyPath: 'id' });
        d.createObjectStore('holds', { keyPath: 'id' });
        d.createObjectStore('moves', { keyPath: 'id', autoIncrement: true });
        d.createObjectStore('meta', { keyPath: 'key' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }
  function friendly(e) {
    if (e && e.name === 'QuotaExceededError') return new Error('مساحة التخزين ممتلئة. صدّر نسخة احتياطية وحرّر مساحة في الهاتف.');
    return e instanceof Error ? e : new Error('تعذّر الحفظ في التخزين المحلي');
  }
  // fn يعيد قيمة الإرجاع بعد اكتمال المعاملة؛ fail(e) يلغي المعاملة بخطأ
  async function run(stores, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      let out, err = null;
      const t = db.transaction(stores, mode);
      t.oncomplete = () => res(typeof out === 'function' ? out() : out);
      t.onabort = () => rej(friendly(err || t.error));
      t.onerror = () => { err = err || t.error; };
      const fail = e => { err = e; try { t.abort(); } catch (_) {} };
      try { out = fn(t, fail); } catch (e) { fail(e); }
    });
  }
  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = async s => { const db = await open(); return reqP(db.transaction(s).objectStore(s).getAll()); };
  const put = (s, v) => run([s], 'readwrite', t => { t.objectStore(s).put(v); });
  const del = (s, k) => run([s], 'readwrite', t => { t.objectStore(s).delete(k); });
  const getMeta = async k => { const db = await open(); const r = await reqP(db.transaction('meta').objectStore('meta').get(k)); return r ? r.value : undefined; };
  const setMeta = (k, v) => run(['meta'], 'readwrite', t => { t.objectStore('meta').put({ key: k, value: v }); });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const r3 = n => Math.round((n + Number.EPSILON) * 1000) / 1000;

  function saveProduct(p, isNew, now) {
    return run(['products', 'moves'], 'readwrite', t => {
      t.objectStore('products').put(p);
      if (isNew && p.qty > 0) t.objectStore('moves').add({ pid: p.id, name: p.name, unit: p.unit, type: 'initial', delta: p.qty, after: p.qty, reason: 'رصيد افتتاحي', t: now });
    });
  }
  function adjustStock(pid, mode, value, reason, now) {
    return run(['products', 'moves'], 'readwrite', (t, fail) => {
      t.objectStore('products').get(pid).onsuccess = e => {
        const p = e.target.result; if (!p) return fail(new Error('المنتج غير موجود'));
        const after = mode === 'add' ? r3(p.qty + value) : r3(value);
        if (after < 0) return fail(new Error('الكمية الناتجة لا يمكن أن تكون سالبة'));
        const delta = r3(after - p.qty); p.qty = after;
        t.objectStore('products').put(p);
        t.objectStore('moves').add({ pid, name: p.name, unit: p.unit, type: mode === 'add' ? 'in' : 'adjust', delta, after, reason: reason || (mode === 'add' ? 'وصول بضاعة' : 'تعديل جرد'), t: now });
      };
    });
  }
  // تأكيد البيع: معاملة واحدة تضمن عدم التكرار وخصم المخزون مرة واحدة
  function confirmSale(cart, paid, change, allowNeg, now) {
    return run(['sales', 'products', 'moves', 'meta'], 'readwrite', (t, fail) => {
      const S = t.objectStore('sales'), P = t.objectStore('products'), M = t.objectStore('moves'), Me = t.objectStore('meta');
      let result = null;
      Me.get('done:' + cart.id).onsuccess = e0 => {
        if (e0.target.result) return fail(new Error('DUP'));
        Me.get('seq').onsuccess = e1 => {
          const n = (e1.target.result ? e1.target.result.value : 0) + 1;
          const lines = cart.lines, prods = {}; let i = 0;
          const next = () => {
            if (i < lines.length) {
              const l = lines[i++];
              P.get(l.pid).onsuccess = ev => {
                const p = ev.target.result;
                if (!p) return fail(new Error('المنتج «' + l.name + '» لم يعد موجودًا'));
                if (!allowNeg && r3(p.qty - l.qty) < -1e-9) return fail(new Error('المخزون غير كافٍ للمنتج «' + p.name + '» (المتوفر ' + p.qty + ')'));
                prods[l.pid] = p; next();
              };
              return;
            }
            let total = 0, cost = 0; const sl = [];
            for (const l of lines) {
              const p = prods[l.pid];
              total += l.price * l.qty; cost += p.buy * l.qty;
              sl.push({ pid: l.pid, name: l.name, unit: l.unit, qty: l.qty, price: l.price, cost: p.buy });
              p.qty = r3(p.qty - l.qty); P.put(p);
              M.add({ pid: p.id, name: p.name, unit: p.unit, type: 'sale', delta: -l.qty, after: p.qty, reason: 'بيع #' + n, t: now, saleId: n });
            }
            total = Math.round(total * 100) / 100; cost = Math.round(cost * 100) / 100;
            result = { id: n, t: now, lines: sl, total, cost, paid, change, status: 'ok', cartId: cart.id };
            S.add(result); Me.put({ key: 'seq', value: n }); Me.put({ key: 'done:' + cart.id, value: n });
          };
          next();
        };
      };
      return () => result;
    });
  }
  function cancelSale(id, now) {
    return run(['sales', 'products', 'moves'], 'readwrite', (t, fail) => {
      t.objectStore('sales').get(id).onsuccess = e => {
        const s = e.target.result;
        if (!s || s.status === 'cancelled') return fail(new Error('لا يمكن إلغاء هذه العملية'));
        s.status = 'cancelled'; s.cancelledAt = now; t.objectStore('sales').put(s);
        s.lines.forEach(l => {
          t.objectStore('products').get(l.pid).onsuccess = ev => {
            const p = ev.target.result; if (!p) return;
            p.qty = r3(p.qty + l.qty); t.objectStore('products').put(p);
            t.objectStore('moves').add({ pid: p.id, name: p.name, unit: p.unit, type: 'cancel', delta: l.qty, after: p.qty, reason: 'إلغاء بيع #' + id, t: now, saleId: id });
          };
        });
      };
    });
  }
  function nextHoldNo() {
    return run(['meta'], 'readwrite', t => {
      const r = {};
      t.objectStore('meta').get('holdSeq').onsuccess = e => { r.n = (e.target.result ? e.target.result.value : 0) + 1; t.objectStore('meta').put({ key: 'holdSeq', value: r.n }); };
      return () => r.n;
    });
  }
  async function exportData() {
    const [products, sales, holds, moves, settings, seq, holdSeq] = await Promise.all([all('products'), all('sales'), all('holds'), all('moves'), getMeta('settings'), getMeta('seq'), getMeta('holdSeq')]);
    return { products, sales, holds, moves, settings: settings || {}, seq: seq || 0, holdSeq: holdSeq || 0 };
  }
  function replaceAll(d) {
    return run(['products', 'sales', 'holds', 'moves', 'meta'], 'readwrite', t => {
      ['products', 'sales', 'holds', 'moves'].forEach(s => { const st = t.objectStore(s); st.clear(); d[s].forEach(v => st.put(v)); });
      const m = t.objectStore('meta');
      m.put({ key: 'settings', value: d.settings || {} }); m.put({ key: 'seq', value: d.seq || 0 }); m.put({ key: 'holdSeq', value: d.holdSeq || 0 });
      m.put({ key: 'cart', value: null });
    });
  }
  root.POSDB = { open, all, put, del, getMeta, setMeta, uid, saveProduct, adjustStock, confirmSale, cancelSale, nextHoldNo, exportData, replaceAll };
})(window);
