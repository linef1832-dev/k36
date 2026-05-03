// ==========================================
// 📋 ระบบ SOP — คู่มือการทำงานกลาง
// เก็บใน Supabase: settings table
//   key: sop_data       → array ของกฎทั้งหมด
//   key: sop_categories → array ของหมวดหมู่
// ==========================================

let globalSOPData = [];
let globalSOPCategories = [];
let currentSopId = null;

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
            // ค่าเริ่มต้น 5 หมวด
            globalSOPCategories = [
                { id: 'การฝาก',     name: '💰 การฝาก' },
                { id: 'การถอน',     name: '💸 การถอน' },
                { id: 'เครดิต',     name: '🪙 เครดิต' },
                { id: 'เคสพิเศษ',   name: '⚠️ เคสพิเศษ' },
                { id: 'กฎทั่วไป',   name: '📌 กฎทั่วไป' }
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
    globalSOPCategories.forEach(c => {
        html += `<option value="${c.id}">${c.name}</option>`;
    });
    filterSelect.innerHTML = html;
    if (currentVal && (currentVal === 'ALL' || globalSOPCategories.some(c => c.id === currentVal))) {
        filterSelect.value = currentVal;
    } else {
        filterSelect.value = 'ALL';
    }
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

    // กรอง emoji ออกเพื่อใช้เป็น id
    const id = val.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim() || val;

    if (globalSOPCategories.some(c => c.id === id || c.name === val)) {
        Swal.showValidationMessage('มีหมวดหมู่นี้ในระบบแล้วครับ');
        return;
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
    if (usedCount > 0) {
        warnText += `\n\n⚠️ มีกฎ ${usedCount} ข้อใช้หมวดนี้อยู่ — กฎจะยังอยู่ในระบบ แต่จะไม่สามารถ filter ตามหมวดนี้ได้`;
    }

    const confirm = await Swal.fire({
        title: 'ยืนยันลบหมวดหมู่?',
        text: warnText,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง',
        cancelButtonText: 'ยกเลิก'
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
// 📥 FETCH DATA
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
        // เรียงตาม updated_at ล่าสุดก่อน
        globalSOPData.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        sop_renderList();
        if (currentSopId) sop_readRule(currentSopId);
    } catch (e) {
        console.error('sop_fetchData error:', e);
        globalSOPData = [];
        sop_renderList();
    }
};

window.sop_saveAllData = async function() {
    await appDB.from('settings').upsert([{ key: 'sop_data', value: JSON.stringify(globalSOPData) }]);
};

// ==========================================
// 📜 RENDER LIST
// ==========================================
window.sop_renderList = function() {
    const term = document.getElementById('sopSearch') ? document.getElementById('sopSearch').value.toLowerCase() : '';
    const cat = document.getElementById('sopCategory') ? document.getElementById('sopCategory').value : 'ALL';
    const container = document.getElementById('sopListContainer');
    const countEl = document.getElementById('sopCount');
    if (!container) return;

    let filtered = globalSOPData.filter(item => {
        const matchSearch = (item.title || '').toLowerCase().includes(term) ||
                            (item.content || '').toLowerCase().includes(term) ||
                            (item.examples || '').toLowerCase().includes(term);
        const matchCat = (cat === 'ALL' || item.category === cat);
        return matchSearch && matchCat;
    });

    if (countEl) countEl.innerText = `${filtered.length}/${globalSOPData.length}`;

    if (globalSOPData.length === 0) {
        const isAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
        const hint = isAdmin ? 'กดปุ่ม "เพิ่มกฎใหม่" เพื่อเริ่ม' : 'รอผู้ดูแลเพิ่มกฎ';
        container.innerHTML = `<div class="text-center text-gray-500 py-10 font-bold text-sm bg-gray-100 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">${hint}</div>`;
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-10 font-bold text-sm bg-gray-100 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">ไม่พบกฎที่ค้นหา</div>`;
        return;
    }

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
        const activeBg = currentSopId === item.id
            ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-400'
            : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/50 hover:bg-white dark:hover:bg-slate-800';

        return window.renderTemplate('tpl-sop-list-item', {
            id: item.id,
            activeBg, iconColor, icon,
            title: item.title || '(ไม่มีชื่อ)',
            displayCat: displayCat || 'ไม่ระบุหมวด',
            date
        });
    }).join('');
};

