// ==========================================
// 🔍 OD CENTER — ตรวจลิงก์เว็บอัตโนมัติ
// ==========================================

let odcWebsites = [];   // [{ id, name, emoji, color, links: [{key, label, url, type}] }]
let odcResults = {};    // { 'webId.linkKey': { status: 'ok'|'fail'|'manual_ok'|'manual_fail'|'pending', time, detail } }
let odcCurrentRound = null; // { date, time, assignee, started_at }

// LINK_TYPES: 'auto' = ตรวจอัตโนมัติได้, 'manual' = ต้องมือถือเช็ค (เช่น APK), 'speculator' = ตรวจไฟล์ CSV
const ODC_LINK_TYPES = {
    'login':    { label: 'ลิ้งค์เข้าสู่ระบบ',           type: 'auto',       icon: 'login' },
    'referral': { label: 'ลิ้งค์ แนะนำเพื่อน',           type: 'auto',       icon: 'group_add' },
    'apk':      { label: 'ลิ้งค์ดาวน์โหลดแอปพลิเคชัน',  type: 'manual',     icon: 'phone_android' },
    'group':    { label: 'ตรวจสอบกลุ่มเก็งกำไร',         type: 'speculator', icon: 'forum' }
};

// หลังบ้านที่รองรับ — แต่ละหลังบ้านมี mapping column ต่างกัน
const ODC_BACKEND_TYPES = {
    'k36': {
        label: 'K36',
        usernameCol: 'Player ID',
        depositCountCol: 'Total Deposit Count',
        depositSumCol: 'Total Deposit',
        levelGroupCol: 'Level & Group',
        kgiKeyword: 'KGI'
    },
    'tcg': {
        label: 'TCG',
        usernameCol: 'Player ID',
        depositCountCol: 'Total Deposit Count',
        depositSumCol: 'Total Deposit',
        levelGroupCol: 'Level & Group',
        kgiKeyword: 'KGI'
    },
    'wg': {
        label: 'WG',
        usernameCol: 'Player ID',
        depositCountCol: 'Total Deposit Count',
        depositSumCol: 'Total Deposit',
        levelGroupCol: 'Level & Group',
        kgiKeyword: 'KGI'
    }
};

// default websites — admin แก้ได้ทีหลัง
// backend: หลังบ้านของเว็บนี้ใช้อะไร (k36/tcg/wg) สำหรับตรวจกลุ่มเก็งกำไร
const ODC_DEFAULT_WEBSITES = [
    { id: 'jun88', name: 'Jun88', emoji: '🔵', color: '#3b82f6', backend: 'k36', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'mk8',   name: 'MK8',   emoji: '⚫️', color: '#0f172a', backend: 'k36', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'f168',  name: 'F168',  emoji: '🟠', color: '#f97316', backend: 'k36', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'pg688', name: 'PG688', emoji: '🟣', color: '#a855f7', backend: 'k36', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'jl69',  name: 'JL69',  emoji: '🟡', color: '#eab308', backend: 'k36', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'nm9',   name: 'NM9',   emoji: '🔴', color: '#ef4444', backend: 'k36', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'vv72',  name: 'VV72',  emoji: '🔘', color: '#64748b', backend: 'tcg', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'th26',  name: 'TH26',  emoji: '🟤', color: '#92400e', backend: 'tcg', links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'k188',  name: 'K188',  emoji: '🩷', color: '#ec4899', backend: 'wg',  links: { login: '', referral: '', apk: '', group: '' } },
    { id: 'bt678', name: 'BT678', emoji: '⚪️', color: '#94a3b8', backend: 'wg',  links: { login: '', referral: '', apk: '', group: '' } }
];

// เก็บผลการตรวจกลุ่มเก็งกำไรของแต่ละเว็บ (ในรอบปัจจุบัน)
let odcSpeculatorData = {}; // { webId: [{username, count, deposit}, ...] }

// ==========================================
// 🔍 SPECULATOR CHECK — ตรวจกลุ่มเก็งกำไร (อัพ CSV → filter ฝาก ≥ 2)
// ==========================================

// helper: parse CSV (รองรับ quoted, comma in quotes, =""xxx"" pattern)
function odc_parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const lines = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') { inQuotes = !inQuotes; cur += c; }
        else if (c === '\n' && !inQuotes) { lines.push(cur); cur = ''; }
        else if (c === '\r' && !inQuotes) { /* skip */ }
        else { cur += c; }
    }
    if (cur) lines.push(cur);

    function parseLine(line) {
        const cells = [];
        let cell = '';
        let q = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (q && line[i+1] === '"') { cell += '"'; i++; continue; }
                q = !q;
            } else if (c === ',' && !q) { cells.push(cell); cell = ''; }
            else { cell += c; }
        }
        cells.push(cell);
        return cells.map(v => {
            v = v.trim();
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            const m = v.match(/^=\s*"(.*)"$/);
            if (m) v = m[1];
            return v;
        });
    }

    const rows = lines.filter(l => l.trim()).map(parseLine);
    if (rows.length === 0) return { headers: [], data: [] };
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
    });
    return { headers, data };
}

