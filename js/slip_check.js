// ==========================================
// 🌟 โหลดข้อมูลพื้นฐานและสิทธิ์ผู้ใช้งาน
// ==========================================

// ดึงประวัติจากที่บันทึกไว้ในเครื่องเบื้องต้น
window.slipHistoryData = JSON.parse(localStorage.getItem('slip_check_history') || '[]');
window.qrHistoryData = JSON.parse(localStorage.getItem('qr_check_history') || '[]');
window.selectedSlipFile = null;

// ดึงชื่อและสิทธิ์ (รองรับระบบ Session ใหม่)
window.getCurrentUserName = () => {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) return currentUser.username;
    const savedUser = sessionStorage.getItem('user_platinum_plus');
    if (savedUser) { try { const user = JSON.parse(savedUser); if (user.username) return user.username; } catch(e) {} }
    return localStorage.getItem('username') || localStorage.getItem('name') || 'แอดมิน';
};

window.getCurrentUserRole = () => {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role) return currentUser.role;
    const savedUser = sessionStorage.getItem('user_platinum_plus');
    if (savedUser) { try { const user = JSON.parse(savedUser); if (user.role) return user.role; } catch(e) {} }
    return localStorage.getItem('role') || localStorage.getItem('userRole') || 'manager'; 
};

// ==========================================
// 🌟 ระบบเชื่อมต่อฐานข้อมูล (Supabase) และ Real-time
// ==========================================
window.syncChannel = null; // 🌟 เพิ่มตัวแปรเตรียมรับสัญญาณ

window.fetchSlipHistoryDB = async function() {
    try {
        if (typeof appDB !== 'undefined') {
            const { data } = await appDB.from('settings').select('value').eq('key', 'slip_check_history').single();
            if (data && data.value) {
                window.slipHistoryData = JSON.parse(data.value);
                localStorage.setItem('slip_check_history', data.value);
            }
        }
    } catch (e) { console.error('Fetch Slip DB Error:', e); }
};

window.fetchQRHistoryDB = async function() {
    try {
        if (typeof appDB !== 'undefined') {
            const { data } = await appDB.from('settings').select('value').eq('key', 'qr_check_history').single();
            if (data && data.value) {
                window.qrHistoryData = JSON.parse(data.value);
                localStorage.setItem('qr_check_history', data.value);
            }
        }
    } catch (e) { console.error('Fetch QR DB Error:', e); }
};

// 🚀 เพิ่มฟังก์ชัน Broadcast รับสัญญาณกระซิบจากเครื่องคนอื่น (ไม่กินโควต้า DB)
window.initRealtimeSync = function() {
    if (typeof appDB === 'undefined') return;
    
    if (window.syncChannel) appDB.removeChannel(window.syncChannel);
    
    // สร้างห้องสื่อสารสำหรับพนักงาน
    window.syncChannel = appDB.channel('history-sync-room');
    
    window.syncChannel
        .on('broadcast', { event: 'update_slip' }, (payload) => {
            // เมื่อเครื่องอื่นสแกนสลิป เครื่องเราจะอัปเดตหน้าจอทันที
            if (payload.payload) {
                window.slipHistoryData = payload.payload;
                localStorage.setItem('slip_check_history', JSON.stringify(window.slipHistoryData));
                if (document.getElementById('slipHistoryBody')) window.renderSlipHistory();
                if (document.getElementById('fakeHistoryBody') && typeof window.renderFakeHistory === 'function') window.renderFakeHistory();
            }
        })
        .on('broadcast', { event: 'update_qr' }, (payload) => {
            // เมื่อเครื่องอื่นสแกน QR เครื่องเราจะอัปเดตหน้าจอทันที
            if (payload.payload) {
                window.qrHistoryData = payload.payload;
                localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
                if (document.getElementById('qrHistoryBody')) window.renderQRHistory();
            }
        })
        .subscribe();

    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window.syncChannel);
};

// ─── Lazy Load หนัก ────────────────────────
async function _loadSlipLibs() {
    const load = (src) => new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) return res();
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
    });
    await Promise.all([
        typeof jsQR      === 'undefined' ? load('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js') : Promise.resolve(),
        typeof Tesseract === 'undefined' ? load('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js') : Promise.resolve(),
    ]);
}

window.initSlipCheck = async function() {
    window.clearSlipUpload();
    window.clearQRReceiver();

    // โหลด jsQR + Tesseract แบบ lazy (ไม่กระทบหน้าอื่น)
    await _loadSlipLibs();

    // 1. โหลดประวัติจาก DB กลาง (ทำแค่ครั้งแรกตอนเปิดหน้าเว็บ)
    await window.fetchSlipHistoryDB();
    await window.fetchQRHistoryDB();
    
    window.renderSlipHistory();
    window.renderQRHistory();
    if (typeof window.renderFakeHistory === 'function') window.renderFakeHistory();

    // 2. 🌟 เปิดระบบรอรับสัญญาณ Real-time แบบ Broadcast
    window.initRealtimeSync();
};

