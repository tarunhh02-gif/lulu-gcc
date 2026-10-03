/* LuLu KW Hyper Deals — panel tracking (Kotha LP analytics).
   page_view + download_click bhejta hai. Non-blocking: kabhi page nahi todega. */
(function () {
  var LP_ID  = 'lp_f9cd1aa9ccd8';
  var HOST   = 'lulu-hyperdeals.web.app';
  var TRACK  = 'https://maakichu.com/lp/track';

  function cookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }

  function param(name) {
    try { return new URLSearchParams(location.search).get(name) || ''; }
    catch (e) { return ''; }
  }

  function fbc() {
    var c = cookie('_fbc');
    if (c) { return c; }
    var cl = param('fbclid');
    return cl ? ('fb.1.' + Date.now() + '.' + cl) : '';
  }

  function send(payload) {
    payload.lp_id  = LP_ID;
    payload.domain = HOST;
    try {
      var body = JSON.stringify(payload);
      /* text/plain => CORS preflight nahi (server force=True se parse karta hai) */
      if (navigator.sendBeacon && navigator.sendBeacon(TRACK, new Blob([body], { type: 'text/plain' }))) {
        return;
      }
      fetch(TRACK, {
        method: 'POST',
        body: body,
        keepalive: true,
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) { /* tracking kabhi page ko na tode */ }
  }

  function base() {
    return {
      utm_source:   param('utm_source')   || '',
      utm_medium:   param('utm_medium')   || '',
      utm_campaign: param('utm_campaign') || '',
      fbc: fbc(),
      fbp: cookie('_fbp')
    };
  }

  /* 1) page view */
  var pv = base();
  pv.event = 'page_view';
  send(pv);

  /* 2) APK download click — CTA = <a data-cta>, href = LF_CONFIG.ctaUrl */
  document.addEventListener('click', function (ev) {
    var el = ev.target, a = null;
    while (el && el !== document) {
      if (el.tagName === 'A') {
        var href = el.getAttribute('href') || '';
        if (el.hasAttribute('data-cta') || /\.apk(\?|$)/i.test(href)) { a = el; break; }
      }
      el = el.parentNode;
    }
    if (!a) { return; }
    var d1 = base(); d1.event = 'download_click'; send(d1);
    var d2 = base(); d2.event = 'download';       send(d2);
  }, true);
})();
