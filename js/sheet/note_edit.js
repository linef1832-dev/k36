// ════════════════════════════════════════════════════════════════════
// 📦 sheet/note_edit.js — ส่วนที่ 3/4 ของตารางงานรวม (ชีต) (แยกจาก sheet.js เดิม 1,616 บรรทัด)
// เนื้อหา: โหมดแก้ไขหน้าข้อความทั้งหมด (เลือกช่อง, ผสาน, เรียง, ค้นแทน, วาง Excel)
// ⚠️ ลำดับโหลด: sheet/core → sheet/note_view → sheet/note_edit → sheet/admin (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 🛠️ แก้ไขในหน้า — เลือกช่องแบบลากคลุม, ผสานทั้งแนวนอน/แนวตั้ง, เส้นขอบร่วม, ขนาดตัวอักษร
// ==========================================
window._noteEdit = null; window._noteUndo = []; window._noteRedo = []; window._noteSel = null; window._noteEditing = false; window._noteDrag = null;
const _nClone = (n) => JSON.parse(JSON.stringify(n));
// ต้นทางของช่อง (r,x) — ถ้าช่องถูกผสานทับ คืนช่องที่ผสานมันอยู่
const _nAnchor = (note, r, x) => {
    const c = note.rows[r] && note.rows[r][x]; if (!c) return null;
    if (!c.h) return { r, x, c };
    for (let rr = r; rr >= 0; rr--) for (let xx = x; xx >= 0; xx--) { const a = note.rows[rr][xx]; if (a && !a.h && rr + (a.rs || 1) > r && xx + (a.cs || 1) > x) return { r: rr, x: xx, c: a }; }
    return null;
};
// ช่องต้นทางทั้งหมดในกรอบเลือก
const _nSelCells = () => {
    const sel = window._noteSel, note = window._noteEdit; if (!sel || !note) return [];
    const seen = new Set(), out = [];
    for (let r = sel.r1; r <= sel.r2; r++) for (let x = sel.x1; x <= sel.x2; x++) { const a = _nAnchor(note, r, x); if (!a) continue; const k = `${a.r}:${a.x}`; if (seen.has(k)) continue; seen.add(k); out.push({ r: a.r, x: a.x, c: a.c, x2: a.x + (a.c.cs || 1) - 1, r2: a.r + (a.c.rs || 1) - 1 }); }
    return out;
};
// ตั้งเส้นขอบแบบ "ขอบร่วม": ด้านนั้นของช่องนี้ + ด้านตรงข้ามของช่องข้างเคียง
const _nSetEdge = (note, o, side, on, color) => {
    const set = (cell, s) => { cell.bd = { ...(cell.bd || { t: true, b: true, l: true, r: true }), [s]: on }; if (color !== undefined && on) cell.bc = color; };
    set(o.c, side);
    const opp = { t: 'b', b: 't', l: 'r', r: 'l' }[side];
    const nbs = [];
    if (side === 't' && o.r > 0) for (let x = o.x; x <= o.x2; x++) nbs.push(_nAnchor(note, o.r - 1, x));
    if (side === 'b' && o.r2 < note.rows.length - 1) for (let x = o.x; x <= o.x2; x++) nbs.push(_nAnchor(note, o.r2 + 1, x));
    if (side === 'l' && o.x > 0) for (let r = o.r; r <= o.r2; r++) nbs.push(_nAnchor(note, r, o.x - 1));
    if (side === 'r' && o.x2 < note.rows[0].length - 1) for (let r = o.r; r <= o.r2; r++) nbs.push(_nAnchor(note, r, o.x2 + 1));
    const done = new Set(); nbs.forEach(a => {
        if (!a) return; const k = `${a.r}:${a.x}`; if (done.has(k)) return; done.add(k);
        // ช่องข้างเคียงที่ "ผสาน" ยาวเกินขอบที่เรากำลังตั้ง → ไม่ไปแตะมัน (ไม่งั้นเส้นจะลามไปตลอดความยาวของมัน)
        const ar2 = a.r + (a.c.rs || 1) - 1, ax2 = a.x + (a.c.cs || 1) - 1;
        if ((side === 'l' || side === 'r') && (a.r < o.r || ar2 > o.r2)) return;
        if ((side === 't' || side === 'b') && (a.x < o.x || ax2 > o.x2)) return;
        set(a.c, opp);
    });
};

