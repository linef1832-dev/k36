// ════════════════════════════════════════════════════════════════════
// 📦 logo_editor/tools.js — ส่วนที่ 3/4 ของเครื่องมือแต่งรูป (แยกจาก logo_editor.js เดิม 2,191 บรรทัด)
// เนื้อหา: ใส่ข้อความ, ฟิลเตอร์สี, หมุน/พลิก/ครอป, ลายน้ำ, ประวัติ undo, วาดฟรีมือ
// ⚠️ ลำดับโหลด: logo_editor/core → logo_editor/erase → logo_editor/tools → logo_editor/extras
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// ✨ TEXT — ใส่ข้อความบนรูป
// ==========================================
window.leAddText = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'กรุณาเลือกรูปก่อน', 'warning');
    const text = document.getElementById('leTextInput').value.trim();
    if (!text) return Swal.fire('!', 'กรุณาพิมพ์ข้อความ', 'warning');
    
    const fontSize = parseInt(document.getElementById('leTextSize').value);
    const obj = {
        id: 't_' + Date.now(),
        text,
        x: s.canvas.width / 2,
        y: s.canvas.height / 2,
        fontSize,
        font: document.getElementById('leTextFont').value,
        color: document.getElementById('leTextColor').value,
        weight: document.getElementById('leTextWeight').value,
        stroke: parseInt(document.getElementById('leTextStroke').value),
        strokeColor: document.getElementById('leTextStrokeColor').value,
        shadow: document.getElementById('leTextShadow').checked
    };
    s.textObjects.push(obj);
    leRenderAllTextOverlays();
    leUpdateTextList();
    leShowTip('✏️ ลากย้ายข้อความได้ คลิกในรายการเพื่อแก้ไข', 3000);
};

function leRenderAllTextOverlays() {
    const container = document.getElementById('leTextOverlayContainer');
    if (!container) return;
    container.innerHTML = '';
    container.style.pointerEvents = 'none';
    const scale = leTotalScale();
    window.leState.textObjects.forEach(obj => {
        if (obj.visible === false) return;  // ซ่อนจาก layer panel
        const div = document.createElement('div');
        div.className = 'le-text-overlay' + (obj.id === window.leState.selectedTextId ? ' selected' : '');
        div.dataset.id = obj.id;
        div.style.left = (obj.x * scale) + 'px';
        div.style.top = (obj.y * scale) + 'px';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.color = obj.color;
        div.style.fontFamily = obj.font;
        div.style.fontWeight = obj.weight;
        div.style.fontSize = (obj.fontSize * scale) + 'px';
        div.style.pointerEvents = 'auto';
        if (obj.stroke > 0) {
            div.style.webkitTextStroke = `${obj.stroke * scale}px ${obj.strokeColor}`;
        }
        if (obj.shadow) {
            div.style.textShadow = `${3 * scale}px ${3 * scale}px ${4 * scale}px rgba(0,0,0,0.7)`;
        }
        div.innerText = obj.text;
        container.appendChild(div);
    });
    // re-render stickers ด้วย (เพราะ innerHTML='' ลบ sticker ไปด้วย)
    leRenderAllStickers();
}

function leSetupTextDragging() {
    const container = document.getElementById('leTextOverlayContainer');
    if (!container || container._setup) return;
    container._setup = true;
    let dragId = null, dragStart = null, startPos = null;
    
    const onDown = (e) => {
        const t = e.target.closest('.le-text-overlay');
        if (!t) return;
        dragId = t.dataset.id;
        window.leState.selectedTextId = dragId;
        const obj = window.leState.textObjects.find(o => o.id === dragId);
        if (!obj) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        dragStart = { x: cx, y: cy };
        startPos = { x: obj.x, y: obj.y };
        leRenderAllTextOverlays();
        leUpdateTextList();
        e.preventDefault();
        e.stopPropagation();
    };
    const onMove = (e) => {
        if (!dragId) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const scale = leTotalScale();
        const obj = window.leState.textObjects.find(o => o.id === dragId);
        if (!obj) return;
        obj.x = startPos.x + (cx - dragStart.x) / scale;
        obj.y = startPos.y + (cy - dragStart.y) / scale;
        leRenderAllTextOverlays();
        e.preventDefault();
    };
    const onUp = () => { dragId = null; };
    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('touchstart', onDown, {passive: false});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onUp);
}