// ==========================================
// 🌟 ระบบสลับโหมด (Tabs)
// ==========================================
window.switchSlipTab = function(tabName) {
    const btnSlip = document.getElementById('tabBtnSlip');
    const btnQR = document.getElementById('tabBtnQR');
    const btnFake = document.getElementById('tabBtnFake'); 
    const contentSlip = document.getElementById('tabContentSlip');
    const contentQR = document.getElementById('tabContentQR');
    const contentFake = document.getElementById('tabContentFake'); 

    // รีเซ็ตปุ่มทั้งหมด
    [btnSlip, btnQR, btnFake].forEach(btn => {
        if(btn) btn.className = "px-5 py-2.5 bg-[#151f32] text-gray-400 rounded-lg hover:bg-slate-800 font-bold text-sm flex items-center gap-2 transition border border-slate-700 whitespace-nowrap";
    });
    
    // ซ่อนเนื้อหาทั้งหมด
    [contentSlip, contentQR, contentFake].forEach(content => {
        if(content) {
            content.classList.add('hidden');
            content.classList.remove('flex');
        }
    });

    if(tabName === 'slip') {
        if(btnSlip) btnSlip.className = "px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg text-sm flex items-center gap-2 transition whitespace-nowrap";
        if(contentSlip) contentSlip.classList.remove('hidden');
    } else if (tabName === 'qr') {
        if(btnQR) btnQR.className = "px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg text-sm flex items-center gap-2 transition whitespace-nowrap";
        if(contentQR) {
            contentQR.classList.remove('hidden');
            contentQR.classList.add('flex');
        }
    } else if (tabName === 'fake') {
        if(btnFake) btnFake.className = "px-5 py-2.5 bg-red-600 text-white rounded-lg font-bold shadow-lg text-sm flex items-center gap-2 transition whitespace-nowrap";
        if(contentFake) {
            contentFake.classList.remove('hidden');
            contentFake.classList.add('flex');
        }
        window.renderFakeHistory();
    }
};

// ==========================================
// 🌟 โหมดที่ 2: เช็ค QR Code ผู้รับเงิน
// ==========================================
window.clearQRReceiver = function() {
    const qrInput = document.getElementById('qrReceiverInput');
    if (qrInput) qrInput.value = '';
    
    const qrImg = document.getElementById('qrReceiverImg');
    if (qrImg) {
        qrImg.src = '';
        qrImg.classList.add('hidden');
    }
    
    const qrPlaceholder = document.getElementById('qrReceiverPlaceholder');
    if (qrPlaceholder) qrPlaceholder.classList.remove('opacity-0');
    
    const resultEmpty = document.getElementById('qrResultEmpty');
    if (resultEmpty) resultEmpty.classList.remove('hidden');
    
    const resultData = document.getElementById('qrResultData');
    if (resultData) resultData.classList.add('hidden');
};

