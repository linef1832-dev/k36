// ==========================================
// 📊 สถิติเคสพนักงาน + บอท Telegram Settings
// ==========================================

let _caseData       = [];
let _casePage       = 1;
const _casePageSize = 50;
let _caseDate       = null;
let _caseSite       = 'ALL';
let _caseType       = 'ALL';
let _caseTab        = 'stats';

// ─── Init ─────────────────────────────────
window.initWithdrawalReport = async function() {
    _casePage = 1;
    _activeTypeFilter  = 'ALL';
    _activeShiftFilter = 'ALL';
    _setDefaultDate();
    await _loadShiftMap();   // โหลดข้อมูลกะจาก users table
    await _loadBotStatus();
    await _loadCaseData();
};
window.initCaseReport = window.initWithdrawalReport;

// ─── Tab Switch ───────────────────────────
const _TAB_COLORS = {
    stats:    { active: '#4f46e5', shadow: 'rgba(79,70,229,0.4)',   icon: 'leaderboard' },
    summary:  { active: '#7c3aed', shadow: 'rgba(124,58,237,0.4)', icon: 'bar_chart'   },
    log:      { active: '#0369a1', shadow: 'rgba(3,105,161,0.4)',   icon: 'history'     },
    settings: { active: '#047857', shadow: 'rgba(4,120,87,0.4)',    icon: 'smart_toy'   },
};

window.switchCaseTab = function(tab) {
    _caseTab = tab;
    ['stats','summary','log','settings'].forEach(t => {
        const el  = document.getElementById(`caseTab-${t}`);
        const btn = document.getElementById(`tab-${t}`);
        if (!el || !btn) return;
        el.classList.toggle('hidden', t !== tab);
        const cfg = _TAB_COLORS[t] || {};
        if (t === tab) {
            btn.style.background  = cfg.active || '#4f46e5';
            btn.style.color       = '#fff';
            btn.style.boxShadow   = `0 2px 10px ${cfg.shadow||'rgba(79,70,229,0.4)'}`;
        } else {
            btn.style.background  = 'rgba(124,58,237,0.12)';
            btn.style.color       = '#a78bfa';
            btn.style.boxShadow   = 'none';
        }
    });
    if (tab === 'summary') loadSummary();
};

// ─── Date helpers ─────────────────────────
function _setDefaultDate() {
    const picker = document.getElementById('caseDatePicker');
    if (!picker) return;
    if (!_caseDate) {
        const th = new Date(Date.now() + 7*60*60*1000);
        _caseDate = th.toISOString().slice(0,10);
    }
    picker.value = _caseDate;
}
window.setCaseDateToday = function() {
    const th = new Date(Date.now() + 7*60*60*1000);
    _caseDate = th.toISOString().slice(0,10);
    document.getElementById('caseDatePicker').value = _caseDate;
    _loadCaseData();
};
window.applyFilters = function() {
    _caseDate = document.getElementById('caseDatePicker').value || _caseDate;
    _caseSite = document.getElementById('caseSiteFilter').value;
    _caseType = document.getElementById('caseTypeFilter').value;
    _casePage = 1;
    _loadCaseData();
};

// ─── โหลดข้อมูลเคส ────────────────────────
async function _loadCaseData() {
    document.getElementById('caseStaffGrid').innerHTML =
        `<div class="col-span-full text-center py-8"><span class="material-icons animate-spin text-violet-400 text-3xl">sync</span></div>`;
    document.getElementById('caseLogBody').innerHTML =
        `<tr><td colspan="7" class="text-center py-8"><span class="material-icons animate-spin text-violet-400 text-2xl">sync</span></td></tr>`;
    try {
        let q = appDB.from('tg_case_logs').select('*')
            .eq('msg_date', _caseDate)
            .order('created_at', { ascending: false });
        if (_caseSite !== 'ALL') q = q.eq('site', _caseSite);
        if (_caseType !== 'ALL') q = q.eq('case_type', _caseType);
        const { data, error } = await q;
        if (error) throw error;
        _caseData = data || [];
        _renderSummary();
        _renderStaffGrid();
        _renderLogTable();
    } catch(e) {
        document.getElementById('caseLogBody').innerHTML =
            `<tr><td colspan="7" class="text-center py-8 text-red-400">Error: ${e.message}</td></tr>`;
    }
}