function leUpdateTextList() {
    const wrap = document.getElementById('leTextList');
    const list = document.getElementById('leTextItems');
    const count = document.getElementById('leTextCount');
    if (wrap && list) {
        const items = window.leState.textObjects;
        if (items.length === 0) {
            wrap.classList.add('hidden');
        } else {
            wrap.classList.remove('hidden');
            if (count) count.innerText = items.length;
            list.innerHTML = items.map(o => `
                <div class="flex items-center gap-1 bg-cyan-950/30 border border-cyan-900/40 rounded p-1.5 hover:bg-cyan-950/50 transition">
                    <span class="material-icons text-xs text-cyan-400">text_fields</span>
                    <span class="flex-1 text-[11px] text-cyan-200 truncate">${o.text}</span>
                    <button onclick="leDeleteText('${o.id}')" class="text-rose-400 hover:bg-rose-500/20 p-0.5 rounded">
                        <span class="material-icons text-xs">close</span>
                    </button>
                </div>
            `).join('');
        }
    }
    // refresh layer panel ด้วย
    if (typeof leLayerRefresh === 'function') leLayerRefresh();
}

window.leDeleteText = function(id) {
    window.leState.textObjects = window.leState.textObjects.filter(o => o.id !== id);
    leRenderAllTextOverlays();
    leUpdateTextList();
};

function leClearAllText() {
    window.leState.textObjects = [];
    leRenderAllTextOverlays();
    leUpdateTextList();
}

// แสดงค่า slider live
document.addEventListener('input', (e) => {
    if (e.target.id === 'leTextSize') document.getElementById('leTextSizeLabel').innerText = e.target.value + 'px';
    if (e.target.id === 'leTextStroke') document.getElementById('leTextStrokeLabel').innerText = e.target.value;
    if (e.target.id === 'leWmOpacity') document.getElementById('leWmOpacityLabel').innerText = e.target.value + '%';
    if (e.target.id === 'leWmSize') document.getElementById('leWmSizeLabel').innerText = e.target.value;
});

// ==========================================
// 🎨 FILTER — ปรับสี
// ==========================================
function leGetFilterCss() {
    const b = document.getElementById('leBrightness')?.value || 100;
    const c = document.getElementById('leContrast')?.value || 100;
    const s = document.getElementById('leSaturate')?.value || 100;
    const h = document.getElementById('leHue')?.value || 0;
    const bl = document.getElementById('leBlur')?.value || 0;
    document.getElementById('leBrightnessLabel') && (document.getElementById('leBrightnessLabel').innerText = b + '%');
    document.getElementById('leContrastLabel') && (document.getElementById('leContrastLabel').innerText = c + '%');
    document.getElementById('leSaturateLabel') && (document.getElementById('leSaturateLabel').innerText = s + '%');
    document.getElementById('leHueLabel') && (document.getElementById('leHueLabel').innerText = h + '°');
    document.getElementById('leBlurLabel') && (document.getElementById('leBlurLabel').innerText = bl);
    return `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) blur(${bl}px)`;
}

window.leApplyFilters = function() {
    const s = window.leState;
    if (!s.baseImage) return;
    s.ctx.filter = leGetFilterCss();
    s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
    s.ctx.drawImage(s.baseImage, 0, 0);
    s.ctx.filter = 'none';
    // ถ้ามีการแก้ไขอื่นๆ (เช่น erase) — ทำหลัง commit เท่านั้น
};

