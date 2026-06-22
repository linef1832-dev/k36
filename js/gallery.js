let currentGalleryData = [];
let currentGalleryMode = 'general';
let _galleryPage = 1;

// 🌟 ตัวช่วยดึง HTML Template และแทนที่ข้อมูล (เหมือนของหน้า Summary)
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

// 🌟 [คลังรูป] กำหนด suffix ของแต่ละ mode → เก็บใน DB เป็น category เช่น "Jun88_BONUS", "MK8_REACH"
// mode 'general' → ไม่มี suffix (ใช้ category ตรงๆ)
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
    // 🌟 [สิทธิ์ tab] ซ่อนแท็บที่ไม่มีสิทธิ์ดู — admin/manager เห็นทุกแท็บ
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

    // 🌟 [แก้บัค] เช็คสิทธิ์อัปโหลดแบบ permission ด้วย ไม่ใช่แค่ role
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

    // เริ่ม Drag & Drop
    setTimeout(() => initGalleryDragDrop(), 300);
}

window.switchGalleryMode = function(mode) {
    // 🌟 [สิทธิ์ tab] กันเปิด mode ที่ไม่มีสิทธิ์ (เผื่อ user ลอง bypass ด้วย console)
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
    
    // ปิดปุ่มทุก tab → เปิดเฉพาะที่ active
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

    // 🌟 [คลังรูป] ตัวช่วยเช็คว่า category ตรงกับ mode ปัจจุบันไหม
    const currentSuffix = GALLERY_MODE_SUFFIX[currentGalleryMode] || '';
    const allSuffixes = Object.values(GALLERY_MODE_SUFFIX).filter(s => s !== '');

    let filteredData = data.filter(img => {
        const cat = img.category || '';
        
        if (currentGalleryMode === 'general') {
            // โหมดทั่วไป → ตัด suffix ของ mode อื่นๆ ออก (ไม่โชว์รูป BONUS/REACH/CARD)
            for (const suf of allSuffixes) {
                if (cat.endsWith(suf)) return false;
            }
        } else {
            // โหมดอื่น → โชว์เฉพาะที่ลงท้ายด้วย suffix นี้
            if (!cat.endsWith(currentSuffix)) return false;
        }

        if (filterVal !== 'all') {
            const targetCat = filterVal + currentSuffix; // ใช้ suffix ตาม mode ปัจจุบัน
            if (cat !== targetCat) return false;
        }

        if (searchVal && !img.name.toLowerCase().includes(searchVal)) return false;
        return true;
    });

    currentGalleryData = filteredData;
    if(countSpan) countSpan.innerText = filteredData.length;

    // แสดง badge จำนวนรูปต่อเว็บ
    _renderWebBadges(filteredData);

    if (filteredData.length === 0) {
        const msg = GALLERY_MODE_LABEL[currentGalleryMode] || 'ไม่พบรูปภาพ';
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 pt-20">${msg}</div>`;
        return;
    }

    // Sort
    const sortVal = document.getElementById('gallerySort')?.value || 'newest';
    if (sortVal === 'newest')    filteredData.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sortVal === 'oldest')   filteredData.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sortVal === 'name_asc') filteredData.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    else if (sortVal === 'name_desc')filteredData.sort((a,b) => (b.name||'').localeCompare(a.name||''));

    // Pagination
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

    // Re-render เฉพาะหน้าที่เลือก พร้อม hover date
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

        return getGalleryTpl('tpl-gallery-card', {
            url: img.url, name: img.name,
            newBadge: newBadgeG, adminCheckbox: adminCbG, catBadge: catBadgeG,
            uploadDate, uploadBy,
            lbIndex: realIdx,
            lightboxClick: ''  // ไม่ใช้แล้ว ใช้ data-lb-index แทน
        });
    }).join('');

    updateBulkDeleteButton();
}

