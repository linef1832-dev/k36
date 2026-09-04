// ════════════════════════════════════════════════════════════════════
// 📦 gallery/ui.js — ส่วนที่ 2/2 ของคลังรูป (แยกจาก gallery.js เดิม 823 บรรทัด)
// เนื้อหา: คัดลอกรูป, Lightbox, ลากวางอัปโหลด, badge, แก้ชื่อ, context menu, skeleton
// ⚠️ ลำดับโหลด: gallery/core → gallery/ui (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
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
        // ⚡ เร่งความเร็ว: ดึงผ่าน fetch + force-cache → รูปที่แสดงบนหน้าอยู่แล้วไม่ต้องโหลดใหม่จากเซิร์ฟเวอร์
        // (วิธีเดิมใช้ new Image + crossOrigin ซึ่งแคชคนละช่องกับรูปบนหน้า เลยโหลดซ้ำเต็ม ๆ ทุกครั้ง = ช้า)
        let img;
        try {
            const resp = await fetch(imageUrl, { cache: 'force-cache' });
            if (!resp.ok) throw new Error('fetch failed');
            const srcBlob = await resp.blob();
            img = await createImageBitmap(srcBlob);
        } catch (fetchErr) {
            // fallback วิธีเดิม เผื่อเบราว์เซอร์เก่า/ติด CORS
            img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = imageUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error("ไม่สามารถโหลดรูปภาพจากเซิร์ฟเวอร์ได้"));
            });
        }
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
                // Ripple effect บน card ที่ copy
                _galleryRipple(imageUrl);
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
                    timer: 1500,
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
        html: `
            <div style="padding:8px 4px 4px">
                <div style="width:48px;height:48px;margin:0 auto 14px;background:rgba(251,191,36,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(251,191,36,0.3)">
                    <span class="material-icons" style="color:#fbbf24;font-size:22px">edit</span>
                </div>
                <div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:14px">แก้ชื่อรูป</div>
                <input id="_renameInput" type="text" maxlength="100" placeholder="ชื่อรูปใหม่..."
                    style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:14px;font-weight:600;outline:none;transition:border 0.2s"
                    onfocus="this.style.borderColor='rgba(251,191,36,0.6)'"
                    onblur="this.style.borderColor='rgba(255,255,255,0.12)'"
                >
            </div>
        `,
        background: '#0f172a',
        backdrop: 'rgba(0,0,0,0.7)',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#374151',
        customClass: {
            popup: 'rounded-2xl border border-amber-900/40',
            confirmButton: 'rounded-xl font-bold px-5',
            cancelButton: 'rounded-xl font-bold px-5'
        },
        didOpen: () => {
            const inp = document.getElementById('_renameInput');
            if (inp) { inp.value = (typeof img !== 'undefined' ? (img.name||'') : (currentName||'')); inp.focus(); inp.select(); }
        },
        preConfirm: () => {
            const val = document.getElementById('_renameInput')?.value?.trim();
            if (!val) { Swal.showValidationMessage('กรุณากรอกชื่อ'); return false; }
            return val;
        }
    });
    if (!newName || newName.trim() === img.name) return;
    try {
        const { error } = await appDB.from('image_gallery').update({ name: newName.trim() }).eq('id', img.id);
        if (error) throw error;
        img.name = newName.trim();
        document.getElementById('lightboxName').textContent = img.name;
        Swal.fire({
            html: `<div style="display:flex;align-items:center;gap:10px;padding:4px 2px">
                <div style="width:28px;height:28px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style="font-size:13px;font-weight:700;color:#fff">แก้ชื่อสำเร็จ!</span>
            </div>`,
            background: '#0f172a', toast: true, position: 'top-end',
            timer: 1500, showConfirmButton: false,
            customClass: { popup: 'rounded-xl border border-green-900/50 shadow-xl' }
        });
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
        html: `
            <div style="padding:8px 4px 4px">
                <div style="width:48px;height:48px;margin:0 auto 14px;background:rgba(251,191,36,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(251,191,36,0.3)">
                    <span class="material-icons" style="color:#fbbf24;font-size:22px">edit</span>
                </div>
                <div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:14px">แก้ชื่อรูป</div>
                <input id="_renameInput" type="text" maxlength="100" placeholder="ชื่อรูปใหม่..."
                    style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-size:14px;font-weight:600;outline:none;transition:border 0.2s"
                    onfocus="this.style.borderColor='rgba(251,191,36,0.6)'"
                    onblur="this.style.borderColor='rgba(255,255,255,0.12)'"
                >
            </div>
        `,
        background: '#0f172a',
        backdrop: 'rgba(0,0,0,0.7)',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#d97706',
        cancelButtonColor: '#374151',
        customClass: {
            popup: 'rounded-2xl border border-amber-900/40',
            confirmButton: 'rounded-xl font-bold px-5',
            cancelButton: 'rounded-xl font-bold px-5'
        },
        didOpen: () => {
            const inp = document.getElementById('_renameInput');
            if (inp) { inp.value = (typeof img !== 'undefined' ? (img.name||'') : (currentName||'')); inp.focus(); inp.select(); }
        },
        preConfirm: () => {
            const val = document.getElementById('_renameInput')?.value?.trim();
            if (!val) { Swal.showValidationMessage('กรุณากรอกชื่อ'); return false; }
            return val;
        }
    });
    if (!newName || newName.trim() === currentName) return;
    try {
        const { error } = await appDB.from('image_gallery').update({ name: newName.trim() }).eq('id', imgId);
        if (error) throw error;
        const idx = currentGalleryData.findIndex(d => String(d.id) === String(imgId));
        if (idx !== -1) currentGalleryData[idx].name = newName.trim();
        Swal.fire({
            html: `<div style="display:flex;align-items:center;gap:10px;padding:4px 2px">
                <div style="width:28px;height:28px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style="font-size:13px;font-weight:700;color:#fff">แก้ชื่อสำเร็จ!</span>
            </div>`,
            background: '#0f172a', toast: true, position: 'top-end',
            timer: 1500, showConfirmButton: false,
            customClass: { popup: 'rounded-xl border border-green-900/50 shadow-xl' }
        });
        fetchGalleryImages();
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// ✨ Ripple Effect บน card ที่เพิ่งคัดลอก
// ==========================================
function _galleryRipple(imageUrl) {
    // หา card ที่มี url นี้
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    const cards = grid.querySelectorAll('[data-lb-index]');
    cards.forEach(card => {
        const btn = card.closest('.bg-slate-800');
        if (!btn) return;
        const img = btn.querySelector('img');
        if (!img || !img.src.includes(imageUrl.split('/').pop())) return;

        // สร้าง ripple overlay
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:40;
            background:radial-gradient(circle at center,rgba(34,197,94,0.35),rgba(34,197,94,0.08) 60%,transparent 80%);
            animation:_gRipple 0.7s ease-out forwards;
        `;
        btn.style.position = 'relative';
        btn.appendChild(ripple);

        // badge "✓ คัดลอกแล้ว"
        const badge = document.createElement('div');
        badge.style.cssText = `
            position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
            background:rgba(34,197,94,0.95);color:#fff;font-size:12px;font-weight:800;
            padding:6px 14px;border-radius:20px;z-index:41;pointer-events:none;
            box-shadow:0 4px 15px rgba(34,197,94,0.4);
            animation:_gBadge 0.7s ease-out forwards;
        `;
        badge.textContent = '✓ คัดลอกแล้ว';
        btn.appendChild(badge);

        setTimeout(() => { ripple.remove(); badge.remove(); }, 700);
    });
}

// inject keyframes
(function(){
    if (document.getElementById('_galleryStyles')) return;
    const s = document.createElement('style');
    s.id = '_galleryStyles';
    s.textContent = `
        @keyframes _gRipple{0%{opacity:1;transform:scale(0.8)}100%{opacity:0;transform:scale(1.05)}}
        @keyframes _gBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(0.7)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(0.9)}}
        @keyframes _gSkeleton{0%,100%{opacity:0.5}50%{opacity:1}}
        ._gallery-ctx-menu{position:fixed;z-index:9999;background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:4px;box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05);min-width:180px;animation:_gBadge2 0.15s ease-out}
        @keyframes _gBadge2{from{opacity:0;transform:scale(0.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
        ._gallery-ctx-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#e2e8f0;transition:background 0.15s}
        ._gallery-ctx-item:hover{background:rgba(255,255,255,0.08)}
        ._gallery-ctx-item .material-icons{font-size:16px;opacity:0.7}
        ._gallery-ctx-sep{height:1px;background:rgba(255,255,255,0.07);margin:3px 0}
    `;
    document.head.appendChild(s);
})();

// ==========================================
// 🖱️ Right-click Context Menu
// ==========================================
(function setupGalleryContextMenu(){
    let _ctxMenu = null;
    function removeCtx(){ if(_ctxMenu){ _ctxMenu.remove(); _ctxMenu=null; } }
    document.addEventListener('click', removeCtx);
    document.addEventListener('contextmenu', (e) => {
        removeCtx();
        // หา card ที่ถูก right-click
        const card = e.target.closest('.bg-slate-800');
        if (!card) return;
        const imgEl = card.querySelector('img');
        const nameEl = card.querySelector('.text-white.font-bold.text-xs');
        if (!imgEl) return;

        e.preventDefault();
        const url  = imgEl.src;
        const name = nameEl ? nameEl.textContent.trim() : 'image';

        const menu = document.createElement('div');
        menu.className = '_gallery-ctx-menu';
        menu.innerHTML = `
            <div class="_gallery-ctx-item" id="_ctxCopy"><span class="material-icons">content_copy</span> คัดลอกรูป</div>
            <div class="_gallery-ctx-item" id="_ctxDl"><span class="material-icons">download</span> ดาวน์โหลด</div>
            <div class="_gallery-ctx-sep"></div>
            <div class="_gallery-ctx-item" id="_ctxOpen"><span class="material-icons">open_in_new</span> เปิดในแท็บใหม่</div>
            <div class="_gallery-ctx-item" id="_ctxUrl"><span class="material-icons">link</span> Copy URL</div>
        `;

        // วาง menu ให้ไม่เกินขอบหน้าจอ
        const mx = Math.min(e.clientX, window.innerWidth - 200);
        const my = Math.min(e.clientY, window.innerHeight - 180);
        menu.style.left = mx + 'px';
        menu.style.top  = my + 'px';
        document.body.appendChild(menu);
        _ctxMenu = menu;

        menu.querySelector('#_ctxCopy').onclick = (ev) => { ev.stopPropagation(); removeCtx(); copyImageToClipboard(url); };
        menu.querySelector('#_ctxDl').onclick   = (ev) => { ev.stopPropagation(); removeCtx(); downloadGalleryUrl(url, name); };
        menu.querySelector('#_ctxOpen').onclick = (ev) => { ev.stopPropagation(); removeCtx(); window.open(url,'_blank'); };
        menu.querySelector('#_ctxUrl').onclick  = (ev) => {
            ev.stopPropagation(); removeCtx();
            navigator.clipboard.writeText(url).then(() =>
                Swal.fire({ icon:'success', title:'Copy URL แล้ว!', timer:1200, showConfirmButton:false, toast:true, position:'top-end' })
            );
        };
    });
})();

// ==========================================
// 💀 Skeleton loading สำหรับรูปที่ยังโหลดไม่เสร็จ
// ==========================================
(function setupGalleryImageSkeleton(){
    const observer = new MutationObserver(() => {
        document.querySelectorAll('#galleryGrid img:not([data-sk])').forEach(img => {
            img.setAttribute('data-sk','1');
            const wrap = img.parentElement;
            if (!wrap) return;
            // ใส่ skeleton พื้นหลังก่อนโหลด
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.4s ease';
            wrap.style.background = 'linear-gradient(90deg,#1e293b 25%,#273449 50%,#1e293b 75%)';
            wrap.style.backgroundSize = '200% 100%';
            wrap.style.animation = '_gSkeleton 1.5s ease-in-out infinite';
            img.onload = () => {
                img.style.opacity = '1';
                wrap.style.background = '';
                wrap.style.animation = '';
            };
        });
    });
    const grid = document.getElementById('galleryGrid');
    if (grid) observer.observe(grid, { childList: true, subtree: true });
})();
