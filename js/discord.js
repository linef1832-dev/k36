const DISCORD_API_URL = 'https://my-discord-production-9382.up.railway.app';
let spyInterval;
let logInterval; 
let isDataLoaded = false;
let globalSpyData = []; 
let dsRoomList = [];

let extStaffList = [];
let extOnlineUsers = [];
let extStaffGroups = {}; 
let checkinStatusMap = {};
let uploadFiles = [];
let selectedAssign = new Set();
let selectedRemove = new Set(); 
let scheduledTransfers = [];
let transferHistory = [];
let selectedTransfer = new Set();
let spySelectedUsers = new Set();
let todaysLeaves = [];
let dsTimers = {};
window.customDiscordNames = window.customDiscordNames || {};
window.isSpyDropdownFocused = false;

function dsDebounce(key, func, delay = 200) {
    clearTimeout(dsTimers[key]);
    dsTimers[key] = setTimeout(func, delay);
}

function getDbUserFromDiscordName(discordName) {
    if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) return null;
    const dsNameClean = discordName.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
    let matchedUser = window.GLOBAL_USER_LIST.find(u => {
        const dbNameClean = u.username ? u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') : '';
        return dbNameClean.length > 1 && (dsNameClean.includes(dbNameClean) || dbNameClean.includes(dsNameClean));
    });
    if (matchedUser) return matchedUser;
    const parts = discordName.toLowerCase().split(/[-_\s|]+/).filter(p => p.length >= 2);
    for (const part of parts) {
        const pClean = part.replace(/[^a-z0-9ก-๙]/g, '');
        if (pClean.length >= 2) {
            matchedUser = window.GLOBAL_USER_LIST.find(u => {
                const dbNameClean = u.username ? u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') : '';
                return dbNameClean === pClean;
            });
            if (matchedUser) return matchedUser;
        }
    }
    return null;
}

window.applyDiscordPermissions = function() {
    const tabs = [
        { btnId: 'tabDsSpy', viewId: 'spy', reqPerm: 'ds_spy' },
        { btnId: 'tabDsMove', viewId: 'move', reqPerm: 'ds_move' },
        { btnId: 'tabDsCheckin', viewId: 'checkin', reqPerm: 'ds_checkin' },
        { btnId: 'tabDsManage', viewId: 'manage', reqPerm: 'ds_manage' },
        { btnId: 'tabDsVoicelog', viewId: 'voicelog', reqPerm: 'ds_log' },
        { btnId: 'tabDsActionlog', viewId: 'actionlog', reqPerm: 'ds_log' },
        { btnId: 'tabDsSendmsg', viewId: 'sendmsg', reqPerm: 'ds_manage' }
    ];

    let firstAllowedTab = null;

    tabs.forEach(tab => {
        const btn = document.getElementById(tab.btnId);
        if (!btn) return;
        if (window.hasUserPerm(tab.reqPerm) || ['manager', 'admin'].includes(currentUser?.role)) {
            btn.classList.remove('no-perm-hidden', 'hidden');
            btn.style.display = ''; 
            if (!firstAllowedTab) firstAllowedTab = tab.viewId;
        } else {
            btn.classList.add('no-perm-hidden');
            btn.style.display = 'none';
        }
    });

    if (firstAllowedTab) {
        document.getElementById('discordNoAccessMessage')?.remove();
        const activeTabs = ['spy', 'move', 'checkin', 'manage', 'voicelog', 'actionlog', 'sendmsg'];
        let isCurrentTabValid = false;
        
        activeTabs.forEach(t => {
            const contentBox = document.getElementById('dsContent_' + t);
            if(contentBox && !contentBox.classList.contains('hidden')) {
                const reqPerm = tabs.find(x => x.viewId === t)?.reqPerm;
                if(window.hasUserPerm(reqPerm) || ['manager', 'admin'].includes(currentUser?.role)) isCurrentTabValid = true;
            }
        });

        if (!isCurrentTabValid) {
            switchDiscordTab(firstAllowedTab);
        } else {
            let visibleTab = 'spy';
            activeTabs.forEach(t => {
                const contentBox = document.getElementById('dsContent_' + t);
                if(contentBox && !contentBox.classList.contains('hidden')) visibleTab = t;
            });
            switchDiscordTab(visibleTab);
        }

    } else {
        tabs.forEach(t => {
            const contentBox = document.getElementById('dsContent_' + t.viewId);
            if(contentBox) contentBox.classList.add('hidden');
        });
        
        if(!document.getElementById('discordNoAccessMessage')) {
            const msg = document.createElement('div');
            msg.id = 'discordNoAccessMessage';
            msg.className = 'text-center mt-[15vh] flex flex-col items-center justify-center fade-in';
            msg.innerHTML = `
                <span class="material-icons text-red-500 text-7xl mb-4 drop-shadow-md">lock</span>
                <h2 class="text-2xl font-black text-white tracking-wider">คุณไม่มีสิทธิ์เข้าถึงเมนูใดๆ ในระบบดิสคอร์ด</h2>
                <p class="text-gray-400 mt-2 text-sm">กรุณาติดต่อผู้จัดการเพื่อขอสิทธิ์การเข้าถึง</p>
            `;
            const appBox = document.querySelector('#discordApp .flex-1');
            if(appBox) appBox.appendChild(msg);
        }
    }
};

window.switchDiscordTab = function(tabName) {
    try {
        const allViews = ['spy', 'move', 'checkin', 'manage', 'voicelog', 'actionlog', 'sendmsg'];
        allViews.forEach(view => {
            const el = document.getElementById('dsContent_' + view);
            if (el) el.classList.add('hidden');
            const btn = document.getElementById('tabDs' + view.charAt(0).toUpperCase() + view.slice(1));
            if (btn) btn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-700 text-gray-300 hover:text-white flex items-center gap-1";
        });

        const targetView = document.getElementById('dsContent_' + tabName);
        if (targetView) targetView.classList.remove('hidden');

        if(spyInterval) clearInterval(spyInterval);
        if(logInterval) clearInterval(logInterval); 

        const activeBtn = document.getElementById('tabDs' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
        if (activeBtn) {
            if (tabName === 'spy') {
                activeBtn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center gap-1";
                ds_fetchSpy(); 
                ds_fetchChannelsSilently();
                spyInterval = setInterval(ds_fetchSpy, 3000); 
            } 
            else if (tabName === 'move') {
                activeBtn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)] flex items-center gap-1";
                ds_fetchChannels(); 
            }
            else if (tabName === 'checkin') {
                activeBtn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)] flex items-center gap-1";
                const d = new Date();
                const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
                if(document.getElementById('tgDate')) document.getElementById('tgDate').value = `${y}-${m}-${day}`;
                
                ds_fetchSpy().then(() => {
                    fetchTodaysLeaves().then(() => {
                        if (!isDataLoaded) fetchSystemData(false).then(() => _doRenderCheckinTable()); 
                        else _doRenderCheckinTable();
                    });
                });
            }
            else if (tabName === 'manage') {
                activeBtn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.5)] flex items-center gap-1";
                if (!isDataLoaded) fetchSystemData(false); 
                else {
                    _doRenderManagerList(); renderGroupList(); renderTransferUserList(); fetchTransfers();
                }
            }
            else if (tabName === 'voicelog') {
                activeBtn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-fuchsia-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.5)] flex items-center gap-1";
                const dateInput = document.getElementById('voiceLogDate');
                if(dateInput && !dateInput.value) {
                    const tzOffset = 7 * 60 * 60 * 1000;
                    dateInput.value = new Date(Date.now() + tzOffset).toISOString().split('T')[0];
                }
                ds_fetchVoiceLogs();
                logInterval = setInterval(() => {
                    ds_fetchVoiceLogs(false, 1);
                }, 15000);
            }
            else if (tabName === 'actionlog') {
                activeBtn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)] flex items-center gap-1";
                ds_fetchActionLogs();
            }
            else if (tabName === 'sendmsg') {
                activeBtn.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] flex items-center gap-1";
                if(typeof ds_fetchChannelsForSendMsg === 'function') ds_fetchChannelsForSendMsg();
                if(typeof ds_loadMsgTemplates === 'function') ds_loadMsgTemplates();
            }
        }
    } catch(err) { console.error("Tab Switch Error:", err); }
};

