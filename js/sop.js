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
let globalStandaloneRules = [];      // V4: กติกาแบบ standalone (Tab 1)
let currentSopId = null;
let sopPinFilterActive = false;
let sopAttachmentsBuffer = [];
let sopRulesBuffer = [];
let sopActiveTab = 'rules';

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
    await sop_loadTelegramConfig();
    await sop_loadGroups();

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
                { id: 'การฝาก',    name: '💰 การฝาก',    color: '#10b981' }, // เขียว
                { id: 'การถอน',    name: '💸 การถอน',    color: '#f97316' }, // ส้ม
                { id: 'เครดิต',    name: '🪙 เครดิต',    color: '#eab308' }, // เหลือง
                { id: 'เคสพิเศษ',  name: '⚠️ เคสพิเศษ',  color: '#ef4444' }, // แดง
                { id: 'กฎทั่วไป',  name: '📌 กฎทั่วไป',  color: '#3b82f6' }  // ฟ้า
            ];
            await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
        }
        // ทำ default field สำหรับหมวดเก่าที่ไม่มี color
        let needsSave = false;
        const defaultColors = ['#10b981', '#f97316', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#ec4899'];
        globalSOPCategories.forEach((c, i) => {
            if (!c.color) { c.color = defaultColors[i % defaultColors.length]; needsSave = true; }
        });
        if (needsSave) await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);

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
    const palette = [
        { val: '#10b981', name: 'เขียว' },
        { val: '#22c55e', name: 'เขียวสด' },
        { val: '#06b6d4', name: 'ฟ้าอมเขียว' },
        { val: '#3b82f6', name: 'ฟ้า' },
        { val: '#6366f1', name: 'น้ำเงิน' },
        { val: '#8b5cf6', name: 'ม่วง' },
        { val: '#a855f7', name: 'ม่วงสด' },
        { val: '#ec4899', name: 'ชมพู' },
        { val: '#ef4444', name: 'แดง' },
        { val: '#f97316', name: 'ส้ม' },
        { val: '#f59e0b', name: 'ส้มทอง' },
        { val: '#eab308', name: 'เหลือง' },
        { val: '#84cc16', name: 'เขียวมะนาว' },
        { val: '#64748b', name: 'เทา' }
    ];

    function buildPalette(currentColor, attr) {
        return palette.map(c => `
            <button type="button" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('ring-2','ring-slate-900','dark:ring-white','scale-110')); this.classList.add('ring-2','ring-slate-900','dark:ring-white','scale-110'); this.parentNode.dataset.${attr} = '${c.val}';"
                class="w-6 h-6 rounded-md border border-gray-300 dark:border-slate-600 shadow-sm transition ${currentColor === c.val ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : ''}"
                style="background-color: ${c.val};" title="${c.name}"></button>
        `).join('');
    }

    function buildList() {
        if (globalSOPCategories.length === 0) return '<div class="text-center text-gray-500 text-sm py-4">ไม่มีหมวดหมู่</div>';
        return globalSOPCategories.map((c, idx) => `
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl mb-2 shadow-sm overflow-hidden">
                <div class="px-3 py-2 flex justify-between items-center gap-2" style="border-left: 6px solid ${c.color || '#f97316'};">
                    <span class="text-slate-800 dark:text-white font-bold text-sm flex-1 truncate">${c.name}</span>
                    <button onclick="document.getElementById('sopCatPalette_${idx}').classList.toggle('hidden')" class="text-blue-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-blue-500 px-2 py-1.5 rounded-lg transition shadow-sm border border-gray-200 dark:border-slate-700" title="เปลี่ยนสี"><span class="material-icons text-[16px]">palette</span></button>
                    <button onclick="sop_deleteCategory(${idx})" class="text-red-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-red-500 px-2 py-1.5 rounded-lg transition shadow-sm border border-gray-200 dark:border-slate-700" title="ลบหมวดหมู่"><span class="material-icons text-[16px]">delete</span></button>
                </div>
                <div id="sopCatPalette_${idx}" class="hidden px-3 py-2 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <div class="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">เลือกสีหมวด</div>
                    <div class="flex flex-wrap gap-1.5" data-color="${c.color || '#f97316'}" id="sopCatPaletteBtns_${idx}">
                        ${buildPalette(c.color || '#f97316', 'color')}
                    </div>
                    <button onclick="sop_saveCategoryColor(${idx})" class="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold transition active:scale-95 shadow-sm flex items-center justify-center gap-1"><span class="material-icons text-[14px]">check</span>บันทึกสี</button>
                </div>
            </div>
        `).join('');
    }

    window.renderSopManageCatHtml = buildList;

    const initialPaletteHtml = buildPalette('#f97316', 'newcatcolor');

    const htmlContent = `
        <div class="text-left mt-4">
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4">
                <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">เพิ่มหมวดหมู่ใหม่</div>
                <input type="text" id="newSopCatName" placeholder="พิมพ์ชื่อหมวดหมู่ใหม่..." class="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-rose-500 shadow-inner font-bold mb-2">
                <div class="text-[10px] font-bold text-gray-500 mb-1.5">เลือกสี:</div>
                <div class="flex flex-wrap gap-1.5 mb-2" data-newcatcolor="#f97316" id="sopNewCatPalette">${initialPaletteHtml}</div>
                <button onclick="sop_addCategory()" class="w-full bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold shadow-md transition active:scale-95 flex items-center justify-center gap-1 border border-rose-500"><span class="material-icons text-sm">add</span> เพิ่มหมวดหมู่</button>
            </div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-slate-700 pb-1">หมวดหมู่ที่มีอยู่</div>
            <div id="sopCatListContainer" class="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
                ${buildList()}
            </div>
        </div>
    `;

    Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-rose-500">category</span> จัดการหมวดหมู่</div>',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        width: '560px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });
};

window.sop_saveCategoryColor = async function(idx) {
    const palette = document.getElementById(`sopCatPaletteBtns_${idx}`);
    if (!palette) return;
    const newColor = palette.dataset.color;
    if (!newColor || !globalSOPCategories[idx]) return;
    globalSOPCategories[idx].color = newColor;
    await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
    document.getElementById('sopCatListContainer').innerHTML = window.renderSopManageCatHtml();
    sop_renderAllRulesPage();
    sop_renderList();
    sop_showInlineToast('เปลี่ยนสีหมวดแล้ว ✅', 'success');
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
    // ดึงสีจาก palette
    const palette = document.getElementById('sopNewCatPalette');
    const color = (palette && palette.dataset.newcatcolor) || '#f97316';
    globalSOPCategories.push({ id, name: val, color });
    input.value = '';
    document.getElementById('sopCatListContainer').innerHTML = window.renderSopManageCatHtml();
    await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
    sop_renderCategoryDropdowns();
    sop_renderAllRulesPage();
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
        // ทำ default field ที่อาจไม่มีใน V1/V2/V3
        globalSOPData.forEach(r => {
            if (!r.priority) r.priority = 'medium';
            if (typeof r.pinned !== 'boolean') r.pinned = false;
            if (!Array.isArray(r.shifts)) r.shifts = ['all'];
            if (!Array.isArray(r.tags)) r.tags = [];
            if (!Array.isArray(r.attachments)) r.attachments = [];
            if (typeof r.view_count !== 'number') r.view_count = 0;
            if (!Array.isArray(r.read_by)) r.read_by = [];
            if (!Array.isArray(r.history)) r.history = [];
            if (!Array.isArray(r.rules)) r.rules = [];
            r.rules.forEach(rule => {
                if (!rule.color) rule.color = '';
                if (!rule.subgroup) rule.subgroup = '';
                if (!Array.isArray(rule.images)) rule.images = [];
            });
            if (!r.voice_url) r.voice_url = ''; // V6: voice note
        });
        sop_sortData();
        sop_renderList();
        if (currentSopId) sop_readRule(currentSopId, true);

        // V4: โหลด standalone rules (Tab 1)
        await sop_fetchStandaloneRules();
    } catch (e) {
        console.error('sop_fetchData error:', e);
        globalSOPData = [];
        sop_renderList();
    }
};

// V4: โหลด/บันทึก standalone rules (กติกาที่อยู่ใน Tab "กติกาขั้นตอน" — ไม่ผูกกับ SOP)
window.sop_fetchStandaloneRules = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_rules_standalone').single();
        if (data && data.value) {
            globalStandaloneRules = JSON.parse(data.value);
        } else {
            globalStandaloneRules = [];
        }
        // default fields
        globalStandaloneRules.forEach(r => {
            if (!r.color) r.color = '';
            if (!r.subgroup) r.subgroup = '';
            if (!Array.isArray(r.images)) r.images = [];
            if (!r.type) r.type = 'do';
            if (!r.title) r.title = '';
            if (!r.text) r.text = '';
            if (typeof r.pinned !== 'boolean') r.pinned = false;
            if (!Array.isArray(r.read_by)) r.read_by = []; // V6: เก็บ username คนที่อ่าน
            if (!r.voice_url) r.voice_url = ''; // V6: voice note URL
        });
        sop_updateUnreadBadge();
    } catch (e) {
        console.warn('sop_fetchStandaloneRules error (treating as empty):', e);
        globalStandaloneRules = [];
        sop_updateUnreadBadge();
    }
};

window.sop_saveStandaloneRules = async function() {
    await appDB.from('settings').upsert([{ key: 'sop_rules_standalone', value: JSON.stringify(globalStandaloneRules) }]);
    sop_updateUnreadBadge();
};

// V6: นับ OD/กติกา ที่ผู้ใช้ปัจจุบันยังไม่อ่าน → แสดงที่ Bell badge
window.sop_updateUnreadBadge = function() {
    const badge = document.getElementById('sopUnreadBadge');
    if (!badge) return;
    const myUsername = (currentUser && currentUser.username) || '';
    if (!myUsername) { badge.classList.add('hidden'); return; }

    let count = 0;
    // ขั้นตอน (SOP) - ใช้ read_by
    (globalSOPData || []).forEach(r => {
        const readBy = r.read_by || [];
        if (!readBy.includes(myUsername)) count++;
    });
    // กติกา (Standalone) - ใช้ read_by
    (globalStandaloneRules || []).forEach(r => {
        const readBy = r.read_by || [];
        if (!readBy.includes(myUsername)) count++;
    });

    if (count > 0) {
        badge.classList.remove('hidden');
        badge.innerText = count > 99 ? '99+' : count;
    } else {
        badge.classList.add('hidden');
    }
};

