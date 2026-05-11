// ====================================================
// 🎨 เครื่องมือแต่งรูป: ลบโลโก้เดิม → ใส่โลโก้ใหม่
// ====================================================

window.leState = {
    canvas: null,
    ctx: null,
    baseImage: null,          // รูปต้นฉบับ (HTMLImageElement)
    newLogo: null,            // โลโก้ใหม่ (HTMLImageElement)
    history: [],              // เก็บ ImageData ก่อนทำ erase (undo)
    tool: 'erase',
    isDrawingSelection: false,
    selStart: null,
    selBox: null,             // {x,y,w,h} ในพิกัด canvas
    canvasScale: 1,           // อัตราย่อ canvas เพื่อให้พอดีจอ
    logoOverlay: { x: 50, y: 50, w: 120, h: 120, opacity: 1 }
};

// ==========================================
// 🚀 เริ่มต้นเมื่อเข้าหน้า
// ==========================================
window.initLogoEditorApp = function() {
    const cvs = document.getElementById('leCanvas');
    if (!cvs) return;
    window.leState.canvas = cvs;
    window.leState.ctx = cvs.getContext('2d');

    // 🌟 [สิทธิ์] ซ่อนปุ่มที่ไม่มีสิทธิ์ — admin/manager เห็นทุกปุ่ม
    const isAdminOrMgr = (currentUser.role === 'admin' || currentUser.role === 'manager');
    const can = (perm) => isAdminOrMgr || (typeof window.hasUserPerm === 'function' && window.hasUserPerm(perm));
    window.leCanErase    = can('logo_editor_erase');
    window.leCanAddLogo  = can('logo_editor_add_logo');
    window.leCanDownload = can('logo_editor_download');

    // ซ่อน section ที่ไม่มีสิทธิ์
    const eraseSection    = document.getElementById('leEraseSection');
    const addLogoSection  = document.getElementById('leAddLogoSection');
    const downloadBtn     = document.getElementById('leDownloadBtn');
    if (eraseSection)   eraseSection.style.display    = window.leCanErase    ? '' : 'none';
    if (addLogoSection) addLogoSection.style.display  = window.leCanAddLogo  ? '' : 'none';
    if (downloadBtn)    downloadBtn.style.display     = window.leCanDownload ? '' : 'none';

    leSetupCanvasEvents();
    leSetupLogoOverlayEvents();
    leSetupDragDropFile();
};

// ==========================================
// 📥 โหลดรูปต้นฉบับ
// ==========================================
window.leLoadBaseImage = function(event) {
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.leState.baseImage = img;
            window.leState.history = [];
            window.leState.newLogo = null;
            window.leState.selBox = null;
            leRenderBase();
            leRemoveLogo();
            document.getElementById('leEmptyState').classList.add('hidden');
            document.getElementById('leCanvasWrapper').classList.remove('hidden');
        };
        img.onerror = () => Swal.fire('Error', 'โหลดรูปไม่ได้', 'error');
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    if (event.target && event.target.value !== undefined) event.target.value = '';
};

function leRenderBase() {
    const s = window.leState;
    if (!s.baseImage) return;
    
    s.canvas.width = s.baseImage.width;
    s.canvas.height = s.baseImage.height;
    s.ctx.drawImage(s.baseImage, 0, 0);
    
    // ย่อให้พอดีจอ (ผ่าน CSS) — แต่ canvas resolution ยังเป็น original
    leFitCanvasToScreen();
}

function leFitCanvasToScreen() {
    const s = window.leState;
    const wrapper = document.getElementById('leCanvasWrapper');
    const area = document.getElementById('leCanvasArea');
    if (!wrapper || !area || !s.baseImage) return;
    
    const maxW = area.clientWidth - 32;
    const maxH = area.clientHeight - 32;
    const imgW = s.canvas.width;
    const imgH = s.canvas.height;
    
    let scale = Math.min(maxW / imgW, maxH / imgH, 1);
    s.canvasScale = scale;
    
    wrapper.style.width = (imgW * scale) + 'px';
    wrapper.style.height = (imgH * scale) + 'px';
    s.canvas.style.width = (imgW * scale) + 'px';
    s.canvas.style.height = (imgH * scale) + 'px';
}
window.addEventListener('resize', () => { if (window.leState && window.leState.baseImage) leFitCanvasToScreen(); });