window.fetchSystemData = async function(forceSync = false, silent = false) {
    if (isDataLoaded && !forceSync && !silent) return; 
    try {
        if (forceSync && !silent) Swal.fire({title: 'กำลังเชื่อมต่อบอท...', text: 'เซิร์ฟเวอร์อาจกำลังตื่นนอน โปรดรอสักครู่...', didOpen: () => Swal.showLoading(), allowOutsideClick: false});
        
        if (typeof appDB !== 'undefined') {
            const { data: dbUsers } = await appDB.from('users').select('*');
            if (dbUsers && dbUsers.length > 0) window.GLOBAL_USER_LIST = dbUsers;

            const { data: customNameData } = await appDB.from('settings').select('value').eq('key', 'discord_custom_names').single();
            if (customNameData && customNameData.value) {
                window.customDiscordNames = JSON.parse(customNameData.value);
            }
        }

        const tStamp = Date.now();
        const fetchOpts = { headers: { 'Cache-Control': 'no-cache', 'ngrok-skip-browser-warning': 'true' } };

        const [sRes, oRes, gRes] = await Promise.all([
            fetch(`${DISCORD_API_URL}/api/staff-list?t=${tStamp}`, fetchOpts).catch(e => { throw new Error('NET_BLOCK'); }),
            fetch(`${DISCORD_API_URL}/api/online-status?t=${tStamp}`, fetchOpts).catch(e => { throw new Error('NET_BLOCK'); }),
            fetch(`${DISCORD_API_URL}/api/staff-groups?t=${tStamp}`, fetchOpts).catch(e => { throw new Error('NET_BLOCK'); })
        ]);
        
        if (!sRes.ok) throw new Error('BOT_SLEEP'); 

        const sData = await sRes.json().catch(()=>[]);
        const oData = await oRes.json().catch(()=>[]);
        const gData = await gRes.json().catch(()=>({}));

        let rawStaffList = Array.isArray(sData) ? sData : (sData.data || []);
        
        extStaffList = rawStaffList.map(s => {
            if (window.customDiscordNames[s.id]) {
                return { ...s, name: window.customDiscordNames[s.id] }; 
            }
            return s; 
        });

        let rawOnline = Array.isArray(oData) ? oData : (oData.data || oData.users || oData.online || []);
        extOnlineUsers = rawOnline.map(item => typeof item === 'object' ? String(item.id || item.user_id) : String(item));
        if (Object.keys(gData).length > 0) extStaffGroups = gData;

        isDataLoaded = true;

        updateAllFilters();
        if (typeof renderGroupList === 'function') renderGroupList();
        if (typeof _doRenderCheckinTable === 'function') _doRenderCheckinTable();
        if (typeof _doRenderManagerList === 'function') _doRenderManagerList();
        if (typeof renderTransferUserList === 'function') renderTransferUserList();
        if (typeof fetchTransfers === 'function') fetchTransfers();
        
        if (forceSync && !silent) {
            Swal.fire({icon: 'success', title: 'เชื่อมต่อสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    } catch(e) {
        console.error("System Fetch Error:", e);
        if (!silent) {
            if (e.message === 'NET_BLOCK') Swal.fire('เครื่องนี้บล็อกบอท!', 'เน็ตเวิร์ค หรือ AdBlock บล็อกการเชื่อมต่อ', 'error');
            else if (e.message === 'BOT_SLEEP') Swal.fire('บอทกำลังตื่นนอน', 'รอสัก 30 วินาทีแล้วลองกดรีเฟรชใหม่ครับ', 'warning');
            else Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
        }
    }
};

window.syncDiscord = async function() { 
    Swal.fire({title: 'กำลังสั่งบอทดึงรายชื่อ...', didOpen: () => Swal.showLoading()}); 
    try {
        const res = await fetch(DISCORD_API_URL + '/api/import-discord-members', { method:'POST', headers: { 'Cache-Control': 'no-cache' } }); 
        if(!res.ok) throw new Error('API_FAIL');
        await fetchSystemData(true, true); 
        Swal.fire({icon: 'success', title: 'อัปเดตเรียบร้อย', timer: 1000, showConfirmButton: false}); 
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'เชื่อมต่อล้มเหลว', text: 'บอทอาจจะหลับอยู่ หรือคอมเครื่องนี้มีระบบป้องกัน' });
    }
};

window.spy_toggleSelectUser = function(uid) {
    if(spySelectedUsers.has(uid)) spySelectedUsers.delete(uid);
    else spySelectedUsers.add(uid);
    document.getElementById('spySelectedCount').innerText = spySelectedUsers.size;
};

window.spy_toggleSelectAll = function() {
    const isChecked = document.getElementById('spySelectAll').checked;
    document.querySelectorAll('.spy-user-cb').forEach(cb => {
        cb.checked = isChecked;
        if(isChecked) spySelectedUsers.add(cb.value);
        else spySelectedUsers.delete(cb.value);
    });
    document.getElementById('spySelectedCount').innerText = spySelectedUsers.size;
};

window.spy_moveSelectedUsers = async function() {
    const targetId = document.getElementById('bulkMoveTarget').value;
    const ids = Array.from(spySelectedUsers);
    if(ids.length === 0) return Swal.fire('เตือน', 'กรุณาติ๊กเลือกคนที่จะย้ายก่อน', 'warning');
    if(!targetId) return Swal.fire('เตือน', 'กรุณาเลือกห้องปลายทาง', 'warning');

    Swal.fire({title: 'กำลังย้าย...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${DISCORD_API_URL}/api/move-users`, {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ userIds: ids, targetChannelId: targetId })
        });
        const r = await res.json();
        if(r.success) {
            Swal.fire('สำเร็จ', `ย้ายพนักงาน ${r.movedCount} คนแล้ว`, 'success');
            ds_logAction('Spy Move', `ดึงคนย้ายห้อง ${ids.length} คน ไปยังเป้าหมาย`);
            spySelectedUsers.clear();
            document.getElementById('spySelectAll').checked = false;
            document.getElementById('spySelectedCount').innerText = 0;
            ds_fetchSpy();
        } else Swal.fire('Error', r.error, 'error');
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

window.spy_returnMove = async function() {
    Swal.fire({title: 'กำลังย้ายกลับ...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${DISCORD_API_URL}/api/spy-return`, { method: 'POST' });
        const r = await res.json();
        if (r.success) {
            Swal.fire('สำเร็จ', `ย้ายกลับ ${r.count} คนแล้ว`, 'success');
            ds_logAction('Spy Return', `ดึงพนักงาน ${r.count} คนกลับห้องเดิม`);
        } else Swal.fire('Error', r.error, 'error');
    } catch(e) { Swal.fire('Error', 'เชื่อมต่อบอทไม่ได้', 'error'); }
};

window.spy_moveSingleUser = async function(uid, targetId) {
    if(!targetId) return;
    try {
        await fetch(`${DISCORD_API_URL}/api/move-users`, {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ userIds: [uid], targetChannelId: targetId })
        });
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: 'ย้ายเรียบร้อย' });
        ds_logAction('Spy Move Single', `ย้าย 1 คนไปห้องใหม่`);
        ds_fetchSpy();
    } catch(e) {}
};

window.ds_renderSpyTable = function() {
    const term = document.getElementById('spySearchInput').value.toLowerCase();
    const tbody = document.getElementById('ds_spyBody');
    const now = Date.now();
    
    let roomOptionsHtml = '<option value="">⚡ ย้ายไป..</option>';
    dsRoomList.forEach(c => { roomOptionsHtml += `<option value="${c.id}">${c.name}</option>`; });

    const filtered = globalSpyData.filter(u => term === '' || u.name.toLowerCase().includes(term));
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-500">ไม่พบรายชื่อพนักงาน</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(u => {
        let mute = u.totalMute + (u.startMute ? (now - u.startMute) : 0);
        let deaf = u.totalDeaf + (u.startDeaf ? (now - u.startDeaf) : 0);
        
        let mStr = '-';
        if (mute > 0) {
            let mMins = Math.floor(mute / 60000);
            mStr = mMins > 0 ? `${mMins} นาที` : `< 1 นาที`;
        }
        let dStr = '-';
        if (deaf > 0) {
            let dMins = Math.floor(deaf / 60000);
            dStr = dMins > 0 ? `${dMins} นาที` : `< 1 นาที`;
        }
        
        let statusBadges = '';
        if(u.startMute) statusBadges += '<span class="bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/50 mr-1">ปิดไมค์</span>';
        if(u.startDeaf) statusBadges += '<span class="bg-red-500/20 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/50 mr-1">ปิดหูฟัง</span>';
        if(!statusBadges && u.currentRoom) statusBadges = '<span class="text-gray-500 text-xs">ปกติ</span>';

        let devicesHTML = '';
        let isDouble = false;
        if (u.devices) {
            if (u.devices.includes('desktop')) devicesHTML += '<span title="PC" class="text-lg">💻</span>';
            if (u.devices.includes('web')) devicesHTML += '<span title="Web" class="text-lg">🌐</span>';
            if (u.devices.includes('mobile')) devicesHTML += '<span title="Mobile" class="text-lg">📱</span>';
            if (u.devices.includes('desktop') && u.devices.includes('web')) isDouble = true;
        }
        if(isDouble) devicesHTML += '<span class="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold ml-2 animate-pulse">ซ้อน 2 จอ!</span>';

        const roomBadge = u.currentRoom ? `<span class="bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded border border-indigo-700/50 text-xs font-bold">${u.currentRoom}</span>` : '<span class="text-gray-600 text-xs">ออฟไลน์</span>';
        const nameColor = u.currentRoom ? 'text-white' : 'text-gray-500';
        const isChecked = spySelectedUsers.has(u.id) ? 'checked' : '';

        return window.renderTemplate('tpl-ds-spy-row', {
            id: u.id,
            nameColor: nameColor,
            name: u.name,
            roomBadge: roomBadge,
            devicesHTML: devicesHTML,
            statusBadges: statusBadges,
            mStr: mStr,
            dStr: dStr,
            roomOptionsHtml: roomOptionsHtml,
            isChecked: isChecked
        });
    }).join('');
};

window.ds_fetchSpy = async function() {
    try {
        const res = await fetch(DISCORD_API_URL + '/api/spy-data?t=' + Date.now());
        if(res.ok) {
            const data = await res.json();
            globalSpyData = Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a,b) => (a.currentRoom ? -1 : 1));
            if (!window.isSpyDropdownFocused) ds_renderSpyTable();
        }
    } catch(e) {}
};

window.ds_fetchChannelsSilently = async function() {
    try {
        if(typeof appDB !== 'undefined') {
            const { data } = await appDB.from('settings').select('value').eq('key', 'discord_channels').single();
            if (data && data.value) {
                dsRoomList = JSON.parse(data.value);
                let dropHtml = '<option value="">-- เลือกห้องปลายทาง --</option>';
                dsRoomList.forEach(c => dropHtml += `<option value="${c.id}">${c.name}</option>`);
                const targetSelect = document.getElementById('bulkMoveTarget');
                if(targetSelect) targetSelect.innerHTML = dropHtml;
            }
        }
    } catch(e) {}
};

window.filterSourceRooms = function() {
    const term = document.getElementById('searchSourceRoom').value.toLowerCase();
    document.querySelectorAll('.ds-room-item').forEach(el => {
        const name = el.getAttribute('data-name').toLowerCase();
        el.style.display = name.includes(term) ? 'flex' : 'none';
    });
};

window.ds_fetchChannels = async function() {
    try {
        if(typeof appDB !== 'undefined') {
            const { data } = await appDB.from('settings').select('value').eq('key', 'discord_channels').single();
            if (data && data.value) {
                dsRoomList = JSON.parse(data.value);
                let srcHtml = '';
                let targetHtml = '<option value="">-- เลือกห้องที่ต้องการย้ายไป --</option>';
                
                dsRoomList.forEach(c => {
                    srcHtml += window.renderTemplate('tpl-ds-source-room', { id: c.id, name: c.name });
                    targetHtml += `<option value="${c.id}">${c.name}</option>`;
                });
                document.getElementById('ds_sourceRooms').innerHTML = srcHtml;
                document.getElementById('ds_targetRoom').innerHTML = targetHtml;
            }
        }
    } catch (e) { 
        document.getElementById('ds_sourceRooms').innerHTML = '<div class="text-center text-gray-500 py-10">รอโหลดข้อมูล...</div>';
    }
};

window.ds_startMove = async function() {
    const srcIds = Array.from(document.querySelectorAll('input[name="ds_src"]:checked')).map(cb => cb.value);
    const target = document.getElementById('ds_targetRoom').value;
    if (!target || srcIds.length === 0) return Swal.fire('เตือน', 'เลือกห้องต้นทางและปลายทางก่อน', 'warning');

    Swal.fire({title: 'กำลังย้าย...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${DISCORD_API_URL}/api/mass-move-rooms`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceChannelIds: srcIds, targetChannelId: target })
        });
        const r = await res.json();
        if (r.success) {
            Swal.fire('สำเร็จ', `ย้ายพนักงาน ${r.count} คนแล้ว`, 'success');
            ds_logAction('Mass Move', `ย้ายพนักงาน ${r.count} คนไปห้องเป้าหมาย`);
        } else Swal.fire('Error', r.error, 'error');
    } catch(e) { Swal.fire('Error', 'เชื่อมต่อบอทไม่ได้', 'error'); }
};

