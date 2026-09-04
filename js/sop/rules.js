// ════════════════════════════════════════════════════════════════════
// 📦 sop/rules.js — ส่วนที่ 2/4 ของหน้าคู่มือ SOP (แยกจาก sop.js เดิม 3,451 บรรทัด)
// เนื้อหา: หน้ากติกา (Layout 2 คอลัมน์), อ่านกติกา, modal เพิ่ม/แก้ไข, ไฟล์แนบ, บันทึก, ลบ, ปักหมุด, รับทราบ, คัดลอก
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): sop/core → sop/rules → sop/manage → sop/share
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ต้องโหลดหลัง core เสมอ
// ════════════════════════════════════════════════════════════════════
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
    // กรองตามกลุ่มที่เลือกใน dropdown
    const activeGroupFilter = document.getElementById('sopRulesGroupFilter')?.value || 'ALL';
    const filteredCatKeys = activeGroupFilter === 'ALL'
        ? orderedCatKeys
        : orderedCatKeys.filter(k => {
            const c = globalSOPCategories.find(x => x.id === k);
            return (c?.group || '') === activeGroupFilter;
        });

    let tocHtml = '';
    filteredCatKeys.forEach(catKey => {
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

        const catGroupName = catObj?.group || '';
        const catGroupBadge = catGroupName ? `<span class="inline-flex items-center gap-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"><span class="material-icons text-[9px]">folder</span>${catGroupName}</span>` : '';
        const isAdminForToc = currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin');
        const moveCatBtn = isAdminForToc ? `<button onclick="event.stopPropagation(); sop_moveCategoryToGroup('${safeCatKey}')" class="opacity-0 group-hover:opacity-100 ml-auto shrink-0 p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-400 hover:text-indigo-500 hover:border-indigo-400 transition" title="โยกเข้ากลุ่ม"><span class="material-icons text-[14px]">drive_file_move</span></button>` : '';

        tocHtml += `
            <div onclick="sop_selectRulesCategory('${safeCatKey}')" class="cursor-pointer rounded-xl border-l-4 ${isSelected ? 'ring-2 ring-orange-300 dark:ring-orange-700 bg-orange-50 dark:bg-orange-900/20 border-orange-400' : 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500/50 hover:bg-white dark:hover:bg-slate-800'} transition group shadow-sm relative overflow-hidden mb-2.5" style="border-left-color: ${catColor};">
                <div class="p-3 flex gap-3 items-center">
                    <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-inner" style="background-color: ${catColor};">
                        <span class="material-icons text-[20px]">${catIcon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-slate-800 dark:text-white font-bold text-sm truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition leading-snug">${(catLabel).replace(/</g, '&lt;')}</h4>
                        <div class="flex items-center gap-1 mt-0.5">
                            <span class="text-[10px] font-bold text-gray-500">${items.length} ข้อ</span>
                            ${catGroupBadge}
                        </div>
                    </div>
                    ${isSelected ? '<span class="material-icons text-orange-500 text-[18px]">arrow_forward</span>' : moveCatBtn}
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
    if (!window.sopRequire(window.sopCanManage)) return;

    sop_openEditModal(null);
};

window.sop_editRule = function(id) {
    if (!window.sopRequire(window.sopCanManage)) return;

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
    if (!window.sopRequire(window.sopCanManage)) return;

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
    if (!window.sopRequire(window.sopCanManage)) return;

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
    if (!window.sopRequire(window.sopCanManage)) return;

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