window.sop_saveAllData = async function() {
    await appDB.from('settings').upsert([{ key: 'sop_data', value: JSON.stringify(globalSOPData) }]);
    sop_updateUnreadBadge();
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

    // V4.2: จัดกลุ่มตามหมวดหมู่
    const groupedByCategory = {};
    filtered.forEach(item => {
        const catKey = item.category || '__uncat__';
        if (!groupedByCategory[catKey]) groupedByCategory[catKey] = [];
        groupedByCategory[catKey].push(item);
    });

    // เรียงลำดับหมวด: ตาม globalSOPCategories ก่อน → unmatched ท้าย
    const orderedCatKeys = [];
    globalSOPCategories.forEach(c => { if (groupedByCategory[c.id]) orderedCatKeys.push(c.id); });
    Object.keys(groupedByCategory).forEach(k => { if (!orderedCatKeys.includes(k)) orderedCatKeys.push(k); });

    function buildItemHtml(item) {
        let icon = 'rule', iconColor = 'text-gray-500 dark:text-gray-400';
        const cs = item.category || '';
        if (cs.includes('ฝาก'))     { icon = 'savings';        iconColor = 'text-emerald-500 dark:text-emerald-400'; }
        else if (cs.includes('ถอน')) { icon = 'payments';       iconColor = 'text-blue-500 dark:text-blue-400'; }
        else if (cs.includes('เครดิต')) { icon = 'monetization_on'; iconColor = 'text-amber-500 dark:text-amber-400'; }
        else if (cs.includes('พิเศษ')) { icon = 'warning';        iconColor = 'text-rose-500 dark:text-rose-400'; }
        else if (cs.includes('ทั่วไป')) { icon = 'menu_book';      iconColor = 'text-purple-500 dark:text-purple-400'; }

        const displayCat = globalSOPCategories.find(x => x.id === item.category)?.name || item.category;
        const dateRaw = item.updated_at || item.created_at;
        const date = dateRaw ? new Date(dateRaw).toLocaleDateString('th-TH') : '-';

        const priorityOpt = SOP_PRIORITY_OPTIONS.find(p => p.id === item.priority) || SOP_PRIORITY_OPTIONS[1];
        const priorityBorder = priorityOpt.border;
        const priorityBadge = item.priority === 'high'
            ? '<span class="text-[10px] mr-0.5" title="สำคัญมาก">🔴</span>'
            : (item.priority === 'medium' ? '<span class="text-[10px] mr-0.5" title="ปานกลาง">🟡</span>' : '<span class="text-[10px] mr-0.5" title="ทั่วไป">🟢</span>');

        const pinIcon = item.pinned ? '<span class="absolute top-1.5 right-1.5 material-icons text-amber-500 text-[16px]" title="ปักหมุด">push_pin</span>' : '';

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

        const readBy = item.read_by || [];
        const isReadByMe = readBy.includes(myUsername);
        let readIndicator = '';
        if (readBy.length > 0) {
            readIndicator = isReadByMe
                ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 flex items-center gap-0.5"><span class="material-icons text-[10px]">verified</span>อ่านแล้ว</span>`
                : `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-slate-600 flex items-center gap-0.5"><span class="material-icons text-[10px]">groups</span>${readBy.length} คน</span>`;
        }

        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = '<div class="flex flex-wrap gap-1 mt-1.5">' + item.tags.slice(0, 4).map(t => `<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">#${t}</span>`).join('') + (item.tags.length > 4 ? `<span class="text-[9px] px-1 text-gray-500">+${item.tags.length - 4}</span>` : '') + '</div>';
        }

        const attCount = (item.attachments || []).length;
        const attachmentIcon = attCount > 0
            ? `<span class="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><span class="material-icons text-[11px]">attach_file</span>${attCount}</span>`
            : '';

        // V6: voice icon
        const voiceIcon = item.voice_url
            ? `<span class="flex items-center gap-0.5 text-rose-600 dark:text-rose-400" title="มีเสียงอธิบาย"><span class="material-icons text-[11px]">mic</span></span>`
            : '';

        const activeBg = currentSopId === item.id
            ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-400 ring-2 ring-rose-300 dark:ring-rose-700'
            : 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/50 hover:bg-white dark:hover:bg-slate-800';

        // V4.3: ปุ่มย้ายหมวดเร็ว (เฉพาะ admin)
        const hasManagePermLi = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
        const isAdminLi = hasManagePermLi || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
        const moveCategoryBtn = isAdminLi
            ? `<button onclick="event.stopPropagation(); sop_quickMoveCategory('${item.id}')" class="ml-auto bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-400 hover:text-blue-500 px-2 py-1 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-1" title="ย้ายไปหมวดอื่น"><span class="material-icons text-[12px]">drive_file_move</span>ย้ายหมวด</button>`
            : '';

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
            voiceIcon,
            rulesCountBadge: '',
            moveCategoryBtn
        });
    }

    if (!window._sopCollapsedCats) window._sopCollapsedCats = new Set();

    let listHtml = '';
    orderedCatKeys.forEach(catKey => {
        const items = groupedByCategory[catKey];
        const catObj = globalSOPCategories.find(c => c.id === catKey);
        const catLabel = catKey === '__uncat__' ? '(ไม่ระบุหมวด)' : (catObj ? catObj.name : catKey);
        const catColor = catObj?.color || '#64748b';
        const isCollapsed = window._sopCollapsedCats.has(catKey);

        let catIcon = 'rule';
        if (catLabel.includes('ฝาก'))     catIcon = 'savings';
        else if (catLabel.includes('ถอน')) catIcon = 'payments';
        else if (catLabel.includes('เครดิต')) catIcon = 'monetization_on';
        else if (catLabel.includes('พิเศษ')) catIcon = 'warning';
        else if (catLabel.includes('ทั่วไป')) catIcon = 'menu_book';

        const itemsHtml = items.map(buildItemHtml).join('');
        const safeCatKey = (catKey || '').replace(/'/g, '');
        listHtml += `
            <div class="rounded-xl overflow-hidden shadow-sm mb-3 border border-gray-200 dark:border-slate-700">
                <div onclick="sop_toggleCatFolder('${safeCatKey}')" class="cursor-pointer text-white px-3 py-2 flex items-center gap-2 transition" style="background: ${catColor};">
                    <span class="material-icons text-[18px]">${catIcon}</span>
                    <span class="font-black text-sm tracking-wide flex-1 truncate">${(catLabel).replace(/</g, '&lt;')}</span>
                    <span class="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">${items.length}</span>
                    <span class="material-icons text-white transition ${isCollapsed ? '' : 'rotate-180'} text-[18px]">expand_more</span>
                </div>
                ${isCollapsed ? '' : `<div class="bg-slate-50 dark:bg-slate-900/30 p-2 space-y-2">${itemsHtml}</div>`}
            </div>
        `;
    });

    container.innerHTML = listHtml;
};

// V4.2: toggle category folder
window.sop_toggleCatFolder = function(catKey) {
    if (!window._sopCollapsedCats) window._sopCollapsedCats = new Set();
    if (window._sopCollapsedCats.has(catKey)) window._sopCollapsedCats.delete(catKey);
    else window._sopCollapsedCats.add(catKey);
    sop_renderList();
};