window.ds_returnMove = async function() {
    Swal.fire({title: 'กำลังย้ายกลับ...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${DISCORD_API_URL}/api/mass-return`, { method: 'POST' });
        const r = await res.json();
        if (r.success) {
            Swal.fire('สำเร็จ', `ย้ายกลับ ${r.count} คนแล้ว`, 'success');
            ds_logAction('Return Move', `ดึงพนักงาน ${r.count} คนกลับห้องเดิม`);
        } else Swal.fire('Error', r.error, 'error');
    } catch(e) { Swal.fire('Error', 'เชื่อมต่อบอทไม่ได้', 'error'); }
};

window.loadTgConfigLocal = function() {
    const savedToken = localStorage.getItem('tg_bot_token');
    const savedChatId = localStorage.getItem('tg_chat_id');
    if(savedToken && document.getElementById('cfgToken')) document.getElementById('cfgToken').value = savedToken;
    if(savedChatId && document.getElementById('cfgChatId')) document.getElementById('cfgChatId').value = savedChatId;
};

window.saveTgConfigLocal = async function() {
    const token = document.getElementById('cfgToken').value.trim();
    const chatId = document.getElementById('cfgChatId').value.trim();
    localStorage.setItem('tg_bot_token', token);
    localStorage.setItem('tg_chat_id', chatId);
    try { await fetch(DISCORD_API_URL + '/api/save-tg-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ botToken: token, chatId: chatId }) }); } catch(e) {}
    Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', text: 'ระบบจะจำการตั้งค่านี้ไว้ในเบราว์เซอร์ของคุณ', timer: 2000, showConfirmButton: false});
    document.getElementById('tgSettingsBox').classList.add('hidden');
};

window.renderCheckinTable = function() { dsDebounce('checkin', _doRenderCheckinTable, 200); };

window._doRenderCheckinTable = function() {
    const container = document.getElementById('checkinTableContainer');
    if(!container) return;
    const group = document.getElementById('groupFilter').value;
    const search = document.getElementById('searchTable').value.toLowerCase();
    
    let counts = { '✅':0, '🏖️':0, '🤒':0, '📝':0, '❌':0, 'TOTAL':0 };
    
    const filteredStaff = extStaffList.filter(s => {
        const passGroup = group === 'ALL' || (extStaffGroups[group] && extStaffGroups[group].includes(s.id));
        const passSearch = search === '' || s.name.toLowerCase().includes(search);
        return passGroup && passSearch;
    });

    if (filteredStaff.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 p-8 font-bold">ไม่พบข้อมูลรายชื่อ</div>';
        document.getElementById('statusSummary').innerHTML = '';
        return;
    }

    container.innerHTML = filteredStaff.map(s => {
        counts.TOTAL++;
        const inVoiceRoom = globalSpyData.some(spy => (String(spy.id) === String(s.id) || spy.name === s.name) && spy.currentRoom);
        const isOnline = extOnlineUsers.includes(String(s.id)) || inVoiceRoom;
        
        const dbUser = getDbUserFromDiscordName(s.name);
        
        let leaveReasonDb = null;
        if (dbUser && todaysLeaves && todaysLeaves.length > 0) {
            const foundLeave = todaysLeaves.find(l => {
                const dbNameLeave = l.user_name ? l.user_name.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') : '';
                const dbNameClean = dbUser.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
                return dbNameLeave === dbNameClean || dbNameClean.includes(dbNameLeave);
            });
            if (foundLeave) leaveReasonDb = foundLeave.reason;
        }
        
        let st = checkinStatusMap[s.id];
        if (!st) {
            if (leaveReasonDb) {
                if (leaveReasonDb === 'KL') st = '📝'; 
                else st = '🏖️'; 
            }
            else if (isOnline) st = '✅';
            else st = '❌';
        }
        
        if(counts[st] !== undefined) counts[st]++;

        let leaveBadgeHtml = '';
        if (leaveReasonDb) {
            let badgeText = 'ลาหยุดวันนี้';
            let badgeColor = 'bg-amber-500 text-white';
            if (leaveReasonDb === 'KL') { badgeText = 'ลากิจ (KL)'; badgeColor = 'bg-green-600 text-white'; }
            else if (leaveReasonDb === 'X' || leaveReasonDb === 'Table-Booking') { badgeText = 'หยุดปกติ (X)'; badgeColor = 'bg-red-500 text-white'; }
            else if (leaveReasonDb === 'XX') { badgeText = 'เปลี่ยนกะ (XX)'; badgeColor = 'bg-yellow-400 text-yellow-900'; }
            else if (leaveReasonDb === 'X4') { badgeText = 'ลาครึ่งวัน (X4)'; badgeColor = 'bg-pink-500 text-white'; }
            else if (leaveReasonDb === 'TL' || leaveReasonDb === 'TX') { badgeText = 'สลับวันหยุด (' + leaveReasonDb + ')'; badgeColor = 'bg-blue-500 text-white'; }
            else if (leaveReasonDb === 'PN') { badgeText = 'พักร้อน (PN)'; badgeColor = 'bg-amber-800 text-white'; }
            
            leaveBadgeHtml = `<span class="text-[9px] ${badgeColor} px-1.5 py-0.5 rounded shadow-sm ml-1 font-bold border border-black/10">${badgeText}</span>`;
        }
        
        return window.renderTemplate('tpl-ds-checkin-row', {
            onlineColorClass: isOnline ? 'text-emerald-400' : 'text-gray-400',
            onlineDotClass: isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gray-600',
            name: s.name,
            leaveBadgeHtml: leaveBadgeHtml,
            id: s.id,
            selA: st==='✅'?'selected':'',
            selB: st==='🏖️'?'selected':'',
            selC: st==='🤒'?'selected':'',
            selD: st==='📝'?'selected':'',
            selE: st==='❌'?'selected':''
        });
    }).join('');
    
    document.getElementById('statusSummary').innerHTML = `
        <div class="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-xl text-center shadow-inner"><b class="text-white text-lg">${counts.TOTAL}</b><br><span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ทั้งหมด</span></div>
        <div class="flex-1 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-center shadow-inner"><b class="text-emerald-400 text-lg">${counts['✅']}</b><br><span class="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">มาทำงาน</span></div>
        <div class="flex-1 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-center shadow-inner"><b class="text-amber-400 text-lg">${counts['🏖️']}</b><br><span class="text-[10px] font-bold text-amber-500 uppercase tracking-widest">ลาหยุด</span></div>
        <div class="flex-1 bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-center shadow-inner"><b class="text-red-400 text-lg">${counts['❌']}</b><br><span class="text-[10px] font-bold text-red-500 uppercase tracking-widest">ขาด</span></div>
    `;
};

window.updateCheckinStatus = function(uid, val) { checkinStatusMap[uid] = val; _doRenderCheckinTable(); };
window.clearCheckinStatus = function() { if(confirm('ล้างสถานะทั้งหมด?')) { checkinStatusMap={}; _doRenderCheckinTable(); } };

document.addEventListener('paste', e => {
    const dsContentCheckin = document.getElementById('dsContent_checkin');
    if(!dsContentCheckin || dsContentCheckin.classList.contains('hidden')) return;
    
    const items = e.clipboardData.items;
    for(let i=0; i<items.length; i++) if(items[i].type.indexOf('image')!==-1) uploadFiles.push(items[i].getAsFile());
    
    const g = document.getElementById('imgGallery'), pa = document.getElementById('pasteArea');
    if(!g || !pa) return;

    g.innerHTML = '';
    if (uploadFiles.length > 0) pa.classList.add('hidden'); else pa.classList.remove('hidden');
    uploadFiles.forEach((f, idx) => {
        g.innerHTML += `<div class="relative group"><img src="${URL.createObjectURL(f)}" class="w-16 h-16 object-cover rounded-xl border border-slate-500 shadow-md"><button onclick="removeUploadImage(${idx})" class="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition shadow-lg">X</button></div>`;
    });
});

window.removeUploadImage = function(idx) { uploadFiles.splice(idx, 1); document.dispatchEvent(new Event('paste')); };

window.sendToTelegram = async function() {
    if(uploadFiles.length === 0) return Swal.fire('แจ้งเตือน', 'กรุณากด Ctrl+V เพื่อวางรูปภาพหลักฐานก่อนครับ', 'warning');
    
    const botToken = localStorage.getItem('tg_bot_token') || document.getElementById('cfgToken').value;
    const chatId = localStorage.getItem('tg_chat_id') || document.getElementById('cfgChatId').value;
    
    if (!botToken || !chatId) {
        document.getElementById('tgSettingsBox').classList.remove('hidden');
        return Swal.fire('ตั้งค่าก่อน', 'กรุณาใส่ Token บอท และ Chat ID ที่ปุ่มตั้งค่าด้านบนให้เรียบร้อยก่อนส่งครับ', 'info');
    }

    const title = document.getElementById('tgTitle').value;
    const group = document.getElementById('groupFilter').value;
    const round = document.getElementById('roundFilter').value;
    const reporter = document.getElementById('reporterName').value;
    
    let listText = `📋 <b>${title}</b>`;
    if (group !== 'ALL') listText += ` (${group})`;
    if (round) listText += ` - ${round}`;
    
    const dateVal = document.getElementById('tgDate').value;
    if(dateVal) { 
        const [y,m,d] = dateVal.split('-'); 
        listText += `\n📅 ${d}/${m}/${parseInt(y)+543}\n\n`; 
    } else { 
        listText += `\n\n`; 
    }
    
    let counts = { '✅':0, '🏖️':0, '🤒':0, '📝':0, '❌':0 }, namesText = "";
    extStaffList.forEach(s => {
        if(group !== 'ALL' && !extStaffGroups[group]?.includes(s.id)) return;
        
        const dbUser = getDbUserFromDiscordName(s.name);
        
        let leaveReasonDb = null;
        if (dbUser && todaysLeaves && todaysLeaves.length > 0) {
            const foundLeave = todaysLeaves.find(l => {
                const dbNameLeave = l.user_name ? l.user_name.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') : '';
                const dbNameClean = dbUser.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
                return dbNameLeave === dbNameClean || dbNameClean.includes(dbNameLeave);
            });
            if (foundLeave) leaveReasonDb = foundLeave.reason;
        }
        
        let st = checkinStatusMap[s.id];
        if (!st) {
            if (leaveReasonDb) {
                st = (leaveReasonDb === 'KL') ? '📝' : '🏖️';
            } else {
                const inVoiceRoom = globalSpyData.some(spy => (String(spy.id) === String(s.id) || spy.name === s.name) && spy.currentRoom);
                const isOnline = extOnlineUsers.includes(String(s.id)) || inVoiceRoom;
                st = isOnline ? '✅' : '❌';
            }
        }

        counts[st]++;
        let txt = '(ยังไม่เข้างาน❌)';
        if(st==='✅') txt='(✅)'; else if(st==='🏖️') txt='(หยุด 🏖)'; else if(st==='🤒') txt='(ป่วย 🤒)'; else if(st==='📝') txt='(กิจ 📝)';
        namesText += `${s.name} ${txt}\n`;
    });
    
    let summaryParts = [];
    if(counts['✅'] > 0) summaryParts.push(`มา ${counts['✅']}`);
    if(counts['🏖️'] > 0) summaryParts.push(`หยุด ${counts['🏖️']}`);
    if(counts['🤒'] > 0) summaryParts.push(`ลาป่วย ${counts['🤒']}`);
    if(counts['📝'] > 0) summaryParts.push(`ลากิจ ${counts['📝']}`);
    if(counts['❌'] > 0) summaryParts.push(`ขาด ${counts['❌']}`);
    if(summaryParts.length > 0) listText += `📊 สรุป: ` + summaryParts.join(' | ') + '\n\n';
    
    listText += namesText;
    if(reporter) listText += `\n👤 ผู้ทำรายการ: ${reporter}`;

    Swal.fire({title: 'กำลังส่งข้อมูล...', text: 'กำลังยิงเข้ากลุ่ม Telegram...', didOpen: () => Swal.showLoading(), allowOutsideClick: false});
    
    try {
        const tgApiUrl = `https://api.telegram.org/bot${botToken}`;

        const textRes = await fetch(`${tgApiUrl}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: listText,
                parse_mode: 'HTML'
            })
        });

        if (!textRes.ok) {
            const errData = await textRes.json();
            throw new Error(`ส่งข้อความไม่ผ่าน: ${errData.description}`);
        }

        if (uploadFiles.length === 1) {
            const fd = new FormData();
            fd.append('chat_id', chatId);
            fd.append('photo', uploadFiles[0]); 

            const imgRes = await fetch(`${tgApiUrl}/sendPhoto`, { method: 'POST', body: fd });
            if (!imgRes.ok) {
                const errData = await imgRes.json();
                throw new Error(`ส่งรูปไม่ผ่าน: ${errData.description}`);
            }
        } else {
            const fd = new FormData();
            fd.append('chat_id', chatId);
            
            let mediaArray = [];
            uploadFiles.forEach((file, index) => {
                mediaArray.push({ type: 'photo', media: `attach://img${index}` });
                fd.append(`img${index}`, file);
            });
            
            fd.append('media', JSON.stringify(mediaArray));
            const imgRes = await fetch(`${tgApiUrl}/sendMediaGroup`, { method: 'POST', body: fd });
            if (!imgRes.ok) {
                const errData = await imgRes.json();
                throw new Error(`ส่งรูปไม่ผ่าน: ${errData.description}`);
            }
        }

        Swal.fire('สำเร็จ', 'ส่งข้อมูลเข้ากลุ่มเรียบร้อย', 'success'); 
        if (typeof ds_logAction === 'function') ds_logAction('ส่งเช็คชื่อ (Telegram)', `ส่งรายงานเข้าหัวข้อ: ${title} (${group})`);
        
        uploadFiles = []; 
        document.getElementById('imgGallery').innerHTML = ''; 
        document.getElementById('pasteArea').classList.remove('hidden'); 

    } catch(e) { 
        console.error("Telegram Direct Send Error:", e);
        Swal.fire('ส่งไม่ได้!', e.message || 'ตรวจสอบ Token และ Chat ID อีกครั้ง', 'error'); 
    }
};

window.fetchTodaysLeaves = async function() {
    try {
        const todayStr = document.getElementById('tgDate').value;
        if(typeof appDB !== 'undefined') {
            const { data } = await appDB.from('leave_requests').select('user_name, reason').eq('leave_date', todayStr);
            todaysLeaves = data || [];
        }
    } catch (e) { }
};

window.renderTransferSection = function() {
    const gSelect = document.getElementById('transferToGroup');
    if(gSelect) gSelect.innerHTML = '<option value="">-- เลือกกลุ่มปลายทาง --</option>' + Object.keys(extStaffGroups).map(g => `<option value="${g}">${g}</option>`).join('');
    _doRenderTransferUserList();
};

window.toggleTransfer = function(id) { if(selectedTransfer.has(id)) selectedTransfer.delete(id); else selectedTransfer.add(id); _doRenderTransferUserList(); };
window.renderTransferUserList = function() { dsDebounce('transfer', _doRenderTransferUserList, 200); };

window._doRenderTransferUserList = function() {
    const t = document.getElementById('transferSearch').value.toLowerCase();
    const group = document.getElementById('filterTransferGroup').value;
    const deptFilter = document.getElementById('filterTransferDept').value;
    const shiftFilter = document.getElementById('filterTransferShift').value;
    const c = document.getElementById('transferUserList');
    if(!c) return;

    document.getElementById('transferSelectedTags').innerHTML = Array.from(selectedTransfer).map(id => {
        const s = extStaffList.find(x=>x.id===id);
        return s ? `<span class="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">${s.name} <span class="material-icons text-[12px] cursor-pointer hover:text-black transition" onclick="toggleTransfer('${id}')">cancel</span></span>` : '';
    }).join('');
    
    const filtered = extStaffList.filter(s => {
        const nameMatch = s.name.toLowerCase().includes(t);
        const groupMatch = group === 'ALL' || (extStaffGroups[group] && extStaffGroups[group].includes(s.id));
        
        let matchDept = true;
        let matchShift = true;

        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            const dbUser = getDbUserFromDiscordName(s.name);
            if (!dbUser) return false;
            if (deptFilter !== 'ALL' && (dbUser.department || 'AM') !== deptFilter) matchDept = false;
            if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) matchShift = false;
        }

        return nameMatch && groupMatch && matchDept && matchShift;
    });

    if (filtered.length === 0) {
        c.innerHTML = '<div class="text-center text-gray-500 text-xs py-6">ไม่พบรายชื่อพนักงาน</div>';
        return;
    }

    c.innerHTML = filtered.map(s => {
        const isSel = selectedTransfer.has(s.id);
        const dbUser = getDbUserFromDiscordName(s.name);
        let tagHtml = dbUser ? `<span class="text-[9px] text-gray-500 ml-2">(${dbUser.department||'AM'} | ${dbUser.allowed_shift.replace('กะ','')})</span>` : '';

        return window.renderTemplate('tpl-ds-transfer-user-row', {
            id: s.id,
            bgClass: isSel ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-inner ring-1 ring-emerald-500' : 'bg-slate-900 border border-slate-700 text-gray-300 hover:bg-slate-800',
            name: s.name,
            tagHtml: tagHtml,
            iconHtml: isSel ? '<span class="material-icons text-emerald-500">check_circle</span>' : '<span class="material-icons text-gray-600 text-sm">radio_button_unchecked</span>'
        });
    }).join('');
};

