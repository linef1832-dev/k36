// ════════════════════════════════════════════════════════════════════
// 📦 logo_editor/extras.js — ส่วนที่ 4/4 ของเครื่องมือแต่งรูป (แยกจาก logo_editor.js เดิม 2,191 บรรทัด)
// เนื้อหา: สติกเกอร์/อีโมจิ, ย่อ-ขยายรูป, แยกโลโก้เป็นชิ้น, เทมเพลต, เลเยอร์
// ⚠️ ลำดับโหลด: logo_editor/core → logo_editor/erase → logo_editor/tools → logo_editor/extras
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// 🌟 STICKER / EMOJI
// ==========================================
const LE_EMOJI_CATEGORIES = {
    general: ['🎉','🎊','🔥','💯','⭐','✨','💫','⚡','💥','🎁','🎯','🎪','🎨','🎭','🎬','🎮','🏆','🏅','🥇','🏵️','🎀','🎈','🎂','💝'],
    promo:   ['🆕','🆓','💎','👑','🏷️','🛍️','🛒','💸','💵','💴','💷','💶','🤑','💲','🎟️','🎫','🆙','🔝','📢','📣','📯','🔔','🚨','⚠️'],
    arrows:  ['⬆️','⬇️','⬅️','➡️','↗️','↘️','↙️','↖️','🔼','🔽','◀️','▶️','🔄','🔃','🔁','🔂','↩️','↪️','⤴️','⤵️','➰','➿','➕','➖'],
    status:  ['✅','❌','✔️','❎','☑️','🆗','🆖','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','💚','💛','🧡','❤️','💙','💜','🖤','🤍'],
    money:   ['💰','💴','💵','💶','💷','💸','💳','🪙','🤑','💹','📈','📉','📊','💎','🏦','🪪','🧾','🎰','🎲','🎴','♠️','♥️','♦️','♣️']
};

function leRenderEmojiPickers() {
    Object.entries(LE_EMOJI_CATEGORIES).forEach(([cat, emojis]) => {
        const containerId = 'leEmoji' + cat.charAt(0).toUpperCase() + cat.slice(1);
        const container = document.getElementById(containerId);
        if (!container || container._rendered) return;
        container._rendered = true;
        container.innerHTML = emojis.map(e => `
            <button onclick="leAddSticker('${e}')" class="le-shape-btn rounded p-1.5 text-xl hover:scale-110 transition" title="${e}">${e}</button>
        `).join('');
    });
}

window.leAddSticker = function(emoji) {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'กรุณาเลือกรูปก่อน', 'warning');
    
    const size = Math.min(s.canvas.width, s.canvas.height) * 0.1;
    const obj = {
        id: 'st_' + Date.now(),
        emoji,
        x: s.canvas.width / 2,
        y: s.canvas.height / 2,
        size
    };
    s.stickerObjects.push(obj);
    leRenderAllStickers();
    leUpdateStickerList();
    leShowTip('🌟 วางสติกเกอร์แล้ว — ลากย้ายตำแหน่งได้', 2500);
};

function leRenderAllStickers() {
    const container = document.getElementById('leTextOverlayContainer');
    if (!container) return;
    container.querySelectorAll('.le-sticker-overlay').forEach(e => e.remove());
    const scale = leTotalScale();
    window.leState.stickerObjects.forEach(obj => {
        if (obj.visible === false) return;
        const div = document.createElement('div');
        div.className = 'le-sticker-overlay le-text-overlay' + (obj.id === window.leState.selectedStickerId ? ' selected' : '');
        div.dataset.id = obj.id;
        div.dataset.type = 'sticker';
        div.style.left = (obj.x * scale) + 'px';
        div.style.top = (obj.y * scale) + 'px';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.fontSize = (obj.size * scale) + 'px';
        div.style.lineHeight = '1';
        div.style.pointerEvents = 'auto';
        div.innerText = obj.emoji;
        container.appendChild(div);
    });
}