// ==========================================
// 🖼️ Drag & Drop ไฟล์รูปลง canvas
// ==========================================
function leSetupDragDropFile() {
    const area = document.getElementById('leCanvasArea');
    if (!area) return;
    
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('ring-4', 'ring-fuchsia-400'); });
    area.addEventListener('dragleave', (e) => { area.classList.remove('ring-4', 'ring-fuchsia-400'); });
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('ring-4', 'ring-fuchsia-400');
        if (e.dataTransfer.files.length > 0) {
            leLoadBaseImage(e.dataTransfer.files[0]);
        }
    });
}

// ==========================================
// ✂️ เครื่องมือเลือกพื้นที่ลบโลโก้
// ==========================================
window.leSetTool = function(tool) {
    window.leState.tool = tool;
    const btn = document.getElementById('leToolEraseBtn');
    if (btn) {
        if (tool === 'erase') {
            btn.classList.remove('bg-slate-100', 'dark:bg-slate-700');
            btn.classList.add('bg-rose-500', 'text-white');
        } else {
            btn.classList.add('bg-slate-100', 'dark:bg-slate-700');
            btn.classList.remove('bg-rose-500', 'text-white');
        }
    }
};

function leSetupCanvasEvents() {
    const cvs = window.leState.canvas;
    const box = document.getElementById('leSelectionBox');
    
    const getCanvasCoords = (e) => {
        const rect = cvs.getBoundingClientRect();
        const scale = window.leState.canvasScale || 1;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale,
            screenX: clientX - rect.left,
            screenY: clientY - rect.top
        };
    };
    
    const startSel = (e) => {
        if (window.leState.tool !== 'erase' || !window.leState.baseImage) return;
        e.preventDefault();
        const p = getCanvasCoords(e);
        window.leState.isDrawingSelection = true;
        window.leState.selStart = p;
        box.style.left = p.screenX + 'px';
        box.style.top = p.screenY + 'px';
        box.style.width = '0px';
        box.style.height = '0px';
        box.classList.remove('hidden');
    };
    
    const moveSel = (e) => {
        if (!window.leState.isDrawingSelection) return;
        e.preventDefault();
        const p = getCanvasCoords(e);
        const sx = Math.min(window.leState.selStart.screenX, p.screenX);
        const sy = Math.min(window.leState.selStart.screenY, p.screenY);
        const sw = Math.abs(p.screenX - window.leState.selStart.screenX);
        const sh = Math.abs(p.screenY - window.leState.selStart.screenY);
        box.style.left = sx + 'px';
        box.style.top = sy + 'px';
        box.style.width = sw + 'px';
        box.style.height = sh + 'px';
        
        // เก็บใน canvas coords
        const scale = window.leState.canvasScale || 1;
        window.leState.selBox = {
            x: sx / scale,
            y: sy / scale,
            w: sw / scale,
            h: sh / scale
        };
    };
    
    const endSel = (e) => {
        if (!window.leState.isDrawingSelection) return;
        window.leState.isDrawingSelection = false;
    };
    
    cvs.addEventListener('mousedown', startSel);
    cvs.addEventListener('mousemove', moveSel);
    window.addEventListener('mouseup', endSel);
    cvs.addEventListener('touchstart', startSel, {passive: false});
    cvs.addEventListener('touchmove', moveSel, {passive: false});
    window.addEventListener('touchend', endSel);
}

