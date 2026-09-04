// ════════════════════════════════════════════════════════════════════
// 📦 sheet/note_view.js — ส่วนที่ 2/4 ของตารางงานรวม (ชีต) (แยกจาก sheet.js เดิม 1,616 บรรทัด)
// เนื้อหา: ระบบแท็บ/iFrame, หน้าข้อความโหมดดู (ตาราง+ก๊อป+clamp)
// ⚠️ ลำดับโหลด: sheet/core → sheet/note_view → sheet/note_edit → sheet/admin (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 🟢 3. ระบบจัดการแท็บ และเปิด iFrame
// ==========================================
window.renderRecentTabs = function() {
    const container = document.getElementById('recentTabsContainer');
    if (!container) return;
    
    if (recentTabs.length === 0) { 
        container.classList.add('hidden'); 
        return; 
    }
    container.classList.remove('hidden');

    let html = recentTabs.map(tab => {
        const isViewerVisible = !document.getElementById('sheetViewer').classList.contains('hidden');
        const isActive = (String(window.currentActiveTabId) === String(tab.id)) && isViewerVisible;
        const activeClass = isActive ? 'bg-white text-blue-700 font-black' : 'bg-gray-300 text-gray-600 hover:bg-gray-200 font-bold opacity-80';
        const urlToCheck = tab.sheet_id || tab.url || '';
        const icon = (urlToCheck.startsWith('http') || urlToCheck.startsWith('www')) ? 'link' : 'table_chart';
        const tName = tab.name || tab.title || 'ไม่มีชื่อ';

        return window.renderTemplate('tpl-sheet-recent-tab', {
            id: tab.id,
            activeClass: activeClass,
            icon: icon,
            title: tName
        });
    }).join('');

    if (recentTabs.length > 1) { 
        html += `<button onclick="clearAllTabs()" class="ml-2 px-2 pb-2 text-[10px] text-red-500 hover:text-red-400 underline shrink-0">ล้างทั้งหมด</button>`; 
    }
    container.innerHTML = html;
};

window.openSheetById = function(id) {
    const tab = recentTabs.find(t => String(t.id) === String(id)) || window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
    if(tab) openSheet(tab);
};

window.addToRecentTabs = function(sheet) {
    recentTabs = recentTabs.filter(t => t.id !== sheet.id);
    recentTabs.unshift(sheet);
    if (recentTabs.length > 10) recentTabs.pop();
    window.safeSetItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    renderRecentTabs();
};

window.closeTab = function(e, id) {
    e.stopPropagation();
    recentTabs = recentTabs.filter(t => String(t.id) !== String(id));
    window.safeSetItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    
    if (recentTabs.length === 0) {
        closeSheet(); 
    } else {
        if (String(window.currentActiveTabId) === String(id)) {
            openSheet(recentTabs[0]); 
        } else {
            renderRecentTabs(); 
        }
    }
};

window.clearAllTabs = function() {
    recentTabs = [];
    window.safeSetItem('sheet_recent_tabs', '[]');
    renderRecentTabs();
    closeSheet();
};

window.openSheet = function(sheet) {
    window.currentActiveTabId = sheet.id;
    
    document.getElementById('sheetMenu').classList.add('hidden');
    const viewer = document.getElementById('sheetViewer');
    viewer.classList.remove('hidden');
    viewer.classList.add('flex');
    
    const gName = sheet.group_name || sheet.category || 'ทั่วไป';
    const sName = sheet.name || sheet.title || 'ไม่มีชื่อ';
    document.getElementById('sheetTitle').innerHTML = `<span class="text-gray-500">${gName}</span> <span class="material-icons text-[10px] mx-1 text-gray-600">arrow_forward_ios</span> <span class="text-white font-bold text-sm">${sName}</span>`;
    
    document.getElementById('sheetLoading').classList.remove('hidden');
    addToRecentTabs(sheet);

    let url = sheet.sheet_id || sheet.url || '';

    // 📝 หน้าข้อความที่สร้างในระบบ → ไม่ใช้ iframe โหลดทันที
    const frameEl = document.getElementById('sheetFrame');
    const noteEl = document.getElementById('noteViewer');
    if (url === 'NOTE') {
        if (frameEl) { frameEl.src = 'about:blank'; frameEl.classList.add('hidden'); }
        if (noteEl) { noteEl.classList.remove('hidden'); noteEl.classList.add('flex'); }
        const btnNT = document.getElementById('btnOpenNewTab'); if (btnNT) btnNT.classList.add('hidden');
        window.openNoteSheet(sheet);
        return;
    }
    if (frameEl) frameEl.classList.remove('hidden');
    if (noteEl) { noteEl.classList.add('hidden'); noteEl.classList.remove('flex'); }
    const btnNT2 = document.getElementById('btnOpenNewTab'); if (btnNT2) btnNT2.classList.remove('hidden');
    
    if (url.startsWith('http') || url.startsWith('www')) {
        url = url.startsWith('www') ? 'https://' + url : url;
    } 
    else if (url.length > 20 && !url.includes('/')) {
        url = `https://docs.google.com/spreadsheets/d/${url}/edit?rm=minimal&single=true&widget=true&headers=false`;
        if(sheet.gid) url += `&gid=${sheet.gid}`;
    }
    if (!url) url = 'about:blank';
    
    const btnNewTab = document.getElementById('btnOpenNewTab');
    if (btnNewTab) btnNewTab.onclick = () => window.open(url, '_blank');
    
    const frame = document.getElementById('sheetFrame');
    if(frame) {
        frame.onload = function() { window.hideSheetLoading(); };
        frame.src = url;
    }
};

