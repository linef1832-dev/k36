// ════════════════════════════════════════════════════════════════════
// 📦 slip_check/scan.js — ส่วนที่ 2/3 ของระบบตรวจสลิป (แยกจาก slip_check.js เดิม 1,118 บรรทัด)
// เนื้อหา: สแกน QR + OCR + ตรวจปลอม, ฟังก์ชันตรวจสอบสลิปหลัก
// ⚠️ ลำดับโหลด: slip_check/core → slip_check/scan → slip_check/history (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// PATCH: แก้ไขระบบสแกน QR + OCR + ตรวจปลอม
// ==========================================

// ── 1. extractQrPayload ใหม่: ลอง resize หลายขนาด + enhance contrast ──
window.extractQrPayload = function(file) {
    return new Promise((resolve, reject) => {
        if (typeof jsQR === 'undefined') return reject(new Error('ไม่พบระบบอ่าน QR Code (jsQR)'));

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // ลอง 4 ขนาด: ต้นฉบับ, 1600, 1200, 800
                const sizes = [
                    Math.max(img.width, img.height),
                    1600, 1200, 800
                ].filter((v, i, a) => a.indexOf(v) === i);

                const trySize = (sizeIdx) => {
                    if (sizeIdx >= sizes.length) return reject(new Error('ไม่พบ QR Code บนสลิปนี้'));

                    const maxSize = sizes[sizeIdx];
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    let w = img.width, h = img.height;
                    if (w > maxSize || h > maxSize) {
                        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                        else { w = Math.round(w * maxSize / h); h = maxSize; }
                    }
                    canvas.width = w; canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);

                    // enhance: เพิ่ม contrast ก่อน scan
                    const imageData = ctx.getImageData(0, 0, w, h);
                    const d = imageData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        // grayscale + threshold เพื่อช่วย QR
                        const avg = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
                        const v = avg > 128 ? 255 : 0;
                        d[i] = d[i+1] = d[i+2] = v;
                    }
                    ctx.putImageData(imageData, 0, 0);

                    // scan ทั้ง 2 โหมด: normal + inverted
                    let code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
                    if (code) return resolve(code.data);

                    // ลองไม่ threshold
                    ctx.drawImage(img, 0, 0, w, h);
                    const raw = ctx.getImageData(0, 0, w, h);
                    code = jsQR(raw.data, w, h, { inversionAttempts: 'attemptBoth' });
                    if (code) return resolve(code.data);

                    // ลองขนาดถัดไป
                    trySize(sizeIdx + 1);
                };

                trySize(0);
            };
            img.onerror = () => reject(new Error('รูปภาพเสียหาย'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
        reader.readAsDataURL(file);
    });
};

// ── 2. performOCR ใหม่: pre-process รูปก่อน + ลด noise ──
window.performOCR = async function(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const img = new Image();
                img.onload = async () => {
                    // scale รูปให้ใหญ่พอ (OCR ต้องการ ~150dpi ขึ้นไป)
                    const scale = Math.max(1, Math.min(3, 2000 / Math.max(img.width, img.height)));
                    const canvas = document.createElement('canvas');
                    canvas.width  = Math.round(img.width  * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    // ใช้ imageSmoothingQuality สูงสุดก่อน scale
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // เพิ่ม contrast ง่ายๆ ด้วย CSS filter ผ่าน offscreen canvas
                    const offscreen = document.createElement('canvas');
                    offscreen.width  = canvas.width;
                    offscreen.height = canvas.height;
                    const octx = offscreen.getContext('2d');
                    octx.filter = 'contrast(1.5) brightness(1.1) grayscale(1)';
                    octx.drawImage(canvas, 0, 0);

                    const dataUrl = offscreen.toDataURL('image/png');

                    const worker = await Tesseract.createWorker(['tha', 'eng']);
                    await worker.setParameters({
                        tessedit_pageseg_mode: '6',  // single block
                        preserve_interword_spaces: '1',
                    });
                    const ret = await worker.recognize(dataUrl);
                    await worker.terminate();
                    resolve(ret.data.text);
                };
                img.onerror = () => resolve('');
                img.src = reader.result;
            } catch (e) {
                console.error('OCR Error:', e);
                resolve('');
            }
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
};

// ── 3. ตรวจสอบชื่อแม่นขึ้น: รับ *, x, X, ---, masked ──
window._isMasked = function(name) {
    if (!name || name === '-' || name === 'ไม่ระบุ') return true;
    // ธนาคารมักเซ็นเซอร์ชื่อด้วย * . x X -
    return /[*xX]{2,}|[-]{3,}|\.{3,}|\bx+\b/.test(name);
};