window.handleScanQRReceiver = async function(event) {
    const file = event.target.files[0];
    if(!file) return;

    // แสดงพรีวิวรูป
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('qrReceiverImg').src = e.target.result;
        document.getElementById('qrReceiverImg').classList.remove('hidden');
        document.getElementById('qrReceiverPlaceholder').classList.add('opacity-0');
    };
    reader.readAsDataURL(file);

    Swal.fire({ title: 'กำลังสแกน...', didOpen: () => Swal.showLoading(), allowOutsideClick: false, customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' } });

    try {
        const qrText = await window.extractQrPayload(file);
        
        let type = 'ข้อมูลทั่วไป / ลิงก์';
        let account = '-';

        // 🌟 ถอดรหัส PromptPay (EMVCo Standard)
        const phoneMatch = qrText.match(/01130066(\d{9})/);
        const nidMatch = qrText.match(/0213(\d{13})/);
        const ewalletMatch = qrText.match(/0315(\d{15})/);

        if (phoneMatch) {
            type = '💳 พร้อมเพย์ (เบอร์โทรศัพท์)';
            account = '0' + phoneMatch[1]; // แปลง 0066 8x เป็น 08x
        } else if (nidMatch) {
            type = '🪪 พร้อมเพย์ (บัตรประชาชน)';
            account = nidMatch[1];
        } else if (ewalletMatch) {
            type = '📱 พร้อมเพย์ (e-Wallet / e-Money)';
            account = ewalletMatch[1];
        } else if (qrText.startsWith('000201')) {
            type = '🏦 QR Code โอนเงิน (มาตรฐานธนาคาร)';
            account = 'ไม่สามารถระบุเลขบัญชีได้ (ข้อมูลเข้ารหัส)';
        } else {
            type = '🔗 QR Code ทั่วไป';
            account = qrText.length > 50 ? qrText.substring(0, 50) + '...' : qrText;
        }

        // แสดงผล
        document.getElementById('resQrType').innerText = type;
        document.getElementById('resQrAccount').innerText = account;
        document.getElementById('resQrRaw').innerText = qrText;

        document.getElementById('qrResultEmpty').classList.add('hidden');
        document.getElementById('qrResultData').classList.remove('hidden');
        document.getElementById('qrResultData').classList.add('flex');

        Swal.fire({icon: 'success', title: 'อ่านข้อมูลสำเร็จ', timer: 1000, showConfirmButton: false});

        // 🌟 บันทึกประวัติ QR ลงฐานข้อมูลทันที
        window.saveQRHistory({ type: type, account: account, raw: qrText });

    } catch (e) {
        Swal.fire('ตรวจพบปัญหา', 'รูปภาพนี้ไม่มี QR Code หรือสแกนไม่ผ่านครับ', 'error');
        window.clearQRReceiver();
    }
};

// ==========================================
// 🌟 ระบบประวัติย้อนหลัง สำหรับ "สแกน QR ผู้รับเงิน"
// ==========================================
window.saveQRHistory = async function(data) {
    const newEntry = {
        id: 'qr_' + Date.now(),
        timestamp: Date.now(),
        type: data.type,
        account: data.account,
        raw: data.raw,
        checkerName: window.getCurrentUserName() // บันทึกชื่อคนทำรายการ
    };
    
    window.qrHistoryData.unshift(newEntry);
    if (window.qrHistoryData.length > 200) window.qrHistoryData.pop(); 
    
    localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
    
    // ซิงค์ขึ้นฐานข้อมูล
    if (typeof appDB !== 'undefined') {
        await appDB.from('settings').upsert([{ key: 'qr_check_history', value: JSON.stringify(window.qrHistoryData) }]);
        
        // 🌟 ส่งสัญญาณ Broadcast บอกเครื่องอื่นให้อัปเดตหน้าจอทันที
        if (window.syncChannel) {
            window.syncChannel.send({ type: 'broadcast', event: 'update_qr', payload: window.qrHistoryData });
        }
    }
    
    window.renderQRHistory();
};

window.renderQRHistory = function() {
    const tbody = document.getElementById('qrHistoryBody');
    if (!tbody) return;
    
    const search = document.getElementById('qrHistorySearch') ? document.getElementById('qrHistorySearch').value.toLowerCase() : '';
    
    const filtered = window.qrHistoryData.filter(h => 
        (h.account && h.account.toLowerCase().includes(search)) ||
        (h.type && h.type.toLowerCase().includes(search)) ||
        (h.checkerName && h.checkerName.toLowerCase().includes(search))
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-500 font-bold bg-[#151f32] text-xs">ไม่พบประวัติการสแกน QR Code</td></tr>`;
        return;
    }

    const role = window.getCurrentUserRole().toLowerCase();
    const isManager = (role === 'manager' || role === 'admin' || role === 'vip' || role === 'ผู้จัดการ');
    const canDelete = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('slip_check_delete') : isManager;
    
    tbody.innerHTML = filtered.map(h => {
        const timeStr = new Date(h.timestamp).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
        
        const actionBtn = canDelete 
            ? `<button onclick="window.deleteQRHistory('${h.id}', event)" class="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1.5 rounded-lg transition" title="ลบประวัติ"><span class="material-icons text-[18px]">delete</span></button>`
            : `<span class="text-slate-600 material-icons text-[16px]" title="ไม่มีสิทธิ์ลบ">block</span>`;
            
        return `
            <tr class="hover:bg-slate-800 transition border-b border-slate-800/50">
                <td class="p-3 text-xs text-gray-400 font-mono">${timeStr} น.</td>
                <td class="p-3 text-xs text-sky-400 font-bold">${h.type || '-'}</td>
                <td class="p-3 font-mono font-bold text-emerald-400 text-sm tracking-wider select-all">${h.account || '-'}</td>
                <td class="p-3 text-xs text-amber-300 font-semibold">${h.checkerName || '-'}</td>
                <td class="p-3 text-center">${actionBtn}</td>
            </tr>
        `;
    }).join('');
};

window.filterQRHistory = function() { window.renderQRHistory(); };

window.deleteQRHistory = function(id, event) {
    if (event) event.stopPropagation(); 
    Swal.fire({
        title: 'ยืนยันการลบประวัติ?',
        text: "คุณต้องการลบประวัติการสแกน QR นี้ใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#4b5563',
        confirmButtonText: 'ลบเลย',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.qrHistoryData = window.qrHistoryData.filter(h => h.id !== id);
            localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
            
            if (typeof appDB !== 'undefined') {
                await appDB.from('settings').upsert([{ key: 'qr_check_history', value: JSON.stringify(window.qrHistoryData) }]);
                
                // 🌟 ส่งสัญญาณบอกเครื่องอื่นให้ลบรายการนี้ออกจากหน้าจอ
                if (window.syncChannel) {
                    window.syncChannel.send({ type: 'broadcast', event: 'update_qr', payload: window.qrHistoryData });
                }
            }
            
            window.renderQRHistory();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    });
};

// ==========================================
// 🌟 โหมดที่ 1: เช็คสลิปโอนเงิน (OCR & API)
// ==========================================

window.handleSlipUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    window.selectedSlipFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('slipPreviewImg').src = e.target.result;
        document.getElementById('slipPreviewImg').classList.remove('hidden');
        document.getElementById('slipUploadPlaceholder').classList.add('opacity-0'); 
    };
    reader.readAsDataURL(file);

    updateSlipBadge('ready', 'พร้อมตรวจสอบ');
};

