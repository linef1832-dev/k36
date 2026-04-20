window.kbizBotQueue = [];
window.isKbizBotRunning = false;
const STORAGE_KEY = 'my_saved_kbiz_bots';

window.initKbizBotPage = async function() {
    window.removeEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
    window.addEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
    renderSavedBots();
    renderBotQueue();
};

function getSavedBots() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }

window.saveKbizBot = function() {
    const idInput = document.getElementById('editBotId').value;
    const name = document.getElementById('botSaveName').value.trim();
    const user = document.getElementById('botSaveUser').value.trim();
    const pass = document.getElementById('botSavePass').value.trim();

    if (!name || !user || !pass) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');

    let bots = getSavedBots();
    if (idInput) {
        let index = bots.findIndex(b => b.id === idInput);
        if(index > -1) bots[index] = { id: idInput, name, user, pass };
    } else { bots.push({ id: 'b_'+Date.now(), name, user, pass }); }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
    clearBotForm(); renderSavedBots();
    Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', timer: 1000, showConfirmButton: false});
};

window.editSavedBot = function(id) {
    const bot = getSavedBots().find(b => b.id === id);
    if(bot) {
        document.getElementById('editBotId').value = bot.id;
        document.getElementById('botSaveName').value = bot.name;
        document.getElementById('botSaveUser').value = bot.user;
        document.getElementById('botSavePass').value = bot.pass;
    }
};

window.deleteSavedBot = function(id) {
    if(!confirm('ต้องการลบบอทตัวนี้ใช่หรือไม่?')) return;
    let bots = getSavedBots().filter(b => b.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bots)); renderSavedBots();
};

window.clearBotForm = function() {
    document.getElementById('editBotId').value = ''; document.getElementById('botSaveName').value = '';
    document.getElementById('botSaveUser').value = ''; document.getElementById('botSavePass').value = '';
};

window.renderSavedBots = function() {
    const list = document.getElementById('savedBotsList');
    const bots = getSavedBots();
    if(bots.length === 0) { list.innerHTML = '<div class="text-xs text-gray-400 text-center py-2">ยังไม่มีข้อมูลบอท</div>'; return; }
    list.innerHTML = bots.map(b => `
        <div class="flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600">
            <div class="flex flex-col">
                <span class="text-sm font-bold text-slate-800 dark:text-white">${b.name}</span>
                <span class="text-[10px] text-gray-500 dark:text-gray-400">User: ${b.user}</span>
            </div>
            <div class="flex gap-1">
                <button onclick="addSavedBotToQueue('${b.id}')" class="bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-emerald-600">+ เลือกลงคิว</button>
                <button onclick="editSavedBot('${b.id}')" class="bg-amber-500 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-amber-600"><span class="material-icons text-[12px]">edit</span></button>
                <button onclick="deleteSavedBot('${b.id}')" class="bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-600"><span class="material-icons text-[12px]">delete</span></button>
            </div>
        </div>
    `).join('');
};

window.addSavedBotToQueue = function(id) {
    if (window.isKbizBotRunning) return Swal.fire('เตือน', 'กรุณาหยุดบอทก่อนเพิ่มคิว', 'warning');
    const bot = getSavedBots().find(b => b.id === id);
    if (!bot) return;
    if (window.kbizBotQueue.find(b => b.machine_id === bot.name)) return Swal.fire('ข้อมูลซ้ำ', 'มีบอทชื่อนี้ในคิวแล้วครับ', 'info');

    window.kbizBotQueue.push({ id: 'q_'+Date.now(), machine_id: bot.name, username: bot.user, password: bot.pass, success: 0, fail: 0, status: 'ready' });
    renderBotQueue();
};

window.removeBotFromQueue = function(id) {
    if (window.isKbizBotRunning) return;
    window.kbizBotQueue = window.kbizBotQueue.filter(b => b.id !== id); renderBotQueue();
};

window.clearBotQueue = function() {
    if (window.isKbizBotRunning) return;
    window.kbizBotQueue = []; renderBotQueue();
};