// ─── Summary Cards ─────────────────────────
function _renderSummary() {
    const total = _caseData.length;
    const del   = _caseData.filter(d => (d.case_type||'').includes('ลบ')).length;
    const chk   = _caseData.filter(d => (d.case_type||'').includes('เช็ค')).length;
    const unb   = _caseData.filter(d => (d.case_type||'').includes('ปลด')).length;
    const other = _caseData.filter(d => {
        const t = d.case_type||'';
        return !t.includes('ลบ') && !t.includes('เช็ค') && !t.includes('ปลด');
    }).length;
    document.getElementById('caseTotal').textContent      = total.toLocaleString();
    document.getElementById('caseDeleteTurn').textContent = del.toLocaleString();
    document.getElementById('caseCheckTurn').textContent  = chk.toLocaleString();
    document.getElementById('caseUnblock').textContent    = unb.toLocaleString();
    const otherEl = document.getElementById('caseOther');
    if (otherEl) otherEl.textContent = other.toLocaleString();
    _updateCardActiveStyle();
}

let _activeTypeFilter = 'ALL';

function _updateCardActiveStyle() {
    [['cardAll','ALL'],['cardDel','ลบ'],['cardChk','เช็ค'],['cardUnb','ปลด'],['cardOther','other']].forEach(([id,k]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.outline = (_activeTypeFilter === k) ? '2px solid #fff' : 'none';
        el.style.opacity = (_activeTypeFilter === 'ALL' || _activeTypeFilter === k) ? '1' : '0.5';
        el.style.cursor  = 'pointer';
    });
}

window.filterByType = function(type) {
    _activeTypeFilter = (_activeTypeFilter === type) ? 'ALL' : type;
    _updateCardActiveStyle();
    _renderStaffGrid();
};

// ─── Staff Grid ─────────────────────────────
function _getShift(name, fullName, shiftMap) {
    // 1. ดึงจาก shiftMap (users table) ก่อน
    if (shiftMap && shiftMap[name]) return shiftMap[name];
    // 2. fallback ดึงจากชื่อเต็ม
    const src = fullName || name || '';
    if (/08.00-20.00|08:00-20:00/i.test(src)) return 'กะเช้า';
    if (/20.00-08.00|20:00-08:00/i.test(src)) return 'กะดึก';
    return 'ไม่ระบุ';
}

let _shiftMap = {}; // { sender_name: 'กะเช้า'|'กะดึก' }

async function _loadShiftMap() {
    try {
        const { data } = await appDB.from('users').select('username, allowed_shift');
        _shiftMap = {};
        (data||[]).forEach(u => {
            if (u.username && u.allowed_shift) {
                _shiftMap[u.username] = u.allowed_shift;
            }
        });
    } catch(e) { console.warn('loadShiftMap:', e); }
}

let _activeShiftFilter = 'ALL';

window.filterByShift = function(shift) {
    _activeShiftFilter = (_activeShiftFilter === shift) ? 'ALL' : shift;
    // อัปเดต UI ปุ่มกะ
    ['ALL','กะเช้า','กะดึก','ไม่ระบุ'].forEach(s => {
        const el = document.getElementById('shiftBtn-'+s);
        if (!el) return;
        el.style.background  = (_activeShiftFilter === s) ? '#7c3aed' : 'rgba(124,58,237,0.15)';
        el.style.color       = (_activeShiftFilter === s) ? '#fff' : '#a78bfa';
        el.style.borderColor = (_activeShiftFilter === s) ? '#7c3aed' : 'rgba(124,58,237,0.3)';
    });
    _renderStaffGrid();
};

function _renderStaffGrid() {
    const counts = {};
    _caseData.forEach(d => {
        const k     = d.sender_name;
        const t     = d.case_type||'';
        const shift = _getShift(k, d.full_name, _shiftMap);

        // กรองตามประเภท
        const matchType =
            _activeTypeFilter === 'ALL' ||
            (_activeTypeFilter === 'ลบ'    && t.includes('ลบ')) ||
            (_activeTypeFilter === 'เช็ค'  && t.includes('เช็ค')) ||
            (_activeTypeFilter === 'ปลด'   && t.includes('ปลด')) ||
            (_activeTypeFilter === 'other' && !t.includes('ลบ') && !t.includes('เช็ค') && !t.includes('ปลด'));
        // กรองตามกะ
        const matchShift = _activeShiftFilter === 'ALL' || shift === _activeShiftFilter;

        if (!matchType || !matchShift) return;

        if (!counts[k]) counts[k] = { total:0, ลบ:0, เช็ค:0, ปลด:0, reply:0, sites:{}, shift, fullName: d.full_name||'' };
        counts[k].total++;
        if (t.includes('ลบ'))        counts[k].ลบ++;
        else if (t.includes('เช็ค')) counts[k].เช็ค++;
        else if (t.includes('ปลด'))  counts[k].ปลด++;
        else                          counts[k].reply++;
        const site = d.site||'OTHER';
        counts[k].sites[site] = (counts[k].sites[site]||0) + 1;
    });
    window._staffCounts = counts;
    _renderStaffCards(counts, document.querySelector('input[oninput*="searchStaff"]')?.value||'');
}