window.leResetFilters = function(apply = true) {
    ['leBrightness','leContrast','leSaturate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 100; });
    const hue = document.getElementById('leHue'); if (hue) hue.value = 0;
    const blur = document.getElementById('leBlur'); if (blur) blur.value = 0;
    if (apply) leApplyFilters();
};

window.leApplyPreset = function(preset) {
    const presets = {
        none:     { b: 100, c: 100, s: 100, h: 0, bl: 0 },
        warm:     { b: 105, c: 110, s: 115, h: 10, bl: 0 },
        cool:     { b: 95, c: 105, s: 90, h: -15, bl: 0 },
        vivid:    { b: 105, c: 120, s: 140, h: 0, bl: 0 },
        vintage:  { b: 105, c: 95, s: 70, h: 15, bl: 0 },
        bw:       { b: 100, c: 110, s: 0, h: 0, bl: 0 },
        sepia:    { b: 110, c: 100, s: 50, h: 20, bl: 0 },
        bright:   { b: 120, c: 105, s: 110, h: 0, bl: 0 },
        dramatic: { b: 95, c: 140, s: 110, h: 0, bl: 0 }
    };
    const p = presets[preset] || presets.none;
    document.getElementById('leBrightness').value = p.b;
    document.getElementById('leContrast').value = p.c;
    document.getElementById('leSaturate').value = p.s;
    document.getElementById('leHue').value = p.h;
    document.getElementById('leBlur').value = p.bl;
    leApplyFilters();
};

// commit filter — เขียนผลถาวรลง baseImage
window.leCommitFilters = function() {
    const s = window.leState;
    if (!s.baseImage) return;
    leSaveHistory();
    // วาดใหม่ด้วย filter แล้วเซฟเป็น baseImage ใหม่
    const tmp = document.createElement('canvas');
    tmp.width = s.canvas.width;
    tmp.height = s.canvas.height;
    const tctx = tmp.getContext('2d');
    tctx.filter = leGetFilterCss();
    tctx.drawImage(s.canvas, 0, 0);
    
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
        s.ctx.drawImage(newImg, 0, 0);
        leResetFilters(false);
        leApplyFilters();
        Swal.fire({ icon: 'success', title: 'บันทึกการปรับสีแล้ว', timer: 1000, showConfirmButton: false });
    };
    newImg.src = tmp.toDataURL('image/png');
};

// ==========================================
// 🔄 ROTATE / FLIP / CROP
// ==========================================
window.leRotate = function(degrees) {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    leSaveHistory();
    const oldW = s.canvas.width, oldH = s.canvas.height;
    const newW = oldH, newH = oldW;
    const tmp = document.createElement('canvas');
    tmp.width = newW; tmp.height = newH;
    const tctx = tmp.getContext('2d');
    tctx.translate(newW / 2, newH / 2);
    tctx.rotate(degrees * Math.PI / 180);
    tctx.drawImage(s.canvas, -oldW / 2, -oldH / 2);
    
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.canvas.width = newW;
        s.canvas.height = newH;
        s.ctx.drawImage(newImg, 0, 0);
        leFitScreen();
    };
    newImg.src = tmp.toDataURL('image/png');
};

window.leFlipImage = function(dir) {
    const s = window.leState;
    if (!s.baseImage) return;
    leSaveHistory();
    const tmp = document.createElement('canvas');
    tmp.width = s.canvas.width; tmp.height = s.canvas.height;
    const tctx = tmp.getContext('2d');
    if (dir === 'h') { tctx.translate(s.canvas.width, 0); tctx.scale(-1, 1); }
    else { tctx.translate(0, s.canvas.height); tctx.scale(1, -1); }
    tctx.drawImage(s.canvas, 0, 0);
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
        s.ctx.drawImage(newImg, 0, 0);
    };
    newImg.src = tmp.toDataURL('image/png');
};

window.leStartCrop = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    s.cropMode = true;
    s.cropRatio = document.getElementById('leCropRatio').value;
    document.getElementById('leStartCropBtn').classList.add('hidden');
    document.getElementById('leCropControls').classList.remove('hidden');
    document.getElementById('leCropControls').classList.add('grid');
    document.getElementById('leCanvas').style.cursor = 'crosshair';
    // เริ่มต้นด้วยกรอบกลาง 80%
    const w = s.canvas.width * 0.8;
    const h = s.canvas.height * 0.8;
    s.cropBox = { x: (s.canvas.width - w) / 2, y: (s.canvas.height - h) / 2, w, h };
    leDrawCropOverlay();
    leShowTip('🖱️ ลากใหม่บนรูปเพื่อกำหนดกรอบ — กด "ครอบเลย" เมื่อพอใจ', 4000);
};