window.clearSlipUpload = function() {
    window.selectedSlipFile = null;
    
    const slipInput = document.getElementById('slipUploadInput');
    if (slipInput) slipInput.value = '';
    
    const slipImg = document.getElementById('slipPreviewImg');
    if (slipImg) {
        slipImg.src = '';
        slipImg.classList.add('hidden');
    }
    
    const slipPlaceholder = document.getElementById('slipUploadPlaceholder');
    if (slipPlaceholder) slipPlaceholder.classList.remove('opacity-0');
    
    const resultEmpty = document.getElementById('slipResultEmpty');
    if (resultEmpty) {
        resultEmpty.classList.remove('hidden');
        resultEmpty.classList.add('flex');
    }
    
    const resultData = document.getElementById('slipResultData');
    if (resultData) {
        resultData.classList.add('hidden');
        resultData.classList.remove('flex');
    }
    
    // 🔴 ซ่อนป้ายรายละเอียดความผิดปกติเมื่อล้างรูปภาพ
    const detailBadge = document.getElementById('slipDetailBadge');
    if (detailBadge) detailBadge.classList.add('hidden');
    
    updateSlipBadge('none', 'รอรูปภาพ...');
};

window.updateSlipBadge = function(type, text) {
    const badge = document.getElementById('slipStatusBadge');
    if (!badge) return;
    
    badge.innerText = text;
    badge.className = "px-3 py-1 rounded-full text-xs font-black shadow-inner border ";
    
    if (type === 'ready') badge.className += "bg-indigo-900/40 text-indigo-400 border-indigo-700/50";
    else if (type === 'success') badge.className += "bg-emerald-900/40 text-emerald-400 border-emerald-700/50";
    else if (type === 'error') badge.className += "bg-red-900/40 text-red-400 border-red-700/50";
    else if (type === 'warning') badge.className += "bg-yellow-900/40 text-yellow-400 border-yellow-700/50";
    else badge.className += "bg-slate-800 text-gray-400 border-slate-600";
};