window.renderBotQueue = function() {
    const list = document.getElementById('botQueueList');
    document.getElementById('botQueueCount').innerText = window.kbizBotQueue.length;
    if (window.kbizBotQueue.length === 0) { list.innerHTML = '<div class="text-center text-gray-400 text-xs py-10">กรุณากด "+ เลือกลงคิว" จากด้านบน</div>'; return; }
    list.innerHTML = window.kbizBotQueue.map(b => `
        <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div class="flex flex-col">
                <span class="font-bold text-sm text-slate-800 dark:text-white">${b.machine_id}</span>
                <div class="flex items-center gap-2 text-[10px] mt-1 font-bold">
                    <span class="text-emerald-500">สำเร็จ: ${b.success}</span> | <span class="text-red-500">ไม่สำเร็จ: ${b.fail}</span>
                    <span class="text-blue-500 ml-2">${b.status === 'running' ? '(กำลังทำงาน...)' : ''}</span>
                </div>
            </div>
            <button onclick="removeBotFromQueue('${b.id}')" class="text-red-500 hover:text-red-700 ${window.isKbizBotRunning ? 'hidden' : ''}"><span class="material-icons text-sm">cancel</span></button>
        </div>
    `).join('');
};

window.handleBotStatusUpdate = function(e) {
    const { message, status, botId, action } = e.detail;
    addBotLog(message, status);
    if (botId) {
        const bot = window.kbizBotQueue.find(b => b.id === botId || b.machine_id === botId);
        if (bot) {
            if (action === 'success') bot.success++;
            else if (action === 'fail') bot.fail++;
            renderBotQueue(); 
        }
    }
};

window.startKbizBotProcess = function() {
    if (window.kbizBotQueue.length === 0) return Swal.fire('คิวว่าง', 'กรุณาเลือกบอทลงคิว', 'warning');

    const btn = document.getElementById('btnStartAutoRun');
    // 🌟 อ่านค่าลิมิตจำนวนครั้งที่ถอนเงิน 🌟
    const maxWithdraw = parseInt(document.getElementById('botSettingMaxWithdrawal').value) || 3;

    if (window.isKbizBotRunning) {
        window.isKbizBotRunning = false;
        btn.innerHTML = '<span class="material-icons">play_circle</span> เริ่มทำงานอัตโนมัติ (Auto-Run)';
        btn.className = "w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2";
        window.kbizBotQueue.forEach(b => b.status = 'ready'); renderBotQueue();
        addBotLog('หยุดการทำงานบอทแล้ว', 'warning');
        window.dispatchEvent(new CustomEvent('STOP_KBIZ_BOT'));
    } else {
        window.isKbizBotRunning = true;
        btn.innerHTML = '<span class="material-icons">stop_circle</span> หยุดการทำงานบอท (Stop)';
        btn.className = "w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2";
        window.kbizBotQueue.forEach(b => b.status = 'running'); renderBotQueue();
        
        addBotLog(`ส่งคำสั่งไปให้บอท ${window.kbizBotQueue.length} ตัว... (ตั้งลิมิตยอดถอนไว้ที่ ${maxWithdraw} ครั้ง)`, 'info');
        
        window.dispatchEvent(new CustomEvent('START_KBIZ_BOT', {
            detail: {
                max_withdrawal: maxWithdraw, // 👈 แนบไปกับคำสั่งด้วย
                bots: window.kbizBotQueue.map(b => ({
                    id: b.machine_id, machine_id: b.machine_id, username: b.username, password: b.password
                }))
            }
        }));
    }
};

window.addBotLog = function(message, status = 'info') {
    const logArea = document.getElementById('botLogArea'); if (!logArea) return;
    const time = new Date().toLocaleTimeString('th-TH');
    let color = 'text-green-400';
    if (status === 'error') color = 'text-red-400';
    if (status === 'warning') color = 'text-yellow-400';
    if (status === 'success') color = 'text-sky-400 font-bold';
    logArea.innerHTML += `<div><span class="text-gray-500">[${time}]</span> <span class="${color}">>> ${message}</span></div>`;
    logArea.scrollTop = logArea.scrollHeight;
};
window.clearBotLog = () => { document.getElementById('botLogArea').innerHTML = ''; };

setInterval(() => {
    const list = document.getElementById('savedBotsList');
    if (list && !list.hasAttribute('data-loaded')) {
        if (typeof window.renderSavedBots === 'function') {
            window.renderSavedBots(); window.renderBotQueue();
            list.setAttribute('data-loaded', 'true');
            window.removeEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
            window.addEventListener('BOT_STATUS_UPDATE', handleBotStatusUpdate);
        }
    }
}, 500);
