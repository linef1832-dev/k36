// ดึงประวัติจากที่บันทึกไว้ในเครื่อง
window.slipHistoryData = JSON.parse(localStorage.getItem('slip_check_history') || '[]');
window.selectedSlipFile = null;

// ดึงชื่อและสิทธิ์
window.getCurrentUserName = () => localStorage.getItem('username') || localStorage.getItem('name') || 'แอดมิน';
window.getCurrentUserRole = () => localStorage.getItem('role') || localStorage.getItem('userRole') || 'manager'; 

window.initSlipCheck = function() {
    window.clearSlipUpload();
    window.clearQRReceiver();
    window.renderSlipHistory();
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
// ✅ คัดลอกโค้ดนี้ไปทับฟังก์ชันเดิม
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
            // แปลง 0066 8x เป็น 08x
            account = '0' + phoneMatch[1];
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

    } catch (e) {
        Swal.fire('ตรวจพบปัญหา', 'รูปภาพนี้ไม่มี QR Code หรือสแกนไม่ผ่านครับ', 'error');
        window.clearQRReceiver();
    }
};


// ==========================================
// 🌟 โหมดที่ 1: เช็คสลิปโอนเงิน (ของเดิม)
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

// ✅ คัดลอกโค้ดนี้ไปทับฟังก์ชันเดิม
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

window.extractQrPayload = function(file) {
    return new Promise((resolve, reject) => {
        if (typeof jsQR === 'undefined') return reject(new Error('ไม่พบระบบอ่าน QR Code (jsQR)'));

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { willReadFrequently: true });
                const maxSize = 800;
                let width = img.width, height = img.height;
                if (width > height && width > maxSize) { height *= maxSize / width; width = maxSize; }
                else if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                canvas.width = width; canvas.height = height;
                context.drawImage(img, 0, 0, width, height);
                const imageData = context.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                
                if (code) resolve(code.data);
                else reject(new Error('ไม่พบรหัส QR Code บนสลิปนี้'));
            };
            img.onerror = () => reject(new Error('รูปภาพเสียหาย หรือโหลดไม่สำเร็จ'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
        reader.readAsDataURL(file);
    });
};

window.performOCR = async function(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const worker = await Tesseract.createWorker('eng');
                await worker.setParameters({ tessedit_char_whitelist: '0123456789.,' });
                const ret = await worker.recognize(reader.result);
                await worker.terminate();
                resolve(ret.data.text);
            } catch (e) {
                console.error("OCR Error:", e);
                resolve("");
            }
        };
        reader.readAsDataURL(file);
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