window.odc_openSpeculatorCheck = async function(webId) {
    const w = odcWebsites.find(w => w.id === webId);
    if (!w) return;

    const backendKey = w.backend || 'k36';
    const backend = ODC_BACKEND_TYPES[backendKey] || ODC_BACKEND_TYPES['k36'];
    const savedResults = odcSpeculatorData[webId] || [];

    function buildResultsHTML(results) {
        if (!results || results.length === 0) {
            return `<div class="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-8 text-center">
                <span class="material-icons text-gray-400 text-[48px] opacity-50">cloud_upload</span>
                <p class="text-sm font-bold text-gray-500 mt-2">อัพโหลดไฟล์ CSV เพื่อตรวจ</p>
                <p class="text-[11px] text-gray-400 mt-1">ระบบจะกรองเฉพาะ <b class="text-red-500">【KGI】-ชั้นเก็งกำไร</b> ที่ฝาก ≥ 2 ครั้ง</p>
            </div>`;
        }

        // เรียงตาม count มาก→น้อย
        const sorted = [...results].sort((a, b) => b.count - a.count);

        const itemsHtml = sorted.map((r, i) => {
            const warnIcon = r.count >= 5 ? '⚠️' : (r.count >= 3 ? '🟠' : '🟡');
            const safeUsername = (r.username || '').replace(/</g, '&lt;');
            const safeLvl = (r.levelGroup || '').replace(/</g, '&lt;');
            return `<div class="bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600 ring-1 ring-red-300 dark:ring-red-700 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div class="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100 rounded-lg w-8 h-8 flex items-center justify-center shrink-0 text-sm font-black">${i+1}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-mono font-bold text-sm text-slate-800 dark:text-white truncate flex items-center gap-1.5 flex-wrap">
                        ${safeUsername}
                        <span class="inline-flex items-center gap-0.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">⚠️ KGI</span>
                    </div>
                    <div class="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                        ${r.deposit ? `<span>ยอดรวม: ${r.deposit}</span>` : ''}
                        ${safeLvl ? `<span class="text-red-600 dark:text-red-300 font-bold">📊 ${safeLvl}</span>` : ''}
                    </div>
                </div>
                <div class="flex flex-col items-end shrink-0">
                    <div class="text-base font-black text-red-600 dark:text-red-400 flex items-center gap-1">${warnIcon} ${r.count}</div>
                    <div class="text-[9px] text-gray-500">ครั้ง</div>
                </div>
            </div>`;
        }).join('');

        return `<div class="space-y-1.5 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
            <div class="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-md mb-2">
                <span class="material-icons text-[16px]">warning</span>
                🚨 ชั้นเก็งกำไร KGI ฝาก ≥ 2 ครั้ง — ${sorted.length} ยูสเซอร์
            </div>
            ${itemsHtml}
        </div>`;
    }

    const formHtml = `
        <div class="text-left space-y-3">
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-3 text-sm">
                <div class="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 mb-1">
                    <span class="material-icons text-[16px]">info</span>วิธีใช้งาน
                </div>
                <ol class="text-xs text-slate-700 dark:text-gray-200 ml-4 space-y-0.5 list-decimal">
                    <li>ดึงข้อมูล Player List จากหลังบ้าน <b>${backend.label}</b> (ล็อคช่วงเวลาที่ต้องการก่อน export)</li>
                    <li>กดปุ่ม "เลือกไฟล์ CSV" → ระบบกรองเฉพาะ <b class="text-red-500">【KGI】-ชั้นเก็งกำไร</b> ที่ฝาก ≥ 2 ครั้ง</li>
                    <li>ดูรายชื่อ → ส่ง Telegram ได้</li>
                </ol>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
                <label class="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">หลังบ้าน:</label>
                <select id="odcSpecBackend" class="bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white px-3 py-1.5 rounded-lg text-sm font-bold outline-none focus:border-amber-500">
                    ${Object.keys(ODC_BACKEND_TYPES).map(k => `<option value="${k}" ${k === backendKey ? 'selected' : ''}>${ODC_BACKEND_TYPES[k].label}</option>`).join('')}
                </select>
                <span class="text-[10px] text-gray-500 italic">เปลี่ยนหลังบ้านได้ → จะจดจำไว้</span>
            </div>

            <div class="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-4 text-center">
                <input type="file" id="odcSpecFile" accept=".csv" class="hidden" onchange="odc_handleSpeculatorFile(event, '${webId}')">
                <button type="button" onclick="document.getElementById('odcSpecFile').click()" class="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md transition active:scale-95 mx-auto">
                    <span class="material-icons">upload_file</span>เลือกไฟล์ CSV
                </button>
                <p class="text-[10px] text-gray-500 mt-2">รองรับ CSV จากหลังบ้าน K36 / TCG / WG</p>
            </div>

            <div id="odcSpecStats" class="${savedResults.length > 0 ? '' : 'hidden'} grid grid-cols-3 gap-2">
                <div class="bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600 rounded-lg p-2 text-center ring-1 ring-red-300 dark:ring-red-700">
                    <div class="text-[9px] font-bold text-red-700 dark:text-red-300 uppercase">⚠️ KGI ฝาก ≥ 2</div>
                    <div class="text-lg font-black text-red-700 dark:text-red-300" id="odcSpecTotal">${savedResults.length}</div>
                </div>
                <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg p-2 text-center">
                    <div class="text-[9px] font-bold text-orange-600 uppercase">ฝาก 3+ ครั้ง</div>
                    <div class="text-lg font-black text-orange-700 dark:text-orange-300" id="odcSpec3plus">${savedResults.filter(r => r.count >= 3).length}</div>
                </div>
                <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-700 rounded-lg p-2 text-center">
                    <div class="text-[9px] font-bold text-rose-600 uppercase">ฝาก 5+ ครั้ง</div>
                    <div class="text-lg font-black text-rose-700 dark:text-rose-300" id="odcSpecKgi">${savedResults.filter(r => r.count >= 5).length}</div>
                </div>
            </div>

            <div id="odcSpecResults">${buildResultsHTML(savedResults)}</div>

            <div id="odcSpecActions" class="${savedResults.length > 0 ? '' : 'hidden'} flex gap-2 justify-center pt-2 border-t border-gray-200 dark:border-slate-700">
                <button type="button" onclick="odc_speculatorCopy('${webId}')" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1 shadow-sm transition active:scale-95">
                    <span class="material-icons text-[16px]">content_copy</span>คัดลอก
                </button>
                <button type="button" onclick="odc_speculatorSendTelegram('${webId}')" class="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1 shadow-sm transition active:scale-95">
                    <span class="material-icons text-[16px]">send</span>ส่ง Telegram
                </button>
            </div>
        </div>
    `;

    window._odcSpecBuildHTML = buildResultsHTML;

    await Swal.fire({
        title: `<div class="text-base font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-amber-500">forum</span> ${w.emoji || ''} ${w.name} — กลุ่มเก็งกำไร</div>`,
        html: formHtml,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">check</span> ตรวจสอบเรียบร้อย',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        didOpen: () => {
            const sel = document.getElementById('odcSpecBackend');
            if (sel) {
                sel.addEventListener('change', async () => {
                    const idx = odcWebsites.findIndex(x => x.id === webId);
                    if (idx !== -1) {
                        odcWebsites[idx].backend = sel.value;
                        await odc_saveWebsites();
                        sop_showInlineToast(`เปลี่ยนหลังบ้านเป็น ${ODC_BACKEND_TYPES[sel.value].label}`, 'success');
                    }
                });
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            await odc_setManualResult(webId, 'group', true);
        }
    });
};