// ==========================================
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
        const SUPABASE_FUNCTION_URL = 'https://zedbbtjxuidfubpiauyb.supabase.co/functions/v1/verify-slip'; 

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

            if (ocrText.trim() !== "") {
                // 1. ตรวจสอบยอดเงิน (Amount)
                const amountStr1 = actualAmount.toFixed(2); 
                const amountStr2 = actualAmount.toLocaleString('en-US', {minimumFractionDigits: 2});
                const hasRealAmount = ocrText.includes(amountStr1) || ocrText.includes(amountStr2);

                if (!hasRealAmount) {
                    const numberMatches = ocrText.replace(/,/g, '').match(/\d+\.\d{2}/g) || [];
                    const extractedNumbers = numberMatches.map(n => parseFloat(n));

                    if (extractedNumbers.length > 0) {
                        ocrDetectedAmount = Math.max(...extractedNumbers); 
                        if (ocrDetectedAmount !== actualAmount && ocrDetectedAmount > actualAmount) {
                            isFakeSlip = true; 
                            isFakeAmount = true;
                            fakeReasons.push(`<b>ยอดเงินไม่ตรง:</b> ตรวจพบ ฿${ocrDetectedAmount.toLocaleString('en-US', {minimumFractionDigits: 2})} แต่ QR คือ ฿${actualAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
                        }
                    }
                }

                // ฟังก์ชันช่วยเคลียร์ช่องว่างเพื่อให้เปรียบเทียบชื่อได้แม่นยำขึ้น
                const normalizeText = (text) => text.replace(/\s+/g, '').toLowerCase();
                const normalizedOcr = normalizeText(ocrText);

                // 2. ตรวจสอบชื่อผู้โอน (Sender)
                // ข้ามการตรวจถ้าชื่อมีเครื่องหมายดอกจัน (*) เซ็นเซอร์มาจากธนาคาร
                if (senderName !== 'ไม่ระบุ' && senderName !== '-' && !window._isMasked(senderName)) {
                    // ตัดคำนำหน้าออกป้องกัน OCR ผิดเพี้ยน
                    let cleanSender = senderName.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.|Mr\.|Mrs\.|Ms\.|Miss\.)\s*/i, '').trim();
                    let senderParts = cleanSender.split(/\s+/);
                    // หยิบเฉพาะชื่อแรก (ความยาว > 2) ไปค้นหาในสลิป
                    if (senderParts.length > 0 && senderParts[0].length > 2) {
                        let firstPart = normalizeText(senderParts[0]);
                        if (!normalizedOcr.includes(firstPart)) {
                            isFakeSlip = true;
                            isFakeName = true;
                            fakeReasons.push(`<b>ชื่อผู้โอนไม่ตรง:</b> ไม่พบคำว่า "${senderParts[0]}" บนสลิป`);
                        }
                    }
                }

                // 3. ตรวจสอบชื่อผู้รับ (Receiver)
                if (receiverName !== 'ไม่ระบุ' && receiverName !== '-' && !window._isMasked(receiverName)) {
                    let cleanReceiver = receiverName.replace(/^(นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.|Mr\.|Mrs\.|Ms\.|Miss\.)\s*/i, '').trim();
                    let receiverParts = cleanReceiver.split(/\s+/);
                    if (receiverParts.length > 0 && receiverParts[0].length > 2) {
                        let firstPart = normalizeText(receiverParts[0]);
                        if (!normalizedOcr.includes(firstPart)) {
                            isFakeSlip = true;
                            isFakeName = true;
                            fakeReasons.push(`<b>ชื่อผู้รับไม่ตรง:</b> ไม่พบคำว่า "${receiverParts[0]}" บนสลิป`);
                        }
                    }
                }
            }

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
// 🌟 3. ระบบบันทึก ลบ และแสดงผลประวัติ 
// ==========================================

window.saveSlipHistory = async function(result, isSuccess) {
    const isFake = result.isFake || false;
    const newEntry = {
        id: 'slip_' + Date.now(),
        timestamp: Date.now(),
        success: isSuccess,
        isFake: isFake,
        checkerName: window.getCurrentUserName(),
        amount: isSuccess && result.data ? result.data.amount : 0,
        senderName: isSuccess && result.data ? (result.data.sender?.name || '') : '',
        receiverName: isSuccess && result.data ? (result.data.receiver?.name || '') : '',
        ref: isSuccess && result.data ? (result.data.transRef || result.data.ref1 || '') : '',
        date: isSuccess && result.data ? (result.data.date || '') : '',
        imageUrl: result.imageUrl || null 
    };
    
    if (typeof appDB !== 'undefined') {
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'slip_check_history').single();
            if (data && data.value) window.slipHistoryData = JSON.parse(data.value);
        } catch (e) { console.error("Error fetching before save:", e); }
        
        window.slipHistoryData.unshift(newEntry);
        if (window.slipHistoryData.length > 200) window.slipHistoryData.pop(); 
        
        localStorage.setItem('slip_check_history', JSON.stringify(window.slipHistoryData));
        await appDB.from('settings').upsert([{ key: 'slip_check_history', value: JSON.stringify(window.slipHistoryData) }]);
        
        if (window.syncChannel) window.syncChannel.send({ type: 'broadcast', event: 'update_slip', payload: window.slipHistoryData });
    } else {
        window.slipHistoryData.unshift(newEntry);
        if (window.slipHistoryData.length > 200) window.slipHistoryData.pop(); 
        localStorage.setItem('slip_check_history', JSON.stringify(window.slipHistoryData));
    }
    
    window.renderSlipHistory();
    if (typeof window.renderFakeHistory === 'function') window.renderFakeHistory();
};

window.deleteSlipHistory = function(id, event) {
    if(event) event.stopPropagation(); 
    Swal.fire({
        title: 'ยืนยันการลบประวัติ?', 
        text: 'หากมีรูปสลิป รูปจะถูกลบทิ้งอย่างถาวรด้วย',
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#4b5563', confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const slipToDelete = window.slipHistoryData.find(h => h.id === id);
            if (slipToDelete && slipToDelete.imageUrl && typeof appDB !== 'undefined') {
                try {
                    const urlParts = slipToDelete.imageUrl.split('/slips/');
                    if (urlParts.length === 2) {
                        await appDB.storage.from('slips').remove([urlParts[1]]);
                    }
                } catch(e) { console.error('Delete image error:', e); }
            }

            if (typeof appDB !== 'undefined') {
                try {
                    const { data } = await appDB.from('settings').select('value').eq('key', 'slip_check_history').single();
                    if (data && data.value) window.slipHistoryData = JSON.parse(data.value);
                } catch(e) {}
            }

            window.slipHistoryData = window.slipHistoryData.filter(h => h.id !== id);
            localStorage.setItem('slip_check_history', JSON.stringify(window.slipHistoryData));
            
            if (typeof appDB !== 'undefined') {
                await appDB.from('settings').upsert([{ key: 'slip_check_history', value: JSON.stringify(window.slipHistoryData) }]);
                if (window.syncChannel) window.syncChannel.send({ type: 'broadcast', event: 'update_slip', payload: window.slipHistoryData });
            }
            
            window.renderSlipHistory();
            if(typeof window.renderFakeHistory === 'function') window.renderFakeHistory();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    });
};

window.renderSlipHistory = function() {
    const tbody = document.getElementById('slipHistoryBody');
    if (!tbody) return;
    
    const search = document.getElementById('slipHistorySearch') ? document.getElementById('slipHistorySearch').value.toLowerCase() : '';
    
    const filtered = window.slipHistoryData.filter(h => {
        if (!search) return true;
        return (h.senderName && h.senderName.toLowerCase().includes(search)) ||
               (h.receiverName && h.receiverName.toLowerCase().includes(search)) ||
               (h.ref && h.ref.toLowerCase().includes(search)) ||
               (h.checkerName && h.checkerName.toLowerCase().includes(search));
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500 font-bold bg-[#151f32] text-xs">ไม่พบประวัติการตรวจสอบ</td></tr>`;
        return;
    }

    const role = window.getCurrentUserRole().toLowerCase();
    const isManager = (role === 'manager' || role === 'admin' || role === 'vip' || role === 'ผู้จัดการ');
    const canDelete = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('slip_check_delete') : isManager;
    
    tbody.innerHTML = filtered.map(h => {
        const timeStr = new Date(h.timestamp).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
        let statusBadge = h.isFake ? `<span class="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 mx-auto w-fit">ปลอม!</span>` : (h.success ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 mx-auto w-fit">สำเร็จ</span>` : `<span class="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 mx-auto w-fit">ไม่สำเร็จ</span>`);
        
        const viewImgBtn = h.imageUrl 
            ? `<button onclick="window.viewSlipImage('${h.imageUrl}', event)" class="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1.5 rounded-lg transition" title="ดูรูปสลิป"><span class="material-icons text-[18px]">image</span></button>` 
            : `<span class="text-slate-600 material-icons text-[16px] p-1.5" title="ไม่มีรูป">image_not_supported</span>`;
            
        const delBtn = canDelete 
            ? `<button onclick="window.deleteSlipHistory('${h.id}', event)" class="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1.5 rounded-lg transition"><span class="material-icons text-[18px]">delete</span></button>` 
            : `<span class="text-slate-600 material-icons text-[16px] p-1.5">block</span>`;
            
        const actionBtns = `<div class="flex items-center justify-center gap-1">${viewImgBtn}${delBtn}</div>`;

        return `<tr class="hover:bg-slate-800 transition cursor-pointer border-b border-slate-800/50 group" onclick="window.viewHistoryDetail('${h.id}')"><td class="p-3 text-xs text-gray-400 font-mono">${timeStr} น.</td><td class="p-3 font-mono text-xs text-sky-400 font-bold">${h.ref || '-'}</td><td class="p-3 font-bold text-sm text-gray-200">${h.senderName || '-'}</td><td class="p-3 text-xs text-gray-400">${h.receiverName || '-'}</td><td class="p-3 text-right font-mono font-bold ${h.isFake ? 'text-red-400':'text-emerald-400'}">฿${parseFloat(h.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td class="p-3 text-center">${statusBadge}</td><td class="p-3 text-xs text-amber-300 font-semibold">${h.checkerName || '-'}</td><td class="p-3 text-center">${actionBtns}</td></tr>`;
    }).join('');
};

window.renderFakeHistory = function() {
    const tbody = document.getElementById('fakeHistoryBody');
    if (!tbody) return;
    const search = document.getElementById('fakeHistorySearch') ? document.getElementById('fakeHistorySearch').value.toLowerCase() : '';
    
    const fakes = window.slipHistoryData.filter(h => h.isFake);
    const filtered = fakes.filter(h => {
        if (!search) return true; 
        return (h.senderName && h.senderName.toLowerCase().includes(search)) ||
               (h.receiverName && h.receiverName.toLowerCase().includes(search)) ||
               (h.checkerName && h.checkerName.toLowerCase().includes(search));
    });
    
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-500 font-bold bg-[#151f32] text-xs">ไม่พบประวัติผู้โอนสลิปปลอม</td></tr>`; return; }
    
    tbody.innerHTML = filtered.map(h => {
        const timeStr = new Date(h.timestamp).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
        return `<tr class="hover:bg-red-900/20 transition border-b border-slate-800/50"><td class="p-3 text-xs text-gray-400 font-mono">${timeStr} น.</td><td class="p-3 font-bold text-sm text-red-400">${h.senderName || '-'}</td><td class="p-3 text-xs text-gray-400">${h.receiverName || '-'}</td><td class="p-3 text-right font-mono font-bold text-red-500">฿${parseFloat(h.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td class="p-3 text-xs text-amber-300 font-semibold">${h.checkerName || '-'}</td></tr>`;
    }).join('');
};

window.filterFakeHistory = function() { window.renderFakeHistory(); };

// ==========================================
// 🌟 ประวัติการสแกน QR Code
// ==========================================

window.saveQRHistory = async function(data) {
    const newEntry = {
        id: 'qr_' + Date.now(), timestamp: Date.now(), type: data.type, account: data.account, raw: data.raw,
        checkerName: window.getCurrentUserName() 
    };
    
    if (typeof appDB !== 'undefined') {
        try {
            const { data: dbData } = await appDB.from('settings').select('value').eq('key', 'qr_check_history').single();
            if (dbData && dbData.value) window.qrHistoryData = JSON.parse(dbData.value);
        } catch(e) {}
        
        window.qrHistoryData.unshift(newEntry);
        if (window.qrHistoryData.length > 200) window.qrHistoryData.pop(); 
        
        localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
        await appDB.from('settings').upsert([{ key: 'qr_check_history', value: JSON.stringify(window.qrHistoryData) }]);
        if (window.syncChannel) window.syncChannel.send({ type: 'broadcast', event: 'update_qr', payload: window.qrHistoryData });
    } else {
        window.qrHistoryData.unshift(newEntry);
        if (window.qrHistoryData.length > 200) window.qrHistoryData.pop(); 
        localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
    }
    
    window.renderQRHistory();
};

window.deleteQRHistory = function(id, event) {
    if (event) event.stopPropagation(); 
    Swal.fire({
        title: 'ยืนยันการลบประวัติ?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#4b5563', confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            if (typeof appDB !== 'undefined') {
                try {
                    const { data } = await appDB.from('settings').select('value').eq('key', 'qr_check_history').single();
                    if (data && data.value) window.qrHistoryData = JSON.parse(data.value);
                } catch(e) {}
            }

            window.qrHistoryData = window.qrHistoryData.filter(h => h.id !== id);
            localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
            
            if (typeof appDB !== 'undefined') {
                await appDB.from('settings').upsert([{ key: 'qr_check_history', value: JSON.stringify(window.qrHistoryData) }]);
                if (window.syncChannel) window.syncChannel.send({ type: 'broadcast', event: 'update_qr', payload: window.qrHistoryData });
            }
            
            window.renderQRHistory();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    });
};

window.renderQRHistory = function() {
    const tbody = document.getElementById('qrHistoryBody');
    if (!tbody) return;
    const search = document.getElementById('qrHistorySearch') ? document.getElementById('qrHistorySearch').value.toLowerCase() : '';
    
    const filtered = window.qrHistoryData.filter(h => {
        if (!search) return true; 
        return (h.account && h.account.toLowerCase().includes(search)) ||
               (h.type && h.type.toLowerCase().includes(search)) ||
               (h.checkerName && h.checkerName.toLowerCase().includes(search));
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-500 font-bold bg-[#151f32] text-xs">ไม่พบประวัติการสแกน QR Code</td></tr>`;
        return;
    }

    const role = window.getCurrentUserRole().toLowerCase();
    const isManager = (role === 'manager' || role === 'admin' || role === 'vip' || role === 'ผู้จัดการ');
    const canDelete = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('slip_check_delete') : isManager;
    
    tbody.innerHTML = filtered.map(h => {
        const timeStr = new Date(h.timestamp).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
        const actionBtn = canDelete ? `<button onclick="window.deleteQRHistory('${h.id}', event)" class="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1.5 rounded-lg transition"><span class="material-icons text-[18px]">delete</span></button>` : `<span class="text-slate-600 material-icons text-[16px]">block</span>`;
        return `<tr class="hover:bg-slate-800 transition border-b border-slate-800/50"><td class="p-3 text-xs text-gray-400 font-mono">${timeStr} น.</td><td class="p-3 text-xs text-sky-400 font-bold">${h.type || '-'}</td><td class="p-3 font-mono font-bold text-emerald-400 text-sm tracking-wider select-all">${h.account || '-'}</td><td class="p-3 text-xs text-amber-300 font-semibold">${h.checkerName || '-'}</td><td class="p-3 text-center">${actionBtn}</td></tr>`;
    }).join('');
};

window.filterQRHistory = function() { window.renderQRHistory(); };

// ==========================================
// 🌟 ฟังก์ชันอื่นๆ (คัดลอก และ วางสลิป)
// ==========================================
window.copyToClipboard = function(text, btnElement, event) {
    if (event) event.stopPropagation(); 
    if (!text || text === '-') return;
    
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = '<span class="material-icons text-[18px] text-emerald-400">check</span>';
        btnElement.classList.add('border-emerald-500/50', 'bg-emerald-900/30');
        
        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
            btnElement.classList.remove('border-emerald-500/50', 'bg-emerald-900/30');
        }, 1500); 
    }).catch(err => console.error('คัดลอกไม่สำเร็จ: ', err));
};

document.addEventListener('paste', function(e) {
    const slipPage = document.getElementById('slipCheckPage');
    if (!slipPage) return;
    
    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            let blob = item.getAsFile();
            const file = new File([blob], "pasted_slip.png", { type: item.type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            const contentQR = document.getElementById('tabContentQR');
            if (contentQR && !contentQR.classList.contains('hidden')) {
                const qrInput = document.getElementById('qrReceiverInput');
                if (qrInput) {
                    qrInput.files = dataTransfer.files;
                    window.handleScanQRReceiver({ target: qrInput });
                }
            } else {
                const slipInput = document.getElementById('slipUploadInput');
                if (slipInput) {
                    slipInput.files = dataTransfer.files;
                    window.handleSlipUpload({ target: slipInput });
                }
            }
            break;
        }
    }
});

const slipPageObserver = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
        if (mutation.addedNodes.length) {
            const input = document.getElementById('slipUploadInput');
            if (input && !input.dataset.initialized) {
                input.dataset.initialized = 'true';
                window.initSlipCheck();
            }
        }
    }
});
slipPageObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', (e) => {
    if (e.target.closest('button[onclick*="showPage"]')) {
        const input = document.getElementById('slipUploadInput');
        if(input) input.dataset.initialized = '';
    }
});