// V4.3: ย้ายกฎไปหมวดอื่นแบบรวดเร็ว
window.sop_quickMoveCategory = async function(ruleId) {
    const item = globalSOPData.find(r => String(r.id) === String(ruleId));
    if (!item) return;

    const currentCatLabel = globalSOPCategories.find(c => c.id === item.category)?.name || item.category || 'ไม่ระบุ';

    const optionsHtml = globalSOPCategories.map(c => {
        const isCurrent = c.id === item.category;
        const color = c.color || '#64748b';
        return `
            <button type="button" data-catid="${c.id}" onclick="document.querySelectorAll('.qmCatBtn').forEach(b=>b.classList.remove('ring-2','ring-blue-500','scale-[1.02]')); this.classList.add('ring-2','ring-blue-500','scale-[1.02]'); document.getElementById('qmSelected').value='${c.id}';" 
                class="qmCatBtn w-full text-left p-3 rounded-xl border-2 ${isCurrent ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 opacity-60' : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-blue-400'} transition flex items-center gap-3 mb-2 shadow-sm" ${isCurrent ? 'disabled' : ''}>
                <div class="w-5 h-5 rounded-md shrink-0" style="background-color: ${color};"></div>
                <span class="text-sm font-bold text-slate-800 dark:text-white flex-1">${c.name}</span>
                ${isCurrent ? '<span class="text-[10px] font-bold text-amber-600 dark:text-amber-400">หมวดปัจจุบัน</span>' : ''}
            </button>
        `;
    }).join('');

    const formHtml = `
        <div class="text-left">
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3 mb-4 text-sm">
                <div class="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1">กฎที่จะย้าย</div>
                <div class="font-bold text-slate-800 dark:text-white">${(item.title || '(ไม่มีชื่อ)').replace(/</g, '&lt;')}</div>
                <div class="text-xs text-gray-500 mt-1">หมวดปัจจุบัน: <span class="font-bold">${currentCatLabel}</span></div>
            </div>
            <div class="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">เลือกหมวดใหม่</div>
            <div class="max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">${optionsHtml}</div>
            <input type="hidden" id="qmSelected" value="">
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">drive_file_move</span> ย้ายไปหมวดอื่น</div>',
        html: formHtml,
        width: '500px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">check</span> ย้าย',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const newCat = document.getElementById('qmSelected').value;
            if (!newCat) { Swal.showValidationMessage('กรุณาเลือกหมวดใหม่'); return false; }
            if (newCat === item.category) { Swal.showValidationMessage('นี่คือหมวดเดิมอยู่แล้ว'); return false; }
            return { newCat };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    Swal.fire({ title: 'กำลังย้าย...', didOpen: () => Swal.showLoading() });
    try {
        const oldCat = currentCatLabel;
        const newCatLabel = globalSOPCategories.find(c => c.id === result.value.newCat)?.name || result.value.newCat;
        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();

        const idx = globalSOPData.findIndex(x => String(x.id) === String(ruleId));
        if (idx !== -1) {
            globalSOPData[idx].category = result.value.newCat;
            globalSOPData[idx].updated_at = nowIso;
            globalSOPData[idx].last_editor = authorName;
            if (!Array.isArray(globalSOPData[idx].history)) globalSOPData[idx].history = [];
            globalSOPData[idx].history.push({
                timestamp: nowIso,
                editor: authorName,
                title_before: globalSOPData[idx].title,
                action: `ย้ายหมวด: ${oldCat} → ${newCatLabel}`
            });
            while (globalSOPData[idx].history.length > 5) globalSOPData[idx].history.shift();
        }

        await sop_saveAllData();
        sop_sortData();
        sop_renderList();
        sop_updateTabCounters();
        Swal.fire({ icon: 'success', title: `ย้ายไป "${newCatLabel}" แล้ว!`, timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'ย้ายไม่สำเร็จ', 'error');
    }
};


// ==========================================
// 🔢 V3.4: TAB COUNTERS
// ==========================================
window.sop_updateTabCounters = function() {
    const sopBadge   = document.getElementById('sopTabSopCount');
    const rulesBadge = document.getElementById('sopTabRulesCount');
    const myUsername = (currentUser && currentUser.username) || '';

    if (sopBadge) sopBadge.innerText = globalSOPData.length;

    if (rulesBadge) {
        const total   = (globalStandaloneRules || []).length;
        const unread  = (globalStandaloneRules || []).filter(r => {
            const readBy = r.read_by || [];
            return !readBy.includes(myUsername);
        }).length;
        rulesBadge.innerText = total;
        // ถ้ามีที่ยังไม่อ่าน — ขึ้น badge แดงบน tab
        const tabBtn = document.getElementById('sopTabBtn_rules');
        let newBadge = document.getElementById('sopRulesNewBadge');
        if (unread > 0) {
            if (!newBadge) {
                newBadge = document.createElement('span');
                newBadge.id = 'sopRulesNewBadge';
                newBadge.className = 'bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full';
                if (tabBtn) tabBtn.appendChild(newBadge);
            }
            newBadge.innerText = unread > 99 ? '99+' : unread;
            newBadge.style.display = '';
        } else if (newBadge) {
            newBadge.style.display = 'none';
        }
    }
};

// ==========================================
// 🟠 V3.7: หน้ากติกาทั้งหมด (Tab Rules) — Dropdown + Subgroup + Custom Color + Images
// ==========================================

// ตัวเก็บสถานะ accordion (เปิด/ปิด แต่ละข้อ) ในหน้าแสดงผล
window._sopOpenRules = window._sopOpenRules || new Set();

window.sop_toggleRuleAccordion = function(ruleId, idx) {
    const key = `${ruleId}::${idx}`;
    if (window._sopOpenRules.has(key)) {
        window._sopOpenRules.delete(key);
    } else {
        window._sopOpenRules.add(key);
        // [FIX] auto mark read ตอนกดเปิดดู
        const r = (globalStandaloneRules || [])[idx];
        const myUsername = (currentUser && currentUser.username) || '';
        if (r && myUsername && !((r.read_by || []).includes(myUsername))) {
            if (!Array.isArray(r.read_by)) r.read_by = [];
            r.read_by.push(myUsername);
            sop_saveStandaloneRules();
            sop_updateTabCounters();
            sop_updateUnreadBadge();
        }
    }
    sop_renderAllRulesPage();
};

// ดีไซน์ตามประเภท (ไอคอน/สีเริ่มต้น)
function sop_getRuleTypeStyle(t) {
    let cfg = {
        defaultColor: '#10b981', // emerald
        ic: 'check_circle',
        lbl: 'ทำได้'
    };
    if (t === 'dont')      cfg = { defaultColor: '#ef4444', ic: 'block',          lbl: 'ห้ามทำ' };
    else if (t === 'must') cfg = { defaultColor: '#f97316', ic: 'priority_high',  lbl: 'ต้องทำ' };
    else if (t === 'info') cfg = { defaultColor: '#3b82f6', ic: 'info',           lbl: 'หมายเหตุ' };
    return cfg;
}

// ==========================================
// 🟠 V5: หน้ากติกาขั้นตอน (Tab Rules) — Layout 2 คอลัมน์
// ==========================================

// state: หมวดที่กำลังเลือกในสารบัญ (default = หมวดแรกที่มีกติกา หรือ ALL)
window._sopSelectedCat = window._sopSelectedCat || null;

// คลิกหมวดในสารบัญ → render เนื้อหาของหมวดนั้นด้านขวา
window.sop_selectRulesCategory = function(catKey) {
    window._sopSelectedCat = catKey;
    sop_renderAllRulesPage();
};

// helper: lighten hex color
function sop_lightenHex(hex, amt) {
    if (!hex || !hex.startsWith('#')) return hex;
    const c = hex.replace('#', '');
    const r = Math.min(255, parseInt(c.substr(0,2), 16) + amt);
    const g = Math.min(255, parseInt(c.substr(2,2), 16) + amt);
    const b = Math.min(255, parseInt(c.substr(4,2), 16) + amt);
    return `rgb(${r},${g},${b})`;
}

window.sop_renderAllRulesPage = function() {
    const tocContainer = document.getElementById('sopAllRulesTocContainer');
    const container = document.getElementById('sopAllRulesContainer');
    const countEl = document.getElementById('sopRulesCount');
    if (!tocContainer || !container) return;

    const term = document.getElementById('sopRulesSearch') ? document.getElementById('sopRulesSearch').value.toLowerCase() : '';
    const catF = document.getElementById('sopRulesCatFilter') ? document.getElementById('sopRulesCatFilter').value : 'ALL';
    const typeF = document.getElementById('sopRulesTypeFilter') ? document.getElementById('sopRulesTypeFilter').value : 'ALL';
    const groupF = document.getElementById('sopRulesGroupFilter') ? document.getElementById('sopRulesGroupFilter').value : 'ALL';

    // กรองตาม filter
    let filtered = (globalStandaloneRules || []).slice();
    if (groupF !== 'ALL') filtered = filtered.filter(r => (r.group || '') === groupF);
    if (catF !== 'ALL') filtered = filtered.filter(r => r.category === catF);
    if (typeF !== 'ALL') filtered = filtered.filter(r => (r.type || 'do') === typeF);
    if (term) filtered = filtered.filter(r =>
        (r.title || '').toLowerCase().includes(term) ||
        (r.text || '').toLowerCase().includes(term) ||
        (r.subgroup || '').toLowerCase().includes(term)
    );

    // เรียง: pinned ก่อน → ใหม่ก่อน
    filtered.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });

    if (countEl) countEl.innerText = `${filtered.length}/${(globalStandaloneRules || []).length}`;

    if (!filtered.length) {
        if (!globalStandaloneRules || globalStandaloneRules.length === 0) {
            tocContainer.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 text-xs py-8 italic">ยังไม่มีกติกา</div>';
            container.innerHTML = `
                <div class="text-center text-gray-400 dark:text-gray-600 mt-[15vh] flex flex-col items-center select-none p-8">
                    <span class="material-icons text-[100px] mb-6 opacity-30">gavel</span>
                    <h2 class="text-2xl font-black text-gray-500">ยังไม่มีกติกาขั้นตอน</h2>
                    <p class="text-sm mt-2 font-bold">กดปุ่ม "+ เพิ่มกติกาใหม่" ด้านบนเพื่อสร้าง</p>
                </div>`;
        } else {
            tocContainer.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 text-xs py-8 italic">ไม่พบกติกา</div>';
            container.innerHTML = `
                <div class="text-center text-gray-400 dark:text-gray-600 mt-[15vh] flex flex-col items-center select-none p-8">
                    <span class="material-icons text-[100px] mb-6 opacity-30">search_off</span>
                    <h2 class="text-2xl font-black text-gray-500">ไม่พบกติกาตามเงื่อนไข</h2>
                    <p class="text-sm mt-2 font-bold">ลองเปลี่ยนคำค้นหาหรือ filter</p>
                </div>`;
        }
        return;
    }

    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
    const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));

    // จัดกลุ่มตามหมวด
    const groupedByCat = {};
    filtered.forEach(r => {
        const c = r.category || '__uncat__';
        if (!groupedByCat[c]) groupedByCat[c] = [];
        groupedByCat[c].push({ r, idx: globalStandaloneRules.indexOf(r) });
    });

    // เรียงหมวดตาม globalSOPCategories
    const orderedCatKeys = [];
    globalSOPCategories.forEach(c => { if (groupedByCat[c.id]) orderedCatKeys.push(c.id); });
    Object.keys(groupedByCat).forEach(k => { if (!orderedCatKeys.includes(k)) orderedCatKeys.push(k); });

    // ถ้ายังไม่มี selected หรือ selected ไม่อยู่ในรายการ → เลือกตัวแรก
    let selectedCat = window._sopSelectedCat;
    if (!selectedCat || !groupedByCat[selectedCat]) {
        selectedCat = orderedCatKeys[0];
        window._sopSelectedCat = selectedCat;
    }

    // ============= 1) RENDER TOC (สารบัญซ้าย) =============
    let tocHtml = '';
    orderedCatKeys.forEach(catKey => {
        const items = groupedByCat[catKey];
        const catObj = globalSOPCategories.find(c => c.id === catKey);
        const catLabel = catKey === '__uncat__' ? '(ไม่ระบุหมวด)' : (catObj ? catObj.name : catKey);
        const catColor = catObj?.color || '#64748b';

        let catIcon = 'rule';
        if (catLabel.includes('ฝาก'))     catIcon = 'savings';
        else if (catLabel.includes('ถอน')) catIcon = 'payments';
        else if (catLabel.includes('เครดิต')) catIcon = 'monetization_on';
        else if (catLabel.includes('พิเศษ')) catIcon = 'warning';
        else if (catLabel.includes('ทั่วไป')) catIcon = 'menu_book';

        const isSelected = catKey === selectedCat;
        const safeCatKey = (catKey || '').replace(/'/g, '');

        tocHtml += `
            <div onclick="sop_selectRulesCategory('${safeCatKey}')" class="cursor-pointer rounded-xl border-l-4 ${isSelected ? 'ring-2 ring-orange-300 dark:ring-orange-700 bg-orange-50 dark:bg-orange-900/20 border-orange-400' : 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500/50 hover:bg-white dark:hover:bg-slate-800'} transition group shadow-sm relative overflow-hidden mb-2.5" style="border-left-color: ${catColor};">
                <div class="p-3 flex gap-3 items-center">
                    <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-inner" style="background-color: ${catColor};">
                        <span class="material-icons text-[20px]">${catIcon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-slate-800 dark:text-white font-bold text-sm truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition leading-snug">${(catLabel).replace(/</g, '&lt;')}</h4>
                        <div class="text-[10px] font-bold text-gray-500 mt-0.5">${items.length} ข้อ</div>
                    </div>
                    ${isSelected ? '<span class="material-icons text-orange-500 text-[18px]">arrow_forward</span>' : ''}
                </div>
            </div>
        `;
    });
    tocContainer.innerHTML = tocHtml;

    // ============= 2) RENDER เนื้อหาขวา (กติกาในหมวดที่เลือก) =============
    const selectedItems = groupedByCat[selectedCat] || [];
    const selectedCatObj = globalSOPCategories.find(c => c.id === selectedCat);
    const selectedLabel = selectedCat === '__uncat__' ? '(ไม่ระบุหมวด)' : (selectedCatObj ? selectedCatObj.name : selectedCat);
    const selectedColor = selectedCatObj?.color || '#64748b';
    const selectedColorLight = sop_lightenHex(selectedColor, 30);

    let selectedIcon = 'rule';
    if (selectedLabel.includes('ฝาก'))     selectedIcon = 'savings';
    else if (selectedLabel.includes('ถอน')) selectedIcon = 'payments';
    else if (selectedLabel.includes('เครดิต')) selectedIcon = 'monetization_on';
    else if (selectedLabel.includes('พิเศษ')) selectedIcon = 'warning';
    else if (selectedLabel.includes('ทั่วไป')) selectedIcon = 'menu_book';

    // จัดกลุ่มย่อย (subgroup)
    const subgroupMap = {};
    selectedItems.forEach(({ r, idx }) => {
        const g = (r.subgroup || '').trim() || '__no_sub__';
        if (!subgroupMap[g]) subgroupMap[g] = [];
        subgroupMap[g].push({ r, idx });
    });
    const subgroupNames = Object.keys(subgroupMap).sort((a, b) => {
        if (a === '__no_sub__') return 1;
        if (b === '__no_sub__') return -1;
        return a.localeCompare(b, 'th');
    });

    let bodyHtml = '';
    subgroupNames.forEach(gName => {
        if (gName !== '__no_sub__') {
            bodyHtml += `
                <div class="flex items-center gap-2 mt-3 mb-2 px-1">
                    <span class="material-icons text-orange-500 text-[16px]">folder</span>
                    <span class="text-xs font-black text-slate-700 dark:text-gray-200 uppercase tracking-wider">${(gName).replace(/</g, '&lt;')}</span>
                    <div class="flex-1 border-t border-dashed border-orange-300 dark:border-orange-700/50 ml-1"></div>
                    <span class="text-[10px] font-bold text-gray-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full">${subgroupMap[gName].length} ข้อ</span>
                </div>`;
        }

        subgroupMap[gName].forEach(({ r, idx }) => {
            const t = r.type || 'do';
            const cfg = sop_getRuleTypeStyle(t);
            const usedColor = (r.color && r.color.trim()) ? r.color : cfg.defaultColor;

            const safeTitle = (r.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeText = (r.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
            const hasContent = (r.text || '').trim().length > 0;

            const accordionKey = `standalone::${idx}`;
            const isOpen = window._sopOpenRules.has(accordionKey);

            const imgs = Array.isArray(r.images) ? r.images : [];
            let imagesHtml = '';
            if (imgs.length > 0) {
                imagesHtml = `<div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">` +
                    imgs.map(img => `
                        <div onclick="event.stopPropagation(); sop_openLightbox('${img.url}')" class="cursor-zoom-in rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 hover:opacity-90 transition relative group shadow-sm">
                            <img src="${img.url}" class="w-full h-32 object-cover">
                            <div class="absolute top-1 right-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-0.5"><span class="material-icons text-[10px]">zoom_in</span></div>
                        </div>
                    `).join('') +
                    `</div>`;
            }

            const canSendTgSA = currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin' || currentUser.role === 'trainer');
            const tgBtnSA = canSendTgSA ? `<button onclick="event.stopPropagation(); sop_sendStandaloneToTelegram(${idx})" class="bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ส่งลง Telegram"><span class="material-icons text-[16px]">send</span></button>` : '';
            const moveBtnSA = isAdmin ? `<button onclick="event.stopPropagation(); sop_moveToGroup(${idx})" class="bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-gray-400 hover:text-indigo-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="โยกเข้ากลุ่ม"><span class="material-icons text-[16px]">drive_file_move</span></button>` : '';
            const groupBadgeSA = r.group ? `<span class="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700 ml-1"><span class="material-icons text-[10px]">folder</span>${r.group}</span>` : '';
            const adminBtns = isAdmin ? `
                ${moveBtnSA}
                ${tgBtnSA}
                <button onclick="event.stopPropagation(); sop_editStandaloneRule(${idx})" class="bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-gray-400 hover:text-amber-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="แก้ไข"><span class="material-icons text-[16px]">edit</span></button>
                <button onclick="event.stopPropagation(); sop_toggleStandalonePin(${idx})" class="bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-500/20 ${r.pinned ? 'text-amber-500' : 'text-gray-400'} hover:text-amber-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="${r.pinned ? 'เลิกปักหมุด' : 'ปักหมุด'}"><span class="material-icons text-[16px]">push_pin</span></button>
                <button onclick="event.stopPropagation(); sop_deleteStandaloneRule(${idx})" class="bg-white dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ลบ"><span class="material-icons text-[16px]">delete</span></button>
            ` : tgBtnSA;
            const pinIcon = r.pinned ? '<span class="material-icons text-amber-500 text-[14px]" title="ปักหมุด">push_pin</span>' : '';

            // วันที่ลงและอัพเดทล่าสุด
            const createdDate = r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
            const updatedDate = r.updated_at ? new Date(r.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
            const isUpdated = r.updated_at && r.created_at && r.updated_at !== r.created_at;
            const lastEditor = r.last_editor || r.author_name || '';

            // V6: read status
            const myUsername = (currentUser && currentUser.username) || '';
            const readBy = r.read_by || [];
            const isReadByMe = myUsername && readBy.includes(myUsername);
            const newBadge = !isReadByMe
                ? '<span class="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded animate-pulse" title="ยังไม่อ่าน">ใหม่!</span>'
                : '';
            const voiceBadge = r.voice_url
                ? '<span class="text-[9px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5"><span class="material-icons text-[10px]">mic</span>เสียง</span>'
                : '';

            // ปุ่ม "ทำเครื่องหมายว่าอ่านแล้ว" (เห็นเฉพาะตอน expand)
            const readBtn = myUsername
                ? (isReadByMe
                    ? `<button onclick="event.stopPropagation(); sop_markStandaloneRead(${idx})" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95"><span class="material-icons text-[14px]">verified</span>อ่านแล้ว (กดเพื่อยกเลิก)</button>`
                    : `<button onclick="event.stopPropagation(); sop_markStandaloneRead(${idx})" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95"><span class="material-icons text-[14px]">check_circle</span>กดเมื่ออ่านแล้ว</button>`)
                : '';

            const voicePlayer = r.voice_url
                ? `<div class="mb-3 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/50 rounded-lg flex items-center gap-3">
                       <span class="material-icons text-rose-500 text-2xl">mic</span>
                       <div class="flex-1 min-w-0">
                           <div class="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider mb-1">เสียงอธิบาย</div>
                           <audio src="${r.voice_url}" controls class="w-full h-9"></audio>
                       </div>
                   </div>`
                : '';

            bodyHtml += `
                <div class="bg-white dark:bg-slate-800 rounded-xl border-l-[6px] border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden mb-2.5 hover:shadow-md transition ${!isReadByMe ? 'ring-1 ring-red-300 dark:ring-red-700/50' : ''}" style="border-left-color: ${usedColor};">
                    <div onclick="sop_toggleRuleAccordion('standalone', ${idx})" class="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                        <div class="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-inner" style="background-color: ${usedColor};">
                            <span class="material-icons text-[22px]">${cfg.ic}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap mb-1">
                                <span class="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded text-white" style="background-color: ${usedColor};">${cfg.lbl}</span>
                                ${newBadge}
                                ${pinIcon}
                                ${voiceBadge}
                                ${imgs.length > 0 ? `<span class="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5"><span class="material-icons text-[10px]">image</span>${imgs.length} รูป</span>` : ''}
                                ${hasContent ? '<span class="text-[9px] text-blue-500 font-bold">📝 มีรายละเอียด</span>' : ''}
                            </div>
                            <div class="text-base md:text-lg font-black text-slate-800 dark:text-white truncate leading-snug">${safeTitle || '(ไม่มีหัวข้อ)'}</div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">${adminBtns}
                            <span class="material-icons text-gray-400 transition ${isOpen ? 'rotate-180' : ''} text-[20px]">expand_more</span>
                        </div>
                    </div>
                    <!-- แถวข้อมูลวันที่ + read count -->
                    <div class="bg-slate-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 px-4 py-1.5 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 font-bold flex-wrap">
                        <span class="flex items-center gap-1" title="วันที่สร้าง"><span class="material-icons text-[12px] text-emerald-500">add_circle</span>สร้าง: ${createdDate}</span>
                        ${isUpdated ? `<span class="flex items-center gap-1" title="อัพเดทล่าสุด"><span class="material-icons text-[12px] text-amber-500">update</span>อัพเดท: ${updatedDate}</span>` : ''}
                        ${readBy.length > 0 ? `<span class="flex items-center gap-1" title="คนอ่านแล้ว"><span class="material-icons text-[12px] text-emerald-600">verified</span>${readBy.length} คนอ่าน</span>` : ''}
                        ${lastEditor ? `<span class="flex items-center gap-1 ml-auto" title="แก้ไขล่าสุดโดย"><span class="material-icons text-[12px] text-blue-500">person</span>${lastEditor}</span>` : ''}
                    </div>
                    ${isOpen ? `
                        <div class="px-4 pb-4 pt-3 border-t border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            ${voicePlayer}
                            ${imagesHtml}
                            ${hasContent ? `<div class="text-sm md:text-base text-slate-800 dark:text-white leading-relaxed whitespace-pre-wrap font-medium mb-3">${safeText}</div>` : '<div class="text-sm text-gray-400 italic mb-3">ไม่มีรายละเอียดเพิ่มเติม</div>'}
                            ${readBtn ? `<div class="flex justify-end pt-2 border-t border-gray-200 dark:border-slate-700">${readBtn}</div>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        });
    });

    // header ของหมวดที่เลือก
    const headerHtml = `
        <div class="text-white px-5 py-3 rounded-2xl shadow-md flex items-center gap-2 flex-wrap mb-4 sticky top-0 z-10" style="background: linear-gradient(to right, ${selectedColor}, ${selectedColorLight});">
            <div class="bg-white/20 p-1.5 rounded-lg shrink-0"><span class="material-icons text-[18px]">${selectedIcon}</span></div>
            <h3 class="text-white font-black text-sm md:text-base tracking-wide truncate flex-1">${(selectedLabel).replace(/</g, '&lt;')}</h3>
            <span class="bg-white/20 text-white text-[11px] font-black px-2 py-0.5 rounded-full">${selectedItems.length} ข้อ</span>
        </div>
    `;

    container.innerHTML = headerHtml + bodyHtml;
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
    const canSendTg = currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin' || currentUser.role === 'trainer');
    const tgBtn = canSendTg ? `<button onclick="event.stopPropagation(); sop_sendItemToTelegram('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ส่งลง Telegram"><span class="material-icons">send</span></button>` : '';
    if (isAdmin || canSendTg) {
        const pinTitle = item.pinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด';
        const pinClass = item.pinned ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400 bg-white dark:bg-slate-800';
        const editDeleteBtns = isAdmin ? `
            <button onclick="sop_togglePin('${item.id}')" class="${pinClass} hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:text-amber-600 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="${pinTitle}"><span class="material-icons">push_pin</span></button>
            <button onclick="sop_editRule('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/20 text-gray-400 hover:text-amber-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="แก้ไข"><span class="material-icons">edit</span></button>
            <button onclick="sop_deleteRule('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ลบ"><span class="material-icons">delete</span></button>` : '';
        adminBtns = tgBtn + editDeleteBtns;
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

    // V4: ไม่มี rules block ใน SOP detail แล้ว — กติกาแยกอยู่แท็บของตัวเอง
    let rulesBlock = '';

    // V6: voice note block
    let voiceBlock = '';
    if (item.voice_url) {
        voiceBlock = `
            <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/50 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <span class="material-icons text-rose-500 text-3xl shrink-0">mic</span>
                <div class="flex-1 min-w-0">
                    <div class="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider mb-2">🎤 เสียงอธิบายจากแอดมิน</div>
                    <audio src="${item.voice_url}" controls class="w-full h-10"></audio>
                </div>
            </div>
        `;
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
        voiceBlock,
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
    window._sopVoiceUrl = isEdit ? (existing.voice_url || '') : '';
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
                    <span class="material-icons text-[14px] text-amber-500">attach_file</span>ไฟล์ประกอบ (รูปภาพ / PDF) — ก๊อปวาง / ลาก / กดเลือก
                </label>
                <div id="sopFormPasteZone" class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 transition focus-within:border-amber-500 hover:border-amber-400" tabindex="0">
                    <div class="flex gap-2 mb-2 items-center">
                        <input type="file" id="sopFormFiles" multiple accept="image/*,.pdf" class="hidden" onchange="sop_handleFileSelect(event)">
                        <button type="button" onclick="document.getElementById('sopFormFiles').click()" class="bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md transition active:scale-95"><span class="material-icons text-[14px]">upload</span>เลือกไฟล์</button>
                        <span class="text-[11px] text-gray-500 italic">รองรับ JPG, PNG, PDF / Ctrl+V วางจาก clipboard / ลากไฟล์มาทิ้ง</span>
                    </div>
                    <div id="sopAttachmentPreview" class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar"></div>
                </div>
            </div>

            <!-- 🎤 Voice Note สำหรับ SOP (V6) -->
            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <span class="material-icons text-[14px] text-rose-500">mic</span>เสียงอธิบาย (Voice Note) — ไม่บังคับ
                </label>
                <div class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-900">
                    <div id="voiceRecorderUI">
                        <!-- จะ render โดย sop_initVoiceRecorder() -->
                    </div>
                </div>
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
            sop_initVoiceRecorder('voiceRecorderUI');
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

            // V4.3: Paste + Drag&Drop สำหรับ attachments
            const pasteZone = document.getElementById('sopFormPasteZone');
            const swalPopup = Swal.getPopup();

            const pasteHandler = async (e) => {
                const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
                if (!items) return;
                for (const item of items) {
                    if (item.type && item.type.indexOf('image') !== -1) {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = item.getAsFile();
                        if (file) {
                            sop_showInlineToast('กำลังอัพรูปจาก clipboard...', 'info');
                            const ok = await sop_uploadAttachmentFile(file);
                            if (ok) {
                                sop_renderAttachmentPreview();
                                sop_showInlineToast('แนบรูปจาก clipboard แล้ว ✅', 'success');
                            } else {
                                sop_showInlineToast('อัพไม่สำเร็จ', 'error');
                            }
                        }
                    }
                }
            };
            // ผูกที่ zone + popup เท่านั้น (ห้ามผูก document)
            if (pasteZone) pasteZone.addEventListener('paste', pasteHandler);
            if (swalPopup) swalPopup.addEventListener('paste', pasteHandler);

            // Drag & Drop
            if (pasteZone) {
                pasteZone.addEventListener('dragover', (e) => { e.preventDefault(); pasteZone.classList.add('border-amber-500'); });
                pasteZone.addEventListener('dragleave', () => pasteZone.classList.remove('border-amber-500'));
                pasteZone.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    pasteZone.classList.remove('border-amber-500');
                    const files = Array.from(e.dataTransfer?.files || []);
                    if (files.length === 0) return;
                    sop_showInlineToast(`กำลังอัพ ${files.length} ไฟล์...`, 'info');
                    for (const f of files) await sop_uploadAttachmentFile(f);
                    sop_renderAttachmentPreview();
                    sop_showInlineToast('อัพไฟล์เสร็จ ✅', 'success');
                });
            }
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
            return { title, content, category, priority, pinned, examples, tags, shifts, rules, voice_url: window._sopVoiceUrl || '' };
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
// Helper: อัพ 1 ไฟล์ขึ้น Supabase แล้ว push เข้า buffer
window.sop_uploadAttachmentFile = async function(file) {
    if (!file) return false;
    try {
        let ext = (file.name && file.name.split('.').pop().toLowerCase()) || '';
        if (!ext || ext.length > 5) {
            // เคส paste image (มัก type เป็น 'image/png' แต่ไม่มีนามสกุล)
            if (file.type && file.type.startsWith('image/')) {
                ext = file.type.split('/')[1] || 'png';
            } else {
                ext = 'bin';
            }
        }
        const fileName = `sop/${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
        const { error: upErr } = await appDB.storage.from('staff_images').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: pubData } = appDB.storage.from('staff_images').getPublicUrl(fileName);
        sopAttachmentsBuffer.push({
            url: pubData.publicUrl,
            name: file.name || `clipboard.${ext}`,
            type: ext === 'pdf' ? 'pdf' : 'image',
            path: fileName
        });
        return true;
    } catch (e) {
        console.error('upload attachment error:', e);
        return false;
    }
};

window.sop_handleFileSelect = async function(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const submitBtn = Swal.getConfirmButton();
    if (submitBtn) submitBtn.disabled = true;
    sop_showInlineToast(`กำลังอัพ ${files.length} ไฟล์...`, 'info');

    for (let i = 0; i < files.length; i++) {
        const ok = await sop_uploadAttachmentFile(files[i]);
        if (!ok) sop_showInlineToast(`อัพ ${files[i].name} ไม่สำเร็จ`, 'error');
    }

    sop_renderAttachmentPreview();
    if (submitBtn) submitBtn.disabled = false;
    sop_showInlineToast('อัพไฟล์เสร็จ ✅', 'success');
    event.target.value = '';
};

window.sop_renderAttachmentPreview = function() {
    const container = document.getElementById('sopAttachmentPreview');
    if (!container) return;
    if (sopAttachmentsBuffer.length === 0) {
        container.innerHTML = '<div class="text-[11px] text-gray-400 italic text-center py-2">ยังไม่มีไฟล์แนบ — เลือกไฟล์ / Ctrl+V / ลากมาทิ้ง</div>';
        return;
    }
    container.innerHTML = '<div class="grid grid-cols-2 md:grid-cols-3 gap-2">' +
        sopAttachmentsBuffer.map((att, idx) => {
            const isPdf = (att.type === 'pdf' || (att.url || '').toLowerCase().includes('.pdf'));
            if (isPdf) {
                return `
                    <div class="relative group rounded-lg overflow-hidden border border-red-300 dark:border-red-700/50 shadow-sm bg-red-50 dark:bg-red-900/20 p-3 flex items-center gap-2">
                        <span class="material-icons text-red-500 text-2xl shrink-0">picture_as_pdf</span>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-slate-800 dark:text-white truncate">${(att.name || 'PDF').replace(/</g, '&lt;')}</div>
                            <div class="text-[10px] text-gray-500">PDF</div>
                        </div>
                        <button type="button" onclick="sop_removeAttachment(${idx})" class="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-90 hover:opacity-100 transition shadow shrink-0" title="ลบไฟล์"><span class="material-icons text-[14px]">close</span></button>
                    </div>
                `;
            }
            return `
                <div class="relative group rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600 shadow-sm">
                    <img src="${att.url}" class="w-full h-20 object-cover">
                    <button type="button" onclick="sop_removeAttachment(${idx})" class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-90 hover:opacity-100 transition shadow z-10" title="ลบรูป"><span class="material-icons text-[14px]">close</span></button>
                </div>
            `;
        }).join('') + '</div>';
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
        let newSopRecord = null; // 🆕 เก็บ reference ของ OD ที่เพิ่งเพิ่ม — ไม่ต้องพึ่ง index หลัง sort

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
                    voice_url: formData.voice_url || '',
                    updated_at: nowIso,
                    last_editor: authorName,
                    history: newHistory,
                    read_by: [] // V6: reset เมื่อแก้
                };
            }
        } else {
            newSopRecord = {
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
                voice_url: formData.voice_url || '',
                view_count: 0,
                read_by: [],
                history: [],
                author_name: authorName,
                last_editor: authorName,
                created_at: nowIso,
                updated_at: nowIso
            };
            globalSOPData.unshift(newSopRecord);
        }

        sopAttachmentsBuffer = [];
        sopRulesBuffer = [];
        await sop_saveAllData();
        sop_sortData();
        sop_renderList();

        if (existing) sop_readRule(existing.id, true);
        else if (newSopRecord) {
            currentSopId = newSopRecord.id; // 🆕 ใช้ id จริงของ OD ที่เพิ่งเพิ่ม ไม่ใช่ [0]
            sop_readRule(currentSopId, true);
        }

        // V6: Telegram notify - ส่งเฉพาะตอนสร้างใหม่ (ไม่ส่งตอนแก้ไข)
        if (!existing && newSopRecord) {
            const catLabel = globalSOPCategories.find(c => c.id === formData.category)?.name || formData.category || '';
            // 🆕 ใช้ newSopRecord ตรงๆ — ไม่ต้องไปอ่าน globalSOPData[0] ที่อาจถูก sort เปลี่ยนตำแหน่ง
            const imgUrls = (newSopRecord.attachments || [])
                .filter(a => !(a.url || '').toLowerCase().includes('.pdf') && a.type !== 'pdf')
                .map(a => a.url);
            sop_sendTelegramNotify('add', 'sop', formData.title, catLabel, null, imgUrls, formData.content);
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
// 🆕 V3.7: เพิ่ม/แก้/ลบ กติกา (Premium — รองรับ subgroup, สีเอง, รูปภาพ, paste)
// ==========================================

// 🎨 พาเล็ทสี (เลือกสีเองได้)
const SOP_COLOR_PALETTE = [
    { val: '',         name: 'อัตโนมัติ',  preview: 'linear-gradient(135deg,#10b981,#ef4444,#f97316,#3b82f6)' },
    { val: '#10b981',  name: 'เขียว',       preview: '#10b981' },
    { val: '#22c55e',  name: 'เขียวสด',     preview: '#22c55e' },
    { val: '#06b6d4',  name: 'ฟ้าอมเขียว',  preview: '#06b6d4' },
    { val: '#3b82f6',  name: 'ฟ้า',         preview: '#3b82f6' },
    { val: '#6366f1',  name: 'น้ำเงิน',     preview: '#6366f1' },
    { val: '#8b5cf6',  name: 'ม่วง',        preview: '#8b5cf6' },
    { val: '#a855f7',  name: 'ม่วงสด',      preview: '#a855f7' },
    { val: '#ec4899',  name: 'ชมพู',        preview: '#ec4899' },
    { val: '#f43f5e',  name: 'แดงชมพู',     preview: '#f43f5e' },
    { val: '#ef4444',  name: 'แดง',         preview: '#ef4444' },
    { val: '#f97316',  name: 'ส้ม',         preview: '#f97316' },
    { val: '#f59e0b',  name: 'ส้มทอง',      preview: '#f59e0b' },
    { val: '#eab308',  name: 'เหลือง',      preview: '#eab308' },
    { val: '#84cc16',  name: 'เขียวมะนาว',  preview: '#84cc16' },
    { val: '#64748b',  name: 'เทา',         preview: '#64748b' },
    { val: '#475569',  name: 'เทาเข้ม',     preview: '#475569' }
];

// buffer สำหรับรูปแนบกติกา (ใช้ตอนเปิดฟอร์ม)
let sopRuleImagesBuffer = [];

window.sop_renderRuleImagesPreview = function() {
    const container = document.getElementById('qaRuleImagesPreview');
    if (!container) return;
    if (sopRuleImagesBuffer.length === 0) {
        container.innerHTML = '<div class="text-[11px] text-gray-400 italic text-center py-2">ยังไม่มีรูป — ลาก/ก็อปวาง/อัพได้</div>';
        return;
    }
    container.innerHTML = sopRuleImagesBuffer.map((img, idx) => `
        <div class="relative group rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600 shadow-sm">
            <img src="${img.url}" class="w-full h-20 object-cover">
            <button type="button" onclick="sop_removeRuleImage(${idx})" class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-90 hover:opacity-100 transition shadow"><span class="material-icons text-[14px]">close</span></button>
        </div>
    `).join('');
};

window.sop_removeRuleImage = function(idx) {
    sopRuleImagesBuffer.splice(idx, 1);
    sop_renderRuleImagesPreview();
};

window.sop_uploadRuleImageFile = async function(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return null;
    try {
        const ext = (file.name && file.name.split('.').pop()) || 'png';
        const fileName = `sop/rule_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
        const { error: upErr } = await appDB.storage.from('staff_images').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: pubData } = appDB.storage.from('staff_images').getPublicUrl(fileName);
        return { url: pubData.publicUrl, name: file.name || 'image.png', path: fileName };
    } catch (e) {
        console.error('upload rule image error:', e);
        return null;
    }
};

window.sop_handleRuleFilesSelect = async function(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const submitBtn = Swal.getConfirmButton();
    if (submitBtn) submitBtn.disabled = true;
    sop_showInlineToast(`กำลังอัพโหลด ${files.length} รูป...`, 'info');
    for (const f of files) {
        const obj = await sop_uploadRuleImageFile(f);
        if (obj) sopRuleImagesBuffer.push(obj);
    }
    sop_renderRuleImagesPreview();
    if (submitBtn) submitBtn.disabled = false;
    event.target.value = '';
    sop_showInlineToast(`อัพ ${files.length} รูปเสร็จ ✅`, 'success');
};

// ==========================================
// 🟠 V4: STANDALONE RULES CRUD (Tab 1 — กติกาขั้นตอน)
// ==========================================

// Toast เล็กๆ ที่ใช้ DOM ธรรมดา — ปลอดภัยกว่าการเรียก Swal.mixin ขณะมี Swal popup เปิดอยู่
window.sop_showInlineToast = function(msg, type) {
    type = type || 'info';
    let t = document.getElementById('sopInlineToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'sopInlineToast';
        t.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:10px 16px;border-radius:12px;font-weight:bold;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,0.25);pointer-events:none;transition:opacity 0.2s;';
        document.body.appendChild(t);
    }
    let bg = '#3b82f6', color = 'white';
    if (type === 'success') bg = '#10b981';
    else if (type === 'error') bg = '#ef4444';
    else if (type === 'info') bg = '#0ea5e9';
    t.style.background = bg;
    t.style.color = color;
    t.innerText = msg;
    t.style.opacity = '1';

    if (window._sopToastTimer) clearTimeout(window._sopToastTimer);
    window._sopToastTimer = setTimeout(() => {
        if (t) {
            t.style.opacity = '0';
            setTimeout(() => { if (t && t.parentNode) t.remove(); }, 250);
        }
    }, 1800);
};

async function sop_openStandaloneRuleForm(editIdx) {
    const isEdit = (typeof editIdx === 'number');
    const existing = isEdit ? globalStandaloneRules[editIdx] : null;
    if (isEdit && !existing) return;

    sopRuleImagesBuffer = isEdit ? JSON.parse(JSON.stringify(existing.images || [])) : [];
    window._sopVoiceUrl = isEdit ? (existing.voice_url || '') : '';

    const titleVal     = isEdit ? (existing.title || '')     : '';
    const textVal      = isEdit ? (existing.text || '')      : '';
    const typeVal      = isEdit ? (existing.type || 'do')    : 'do';
    const colorVal     = isEdit ? (existing.color || '')     : '';
    const subgroupVal  = isEdit ? (existing.subgroup || '')  : '';
    const categoryVal  = isEdit ? (existing.category || '')  : (globalSOPCategories[0]?.id || '');
    const pinnedVal    = isEdit ? !!existing.pinned          : false;

    // หมวดหมู่
    const categoryOptions = `
        <option value="">-- ไม่ระบุหมวด --</option>
        ${globalSOPCategories.map(c => `<option value="${c.id}" ${c.id === categoryVal ? 'selected' : ''}>${c.name}</option>`).join('')}
    `;

    // subgroup ที่มีอยู่
    const existingSubgroups = new Set();
    (globalStandaloneRules || []).forEach(r => { if (r.subgroup && r.subgroup.trim()) existingSubgroups.add(r.subgroup.trim()); });
    const subgroupOpts = `
        <option value="">-- ไม่จัดกลุ่ม --</option>
        ${Array.from(existingSubgroups).map(g => `<option value="${g}" ${g === subgroupVal ? 'selected' : ''}>${g}</option>`).join('')}
        <option value="__new__">+ เพิ่มกลุ่มใหม่...</option>
    `;

    const colorPaletteHtml = SOP_COLOR_PALETTE.map(c => `
        <label class="cursor-pointer relative" title="${c.name}">
            <input type="radio" name="qaRuleColor" value="${c.val}" class="sr-only peer" ${colorVal === c.val ? 'checked' : ''}>
            <div class="w-8 h-8 rounded-lg border-2 border-gray-300 dark:border-slate-600 peer-checked:border-slate-900 dark:peer-checked:border-white peer-checked:scale-110 transition shadow-sm" style="background: ${c.preview};"></div>
            ${c.val === '' ? '<span class="absolute inset-0 flex items-center justify-center text-white font-black text-[8px] pointer-events-none drop-shadow">AUTO</span>' : ''}
        </label>
    `).join('');

    const formHtml = `
        <div class="text-left space-y-3">
            <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-xl p-3 text-xs text-slate-700 dark:text-gray-200 flex gap-2 items-start">
                <span class="material-icons text-orange-500 text-[18px]">info</span>
                <div>กรอกหัวข้อ → เลือกประเภท/สี/หมวด → เนื้อหา → แนบรูป (ก๊อปวาง/ลาก/อัพ) → บันทึก</div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">หัวข้อกติกา <span class="text-red-500">*</span></label>
                <input type="text" id="qaRuleTitle" value="${titleVal.replace(/"/g, '&quot;')}" placeholder="เช่น ตรวจสลิปก่อนเติม..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm">
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">ประเภท <span class="text-red-500">*</span></label>
                    <div class="grid grid-cols-2 gap-1.5">
                        <label class="flex items-center gap-1 cursor-pointer p-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-500 transition has-[:checked]:bg-emerald-200 dark:has-[:checked]:bg-emerald-900/50 has-[:checked]:border-emerald-500">
                            <input type="radio" name="qaRuleType" value="do" class="w-3 h-3 accent-emerald-500" ${typeVal === 'do' ? 'checked' : ''}>
                            <span class="material-icons text-emerald-500 text-[14px]">check_circle</span>
                            <span class="text-xs font-bold">ทำได้</span>
                        </label>
                        <label class="flex items-center gap-1 cursor-pointer p-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500 transition has-[:checked]:bg-orange-200 dark:has-[:checked]:bg-orange-900/50 has-[:checked]:border-orange-500">
                            <input type="radio" name="qaRuleType" value="must" class="w-3 h-3 accent-orange-500" ${typeVal === 'must' ? 'checked' : ''}>
                            <span class="material-icons text-orange-500 text-[14px]">priority_high</span>
                            <span class="text-xs font-bold">ต้องทำ</span>
                        </label>
                        <label class="flex items-center gap-1 cursor-pointer p-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 hover:border-red-500 transition has-[:checked]:bg-red-200 dark:has-[:checked]:bg-red-900/50 has-[:checked]:border-red-500">
                            <input type="radio" name="qaRuleType" value="dont" class="w-3 h-3 accent-red-500" ${typeVal === 'dont' ? 'checked' : ''}>
                            <span class="material-icons text-red-500 text-[14px]">block</span>
                            <span class="text-xs font-bold">ห้ามทำ</span>
                        </label>
                        <label class="flex items-center gap-1 cursor-pointer p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-500 transition has-[:checked]:bg-blue-200 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-500">
                            <input type="radio" name="qaRuleType" value="info" class="w-3 h-3 accent-blue-500" ${typeVal === 'info' ? 'checked' : ''}>
                            <span class="material-icons text-blue-500 text-[14px]">info</span>
                            <span class="text-xs font-bold">หมายเหตุ</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">หมวดหมู่</label>
                    <select id="qaRuleCategory" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm">${categoryOptions}</select>
                </div>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">หมวดหมู่ย่อย (ไม่บังคับ)</label>
                <select id="qaRuleSubgroup" onchange="sop_onSubgroupChange(this)" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm">${subgroupOpts}</select>
                <input type="text" id="qaRuleSubgroupNew" placeholder="พิมพ์ชื่อกลุ่มใหม่..." class="hidden w-full mt-1.5 p-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm">
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">สีแถบของกติกา</label>
                <div class="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl">${colorPaletteHtml}</div>
                <div class="text-[10px] text-gray-500 mt-1">เลือก "AUTO" = ใช้สีตามประเภท</div>
            </div>

            <div>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="qaRulePinned" class="w-4 h-4 accent-amber-500" ${pinnedVal ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-700 dark:text-gray-200 flex items-center gap-1"><span class="material-icons text-amber-500 text-[16px]">push_pin</span>ปักหมุด — ให้เด้งบนสุด</span>
                </label>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">รายละเอียด (ไม่บังคับ — กดที่หัวข้อเพื่อขยาย)</label>
                <textarea id="qaRuleText" rows="5" placeholder="พิมพ์รายละเอียดเพิ่มเติม..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none text-sm whitespace-pre-wrap font-medium leading-relaxed">${textVal}</textarea>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">รูปภาพประกอบ <span class="text-gray-400 normal-case ml-2">(ก๊อปวาง / ลากไฟล์ / กดปุ่มเลือก)</span></label>
                <div id="qaRulePasteZone" class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 transition focus-within:border-orange-500 hover:border-orange-400" tabindex="0">
                    <div class="flex gap-2 items-center mb-2">
                        <input type="file" id="qaRuleFiles" multiple accept="image/*" class="hidden" onchange="sop_handleRuleFilesSelect(event)">
                        <button type="button" onclick="document.getElementById('qaRuleFiles').click()" class="bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95"><span class="material-icons text-[14px]">upload</span>เลือกรูปจากคอม</button>
                        <span class="text-[11px] text-gray-500 italic">หรือกด Ctrl+V เพื่อวางจาก clipboard / ลากรูปมาทิ้งในกล่อง</span>
                    </div>
                    <div id="qaRuleImagesPreview" class="grid grid-cols-3 md:grid-cols-4 gap-1.5 min-h-[60px]"></div>
                </div>
            </div>

            <!-- 🎤 Voice Note (V6) -->
            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <span class="material-icons text-[14px] text-rose-500">mic</span>เสียงอธิบาย (Voice Note) — ไม่บังคับ
                </label>
                <div class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-900">
                    <div id="voiceRecorderUI">
                        <!-- จะ render โดย sop_initVoiceRecorder() -->
                    </div>
                </div>
            </div>
        </div>
    `;

    const result = await Swal.fire({
        title: `<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-${isEdit ? 'amber' : 'orange'}-500">${isEdit ? 'edit' : 'add_circle'}</span> ${isEdit ? 'แก้ไขกติกา' : 'เพิ่มกติกาใหม่'}</div>`,
        html: formHtml,
        width: '720px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: isEdit ? '#f59e0b' : '#f97316',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        didOpen: () => {
            sop_renderRuleImagesPreview();
            sop_initVoiceRecorder('voiceRecorderUI');
            const zone = document.getElementById('qaRulePasteZone');
            const textarea = document.getElementById('qaRuleText');
            const titleInput = document.getElementById('qaRuleTitle');

            const pasteHandler = async (e) => {
                const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
                if (!items) return;
                let foundImage = false;
                for (const item of items) {
                    if (item.type && item.type.indexOf('image') !== -1) {
                        foundImage = true;
                        e.preventDefault();
                        e.stopPropagation();
                        const file = item.getAsFile();
                        if (file) {
                            sop_showInlineToast('กำลังอัพรูป...', 'info');
                            const obj = await sop_uploadRuleImageFile(file);
                            if (obj) {
                                sopRuleImagesBuffer.push(obj);
                                sop_renderRuleImagesPreview();
                                sop_showInlineToast('แนบรูปจาก clipboard แล้ว ✅', 'success');
                            } else {
                                sop_showInlineToast('อัพไม่สำเร็จ', 'error');
                            }
                        }
                    }
                }
                return foundImage;
            };
            // ผูกกับ element ใน popup เท่านั้น — ห้ามผูกกับ document (จะทำให้ Swal ปิด)
            if (zone) zone.addEventListener('paste', pasteHandler);
            if (textarea) textarea.addEventListener('paste', pasteHandler);
            if (titleInput) titleInput.addEventListener('paste', pasteHandler);
            // ผูกกับ swal container เพื่อให้ paste จากที่ไหนก็ได้ในฟอร์ม
            const swalContainer = Swal.getPopup();
            if (swalContainer) swalContainer.addEventListener('paste', pasteHandler);

            if (zone) {
                zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('border-orange-500'); });
                zone.addEventListener('dragleave', () => zone.classList.remove('border-orange-500'));
                zone.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    zone.classList.remove('border-orange-500');
                    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
                    if (files.length === 0) return;
                    sop_showInlineToast(`กำลังอัพ ${files.length} รูป...`, 'info');
                    for (const f of files) {
                        const obj = await sop_uploadRuleImageFile(f);
                        if (obj) sopRuleImagesBuffer.push(obj);
                    }
                    sop_renderRuleImagesPreview();
                    sop_showInlineToast('แนบรูปแล้ว ✅', 'success');
                });
            }

            if (titleInput && !isEdit) titleInput.focus();
        },
        willClose: () => {
            // เคลียร์ inline toast ถ้ามี
            const t = document.getElementById('sopInlineToast');
            if (t) t.remove();
        },
        preConfirm: () => {
            const title = document.getElementById('qaRuleTitle').value.trim();
            const text = document.getElementById('qaRuleText').value.trim();
            const typeEl = document.querySelector('input[name="qaRuleType"]:checked');
            const ruleType = typeEl ? typeEl.value : 'do';
            const colorEl = document.querySelector('input[name="qaRuleColor"]:checked');
            const color = colorEl ? colorEl.value : '';
            let subgroup = document.getElementById('qaRuleSubgroup').value;
            if (subgroup === '__new__') subgroup = (document.getElementById('qaRuleSubgroupNew').value || '').trim();
            const category = document.getElementById('qaRuleCategory').value;
            const pinned = document.getElementById('qaRulePinned').checked;

            if (!title) { Swal.showValidationMessage('กรุณาใส่หัวข้อกติกา'); return false; }
            return { title, text, type: ruleType, color, subgroup, category, pinned, images: [...sopRuleImagesBuffer], voice_url: window._sopVoiceUrl || '' };
        }
    });

    sopRuleImagesBuffer = [];
    if (!result.isConfirmed || !result.value) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();

        if (isEdit) {
            globalStandaloneRules[editIdx] = {
                ...globalStandaloneRules[editIdx],
                title: result.value.title,
                text: result.value.text,
                type: result.value.type,
                color: result.value.color,
                subgroup: result.value.subgroup,
                category: result.value.category,
                pinned: result.value.pinned,
                images: result.value.images,
                voice_url: result.value.voice_url || '',
                updated_at: nowIso,
                last_editor: authorName,
                read_by: [] // V6: reset read_by เมื่อแก้ → ให้ทุกคนอ่านใหม่
            };
        } else {
            globalStandaloneRules.unshift({
                id: 'srule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                title: result.value.title,
                text: result.value.text,
                type: result.value.type,
                color: result.value.color,
                subgroup: result.value.subgroup,
                category: result.value.category,
                pinned: result.value.pinned,
                images: result.value.images,
                voice_url: result.value.voice_url || '',
                read_by: [],
                author_name: authorName,
                last_editor: authorName,
                created_at: nowIso,
                updated_at: nowIso
            });
        }

        await sop_saveStandaloneRules();
        sop_renderAllRulesPage();
        sop_updateTabCounters();

        // V6: Telegram notify - ส่งเฉพาะตอนสร้างใหม่ (ไม่ส่งตอนแก้ไข)
        if (!isEdit) {
            const catLabel = globalSOPCategories.find(c => c.id === result.value.category)?.name || result.value.category || '';
            // ดึง URL รูปจากข้อมูลที่บันทึก
            const imgUrls = (result.value.images || []).map(im => im.url).filter(u => u);
            sop_sendTelegramNotify('add', 'rule', result.value.title, catLabel, result.value.type, imgUrls, result.value.text);
        }

        Swal.fire({ icon: 'success', title: isEdit ? 'แก้ไขสำเร็จ!' : 'เพิ่มกติกาสำเร็จ!', timer: 1100, showConfirmButton: false });
    } catch (e) {
        console.error('saveStandaloneRule error:', e);
        Swal.fire('Error', e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
}

// onChange ของ subgroup dropdown
window.sop_onSubgroupChange = function(sel) {
    const newInput = document.getElementById('qaRuleSubgroupNew');
    if (!newInput) return;
    if (sel.value === '__new__') {
        newInput.classList.remove('hidden');
        newInput.focus();
    } else {
        newInput.classList.add('hidden');
        newInput.value = '';
    }
};

// Public APIs สำหรับ Tab "กติกาขั้นตอน" (V4)
window.sop_quickAddRule = function() { sop_openStandaloneRuleForm(); };
window.sop_editStandaloneRule = function(idx) { sop_openStandaloneRuleForm(idx); };

window.sop_toggleStandalonePin = async function(idx) {
    if (!globalStandaloneRules[idx]) return;
    globalStandaloneRules[idx].pinned = !globalStandaloneRules[idx].pinned;
    globalStandaloneRules[idx].updated_at = new Date().toISOString();
    try {
        await sop_saveStandaloneRules();
        sop_renderAllRulesPage();
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
        Toast.fire({ icon: 'success', title: globalStandaloneRules[idx].pinned ? '📌 ปักหมุดแล้ว' : 'เลิกปักหมุดแล้ว' });
    } catch (e) {
        Swal.fire('Error', e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
};

window.sop_deleteStandaloneRule = async function(idx) {
    const r = globalStandaloneRules[idx];
    if (!r) return;

    const confirm = await Swal.fire({
        title: 'ยืนยันลบกติกาข้อนี้?',
        html: `<div class="text-left text-sm">
                  <div class="font-bold text-slate-700 dark:text-gray-200 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border border-gray-200 dark:border-slate-700">${(r.title || '(ไม่มีหัวข้อ)').replace(/</g, '&lt;')}</div>
                  <div class="text-gray-500 text-xs mt-2">ลบแล้วจะไม่สามารถกู้คืนได้</div>
               </div>`,
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง', cancelButtonText: 'ยกเลิก'
    });
    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
    try {
        globalStandaloneRules.splice(idx, 1);
        await sop_saveStandaloneRules();
        sop_renderAllRulesPage();
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

// ==========================================
// 🎤 V6: VOICE RECORDER (อัดเสียงในเบราเซอร์ → อัพ Supabase)
// ==========================================
window._sopVoiceUrl = '';
let _sopMediaRecorder = null;
let _sopAudioChunks = [];
let _sopRecordTimer = null;
let _sopRecordSeconds = 0;

window.sop_initVoiceRecorder = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const renderUI = () => {
        const hasVoice = !!window._sopVoiceUrl;
        if (hasVoice) {
            container.innerHTML = `
                <div class="flex items-center gap-3">
                    <audio src="${window._sopVoiceUrl}" controls class="flex-1 h-10"></audio>
                    <button type="button" onclick="sop_removeVoice()" class="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition shadow-sm" title="ลบเสียง"><span class="material-icons text-[16px]">delete</span></button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="flex items-center gap-2">
                    <button type="button" id="sopVoiceRecBtn" onclick="sop_toggleVoiceRecord()" class="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95">
                        <span class="material-icons text-[14px]">mic</span> เริ่มอัดเสียง
                    </button>
                    <span id="sopVoiceTimer" class="text-xs font-bold text-gray-500 hidden">00:00</span>
                    <span class="text-[10px] text-gray-500 italic">เริ่มอัด → พูด → กดหยุด → อัพอัตโนมัติ</span>
                </div>
            `;
        }
    };

    window._sopVoiceRender = renderUI;
    renderUI();
};

window.sop_removeVoice = function() {
    window._sopVoiceUrl = '';
    if (window._sopVoiceRender) window._sopVoiceRender();
};

window.sop_toggleVoiceRecord = async function() {
    const btn = document.getElementById('sopVoiceRecBtn');
    const timer = document.getElementById('sopVoiceTimer');

    // ถ้ากำลังอัดอยู่ → หยุด
    if (_sopMediaRecorder && _sopMediaRecorder.state === 'recording') {
        _sopMediaRecorder.stop();
        return;
    }

    // เริ่มอัด
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _sopAudioChunks = [];
        _sopMediaRecorder = new MediaRecorder(stream);

        _sopMediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) _sopAudioChunks.push(e.data);
        };

        _sopMediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            clearInterval(_sopRecordTimer);
            _sopRecordTimer = null;
            _sopRecordSeconds = 0;

            const blob = new Blob(_sopAudioChunks, { type: 'audio/webm' });
            sop_showInlineToast('กำลังอัพเสียง...', 'info');

            try {
                const fileName = `sop/voice_${Date.now()}_${Math.floor(Math.random() * 10000)}.webm`;
                const { error: upErr } = await appDB.storage.from('staff_images').upload(fileName, blob, { cacheControl: '3600', upsert: false, contentType: 'audio/webm' });
                if (upErr) throw new Error(upErr.message);
                const { data: pubData } = appDB.storage.from('staff_images').getPublicUrl(fileName);
                window._sopVoiceUrl = pubData.publicUrl;
                if (window._sopVoiceRender) window._sopVoiceRender();
                sop_showInlineToast('อัดเสียงเสร็จ ✅', 'success');
            } catch (e) {
                console.error('upload voice error:', e);
                sop_showInlineToast('อัพเสียงไม่สำเร็จ', 'error');
            }
        };

        _sopMediaRecorder.start();
        _sopRecordSeconds = 0;
        if (timer) {
            timer.classList.remove('hidden');
            timer.innerText = '00:00';
        }
        if (btn) {
            btn.classList.remove('bg-rose-500', 'hover:bg-rose-600');
            btn.classList.add('bg-red-600', 'hover:bg-red-700', 'animate-pulse');
            btn.innerHTML = '<span class="material-icons text-[14px]">stop</span> หยุดอัด';
        }
        _sopRecordTimer = setInterval(() => {
            _sopRecordSeconds++;
            const mm = String(Math.floor(_sopRecordSeconds / 60)).padStart(2, '0');
            const ss = String(_sopRecordSeconds % 60).padStart(2, '0');
            const t = document.getElementById('sopVoiceTimer');
            if (t) t.innerText = `${mm}:${ss}`;
        }, 1000);
    } catch (e) {
        console.error('mic error:', e);
        Swal.fire('ไม่สามารถเข้าถึงไมค์ได้', 'กรุณาอนุญาต permission ไมโครโฟนในเบราว์เซอร์', 'error');
    }
};

