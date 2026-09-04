// ════════════════════════════════════════════════════════════════════
// 📦 logo_editor/erase.js — ส่วนที่ 2/4 ของเครื่องมือแต่งรูป (แยกจาก logo_editor.js เดิม 2,191 บรรทัด)
// เนื้อหา: Selection, Magic Eraser, Content-Aware Fill, Auto ลบพื้นหลัง, เปลี่ยนสีตัวอักษร
// ⚠️ ลำดับโหลด: logo_editor/core → logo_editor/erase → logo_editor/tools → logo_editor/extras
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// ✂️ Selection — ทำงานในแท็บ replace เท่านั้น
// ==========================================
function leSetupCanvasEvents() {
    const cvs = window.leState.canvas;
    if (!cvs || cvs._eventsSetup) return;
    cvs._eventsSetup = true;
    const svg = document.getElementById('leSelectionSvg');
    
    const getCoords = (e) => {
        const rect = cvs.getBoundingClientRect();
        const scale = leTotalScale();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale };
    };
    
    const startSel = (e) => {
        if (!window.leState.baseImage) return;
        if (window.leState.cropMode) return leStartCropDraw(e);
        
        // 🎨 Split mode — ใช้แท็บ split และมีชิ้นแยกอยู่
        if (window.leState.currentTab === 'split' && window.leState.splitMode && window.leState.splitParts.length > 0) {
            e.preventDefault();
            if (typeof leSplitHandleCanvasMouseDown === 'function') leSplitHandleCanvasMouseDown(e);
            return;
        }
        
        // 🌟 โหมดวาด (มี priority สูงสุด ใช้ได้ทุกแท็บที่เปิด drawMode)
        if (window.leState.drawMode) return leStartDraw(e, getCoords(e));
        
        // 🪶 Magic Eraser Brush — ใช้ในแท็บ replace + mode = brush
        if (window.leState.currentTab === 'replace' && window.leState.mode === 'brush') {
            if (window.leCanErase === false) return;
            e.preventDefault();
            leSaveHistory();
            window.leState.isBrushing = true;
            leBrushErase(getCoords(e));
            return;
        }
        
        // โหมดคลุมเป็นกรอบ (rect/ellipse/circle/lasso)
        if (window.leState.currentTab !== 'replace') return;
        if (window.leCanErase === false) return;
        e.preventDefault();
        const p = getCoords(e);
        window.leState.isDrawingSelection = true;
        window.leState.selStart = p;
        window.leState.lassoPoints = [p];
        svg.classList.remove('hidden');
        leDrawSelectionShape(p, p);
    };
    
    const moveSel = (e) => {
        if (window.leState.cropMode) return leMoveCropDraw(e);
        
        // split drag
        if (window.leState._splitDragging) {
            return (typeof leSplitHandleCanvasMouseMove === 'function') ? leSplitHandleCanvasMouseMove(e) : undefined;
        }
        
        if (window.leState.drawMode) return leMoveDraw(e, getCoords(e));
        
        // brush eraser
        if (window.leState.isBrushing) {
            e.preventDefault();
            leBrushErase(getCoords(e));
            return;
        }
        
        if (!window.leState.isDrawingSelection) return;
        e.preventDefault();
        const p = getCoords(e);
        if (window.leState.shape === 'lasso') {
            window.leState.lassoPoints.push(p);
            leDrawLassoPath(window.leState.lassoPoints);
        } else {
            leDrawSelectionShape(window.leState.selStart, p);
        }
    };
    
    const endSel = async (e) => {
        if (window.leState.cropMode) return leEndCropDraw(e);
        
        // split drag end
        if (window.leState._splitDragging) {
            return (typeof leSplitHandleCanvasMouseUp === 'function') ? leSplitHandleCanvasMouseUp() : undefined;
        }
        
        if (window.leState.drawMode) return leEndDraw(e);
        
        // brush eraser
        if (window.leState.isBrushing) {
            window.leState.isBrushing = false;
            return;
        }
        
        if (!window.leState.isDrawingSelection) return;
        window.leState.isDrawingSelection = false;
        const sel = window.leState.selBox;
        const hasValid = sel && ((sel.type === 'rect' && sel.w >= 4 && sel.h >= 4) ||
                                  (sel.type === 'ellipse' && sel.rx >= 2 && sel.ry >= 2) ||
                                  (sel.type === 'lasso' && sel.points && sel.points.length >= 5));
        if (hasValid) {
            const bbox = leGetBBox(sel);
            await leApplyErase();
            if (window.leState.mode === 'magic' && window.leState.pendingLogo) {
                leAutoPlaceLogo(bbox);
            }
        }
        svg.classList.add('hidden');
        svg.innerHTML = '';
        window.leState.selBox = null;
        window.leState.lassoPoints = [];
    };
    
    cvs.addEventListener('mousedown', startSel);
    cvs.addEventListener('mousemove', moveSel);
    window.addEventListener('mouseup', endSel);
    cvs.addEventListener('touchstart', startSel, {passive: false});
    cvs.addEventListener('touchmove', moveSel, {passive: false});
    window.addEventListener('touchend', endSel);
    
    // brush size label update
    document.addEventListener('input', (e) => {
        if (e.target.id === 'leBrushSize') {
            document.getElementById('leBrushSizeLabel').innerText = e.target.value + 'px';
        }
        if (e.target.id === 'leDrawSize') {
            document.getElementById('leDrawSizeLabel').innerText = e.target.value + 'px';
            window.leState.drawSize = parseInt(e.target.value);
        }
        if (e.target.id === 'leResizePercent') {
            leUpdateResizePreview();
        }
        if (e.target.id === 'leDrawColor') {
            window.leState.drawColor = e.target.value;
        }
    });
}