// ==========================================
// 🌟 1. ฟังก์ชันอัปโหลดรูป และ แสดงรูป
// ==========================================

window.uploadSlipToStorage = async function(file) {
    if (!file || typeof appDB === 'undefined') return null;
    try {
        const fileExt = file.name ? file.name.split('.').pop() : 'png';
        const fileName = `slip_${Date.now()}_${Math.random().toString(36).substring(2,9)}.${fileExt}`;

        const { error } = await appDB.storage.from('slips').upload(fileName, file);
        if (error) throw error;

        const { data: publicUrlData } = appDB.storage.from('slips').getPublicUrl(fileName);
        return publicUrlData.publicUrl;
    } catch (e) {
        console.error("Storage Upload Error:", e);
        return null;
    }
};

window.viewSlipImage = function(url, event) {
    if (event) event.stopPropagation(); 
    
    if (!document.getElementById('swal-slow-anim')) {
        const style = document.createElement('style');
        style.id = 'swal-slow-anim';
        style.innerHTML = `
            .swal2-popup.swal-slow-show { animation: swal2-show 0.6s ease-in-out !important; }
            .swal2-popup.swal-slow-hide { animation: swal2-hide 0.4s ease-in-out !important; }
        `;
        document.head.appendChild(style);
    }

    Swal.fire({
        imageUrl: url,
        imageAlt: 'รูปสลิปโอนเงิน',
        showConfirmButton: false,
        showCloseButton: true,
        showClass: { popup: 'swal2-popup swal2-modal swal-slow-show' },
        hideClass: { popup: 'swal2-popup swal2-modal swal-slow-hide' },
        customClass: { 
            popup: 'dark:bg-slate-800 rounded-2xl', 
            image: 'rounded-lg max-h-[80vh] object-contain shadow-lg bg-[#0f172a]' 
        },
        width: 'auto'
    });
};
