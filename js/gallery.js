let currentGalleryData = [];
let currentGalleryMode = 'general';
let _galleryPage = 1;
function getGalleryTpl(templateId, data = {}) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return '';
    let html = tpl.innerHTML;
    for (const key in data) {
        const val = data[key] !== undefined && data[key] !== null ? data[key] : '';
        html = html.split(`{{${key}}}`).join(val);
    }
    return html;
}
const GALLERY_MODE_SUFFIX = {
    general: '',
    bonus:   '_BONUS',
    reach:   '_REACH',
    card:    '_CARD',
    logo:    '_LOGO'
};
const GALLERY_MODE_LABEL = {
    general: 'ไม่พบรูปภาพ',
    bonus:   'ยังไม่มีรูปโบนัสไทม์',
    reach:   'ยังไม่มีรูปรีชเมนู',
    card:    'ยังไม่มีรูปการ์ดเมนู',
    logo:    'ยังไม่มีรูป LOGO'
};
const GALLERY_MODE_UPLOAD_TEXT = {
    general: '',
    bonus:   '🎁 โบนัสไทม์ ',
    reach:   '📣 รีชเมนู ',
    card:    '🃏 การ์ดเมนู ',
    logo:    '🏷️ LOGO '
};
window.initGalleryApp = function() {
    const isAdminOrManager = (currentUser.role === 'admin' || currentUser.role === 'manager');
    const tabPermMap = {
        tabBonus: 'gallery_tab_bonus',
        tabReach: 'gallery_tab_reach',
        tabCard:  'gallery_tab_card',
        tabLogo:  'gallery_tab_logo'
    };
    Object.keys(tabPermMap).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const permId = tabPermMap[btnId];
        const canSee = isAdminOrManager || (typeof window.hasUserPerm === 'function' && window.hasUserPerm(permId));
        if (canSee) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    });
    switchGalleryMode('general');
    const adminControls = document.getElementById('adminUploadControls');
    const bulkDeleteBtn = document.getElementById('btnBulkDelete');
    if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
    document.querySelectorAll('.gallery-check').forEach(cb => cb.checked = false);
    const canUpload = isAdminOrManager || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('gallery_upload'));
    if (adminControls) {
        if (canUpload) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }
    const filterSelect = document.getElementById('galleryFilter');
    const uploadSelect = document.getElementById('uploadCategory');
    if (filterSelect && uploadSelect) {
        let optionsHTML = TEAM_LIST.map(t => `<option value="${t}">${t}</option>`).join('');
        if(!filterSelect.innerHTML.includes(TEAM_LIST[0])) {
             filterSelect.innerHTML = `<option value="all">-- ทุกเว็บ --</option><option value="ทั่วไป">ทั่วไป</option>` + optionsHTML;
             uploadSelect.innerHTML = `<option value="ทั่วไป">ทั่วไป</option>` + optionsHTML;
        }
        const currentTeam = document.getElementById('dailyTeam') ? document.getElementById('dailyTeam').value : 'ทั่วไป';
        if(TEAM_LIST.includes(currentTeam)) {
            filterSelect.value = currentTeam;
            uploadSelect.value = currentTeam;
        } else {
            filterSelect.value = 'all';
        }
    }
    const searchInput = document.getElementById('gallerySearch');
    if(searchInput) searchInput.value = '';
    setTimeout(() => initGalleryDragDrop(), 300);
}
window.switchGalleryMode = function(mode) {
    const isAdminOrManager = (currentUser.role === 'admin' || currentUser.role === 'manager');
    const modePerm = { bonus: 'gallery_tab_bonus', reach: 'gallery_tab_reach', card: 'gallery_tab_card', logo: 'gallery_tab_logo' };
    if (modePerm[mode] && !isAdminOrManager) {
        const allowed = (typeof window.hasUserPerm === 'function' && window.hasUserPerm(modePerm[mode]));
        if (!allowed) {
            Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์เข้าดูแท็บนี้ครับ', 'warning');
            return;
        }
    }
    currentGalleryMode = mode;
    const tabs = {
        general: { btn: 'tabGeneral', activeStyle: 'bg-blue-600 text-white shadow-lg border border-blue-400' },
        bonus:   { btn: 'tabBonus',   activeStyle: 'bg-gradient-to-r from-yellow-600 to-amber-500 text-white shadow-lg border border-yellow-400' },
        reach:   { btn: 'tabReach',   activeStyle: 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-lg border border-fuchsia-400' },
        card:    { btn: 'tabCard',    activeStyle: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg border border-emerald-400' },
        logo:    { btn: 'tabLogo',    activeStyle: 'bg-gradient-to-r from-rose-600 to-pink-500 text-white shadow-lg border border-rose-400' }
    };
    const inactiveStyle = 'bg-slate-700 text-gray-400 hover:text-white border border-transparent';
    Object.keys(tabs).forEach(k => {
        const el = document.getElementById(tabs[k].btn);
        if (!el) return;
        const base = 'flex-1 min-w-[110px] py-2 rounded-lg font-bold text-sm transition';
        if (k === mode) {
            el.className = `${base} ${tabs[k].activeStyle} transform scale-105`;
        } else {
            el.className = `${base} ${inactiveStyle}`;
        }
    });
    fetchGalleryImages();
}
window.syncUploadCategory = function() {
    const viewVal = document.getElementById('galleryFilter').value;
    const uploadSelect = document.getElementById('uploadCategory');
    if(viewVal !== 'all' && uploadSelect) {
        uploadSelect.value = viewVal;
    }
}
window.fetchGalleryImages = async function() {
    const grid = document.getElementById('galleryGrid');
    if(!grid) return;
    const filterVal = document.getElementById('galleryFilter').value;
    const searchVal = document.getElementById('gallerySearch').value.toLowerCase();
    const countSpan = document.getElementById('galleryCount');
    grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10 flex flex-col items-center"><span class="material-icons animate-spin text-4xl mb-2">sync</span>กำลังโหลด...</div>';
    const { data, error } = await appDB.from('image_gallery').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error || !data) {
        grid.innerHTML = '<div class="col-span-full text-center text-red-400">โหลดไม่สำเร็จ</div>';
        return;
    }
    const currentSuffix = GALLERY_MODE_SUFFIX[currentGalleryMode] || '';
    const allSuffixes = Object.values(GALLERY_MODE_SUFFIX).filter(s => s !== '');
    let filteredData = data.filter(img => {
        const cat = img.category || '';
        if (currentGalleryMode === 'general') {
            for (const suf of allSuffixes) {
                if (cat.endsWith(suf)) return false;
            }
        } else {
            if (!cat.endsWith(currentSuffix)) return false;
        }
        if (filterVal !== 'all') {
            const targetCat = filterVal + currentSuffix;
            if (cat !== targetCat) return false;
        }
        if (searchVal && !img.name.toLowerCase().includes(searchVal)) return false;
        return true;
    });
    currentGalleryData = filteredData;
    if(countSpan) countSpan.innerText = filteredData.length;
    _renderWebBadges(filteredData);
    if (filteredData.length === 0) {
        const msg = GALLERY_MODE_LABEL[currentGalleryMode] || 'ไม่พบรูปภาพ';
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 pt-20">${msg}</div>`;
        return;
    }
    const sortVal = document.getElementById('gallerySort')?.value || 'newest';
    if (sortVal === 'newest')    filteredData.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sortVal === 'oldest')   filteredData.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sortVal === 'name_asc') filteredData.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    else if (sortVal === 'name_desc')filteredData.sort((a,b) => (b.name||'').localeCompare(a.name||''));
    const perPage  = parseInt(document.getElementById('galleryPerPage')?.value || '50');
    const maxPage  = Math.ceil(filteredData.length / perPage);
    if (_galleryPage > maxPage) _galleryPage = 1;
    const start    = (_galleryPage - 1) * perPage;
    const pageData = filteredData.slice(start, start + perPage);
    const pagEl = document.getElementById('galleryPagination');
    if (pagEl) {
        if (maxPage > 1) {
            let btns = '';
            for (let i = 1; i <= maxPage; i++) {
                const active = i === _galleryPage
                    ? 'bg-pink-600 text-white border-pink-400 scale-110'
                    : 'bg-slate-700 text-gray-300 border-slate-600 hover:bg-pink-700 hover:text-white';
                btns += `<button onclick="_galleryPage=${i}; fetchGalleryImages()" class="text-xs font-bold min-w-[28px] h-7 px-2 rounded-lg border ${active} transition">${i}</button>`;
            }
            pagEl.innerHTML = `<span class="text-gray-400 text-xs mr-1">หน้า:</span>${btns}`;
        } else {
            pagEl.innerHTML = '';
        }
    }
    const isAdminG = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canDelG  = isAdminG || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('gallery_delete'));
    const lastViewG = new Date(localStorage.getItem(`gallery_last_view_${currentUser.username}`) || '2000-01-01');
    grid.innerHTML = pageData.map((img, i) => {
        const realIdx   = start + i;
        const imgDate   = new Date(img.created_at);
        const isNewG    = imgDate > lastViewG;
        const uploadDate = imgDate.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
        const uploadBy   = img.uploaded_by ? `โดย ${img.uploaded_by}` : '';
        const newBadgeG  = isNewG ? `<span class="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded shadow-lg font-bold animate-pulse z-30 border border-white/50">NEW</span>` : '';
        const adminCbG   = canDelG ? `<div class="absolute top-2 left-2 z-30" onclick="event.stopPropagation()"><input type="checkbox" class="gallery-check w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shadow-sm bg-white" value="${img.id}" onchange="updateBulkDeleteButton()"></div>` : '';
        let catColorG = 'bg-black/60 text-white border-white/20';
        let catNameG  = img.category || '';
        if (catNameG.endsWith('_BONUS'))      { catNameG = catNameG.replace('_BONUS',''); catColorG = 'bg-yellow-600/90 text-white border-yellow-300'; }
        else if (catNameG.endsWith('_REACH')) { catNameG = catNameG.replace('_REACH',''); catColorG = 'bg-purple-600/90 text-white border-fuchsia-300'; }
        else if (catNameG.endsWith('_CARD'))  { catNameG = catNameG.replace('_CARD','');  catColorG = 'bg-emerald-600/90 text-white border-teal-300'; }
        const catBadgeG = `<span class="absolute bottom-2 left-2 ${catColorG} text-[10px] px-2 py-0.5 rounded border z-20 backdrop-blur-sm font-bold shadow-sm">${catNameG}</span>`;
        const isAdminRename = (currentUser.role === 'manager' || currentUser.role === 'admin');
        const renameBtn = isAdminRename
            ? `<button data-img-id="${img.id}" data-img-name="${(img.name||'').replace(/"/g,'&quot;')}" onclick="event.stopPropagation(); renameGalleryImage(this.dataset.imgId, this.dataset.imgName)" class="text-amber-400 hover:text-amber-300 shrink-0 transition opacity-0 group-hover:opacity-100"><span class="material-icons text-[14px]">edit</span></button>`
            : '';
        return getGalleryTpl('tpl-gallery-card', {
            url: img.url, name: img.name,
            imgId: img.id,
            renameBtn,
            newBadge: newBadgeG, adminCheckbox: adminCbG, catBadge: catBadgeG,
            uploadDate, uploadBy,
            lbIndex: realIdx,
            lightboxClick: ''
        });
    }).join('');
    updateBulkDeleteButton();
}
window.handleImageUpload = async function(input) {
    const files = input.files;
    let category = document.getElementById('galleryFilter').value;
    if (category === 'all' || !category) category = 'ทั่วไป';
    const currentSuffix = GALLERY_MODE_SUFFIX[currentGalleryMode] || '';
    category += currentSuffix;
    const displayCategory = category.replace(currentSuffix, '');
    const modeText = GALLERY_MODE_UPLOAD_TEXT[currentGalleryMode] || '';
    if (!files || files.length === 0) return;
    Swal.fire({
        title: 'กำลังอัปโหลด...',
        text: `กำลังนำรูปไปใส่ในหมวด: ${modeText}${displayCategory}`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
    let successCount = 0; let failCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        Swal.update({ text: `กำลังอัปโหลดไฟล์: ${file.name} (${i + 1}/${files.length})` });
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}.${fileExt}`;
            const { error: uploadError } = await appDB.storage.from('staff_images').upload(fileName, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw new Error(uploadError.message);
            const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(fileName);
            const { error: dbError } = await appDB.from('image_gallery').insert([{
                name: file.name, url: publicUrlData.publicUrl, uploader: currentUser.username || 'unknown', category: category
            }]);
            if (dbError) throw new Error(dbError.message);
            successCount++;
        } catch (err) { failCount++; }
    }
    input.value = '';
    document.getElementById('galleryFilter').value = category.replace(currentSuffix, '');
    fetchGalleryImages();
    if (failCount === 0) Swal.fire({ icon: 'success', title: 'เสร็จสิ้น', text: `อัปโหลด ${successCount} รูป เข้าหมวด ${modeText}${displayCategory} เรียบร้อย`, timer: 1500, showConfirmButton: false });
    else Swal.fire('แจ้งเตือน', `สำเร็จ ${successCount}, ล้มเหลว ${failCount}`, 'warning');
}
window.updateBulkDeleteButton = function() {
    const checkboxes = document.querySelectorAll('.gallery-check:checked');
    const btn = document.getElementById('btnBulkDelete');
    const countSpan = document.getElementById('selectedCount');
    if (btn) {
        if (checkboxes.length > 0) { btn.classList.remove('hidden'); countSpan.innerText = checkboxes.length; }
        else { btn.classList.add('hidden'); }
    }
}
window.toggleSelectAllImages = function(source) {
    document.querySelectorAll('.gallery-check').forEach(cb => cb.checked = source.checked);
    updateBulkDeleteButton();
}
window.deleteSelectedImages = async function() {
    const ids = Array.from(document.querySelectorAll('.gallery-check:checked')).map(cb => cb.value);
    if (ids.length === 0) return;
    const result = await Swal.fire({ title: `ลบ ${ids.length} รูป?`, text: "ลบแล้วกู้คืนไม่ได้นะครับ", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย!', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        Swal.fire({ title: 'กำลังลบ...', didOpen: () => Swal.showLoading() });
        const { error } = await appDB.from('image_gallery').delete().in('id', ids);
        if (error) Swal.fire('Error', error.message, 'error');
        else { fetchGalleryImages(); Swal.fire({ icon: 'success', title: 'ลบเรียบร้อย', timer: 1500, showConfirmButton: false }); }
    }
}
window.viewImageFull = function(url) { window.open(url, '_blank'); }
window.downloadGalleryUrl = async function(url, fileName) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName || `img_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    } catch(e) { window.open(url, '_blank'); }
}
window.downloadAllInFilter = async function() {
    if (!currentGalleryData || currentGalleryData.length === 0) return Swal.fire('ไม่มีรูป', '', 'warning');
    if (typeof JSZip === 'undefined') {
        try {
            Swal.fire({ title: 'กำลังเตรียมระบบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('โหลด JSZip ไม่สำเร็จ'));
                document.head.appendChild(script);
            });
        } catch (e) {
            return Swal.fire('Error', 'ไม่สามารถโหลดระบบสร้างโฟลเดอร์ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'error');
        }
    }
    if (typeof JSZip === 'undefined') return Swal.fire('Error', 'ไม่พบระบบสร้างโฟลเดอร์ กรุณาแจ้งผู้ดูแลระบบ', 'error');
    let categoryName = document.getElementById('galleryFilter').value;
    let folderName = categoryName === 'all' ? 'รวมรูปภาพทั้งหมด' : categoryName;
    const folderSuffixMap = { general: '', bonus: '_BonusTime', reach: '_ReachMenu', card: '_CardMenu' };
    folderName += (folderSuffixMap[currentGalleryMode] || '');
    const confirm = await Swal.fire({ title: `โหลด ${currentGalleryData.length} รูป?`, text: `ระบบจะรวบรวมไฟล์ใส่โฟลเดอร์ชื่อ "${folderName}.zip"`, icon: 'question', showCancelButton: true, confirmButtonText: 'เริ่มดาวน์โหลด', confirmButtonColor: '#2563eb' });
    if (confirm.isConfirmed) {
        Swal.fire({ title: 'กำลังเตรียมไฟล์...', text: 'กรุณารอสักครู่ ห้ามปิดหน้าต่างนี้', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        try {
            const zip = new JSZip();
            const imgFolder = zip.folder(folderName);
            let count = 0;
            for (const img of currentGalleryData) {
                try {
                    const response = await fetch(img.url);
                    const blob = await response.blob();
                    const fileName = img.name || `image_${Date.now()}_${count}.jpg`;
                    imgFolder.file(fileName, blob);
                    count++;
                    Swal.update({ text: `กำลังดึงรูป... (${count}/${currentGalleryData.length})` });
                } catch (fetchErr) { console.error("ดึงรูปไม่สำเร็จ:", img.url, fetchErr); }
            }
            Swal.update({ text: `กำลังบีบอัดเป็นไฟล์ ZIP...` });
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${folderName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            Swal.fire({ icon: 'success', title: 'ดาวน์โหลดเสร็จสิ้น!', timer: 1500, showConfirmButton: false });
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างไฟล์ ZIP ได้', 'error'); }
    }
};
// ==========================================
// 📋 คัดลอกรูปภาพ — popup สวยขึ้น
// ==========================================
window.copyImageToClipboard = async function(imageUrl) {
    // Loading popup — dark theme
    Swal.fire({
        html: `
            <div style="padding:14px 8px">
                <div style="position:relative;width:50px;height:50px;margin:0 auto 12px">
                    <div style="position:absolute;inset:0;border-radius:50%;border:3px solid rgba(236,72,153,0.15)"></div>
                    <div style="position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:#ec4899;animation:gspinn .8s linear infinite"></div>
                    <div style="position:absolute;inset:8px;border-radius:50%;border:2px solid transparent;border-top-color:#f9a8d4;animation:gspinn .6s linear infinite reverse"></div>
                </div>
                <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px">กำลังคัดลอกรูปภาพ</div>
                <div style="font-size:11px;color:#94a3b8">กำลังแปลงไฟล์ กรุณารอสักครู่...</div>
            </div>
            <style>@keyframes gspinn{to{transform:rotate(360deg)}}</style>
        `,
        background: '#0f172a',
        backdrop: 'rgba(0,0,0,0.65)',
        allowOutsideClick: false,
        showConfirmButton: false,
        customClass: { popup: 'rounded-2xl border border-pink-900/40' }
    });
    try {
        if (!navigator.clipboard || !window.ClipboardItem) {
            throw new Error("เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพโดยตรง (แนะนำให้ใช้ Chrome หรือ Edge)");
        }
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("ไม่สามารถโหลดรูปภาพจากเซิร์ฟเวอร์ได้"));
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
            try {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                // Success popup — สวยขึ้น
                Swal.fire({
                    html: `
                        <div style="padding:14px 8px">
                            <div style="width:58px;height:58px;margin:0 auto 14px;background:rgba(34,197,94,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(34,197,94,0.3);box-shadow:0 0 20px rgba(34,197,94,0.12)">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:8px">คัดลอกสำเร็จ!</div>
                            <div style="font-size:12px;color:#94a3b8;line-height:1.8">
                                นำไปกดวาง
                                <kbd style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:5px;padding:2px 7px;font-size:11px;color:#e2e8f0;font-family:monospace">Ctrl+V</kbd>
                                ในช่องแชท Line OA ได้เลยครับ
                            </div>
                        </div>
                    `,
                    background: '#0f172a',
                    backdrop: 'rgba(0,0,0,0.6)',
                    timer: 2400,
                    showConfirmButton: false,
                    customClass: { popup: 'rounded-2xl border border-green-900/40' }
                });
            } catch (err) {
                console.error('Clipboard write failed:', err);
                Swal.fire({
                    html: `<div style="padding:12px 8px">
                        <div style="width:52px;height:52px;margin:0 auto 12px;background:rgba(239,68,68,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(239,68,68,0.3)">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </div>
                        <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:6px">คัดลอกไม่สำเร็จ</div>
                        <div style="font-size:11px;color:#94a3b8">${err.message}</div>
                    </div>`,
                    background: '#0f172a', backdrop: 'rgba(0,0,0,0.6)',
                    showConfirmButton: true, confirmButtonText: 'ตกลง', confirmButtonColor: '#dc2626',
                    customClass: { popup: 'rounded-2xl border border-red-900/40', confirmButton: 'rounded-xl font-bold px-5' }
                });
            }
        }, 'image/png');
    } catch (err) {
        console.error('Copy image failed:', err);
        Swal.fire({
            html: `<div style="padding:12px 8px">
                <div style="width:52px;height:52px;margin:0 auto 12px;background:rgba(239,68,68,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(239,68,68,0.3)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </div>
                <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:6px">คัดลอกไม่สำเร็จ</div>
                <div style="font-size:11px;color:#94a3b8">${err.message}</div>
            </div>`,
            background: '#0f172a', backdrop: 'rgba(0,0,0,0.6)',
            showConfirmButton: true, confirmButtonText: 'ตกลง', confirmButtonColor: '#dc2626',
            customClass: { popup: 'rounded-2xl border border-red-900/40', confirmButton: 'rounded-xl font-bold px-5' }
        });
    }
};
window.filterGalleryImages = function() {
    clearTimeout(window.gallerySearchTimer);
    window.gallerySearchTimer = setTimeout(() => {
        fetchGalleryImages(true);
    }, 300);
};
// ==========================================
// 🖼️ Lightbox
// ==========================================
let _lbIndex = 0;
let _lbData  = [];
const _isAdminGallery = () => currentUser.role === 'admin' || currentUser.role === 'manager';
window.openLightbox = function(index) {
    _lbData  = currentGalleryData;
    _lbIndex = index;
    _updateLightbox();
    document.getElementById('galleryLightbox').classList.remove('hidden');
    document.addEventListener('keydown', _lbKeyHandler);
};
function _updateLightbox() {
    const img = _lbData[_lbIndex];
    if (!img) return;
    document.getElementById('lightboxImg').src              = img.url;
    document.getElementById('lightboxName').textContent     = img.name || '';
    document.getElementById('lightboxCounter').textContent  = `${_lbIndex + 1} / ${_lbData.length}`;
    document.getElementById('lightboxDownload').href        = img.url;
    document.getElementById('lightboxDownload').download    = img.name || 'image';
    const dateEl = document.getElementById('lightboxDate');
    if (dateEl && img.created_at) {
        const d = new Date(img.created_at);
        dateEl.textContent = `📅 ${d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}`;
    }
    const renameBtn = document.getElementById('lightboxRename');
    if (renameBtn) {
        if (_isAdminGallery()) renameBtn.classList.remove('hidden');
        else renameBtn.classList.add('hidden');
    }
}
window.moveLightbox = function(dir) {
    _lbIndex = (_lbIndex + dir + _lbData.length) % _lbData.length;
    _updateLightbox();
};
window.closeLightbox = function() {
    document.getElementById('galleryLightbox').classList.add('hidden');
    document.removeEventListener('keydown', _lbKeyHandler);
};
function _lbKeyHandler(e) {
    if (e.key === 'ArrowRight') moveLightbox(1);
    else if (e.key === 'ArrowLeft') moveLightbox(-1);
    else if (e.key === 'Escape') closeLightbox();
}
window._copyLightboxUrl = function() {
    const img = _lbData[_lbIndex];
    if (!img) return;
    navigator.clipboard.writeText(img.url).then(() => {
        Swal.fire({ icon: 'success', title: 'Copy URL แล้ว!', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
    });
};
window._renameLightboxImg = async function() {
    const img = _lbData[_lbIndex];
    if (!img) return;
    const { value: newName } = await Swal.fire({
        title: 'แก้ชื่อรูป',
        input: 'text',
        inputValue: img.name || '',
        inputPlaceholder: 'ชื่อรูปใหม่...',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        background: '#1e293b', color: '#e2e8f0',
        confirmButtonColor: '#d97706',
    });
    if (!newName || newName.trim() === img.name) return;
    try {
        const { error } = await appDB.from('image_gallery').update({ name: newName.trim() }).eq('id', img.id);
        if (error) throw error;
        img.name = newName.trim();
        document.getElementById('lightboxName').textContent = img.name;
        Swal.fire({ icon: 'success', title: 'แก้ชื่อสำเร็จ!', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
        fetchGalleryImages();
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
};
// ==========================================
// 📁 Drag & Drop Upload
// ==========================================
window.initGalleryDragDrop = function() {
    const zone = document.getElementById('galleryDropZone');
    const adminControls = document.getElementById('adminUploadControls');
    if (!zone || !adminControls || adminControls.classList.contains('hidden')) return;
    zone.classList.remove('hidden');
    const galleryApp = document.getElementById('galleryApp');
    if (!galleryApp) return;
    galleryApp.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('border-pink-300', 'bg-pink-800/30');
    });
    galleryApp.addEventListener('dragleave', (e) => {
        if (!galleryApp.contains(e.relatedTarget)) {
            zone.classList.remove('border-pink-300', 'bg-pink-800/30');
        }
    });
    galleryApp.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('border-pink-300', 'bg-pink-800/30');
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;
        const fakeInput = { files };
        await window.handleImageUpload(fakeInput);
    });
};
// ==========================================
// 📊 Badge count per web
// ==========================================
function _renderWebBadges(data) {
    const badgeEl = document.getElementById('galleryWebBadges');
    if (!badgeEl) return;
    const counts = {};
    data.forEach(img => {
        const cat = img.category || 'ทั่วไป';
        const webName = cat.replace(/_BONUS|_REACH|_CARD|_LOGO/g, '') || 'ทั่วไป';
        counts[webName] = (counts[webName] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const currentFilter = document.getElementById('galleryFilter')?.value || 'all';
    badgeEl.innerHTML = sorted.map(([web, count]) => {
        const isActive = currentFilter === web;
        const activeClass = isActive
            ? 'bg-pink-600 text-white border-pink-400'
            : 'bg-slate-700 text-gray-300 border-slate-600 hover:bg-pink-700 hover:text-white';
        return `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${activeClass} border cursor-pointer transition"
              onclick="document.getElementById('galleryFilter').value='${web}'; fetchGalleryImages()">
            ${web} <span class="${isActive ? 'text-pink-200' : 'text-pink-400'}">${count}</span>
        </span>`;
    }).join('');
}
// ==========================================
// ✏️ แก้ชื่อรูปจากหน้า card
// ==========================================
window.renameGalleryImage = async function(imgId, currentName) {
    const isAdminG = (currentUser.role === 'manager' || currentUser.role === 'admin');
    if (!isAdminG) return;
    const { value: newName } = await Swal.fire({
        title: 'แก้ชื่อรูป',
        input: 'text',
        inputValue: currentName || '',
        inputPlaceholder: 'ชื่อรูปใหม่...',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        background: '#1e293b', color: '#e2e8f0',
        confirmButtonColor: '#d97706',
        inputAttributes: { maxlength: 100 }
    });
    if (!newName || newName.trim() === currentName) return;
    try {
        const { error } = await appDB.from('image_gallery').update({ name: newName.trim() }).eq('id', imgId);
        if (error) throw error;
        const idx = currentGalleryData.findIndex(d => String(d.id) === String(imgId));
        if (idx !== -1) currentGalleryData[idx].name = newName.trim();
        Swal.fire({ icon: 'success', title: 'แก้ชื่อสำเร็จ!', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
        fetchGalleryImages();
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
};