// ── 4. ฟังก์ชันดูรายละเอียดประวัติ (ที่หายไป) ──
window.viewHistoryDetail = function(id) {
    const h = window.slipHistoryData.find(x => x.id === id);
    if (!h) return;
    const timeStr = new Date(h.timestamp).toLocaleString('th-TH');
    const statusHtml = h.isFake
        ? `<span class="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-black">สลิปปลอม ❌</span>`
        : `<span class="bg-emerald-600 text-white px-3 py-1 rounded-full text-sm font-black">สลิปจริง ✅</span>`;
    const imgHtml = h.imageUrl
        ? `<div class="mt-4"><img src="${h.imageUrl}" class="w-full rounded-xl border border-slate-600 max-h-72 object-contain bg-slate-900 cursor-pointer" onclick="window.viewSlipImage('${h.imageUrl}', event)"></div>`
        : '';
    Swal.fire({
        html: `
        <div class="text-left space-y-3">
            <div class="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                <span class="font-black text-white text-lg">รายละเอียดสลิป</span>
                ${statusHtml}
            </div>
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="bg-slate-900 p-3 rounded-xl"><div class="text-gray-400 text-[10px] mb-1">เวลา</div><div class="text-white font-bold">${timeStr}</div></div>
                <div class="bg-slate-900 p-3 rounded-xl"><div class="text-gray-400 text-[10px] mb-1">ผู้ตรวจ</div><div class="text-amber-400 font-bold">${h.checkerName || '-'}</div></div>
                <div class="bg-slate-900 p-3 rounded-xl"><div class="text-gray-400 text-[10px] mb-1">ผู้โอน</div><div class="text-white font-bold">${h.senderName || '-'}</div></div>
                <div class="bg-slate-900 p-3 rounded-xl"><div class="text-gray-400 text-[10px] mb-1">ผู้รับ</div><div class="text-gray-300 font-bold">${h.receiverName || '-'}</div></div>
                <div class="bg-slate-900 p-3 rounded-xl col-span-2"><div class="text-gray-400 text-[10px] mb-1">ยอดเงิน</div><div class="text-${h.isFake ? 'red' : 'emerald'}-400 font-black text-xl">฿${parseFloat(h.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</div></div>
                <div class="bg-slate-900 p-3 rounded-xl col-span-2"><div class="text-gray-400 text-[10px] mb-1">เลขอ้างอิง</div><div class="text-sky-400 font-mono text-sm select-all">${h.ref || '-'}</div></div>
            </div>
            ${imgHtml}
        </div>`,
        showCloseButton: true,
        showConfirmButton: false,
        width: '480px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600' }
    });
};


const findDeep = (obj, key) => {
    if (typeof obj !== 'object' || obj === null) return undefined;
    if (obj.hasOwnProperty(key) && obj[key] !== undefined && obj[key] !== null && obj[key] !== '-') return obj[key];
    for (let k in obj) {
        let res = findDeep(obj[k], key);
        if (res !== undefined && res !== null && res !== '-') return res;
    }
    return undefined;
};