// ==========================================
// 🩹 เติมพื้นที่ที่เลือก (ลบโลโก้)
// ==========================================
window.leApplyErase = function() {
    if (window.leCanErase === false) {
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ลบโลโก้เดิม', 'warning');
    }
    const s = window.leState;
    if (!s.selBox || s.selBox.w < 4 || s.selBox.h < 4) {
        return Swal.fire('!', 'ลากกรอบทับโลโก้ก่อน แล้วค่อยกดเติมพื้นที่', 'warning');
    }
    
    // เก็บ history ก่อนแก้
    s.history.push(s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height));
    if (s.history.length > 20) s.history.shift();
    
    const mode = document.getElementById('leFillMode').value;
    const color = document.getElementById('leFillColor').value;
    const box = s.selBox;
    
    if (mode === 'solid') {
        s.ctx.fillStyle = color;
        s.ctx.fillRect(box.x, box.y, box.w, box.h);
    } else if (mode === 'blur') {
        leApplyBlurFill(box);
    } else {
        // auto: เดาสีจาก sample ขอบรอบๆ แล้วเติม + เบลอเล็กน้อยกลืน
        leApplyAutoFill(box);
    }
    
    // ซ่อนกรอบ
    document.getElementById('leSelectionBox').classList.add('hidden');
    s.selBox = null;
};

// เติมสีโดยเดาจากขอบ
function leApplyAutoFill(box) {
    const s = window.leState;
    const ctx = s.ctx;
    
    // สุ่ม sample จาก 4 ขอบของกรอบ (นอกกรอบ 5px)
    const samples = [];
    const pad = 5;
    const sampleEdge = (sx, sy, w, h) => {
        try {
            const d = ctx.getImageData(Math.max(0, sx), Math.max(0, sy), Math.min(w, s.canvas.width - sx), Math.min(h, s.canvas.height - sy));
            for (let i = 0; i < d.data.length; i += 16) {
                samples.push([d.data[i], d.data[i+1], d.data[i+2]]);
            }
        } catch(e) {}
    };
    
    sampleEdge(box.x - pad, box.y - pad, box.w + pad*2, pad); // top
    sampleEdge(box.x - pad, box.y + box.h, box.w + pad*2, pad); // bottom
    sampleEdge(box.x - pad, box.y, pad, box.h); // left
    sampleEdge(box.x + box.w, box.y, pad, box.h); // right
    
    if (samples.length === 0) {
        ctx.fillStyle = '#ffffff';
    } else {
        // เฉลี่ยสี
        let r = 0, g = 0, b = 0;
        samples.forEach(s => { r += s[0]; g += s[1]; b += s[2]; });
        r = Math.round(r / samples.length);
        g = Math.round(g / samples.length);
        b = Math.round(b / samples.length);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
    }
    ctx.fillRect(box.x, box.y, box.w, box.h);
    
    // เพิ่ม noise เล็กน้อยกลืน
    try {
        const imgData = ctx.getImageData(box.x, box.y, box.w, box.h);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const n = (Math.random() - 0.5) * 12;
            imgData.data[i]   = Math.max(0, Math.min(255, imgData.data[i] + n));
            imgData.data[i+1] = Math.max(0, Math.min(255, imgData.data[i+1] + n));
            imgData.data[i+2] = Math.max(0, Math.min(255, imgData.data[i+2] + n));
        }
        ctx.putImageData(imgData, box.x, box.y);
    } catch(e) {}
}

// เติมแบบ blur สีรอบๆ
function leApplyBlurFill(box) {
    const s = window.leState;
    const ctx = s.ctx;
    // วิธีง่ายๆ: เอาส่วนที่ใหญ่กว่า → ย่อ → ขยายกลับ (กลืน)
    const pad = Math.max(20, Math.floor(Math.max(box.w, box.h) * 0.3));
    const sx = Math.max(0, box.x - pad);
    const sy = Math.max(0, box.y - pad);
    const sw = Math.min(s.canvas.width - sx, box.w + pad*2);
    const sh = Math.min(s.canvas.height - sy, box.h + pad*2);
    
    // ก่อนอื่น เติมสี auto ก่อน เพื่อกลบโลโก้
    leApplyAutoFill(box);
    
    // เบลอเพิ่มอีกขั้นด้วยการสุ่มเฉลี่ย
    try {
        const imgData = ctx.getImageData(box.x, box.y, box.w, box.h);
        const blurred = leBoxBlur(imgData, 3);
        ctx.putImageData(blurred, box.x, box.y);
    } catch(e) {}
}

