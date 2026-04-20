window.kbizBotQueue = [];
window.isKbizBotRunning = false;

window.initKbizBotPage = async function() {
    const select = document.getElementById('botSelectAcc');
    if (!select) return;

    try {
        if(typeof appDB !== 'undefined') {
            const { data } = await appDB.from('settings').select('value').eq('key', 'kbiz_bots_data').single();
            if (data && data.value) {
                const bots = JSON.parse(data.value);
                select.innerHTML = '<option value="">-- เลือกบอทที่บันทึกไว้ --</option>';
                // ดึงเฉพาะตัวที่เปิดใช้งานอยู่มาใส่ Dropdown
                bots.filter(b => b.is_active).forEach(b => {
                    const val = JSON.stringify({ id: b.id, machine_id: b.machine_id, u: b.username, p: b.password });
                    select.innerHTML += `<option value='${val}'>${b.machine_id} - ${b.display_name || b.username}</option>`;
                });
            }
        }
    } catch(e) { console.error('Load Bots Error:', e); }

    // สมัครรับข้อมูลแจ้งเตือน (Log และ สถิติ) จาก Extension
    window.removeEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
    window.addEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
    
    renderBotQueue();
};

window.addBotToQueue = function() {
    if (window.isKbizBotRunning) return Swal.fire('ไม่สามารถเพิ่มได้', 'กรุณาหยุดการทำงานของบอทก่อน จึงจะเพิ่มคิวได้ครับ', 'warning');
    
    const select = document.getElementById('botSelectAcc');
    const val = select.value;
    if (!val) return Swal.fire('ไม่ได้เลือก', 'กรุณาเลือกบอทจากรายการด้านซ้ายก่อนกดเพิ่มครับ', 'warning');
    
    const botData = JSON.parse(val);
    
    // ดักไม่ให้เพิ่มบอทตัวเดียวกันซ้ำ
    if (window.kbizBotQueue.find(b => b.id === botData.id)) {
        return Swal.fire('ข้อมูลซ้ำ', 'มีบอทตัวนี้ในคิวทำงานอยู่แล้วครับ', 'info');
    }
    
    window.kbizBotQueue.push({
        id: botData.id,
        machine_id: botData.machine_id,
        username: botData.u,
        password: botData.p,
        success: 0,
        fail: 0,
        status: 'ready' // สถานะ: ready, running
    });
    
    renderBotQueue();
    select.value = ''; // รีเซ็ตช่องเผื่อเลือกตัวต่อไป
};

window.removeBotFromQueue = function(id) {
    if (window.isKbizBotRunning) return;
    window.kbizBotQueue = window.kbizBotQueue.filter(b => b.id !== id);
    renderBotQueue();
};

window.clearBotQueue = function() {
    if (window.isKbizBotRunning) return Swal.fire('เตือน', 'กรุณากดหยุดการทำงานก่อนล้างคิวครับ', 'warning');
    window.kbizBotQueue = [];
    renderBotQueue();
};

// ฟังก์ชันวาดการ์ดบอท (พร้อมสถิติ)
window.renderBotQueue = function() {
    const list = document.getElementById('botQueueList');
    const countSpan = document.getElementById('botQueueCount');
    if (!list) return;
    
    if (countSpan) countSpan.innerText = window.kbizBotQueue.length;
    
    if (window.kbizBotQueue.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-400 text-xs py-10">ยังไม่ได้เพิ่มบอทลงในคิว</div>';
        return;
    }
    
    list.innerHTML = window.kbizBotQueue.map(b => {
        let statusBadge = '';
        if (b.status === 'ready') statusBadge = '<span class="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-gray-300 px-2 py-0.5 rounded border dark:border-slate-600 font-bold shadow-sm">รอทำงาน</span>';
        else if (b.status === 'running') statusBadge = '<span class="text-[9px] bg-blue-500/20 text-blue-500 border border-blue-500/50 px-2 py-0.5 rounded font-bold shadow-sm flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> กำลังสแกน...</span>';
        
        return `
        <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center justify-between relative overflow-hidden group hover:border-emerald-400 transition">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${b.status === 'running' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-gray-300 dark:bg-slate-600'}"></div>
            <div class="flex flex-col ml-3 w-full pr-2">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="font-black text-sm text-slate-800 dark:text-white truncate pr-2">${b.machine_id}</span>
                    ${statusBadge}
                </div>
                <div class="flex items-center gap-4 text-[10px] font-bold bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span class="text-emerald-500 flex items-center gap-1" title="แก้ไขสำเร็จ"><span class="material-icons text-[14px]">check_circle</span> สำเร็จ: <span class="text-xs font-black bg-emerald-100 dark:bg-emerald-900/30 px-1.5 rounded shadow-sm">${b.success}</span></span>
                    <span class="text-red-500 flex items-center gap-1" title="แก้ไขไม่สำเร็จ / ข้อมูลไม่ตรง"><span class="material-icons text-[14px]">cancel</span> ไม่สำเร็จ: <span class="text-xs font-black bg-red-100 dark:bg-red-900/30 px-1.5 rounded shadow-sm">${b.fail}</span></span>
                </div>
            </div>
            <button onclick="removeBotFromQueue('${b.id}')" class="shrink-0 w-8 h-8 rounded-lg bg-red-50 dark:bg-slate-700 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition shadow-sm border border-red-200 dark:border-slate-600 ${window.isKbizBotRunning ? 'hidden' : ''}">
                <span class="material-icons text-sm">delete</span>
            </button>
        </div>
        `;
    }).join('');
};