window.odc_handleSpeculatorFile = async function(event, webId) {
    const file = event.target.files[0];
    if (!file) return;
    const w = odcWebsites.find(w => w.id === webId);
    const backendKey = (document.getElementById('odcSpecBackend')?.value) || w?.backend || 'k36';
    const backend = ODC_BACKEND_TYPES[backendKey] || ODC_BACKEND_TYPES['k36'];

    sop_showInlineToast('กำลังอ่านไฟล์...', 'info');

    try {
        const text = await file.text();
        const { headers, data } = odc_parseCSV(text);

        if (data.length === 0) {
            sop_showInlineToast('ไฟล์ว่างหรืออ่านไม่ได้', 'error');
            return;
        }

        if (!headers.includes(backend.usernameCol) || !headers.includes(backend.depositCountCol)) {
            Swal.fire({
                icon: 'error',
                title: 'ไฟล์ไม่ตรงกับ format',
                html: `<div class="text-left text-sm">
                    ต้องมีคอลัมน์: <br>
                    • <code class="bg-slate-100 dark:bg-slate-900 px-1 rounded">${backend.usernameCol}</code><br>
                    • <code class="bg-slate-100 dark:bg-slate-900 px-1 rounded">${backend.depositCountCol}</code><br><br>
                    <b>คอลัมน์ที่พบในไฟล์:</b><br>
                    <div class="text-xs text-gray-500 mt-1 max-h-32 overflow-y-auto">${headers.join(', ')}</div>
                </div>`,
                confirmButtonColor: '#3b82f6'
            });
            event.target.value = '';
            return;
        }

        const filtered = data
            .map(r => {
                const lvl = r[backend.levelGroupCol] || '';
                const isKgi = backend.kgiKeyword && lvl.includes(backend.kgiKeyword);
                return {
                    username: r[backend.usernameCol] || '',
                    count: parseInt(r[backend.depositCountCol] || '0', 10) || 0,
                    deposit: r[backend.depositSumCol] || '',
                    levelGroup: lvl,
                    isKgi: isKgi
                };
            })
            .filter(r => r.username && r.count >= 2 && r.isKgi);

        odcSpeculatorData[webId] = filtered;
        const toastMsg = filtered.length > 0
            ? `พบ ${filtered.length} ยูส KGI ฝาก ≥ 2 ⚠️`
            : `ไม่พบ User KGI ฝาก ≥ 2 ครั้ง ✅`;
        sop_showInlineToast(toastMsg, filtered.length > 0 ? 'warning' : 'success');

        const statsEl = document.getElementById('odcSpecStats');
        const actionsEl = document.getElementById('odcSpecActions');
        const resultsEl = document.getElementById('odcSpecResults');
        const totalEl = document.getElementById('odcSpecTotal');
        const c3 = document.getElementById('odcSpec3plus');
        const cKgi = document.getElementById('odcSpecKgi');

        if (statsEl) statsEl.classList.remove('hidden');
        if (actionsEl) actionsEl.classList.remove('hidden');
        if (totalEl) totalEl.innerText = filtered.length;
        if (c3) c3.innerText = filtered.filter(r => r.count >= 3).length;
        if (cKgi) cKgi.innerText = filtered.filter(r => r.count >= 5).length;

        if (resultsEl) {
            if (filtered.length === 0) {
                resultsEl.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-xl p-6 text-center">
                    <span class="material-icons text-emerald-500 text-[48px]">check_circle</span>
                    <p class="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-2">เรียบร้อย — ไม่พบ User ชั้นเก็งกำไร KGI ฝาก ≥ 2 ครั้ง</p>
                </div>`;
            } else if (window._odcSpecBuildHTML) {
                resultsEl.innerHTML = window._odcSpecBuildHTML(filtered);
            }
        }
    } catch (e) {
        console.error('parse csv error:', e);
        Swal.fire('Error', 'อ่านไฟล์ไม่ได้: ' + e.message, 'error');
    }
    event.target.value = '';
};

window.odc_speculatorCopy = function(webId) {
    const w = odcWebsites.find(w => w.id === webId);
    const results = odcSpeculatorData[webId] || [];
    if (results.length === 0) { sop_showInlineToast('ไม่มีข้อมูลให้คัดลอก', 'info'); return; }

    const sorted = [...results].sort((a, b) => b.count - a.count);

    let text = `🚨 ชั้นเก็งกำไร KGI ฝาก 2+ ครั้ง — ${w.name}\n`;
    text += `📅 ${new Date().toLocaleDateString('th-TH')}\n`;
    text += `👥 พบ ${sorted.length} ยูสเซอร์ ⚠️\n\n`;
    sorted.forEach((r, i) => {
        text += `${i+1}. ${r.username} → ฝาก ${r.count} ครั้ง [KGI]\n`;
    });

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => sop_showInlineToast('คัดลอกแล้ว ✅', 'success'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        sop_showInlineToast('คัดลอกแล้ว ✅', 'success');
    }
};

window.odc_speculatorSendTelegram = async function(webId) {
    const w = odcWebsites.find(w => w.id === webId);
    const results = odcSpeculatorData[webId] || [];
    if (results.length === 0) { sop_showInlineToast('ไม่มีข้อมูลให้ส่ง', 'info'); return; }

    if (typeof sop_loadTelegramConfig === 'function') await sop_loadTelegramConfig();
    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) {
        Swal.fire('ยังไม่ได้ตั้งค่า Telegram', 'กรุณาไปตั้งค่า Bot Token ในหน้า OD ก่อน', 'warning');
        return;
    }

    const sorted = [...results].sort((a, b) => b.count - a.count);
    const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'admin';

    function buildMsg(list, truncated) {
        let m = `🚨 <b>ชั้นเก็งกำไร KGI ฝาก 2+ ครั้ง — ${w.name}</b> ⚠️\n`;
        m += `📅 ${new Date().toLocaleDateString('th-TH')}\n`;
        m += `👤 ผู้ตรวจ: ${authorName}\n`;
        m += `👥 พบ <b>${results.length}</b> ยูสเซอร์\n\n`;
        list.forEach((r, i) => {
            const warn = r.count >= 5 ? '⚠️' : (r.count >= 3 ? '🟠' : '🟡');
            m += `${i+1}. <code>${r.username}</code> → ${warn} <b>${r.count}</b> ครั้ง\n`;
        });
        if (truncated) m += `\n<i>(แสดง top — กด "คัดลอก" เพื่อดูทั้งหมด)</i>`;
        return m;
    }

    let msg = buildMsg(sorted, false);
    if (msg.length > 4000) {
        const top = sorted.slice(0, 50);
        msg = buildMsg(top, sorted.length > 50);
    }

    Swal.fire({ title: 'กำลังส่ง...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: cfg.chat_id, text: msg, parse_mode: 'HTML' })
        });
        const json = await res.json();
        if (json.ok) Swal.fire({ icon: 'success', title: 'ส่งสำเร็จ! ✅', timer: 1500, showConfirmButton: false });
        else Swal.fire('ส่งไม่สำเร็จ', json.description || 'ไม่ทราบสาเหตุ', 'error');
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// ==========================================
// INIT
// ==========================================
window.initOdCenterApp = async function() {
    await odc_loadWebsites();
    await odc_loadCurrentRound();
    odc_renderWebsites();
    odc_updateStatusBar();

    // แสดง admin controls ถ้าเป็น admin/manager
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('odcenter_manage') : false;
    const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    if (isAdmin) {
        const ctrl = document.getElementById('odcAdminControls');
        if (ctrl) { ctrl.classList.remove('hidden'); ctrl.classList.add('flex'); }
    }
};

// ==========================================
// LOAD/SAVE
// ==========================================
window.odc_loadWebsites = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_websites').single();
        if (data && data.value) {
            odcWebsites = JSON.parse(data.value);
        } else {
            odcWebsites = JSON.parse(JSON.stringify(ODC_DEFAULT_WEBSITES));
            await appDB.from('settings').upsert([{ key: 'odc_websites', value: JSON.stringify(odcWebsites) }]);
        }
    } catch (e) {
        console.warn('Use default websites:', e);
        odcWebsites = JSON.parse(JSON.stringify(ODC_DEFAULT_WEBSITES));
    }
};

window.odc_saveWebsites = async function() {
    await appDB.from('settings').upsert([{ key: 'odc_websites', value: JSON.stringify(odcWebsites) }]);
};

window.odc_loadCurrentRound = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_current_round').single();
        if (data && data.value) {
            odcCurrentRound = JSON.parse(data.value);
            odcResults = odcCurrentRound.results || {};
        }
    } catch (e) {
        odcCurrentRound = null;
        odcResults = {};
    }
};

window.odc_saveCurrentRound = async function() {
    if (!odcCurrentRound) odcCurrentRound = { date: new Date().toISOString().split('T')[0], time: '12:00', assignee: '', started_at: new Date().toISOString() };
    odcCurrentRound.results = odcResults;
    odcCurrentRound.updated_at = new Date().toISOString();
    await appDB.from('settings').upsert([{ key: 'odc_current_round', value: JSON.stringify(odcCurrentRound) }]);
};

// V2: เริ่ม/ใช้รอบของวันนี้อัตโนมัติ — ไม่ต้องกดรับงาน
// ทุกครั้งที่ทำการตรวจ → ระบบเซ็ตชื่อคนทำให้เลย
window.odc_ensureRound = async function() {
    const myUsername = (currentUser && (currentUser.username || currentUser.name)) || '';
    if (!myUsername) return false;

    const today = new Date().toISOString().split('T')[0];
    const isNewRound = !odcCurrentRound || odcCurrentRound.date !== today;

    if (isNewRound) {
        // เริ่มรอบใหม่อัตโนมัติ
        odcCurrentRound = {
            date: today,
            time: '12:00',
            assignee: myUsername,
            started_at: new Date().toISOString(),
            results: {}
        };
        odcResults = {};
    } else if (!odcCurrentRound.assignee || odcCurrentRound.assignee !== myUsername) {
        // ถ้ายังไม่มีชื่อ หรือคนอื่นมาตรวจต่อ → ใช้ชื่อล่าสุด
        odcCurrentRound.assignee = myUsername;
    }

    return true;
};

// (เก็บ claimRound ไว้เผื่อ backward compat แต่ไม่ใช้แล้ว)
window.odc_claimRound = window.odc_ensureRound;

// ==========================================
// AUTO CHECK (ลิงก์ปกติ — ไม่ใช่ APK)
// ==========================================
window.odc_runAllChecks = async function() {
    // V2: auto ensure round — ไม่ต้องถาม
    const ok = await odc_ensureRound();
    if (!ok) {
        Swal.fire('Error', 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 'error');
        return;
    }

    // เก็บ list ลิงก์ที่ตรวจอัตโนมัติได้
    const checks = [];
    odcWebsites.forEach(w => {
        Object.keys(w.links || {}).forEach(linkKey => {
            const url = w.links[linkKey];
            if (!url) return;
            const meta = ODC_LINK_TYPES[linkKey];
            if (!meta || meta.type !== 'auto') return;
            checks.push({ webId: w.id, linkKey, url });
        });
    });

    if (checks.length === 0) {
        Swal.fire('ไม่มีลิงก์ให้ตรวจ', 'กรุณาเพิ่มลิงก์ในหน้า "จัดการเว็บ" ก่อน', 'info');
        return;
    }

    sop_showInlineToast(`กำลังตรวจ ${checks.length} ลิงก์...`, 'info');

    // mark all as pending
    checks.forEach(c => {
        odcResults[`${c.webId}.${c.linkKey}`] = { status: 'pending' };
    });
    odc_renderWebsites();

    // ยิง parallel ทุกลิงก์
    await Promise.all(checks.map(async (c) => {
        const startTime = Date.now();
        try {
            // ใช้ no-cors mode — เช็คว่าเซิร์ฟเวอร์ตอบกลับหรือไม่
            // ถ้า fetch ผ่าน = เซิร์ฟเวอร์ออนไลน์
            // ถ้า fetch error = offline / DNS error / blocked
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 10000);

            await fetch(c.url, {
                method: 'GET',
                mode: 'no-cors',
                signal: ctrl.signal,
                cache: 'no-store'
            });
            clearTimeout(timeout);

            const elapsed = Date.now() - startTime;
            odcResults[`${c.webId}.${c.linkKey}`] = {
                status: 'ok',
                time: elapsed,
                checked_at: new Date().toISOString()
            };
        } catch (e) {
            odcResults[`${c.webId}.${c.linkKey}`] = {
                status: 'fail',
                error: e.name === 'AbortError' ? 'timeout (>10s)' : (e.message || 'connection failed'),
                checked_at: new Date().toISOString()
            };
        }
    }));

    await odc_saveCurrentRound();
    odc_renderWebsites();
    odc_updateStatusBar();

    const okCount = checks.filter(c => odcResults[`${c.webId}.${c.linkKey}`]?.status === 'ok').length;
    sop_showInlineToast(`ตรวจเสร็จ — ${okCount}/${checks.length} ปกติ`, okCount === checks.length ? 'success' : 'info');
};

// ==========================================
// MANUAL CHECK (สำหรับ APK)
// ==========================================
window.odc_setManualResult = async function(webId, linkKey, ok) {
    const ready = await odc_ensureRound();
    if (!ready) return;
    odcResults[`${webId}.${linkKey}`] = {
        status: ok ? 'manual_ok' : 'manual_fail',
        checked_at: new Date().toISOString(),
        checked_by: (currentUser && (currentUser.username || currentUser.name)) || 'admin'
    };
    await odc_saveCurrentRound();
    odc_renderWebsites();
    odc_updateStatusBar();
    sop_showInlineToast(ok ? 'บันทึก: ใช้ได้ ✅' : 'บันทึก: ใช้ไม่ได้ 🔴', ok ? 'success' : 'info');
};

// ==========================================
// 👁️ VIEW IN IFRAME (ฝังเว็บมาดูในระบบ)
// ==========================================
window.odc_viewInline = async function(webId, linkKey) {
    const w = odcWebsites.find(w => w.id === webId);
    if (!w) return;
    const url = w.links[linkKey];
    if (!url) {
        Swal.fire('ไม่มีลิงก์', 'กรุณาเพิ่มลิงก์ในหน้า "จัดการเว็บ" ก่อน', 'info');
        return;
    }
    const meta = ODC_LINK_TYPES[linkKey];

    window._odcViewState = { url, webId, linkKey, history: [url] };

    await Swal.fire({
        title: `<div class="text-base font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">visibility</span> ${w.emoji || ''} ${w.name} — ${meta.label}</div>`,
        html: `
            <div class="text-left">
                <!-- Toolbar -->
                <div class="bg-slate-100 dark:bg-slate-900 rounded-t-xl border-2 border-b-0 border-gray-300 dark:border-slate-600 px-2 py-1.5 flex items-center gap-1.5 flex-wrap">
                    <button onclick="odc_iframeBack()" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-600 dark:text-gray-300 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ย้อนกลับ"><span class="material-icons text-[16px]">arrow_back</span></button>
                    <button onclick="odc_iframeReload()" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-600 dark:text-gray-300 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="รีโหลด"><span class="material-icons text-[16px]">refresh</span></button>
                    <button onclick="odc_iframeHome('${url}')" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-600 dark:text-gray-300 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="กลับหน้าหลัก"><span class="material-icons text-[16px]">home</span></button>
                    <button onclick="odc_findEntryLinks()" class="bg-cyan-500 hover:bg-cyan-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition" title="ค้นหาลิงก์ทางเข้าจากหน้าเว็บ"><span class="material-icons text-[12px]">search</span>หาทางเข้า</button>
                    <div class="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate" id="odcIframeUrlBar">${url}</div>
                    <a href="${url}" target="_blank" rel="noopener" class="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition" title="เปิดในแท็บใหม่"><span class="material-icons text-[12px]">open_in_new</span></a>
                </div>

                <!-- Entry Links ทางเข้า 1-5 (ถ้าหาเจอ) -->
                <div id="odcEntryLinks" class="hidden bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border-x-2 border-cyan-300 dark:border-cyan-700 px-3 py-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1">
                            <span class="material-icons text-[14px]">link</span>🎮 ทางเข้าทั้งหมด:
                        </span>
                        <div id="odcEntryButtons" class="flex gap-1"></div>
                    </div>
                </div>

                <!-- Tip -->
                <div class="bg-blue-50 dark:bg-blue-900/20 border-x-2 border-blue-300 dark:border-blue-700 px-2.5 py-1 text-[11px] flex items-center gap-1.5">
                    <span class="material-icons text-blue-500 text-[14px]">info</span>
                    <span><b>💡 ทิป:</b> กดปุ่ม "หาทางเข้า" → ระบบจะหาลิงก์ทางเข้า 1-5 แล้วทำเป็นปุ่มให้คลิก (เปิดในกรอบนี้ ไม่เด้งแท็บใหม่)</span>
                </div>

                <!-- Iframe container -->
                <div class="relative bg-slate-100 dark:bg-slate-900 rounded-b-xl overflow-hidden border-2 border-t-0 border-gray-300 dark:border-slate-600" style="height: 60vh;">
                    <div id="odcIframeLoading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-10">
                        <span class="material-icons animate-spin text-blue-500 text-3xl mb-2">sync</span>
                        <p class="text-sm font-bold text-slate-600 dark:text-gray-300">กำลังโหลดเว็บ...</p>
                    </div>
                    <iframe src="${url}" id="odcIframe" class="w-full h-full bg-white" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
                </div>

                <!-- ปุ่มบันทึกผล -->
                <div class="flex gap-2 justify-center pt-3">
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', true); Swal.close();" class="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-[18px]">check_circle</span> ปกติ ใช้ได้
                    </button>
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', false); Swal.close();" class="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-[18px]">cancel</span> ผิดปกติ
                    </button>
                </div>
            </div>
        `,
        width: '92vw',
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        didOpen: () => {
            const iframe = document.getElementById('odcIframe');
            if (!iframe) return;

            iframe.addEventListener('load', () => {
                const loading = document.getElementById('odcIframeLoading');
                if (loading) loading.style.display = 'none';

                try {
                    const newUrl = iframe.contentWindow.location.href;
                    const bar = document.getElementById('odcIframeUrlBar');
                    if (bar && newUrl && newUrl !== 'about:blank') bar.innerText = newUrl;
                } catch (e) { /* cross-origin */ }
            });
        }
    });
};

// 🔍 หาลิงก์ทางเข้า 1-5 จากหน้าเว็บ
window.odc_findEntryLinks = async function() {
    const iframe = document.getElementById('odcIframe');
    if (!iframe) return;

    const currentUrl = iframe.src;
    if (!currentUrl || currentUrl === 'about:blank') {
        sop_showInlineToast('รอให้โหลดเว็บเสร็จก่อน', 'info');
        return;
    }

    sop_showInlineToast('กำลังค้นหาทางเข้า...', 'info');

    try {
        // วิธี 1: ลอง fetch ตรงๆ
        const resp = await fetch(currentUrl, { 
            mode: 'cors', 
            cache: 'no-store',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }).catch(() => null);

        let entryUrls = [];
        if (resp && resp.ok) {
            const html = await resp.text();
            entryUrls = odc_parseEntryLinksFromHTML(html);
        }

        // วิธี 2: ถ้า fetch ไม่ได้ → ใช้ hardcoded pattern (ทาง JL69 มักจะเป็น subdomain)
        if (entryUrls.length === 0) {
            try {
                const url = new URL(currentUrl);
                const baseDomain = url.hostname.replace(/^[^.]+\./, ''); // jl691111.vip → 91111.vip
                const baseNum = url.hostname.match(/(\d+)/)?.[1] || '1111';
                
                // สร้างลิงก์คาดเดา JL69: jl691111.vip, jl691112.vip, ...
                for (let i = 1; i <= 5; i++) {
                    const guessUrl = `${url.protocol}//jl69${baseNum.slice(0, -1)}${i}.vip${url.pathname}`;
                    entryUrls.push(guessUrl);
                }
                sop_showInlineToast('ใช้ลิงก์คาดเดา (เพราะ CORS block)', 'warning');
            } catch (_) {
                sop_showInlineToast('หาทางเข้าไม่ได้ - ลองคลิกในเว็บเอง', 'error');
                return;
            }
        } else {
            sop_showInlineToast(`พบ ${entryUrls.length} ทางเข้า ✅`, 'success');
        }

        // แสดงปุ่มทางเข้า
        const container = document.getElementById('odcEntryLinks');
        const buttonsDiv = document.getElementById('odcEntryButtons');
        if (container && buttonsDiv) {
            container.classList.remove('hidden');
            buttonsDiv.innerHTML = '';
            
            entryUrls.forEach((url, i) => {
                const btn = document.createElement('button');
                btn.innerHTML = `${i + 1}`;
                btn.className = 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-[11px] w-8 h-8 rounded-lg shadow-sm transition active:scale-95';
                btn.title = `ทางเข้า ${i + 1}: ${url}`;
                btn.onclick = () => odc_navigateToEntry(url);
                buttonsDiv.appendChild(btn);
            });
        }
    } catch (e) {
        console.error('findEntryLinks error:', e);
        sop_showInlineToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
    }
};