// ==========================================
// 📖 V6: MARK READ สำหรับกติกาขั้นตอน (standalone)
// ==========================================
window.sop_markStandaloneRead = async function(idx) {
    const r = globalStandaloneRules[idx];
    if (!r) return;
    const myUsername = (currentUser && currentUser.username) || '';
    if (!myUsername) return;
    if (!Array.isArray(r.read_by)) r.read_by = [];
    if (r.read_by.includes(myUsername)) {
        // ถอน
        r.read_by = r.read_by.filter(u => u !== myUsername);
    } else {
        r.read_by.push(myUsername);
    }
    await sop_saveStandaloneRules();
    sop_renderAllRulesPage();
};

// ==========================================
// 📄 V6: EXPORT PDF
// ==========================================
window.sop_exportPDF = async function() {
    // ถาม user ว่าจะ export อะไร
    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">picture_as_pdf</span> Export PDF</div>',
        html: `
            <div class="text-left space-y-3">
                <div class="text-sm text-slate-700 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3">
                    เลือกเนื้อหาที่จะส่งออกเป็น PDF
                </div>
                <div class="space-y-2">
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 hover:border-rose-500 transition has-[:checked]:bg-rose-200 dark:has-[:checked]:bg-rose-900/50 has-[:checked]:border-rose-500">
                        <input type="radio" name="exportMode" value="all" class="w-4 h-4 accent-rose-500" checked>
                        <div class="flex-1">
                            <div class="font-bold text-sm">ทั้งหมด</div>
                            <div class="text-xs text-gray-500">กติกาขั้นตอน + ขั้นตอนต่างๆ (SOP)</div>
                        </div>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500 transition has-[:checked]:bg-orange-200 dark:has-[:checked]:bg-orange-900/50 has-[:checked]:border-orange-500">
                        <input type="radio" name="exportMode" value="rules" class="w-4 h-4 accent-orange-500">
                        <div class="flex-1">
                            <div class="font-bold text-sm">เฉพาะกติกาขั้นตอน</div>
                            <div class="text-xs text-gray-500">${(globalStandaloneRules || []).length} ข้อ</div>
                        </div>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-500 transition has-[:checked]:bg-blue-200 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-blue-500">
                        <input type="radio" name="exportMode" value="sop" class="w-4 h-4 accent-blue-500">
                        <div class="flex-1">
                            <div class="font-bold text-sm">เฉพาะขั้นตอน (SOP)</div>
                            <div class="text-xs text-gray-500">${globalSOPData.length} กฎ</div>
                        </div>
                    </label>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">file_download</span> สร้าง PDF',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const m = document.querySelector('input[name="exportMode"]:checked');
            return m ? m.value : 'all';
        }
    });

    if (!result.isConfirmed) return;
    sop_doExportPDF(result.value);
};

window.sop_doExportPDF = function(mode) {
    // Build HTML แยกหน้าเปิด print dialog
    const dateStr = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });
    const companyName = 'คู่มือการทำงาน (OD)';

    let body = '';

    // หน้าปก
    body += `
        <div class="page cover">
            <div class="cover-inner">
                <h1>${companyName}</h1>
                <h2>${mode === 'rules' ? 'กติกาขั้นตอน' : (mode === 'sop' ? 'ขั้นตอนต่างๆ (SOP)' : 'ฉบับเต็ม')}</h2>
                <div class="meta">สร้าง: ${dateStr}</div>
                <div class="meta">โดย: ${(currentUser && (currentUser.username || currentUser.name)) || 'admin'}</div>
            </div>
        </div>
    `;

    // กติกาขั้นตอน
    if (mode === 'all' || mode === 'rules') {
        body += `<div class="section-header"><h2>📜 กติกาขั้นตอน</h2></div>`;
        // จัดกลุ่มตาม category
        const groupedR = {};
        (globalStandaloneRules || []).forEach(r => {
            const c = r.category || '__uncat__';
            if (!groupedR[c]) groupedR[c] = [];
            groupedR[c].push(r);
        });
        const orderR = [];
        globalSOPCategories.forEach(c => { if (groupedR[c.id]) orderR.push(c.id); });
        Object.keys(groupedR).forEach(k => { if (!orderR.includes(k)) orderR.push(k); });

        if (orderR.length === 0) {
            body += `<div class="empty">ยังไม่มีกติกา</div>`;
        }

        orderR.forEach(catKey => {
            const catObj = globalSOPCategories.find(c => c.id === catKey);
            const catName = catKey === '__uncat__' ? '(ไม่ระบุหมวด)' : (catObj ? catObj.name : catKey);
            const catColor = catObj?.color || '#64748b';

            body += `<div class="cat-block"><div class="cat-title" style="background:${catColor};">${catName} (${groupedR[catKey].length} ข้อ)</div>`;
            groupedR[catKey].forEach((r, i) => {
                const t = r.type || 'do';
                let typeLabel = 'ทำได้', typeColor = '#10b981';
                if (t === 'dont')      { typeLabel = 'ห้ามทำ';     typeColor = '#ef4444'; }
                else if (t === 'must') { typeLabel = 'ต้องทำ';     typeColor = '#f97316'; }
                else if (t === 'info') { typeLabel = 'หมายเหตุ';   typeColor = '#3b82f6'; }
                const usedColor = r.color || typeColor;

                const safeTitle = (r.title || '').replace(/</g, '&lt;');
                const safeText = (r.text || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                const subgroupBadge = r.subgroup ? `<span class="subgroup">📁 ${r.subgroup.replace(/</g, '&lt;')}</span>` : '';

                let imgsHtml = '';
                if (Array.isArray(r.images) && r.images.length > 0) {
                    imgsHtml = '<div class="imgs">' + r.images.map(im => `<img src="${im.url}" />`).join('') + '</div>';
                }

                body += `
                    <div class="rule-item" style="border-left-color:${usedColor};">
                        <div class="rule-head">
                            <span class="type-badge" style="background:${usedColor};">${typeLabel}</span>
                            ${subgroupBadge}
                            <strong>${i + 1}. ${safeTitle}</strong>
                        </div>
                        ${safeText ? `<div class="rule-text">${safeText}</div>` : ''}
                        ${imgsHtml}
                    </div>
                `;
            });
            body += `</div>`;
        });
    }

    // SOP / ขั้นตอนต่างๆ
    if (mode === 'all' || mode === 'sop') {
        body += `<div class="section-header"><h2>📚 ขั้นตอนต่างๆ (SOP)</h2></div>`;

        const groupedS = {};
        (globalSOPData || []).forEach(s => {
            const c = s.category || '__uncat__';
            if (!groupedS[c]) groupedS[c] = [];
            groupedS[c].push(s);
        });
        const orderS = [];
        globalSOPCategories.forEach(c => { if (groupedS[c.id]) orderS.push(c.id); });
        Object.keys(groupedS).forEach(k => { if (!orderS.includes(k)) orderS.push(k); });

        if (orderS.length === 0) {
            body += `<div class="empty">ยังไม่มี SOP</div>`;
        }

        orderS.forEach(catKey => {
            const catObj = globalSOPCategories.find(c => c.id === catKey);
            const catName = catKey === '__uncat__' ? '(ไม่ระบุหมวด)' : (catObj ? catObj.name : catKey);
            const catColor = catObj?.color || '#64748b';

            body += `<div class="cat-block"><div class="cat-title" style="background:${catColor};">${catName} (${groupedS[catKey].length} กฎ)</div>`;

            groupedS[catKey].forEach(item => {
                const safeTitle = (item.title || '').replace(/</g, '&lt;');
                const safeContent = (item.content || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
                const safeExamples = (item.examples || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');

                let attHtml = '';
                if (Array.isArray(item.attachments) && item.attachments.length > 0) {
                    const imgs = item.attachments.filter(a => !(a.url || '').toLowerCase().includes('.pdf') && a.type !== 'pdf');
                    if (imgs.length > 0) attHtml = '<div class="imgs">' + imgs.map(a => `<img src="${a.url}" />`).join('') + '</div>';
                }

                body += `
                    <div class="sop-item">
                        <h3>${safeTitle}</h3>
                        ${safeContent ? `<div class="block-label">📋 รายละเอียด/ขั้นตอน</div><div class="block-body">${safeContent}</div>` : ''}
                        ${safeExamples ? `<div class="block-label">💡 ตัวอย่าง</div><div class="block-body">${safeExamples}</div>` : ''}
                        ${attHtml}
                    </div>
                `;
            });

            body += `</div>`;
        });
    }

    const fullHtml = `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${companyName} — ${dateStr}</title>
<style>
@page { size: A4; margin: 1.5cm; }
body { font-family: 'Sarabun','Tahoma',sans-serif; color:#0f172a; line-height:1.55; font-size:13px; margin:0; padding:0; }
.page { page-break-after: always; }
.cover { display:flex; align-items:center; justify-content:center; height:90vh; }
.cover-inner { text-align:center; padding:40px; border:4px double #e11d48; border-radius:20px; background: linear-gradient(135deg,#fff1f2,#fef3c7); }
.cover h1 { font-size:38px; color:#e11d48; margin:0 0 12px; }
.cover h2 { font-size:22px; color:#475569; font-weight:normal; margin:0 0 24px; }
.cover .meta { font-size:14px; color:#64748b; margin-top:8px; }
.section-header { background: linear-gradient(135deg,#e11d48,#f97316); color:#fff; padding:16px 24px; border-radius:14px; margin:24px 0 16px; }
.section-header h2 { margin:0; font-size:20px; }
.cat-block { margin-bottom:18px; page-break-inside: avoid; }
.cat-title { color:#fff; padding:10px 16px; border-radius:10px 10px 0 0; font-weight:bold; font-size:15px; }
.rule-item { padding:12px 14px; border-left:6px solid; border:1px solid #e5e7eb; border-left-width:6px; margin-bottom:6px; background:#fafafa; border-radius:0 8px 8px 0; page-break-inside: avoid; }
.rule-head { margin-bottom:6px; }
.type-badge { display:inline-block; color:#fff; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold; margin-right:8px; }
.subgroup { display:inline-block; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-size:10px; margin-right:8px; }
.rule-text { color:#334155; font-size:13px; padding-left:6px; margin-top:4px; }
.sop-item { padding:14px; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:10px; background:#fff; page-break-inside: avoid; }
.sop-item h3 { margin:0 0 10px; font-size:17px; color:#0f172a; border-bottom:2px solid #e11d48; padding-bottom:6px; }
.block-label { font-weight:bold; color:#475569; margin:8px 0 4px; font-size:12px; text-transform:uppercase; }
.block-body { color:#0f172a; padding:6px 10px; background:#f8fafc; border-radius:6px; }
.imgs { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.imgs img { max-width:48%; max-height:200px; border:1px solid #e5e7eb; border-radius:6px; }
.empty { padding:30px; text-align:center; color:#94a3b8; font-style:italic; }
@media print {
  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
</style>
</head>
<body>
${body}
<script>
window.addEventListener('load', () => {
  setTimeout(() => window.print(), 600);
});
</script>
</body>
</html>
    `;

    const w = window.open('', '_blank');
    if (!w) {
        Swal.fire('ไม่สามารถเปิดหน้าต่างใหม่', 'กรุณาอนุญาต popup ในเบราเซอร์', 'error');
        return;
    }
    w.document.open();
    w.document.write(fullHtml);
    w.document.close();
};

// ==========================================
// 🔔 V6: TELEGRAM NOTIFICATION
// ==========================================

// โหลดการตั้งค่าจาก Supabase
window._sopTelegramConfig = { enabled: false, bot_token: '', chat_id: '' };

window.sop_loadTelegramConfig = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_telegram_config').single();
        if (data && data.value) {
            window._sopTelegramConfig = JSON.parse(data.value);
        }
    } catch (e) {
        console.warn('No telegram config yet');
    }
};

window.sop_saveTelegramConfig = async function() {
    await appDB.from('settings').upsert([{ key: 'sop_telegram_config', value: JSON.stringify(window._sopTelegramConfig) }]);
};

window.sop_telegramSettings = async function() {
    await sop_loadTelegramConfig();
    const cfg = window._sopTelegramConfig;

    const formHtml = `
        <div class="text-left space-y-3">
            <div class="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-300 dark:border-cyan-700 rounded-xl p-3 text-sm">
                <div class="font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1 mb-2">
                    <span class="material-icons text-[16px]">info</span>วิธีตั้งค่า Telegram Bot
                </div>
                <ol class="text-xs text-slate-700 dark:text-gray-200 ml-4 space-y-1 list-decimal">
                    <li>เปิด Telegram → ค้นหา <b>@BotFather</b> → พิมพ์ <code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">/newbot</code></li>
                    <li>ตั้งชื่อ bot → จะได้ <b>Bot Token</b> มา (ใส่ในช่องล่าง)</li>
                    <li>สร้างกลุ่ม Telegram → เพิ่ม bot เข้ากลุ่ม → ตั้งเป็น admin</li>
                    <li>ในกลุ่มพิมพ์อะไรก็ได้ → ไปที่ <code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
                    <li>คัดลอก <b>chat.id</b> (ปกติเป็นเลขลบ เช่น <code>-1234567890</code>) → ใส่ในช่องล่าง</li>
                    <li>กดปุ่ม <b>ทดสอบ</b> เพื่อตรวจสอบ → กด <b>บันทึก</b></li>
                </ol>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Bot Token <span class="text-red-500">*</span></label>
                <input type="text" id="tgBotToken" value="${(cfg.bot_token || '').replace(/"/g, '&quot;')}" placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxyz" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-xs">
            </div>

            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Chat ID (กลุ่ม) <span class="text-red-500">*</span></label>
                <input type="text" id="tgChatId" value="${(cfg.chat_id || '').replace(/"/g, '&quot;')}" placeholder="-1234567890" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none font-mono text-xs">
            </div>

            <div>
                <label class="flex items-center gap-2 cursor-pointer p-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:border-emerald-500 transition has-[:checked]:bg-emerald-100 dark:has-[:checked]:bg-emerald-900/40">
                    <input type="checkbox" id="tgEnabled" ${cfg.enabled ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
                    <span class="material-icons text-emerald-500 text-[18px]">notifications_active</span>
                    <span class="text-sm font-bold text-slate-800 dark:text-white">เปิดการแจ้งเตือน — ส่งทุกครั้งที่เพิ่ม/แก้ OD</span>
                </label>
            </div>

            <div class="flex gap-2">
                <button type="button" onclick="sop_telegramTest()" class="flex-1 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1 shadow-md transition active:scale-95">
                    <span class="material-icons text-sm">send</span>ทดสอบส่งข้อความ
                </button>
            </div>
            <div id="tgTestResult" class="text-xs text-center min-h-[18px]"></div>
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-cyan-500">notifications</span> ตั้งค่า Telegram</div>',
        html: formHtml,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#06b6d4',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const bot_token = document.getElementById('tgBotToken').value.trim();
            const chat_id = document.getElementById('tgChatId').value.trim();
            const enabled = document.getElementById('tgEnabled').checked;
            if (enabled && (!bot_token || !chat_id)) {
                Swal.showValidationMessage('ต้องใส่ Bot Token และ Chat ID เมื่อเปิดการแจ้งเตือน');
                return false;
            }
            return { bot_token, chat_id, enabled };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        window._sopTelegramConfig = result.value;
        await sop_saveTelegramConfig();
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1100, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'บันทึกไม่สำเร็จ', 'error');
    }
};

window.sop_telegramTest = async function() {
    const tokenEl = document.getElementById('tgBotToken');
    const chatEl = document.getElementById('tgChatId');
    const resultEl = document.getElementById('tgTestResult');
    if (!tokenEl || !chatEl || !resultEl) return;

    const token = tokenEl.value.trim();
    const chatId = chatEl.value.trim();
    if (!token || !chatId) {
        resultEl.innerHTML = '<span class="text-red-500 font-bold">กรุณาใส่ Bot Token และ Chat ID ก่อน</span>';
        return;
    }

    resultEl.innerHTML = '<span class="text-blue-500 font-bold">กำลังส่ง...</span>';

    try {
        const msg = `🤖 <b>ทดสอบการแจ้งเตือน</b>\n\nระบบ K36 OD เชื่อมต่อสำเร็จ ✅\nเวลา: ${new Date().toLocaleString('th-TH')}`;
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
        });
        const json = await res.json();
        if (json.ok) {
            resultEl.innerHTML = '<span class="text-emerald-500 font-bold">✅ ส่งสำเร็จ! เช็คในกลุ่ม Telegram</span>';
        } else {
            resultEl.innerHTML = `<span class="text-red-500 font-bold">❌ ส่งไม่สำเร็จ: ${json.description || 'ไม่ทราบสาเหตุ'}</span>`;
        }
    } catch (e) {
        resultEl.innerHTML = `<span class="text-red-500 font-bold">❌ Error: ${e.message}</span>`;
    }
};

// ส่งแจ้งเตือนเมื่อเพิ่ม OD ใหม่ (เฉพาะตอน add — ไม่ส่งตอน edit)
// imgUrls = array ของ public URL รูป, content = เนื้อหา/รายละเอียด
// helper: ส่งข้อความยาวโดยแบ่ง chunk (Telegram max 4096)
async function sop_sendChunkedMessage(botToken, chatId, text, parseMode = 'HTML') {
    const MAX = 4000;
    if (text.length <= MAX) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
        });
        return;
    }
    // แบ่งตาม newline เพื่อไม่ตัดกลางบรรทัด
    const lines = text.split('\n');
    let chunk = '';
    for (const line of lines) {
        if ((chunk + '\n' + line).length > MAX) {
            if (chunk) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: parseMode })
                });
                await new Promise(r => setTimeout(r, 500));
            }
            chunk = line;
        } else {
            chunk = chunk ? chunk + '\n' + line : line;
        }
    }
    if (chunk) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: parseMode })
        });
    }
}

