// ════════════════════════════════════════════════════════════════════
// 📅 datepicker.js — ปฏิทินเลือกวันที่แบบเดียวกันทั้งเว็บ (ธีมเข้ม-ทอง)
// วิธีทำงาน: "ครอบทับ" <input type="date"> ทุกช่องอัตโนมัติ
//   - ช่องเดิมยังอยู่ในหน้า (ซ่อนไว้) → โค้ดเดิมที่อ่าน/เขียน .value ยังใช้ได้ 100% ไม่ต้องแก้อะไร
//   - เลือกวันในปฏิทิน → เขียน .value เป็น YYYY-MM-DD แล้วยิง event input/change → onchange เดิมทำงานตามปกติ
//   - ช่องที่โผล่มาทีหลัง (หน้าที่โหลดแบบ dynamic, popup) ก็ถูกครอบเองด้วย MutationObserver
// ════════════════════════════════════════════════════════════════════
(function () {
    if (window.__k36DatePickerInstalled) return;
    window.__k36DatePickerInstalled = true;

    const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const TH_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const TH_DAYS = ['อา','จ','อ','พ','พฤ','ศ','ส'];

    // ── CSS (ฉีดครั้งเดียว) ──
    const css = `
    .k36dp-field{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;position:relative;}
    .k36dp-field.k36dp-disabled{opacity:.5;cursor:not-allowed;}
    .k36dp-field .k36dp-ico{font-family:'Material Icons';font-size:16px;line-height:1;color:#E8C15A;flex-shrink:0;}
    .k36dp-field .k36dp-txt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .k36dp-field .k36dp-txt.k36dp-empty{opacity:.45;}
    .k36dp-field:hover{border-color:rgba(232,193,90,.6)!important;}
    .k36dp-pop{position:fixed;z-index:200000;width:272px;background:#0f1728;border:1px solid rgba(232,193,90,.35);border-radius:14px;
        box-shadow:0 24px 60px -12px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.03) inset;padding:12px;color:#e2e8f0;
        font-family:inherit;animation:k36dpIn .14s ease;}
    @keyframes k36dpIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
    .k36dp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
    .k36dp-title{font-weight:800;font-size:13.5px;color:#f5e3ae;letter-spacing:.2px;}
    .k36dp-nav{display:flex;gap:4px;}
    .k36dp-nav button{width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);
        color:#cbd5e1;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:'Material Icons';font-size:18px;transition:all .12s;}
    .k36dp-nav button:hover{background:rgba(232,193,90,.15);border-color:rgba(232,193,90,.5);color:#E8C15A;}
    .k36dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
    .k36dp-dow{text-align:center;font-size:10px;font-weight:800;color:#64748b;padding:4px 0 6px;letter-spacing:.3px;}
    .k36dp-day{height:32px;border-radius:9px;border:1px solid transparent;background:transparent;color:#cbd5e1;font-size:12.5px;font-weight:600;
        cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .1s;font-family:inherit;}
    .k36dp-day:hover{background:rgba(232,193,90,.14);color:#fff;}
    .k36dp-day.k36dp-other{color:#475569;}
    .k36dp-day.k36dp-today{border-color:rgba(232,193,90,.6);color:#E8C15A;}
    .k36dp-day.k36dp-sel{background:#E8C15A;color:#101828;font-weight:900;box-shadow:0 4px 14px rgba(232,193,90,.4);}
    .k36dp-day.k36dp-sel:hover{background:#f0cf6f;color:#101828;}
    .k36dp-foot{display:flex;justify-content:space-between;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);}
    .k36dp-foot button{flex:1;padding:7px 0;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.04);color:#cbd5e1;transition:all .12s;font-family:inherit;}
    .k36dp-foot button:hover{background:rgba(255,255,255,.09);color:#fff;}
    .k36dp-foot button.k36dp-today-btn{border-color:rgba(232,193,90,.45);color:#E8C15A;}
    .k36dp-foot button.k36dp-today-btn:hover{background:rgba(232,193,90,.15);}
    `;
    const st = document.createElement('style'); st.id = 'k36dp-style'; st.textContent = css; document.head.appendChild(st);

    // ── helpers ──
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
    const fmtLabel = s => { const d = parseISO(s); return d ? `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}` : ''; };

    let openPop = null, openField = null;

    function closePop() {
        if (openPop) { openPop.remove(); openPop = null; openField = null; }
    }

    function setValue(input, iso) {
        if (input.value === iso) { updateLabel(input); return; }
        input.value = iso;
        updateLabel(input);
        // ให้ onchange / oninput เดิมทำงานเหมือนผู้ใช้เลือกในช่องจริง
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function updateLabel(input) {
        const f = input.__k36dpField; if (!f) return;
        const txt = f.querySelector('.k36dp-txt');
        const label = fmtLabel(input.value);
        txt.textContent = label || (input.getAttribute('placeholder') || 'เลือกวันที่');
        txt.classList.toggle('k36dp-empty', !label);
        f.classList.toggle('k36dp-disabled', !!(input.disabled || input.readOnly));
    }

    function buildPop(input, field) {
        closePop();
        const sel = parseISO(input.value);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let view = new Date((sel || today).getFullYear(), (sel || today).getMonth(), 1);

        const pop = document.createElement('div'); pop.className = 'k36dp-pop';
        const render = () => {
            const y = view.getFullYear(), m = view.getMonth();
            const first = new Date(y, m, 1), startDow = first.getDay();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const prevDays = new Date(y, m, 0).getDate();
            let cells = '';
            for (let i = 0; i < 42; i++) {
                let d, other = false;
                if (i < startDow) { d = new Date(y, m - 1, prevDays - startDow + i + 1); other = true; }
                else if (i - startDow < daysInMonth) { d = new Date(y, m, i - startDow + 1); }
                else { d = new Date(y, m + 1, i - startDow - daysInMonth + 1); other = true; }
                const iso = toISO(d);
                const cls = ['k36dp-day', other ? 'k36dp-other' : '', d.getTime() === today.getTime() ? 'k36dp-today' : '', (sel && iso === toISO(sel)) ? 'k36dp-sel' : ''].filter(Boolean).join(' ');
                cells += `<button type="button" class="${cls}" data-iso="${iso}">${d.getDate()}</button>`;
            }
            pop.innerHTML = `
                <div class="k36dp-head">
                    <div class="k36dp-title">${TH_MONTHS[m]} ${y + 543}</div>
                    <div class="k36dp-nav">
                        <button type="button" data-nav="-1" title="เดือนก่อน">chevron_left</button>
                        <button type="button" data-nav="1" title="เดือนถัดไป">chevron_right</button>
                    </div>
                </div>
                <div class="k36dp-grid">${TH_DAYS.map(d => `<div class="k36dp-dow">${d}</div>`).join('')}${cells}</div>
                <div class="k36dp-foot">
                    <button type="button" data-act="clear">ล้าง</button>
                    <button type="button" class="k36dp-today-btn" data-act="today">วันนี้</button>
                </div>`;
        };
        render();
        pop.addEventListener('click', e => {
            const nav = e.target.closest('[data-nav]'); if (nav) { view.setMonth(view.getMonth() + (+nav.dataset.nav)); render(); return; }
            const day = e.target.closest('[data-iso]'); if (day) { setValue(input, day.dataset.iso); closePop(); return; }
            const act = e.target.closest('[data-act]'); if (act) {
                if (act.dataset.act === 'today') setValue(input, toISO(today));
                else setValue(input, '');
                closePop(); return;
            }
        });
        document.body.appendChild(pop);
        openPop = pop; openField = field;
        position();
        // เปิดแล้วเลื่อนหน้าให้ตำแหน่งตามไปด้วย
    }

    function position() {
        if (!openPop || !openField) return;
        const r = openField.getBoundingClientRect();
        const W = 272, H = openPop.offsetHeight || 320;
        let left = Math.min(r.left, window.innerWidth - W - 8); if (left < 8) left = 8;
        let top = r.bottom + 6;
        if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6);
        openPop.style.left = left + 'px'; openPop.style.top = top + 'px';
    }

    function enhance(input) {
        if (input.__k36dpField || input.dataset.k36dpSkip !== undefined) return;
        if (!input.parentNode) return;
        const field = document.createElement('div');
        // ใช้ class เดิมของช่อง → ขนาด/ขอบ/สีพื้นตรงกับดีไซน์แต่ละหน้าอัตโนมัติ
        field.className = (input.className || '') + ' k36dp-field';
        field.setAttribute('tabindex', '0');
        field.innerHTML = `<span class="k36dp-ico">calendar_month</span><span class="k36dp-txt"></span>`;
        // ซ่อนช่องเดิมแต่ยังอยู่ใน DOM (โค้ดเดิมยังอ่าน/เขียน .value ได้)
        input.style.cssText += ';position:absolute!important;opacity:0!important;width:0!important;height:0!important;padding:0!important;margin:0!important;border:0!important;pointer-events:none!important;';
        input.setAttribute('tabindex', '-1');
        input.parentNode.insertBefore(field, input.nextSibling);
        input.__k36dpField = field;
        const open = () => { if (input.disabled || input.readOnly) return; if (openField === field) { closePop(); return; } buildPop(input, field); };
        field.addEventListener('click', open);
        field.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        // ค่าถูกเปลี่ยนจากโค้ด/ผู้ใช้ → อัปเดตป้าย
        input.addEventListener('change', () => updateLabel(input));
        input.addEventListener('input', () => updateLabel(input));
        updateLabel(input);
    }

    function scan(root) {
        (root.querySelectorAll ? root.querySelectorAll('input[type="date"]') : []).forEach(enhance);
        if (root.matches && root.matches('input[type="date"]')) enhance(root);
    }

    // ปิดเมื่อคลิกข้างนอก / กด Esc / ย่อขยายจอ
    document.addEventListener('mousedown', e => { if (openPop && !openPop.contains(e.target) && !(openField && openField.contains(e.target))) closePop(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
    window.addEventListener('resize', closePop);
    window.addEventListener('scroll', position, true);

    // ครอบช่องที่มีอยู่แล้ว + ช่องที่โผล่มาทีหลัง (หน้าโหลด dynamic, popup)
    const start = () => {
        scan(document);
        new MutationObserver(muts => {
            muts.forEach(mu => mu.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); }));
        }).observe(document.body, { childList: true, subtree: true });
        // โค้ดเดิมหลายจุดเซ็ต .value ตรงๆ โดยไม่ยิง event → เช็คให้ป้ายตรงกับค่าเป็นระยะ (เบามาก)
        setInterval(() => document.querySelectorAll('input[type="date"]').forEach(i => { if (i.__k36dpField) updateLabel(i); }), 500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
