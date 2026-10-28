// الواجهة وربط الصفحات — المنطق في logic.js والتخزين في db.js والترخيص في license.js
(function () {
  'use strict';
  const L = POSLogic, C = POS_CONFIG, DB = POSDB, LIC = POSLicense;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' DA';
  const num = n => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const fdt = t => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const P = { cart: '<circle cx="8" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.5L23 7H6"/>', box: '<path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>', layers: '<path d="m12 2 10 6-10 6L2 8z"/><path d="m2 16 10 6 10-6"/>', pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>', receipt: '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>', chart: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>', save: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v3h16v-3"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>', home: '<path d="m3 11 9-8 9 8M5 10v10h14V10"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', printer: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="6" y="14" width="12" height="7"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', back: '<path d="M5 12h14M13 6l6 6-6 6"/>', up: '<path d="M12 21V9m0 0-4 4m4-4 4 4"/><path d="M4 7V4h16v3"/>', check: '<path d="m5 12 5 5 9-10"/>', cam: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/>' };
  const ic = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (P[n] || '') + '</svg>';
  const TITLES = { home: 'POS Supérette', pos: 'البيع', holds: 'السلال المعلقة', products: 'المنتجات', stock: 'المخزون', sales: 'سجل المبيعات', reports: 'التقارير', backup: 'النسخ الاحتياطي', settings: 'الإعدادات والترخيص' };
  const DEF = { shopName: 'متجري', phone: '', address: '', footer: 'شكرًا لزيارتكم', logo: '', lowDefault: 5, allowNeg: false, showImgs: true, printWidth: '58', autoPrint: false };
  const newCart = () => ({ id: DB.uid(), lines: [] });
  const S = { products: [], holds: [], sales: [], moves: [], set: Object.assign({}, DEF), cart: newCart(), page: 'home', tab: 'items', q: '', cat: '', busy: false, online: navigator.onLine, lic: { code: 'none', readOnly: true }, rep: { kind: 'day', from: '', to: '' }, sq: '', sd: '', plow: '', pq: '', pcat: '', showMoves: false, tmpImg: null, fatal: '', bt: null };

  // ---------- أدوات عامة ----------
  let tt;
  function toast(m, type) { const t = $('#toast'); t.textContent = m; t.className = 'toast' + (type === 'err' ? ' err' : ''); t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, type === 'err' ? 4200 : 2200); }
  function modal(html) { const m = $('#modal'); m.innerHTML = '<div class="sheet">' + html + '</div>'; m.hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  function confirmBox(msg, ok, danger) {
    return new Promise(res => {
      modal('<h3>تأكيد</h3><p>' + esc(msg).replace(/\n/g, '<br>') + '</p><div class="acts"><button class="btn sec" id="cN">إلغاء</button><button class="btn ' + (danger ? 'red' : '') + '" id="cY">' + esc(ok || 'تأكيد') + '</button></div>');
      $('#cN').onclick = () => { closeModal(); res(false); }; $('#cY').onclick = () => { closeModal(); res(true); };
    });
  }
  const roMsg = s => s.code === 'tampered' ? 'تم اكتشاف تغيير في ساعة الجهاز. صحّح الوقت ثم اتصل بالإنترنت لمزامنته.' : s.code === 'none' ? 'يجب تفعيل التطبيق أولًا.' : 'انتهت التجربة المجانية — وضع القراءة فقط. ' + C.contact;
  function ro() { S.lic = LIC.status(); if (S.lic.readOnly) { toast(roMsg(S.lic), 'err'); return true; } return false; }
  async function loadAll() {
    const [p, h, s, m, st, cart] = await Promise.all([DB.all('products'), DB.all('holds'), DB.all('sales'), DB.all('moves'), DB.getMeta('settings'), DB.getMeta('cart')]);
    S.products = p.sort((a, b) => a.name.localeCompare(b.name, 'ar')); S.holds = h.sort((a, b) => a.no - b.no);
    S.sales = s.sort((a, b) => b.id - a.id); S.moves = m.sort((a, b) => b.id - a.id);
    S.set = Object.assign({}, DEF, st || {}); if (cart && Array.isArray(cart.lines)) S.cart = cart;
  }
  const saveCart = () => DB.setMeta('cart', S.cart).catch(e => toast(e.message, 'err'));
  const lowOf = p => p.qty <= (p.alert == null ? S.set.lowDefault : p.alert);
  const cats = () => Array.from(new Set(S.products.map(p => p.cat).filter(Boolean)));
  const cartQty = pid => { const l = S.cart.lines.find(x => x.pid === pid); return l ? l.qty : 0; };
  function leftTxt(ms) { const m = Math.max(0, Math.floor(ms / 6e4)); return Math.floor(m / 60) + ' س ' + (m % 60) + ' د'; }
  async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); }
  function resizeImg(file, max, cb) {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .72)); }; im.onerror = () => toast('تعذّر قراءة الصورة', 'err'); im.src = r.result; };
    r.readAsDataURL(file);
  }

  // ---------- العرض ----------
  function banner() {
    const s = S.lic;
    if (s.code === 'trial') return '<div class="banner' + (s.left < 36e5 ? ' warn' : '') + '">تجربة مجانية — المتبقي ' + leftTxt(s.left) + '</div>';
    if (s.code === 'expired') return '<div class="banner bad">انتهت التجربة المجانية — وضع القراءة فقط. بياناتك محفوظة ويمكنك تصدير نسخة احتياطية. <a href="#" data-a="go" data-p="settings">الترخيص</a></div>';
    if (s.code === 'tampered') return '<div class="banner bad">تم اكتشاف تغيير في ساعة الجهاز — وضع القراءة فقط. <a href="#" data-a="syncClock">مزامنة الوقت (يتطلب إنترنت)</a></div>';
    return '';
  }
  function render() {
    const root = $('#app');
    if (S.fatal) { root.innerHTML = '<div class="center"><div class="card"><h2>تعذّر تشغيل التطبيق</h2><p>' + esc(S.fatal) + '</p></div></div>'; return; }
    if (S.lic.code === 'none') { root.innerHTML = activationView(); return; }
    const pg = PAGES[S.page] || PAGES.home;
    root.innerHTML = '<header class="top">' + (S.page !== 'home' ? '<button class="ib" data-a="go" data-p="home" aria-label="رجوع">' + ic('back') + '</button>' : '') + '<h1>' + esc(S.page === 'home' ? S.set.shopName : TITLES[S.page]) + '</h1><span style="font-size:13px"><i class="dot' + (S.online ? '' : ' off') + '"></i>' + (S.online ? 'متصل' : 'دون اتصال') + '</span></header>' + banner() + '<main>' + pg() + '</main>' + (S.page === 'pos' && S.tab === 'items' ? posBar() : '') + (S.page === 'products' && !S.lic.readOnly ? '<button class="fab" data-a="prodNew" aria-label="إضافة منتج">' + ic('plus') + '</button>' : '');
  }
  function activationView() {
    return '<div class="center"><div class="card"><h2>مرحبًا بك في POS Supérette</h2><p>نظام بيع وتسيير للمحلات الصغيرة. يعمل دون إنترنت بعد التفعيل.</p><div class="warnbox">التفعيل الأول يتطلب اتصالًا بالإنترنت (مرة واحدة فقط). تبدأ التجربة المجانية (24 ساعة) عند التفعيل.</div><button class="btn blk" data-a="activate">' + ic('check') + ' ابدأ التجربة المجانية</button><p style="color:var(--mu);font-size:13px">' + (S.online ? 'أنت متصل بالإنترنت.' : 'لا يوجد اتصال حاليًا — اتصل بالإنترنت ثم أعد المحاولة.') + '</p></div></div>';
  }
  const empty = (i, t) => '<div class="empty">' + ic(i) + '<p>' + esc(t) + '</p></div>';
  const thumb = p => p.img && S.set.showImgs ? '<img src="' + esc(p.img) + '" alt="">' : '<div class="ph">' + ic('box') + '</div>';

  const PAGES = {
    home() {
      const [lo, hi] = L.rangeFor('day', Date.now()), r = L.report(S.sales, lo, hi), low = S.products.filter(lowOf).length;
      const q = (p, i, t, b) => '<button class="q" data-a="go" data-p="' + p + '">' + ic(i) + t + (b ? '<span class="badge">' + b + '</span>' : '') + '</button>';
      return '<div class="grid"><div class="stat"><span>مبيعات اليوم</span><b>' + money(r.total) + '</b></div><div class="stat"><span>عمليات البيع</span><b>' + r.count + '</b></div><div class="stat"><span>الربح الإجمالي التقديري</span><b>' + money(r.profit) + '</b></div><div class="stat"><span>منتجات منخفضة المخزون</span><b' + (low ? ' class="low"' : '') + '>' + low + '</b></div></div>' +
        '<div class="quick"><button class="q main" data-a="go" data-p="pos">' + ic('cart') + 'البيع</button>' + q('products', 'box', 'المنتجات') + q('stock', 'layers', 'المخزون') + q('holds', 'pause', 'السلال المعلقة', S.holds.length) + q('sales', 'receipt', 'سجل المبيعات') + q('reports', 'chart', 'التقارير') + q('backup', 'save', 'النسخ الاحتياطي') + q('settings', 'settings', 'الإعدادات والترخيص') + '</div>' +
        '<p style="color:var(--mu);font-size:12px;text-align:center;margin-top:16px">الربح الإجمالي = المبيعات − تكلفة البضاعة، قبل أي مصاريف أخرى.</p>';
    },
    pos() {
      const n = S.cart.lines.length;
      let h = '<div class="row"><div class="sp"><input id="q" data-i="q" placeholder="ابحث بالاسم أو الباركود" value="' + esc(S.q) + '" autocomplete="off" enterkeyhint="search"></div><button class="ib" data-a="scanPos" aria-label="مسح بالكاميرا">' + ic('cam') + '</button><button class="btn sec" data-a="go" data-p="holds">' + ic('pause') + 'السلال المعلقة' + (S.holds.length ? ' <b class="tag g">' + S.holds.length + '</b>' : '') + '</button></div>' +
        '<div class="tabs" style="margin-top:10px"><button class="' + (S.tab === 'items' ? 'on' : '') + '" data-a="tab" data-t="items">المنتجات</button><button class="' + (S.tab === 'cart' ? 'on' : '') + '" data-a="tab" data-t="cart">السلة (' + n + ')</button></div>';
      if (S.tab === 'items') {
        h += '<div class="chips"><span class="chip' + (S.cat ? '' : ' on') + '" data-a="cat" data-c="">الكل</span>' + cats().map(c => '<span class="chip' + (S.cat === c ? ' on' : '') + '" data-a="cat" data-c="' + esc(c) + '">' + esc(c) + '</span>').join('') + '</div><div id="plist">' + plist() + '</div>';
      } else h += cartView();
      return h;
    },
    holds() {
      const q = S.hq || '', list = S.holds.filter(h => !q || String(h.no).includes(q) || (h.note || '').includes(q) || h.lines.some(l => l.name.includes(q)));
      return '<input id="hq" data-i="hq" placeholder="ابحث برقم السلة أو ملاحظة أو منتج" value="' + esc(q) + '"><div style="margin-top:10px">' + (list.length ? list.map(h => { const t = L.cartTotals(h.lines); return '<div class="item"><div class="t"><b>سلة رقم ' + h.no + (h.note ? ' — ' + esc(h.note) : '') + '</b><small>' + h.lines.length + ' منتج • علّقت ' + fdt(h.t) + '</small><div class="price">' + money(t.total) + '</div></div><button class="btn" data-a="holdRestore" data-id="' + h.id + '">استرجاع</button><button class="ib" style="background:var(--rl);color:var(--rd)" data-a="holdDel" data-id="' + h.id + '" aria-label="حذف">' + ic('trash') + '</button></div>'; }).join('') : empty('pause', 'لا توجد سلال معلقة')) + '</div><p style="color:var(--mu);font-size:13px">السلة المعلقة ليست عملية بيع: لا تُحتسب في المبيعات ولا الأرباح ولا تخصم من المخزون.</p>';
    },
    products() {
      const q = S.pq.trim().toLowerCase();
      const list = S.products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q)) && (!S.pcat || p.cat === S.pcat) && (!S.plow || (S.plow === 'low' ? lowOf(p) && p.qty > 0 : S.plow === 'out' ? p.qty <= 0 : true)));
      return '<input id="pq" data-i="pq" placeholder="بحث بالاسم أو الباركود" value="' + esc(S.pq) + '"><div class="row" style="margin-top:8px"><select data-i="pcat"><option value="">كل التصنيفات</option>' + cats().map(c => '<option' + (S.pcat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select><select data-i="plow"><option value="">كل الحالات</option><option value="low"' + (S.plow === 'low' ? ' selected' : '') + '>منخفض</option><option value="out"' + (S.plow === 'out' ? ' selected' : '') + '>نافد</option></select></div><div style="margin-top:10px">' +
        (list.length ? list.map(p => '<div class="item">' + thumb(p) + '<div class="t"><b>' + esc(p.name) + '</b><small>' + esc(p.cat || 'بدون تصنيف') + (p.barcode ? ' • ' + esc(p.barcode) : '') + '</small><div><span class="price">' + money(p.sell) + '</span> <small>شراء ' + money(p.buy) + '</small></div><small class="' + (lowOf(p) ? 'low' : '') + '">' + num(p.qty) + ' ' + esc(p.unit) + (p.qty <= 0 ? '<span class="tag">نافد</span>' : lowOf(p) ? '<span class="tag">منخفض</span>' : '') + '</small></div><button class="ib" data-a="prodEdit" data-id="' + p.id + '" aria-label="تعديل">' + ic('edit') + '</button><button class="ib" style="background:var(--rl);color:var(--rd)" data-a="prodDel" data-id="' + p.id + '" aria-label="حذف">' + ic('trash') + '</button></div>').join('') : empty('box', S.products.length ? 'لا نتائج مطابقة' : 'لا توجد منتجات بعد — اضغط زر + لإضافة أول منتج')) + '</div>';
    },
    stock() {
      const list = S.products.filter(p => !S.slow || lowOf(p));
      return '<div class="row"><label class="row sp" style="margin:0"><input type="checkbox" style="width:22px;min-height:22px" data-i="slow"' + (S.slow ? ' checked' : '') + '> المنخفض فقط</label><button class="btn sec" data-a="toggleMoves">' + (S.showMoves ? 'الكميات' : 'سجل الحركات') + '</button></div><div style="margin-top:10px">' +
        (S.showMoves ? (S.moves.length ? S.moves.slice(0, 150).map(m => '<div class="item"><div class="t"><b>' + esc(m.name) + '</b><small>' + esc(m.reason) + ' • ' + fdt(m.t) + '</small></div><div style="text-align:end"><b class="' + (m.delta < 0 ? 'low' : '') + '" style="direction:ltr;display:block">' + (m.delta > 0 ? '+' : '') + num(m.delta) + '</b><small>الرصيد ' + num(m.after) + '</small></div></div>').join('') : empty('layers', 'لا توجد حركات')) :
          (list.length ? list.map(p => '<div class="item">' + thumb(p) + '<div class="t"><b>' + esc(p.name) + '</b><small class="' + (lowOf(p) ? 'low' : '') + '">' + num(p.qty) + ' ' + esc(p.unit) + (lowOf(p) ? ' — تحت الحد (' + num(p.alert) + ')' : '') + '</small></div><button class="btn sec" data-a="stockAdj" data-id="' + p.id + '">تعديل</button></div>').join('') : empty('layers', 'لا توجد منتجات'))) + '</div>';
    },
    sales() {
      const q = S.sq.trim(), d = S.sd;
      const list = S.sales.filter(s => (!q || String(s.id) === q.replace('#', '')) && (!d || L.dayStr(new Date(s.t)) === d));
      return '<div class="row"><input id="sq" data-i="sq" placeholder="رقم الفاتورة" inputmode="numeric" value="' + esc(S.sq) + '"><input type="date" data-i="sd" value="' + esc(S.sd) + '"></div><div style="margin-top:10px">' +
        (list.length ? list.slice(0, 200).map(s => '<div class="item" data-a="saleView" data-id="' + s.id + '" style="cursor:pointer"><div class="t"><b>فاتورة #' + s.id + (s.status === 'cancelled' ? '<span class="tag">ملغاة</span>' : '') + '</b><small>' + fdt(s.t) + ' • ' + s.lines.length + ' منتج</small></div><span class="price">' + money(s.total) + '</span></div>').join('') : empty('receipt', 'لا توجد عمليات بيع')) + '</div>';
    },
    reports() {
      const k = S.rep.kind; let rg = L.rangeFor(k, Date.now(), S.rep.from, S.rep.to), r = rg ? L.report(S.sales, rg[0], rg[1]) : null;
      const low = S.products.filter(lowOf);
      return '<div class="tabs">' + [['day', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['custom', 'فترة']].map(([a, b]) => '<button class="' + (k === a ? 'on' : '') + '" data-a="rep" data-k="' + a + '">' + b + '</button>').join('') + '</div>' +
        (k === 'custom' ? '<div class="row"><input id="rfrom" type="date" data-i="rfrom" value="' + esc(S.rep.from) + '"><input id="rto" type="date" data-i="rto" value="' + esc(S.rep.to) + '"></div>' : '') +
        (r ? '<div class="card" style="margin-top:10px"><div class="sum"><span>إجمالي المبيعات</span><b>' + money(r.total) + '</b></div><div class="sum"><span>عدد عمليات البيع</span><b>' + r.count + '</b></div><div class="sum"><span>تكلفة البضاعة المباعة</span><b>' + money(r.cost) + '</b></div><div class="sum big"><span>الربح الإجمالي التقديري</span><b>' + money(r.profit) + '</b></div><small style="color:var(--mu)">هذا ربح إجمالي قبل خصم المصاريف الأخرى (كراء، عمال، كهرباء…) وليس صافي الربح. العمليات الملغاة مستثناة.</small></div>' +
          '<div class="card"><b>الأكثر مبيعًا</b>' + (r.top.length ? r.top.map(t => '<div class="sum"><span>' + esc(t.name) + ' <small>(' + num(t.qty) + ' ' + esc(t.unit) + ')</small></span><b>' + money(t.amount) + '</b></div>').join('') : '<p style="color:var(--mu)">لا مبيعات في هذه الفترة</p>') + '</div>' : '<p class="empty">اختر فترة صحيحة</p>') +
        '<div class="card"><b>منتجات منخفضة المخزون (' + low.length + ')</b>' + (low.length ? low.map(p => '<div class="sum"><span>' + esc(p.name) + '</span><b class="low">' + num(p.qty) + ' ' + esc(p.unit) + '</b></div>').join('') : '<p style="color:var(--mu)">لا يوجد</p>') + '</div>';
    },
    backup() {
      return '<div class="card"><h3 style="margin-top:0">تصدير نسخة احتياطية</h3><p>يحفظ كل المنتجات والمبيعات والمخزون والإعدادات في ملف على الهاتف. يعمل دون إنترنت ويبقى متاحًا بعد انتهاء التجربة.</p><button class="btn blk" data-a="export">' + ic('save') + ' تصدير نسخة احتياطية</button></div><div class="card"><h3 style="margin-top:0">استرجاع نسخة</h3><p>سيستبدل الاسترجاع كل البيانات الحالية. تتم معاينة الملف وطلب تأكيدك قبل أي تغيير.</p><input type="file" id="rfile" accept="application/json,.json" hidden><button class="btn sec blk" data-a="restorePick">' + ic('up') + ' استرجاع نسخة احتياطية</button></div><div class="warnbox">تنبيه: بياناتك مخزنة داخل متصفح الهاتف فقط. مسح بيانات المتصفح أو حذف التطبيق قد يمسحها نهائيًا — احتفظ بنسخة احتياطية بانتظام، وانسخها خارج الهاتف (واتساب/Drive/حاسوب).</div>';
    },
    settings() {
      const s = S.set, l = LIC.state(), st = S.lic;
      const stTxt = { trial: 'تجربة مجانية — المتبقي ' + leftTxt(st.left || 0), expired: 'انتهت التجربة (قراءة فقط)', licensed: 'مرخّص ✔', tampered: 'تم اكتشاف تغيير الساعة (قراءة فقط)' }[st.code] || '';
      return '<div class="card"><label>اسم المحل</label><input id="s_name" value="' + esc(s.shopName) + '"><label>الهاتف (يظهر في الفاتورة)</label><input id="s_phone" value="' + esc(s.phone) + '"><label>العنوان</label><input id="s_addr" value="' + esc(s.address) + '"><label>تذييل الفاتورة</label><input id="s_foot" value="' + esc(s.footer) + '"><label>حد تنبيه المخزون الافتراضي</label><input id="s_low" inputmode="decimal" value="' + esc(s.lowDefault) + '"><label>العملة</label><input value="الدينار الجزائري DA" disabled>' +
        '<label class="row"><input type="checkbox" id="s_neg" style="width:22px;min-height:22px"' + (s.allowNeg ? ' checked' : '') + '> السماح بالبيع عند نفاد المخزون (مخزون سالب)</label><label class="row"><input type="checkbox" id="s_img" style="width:22px;min-height:22px"' + (s.showImgs ? ' checked' : '') + '> عرض صور المنتجات</label>' +
        '<label>عرض ورق الطابعة</label><select id="s_pw"><option value="58"' + (s.printWidth !== '80' ? ' selected' : '') + '>58 مم</option><option value="80"' + (s.printWidth === '80' ? ' selected' : '') + '>80 مم</option></select><label class="row"><input type="checkbox" id="s_auto" style="width:22px;min-height:22px"' + (s.autoPrint ? ' checked' : '') + '> طباعة الفاتورة تلقائيًا بعد كل بيع</label><div class="sum"><span>طابعة بلوتوث مباشرة (تجريبي)</span><b>' + (S.bt ? esc(S.bt.dev.name || 'مرتبطة') : 'غير مرتبطة') + '</b></div><button class="btn sec blk" data-a="btPair">' + ic('printer') + ' ربط طابعة بلوتوث</button><button class="btn sec blk" style="margin-top:6px" data-a="btTest">طباعة تجربة</button><label>الشعار (اختياري)</label><div class="row">' + (s.logo ? '<img src="' + esc(s.logo) + '" style="height:44px;border-radius:8px" alt="">' : '') + '<input type="file" id="s_logo" accept="image/*"></div><button class="btn blk" style="margin-top:14px" data-a="saveSettings">حفظ الإعدادات</button></div>' +
        '<div class="card"><h3 style="margin-top:0">الترخيص</h3><div class="sum"><span>الحالة</span><b>' + stTxt + '</b></div>' + (l && st.code !== 'licensed' ? '<div class="sum"><span>بداية التجربة</span><b>' + fdt(l.startServer + l.skew) + '</b></div><div class="sum"><span>تنتهي</span><b>' + fdt(l.startServer + l.skew + C.trialMs) + '</b></div>' : '') + '<label>معرّف التثبيت (أرسله للبائع)</label><span class="mono">' + esc(l ? l.installId : '') + '</span>' +
        (st.code !== 'licensed' ? '<label>كود الترخيص</label><textarea id="s_lic" rows="3" style="direction:ltr" placeholder="الصق كود الترخيص هنا"></textarea><button class="btn sec blk" style="margin-top:8px" data-a="applyLic">تفعيل الترخيص</button><p style="font-size:13px;color:var(--mu)">' + esc(C.contact) + '</p>' : '') + '</div>';
    }
  };

  // ---------- السلة ----------
  function plist() {
    const q = S.q.trim().toLowerCase();
    const list = S.products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q)) && (!S.cat || p.cat === S.cat)).slice(0, 120);
    if (!list.length) return empty('search', S.products.length ? 'لا نتائج' : 'أضف منتجات أولًا من صفحة المنتجات');
    return list.map(p => '<div class="item" data-a="add" data-id="' + p.id + '" style="cursor:pointer">' + thumb(p) + '<div class="t"><b>' + esc(p.name) + '</b><small class="' + (lowOf(p) ? 'low' : '') + '">المتوفر: ' + num(p.qty) + ' ' + esc(p.unit) + '</small></div><span class="price">' + money(p.sell) + '</span></div>').join('');
  }
  function posBar() {
    const t = L.cartTotals(S.cart.lines);
    return '<div class="bar"><div class="tot"><small>' + t.count + ' منتج</small><b>' + money(t.total) + '</b></div><button class="btn" data-a="tab" data-t="cart"' + (t.count ? '' : ' disabled') + '>' + ic('cart') + 'عرض السلة</button></div>';
  }
  function cartView() {
    const ls = S.cart.lines, t = L.cartTotals(ls);
    if (!ls.length) return empty('cart', 'السلة فارغة');
    return ls.map(l => '<div class="item"><div class="t"><b>' + esc(l.name) + '</b><small>' + money(l.price) + ' / ' + esc(l.unit) + '</small><div class="price">' + money(L.r2(l.price * l.qty)) + '</div></div><div class="qty"><button data-a="dec" data-id="' + l.pid + '">−</button><input data-i="qty" data-id="' + l.pid + '" inputmode="decimal" value="' + num(l.qty) + '"><button data-a="inc" data-id="' + l.pid + '">+</button></div><button class="ib" style="background:var(--rl);color:var(--rd)" data-a="rm" data-id="' + l.pid + '" aria-label="حذف">' + ic('x') + '</button></div>').join('') +
      '<div class="card"><div class="sum big"><span>الإجمالي</span><b>' + money(t.total) + '</b></div><label>المبلغ المدفوع (اتركه فارغًا إن كان المبلغ مضبوطًا)</label><input id="paid" data-i="paid" inputmode="decimal" placeholder="' + num(t.total) + '"><div class="sum"><span>الباقي للزبون</span><b id="chg">0 DA</b></div><label>ملاحظة (اسم الزبون عند التعليق)</label><input id="note" placeholder="اختياري"></div>' +
      '<button class="btn blk" style="min-height:56px;font-size:18px" data-a="confirmSale"' + (S.busy ? ' disabled' : '') + '>' + ic('check') + ' تأكيد البيع</button><div class="row" style="margin-top:8px"><button class="btn acc sp" data-a="hold">' + ic('pause') + 'تعليق السلة</button><button class="btn red sp" data-a="cancelCart">إلغاء السلة</button></div>';
  }
  function setLine(pid, qty) {
    const p = S.products.find(x => x.id === pid), l = S.cart.lines.find(x => x.pid === pid); if (!p || !l) return;
    const q = L.normQty(p.unit, qty); if (isNaN(q)) { toast('كمية غير صالحة', 'err'); return render(); }
    if (!L.canAdd(p.qty, 0, q, S.set.allowNeg)) { toast('المتوفر في المخزون ' + num(p.qty) + ' ' + p.unit + ' فقط', 'err'); l.qty = Math.min(l.qty, p.qty) || l.qty; }
    else l.qty = q;
    saveCart(); render();
  }
  function addToCart(pid) {
    if (ro()) return;
    const p = S.products.find(x => x.id === pid); if (!p) return;
    const inC = cartQty(pid);
    if (!L.canAdd(p.qty, inC, 1, S.set.allowNeg)) return toast(p.qty <= 0 ? 'المنتج نافد' : 'لا يمكن تجاوز الكمية المتوفرة (' + num(p.qty) + ' ' + p.unit + ')', 'err');
    const l = S.cart.lines.find(x => x.pid === pid);
    if (l) l.qty = L.r3(l.qty + 1); else S.cart.lines.push({ pid, name: p.name, unit: p.unit, price: p.sell, cost: p.buy, qty: 1 });
    saveCart(); toast('أُضيف: ' + p.name); render();
    const q = $('#q'); if (q && S.q) { /* يبقى البحث لإضافة منتجات أخرى */ }
  }
  async function confirmSale() {
    if (S.busy) return; if (ro()) return;
    const ls = S.cart.lines; if (!ls.length) return toast('السلة فارغة', 'err');
    const tot = L.cartTotals(ls), st = L.settle(tot.total, ($('#paid') || {}).value || '');
    if (!st.ok) return toast(st.err, 'err');
    S.busy = true;
    try {
      if (!await confirmBox('تأكيد البيع بمبلغ ' + money(tot.total) + (st.change ? '\nالباقي للزبون: ' + money(st.change) : ''), 'تأكيد البيع')) return;
      const sale = await DB.confirmSale(S.cart, st.paid, st.change, !!S.set.allowNeg, Date.now());
      LIC.touch(true);
      S.cart = newCart(); await DB.setMeta('cart', S.cart); await loadAll(); S.tab = 'items'; S.q = ''; render(); showSale(sale, true); if (S.set.autoPrint) printSale(sale);
    } catch (e) {
      if (e.message === 'DUP') { S.cart = newCart(); await DB.setMeta('cart', S.cart); toast('هذه العملية سُجّلت من قبل ولم تُكرَّر'); } else toast(e.message, 'err');
      await loadAll(); render();
    } finally { S.busy = false; }
  }
  async function holdCart() {
    if (ro()) return; if (!S.cart.lines.length) return toast('السلة فارغة', 'err');
    try {
      const no = await DB.nextHoldNo();
      await DB.put('holds', { id: DB.uid(), no, t: Date.now(), lines: S.cart.lines, note: ($('#note') || {}).value || '' });
      S.cart = newCart(); await DB.setMeta('cart', S.cart); await loadAll(); S.tab = 'items'; S.q = ''; toast('تم تعليق السلة رقم ' + no); render();
    } catch (e) { toast(e.message, 'err'); }
  }
  async function restoreHold(id) {
    if (ro()) return; const h = S.holds.find(x => x.id === id); if (!h) return;
    try {
      if (S.cart.lines.length) {
        if (!await confirmBox('السلة الحالية غير فارغة. سيتم تعليقها تلقائيًا ثم استرجاع السلة رقم ' + h.no + '.', 'متابعة')) return;
        const no = await DB.nextHoldNo(); await DB.put('holds', { id: DB.uid(), no, t: Date.now(), lines: S.cart.lines, note: '' });
      }
      S.cart = { id: DB.uid(), lines: h.lines }; await DB.del('holds', id); await DB.setMeta('cart', S.cart); await loadAll();
      S.page = 'pos'; S.tab = 'cart'; render(); toast('تم استرجاع السلة رقم ' + h.no);
    } catch (e) { toast(e.message, 'err'); }
  }

  // ---------- المنتجات والمخزون ----------
  function prodForm(id) {
    const p = id ? S.products.find(x => x.id === id) : null; S.tmpImg = null;
    const isStd = !p || L.UNITS.includes(p.unit);
    modal('<h3>' + (p ? 'تعديل منتج' : 'منتج جديد') + '</h3><label>اسم المنتج *</label><input id="f_name" value="' + esc(p && p.name) + '"><label>الباركود (اختياري)</label><div class="row"><input id="f_barcode" inputmode="numeric" value="' + esc(p && p.barcode) + '"><button class="ib" data-a="scanFill" aria-label="مسح بالكاميرا">' + ic('cam') + '</button></div><div class="row"><div class="sp"><label>سعر الشراء (DA)</label><input id="f_buy" inputmode="decimal" value="' + esc(p ? p.buy : '') + '"></div><div class="sp"><label>سعر البيع (DA)</label><input id="f_sell" inputmode="decimal" value="' + esc(p ? p.sell : '') + '"></div></div><div class="row"><div class="sp"><label>الكمية' + (p ? ' (تُعدَّل من المخزون)' : '') + '</label><input id="f_qty" inputmode="decimal" value="' + esc(p ? p.qty : '') + '"' + (p ? ' disabled' : '') + '></div><div class="sp"><label>حد التنبيه</label><input id="f_alert" inputmode="decimal" value="' + esc(p ? p.alert : S.set.lowDefault) + '"></div></div><label>الوحدة</label><select id="f_unit">' + L.UNITS.map(u => '<option' + (p && p.unit === u ? ' selected' : '') + '>' + u + '</option>').join('') + '<option value="__c"' + (!isStd ? ' selected' : '') + '>وحدة أخرى…</option></select><input id="f_cunit" placeholder="اسم الوحدة (مثال: علبة)" style="margin-top:6px" value="' + esc(!isStd ? p.unit : '') + '"' + (isStd ? ' hidden' : '') + '><label>التصنيف</label><input id="f_cat" list="catl" value="' + esc(p && p.cat) + '"><datalist id="catl">' + cats().map(c => '<option value="' + esc(c) + '">').join('') + '</datalist><label>صورة (اختيارية)</label><input type="file" id="f_img" accept="image/*"><div class="acts"><button class="btn sec" data-a="closeModal">إلغاء</button><button class="btn" data-a="prodSave" data-id="' + (id || '') + '">حفظ</button></div>');
  }
  async function saveProduct(id) {
    if (ro()) return; const g = k => $('#f_' + k).value, old = id ? S.products.find(x => x.id === id) : null;
    let unit = g('unit') === '__c' ? g('cunit').trim() : g('unit'); if (!unit) return toast('اكتب اسم الوحدة', 'err');
    const p = { id: id || DB.uid(), name: g('name').trim(), barcode: g('barcode').trim(), buy: L.parseNum(g('buy')), sell: L.parseNum(g('sell')), qty: old ? old.qty : (g('qty').trim() === '' ? 0 : L.parseNum(g('qty'))), alert: g('alert').trim() === '' ? S.set.lowDefault : L.parseNum(g('alert')), unit, cat: g('cat').trim(), img: S.tmpImg != null ? S.tmpImg : (old ? old.img || '' : '') };
    const errs = L.validateProduct(p); if (errs.length) return toast(errs[0], 'err');
    const dup = p.barcode && S.products.find(x => x.barcode === p.barcode && x.id !== p.id);
    if (dup && !await confirmBox('الباركود موجود مسبقًا للمنتج «' + dup.name + '». هل تريد الحفظ رغم ذلك؟', 'حفظ رغم التكرار')) return;
    if (p.sell < p.buy && !await confirmBox('سعر البيع أقل من سعر الشراء (خسارة). هل تريد المتابعة؟', 'متابعة')) return;
    try { await DB.saveProduct(p, !old, Date.now()); await loadAll(); closeModal(); toast('تم حفظ المنتج'); render(); } catch (e) { toast(e.message, 'err'); }
  }
  function stockForm(id) {
    const p = S.products.find(x => x.id === id); if (!p) return;
    modal('<h3>' + esc(p.name) + '</h3><p>الكمية الحالية: <b>' + num(p.qty) + ' ' + esc(p.unit) + '</b></p><label>نوع العملية</label><select id="k_mode"><option value="add">إضافة كمية (وصول بضاعة)</option><option value="set">تعيين الكمية (جرد/تصحيح)</option></select><label>القيمة</label><input id="k_val" inputmode="decimal"><label>السبب</label><input id="k_why" placeholder="مثال: وصول بضاعة من المورّد"><div class="acts"><button class="btn sec" data-a="closeModal">إلغاء</button><button class="btn" data-a="stockSave" data-id="' + id + '">حفظ</button></div>');
  }
  async function saveStock(id) {
    if (ro()) return; const p = S.products.find(x => x.id === id), mode = $('#k_mode').value, v = L.parseNum($('#k_val').value);
    if (!isFinite(v) || v < 0 || (mode === 'add' && v === 0)) return toast('أدخل كمية صحيحة', 'err');
    if (!L.isDec(p.unit) && !Number.isInteger(v)) return toast('وحدة «قطعة» لا تقبل كسورًا', 'err');
    try { await DB.adjustStock(id, mode, v, $('#k_why').value.trim(), Date.now()); await loadAll(); closeModal(); toast('تم تحديث المخزون'); render(); } catch (e) { toast(e.message, 'err'); }
  }

  // ---------- الفواتير ----------
  function invHtml(s) {
    const st = S.set;
    return '<div class="inv">' + (st.logo ? '<div style="text-align:center"><img src="' + esc(st.logo) + '" style="max-height:50px" alt=""></div>' : '') + '<h3 style="text-align:center;margin:4px 0">' + esc(st.shopName) + '</h3>' + (st.phone || st.address ? '<div style="text-align:center">' + esc([st.phone, st.address].filter(Boolean).join(' • ')) + '</div>' : '') + '<div>فاتورة #' + s.id + (s.status === 'cancelled' ? ' (ملغاة)' : '') + '<br>' + fdt(s.t) + '</div><table><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr>' + s.lines.map(l => '<tr><td>' + esc(l.name) + '</td><td>' + num(l.qty) + ' ' + esc(l.unit) + '</td><td>' + num(l.price) + '</td><td>' + num(L.r2(l.price * l.qty)) + '</td></tr>').join('') + '</table><div class="sum big"><span>الإجمالي</span><b>' + money(s.total) + '</b></div><div class="sum"><span>المدفوع</span><span>' + money(s.paid) + '</span></div><div class="sum"><span>الباقي</span><span>' + money(s.change) + '</span></div><p style="text-align:center">' + esc(st.footer) + '</p></div>';
  }
  function showSale(s, fresh) {
    modal((fresh ? '<h3 style="color:var(--ok)">✔ تم تسجيل البيع</h3>' : '') + invHtml(s) + '<div class="acts"><button class="btn sec" data-a="closeModal">إغلاق</button><button class="btn" data-a="salePrint" data-id="' + s.id + '">' + ic('printer') + 'طباعة</button>' + (!fresh && s.status !== 'cancelled' ? '<button class="btn red" data-a="saleCancel" data-id="' + s.id + '">إلغاء البيع</button>' : '') + '</div>');
  }
  // طباعة: بلوتوث مباشر (تجريبي) إن رُبطت طابعة، وإلا طباعة النظام
  const BT_SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb', '0000ae30-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'];
  function sysPrint(s) {
    if (!window.print) return toast('الطباعة غير مدعومة في هذا المتصفح', 'err');
    const pa = $('#printArea'); pa.style.width = S.set.printWidth === '80' ? '80mm' : '58mm'; pa.innerHTML = invHtml(s); setTimeout(() => window.print(), 50);
  }
  async function printSale(s) {
    if (S.bt) { try { await printBT(s); return; } catch (e) { toast('تعذّرت الطباعة عبر البلوتوث — سيتم استعمال طباعة النظام', 'err'); } }
    sysPrint(s);
  }
  function receiptCanvas(s) {
    const W = S.set.printWidth === '80' ? 576 : 384, st = S.set, F = 'Cairo,Tajawal,"Noto Naskh Arabic","Droid Arabic Naskh",sans-serif', rows = [];
    rows.push({ c: st.shopName, size: 30, bold: 1 }); if (st.phone) rows.push({ c: st.phone, size: 22 }); if (st.address) rows.push({ c: st.address, size: 22 });
    rows.push({ r: 'فاتورة #' + s.id + (s.status === 'cancelled' ? ' (ملغاة)' : ''), l: fdt(s.t), size: 22 }, { line: 1 });
    s.lines.forEach(l => { rows.push({ r: l.name, size: 24, bold: 1 }, { r: num(l.qty) + ' ' + l.unit + ' × ' + num(l.price), l: num(L.r2(l.price * l.qty)) + ' DA', size: 22 }); });
    rows.push({ line: 1 }, { r: 'الإجمالي', l: money(s.total), size: 28, bold: 1 }, { r: 'المدفوع', l: money(s.paid), size: 24 }, { r: 'الباقي', l: money(s.change), size: 24 });
    if (st.footer) rows.push({ c: st.footer, size: 22 });
    const lh = r => r.line ? 14 : Math.round(r.size * 1.5), H = rows.reduce((a, r) => a + lh(r), 0) + 30;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#000'; x.textBaseline = 'top'; let y = 8;
    const fit = (t, max) => { while (t.length > 1 && x.measureText(t).width > max) t = t.slice(0, -1); return t; };
    for (const r of rows) {
      if (r.line) { x.fillRect(4, y + 6, W - 8, 2); y += 14; continue; }
      x.font = (r.bold ? 'bold ' : '') + r.size + 'px ' + F;
      if (r.c != null) { x.direction = 'rtl'; x.textAlign = 'center'; x.fillText(fit(r.c, W - 12), W / 2, y); }
      else {
        let lw = 0; if (r.l != null) { x.direction = 'ltr'; x.textAlign = 'left'; x.fillText(r.l, 6, y); lw = x.measureText(r.l).width + 18; }
        x.direction = 'rtl'; x.textAlign = 'right'; x.fillText(fit(r.r, W - 12 - lw), W - 6, y);
      }
      y += lh(r);
    }
    return cv;
  }
  function toEscPos(cv) { // صورة أحادية اللون (تدعم العربية) بأوامر ESC/POS
    const W = cv.width, H = cv.height, wb = W / 8, d = cv.getContext('2d').getImageData(0, 0, W, H).data, out = [0x1B, 0x40];
    for (let y0 = 0; y0 < H; y0 += 96) {
      const h = Math.min(96, H - y0); out.push(0x1D, 0x76, 0x30, 0, wb & 255, wb >> 8, h & 255, h >> 8);
      for (let y = y0; y < y0 + h; y++) for (let b = 0; b < wb; b++) { let v = 0; for (let k = 0; k < 8; k++) { const i = (y * W + b * 8 + k) * 4; if (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11 < 140) v |= 0x80 >> k; } out.push(v); }
    }
    out.push(0x1B, 0x64, 4); return Uint8Array.from(out);
  }
  async function findChar(dev) {
    const srv = await dev.gatt.connect();
    for (const sv of await srv.getPrimaryServices()) for (const c of await sv.getCharacteristics()) if (c.properties.writeWithoutResponse || c.properties.write) return c;
    throw new Error('لم أجد قناة طباعة في هذه الطابعة');
  }
  async function printBT(s) {
    if (!S.bt.dev.gatt.connected) S.bt.ch = await findChar(S.bt.dev);
    const ch = S.bt.ch, data = toEscPos(receiptCanvas(s)); let size = 120;
    for (let i = 0; i < data.length;) {
      const part = data.slice(i, i + size);
      try { if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(part); else await ch.writeValue(part); i += size; await new Promise(r => setTimeout(r, 12)); }
      catch (e) { if (size > 20) { size = 20; continue; } throw e; }
    }
  }
  async function cancelSale(id) {
    if (ro()) return;
    if (!await confirmBox('سيتم إلغاء الفاتورة #' + id + ' وإرجاع كمياتها إلى المخزون بحركة عكسية. تبقى الفاتورة في السجل كـ«ملغاة».', 'إلغاء البيع', true)) return;
    try { await DB.cancelSale(id, Date.now()); await loadAll(); closeModal(); toast('تم إلغاء البيع وإرجاع المخزون'); render(); } catch (e) { toast(e.message, 'err'); }
  }

  // ---------- النسخ الاحتياطي ----------
  async function doExport() {
    try {
      const data = await DB.exportData(), checksum = await sha(JSON.stringify(data));
      const blob = new Blob([JSON.stringify({ app: 'POS Supérette', schema: C.schema, exportedAt: new Date().toISOString(), checksum, data })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'POS-Superette-' + L.dayStr(new Date()) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('تم تصدير النسخة الاحتياطية');
    } catch (e) { toast('فشل التصدير: ' + e.message, 'err'); }
  }
  async function doRestore(file) {
    if (ro()) return;
    try {
      const o = JSON.parse(await file.text()), err = L.validateBackup(o, C.schema); if (err) return toast(err, 'err');
      if (!o.checksum || o.checksum !== await sha(JSON.stringify(o.data))) return toast('الملف تالف أو تم تعديله (فشل التحقق من السلامة)', 'err');
      const d = o.data;
      if (!await confirmBox('نسخة بتاريخ ' + fdt(Date.parse(o.exportedAt) || Date.now()) + '\n' + d.products.length + ' منتج • ' + d.sales.length + ' عملية بيع • ' + d.holds.length + ' سلة معلقة\n\nسيتم استبدال كل البيانات الحالية.', 'استبدال واسترجاع', true)) return;
      await DB.replaceAll(d); await loadAll(); S.cart = newCart(); toast('تم الاسترجاع بنجاح'); render();
    } catch (e) { toast('فشل الاسترجاع: ' + (e instanceof SyntaxError ? 'الملف ليس JSON صالحًا' : e.message), 'err'); }
  }

  // ---------- مسح الباركود بالكاميرا (BarcodeDetector — يعمل دون إنترنت في Chrome لأندرويد) ----------
  async function openScanner(cb, cont) {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices) return toast('هذا المتصفح لا يدعم مسح الباركود بالكاميرا. استعمل Chrome على أندرويد أو اكتب الباركود يدويًا.', 'err');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
    catch (e) { return toast('تعذّر فتح الكاميرا. اسمح للتطبيق باستعمال الكاميرا من إعدادات المتصفح.', 'err'); }
    const det = new BarcodeDetector(), el = document.createElement('div');
    el.className = 'overlay'; el.style.zIndex = 70; el.style.alignItems = 'center';
    el.innerHTML = '<div class="sheet" style="border-radius:20px;max-width:420px"><video playsinline muted autoplay style="width:100%;border-radius:12px;background:#000;max-height:55vh"></video><p style="text-align:center">وجّه الكاميرا نحو الباركود</p><button class="btn red blk" id="scanX">إغلاق</button></div>';
    document.body.appendChild(el);
    const v = el.querySelector('video'); v.srcObject = stream; v.play().catch(() => {});
    let last = '', lastT = 0, tm = null;
    const close = () => { clearInterval(tm); stream.getTracks().forEach(t => t.stop()); el.remove(); };
    el.querySelector('#scanX').onclick = close;
    tm = setInterval(async () => {
      if (v.readyState < 2) return;
      try {
        const r = await det.detect(v); if (!r.length) return;
        const c = r[0].rawValue, n = Date.now(); if (c === last && n - lastT < 2000) return;
        last = c; lastT = n; if (navigator.vibrate) navigator.vibrate(60);
        cb(c); if (!cont) close();
      } catch (_) {}
    }, 250);
  }
  function scanToCart(code) {
    const m = S.products.find(p => p.barcode && p.barcode === code);
    if (m) addToCart(m.id); else toast('باركود غير موجود في المنتجات: ' + code, 'err');
  }

  // ---------- الأحداث ----------
  const ACT = {
    go: d => { S.page = d.p; if (d.p === 'pos') S.tab = S.cart.lines.length ? S.tab : 'items'; render(); window.scrollTo(0, 0); },
    closeModal, tab: d => { S.tab = d.t; render(); }, cat: d => { S.cat = d.c; render(); },
    add: d => addToCart(d.id), inc: d => { const l = S.cart.lines.find(x => x.pid === d.id); if (l) setLine(d.id, l.qty + 1); },
    dec: d => { const l = S.cart.lines.find(x => x.pid === d.id); if (l) { if (l.qty - 1 <= 0) { S.cart.lines = S.cart.lines.filter(x => x.pid !== d.id); saveCart(); render(); } else setLine(d.id, l.qty - 1); } },
    rm: d => { S.cart.lines = S.cart.lines.filter(x => x.pid !== d.id); saveCart(); render(); },
    cancelCart: async () => { if (S.cart.lines.length && await confirmBox('هل تريد إلغاء السلة الحالية وحذف محتوياتها؟', 'إلغاء السلة', true)) { S.cart = newCart(); await DB.setMeta('cart', S.cart); S.tab = 'items'; render(); } },
    hold: holdCart, confirmSale, holdRestore: d => restoreHold(d.id),
    holdDel: async d => { const h = S.holds.find(x => x.id === d.id); if (h && await confirmBox('حذف السلة المعلقة رقم ' + h.no + ' نهائيًا؟', 'حذف', true)) { await DB.del('holds', d.id); await loadAll(); render(); toast('تم حذف السلة'); } },
    prodNew: () => { if (!ro()) prodForm(); }, prodEdit: d => { if (!ro()) prodForm(d.id); }, prodSave: d => saveProduct(d.id),
    prodDel: async d => { if (ro()) return; const p = S.products.find(x => x.id === d.id); if (p && await confirmBox('حذف المنتج «' + p.name + '»؟ تبقى المبيعات السابقة محفوظة.', 'حذف', true)) { await DB.del('products', d.id); S.cart.lines = S.cart.lines.filter(l => l.pid !== d.id); saveCart(); await loadAll(); render(); toast('تم حذف المنتج'); } },
    stockAdj: d => { if (!ro()) stockForm(d.id); }, stockSave: d => saveStock(d.id), toggleMoves: () => { S.showMoves = !S.showMoves; render(); },
    saleView: d => { const s = S.sales.find(x => x.id === +d.id); if (s) showSale(s, false); }, salePrint: d => { const s = S.sales.find(x => x.id === +d.id); if (s) printSale(s); }, saleCancel: d => cancelSale(+d.id),
    rep: d => { S.rep.kind = d.k; if (d.k === 'custom' && !S.rep.from) S.rep.from = S.rep.to = L.dayStr(new Date()); render(); },
    scanPos: () => { if (!ro()) openScanner(scanToCart, true); }, scanFill: () => openScanner(c => { $('#f_barcode').value = c; toast('تم مسح الباركود'); }, false),
    btPair: async () => {
      if (!navigator.bluetooth) return toast('هذا المتصفح لا يدعم البلوتوث المباشر. استعمل Chrome على أندرويد أو طباعة النظام.', 'err');
      try { const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES }); const ch = await findChar(dev); S.bt = { dev, ch }; toast('تم ربط الطابعة: ' + (dev.name || '')); render(); }
      catch (e) { if (e.name !== 'NotFoundError') toast('تعذّر ربط الطابعة: ' + (e.message || ''), 'err'); }
    },
    btTest: () => printSale({ id: 0, t: Date.now(), lines: [{ name: 'اختبار الطباعة', unit: 'قطعة', qty: 1, price: 100 }], total: 100, paid: 100, change: 0, status: 'ok' }),
    export: doExport, restorePick: () => { if (!ro()) $('#rfile').click(); },
    saveSettings: async () => {
      if (ro()) return; const low = L.parseNum($('#s_low').value); if (!isFinite(low) || low < 0) return toast('حد التنبيه غير صالح', 'err');
      Object.assign(S.set, { shopName: $('#s_name').value.trim() || 'متجري', phone: $('#s_phone').value.trim(), address: $('#s_addr').value.trim(), footer: $('#s_foot').value.trim(), lowDefault: low, allowNeg: $('#s_neg').checked, showImgs: $('#s_img').checked, printWidth: $('#s_pw').value, autoPrint: $('#s_auto').checked });
      try { await DB.setMeta('settings', S.set); toast('تم حفظ الإعدادات'); render(); } catch (e) { toast(e.message, 'err'); }
    },
    applyLic: async () => { const r = await LIC.applyLicense($('#s_lic').value); S.lic = LIC.status(); if (r.ok) toast('تم تفعيل الترخيص ✔'); else toast(r.err, 'err'); render(); },
    activate: async () => {
      if (!navigator.onLine) return toast('لا يوجد اتصال بالإنترنت. اتصل ثم أعد المحاولة.', 'err');
      try { await LIC.activate(); S.lic = LIC.status(); toast('تم التفعيل — بدأت التجربة المجانية 24 ساعة'); render(); } catch (e) { toast('تعذّر التفعيل: ' + e.message + '. تأكد من الاتصال بالإنترنت.', 'err'); }
    },
    syncClock: async () => { try { await LIC.syncClock(); S.lic = LIC.status(); toast(S.lic.code === 'tampered' ? 'ما زال الوقت غير صحيح' : 'تمت مزامنة الوقت'); render(); } catch (e) { toast('تعذّرت المزامنة: ' + e.message, 'err'); } }
  };
  document.addEventListener('click', e => {
    if (e.target.id === 'modal') return closeModal();
    const b = e.target.closest('[data-a]'); if (!b || !ACT[b.dataset.a]) return;
    if (b.tagName === 'A') e.preventDefault(); ACT[b.dataset.a](b.dataset);
  });
  function keepFocus(fn) { const el = document.activeElement, id = el && el.id, pos = el && el.selectionStart; fn(); if (id) { const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } } }
  document.addEventListener('input', e => {
    const t = e.target, i = t.dataset && t.dataset.i; if (!i) return;
    if (i === 'q') { S.q = t.value; const pl = $('#plist'); if (pl) pl.innerHTML = plist(); }
    else if (i === 'paid') { const tot = L.cartTotals(S.cart.lines).total, st = L.settle(tot, t.value); $('#chg').textContent = st.ok ? money(st.change) : (st.short ? 'ينقص ' + money(st.short) : '—'); }
    else if (i === 'f_img') { }
    else { const map = { hq: 'hq', pq: 'pq', sq: 'sq', rfrom: 0, rto: 0 }; if (i in map) { if (i === 'rfrom') S.rep.from = t.value; else if (i === 'rto') S.rep.to = t.value; else S[i] = t.value; keepFocus(render); } }
  });
  document.addEventListener('change', e => {
    const t = e.target, i = t.dataset && t.dataset.i;
    if (i === 'qty') return setLine(t.dataset.id, t.value);
    if (i === 'pcat' || i === 'plow' || i === 'sd') { S[i] = t.value; render(); }
    else if (i === 'slow') { S.slow = t.checked; render(); }
    else if (i === 'rfrom' || i === 'rto') { render(); }
    else if (t.id === 'f_unit') { $('#f_cunit').hidden = t.value !== '__c'; }
    else if (t.id === 'f_img' && t.files[0]) resizeImg(t.files[0], 160, d => { S.tmpImg = d; toast('تم اختيار الصورة'); });
    else if (t.id === 's_logo' && t.files[0]) resizeImg(t.files[0], 220, async d => { S.set.logo = d; try { await DB.setMeta('settings', S.set); render(); } catch (er) { toast(er.message, 'err'); } });
    else if (t.id === 'rfile' && t.files[0]) { doRestore(t.files[0]); t.value = ''; }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'q') {
      const v = e.target.value.trim(); if (!v) return;
      const m = S.products.find(p => p.barcode && p.barcode === v);
      if (m) { addToCart(m.id); S.q = ''; const q = $('#q'); if (q) { q.value = ''; $('#plist').innerHTML = plist(); q.focus(); } }
      else { const f = S.products.filter(p => p.name.toLowerCase().includes(v.toLowerCase())); if (f.length === 1) { addToCart(f[0].id); } else if (!f.length && /^\d{6,}$/.test(v)) toast('باركود غير موجود في المنتجات: ' + v, 'err'); }
    }
  });
  // قارئ باركود USB/بلوتوث بوضع لوحة المفاتيح: يكتب الأرقام بسرعة ثم Enter — يُلتقط تلقائيًا دون الحاجة لتحديد خانة البحث
  let sbuf = '', st0 = 0;
  function onScan(code) {
    const f = $('#f_barcode'); if (f) { f.value = code; toast('تم مسح الباركود'); return; }
    if (!$('#modal').hidden || S.lic.code === 'none') return;
    if (S.page !== 'pos') { S.page = 'pos'; S.tab = 'items'; render(); }
    scanToCart(code);
  }
  document.addEventListener('keydown', e => {
    const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) || e.ctrlKey || e.altKey || e.metaKey) return;
    const n = Date.now();
    if (e.key === 'Enter') { if (sbuf.length >= 4 && n - st0 < 150) { e.preventDefault(); onScan(sbuf); } sbuf = ''; return; }
    if (e.key.length === 1) { if (n - st0 > 100) sbuf = ''; sbuf += e.key; st0 = n; }
  });
  window.addEventListener('online', () => { S.online = true; LIC.syncClock().then(() => { S.lic = LIC.status(); render(); }).catch(() => render()); });
  window.addEventListener('offline', () => { S.online = false; render(); });
  window.addEventListener('pagehide', () => LIC.touch(true));

  // ---------- التشغيل ----------
  async function init() {
    try {
      await DB.open(); await loadAll(); await LIC.load(); S.lic = LIC.status(); render();
      if (LIC.state() && navigator.onLine) LIC.syncClock().then(() => { S.lic = LIC.status(); render(); }).catch(() => {});
    } catch (e) { S.fatal = e.message || 'خطأ غير معروف'; render(); return; }
    setInterval(() => { LIC.touch(); const before = S.lic.code; S.lic = LIC.status(); if (S.lic.code !== before || S.lic.code === 'trial') { if (!$('#modal').hidden || document.activeElement.tagName === 'INPUT') return; render(); } }, 30000);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