window.closeSheet = function() {
    if (window._noteEditing) window.noteEditExit(false);
    const frame = document.getElementById('sheetFrame');
    if(frame) frame.src = 'about:blank';
    document.getElementById('sheetViewer')?.classList.add('hidden');
    document.getElementById('sheetViewer')?.classList.remove('flex');
    document.getElementById('sheetMenu')?.classList.remove('hidden');
    window.currentActiveTabId = null;
    renderRecentTabs();
};

window.hideSheetLoading = function() {
    document.getElementById('sheetLoading')?.classList.add('hidden');
};

// ==========================================
// 📝 หน้าข้อความที่สร้างในระบบ (ตารางแพทเทิร์น/หมายเหตุ) — เก็บใน settings key sheet_note_<id>
// โมเดล v3 (ตารางเต็ม): note = { v:3, rows:[[cell,...]], cols:[px,...] }
//   cell = { t, bg, fg, b, a('c'|'r'|null), fs(px), bd:{t,b,l,r}, bc, cs, rs, h }
//   cs/rs = ผสานไปทางขวา/ลง กี่ช่อง (เฉพาะช่อง "ต้นทาง")  h = true คือช่องที่ถูกผสานทับ (ไม่วาด)
//   เส้นตาราง: เส้นแต่ละด้านเป็น "ขอบร่วม" — ตั้งด้านขวาของช่อง A = ตั้งด้านซ้ายของช่อง B ด้วย
// รูปแบบเก่า (v1 คอลัมน์+แถว / v2 colspan) ถูกแปลงเป็น v3 ตอนเปิดอัตโนมัติ
// ==========================================
window._noteCache = {};
window._currentNote = null;
window._pendingRich = null;
window.NOTE_DEF_BC = '#000000';   // สีเส้นเริ่มต้น = ดำ
window.NOTE_DEF_FS = 14;

const _nCell = (o) => ({ t: '', bg: null, fg: null, b: false, a: null, fs: null, bd: { t: true, b: true, l: true, r: true }, bc: null, cs: 1, rs: 1, h: false, ...(o || {}) });

// ---------- แปลงรูปแบบเก่า → v3 ----------
window.noteToV3 = function(note) {
    if (!note) return { v: 3, rows: [], cols: [] };
    if (note.v === 3) return note;
    let rowsV2;
    if (note.v === 2) rowsV2 = note.rows || [];
    else rowsV2 = [ (note.columns || []).map(c => ({ t: c, bg: '#fce5cd', b: true, a: 'c', cs: 1 })), ...(note.rows || []).map(r => r.map(c => ({ t: c, cs: 1 }))) ];
    const width = Math.max(0, ...rowsV2.map(r => r.reduce((a, c) => a + (c.cs || 1), 0)));
    const rows = rowsV2.map(r => {
        const out = [];
        r.forEach(c => { out.push(_nCell({ t: c.t, bg: c.bg || null, fg: c.fg || null, b: !!c.b, a: c.a || null, bd: c.bd ? { ...c.bd } : undefined, bc: c.bc || null, cs: c.cs || 1, rs: 1 })); for (let k = 1; k < (c.cs || 1); k++) out.push(_nCell({ h: true })); });
        while (out.length < width) out.push(_nCell());
        return out;
    });
    const cols = (note.cols || []).slice(0, width); while (cols.length < width) cols.push(160);
    return { v: 3, rows, cols };
};