function leDrawCropOverlay() {
    const overlay = document.getElementById('leCropOverlay');
    const s = window.leState;
    if (!overlay || !s.cropBox) return;
    overlay.classList.remove('hidden');
    const scale = leTotalScale();
    overlay.style.left = (s.cropBox.x * scale) + 'px';
    overlay.style.top = (s.cropBox.y * scale) + 'px';
    overlay.style.width = (s.cropBox.w * scale) + 'px';
    overlay.style.height = (s.cropBox.h * scale) + 'px';
}

function leStartCropDraw(e) {
    if (!window.leState.cropMode) return;
    e.preventDefault();
    const cvs = window.leState.canvas;
    const rect = cvs.getBoundingClientRect();
    const scale = leTotalScale();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    window.leState._cropDrawing = true;
    window.leState._cropStart = { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale };
}

function leMoveCropDraw(e) {
    if (!window.leState._cropDrawing) return;
    e.preventDefault();
    const cvs = window.leState.canvas;
    const rect = cvs.getBoundingClientRect();
    const scale = leTotalScale();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const ex = (cx - rect.left) / scale;
    const ey = (cy - rect.top) / scale;
    const s = window.leState;
    let x = Math.min(s._cropStart.x, ex);
    let y = Math.min(s._cropStart.y, ey);
    let w = Math.abs(ex - s._cropStart.x);
    let h = Math.abs(ey - s._cropStart.y);
    // บังคับ ratio
    if (s.cropRatio !== 'free') {
        const [rw, rh] = s.cropRatio.split(':').map(Number);
        const targetRatio = rw / rh;
        if (w / h > targetRatio) w = h * targetRatio;
        else h = w / targetRatio;
    }
    s.cropBox = { x, y, w, h };
    leDrawCropOverlay();
}

function leEndCropDraw(e) {
    window.leState._cropDrawing = false;
}

window.leApplyCrop = function() {
    const s = window.leState;
    if (!s.cropBox || s.cropBox.w < 10 || s.cropBox.h < 10) {
        return Swal.fire('!', 'กรอบเล็กเกินไป', 'warning');
    }
    leSaveHistory();
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(s.cropBox.w);
    tmp.height = Math.round(s.cropBox.h);
    const tctx = tmp.getContext('2d');
    tctx.drawImage(s.canvas, -s.cropBox.x, -s.cropBox.y);
    const newImg = new Image();
    newImg.onload = () => {
        s.baseImage = newImg;
        s.canvas.width = tmp.width;
        s.canvas.height = tmp.height;
        s.ctx.drawImage(newImg, 0, 0);
        leFitScreen();
        leCancelCrop();
        Swal.fire({ icon: 'success', title: 'ครอบรูปสำเร็จ', timer: 1000, showConfirmButton: false });
    };
    newImg.src = tmp.toDataURL('image/png');
};

window.leCancelCrop = function() {
    window.leState.cropMode = false;
    window.leState.cropBox = null;
    document.getElementById('leStartCropBtn').classList.remove('hidden');
    document.getElementById('leCropControls').classList.add('hidden');
    document.getElementById('leCropControls').classList.remove('grid');
    document.getElementById('leCropOverlay').classList.add('hidden');
    document.getElementById('leCanvas').style.cursor = 'crosshair';
};

