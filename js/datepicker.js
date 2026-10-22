(function() {
  if (window.__k36DatePickerInstalled) return;
  window.__k36DatePickerInstalled = true;
  const TH_MONTHS = [ 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม' ];
  const TH_MONTHS_SHORT = [ 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.' ];
  const TH_DAYS = [ 'อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส' ];
  const css = `\n    .k36dp-field{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;position:relative;}\n    .k36dp-field.k36dp-disabled{opacity:.5;cursor:not-allowed;}\n    .k36dp-field .k36dp-ico{font-family:'Material Icons';font-size:16px;line-height:1;color:var(--k-gold-tx);flex-shrink:0;}\n    .k36dp-field .k36dp-txt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n    .k36dp-field .k36dp-txt.k36dp-empty{opacity:.45;}\n    .k36dp-field:hover{border-color:rgba(232,193,90,.6)!important;}\n    .k36dp-pop{position:fixed;z-index:200000;width:272px;background:var(--k-panel2);border:1px solid rgba(232,193,90,.35);border-radius:14px;\n        box-shadow:0 24px 60px -12px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.03) inset;padding:12px;color:var(--k-tx);\n        font-family:inherit;animation:k36dpIn .14s ease;}\n    @keyframes k36dpIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}\n    .k36dp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}\n    .k36dp-title{font-weight:800;font-size:13.5px;color:var(--k-gold-tx);letter-spacing:.2px;}\n    .k36dp-nav{display:flex;gap:4px;}\n    .k36dp-nav button{width:28px;height:28px;border-radius:8px;border:1px solid color-mix(in srgb,var(--k-tx-strong) 8.0%,transparent);background:color-mix(in srgb,var(--k-tx-strong) 4.0%,transparent);\n        color:var(--k-tx2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:'Material Icons';font-size:18px;transition:all .12s;}\n    .k36dp-nav button:hover{background:rgba(232,193,90,.15);border-color:rgba(232,193,90,.5);color:var(--k-gold-tx);}\n    .k36dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}\n    .k36dp-dow{text-align:center;font-size:10px;font-weight:800;color:var(--k-mute);padding:4px 0 6px;letter-spacing:.3px;}\n    .k36dp-day{height:32px;border-radius:9px;border:1px solid transparent;background:transparent;color:var(--k-tx2);font-size:12.5px;font-weight:600;\n        cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .1s;font-family:inherit;}\n    .k36dp-day:hover{background:rgba(232,193,90,.14);color:var(--k-tx-strong);}\n    .k36dp-day.k36dp-other{color:var(--k-mute3);}\n    .k36dp-day.k36dp-today{border-color:rgba(232,193,90,.6);color:var(--k-gold-tx);}\n    .k36dp-day.k36dp-sel{background:#E8C15A;color:#101828;font-weight:900;box-shadow:0 4px 14px rgba(232,193,90,.4);}\n    .k36dp-day.k36dp-sel:hover{background:#f0cf6f;color:#101828;}\n    .k36dp-foot{display:flex;justify-content:space-between;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(--k-tx-strong) 7.0%,transparent);}\n    .k36dp-foot button{flex:1;padding:7px 0;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;border:1px solid color-mix(in srgb,var(--k-tx-strong) 8.0%,transparent);\n        background:color-mix(in srgb,var(--k-tx-strong) 4.0%,transparent);color:var(--k-tx2);transition:all .12s;font-family:inherit;}\n    .k36dp-foot button:hover{background:color-mix(in srgb,var(--k-tx-strong) 9.0%,transparent);color:var(--k-tx-strong);}\n    .k36dp-foot button.k36dp-today-btn{border-color:rgba(232,193,90,.45);color:var(--k-gold-tx);}\n    .k36dp-foot button.k36dp-today-btn:hover{background:rgba(232,193,90,.15);}\n    `;
  const st = document.createElement('style');
  st.id = 'k36dp-style';
  st.textContent = css;
  document.head.appendChild(st);
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const fmtLabel = s => {
    const d = parseISO(s);
    return d ? `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}` : '';
  };
  let openPop = null, openField = null;
  function closePop() {
    if (openPop) {
      openPop.remove();
      openPop = null;
      openField = null;
    }
  }
  function setValue(input, iso) {
    if (input.value === iso) {
      updateLabel(input);
      return;
    }
    input.value = iso;
    updateLabel(input);
    input.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    input.dispatchEvent(new Event('change', {
      bubbles: true
    }));
  }
  function updateLabel(input) {
    const f = input.__k36dpField;
    if (!f) return;
    const txt = f.querySelector('.k36dp-txt');
    const label = fmtLabel(input.value);
    txt.textContent = label || (input.getAttribute('placeholder') || 'เลือกวันที่');
    txt.classList.toggle('k36dp-empty', !label);
    f.classList.toggle('k36dp-disabled', !!(input.disabled || input.readOnly));
  }
  function buildPop(input, field) {
    closePop();
    const sel = parseISO(input.value);
    const today = new Date;
    today.setHours(0, 0, 0, 0);
    let view = new Date((sel || today).getFullYear(), (sel || today).getMonth(), 1);
    const pop = document.createElement('div');
    pop.className = 'k36dp-pop';
    const render = () => {
      const y = view.getFullYear(), m = view.getMonth();
      const first = new Date(y, m, 1), startDow = first.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const prevDays = new Date(y, m, 0).getDate();
      let cells = '';
      for (let i = 0; i < 42; i++) {
        let d, other = false;
        if (i < startDow) {
          d = new Date(y, m - 1, prevDays - startDow + i + 1);
          other = true;
        } else if (i - startDow < daysInMonth) {
          d = new Date(y, m, i - startDow + 1);
        } else {
          d = new Date(y, m + 1, i - startDow - daysInMonth + 1);
          other = true;
        }
        const iso = toISO(d);
        const cls = [ 'k36dp-day', other ? 'k36dp-other' : '', d.getTime() === today.getTime() ? 'k36dp-today' : '', sel && iso === toISO(sel) ? 'k36dp-sel' : '' ].filter(Boolean).join(' ');
        cells += `<button type="button" class="${cls}" data-iso="${iso}">${d.getDate()}</button>`;
      }
      pop.innerHTML = `\n                <div class="k36dp-head">\n                    <div class="k36dp-title">${TH_MONTHS[m]} ${y + 543}</div>\n                    <div class="k36dp-nav">\n                        <button type="button" data-nav="-1" title="เดือนก่อน">chevron_left</button>\n                        <button type="button" data-nav="1" title="เดือนถัดไป">chevron_right</button>\n                    </div>\n                </div>\n                <div class="k36dp-grid">${TH_DAYS.map((d => `<div class="k36dp-dow">${d}</div>`)).join('')}${cells}</div>\n                <div class="k36dp-foot">\n                    <button type="button" data-act="clear">ล้าง</button>\n                    <button type="button" class="k36dp-today-btn" data-act="today">วันนี้</button>\n                </div>`;
    };
    render();
    pop.addEventListener('click', (e => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        view.setMonth(view.getMonth() + +nav.dataset.nav);
        render();
        return;
      }
      const day = e.target.closest('[data-iso]');
      if (day) {
        setValue(input, day.dataset.iso);
        closePop();
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'today') setValue(input, toISO(today)); else setValue(input, '');
        closePop();
        return;
      }
    }));
    document.body.appendChild(pop);
    openPop = pop;
    openField = field;
    position();
  }
  function position() {
    if (!openPop || !openField) return;
    const r = openField.getBoundingClientRect();
    const W = 272, H = openPop.offsetHeight || 320;
    let left = Math.min(r.left, window.innerWidth - W - 8);
    if (left < 8) left = 8;
    let top = r.bottom + 6;
    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6);
    openPop.style.left = left + 'px';
    openPop.style.top = top + 'px';
  }
  function bindField(input, field) {
    input.__k36dpField = field;
    if (field.__k36dpBound) return;
    field.__k36dpBound = true;
    const open = () => {
      if (input.disabled || input.readOnly) return;
      if (openField === field) {
        closePop();
        return;
      }
      buildPop(input, field);
    };
    field.addEventListener('click', open);
    field.addEventListener('keydown', (e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    }));
    input.addEventListener('change', (() => updateLabel(input)));
    input.addEventListener('input', (() => updateLabel(input)));
  }
  function enhance(input) {
    if (input.dataset.k36dpSkip !== undefined) return;
    if (!input.parentNode) return;
    let existing = null, sib = input.nextSibling;
    while (sib) {
      const next = sib.nextSibling;
      if (sib.nodeType === 1 && sib.classList && sib.classList.contains('k36dp-field')) {
        if (!existing) existing = sib; else sib.remove();
      } else if (sib.nodeType === 1 || sib.nodeType === 3 && sib.textContent.trim()) break;
      sib = next;
    }
    if (existing) {
      if (input.__k36dpField === existing && existing.__k36dpBound) {
        updateLabel(input);
        return;
      }
      bindField(input, existing);
      updateLabel(input);
      return;
    }
    if (input.__k36dpField && input.__k36dpField.isConnected) {
      updateLabel(input);
      return;
    }
    const field = document.createElement('div');
    field.className = (input.className || '') + ' k36dp-field';
    field.setAttribute('tabindex', '0');
    field.innerHTML = `<span class="k36dp-ico">calendar_month</span><span class="k36dp-txt"></span>`;
    input.style.cssText += ';position:absolute!important;opacity:0!important;width:0!important;height:0!important;padding:0!important;margin:0!important;border:0!important;pointer-events:none!important;';
    input.setAttribute('tabindex', '-1');
    input.dataset.k36dp = '1';
    input.parentNode.insertBefore(field, input.nextSibling);
    bindField(input, field);
    updateLabel(input);
  }
  function scan(root) {
    (root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : []).forEach(enhance);
    if (root.matches && root.matches('input[type="date"]')) enhance(root);
  }
  document.addEventListener('mousedown', (e => {
    if (openPop && !openPop.contains(e.target) && !(openField && openField.contains(e.target))) closePop();
  }));
  document.addEventListener('keydown', (e => {
    if (e.key === 'Escape') closePop();
  }));
  window.addEventListener('resize', closePop);
  window.addEventListener('scroll', position, true);
  const start = () => {
    scan(document);
    new MutationObserver((muts => {
      muts.forEach((mu => mu.addedNodes.forEach((n => {
        if (n.nodeType === 1) scan(n);
      }))));
    })).observe(document.body, {
      childList: true,
      subtree: true
    });
    setInterval((() => scan(document)), 500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