// ---------- วาง/พิมพ์ ----------
window.parseNoteText = function(text, firstRowHeader) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    const sep = lines.some(l => l.includes('\t')) ? '\t' : (lines.some(l => l.includes('|')) ? '|' : null);
    const rows = lines.map(l => (sep ? l.split(sep) : [l]).map(c => c.trim()));
    const width = Math.max(1, ...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < width) r.push(''); });
    let columns = [];
    if (firstRowHeader && rows.length > 0) columns = rows.shift();
    else columns = Array.from({ length: width }, (_, i) => `คอลัมน์ ${i + 1}`);
    return window.noteToV3({ columns, rows });
};
// แปลง HTML จาก clipboard ของ Google Sheet → v3 (สี/ตัวหนา/จัดกลาง/ขนาด/ผสานทั้งแนวนอนและแนวตั้ง)
window.parseNoteHtml = function(html) {
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.querySelector('table'); if (!table) return null;
        const normBg = (c) => { if (!c) return null; c = c.trim().toLowerCase(); if (['transparent','inherit','initial','#ffffff','#fff','white','rgb(255, 255, 255)'].includes(c)) return null; return c; };
        const normFg = (c) => { if (!c) return null; c = c.trim().toLowerCase(); if (['transparent','inherit','initial'].includes(c)) return null; return c; };
        const cols = [...table.querySelectorAll('colgroup col')].map(c => parseInt(c.getAttribute('width') || c.style.width || '0') || 0);
        const grid = []; // grid[r][x]
        const trs = [...table.querySelectorAll('tr')];
        trs.forEach((tr, r) => {
            grid[r] = grid[r] || [];
            let x = 0;
            [...tr.children].filter(el => /^T[DH]$/.test(el.tagName)).forEach(td => {
                while (grid[r][x]) x++;   // ข้ามช่องที่ถูก rowspan จากข้างบน
                const st = td.getAttribute('style') || '';
                const get = (prop) => { const m = st.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)', 'i')); return m ? m[1] : null; };
                const clone = td.cloneNode(true); clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                const ta = (get('text-align') || '').toLowerCase();
                const fsm = (get('font-size') || '').match(/([\d.]+)(pt|px)?/);
                let fs = null; if (fsm) { fs = parseFloat(fsm[1]); if ((fsm[2] || 'pt') === 'pt') fs = Math.round(fs * 1.333); if (fs === window.NOTE_DEF_FS) fs = null; }
                const cs = Math.max(1, parseInt(td.getAttribute('colspan') || '1')), rs = Math.max(1, parseInt(td.getAttribute('rowspan') || '1'));
                const cell = _nCell({
                    t: String(clone.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim(),
                    bg: normBg(get('background-color') || get('background')), fg: normFg(get('color')),
                    b: /font-weight\s*:\s*(bold|[6-9]00)/i.test(st) || !!td.querySelector('b,strong') || td.tagName === 'TH',
                    a: ta === 'center' ? 'c' : (ta === 'right' ? 'r' : null), fs, cs, rs
                });
                for (let dy = 0; dy < rs; dy++) for (let dx = 0; dx < cs; dx++) {
                    grid[r + dy] = grid[r + dy] || [];
                    grid[r + dy][x + dx] = (dy === 0 && dx === 0) ? cell : _nCell({ h: true });
                }
                x += cs;
            });
        });
        const width = Math.max(0, ...grid.map(r => r.length));
        const rows = grid.map(r => { const out = []; for (let x = 0; x < width; x++) out.push(r[x] || _nCell()); return out; });
        return window.trimNoteGrid({ v: 3, rows, cols: cols.slice(0, width) });
    } catch (e) { console.warn('parseNoteHtml', e); return null; }
};
// ตัดคอลัมน์/แถวที่ว่างทั้งหมด (ช่องผสานที่คร่อมอยู่จะถูกย่อขนาดตาม)
window.trimNoteGrid = function(note) {
    note = window.noteToV3(note);
    const rows = note.rows.map(r => r.map(c => ({ ...c, bd: { ...(c.bd || { t: true, b: true, l: true, r: true }) } })));
    const H = rows.length, W = Math.max(0, ...rows.map(r => r.length));
    // หา "ต้นทาง" ของแต่ละช่อง
    const anchor = (r, x) => { for (let rr = r; rr >= 0; rr--) for (let xx = x; xx >= 0; xx--) { const c = rows[rr][xx]; if (c && !c.h && rr + (c.rs || 1) > r && xx + (c.cs || 1) > x) return { r: rr, x: xx, c }; } return null; };
    const colHas = Array.from({ length: W }, (_, x) => rows.some((r, ri) => { const a = anchor(ri, x); return a && a.c.t && a.x === x; }));
    const rowHas = rows.map((r, ri) => r.some((c, x) => { const a = anchor(ri, x); return a && a.c.t && a.r === ri; }));
    // ลบคอลัมน์ว่าง (จากขวาไปซ้าย)
    for (let x = W - 1; x >= 0; x--) {
        if (colHas[x]) continue;
        rows.forEach((r, ri) => { const a = anchor(ri, x); if (a && a.x < x) { if (a.r === ri && a.x === x) {} else if (a.r === ri) rows[a.r][a.x].cs--; } });
        rows.forEach(r => r.splice(x, 1));
        if (note.cols) note.cols.splice(x, 1);
    }
    for (let ri = H - 1; ri >= 0; ri--) {
        if (rowHas[ri]) continue;
        const W2 = rows[0] ? rows[0].length : 0;
        for (let x = 0; x < W2; x++) { const a = anchor(ri, x); if (a && a.r < ri && a.x === x) rows[a.r][a.x].rs--; }
        rows.splice(ri, 1);
    }
    // rs/cs ที่ลดแล้วต้องไม่ต่ำกว่า 1
    rows.forEach(r => r.forEach(c => { c.cs = Math.max(1, c.cs || 1); c.rs = Math.max(1, c.rs || 1); }));
    const width = rows[0] ? rows[0].length : 0;
    const cols = (note.cols || []).slice(0, width); while (cols.length < width) cols.push(160);
    return { v: 3, rows, cols };
};
window.noteToText = function(note) {
    note = window.noteToV3(note);
    return note.rows.map(r => r.filter(c => !c.h).map(c => c.t).join('\t')).join('\n');
};
window.previewNote = function() {
    const el = document.getElementById('notePreview'); if (!el) return;
    if (window._pendingRich) {
        const n = window._pendingRich;
        el.innerHTML = `<span class="text-emerald-400">✅ รับตารางจาก Google Sheet พร้อมสี/ผสานช่องแล้ว</span> — ${n.cols.length} คอลัมน์ × ${n.rows.length} แถว <span class="text-slate-500">— ถ้าแก้ข้อความในช่องนี้ สีจะหายไป (แก้ต่อได้ในหน้าหลังบันทึก)</span>`;
        return;
    }
    const n = window.parseNoteText(document.getElementById('newSheetNote').value, document.getElementById('newSheetNoteHeader').checked);
    el.innerText = n.rows.length ? `ตัวอย่าง: ${n.cols.length} คอลัมน์ × ${n.rows.length} แถว` : '';
};
document.addEventListener('paste', e => {
    const ta = e.target; if (!ta || ta.id !== 'newSheetNote') return;
    const html = e.clipboardData && e.clipboardData.getData('text/html');
    if (html && /<t(able|d|r)\b/i.test(html)) {
        const rich = window.parseNoteHtml(html);
        if (rich && rich.rows.length) { e.preventDefault(); window._pendingRich = rich; ta.value = window.noteToText(rich); window.previewNote(); }
    }
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'newSheetNote') { window._pendingRich = null; window.previewNote(); } });
document.addEventListener('change', e => { if (e.target && e.target.id === 'newSheetNoteHeader') window.previewNote(); });
window.setSheetType = function(type) {
    document.getElementById('newSheetType').value = type;
    const isNote = type === 'note';
    document.getElementById('noteEditorBox').classList.toggle('hidden', !isNote);
    document.getElementById('linkEditorBox').classList.toggle('hidden', isNote);
    const on = 'flex-1 py-2.5 rounded-xl text-sm font-bold border transition bg-purple-600 border-purple-400 text-white';
    const off = 'flex-1 py-2.5 rounded-xl text-sm font-bold border transition bg-slate-800 border-slate-600 text-slate-400 hover:text-white';
    document.getElementById('sheetTypeBtn_link').className = isNote ? off : on;
    document.getElementById('sheetTypeBtn_note').className = isNote ? on : off;
};