window.sop_sendTelegramNotify = async function(action, type, title, category, ruleType, imgUrls, content) {
    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) return;

    const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'admin';

    let typeEmoji = '📚', typeText = 'ขั้นตอน (SOP)';
    if (type === 'rule') { typeEmoji = '⚖️'; typeText = 'กติกาขั้นตอน'; }

    let ruleTypeText = '';
    if (ruleType) {
        if (ruleType === 'do') ruleTypeText = '\n🟢 ประเภท: ทำได้';
        else if (ruleType === 'must') ruleTypeText = '\n🟠 ประเภท: ต้องทำ';
        else if (ruleType === 'dont') ruleTypeText = '\n🔴 ประเภท: ห้ามทำ';
        else if (ruleType === 'info') ruleTypeText = '\n🔵 ประเภท: หมายเหตุ';
    }

    const esc = (s) => (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

    const safeTitle    = esc(title    || '(ไม่มีหัวข้อ)');
    const safeCategory = esc(category || 'ไม่ระบุ');

    // [FIX] ไม่ตัดเนื้อหา — ส่งแบบ chunked แทน
    let safeContent = '';
    if (content && content.trim()) {
        safeContent = '\n\n📝 <b>เนื้อหา:</b>\n' + esc(content.trim());
    }

    const header = `${typeEmoji} <b>${typeText}</b>\n\n` +
                   `📋 <b>หัวข้อ:</b> ${safeTitle}\n` +
                   `📁 <b>หมวด:</b> ${safeCategory}` +
                   ruleTypeText;
    const footer = `\n\n👤 <b>โดย:</b> ${esc(authorName)}\n` +
                   `🕐 ${new Date().toLocaleString('th-TH')}`;

    const caption = header + safeContent + footer;

    // สำหรับรูป caption max 1024 → ตัดแค่ส่วน caption แล้วส่ง content แยก
    let captionForPhoto = header + footer;
    if (captionForPhoto.length > 1020) {
        captionForPhoto = captionForPhoto.substring(0, 1020) + '...';
    }

    const validImgs = (imgUrls || []).filter(u => u && typeof u === 'string').slice(0, 10);

    try {
        if (validImgs.length === 0) {
            // [FIX] ส่งแบบ chunked รองรับข้อความยาว
            await sop_sendChunkedMessage(cfg.bot_token, cfg.chat_id, caption, 'HTML');
        } else if (validImgs.length === 1) {
            await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: cfg.chat_id,
                    photo: validImgs[0],
                    caption: captionForPhoto,
                    parse_mode: 'HTML'
                })
            });
        } else {
            const media = validImgs.map((url, idx) => ({
                type: 'photo',
                media: url,
                ...(idx === 0 ? { caption: captionForPhoto, parse_mode: 'HTML' } : {})
            }));
            await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMediaGroup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: cfg.chat_id, media: media })
            });
        }
    } catch (e) {
        console.warn('Telegram notify failed:', e);
    }
};