// ==========================================
// 📖 READ RULE
// ==========================================
window.sop_readRule = function(id) {
    currentSopId = id;
    sop_renderList();

    const item = globalSOPData.find(x => String(x.id) === String(id));
    const reader = document.getElementById('sopReaderContent');
    if (!item || !reader) return;

    const updateDateStr = item.updated_at ? new Date(item.updated_at).toLocaleString('th-TH') : new Date(item.created_at).toLocaleString('th-TH');
    const formattedContent = (item.content || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
    const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));

    const adminBtns = isAdmin ? `
        <div class="flex items-center gap-2 shrink-0">
            <button onclick="sop_editRule('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/20 text-gray-400 hover:text-amber-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="แก้ไข"><span class="material-icons">edit</span></button>
            <button onclick="sop_deleteRule('${item.id}')" class="bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-gray-400 hover:text-red-500 p-2 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm" title="ลบ"><span class="material-icons">delete</span></button>
        </div>` : '';

    const displayCat = globalSOPCategories.find(c => c.id === item.category)?.name || item.category || 'ไม่ระบุหมวด';

    let lastEditorBadge = '';
    if (item.last_editor && item.last_editor !== item.author_name) {
        lastEditorBadge = `<span class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-700"><span class="material-icons text-[14px]">manage_accounts</span> แก้ล่าสุดโดย: ${item.last_editor}</span>`;
    }

    let examplesBlock = '';
    if (item.examples && item.examples.trim()) {
        const formattedExamples = item.examples.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        examplesBlock = window.renderTemplate('tpl-sop-examples', { formattedExamples });
    }

    reader.innerHTML = window.renderTemplate('tpl-sop-read', {
        displayCat,
        title: item.title || '-',
        author_name: item.author_name || 'ไม่ระบุ',
        updateDateStr,
        adminBtns,
        formattedContent,
        examplesBlock,
        lastEditorBadge
    });
};

// ==========================================
// ➕ ADD MODAL
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

    let categoryOptions = globalSOPCategories.map(c =>
        `<option value="${c.id}" ${c.id === categoryVal ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const formHtml = `
        <div class="text-left space-y-3">
            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">หมวดหมู่</label>
                <select id="sopFormCategory" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm shadow-inner">
                    ${categoryOptions}
                </select>
            </div>
            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">ชื่อกฎ <span class="text-red-500">*</span></label>
                <input type="text" id="sopFormTitle" value="${titleVal.replace(/"/g, '&quot;')}" placeholder="เช่น ขั้นตอนตรวจสลิปฝาก, เครดิตห้ามผสมกับยอดฝาก..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm shadow-inner">
            </div>
            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider">รายละเอียด / ขั้นตอน <span class="text-red-500">*</span></label>
                <textarea id="sopFormContent" rows="7" placeholder="พิมพ์รายละเอียดของกฎ — ขั้นตอนการทำงาน, เงื่อนไข, สิ่งที่ต้องทำ/ห้ามทำ..." class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none text-sm shadow-inner whitespace-pre-wrap font-medium leading-relaxed">${contentVal}</textarea>
            </div>
            <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <span class="material-icons text-[14px] text-blue-500">lightbulb</span>
                    ตัวอย่างเคส (ไม่บังคับ)
                </label>
                <textarea id="sopFormExamples" rows="4" placeholder="ตัวอย่างสถานการณ์ที่ใช้กฎนี้ เช่น 'ลูกค้าฝาก 1000 พร้อมรับเครดิต 100 → ต้อง...'" class="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-inner whitespace-pre-wrap font-medium leading-relaxed">${examplesVal}</textarea>
            </div>
        </div>
    `;

    Swal.fire({
        title: `<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-rose-500">${isEdit ? 'edit' : 'post_add'}</span> ${isEdit ? 'แก้ไขกฎ' : 'เพิ่มกฎใหม่'}</div>`,
        html: formHtml,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">save</span> บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const title = document.getElementById('sopFormTitle').value.trim();
            const content = document.getElementById('sopFormContent').value.trim();
            const category = document.getElementById('sopFormCategory').value;
            const examples = document.getElementById('sopFormExamples').value.trim();

            if (!title) { Swal.showValidationMessage('กรุณาใส่ชื่อกฎ'); return false; }
            if (!content) { Swal.showValidationMessage('กรุณาใส่รายละเอียด'); return false; }
            if (!category) { Swal.showValidationMessage('กรุณาเลือกหมวด'); return false; }
            return { title, content, category, examples };
        }
    }).then(async (result) => {
        if (!result.isConfirmed || !result.value) return;
        await sop_saveRule(existing, result.value);
    });
}

window.sop_saveRule = async function(existing, formData) {
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();

        if (existing) {
            // แก้ไข
            const idx = globalSOPData.findIndex(x => String(x.id) === String(existing.id));
            if (idx !== -1) {
                globalSOPData[idx] = {
                    ...globalSOPData[idx],
                    title: formData.title,
                    content: formData.content,
                    examples: formData.examples,
                    category: formData.category,
                    updated_at: nowIso,
                    last_editor: authorName
                };
            }
        } else {
            // เพิ่มใหม่
            globalSOPData.unshift({
                id: 'sop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                title: formData.title,
                content: formData.content,
                examples: formData.examples,
                category: formData.category,
                author_name: authorName,
                last_editor: authorName,
                created_at: nowIso,
                updated_at: nowIso
            });
        }

        await sop_saveAllData();
        // เรียงใหม่ตาม updated
        globalSOPData.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

        sop_renderList();
        if (existing) {
            sop_readRule(existing.id);
        } else {
            currentSopId = globalSOPData[0]?.id;
            if (currentSopId) sop_readRule(currentSopId);
        }

        Swal.fire({ icon: 'success', title: existing ? 'แก้ไขสำเร็จ!' : 'เพิ่มกฎสำเร็จ!', timer: 1500, showConfirmButton: false });
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
                  <div class="text-gray-500 text-xs">ลบแล้วจะไม่สามารถกู้คืนได้</div>
               </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง',
        cancelButtonText: 'ยกเลิก'
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
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'ลบไม่สำเร็จ', 'error');
    }
};