window.noteEditStart = function() {
    if (!window._currentNote) return;
    window._noteEdit = _nClone(window.noteToV3(window._currentNote));
    if (window._noteEdit.rows.length === 0) { window._noteEdit.rows = [[_nCell(), _nCell(), _nCell()], [_nCell(), _nCell(), _nCell()]]; window._noteEdit.cols = [160, 200, 300]; }
    window._noteUndo = []; window._noteRedo = []; window._noteSel = null; window._noteEditing = true;
    document.getElementById('noteToolbar').classList.remove('hidden'); document.getElementById('noteToolbar').classList.add('flex');
    document.getElementById('btnNoteEdit').classList.add('hidden');
    document.getElementById('noteHint')?.classList.add('hidden');
    const srch = document.getElementById('noteSearch'); if (srch) { srch.value = ''; srch.disabled = true; }
    window.renderNoteEditor();
};
window.noteEditExit = function(rerender) {
    window._noteEditing = false; window._noteEdit = null; window._noteSel = null;
    const tb = document.getElementById('noteToolbar'); if (tb) { tb.classList.add('hidden'); tb.classList.remove('flex'); }
    const srch = document.getElementById('noteSearch'); if (srch) srch.disabled = false;
    document.getElementById('noteHint')?.classList.remove('hidden');
    // 👤 แก้หน้าข้อความได้: mgr (ชีตส่วนกลาง) หรือเจ้าของ (ชีตส่วนตัว)
    const _ns = (window.GLOBAL_SHEETS || []).find(s => String(s.id) === String(window._currentNoteSheetId));
    const canEdit = window.currentUser && (
        (_ns && _ns.owner)
            ? _ns.owner === window.sheetMe()
            : ['admin', 'manager'].includes(window.currentUser.role)
    );
    document.getElementById('btnNoteEdit')?.classList.toggle('hidden', !canEdit);
    if (rerender) window.renderNoteTable();
};
window.noteEditCancel = async function() {
    const ok = await Swal.fire({ icon: 'question', title: 'ยกเลิกการแก้ไข?', text: 'สิ่งที่แก้ไว้จะหายไป', showCancelButton: true, confirmButtonText: 'ยกเลิกการแก้ไข', cancelButtonText: 'แก้ต่อ', confirmButtonColor: '#ef4444' });
    if (ok.isConfirmed) window.noteEditExit(true);
};
window.noteEditSave = async function() {
    window._noteSyncText();
    const note = window._noteEdit; const id = window._currentNoteSheetId; if (!note || !id) return;
    // 👤 กันสิทธิ์ (กันเรียกตรงจาก console): ชีตส่วนตัวเซฟได้เฉพาะเจ้าของ / ส่วนกลางเฉพาะ mgr
    const _s = (window.GLOBAL_SHEETS || []).find(s => String(s.id) === String(id));
    if (_s && !window.sheetCanTouch(_s)) return Swal.fire('ไม่มีสิทธิ์', 'คุณแก้ไขได้เฉพาะชีตของตัวเองครับ', 'error');
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        window.clearSettingCache();
        const { error } = await appDB.from('settings').upsert([{ key: `sheet_note_${id}`, value: JSON.stringify(note) }]);
        if (error) throw error;
        window._noteCache[id] = note; window._currentNote = note;
        try { await appDB.from('system_logs').insert([{ action_type: 'แก้ไขชีท', performed_by: currentUser.username, target_details: `แก้ไขหน้าข้อความ #${id} (${note.rows.length} แถว)` }]); } catch (e) {}
        window.noteEditExit(true);
        Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1200, showConfirmButton: false });
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};
window._noteSyncText = function() {
    if (!window._noteEdit) return;
    document.querySelectorAll('#noteTableWrap td[data-r]').forEach(td => { const c = window._noteEdit.rows[+td.dataset.r] && window._noteEdit.rows[+td.dataset.r][+td.dataset.x]; if (c) { const d = td.querySelector('.nt-ebody'); c.t = (d || td).innerText.replace(/\u00a0/g, ' ').replace(/\n$/, ''); } });
};
const _nSnap = () => { window._noteSyncText(); window._noteUndo.push(_nClone(window._noteEdit)); if (window._noteUndo.length > 50) window._noteUndo.shift(); window._noteRedo = []; };