// ---------- เปิดดู ----------
window.openNoteSheet = async function(sheet) {
    const wrap = document.getElementById('noteTableWrap');
    const search = document.getElementById('noteSearch'); if (search) search.value = '';
    document.getElementById('sheetLoading')?.classList.add('hidden');
    let note = window._noteCache[sheet.id];
    if (!note) {
        wrap.innerHTML = '<div class="text-center text-slate-500 py-10"><span class="material-icons animate-spin">sync</span></div>';
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', `sheet_note_${sheet.id}`).maybeSingle();
            note = data && data.value ? JSON.parse(data.value) : { v: 3, rows: [], cols: [] };
        } catch (e) { note = { v: 3, rows: [], cols: [] }; }
        note = window.noteToV3(note);
        window._noteCache[sheet.id] = note;
    }
    window._currentNote = note;
    window._currentNoteSheetId = sheet.id;
    window.noteEditExit(false);
    window.renderNoteTable();
};

// สไตล์ช่อง (ใช้ทั้งดูและแก้)
window._noteCellStyle = function(c, editing) {
    const st = [`background:${c.bg || '#ffffff'}`, `color:${c.fg || '#111827'}`, `font-size:${c.fs || window.NOTE_DEF_FS}px`];
    if (c.i) st.push('font-style:italic');
    { const deco = []; if (c.u) deco.push('underline'); if (c.st) deco.push('line-through'); if (deco.length) st.push(`text-decoration:${deco.join(' ')}`); }
    if (c.a === 'c') st.push('text-align:center'); else if (c.a === 'r') st.push('text-align:right');
    const bd = c.bd || { t: true, b: true, l: true, r: true }; const col = c.bc || window.NOTE_DEF_BC;
    const off = editing ? '1px dashed rgba(148,163,184,.45)' : '1px none transparent';   // none = ถ้าช่องข้างเคียงอยากมีเส้น ให้มันวาดได้ (ลบเส้นจริงต้องปิดทั้งสองฝั่ง ซึ่ง _nSetEdge ทำให้)
    ['t', 'r', 'b', 'l'].forEach(side => st.push(`border-${{ t: 'top', r: 'right', b: 'bottom', l: 'left' }[side]}:${bd[side] ? `1px solid ${col}` : off}`));
    return st.join(';');
};
const _nColName = (x) => { let n = x + 1, out = ''; while (n > 0) { const m = (n - 1) % 26; out = String.fromCharCode(65 + m) + out; n = Math.floor((n - 1) / 26); } return out; };
const _nHdrCls = 'nt-hdr';   // สไตล์อยู่ใน sheet.html (.nt-hdr) — ห้ามใช้ class แบบ bg-[#xxx] เพราะ css ถูกคอมไพล์ไว้ล่วงหน้า
const _nEsc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