// helper: แยกลิงก์ทางเข้าจาก HTML
function odc_parseEntryLinksFromHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const entries = [];

    // หา <a> ที่มีคำว่า "ทางเข้า" หรือ "คลิก" หรือตัวเลข 1-5
    const allLinks = Array.from(doc.querySelectorAll('a[href]'));
    allLinks.forEach(a => {
        const href = a.href || a.getAttribute('href') || '';
        const text = (a.innerText || a.textContent || '').trim();

        if (href.startsWith('http')) {
            // ลิงก์ที่มีข้อความ "ทางเข้า", "เข้าเล่น", "คลิก" หรือตัวเลข
            if (text.includes('ทางเข้า') || text.includes('เข้าเล่น') || 
                text.includes('คลิก') || text.match(/^(ทาง\s*)?[1-5]$/)) {
                if (!entries.includes(href)) {
                    entries.push(href);
                }
            }
        }
    });

    // ถ้าไม่เจอ → หา link ภายนอกที่ไม่ใช่ domain เดียวกัน
    if (entries.length === 0) {
        const baseHost = new URL(window.location.href).hostname;
        allLinks.forEach(a => {
            const href = a.href || a.getAttribute('href') || '';
            if (href.startsWith('http')) {
                try {
                    const linkHost = new URL(href).hostname;
                    if (linkHost !== baseHost && !entries.includes(href)) {
                        entries.push(href);
                    }
                } catch (_) {}
            }
        });
    }

    return entries.slice(0, 5); // เอาแค่ 5 แรก
}

