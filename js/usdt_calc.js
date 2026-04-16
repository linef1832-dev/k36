// เก็บสถานะว่าอยู่โหมดไหน (auto / manual)
window.usdtCalcMode = 'auto';

window.initUsdtCalc = function() {
    window.currentUsdtRate = 0; 
    
    // โหลดเรท Manual เดิมที่เคยกรอกไว้ (ถ้าไม่มีให้ว่างไว้ เพื่อโชว์ 00.00)
    let savedRate = localStorage.getItem('manual_usdt_rate');
    window.manualUsdtRateValue = savedRate ? parseFloat(savedRate) : '';
    
    const manualInput = document.getElementById('manualUsdtRate');
    if (manualInput) manualInput.value = window.manualUsdtRateValue;

    // สั่งให้เริ่มทำงานด้วยโหมด Auto เสมอ
    window.setUsdtMode('auto');
};

// 🟢 ฟังก์ชันสลับโหมด
window.setUsdtMode = function(mode) {
    window.usdtCalcMode = mode;
    
    const autoBtn = document.getElementById('modeAutoBtn');
    const manualBtn = document.getElementById('modeManualBtn');
    const autoDisp = document.getElementById('autoRateDisplay');
    const manualDisp = document.getElementById('manualRateDisplay');
    const refreshBtn = document.getElementById('btnRefreshUsdt');
    const timeDisp = document.getElementById('usdtUpdateTime');
    const noteDesc = document.getElementById('noteDescription');

    if (mode === 'auto') {
        // UI ปุ่ม Auto
        if (autoBtn) {
            autoBtn.className = "px-2 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-slate-800 shadow-sm text-emerald-500 border border-slate-200 dark:border-slate-600 transition flex items-center gap-1";
            autoBtn.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Auto';
        }
        if (manualBtn) {
            manualBtn.className = "px-2 py-0.5 text-[10px] font-bold rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition flex items-center gap-1";
            manualBtn.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> กำหนดเอง';
        }

        // โชว์เรท Auto ซ่อน Manual
        if (autoDisp) { autoDisp.classList.remove('hidden'); autoDisp.classList.add('flex'); }
        if (manualDisp) { manualDisp.classList.add('hidden'); manualDisp.classList.remove('flex'); }
        
        // เปิดปุ่มรีเฟรช
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            refreshBtn.classList.add('bg-white', 'hover:bg-gray-50', 'text-sky-500');
            refreshBtn.innerHTML = '<span class="material-icons text-base">sync</span> รีเฟรชราคา';
        }
        
        if (noteDesc) {
            noteDesc.innerHTML = 'ราคาที่แสดงเป็นราคาประมาณการเบื้องต้นแบบ Real-time <span class="text-amber-400 font-bold">(อ้างอิงเรทราคาตลาดโลก เทียบเท่า Google Finance)</span> เรทราคาจริงเวลาโอนอาจมีการเปลี่ยนแปลงตามความผันผวนของตลาดในช่วงเวลานั้นๆ';
        }
        
        window.fetchUsdtRate(); // ดึงราคาเน็ต
        
    } else {
        // UI ปุ่ม Manual
        if (manualBtn) {
            manualBtn.className = "px-2 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-slate-800 shadow-sm text-amber-500 border border-slate-200 dark:border-slate-600 transition flex items-center gap-1";
            manualBtn.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> กำหนดเอง';
        }
        if (autoBtn) {
            autoBtn.className = "px-2 py-0.5 text-[10px] font-bold rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition flex items-center gap-1";
            autoBtn.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Auto';
        }

        // โชว์เรท Manual ซ่อน Auto
        if (manualDisp) { manualDisp.classList.remove('hidden'); manualDisp.classList.add('flex'); }
        if (autoDisp) { autoDisp.classList.add('hidden'); autoDisp.classList.remove('flex'); }
        
        // ปิดปุ่มรีเฟรช
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-100');
            refreshBtn.classList.remove('bg-white', 'hover:bg-gray-50', 'text-sky-500');
            refreshBtn.innerHTML = '<span class="material-icons text-base">edit_off</span> ตั้งค่าเอง';
        }
        
        if (timeDisp) {
            timeDisp.innerText = '--:--:--';
        }
        
        if (noteDesc) {
            noteDesc.innerHTML = 'ตอนนี้คุณกำลังใช้ <span class="text-amber-400 font-bold">เรทราคาแบบกำหนดเอง (Manual)</span> การคำนวณทั้งหมดจะยึดตามตัวเลขที่คุณพิมพ์ไว้ด้านบนเท่านั้น';
        }
        
        window.updateManualRate(); // คำนวณตามที่กรอก
    }
};