function leUpdateStickerList() {
    const wrap = document.getElementById('leStickerList');
    const list = document.getElementById('leStickerItems');
    const count = document.getElementById('leStickerCount');
    if (wrap && list) {
        const items = window.leState.stickerObjects;
        if (items.length === 0) {
            wrap.classList.add('hidden');
        } else {
            wrap.classList.remove('hidden');
            if (count) count.innerText = items.length;
            list.innerHTML = items.map(o => `
                <div class="flex items-center gap-2 bg-yellow-950/30 border border-yellow-900/40 rounded p-1.5">
                    <span class="text-lg">${o.emoji}</span>
                    <div class="flex-1 text-[10px] text-yellow-200">
                        <input type="range" min="20" max="500" value="${o.size}" oninput="leUpdateStickerSize('${o.id}', this.value)" class="w-full le-slider">
                    </div>
                    <button onclick="leDeleteSticker('${o.id}')" class="text-rose-400 hover:bg-rose-500/20 p-0.5 rounded">
                        <span class="material-icons text-xs">close</span>
                    </button>
                </div>
            `).join('');
        }
    }
    if (typeof leLayerRefresh === 'function') leLayerRefresh();
}

window.leUpdateStickerSize = function(id, val) {
    const obj = window.leState.stickerObjects.find(o => o.id === id);
    if (obj) {
        obj.size = parseInt(val);
        leRenderAllStickers();
    }
};

window.leDeleteSticker = function(id) {
    window.leState.stickerObjects = window.leState.stickerObjects.filter(o => o.id !== id);
    leRenderAllStickers();
    leUpdateStickerList();
};

function leClearAllStickers() {
    window.leState.stickerObjects = [];
    leRenderAllStickers();
    leUpdateStickerList();
}

// แก้ text drag handler ให้รองรับ sticker ด้วย
function leSetupStickerDragging() {
    // sticker ใช้ container เดียวกับ text — drag handler เดิมรองรับเฉพาะ text 
    // เราจะเพิ่ม handler ที่เช็ค dataset.type
    const container = document.getElementById('leTextOverlayContainer');
    if (!container || container._stickerSetup) return;
    container._stickerSetup = true;
    
    let dragId = null, dragType = null, dragStart = null, startPos = null;
    
    const onDown = (e) => {
        const el = e.target.closest('.le-text-overlay');
        if (!el) return;
        dragId = el.dataset.id;
        dragType = el.dataset.type === 'sticker' ? 'sticker' : 'text';
        
        let obj;
        if (dragType === 'sticker') {
            obj = window.leState.stickerObjects.find(o => o.id === dragId);
            window.leState.selectedStickerId = dragId;
        } else {
            obj = window.leState.textObjects.find(o => o.id === dragId);
            window.leState.selectedTextId = dragId;
        }
        if (!obj) return;
        
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        dragStart = { x: cx, y: cy };
        startPos = { x: obj.x, y: obj.y };
        
        if (dragType === 'sticker') leRenderAllStickers();
        else leRenderAllTextOverlays();
        e.preventDefault();
        e.stopPropagation();
    };
    const onMove = (e) => {
        if (!dragId) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const scale = leTotalScale();
        let obj;
        if (dragType === 'sticker') obj = window.leState.stickerObjects.find(o => o.id === dragId);
        else obj = window.leState.textObjects.find(o => o.id === dragId);
        if (!obj) return;
        obj.x = startPos.x + (cx - dragStart.x) / scale;
        obj.y = startPos.y + (cy - dragStart.y) / scale;
        if (dragType === 'sticker') leRenderAllStickers();
        else leRenderAllTextOverlays();
        e.preventDefault();
    };
    const onUp = () => { dragId = null; dragType = null; };
    
    container.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('touchstart', onDown, {passive: false});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onUp);
}

// ==========================================
// 🔍 RESIZE IMAGE
// ==========================================
function leUpdateResizeInfo() {
    const s = window.leState;
    const current = document.getElementById('leCurrentSize');
    if (current && s.canvas) {
        current.innerText = `${s.canvas.width} × ${s.canvas.height} px`;
    }
    leUpdateResizePreview();
}