// เปลี่ยนหน้าใน iframe
window.odc_navigateToEntry = function(url) {
    const iframe = document.getElementById('odcIframe');
    const urlBar = document.getElementById('odcIframeUrlBar');
    const loading = document.getElementById('odcIframeLoading');

    if (iframe) {
        if (loading) loading.style.display = 'flex';
        iframe.src = url;
        if (urlBar) urlBar.innerText = url;
        sop_showInlineToast('เปลี่ยนเป็นทางเข้าใหม่...', 'info');
    }
};

// ฟังก์ชันควบคุม iframe
window.odc_iframeBack = function() {
    try {
        const iframe = document.getElementById('odcIframe');
        if (iframe && iframe.contentWindow) iframe.contentWindow.history.back();
    } catch (e) { console.warn('Cannot go back:', e); }
};

window.odc_iframeReload = function() {
    const iframe = document.getElementById('odcIframe');
    if (iframe) {
        const loading = document.getElementById('odcIframeLoading');
        if (loading) loading.style.display = 'flex';
        iframe.src = iframe.src;
    }
};

window.odc_iframeHome = function(homeUrl) {
    const iframe = document.getElementById('odcIframe');
    if (iframe) {
        const loading = document.getElementById('odcIframeLoading');
        if (loading) loading.style.display = 'flex';
        iframe.src = homeUrl;
    }
};

