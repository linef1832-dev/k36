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
let sopRulesBuffer = [];       // กติกา (V3) ที่กำลังแก้ในฟอร์ม
let sopActiveTab = 'rules';    // V3.4: 'rules' | 'sop'

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
    const rulesAdminControls = document.getElementById('sopRulesAdminControls');
    if (rulesAdminControls) {
        if (isAdmin) rulesAdminControls.classList.remove('hidden');
        else rulesAdminControls.classList.add('hidden');
    }

    currentSopId = null;
    sopPinFilterActive = false;
    sop_updatePinFilterBtn();
    document.getElementById('sopReaderContent').innerHTML = window.renderTemplate('tpl-sop-empty');

    await sop_loadCategories();
    await sop_fetchData();

    // V3.4: ตั้ง tab default = "กติกา"
    sopActiveTab = 'rules';
    sop_switchTab('rules');
};

// ==========================================
// 🆕 V3.4: TAB SWITCHER
// ==========================================
window.sop_switchTab = function(tabName) {
    sopActiveTab = tabName;

    const tabRules = document.getElementById('sopTab_rules');
    const tabSop = document.getElementById('sopTab_sop');
    const btnRules = document.getElementById('sopTabBtn_rules');
    const btnSop = document.getElementById('sopTabBtn_sop');

    if (tabName === 'rules') {
        if (tabRules) { tabRules.classList.remove('hidden'); tabRules.classList.add('flex'); }
        if (tabSop)   { tabSop.classList.add('hidden');     tabSop.classList.remove('flex'); }
        if (btnRules) {
            btnRules.classList.remove('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnRules.classList.add('bg-gradient-to-b', 'from-orange-500', 'to-amber-500', 'text-white', 'border-orange-400', '-mb-px');
        }
        if (btnSop) {
            btnSop.classList.add('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnSop.classList.remove('bg-gradient-to-b', 'from-rose-500', 'to-pink-500', 'text-white', 'border-rose-400', '-mb-px');
        }
        sop_renderRulesCategoryDropdown();
        sop_renderAllRulesPage();
    } else {
        if (tabRules) { tabRules.classList.add('hidden');     tabRules.classList.remove('flex'); }
        if (tabSop)   { tabSop.classList.remove('hidden');   tabSop.classList.add('flex'); }
        if (btnSop) {
            btnSop.classList.remove('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnSop.classList.add('bg-gradient-to-b', 'from-rose-500', 'to-pink-500', 'text-white', 'border-rose-400', '-mb-px');
        }
        if (btnRules) {
            btnRules.classList.add('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnRules.classList.remove('bg-gradient-to-b', 'from-orange-500', 'to-amber-500', 'text-white', 'border-orange-400', '-mb-px');
        }
    }
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
    if (filterSelect) {
        const currentVal = filterSelect.value;
        let html = '<option value="ALL">📂 ทุกหมวดหมู่</option>';
        globalSOPCategories.forEach(c => html += `<option value="${c.id}">${c.name}</option>`);
        filterSelect.innerHTML = html;
        if (currentVal && (currentVal === 'ALL' || globalSOPCategories.some(c => c.id === currentVal))) filterSelect.value = currentVal;
        else filterSelect.value = 'ALL';
    }
    sop_renderRulesCategoryDropdown();
};

window.sop_renderRulesCategoryDropdown = function() {
    const filterSelect = document.getElementById('sopRulesCatFilter');
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
        // ทำ default field ที่อาจไม่มีใน V1/V2
        globalSOPData.forEach(r => {
            if (!r.priority) r.priority = 'medium';
            if (typeof r.pinned !== 'boolean') r.pinned = false;
            if (!Array.isArray(r.shifts)) r.shifts = ['all'];
            if (!Array.isArray(r.tags)) r.tags = [];
            if (!Array.isArray(r.attachments)) r.attachments = [];
            if (typeof r.view_count !== 'number') r.view_count = 0;
            if (!Array.isArray(r.read_by)) r.read_by = [];
            if (!Array.isArray(r.history)) r.history = [];
            if (!Array.isArray(r.rules)) r.rules = []; // V3: บล็อกกติกา [{type, text}]
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

    // V3.4: อัพเดทเลขแท็บ
    sop_updateTabCounters();

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

        // rules count badge (V3)
        const rulesCount = (item.rules || []).length;
        const rulesCountBadge = rulesCount > 0
            ? `<span class="flex items-center gap-0.5 text-orange-600 dark:text-orange-400"><span class="material-icons text-[11px]">gavel</span>${rulesCount}</span>`
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
            attachmentIcon,
            rulesCountBadge
        });
    }).join('');
};

// ==========================================
// 🔢 V3.4: TAB COUNTERS
// ==========================================
window.sop_updateTabCounters = function() {
    const sopBadge = document.getElementById('sopTabSopCount');
    const rulesBadge = document.getElementById('sopTabRulesCount');

    if (sopBadge) sopBadge.innerText = globalSOPData.length;

    let totalRules = 0;
    globalSOPData.forEach(r => totalRules += (r.rules || []).length);
    if (rulesBadge) rulesBadge.innerText = totalRules;
};

// ==========================================
// 🟠 V3.4: หน้ากติกาทั้งหมด (Tab Rules)
// ==========================================
window.sop_renderAllRulesPage = function() {
    const container = document.getElementById('sopAllRulesContainer');
    if (!container) return;

    const term = document.getElementById('sopRulesSearch') ? document.getElementById('sopRulesSearch').value.toLowerCase() : '';
    const cat = document.getElementById('sopRulesCatFilter') ? document.getElementById('sopRulesCatFilter').value : 'ALL';
    const typeF = document.getElementById('sopRulesTypeFilter') ? document.getElementById('sopRulesTypeFilter').value : 'ALL';

    let candidates = globalSOPData.filter(r => Array.isArray(r.rules) && r.rules.length > 0);
    if (cat !== 'ALL') candidates = candidates.filter(r => r.category === cat);

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    candidates.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const pa = priorityOrder[a.priority] ?? 1;
        const pb = priorityOrder[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });

    if (candidates.length === 0) {
        container.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md p-10 text-center">
                <span class="material-icons text-6xl opacity-30 mb-3 text-gray-400">gavel</span>
                <h3 class="text-lg font-black text-gray-500 dark:text-gray-400">ยังไม่มีกติกา</h3>
                <p class="text-sm text-gray-400 mt-1">ไปหน้า "รายละเอียด SOP" เพื่อเพิ่มกติกาในกฎต่างๆ</p>
            </div>`;
        return;
    }

    let html = '';
    let foundAny = false;

    candidates.forEach(rule => {
        let rs = (rule.rules || []).filter(r => {
            if (typeF !== 'ALL' && (r.type || 'do') !== typeF) return false;
            if (term && !(r.text || '').toLowerCase().includes(term) &&
                       !(rule.title || '').toLowerCase().includes(term)) return false;
            return true;
        });
        if (rs.length === 0) return;
        foundAny = true;

        let icon = 'rule';
        const c = rule.category || '';
        if (c.includes('ฝาก'))     icon = 'savings';
        else if (c.includes('ถอน')) icon = 'payments';
        else if (c.includes('เครดิต')) icon = 'monetization_on';
        else if (c.includes('พิเศษ')) icon = 'warning';
        else if (c.includes('ทั่วไป')) icon = 'menu_book';

        const categoryLabel = globalSOPCategories.find(x => x.id === rule.category)?.name || rule.category || 'ไม่ระบุ';

        const shifts = rule.shifts || ['all'];
        let shiftLabels = '';
        if (shifts.includes('all')) {
            shiftLabels = '<span class="bg-white/20 px-1.5 py-0.5 rounded">🌐 ทุกกะ</span>';
        } else {
            shifts.forEach(s => {
                const sOpt = SOP_SHIFT_OPTIONS.find(x => x.id === s);
                if (sOpt) shiftLabels += `<span class="bg-white/20 px-1.5 py-0.5 rounded">${sOpt.label}</span>`;
            });
        }

        // ปักหมุด badge
        const pinBadge = rule.pinned ? '<span class="bg-white/20 px-1.5 py-0.5 rounded flex items-center gap-0.5"><span class="material-icons text-[10px]">push_pin</span>ปักหมุด</span>' : '';

        // เช็คสิทธิ์ admin
        const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
        const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));

        let rulesItemsHtml = '';
        rs.forEach(r => {
            const t = r.type || 'do';
            let cfg = {
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                border: 'border-emerald-300 dark:border-emerald-700',
                labelBg: 'bg-emerald-500',
                ic: 'check_circle',
                lbl: 'ทำได้'
            };
            if (t === 'dont')      cfg = { bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-300 dark:border-red-700',         labelBg: 'bg-red-500',     ic: 'block',           lbl: 'ห้ามทำ' };
            else if (t === 'must') cfg = { bg: 'bg-orange-50 dark:bg-orange-900/20',   border: 'border-orange-300 dark:border-orange-700',   labelBg: 'bg-orange-500',  ic: 'priority_high',   lbl: 'ต้องทำ' };
            else if (t === 'info') cfg = { bg: 'bg-blue-50 dark:bg-blue-900/20',       border: 'border-blue-300 dark:border-blue-700',       labelBg: 'bg-blue-500',    ic: 'info',            lbl: 'หมายเหตุ' };

            const safeText = (r.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

            // หาตำแหน่งจริงของกติกาข้อนี้ใน rule.rules (เพราะ rs คือ filter)
            const actualIdx = rule.rules.indexOf(r);

            // ปุ่ม edit/delete (เฉพาะ admin)
            const adminBtns = isAdmin ? `
                <div class="flex flex-col gap-1 p-2 shrink-0 border-l ${cfg.border}">
                    <button onclick="sop_editSingleRule('${rule.id}', ${actualIdx})" class="bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-gray-400 hover:text-amber-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="แก้ไขกติกาข้อนี้"><span class="material-icons text-[16px]">edit</span></button>
                    <button onclick="sop_deleteSingleRule('${rule.id}', ${actualIdx})" class="bg-white dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ลบกติกาข้อนี้"><span class="material-icons text-[16px]">delete</span></button>
                </div>
            ` : '';

            rulesItemsHtml += `
                <div class="${cfg.bg} border ${cfg.border} rounded-xl flex items-stretch overflow-hidden">
                    <div class="${cfg.labelBg} text-white py-2 px-3 flex flex-col items-center justify-center shrink-0 w-16 md:w-20">
                        <span class="material-icons text-xl drop-shadow-sm">${cfg.ic}</span>
                        <span class="text-[9px] font-black uppercase tracking-wider mt-0.5 drop-shadow-sm">${cfg.lbl}</span>
                    </div>
                    <div class="flex-1 p-3 text-slate-800 dark:text-white text-sm leading-relaxed whitespace-pre-wrap font-medium">${safeText}</div>
                    ${adminBtns}
                </div>
            `;
        });

        const safeRuleTitle = (rule.title || '(ไม่มีชื่อ)').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        html += `
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md overflow-hidden">
                <div class="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-3 flex items-center gap-2 flex-wrap">
                    <div class="bg-white/20 p-1.5 rounded-lg shrink-0"><span class="material-icons text-[18px]">${icon}</span></div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-white font-black text-sm md:text-base tracking-wide truncate">${safeRuleTitle}</h3>
                        <div class="flex items-center gap-1.5 text-[10px] font-bold opacity-95 mt-1 flex-wrap">
                            ${pinBadge}
                            <span class="bg-white/20 px-1.5 py-0.5 rounded">${categoryLabel}</span>
                            ${shiftLabels}
                            <span class="bg-white/20 px-1.5 py-0.5 rounded">${rs.length} ข้อ</span>
                        </div>
                    </div>
                    <button onclick="sop_jumpToSopFromRules('${rule.id}')" class="bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 shrink-0" title="ดูรายละเอียดเต็ม">
                        <span class="material-icons text-[14px]">open_in_new</span> ดู SOP
                    </button>
                </div>
                <div class="p-4 space-y-2 bg-orange-50/40 dark:bg-slate-800/80">${rulesItemsHtml}</div>
            </div>
        `;
    });

    if (!foundAny) {
        container.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md p-10 text-center">
                <span class="material-icons text-6xl opacity-30 mb-3 text-gray-400">search_off</span>
                <h3 class="text-lg font-black text-gray-500 dark:text-gray-400">ไม่พบกติกาตามเงื่อนไข</h3>
                <p class="text-sm text-gray-400 mt-1">ลองเปลี่ยนคำค้นหาหรือ filter</p>
            </div>`;
        return;
    }

    container.innerHTML = html;
};

// V3.4: กระโดดจากแท็บกติกา → ไปแท็บ SOP เปิดกฎตัวนั้น
window.sop_jumpToSopFromRules = function(ruleId) {
    sop_switchTab('sop');
    setTimeout(() => sop_readRule(ruleId, false), 100);
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

    // rules block (V3.4) — ปุ่มลิงก์ไปแท็บกติกา
    let rulesBlock = '';
    if (item.rules && item.rules.length > 0) {
        rulesBlock = `
            <button onclick="sop_switchTab('rules')" class="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:via-amber-600 hover:to-orange-600 text-white rounded-2xl shadow-lg transition transform hover:scale-[1.01] active:scale-[0.99] overflow-hidden border-2 border-orange-400 dark:border-orange-600 group">
                <div class="px-6 py-4 flex items-center gap-4">
                    <div class="bg-white/20 p-3 rounded-2xl shadow-inner backdrop-blur-sm border border-white/20">
                        <span class="material-icons text-3xl">gavel</span>
                    </div>
                    <div class="flex-1 text-left">
                        <div class="text-xs font-bold opacity-80 uppercase tracking-wider mb-0.5">⚖️ กฎนี้มีกติกา</div>
                        <div class="text-lg md:text-xl font-black tracking-wide drop-shadow-sm">ดูกติกาทั้งหมด (${item.rules.length} ข้อ)</div>
                    </div>
                    <div class="bg-white/20 p-2 rounded-xl group-hover:bg-white/30 transition">
                        <span class="material-icons text-xl group-hover:translate-x-1 transition">arrow_forward</span>
                    </div>
                </div>
            </button>`;
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

    // read receipts (V3.1) - แสดงรายชื่อคนที่อ่านแล้ว
    let readReceiptsBlock = '';
    const readByList = item.read_by || [];
    if (readByList.length > 0) {
        const chipsHtml = readByList.map(uname => {
            const initials = (uname || '?').substring(0, 2).toUpperCase();
            return window.renderTemplate('tpl-sop-read-receipt-chip', { initials, username: uname });
        }).join('');
        const content = `<div class="flex flex-wrap gap-2">${chipsHtml}</div>`;
        readReceiptsBlock = window.renderTemplate('tpl-sop-read-receipts', { count: readByList.length, readReceiptsContent: content });
    } else {
        const emptyContent = `
            <div class="flex flex-col items-center text-center py-4 text-gray-400 dark:text-gray-500">
                <span class="material-icons text-3xl mb-1 opacity-40">person_off</span>
                <span class="text-xs font-bold">ยังไม่มีพนักงานกดรับทราบกฎนี้</span>
                <span class="text-[10px] mt-1 italic">เมื่ออ่านเสร็จกดปุ่ม "✅ กดเมื่ออ่านแล้ว" ด้านบน</span>
            </div>
        `;
        readReceiptsBlock = window.renderTemplate('tpl-sop-read-receipts', { count: 0, readReceiptsContent: emptyContent });
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
        rulesBlock,
        readReceiptsBlock,
        attachmentsBlock,
        examplesBlock,
        historyBlock,
        lastEditorBadge,
        viewCount: item.view_count || 0,
        readCount: (item.read_by || []).length,
        attachmentCount: (item.attachments || []).length,
        historyCount: (item.history || []).length
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
    const rulesVal = isEdit ? (existing.rules || []) : [];

    // โหลดไฟล์เดิมเข้า buffer (clone)
    sopAttachmentsBuffer = isEdit ? JSON.parse(JSON.stringify(existing.attachments || [])) : [];
    sopRulesBuffer = JSON.parse(JSON.stringify(rulesVal));

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

            <div class="border-t-2 border-dashed border-gray-200 dark:border-slate-700 pt-3"></div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">รายละเอียด / ขั้นตอน <span class="text-red-500">*</span></label>
                <textarea id="sopFormContent" rows="5" placeholder="พิมพ์รายละเอียดของกฎ — บอกภาพรวมของขั้นตอนที่ต้องทำ..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none text-sm whitespace-pre-wrap font-medium leading-relaxed">${contentVal}</textarea>
            </div>

            <!-- ⚖️ กติกา (NEW V3) -->
            <div class="border-2 border-orange-300 dark:border-orange-700/50 rounded-2xl p-4 bg-orange-50/50 dark:bg-orange-900/10">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-icons text-orange-500">gavel</span>
                    <span class="text-sm font-black text-orange-700 dark:text-orange-300 uppercase tracking-wider">กติกา / ข้อบังคับ</span>
                    <span class="ml-auto text-[10px] text-gray-500 italic">เพิ่มกติกาแบบเป็นข้อๆ</span>
                </div>
                <div id="sopRulesEditor" class="space-y-2 mb-3"></div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                    <button type="button" onclick="sop_addRuleItem('do')" class="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"><span class="material-icons text-[14px]">check_circle</span>+ ทำได้</button>
                    <button type="button" onclick="sop_addRuleItem('must')" class="bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"><span class="material-icons text-[14px]">priority_high</span>+ ต้องทำ</button>
                    <button type="button" onclick="sop_addRuleItem('dont')" class="bg-red-500 hover:bg-red-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"><span class="material-icons text-[14px]">block</span>+ ห้ามทำ</button>
                    <button type="button" onclick="sop_addRuleItem('info')" class="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"><span class="material-icons text-[14px]">info</span>+ หมายเหตุ</button>
                </div>
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
        width: '760px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        didOpen: () => {
            sop_renderAttachmentPreview();
            sop_renderRulesEditor();
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

            // sync rules from inputs
            sop_syncRulesFromInputs();
            const rules = sopRulesBuffer.filter(r => r.text && r.text.trim());

            if (!title)    { Swal.showValidationMessage('กรุณาใส่ชื่อกฎ'); return false; }
            if (!content)  { Swal.showValidationMessage('กรุณาใส่รายละเอียด'); return false; }
            if (!category) { Swal.showValidationMessage('กรุณาเลือกหมวด'); return false; }
            return { title, content, category, priority, pinned, examples, tags, shifts, rules };
        }
    }).then(async (result) => {
        if (!result.isConfirmed || !result.value) {
            sopAttachmentsBuffer = [];
            sopRulesBuffer = [];
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
                    rules: formData.rules || [],
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
                rules: formData.rules || [],
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
        sopRulesBuffer = [];
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
// ⚖️ RULES EDITOR (V3)
// ==========================================
window.sop_addRuleItem = function(type) {
    sop_syncRulesFromInputs();
    sopRulesBuffer.push({ type: type, text: '' });
    sop_renderRulesEditor();
    // โฟกัสที่ช่องที่เพิ่มใหม่
    setTimeout(() => {
        const inputs = document.querySelectorAll('.sop-rule-input');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
};

window.sop_removeRuleItem = function(idx) {
    sop_syncRulesFromInputs();
    sopRulesBuffer.splice(idx, 1);
    sop_renderRulesEditor();
};

window.sop_moveRuleItem = function(idx, dir) {
    sop_syncRulesFromInputs();
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sopRulesBuffer.length) return;
    [sopRulesBuffer[idx], sopRulesBuffer[newIdx]] = [sopRulesBuffer[newIdx], sopRulesBuffer[idx]];
    sop_renderRulesEditor();
};

window.sop_syncRulesFromInputs = function() {
    document.querySelectorAll('.sop-rule-input').forEach(inp => {
        const idx = parseInt(inp.dataset.idx);
        if (!isNaN(idx) && sopRulesBuffer[idx]) {
            sopRulesBuffer[idx].text = inp.value;
        }
    });
};

window.sop_renderRulesEditor = function() {
    const container = document.getElementById('sopRulesEditor');
    if (!container) return;
    if (sopRulesBuffer.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 text-xs py-3 italic border border-dashed border-gray-300 dark:border-slate-600 rounded-lg">ยังไม่มีกติกา — กดปุ่มด้านล่างเพื่อเพิ่ม</div>';
        return;
    }
    container.innerHTML = sopRulesBuffer.map((r, idx) => {
        const t = r.type || 'do';
        let bg = 'bg-emerald-50 dark:bg-emerald-900/20', border = 'border-emerald-300 dark:border-emerald-700', icon = 'check_circle', iconColor = 'text-emerald-500', label = 'ทำได้';
        if (t === 'dont') { bg = 'bg-red-50 dark:bg-red-900/20'; border = 'border-red-300 dark:border-red-700'; icon = 'block'; iconColor = 'text-red-500'; label = 'ห้ามทำ'; }
        else if (t === 'must') { bg = 'bg-orange-50 dark:bg-orange-900/20'; border = 'border-orange-300 dark:border-orange-700'; icon = 'priority_high'; iconColor = 'text-orange-500'; label = 'ต้องทำ'; }
        else if (t === 'info') { bg = 'bg-blue-50 dark:bg-blue-900/20'; border = 'border-blue-300 dark:border-blue-700'; icon = 'info'; iconColor = 'text-blue-500'; label = 'หมายเหตุ'; }

        const safeText = (r.text || '').replace(/"/g, '&quot;');
        return `
            <div class="${bg} border ${border} rounded-xl p-2 flex items-start gap-2">
                <div class="flex flex-col items-center gap-0.5 shrink-0 mt-1">
                    <span class="material-icons ${iconColor} text-[20px]">${icon}</span>
                    <span class="text-[8px] font-black ${iconColor} uppercase tracking-wider">${label}</span>
                </div>
                <textarea class="sop-rule-input flex-1 p-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-400 resize-none" rows="2" data-idx="${idx}" placeholder="พิมพ์เนื้อหากติกา...">${safeText}</textarea>
                <div class="flex flex-col gap-0.5 shrink-0">
                    <button type="button" onclick="sop_moveRuleItem(${idx}, -1)" class="text-gray-400 hover:text-blue-500 p-1 rounded transition disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}><span class="material-icons text-[16px]">arrow_upward</span></button>
                    <button type="button" onclick="sop_moveRuleItem(${idx}, 1)" class="text-gray-400 hover:text-blue-500 p-1 rounded transition disabled:opacity-30" ${idx === sopRulesBuffer.length - 1 ? 'disabled' : ''}><span class="material-icons text-[16px]">arrow_downward</span></button>
                    <button type="button" onclick="sop_removeRuleItem(${idx})" class="text-gray-400 hover:text-red-500 p-1 rounded transition"><span class="material-icons text-[16px]">close</span></button>
                </div>
            </div>
        `;
    }).join('');
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

    if (item.rules && item.rules.length > 0) {
        text += `\n⚖️ กติกา / ข้อบังคับ:\n`;
        item.rules.forEach(r => {
            let prefix = '✅';
            if (r.type === 'dont') prefix = '❌';
            else if (r.type === 'must') prefix = '⚠️';
            else if (r.type === 'info') prefix = 'ℹ️';
            text += `${prefix} ${r.text}\n`;
        });
    }

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

// ==========================================
// 🆕 V3.5: เพิ่มกติกาแบบเร็ว (Quick Add) - เลือกกฎ + ใส่กติกาทันที
// ==========================================
window.sop_quickAddRule = async function() {
    if (globalSOPData.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'ยังไม่มีกฎในระบบ',
            text: 'กรุณาไปที่แท็บ "รายละเอียด SOP" แล้วกด "เพิ่มกฎใหม่" ก่อนครับ',
            confirmButtonColor: '#f97316'
        });
        return;
    }

    // สร้าง dropdown options ของกฎทั้งหมด (เรียงตาม pinned + ล่าสุด)
    const sortedRules = [...globalSOPData].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });

    const ruleOptions = sortedRules.map(r => {
        const cat = globalSOPCategories.find(c => c.id === r.category)?.name || r.category || '';
        const pin = r.pinned ? '📌 ' : '';
        const count = (r.rules || []).length;
        const safeTitle = (r.title || '(ไม่มีชื่อ)').replace(/"/g, '&quot;');
        return `<option value="${r.id}">${pin}${safeTitle} — ${cat} (${count} ข้อ)</option>`;
    }).join('');

    const formHtml = `
        <div class="text-left space-y-3">
            <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-xl p-3 text-sm flex gap-2 items-start">
                <span class="material-icons text-orange-500 text-[18px] mt-0.5">info</span>
                <div class="text-slate-700 dark:text-gray-200">
                    <div class="font-bold mb-0.5">วิธีใช้</div>
                    <div class="text-xs">เลือกกฎที่ต้องการเพิ่มกติกา → เลือกประเภท → พิมพ์เนื้อหา → บันทึก</div>
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">เลือกกฎที่จะเพิ่มกติกา <span class="text-red-500">*</span></label>
                <select id="qaRuleSelect" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm">${ruleOptions}</select>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">ประเภทกติกา <span class="text-red-500">*</span></label>
                <div class="grid grid-cols-2 gap-2">
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-500 transition has-[:checked]:bg-emerald-200 dark:has-[:checked]:bg-emerald-900/50 has-[:checked]:border-emerald-500">
                        <input type="radio" name="qaRuleType" value="do" class="w-4 h-4 accent-emerald-500" checked>
                        <span class="material-icons text-emerald-500 text-[18px]">check_circle</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">ทำได้</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500 transition has-[:checked]:bg-orange-200 dark:has-[:checked]:bg-orange-900/50 has-[:checked]:border-orange-500">
                        <input type="radio" name="qaRuleType" value="must" class="w-4 h-4 accent-orange-500">
                        <span class="material-icons text-orange-500 text-[18px]">priority_high</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">ต้องทำ</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 hover:border-red-500 transition has-[:checked]:bg-red-200 dark:has-[:checked]:bg-red-900/50 has-[:checked]:border-red-500">
                        <input type="radio" name="qaRuleType" value="dont" class="w-4 h-4 accent-red-500">
                        <span class="material-icons text-red-500 text-[18px]">block</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">ห้ามทำ</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-500 transition has-[:checked]:bg-blue-200 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-500">
                        <input type="radio" name="qaRuleType" value="info" class="w-4 h-4 accent-blue-500">
                        <span class="material-icons text-blue-500 text-[18px]">info</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">หมายเหตุ</span>
                    </label>
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">เนื้อหากติกา <span class="text-red-500">*</span></label>
                <textarea id="qaRuleText" rows="4" placeholder="พิมพ์เนื้อหากติกา..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm whitespace-pre-wrap font-medium leading-relaxed"></textarea>
            </div>
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-orange-500">add_circle</span> เพิ่มกติกาใหม่</div>',
        html: formHtml,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> เพิ่มกติกา',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const ruleId = document.getElementById('qaRuleSelect').value;
            const typeEl = document.querySelector('input[name="qaRuleType"]:checked');
            const ruleType = typeEl ? typeEl.value : 'do';
            const text = document.getElementById('qaRuleText').value.trim();
            if (!ruleId)  { Swal.showValidationMessage('กรุณาเลือกกฎ'); return false; }
            if (!text)    { Swal.showValidationMessage('กรุณาพิมพ์เนื้อหากติกา'); return false; }
            return { ruleId, ruleType, text };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    // เพิ่มกติกาเข้ากฎที่เลือก
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        const idx = globalSOPData.findIndex(x => String(x.id) === String(result.value.ruleId));
        if (idx === -1) throw new Error('ไม่พบกฎ');

        if (!Array.isArray(globalSOPData[idx].rules)) globalSOPData[idx].rules = [];
        globalSOPData[idx].rules.push({
            type: result.value.ruleType,
            text: result.value.text
        });

        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();
        globalSOPData[idx].updated_at = nowIso;
        globalSOPData[idx].last_editor = authorName;

        // บันทึกประวัติ
        if (!Array.isArray(globalSOPData[idx].history)) globalSOPData[idx].history = [];
        globalSOPData[idx].history.push({
            timestamp: nowIso,
            editor: authorName,
            title_before: globalSOPData[idx].title
        });
        while (globalSOPData[idx].history.length > 5) globalSOPData[idx].history.shift();

        await sop_saveAllData();
        sop_sortData();
        sop_renderAllRulesPage();
        sop_renderList();
        sop_updateTabCounters();

        Swal.fire({ icon: 'success', title: 'เพิ่มกติกาสำเร็จ!', timer: 1200, showConfirmButton: false });
    } catch (e) {
        console.error('quickAddRule error:', e);
        Swal.fire('Error', e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
};

// ==========================================
// 🆕 V3.6: แก้/ลบ กติกาทีละข้อ (จากแท็บกติกา)
// ==========================================
window.sop_editSingleRule = async function(ruleId, ruleIdx) {
    const sop = globalSOPData.find(x => String(x.id) === String(ruleId));
    if (!sop || !sop.rules || !sop.rules[ruleIdx]) return;

    const r = sop.rules[ruleIdx];
    const currentType = r.type || 'do';
    const currentText = r.text || '';

    const formHtml = `
        <div class="text-left space-y-3">
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs">
                <div class="text-gray-500 dark:text-gray-400 mb-0.5">กฎ:</div>
                <div class="font-bold text-slate-800 dark:text-white">${(sop.title || '(ไม่มีชื่อ)').replace(/</g, '&lt;')}</div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">ประเภทกติกา <span class="text-red-500">*</span></label>
                <div class="grid grid-cols-2 gap-2">
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-500 transition has-[:checked]:bg-emerald-200 dark:has-[:checked]:bg-emerald-900/50 has-[:checked]:border-emerald-500">
                        <input type="radio" name="qaRuleType" value="do" class="w-4 h-4 accent-emerald-500" ${currentType === 'do' ? 'checked' : ''}>
                        <span class="material-icons text-emerald-500 text-[18px]">check_circle</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">ทำได้</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500 transition has-[:checked]:bg-orange-200 dark:has-[:checked]:bg-orange-900/50 has-[:checked]:border-orange-500">
                        <input type="radio" name="qaRuleType" value="must" class="w-4 h-4 accent-orange-500" ${currentType === 'must' ? 'checked' : ''}>
                        <span class="material-icons text-orange-500 text-[18px]">priority_high</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">ต้องทำ</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 hover:border-red-500 transition has-[:checked]:bg-red-200 dark:has-[:checked]:bg-red-900/50 has-[:checked]:border-red-500">
                        <input type="radio" name="qaRuleType" value="dont" class="w-4 h-4 accent-red-500" ${currentType === 'dont' ? 'checked' : ''}>
                        <span class="material-icons text-red-500 text-[18px]">block</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">ห้ามทำ</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-500 transition has-[:checked]:bg-blue-200 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-500">
                        <input type="radio" name="qaRuleType" value="info" class="w-4 h-4 accent-blue-500" ${currentType === 'info' ? 'checked' : ''}>
                        <span class="material-icons text-blue-500 text-[18px]">info</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white">หมายเหตุ</span>
                    </label>
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">เนื้อหากติกา <span class="text-red-500">*</span></label>
                <textarea id="qaRuleText" rows="4" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm whitespace-pre-wrap font-medium leading-relaxed">${currentText}</textarea>
            </div>
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-amber-500">edit</span> แก้ไขกติกา</div>',
        html: formHtml,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const typeEl = document.querySelector('input[name="qaRuleType"]:checked');
            const ruleType = typeEl ? typeEl.value : 'do';
            const text = document.getElementById('qaRuleText').value.trim();
            if (!text) { Swal.showValidationMessage('กรุณาพิมพ์เนื้อหากติกา'); return false; }
            return { ruleType, text };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        sop.rules[ruleIdx].type = result.value.ruleType;
        sop.rules[ruleIdx].text = result.value.text;

        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();
        sop.updated_at = nowIso;
        sop.last_editor = authorName;

        if (!Array.isArray(sop.history)) sop.history = [];
        sop.history.push({ timestamp: nowIso, editor: authorName, title_before: sop.title });
        while (sop.history.length > 5) sop.history.shift();

        await sop_saveAllData();
        sop_renderAllRulesPage();
        sop_renderList();
        sop_updateTabCounters();

        Swal.fire({ icon: 'success', title: 'แก้ไขสำเร็จ!', timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
};

window.sop_deleteSingleRule = async function(ruleId, ruleIdx) {
    const sop = globalSOPData.find(x => String(x.id) === String(ruleId));
    if (!sop || !sop.rules || !sop.rules[ruleIdx]) return;

    const r = sop.rules[ruleIdx];
    let typeLabel = 'ทำได้';
    if (r.type === 'dont') typeLabel = 'ห้ามทำ';
    else if (r.type === 'must') typeLabel = 'ต้องทำ';
    else if (r.type === 'info') typeLabel = 'หมายเหตุ';

    const confirm = await Swal.fire({
        title: 'ยืนยันลบกติกาข้อนี้?',
        html: `<div class="text-left text-sm">
                  <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">ประเภท: <span class="font-bold">${typeLabel}</span></div>
                  <div class="font-bold text-slate-700 dark:text-gray-200 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border border-gray-200 dark:border-slate-700">${(r.text || '').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</div>
                  <div class="text-gray-500 text-xs mt-2">ลบแล้วจะไม่สามารถกู้คืนได้</div>
               </div>`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง', cancelButtonText: 'ยกเลิก'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
    try {
        sop.rules.splice(ruleIdx, 1);

        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();
        sop.updated_at = nowIso;
        sop.last_editor = authorName;

        if (!Array.isArray(sop.history)) sop.history = [];
        sop.history.push({ timestamp: nowIso, editor: authorName, title_before: sop.title });
        while (sop.history.length > 5) sop.history.shift();

        await sop_saveAllData();
        sop_renderAllRulesPage();
        sop_renderList();
        sop_updateTabCounters();

        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', timer: 1000, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'ลบไม่สำเร็จ', 'error');
    }
};

// ==========================================
// 🖼️ LIGHTBOX (ดูรูปขยายในหน้าเดียวกัน)
// ==========================================
let sopLightboxImages = [];
let sopLightboxIndex = 0;

window.sop_openLightbox = function(url) {
    // รวบรวมรูปทั้งหมดของกฎที่กำลังอ่านอยู่ เพื่อให้กดถัดไป/ก่อนหน้าได้
    const item = globalSOPData.find(x => String(x.id) === String(currentSopId));
    if (item && item.attachments) {
        sopLightboxImages = item.attachments
            .filter(a => a.type !== 'pdf' && !(a.url || '').toLowerCase().includes('.pdf'))
            .map(a => a.url);
    } else {
        sopLightboxImages = [url];
    }
    sopLightboxIndex = sopLightboxImages.indexOf(url);
    if (sopLightboxIndex < 0) sopLightboxIndex = 0;

    sop_showLightboxImage();

    const lb = document.getElementById('sopLightbox');
    if (lb) {
        lb.classList.remove('hidden');
        lb.classList.add('flex');
        document.body.style.overflow = 'hidden'; // กันสกอลล์ขณะเปิด
    }

    // ผูก keyboard
    document.addEventListener('keydown', sop_lightboxKeydown);
};

window.sop_closeLightbox = function(event) {
    // ถ้ากดที่รูปเอง ไม่ปิด
    if (event && event.target && event.target.tagName === 'IMG') return;

    const lb = document.getElementById('sopLightbox');
    if (lb) {
        lb.classList.add('hidden');
        lb.classList.remove('flex');
        document.body.style.overflow = '';
    }
    document.removeEventListener('keydown', sop_lightboxKeydown);
};

window.sop_lightboxNav = function(dir) {
    if (sopLightboxImages.length === 0) return;
    sopLightboxIndex = (sopLightboxIndex + dir + sopLightboxImages.length) % sopLightboxImages.length;
    sop_showLightboxImage();
};

function sop_showLightboxImage() {
    const img = document.getElementById('sopLightboxImg');
    const prevBtn = document.getElementById('sopLightboxPrev');
    const nextBtn = document.getElementById('sopLightboxNext');
    const counter = document.getElementById('sopLightboxCounter');

    if (!img) return;
    img.src = sopLightboxImages[sopLightboxIndex] || '';

    // โชว์ปุ่มก่อนหน้า/ถัดไป เฉพาะกรณีมีรูปมากกว่า 1
    if (sopLightboxImages.length > 1) {
        if (prevBtn) { prevBtn.classList.remove('hidden'); prevBtn.classList.add('flex'); }
        if (nextBtn) { nextBtn.classList.remove('hidden'); nextBtn.classList.add('flex'); }
        if (counter) {
            counter.classList.remove('hidden');
            counter.innerText = `${sopLightboxIndex + 1} / ${sopLightboxImages.length}`;
        }
    } else {
        if (prevBtn) prevBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.add('hidden');
        if (counter) counter.classList.add('hidden');
    }
}

function sop_lightboxKeydown(e) {
    if (e.key === 'Escape') sop_closeLightbox();
    else if (e.key === 'ArrowLeft') sop_lightboxNav(-1);
    else if (e.key === 'ArrowRight') sop_lightboxNav(1);
}
