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
};

window.initSlipCheck = async function() {
    window.clearSlipUpload();
    window.clearQRReceiver();
    
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