window.verifyThunderSlip = async function() {
    if (!window.selectedSlipFile) {
        return Swal.fire('แจ้งเตือน', 'กรุณาอัปโหลดรูปภาพ หรือกด Ctrl+V เพื่อวางสลิปก่อนครับ', 'warning');
    }

    Swal.fire({
        title: 'กำลังสแกน QR Code...',
        html: 'โปรดรอสักครู่...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
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

            let rawAmount = findDeep(data, 'amount');
            let amountVal = typeof rawAmount === 'object' ? (rawAmount.amount || 0) : (rawAmount || 0);
            let actualAmount = parseFloat(amountVal);

            Swal.update({ title: 'AI กำลังอ่านตัวเลขบนรูป...', html: 'ตรวจสอบสลิปตัดต่อด้วยระบบ AI...' });
            const ocrText = await window.performOCR(window.selectedSlipFile);

            let isFakeSlip = false;
            let ocrDetectedAmount = actualAmount;

            if (ocrText.trim() !== "") {
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
                        }
                    }
                }
            }

            let senderObj = data.sender || {};
            let receiverObj = data.receiver || {};

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

            let senderName = getName(senderObj);
            let receiverName = getName(receiverObj);
            let transRef = findDeep(data, 'transRef') || findDeep(data, 'ref1') || '-';
            let transDate = findDeep(data, 'transDate') || findDeep(data, 'date');

            let isLocalDuplicate = window.slipHistoryData.some(h => h.ref === transRef && transRef !== '-');
            let isDuplicate = data.isDuplicate || isLocalDuplicate;

            const resAmountEl = document.getElementById('resAmount');
            resAmountEl.innerText = actualAmount.toLocaleString('en-US', {minimumFractionDigits: 2});
            
            if (isFakeSlip) {
                resAmountEl.classList.remove('text-emerald-400');
                resAmountEl.classList.add('text-red-500');
            } else {
                resAmountEl.classList.add('text-emerald-400');
                resAmountEl.classList.remove('text-red-500');
            }

            document.getElementById('resSenderName').innerText = senderName;
            document.getElementById('resSenderBank').innerText = getBank(senderObj.bank);
            document.getElementById('resReceiverName').innerText = receiverName;
            document.getElementById('resReceiverBank').innerText = getBank(receiverObj.bank);
            document.getElementById('resReceiverAccount').innerText = getAccount(receiverObj);
            document.getElementById('resRef').innerText = transRef;
            
            if (transDate) {
                 document.getElementById('resDate').innerText = new Date(transDate).toLocaleString('th-TH');
            } else {
                 document.getElementById('resDate').innerText = '-';
            }

            document.getElementById('slipResultEmpty').classList.add('hidden');
            document.getElementById('slipResultEmpty').classList.remove('flex');
            document.getElementById('slipResultData').classList.remove('hidden');
            document.getElementById('slipResultData').classList.add('flex');

            if (isDuplicate) {
                 updateSlipBadge('warning', 'สลิปถูกใช้แล้ว ⚠️');
                 Swal.fire({
                     icon: 'warning', 
                     title: '🚨 ตรวจพบสลิปซ้ำ!', 
                     html: 'สลิปนี้ <b>ได้มีการค้นหาในระบบไปแล้ว</b><br>ห้ามนำมาทำรายการซ้ำเด็ดขาด!', 
                     confirmButtonText: 'รับทราบ', 
                     confirmButtonColor: '#f59e0b'
                 });
            } else if (isFakeSlip) {
                updateSlipBadge('error', 'สลิปปลอมแปลงยอดเงิน ❌');
                Swal.fire({
                    icon: 'error',
                    title: '🚨 AI จับโป๊ะสลิปปลอม!',
                    html: `สลิปนี้โดนแก้ไขตัวเลขชัวร์!<br><br>ยอดโอนในระบบคือ <b>${actualAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</b> บาท<br>แต่ AI อ่านตัวเลขบนรูปได้ <b>${ocrDetectedAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</b> บาท`,
                    confirmButtonColor: '#ef4444'
                });
                
                window.saveSlipHistory({
                    success: true,
                    isFake: true,
                    data: { amount: actualAmount, sender: { name: senderName }, receiver: { name: receiverName }, transRef: transRef, date: transDate }
                }, true);

            } else {
                 updateSlipBadge('success', 'สลิปถูกต้อง ✅');
                 Swal.fire({icon: 'success', title: 'สลิปจริง', text: 'ตัวเลขบนรูปตรงกับยอดใน QR Code', timer: 1500, showConfirmButton: false});
                 
                 window.saveSlipHistory({
                     success: true,
                     isFake: false,
                     data: { amount: actualAmount, sender: { name: senderName }, receiver: { name: receiverName }, transRef: transRef, date: transDate }
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

window.deleteSlipHistory = function(id, event) {
    event.stopPropagation(); 
    
    Swal.fire({
        title: 'ยืนยันการลบประวัติ?',
        text: "คุณต้องการลบประวัติการตรวจสลิปนี้ใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#4b5563',
        confirmButtonText: 'ลบเลย',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' }
    }).then((result) => {
        if (result.isConfirmed) {
            window.slipHistoryData = window.slipHistoryData.filter(h => h.id !== id);
            localStorage.setItem('slip_check_history', JSON.stringify(window.slipHistoryData));
            window.renderSlipHistory();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    });
};

window.renderSlipHistory = function() {
    const tbody = document.getElementById('slipHistoryBody');
    if (!tbody) return;

    const table = tbody.closest('table');
    if (table) {
        const theadTr = table.querySelector('thead tr');
        if (theadTr && theadTr.children.length === 6) {
            theadTr.innerHTML += `<th class="p-3 font-semibold text-gray-400 text-left">ผู้ทำรายการ</th>`;
            theadTr.innerHTML += `<th class="p-3 font-semibold text-gray-400 text-center">จัดการ</th>`;
        }
    }
    
    const search = document.getElementById('slipHistorySearch') ? document.getElementById('slipHistorySearch').value.toLowerCase() : '';
    
    const filtered = window.slipHistoryData.filter(h => 
        (h.senderName && h.senderName.toLowerCase().includes(search)) ||
        (h.receiverName && h.receiverName.toLowerCase().includes(search)) ||
        (h.ref && h.ref.toLowerCase().includes(search)) ||
        (h.checkerName && h.checkerName.toLowerCase().includes(search))
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500 font-bold bg-[#151f32] text-xs">ไม่พบประวัติการตรวจสอบ</td></tr>`;
        return;
    }

    const role = window.getCurrentUserRole().toLowerCase();
    const isManager = (role === 'manager' || role === 'admin' || role === 'vip' || role === 'ผู้จัดการ');
    
    tbody.innerHTML = filtered.map(h => {
        const timeStr = new Date(h.timestamp).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
        
        let statusBadge = '';
        let rowClass = "hover:bg-slate-800 transition cursor-pointer border-b border-slate-800/50 group";
        let amountColor = "text-emerald-400";
        
        if (h.isFake) {
            statusBadge = `<span class="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 mx-auto w-fit"><span class="material-icons text-[12px]">warning</span> ปลอมแปลง!</span>`;
            rowClass = "bg-red-900/20 hover:bg-red-900/40 transition cursor-pointer border-b border-red-500/30 group";
            amountColor = "text-red-400";
        } else if (h.success) {
            statusBadge = `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 mx-auto w-fit"><span class="material-icons text-[12px]">check_circle</span> สำเร็จ</span>`;
        } else {
            statusBadge = `<span class="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center justify-center gap-1 mx-auto w-fit"><span class="material-icons text-[12px]">cancel</span> ไม่สำเร็จ</span>`;
            amountColor = "text-gray-500";
        }

        const actionBtn = window.hasUserPerm('slip_check_delete') 
            ? `<button onclick="window.deleteSlipHistory('${h.id}', event)" class="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1.5 rounded-lg transition" title="ลบประวัติ"><span class="material-icons text-[18px]">delete</span></button>`
            : `<span class="text-slate-600 material-icons text-[16px]" title="ไม่มีสิทธิ์ลบ">block</span>`;
            
        return `
            <tr class="${rowClass}" onclick="viewHistoryDetail('${h.id}')" title="คลิกเพื่อดูรายละเอียด">
                <td class="p-3 text-xs text-gray-400 font-mono flex items-center gap-2">
                    <span class="material-icons text-gray-500 text-[14px] opacity-0 group-hover:opacity-100 transition">touch_app</span>
                    ${timeStr} น.
                </td>
                <td class="p-3 font-mono text-xs text-sky-400 font-bold">${h.ref || '-'}</td>
                <td class="p-3 font-bold text-sm text-gray-200">${h.senderName || '-'}</td>
                <td class="p-3 text-xs text-gray-400">${h.receiverName || '-'}</td>
                <td class="p-3 text-right font-mono font-bold ${amountColor}">฿${parseFloat(h.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-xs text-amber-300 font-semibold">${h.checkerName || '-'}</td>
                <td class="p-3 text-center">${actionBtn}</td>
            </tr>
        `;
    }).join('');
};

window.filterSlipHistory = function() {
    renderSlipHistory();
};

window.saveSlipHistory = function(result, isSuccess) {
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
        date: isSuccess && result.data ? (result.data.date || '') : ''
    };
    
    window.slipHistoryData.unshift(newEntry);
    if (window.slipHistoryData.length > 50) window.slipHistoryData.pop(); 
    
    localStorage.setItem('slip_check_history', JSON.stringify(window.slipHistoryData));
    renderSlipHistory();
};

window.viewHistoryDetail = function(id) {
    const h = window.slipHistoryData.find(x => x.id === id);
    if (!h) return;
    
    const resAmountEl = document.getElementById('resAmount');
    resAmountEl.innerText = parseFloat(h.amount).toLocaleString('en-US', {minimumFractionDigits: 2});
    document.getElementById('resSenderName').innerText = h.senderName || 'ไม่ระบุ';
    document.getElementById('resSenderBank').innerText = '-'; 
    document.getElementById('resReceiverName').innerText = h.receiverName || 'ไม่ระบุ';
    document.getElementById('resReceiverBank').innerText = '-';
    document.getElementById('resReceiverAccount').innerText = '-';
    document.getElementById('resRef').innerText = h.ref || '-';
    document.getElementById('resDate').innerText = h.date ? new Date(h.date).toLocaleString('th-TH') : '-';

    document.getElementById('slipResultEmpty').classList.add('hidden');
    document.getElementById('slipResultEmpty').classList.remove('flex');
    document.getElementById('slipResultData').classList.remove('hidden');
    document.getElementById('slipResultData').classList.add('flex');
    
    if (h.isFake) {
        updateSlipBadge('error', 'สลิปปลอมแปลงตัวเลข ❌ (จากประวัติ)');
        resAmountEl.classList.add('text-red-500');
        resAmountEl.classList.remove('text-emerald-400');
    } else if (h.success) {
        updateSlipBadge('success', 'สลิปถูกต้อง ✅ (เรียกดูจากประวัติ)');
        resAmountEl.classList.remove('text-red-500');
        resAmountEl.classList.add('text-emerald-400');
    } else {
        updateSlipBadge('error', 'สลิปไม่ถูกต้อง ❌ (เรียกดูจากประวัติ)');
        resAmountEl.classList.remove('text-red-500');
        resAmountEl.classList.add('text-emerald-400');
    }
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
            
            // ส่งไฟล์ไปเข้าโหมดที่กำลังเปิดอยู่ (สลิป หรือ QR)
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
// ==============================================================
// 🌟 ระบบประวัติย้อนหลัง สำหรับ "สแกน QR ผู้รับเงิน"
// ==============================================================

// ดึงประวัติ QR จากเครื่อง (แยกกับประวัติ Slip)
window.qrHistoryData = JSON.parse(localStorage.getItem('qr_check_history') || '[]');

// เพิ่มให้ render ตอนเข้าหน้าเว็บครั้งแรก
const originalInit = window.initSlipCheck;
window.initSlipCheck = function() {
    if(originalInit) originalInit();
    window.renderQRHistory();
};

window.saveQRHistory = function(data) {
    const newEntry = {
        id: 'qr_' + Date.now(),
        timestamp: Date.now(),
        type: data.type,
        account: data.account,
        raw: data.raw,
        checkerName: window.getCurrentUserName() // บันทึกชื่อคนทำรายการ
    };
    
    window.qrHistoryData.unshift(newEntry);
    if (window.qrHistoryData.length > 50) window.qrHistoryData.pop(); 
    
    localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
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
    
    tbody.innerHTML = filtered.map(h => {
        const timeStr = new Date(h.timestamp).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
        
        // ปุ่มลบโชว์เฉพาะผู้จัดการ
        const actionBtn = window.hasUserPerm('slip_check_delete') 
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

window.filterQRHistory = function() {
    renderQRHistory();
};

window.deleteQRHistory = function(id, event) {
    event.stopPropagation(); 
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
    }).then((result) => {
        if (result.isConfirmed) {
            window.qrHistoryData = window.qrHistoryData.filter(h => h.id !== id);
            localStorage.setItem('qr_check_history', JSON.stringify(window.qrHistoryData));
            window.renderQRHistory();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    });
};

// 🌟 สิ่งสุดท้าย: ต้องสั่งให้บันทึกประวัติ ตอนที่สแกน QR สำเร็จด้วย
// เราจะเขียนทับฟังก์ชัน handleScanQRReceiver เดิมเล็กน้อย เพื่อให้มันเรียก saveQRHistory
const originalHandleScanQRReceiver = window.handleScanQRReceiver;
window.handleScanQRReceiver = async function(event) {
    const file = event.target.files[0];
    if(!file) return;

    // รันโค้ดเก่า
    await originalHandleScanQRReceiver(event);
    
    // ดึงค่ามาบันทึกประวัติ
    setTimeout(() => {
        const typeEl = document.getElementById('resQrType');
        const accountEl = document.getElementById('resQrAccount');
        const rawEl = document.getElementById('resQrRaw');
        
        // ถ้าแสดงผลแล้ว ไม่ใช่ค่า '-' แปลว่าสำเร็จ ให้บันทึกประวัติ
        if(typeEl && typeEl.innerText !== '-') {
            window.saveQRHistory({
                type: typeEl.innerText,
                account: accountEl.innerText,
                raw: rawEl.innerText
            });
        }
    }, 500); // ดีเลย์นิดนึงเพื่อให้ DOM โหลดค่าเสร็จก่อน
};
// 🌟 ฟังก์ชันคัดลอกข้อความ
window.copyToClipboard = function(text, btnElement, event) {
    if (event) event.stopPropagation(); // ป้องกันไม่ให้ตารางเด้งเปิดรายละเอียดตอนกดปุ่ม
    if (!text || text === '-') return;
    
    navigator.clipboard.writeText(text).then(() => {
        // เปลี่ยนไอคอนเป็นเครื่องหมายถูกชั่วคราว
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = '<span class="material-icons text-[18px] text-emerald-400">check</span>';
        btnElement.classList.add('border-emerald-500/50', 'bg-emerald-900/30');
        
        setTimeout(() => {
            btnElement.innerHTML = originalHTML;
            btnElement.classList.remove('border-emerald-500/50', 'bg-emerald-900/30');
        }, 1500); // กลับเป็นปกติใน 1.5 วินาที
    }).catch(err => {
        console.error('คัดลอกไม่สำเร็จ: ', err);
    });
};
// ==============================================================
// 🌟 ระบบประวัติย้อนหลัง สำหรับ "สลิปปลอม (Blacklist)"
// ==============================================================

window.renderFakeHistory = function() {
    const tbody = document.getElementById('fakeHistoryBody');
    if (!tbody) return;
    
    const search = document.getElementById('fakeHistorySearch') ? document.getElementById('fakeHistorySearch').value.toLowerCase() : '';
    
    // กรองเอาเฉพาะรายการที่เจอว่า "ปลอม" (isFake === true)
    const fakes = window.slipHistoryData.filter(h => h.isFake);
    
    const filtered = fakes.filter(h => 
        (h.senderName && h.senderName.toLowerCase().includes(search)) ||
        (h.receiverName && h.receiverName.toLowerCase().includes(search)) ||
        (h.checkerName && h.checkerName.toLowerCase().includes(search))
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-500 font-bold bg-[#151f32] text-xs">ไม่พบประวัติผู้โอนสลิปปลอม</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(h => {
        const timeStr = new Date(h.timestamp).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
        
        return `
            <tr class="hover:bg-red-900/20 transition border-b border-slate-800/50">
                <td class="p-3 text-xs text-gray-400 font-mono">${timeStr} น.</td>
                <td class="p-3 font-bold text-sm text-red-400">${h.senderName || '-'}</td>
                <td class="p-3 text-xs text-gray-400">${h.receiverName || '-'}</td>
                <td class="p-3 text-right font-mono font-bold text-red-500">฿${parseFloat(h.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="p-3 text-xs text-amber-300 font-semibold">${h.checkerName || '-'}</td>
            </tr>
        `;
    }).join('');
};

window.filterFakeHistory = function() {
    renderFakeHistory();
};

// ดักจับการแก้ไขเวลาลบ / เซฟ สลิป ให้มันอัปเดตหน้าบัญชีดำไปด้วย
const _originalDeleteSlip = window.deleteSlipHistory;
window.deleteSlipHistory = function(id, event) {
    // ให้รันของเดิม แล้วสั่งรีเฟรชหน้าปลอมด้วย เผื่อแอดมินลบสลิปปลอมทิ้ง
    _originalDeleteSlip(id, event);
    setTimeout(() => { if(typeof window.renderFakeHistory === 'function') window.renderFakeHistory(); }, 1500);
};

const _originalSaveSlip = window.saveSlipHistory;
window.saveSlipHistory = function(result, isSuccess) {
    _originalSaveSlip(result, isSuccess);
    if (typeof window.renderFakeHistory === 'function') window.renderFakeHistory();
};