// ==========================================
// 💧 WATERMARK
// ==========================================
window.leApplyWatermark = function() {
    const s = window.leState;
    if (!s.baseImage) return Swal.fire('!', 'ยังไม่มีรูป', 'warning');
    const text = document.getElementById('leWatermarkText').value.trim();
    if (!text) return Swal.fire('!', 'กรุณาพิมพ์ข้อความ', 'warning');
    
    leSaveHistory();
    const pattern = document.getElementById('leWatermarkPattern').value;
    const opacity = parseInt(document.getElementById('leWmOpacity').value) / 100;
    const size = parseInt(document.getElementById('leWmSize').value);
    const color = document.getElementById('leWmColor').value;
    
    s.ctx.save();
    s.ctx.globalAlpha = opacity;
    s.ctx.fillStyle = color;
    s.ctx.font = `bold ${size}px Arial, sans-serif`;
    s.ctx.textBaseline = 'middle';
    
    if (pattern === 'tile') {
        // เรียงทแยงทั่วทั้งภาพ
        s.ctx.translate(s.canvas.width / 2, s.canvas.height / 2);
        s.ctx.rotate(-Math.PI / 6);
        s.ctx.textAlign = 'center';
        const spaceX = size * 8;
        const spaceY = size * 4;
        const range = Math.max(s.canvas.width, s.canvas.height);
        for (let y = -range; y < range; y += spaceY) {
            for (let x = -range; x < range; x += spaceX) {
                s.ctx.fillText(text, x, y);
            }
        }
    } else if (pattern === 'single') {
        s.ctx.textAlign = 'right';
        s.ctx.fillText(text, s.canvas.width - 20, s.canvas.height - 20);
    } else if (pattern === 'corners') {
        const margin = 20;
        s.ctx.textAlign = 'left';
        s.ctx.fillText(text, margin, margin + size / 2);
        s.ctx.fillText(text, margin, s.canvas.height - margin - size / 2);
        s.ctx.textAlign = 'right';
        s.ctx.fillText(text, s.canvas.width - margin, margin + size / 2);
        s.ctx.fillText(text, s.canvas.width - margin, s.canvas.height - margin - size / 2);
    } else if (pattern === 'center') {
        s.ctx.textAlign = 'center';
        s.ctx.font = `bold ${size * 3}px Arial, sans-serif`;
        s.ctx.fillText(text, s.canvas.width / 2, s.canvas.height / 2);
    }
    
    s.ctx.restore();
    Swal.fire({ icon: 'success', title: 'ใส่ลายน้ำสำเร็จ', timer: 1000, showConfirmButton: false });
};

// ==========================================
// 📚 HISTORY
// ==========================================
function leSaveHistory() {
    const s = window.leState;
    if (!s.ctx || !s.canvas) return;
    try {
        s.history.push(s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height));
        if (s.history.length > 20) s.history.shift();
    } catch(e) {}
}

window.leUndoLast = function() {
    const s = window.leState;
    if (s.history.length === 0) return Swal.fire('!', 'ไม่มีขั้นตอนให้ย้อนกลับ', 'info');
    const last = s.history.pop();
    s.canvas.width = last.width;
    s.canvas.height = last.height;
    s.ctx.putImageData(last, 0, 0);
    leFitScreen();
};

window.leResetAll = async function() {
    const ok = await Swal.fire({
        title: 'เริ่มใหม่ทั้งหมด?', text: 'การแก้ไขทั้งหมดจะหายไป',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'ใช่', cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
    });
    if (!ok.isConfirmed) return;
    const s = window.leState;
    if (s.baseImage) { s.history = []; leRenderBase(); }
    leRemoveLogo();
    leClearPendingLogo();
    leClearAllText();
    leClearAllStickers();
    leResetFilters(false);
    s.selBox = null;
};

// ==========================================
// ✏️ DRAW TOOLS — วาดฟรีมือ
// ==========================================
window.leSetDrawTool = function(tool) {
    window.leState.drawTool = tool;
    ['pen','highlighter','marker','arrow','line','rect-shape','circle-shape','eraser'].forEach(t => {
        const id = 'leDraw' + (
            t === 'pen' ? 'Pen' :
            t === 'highlighter' ? 'Highlight' :
            t === 'marker' ? 'Marker' :
            t === 'arrow' ? 'Arrow' :
            t === 'line' ? 'Line' :
            t === 'rect-shape' ? 'Rect' :
            t === 'circle-shape' ? 'Circle' :
            'Eraser'
        );
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', t === tool);
    });
};

window.leSetDrawColor = function(color) {
    window.leState.drawColor = color;
    const input = document.getElementById('leDrawColor');
    if (input) input.value = color;
};