function _renderStaffCards(counts, search) {
    const grid   = document.getElementById('caseStaffGrid');
    if (!grid) return;
    const sorted = Object.entries(counts)
        .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
        .filter(([,c]) => c.total > 0)
        .sort((a,b) => b[1].total - a[1].total);

    if (sorted.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400">
            <span class="material-icons text-4xl">inbox</span>
            <p class="mt-2 text-sm">${search ? 'ไม่พบชื่อที่ค้นหา' : 'ไม่พบข้อมูล'}</p></div>`;
        return;
    }
    const max    = sorted[0][1].total || 1;
    const medals = ['🥇','🥈','🥉'];

    grid.innerHTML = sorted.map(([name, c], i) => {
        const pct   = Math.round((c.total/max)*100);
        const mdl   = medals[i] || `#${i+1}`;
        const ring  = i===0 ? 'outline:2px solid #facc15;' : '';
        const shift = c.shift || _getShift(name, c.fullName, _shiftMap);
        const shiftColor = shift==='กะเช้า' ? '#fbbf24' : shift==='กะดึก' ? '#818cf8' : '#64748b';
        const shiftIcon  = shift==='กะเช้า' ? '🌅' : shift==='กะดึก' ? '🌙' : '❓';

        const typeTags = [
            c.ลบ    ? `<span style="background:rgba(59,130,246,0.2);color:#60a5fa;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;">ลบ ${c.ลบ}</span>`:'',
            c.เช็ค  ? `<span style="background:rgba(16,185,129,0.2);color:#34d399;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;">เช็ค ${c.เช็ค}</span>`:'',
            c.ปลด   ? `<span style="background:rgba(245,158,11,0.2);color:#fbbf24;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;">ปลด ${c.ปลด}</span>`:'',
            c.reply ? `<span style="background:rgba(100,116,139,0.2);color:#94a3b8;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;">อื่นๆ ${c.reply}</span>`:'',
        ].filter(Boolean).join('');

        const siteTags = Object.entries(c.sites).sort((a,b)=>b[1]-a[1])
            .map(([s,n]) => `<span style="background:rgba(14,165,233,0.15);color:#38bdf8;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:700;">${s}×${n}</span>`)
            .join('');

        const safeName    = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const displayName = (()=>{ const m = name.match(/^[^-]+-([^-]+)-/); return m ? m[1] : name; })();
        return `
        <div onclick="openStaffDetail('${safeName}')"
             style="cursor:pointer;background:#1e293b;border-radius:12px;padding:16px;border:1px solid #334155;transition:all .15s;${ring}"
             onmouseover="this.style.background='#263548';this.style.borderColor='#7c3aed'"
             onmouseout="this.style.background='#1e293b';this.style.borderColor='#334155'">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <span style="font-size:20px;flex-shrink:0;">${mdl}</span>
                    <span style="font-weight:700;color:#f1f5f9;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${name}">${displayName}</span>
                </div>
                <span style="font-size:24px;font-weight:900;color:#a78bfa;flex-shrink:0;">${c.total}</span>
            </div>
            <div style="margin-bottom:8px;">
                <span style="font-size:11px;font-weight:700;color:${shiftColor};background:${shiftColor}22;padding:2px 8px;border-radius:999px;">
                    ${shiftIcon} กะ${shift}
                </span>
            </div>
            <div style="width:100%;background:#334155;border-radius:999px;height:5px;margin-bottom:8px;">
                <div style="background:#7c3aed;height:5px;border-radius:999px;width:${pct}%;"></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:${siteTags?'5px':'0'};">${typeTags}</div>
            ${siteTags?`<div style="display:flex;flex-wrap:wrap;gap:4px;">${siteTags}</div>`:''}
        </div>`;
    }).join('');
}

// ─── ค้นหาชื่อพนักงาน ────────────────────
window.searchStaff = function(val) {
    _renderStaffCards(window._staffCounts || {}, val);
};