// 🟢 อัปเดตราคาเมื่อพิมพ์ในโหมด Manual
window.updateManualRate = function() {
    const input = document.getElementById('manualUsdtRate');
    if (!input) return;
    const val = parseFloat(input.value);
    
    if (!isNaN(val) && val > 0) {
        window.currentUsdtRate = val;
        window.manualUsdtRateValue = val;
        localStorage.setItem('manual_usdt_rate', val); // จำค่าไว้ในเครื่อง
        window.calcUsdtToThb(); // สั่งให้ด้านล่างคำนวณใหม่
    } else {
        // ถ้าช่องกำหนดเองถูกลบจนว่างเปล่า ให้เคลียร์ยอดคำนวณด้านล่างด้วย
        window.currentUsdtRate = 0;
        window.calcUsdtToThb();
    }
};

// 🟢 ฟังก์ชันดึง/รีเฟรชราคาจากเน็ต (ทำงานเฉพาะตอนอยู่โหมด Auto)
window.fetchUsdtRate = async function() {
    if (window.usdtCalcMode === 'manual') return;

    const timeDisplay = document.getElementById('usdtUpdateTime');
    const rateDisplay = document.getElementById('usdtRateDisplay');
    const usdtInput = document.getElementById('calcUsdtInput');
    
    if (rateDisplay) rateDisplay.innerHTML = '<span class="material-icons animate-spin text-3xl">sync</span>';
    
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        
        if (data && data.rates && data.rates.THB) {
            window.currentUsdtRate = data.rates.THB;
        } else {
            window.currentUsdtRate = 34.5000;
        }
    } catch (error) {
        console.error('API Error:', error);
        window.currentUsdtRate = 34.5000; 
    }
    
    if (timeDisplay) {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        timeDisplay.innerText = `${h}:${m}:${s}`;
    }
    
    if (rateDisplay) {
        rateDisplay.innerText = window.currentUsdtRate.toFixed(4);
    }
    
    if (usdtInput && usdtInput.value) {
        window.calcUsdtToThb();
    }
};

// 🟢 คำนวณจาก USDT เป็น บาท
window.calcUsdtToThb = function() {
    const usdtInput = document.getElementById('calcUsdtInput');
    const thbInput = document.getElementById('calcThbInput');
    if (!usdtInput || !thbInput) return;
    
    const usdtVal = parseFloat(usdtInput.value);
    if (!isNaN(usdtVal) && window.currentUsdtRate > 0) {
        thbInput.value = (usdtVal * window.currentUsdtRate).toFixed(2);
    } else {
        thbInput.value = '';
    }
};

// 🟢 คำนวณจาก บาท เป็น USDT
window.calcThbToUsdt = function() {
    const usdtInput = document.getElementById('calcUsdtInput');
    const thbInput = document.getElementById('calcThbInput');
    if (!usdtInput || !thbInput) return;
    
    const thbVal = parseFloat(thbInput.value);
    if (!isNaN(thbVal) && window.currentUsdtRate > 0) {
        usdtInput.value = (thbVal / window.currentUsdtRate).toFixed(4);
    } else {
        usdtInput.value = '';
    }
};

// ========================================================================
// 🌟 ตัวดักจับเวลาเข้าหน้าเว็บ (Smart Observer)
// ทำให้โหลดราคาอัตโนมัติ โดยไม่ต้องรอให้คนกด Refresh อีกต่อไป!
// ========================================================================
const usdtPageObserver = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
        if (mutation.addedNodes.length) {
            const calcInput = document.getElementById('calcUsdtInput');
            // ถ้าตรวจพบว่าหน้า usdt_calc ถูกวาดเสร็จแล้ว และยังไม่ได้โหลดข้อมูล
            if (calcInput && !calcInput.dataset.initialized) {
                calcInput.dataset.initialized = 'true'; // มาร์คไว้ว่าโหลดแล้ว จะได้ไม่โหลดซ้ำ
                window.initUsdtCalc(); // สั่งดึงราคาเข้าหน้าจอทันที!
            }
        }
    }
});

// สั่งให้ระบบคอยจับตาดูการเปลี่ยนหน้าเว็บ
usdtPageObserver.observe(document.body, { childList: true, subtree: true });

// เมื่อกดย้ายไปหน้าอื่น ให้ล้างสถานะ เพื่อที่พอกลับมาใหม่ จะได้โหลดราคาใหม่อีกครั้ง
document.addEventListener('click', (e) => {
    if (e.target.closest('button[onclick*="showPage"]')) {
        const input = document.getElementById('calcUsdtInput');
        if(input) input.dataset.initialized = '';
    }
});