window.handleBotStatusUpdate = function(e) {
    // รับข้อมูลมาจาก Extension
    const { message, status, botId, action } = e.detail;
    addBotLog(message, status);
    
    // ถ้า Extension แนบ ID ของบอทกลับมาด้วย ให้บวกแต้มให้ตรงตัว
    if (botId) {
        const bot = window.kbizBotQueue.find(b => b.id === botId);
        if (bot) {
            if (action === 'success') bot.success++;
            else if (action === 'fail') bot.fail++;
            renderBotQueue(); // วาดตัวเลขใหม่ให้ผู้ใช้เห็นทันที
        }
    }
};

window.startKbizBotProcess = function() {
    if (window.kbizBotQueue.length === 0) {
        return Swal.fire('คิวว่างเปล่า', 'กรุณาเพิ่มบอทลงในคิวอย่างน้อย 1 ตัวก่อนเริ่มทำงานครับ', 'warning');
    }

    const btn = document.getElementById('btnStartAutoRun');

    if (window.isKbizBotRunning) {
        // 🔴 โหมด: กดหยุดการทำงาน
        window.isKbizBotRunning = false;
        btn.innerHTML = '<span class="material-icons">play_circle</span> เริ่มทำงานอัตโนมัติ (Auto-Run)';
        btn.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition transform active:scale-95 text-lg border border-emerald-500 mt-2 flex items-center justify-center gap-2 shrink-0";
        
        // ปรับสถานะบอททุกตัวในคิวให้กลับมาเป็นรอ
        window.kbizBotQueue.forEach(b => b.status = 'ready');
        renderBotQueue();
        addBotLog('หยุดการทำงานของบอททั้งหมดแล้ว', 'warning');
        
        // ส่งคำสั่งหยุดไปบอก Extension (ถ้า Extension ถูกเขียนให้รองรับ)
        window.dispatchEvent(new CustomEvent('STOP_KBIZ_BOT'));
    } else {
        // 🟢 โหมด: เริ่มการทำงาน
        window.isKbizBotRunning = true;
        btn.innerHTML = '<span class="material-icons">stop_circle</span> หยุดการทำงานบอท (Stop)';
        btn.className = "w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl shadow-lg transition transform active:scale-95 text-lg border border-red-500 mt-2 flex items-center justify-center gap-2 shrink-0";
        
        // ปรับสถานะเป็นวิ่ง
        window.kbizBotQueue.forEach(b => b.status = 'running');
        renderBotQueue();
        
        addBotLog(`เริ่มส่งคำสั่งไปให้บอทจำนวน ${window.kbizBotQueue.length} ตัว ทำงาน...`, 'info');
        
        // โยนคิวบอททั้งหมดที่มีให้ Chrome Extension ไปบริหารจัดการต่อ
        window.dispatchEvent(new CustomEvent('START_KBIZ_BOT', {
            detail: {
                bots: window.kbizBotQueue.map(b => ({
                    id: b.id,
                    machine_id: b.machine_id,
                    username: b.username,
                    password: b.password
                }))
            }
        }));
    }
};

window.addBotLog = function(message, status = 'info') {
    const logArea = document.getElementById('botLogArea');
    if (!logArea) return;
    
    const time = new Date().toLocaleTimeString('th-TH');
    let colorClass = 'text-green-400';
    if (status === 'error') colorClass = 'text-red-400';
    if (status === 'warning') colorClass = 'text-yellow-400';
    if (status === 'success') colorClass = 'text-sky-400 font-bold';

    logArea.innerHTML += `<div><span class="text-gray-500">[${time}]</span> <span class="${colorClass}">>> ${message}</span></div>`;
    logArea.scrollTop = logArea.scrollHeight;
};

window.clearBotLog = function() {
    const logArea = document.getElementById('botLogArea');
    if (logArea) logArea.innerHTML = '';
};