window.leSetResizePercent = function(pct) {
    document.getElementById('leResizePercent').value = pct;
    leUpdateResizePreview();
};

window.leUpdateResizePreview = function() {
    const s = window.leState;
    const pct = parseInt(document.getElementById('leResizePercent')?.value || 100);
    const label = document.getElementById('leResizePercentLabel');
    const newSize = document.getElementById('leNewSize');
    if (label) label.innerText = pct + '%';
    if (newSize && s.canvas) {
        const nw = Math.round(s.canvas.width * pct / 100);
        const nh = Math.round(s.canvas.height * pct / 100);
        newSize.innerText = `${nw} × ${nh} px`;
    }
};

window.leApplyResize = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    const pct = parseInt(document.getElementById('leResizePercent')?.value || 100);
    if (pct === 100) return Swal.fire('!', 'ขนาดเท่าเดิม ไม่ต้องปรับ', 'info');
    
    const newW = Math.round(s.canvas.width * pct / 100);
    const newH = Math.round(s.canvas.height * pct / 100);
    
    if (newW > 8000 || newH > 8000) {
        return Swal.fire('!', 'ขนาดใหญ่เกินไป (max 8000px)', 'warning');
    }
    
    leSaveHistory();
    
    const smooth = document.getElementById('leSmoothResize')?.checked !== false;
    const tmp = document.createElement('canvas');
    tmp.width = newW;
    tmp.height = newH;
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = smooth;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(s.canvas, 0, 0, newW, newH);
    
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.canvas.width = newW;
        s.canvas.height = newH;
        s.ctx.drawImage(newImg, 0, 0);
        leFitScreen();
        leUpdateResizeInfo();
        Swal.fire({ icon: 'success', title: `ปรับขนาดเป็น ${newW}×${newH}`, timer: 1200, showConfirmButton: false });
    };
    newImg.src = tmp.toDataURL('image/png');
};

// ==========================================
// 🎨 LOGO SPLITTER — แยกโลโก้เป็นชิ้น แก้ไขทีละชิ้น
// ==========================================



// ==========================================
// Algorithm หลัก: flood-fill แยกชิ้น
// ==========================================

// ==========================================
// วาดทุก part ลง canvas
// ==========================================


// ==========================================
// UI: รายการ parts
// ==========================================








// คลิกที่ canvas → เลือกชิ้น (ใช้เฉพาะแท็บ split)

// ==========================================
// Drag/Move ชิ้นที่เลือก
// ==========================================



// ==========================================
// Finalize — รวมทุก part เป็นรูปเดียว ออกจาก split mode
// ==========================================


window._leAiBgModule = null;







// ==========================================
// 📦 TEMPLATE SYSTEM
// ==========================================

// ==========================================
// 📎 LAYER SYSTEM
// ==========================================
function leGetAllLayers() {
    const s = window.leState;
    const layers = [];
    if (s.baseImage) {
        layers.push({ id: 'base', type: 'base', name: 'รูปต้นฉบับ', icon: 'image', iconColor: 'text-fuchsia-400', visible: true, locked: true });
    }
    s.textObjects.forEach(t => {
        layers.push({ id: t.id, type: 'text', name: t.text.length > 25 ? t.text.substring(0, 25) + '...' : t.text, icon: 'text_fields', iconColor: 'text-cyan-400', visible: t.visible !== false, locked: false });
    });
    s.stickerObjects.forEach(st => {
        layers.push({ id: st.id, type: 'sticker', name: 'สติกเกอร์ ' + st.emoji, icon: 'emoji_emotions', iconColor: 'text-yellow-400', visible: st.visible !== false, locked: false });
    });
    if (s.newLogo) {
        layers.push({ id: 'newlogo', type: 'logo', name: 'โลโก้ใหม่', icon: 'add_photo_alternate', iconColor: 'text-emerald-400', visible: s.logoOverlay.opacity > 0, locked: false });
    }
    return layers;
}