// ==========================================
// 🌟 2. ฟังก์ชันตรวจสอบสลิปหลัก
// ==========================================
window.verifyThunderSlip = async function() {
    if (!window.selectedSlipFile) {
        return Swal.fire('แจ้งเตือน', 'กรุณาอัปโหลดรูปภาพ หรือกด Ctrl+V เพื่อวางสลิปก่อนครับ', 'warning');
    }

    Swal.fire({
        title: 'กำลังสแกน QR Code...', html: 'โปรดรอสักครู่...',
        allowOutsideClick: false, didOpen: () => Swal.showLoading(),
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });

    try {
        const qrPayload = await window.extractQrPayload(window.selectedSlipFile);
        
        Swal.update({ title: 'เชื่อมต่อฐานข้อมูล...', html: 'กำลังดึงข้อมูลจากธนาคาร...' });
        // ประกอบจาก DB_URL ใน global.js — ย้ายโปรเจกต์ Supabase ทีจะได้แก้ที่เดียว
        const SUPABASE_FUNCTION_URL = `${DB_URL}/functions/v1/verify-slip`;

        const response = await fetch(SUPABASE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: qrPayload, checkDuplicate: true }) 
        });

        const result = await response.json();

        if (result.status === 200 || result.success === true) {
            const data = result.data || result; 

            // ดึงข้อมูลยอดเงิน
            let rawAmount = findDeep(data, 'amount');
            let amountVal = typeof rawAmount === 'object' ? (rawAmount.amount || 0) : (rawAmount || 0);
            let actualAmount = parseFloat(amountVal);

            // ดึงข้อมูลรายชื่อมาเตรียมไว้ก่อนตรวจสอบ
            const getName = (obj) => {
                if (!obj) return 'ไม่ระบุ';
                if (typeof obj === 'string') return obj;
                return findDeep(obj, 'th') || findDeep(obj, 'en') || findDeep(obj, 'displayName') || findDeep(obj, 'name') || 'ไม่ระบุ';
            };

            const getBank = (obj) => {
                if (!obj) return '-';
                if (typeof obj === 'string') return obj;
                return findDeep(obj, 'short') || findDeep(obj, 'name') || '-';
            };

            const getAccount = (obj) => {
                if (!obj) return '-';
                return findDeep(obj, 'value') || findDeep(obj, 'account') || findDeep(obj, 'anyId') || '-';
            };

            let senderObj = data.sender || {};
            let receiverObj = data.receiver || {};
            let senderName = getName(senderObj);
            let receiverName = getName(receiverObj);
            let transRef = findDeep(data, 'transRef') || findDeep(data, 'ref1') || '-';
            let transDate = findDeep(data, 'transDate') || findDeep(data, 'date');

            Swal.update({ title: 'AI กำลังอ่านตัวเลขและรายชื่อ...', html: 'ตรวจสอบสลิปตัดต่อด้วยระบบ AI...' });
            const ocrText = await window.performOCR(window.selectedSlipFile);

            let isFakeSlip = false;
            let isFakeName = false;
            let isFakeAmount = false;
            let fakeReasons = []; // เก็บเหตุผลความผิดปกติทั้งหมด
            let ocrDetectedAmount = actualAmount;

            // ── helper: normalize ตัดช่องว่าง + lowercase ──
            const normalizeText = (text) => text.replace(/\s+/g, '').toLowerCase();

            // ── helper: เทียบชื่อแบบมี tolerance (Tesseract อ่านผิดได้บ้าง) ──
            // คืน true = พบชื่อ (ผ่าน), false = ไม่พบ (น่าสงสัย)
            const nameFoundInOcr = (name, ocr) => {
                const normOcr = normalizeText(ocr);
                const normName = normalizeText(name);
                if (normOcr.includes(normName)) return true;

                // ลอง substring ย่อย: ถ้าชื่อยาว >= 4 ตัด 70% แรกก็พอ
                if (normName.length >= 4) {
                    const partial = normName.substring(0, Math.ceil(normName.length * 0.7));
                    if (normOcr.includes(partial)) return true;
                }

                // ลอง fuzzy: นับตัวอักษรที่ตรงกัน (OCR บางตัวอาจเพี้ยน 1-2 ตัว)
                // ถ้าตรงกัน >= 75% ถือว่าผ่าน
                let matchCount = 0;
                const chars = normName.split('');
                chars.forEach(c => { if (normOcr.includes(c)) matchCount++; });
                const matchRatio = matchCount / normName.length;
                if (matchRatio >= 0.75) return true;

                return false;
            };

            // ── helper: ตรวจยอดเงินแบบ fuzzy ±1 บาท (OCR กับ comma บางทีผิด) ──
            const amountFoundInOcr = (amount, ocr) => {
                const s1 = amount.toFixed(2);
                const s2 = amount.toLocaleString('en-US', {minimumFractionDigits: 2});
                if (ocr.includes(s1) || ocr.includes(s2)) return true;
                // ลอง ±0.01 เผื่อ OCR อ่าน .00 เป็น .0O หรืออื่นๆ
                for (let delta = -1; delta <= 1; delta += 0.01) {
                    const v = (amount + delta).toFixed(2);
                    if (ocr.includes(v)) return true;
                }
                return false;
            };

            if (ocrText.trim().length > 20) { // OCR ต้องอ่านได้อย่างน้อย 20 ตัวอักษร ไม่งั้น skip
                // ── 1. ตรวจยอดเงิน ──
                if (!amountFoundInOcr(actualAmount, ocrText)) {
                    // กรองเฉพาะตัวเลขที่น่าจะเป็น "ยอดโอน" (ไม่ใช่เลขบัญชี/เวลา)
                    // เลขบัญชีมักยาว > 10 หลัก, เวลามักเป็น HH:MM ไม่มี .xx
                    const numberMatches = ocrText.replace(/,/g, '').match(/\b\d{1,8}\.\d{2}\b/g) || [];
                    const candidates = numberMatches
                        .map(n => parseFloat(n))
                        .filter(n => n > 0 && n < 10000000); // กรองเลขแปลกๆ ออก

                    if (candidates.length > 0) {
                        // เอาตัวเลขที่ใกล้กับ actualAmount มากสุด
                        const closest = candidates.reduce((a, b) =>
                            Math.abs(b - actualAmount) < Math.abs(a - actualAmount) ? b : a
                        );
                        // ถือว่าปลอมเมื่อ: ตัวเลขที่อ่านได้ > actualAmount AND ห่างกันเกิน 1 บาท
                        if (closest > actualAmount && (closest - actualAmount) > 1) {
                            isFakeSlip = true;
                            isFakeAmount = true;
                            fakeReasons.push(`<b>ยอดเงินไม่ตรง:</b> รูปแสดง ฿${closest.toLocaleString('en-US', {minimumFractionDigits: 2})} แต่ QR บันทึกไว้ ฿${actualAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
                        }
                    }
                    // ถ้าหาตัวเลขไม่เจอเลย = OCR อ่านไม่ได้ → ไม่ตัดสิน (ไม่ใช่ปลอม)
                }

                // ── 2. ตรวจชื่อผู้โอน ──
                if (senderName !== 'ไม่ระบุ' && senderName !== '-' && !window._isMasked(senderName)) {
                    let cleanSender = senderName.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.|Mr\.|Mrs\.|Ms\.|Miss\.)\s*/i, '').trim();
                    let parts = cleanSender.split(/\s+/).filter(p => p.length >= 3);
                    // ต้องหาชื่อไม่เจอ "ทุก" ส่วน จึงจะถือว่าปลอม
                    // ถ้าหาเจออย่างน้อย 1 ส่วน = ผ่าน
                    if (parts.length > 0) {
                        const anyFound = parts.some(p => nameFoundInOcr(p, ocrText));
                        if (!anyFound) {
                            isFakeSlip = true;
                            isFakeName = true;
                            fakeReasons.push(`<b>ชื่อผู้โอนไม่ตรง:</b> ไม่พบ "${cleanSender}" บนสลิป (OCR อ่านได้: ${ocrText.substring(0,80).replace(/\n/g,' ')}...)`);
                        }
                    }
                }

                // ── 3. ตรวจชื่อผู้รับ ──
                if (receiverName !== 'ไม่ระบุ' && receiverName !== '-' && !window._isMasked(receiverName)) {
                    let cleanReceiver = receiverName.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.|Mr\.|Mrs\.|Ms\.|Miss\.)\s*/i, '').trim();
                    let parts = cleanReceiver.split(/\s+/).filter(p => p.length >= 3);
                    if (parts.length > 0) {
                        const anyFound = parts.some(p => nameFoundInOcr(p, ocrText));
                        if (!anyFound) {
                            isFakeSlip = true;
                            isFakeName = true;
                            fakeReasons.push(`<b>ชื่อผู้รับไม่ตรง:</b> ไม่พบ "${cleanReceiver}" บนสลิป`);
                        }
                    }
                }
            }
            // ถ้า OCR อ่านได้น้อยกว่า 20 ตัวอักษร = ข้ามการตรวจชื่อ/ยอดทั้งหมด ไม่ตัดสินผิดพลาด

            // 🔴 เพิ่มป้ายสถานะแบบละเอียด (ปกติ / ปลอมชื่อ / ปลอมจำนวนเงิน)
            let detailBadge = document.getElementById('slipDetailBadge');
            if (!detailBadge) {
                detailBadge = document.createElement('span');
                detailBadge.id = 'slipDetailBadge';
                const statusBadge = document.getElementById('slipStatusBadge');
                if (statusBadge) {
                    statusBadge.parentNode.insertBefore(detailBadge, statusBadge);
                }
            }
            
            detailBadge.className = "ml-auto mr-3 px-3 py-1 rounded-full text-[11px] font-black shadow-inner border ";
            if (isFakeSlip) {
                let fakeTypes = [];
                if (isFakeAmount) fakeTypes.push('ปลอมจำนวนเงิน');
                if (isFakeName) fakeTypes.push('ปลอมชื่อ');
                detailBadge.innerHTML = `<span class="material-icons text-[12px] align-middle mr-1">warning</span> ${fakeTypes.join(' และ ')}`;
                detailBadge.className += "bg-red-900/40 text-red-400 border-red-700/50";
            } else {
                detailBadge.innerHTML = `<span class="material-icons text-[12px] align-middle mr-1">task_alt</span> ข้อมูลปกติ`;
                detailBadge.className += "bg-emerald-900/40 text-emerald-400 border-emerald-700/50";
            }
            detailBadge.classList.remove('hidden');
            // -------------------------------------------------------------

            let isLocalDuplicate = window.slipHistoryData.some(h => h.ref === transRef && transRef !== '-');
            let isDuplicate = data.isDuplicate || isLocalDuplicate;

            const resAmountEl = document.getElementById('resAmount');
            resAmountEl.innerText = actualAmount.toLocaleString('en-US', {minimumFractionDigits: 2});
            
            if (isFakeSlip) { resAmountEl.classList.remove('text-emerald-400'); resAmountEl.classList.add('text-red-500'); } 
            else { resAmountEl.classList.add('text-emerald-400'); resAmountEl.classList.remove('text-red-500'); }

            document.getElementById('resSenderName').innerText = senderName;
            document.getElementById('resSenderBank').innerText = getBank(senderObj.bank);
            document.getElementById('resReceiverName').innerText = receiverName;
            document.getElementById('resReceiverBank').innerText = getBank(receiverObj.bank);
            document.getElementById('resReceiverAccount').innerText = getAccount(receiverObj);
            document.getElementById('resRef').innerText = transRef;
            if (transDate) document.getElementById('resDate').innerText = new Date(transDate).toLocaleString('th-TH');
            else document.getElementById('resDate').innerText = '-';

            document.getElementById('slipResultEmpty').classList.add('hidden'); document.getElementById('slipResultEmpty').classList.remove('flex');
            document.getElementById('slipResultData').classList.remove('hidden'); document.getElementById('slipResultData').classList.add('flex');

            // 🔴 🔴 อัปโหลดรูปสลิปขึ้น Storage ก่อนบันทึกประวัติ
            let uploadedImageUrl = null;
            if (!isDuplicate) { 
                Swal.update({ title: 'อัปโหลดสลิป...', html: 'กำลังบันทึกรูปภาพอ้างอิงเข้าระบบ...' });
                uploadedImageUrl = await window.uploadSlipToStorage(window.selectedSlipFile);
            }

            if (isDuplicate) {
                 updateSlipBadge('warning', 'สลิปถูกใช้แล้ว ⚠️');
                 Swal.fire({
                     icon: 'warning', title: '🚨 ตรวจพบสลิปซ้ำ!', 
                     html: 'สลิปนี้ <b>ได้มีการค้นหาในระบบไปแล้ว</b><br>ห้ามนำมาทำรายการซ้ำเด็ดขาด!', 
                     confirmButtonText: 'รับทราบ', confirmButtonColor: '#f59e0b'
                 });
            } else if (isFakeSlip) {
                updateSlipBadge('error', 'สลิปไม่ตรงปก ❌');
                let reasonHtml = fakeReasons.map(r => `<li style="margin-bottom:6px;">- ${r}</li>`).join('');
                
                Swal.fire({
                    icon: 'error', title: '🚨 AI จับโป๊ะสลิปไม่ตรงปก!',
                    html: `ระบบตรวจพบความผิดปกติ ดังนี้:<br><ul style="text-align:left; display:inline-block; margin-top:15px; font-size:14px; color:#ef4444;">${reasonHtml}</ul>`,
                    confirmButtonColor: '#ef4444'
                });
                
                window.saveSlipHistory({
                    success: true, isFake: true,
                    data: { amount: actualAmount, sender: { name: senderName }, receiver: { name: receiverName }, transRef: transRef, date: transDate },
                    imageUrl: uploadedImageUrl 
                }, true);

            } else {
                 updateSlipBadge('success', 'สลิปถูกต้อง ✅');
                 Swal.fire({icon: 'success', title: 'สลิปจริง', text: 'ชื่อและยอดเงินบนรูปตรงกับระบบธนาคาร', timer: 1500, showConfirmButton: false});
                 
                 window.saveSlipHistory({
                     success: true, isFake: false,
                     data: { amount: actualAmount, sender: { name: senderName }, receiver: { name: receiverName }, transRef: transRef, date: transDate },
                     imageUrl: uploadedImageUrl 
                 }, true);
            }

        } else {
            updateSlipBadge('error', 'สลิปไม่ถูกต้อง ❌');
            let errorMsg = result.message || 'สลิปนี้ไม่ถูกต้อง หรือไม่สามารถอ่าน QR Code ได้';
            if (errorMsg === 'quota_exceeded') errorMsg = 'โควต้าการตรวจสอบสลิปของ Thunder หมดแล้ว';
            else if (errorMsg === 'unauthorized') errorMsg = 'API Key ของ Thunder ไม่ถูกต้อง';
            Swal.fire('ตรวจพบปัญหา', errorMsg, 'error');
        }

    } catch (error) {
        console.error("Slip API Error:", error);
        updateSlipBadge('error', 'เชื่อมต่อขัดข้อง');
        Swal.fire('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ตรวจสอบได้', 'error');
    }
};

// ==========================================