// ==========================================
// 📤 ส่งข้อแต่ละข้อลง Telegram (กดปุ่มในการ์ด)
// ==========================================
window.sop_sendItemToTelegram = async function(itemId) {
    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) {
        return Swal.fire('ยังไม่ตั้งค่า Telegram', 'กรุณาไปตั้งค่า Telegram ก่อน (ปุ่ม Telegram ด้านบน)', 'warning');
    }

    // หา item จาก globalSOPData (ขั้นตอนต่างๆ)
    let item = null;
    for (const cat of (globalSOPData || [])) {
        const found = (cat.items || []).find(i => i.id === itemId);
        if (found) { item = { ...found, catName: cat.name || cat.title || 'ไม่ระบุ' }; break; }
    }
    if (!item) return Swal.fire('ไม่พบข้อมูล', '', 'error');

    Swal.fire({ title: 'กำลังส่ง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await sop_sendTelegramNotify('manual', 'sop', item.title || '(ไม่มีหัวข้อ)', item.catName, null, item.images || [], item.content || '');
        Swal.fire({ icon: 'success', title: 'ส่งลง Telegram แล้ว!', timer: 1500, showConfirmButton: false });
    } catch(e) { Swal.fire('ส่งไม่สำเร็จ', e.message, 'error'); }
};

