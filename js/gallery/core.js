// ════════════════════════════════════════════════════════════════════
// 📦 gallery/core.js — ส่วนที่ 1/2 ของคลังรูป (แยกจาก gallery.js เดิม 823 บรรทัด)
// เนื้อหา: โหลด/วาด/กรองรูป, อัปโหลด, เปลี่ยนโหมด
// ⚠️ ลำดับโหลด: gallery/core → gallery/ui (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
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