// ==========================================
// 📱 SHOW QR CODE สำหรับลิงก์ APK
// ==========================================
window.odc_showQrCode = async function(webId, linkKey) {
    const w = odcWebsites.find(w => w.id === webId);
    if (!w) return;
    const url = w.links[linkKey];
    if (!url) {
        Swal.fire('ไม่มีลิงก์', 'กรุณาเพิ่มลิงก์ในหน้า "จัดการเว็บ" ก่อน', 'info');
        return;
    }

    const meta = ODC_LINK_TYPES[linkKey];
    // ใช้ Google Chart API สร้าง QR code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

    await Swal.fire({
        title: `<div class="text-lg font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">qr_code_2</span> ${w.name} — ${meta.label}</div>`,
        html: `
            <div class="text-center space-y-3">
                <div class="bg-white p-4 rounded-2xl inline-block shadow-md border border-gray-200">
                    <img src="${qrUrl}" alt="QR Code" class="w-[260px] h-[260px]" />
                </div>
                <div class="text-xs text-gray-500 break-all px-2 font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">${url}</div>
                <div class="text-sm text-slate-700 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3">
                    📱 <b>วิธีใช้:</b><br>
                    1. เปิดกล้องมือถือ → สแกน QR<br>
                    2. กดดาวน์โหลด/ติดตั้งแอป<br>
                    3. กลับมาหน้านี้ → กด "ใช้ได้" หรือ "ใช้ไม่ได้"
                </div>
                <div class="flex gap-2 justify-center pt-2">
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', true); Swal.close();" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-sm">check_circle</span> ใช้ได้
                    </button>
                    <button onclick="odc_setManualResult('${webId}', '${linkKey}', false); Swal.close();" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 shadow-md transition active:scale-95">
                        <span class="material-icons text-sm">cancel</span> ใช้ไม่ได้
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '440px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });
};

// ==========================================
// 🌪️ เปิด 5 แท็บพร้อมกัน — ลองอ่านหน้า OK VIP หาทางเข้า 1-5
// ==========================================
window.odc_openAllEntries = async function(webId, linkKey) {
    const w = odcWebsites.find(w => w.id === webId);
    if (!w) return;
    const url = w.links[linkKey];
    if (!url) {
        Swal.fire('ไม่มีลิงก์', 'กรุณาเพิ่มลิงก์ในหน้า "จัดการเว็บ" ก่อน', 'info');
        return;
    }
    const meta = ODC_LINK_TYPES[linkKey];

    // popup confirm + แสดง progress
    const confirmRes = await Swal.fire({
        title: `<div class="text-base font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-purple-500">tab</span> เปิดทางเข้า 1-5 พร้อมกัน</div>`,
        html: `
            <div class="text-left space-y-3">
                <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-xl p-3 text-sm">
                    <div class="font-bold text-purple-700 dark:text-purple-300 mb-1">💡 วิธีทำงาน</div>
                    <ol class="text-xs text-slate-700 dark:text-gray-200 ml-4 space-y-0.5 list-decimal">
                        <li>ระบบจะลองอ่านหน้า ${w.name} หาลิงก์ "ทางเข้า 1-5"</li>
                        <li>ถ้าหาเจอ → เปิดทุกแท็บพร้อมกัน → คุณดูแว็บๆ ได้</li>
                        <li>ถ้าหาไม่เจอ → เปิดเฉพาะหน้า OK VIP เดียว</li>
                        <li>หลังตรวจเสร็จ → ปิดแท็บทั้งหมด → กลับมากด ✅/🔴 ที่นี่</li>
                    </ol>
                </div>
                <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-2.5 text-xs text-slate-700 dark:text-gray-200 flex items-center gap-2">
                    <span class="material-icons text-amber-500 text-[16px]">warning</span>
                    <span>เบราว์เซอร์อาจ block popup → ถ้าโดนถาม กด "อนุญาต popup จากเว็บนี้"</span>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">launch</span> เปิดทุกแท็บ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#a855f7',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[1.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });

    if (!confirmRes.isConfirmed) return;

    Swal.fire({
        title: 'กำลังหาทางเข้า 1-5...',
        html: '<div class="text-xs text-gray-500 mt-2">กำลังอ่านหน้า ' + w.name + '</div>',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    let entryUrls = [];
    let parsedSuccessfully = false;

    try {
        // ลองอ่านหน้า OK VIP โดยใช้ fetch (อาจติด CORS)
        const resp = await fetch(url, { mode: 'cors', cache: 'no-store' }).catch(() => null);

        if (resp && resp.ok) {
            const html = await resp.text();
            // parse HTML หาลิงก์
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // หา <a> ทุกอันที่มีคำว่า "ทางเข้า" หรือเป็นลิงก์ภายนอก
            const allLinks = Array.from(doc.querySelectorAll('a'));
            const entries = [];

            allLinks.forEach(a => {
                const href = a.href || a.getAttribute('href') || '';
                const text = (a.innerText || a.textContent || '').trim();

                // ถ้าข้อความมีคำว่า "ทางเข้า" หรือ "เข้าเล่น" หรือ "คลิก" และมี URL
                if (href && (text.includes('ทางเข้า') || text.includes('เข้าเล่น') || text.includes('คลิก') || text.match(/^\d+$/))) {
                    if (href.startsWith('http') && !entries.includes(href)) {
                        entries.push(href);
                    }
                }
            });

            // ถ้ายังไม่เจอ → หา link ภายนอกทั้งหมด (ที่ไม่ใช่ domain เดียวกัน)
            if (entries.length === 0) {
                const baseHost = new URL(url).hostname;
                allLinks.forEach(a => {
                    const href = a.href || a.getAttribute('href') || '';
                    if (href.startsWith('http')) {
                        try {
                            const linkHost = new URL(href).hostname;
                            if (linkHost !== baseHost && !entries.includes(href)) {
                                entries.push(href);
                            }
                        } catch (_) {}
                    }
                });
            }

            entryUrls = entries.slice(0, 5); // เอาแค่ 5 แรก
            if (entryUrls.length > 0) parsedSuccessfully = true;
        }
    } catch (e) {
        console.warn('Cannot parse page (CORS or error):', e);
    }

    // ถ้า parse ไม่ได้ → fallback ใช้ url หลักเปิดแท็บเดียว
    if (!parsedSuccessfully || entryUrls.length === 0) {
        Swal.close();
        const fallback = await Swal.fire({
            title: 'อ่านหน้าไม่ได้ (CORS block)',
            html: `<div class="text-sm text-left">
                <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-3 mb-3">
                    เบราว์เซอร์ block ไม่ให้อ่านเนื้อหาเว็บ ${w.name} เนื่องจาก CORS<br><br>
                    <b>แนะนำ:</b> เปิดหน้า OK VIP แท็บเดียว → คุณคลิก "ทางเข้า 1-5" ในแท็บนั้น
                </div>
            </div>`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'เปิดหน้า OK VIP',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#3b82f6'
        });
        if (fallback.isConfirmed) {
            window.open(url, '_blank', 'noopener');
        }
        return;
    }

    // เจอลิงก์ → เปิดทุกแท็บ
    Swal.close();

    let openedCount = 0;
    let blockedCount = 0;
    entryUrls.forEach((u, i) => {
        // delay เล็กน้อยป้องกัน browser block
        setTimeout(() => {
            const win = window.open(u, '_blank', 'noopener');
            if (win) openedCount++;
            else blockedCount++;
        }, i * 100);
    });

    // แสดงผลหลังเปิดเสร็จ
    setTimeout(() => {
        Swal.fire({
            icon: blockedCount === entryUrls.length ? 'warning' : 'success',
            title: blockedCount === entryUrls.length ? 'เบราว์เซอร์ block popup ทั้งหมด!' : `เปิด ${entryUrls.length} แท็บแล้ว`,
            html: blockedCount === entryUrls.length
                ? '<div class="text-xs text-left bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">กรุณากด "อนุญาต popup" ที่ icon ด้านบน address bar (มีรูปกากบาท) → ลองใหม่</div>'
                : `<div class="text-xs text-left text-gray-500">หลังตรวจเสร็จ → ปิดแท็บทั้งหมด → กลับมากด ✅/🔴 ที่นี่</div>${blockedCount > 0 ? `<div class="text-xs text-amber-500 mt-2">⚠️ ${blockedCount} แท็บถูก block</div>` : ''}`,
            timer: blockedCount === entryUrls.length ? 0 : 3500,
            showConfirmButton: blockedCount === entryUrls.length,
            confirmButtonColor: '#3b82f6'
        });
    }, entryUrls.length * 110 + 200);
};

// ==========================================
// RENDER
// ==========================================
function odc_lightenHex(hex, amt) {
    if (!hex || !hex.startsWith('#')) return hex;
    const c = hex.replace('#', '');
    const r = Math.min(255, parseInt(c.substr(0,2), 16) + amt);
    const g = Math.min(255, parseInt(c.substr(2,2), 16) + amt);
    const b = Math.min(255, parseInt(c.substr(4,2), 16) + amt);
    return `rgb(${r},${g},${b})`;
}

window.odc_renderWebsites = function() {
    const container = document.getElementById('odcWebsitesContainer');
    if (!container) return;

    if (!odcWebsites || odcWebsites.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 dark:text-gray-600 py-20 flex flex-col items-center select-none">
                <span class="material-icons text-[80px] opacity-30">link_off</span>
                <h2 class="text-xl font-black text-gray-500 mt-3">ยังไม่มีเว็บ</h2>
                <p class="text-sm mt-1">กดปุ่ม "จัดการเว็บ" เพื่อเพิ่ม</p>
            </div>`;
        return;
    }

    let html = '';
    odcWebsites.forEach(w => {
        const linksHtml = Object.keys(ODC_LINK_TYPES).map(linkKey => {
            const meta = ODC_LINK_TYPES[linkKey];
            const url = (w.links || {})[linkKey] || '';
            const result = odcResults[`${w.id}.${linkKey}`] || {};

            let statusIcon = 'help_outline';
            let statusIconClass = 'text-gray-400';
            let statusBorderClass = 'border-gray-300 dark:border-slate-600';
            let statusDetail = '<div class="text-[10px] text-gray-400 italic">ยังไม่ได้ตรวจ</div>';

            if (result.status === 'ok' || result.status === 'manual_ok') {
                statusIcon = 'check_circle';
                statusIconClass = 'text-emerald-500';
                statusBorderClass = 'border-emerald-500';
                const detail = result.status === 'manual_ok' ? `เช็คโดย: ${result.checked_by || '-'}` : `${result.time || 0}ms`;
                statusDetail = `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">✅ ปกติ — ${detail}</div>`;
            } else if (result.status === 'fail' || result.status === 'manual_fail') {
                statusIcon = 'error';
                statusIconClass = 'text-red-500';
                statusBorderClass = 'border-red-500';
                const detail = result.status === 'manual_fail' ? `เช็คโดย: ${result.checked_by || '-'}` : (result.error || 'ผิดพลาด');
                statusDetail = `<div class="text-[10px] text-red-600 dark:text-red-400 font-bold">🔴 ${detail}</div>`;
            } else if (result.status === 'pending') {
                statusIcon = 'sync';
                statusIconClass = 'text-blue-500 animate-spin';
                statusBorderClass = 'border-blue-500';
                statusDetail = `<div class="text-[10px] text-blue-600 dark:text-blue-400 font-bold animate-pulse">กำลังตรวจ...</div>`;
            }

            // Action buttons
            let actions = '';

            // 🔍 SPECULATOR (กลุ่มเก็งกำไร) — ไม่ใช้ลิงก์, ใช้การอัพ CSV
            if (meta.type === 'speculator') {
                const specData = odcSpeculatorData[w.id] || [];
                const specCount = specData.length;
                let specBadge = '';
                if (specCount > 0) {
                    specBadge = `<span class="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm animate-pulse" title="ชั้นเก็งกำไร KGI ฝาก ≥ 2">⚠️ KGI ${specCount} ยูส</span>`;
                }
                actions += `<button onclick="odc_openSpeculatorCheck('${w.id}')" class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition active:scale-95" title="อัพไฟล์ CSV ตรวจกลุ่มเก็งกำไร"><span class="material-icons text-[14px]">cloud_upload</span>ตรวจ</button>`;
                actions += specBadge;
                // ปุ่ม manual check
                actions += `<button onclick="odc_setManualResult('${w.id}', '${linkKey}', true)" class="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 shadow-sm flex items-center gap-0.5" title="เรียบร้อย"><span class="material-icons text-[12px]">check</span></button>`;
                actions += `<button onclick="odc_setManualResult('${w.id}', '${linkKey}', false)" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 shadow-sm flex items-center gap-0.5" title="พบเก็งกำไร"><span class="material-icons text-[12px]">close</span></button>`;
            } else if (url) {
                // ปุ่ม "ดูในระบบ" (iframe popup) — สำหรับลิงก์ที่ไม่ใช่ APK
                if (meta.type !== 'manual') {
                    actions += `<button onclick="odc_viewInline('${w.id}', '${linkKey}')" class="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition active:scale-95" title="ดูเว็บในระบบ"><span class="material-icons text-[14px]">visibility</span>ดู</button>`;

                    // 🌪️ ปุ่มเปิด 5 แท็บพร้อมกัน — เฉพาะลิงก์ที่เป็น OK VIP (login/referral)
                    if (linkKey === 'login' || linkKey === 'referral') {
                        actions += `<button onclick="odc_openAllEntries('${w.id}', '${linkKey}')" class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition active:scale-95" title="เปิดทางเข้า 1-5 พร้อมกัน"><span class="material-icons text-[14px]">tab</span>เปิด 5 แท็บ</button>`;
                    }
                }

                // ปุ่มเปิดแท็บใหม่ (สำรอง)
                actions += `<a href="${url}" target="_blank" rel="noopener" class="bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-400 hover:text-blue-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-1" title="เปิดแท็บใหม่"><span class="material-icons text-[14px]">open_in_new</span></a>`;

                if (meta.type === 'manual') {
                    // APK: QR code + Manual buttons
                    actions += `<button onclick="odc_showQrCode('${w.id}', '${linkKey}')" class="bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-gray-400 hover:text-purple-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-1" title="QR สแกนมือถือ"><span class="material-icons text-[14px]">qr_code_2</span></button>`;
                }

                // ปุ่ม ✅/🔴 manual check — มีให้ทุกลิงก์
                actions += `<button onclick="odc_setManualResult('${w.id}', '${linkKey}', true)" class="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 shadow-sm flex items-center gap-0.5" title="ใช้ได้"><span class="material-icons text-[12px]">check</span></button>`;
                actions += `<button onclick="odc_setManualResult('${w.id}', '${linkKey}', false)" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 shadow-sm flex items-center gap-0.5" title="ใช้ไม่ได้"><span class="material-icons text-[12px]">close</span></button>`;
            } else {
                actions += `<span class="text-[10px] text-amber-600 italic">⚠️ ยังไม่ได้ใส่ลิงก์</span>`;
            }

            return `
                <div class="flex items-center gap-3 p-3 rounded-xl border-l-4 ${statusBorderClass} bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition">
                    <span class="material-icons text-[22px] ${statusIconClass}">${statusIcon}</span>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                            <span class="material-icons text-[16px] text-gray-500">${meta.icon}</span>
                            ${meta.label}
                            ${meta.type === 'manual' ? '<span class="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">📱 มือถือ</span>' : ''}
                            ${meta.type === 'speculator' ? `<span class="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">📊 หลังบ้าน ${ODC_BACKEND_TYPES[w.backend || 'k36']?.label || 'K36'}</span>` : ''}
                        </div>
                        <div class="text-[10px] text-gray-500 dark:text-gray-400 truncate font-mono">${meta.type === 'speculator' ? 'อัพ CSV จากหลังบ้าน → กรองเฉพาะ KGI ฝาก ≥ 2 ครั้ง' : (url || '(ไม่มีลิงก์)')}</div>
                        ${statusDetail}
                    </div>
                    <div class="flex items-center gap-1 shrink-0 flex-wrap justify-end">${actions}</div>
                </div>
            `;
        }).join('');

        // header with stats
        const totalLinks = Object.values(w.links || {}).filter(u => u).length;
        const okLinks = Object.keys(w.links || {}).filter(k => {
            const r = odcResults[`${w.id}.${k}`];
            return r && (r.status === 'ok' || r.status === 'manual_ok');
        }).length;
        const failLinks = Object.keys(w.links || {}).filter(k => {
            const r = odcResults[`${w.id}.${k}`];
            return r && (r.status === 'fail' || r.status === 'manual_fail');
        }).length;

        let statusBadge = `${okLinks}/${totalLinks}`;
        if (failLinks > 0) statusBadge += ` ⚠️`;
        else if (okLinks === totalLinks && totalLinks > 0) statusBadge += ` ✅`;

        const wColor = w.color || '#3b82f6';
        const wColorLight = odc_lightenHex(wColor, 30);

        html += `
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md overflow-hidden">
                <div class="text-white px-5 py-3 flex items-center gap-3 flex-wrap" style="background: linear-gradient(to right, ${wColor}, ${wColorLight});">
                    <span class="text-2xl shrink-0">${w.emoji || '🌐'}</span>
                    <h3 class="font-black text-lg tracking-wide flex-1">${(w.name || '').replace(/</g, '&lt;')}</h3>
                    <span class="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full">${statusBadge}</span>
                </div>
                <div class="p-3 space-y-2">${linksHtml}</div>
            </div>
        `;
    });

    container.innerHTML = html;
};

