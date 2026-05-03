// ==========================================
// 📋 ระบบ SOP V2 — คู่มือการทำงานพรีเมียม
// ฟีเจอร์: ไฟล์แนบ, ปักหมุด, ระดับความสำคัญ, ระบุกะ, Tags,
//         Copy 1คลิก, View count, Read receipts, ประวัติแก้ไข
// เก็บใน Supabase: settings table
//   key: sop_data       → array ของกฎทั้งหมด
//   key: sop_categories → array ของหมวดหมู่
// ==========================================

let globalSOPData = [];
let globalSOPCategories = [];
let currentSopId = null;
let sopPinFilterActive = false;
let sopAttachmentsBuffer = []; // ไฟล์ที่กำลังเตรียมอัพโหลด

const SOP_PRIORITY_OPTIONS = [
    { id: 'high',   label: '🔴 สำคัญมาก',  color: 'red',    border: 'border-red-500',    bg: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' },
    { id: 'medium', label: '🟡 ปานกลาง',   color: 'amber',  border: 'border-amber-400',  bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
    { id: 'low',    label: '🟢 ทั่วไป',    color: 'emerald',border: 'border-emerald-400',bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' }
];

const SOP_SHIFT_OPTIONS = [
    { id: 'morning', label: '🌅 กะเช้า', short: 'เช้า', color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700' },
    { id: 'mid',     label: '☀️ กะกลาง', short: 'กลาง', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' },
    { id: 'night',   label: '🌃 กะดึก',  short: 'ดึก',  color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700' }
];

// ==========================================
// 🚀 INIT
// ==========================================
window.initSopApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
    const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));

    const adminControls = document.getElementById('sopAdminControls');
    if (adminControls) {
        if (isAdmin) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }

    currentSopId = null;
    sopPinFilterActive = false;
    sop_updatePinFilterBtn();
    document.getElementById('sopReaderContent').innerHTML = window.renderTemplate('tpl-sop-empty');

    await sop_loadCategories();
    await sop_fetchData();
};

// ==========================================
// 📂 CATEGORIES
// ==========================================
window.sop_loadCategories = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_categories').single();
        if (data && data.value) {
            globalSOPCategories = JSON.parse(data.value);
        } else {
            globalSOPCategories = [
                { id: 'การฝาก',    name: '💰 การฝาก' },
                { id: 'การถอน',    name: '💸 การถอน' },
                { id: 'เครดิต',    name: '🪙 เครดิต' },
                { id: 'เคสพิเศษ',  name: '⚠️ เคสพิเศษ' },
                { id: 'กฎทั่วไป',  name: '📌 กฎทั่วไป' }
            ];
            await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
        }
        sop_renderCategoryDropdowns();
    } catch (e) {
        console.error('sop_loadCategories error:', e);
        globalSOPCategories = [];
    }
};

window.sop_renderCategoryDropdowns = function() {
    const filterSelect = document.getElementById('sopCategory');
    if (!filterSelect) return;
    const currentVal = filterSelect.value;
    let html = '<option value="ALL">📂 ทุกหมวดหมู่</option>';
    globalSOPCategories.forEach(c => html += `<option value="${c.id}">${c.name}</option>`);
    filterSelect.innerHTML = html;
    if (currentVal && (currentVal === 'ALL' || globalSOPCategories.some(c => c.id === currentVal))) filterSelect.value = currentVal;
    else filterSelect.value = 'ALL';
};

window.sop_manageCategories = function() {
    window.renderSopManageCatHtml = function() {
        if (globalSOPCategories.length === 0) return '<div class="text-center text-gray-500 text-sm py-4">ไม่มีหมวดหมู่</div>';
        return globalSOPCategories.map((c, idx) => window.renderTemplate('tpl-sop-manage-cat-item', { catName: c.name, index: idx })).join('');
    };
    const htmlContent = window.renderTemplate('tpl-sop-manage-cat', { catListHtml: window.renderSopManageCatHtml() });
    Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-rose-500">category</span> จัดการหมวดหมู่</div>',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });
};

window.sop_addCategory = async function() {
    const input = document.getElementById('newSopCatName');
    const val = input.value.trim();
    if (!val) return;
    const id = val.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim() || val;
    if (globalSOPCategories.some(c => c.id === id || c.name === val)) {
        Swal.showValidationMessage('มีหมวดหมู่นี้ในระบบแล้วครับ'); return;
    }
    Swal.resetValidationMessage();
    globalSOPCategories.push({ id, name: val });
    input.value = '';
    document.getElementById('sopCatListContainer').innerHTML = window.renderSopManageCatHtml();
    await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
    sop_renderCategoryDropdowns();
};

window.sop_deleteCategory = async function(idx) {
    const cat = globalSOPCategories[idx];
    const usedCount = globalSOPData.filter(r => r.category === cat.id).length;
    let warnText = `ต้องการลบหมวด "${cat.name}" ใช่หรือไม่?`;
    if (usedCount > 0) warnText += `\n\n⚠️ มีกฎ ${usedCount} ข้อใช้หมวดนี้อยู่`;
    const confirm = await Swal.fire({
        title: 'ยืนยันลบหมวดหมู่?', text: warnText, icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'ลบทิ้ง', cancelButtonText: 'ยกเลิก'
    });
    if (confirm.isConfirmed) {
        globalSOPCategories.splice(idx, 1);
        document.getElementById('sopCatListContainer').innerHTML = window.renderSopManageCatHtml();
        await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
        sop_renderCategoryDropdowns();
        sop_renderList();
    }
};

// ==========================================
// 📥 FETCH / SAVE
// ==========================================
window.sop_fetchData = async function() {
    const container = document.getElementById('sopListContainer');
    if (container) container.innerHTML = '<div class="text-center text-gray-500 py-10"><span class="material-icons animate-spin mb-2">sync</span><br>กำลังโหลด...</div>';
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_data').single();
        if (data && data.value) {
            globalSOPData = JSON.parse(data.value);
        } else {
            globalSOPData = [];
        }
        // ทำ default field ที่อาจไม่มีใน V1
        globalSOPData.forEach(r => {
            if (!r.priority) r.priority = 'medium';
            if (typeof r.pinned !== 'boolean') r.pinned = false;
            if (!Array.isArray(r.shifts)) r.shifts = ['all'];
            if (!Array.isArray(r.tags)) r.tags = [];
            if (!Array.isArray(r.attachments)) r.attachments = [];
            if (typeof r.view_count !== 'number') r.view_count = 0;
            if (!Array.isArray(r.read_by)) r.read_by = [];
            if (!Array.isArray(r.history)) r.history = [];
        });
        sop_sortData();
        sop_renderList();
        if (currentSopId) sop_readRule(currentSopId, true);
    } catch (e) {
        console.error('sop_fetchData error:', e);
        globalSOPData = [];
        sop_renderList();
    }
};

