// ════════════════════════════════════════════════════════════════════
// 📦 slip_check/core.js — ส่วนที่ 1/3 ของระบบตรวจสลิป (แยกจาก slip_check.js เดิม 1,118 บรรทัด)
// เนื้อหา: init, สิทธิ์, เชื่อม Supabase/Realtime, ระบบแท็บ, โหมดเช็ค QR ผู้รับเงิน
// ⚠️ ลำดับโหลด: slip_check/core → slip_check/scan → slip_check/history (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
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