window.selectAllVisibleTransfer = function() {
    const t = document.getElementById('transferSearch').value.toLowerCase();
    const group = document.getElementById('filterTransferGroup').value;
    const deptFilter = document.getElementById('filterTransferDept').value;
    const shiftFilter = document.getElementById('filterTransferShift').value;

    extStaffList.filter(s => {
        const nameMatch = s.name.toLowerCase().includes(t);
        const groupMatch = group === 'ALL' || (extStaffGroups[group] && extStaffGroups[group].includes(s.id));
        let matchDept = true; let matchShift = true;
        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            const dbUser = getDbUserFromDiscordName(s.name);
            if (!dbUser) return false;
            if (deptFilter !== 'ALL' && (dbUser.department || 'AM') !== deptFilter) matchDept = false;
            if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) matchShift = false;
        }
        return nameMatch && groupMatch && matchDept && matchShift;
    }).forEach(s => selectedTransfer.add(s.id));
    _doRenderTransferUserList();
};

window.scheduleTransfer = async function() {
    const ids = Array.from(selectedTransfer);
    const toGroup = document.getElementById('transferToGroup').value;
    const time = document.getElementById('transferTime').value;

    if(ids.length===0 || !toGroup || !time) return Swal.fire('ข้อมูลไม่ครบ', 'เลือกคน, กลุ่มปลายทาง, และเวลา', 'warning');

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    for(const staffId of ids) {
        let fromGroup = '?';
        for(let g in extStaffGroups) { if(extStaffGroups[g].includes(staffId)) { fromGroup = g; break; } }
        
        await fetch(DISCORD_API_URL + '/api/schedule-transfer', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ staffId, fromGroup, toGroup, executeAt: time })
        });
    }
    Swal.fire('สำเร็จ', 'บันทึกการตั้งเวลาย้ายกลุ่มแล้ว', 'success');
    selectedTransfer.clear();
    fetchTransfers();
    _doRenderTransferUserList();
};

window.fetchTransfers = async function() {
    try {
        const [dsRes, webRes] = await Promise.all([
            fetch(DISCORD_API_URL + '/api/transfers').catch(() => ({json: () => ({pending:[], history:[]})})),
            (typeof appDB !== 'undefined' ? appDB.from('scheduled_tasks').select('*').in('task_type', ['individual_shift_update', 'group_transfer']).order('created_at', {ascending: false}).limit(100) : Promise.resolve({data: []}))
        ]);

        const dsData = await dsRes.json();
        const webData = webRes.data || [];

        let allPending = [...(dsData.pending || [])];
        let allHistory = [...(dsData.history || [])];

        webData.forEach(t => {
            if(t.task_type === 'individual_shift_update') {
                const p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
                const format = { id: t.id, staffId: p.user_name, fromGroup: 'ระบบกะ', toGroup: p.target_shift, executeAt: t.scheduled_for, completedAt: t.completed_at };
                if(t.status === 'pending' || t.status === 'info_only') allPending.push(format);
                else if(t.status === 'completed') allHistory.push(format);
            }
        });

        allPending = allPending.filter(t => {
            const existsInDs = extStaffList.some(s => s.id === t.staffId || s.name === t.staffId);
            const existsInDb = window.GLOBAL_USER_LIST ? window.GLOBAL_USER_LIST.some(u => u.username === t.staffId) : false;
            return existsInDs || existsInDb;
        });

        allPending.sort((a,b) => new Date(a.executeAt) - new Date(b.executeAt));
        allHistory.sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));

        scheduledTransfers = allPending;
        transferHistory = allHistory;
        
        renderTransferLists();
        renderTransferSummary();
    } catch(e) { console.error(e); }
};

window.renderTransferLists = function() {
    const pSearch = document.getElementById('searchPendingTransfer') ? document.getElementById('searchPendingTransfer').value.toLowerCase() : '';
    const hSearch = document.getElementById('searchHistoryTransfer') ? document.getElementById('searchHistoryTransfer').value.toLowerCase() : '';

    const pBox = document.getElementById('transferList');
    const hBox = document.getElementById('transferHistoryList');
    if(!pBox || !hBox) return;

    const filteredPending = scheduledTransfers.filter(t => {
        const s = extStaffList.find(x=>x.id===t.staffId);
        const name = s ? s.name.toLowerCase() : t.staffId.toLowerCase();
        return name.includes(pSearch);
    });

    if (filteredPending.length === 0) pBox.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">ไม่มีรายการ</div>';
    else {
        pBox.innerHTML = filteredPending.map(t => {
            const s = extStaffList.find(x=>x.id===t.staffId);
            const name = s ? s.name : t.staffId;
            const dateStr = new Date(t.executeAt).toLocaleString('th-TH');
            return window.renderTemplate('tpl-ds-transfer-pending-row', { id: t.id, name: name, fromGroup: t.fromGroup, toGroup: t.toGroup, dateStr: dateStr });
        }).join('');
    }

    const filteredHistory = transferHistory.slice().filter(t => {
        const s = extStaffList.find(x=>x.id===t.staffId);
        const name = s ? s.name.toLowerCase() : t.staffId.toLowerCase();
        return name.includes(hSearch);
    });

    if (filteredHistory.length === 0) hBox.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">ไม่มีประวัติ</div>';
    else {
        hBox.innerHTML = filteredHistory.map(t => {
            const s = extStaffList.find(x=>x.id===t.staffId);
            const name = s ? s.name : t.staffId;
            const dateStr = new Date(t.completedAt).toLocaleString('th-TH');
            return window.renderTemplate('tpl-ds-transfer-history-row', { name: name, fromGroup: t.fromGroup, toGroup: t.toGroup, dateStr: dateStr });
        }).join('');
    }
};