window.renderNoteEditor = function() {
    const wrap = document.getElementById('noteTableWrap'); const note = window._noteEdit; if (!wrap || !note) return;
    const cols = note.cols || []; const rowH = note.rowH || [];
    const colgroup = `<colgroup><col style="width:42px">${cols.map(w => `<col style="width:${Math.max(60, Math.round((w || 100) * 1.15))}px">`).join('')}</colgroup>`;
    const selSet = new Set(_nSelCells().map(o => `${o.r}:${o.x}`));
    const selCols = new Set(), selRows = new Set();
    if (window._noteSel) { for (let x = window._noteSel.x1; x <= window._noteSel.x2; x++) selCols.add(x); for (let r = window._noteSel.r1; r <= window._noteSel.r2; r++) selRows.add(r); }
    wrap.innerHTML = `
        <div class="bg-white rounded-lg shadow-inner inline-block select-none" style="min-width:100%">
        <table id="noteEditTable" class="border-collapse" style="font-family:'Sarabun',system-ui,sans-serif;table-layout:fixed;width:${42 + cols.reduce((a, w) => a + Math.max(60, Math.round((w || 100) * 1.15)), 0)}px">
            ${colgroup}
            <thead><tr><th class="${_nHdrCls} nt-stick-tl" onmousedown="noteSelectAll()" title="เลือกทั้งหมด"></th>${cols.map((_, x) => `<th class="${_nHdrCls} nt-stick-top relative cursor-pointer ${selCols.has(x) ? 'nt-hdr-sel' : ''}" onmousedown="noteSelectCol(event,${x})">${_nColName(x)}<div class="nt-col-rs" onmousedown="noteResizeStart(event,'col',${x})" title="ลากเพื่อปรับความกว้าง"></div></th>`).join('')}</tr></thead>
            <tbody>${note.rows.map((r, ri) => `<tr style="${rowH[ri] ? `height:${rowH[ri]}px` : ''}"><td class="${_nHdrCls} nt-stick-left relative cursor-pointer ${selRows.has(ri) ? 'nt-hdr-sel' : ''}" onmousedown="noteSelectRow(event,${ri})">${ri + 1}<div class="nt-row-rs" onmousedown="noteResizeStart(event,'row',${ri})" title="ลากเพื่อปรับความสูง"></div></td>${r.map((c, x) => c.h ? '' : `<td data-r="${ri}" data-x="${x}" colspan="${c.cs || 1}" rowspan="${c.rs || 1}"
                    onmousedown="noteCellDown(event,this)" onmouseenter="noteCellEnter(event,this)"
                    class="p-0 align-top ${selSet.has(`${ri}:${x}`) ? 'note-sel' : ''}"
                    style="${window._noteCellStyle(c, true)}${c.clip ? ';box-shadow:inset 0 -3px 0 #f59e0b' : ''}"><div class="nt-ebody whitespace-pre-wrap leading-snug outline-none ${c.b ? 'font-bold' : ''}" contenteditable="true" spellcheck="false" onfocus="noteCellFocus(this.parentElement)">${_nEsc(c.t)}</div></td>`).join('')}</tr>`).join('')}
            </tbody>
        </table></div>`;

    // 📏 [Auto-clamp] เหมือนโหมดดู: ช่องไหนพิมพ์ไว้ยาวมาก → เลื่อนดูในช่องตัวเอง ไม่ดันทั้งแถวสูง
    // ถ้าผู้ใช้ลากปรับความสูงแถวเองไว้สูงกว่าเกณฑ์ จะเคารพค่าที่ลากไว้ (โชว์ได้ถึงความสูงนั้น)
    const _clampEditCell = (d) => {
        const td = d.parentElement; if (!td || td.dataset.r === undefined) return;
        const maxH = Math.max(230, (note.rowH || [])[+td.dataset.r] || 0);
        if (d.scrollHeight > maxH + 30) { d.classList.add('nt-etall'); d.style.maxHeight = maxH + 'px'; }
    };
    requestAnimationFrame(() => wrap.querySelectorAll('.nt-ebody').forEach(_clampEditCell));
    // พิมพ์เพิ่มจนยาวเกินระหว่างแก้ → clamp ทันทีโดยไม่ต้องรอ render ใหม่
    wrap.oninput = (e) => { const d = e.target && e.target.closest && e.target.closest('.nt-ebody'); if (d && !d.classList.contains('nt-etall')) _clampEditCell(d); };
    // 📥 [Excel Paste] ก๊อปหลายช่องจาก Excel/Google Sheet มาวาง → กระจายลงหลายช่องให้อัตโนมัติ
    // เริ่มวางที่ช่องที่เลือกอยู่ ถ้าข้อมูลยาวเกินตาราง จะเพิ่มแถว/คอลัมน์ให้เอง
    wrap.onpaste = (e) => {
        const note = window._noteEdit; if (!note || !window._noteSel) return;
        const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
        if (!/\t|\n/.test(text.replace(/\r/g, '').replace(/\n$/, ''))) return;   // ข้อมูลช่องเดียว → วางแบบปกติ
        e.preventDefault();
        _nSnap();
        const grid = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
        const r0 = window._noteSel.r1, x0 = window._noteSel.x1;
        const needRows = r0 + grid.length;
        const needCols = x0 + Math.max(...grid.map(g => g.length));
        while (note.rows.length < needRows) { note.rows.push(Array.from({ length: note.rows[0].length }, () => _nCell())); if (note.rowH) note.rowH.push(undefined); }
        while (note.rows[0].length < needCols) { note.rows.forEach(row => row.push(_nCell())); note.cols.push(160); }
        grid.forEach((line, dr) => line.forEach((valTxt, dx) => { const c = note.rows[r0 + dr][x0 + dx]; if (!c.h) c.t = valTxt; }));
        window._noteSel = { r1: r0, r2: r0 + grid.length - 1, x1: x0, x2: x0 + Math.max(...grid.map(g => g.length)) - 1 };
        window.renderNoteEditor();
        _nToast(`วางข้อมูล ${grid.length} แถว เรียบร้อย`);
    };
    window._noteUpdateSelInfo();
    // แสดงขนาดตัวอักษรของช่องที่เลือกใน dropdown
    const fsSel = document.getElementById('noteFontSize'); const first = _nSelCells()[0];
    if (fsSel) fsSel.value = String((first && first.c.fs) || window.NOTE_DEF_FS);
};
window._noteUpdateSelInfo = function() {
    const info = document.getElementById('noteSelInfo'); const sel = window._noteSel; if (!info) return;
    if (!sel) { info.innerText = 'คลิกช่อง · ลากเมาส์คลุมหลายช่อง · Shift+คลิก ขยายการเลือก'; return; }
    const n = _nSelCells().length;
    info.innerText = n > 1 ? `เลือก ${n} ช่อง` : `แถว ${sel.r1 + 1} · คอลัมน์ ${sel.x1 + 1}`;
};
window._notePaintSel = function() {
    const selSet = new Set(_nSelCells().map(o => `${o.r}:${o.x}`));
    document.querySelectorAll('#noteTableWrap td[data-r]').forEach(td => td.classList.toggle('note-sel', selSet.has(`${td.dataset.r}:${td.dataset.x}`)));
    window._noteUpdateSelInfo();
    const fsSel = document.getElementById('noteFontSize'); const first = _nSelCells()[0];
    if (fsSel) fsSel.value = String((first && first.c.fs) || window.NOTE_DEF_FS);
};
const _tdRect = (td) => { const r = +td.dataset.r, x1 = +td.dataset.x; return { r, r2: r + (parseInt(td.getAttribute('rowspan')) || 1) - 1, x1, x2: x1 + (parseInt(td.getAttribute('colspan')) || 1) - 1 }; };
const _nExpandSel = (a, b) => ({ r1: Math.min(a.r, b.r), r2: Math.max(a.r2, b.r2), x1: Math.min(a.x1, b.x1), x2: Math.max(a.x2, b.x2) });
window.noteCellDown = function(e, td) {
    if (e.button !== 0) return;
    const t = _tdRect(td);
    if (e.shiftKey && window._noteSel) { e.preventDefault(); const s0 = window._noteSel; window._noteSel = _nExpandSel({ r: s0.r1, r2: s0.r2, x1: s0.x1, x2: s0.x2 }, t); window._notePaintSel(); return; }
    window._noteSel = { r1: t.r, r2: t.r2, x1: t.x1, x2: t.x2 };
    window._noteDrag = { start: t, td };
    window._notePaintSel();
    // 🖱️ คลิกโดนพื้นที่ว่างของช่อง (นอกกล่องข้อความ) → พาเคอร์เซอร์เข้าไปท้ายข้อความให้
    if (e.target === td) {
        const d = td.querySelector('.nt-ebody');
        if (d) {
            e.preventDefault(); d.focus();
            try { const rng = document.createRange(); rng.selectNodeContents(d); rng.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(rng); } catch (err) {}
        }
    }
};
window.noteCellEnter = function(e, td) {
    const d = window._noteDrag; if (!d || !(e.buttons & 1) || td === d.td) return;
    try { window.getSelection().removeAllRanges(); } catch (_) {}
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window._noteSel = _nExpandSel(d.start, _tdRect(td)); window._notePaintSel();
};
document.addEventListener('mouseup', () => { window._noteDrag = null; });
window.noteCellFocus = function(td) {
    const t = _tdRect(td); const s0 = window._noteSel;
    if (!s0 || t.r < s0.r1 || t.r > s0.r2 || t.x2 < s0.x1 || t.x1 > s0.x2) { window._noteSel = { r1: t.r, r2: t.r2, x1: t.x1, x2: t.x2 }; window._notePaintSel(); }
};
// 🎨 จานสีแบบ Google Sheet (ตัวอักษร / พื้น)
window.NOTE_PALETTE = {
    base: ['#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#efefef','#f3f3f3','#ffffff'],
    bright: ['#980000','#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff','#ff00ff'],
    shades: [
        ['#e6b8af','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#cfe2f3','#d9d2e9','#ead1dc'],
        ['#dd7e6b','#ea9999','#f9cb9c','#ffe599','#b6d7a8','#a2c4c9','#a4c2f4','#9fc5e8','#b4a7d6','#d5a6bd'],
        ['#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#6fa8dc','#8e7cc3','#c27ba0'],
        ['#a61c00','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#3d85c6','#674ea7','#a64d79'],
        ['#85200c','#990000','#b45f06','#bf9000','#38761d','#134f5c','#1155cc','#0b5394','#351c75','#741b47'],
        ['#5b0f00','#660000','#783f04','#7f6000','#274e13','#0c343d','#1c4587','#073763','#20124d','#4c1130'],
    ]
};
window._noteLastColor = { fg: '#000000', bg: '#fce5cd' };
window.notePaletteToggle = function(kind) {
    const el = document.getElementById('notePal_' + kind); if (!el) return;
    document.querySelectorAll('.nt-palette').forEach(p => { if (p !== el) p.classList.add('hidden'); });
    if (!el.classList.contains('hidden')) { el.classList.add('hidden'); return; }
    const P = window.NOTE_PALETTE;
    const row = (arr) => `<div class="row">${arr.map(c => `<div class="sw" style="background:${c}" title="${c}" onclick="notePalettePick('${kind}','${c}')"></div>`).join('')}</div>`;
    el.innerHTML = `
        <div class="flex items-center justify-between mb-1">
            <span class="lbl" style="margin:0">${kind === 'fg' ? 'สีตัวอักษร' : 'สีพื้นช่อง'}</span>
            <button onclick="notePalettePick('${kind}',null)" class="text-[10px] font-bold text-red-500 hover:underline">${kind === 'fg' ? 'ดำ (ค่าเริ่มต้น)' : 'ไม่มีสี'}</button>
        </div>
        ${row(P.base)}${row(P.bright)}
        <div class="lbl">โทนอ่อน → เข้ม</div>
        ${P.shades.map(row).join('')}
        <div class="lbl">กำหนดเอง</div>
        <div class="flex items-center gap-2">
            <label class="sw" style="width:28px;height:22px;background:linear-gradient(45deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f);position:relative"><input type="color" value="${window._noteLastColor[kind] || '#000000'}" onchange="notePalettePick('${kind}', this.value)" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
            <input type="text" placeholder="#rrggbb" maxlength="7" onkeydown="if(event.key==='Enter'){notePalettePick('${kind}', this.value)}" class="flex-1 text-[11px] px-2 py-1 border border-slate-300 rounded text-slate-800 outline-none focus:border-purple-500">
            <span class="text-[10px] text-slate-400">Enter</span>
        </div>`;
    el.classList.remove('hidden');
};
window.notePalettePick = function(kind, color) {
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) { Swal.mixin({ toast: true, position: 'top', timer: 1500, showConfirmButton: false }).fire({ icon: 'warning', title: 'รูปแบบสีต้องเป็น #rrggbb' }); return; }
    if (color) window._noteLastColor[kind] = color;
    const sw = document.getElementById(kind === 'fg' ? 'notePalSwFg' : 'notePalSwBg'); if (sw) sw.style.background = color || (kind === 'fg' ? '#000' : '#fff');
    document.getElementById('notePal_' + kind)?.classList.add('hidden');
    window.noteCmd(kind, color);
};
document.addEventListener('mousedown', e => { if (!e.target.closest('.nt-palette-wrap')) document.querySelectorAll('.nt-palette').forEach(p => p.classList.add('hidden')); });
window.noteSelectCol = function(e, x) { if (e.target.classList.contains('nt-col-rs')) return; e.preventDefault(); const H = window._noteEdit.rows.length; const s0 = window._noteSel; window._noteSel = (e.shiftKey && s0) ? { r1: 0, r2: H - 1, x1: Math.min(s0.x1, x), x2: Math.max(s0.x2, x) } : { r1: 0, r2: H - 1, x1: x, x2: x }; window.renderNoteEditor(); };
window.noteSelectRow = function(e, r) { if (e.target.classList.contains('nt-row-rs')) return; e.preventDefault(); const W = window._noteEdit.rows[0].length; const s0 = window._noteSel; window._noteSel = (e.shiftKey && s0) ? { r1: Math.min(s0.r1, r), r2: Math.max(s0.r2, r), x1: 0, x2: W - 1 } : { r1: r, r2: r, x1: 0, x2: W - 1 }; window.renderNoteEditor(); };
window.noteSelectAll = function() { const n = window._noteEdit; window._noteSel = { r1: 0, r2: n.rows.length - 1, x1: 0, x2: n.rows[0].length - 1 }; window.renderNoteEditor(); };
// ลากปรับความกว้างคอลัมน์ / ความสูงแถว
window._noteRs = null;
window.noteResizeStart = function(e, kind, idx) {
    e.preventDefault(); e.stopPropagation();
    const note = window._noteEdit; if (!note) return;
    const table = document.getElementById('noteEditTable');
    const startPx = e.clientX, startPy = e.clientY;
    let startVal;
    if (kind === 'col') startVal = table.querySelectorAll('colgroup col')[idx + 1].getBoundingClientRect().width;
    else { const tr = table.querySelectorAll('tbody tr')[idx]; startVal = tr.getBoundingClientRect().height; }
    window._noteRs = { kind, idx, startPx, startPy, startVal };
    document.body.style.cursor = kind === 'col' ? 'col-resize' : 'row-resize';
    const move = (ev) => {
        const rs = window._noteRs; if (!rs) return;
        if (rs.kind === 'col') { const w = Math.max(40, Math.round(rs.startVal + (ev.clientX - rs.startPx))); const col = table.querySelectorAll('colgroup col')[rs.idx + 1]; const prev = parseFloat(col.style.width) || rs.startVal; col.style.width = w + 'px'; table.style.width = (parseFloat(table.style.width) + (w - prev)) + 'px'; rs.cur = w; }
        else { const h = Math.max(24, Math.round(rs.startVal + (ev.clientY - rs.startPy))); table.querySelectorAll('tbody tr')[rs.idx].style.height = h + 'px'; rs.cur = h; }
    };
    const up = () => {
        const rs = window._noteRs; window._noteRs = null; document.body.style.cursor = '';
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        if (!rs || rs.cur == null) return;
        _nSnap();
        if (rs.kind === 'col') note.cols[rs.idx] = Math.round(rs.cur / 1.15);   // เก็บเป็นหน่วยเดิมของชีท (วาดคูณ 1.15)
        else { note.rowH = note.rowH || []; note.rowH[rs.idx] = rs.cur; }
    };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
};
const _nToast = (m) => Swal.mixin({ toast: true, position: 'top', timer: 1800, showConfirmButton: false }).fire({ icon: 'info', title: m });