window.sop_sendStandaloneToTelegram = async function(idx) {
    const cfg = window._sopTelegramConfig;
    if (!cfg || !cfg.enabled || !cfg.bot_token || !cfg.chat_id) {
        return Swal.fire('ยังไม่ตั้งค่า Telegram', 'กรุณาไปตั้งค่า Telegram ก่อน (ปุ่ม Telegram ด้านบน)', 'warning');
    }

    const r = (globalStandaloneRules || [])[idx];
    if (!r) return Swal.fire('ไม่พบข้อมูล', '', 'error');

    const catName = globalSOPCategories?.find(c => c.id === r.category)?.name || 'ไม่ระบุ';

    Swal.fire({ title: 'กำลังส่ง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await sop_sendTelegramNotify('manual', 'rule', r.title || r.text || '(ไม่มีหัวข้อ)', catName, r.type || null, r.images || [], r.content || r.text || '');
        Swal.fire({ icon: 'success', title: 'ส่งลง Telegram แล้ว!', timer: 1500, showConfirmButton: false });
    } catch(e) { Swal.fire('ส่งไม่สำเร็จ', e.message, 'error'); }
};

// ==========================================
// 📁 ระบบกลุ่ม (Group/Folder) สำหรับกติกาขั้นตอน
// ==========================================
let globalSopGroups = []; // ['K36', 'Jun88', ...]

// โหลดกลุ่มจาก DB
async function sop_loadGroups() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_groups').maybeSingle();
        globalSopGroups = data?.value ? JSON.parse(data.value) : [];
    } catch(e) { globalSopGroups = []; }
    sop_updateGroupDropdown();
}

