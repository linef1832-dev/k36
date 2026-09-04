// ════════════════════════════════════════════════════════════════════
// 📦 sheet/admin.js — ส่วนที่ 4/4 ของตารางงานรวม (ชีต) (แยกจาก sheet.js เดิม 1,616 บรรทัด)
// เนื้อหา: จัดการชีต (เพิ่ม/ลบ/แก้), หน่วงค้นหา, ระบบแบ่งจอคลังรูป
// ⚠️ ลำดับโหลด: sheet/core → sheet/note_view → sheet/note_edit → sheet/admin (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 🟢 4. ระบบแอดมิน (เพิ่ม/ลบ/แก้ไข)
// ==========================================
window.showSheetAdmin = function(personal) {
    // 👤 พนักงานทั่วไปเปิดได้เฉพาะโหมดชีตส่วนตัว — โหมดชีตส่วนกลางเฉพาะ manager/admin
    if (!personal && !window.sheetIsMgr()) personal = true;
    window._sheetPersonalMode = !!personal;

    // ปรับหน้าตา modal ตามโหมด
    const title = document.getElementById('sheetAdminTitle');
    if (title) title.innerHTML = personal
        ? `<span class="material-icons">person</span> ชีตของฉัน (ส่วนตัว — เห็นเฉพาะคุณ)`
        : `<span class="material-icons">settings_applications</span> จัดการรายการ / ลิงก์`;
    const groupWrap = document.getElementById('sheetGroupFieldWrap');
    if (groupWrap) groupWrap.classList.toggle('hidden', !!personal);   // ส่วนตัวไม่ต้องเลือกหมวด (fix เป็น "ชีตของฉัน")
    const hint = document.getElementById('sheetPersonalHint');
    if (hint) hint.classList.toggle('hidden', !personal);

    window.cancelEdit();
    document.getElementById('sheetAdminModal').classList.remove('hidden');
    document.getElementById('sheetAdminModal').classList.add('flex');
    renderAdminSheetList();
};

window.closeSheetAdmin = function() {
    document.getElementById('sheetAdminModal').classList.add('hidden');
    document.getElementById('sheetAdminModal').classList.remove('flex');
};

window.renderAdminSheetList = function() {
    const list = document.getElementById('adminSheetList');
    if(!list) return;
    const colorMap = { 'blue': '#3b82f6', 'green': '#10b981', 'red': '#ef4444', 'yellow': '#f59e0b', 'purple': '#8b5cf6', 'gray': '#64748b' };
    
    // 👤 โหมดส่วนตัว → เฉพาะชีตของตัวเอง | โหมดส่วนกลาง → เฉพาะชีตส่วนกลาง (ไม่ปนกัน)
    const me = window.sheetMe();
    const visible = window.GLOBAL_SHEETS.filter(s => window._sheetPersonalMode ? (s.owner === me) : !s.owner);

    if (visible.length === 0) {
        list.innerHTML = `<div class="col-span-full text-center text-slate-500 py-8 text-sm">${window._sheetPersonalMode ? 'คุณยังไม่มีชีตส่วนตัว — กรอกฟอร์มด้านบนเพื่อสร้างอันแรกได้เลย' : 'ยังไม่มีรายการ'}</div>`;
        return;
    }

    list.innerHTML = visible.map(s => {
        let bg = s.color;
        if(bg && !bg.startsWith('#')) bg = colorMap[bg] || '#8b5cf6';
        if(!bg) bg = '#8b5cf6';
        
        return window.renderTemplate('tpl-sheet-admin-item', {
            id: s.id,
            bg: bg,
            groupName: s.group_name || s.category || 'ทั่วไป',
            title: s.name || s.title
        });
    }).join('');
};