window.noteCmd = async function(cmd, val) {
    const note = window._noteEdit; if (!note) return;
    if (cmd === 'undo') { if (!window._noteUndo.length) return; window._noteSyncText(); window._noteRedo.push(_nClone(window._noteEdit)); window._noteEdit = window._noteUndo.pop(); window._noteSel = null; window.renderNoteEditor(); return; }
    if (cmd === 'redo') { if (!window._noteRedo.length) return; window._noteSyncText(); window._noteUndo.push(_nClone(window._noteEdit)); window._noteEdit = window._noteRedo.pop(); window._noteSel = null; window.renderNoteEditor(); return; }
    if (cmd === 'trimEmpty') { _nSnap(); const t = window.trimNoteGrid(note); note.rows = t.rows; note.cols = t.cols; window._noteSel = null; window.renderNoteEditor(); return; }
    const sel = window._noteSel; if (!sel) { _nToast('คลิกเลือกช่องก่อน'); return; }
    _nSnap();
    const cells = _nSelCells(); const each = (fn) => cells.forEach(o => fn(o.c, o));
    const bdOf = (c) => c.bd || { t: true, b: true, l: true, r: true };
    const abort = () => { window._noteUndo.pop(); };
    const W = note.rows[0].length, H = note.rows.length;
    switch (cmd) {
        case 'bold': { const allB = cells.every(o => o.c.b); each(c => c.b = !allB); break; }
        case 'italic': { const all = cells.every(o => o.c.i); each(c => c.i = !all); break; }
        case 'underline': { const all = cells.every(o => o.c.u); each(c => c.u = !all); break; }
        case 'strike': { const all = cells.every(o => o.c.st); each(c => c.st = !all); break; }
        // 🧹 ล้างรูปแบบ — เหลือแต่ข้อความ (เส้นตารางกลับเป็นค่าเริ่มต้น)
        case 'clearFmt': each(c => { c.bg = null; c.fg = null; c.b = false; c.i = false; c.u = false; c.st = false; c.a = null; c.fs = null; c.bc = null; c.clip = false; c.bd = { t: true, b: true, l: true, r: true }; }); break;
        // ↕️ ย้ายแถวที่เลือกขึ้น/ลง 1 ตำแหน่ง (ทั้งก้อนถ้าเลือกหลายแถว)
        case 'rowUp': case 'rowDown': {
            const up = cmd === 'rowUp';
            const from = up ? sel.r1 - 1 : sel.r2 + 1;                       // แถวเพื่อนบ้านที่จะสลับ
            if (from < 0 || from >= H) { abort(); return; }
            // กันช่องผสานแนวตั้งพัง: แถวที่เกี่ยวข้องทั้งหมดต้องไม่มีช่องผสานข้ามแถว
            for (let r = Math.min(from, sel.r1); r <= Math.max(from, sel.r2); r++)
                for (let x = 0; x < W; x++) { const c = note.rows[r][x]; if (c.h || (c.rs || 1) > 1) { abort(); _nToast('มีช่องผสานแนวตั้งคร่อมอยู่ — แยกช่องก่อนแล้วค่อยย้ายแถว'); return; } }
            const band = note.rows.splice(sel.r1, sel.r2 - sel.r1 + 1);
            const bandH = note.rowH ? note.rowH.splice(sel.r1, sel.r2 - sel.r1 + 1) : null;
            const at = up ? sel.r1 - 1 : sel.r1 + 1;
            note.rows.splice(at, 0, ...band);
            if (bandH) { note.rowH = note.rowH || []; note.rowH.splice(at, 0, ...bandH); }
            window._noteSel = { r1: at, r2: at + band.length - 1, x1: sel.x1, x2: sel.x2 };
            break;
        }
        // ⎘ คัดลอกแถวที่เลือก แทรกต่อท้ายก้อนเดิม (ก๊อปทั้งข้อความ+สี+รูปแบบ)
        case 'rowDup': {
            for (let r = sel.r1; r <= sel.r2; r++)
                for (let x = 0; x < W; x++) { const c = note.rows[r][x];
                    if (c.h) { const a = _nAnchor(note, r, x); if (!a || a.r < sel.r1) { abort(); _nToast('มีช่องผสานคร่อมนอกแถวที่เลือก — แยกช่องก่อน'); return; } }
                    if ((c.rs || 1) > 1 && r + c.rs - 1 > sel.r2) { abort(); _nToast('มีช่องผสานยื่นออกนอกแถวที่เลือก — แยกช่องก่อน'); return; } }
            const band = JSON.parse(JSON.stringify(note.rows.slice(sel.r1, sel.r2 + 1)));
            note.rows.splice(sel.r2 + 1, 0, ...band);
            if (note.rowH) { const bh = note.rowH.slice(sel.r1, sel.r2 + 1); note.rowH.splice(sel.r2 + 1, 0, ...bh); }
            window._noteSel = { r1: sel.r2 + 1, r2: sel.r2 + band.length, x1: sel.x1, x2: sel.x2 };
            break;
        }
        // 🔤 เรียงแถวตามคอลัมน์ที่เลือก (ตัวเลขเรียงแบบตัวเลข ไทย/อังกฤษเรียงตามพจนานุกรม)
        case 'sortAsc': case 'sortDesc': {
            for (let r = 0; r < H; r++) for (let x = 0; x < W; x++) { const c = note.rows[r][x]; if (c.h || (c.cs || 1) > 1 || (c.rs || 1) > 1) { abort(); _nToast('ตารางมีช่องผสาน — แยกช่องทั้งหมดก่อนแล้วค่อยเรียง'); return; } }
            const ask = await Swal.fire({ title: 'เรียงลำดับ', text: `เรียงตามคอลัมน์ ${_nColName(sel.x1)} ${cmd === 'sortAsc' ? 'ก→ฮ / A→Z / น้อย→มาก' : 'ฮ→ก / Z→A / มาก→น้อย'}`, input: 'checkbox', inputValue: 1, inputPlaceholder: 'แถวแรกเป็นหัวตาราง (ไม่ต้องเรียง)', showCancelButton: true, confirmButtonText: 'เรียงเลย', cancelButtonText: 'ยกเลิก' });
            if (ask.isConfirmed === false || ask.dismiss) { abort(); return; }
            const skipHead = !!ask.value;
            const start = skipHead ? 1 : 0;
            const idx = note.rows.map((_, i) => i).slice(start);
            const key = (i) => String(note.rows[i][sel.x1].t || '');
            idx.sort((a, b) => key(a).localeCompare(key(b), 'th', { numeric: true, sensitivity: 'base' }));
            if (cmd === 'sortDesc') idx.reverse();
            const head = note.rows.slice(0, start);
            note.rows = head.concat(idx.map(i => note.rows[i]));
            if (note.rowH) { const hh = note.rowH.slice(0, start); note.rowH = hh.concat(idx.map(i => note.rowH[i])); }
            window._noteSel = null;
            break;
        }
        // 📋 คัดลอกช่วงที่เลือกเป็นตาราง (TSV) → เอาไปวางใน Excel / Google Sheets ได้เลย
        case 'copyTSV': {
            abort();   // ไม่ต้องเก็บ undo — ไม่ได้แก้ข้อมูล
            const lines = [];
            for (let r = sel.r1; r <= sel.r2; r++) { const row = [];
                for (let x = sel.x1; x <= sel.x2; x++) { const c = note.rows[r][x]; row.push(c.h ? '' : String(c.t || '').replace(/\t/g, ' ')); }
                lines.push(row.join('\t')); }
            window._copyText(lines.join('\n'), null);
            return;
        }
        case 'fg': each(c => c.fg = val); break;
        case 'bg': each(c => c.bg = val); break;
        case 'align': each(c => c.a = val === 'l' ? null : val); break;
        case 'wrap': each(c => c.clip = (val === 'clip')); break;
        case 'fontSize': { const n = parseInt(val); each(c => c.fs = (!n || n === window.NOTE_DEF_FS) ? null : n); break; }
        case 'border': {
            const color = window._noteBorderColor || undefined;
            if (val === 'all') each((c, o) => ['t', 'b', 'l', 'r'].forEach(s => _nSetEdge(note, o, s, true, color)));
            else if (val === 'none') each((c, o) => ['t', 'b', 'l', 'r'].forEach(s => _nSetEdge(note, o, s, false)));
            else if (val === 'outer') each((c, o) => { _nSetEdge(note, o, 't', o.r === sel.r1, color); _nSetEdge(note, o, 'b', o.r2 >= sel.r2, color); _nSetEdge(note, o, 'l', o.x === sel.x1, color); _nSetEdge(note, o, 'r', o.x2 >= sel.x2, color); });
            else if (val === 'inner') each((c, o) => { _nSetEdge(note, o, 't', o.r !== sel.r1, color); _nSetEdge(note, o, 'b', o.r2 < sel.r2, color); _nSetEdge(note, o, 'l', o.x !== sel.x1, color); _nSetEdge(note, o, 'r', o.x2 < sel.x2, color); });
            else { const allOn = cells.every(o => bdOf(o.c)[val]); each((c, o) => _nSetEdge(note, o, val, !allOn, color)); }
            document.getElementById('noteBorderMenu')?.classList.add('hidden'); break;
        }
        case 'borderColor': { window._noteBorderColor = val; each(c => c.bc = val); document.getElementById('noteBorderMenu')?.classList.add('hidden'); break; }
        case 'merge': {
            if (cells.length < 2 && !(cells[0] && (cells[0].c.cs > 1 || cells[0].c.rs > 1))) { abort(); _nToast('ลากคลุมอย่างน้อย 2 ช่องก่อน'); return; }
            // ขยายกรอบให้ครอบช่องผสานเดิมทั้งหมด
            let r1 = sel.r1, r2 = sel.r2, x1 = sel.x1, x2 = sel.x2;
            cells.forEach(o => { r1 = Math.min(r1, o.r); r2 = Math.max(r2, o.r2); x1 = Math.min(x1, o.x); x2 = Math.max(x2, o.x2); });
            const texts = []; const base = _nAnchor(note, r1, x1).c;
            for (let r = r1; r <= r2; r++) for (let x = x1; x <= x2; x++) { const c = note.rows[r][x]; if (!c.h && c.t) texts.push(c.t); }
            for (let r = r1; r <= r2; r++) for (let x = x1; x <= x2; x++) note.rows[r][x] = (r === r1 && x === x1) ? { ...base, t: texts.join(' '), cs: x2 - x1 + 1, rs: r2 - r1 + 1, h: false } : _nCell({ h: true });
            window._noteSel = { r1, r2, x1, x2 }; break;
        }
        case 'unmerge': {
            let did = false;
            cells.forEach(o => { const c = o.c; if ((c.cs || 1) === 1 && (c.rs || 1) === 1) return; const cs = c.cs || 1, rs = c.rs || 1; for (let r = o.r; r < o.r + rs; r++) for (let x = o.x; x < o.x + cs; x++) if (!(r === o.r && x === o.x)) note.rows[r][x] = _nCell({ bg: c.bg, fg: c.fg, b: c.b, i: c.i, u: c.u, st: c.st, a: c.a, fs: c.fs, bd: { ...bdOf(c) }, bc: c.bc, clip: c.clip }); c.cs = 1; c.rs = 1; did = true; });
            if (!did) { abort(); return; }
            break;
        }
        case 'rowAbove': case 'rowBelow': {
            const at = cmd === 'rowAbove' ? sel.r1 : sel.r2 + 1;
            const newRow = Array.from({ length: W }, () => _nCell());
            // ช่องผสานที่คร่อมตำแหน่งแทรก → ขยาย rs และให้ช่องใหม่เป็น h
            for (let x = 0; x < W; x++) { const a = at < H ? _nAnchor(note, at, x) : null; if (a && a.r < at) { a.c.rs++; newRow[x] = _nCell({ h: true }); } }
            note.rows.splice(at, 0, newRow); if (note.rowH) note.rowH.splice(at, 0, undefined); window._noteSel = null; break;
        }
        case 'rowDel': {
            const n = sel.r2 - sel.r1 + 1; if (H - n < 1) { abort(); return; }
            for (let r = sel.r2; r >= sel.r1; r--) {
                for (let x = 0; x < W; x++) { const c = note.rows[r][x]; const a = _nAnchor(note, r, x); if (!a) continue;
                    if (a.r < r) { a.c.rs--; }                                   // แถวนี้อยู่ใต้ช่องผสาน → หดช่องนั้น
                    else if (a.r === r && (c.rs || 1) > 1) { const nc = { ...c, rs: c.rs - 1 }; note.rows[r + 1][x] = nc; for (let xx = x + 1; xx < x + (c.cs || 1); xx++) note.rows[r + 1][xx] = _nCell({ h: true }); } }   // ย้ายต้นทางลงแถวถัดไป
                note.rows.splice(r, 1); if (note.rowH) note.rowH.splice(r, 1);
            }
            window._noteSel = null; break;
        }
        case 'colLeft': case 'colRight': {
            const at = cmd === 'colLeft' ? sel.x1 : sel.x2 + 1;
            note.rows.forEach((row, r) => { const a = at < W ? _nAnchor(note, r, at) : null; const cell = (a && a.x < at) ? _nCell({ h: true }) : _nCell(); if (a && a.x < at && a.r === r) a.c.cs++; row.splice(at, 0, cell); });
            note.cols.splice(at, 0, 160); window._noteSel = null; break;
        }
        case 'colDel': {
            const n = sel.x2 - sel.x1 + 1; if (W - n < 1) { abort(); return; }
            for (let x = sel.x2; x >= sel.x1; x--) {
                note.rows.forEach((row, r) => { const c = row[x]; const a = _nAnchor(note, r, x); if (!a) return;
                    if (a.x < x) { if (a.r === r) a.c.cs--; }
                    else if (a.x === x && a.r === r && (c.cs || 1) > 1) { const nc = { ...c, cs: c.cs - 1 }; row[x + 1] = nc; for (let rr = r + 1; rr < r + (c.rs || 1); rr++) note.rows[rr][x + 1] = _nCell({ h: true }); } });
                note.rows.forEach(row => row.splice(x, 1)); note.cols.splice(x, 1);
            }
            window._noteSel = null; break;
        }
        case 'colWidth': {
            const { value } = await Swal.fire({ title: `ความกว้างคอลัมน์ ${sel.x1 + 1}${sel.x2 > sel.x1 ? '-' + (sel.x2 + 1) : ''} (px)`, input: 'number', inputValue: note.cols[sel.x1] || 160, inputAttributes: { min: 60, max: 900 } });
            if (!value) { abort(); return; }
            for (let x = sel.x1; x <= sel.x2; x++) note.cols[x] = parseInt(value); break;
        }
    }
    window.renderNoteEditor();
};
// 🔎 ค้นหา & แทนที่ทั้งตาราง (หรือเฉพาะช่วงที่เลือกไว้ ถ้าเลือกมากกว่า 1 ช่อง)
window.noteFindReplace = async function() {
    const note = window._noteEdit; if (!note) return;
    const sel = window._noteSel; const inSel = sel && (sel.r2 > sel.r1 || sel.x2 > sel.x1);
    const { value: v, isConfirmed } = await Swal.fire({
        title: '🔎 ค้นหา & แทนที่',
        html: `<input id="nfrFind" class="swal2-input" placeholder="คำที่ค้นหา..." style="margin-bottom:6px">` +
              `<input id="nfrRep" class="swal2-input" placeholder="แทนที่ด้วย... (เว้นว่าง = ลบคำนั้นทิ้ง)">` +
              (inSel ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px">จะแทนที่เฉพาะในช่วงที่เลือกไว้</div>` : `<div style="font-size:12px;color:#94a3b8;margin-top:4px">จะแทนที่ทั้งตาราง</div>`),
        showCancelButton: true, confirmButtonText: 'แทนที่ทั้งหมด', cancelButtonText: 'ยกเลิก',
        preConfirm: () => ({ f: document.getElementById('nfrFind').value, r: document.getElementById('nfrRep').value })
    });
    if (!isConfirmed || !v || !v.f) return;
    _nSnap();
    const esc = v.f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc, 'g');
    let cellCount = 0, hitCount = 0;
    const walk = (r, x) => { const c = note.rows[r][x]; if (c.h || !c.t) return; const hits = (String(c.t).match(re) || []).length; if (!hits) return; c.t = String(c.t).replace(re, v.r); cellCount++; hitCount += hits; };
    if (inSel) { for (let r = sel.r1; r <= sel.r2; r++) for (let x = sel.x1; x <= sel.x2; x++) walk(r, x); }
    else { for (let r = 0; r < note.rows.length; r++) for (let x = 0; x < note.rows[r].length; x++) walk(r, x); }
    if (!hitCount) { window._noteUndo.pop(); _nToast('ไม่พบคำที่ค้นหา'); return; }
    window.renderNoteEditor();
    _nToast(`แทนที่แล้ว ${hitCount} จุด ใน ${cellCount} ช่อง`);
};
document.addEventListener('mousedown', e => { const m = document.getElementById('noteBorderMenu'); if (m && !m.classList.contains('hidden') && !e.target.closest('#noteBorderMenuWrap')) m.classList.add('hidden'); });
document.addEventListener('keydown', e => {
    if (!window._noteEditing) return;
    // Delete = ล้างข้อความทุกช่องที่เลือก (ไม่ต้องลากคลุมตัวอักษร) — Backspace ยังลบทีละตัวตามปกติ
    if (e.key === 'Delete' && window._noteSel) {
        e.preventDefault(); _nSnap();
        _nSelCells().forEach(o => { o.c.t = ''; });
        window.renderNoteEditor(); return;
    }
    if (e.key === 'Escape') { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); window.noteCmd('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); window.noteCmd('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { e.preventDefault(); window.noteCmd('underline'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); window.noteFindReplace(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); window.noteCmd(e.shiftKey ? 'redo' : 'undo'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); window.noteCmd('redo'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); window.noteEditSave(); }
});

// ==========================================