// ─── ปุ่ม "ของฉัน" ───────────────────────
let _myCaseOnly = false;
window.toggleMyCase = function() {
    _myCaseOnly = !_myCaseOnly;
    const btn = document.getElementById('btnMyCase');
    if (btn) {
        btn.style.background   = _myCaseOnly ? '#059669' : 'rgba(16,185,129,0.15)';
        btn.style.color        = _myCaseOnly ? '#fff' : '#34d399';
        btn.style.borderColor  = _myCaseOnly ? '#059669' : 'rgba(16,185,129,0.3)';
    }
    if (_myCaseOnly) {
        const myName = (window.currentUser||{}).username || '';
        // ค้นหาชื่อตัวเองในแผนที่
        const counts = window._staffCounts || {};
        // ลอง match กับ sender_name โดยตรง หรือ match กับชื่อกลาง
        const matched = Object.keys(counts).find(k => {
            if (k === myName) return true;
            const m = k.match(/^[^-]+-([^-]+)-/);
            return m && m[1].toLowerCase() === myName.toLowerCase();
        });
        const inp = document.getElementById('staffSearchInput');
        if (inp) inp.value = matched || myName;
        _renderStaffCards(counts, matched || myName);
    } else {
        const inp = document.getElementById('staffSearchInput');
        if (inp) inp.value = '';
        _renderStaffCards(window._staffCounts || {}, '');
    }
};