// บันทึกกลุ่มลง DB
async function sop_saveGroups() {
    await appDB.from('settings').upsert([{ key: 'sop_groups', value: JSON.stringify(globalSopGroups) }]);
    sop_updateGroupDropdown();
}

// อัปเดต dropdown กลุ่ม
window.sop_updateGroupDropdown = function() {
    const sel = document.getElementById('sopRulesGroupFilter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="ALL">📁 ทุกกลุ่ม</option>';
    globalSopGroups.forEach(g => {
        sel.innerHTML += `<option value="${g}">${g}</option>`;
    });
    sel.value = cur;
};

// จัดการกลุ่ม (สร้าง/ลบ)
window.sop_manageGroups = async function() {
    await sop_loadGroups();

    const listHtml = globalSopGroups.length > 0
        ? globalSopGroups.map((g, i) => `
            <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-gray-200 dark:border-slate-700">
                <span class="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                    <span class="material-icons text-indigo-500 text-[18px]">folder</span>${g}
                </span>
                <button onclick="sop_deleteGroup(${i})" class="text-red-400 hover:text-red-600 p-1 rounded transition" title="ลบกลุ่ม">
                    <span class="material-icons text-[16px]">delete</span>
                </button>
            </div>`).join('')
        : '<div class="text-center text-gray-400 py-4 text-sm">ยังไม่มีกลุ่ม</div>';

    const { value: newName } = await Swal.fire({
        title: '<div class="flex items-center gap-2"><span class="material-icons text-indigo-500">folder</span> จัดการกลุ่ม</div>',
        html: `
            <div class="text-left space-y-3">
                <div class="space-y-2 max-h-48 overflow-y-auto">${listHtml}</div>
                <hr class="border-gray-200 dark:border-slate-700">
                <div class="font-bold text-sm text-slate-700 dark:text-slate-200">➕ สร้างกลุ่มใหม่</div>
                <input id="sopNewGroupName" type="text" placeholder="ชื่อกลุ่ม เช่น K36, Jun88..." 
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm outline-none focus:border-indigo-500">
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'สร้างกลุ่ม',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#6366f1',
        didOpen: () => {
            // ให้ปุ่มลบทำงานได้ใน Swal
            document.querySelectorAll('[onclick^="sop_deleteGroup"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const idx = parseInt(btn.getAttribute('onclick').match(/\d+/)[0]);
                    globalSopGroups.splice(idx, 1);
                    await sop_saveGroups();
                    Swal.close();
                    sop_manageGroups();
                });
            });
        },
        preConfirm: () => {
            return document.getElementById('sopNewGroupName')?.value?.trim() || null;
        }
    });

    if (newName) {
        if (globalSopGroups.includes(newName)) {
            return Swal.fire('มีกลุ่มนี้แล้ว', '', 'warning');
        }
        globalSopGroups.push(newName);
        await sop_saveGroups();
        Swal.fire({ icon: 'success', title: `สร้างกลุ่ม "${newName}" แล้ว!`, timer: 1200, showConfirmButton: false });
        sop_renderAllRulesPage();
    }
};

window.sop_deleteGroup = async function(idx) {
    globalSopGroups.splice(idx, 1);
    await sop_saveGroups();
};

// โยกข้อเข้ากลุ่ม
window.sop_moveToGroup = async function(idx) {
    await sop_loadGroups();
    const r = globalStandaloneRules[idx];
    if (!r) return;

    if (globalSopGroups.length === 0) {
        return Swal.fire('ยังไม่มีกลุ่ม', 'กรุณาสร้างกลุ่มก่อน โดยกดปุ่ม "จัดการกลุ่ม"', 'info');
    }

    const options = { '': '— ไม่อยู่กลุ่มไหน —' };
    globalSopGroups.forEach(g => { options[g] = `📁 ${g}`; });

    const { value: selectedGroup } = await Swal.fire({
        title: `<div class="flex items-center gap-2 text-base"><span class="material-icons text-indigo-500">drive_file_move</span> โยก "${r.title || r.text || '(ไม่มีหัวข้อ)'}"</div>`,
        input: 'select',
        inputOptions: options,
        inputValue: r.group || '',
        showCancelButton: true,
        confirmButtonText: 'ย้ายเข้ากลุ่ม',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#6366f1',
    });

    if (selectedGroup !== undefined) {
        r.group = selectedGroup || '';
        await sop_saveStandaloneRules();
        sop_renderAllRulesPage();
        Swal.fire({ icon: 'success', title: selectedGroup ? `ย้ายเข้ากลุ่ม "${selectedGroup}" แล้ว!` : 'นำออกจากกลุ่มแล้ว', timer: 1200, showConfirmButton: false });
    }
};