window.renderTransferSummary = function() {
    let summary = {};
    scheduledTransfers.forEach(t => {
        const key = `${t.fromGroup || '?'} ➝ ${t.toGroup}`;
        if(!summary[key]) summary[key] = 0;
        summary[key]++;
    });
    
    const board = document.getElementById('transferSummaryBoard');
    if(!board) return;
    
    if (Object.keys(summary).length === 0) {
        board.innerHTML = '<span class="text-gray-500 text-sm py-2 font-bold flex items-center gap-2"><span class="material-icons text-[18px]">verified</span> ไม่มีคิวโอนย้ายรอดำเนินการ</span>';
    } else {
        board.innerHTML = Object.keys(summary).map(k => {
            return window.renderTemplate('tpl-ds-transfer-summary-card', { k: k, count: summary[k] });
        }).join('');
    }
};

window.showTransferSummaryDetail = function(key) {
    const filtered = scheduledTransfers.filter(t => `${t.fromGroup || '?'} ➝ ${t.toGroup}` === key);
    
    let listHtml = filtered.map((t, i) => {
        const s = extStaffList.find(x=>x.id===t.staffId);
        const name = s ? s.name : t.staffId;
        const dateStr = new Date(t.executeAt).toLocaleString('th-TH');
        return window.renderTemplate('tpl-ds-transfer-detail-row', { index: i+1, searchName: name.toLowerCase(), name: name, dateStr: dateStr });
    }).join('');

    Swal.fire({
        title: `
            <div class="flex flex-col gap-2 text-left w-full">
                <div class="text-sm font-bold text-gray-400">รายการรอทำงาน:</div>
                <div class="flex items-center justify-between border-b border-slate-700 pb-3">
                    <div class="text-lg font-black text-emerald-400">${key}</div>
                    <span class="text-xs text-white font-bold bg-slate-700 px-3 py-1 rounded-lg shadow-inner">${filtered.length} คน</span>
                </div>
            </div>
        `,
        html: `
            <div class="relative mb-3 mt-4">
                <span class="material-icons absolute left-3 top-2.5 text-gray-400 text-[18px]">search</span>
                <input type="text" id="popupSummarySearch" onkeyup="filterSummaryPopup()" placeholder="ค้นหาชื่อพนักงานในคิวนี้..." class="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-600 text-white rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">
            </div>
            <div class="max-h-[45vh] overflow-y-auto custom-scrollbar pr-2 text-left" id="popupSummaryList">
                ${listHtml || '<div class="text-center text-gray-500 py-4 text-sm font-bold">ไม่มีข้อมูล</div>'}
            </div>
        `,
        showCloseButton: true,
        showConfirmButton: false,
        width: '500px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-600 shadow-2xl' }
    });
};

window.filterSummaryPopup = function() {
    const term = document.getElementById('popupSummarySearch').value.toLowerCase();
    const list = document.getElementById('popupSummaryList');
    if(!list) return;
    const items = list.children;
    for(let i=0; i<items.length; i++) {
        const nameEl = items[i].querySelector('[data-search-name]');
        if(nameEl) {
            const name = nameEl.getAttribute('data-search-name');
            items[i].style.display = name.includes(term) ? '' : 'none';
        }
    }
};

window.delTransfer = async function(id) {
    await fetch(DISCORD_API_URL + '/api/delete-transfer', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id})});
    fetchTransfers();
};

// ==============================================================
// 🌟 ตัวแปรสำหรับควบคุมการแบ่งหน้า (Pagination)
// ==============================================================
window.dsCurrentPage = 1;
window.dsRowsPerPage = 50; // โหลดทีละ 50 บรรทัด
window.dsTotalPages = 1;

// ==============================================================
// 🌟 ฟังก์ชันดึงประวัติการเข้า-ออกห้อง (แบบแบ่งหน้า + ค้นหาจากฐานข้อมูล)
// ==============================================================
window.ds_fetchVoiceLogs = async function(forceRefresh = false, page = 1) {
    if (typeof ds_subscribeVoiceLogs === 'function') ds_subscribeVoiceLogs(); 

    // อัปเดตหน้าปัจจุบัน
    window.dsCurrentPage = page;

    const dateInput = document.getElementById('voiceLogDate');
    let targetDate = dateInput ? dateInput.value : '';
    
    if (!targetDate) {
        const today = new Date();
        targetDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        if (dateInput) dateInput.value = targetDate;
    }

    // 🌟 อ่านค่าจากช่องค้นหาชื่อ
    const searchInput = document.getElementById('dsLogSearch'); 
    const searchText = searchInput ? searchInput.value.trim() : '';

    const tbody = document.getElementById('ds_voiceLogBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-gray-400"><span class="material-icons animate-spin text-4xl mb-2 text-fuchsia-500">sync</span><br>กำลังดึงข้อมูลหน้า ${page}...</td></tr>`;

    try {
        const startOfDay = `${targetDate}T00:00:00+07:00`;
        const endOfDay = `${targetDate}T23:59:59+07:00`;

        // 🌟 1. ดึงแบบ Server-Side แบ่งหน้า เพื่อทะลุขีดจำกัด 1000 รายการของระบบ
        let query = appDB.from('discord_voice_logs')
            .select('id, user_name, action_type, room_name, created_at', { count: 'exact' })
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false });

        // 🌟 2. ถ้ามีการพิมพ์ชื่อ ให้ค้นหาจากฐานข้อมูลโดยตรง (หาเจอ 100% แม้ชื่อจะตกไปอยู่หน้าหลังๆ)
        if (searchText) {
            query = query.ilike('user_name', `%${searchText}%`);
        }

        // 🌟 3. คำนวณจุดเริ่มต้นและสิ้นสุด (ดึงทีละ 50 บรรทัด)
        const from = (window.dsCurrentPage - 1) * window.dsRowsPerPage;
        const to = from + window.dsRowsPerPage - 1;
        
        // ใส่ Range ลงไปใน Query จะทำให้ได้ข้อมูลครบและทะลุ 1000 ได้ชัวร์ๆ
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        // 🌟 4. คำนวณจำนวนหน้า (Pagination) จากยอดรวมจริงๆ ในระบบ (count)
        window.dsTotalPages = Math.ceil((count || 0) / window.dsRowsPerPage) || 1;

        // ดักจับกรณีค้นหาจนหน้าปัจจุบันเกินจำนวนหน้าทั้งหมด
        if (window.dsCurrentPage > window.dsTotalPages) {
            window.dsCurrentPage = 1;
            return ds_fetchVoiceLogs(forceRefresh, 1);
        }

        window.dsGlobalVoiceLogs = data.map(row => ({
            id: row.id,
            name: row.user_name,
            action: row.action_type,
            room: row.room_name,
            time: row.created_at
        }));

        // วาดตาราง 50 บรรทัด
        if (typeof ds_renderVoiceLogs === 'function') ds_renderVoiceLogs();

        // 🌟 วาดปุ่มเปลี่ยนหน้า (ส่ง count ที่แท้จริงไปให้)
        ds_renderPaginationControls(count);

        if (forceRefresh === true && !searchText) {
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            Toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลเรียบร้อย' });
        }

    } catch (e) {
        console.error("Fetch Voice Logs Error:", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500 font-bold">ไม่สามารถดึงข้อมูลได้: ${e.message}</td></tr>`;
    }
};

window.ds_renderVoiceLogs = function() {
    const term = document.getElementById('dsLogSearch') ? document.getElementById('dsLogSearch').value.toLowerCase() : '';
    const dateFilter = document.getElementById('voiceLogDate').value;
    const lateFilter = document.getElementById('voiceLogLateFilter').value;
    const shiftFilter = document.getElementById('voiceLogShiftFilter') ? document.getElementById('voiceLogShiftFilter').value : 'ALL';
    const tbody = document.getElementById('ds_voiceLogBody');
    
    let filtered = window.dsGlobalVoiceLogs || [];

    // การกรอง Shift และสาย ย้ายมาทำฝั่ง Frontend เหมือนเดิม (เฉพาะหน้าปัจจุบัน)
    if (shiftFilter !== 'ALL') {
        filtered = filtered.filter(log => {
            const dbUser = getDbUserFromDiscordName(log.name);
            if (dbUser && dbUser.allowed_shift === shiftFilter) return true;
            if (log.name.includes(shiftFilter)) return true;
            return false;
        });
    }

    let finalHtml = '';
    
    filtered.forEach(log => {
        let d = new Date(log.time);
        //d = new Date(d.getTime() - (7 * 60 * 60 * 1000));
        
        // 🌟 1. ดึงวันที่ (รูปแบบ 09/04/2569)
        const datePart = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
        // 🌟 2. ดึงเวลา (รูปแบบ 15:38:51)
        const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // 🌟 3. เอามาจับมัดรวมกัน จัดให้วันที่เป็นตัวหนังสือเล็กๆ สีเทาๆ
        const timeStr = `${timePart} <span class="text-[9px] text-gray-600 ml-1">(${datePart})</span>`;
        
        let badge = ''; let lateBadge = ''; let rowClass = 'hover:bg-slate-700/50'; let isLate = false;
        const dbUser = getDbUserFromDiscordName(log.name);

        if(log.action === 'เข้าห้อง') {
            badge = '<span class="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md text-[11px] font-bold border border-emerald-500/50 whitespace-nowrap shadow-sm">เข้าห้อง</span>';
            
            let targetShift = dbUser ? dbUser.allowed_shift : null;
            if (!targetShift) {
                if (log.name.includes('กะเช้า')) targetShift = 'กะเช้า';
                else if (log.name.includes('กะกลาง')) targetShift = 'กะกลาง';
                else if (log.name.includes('กะดึก')) targetShift = 'กะดึก';
            }
            
            if (targetShift && targetShift !== 'all') {
                const shiftPrefix = targetShift.replace('กะ', '');
                let expectedStart = null; 
                if (shiftPrefix === 'เช้า') expectedStart = '08:00'; 
                else if (shiftPrefix === 'กลาง') expectedStart = '11:00'; 
                else if (shiftPrefix === 'ดึก') expectedStart = '20:00'; 

                if (typeof SETTINGS !== 'undefined' && SETTINGS['open_time_' + shiftPrefix]) {
                    expectedStart = SETTINGS['open_time_' + shiftPrefix];
                }
                
                if (expectedStart) {
                    const [h, m] = expectedStart.split(':').map(Number);
                    let expectedTime = new Date(d); 
                    expectedTime.setHours(h, m, 0, 0);

                    if (h >= 18 && d.getHours() < 12) {
                        expectedTime.setDate(expectedTime.getDate() - 1);
                    }

                    if (d > expectedTime && (d - expectedTime) > 60000) {
                        const diffMins = Math.floor((d - expectedTime) / 60000);
                        if (diffMins <= 720) { 
                            lateBadge = `<span class="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold shadow-md whitespace-nowrap">มาสาย ${diffMins} นาที</span>`;
                            isLate = true;
                        }
                    }
                }
            }
        }
        else if(log.action.includes('ออกดิส') || log.action.includes('ออกห้อง')) {
            badge = '<span class="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-md text-[11px] font-bold border border-red-500/50 whitespace-nowrap shadow-sm">ออกดิสคอร์ด</span>';
            rowClass = 'bg-red-900/10 hover:bg-red-900/30'; 
        }
        else {
            badge = '<span class="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-md text-[11px] font-bold border border-blue-500/50 whitespace-nowrap shadow-sm">ย้ายไป</span>';
        }

        if (lateFilter === 'late' && !isLate) return; 
        if (lateFilter === 'leave' && !log.action.includes('ออกดิส') && !log.action.includes('ออกห้อง')) return;

        let displayShift = dbUser ? dbUser.allowed_shift : '';
        if (!displayShift) {
             if (log.name.includes('กะเช้า')) displayShift = 'กะเช้า';
             else if (log.name.includes('กะกลาง')) displayShift = 'กะกลาง';
             else if (log.name.includes('กะดึก')) displayShift = 'กะดึก';
        }
        const shiftTag = displayShift ? `<span class="text-[9px] text-gray-500 ml-1 whitespace-nowrap">(${displayShift})</span>` : '';

        finalHtml += window.renderTemplate('tpl-ds-voice-log-row', {
            rowClass: rowClass,
            timeStr: timeStr,
            name: log.name,
            shiftTag: shiftTag,
            lateBadge: lateBadge,
            badge: badge,
            room: log.room
        });
    });

    if (finalHtml === '') {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold">ไม่พบประวัติในหน้านี้</td></tr>';
    } else {
        tbody.innerHTML = finalHtml;
    }
};