// ─── Popup รายละเอียดพนักงาน ─────────────
window.openStaffDetail = function(name) {
    const rows = _caseData.filter(d => d.sender_name === name)
        .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

    const badge = t => {
        if ((t||'').includes('ลบ'))   return `<span style="background:rgba(59,130,246,0.25);color:#93c5fd;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${t}</span>`;
        if ((t||'').includes('เช็ค')) return `<span style="background:rgba(16,185,129,0.25);color:#6ee7b7;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${t}</span>`;
        if ((t||'').includes('ปลด'))  return `<span style="background:rgba(245,158,11,0.25);color:#fde68a;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${t}</span>`;
        return `<span style="background:rgba(100,116,139,0.25);color:#cbd5e1;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${t||'reply'}</span>`;
    };

    const html = rows.map((d,i) => {
        const t          = new Date(d.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
        const myMsg      = d.message_text || '—';
        const quotedMsg  = d.quoted_text  || '';
        const qf         = d.quoted_from  || '—';
        return `
        <div style="background:#0f172a;border-radius:10px;padding:12px 14px;border:1px solid #1e293b;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:11px;color:#64748b;font-weight:700;font-family:monospace;">${i+1}. ${t}</span>
                ${badge(d.case_type)}
                <span style="font-size:11px;color:#38bdf8;font-weight:700;">${d.site||''}</span>
            </div>
            ${quotedMsg ? `
            <div style="background:#1e293b;border-left:3px solid #475569;border-radius:6px;padding:8px 10px;margin-bottom:8px;">
                <div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:3px;">📌 ข้อความต้นทาง (จาก ${qf})</div>
                <div style="font-size:12px;color:#94a3b8;line-height:1.5;">${quotedMsg}</div>
            </div>` : ''}
            <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="font-size:11px;color:#7c3aed;font-weight:700;flex-shrink:0;">↩ ตอบ:</span>
                <div style="font-size:13px;color:#e2e8f0;line-height:1.5;">${myMsg}</div>
            </div>
        </div>`;
    }).join('');

    Swal.fire({
        title: `<span style="font-size:16px;">📋 ${name} — ${rows.length} เคส</span>`,
        html:  `<div style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow-y:auto;text-align:left;">${html}</div>`,
        background:      '#1e293b',
        color:           '#e2e8f0',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#7c3aed',
        width:           '600px',
    });
};

// ─── Log Table ────────────────────────────
function _renderLogTable() {
    const tbody = document.getElementById('caseLogBody');
    const total = _caseData.length;
    const el    = document.getElementById('caseLogCount');
    if (el) el.textContent = `ทั้งหมด ${total.toLocaleString()} รายการ`;
    const start = (_casePage-1)*_casePageSize;
    const page  = _caseData.slice(start, start+_casePageSize);
    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">ไม่มีข้อมูล</td></tr>`;
        _renderPagination(0); return;
    }
    const badge = t => {
        if ((t||'').includes('ลบ'))   return `<span class="bg-blue-900/50 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">${t}</span>`;
        if ((t||'').includes('เช็ค')) return `<span class="bg-emerald-900/50 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">${t}</span>`;
        if ((t||'').includes('ปลด'))  return `<span class="bg-amber-900/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">${t}</span>`;
        return `<span class="bg-slate-700 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full">${t||'reply'}</span>`;
    };
    tbody.innerHTML = page.map((d,i) => {
        const ts  = new Date(d.created_at);
        const t   = ts.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        const msg = (d.message_text||'').slice(0,60) + ((d.message_text||'').length>60?'…':'');
        return `<tr class="hover:bg-slate-800/30 transition">
            <td class="p-3 text-center text-gray-500 text-xs">${start+i+1}</td>
            <td class="p-3 text-xs text-gray-400 font-mono">${t}</td>
            <td class="p-3 font-bold text-sm text-violet-300">${d.sender_name}</td>
            <td class="p-3">${badge(d.case_type)}</td>
            <td class="p-3 text-xs font-bold text-sky-400">${d.site||'—'}</td>
            <td class="p-3 text-xs text-gray-500 font-mono">${d.quoted_from||'—'}</td>
            <td class="p-3 text-xs text-gray-400 max-w-[200px] truncate" title="${d.message_text||''}">${msg||'—'}</td>
        </tr>`;
    }).join('');
    _renderPagination(total);
}
function _renderPagination(total) {
    const pages = Math.ceil(total/_casePageSize);
    const el    = document.getElementById('casePagination');
    if (!el) return;
    if (pages <= 1) { el.innerHTML=''; return; }
    const from = (_casePage-1)*_casePageSize+1;
    const to   = Math.min(_casePage*_casePageSize, total);
    el.innerHTML = `
        <span>${from}–${to} จาก ${total.toLocaleString()}</span>
        <div class="flex gap-2">
            ${_casePage>1 ? `<button onclick="window._casePrev()" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold">‹ ก่อนหน้า</button>` :''}
            ${_casePage<pages ? `<button onclick="window._caseNext()" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold">ถัดไป ›</button>` : ''}
        </div>`;
}
window._casePrev = () => { _casePage--; _renderLogTable(); };
window._caseNext = () => { _casePage++; _renderLogTable(); };

// ==========================================
// 🤖 BOT SETTINGS
// ==========================================

const BOT_SETTING_KEY      = 'tg_bot_token';
const CHATID_SETTING_KEY   = 'tg_bot_chatid';

window.toggleTokenVisibility = function() {
    const inp  = document.getElementById('botTokenInput');
    const icon = document.getElementById('tokenEyeIcon');
    if (inp.type === 'password') { inp.type='text'; icon.textContent='visibility_off'; }
    else                          { inp.type='password'; icon.textContent='visibility'; }
};

window.openBotSettings = function() { switchCaseTab('settings'); };

// โหลดสถานะบอทจาก settings
async function _loadBotStatus() {
    try {
        const { data } = await appDB.from('settings')
            .select('key,value')
            .in('key', [BOT_SETTING_KEY, CHATID_SETTING_KEY]);
        const map = {};
        (data||[]).forEach(r => { map[r.key] = r.value; });

        const token  = map[BOT_SETTING_KEY]    || '';
        const chatId = map[CHATID_SETTING_KEY] || '';

        const inp1 = document.getElementById('botTokenInput');
        const inp2 = document.getElementById('botChatIdInput');
        if (inp1 && token)  inp1.value = token;
        if (inp2 && chatId) inp2.value = chatId;

        if (token) {
            await _verifyBotToken(token, chatId, false); // เช็คเงียบๆ
        } else {
            _setBotStatusUI(false, null, chatId);
        }
    } catch(e) { console.warn('loadBotStatus:', e); }
}

// ทดสอบการเชื่อมต่อ
window.testBotConnection = async function() {
    const token  = (document.getElementById('botTokenInput')?.value||'').trim();
    const chatId = (document.getElementById('botChatIdInput')?.value||'').trim();
    if (!token) return _showTestResult(false, 'กรุณาใส่ Bot Token ก่อน');
    const btn = document.getElementById('btnTestBot');
    btn.innerHTML = `<span class="material-icons text-sm animate-spin">sync</span> กำลังทดสอบ...`;
    btn.disabled  = true;
    await _verifyBotToken(token, chatId, true);
    btn.innerHTML = `<span class="material-icons text-sm">wifi_tethering</span> ทดสอบ`;
    btn.disabled  = false;
};

async function _verifyBotToken(token, chatId, showResult) {
    try {
        const r    = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const json = await r.json();
        if (!json.ok) throw new Error(json.description || 'Token ไม่ถูกต้อง');
        const bot  = json.result;
        _setBotStatusUI(true, bot, chatId);
        if (showResult) _showTestResult(true, `เชื่อมต่อสำเร็จ! ชื่อบอท: ${bot.first_name} (@${bot.username})`);
        return true;
    } catch(e) {
        _setBotStatusUI(false, null, chatId);
        if (showResult) _showTestResult(false, e.message);
        return false;
    }
}

function _setBotStatusUI(connected, botInfo, chatId) {
    const dot    = document.getElementById('botStatusDot');
    const txt    = document.getElementById('botStatusText');
    const disc   = document.getElementById('btnDisconnect');

    if (dot) dot.className = `w-2 h-2 rounded-full inline-block ${connected ? 'bg-emerald-400' : 'bg-gray-400'}`;
    if (txt) txt.textContent = connected
        ? `เชื่อมต่อแล้ว: @${botInfo?.username || '...'}`
        : 'ยังไม่ได้เชื่อมต่อบอท';

    const sName     = document.getElementById('sBot_name');
    const sUser     = document.getElementById('sBot_username');
    const sStatus   = document.getElementById('sBot_status');
    const sChatId   = document.getElementById('sBot_chatid');

    if (sStatus) sStatus.textContent = connected ? '✅ เชื่อมต่อแล้ว' : '❌ ไม่ได้เชื่อมต่อ';
    if (sStatus) sStatus.className   = `font-bold ${connected ? 'text-emerald-400' : 'text-red-400'}`;
    if (sName)   sName.textContent   = botInfo?.first_name || '—';
    if (sUser)   sUser.textContent   = botInfo ? `@${botInfo.username}` : '—';
    if (sChatId) sChatId.textContent = chatId || '—';
    if (disc)    disc.classList.toggle('hidden', !connected);
}

function _showTestResult(ok, msg) {
    const el = document.getElementById('botTestResult');
    if (!el) return;
    el.className = `mt-4 p-4 rounded-xl text-sm font-bold ${ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`;
    el.textContent = (ok ? '✅ ' : '❌ ') + msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

// บันทึก settings
window.saveBotSettings = async function() {
    const token  = (document.getElementById('botTokenInput')?.value||'').trim();
    const chatId = (document.getElementById('botChatIdInput')?.value||'').trim();
    if (!token) return Swal.fire('แจ้งเตือน','กรุณาใส่ Bot Token','warning');

    const btn = document.getElementById('btnSaveBot');
    btn.innerHTML = `<span class="material-icons text-sm animate-spin">sync</span> กำลังบันทึก...`;
    btn.disabled  = true;

    // ทดสอบก่อนบันทึก
    const ok = await _verifyBotToken(token, chatId, false);
    if (!ok) {
        btn.innerHTML = `<span class="material-icons text-sm">save</span> บันทึกและเชื่อมต่อ`;
        btn.disabled  = false;
        return Swal.fire('ผิดพลาด','Bot Token ไม่ถูกต้อง — กรุณาตรวจสอบใหม่','error');
    }

    try {
        await appDB.from('settings').upsert([
            { key: BOT_SETTING_KEY,    value: token  },
            { key: CHATID_SETTING_KEY, value: chatId },
        ]);

        // บันทึกเวลา
        const now = new Date().toLocaleString('th-TH');
        const sSaved = document.getElementById('sBot_saved');
        if (sSaved) sSaved.textContent = now;

        Swal.fire({ icon:'success', title:'บันทึกแล้ว', text:'เชื่อมต่อบอทเรียบร้อย', timer:2000, showConfirmButton:false });
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    } finally {
        btn.innerHTML = `<span class="material-icons text-sm">save</span> บันทึกและเชื่อมต่อ`;
        btn.disabled  = false;
    }
};

// ยกเลิกการเชื่อมต่อ
window.disconnectBot = async function() {
    const res = await Swal.fire({
        title:'ยืนยันการยกเลิก?',
        text:'จะลบ Token ออกจากระบบ',
        icon:'warning',
        showCancelButton:true,
        confirmButtonText:'ยืนยัน',
        cancelButtonText:'ยกเลิก',
        confirmButtonColor:'#ef4444'
    });
    if (!res.isConfirmed) return;
    await appDB.from('settings').delete().in('key',[BOT_SETTING_KEY, CHATID_SETTING_KEY]);
    document.getElementById('botTokenInput').value  = '';
    document.getElementById('botChatIdInput').value = '';
    _setBotStatusUI(false, null, '');
    Swal.fire({ icon:'success', title:'ยกเลิกแล้ว', timer:1500, showConfirmButton:false });
};

// วิธีหา Chat ID
window.helpGetChatId = function() {
    Swal.fire({
        title: 'วิธีหา Chat ID',
        html: `
            <div class="text-left text-sm space-y-3">
                <p>1. เพิ่ม <strong>@userinfobot</strong> เข้ากลุ่ม</p>
                <p>2. พิมพ์ <strong>/start</strong> ในกลุ่ม</p>
                <p>3. บอทจะตอบกลับพร้อม Chat ID (เริ่มด้วย -100...)</p>
                <hr class="border-slate-600 my-2">
                <p>หรือใช้วิธีนี้:</p>
                <p>1. Forward ข้อความจากกลุ่มไปให้ <strong>@getidsbot</strong></p>
                <p>2. บอทจะบอก Chat ID ให้</p>
            </div>`,
        confirmButtonText: 'เข้าใจแล้ว',
        background: '#1e293b',
        color: '#e2e8f0'
    });
};

// ─── Export Excel ──────────────────────────
window.exportCaseExcel = async function() {
    if (!_caseData.length) return Swal.fire('แจ้งเตือน','ไม่มีข้อมูล','warning');

    // โหลด SheetJS ถ้ายังไม่มี
    if (typeof XLSX === 'undefined') {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    const rows = [['#','เวลา','พนักงาน','ประเภท','เว็บ','ตอบใคร','ข้อความ']];
    _caseData.forEach((d,i) => {
        const t = new Date(d.created_at).toLocaleTimeString('th-TH');
        rows.push([i+1, t, d.sender_name, d.case_type||'reply', d.site||'', d.quoted_from||'', d.message_text||'']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cases');
    XLSX.writeFile(wb, `tg_cases_${_caseDate}.xlsx`);
};

// ==========================================
// 📊 สรุปรายการรวม (เดือน/สัปดาห์)
// ==========================================

window.loadSummary = async function() {
    const period = document.getElementById('summaryPeriod')?.value || 'month';
    const customDiv = document.getElementById('summaryCustomRange');

    // แสดง/ซ่อน custom range
    if (customDiv) customDiv.classList.toggle('hidden', period !== 'custom');

    // คำนวณ date range
    const now   = new Date();
    const thNow = new Date(now.getTime() + 7*60*60*1000);
    let fromDate, toDate;

    if (period === 'week') {
        const day = thNow.getDay() || 7;
        const mon = new Date(thNow); mon.setDate(thNow.getDate() - day + 1);
        fromDate  = mon.toISOString().slice(0,10);
        toDate    = thNow.toISOString().slice(0,10);
    } else if (period === 'last_week') {
        const day = thNow.getDay() || 7;
        const mon = new Date(thNow); mon.setDate(thNow.getDate() - day - 6);
        const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
        fromDate  = mon.toISOString().slice(0,10);
        toDate    = sun.toISOString().slice(0,10);
    } else if (period === 'month') {
        fromDate  = `${thNow.getFullYear()}-${String(thNow.getMonth()+1).padStart(2,'0')}-01`;
        toDate    = thNow.toISOString().slice(0,10);
    } else if (period === 'last_month') {
        const lm  = new Date(thNow.getFullYear(), thNow.getMonth()-1, 1);
        const lme = new Date(thNow.getFullYear(), thNow.getMonth(), 0);
        fromDate  = lm.toISOString().slice(0,10);
        toDate    = lme.toISOString().slice(0,10);
    } else {
        fromDate = document.getElementById('summaryFrom')?.value;
        toDate   = document.getElementById('summaryTo')?.value;
        if (!fromDate || !toDate) return;
    }

    // แสดงช่วงวันที่
    const rangeEl = document.getElementById('summaryDateRange');
    if (rangeEl) rangeEl.textContent = `${fromDate} ถึง ${toDate}`;

    // Loading
    document.getElementById('summaryRanking').innerHTML =
        `<div class="text-center py-8"><span class="material-icons animate-spin text-violet-400 text-3xl">sync</span></div>`;

    try {
        const { data, error } = await appDB
            .from('tg_case_logs')
            .select('sender_name, case_type, site, full_name')
            .gte('msg_date', fromDate)
            .lte('msg_date', toDate);
        if (error) throw error;

        const rows = data || [];

        // summary cards
        const total = rows.length;
        const del   = rows.filter(d => (d.case_type||'').includes('ลบ')).length;
        const unb   = rows.filter(d => (d.case_type||'').includes('ปลด')).length;
        const other = rows.filter(d => { const t=d.case_type||''; return !t.includes('ลบ')&&!t.includes('เช็ค')&&!t.includes('ปลด'); }).length;
        document.getElementById('sumTotal').textContent = total.toLocaleString();
        document.getElementById('sumDel').textContent   = del.toLocaleString();
        document.getElementById('sumUnb').textContent   = unb.toLocaleString();
        document.getElementById('sumOther').textContent = other.toLocaleString();

        // นับต่อคน
        const counts = {};
        rows.forEach(d => {
            const k = d.sender_name;
            if (!counts[k]) counts[k] = { total:0, ลบ:0, เช็ค:0, ปลด:0, other:0,
                shift: _getShift(k, d.full_name, _shiftMap),
                display: (()=>{ const m=(k||'').match(/^[^-]+-([^-]+)-/); return m?m[1]:k; })()
            };
            counts[k].total++;
            const t = d.case_type||'';
            if (t.includes('ลบ'))        counts[k].ลบ++;
            else if (t.includes('เช็ค')) counts[k].เช็ค++;
            else if (t.includes('ปลด'))  counts[k].ปลด++;
            else                          counts[k].other++;
        });

        const sorted = Object.entries(counts).sort((a,b) => b[1].total - a[1].total);
        const max    = sorted[0]?.[1]?.total || 1;
        const medals = ['🥇','🥈','🥉'];

        const ranking = document.getElementById('summaryRanking');
        if (sorted.length === 0) {
            ranking.innerHTML = `<div class="text-center py-8 text-gray-400">ไม่มีข้อมูลในช่วงนี้</div>`;
            return;
        }

        ranking.innerHTML = sorted.map(([name, c], i) => {
            const pct   = Math.round((c.total/max)*100);
            const mdl   = medals[i] || `#${i+1}`;
            const shiftColor = c.shift==='กะเช้า'?'#fbbf24':c.shift==='กะดึก'?'#818cf8':'#64748b';
            const shiftIcon  = c.shift==='กะเช้า'?'🌅':c.shift==='กะดึก'?'🌙':'❓';
            const tags = [
                c.ลบ    ? `<span style="background:rgba(59,130,246,0.2);color:#60a5fa;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;">ลบ ${c.ลบ}</span>`:'',
                c.เช็ค  ? `<span style="background:rgba(16,185,129,0.2);color:#34d399;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;">เช็ค ${c.เช็ค}</span>`:'',
                c.ปลด   ? `<span style="background:rgba(245,158,11,0.2);color:#fbbf24;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;">ปลด ${c.ปลด}</span>`:'',
                c.other ? `<span style="background:rgba(100,116,139,0.2);color:#94a3b8;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;">อื่นๆ ${c.other}</span>`:'',
            ].filter(Boolean).join('');

            return `
            <div style="background:#0f172a;border-radius:12px;padding:12px 16px;border:1px solid #1e293b;display:flex;align-items:center;gap:12px;">
                <span style="font-size:22px;flex-shrink:0;width:32px;text-align:center;">${mdl}</span>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-weight:800;color:#f1f5f9;font-size:14px;">${c.display}</span>
                        <span style="font-size:10px;font-weight:700;color:${shiftColor};background:${shiftColor}22;padding:1px 7px;border-radius:999px;">${shiftIcon}${c.shift}</span>
                    </div>
                    <div style="width:100%;background:#1e293b;border-radius:999px;height:5px;margin-bottom:6px;">
                        <div style="background:#7c3aed;height:5px;border-radius:999px;width:${pct}%;transition:width .5s;"></div>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:5px;">${tags}</div>
                </div>
                <span style="font-size:28px;font-weight:900;color:#a78bfa;flex-shrink:0;min-width:40px;text-align:right;">${c.total}</span>
            </div>`;
        }).join('');

    } catch(e) {
        document.getElementById('summaryRanking').innerHTML =
            `<div class="text-center py-8 text-red-400">Error: ${e.message}</div>`;
    }
};

// custom date range toggle
document.addEventListener('change', e => {
    if (e.target?.id === 'summaryPeriod') {
        const show = e.target.value === 'custom';
        document.getElementById('summaryCustomRange')?.classList.toggle('hidden', !show);
    }
});