window.leLayerRefresh = function() {
    const container = document.getElementById('leLayerListContainer');
    if (!container) return;
    const layers = leGetAllLayers();
    if (layers.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs"><span class="material-icons text-3xl opacity-50">layers_clear</span><p class="mt-1">ยังไม่มี layer</p></div>`;
        return;
    }
    container.innerHTML = layers.slice().reverse().map((l) => {
        const visIcon = l.visible ? 'visibility' : 'visibility_off';
        const visClass = l.visible ? 'text-emerald-400' : 'text-slate-500';
        return `
        <div class="bg-slate-800/50 hover:bg-slate-800/80 border border-white/10 rounded-lg p-2 flex items-center gap-2 transition">
            <span class="material-icons ${l.iconColor} text-base">${l.icon}</span>
            <div class="flex-1 min-w-0">
                <div class="text-[11px] font-bold text-white truncate">${l.name}</div>
                <div class="text-[9px] text-slate-400">${l.type}${l.locked ? ' • locked' : ''}</div>
            </div>
            <div class="flex gap-0.5">
                <button onclick="leLayerToggleVisibility('${l.id}', '${l.type}')" class="${visClass} hover:bg-white/10 p-1 rounded"><span class="material-icons text-sm">${visIcon}</span></button>
                ${!l.locked ? `
                    <button onclick="leLayerMoveUp('${l.id}', '${l.type}')" class="text-slate-400 hover:bg-white/10 p-1 rounded"><span class="material-icons text-sm">arrow_upward</span></button>
                    <button onclick="leLayerMoveDown('${l.id}', '${l.type}')" class="text-slate-400 hover:bg-white/10 p-1 rounded"><span class="material-icons text-sm">arrow_downward</span></button>
                    <button onclick="leLayerDuplicate('${l.id}', '${l.type}')" class="text-blue-400 hover:bg-blue-500/20 p-1 rounded"><span class="material-icons text-sm">content_copy</span></button>
                    <button onclick="leLayerDelete('${l.id}', '${l.type}')" class="text-rose-400 hover:bg-rose-500/20 p-1 rounded"><span class="material-icons text-sm">delete</span></button>
                ` : `<span class="text-slate-600 p-1"><span class="material-icons text-sm">lock</span></span>`}
            </div>
        </div>`;
    }).join('');
};

window.leLayerToggleVisibility = function(id, type) {
    const s = window.leState;
    if (type === 'text') {
        const obj = s.textObjects.find(o => o.id === id);
        if (obj) obj.visible = obj.visible === false ? true : false;
    } else if (type === 'sticker') {
        const obj = s.stickerObjects.find(o => o.id === id);
        if (obj) obj.visible = obj.visible === false ? true : false;
    } else if (type === 'logo' && id === 'newlogo') {
        s.logoOverlay.opacity = s.logoOverlay.opacity > 0 ? 0 : 1;
        leUpdateLogoOverlayPosition();
    }
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leLayerRefresh();
};

window.leLayerMoveUp = function(id, type) {
    const s = window.leState;
    const arr = type === 'text' ? s.textObjects : (type === 'sticker' ? s.stickerObjects : null);
    if (!arr) return;
    const i = arr.findIndex(o => o.id === id);
    if (i >= 0 && i < arr.length - 1) [arr[i], arr[i+1]] = [arr[i+1], arr[i]];
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leLayerRefresh();
};

window.leLayerMoveDown = function(id, type) {
    const s = window.leState;
    const arr = type === 'text' ? s.textObjects : (type === 'sticker' ? s.stickerObjects : null);
    if (!arr) return;
    const i = arr.findIndex(o => o.id === id);
    if (i > 0) [arr[i], arr[i-1]] = [arr[i-1], arr[i]];
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leLayerRefresh();
};

window.leLayerDuplicate = function(id, type) {
    const s = window.leState;
    if (type === 'text') {
        const obj = s.textObjects.find(o => o.id === id);
        if (obj) s.textObjects.push({ ...obj, id: 't_' + Date.now(), x: obj.x + 30, y: obj.y + 30 });
    } else if (type === 'sticker') {
        const obj = s.stickerObjects.find(o => o.id === id);
        if (obj) s.stickerObjects.push({ ...obj, id: 'st_' + Date.now(), x: obj.x + 30, y: obj.y + 30 });
    }
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateTextList();
    leUpdateStickerList();
    leLayerRefresh();
};