// ==============================================================
// 🌟 ฟังก์ชันสร้างปุ่มเปลี่ยนหน้า (Pagination UI)
// ==============================================================
window.ds_renderPaginationControls = function(totalItems) {
    let paginationDiv = document.getElementById('ds_paginationContainer');
    
    // ถ้ายังไม่มีแถบเปลี่ยนหน้า ให้สร้างต่อท้ายตาราง
    if (!paginationDiv) {
        const tableContainer = document.getElementById('ds_voiceLogBody').closest('.overflow-x-auto') || document.getElementById('ds_voiceLogBody').closest('table').parentElement;
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'ds_paginationContainer';
        paginationDiv.className = 'flex flex-col sm:flex-row justify-between items-center mt-4 p-3 bg-[#151f32] rounded-xl border border-slate-700/80 shadow-md gap-3';
        tableContainer.parentElement.appendChild(paginationDiv);
    }

    if (totalItems === 0) {
        paginationDiv.innerHTML = `<div class="text-xs text-gray-500 w-full text-center font-bold">ไม่มีประวัติในเงื่อนไขนี้</div>`;
        return;
    }

    const startItem = (window.dsCurrentPage - 1) * window.dsRowsPerPage + 1;
    const endItem = Math.min(window.dsCurrentPage * window.dsRowsPerPage, totalItems);

    paginationDiv.innerHTML = `
        <div class="text-xs text-gray-400 font-bold">
            แสดง <span class="text-fuchsia-400">${startItem} - ${endItem}</span> จากทั้งหมด <span class="text-white">${totalItems}</span> รายการ
        </div>
        <div class="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
            <button onclick="ds_fetchVoiceLogs(false, 1)" ${window.dsCurrentPage === 1 ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-gray-300 p-1 rounded transition"'} title="หน้าแรก"><span class="material-icons text-sm">keyboard_double_arrow_left</span></button>
            <button onclick="ds_fetchVoiceLogs(false, ${window.dsCurrentPage - 1})" ${window.dsCurrentPage === 1 ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-fuchsia-400 p-1 rounded transition"'} title="ก่อนหน้า"><span class="material-icons text-sm">chevron_left</span></button>
            
            <span class="text-[11px] font-bold text-white px-3 border-x border-slate-700/50">หน้า ${window.dsCurrentPage} / ${window.dsTotalPages}</span>
            
            <button onclick="ds_fetchVoiceLogs(false, ${window.dsCurrentPage + 1})" ${window.dsCurrentPage === window.dsTotalPages ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-fuchsia-400 p-1 rounded transition"'} title="ถัดไป"><span class="material-icons text-sm">chevron_right</span></button>
            <button onclick="ds_fetchVoiceLogs(false, ${window.dsTotalPages})" ${window.dsCurrentPage === window.dsTotalPages ? 'disabled class="opacity-30 cursor-not-allowed"' : 'class="hover:bg-slate-700 text-gray-300 p-1 rounded transition"'} title="หน้าสุดท้าย"><span class="material-icons text-sm">keyboard_double_arrow_right</span></button>
        </div>
    `;
};

window.ds_fetchActionLogs = async function() {
    try {
        document.getElementById('ds_actionLogBody').innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500"><span class="material-icons animate-spin">sync</span></td></tr>';
        const res = await fetch(DISCORD_API_URL + '/api/action-logs');
        if(res.ok) {
            let data = await res.json();
            window.dsGlobalActionLogs = data; 
            ds_renderActionLogs();
        }
    } catch(e) {}
};

window.ds_renderActionLogs = function() {
    const term = document.getElementById('actionLogSearch') ? document.getElementById('actionLogSearch').value.toLowerCase() : '';
    const dateFilter = document.getElementById('actionLogDate') ? document.getElementById('actionLogDate').value : '';
    const tbody = document.getElementById('ds_actionLogBody');
    
    if (!window.dsGlobalActionLogs || window.dsGlobalActionLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500 font-bold">ไม่พบประวัติการใช้งาน</td></tr>';
        return;
    }

    let filtered = window.dsGlobalActionLogs.filter(log => 
        log.user.toLowerCase().includes(term) || 
        log.action.toLowerCase().includes(term) || 
        log.detail.toLowerCase().includes(term)
    );

    if (dateFilter) {
        filtered = filtered.filter(log => {
            const d = new Date(log.time);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}` === dateFilter;
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-500 font-bold">ไม่พบข้อมูลในเงื่อนไขที่ค้นหา</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(log => {
        const d = new Date(log.time);
        const timeStr = d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        return window.renderTemplate('tpl-ds-action-log-row', {
            timeStr: timeStr,
            user: log.user,
            action: log.action,
            detail: log.detail
        });
    }).join('');
};

window.ds_logAction = async function(actionName, detailStr) {
    try {
        const userName = (typeof currentUser !== 'undefined' && currentUser.username) ? currentUser.username : 'Unknown Admin';
        await fetch(DISCORD_API_URL + '/api/action-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: userName, action: actionName, detail: detailStr })
        });
    } catch(e) {}
};

// ==========================================
// 🟢 อัปเดต Dropdown และ ระบบจัดการฐานข้อมูลดิสคอร์ด (Manage)
// ==========================================

window.updateAllFilters = function() {
    const groupNames = Object.keys(extStaffGroups || {}).sort();
    
    const f1 = document.getElementById('groupFilter'); 
    if(f1) f1.innerHTML = '<option value="ALL">-- ทุกกลุ่ม --</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
    
    const f2 = document.getElementById('filterStaffGroup'); 
    if(f2) f2.innerHTML = '<option value="ALL">-- ดูทุกกลุ่ม --</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
    
    const f3 = document.getElementById('filterTransferGroup'); 
    if(f3) f3.innerHTML = '<option value="ALL">ทุกกลุ่ม</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
    
    const f4 = document.getElementById('transferToGroup'); 
    if(f4) f4.innerHTML = '<option value="">-- เลือกกลุ่มปลายทาง --</option>' + groupNames.map(g => `<option value="${g}">${g}</option>`).join('');
};

window.renderManagerList = function() { dsDebounce('mgrList', _doRenderManagerList, 200); };

window._doRenderManagerList = function() {
    const container = document.getElementById('manageStaffList');
    if(!container) return;
    const search = document.getElementById('searchMgrStaff').value.toLowerCase();
    const group = document.getElementById('filterStaffGroup').value;
    const deptFilter = document.getElementById('filterStaffDept').value;
    const shiftFilter = document.getElementById('filterStaffShift').value;

    const filtered = extStaffList.filter(s => {
        const matchName = s.name.toLowerCase().includes(search);
        const matchGroup = group === 'ALL' || (extStaffGroups[group] && extStaffGroups[group].includes(s.id));
        let matchDept = true; let matchShift = true;
        
        if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
            const dbUser = getDbUserFromDiscordName(s.name);
            if (!dbUser) return false;
            if (deptFilter !== 'ALL' && (dbUser.department || 'AM') !== deptFilter) matchDept = false;
            if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) matchShift = false;
        }
        return matchName && matchGroup && matchDept && matchShift;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8 text-sm">ไม่พบรายชื่อ</div>';
        return;
    }

    container.innerHTML = filtered.map(s => {
        const dbUser = getDbUserFromDiscordName(s.name);
        let tagHtml = dbUser ? `<span class="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-700/50 ml-2 shadow-sm">${dbUser.department || 'AM'} | ${dbUser.allowed_shift.replace('กะ','')}</span>` : `<span class="bg-slate-700 text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold ml-2">ไม่พบในระบบลงเวลา</span>`;
        let groupsIn = [];
        for(let g in extStaffGroups) { if(extStaffGroups[g].includes(s.id)) groupsIn.push(g); }
        const gTags = groupsIn.map(g => `<span class="bg-slate-700 text-gray-300 px-1.5 py-0.5 rounded text-[9px] mr-1">${g}</span>`).join('');
        
        return window.renderTemplate('tpl-ds-manager-row', {
            id: s.id,
            name: s.name,
            tagHtml: tagHtml,
            gTags: gTags || '- ไม่มีกลุ่ม -'
        });
    }).join('');
};

window.renderGroupList = function() {
    const container = document.getElementById('groupList');
    if(!container) return;
    
    let html = '';
    for(let g in extStaffGroups) {
        const count = extStaffGroups[g].length;
        
        let colorClass = 'text-emerald-400 border-slate-600 hover:border-emerald-500';
        let bgClass = 'bg-slate-800 hover:bg-slate-700/50';
        
        if (g.startsWith('AM') || g.startsWith('AMQL')) {
            colorClass = 'text-blue-400 border-blue-900/50 hover:border-blue-400';
            bgClass = 'bg-[#0f172a] hover:bg-[#1e293b]';
        } else if (g.startsWith('OD')) {
            colorClass = 'text-pink-400 border-pink-900/50 hover:border-pink-400';
            bgClass = 'bg-[#2b1b2e]/60 hover:bg-[#2b1b2e]';
        } else if (g.includes('ไม่พบ') || g.includes('อิสระ')) {
            colorClass = 'text-gray-400 border-gray-700 hover:border-gray-500';
            bgClass = 'bg-slate-900/50 hover:bg-slate-800';
        }

        html += window.renderTemplate('tpl-ds-group-row', {
            bgClass: bgClass,
            colorClass: colorClass,
            g: g,
            count: count
        });
    }
    container.innerHTML = html || '<div class="text-center text-gray-500 py-4 text-xs">ไม่มีกลุ่ม</div>';
};

window.openGroupManagerModal = function(groupName) {
    window.renderModalMemberList = function(gName) {
        const memberIds = extStaffGroups[gName] || [];
        if (memberIds.length === 0) return '<div class="text-center text-gray-500 py-6 text-sm">ยังไม่มีสมาชิกในกลุ่มนี้</div>';

        const members = memberIds.map(id => {
            const staff = extStaffList.find(s => s.id === id);
            return { id: id, name: staff ? staff.name : 'Unknown User' };
        }).sort((a,b) => a.name.localeCompare(b.name));

        return members.map((m, idx) => `
            <div class="flex justify-between items-center p-3 bg-slate-800 rounded-xl border border-slate-700 shadow-sm mb-2 hover:bg-slate-700/50 transition">
                <div class="flex items-center gap-3">
                    <div class="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-gray-400 border border-slate-600 shadow-inner">${idx + 1}</div>
                    <span class="font-bold text-sm text-white tracking-wide">${m.name}</span>
                </div>
                <button onclick="removeUserFromGroup('${gName}', '${m.id}')" class="text-red-400 hover:text-white transition p-1.5 bg-slate-900 hover:bg-red-500 rounded-lg border border-slate-700" title="นำออกจากกลุ่ม"><span class="material-icons text-[16px]">person_remove</span></button>
            </div>
        `).join('');
    };

    const allUsersOptions = extStaffList
        .filter(s => !(extStaffGroups[groupName] || []).includes(s.id))
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(s => `<option value="${s.id}">${s.name}</option>`)
        .join('');

    let headerColor = 'text-emerald-400';
    if(groupName.startsWith('AM') || groupName.startsWith('AMQL')) headerColor = 'text-blue-400';
    else if(groupName.startsWith('OD')) headerColor = 'text-pink-400';

    Swal.fire({
        html: `
            <div class="text-left mt-2">
                <div class="flex justify-between items-center mb-5 pb-4 border-b border-slate-700">
                    <div class="text-xl font-black ${headerColor}">${groupName}</div>
                    <span class="bg-slate-700 text-gray-300 text-xs px-3 py-1.5 rounded-full font-bold shadow-inner" id="modalMemberCount">${(extStaffGroups[groupName]||[]).length} คน</span>
                </div>

                <div class="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-5 shadow-inner">
                    <label class="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2"><span class="material-icons text-[16px]">person_add</span> เพิ่มพนักงานเข้ากลุ่ม</label>
                    <div class="flex gap-2">
                        <select id="addMemberSelect" class="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500 font-bold cursor-pointer">
                            <option value="">-- เลือกจากรายชื่อ --</option>
                            ${allUsersOptions}
                        </select>
                        <button onclick="addUserToGroup('${groupName}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg font-bold transition shadow-md whitespace-nowrap flex items-center gap-1 active:scale-95">
                            <span class="material-icons text-[16px]">add_circle</span> เพิ่ม
                        </button>
                    </div>
                </div>

                <div class="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">รายชื่อสมาชิกปัจจุบัน</div>
                <div class="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2" id="modalMemberList">
                    ${window.renderModalMemberList(groupName)}
                </div>
                
                <div class="mt-4 pt-4 border-t border-slate-700 flex justify-start">
                    <button onclick="renameGroup('${groupName}'); Swal.close();" class="text-xs font-bold text-amber-500 hover:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30 transition flex items-center gap-1">
                        <span class="material-icons text-[14px]">edit</span> เปลี่ยนชื่อกลุ่ม
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: '500px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-600 shadow-2xl' }
    });
};