// Box blur แบบง่ายๆ
function leBoxBlur(imgData, radius) {
    const w = imgData.width, h = imgData.height;
    const src = imgData.data;
    const out = new Uint8ClampedArray(src.length);
    const r = radius;
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let cr = 0, cg = 0, cb = 0, ca = 0, count = 0;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    const idx = (ny * w + nx) * 4;
                    cr += src[idx];
                    cg += src[idx+1];
                    cb += src[idx+2];
                    ca += src[idx+3];
                    count++;
                }
            }
            const idx = (y * w + x) * 4;
            out[idx]   = cr / count;
            out[idx+1] = cg / count;
            out[idx+2] = cb / count;
            out[idx+3] = ca / count;
        }
    }
    return new ImageData(out, w, h);
}

// ==========================================
// 🏷️ ใส่โลโก้ใหม่
// ==========================================
window.leLoadNewLogo = function(event) {
    if (window.leCanAddLogo === false) {
        if (event.target) event.target.value = '';
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใส่โลโก้ใหม่', 'warning');
    }
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    if (!window.leState.baseImage) {
        Swal.fire('!', 'กรุณาเลือกรูปต้นฉบับก่อน', 'warning');
        if (event.target) event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.leState.newLogo = img;
            
            // ตั้งขนาดเริ่มต้น (15% ของความกว้างรูปต้นฉบับ)
            const baseW = window.leState.baseImage.width;
            const w0 = baseW * 0.15;
            const ratio = img.height / img.width;
            window.leState.logoOverlay = {
                x: baseW * 0.05,
                y: window.leState.baseImage.height * 0.05,
                w: w0,
                h: w0 * ratio,
                opacity: 1
            };
            
            document.getElementById('leLogoImg').src = e.target.result;
            document.getElementById('leLogoOverlay').classList.remove('hidden');
            document.getElementById('leLogoControls').classList.remove('hidden');
            document.getElementById('leLogoSize').value = 100;
            document.getElementById('leLogoOpacity').value = 100;
            leUpdateLogoOverlayPosition();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
};

function leUpdateLogoOverlayPosition() {
    const s = window.leState;
    const overlay = document.getElementById('leLogoOverlay');
    const img = document.getElementById('leLogoImg');
    const scale = s.canvasScale || 1;
    
    overlay.style.left = (s.logoOverlay.x * scale) + 'px';
    overlay.style.top = (s.logoOverlay.y * scale) + 'px';
    img.style.width = (s.logoOverlay.w * scale) + 'px';
    img.style.height = (s.logoOverlay.h * scale) + 'px';
    img.style.opacity = s.logoOverlay.opacity;
}

window.leUpdateLogoSize = function() {
    const val = parseInt(document.getElementById('leLogoSize').value);
    document.getElementById('leLogoSizeLabel').innerText = val + '%';
    if (!window.leState.newLogo) return;
    
    const baseW = window.leState.baseImage.width;
    const newW = baseW * 0.15 * (val / 100);
    const ratio = window.leState.newLogo.height / window.leState.newLogo.width;
    window.leState.logoOverlay.w = newW;
    window.leState.logoOverlay.h = newW * ratio;
    leUpdateLogoOverlayPosition();
};

window.leUpdateLogoOpacity = function() {
    const val = parseInt(document.getElementById('leLogoOpacity').value);
    document.getElementById('leLogoOpacityLabel').innerText = val + '%';
    window.leState.logoOverlay.opacity = val / 100;
    leUpdateLogoOverlayPosition();
};

window.leRemoveLogo = function() {
    window.leState.newLogo = null;
    document.getElementById('leLogoOverlay').classList.add('hidden');
    document.getElementById('leLogoControls').classList.add('hidden');
    document.getElementById('leLogoImg').src = '';
};

// Drag overlay
function leSetupLogoOverlayEvents() {
    const overlay = document.getElementById('leLogoOverlay');
    const handle = document.getElementById('leLogoHandle');
    
    let isDragging = false, isResizing = false;
    let dragStart = null;
    
    const onDown = (e) => {
        if (e.target === handle) {
            isResizing = true;
        } else {
            isDragging = true;
        }
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        dragStart = { x: cx, y: cy, lo: { ...window.leState.logoOverlay } };
        e.preventDefault();
        e.stopPropagation();
    };
    
    const onMove = (e) => {
        if (!isDragging && !isResizing) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = cx - dragStart.x;
        const dy = cy - dragStart.y;
        const scale = window.leState.canvasScale || 1;
        
        if (isDragging) {
            window.leState.logoOverlay.x = dragStart.lo.x + dx / scale;
            window.leState.logoOverlay.y = dragStart.lo.y + dy / scale;
        } else if (isResizing) {
            const ratio = window.leState.newLogo ? window.leState.newLogo.height / window.leState.newLogo.width : 1;
            const newW = Math.max(10, dragStart.lo.w + dx / scale);
            window.leState.logoOverlay.w = newW;
            window.leState.logoOverlay.h = newW * ratio;
            // sync size slider
            const baseW = window.leState.baseImage.width;
            const pct = Math.round(newW / (baseW * 0.15) * 100);
            document.getElementById('leLogoSize').value = Math.min(300, Math.max(10, pct));
            document.getElementById('leLogoSizeLabel').innerText = Math.min(300, Math.max(10, pct)) + '%';
        }
        
        leUpdateLogoOverlayPosition();
        e.preventDefault();
    };
    
    const onUp = () => { isDragging = false; isResizing = false; };
    
    overlay.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    overlay.addEventListener('touchstart', onDown, {passive: false});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onUp);
}