window.handleImageUpload = async function(input) {
    const files = input.files;
    let category = document.getElementById('galleryFilter').value;
    if (category === 'all' || !category) category = 'ทั่วไป';
    
    // 🌟 [คลังรูป] เพิ่ม suffix ตาม mode ปัจจุบัน
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
    // 🌟 [คลังรูป] reset filter เป็นค่าก่อน suffix
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
    if (typeof JSZip === 'undefined') return Swal.fire('Error', 'ไม่พบระบบสร้างโฟลเดอร์ กรุณาแจ้งผู้ดูแลระบบ', 'error');

    let categoryName = document.getElementById('galleryFilter').value;
    let folderName = categoryName === 'all' ? 'รวมรูปภาพทั้งหมด' : categoryName;
    
    // 🌟 [คลังรูป] เพิ่ม suffix ของ mode ในชื่อ folder zip
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
// 📋 ฟังก์ชันคัดลอกรูปภาพไปยัง Clipboard (แก้บั๊ก JPEG ไม่ให้ก๊อปปี้)
// ==========================================
window.copyImageToClipboard = async function(imageUrl) {
    Swal.fire({
        title: 'กำลังคัดลอกรูปภาพ...',
        text: 'กรุณารอสักครู่ ระบบกำลังแปลงไฟล์ให้รองรับการคัดลอก',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        if (!navigator.clipboard || !window.ClipboardItem) {
            throw new Error("เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพโดยตรง (แนะนำให้ใช้ Chrome หรือ Edge)");
        }

        // 1. สร้าง Image Object เพื่อโหลดรูปมาเตรียมไว้
        const img = new Image();
        img.crossOrigin = "Anonymous"; // ป้องกันปัญหา CORS เวลาดึงรูปจากเซิร์ฟเวอร์อื่น
        img.src = imageUrl;

        // 2. รอให้รูปโหลดเสร็จสมบูรณ์
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("ไม่สามารถโหลดรูปภาพจากเซิร์ฟเวอร์ได้"));
        });

        // 3. สร้าง Canvas จำลองขึ้นมาเพื่อวาดรูป (เทคนิคแปลงไฟล์ภาพ)
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // 4. สั่งให้ Canvas ส่งรูปออกมาเป็นไฟล์สกุล image/png เสมอ!
        canvas.toBlob(async (blob) => {
            try {
                // 5. นำไฟล์ PNG ที่ได้ ยัดลง Clipboard
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                
                Swal.fire({
                    icon: 'success', 
                    title: 'คัดลอกสำเร็จ!', 
                    text: 'นำไปกดวาง (Ctrl+V) ในช่องแชท Line OA ได้เลยครับ', 
                    timer: 2000, 
                    showConfirmButton: false
                });
            } catch (err) {
                console.error('Clipboard write failed:', err);
                Swal.fire('Error', 'ระบบปฏิเสธการคัดลอก: ' + err.message, 'error');
            }
        }, 'image/png'); // บังคับเป็น PNG ให้ Chrome ยอมรับ

    } catch (err) {
        console.error('Copy image failed:', err);
        Swal.fire('Error', 'คัดลอกรูปไม่สำเร็จ: ' + err.message, 'error');
    }
};

// เพิ่มฟังก์ชันนี้เข้าไป
window.filterGalleryImages = function() {
    clearTimeout(window.gallerySearchTimer);
    window.gallerySearchTimer = setTimeout(() => {
        // ให้ฟังก์ชันเดิมทำงานโดยไม่ต้องยิง DB ใหม่ถ้ามี currentGalleryData แล้ว
        fetchGalleryImages(true); 
    }, 300); // หน่วง 0.3 วินาที
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

    // วันที่อัปโหลด
    const dateEl = document.getElementById('lightboxDate');
    if (dateEl && img.created_at) {
        const d = new Date(img.created_at);
        dateEl.textContent = `📅 ${d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}`;
    }

    // ปุ่มแก้ชื่อ — เฉพาะ admin
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

// Copy URL
window._copyLightboxUrl = function() {
    const img = _lbData[_lbIndex];
    if (!img) return;
    navigator.clipboard.writeText(img.url).then(() => {
        Swal.fire({ icon: 'success', title: 'Copy URL แล้ว!', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
    });
};

// แก้ชื่อรูป
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
        fetchGalleryImages(); // refresh grid
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
        // สร้าง input จำลอง
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