window.odc_updateStatusBar = function() {
    const lastCheck = document.getElementById('odcLastCheck');
    const okEl = document.getElementById('odcOkCount');
    const errEl = document.getElementById('odcErrCount');
    const assignedEl = document.getElementById('odcAssignedTo');

    let okCount = 0, errCount = 0;
    Object.values(odcResults).forEach(r => {
        if (r.status === 'ok' || r.status === 'manual_ok') okCount++;
        else if (r.status === 'fail' || r.status === 'manual_fail') errCount++;
    });
    if (okEl) okEl.innerText = okCount;
    if (errEl) errEl.innerText = errCount;

    // V2: ใช้ชื่อ user ที่ login อยู่เลย
    const myUsername = (currentUser && (currentUser.username || currentUser.name)) || '-';

    if (odcCurrentRound) {
        const today = new Date().toISOString().split('T')[0];
        if (odcCurrentRound.date === today) {
            // วันนี้ — โชว์ชื่อ assignee (ถ้ามี) หรือ user ปัจจุบัน
            if (assignedEl) assignedEl.innerText = odcCurrentRound.assignee || myUsername;
            if (lastCheck && odcCurrentRound.updated_at) {
                lastCheck.innerText = `รอบ ${odcCurrentRound.date} ${odcCurrentRound.time} — อัพเดทล่าสุด ${new Date(odcCurrentRound.updated_at).toLocaleTimeString('th-TH')}`;
            } else if (lastCheck) {
                lastCheck.innerText = `รอบ ${odcCurrentRound.date} ${odcCurrentRound.time}`;
            }
        } else {
            // รอบเก่า — โชว์ชื่อ user ปัจจุบัน เพราะรอบใหม่จะเริ่ม
            if (assignedEl) assignedEl.innerText = myUsername;
            if (lastCheck) lastCheck.innerText = `รอบใหม่ ${new Date().toISOString().split('T')[0]} (รอบเก่า: ${odcCurrentRound.date})`;
        }
    } else {
        // ยังไม่มีรอบ — โชว์ชื่อ user ปัจจุบัน
        if (assignedEl) assignedEl.innerText = myUsername;
        if (lastCheck) lastCheck.innerText = 'พร้อมตรวจ — กดปุ่ม "ตรวจอัตโนมัติทั้งหมด"';
    }
};

// ==========================================
// BUILD REPORT
// ==========================================
window.odc_buildReport = async function() {
    const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = odcCurrentRound?.time || '12.00';
    const assignee = odcCurrentRound?.assignee || '-';

    let report = `OD CENTER : รับผิดชอบตรวจสอบเวลา ${time} น.\n`;
    report += `📅 วันที่: ${today}\n`;
    report += `👤 ผู้ตรวจ: ${assignee}\n\n`;

    odcWebsites.forEach(w => {
        report += `${w.emoji || '🌐'}เว็บ ${w.name}${w.emoji || '🌐'}\n`;
        Object.keys(ODC_LINK_TYPES).forEach(linkKey => {
            const meta = ODC_LINK_TYPES[linkKey];
            const result = odcResults[`${w.id}.${linkKey}`];
            let statusText = 'ยังไม่ได้ตรวจ';
            if (result) {
                if (result.status === 'ok' || result.status === 'manual_ok') {
                    statusText = (linkKey === 'group') ? `เรียบร้อย ${w.name}` : 'ปกติ';
                } else if (result.status === 'fail' || result.status === 'manual_fail') {
                    statusText = '⚠️ ผิดปกติ';
                }
            }
            report += `* ${meta.label}  /  ${statusText}\n`;
        });
        report += `\n`;
    });

    await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-purple-500">description</span> รายงาน OD Center</div>',
        html: `
            <div class="text-left">
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3 mb-3 text-xs">
                    คัดลอกข้อความแล้วไปวางใน Telegram/Line
                </div>
                <textarea id="odcReportText" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-mono leading-relaxed" rows="20">${report}</textarea>
            </div>
        `,
        width: '720px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">content_copy</span> คัดลอก',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#a855f7',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const ta = document.getElementById('odcReportText');
            if (ta) {
                ta.select();
                document.execCommand('copy');
                navigator.clipboard?.writeText(ta.value).catch(()=>{});
            }
            return true;
        }
    }).then(r => {
        if (r.isConfirmed) sop_showInlineToast('คัดลอกแล้ว ✅', 'success');
    });
};

// ==========================================
// SEND TELEGRAM
// ==========================================
window.odc_sendTelegram = async function() {
    // ใช้ config เดียวกับ sop telegram
    if (typeof sop_loadTelegramConfig === 'function') await sop_loadTelegramConfig();
    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) {
        Swal.fire({
            title: 'ยังไม่ได้ตั้งค่า Telegram',
            html: 'กรุณาเข้าไปตั้งค่า Bot Token และ Chat ID ในหน้า OD ก่อน',
            icon: 'warning',
            confirmButtonColor: '#06b6d4'
        });
        return;
    }

    const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = odcCurrentRound?.time || '12.00';
    const assignee = odcCurrentRound?.assignee || '-';

    let report = `<b>OD CENTER</b> : รับผิดชอบตรวจสอบเวลา ${time} น.\n`;
    report += `📅 ${today}    👤 ${assignee}\n\n`;

    odcWebsites.forEach(w => {
        report += `${w.emoji || '🌐'}<b>เว็บ ${w.name}</b>${w.emoji || '🌐'}\n`;
        Object.keys(ODC_LINK_TYPES).forEach(linkKey => {
            const meta = ODC_LINK_TYPES[linkKey];
            const result = odcResults[`${w.id}.${linkKey}`];
            let statusText = '⏸️ ยังไม่ตรวจ';
            if (result) {
                if (result.status === 'ok' || result.status === 'manual_ok') {
                    statusText = (linkKey === 'group') ? `✅ เรียบร้อย ${w.name}` : '✅ ปกติ';
                } else if (result.status === 'fail' || result.status === 'manual_fail') {
                    statusText = '🔴 ผิดปกติ';
                }
            }
            report += `* ${meta.label} / ${statusText}\n`;
        });
        report += `\n`;
    });

    const confirm = await Swal.fire({
        title: 'ส่งรายงานเข้า Telegram?',
        html: `<div class="text-left text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-lg max-h-[400px] overflow-y-auto whitespace-pre-wrap font-mono text-xs">${report.replace(/<b>/g, '').replace(/<\/b>/g, '')}</div>`,
        showCancelButton: true,
        confirmButtonText: '📤 ส่ง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#06b6d4',
        cancelButtonColor: '#64748b',
        width: '600px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังส่ง...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: cfg.chat_id, text: report, parse_mode: 'HTML' })
        });
        const json = await res.json();
        if (json.ok) {
            Swal.fire({ icon: 'success', title: 'ส่งสำเร็จ! ✅', timer: 1500, showConfirmButton: false });
            // บันทึกประวัติ
            await odc_archiveRound();
        } else {
            Swal.fire('ส่งไม่สำเร็จ', json.description || 'ไม่ทราบสาเหตุ', 'error');
        }
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// ARCHIVE (เก็บประวัติ)
// ==========================================
window.odc_archiveRound = async function() {
    if (!odcCurrentRound) return;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_history').single();
        let history = [];
        if (data && data.value) history = JSON.parse(data.value);
        history.unshift({
            ...odcCurrentRound,
            sent_at: new Date().toISOString()
        });
        // เก็บแค่ 30 รอบล่าสุด
        history = history.slice(0, 30);
        await appDB.from('settings').upsert([{ key: 'odc_history', value: JSON.stringify(history) }]);
    } catch (e) { console.warn('archive error:', e); }
};