window.addUserToGroup = async function(groupName) {
    const select = document.getElementById('addMemberSelect');
    const staffId = select.value;
    if(!staffId) return;

    const btn = select.nextElementSibling;
    btn.innerHTML = '<span class="material-icons animate-spin">sync</span>';
    btn.disabled = true;

    try {
        const res = await fetch(DISCORD_API_URL + '/api/groups/assign', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupName: groupName, staffIds: [staffId] })
        });
        
        if(res.ok) {
            if(!extStaffGroups[groupName]) extStaffGroups[groupName] = [];
            extStaffGroups[groupName].push(staffId);
            
            document.getElementById('modalMemberList').innerHTML = window.renderModalMemberList(groupName);
            document.getElementById('modalMemberCount').innerText = `${extStaffGroups[groupName].length} คน`;
            
            select.querySelector(`option[value="${staffId}"]`).remove();
            select.value = '';
            
            renderGroupList(); 
        }
    } catch(e) { console.error(e); } 
    finally {
        btn.innerHTML = '<span class="material-icons text-[16px]">add_circle</span> เพิ่ม';
        btn.disabled = false;
    }
};

window.removeUserFromGroup = async function(groupName, staffId) {
    const listContainer = document.getElementById('modalMemberList');
    listContainer.style.opacity = '0.5';

    try {
        const res = await fetch(DISCORD_API_URL + '/api/groups/remove-member', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupName: groupName, staffId: staffId })
        });

        if(res.ok) {
            extStaffGroups[groupName] = extStaffGroups[groupName].filter(id => id !== staffId);
            
            listContainer.innerHTML = window.renderModalMemberList(groupName);
            document.getElementById('modalMemberCount').innerText = `${extStaffGroups[groupName].length} คน`;
            
            const staff = extStaffList.find(s => s.id === staffId);
            if(staff) {
                const select = document.getElementById('addMemberSelect');
                select.innerHTML += `<option value="${staff.id}">${staff.name}</option>`;
            }
            
            renderGroupList(); 
        }
    } catch(e) { console.error(e); } 
    finally {
        listContainer.style.opacity = '1';
    }
};