window.sop_saveAllData = async function() {
    await appDB.from('settings').upsert([{ key: 'sop_data', value: JSON.stringify(globalSOPData) }]);
};

function sop_sortData() {
    // ปักหมุดบนสุด → priority สูง → ล่าสุด
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    globalSOPData.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const pa = priorityOrder[a.priority] ?? 1;
        const pb = priorityOrder[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
}

// ==========================================
// 🎚️ FILTERS
// ==========================================
window.sop_togglePinFilter = function() {
    sopPinFilterActive = !sopPinFilterActive;
    sop_updatePinFilterBtn();
    sop_renderList();
};

function sop_updatePinFilterBtn() {
    const btn = document.getElementById('sopPinFilterBtn');
    if (!btn) return;
    if (sopPinFilterActive) {
        btn.classList.remove('bg-slate-100', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-gray-300');
        btn.classList.add('bg-amber-500', 'text-white', 'border-amber-400');
    } else {
        btn.classList.add('bg-slate-100', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-gray-300');
        btn.classList.remove('bg-amber-500', 'text-white', 'border-amber-400');
    }
}

// ==========================================
// 📜 RENDER LIST
// ==========================================
window.sop_renderList = function() {
    const term = document.getElementById('sopSearch') ? document.getElementById('sopSearch').value.toLowerCase() : '';
    const cat = document.getElementById('sopCategory') ? document.getElementById('sopCategory').value : 'ALL';
    const shiftF = document.getElementById('sopShiftFilter') ? document.getElementById('sopShiftFilter').value : 'ALL';
    const pri = document.getElementById('sopPriorityFilter') ? document.getElementById('sopPriorityFilter').value : 'ALL';
    const container = document.getElementById('sopListContainer');
    const countEl = document.getElementById('sopCount');
    if (!container) return;

    let filtered = globalSOPData.filter(item => {
        const tagText = (item.tags || []).join(' ').toLowerCase();
        const matchSearch = (item.title || '').toLowerCase().includes(term) ||
                            (item.content || '').toLowerCase().includes(term) ||
                            (item.examples || '').toLowerCase().includes(term) ||
                            tagText.includes(term);
        const matchCat = (cat === 'ALL' || item.category === cat);
        const itemShifts = item.shifts || ['all'];
        const matchShift = (shiftF === 'ALL') || itemShifts.includes('all') || itemShifts.includes(shiftF);
        const matchPri = (pri === 'ALL' || item.priority === pri);
        const matchPin = !sopPinFilterActive || item.pinned;
        return matchSearch && matchCat && matchShift && matchPri && matchPin;
    });

    if (countEl) countEl.innerText = `${filtered.length}/${globalSOPData.length}`;

    if (globalSOPData.length === 0) {
        const isAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
        const hint = isAdmin ? 'กดปุ่ม "เพิ่มกฎใหม่" เพื่อเริ่ม' : 'รอผู้ดูแลเพิ่มกฎ';
        container.innerHTML = window.renderTemplate('tpl-sop-no-rules', { hint });
        return;
    }
    if (filtered.length === 0) {
        container.innerHTML = window.renderTemplate('tpl-sop-no-rules', { hint: 'ไม่พบกฎตามเงื่อนไข' });
        return;
    }

    const myUsername = (currentUser && currentUser.username) || '';

    container.innerHTML = filtered.map(item => {
        let icon = 'rule', iconColor = 'text-gray-500 dark:text-gray-400';
        const c = item.category || '';
        if (c.includes('ฝาก'))     { icon = 'savings';        iconColor = 'text-emerald-500 dark:text-emerald-400'; }
        else if (c.includes('ถอน')) { icon = 'payments';       iconColor = 'text-blue-500 dark:text-blue-400'; }
        else if (c.includes('เครดิต')) { icon = 'monetization_on'; iconColor = 'text-amber-500 dark:text-amber-400'; }
        else if (c.includes('พิเศษ')) { icon = 'warning';        iconColor = 'text-rose-500 dark:text-rose-400'; }
        else if (c.includes('ทั่วไป')) { icon = 'menu_book';      iconColor = 'text-purple-500 dark:text-purple-400'; }

        const displayCat = globalSOPCategories.find(x => x.id === item.category)?.name || item.category;
        const dateRaw = item.updated_at || item.created_at;
        const date = dateRaw ? new Date(dateRaw).toLocaleDateString('th-TH') : '-';

        const priorityOpt = SOP_PRIORITY_OPTIONS.find(p => p.id === item.priority) || SOP_PRIORITY_OPTIONS[1];
        const priorityBorder = priorityOpt.border;
        const priorityBadge = item.priority === 'high'
            ? '<span class="text-[10px] mr-0.5" title="สำคัญมาก">🔴</span>'
            : (item.priority === 'medium' ? '<span class="text-[10px] mr-0.5" title="ปานกลาง">🟡</span>' : '<span class="text-[10px] mr-0.5" title="ทั่วไป">🟢</span>');

        const pinIcon = item.pinned ? '<span class="absolute top-1.5 right-1.5 material-icons text-amber-500 text-[16px]" title="ปักหมุด">push_pin</span>' : '';

        // shift badges
        const shifts = item.shifts || ['all'];
        let shiftBadges = '';
        if (!shifts.includes('all')) {
            shifts.forEach(s => {
                const sOpt = SOP_SHIFT_OPTIONS.find(x => x.id === s);
                if (sOpt) shiftBadges += `<span class="text-[9px] px-1.5 py-0.5 rounded ${sOpt.color} border">${sOpt.short}</span>`;
            });
        } else {
            shiftBadges = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600">ทุกกะ</span>';
        }

        // read indicator
        const isRead = (item.read_by || []).includes(myUsername);
        const readIndicator = isRead
            ? '<span class="text-[9px] flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold"><span class="material-icons text-[11px]">check_circle</span>อ่านแล้ว</span>'
            : '';

        // tags
        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = '<div class="flex flex-wrap gap-1 mt-1.5">' +
                item.tags.slice(0, 4).map(t => `<span class="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-700/50">#${t}</span>`).join('') +
                (item.tags.length > 4 ? `<span class="text-[9px] text-gray-400">+${item.tags.length - 4}</span>` : '') +
                '</div>';
        }

        // attachments icon
        const attCount = (item.attachments || []).length;
        const attachmentIcon = attCount > 0
            ? `<span class="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><span class="material-icons text-[11px]">attach_file</span>${attCount}</span>`
            : '';

        const activeBg = currentSopId === item.id
            ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-400 ring-2 ring-rose-300 dark:ring-rose-700'
            : 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/50 hover:bg-white dark:hover:bg-slate-800';

        return window.renderTemplate('tpl-sop-list-item', {
            id: item.id,
            activeBg, iconColor, icon,
            priorityBorder, priorityBadge,
            pinIcon,
            title: item.title || '(ไม่มีชื่อ)',
            displayCat: displayCat || 'ไม่ระบุหมวด',
            shiftBadges, readIndicator, tagsHtml,
            date,
            viewCount: item.view_count || 0,
            attachmentIcon
        });
    }).join('');
};

// ==========================================
// 📖 READ RULE  (ส่ง skipIncrement=true เวลา re-render หลัง save เพื่อไม่ให้บวก view ซ้ำ)
// ==========================================
window.sop_readRule = async function(id, skipIncrement) {
    currentSopId = id;
    const item = globalSOPData.find(x => String(x.id) === String(id));
    const reader = document.getElementById('sopReaderContent');
    if (!item || !reader) return;

    // เพิ่ม view count (เฉพาะตอนเปิดอ่านปกติ ไม่ใช่ re-render)
    if (!skipIncrement) {
        item.view_count = (item.view_count || 0) + 1;
        // save เงียบๆ — ไม่ต้องรอ
        sop_saveAllData().catch(e => console.warn('save view error', e));
    }

    sop_renderList();

    const updateDateStr = item.updated_at ? new Date(item.updated_at).toLocaleString('th-TH') : new Date(item.created_at).toLocaleString('th-TH');
    const formattedContent = (item.content || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
    const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));

    // priority big badge
    const priorityOpt = SOP_PRIORITY_OPTIONS.find(p => p.id === item.priority) || SOP_PRIORITY_OPTIONS[1];
    const priorityBigBadge = `<span class="${priorityOpt.bg} px-3 py-1 rounded-full text-[11px] font-black border shadow-sm">${priorityOpt.label}</span>`;

    // pin big badge
    const pinnedBigBadge = item.pinned ? '<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-[11px] font-black border border-amber-300 dark:border-amber-700 shadow-sm flex items-center gap-1"><span class="material-icons text-[12px]">push_pin</span>ปักหมุด</span>' : '';

    // shift big badges
    const shifts = item.shifts || ['all'];
    let shiftBigBadges = '';
    if (shifts.includes('all')) {
        shiftBigBadges = '<span class="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-[11px] font-black border border-gray-300 dark:border-slate-600 shadow-sm">🌐 ใช้กับทุกกะ</span>';
    } else {
        shifts.forEach(s => {
            const sOpt = SOP_SHIFT_OPTIONS.find(x => x.id === s);
            if (sOpt) shiftBigBadges += `<span class="${sOpt.color} px-3 py-1 rounded-full text-[11px] font-black border shadow-sm">${sOpt.label}</span>`;
        });
    }

    // tags
    let tagsBigHtml = '';
    if (item.tags && item.tags.length > 0) {
        tagsBigHtml = '<div class="flex flex-wrap gap-1.5 mt-3">' +
            item.tags.map(t => `<span class="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-700/50 font-bold">#${t}</span>`).join('') +
            '</div>';
    }

    // last editor
    let lastEditorBadge = '';
    if (item.last_editor && item.last_editor !== item.author_name) {
        lastEditorBadge = `<span class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-700"><span class="material-icons text-[12px]">manage_accounts</span>แก้ล่าสุด: ${item.last_editor}</span>`;
    }

    // read button
    const myUsername = (currentUser && currentUser.username) || '';
    const isRead = (item.read_by || []).includes(myUsername);
    const readBtn = isRead
        ? '<button onclick="sop_unmarkRead(\'' + item.id + '\')" class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 px-3 py-2 rounded-lg transition border border-emerald-300 dark:border-emerald-700 shadow-sm flex items-center gap-1 text-xs font-bold" title="คลิกเพื่อยกเลิก"><span class="material-icons text-[16px]">verified</span>อ่านแล้ว</button>'
        : '<button onclick="sop_markRead(\'' + item.id + '\')" class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 px-3 py-2 rounded-lg transition border border-blue-300 dark:border-blue-700 shadow-sm flex items-center gap-1 text-xs font-bold"><span class="material-icons text-[16px]">check_circle</span>กดเมื่ออ่านแล้ว</button>';

    // admin buttons (pin toggle + edit + delete)
    let adminBtns = '';
    if (isAdmin) {
        const pinTitle = item.pinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด';
        const pinClass = item.pinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400 bg-white dark:bg-slate-800';
        adminBtns = `
            <button onclick="sop_togglePin('${item.id}')" class="${pinClass} hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-amber-600 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="${pinTitle}"><span class="material-icons">push_pin</span></button>
            <button onclick="sop_editRule('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/20 text-gray-400 hover:text-amber-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="แก้ไข"><span class="material-icons">edit</span></button>
            <button onclick="sop_deleteRule('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ลบ"><span class="material-icons">delete</span></button>`;
    }

    const displayCat = globalSOPCategories.find(c => c.id === item.category)?.name || item.category || 'ไม่ระบุหมวด';

    // attachments
    let attachmentsBlock = '';
    if (item.attachments && item.attachments.length > 0) {
        const attHtml = item.attachments.map(att => {
            const isPdf = (att.url || '').toLowerCase().includes('.pdf') || att.type === 'pdf';
            if (isPdf) return window.renderTemplate('tpl-sop-attach-pdf', { url: att.url, name: att.name || 'เอกสาร' });
            return window.renderTemplate('tpl-sop-attach-img', { url: att.url });
        }).join('');
        attachmentsBlock = window.renderTemplate('tpl-sop-attachments', { attachmentsHtml: attHtml, count: item.attachments.length });
    }

    // examples
    let examplesBlock = '';
    if (item.examples && item.examples.trim()) {
        const formattedExamples = item.examples.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        examplesBlock = window.renderTemplate('tpl-sop-examples', { formattedExamples });
    }

    // history
    let historyBlock = '';
    if (item.history && item.history.length > 0) {
        const histItems = item.history.slice().reverse().map(h => window.renderTemplate('tpl-sop-history-item', {
            editor: h.editor || 'ไม่ระบุ',
            dateStr: h.timestamp ? new Date(h.timestamp).toLocaleString('th-TH') : '-'
        })).join('');
        historyBlock = window.renderTemplate('tpl-sop-history', { count: item.history.length, historyItemsHtml: histItems });
    }

    reader.innerHTML = window.renderTemplate('tpl-sop-read', {
        id: item.id,
        displayCat,
        title: item.title || '-',
        author_name: item.author_name || 'ไม่ระบุ',
        updateDateStr,
        priorityBigBadge, pinnedBigBadge, shiftBigBadges, tagsBigHtml,
        readBtn, adminBtns,
        formattedContent,
        attachmentsBlock,
        examplesBlock,
        historyBlock,
        lastEditorBadge,
        viewCount: item.view_count || 0,
        readCount: (item.read_by || []).length
    });
};

// ==========================================
// ➕ ADD / EDIT MODAL
// ==========================================
window.sop_openAddModal = function() {
    sop_openEditModal(null);
};

window.sop_editRule = function(id) {
    const item = globalSOPData.find(x => String(x.id) === String(id));
    if (!item) return;
    sop_openEditModal(item);
};

function sop_openEditModal(existing) {
    const isEdit = !!existing;
    const titleVal = isEdit ? existing.title : '';
    const contentVal = isEdit ? existing.content : '';
    const examplesVal = isEdit ? (existing.examples || '') : '';
    const categoryVal = isEdit ? existing.category : (globalSOPCategories[0]?.id || '');
    const priorityVal = isEdit ? (existing.priority || 'medium') : 'medium';
    const pinnedVal = isEdit ? !!existing.pinned : false;
    const shiftsVal = isEdit ? (existing.shifts || ['all']) : ['all'];
    const tagsVal = isEdit ? (existing.tags || []) : [];

    // โหลดไฟล์เดิมเข้า buffer (clone)
    sopAttachmentsBuffer = isEdit ? JSON.parse(JSON.stringify(existing.attachments || [])) : [];

    const categoryOptions = globalSOPCategories.map(c =>
        `<option value="${c.id}" ${c.id === categoryVal ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const priorityOptions = SOP_PRIORITY_OPTIONS.map(p =>
        `<option value="${p.id}" ${p.id === priorityVal ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const shiftCheckboxes = `
        <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700">
            <input type="checkbox" id="sopShift_all" class="sop-shift-cb w-4 h-4 accent-rose-500" value="all" ${shiftsVal.includes('all') ? 'checked' : ''}>
            <span class="text-sm font-bold">🌐 ทุกกะ</span>
        </label>
        ${SOP_SHIFT_OPTIONS.map(s => `
            <label class="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700">
                <input type="checkbox" id="sopShift_${s.id}" class="sop-shift-cb w-4 h-4 accent-rose-500" value="${s.id}" ${shiftsVal.includes(s.id) ? 'checked' : ''}>
                <span class="text-sm font-bold">${s.label}</span>
            </label>
        `).join('')}
    `;

    const formHtml = `
        <div class="text-left space-y-3">
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">หมวดหมู่</label>
                    <select id="sopFormCategory" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm">${categoryOptions}</select>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">ระดับความสำคัญ</label>
                    <select id="sopFormPriority" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm">${priorityOptions}</select>
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">ชื่อกฎ <span class="text-red-500">*</span></label>
                <input type="text" id="sopFormTitle" value="${titleVal.replace(/"/g, '&quot;')}" placeholder="เช่น ขั้นตอนตรวจสลิปฝาก..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm">
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">ใช้กับกะไหน?</label>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">${shiftCheckboxes}</div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Tag (คั่นด้วยเว้นวรรค) — ไม่บังคับ</label>
                <input type="text" id="sopFormTags" value="${tagsVal.join(' ').replace(/"/g, '&quot;')}" placeholder="เช่น VIP urgent ใหม่ ลูกค้าเก่า" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm">
            </div>

            <div>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="sopFormPinned" class="w-4 h-4 accent-amber-500" ${pinnedVal ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-700 dark:text-gray-200 flex items-center gap-1"><span class="material-icons text-amber-500 text-[16px]">push_pin</span>ปักหมุดกฎนี้ — ให้เด้งบนสุดเสมอ</span>
                </label>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">รายละเอียด / ขั้นตอน <span class="text-red-500">*</span></label>
                <textarea id="sopFormContent" rows="6" placeholder="พิมพ์รายละเอียดของกฎ..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none text-sm whitespace-pre-wrap font-medium leading-relaxed">${contentVal}</textarea>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <span class="material-icons text-[14px] text-blue-500">lightbulb</span>ตัวอย่างเคส (ไม่บังคับ)
                </label>
                <textarea id="sopFormExamples" rows="3" placeholder="เช่น 'ลูกค้าฝาก 1000 พร้อมรับเครดิต 100 → ต้อง...'" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm whitespace-pre-wrap font-medium leading-relaxed">${examplesVal}</textarea>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <span class="material-icons text-[14px] text-amber-500">attach_file</span>ไฟล์ประกอบ (รูปภาพ / PDF)
                </label>
                <div class="flex gap-2 mb-2">
                    <input type="file" id="sopFormFiles" multiple accept="image/*,.pdf" class="hidden" onchange="sop_handleFileSelect(event)">
                    <button type="button" onclick="document.getElementById('sopFormFiles').click()" class="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 shadow-md transition active:scale-95"><span class="material-icons text-sm">upload</span>เลือกไฟล์</button>
                    <span class="text-[11px] text-gray-500 self-center">รองรับ JPG, PNG, PDF — เลือกได้หลายไฟล์</span>
                </div>
                <div id="sopAttachmentPreview" class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar"></div>
            </div>
        </div>
    `;

    Swal.fire({
        title: `<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-rose-500">${isEdit ? 'edit' : 'post_add'}</span> ${isEdit ? 'แก้ไขกฎ' : 'เพิ่มกฎใหม่'}</div>`,
        html: formHtml,
        width: '720px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        didOpen: () => {
            sop_renderAttachmentPreview();
            // ทำ logic ให้ "ทุกกะ" ถ้าติ๊ก จะ uncheck อันอื่น
            const allCb = document.getElementById('sopShift_all');
            const otherCbs = document.querySelectorAll('.sop-shift-cb:not(#sopShift_all)');
            if (allCb) {
                allCb.addEventListener('change', () => {
                    if (allCb.checked) otherCbs.forEach(c => c.checked = false);
                });
            }
            otherCbs.forEach(c => c.addEventListener('change', () => {
                if (c.checked && allCb) allCb.checked = false;
            }));
        },
        preConfirm: () => {
            const title = document.getElementById('sopFormTitle').value.trim();
            const content = document.getElementById('sopFormContent').value.trim();
            const category = document.getElementById('sopFormCategory').value;
            const priority = document.getElementById('sopFormPriority').value;
            const pinned = document.getElementById('sopFormPinned').checked;
            const examples = document.getElementById('sopFormExamples').value.trim();
            const tagsRaw = document.getElementById('sopFormTags').value.trim();
            const tags = tagsRaw ? tagsRaw.split(/\s+/).filter(t => t).map(t => t.replace(/^#/, '')) : [];

            const checkedShifts = Array.from(document.querySelectorAll('.sop-shift-cb:checked')).map(c => c.value);
            const shifts = checkedShifts.length > 0 ? checkedShifts : ['all'];

            if (!title)    { Swal.showValidationMessage('กรุณาใส่ชื่อกฎ'); return false; }
            if (!content)  { Swal.showValidationMessage('กรุณาใส่รายละเอียด'); return false; }
            if (!category) { Swal.showValidationMessage('กรุณาเลือกหมวด'); return false; }
            return { title, content, category, priority, pinned, examples, tags, shifts };
        }
    }).then(async (result) => {
        if (!result.isConfirmed || !result.value) {
            sopAttachmentsBuffer = [];
            return;
        }
        await sop_saveRule(existing, result.value);
    });
}

// ==========================================
// 📎 ATTACHMENTS BUFFER
// ==========================================
window.sop_handleFileSelect = async function(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // อัพโหลดทีละไฟล์ขึ้น Supabase Storage
    Swal.update({ title: 'กำลังอัพโหลดไฟล์...' });
    const submitBtn = Swal.getConfirmButton();
    if (submitBtn) submitBtn.disabled = true;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            const fileName = `sop/${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;

            const { error: upErr } = await appDB.storage.from('staff_images').upload(fileName, file, { cacheControl: '3600', upsert: false });
            if (upErr) throw new Error(upErr.message);

            const { data: pubData } = appDB.storage.from('staff_images').getPublicUrl(fileName);
            sopAttachmentsBuffer.push({
                url: pubData.publicUrl,
                name: file.name,
                type: ext === 'pdf' ? 'pdf' : 'image',
                path: fileName
            });
        } catch (e) {
            console.error('upload error:', e);
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            Toast.fire({ icon: 'error', title: `อัพ ${file.name} ไม่สำเร็จ` });
        }
    }

    sop_renderAttachmentPreview();
    if (submitBtn) submitBtn.disabled = false;
    Swal.update({ title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-rose-500">post_add</span> เพิ่มกฎใหม่</div>' });

    // เคลียร์ input เพื่อให้เลือกซ้ำได้
    event.target.value = '';
};

window.sop_renderAttachmentPreview = function() {
    const container = document.getElementById('sopAttachmentPreview');
    if (!container) return;
    if (sopAttachmentsBuffer.length === 0) {
        container.innerHTML = '<div class="text-[11px] text-gray-400 italic text-center py-2">ยังไม่มีไฟล์แนบ</div>';
        return;
    }
    container.innerHTML = sopAttachmentsBuffer.map((att, idx) => {
        if (att.type === 'pdf' || (att.url || '').toLowerCase().includes('.pdf')) {
            return window.renderTemplate('tpl-sop-attach-preview-pdf', { name: att.name, index: idx });
        }
        return window.renderTemplate('tpl-sop-attach-preview-img', { url: att.url, name: att.name, index: idx });
    }).join('');
};

window.sop_removeAttachment = function(idx) {
    sopAttachmentsBuffer.splice(idx, 1);
    sop_renderAttachmentPreview();
};

// ==========================================
// 💾 SAVE RULE
// ==========================================
window.sop_saveRule = async function(existing, formData) {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();

        if (existing) {
            const idx = globalSOPData.findIndex(x => String(x.id) === String(existing.id));
            if (idx !== -1) {
                // เก็บประวัติเก่าไว้ (เก็บแค่ 5 ครั้งล่าสุด)
                const newHistory = (globalSOPData[idx].history || []).slice();
                newHistory.push({
                    timestamp: nowIso,
                    editor: authorName,
                    title_before: globalSOPData[idx].title
                });
                while (newHistory.length > 5) newHistory.shift();

                globalSOPData[idx] = {
                    ...globalSOPData[idx],
                    title: formData.title,
                    content: formData.content,
                    examples: formData.examples,
                    category: formData.category,
                    priority: formData.priority,
                    pinned: formData.pinned,
                    shifts: formData.shifts,
                    tags: formData.tags,
                    attachments: sopAttachmentsBuffer,
                    updated_at: nowIso,
                    last_editor: authorName,
                    history: newHistory
                };
            }
        } else {
            globalSOPData.unshift({
                id: 'sop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                title: formData.title,
                content: formData.content,
                examples: formData.examples,
                category: formData.category,
                priority: formData.priority,
                pinned: formData.pinned,
                shifts: formData.shifts,
                tags: formData.tags,
                attachments: sopAttachmentsBuffer,
                view_count: 0,
                read_by: [],
                history: [],
                author_name: authorName,
                last_editor: authorName,
                created_at: nowIso,
                updated_at: nowIso
            });
        }

        sopAttachmentsBuffer = [];
        await sop_saveAllData();
        sop_sortData();
        sop_renderList();

        if (existing) sop_readRule(existing.id, true);
        else {
            currentSopId = globalSOPData[0]?.id;
            if (currentSopId) sop_readRule(currentSopId, true);
        }

        Swal.fire({ icon: 'success', title: existing ? 'แก้ไขสำเร็จ!' : 'เพิ่มกฎสำเร็จ!', timer: 1200, showConfirmButton: false });
    } catch (e) {
        console.error('sop_saveRule error:', e);
        Swal.fire('Error', e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
};

// ==========================================
// 🗑️ DELETE
// ==========================================
window.sop_deleteRule = async function(id) {
    const item = globalSOPData.find(x => String(x.id) === String(id));
    if (!item) return;
    const confirm = await Swal.fire({
        title: 'ยืนยันลบกฎนี้?',
        html: `<div class="text-left text-sm">
                  <div class="font-bold text-slate-700 dark:text-gray-200 mb-1">${item.title}</div>
                  <div class="text-gray-500 text-xs">ลบแล้วจะไม่สามารถกู้คืนได้ (ไฟล์แนบจะยังอยู่ใน Storage)</div>
               </div>`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง', cancelButtonText: 'ยกเลิก'
    });
    if (!confirm.isConfirmed) return;
    Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
    try {
        globalSOPData = globalSOPData.filter(x => String(x.id) !== String(id));
        await sop_saveAllData();
        if (currentSopId === id) {
            currentSopId = null;
            document.getElementById('sopReaderContent').innerHTML = window.renderTemplate('tpl-sop-empty');
        }
        sop_renderList();
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', timer: 1000, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'ลบไม่สำเร็จ', 'error');
    }
};

// ==========================================
// 📌 PIN / UNPIN
// ==========================================
window.sop_togglePin = async function(id) {
    const item = globalSOPData.find(x => String(x.id) === String(id));
    if (!item) return;
    item.pinned = !item.pinned;
    item.updated_at = new Date().toISOString();
    try {
        await sop_saveAllData();
        sop_sortData();
        sop_renderList();
        sop_readRule(id, true);
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: item.pinned ? 'ปักหมุดแล้ว' : 'ยกเลิกปักหมุด' });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// ✅ READ RECEIPTS
// ==========================================
window.sop_markRead = async function(id) {
    const item = globalSOPData.find(x => String(x.id) === String(id));
    if (!item) return;
    const myUsername = (currentUser && currentUser.username) || '';
    if (!myUsername) return;
    if (!item.read_by) item.read_by = [];
    if (!item.read_by.includes(myUsername)) item.read_by.push(myUsername);
    try {
        await sop_saveAllData();
        sop_renderList();
        sop_readRule(id, true);
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
        Toast.fire({ icon: 'success', title: 'บันทึกว่าอ่านแล้ว' });
    } catch (e) { console.error(e); }
};

window.sop_unmarkRead = async function(id) {
    const item = globalSOPData.find(x => String(x.id) === String(id));
    if (!item) return;
    const myUsername = (currentUser && currentUser.username) || '';
    if (!myUsername || !item.read_by) return;
    item.read_by = item.read_by.filter(u => u !== myUsername);
    try {
        await sop_saveAllData();
        sop_renderList();
        sop_readRule(id, true);
    } catch (e) { console.error(e); }
};

// ==========================================
// 📋 COPY RULE
// ==========================================
window.sop_copyRule = function(id) {
    const item = globalSOPData.find(x => String(x.id) === String(id));
    if (!item) return;
    const displayCat = globalSOPCategories.find(c => c.id === item.category)?.name || item.category;
    const priorityOpt = SOP_PRIORITY_OPTIONS.find(p => p.id === item.priority) || SOP_PRIORITY_OPTIONS[1];

    let text = `📋 ${item.title}\n`;
    text += `หมวด: ${displayCat}\n`;
    text += `ระดับ: ${priorityOpt.label}\n`;
    if (item.tags && item.tags.length > 0) text += `Tag: ${item.tags.map(t => '#' + t).join(' ')}\n`;
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📌 รายละเอียด:\n${item.content || '-'}\n`;
    if (item.examples && item.examples.trim()) {
        text += `\n💡 ตัวอย่างเคส:\n${item.examples}\n`;
    }
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `อัปเดตล่าสุด: ${new Date(item.updated_at || item.created_at).toLocaleString('th-TH')}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            Toast.fire({ icon: 'success', title: 'ก๊อปแล้ว! เอาไปวางในแชทได้เลย' });
        }).catch(() => sop_copyFallback(text));
    } else {
        sop_copyFallback(text);
    }
};

function sop_copyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    Toast.fire({ icon: 'success', title: 'ก๊อปแล้ว!' });
}