window.renderNoteTable = function() {
    const wrap = document.getElementById('noteTableWrap'); const note = window._currentNote; if (!wrap || !note) return;
    const term = (document.getElementById('noteSearch')?.value || '').toLowerCase().trim();
    const hi = (txt) => { let e = _nEsc(txt); if (term) e = e.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark class="bg-yellow-300 rounded px-0.5">${m}</mark>`);
        // 🔗 ทำลิงก์ให้คลิกได้ (stopPropagation กันไปโดนก๊อปปี้ของช่อง)
        return e.replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-blue-600 underline hover:text-blue-800">${u}</a>`); };
    const rows = note.rows || [];
    if (rows.length === 0) { wrap.innerHTML = '<div class="text-center text-slate-500 py-16"><span class="material-icons text-4xl opacity-40">table_chart</span><p class="mt-2 text-sm">ยังไม่มีเนื้อหา — กด "แก้ไขหน้านี้" หรือวางจาก Google Sheet ใน "จัดการชีท"</p></div>'; return; }
    // ค้นหา: ซ่อนแถวที่ไม่ตรง (ถ้าค้นอยู่จะไม่ใช้ rowspan ข้ามแถวที่ซ่อน)
    const keep = rows.map(r => !term || r.some(c => !c.h && String(c.t).toLowerCase().includes(term)));
    const cnt = document.getElementById('noteCount'); if (cnt) cnt.innerText = `${keep.filter(Boolean).length}/${rows.length} แถว`;
    const cols = note.cols || []; const rowH = note.rowH || [];
    const colgroup = `<colgroup><col style="width:42px">${cols.map(w => `<col style="width:${Math.max(60, Math.round((w || 100) * 1.15))}px">`).join('')}<col style="width:36px"></colgroup>`;
    wrap.innerHTML = `
        <div class="bg-white rounded-lg shadow-inner inline-block" style="min-width:100%">
        <table class="border-collapse" style="font-family:'Sarabun',system-ui,sans-serif;table-layout:fixed;width:${42 + 36 + cols.reduce((a, w) => a + Math.max(60, Math.round((w || 100) * 1.15)), 0)}px">
            ${colgroup}
            <thead><tr><th class="${_nHdrCls} nt-stick-tl"></th>${cols.map((_, x) => `<th class="${_nHdrCls} nt-stick-top">${_nColName(x)}</th>`).join('')}<th class="${_nHdrCls} nt-stick-top"></th></tr></thead>
            <tbody>${rows.map((r, ri) => keep[ri] ? `<tr style="${rowH[ri] ? `height:${rowH[ri]}px` : ''}"><td class="${_nHdrCls} nt-stick-left">${ri + 1}</td>${r.map(c => c.h ? '' : `<td colspan="${c.cs || 1}" rowspan="${term ? 1 : (c.rs || 1)}" ${c.t ? `onclick="copyNoteCell(this)" data-v="${_nEsc(c.t)}" title="คลิกเพื่อก๊อปปี้"` : ''} class="px-3 py-2 align-top whitespace-pre-wrap leading-snug ${c.b ? 'font-bold' : ''} ${c.t ? 'cursor-copy hover:outline hover:outline-2 hover:outline-purple-500 hover:-outline-offset-2' : ''}" style="${window._noteCellStyle(c, false)}">${c.clip ? `<div class="nt-clip" style="background:${c.bg || '#fff'}">${hi(c.t)}</div>` : `<div class="nt-body">${hi(c.t)}</div>`}</td>`).join('')}<td class="border border-[#cbd5e1] text-center align-middle bg-slate-50"><button onclick="copyNoteRow(this)" title="ก๊อปทั้งแถว" class="text-slate-400 hover:text-purple-600 p-1"><span class="material-icons text-[15px]">content_copy</span></button></td></tr>` : '').join('')}
            </tbody>
        </table></div>`;

    // 📏 [Auto-clamp] ช่องไหนเนื้อหาสูงเกินเกณฑ์ → จำกัดความสูงแล้วให้เลื่อนดู "ในช่องตัวเอง"
    // จะได้ไม่ดันทั้งแถวให้สูงตาม (ช่องอื่นในแถวเดียวกันไม่กลายเป็นช่องยักษ์ว่างๆ)
    // มีปุ่ม ⇕ มุมช่องไว้กดกาง/หุบดูเต็มๆ ได้
    requestAnimationFrame(() => {
        const MAX_H = 230; // ~11-12 บรรทัด
        wrap.querySelectorAll('.nt-body').forEach(d => {
            if (d.scrollHeight <= MAX_H + 30) return;   // เผื่อ 30px กันช่องที่เกินนิดเดียวไม่ต้อง clamp
            d.classList.add('nt-tall');
            const td = d.parentElement;
            if (td && !td.querySelector('.nt-expand')) {
                const btn = document.createElement('button');
                btn.className = 'nt-expand';
                btn.title = 'กาง/หุบข้อความ';
                btn.innerHTML = '<span class="material-icons" style="font-size:13px">unfold_more</span>';
                btn.onclick = (e) => {
                    e.stopPropagation();   // อย่าให้ไปโดน copy ของช่อง
                    const open = d.classList.toggle('nt-open');
                    btn.innerHTML = `<span class="material-icons" style="font-size:13px">${open ? 'unfold_less' : 'unfold_more'}</span>`;
                };
                td.style.position = 'relative';
                td.appendChild(btn);
            }
        });
    });
};
window._copyText = async function(text, el) {
    try { await navigator.clipboard.writeText(text); } catch (e) { if (typeof fallbackCopyText === 'function') fallbackCopyText(text); }
    if (el) { const old = el.style.background; el.style.background = '#bbf7d0'; setTimeout(() => el.style.background = old, 450); }
    Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 1000 }).fire({ icon: 'success', title: 'ก๊อปปี้แล้ว' });
};
window.copyNoteCell = function(td) { window._copyText(td.dataset.v || td.innerText, td); };
window.copyNoteRow = function(btn) { const tr = btn.closest('tr'); window._copyText([...tr.querySelectorAll('td[data-v]')].map(td => td.dataset.v).join('\t'), tr); };

// ==========================================