// ==========================================
// 🟢 ฟังก์ชันสำหรับเตะคนออกจากเซิร์ฟเวอร์ดิสคอร์ด
// ==========================================
window.spy_kickUser = async function(uid, name) {
    const confirm = await Swal.fire({
        title: 'ยืนยันการเตะ?',
        text: `คุณแน่ใจหรือไม่ที่จะเตะ "${name}" ออกจากเซิร์ฟเวอร์ดิสคอร์ด? (ต้องส่งคำเชิญใหม่หากต้องการให้เข้ามาอีก)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: 'ใช่, เตะออกเลย!',
        cancelButtonText: 'ยกเลิก'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({title: 'กำลังดำเนินการ...', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch(`${DISCORD_API_URL}/api/kick-user`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: uid })
        });
        const r = await res.json();
        
        if (r.success) {
            Swal.fire('สำเร็จ', `เตะ ${name} ออกจากเซิร์ฟเวอร์แล้ว`, 'success');
            ds_logAction('Kick User', `เตะพนักงาน ${name} ออกจากเซิร์ฟเวอร์ดิสคอร์ด`);
            ds_fetchSpy(); // รีเฟรชตารางใหม่
        } else {
            Swal.fire('เกิดข้อผิดพลาด', r.error || 'ไม่สามารถเตะผู้ใช้นี้ได้', 'error');
        }
    } catch(e) {
        Swal.fire('ล้มเหลว', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์บอทได้', 'error');
    }
};

// ==============================================================
// 🌟 ฟังก์ชันลบประวัติย้ายห้องที่เก่ากว่า 7 วัน (เก็บเข้า/ออก/สาย ไว้)
// ==============================================================
window.ds_clearOldMoveLogs = async function() {
    const res = await Swal.fire({
        title: 'ล้างประวัติการ "ย้ายห้อง"?',
        text: "ระบบจะลบประวัติการย้ายห้องที่เก่ากว่า 7 วันทิ้งเพื่อลดพื้นที่ (ระบบจะยังเก็บประวัติ 'เข้าห้อง', 'ออกห้อง' และสถิติ 'มาสาย' ไว้ตามปกติครับ)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ลบทิ้งเลย'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังตรวจสอบและลบข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            // คำนวณวันที่ย้อนหลัง 7 วัน
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            const cutoffDateStr = cutoffDate.toISOString();

            // สั่งลบเฉพาะที่มีคำว่า "ย้าย" ในตาราง และเวลาเก่ากว่า 7 วัน
            const { error } = await appDB.from('discord_voice_logs')
                .delete()
                .like('action_type', '%ย้าย%')
                .lt('created_at', cutoffDateStr);

            if (error) throw error;

            Swal.fire({
                icon: 'success', 
                title: 'ลบสำเร็จ!', 
                text: 'เคลียร์ประวัติการย้ายห้องที่เก่ากว่า 7 วันเรียบร้อยแล้วครับ', 
                timer: 2000, 
                showConfirmButton: false
            });
            
            // รีเฟรชตารางหน้า 1 ใหม่
            ds_fetchVoiceLogs(true, 1);
            
            // บันทึกประวัติการทำงานของแอดมินไว้ด้วย
            if (typeof ds_logAction === 'function') {
                ds_logAction('ล้างประวัติดิสคอร์ด', 'ลบประวัติย้ายห้องที่เก่ากว่า 7 วันทิ้ง');
            }

        } catch (e) {
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
        }
    }
};

// ---------------------------------------------------------
// 🌟 ระบบส่งข้อความและข้อความสำเร็จรูป (อัปเดตระบบ Global และค้นหาห้อง)
// ---------------------------------------------------------

// ดึงรายชื่อห้อง (ดึงมาทั้ง Text Channels และ Voice Channels แบบ Checkbox)
window.ds_fetchChannelsForSendMsg = async function() {
    const targetContainer = document.getElementById('dsSendMsgChannelContainer');
    if (targetContainer) targetContainer.innerHTML = '<div class="text-center text-gray-500 text-xs py-10"><span class="material-icons animate-spin mb-2">sync</span><br>กำลังโหลดรายชื่อห้อง...</div>';

    try {
        if (typeof appDB !== 'undefined') {
            const [textRes, voiceRes] = await Promise.all([
                appDB.from('settings').select('value').eq('key', 'discord_text_channels').single(),
                appDB.from('settings').select('value').eq('key', 'discord_channels').single()
            ]);
            
            let allChannels = [];

            if (textRes.data && textRes.data.value) {
                try {
                    const textCh = typeof textRes.data.value === 'string' ? JSON.parse(textRes.data.value) : textRes.data.value;
                    if(Array.isArray(textCh)) allChannels = allChannels.concat(textCh.map(c => ({ id: c.id, name: `💬 ${c.name}` })));
                } catch(e){}
            }

            if (voiceRes.data && voiceRes.data.value) {
                try {
                    const voiceCh = typeof voiceRes.data.value === 'string' ? JSON.parse(voiceRes.data.value) : voiceRes.data.value;
                    if(Array.isArray(voiceCh)) {
                        voiceCh.forEach(vc => {
                            if(!allChannels.find(c => c.id === vc.id)) {
                                allChannels.push({ id: vc.id, name: `🔊 ${vc.name}` }); 
                            }
                        });
                    }
                } catch(e){}
            }

            if (allChannels.length > 0) {
                // ดึงข้อมูลที่พนักงานจำไว้ของเครื่องตัวเอง (Local Storage)
                let savedChannels = [];
                try { savedChannels = JSON.parse(localStorage.getItem('ds_last_selected_channels') || '[]'); } catch(e){}

                let html = '';
                allChannels.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                    const isChecked = savedChannels.includes(c.id) ? 'checked' : '';
                    html += `
                        <label class="ds-channel-item flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-lg cursor-pointer border border-transparent hover:border-slate-700 transition" data-name="${c.name.toLowerCase()}">
                            <input type="checkbox" value="${c.id}" class="ds-send-channel-cb w-5 h-5 rounded border-gray-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-2 shadow-inner transition cursor-pointer" ${isChecked} onchange="ds_updateSelectedChannelsLabel()">
                            <span class="text-gray-200 font-bold text-sm truncate">${c.name}</span>
                        </label>
                    `;
                });
                
                if(targetContainer) {
                    targetContainer.innerHTML = html;
                    ds_updateSelectedChannelsLabel();
                }
            } else {
                if(targetContainer) targetContainer.innerHTML = '<div class="text-center text-gray-500 text-xs py-10">-- ไม่พบห้องในระบบ (รอแอดมินเปิดบอท) --</div>';
            }
        }
    } catch(e) { 
        if(targetContainer) targetContainer.innerHTML = '<div class="text-center text-red-500 text-xs py-10">-- เกิดข้อผิดพลาดในการโหลดห้อง --</div>';
    }
};

// 🌟 ฟังก์ชันค้นหาชื่อห้อง
window.ds_filterChannels = function() {
    const term = document.getElementById('dsSearchChannelInput').value.toLowerCase();
    const items = document.querySelectorAll('.ds-channel-item');
    items.forEach(item => {
        const name = item.getAttribute('data-name');
        if (name.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};

// อัปเดตตัวเลขห้องที่ถูกเลือก และบันทึกลงความจำเครื่อง (ของใครของมัน)
window.ds_updateSelectedChannelsLabel = function() {
    const checkboxes = document.querySelectorAll('.ds-send-channel-cb:checked');
    const label = document.getElementById('dsSelectedChannelsLabel');
    if (label) {
        label.innerHTML = `เลือกรอไว้ <span class="text-white">${checkboxes.length}</span> ห้อง`;
    }
    
    // บันทึกใส่เครื่อง เผื่อปิดเว็บเปิดใหม่ก็ยังจำได้ (Local Storage = ของพนักงานแต่ละคน)
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    localStorage.setItem('ds_last_selected_channels', JSON.stringify(selectedIds));
};

// ปุ่มเลือกทั้งหมด / ยกเลิกทั้งหมด (เฉพาะที่มองเห็นจากการค้นหา)
window.ds_selectAllChannels = function() {
    const items = document.querySelectorAll('.ds-channel-item');
    let visibleCheckboxes = [];
    
    items.forEach(item => {
        if (item.style.display !== 'none') {
            visibleCheckboxes.push(item.querySelector('.ds-send-channel-cb'));
        }
    });
    
    if (visibleCheckboxes.length === 0) return;
    
    const allChecked = visibleCheckboxes.every(cb => cb.checked);
    
    visibleCheckboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    ds_updateSelectedChannelsLabel();
};

// 🌟 โหลดรายการข้อความสำเร็จรูป (ดึงจากฐานข้อมูลส่วนกลาง)
window.ds_loadMsgTemplates = async function() {
    const list = document.getElementById('dsMsgTemplatesList');
    if (!list) return;
    
    list.innerHTML = '<div class="text-center text-gray-500 text-xs py-10"><span class="material-icons animate-spin mb-2">sync</span><br>กำลังโหลดข้อความ...</div>';
    
    try {
        let templates = [];
        const { data, error } = await appDB.from('settings').select('value').eq('key', 'discord_msg_templates').single();
        
        if (data && data.value) {
            templates = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        }
        
        window.globalDsMsgTemplates = templates; // เก็บไว้ในตัวแปรระบบ

        if (templates.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500 text-xs py-10">ยังไม่มีข้อความที่บันทึกไว้<br>พิมพ์ข้อความด้านซ้ายแล้วกด "+ บันทึกเป็นข้อความส่วนกลาง"</div>';
            return;
        }

        list.innerHTML = templates.map((t, idx) => `
            <div class="bg-slate-800 border border-slate-600 p-3 rounded-xl hover:border-emerald-500 transition group relative">
                <div class="text-xs text-gray-300 whitespace-pre-line line-clamp-3 mb-2 cursor-pointer" onclick="ds_useMsgTemplate(${idx})">${t.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div class="flex justify-between items-center mt-2 pt-2 border-t border-slate-700">
                    <button onclick="ds_useMsgTemplate(${idx})" class="text-[10px] bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded shadow-sm font-bold border border-sky-500">นำไปใช้</button>
                    <button onclick="ds_deleteMsgTemplate(${idx})" class="text-gray-400 hover:text-red-500 transition" title="ลบข้อความนี้ (ลบของทุกคน)"><span class="material-icons text-[14px]">delete</span></button>
                </div>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = '<div class="text-center text-red-500 text-xs py-10">โหลดข้อมูลล้มเหลว</div>';
    }
};

// 🌟 บันทึกข้อความเก็บไว้เป็นเทมเพลต (ยิงขึ้นฐานข้อมูลส่วนกลาง)
window.ds_saveMsgTemplate = async function() {
    const textEl = document.getElementById('dsSendMsgText');
    if (!textEl) return;
    const text = textEl.value.trim();
    if (!text) return Swal.fire('เตือน', 'กรุณาพิมพ์ข้อความที่ต้องการบันทึกก่อนครับ', 'warning');

    let templates = window.globalDsMsgTemplates || [];

    if (templates.includes(text)) return Swal.fire('เตือน', 'มีข้อความนี้บันทึกไว้แล้ว', 'info');

    Swal.fire({title: 'กำลังบันทึกให้ทุกคนเห็น...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    
    templates.unshift(text); // เอาข้อความใหม่ไว้บนสุด
    
    try {
        await appDB.from('settings').upsert([{ key: 'discord_msg_templates', value: JSON.stringify(templates) }]);
        window.globalDsMsgTemplates = templates;
        ds_loadMsgTemplates();
        Swal.fire({icon: 'success', title: 'บันทึกส่วนกลางสำเร็จ!', timer: 1500, showConfirmButton: false});
    } catch(e) {
        Swal.fire('Error', 'บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
};

// นำข้อความที่บันทึกไว้มาเติมในช่องพิมพ์
window.ds_useMsgTemplate = function(idx) {
    let templates = window.globalDsMsgTemplates || [];
    if (templates[idx]) {
        const textEl = document.getElementById('dsSendMsgText');
        if (textEl) textEl.value = templates[idx];
    }
};

// 🌟 ลบข้อความเทมเพลต (ลบออกจากฐานข้อมูลส่วนกลาง)
window.ds_deleteMsgTemplate = async function(idx) {
    const res = await Swal.fire({
        title: 'ยืนยันลบข้อความ?',
        text: 'ข้อความนี้จะถูกลบออก และพนักงานทุกคนจะไม่เห็นข้อความนี้อีก',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ใช่, ลบทิ้งเลย'
    });
    
    if (res.isConfirmed) {
        let templates = window.globalDsMsgTemplates || [];
        templates.splice(idx, 1);
        
        Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        try {
            await appDB.from('settings').upsert([{ key: 'discord_msg_templates', value: JSON.stringify(templates) }]);
            window.globalDsMsgTemplates = templates;
            ds_loadMsgTemplates();
            Swal.fire({icon: 'success', title: 'ลบสำเร็จ!', timer: 1000, showConfirmButton: false});
        } catch(e) {
            Swal.fire('Error', 'ลบไม่สำเร็จ: ' + e.message, 'error');
        }
    }
};

// ฟังก์ชันยิงคำสั่งให้บอทส่งข้อความ
window.ds_sendMessage = async function() {
    const checkboxes = document.querySelectorAll('.ds-send-channel-cb:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    const messageEl = document.getElementById('dsSendMsgText');
    const message = messageEl ? messageEl.value.trim() : '';
    
    if (selectedIds.length === 0) return Swal.fire('เตือน', 'กรุณาติ๊กเลือกห้องปลายทางอย่างน้อย 1 ห้องครับ', 'warning');
    if (!message) return Swal.fire('เตือน', 'กรุณาพิมพ์ข้อความที่ต้องการส่งก่อนครับ', 'warning');

    Swal.fire({
        title: 'กำลังส่งข้อความ...', 
        html: `กำลังเริ่มส่ง 0 / ${selectedIds.length} ห้อง`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    let successCount = 0;
    let failCount = 0;
    let realErrorMsg = ''; 

    for (let i = 0; i < selectedIds.length; i++) {
        const channelId = selectedIds[i];
        try {
            const res = await fetch(`${DISCORD_API_URL}/api/send-message`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: channelId, content: message })
            });
            
            const textResponse = await res.text();
            
            try {
                const r = JSON.parse(textResponse);
                if (r.success) {
                    successCount++;
                } else {
                    failCount++;
                    realErrorMsg = r.error || 'เซิร์ฟเวอร์บอทไม่ตอบสนอง';
                }
            } catch(jsonErr) {
                failCount++;
                realErrorMsg = 'เซิร์ฟเวอร์บอทไม่ได้ตอบกลับมาเป็น JSON (อาจจะล่ม หรืออัปเดตไม่เสร็จ)';
                console.error("ไม่ใช่ JSON:", textResponse);
            }

        } catch(e) {
            failCount++;
            realErrorMsg = 'การเชื่อมต่อถูกตัดขาด: ' + e.message;
        }
        
        Swal.update({ 
            html: `ส่งไปแล้ว ${i + 1} / ${selectedIds.length} ห้อง<br>
            <div class="flex justify-center gap-4 mt-2">
                <span class="text-sm text-emerald-500 font-bold">✅ สำเร็จ: ${successCount}</span>
                <span class="text-sm text-red-500 font-bold">❌ ล้มเหลว: ${failCount}</span>
            </div>` 
        });
    }

    if (successCount > 0) {
        Swal.fire('สำเร็จ!', `บอทส่งข้อความสำเร็จ ${successCount} ห้อง${failCount > 0 ? `<br><span class="text-xs text-red-500">ส่งไม่ได้ ${failCount} ห้อง<br>(สาเหตุ: ${realErrorMsg})</span>` : ''}`, 'success');
        messageEl.value = ''; 
        if(typeof ds_logAction === 'function') {
            ds_logAction('ส่งข้อความ (Bot)', `สั่งบอทพิมพ์ข้อความลง ${selectedIds.length} ห้อง สำเร็จ ${successCount}`);
        }
    } else {
        Swal.fire('เกิดข้อผิดพลาด', `ส่งข้อความไม่สำเร็จเลย<br><br><span class="text-sm font-bold text-red-500">สาเหตุที่แท้จริง:<br>${realErrorMsg}</span>`, 'error');
    }
};