window.startEdit = function(id) {
    const sheet = window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
    if(!sheet) return;
    // 👤 กันสิทธิ์: ชีตส่วนกลางแก้ได้เฉพาะ mgr / ชีตส่วนตัวแก้ได้เฉพาะเจ้าของ
    if (!window.sheetCanTouch(sheet)) return Swal.fire('ไม่มีสิทธิ์', 'คุณแก้ไขได้เฉพาะชีตของตัวเองครับ', 'error');

    document.getElementById('editSheetId').value = sheet.id;
    document.getElementById('newSheetName').value = sheet.name || sheet.title;
    // 📝 ถ้าเป็นหน้าข้อความ โหลดเนื้อหามาใส่ช่องแก้ไข
    if ((sheet.sheet_id || '') === 'NOTE') {
        window.setSheetType('note');
        const fill = (note) => { note = window.noteToV3(note); window._pendingRich = note; document.getElementById('newSheetNote').value = window.noteToText(note); document.getElementById('newSheetNoteHeader').checked = true; window.previewNote(); };
        if (window._noteCache[sheet.id]) fill(window._noteCache[sheet.id]);
        else appDB.from('settings').select('value').eq('key', `sheet_note_${sheet.id}`).maybeSingle().then(({ data }) => { const n = window.noteToV3(data && data.value ? JSON.parse(data.value) : { v: 3, rows: [], cols: [] }); window._noteCache[sheet.id] = n; fill(n); });
    } else {
        window.setSheetType('link');
        document.getElementById('newSheetNote').value = '';
    }
    document.getElementById('newSheetGroup').value = sheet.group_name || sheet.category || '';
    document.getElementById('newSheetCover').value = sheet.cover_url || sheet.bg_image || '';
    
    if(document.getElementById('newSheetCoverFile')) document.getElementById('newSheetCoverFile').value = ''; 
    const coverContainer = document.getElementById('currentSheetCoverContainer');
    const coverImg = document.getElementById('currentSheetCoverImg');
    if(coverContainer && coverImg) {
        if(sheet.cover_url || sheet.bg_image) { coverImg.src = sheet.cover_url || sheet.bg_image; coverContainer.classList.remove('hidden'); } 
        else { coverContainer.classList.add('hidden'); }
    }
    
    let sheetId = sheet.sheet_id || sheet.url || '';
    if (sheetId && !sheetId.startsWith('http')) {
        let fullUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
        if(sheet.gid) fullUrl += `#gid=${sheet.gid}`;
        document.getElementById('newSheetUrl').value = fullUrl;
    } else { document.getElementById('newSheetUrl').value = sheetId; }

    const colorMap = { 'blue': '#3b82f6', 'green': '#22c55e', 'red': '#ef4444', 'yellow': '#eab308', 'purple': '#a855f7', 'gray': '#6b7280' };
    let hexColor = sheet.color;
    if (hexColor && !hexColor.startsWith('#')) hexColor = colorMap[hexColor] || '#3b82f6';
    document.getElementById('newSheetColor').value = hexColor;

    document.getElementById('formTitle').innerText = `✏️ กำลังแก้ไข: ${sheet.name || sheet.title}`;
    document.getElementById('formTitle').className = "text-sm font-bold text-orange-600";
    const btn = document.getElementById('btnSaveSheet');
    btn.innerHTML = `<span class="material-icons">save</span> บันทึกการแก้ไข`;
    btn.classList.replace('bg-green-600', 'bg-orange-500'); 
    btn.classList.replace('hover:bg-green-500', 'hover:bg-orange-600');
    document.getElementById('btnCancelEdit').classList.remove('hidden');
};

window.cancelEdit = function() {
    window._pendingRich = null;
    if (document.getElementById('newSheetType')) { window.setSheetType('link'); document.getElementById('newSheetNote').value = ''; const pv = document.getElementById('notePreview'); if (pv) pv.innerText = ''; }
    ['editSheetId','newSheetName','newSheetGroup','newSheetUrl','newSheetCover'].forEach(id => document.getElementById(id).value = '');
    if(document.getElementById('newSheetCoverFile')) document.getElementById('newSheetCoverFile').value = ''; 
    if(document.getElementById('currentSheetCoverContainer')) document.getElementById('currentSheetCoverContainer').classList.add('hidden');
    document.getElementById('newSheetColor').value = '#3b82f6';
    
    document.getElementById('formTitle').innerHTML = `<span class="material-icons text-[18px]">add_circle</span> เพิ่มรายการใหม่`;
    document.getElementById('formTitle').className = "text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1";
    const btn = document.getElementById('btnSaveSheet');
    btn.innerHTML = `<span class="material-icons">save</span> บันทึกข้อมูล`;
    btn.classList.replace('bg-orange-500', 'bg-green-600'); 
    btn.classList.replace('hover:bg-orange-600', 'hover:bg-green-500');
    document.getElementById('btnCancelEdit').classList.add('hidden');
};