window.leLayerDelete = function(id, type) {
    const s = window.leState;
    if (type === 'text') s.textObjects = s.textObjects.filter(o => o.id !== id);
    else if (type === 'sticker') s.stickerObjects = s.stickerObjects.filter(o => o.id !== id);
    else if (type === 'logo' && id === 'newlogo') leRemoveLogo();
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateTextList();
    leUpdateStickerList();
    leLayerRefresh();
};

window.leLayerClearAll = async function() {
    const ok = await Swal.fire({ title: 'ลบ layer ทั้งหมด?', text: 'ข้อความ/สติกเกอร์/โลโก้ใหม่ จะถูกลบ', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!ok.isConfirmed) return;
    const s = window.leState;
    s.textObjects = [];
    s.stickerObjects = [];
    leRemoveLogo();
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateTextList();
    leUpdateStickerList();
    leLayerRefresh();
};

window.leLayerHideAll = function() {
    const s = window.leState;
    s.textObjects.forEach(o => o.visible = false);
    s.stickerObjects.forEach(o => o.visible = false);
    if (s.newLogo) s.logoOverlay.opacity = 0;
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateLogoOverlayPosition();
    leLayerRefresh();
};

window.leLayerShowAll = function() {
    const s = window.leState;
    s.textObjects.forEach(o => o.visible = true);
    s.stickerObjects.forEach(o => o.visible = true);
    if (s.newLogo && s.logoOverlay.opacity === 0) {
        s.logoOverlay.opacity = 1;
        const slider = document.getElementById('leLogoOpacity');
        if (slider) slider.value = 100;
    }
    leRenderAllTextOverlays();
    leRenderAllStickers();
    leUpdateLogoOverlayPosition();
    leLayerRefresh();
};


window.leDownload = function() {
    if (window.leCanDownload === false) return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ดาวน์โหลดรูป', 'warning');
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    
    const out = document.createElement('canvas');
    out.width = s.canvas.width;
    out.height = s.canvas.height;
    const octx = out.getContext('2d');
    
    // 1. canvas หลัก (มี filter ฝังอยู่ถ้าไม่ได้ commit)
    octx.filter = leGetFilterCss();
    octx.drawImage(s.canvas, 0, 0);
    octx.filter = 'none';
    
    // 2. โลโก้ใหม่
    if (s.newLogo) {
        octx.globalAlpha = s.logoOverlay.opacity;
        octx.drawImage(s.newLogo, s.logoOverlay.x, s.logoOverlay.y, s.logoOverlay.w, s.logoOverlay.h);
        octx.globalAlpha = 1;
    }
    
    // 3. text overlays
    s.textObjects.forEach(obj => {
        if (obj.visible === false) return;
        octx.save();
        octx.font = `${obj.weight} ${obj.fontSize}px ${obj.font}`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        if (obj.shadow) {
            octx.shadowColor = 'rgba(0,0,0,0.7)';
            octx.shadowBlur = 4;
            octx.shadowOffsetX = 3;
            octx.shadowOffsetY = 3;
        }
        if (obj.stroke > 0) {
            octx.strokeStyle = obj.strokeColor;
            octx.lineWidth = obj.stroke;
            octx.lineJoin = 'round';
            octx.strokeText(obj.text, obj.x, obj.y);
        }
        octx.fillStyle = obj.color;
        octx.fillText(obj.text, obj.x, obj.y);
        octx.restore();
    });
    
    // 4. sticker overlays
    s.stickerObjects.forEach(obj => {
        if (obj.visible === false) return;
        octx.save();
        octx.font = `${obj.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText(obj.emoji, obj.x, obj.y);
        octx.restore();
    });
    
    out.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `edited_${Date.now()}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดแล้ว', timer: 1200, showConfirmButton: false });
    }, 'image/png');
};