// ==========================================
// VIEW HISTORY
// ==========================================
window.odc_viewHistory = async function() {
    Swal.fire({ title: 'กำลังโหลด...', didOpen: () => Swal.showLoading() });
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'odc_history').single();
        const history = (data && data.value) ? JSON.parse(data.value) : [];

        if (history.length === 0) {
            Swal.fire('ไม่มีประวัติ', 'ยังไม่เคยส่งรายงาน', 'info');
            return;
        }

        const itemsHtml = history.map(h => {
            const total = odcWebsites.length * 4;
            let ok = 0, fail = 0;
            Object.values(h.results || {}).forEach(r => {
                if (r.status === 'ok' || r.status === 'manual_ok') ok++;
                else if (r.status === 'fail' || r.status === 'manual_fail') fail++;
            });
            const statusColor = fail > 0 ? '#ef4444' : (ok === total ? '#10b981' : '#eab308');
            return `
                <div class="bg-slate-50 dark:bg-slate-900 border-l-4 rounded-xl p-3 mb-2 shadow-sm" style="border-left-color: ${statusColor};">
                    <div class="font-bold text-slate-800 dark:text-white text-sm">📅 ${h.date} ${h.time || ''}</div>
                    <div class="text-xs text-gray-500 mt-1">👤 ${h.assignee || '-'} | ✅ ${ok} | 🔴 ${fail}</div>
                    <div class="text-[10px] text-gray-400">ส่ง: ${h.sent_at ? new Date(h.sent_at).toLocaleString('th-TH') : '-'}</div>
                </div>
            `;
        }).join('');

        Swal.fire({
            title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-amber-500">history</span> ประวัติการตรวจ</div>',
            html: `<div class="text-left max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">${itemsHtml}</div>`,
            width: '600px',
            showCloseButton: true,
            showConfirmButton: false,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// MANAGE WEBSITES (admin)
// ==========================================
window.odc_manageWebsites = async function() {
    function buildList() {
        if (!odcWebsites || odcWebsites.length === 0) return '<div class="text-center text-gray-500 text-sm py-4">ยังไม่มีเว็บ</div>';
        return odcWebsites.map((w, idx) => `
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl mb-2 shadow-sm overflow-hidden">
                <div class="px-3 py-2 flex justify-between items-center gap-2 cursor-pointer" onclick="document.getElementById('odcMgrLinks_${idx}').classList.toggle('hidden')" style="border-left: 6px solid ${w.color || '#3b82f6'};">
                    <span class="text-xl">${w.emoji || '🌐'}</span>
                    <span class="text-slate-800 dark:text-white font-bold text-sm flex-1 truncate">${(w.name || '').replace(/</g, '&lt;')}</span>
                    <span class="text-[10px] text-gray-500">${Object.values(w.links || {}).filter(u=>u).length}/4 ลิงก์</span>
                    <button onclick="event.stopPropagation(); odc_removeWebsite(${idx})" class="text-red-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-red-500 px-2 py-1.5 rounded-lg transition shadow-sm border border-gray-200 dark:border-slate-700" title="ลบ"><span class="material-icons text-[14px]">delete</span></button>
                </div>
                <div id="odcMgrLinks_${idx}" class="px-3 py-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 space-y-2">
                    ${Object.keys(ODC_LINK_TYPES).map(lk => {
                        const meta = ODC_LINK_TYPES[lk];
                        const val = (w.links || {})[lk] || '';
                        return `
                            <div>
                                <label class="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                    <span class="material-icons text-[12px]">${meta.icon}</span>${meta.label}
                                </label>
                                <input type="text" data-webidx="${idx}" data-linkkey="${lk}" value="${val.replace(/"/g, '&quot;')}" placeholder="https://..." class="odcMgrLinkInput w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-mono outline-none focus:border-blue-500">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    window.odcRebuildMgrList = () => {
        const c = document.getElementById('odcMgrListContainer');
        if (c) c.innerHTML = buildList();
    };

    const html = `
        <div class="text-left">
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4">
                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">เพิ่มเว็บใหม่</div>
                <div class="grid grid-cols-3 gap-2 mb-2">
                    <input type="text" id="odcNewWebEmoji" placeholder="🔵" maxlength="3" class="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-center text-lg outline-none focus:border-blue-500">
                    <input type="text" id="odcNewWebName" placeholder="ชื่อเว็บ (Jun88)" class="col-span-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-sm font-bold outline-none focus:border-blue-500">
                </div>
                <input type="color" id="odcNewWebColor" value="#3b82f6" class="w-full h-9 rounded-lg cursor-pointer">
                <button onclick="odc_addWebsite()" class="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 shadow"><span class="material-icons text-sm">add</span>เพิ่มเว็บ</button>
            </div>
            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-slate-700 pb-1 flex justify-between items-center">
                <span>เว็บที่มีอยู่</span>
                <span class="text-[9px] text-gray-400 italic">คลิกเว็บเพื่อแก้ลิงก์</span>
            </div>
            <div id="odcMgrListContainer" class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 pb-2">${buildList()}</div>
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-slate-500">settings</span> จัดการเว็บ</div>',
        html: html,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            // อ่านลิงก์ทั้งหมดจาก inputs
            document.querySelectorAll('.odcMgrLinkInput').forEach(inp => {
                const wIdx = parseInt(inp.dataset.webidx);
                const lk = inp.dataset.linkkey;
                if (odcWebsites[wIdx]) {
                    if (!odcWebsites[wIdx].links) odcWebsites[wIdx].links = {};
                    odcWebsites[wIdx].links[lk] = inp.value.trim();
                }
            });
            return true;
        }
    });

    if (!result.isConfirmed) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        await odc_saveWebsites();
        odc_renderWebsites();
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ ✅', timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.odc_addWebsite = function() {
    const emoji = (document.getElementById('odcNewWebEmoji').value || '🌐').trim();
    const name = (document.getElementById('odcNewWebName').value || '').trim();
    const color = document.getElementById('odcNewWebColor').value || '#3b82f6';
    if (!name) { Swal.showValidationMessage('กรุณาใส่ชื่อเว็บ'); return; }
    Swal.resetValidationMessage();

    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (odcWebsites.some(w => w.id === id || w.name === name)) {
        Swal.showValidationMessage('มีเว็บนี้อยู่แล้ว'); return;
    }
    odcWebsites.push({
        id, name, emoji, color,
        links: { login: '', referral: '', apk: '', group: '' }
    });
    document.getElementById('odcNewWebName').value = '';
    document.getElementById('odcNewWebEmoji').value = '';
    if (window.odcRebuildMgrList) window.odcRebuildMgrList();
};

window.odc_removeWebsite = function(idx) {
    Swal.fire({
        title: 'ลบเว็บนี้?',
        html: `<div class="text-sm">เว็บ <b>${odcWebsites[idx]?.name || ''}</b> จะถูกลบ`,
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b'
    }).then(r => {
        if (r.isConfirmed) {
            odcWebsites.splice(idx, 1);
            if (window.odcRebuildMgrList) window.odcRebuildMgrList();
        }
    });
};

// helper toast (ถ้าหน้า sop ไม่ได้โหลด)
if (typeof window.sop_showInlineToast !== 'function') {
    window.sop_showInlineToast = function(msg, type) {
        type = type || 'info';
        let t = document.getElementById('odcInlineToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'odcInlineToast';
            t.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:10px 16px;border-radius:12px;font-weight:bold;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,0.25);pointer-events:none;transition:opacity 0.2s;';
            document.body.appendChild(t);
        }
        let bg = '#3b82f6';
        if (type === 'success') bg = '#10b981';
        else if (type === 'error') bg = '#ef4444';
        else if (type === 'info') bg = '#0ea5e9';
        t.style.background = bg; t.style.color = 'white';
        t.innerText = msg;
        t.style.opacity = '1';
        setTimeout(() => {
            if (t) { t.style.opacity = '0'; setTimeout(() => { if (t && t.parentNode) t.remove(); }, 250); }
        }, 1800);
    };
}
