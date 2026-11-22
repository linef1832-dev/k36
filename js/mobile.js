(function() {
  const MQ = window.matchMedia('(max-width: 767px)');
  const isMobile = () => MQ.matches;
  window.isMobileView = isMobile;

  function nav() {
    return document.getElementById('sidebarNav');
  }

  function build() {
    if (document.getElementById('mbTopbar')) return;
    const bar = document.createElement('div');
    bar.id = 'mbTopbar';
    bar.innerHTML = '<button type="button" id="mbMenuBtn" aria-label="เมนู"><span class="material-icons">menu</span></button><div id="mbTitle">K36</div><div id="mbTopRight"></div>';
    document.body.appendChild(bar);
    const bd = document.createElement('div');
    bd.id = 'mbBackdrop';
    document.body.appendChild(bd);
    bar.querySelector('#mbMenuBtn').addEventListener('click', (function() {
      window.mbToggleMenu();
    }));
    bd.addEventListener('click', (function() {
      window.mbToggleMenu(false);
    }));
  }

  window.mbToggleMenu = function(force) {
    const n = nav();
    if (!n) return;
    const open = typeof force === 'boolean' ? force : !document.body.classList.contains('mb-menu-open');
    document.body.classList.toggle('mb-menu-open', open && isMobile());
  };

  function setTitle() {
    const t = document.getElementById('mbTitle');
    if (!t) return;
    const act = document.querySelector('#menu-list .nm-menu-title.active');
    let txt = '';
    if (act) {
      const c = act.cloneNode(true);
      c.querySelectorAll('.material-icons, .material-icons-outlined, .material-symbols-outlined, [class*="badge"], [id*="Badge"], [id*="badge"]').forEach((function(e) {
        e.remove();
      }));
      txt = (c.textContent || '').replace(/\s+/g, ' ').trim();
    }
    t.textContent = txt || 'K36';
  }

  function sync() {
    const n = nav();
    const layout = document.getElementById('main-layout');
    const logged = !!(layout && !layout.classList.contains('hidden'));
    document.body.classList.toggle('mb-on', isMobile() && logged);
    if (!n) return;
    if (isMobile()) {
      if (n.classList.contains('sidebar-mini') || n.classList.contains('sb-narrow')) {
        n.classList.add('sb-instant');
        n.classList.remove('sidebar-mini', 'sb-narrow', 'sb-anim');
        n.dataset.sbAnim = '';
        n.dataset.mbWasMini = '1';
        void n.offsetWidth;
        n.classList.remove('sb-instant');
      }
    } else {
      document.body.classList.remove('mb-menu-open');
      if (n.dataset.mbWasMini === '1') {
        delete n.dataset.mbWasMini;
        let want = false;
        try {
          want = localStorage.getItem('sidebarMini') === '1';
        } catch (e) {}
        if (want && typeof window._sbSetMini === 'function') window._sbSetMini(true, true);
      }
    }
    setTitle();
  }

  let _fitT = null;
  function fitTables() {
    if (!isMobile()) return;
    const app = document.getElementById('app-content');
    if (!app) return;
    app.querySelectorAll('table:not([data-mb-fit])').forEach((function(t) {
      t.setAttribute('data-mb-fit', '1');
      let p = t.parentElement, has = false;
      while (p && p !== app) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') {
          has = true;
          break;
        }
        p = p.parentElement;
      }
      if (!has && t.parentElement && t.parentElement !== app) t.parentElement.classList.add('mb-scroll-x');
    }));
  }
  function queueFit() {
    clearTimeout(_fitT);
    _fitT = setTimeout(fitTables, 250);
  }

  function init() {
    build();
    sync();
    const appEl = document.getElementById('app-content');
    if (appEl) new MutationObserver(queueFit).observe(appEl, {
      childList: true,
      subtree: true
    });
    if (MQ.addEventListener) MQ.addEventListener('change', queueFit);
    queueFit();
    const layout = document.getElementById('main-layout');
    if (layout) new MutationObserver(sync).observe(layout, {
      attributes: true,
      attributeFilter: [ 'class' ]
    });
    const n = nav();
    if (n) {
      new MutationObserver((function() {
        if (isMobile() && (n.classList.contains('sidebar-mini') || n.classList.contains('sb-narrow'))) sync();
      })).observe(n, {
        attributes: true,
        attributeFilter: [ 'class' ]
      });
      n.addEventListener('click', (function(e) {
        if (!isMobile()) return;
        const b = e.target.closest('button, a');
        if (!b || b.closest('.sidebar-collapse-row')) return;
        if (b.classList.contains('menu-section-header')) return;
        setTimeout((function() {
          window.mbToggleMenu(false);
          setTitle();
        }), 60);
      }));
    }
    const ml = document.getElementById('menu-list');
    if (ml) new MutationObserver(setTitle).observe(ml, {
      attributes: true,
      attributeFilter: [ 'class' ],
      subtree: true
    });
    if (MQ.addEventListener) MQ.addEventListener('change', sync); else if (MQ.addListener) MQ.addListener(sync);
    document.addEventListener('keydown', (function(e) {
      if (e.key === 'Escape') window.mbToggleMenu(false);
    }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