window.saveSheetData = async function() {
    const id = document.getElementById('editSheetId').value;
    const name = document.getElementById('newSheetName').value.trim();
    // 👤 โหมดส่วนตัว: หมวดตายตัวเป็น "ชีตของฉัน" (ไม่ให้ปนกับหมวดส่วนกลาง)
    const group = window._sheetPersonalMode
        ? window.MY_SHEET_GROUP
        : (document.getElementById('newSheetGroup').value.trim() || 'ทั่วไป');

    // 👤 กันสิทธิ์ตอนแก้ไข: แตะได้เฉพาะชีตที่มีสิทธิ์ (กันเรียกตรงจาก console ด้วย)
    if (id) {
        const editing = window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
        if (editing && !window.sheetCanTouch(editing)) return Swal.fire('ไม่มีสิทธิ์', 'คุณแก้ไขได้เฉพาะชีตของตัวเองครับ', 'error');
    } else {
        // สร้างใหม่แบบส่วนกลาง → ต้องเป็น mgr เท่านั้น
        if (!window._sheetPersonalMode && !window.sheetIsMgr()) return Swal.fire('ไม่มีสิทธิ์', 'สร้างชีตส่วนกลางได้เฉพาะผู้จัดการขึ้นไป — ใช้ปุ่ม "+ ชีตของฉัน" เพื่อสร้างชีตส่วนตัวครับ', 'error');
    }
    const url = document.getElementById('newSheetUrl').value.trim();
    const color = document.getElementById('newSheetColor').value;
    
    const coverFileInput = document.getElementById('newSheetCoverFile');
    let finalCoverUrl = document.getElementById('newSheetCover').value.trim(); 
    
    const sheetType = (document.getElementById('newSheetType') || {}).value || 'link';
    let noteData = null;
    if (sheetType === 'note') {
        noteData = window._pendingRich || window.parseNoteText(document.getElementById('newSheetNote').value, document.getElementById('newSheetNoteHeader').checked);
        if (!name) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อเรียก', 'warning');
        noteData = window.noteToV3(noteData);
        if (!noteData.rows || noteData.rows.length === 0) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาวางเนื้อหาตารางอย่างน้อย 1 แถว', 'warning');
    } else
    if(!name || !url) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อและลิงก์', 'warning');
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        if (coverFileInput && coverFileInput.files && coverFileInput.files.length > 0) {
            Swal.update({text: `กำลังอัปโหลดรูปภาพหน้าปก...`});
            
            if (id) {
                const sheetToEdit = window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
                if (sheetToEdit && sheetToEdit.cover_url && sheetToEdit.cover_url.includes('supabase.co') && sheetToEdit.cover_url.includes('files/covers/')) {
                    const oldPath = 'files/covers/' + sheetToEdit.cover_url.split('files/covers/')[1].split('?')[0];
                    await appDB.storage.from('staff_images').remove([oldPath]);
                }
            }

            const coverFile = coverFileInput.files[0];
            const coverName = `sheet_cover_${Date.now()}_${Math.floor(Math.random() * 1000)}.${coverFile.name.split('.').pop()}`;

            const { error: coverError } = await appDB.storage.from('staff_images').upload(`files/covers/${coverName}`, coverFile, { cacheControl: '3600', upsert: false });
            if (coverError) throw new Error('อัปโหลดรูปปกไม่สำเร็จ: ' + coverError.message);
            const { data: coverUrlData } = appDB.storage.from('staff_images').getPublicUrl(`files/covers/${coverName}`);
            finalCoverUrl = coverUrlData.publicUrl;
        }

        let sheetId = url; let gid = null;
        if (sheetType === 'note') { sheetId = 'NOTE'; }
        else {
            const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if(idMatch) {
                sheetId = idMatch[1];
                const gidMatch = url.match(/[?&#]gid=([0-9]+)/); 
                if (gidMatch) gid = gidMatch[1];
            }
        }
        
        const payload = { name: name, group_name: group, sheet_id: sheetId, gid: gid, color: color, cover_url: finalCoverUrl };
        // 👤 เจ้าของชีต: สร้างใหม่ → ตามโหมด (ส่วนตัว = ชื่อตัวเอง, ส่วนกลาง = null)
        //    แก้ไข → ไม่แตะ owner เดิม (กันชีตเปลี่ยนมือโดยไม่ตั้งใจ)
        if (!id) payload.owner = window._sheetPersonalMode ? window.sheetMe() : null;

        let savedId = id;
        if (id) {
            const { error } = await appDB.from('external_sheets').update(payload).eq('id', id);
            if(error) throw error;
        } else {
            const { data: ins, error } = await appDB.from('external_sheets').insert([payload]).select('id').single();
            if(error) throw error;
            savedId = ins.id;
        }
        // 📝 เนื้อหาหน้าข้อความ → settings
        if (sheetType === 'note' && savedId) {
            window.clearSettingCache();
            const { error: nErr } = await appDB.from('settings').upsert([{ key: `sheet_note_${savedId}`, value: JSON.stringify(noteData) }]);
            if (nErr) throw nErr;
            window._noteCache[savedId] = noteData;
        }
        Swal.fire({icon: 'success', title: id ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มรายการสำเร็จ', showConfirmButton: false, timer: 1000});
        
        window.cancelEdit();
        await fetchSheets(true);
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
};

window.deleteSheet = async function(id) {
    // 👤 กันสิทธิ์: ลบได้เฉพาะชีตที่ตัวเองมีสิทธิ์
    const target = window.GLOBAL_SHEETS.find(s => String(s.id) === String(id));
    if (target && !window.sheetCanTouch(target)) return Swal.fire('ไม่มีสิทธิ์', 'คุณลบได้เฉพาะชีตของตัวเองครับ', 'error');

    const result = await Swal.fire({ title: 'ยืนยันการลบ?', text: "ลบแล้วกู้คืนไม่ได้นะ", icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก' });
    if (!result.isConfirmed) return;

    Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
    try {
        try { await appDB.from('settings').delete().eq('key', `sheet_note_${id}`); delete window._noteCache[id]; } catch (e) {}
        const { error } = await appDB.from('external_sheets').delete().eq('id', id);
        if (error) throw error;
        Swal.fire({icon: 'success', title: 'ลบเรียบร้อย', showConfirmButton: false, timer: 1000});
        await fetchSheets(true);
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// =========================================
// 🌟 ระบบหน่วงเวลาช่องค้นหา (พิมพ์เสร็จค่อยหา)
// =========================================
let sheetSearchTimeout = null;
window.onSheetSearch = function() {
    clearTimeout(sheetSearchTimeout);
    sheetSearchTimeout = setTimeout(() => {
        renderSheetMenu(); // สั่งวาดตารางเมื่อหยุดพิมพ์ไปแล้ว 300ms
    }, 300); 
};

// ==========================================
// 🖼️ [แบ่งจอคลังรูป] ชีตครึ่งซ้าย — คลังรูปครึ่งขวา ใช้พร้อมกันได้
// - เปิดแล้ว "ค้างถาวร" จนกว่าจะกดปุ่มปิดเอง (ไม่มี Esc / ไม่มีคลิกข้างนอกแล้วปิด)
// - เปิดครั้งแรกโหลดหน้า gallery จริงมาใส่ + init | ครั้งต่อไปโชว์ทันที สถานะคงเดิม
// - ตอนเปิด: บีบหน้าชีตให้เหลือครึ่งซ้ายพอดี (ไม่มีอะไรถูกบัง)
// ==========================================
// ⚙️ ค่าที่ผู้ใช้จัดไว้: ฝั่ง (left/right) + ความกว้างแผงรูป (% ของจอ) — จำถาวรใน localStorage
window._splitPrefs = (() => { try { return { side: 'right', pct: 50, ...JSON.parse(localStorage.getItem('gallery_split') || '{}') }; } catch (e) { return { side: 'right', pct: 50 }; } })();
window._saveSplitPrefs = function() { window.safeSetItem('gallery_split', JSON.stringify(window._splitPrefs)); };

// จัดตำแหน่งตามค่าที่ตั้งไว้ (เรียกทุกครั้งที่เปิด/สลับฝั่ง/ลากปรับขนาด)
window.applySplitLayout = function() {
    const drawer = document.getElementById('galleryDrawer');
    const sheetApp = document.getElementById('sheetApp');
    if (!drawer) return;
    const p = window._splitPrefs;
    const pct = Math.min(75, Math.max(25, p.pct || 50));
    const drawerPx = Math.round(window.innerWidth * pct / 100);
    drawer.style.width = drawerPx + 'px';
    const gold = '2px solid rgba(232,193,90,.45)';
    if (p.side === 'left') {
        drawer.style.left = '0'; drawer.style.right = 'auto';
        drawer.style.borderLeft = 'none'; drawer.style.borderRight = gold;
        drawer.style.boxShadow = '12px 0 40px rgba(0,0,0,.6)';
    } else {
        drawer.style.right = '0'; drawer.style.left = 'auto';
        drawer.style.borderRight = 'none'; drawer.style.borderLeft = gold;
        drawer.style.boxShadow = '-12px 0 40px rgba(0,0,0,.6)';
    }
    // 📏 วัดตำแหน่งจริงของหน้าชีต (แถบเมนูซ้าย/ระยะขอบกินที่ไม่เท่ากันสองฝั่ง)
    // แล้วตั้ง margin แค่พอให้ขอบชีต "ชนขอบแผงรูปพอดี" — ไม่มีช่องว่างเหลือ ไม่มีอะไรถูกบัง
    if (sheetApp) {
        sheetApp.style.marginLeft = '0px'; sheetApp.style.marginRight = '0px';
        const r = sheetApp.getBoundingClientRect();   // ตำแหน่งตามธรรมชาติ (margin = 0)
        if (p.side === 'left') {
            sheetApp.style.marginLeft = Math.max(0, drawerPx - r.left + 8) + 'px';
            sheetApp.style.marginRight = '0px';
        } else {
            sheetApp.style.marginRight = Math.max(0, r.right - (window.innerWidth - drawerPx) + 8) + 'px';
            sheetApp.style.marginLeft = '0px';
        }
    }
    // ที่จับลากอยู่ขอบด้านที่ติดกับหน้าชีตเสมอ
    const h = document.getElementById('splitDragHandle');
    if (h) { if (p.side === 'left') { h.style.right = '-3px'; h.style.left = 'auto'; } else { h.style.left = '-3px'; h.style.right = 'auto'; } }
};

// ปรับขนาดหน้าต่าง → คำนวณตำแหน่งใหม่ (เฉพาะตอนแผงเปิดอยู่)
window.addEventListener('resize', () => {
    const d = document.getElementById('galleryDrawer');
    if (d && d.style.display === 'flex') window.applySplitLayout();
});

// ⇄ สลับฝั่ง ชีต↔คลังรูป
window.swapSplitSide = function() {
    window._splitPrefs.side = window._splitPrefs.side === 'left' ? 'right' : 'left';
    window._saveSplitPrefs();
    window.applySplitLayout();
};

// สร้างปุ่มสลับฝั่ง + เส้นลากปรับขนาด (สร้างจาก JS — กันไฟล์ HTML เก่าค้าง cache)
window._ensureSplitControls = function() {
    const drawer = document.getElementById('galleryDrawer');
    if (!drawer) return;
    // ปุ่มสลับฝั่ง แทรกหน้าปุ่มปิด
    if (!document.getElementById('btnSwapSplit')) {
        const header = drawer.firstElementChild;
        const closeBtn = header ? header.querySelector('button') : null;
        if (header && closeBtn) {
            const b = document.createElement('button');
            b.id = 'btnSwapSplit';
            b.title = 'สลับฝั่ง ชีต ↔ คลังรูป';
            b.style.cssText = 'background:#334155;color:#fcd34d;padding:6px 12px;border-radius:8px;font-weight:700;font-size:12px;display:flex;align-items:center;gap:4px;border:1px solid rgba(232,193,90,.35);cursor:pointer;margin-right:8px';
            b.innerHTML = '<span class="material-icons" style="font-size:15px">swap_horiz</span> สลับฝั่ง';
            b.onclick = window.swapSplitSide;
            closeBtn.parentElement.insertBefore(b, closeBtn);
            closeBtn.parentElement.style.display = 'flex';
            closeBtn.parentElement.style.alignItems = 'center';
        }
    }
    // เส้นลากปรับความกว้าง (ขอบด้านในของแผงรูป)
    if (!document.getElementById('splitDragHandle')) {
        const h = document.createElement('div');
        h.id = 'splitDragHandle';
        h.title = 'ลากเพื่อปรับขนาดสองฝั่ง';
        h.style.cssText = 'position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:5;background:transparent;transition:background .15s';
        h.onmouseenter = () => h.style.background = 'rgba(232,193,90,.5)';
        h.onmouseleave = () => h.style.background = 'transparent';
        h.onmousedown = (e) => {
            e.preventDefault();
            // ผ้าคลุมโปร่งกันเมาส์หลุดเข้า iframe (Google Sheet) ระหว่างลาก
            const cover = document.createElement('div');
            cover.style.cssText = 'position:fixed;inset:0;z-index:9998;cursor:col-resize';
            document.body.appendChild(cover);
            const move = (ev) => {
                const p = window._splitPrefs;
                const raw = p.side === 'left' ? (ev.clientX / window.innerWidth * 100) : ((window.innerWidth - ev.clientX) / window.innerWidth * 100);
                p.pct = Math.min(75, Math.max(25, Math.round(raw)));
                window.applySplitLayout();
            };
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); cover.remove(); window._saveSplitPrefs(); };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        };
        drawer.appendChild(h);
    }
};

window.toggleGalleryDrawer = async function(show) {
    // 💉 ฉีด CSS โหมดแบ่งจอจาก JS ตรงๆ (กันกรณีไฟล์ sheet.html เก่าค้างใน cache ของ CDN)
    if (!document.getElementById('sheetSplitCSS')) {
        const st = document.createElement('style');
        st.id = 'sheetSplitCSS';
        st.textContent = `
            #sheetApp.sheet-split #sheetMenu .lg\\:flex-row{ flex-direction:column !important; }
            #sheetApp.sheet-split #sheetMenu .lg\\:w-\\[340px\\]{ width:100% !important; position:static !important; max-width:520px; }
            #sheetApp.sheet-split #sheetGroupsContainer .grid{ grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
            #sheetApp.sheet-split #sheetGroupsContainer{ padding-right:4px; }
        `;
        document.head.appendChild(st);
    }
    const drawer = document.getElementById('galleryDrawer');
    const sheetApp = document.getElementById('sheetApp');
    if (!drawer) return;
    const isOpen = drawer.style.display !== 'none' && drawer.style.display !== '';
    const willShow = (show === undefined) ? !isOpen : !!show;

    if (!willShow) {
        drawer.style.display = 'none';
        if (sheetApp) { sheetApp.style.marginRight = ''; sheetApp.style.marginLeft = ''; sheetApp.classList.remove('sheet-split'); }
        return;
    }
    drawer.style.display = 'flex';
    if (sheetApp) { sheetApp.style.transition = 'none'; sheetApp.classList.add('sheet-split'); }
    window._ensureSplitControls();
    window.applySplitLayout();

    // เช็คจาก DOM จริง (ไม่ใช้แฟล็ก) — เพราะเปลี่ยนหน้าไปกลับ DOM ของแผงจะถูกสร้างใหม่
    if (!document.getElementById('galleryApp')) {
        try {
            const body = document.getElementById('galleryDrawerBody');
            const res = await fetch(`./pages/gallery/gallery.html?v=${window._APP_VERSION || Date.now()}`);
            if (!res.ok) throw new Error('โหลดหน้าคลังรูปไม่สำเร็จ');
            body.innerHTML = await res.text();
            // ปุ่ม "กลับ" ของหน้าคลังรูป → เปลี่ยนเป็นปิดแผงแทน (กันหลุดไป dashboard)
            body.querySelectorAll('[onclick*="showPage"]').forEach(btn => {
                btn.setAttribute('onclick', 'toggleGalleryDrawer(false)');
                btn.innerHTML = '<span class="material-icons">close</span> ปิด';
            });
            for (const _g of ['gallery/core', 'gallery/ui']) await window.loadScript(_g);   // gallery ถูกผ่าเป็น 2 ไฟล์ ต้องโหลดครบตามลำดับ
            if (typeof initGalleryApp === 'function') initGalleryApp();
        } catch (e) {
            document.getElementById('galleryDrawerBody').innerHTML = `<div style="text-align:center;color:#f87171;padding:40px 0;font-weight:700">โหลดคลังรูปไม่สำเร็จ<br><span style="font-size:11px;color:#64748b">${e.message}</span></div>`;
        }
    }
};
