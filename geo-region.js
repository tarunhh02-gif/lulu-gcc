/* ══════════════════════════════════════════════════════════════════════════
   LuLu landing — GCC geo-adaptation.
   IP/Timezone se visitor ka country detect karke poori page us country ke
   hisaab se badal deta hai: currency (KWD base → local), country name (EN+AR),
   city names, aur Kuwait-only blocks (NBK/KFH offer, KW address/phone/email).

   • Detection SYNC hoti hai (timezone) → page render hone se pehle region pata
     hota hai, KWD ka flash nahi hota. IP-API sirf confirm karne ke liye chalti
     hai (VPN/edge case) aur galat nikle to ek baar reload karti hai.
   • ?c=SA jaisa URL param se force bhi kar sakte ho (test / ad targeting).
   • Base prices KWD hain; factor se local currency me convert hote hain
     (rates pegged hain: 1 KWD = 3.26 USD).
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var REGIONS = {
    KW: { iso: 'KWD', dec: 3, f: 1.0,
          nameEn: 'Kuwait', nameAr: 'الكويت', wordAr: 'بالدينار', flag: '🇰🇼',
          citiesEn: ['Kuwait City', 'Hawalli', 'Salmiya', 'Fahaheel', 'Jahra'],
          citiesAr: ['مدينة الكويت', 'حولي', 'السالمية', 'الفحيحيل', 'الجهراء'] },
    SA: { iso: 'SAR', dec: 2, f: 12.23,
          nameEn: 'Saudi Arabia', nameAr: 'السعودية', wordAr: 'بالريال', flag: '🇸🇦',
          citiesEn: ['Riyadh', 'Jeddah', 'Makkah', 'Dammam', 'Madinah'],
          citiesAr: ['الرياض', 'جدة', 'مكة', 'الدمام', 'المدينة'] },
    AE: { iso: 'AED', dec: 2, f: 11.97,
          nameEn: 'UAE', nameAr: 'الإمارات', wordAr: 'بالدرهم', flag: '🇦🇪',
          citiesEn: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain'],
          citiesAr: ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'العين'] },
    BH: { iso: 'BHD', dec: 3, f: 1.226,
          nameEn: 'Bahrain', nameAr: 'البحرين', wordAr: 'بالدينار', flag: '🇧🇭',
          citiesEn: ['Manama', 'Muharraq', 'Riffa', 'Isa Town', 'Hamad Town'],
          citiesAr: ['المنامة', 'المحرق', 'الرفاع', 'مدينة عيسى', 'مدينة حمد'] },
    QA: { iso: 'QAR', dec: 2, f: 11.87,
          nameEn: 'Qatar', nameAr: 'قطر', wordAr: 'بالريال', flag: '🇶🇦',
          citiesEn: ['Doha', 'Lusail', 'Al Wakrah', 'Al Khor', 'Dukhan'],
          citiesAr: ['الدوحة', 'لوسيل', 'الوكرة', 'الخور', 'دخان'] },
    OM: { iso: 'OMR', dec: 3, f: 1.254,
          nameEn: 'Oman', nameAr: 'عُمان', wordAr: 'بالريال', flag: '🇴🇲',
          citiesEn: ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur'],
          citiesAr: ['مسقط', 'صلالة', 'صحار', 'نزوى', 'صور'] }
  };
  var SUPPORTED = ['KW', 'SA', 'AE', 'BH', 'QA', 'OM'];
  /* DEFAULT = SA  (3-Oct-2026, Malik): jo bhi country detect na ho — ya jo
     supported list me na ho (India, Pakistan, US...) — usko SAUDI dikhe.
     Pehle ye 'KW' tha, isliye Saudi ad pe bhi Kuwaiti page khul raha tha. */
  var DEFAULT = 'SA';
  var CACHE_KEY = '_lulu_geo_v1';
  var CACHE_MS = 6 * 60 * 60 * 1000;      // 6 ghante

  /* ── 1. REGION DETECT (sab kuch sync, kahin nahi rukta) ─────────────── */
  function param(k) {
    try { return new URLSearchParams(location.search).get(k) || ''; } catch (e) { return ''; }
  }
  function norm(cc) {
    cc = String(cc || '').toUpperCase().trim();
    return SUPPORTED.indexOf(cc) >= 0 ? cc : '';
  }
  function tzRegion() {
    /* Intl timezone → GCC country. Ye sync hai, isliye pehle render me hi
       sahi country lag jati hai (Asia/Riyadh → SA). */
    try {
      var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
      if (!tz) { return ''; }
      var map = {
        'asia/riyadh': 'SA', 'asia/jeddah': 'SA', 'asia/mecca': 'SA',
        'asia/kuwait': 'KW', 'asia/dubai': 'AE', 'asia/muscat': 'OM',
        'asia/qatar': 'QA', 'asia/bahrain': 'BH', 'asia/aden': 'SA'
      };
      if (map[tz]) { return map[tz]; }
      if (tz.indexOf('riyadh') >= 0 || tz.indexOf('jeddah') >= 0) { return 'SA'; }
      if (tz.indexOf('kuwait') >= 0) { return 'KW'; }
      if (tz.indexOf('dubai') >= 0) { return 'AE'; }
      if (tz.indexOf('qatar') >= 0) { return 'QA'; }
      if (tz.indexOf('bahrain') >= 0) { return 'BH'; }
      if (tz.indexOf('muscat') >= 0) { return 'OM'; }
    } catch (e) {}
    return '';
  }
  function cacheRead() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) { return ''; }
      var j = JSON.parse(raw);
      if (!j || !j.cc || (Date.now() - (j.ts || 0)) > CACHE_MS) { return ''; }
      return norm(j.cc);
    } catch (e) { return ''; }
  }
  function cacheWrite(cc) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cc: cc, ts: Date.now() })); } catch (e) {}
  }
  function langRegion() {
    try {
      var m = String(navigator.language || '').match(/[-_]([A-Za-z]{2})$/);
      return m ? norm(m[1]) : '';
    } catch (e) { return ''; }
  }

  var forced = norm(param('c')) || norm(param('country'));
  var CC = forced || cacheRead() || tzRegion() || langRegion() || DEFAULT;
  var R = REGIONS[CC];
  window.__LULU_CC = CC;
  window.__LULU_REGION = R;
  /* `?c=XX` sirf us page view ke liye — cache me store NAHI karte, warna
     testing/preview ne baad ke visitors ko pin kar diya (stale region). */

  /* Cart/drawer jaise dynamic hisse in do ko use karte hain. __LULU_NUM sirf
     formatting karta hai (multiply NAHI) — kyunki cart ka number pehle hi
     converted DOM se aata hai. */
  window.__LULU_CUR = R.iso;
  window.__LULU_NUM = function (n) {
    n = Number(n) || 0;
    return (R.dec === 3) ? (Math.round(n * 1000) / 1000).toFixed(3)
                         : (Math.round(n * 100) / 100).toFixed(2);
  };

  /* ── 2. FORMAT ──────────────────────────────────────────────────────── */
  function fmt(n) {
    var v = n * R.f;
    if (R.iso === 'KWD' || R.iso === 'BHD' || R.iso === 'OMR') {
      return (Math.round(v * 1000) / 1000).toFixed(3);
    }
    return (Math.round(v * 100) / 100).toFixed(2);
  }

  /* ── 3. TEXT REWRITE ────────────────────────────────────────────────── */
  var CITY_PAIRS = [];
  (function () {
    var kw = REGIONS.KW;
    for (var i = 0; i < kw.citiesEn.length; i++) {
      CITY_PAIRS.push([kw.citiesEn[i], R.citiesEn[i] || kw.citiesEn[i]]);
      CITY_PAIRS.push([kw.citiesAr[i], R.citiesAr[i] || kw.citiesAr[i]]);
    }
    /* "Kuwait City" AR variant jo alag likha hai */
    CITY_PAIRS.push(['مدينة الكويت', R.citiesAr[0]]);
  })();

  function swapStr(s) {
    if (!s) { return s; }
    var out = s;
    /* cities pehle (warna "Kuwait City" → "Saudi Arabia City" ban jata) */
    for (var i = 0; i < CITY_PAIRS.length; i++) {
      if (CITY_PAIRS[i][0] !== CITY_PAIRS[i][1]) {
        out = out.split(CITY_PAIRS[i][0]).join(CITY_PAIRS[i][1]);
      }
    }
    /* phrase exceptions */
    if (CC !== 'KW') {
      out = out.split('Fresh Kuwait dates').join('Fresh premium dates');
      out = out.split('تمور كويتية طازجة').join('تمور طازجة');
    }
    /* currency code + numbers */
    if (CC !== 'KW') {
      out = out.replace(/\bKWD\s*([0-9]+(?:\.[0-9]+)?)/g, function (m, n) {
        return R.iso + ' ' + fmt(parseFloat(n));
      });
      out = out.replace(/بالدينار/g, R.wordAr);
      out = out.replace(/\bKWD\b/g, R.iso);
    }
    /* country */
    out = out.split('Kuwait').join(R.nameEn);
    out = out.split('الكويت').join(R.nameAr);
    return out;
  }

  function applyDom() {
    /* 3d. region-only blocks — PEHLE (non-KW me Kuwaiti content DOM se nikal do,
       sirf chhupana kaafi nahi: tel:+965 / KW address source me pada rehta hai). */
    try {
      var hides = document.querySelectorAll('[data-geo-hide]');
      for (var k = hides.length - 1; k >= 0; k--) {
        var rule = hides[k].getAttribute('data-geo-hide') || '';
        var show = true;
        if (rule.indexOf('!KW') >= 0 && CC !== 'KW') { show = false; }
        if (!show) {
          if (hides[k].parentNode) { hides[k].parentNode.removeChild(hides[k]); }
        }
      }
    } catch (e) {}

    /* 3a. text nodes — SAARE text nodes, kyunki city naam ("Hawalli", "Salmiya")
       me country/currency ka koi shabd nahi hota (pehle sirf KWD/Kuwait wale
       nodes process hote the → baaki cities reh jati thi). */
    try {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var nodes = [], n;
      while ((n = walker.nextNode())) { nodes.push(n); }
      for (var i = 0; i < nodes.length; i++) {
        var v = nodes[i].nodeValue;
        if (!v || v.length > 3000) { continue; }
        var nv = swapStr(v);
        if (nv !== v) { nodes[i].nodeValue = nv; }
      }
    } catch (e) {}

    /* 3b. data-ar attributes (page ka AR switcher inse padhta hai) */
    try {
      var els = document.querySelectorAll('[data-ar]');
      for (var j = 0; j < els.length; j++) {
        var a = els[j].getAttribute('data-ar');
        if (!a) { continue; }
        var na = swapStr(a);
        if (na !== a) { els[j].setAttribute('data-ar', na); }
      }
    } catch (e) {}

    /* 3c. title + meta */
    try {
      document.title = swapStr(document.title);
      var md = document.querySelector('meta[name="description"]');
      if (md && md.getAttribute('content')) {
        md.setAttribute('content', swapStr(md.getAttribute('content')));
      }
      var og = document.querySelector('meta[property="og:description"]');
      if (og && og.getAttribute('content')) {
        og.setAttribute('content', swapStr(og.getAttribute('content')));
      }
      var ogt = document.querySelector('meta[property="og:title"]');
      if (ogt && ogt.getAttribute('content')) {
        ogt.setAttribute('content', swapStr(ogt.getAttribute('content')));
      }
    } catch (e) {}

    /* (region-only blocks upar 3d me handle ho chuke hain) */

    /* 3f. PER-CARD REAL PRICE (data-pr).
       Card pe data-pr='{"kw":{"n":1.5,"o":7.663,"p":80},"sa":{"n":..,"o":..,"p":..}}'
       ho to us region ka **asli LuLu price** lagta hai (conversion se behtar).
       Jis region ka data nahi, wahan conversion (3a) hi chalta rehta hai.
       Text-walk ke BAAD chalta hai taaki real price converted value ko overwrite kare. */
    try {
      var cards = document.querySelectorAll('[data-card]');
      for (var ci = 0; ci < cards.length; ci++) {
        var card = cards[ci];
        var raw = card.getAttribute('data-pr');
        if (!raw) { continue; }
        var map = null;
        try { map = JSON.parse(raw); } catch (e) { continue; }
        var v = map[CC.toLowerCase()] || map[CC] || null;
        if (!v || v.n === null || v.n === undefined) { continue; }
        var nEl = card.querySelector('[data-price]');
        var oEl = card.querySelector('[data-price-old]');
        var bEl = card.querySelector('[data-off]');
        var num = window.__LULU_NUM;
        if (nEl) { nEl.textContent = R.iso + ' ' + num(v.n); }
        if (oEl && v.o !== null && v.o !== undefined) { oEl.textContent = R.iso + ' ' + num(v.o); }
        if (bEl && v.p !== null && v.p !== undefined) { bEl.textContent = '-' + v.p + '%'; }
      }
    } catch (e) {}

    /* 3e. html attribute + price reveal */
    try {
      document.documentElement.setAttribute('data-geo', CC);
      var st = document.getElementById('__lulu_geo_css');
      if (st && st.parentNode) { st.parentNode.removeChild(st); }
    } catch (e) {}
  }

  /* ── 4. IP CONFIRM (background) ─────────────────────────────────────── */
  function ipConfirm() {
    if (forced) { return; }
    var sources = [
      { u: 'https://ipwho.is/', pick: function (d) { return d.country_code; } },
      { u: 'https://api.country.is/', pick: function (d) { return d.country; } },
      { u: 'https://ipapi.co/json/', pick: function (d) { return d.country_code; } }
    ];
    var idx = 0;
    function tryNext() {
      if (idx >= sources.length) { return; }
      var s = sources[idx++];
      try {
        var x = new XMLHttpRequest();
        x.open('GET', s.u, true);
        x.timeout = 4000;
        x.onload = function () {
          try {
            var d = JSON.parse(x.responseText);
            if (d && (d.success === false || d.error)) { tryNext(); return; }
            var cc = norm(s.pick(d));
            if (!cc) { tryNext(); return; }
            cacheWrite(cc);
            if (cc !== CC) {
              /* VPN/edge case — ek baar reload, phir cache hit (loop nahi) */
              location.reload();
            }
          } catch (e) { tryNext(); }
        };
        x.onerror = tryNext;
        x.ontimeout = tryNext;
        x.send();
      } catch (e) { tryNext(); }
    }
    try { tryNext(); } catch (e) {}
  }

  /* ── 5. GO ──────────────────────────────────────────────────────────── */
  /* Non-KW visitor ko KWD price ka flash na dikhe — prices chhupa do jab tak
     apply na ho jaye. Failsafe: 2.5s baad khud hat jata hai. */
  if (CC !== 'KW') {
    try {
      var st = document.createElement('style');
      st.id = '__lulu_geo_css';
      st.textContent = '[data-price]{visibility:hidden}';
      (document.head || document.documentElement).appendChild(st);
      setTimeout(function () {
        var e = document.getElementById('__lulu_geo_css');
        if (e && e.parentNode) { e.parentNode.removeChild(e); }
      }, 2500);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDom);
  } else {
    applyDom();
  }
  /* baad me app jo bhi render kare (catalogue re-render) — dobara apply */
  setTimeout(applyDom, 900);
  setTimeout(applyDom, 2200);
  ipConfirm();
})();