// ==========================================
// ⏪ Undo + Reset
// ==========================================
window.leUndoLast = function() {
    const s = window.leState;
    if (s.history.length === 0) {
        return Swal.fire('!', 'ไม่มีขั้นตอนให้ย้อนกลับ', 'info');
    }
    const last = s.history.pop();
    s.ctx.putImageData(last, 0, 0);
};

window.leResetAll = async function() {
    const ok = await Swal.fire({
        title: 'เริ่มใหม่ทั้งหมด?',
        text: 'การแก้ไขทั้งหมดจะหายไป',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'ใช่', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
    });
    if (!ok.isConfirmed) return;
    
    const s = window.leState;
    if (s.baseImage) {
        s.history = [];
        leRenderBase();
    }
    leRemoveLogo();
    document.getElementById('leSelectionBox').classList.add('hidden');
    s.selBox = null;
};

// ==========================================
// 💾 ดาวน์โหลด — รวม base canvas + โลโก้ใหม่ลงไฟล์เดียว
// ==========================================
window.leDownload = function() {
    if (window.leCanDownload === false) {
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ดาวน์โหลดรูป', 'warning');
    }
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    
    // สร้าง canvas ใหม่สำหรับ output (เพื่อไม่เขียนทับ canvas หลัก)
    const out = document.createElement('canvas');
    out.width = s.canvas.width;
    out.height = s.canvas.height;
    const octx = out.getContext('2d');
    octx.drawImage(s.canvas, 0, 0);
    
    // วาดโลโก้ใหม่ทับ (ถ้ามี)
    if (s.newLogo) {
        octx.globalAlpha = s.logoOverlay.opacity;
        octx.drawImage(s.newLogo, s.logoOverlay.x, s.logoOverlay.y, s.logoOverlay.w, s.logoOverlay.h);
        octx.globalAlpha = 1;
    }
    
    out.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดแล้ว', timer: 1200, showConfirmButton: false });
    }, 'image/png');
};