window.leToggleDrawMode = function() {
    const s = window.leState;
    s.drawMode = !s.drawMode;
    const btn = document.getElementById('leDrawToggleBtn');
    const cvs = document.getElementById('leCanvas');
    if (s.drawMode) {
        if (!s.baseImage) {
            s.drawMode = false;
            Swal.fire('!', 'กรุณาเลือกรูปก่อน', 'warning');
            return;
        }
        if (btn) {
            btn.innerHTML = '<span class="material-icons text-sm align-middle">stop</span> หยุดวาด';
            btn.classList.remove('le-btn-amber');
            btn.classList.add('le-btn-danger');
        }
        if (cvs) cvs.style.cursor = 'crosshair';
        leShowTip('✏️ ลากเมาส์บนรูปเพื่อวาด — กดหยุดวาดเมื่อเสร็จ', 3500);
    } else {
        if (btn) {
            btn.innerHTML = '<span class="material-icons text-sm align-middle">play_arrow</span> เริ่มวาด';
            btn.classList.remove('le-btn-danger');
            btn.classList.add('le-btn-amber');
        }
        if (cvs) cvs.style.cursor = '';
    }
};

function leStartDraw(e, p) {
    const s = window.leState;
    if (!s.baseImage) return;
    e.preventDefault();
    e.stopPropagation();
    leSaveHistory();
    
    const tool = s.drawTool;
    const ctx = s.ctx;
    
    // เครื่องมือ shape (line/arrow/rect/circle) — เก็บ snapshot สำหรับ preview
    if (['line', 'arrow', 'rect-shape', 'circle-shape'].includes(tool)) {
        s.drawingShape = true;
        s.drawStart = p;
        try {
            s.drawSnapshot = ctx.getImageData(0, 0, s.canvas.width, s.canvas.height);
        } catch(err) {}
        return;
    }
    
    // freehand: pen/highlighter/marker/eraser
    s.drawStart = p;
    leDrawPath(p, p);
}

function leMoveDraw(e, p) {
    const s = window.leState;
    if (!s.drawStart) return;
    e.preventDefault();
    
    const tool = s.drawTool;
    
    // Shape: preview - restore snapshot แล้ววาดใหม่
    if (s.drawingShape && s.drawSnapshot) {
        s.ctx.putImageData(s.drawSnapshot, 0, 0);
        leDrawShape(s.drawStart, p);
        return;
    }
    
    // Freehand: ลากเส้นต่อเนื่อง
    leDrawPath(s.drawStart, p);
    s.drawStart = p;
}

function leEndDraw(e) {
    const s = window.leState;
    s.drawingShape = false;
    s.drawStart = null;
    s.drawSnapshot = null;
}

function leDrawPath(from, to) {
    const s = window.leState;
    const ctx = s.ctx;
    const tool = s.drawTool;
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.drawSize;
    
    if (tool === 'pen') {
        ctx.strokeStyle = s.drawColor;
        ctx.globalAlpha = 1;
    } else if (tool === 'highlighter') {
        ctx.strokeStyle = s.drawColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = s.drawSize * 2;
    } else if (tool === 'marker') {
        ctx.strokeStyle = s.drawColor;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = s.drawSize * 1.5;
    } else if (tool === 'eraser') {
        // ยางลบ — วาดบนรูปจะลบสิ่งที่วาดไว้ (ทำเป็นสีพื้น) — ใช้ destination-out
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = s.drawSize * 1.5;
    }
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
}

function leDrawShape(from, to) {
    const s = window.leState;
    const ctx = s.ctx;
    const tool = s.drawTool;
    
    ctx.save();
    ctx.strokeStyle = s.drawColor;
    ctx.lineWidth = s.drawSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    } else if (tool === 'arrow') {
        // วาดเส้นตรง + หัวลูกศร
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headSize = s.drawSize * 4;
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headSize * Math.cos(angle - Math.PI / 6),
                   to.y - headSize * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - headSize * Math.cos(angle + Math.PI / 6),
                   to.y - headSize * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    } else if (tool === 'rect-shape') {
        ctx.strokeRect(
            Math.min(from.x, to.x), Math.min(from.y, to.y),
            Math.abs(to.x - from.x), Math.abs(to.y - from.y)
        );
    } else if (tool === 'circle-shape') {
        const cx = (from.x + to.x) / 2;
        const cy = (from.y + to.y) / 2;
        const rx = Math.abs(to.x - from.x) / 2;
        const ry = Math.abs(to.y - from.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.restore();
}

// ==========================================