// ==========================================
// 🪶 Magic Eraser Brush — ระบายลบเป็นแปรง
// ==========================================
function leBrushErase(p) {
    const s = window.leState;
    if (!s.baseImage) return;
    const size = parseInt(document.getElementById('leBrushSize')?.value || 40);
    const radius = size / 2;
    
    // ใช้ content-aware fill กับ bounding box ของแปรง (วงกลม)
    const sel = {
        type: 'ellipse',
        cx: p.x,
        cy: p.y,
        rx: radius,
        ry: radius
    };
    const bbox = leGetBBox(sel);
    
    // ใช้ algorithm content-aware fill เดิม
    leContentAwareFill(sel, bbox);
}


function leDrawSelectionShape(start, end) {
    const svg = document.getElementById('leSelectionSvg');
    if (!svg) return;
    const x1 = Math.min(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    const shape = window.leState.shape;
    if (shape === 'rect') {
        svg.innerHTML = `<rect x="${x1}" y="${y1}" width="${w}" height="${h}"/>`;
        window.leState.selBox = { type: 'rect', x: x1, y: y1, w, h };
    } else if (shape === 'ellipse') {
        svg.innerHTML = `<ellipse cx="${x1 + w/2}" cy="${y1 + h/2}" rx="${w/2}" ry="${h/2}"/>`;
        window.leState.selBox = { type: 'ellipse', cx: x1 + w/2, cy: y1 + h/2, rx: w/2, ry: h/2 };
    } else if (shape === 'circle') {
        const r = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        svg.innerHTML = `<ellipse cx="${start.x}" cy="${start.y}" rx="${r}" ry="${r}"/>`;
        window.leState.selBox = { type: 'ellipse', cx: start.x, cy: start.y, rx: r, ry: r };
    }
}

function leDrawLassoPath(points) {
    const svg = document.getElementById('leSelectionSvg');
    if (!svg || points.length < 2) return;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    d += ' Z';
    svg.innerHTML = `<path d="${d}"/>`;
    window.leState.selBox = { type: 'lasso', points: [...points] };
}

window.leApplyErase = async function() {
    if (window.leCanErase === false) return;
    const s = window.leState;
    const sel = s.selBox;
    if (!sel) return;
    if (sel.type === 'rect' && (sel.w < 4 || sel.h < 4)) return;
    if (sel.type === 'ellipse' && (sel.rx < 2 || sel.ry < 2)) return;
    if (sel.type === 'lasso' && sel.points.length < 5) return;
    
    leSaveHistory();
    const mode = document.getElementById('leFillMode').value;
    const color = document.getElementById('leFillColor').value;
    const bbox = leGetBBox(sel);
    
    if (mode === 'solid') {
        // โหมดสีทึบ — ใช้สีที่ผู้ใช้เลือก
        s.ctx.save();
        leClipToShape(s.ctx, sel);
        s.ctx.fillStyle = color;
        s.ctx.fillRect(bbox.x, bbox.y, bbox.w, bbox.h);
        s.ctx.restore();
    } else if (mode === 'blur') {
        // โหมด blur — เติม content-aware ก่อน แล้วเบลอ
        leContentAwareFill(sel, bbox);
        try {
            const imgData = s.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
            const blurred = leBoxBlur(imgData, 3);
            s.ctx.putImageData(blurred, bbox.x, bbox.y);
        } catch(e) {}
    } else {
        // 🌟 โหมด auto — ใช้ content-aware fill (ลากสีจากขอบทุกด้านมาใช้)
        leContentAwareFill(sel, bbox);
    }
};

// ==========================================
// 🪄 Content-Aware Fill v5 — Directional Stretch
// หลักการ: pixel ในกรอบ → ใช้สีจากคอลัมน์/แถวเดียวกันที่อยู่นอกกรอบ
// "ยืด" texture เข้ามาแทน — ไม่ใช่ mirror ไม่ใช่เฉลี่ย
// เหมาะกับพื้นที่มีลาย (texture, gradient)
// ==========================================
function leContentAwareFill(sel, bbox) {
    const s = window.leState;
    const ctx = s.ctx;
    const W = s.canvas.width;
    const H = s.canvas.height;
    
    const x0 = Math.max(0, Math.floor(bbox.x));
    const y0 = Math.max(0, Math.floor(bbox.y));
    const x1 = Math.min(W, Math.ceil(bbox.x + bbox.w));
    const y1 = Math.min(H, Math.ceil(bbox.y + bbox.h));
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw < 2 || bh < 2) return;
    
    // อ่านแถบรอบกรอบ — เอาหลายๆ แถวเพื่อหา pixel ที่ "เรียบ" ใช้แทน
    // ความหนาของแถบ source = 8 pixel
    const sampleDepth = 8;
    
    const tDepth = Math.min(sampleDepth, y0);
    const bDepth = Math.min(sampleDepth, H - y1);
    const lDepth = Math.min(sampleDepth, x0);
    const rDepth = Math.min(sampleDepth, W - x1);
    
    // ถ้าไม่มี source เลย → fallback
    if (tDepth === 0 && bDepth === 0 && lDepth === 0 && rDepth === 0) return;
    
    // อ่านแถบทั้งหมด (ครอบคลุมพื้นที่นอกกรอบ + กรอบเดิม)
    const srcX = Math.max(0, x0 - lDepth);
    const srcY = Math.max(0, y0 - tDepth);
    const srcW = Math.min(W - srcX, bw + lDepth + rDepth);
    const srcH = Math.min(H - srcY, bh + tDepth + bDepth);
    
    let srcData;
    try {
        srcData = ctx.getImageData(srcX, srcY, srcW, srcH);
    } catch(e) { return; }
    const src = srcData.data;
    
    // helper: อ่านสีจาก source ที่ตำแหน่ง (sx, sy) — local ใน source
    const getSrc = (sx, sy) => {
        if (sx < 0 || sx >= srcW || sy < 0 || sy >= srcH) return null;
        const i = (sy * srcW + sx) * 4;
        return { r: src[i], g: src[i+1], b: src[i+2] };
    };
    
    const outImg = ctx.createImageData(bw, bh);
    const out = outImg.data;
    
    // สำหรับ pixel แต่ละตัวในกรอบ — เก็บ candidates จากแถบ source
    // - ทิศบน: คอลัมน์เดียวกัน แถวที่อยู่เหนือกรอบ (เลือกแถวที่ "เรียบ" — สีคล้าย neighbors)
    // - ทิศล่าง: คอลัมน์เดียวกัน แถวที่อยู่ใต้กรอบ
    // - ทิศซ้าย: แถวเดียวกัน คอลัมน์ที่อยู่ซ้าย
    // - ทิศขวา: แถวเดียวกัน คอลัมน์ที่อยู่ขวา
    
    // ก่อนอื่น สร้าง "smoothed edge color" สำหรับแต่ละทิศ
    // โดยหาค่าเฉลี่ยของแถบ source ในคอลัมน์/แถวนั้น
    // ⭐ ใช้ median แทน mean เพื่อหลีกเลี่ยง outlier (เช่น pixel ของตัวอักษร)
    
    function median(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }
    
    // สำหรับแต่ละคอลัมน์ (px) — หาสี median ของแถบบน, ล่าง
    // สำหรับแต่ละแถว (py) — หาสี median ของแถบซ้าย, ขวา
    
    const topColors = new Array(bw);     // [{r,g,b}] ของแต่ละคอลัมน์
    const bottomColors = new Array(bw);
    const leftColors = new Array(bh);    // ของแต่ละแถว
    const rightColors = new Array(bh);
    
    // ทิศบน: pixel ที่อยู่เหนือกรอบ ในคอลัมน์ px
    for (let px = 0; px < bw; px++) {
        const sx = px + lDepth;
        if (sx >= srcW) { topColors[px] = null; continue; }
        if (tDepth > 0) {
            // เก็บค่า R, G, B แยกกัน แล้วหา median
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < tDepth; d++) {
                const sy = d; // sy = 0 คือบนสุดของ source = ห่างจากกรอบ tDepth pixels
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            topColors[px] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else topColors[px] = null;
    }
    
    // ทิศล่าง
    for (let px = 0; px < bw; px++) {
        const sx = px + lDepth;
        if (sx >= srcW) { bottomColors[px] = null; continue; }
        if (bDepth > 0) {
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < bDepth; d++) {
                const sy = tDepth + bh + d;
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            bottomColors[px] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else bottomColors[px] = null;
    }
    
    // ทิศซ้าย
    for (let py = 0; py < bh; py++) {
        const sy = py + tDepth;
        if (sy >= srcH) { leftColors[py] = null; continue; }
        if (lDepth > 0) {
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < lDepth; d++) {
                const sx = d;
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            leftColors[py] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else leftColors[py] = null;
    }
    
    // ทิศขวา
    for (let py = 0; py < bh; py++) {
        const sy = py + tDepth;
        if (sy >= srcH) { rightColors[py] = null; continue; }
        if (rDepth > 0) {
            const rs = [], gs = [], bs = [];
            for (let d = 0; d < rDepth; d++) {
                const sx = lDepth + bw + d;
                const p = getSrc(sx, sy);
                if (p) { rs.push(p.r); gs.push(p.g); bs.push(p.b); }
            }
            rightColors[py] = rs.length ? { r: median(rs), g: median(gs), b: median(bs) } : null;
        } else rightColors[py] = null;
    }
    
    // ทีนี้ ใช้ bilinear blend ของ 4 ทิศ
    for (let py = 0; py < bh; py++) {
        for (let px = 0; px < bw; px++) {
            const tx = px / (bw - 1 || 1);
            const ty = py / (bh - 1 || 1);
            
            const t = topColors[px];
            const b = bottomColors[px];
            const l = leftColors[py];
            const r = rightColors[py];
            
            // ผสมแนวตั้ง — ถ้าทิศใดไม่มี (null) → ใช้อีกทิศ
            let vR, vG, vB;
            if (t && b) {
                vR = t.r * (1 - ty) + b.r * ty;
                vG = t.g * (1 - ty) + b.g * ty;
                vB = t.b * (1 - ty) + b.b * ty;
            } else if (t) { vR = t.r; vG = t.g; vB = t.b; }
            else if (b)   { vR = b.r; vG = b.g; vB = b.b; }
            else { vR = vG = vB = null; }
            
            // ผสมแนวนอน
            let hR, hG, hB;
            if (l && r) {
                hR = l.r * (1 - tx) + r.r * tx;
                hG = l.g * (1 - tx) + r.g * tx;
                hB = l.b * (1 - tx) + r.b * tx;
            } else if (l) { hR = l.r; hG = l.g; hB = l.b; }
            else if (r)   { hR = r.r; hG = r.g; hB = r.b; }
            else { hR = hG = hB = null; }
            
            // เฉลี่ยแนวตั้ง+แนวนอน
            const i = (py * bw + px) * 4;
            let finalR, finalG, finalB;
            if (vR !== null && hR !== null) {
                finalR = (vR + hR) / 2;
                finalG = (vG + hG) / 2;
                finalB = (vB + hB) / 2;
            } else if (vR !== null) { finalR = vR; finalG = vG; finalB = vB; }
            else if (hR !== null)   { finalR = hR; finalG = hG; finalB = hB; }
            else { finalR = finalG = finalB = 128; }
            
            out[i]   = Math.round(finalR);
            out[i+1] = Math.round(finalG);
            out[i+2] = Math.round(finalB);
            out[i+3] = 255;
        }
    }
    
    // noise นิดหน่อย
    for (let i = 0; i < out.length; i += 4) {
        const n = (Math.random() - 0.5) * 8;
        out[i]   = Math.max(0, Math.min(255, out[i] + n));
        out[i+1] = Math.max(0, Math.min(255, out[i+1] + n));
        out[i+2] = Math.max(0, Math.min(255, out[i+2] + n));
    }
    
    // วาดลง canvas
    const off = document.createElement('canvas');
    off.width = bw; off.height = bh;
    off.getContext('2d').putImageData(outImg, 0, 0);
    
    ctx.save();
    leClipToShape(ctx, sel);
    ctx.drawImage(off, x0, y0);
    ctx.restore();
}





function leGetBBox(sel) {
    if (sel.type === 'rect') return { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
    if (sel.type === 'ellipse') return { x: sel.cx - sel.rx, y: sel.cy - sel.ry, w: sel.rx * 2, h: sel.ry * 2 };
    if (sel.type === 'lasso') {
        let xs = sel.points.map(p => p.x), ys = sel.points.map(p => p.y);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
}

function leClipToShape(ctx, sel) {
    ctx.beginPath();
    if (sel.type === 'rect') ctx.rect(sel.x, sel.y, sel.w, sel.h);
    else if (sel.type === 'ellipse') ctx.ellipse(sel.cx, sel.cy, sel.rx, sel.ry, 0, 0, Math.PI * 2);
    else if (sel.type === 'lasso') {
        ctx.moveTo(sel.points[0].x, sel.points[0].y);
        for (let i = 1; i < sel.points.length; i++) ctx.lineTo(sel.points[i].x, sel.points[i].y);
        ctx.closePath();
    }
    ctx.clip();
}

function leComputeAvgEdgeColor(bbox) {
    const s = window.leState;
    const ctx = s.ctx;
    const samples = [];
    const pad = 5;
    const sampleEdge = (sx, sy, w, h) => {
        try {
            const safeSx = Math.max(0, Math.floor(sx));
            const safeSy = Math.max(0, Math.floor(sy));
            const safeW = Math.min(Math.floor(w), s.canvas.width - safeSx);
            const safeH = Math.min(Math.floor(h), s.canvas.height - safeSy);
            if (safeW <= 0 || safeH <= 0) return;
            const d = ctx.getImageData(safeSx, safeSy, safeW, safeH);
            for (let i = 0; i < d.data.length; i += 16) samples.push([d.data[i], d.data[i+1], d.data[i+2]]);
        } catch(e) {}
    };
    sampleEdge(bbox.x - pad, bbox.y - pad, bbox.w + pad*2, pad);
    sampleEdge(bbox.x - pad, bbox.y + bbox.h, bbox.w + pad*2, pad);
    sampleEdge(bbox.x - pad, bbox.y, pad, bbox.h);
    sampleEdge(bbox.x + bbox.w, bbox.y, pad, bbox.h);
    if (samples.length === 0) return '#ffffff';
    let r = 0, g = 0, b = 0;
    samples.forEach(s => { r += s[0]; g += s[1]; b += s[2]; });
    return `rgb(${Math.round(r/samples.length)},${Math.round(g/samples.length)},${Math.round(b/samples.length)})`;
}

function leBoxBlur(imgData, radius) {
    const w = imgData.width, h = imgData.height;
    const src = imgData.data;
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let cr = 0, cg = 0, cb = 0, ca = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    const idx = (ny * w + nx) * 4;
                    cr += src[idx]; cg += src[idx+1]; cb += src[idx+2]; ca += src[idx+3];
                    count++;
                }
            }
            const idx = (y * w + x) * 4;
            out[idx] = cr / count; out[idx+1] = cg / count;
            out[idx+2] = cb / count; out[idx+3] = ca / count;
        }
    }
    return new ImageData(out, w, h);
}

// ==========================================
// 🪄 Auto place + remove bg
// ==========================================
function leAutoPlaceLogo(bbox) {
    const s = window.leState;
    const logo = s.pendingLogo;
    if (!logo || !bbox) return;
    s.newLogo = logo;
    s.originalLogo = logo;  // 🌟 เก็บไว้ recolor
    const logoRatio = logo.height / logo.width;
    const bboxRatio = bbox.h / bbox.w;
    let w, h;
    if (logoRatio > bboxRatio) {
        h = bbox.h; w = h / logoRatio;
    } else {
        w = bbox.w; h = w * logoRatio;
    }
    s.logoOverlay = {
        x: bbox.x + (bbox.w - w) / 2,
        y: bbox.y + (bbox.h - h) / 2,
        w, h, opacity: 1
    };
    document.getElementById('leLogoImg').src = logo.src;
    document.getElementById('leLogoOverlay').classList.remove('hidden');
    document.getElementById('leLogoControls').classList.remove('hidden');
    document.getElementById('leLogoSize').value = 100;
    document.getElementById('leLogoOpacity').value = 100;
    leUpdateLogoOverlayPosition();
    // ถ้าเปิด recolor อยู่ → apply เลย
    // [removed] leApplyLogoRecolor removed
    leShowTip('⚡ วางโลโก้ใหม่เรียบร้อย! ใช้ "เปลี่ยนสี" ได้ในแผงควบคุม', 3000);
}


window.leLoadNewLogo = function(event) {
    if (window.leCanAddLogo === false) {
        if (event.target) event.target.value = '';
        return Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใส่โลโก้ใหม่', 'warning');
    }
    const file = event.target ? event.target.files[0] : event;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
            const removeBg = document.getElementById('leAutoRemoveBg');
            const shouldRemove = !removeBg || removeBg.checked;
            let finalImg = img;
            if (shouldRemove) {
                try { finalImg = await leRemoveBgFromLogo(img); } catch (e) { finalImg = img; }
            }
            if (window.leState.mode === 'magic') {
                window.leState.pendingLogo = finalImg;
                window.leState.originalLogo = finalImg;  // 🌟 เก็บไว้ recolor
                const preview = document.getElementById('leLogoPreview');
                const previewImg = document.getElementById('leLogoPreviewImg');
                const badge = document.getElementById('leLogoReadyBadge');
                if (previewImg) previewImg.src = finalImg.src;
                if (preview) preview.classList.remove('hidden');
                if (badge) badge.classList.remove('hidden');
                leShowTip(window.leState.baseImage ? '⚡ พร้อมแล้ว! ลากคลุมโลโก้เก่าได้เลย' : '💡 เลือกรูปต้นฉบับก่อน', 3500);
            } else {
                if (!window.leState.baseImage) {
                    Swal.fire('!', 'กรุณาเลือกรูปต้นฉบับก่อน', 'warning');
                    if (event.target) event.target.value = '';
                    return;
                }
                window.leState.newLogo = finalImg;
                window.leState.originalLogo = finalImg;  // 🌟 เก็บไว้ recolor
                const baseW = window.leState.baseImage.width;
                const w0 = baseW * 0.15;
                const ratio = finalImg.height / finalImg.width;
                window.leState.logoOverlay = { x: baseW * 0.05, y: window.leState.baseImage.height * 0.05, w: w0, h: w0 * ratio, opacity: 1 };
                document.getElementById('leLogoImg').src = finalImg.src;
                document.getElementById('leLogoOverlay').classList.remove('hidden');
                document.getElementById('leLogoControls').classList.remove('hidden');
                leUpdateLogoOverlayPosition();
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
};

window.leClearPendingLogo = function() {
    window.leState.pendingLogo = null;
    document.getElementById('leLogoPreview')?.classList.add('hidden');
    document.getElementById('leLogoReadyBadge')?.classList.add('hidden');
};

function leUpdateLogoOverlayPosition() {
    const s = window.leState;
    const overlay = document.getElementById('leLogoOverlay');
    const img = document.getElementById('leLogoImg');
    if (!overlay || !img) return;
    const scale = leTotalScale();
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
    const ratio = window.leState.newLogo.height / window.leState.newLogo.width;
    const newW = baseW * 0.15 * (val / 100);
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
    window.leState.originalLogo = null;
    document.getElementById('leLogoOverlay')?.classList.add('hidden');
    document.getElementById('leLogoControls')?.classList.add('hidden');
    const img = document.getElementById('leLogoImg');
    if (img) img.src = '';
    // reset recolor
    const recolorCb = document.getElementById('leLogoRecolor');
    if (recolorCb) recolorCb.checked = false;
    document.getElementById('leLogoRecolorControls')?.classList.add('hidden');
    // [removed] logoRecolor state removed
};

// ==========================================
// 🎨 เปลี่ยนสีตัวอักษรในโลโก้
// ==========================================



// 🌟 โหมด pick สีจากโลโก้ — ผู้ใช้คลิกบนโลโก้แล้วระบบดูดสีออกมา





function leSetupLogoOverlayEvents() {
    const overlay = document.getElementById('leLogoOverlay');
    const handle = document.getElementById('leLogoHandle');
    if (!overlay || overlay._eventsSetup) return;
    overlay._eventsSetup = true;
    let isDragging = false, isResizing = false;
    let dragStart = null;
    const onDown = (e) => {
        if (e.target === handle) isResizing = true; else isDragging = true;
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
        const dx = cx - dragStart.x, dy = cy - dragStart.y;
        const scale = leTotalScale();
        if (isDragging) {
            window.leState.logoOverlay.x = dragStart.lo.x + dx / scale;
            window.leState.logoOverlay.y = dragStart.lo.y + dy / scale;
        } else if (isResizing) {
            const ratio = window.leState.newLogo ? window.leState.newLogo.height / window.leState.newLogo.width : 1;
            const newW = Math.max(10, dragStart.lo.w + dx / scale);
            window.leState.logoOverlay.w = newW;
            window.leState.logoOverlay.h = newW * ratio;
            const baseW = window.leState.baseImage.width;
            const pct = Math.min(300, Math.max(10, Math.round(newW / (baseW * 0.15) * 100)));
            document.getElementById('leLogoSize').value = pct;
            document.getElementById('leLogoSizeLabel').innerText = pct + '%';
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