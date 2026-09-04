// ════════════════════════════════════════════════════════════════════
// 📦 sop/manage.js — ส่วนที่ 3/4 ของหน้าคู่มือ SOP (แยกจาก sop.js เดิม 3,451 บรรทัด)
// เนื้อหา: CRUD กติกาขั้นตอน (standalone), lightbox ดูรูป, อัดเสียง, mark read
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): sop/core → sop/rules → sop/manage → sop/share
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ต้องโหลดหลัง core เสมอ
// ════════════════════════════════════════════════════════════════════
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
window.sop_quickAddRule = function() { if (!window.sopRequire(window.sopCanManage)) return; sop_openStandaloneRuleForm(); };
window.sop_editStandaloneRule = function(idx) { if (!window.sopRequire(window.sopCanManage)) return; sop_openStandaloneRuleForm(idx); };

window.sop_toggleStandalonePin = async function(idx) {
    if (!window.sopRequire(window.sopCanManage)) return;

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
    if (!window.sopRequire(window.sopCanManage)) return;

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
