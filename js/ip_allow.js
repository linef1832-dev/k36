// ═══════════════════════════════════════════════════
// 🔒 หน้าตั้งค่า IP ที่อนุญาต (IP Allowlist)
// เก็บใน settings key: 'ip_whitelist' รูปแบบ { enabled: bool, ips: [{ip, note, added_by, added_at}] }
// การบังคับจริงอยู่ใน auth.js (handleLogin) — บทบาท admin ไม่ถูกบล็อกกันล็อกตัวเองออก
// ═══════════════════════════════════════════════════
(function () {
    let ipData = { enabled: false, ips: [] };
    let myIp = null;

    // ── ดึง IP ปัจจุบัน (แพทเทิร์นเดียวกับ auth.js: หมุนหลาย API กัน rate limit) ──
    async function fetchMyIp() {
        const probes = [
            async () => { const r = await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip; },
            async () => { const r = await fetch('https://www.cloudflare.com/cdn-cgi/trace'); const m = (await r.text()).match(/ip=([^\s]+)/); return m ? m[1] : null; },
            async () => { const r = await fetch('https://api64.ipify.org?format=json'); return (await r.json()).ip; }
        ];
        for (const p of probes) { try { const ip = await p(); if (ip) return ip; } catch (e) {} }
        return null;
    }

    async function loadData() {
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'ip_whitelist').maybeSingle();
            if (data && data.value) ipData = JSON.parse(data.value);
            if (!Array.isArray(ipData.ips)) ipData.ips = [];
        } catch (e) { console.error('โหลด ip_whitelist:', e); }
    }

    async function saveData() {
        const { error } = await appDB.from('settings').upsert([{ key: 'ip_whitelist', value: JSON.stringify(ipData) }]);
        if (error) { Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error'); return false; }
        return true;
    }

    function render() {
        // สวิตช์
        const btn = document.getElementById('ipAllowToggleBtn');
        const dot = document.getElementById('ipAllowToggleDot');
        if (btn && dot) {
            btn.style.background = ipData.enabled ? '#16a34a' : '#33415c';
            dot.style.left = ipData.enabled ? 'calc(100% - 28px)' : '4px';
        }
        // รายการ
        const list = document.getElementById('ipAllowList');
        const count = document.getElementById('ipAllowCount');
        if (count) count.textContent = `${ipData.ips.length} รายการ`;
        if (!list) return;
        if (ipData.ips.length === 0) {
            list.innerHTML = `<div style="padding:32px;text-align:center;font-size:13px;color:#64748b">
                ยังไม่มี IP ในรายการ — ถ้าเปิดบังคับตอนนี้ จะไม่มีใครเข้าได้เลย (ยกเว้น admin)</div>`;
            return;
        }
        list.innerHTML = ipData.ips.map((item, i) => `
            <div style="padding:12px 20px;display:flex;align-items:center;gap:12px;border-top:1px solid #1a2740">
                <span class="material-icons" style="font-size:18px;color:${item.ip.includes('*') ? '#a855f7' : '#22c55e'}">${item.ip.includes('*') ? 'lan' : 'computer'}</span>
                <div style="flex:1;min-width:0">
                    <p style="font-family:monospace;font-weight:800;font-size:15px;color:#f1f5f9;margin:0">${item.ip}
                        ${myIp && ipMatches(myIp, item.ip) ? '<span style="margin-left:8px;font-size:10px;padding:2px 10px;border-radius:99px;background:rgba(59,130,246,0.18);color:#60a5fa;font-family:sans-serif;font-weight:700">IP ของคุณ</span>' : ''}
                    </p>
                    <p style="font-size:11px;color:#8fa3bf;margin:3px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.note || '-'} · เพิ่มโดย ${item.added_by || '-'}</p>
                </div>
                <button onclick="ipAllowRemove(${i})" style="width:34px;height:34px;border-radius:10px;border:none;background:transparent;color:#64748b;cursor:pointer;display:flex;align-items:center;justify-content:center" onmouseover="this.style.color='#ef4444';this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.color='#64748b';this.style.background='transparent'">
                    <span class="material-icons" style="font-size:18px">delete</span>
                </button>
            </div>`).join('');
    }

    // ── ตรวจว่า IP ตรงกับรายการไหม (exact หรือ prefix แบบ 184.22.*) ──
    function ipMatches(ip, pattern) {
        if (!ip || !pattern) return false;
        if (pattern.includes('*')) return ip.startsWith(pattern.replace(/\*+$/, ''));
        return ip === pattern;
    }

    function validIpInput(v) {
        // ยอมรับ IPv4/IPv6 เต็ม หรือ prefix ลงท้าย * เช่น 184.22.* / 2405:9800:*
        return /^[0-9a-fA-F:.]+\*?$/.test(v) && v.length >= 3;
    }

    // ═══ ฟังก์ชันที่ปุ่มเรียก ═══
    window.ipAllowToggle = async function () {
        if (!ipData.enabled && ipData.ips.length === 0) {
            const ok = await Swal.fire({
                icon: 'warning', title: 'ยังไม่มี IP ในรายการ',
                text: 'ถ้าเปิดตอนนี้ พนักงานทุกคนจะเข้าไม่ได้เลย (ยกเว้น admin) ต้องการเปิดจริงไหม?',
                showCancelButton: true, confirmButtonText: 'เปิดเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#d33'
            });
            if (!ok.isConfirmed) return;
        }
        ipData.enabled = !ipData.enabled;
        if (await saveData()) {
            render();
            window.showToast && window.showToast(ipData.enabled ? '🔒 เปิดบังคับตรวจ IP แล้ว' : '🔓 ปิดการตรวจ IP แล้ว');
        } else { ipData.enabled = !ipData.enabled; }
    };

    window.ipAllowAdd = async function (ipArg, noteArg) {
        const ipEl = document.getElementById('ipAllowNewIp');
        const noteEl = document.getElementById('ipAllowNewNote');
        const ip = (ipArg || (ipEl ? ipEl.value : '')).trim();
        const note = (noteArg !== undefined ? noteArg : (noteEl ? noteEl.value : '')).trim();
        if (!validIpInput(ip)) return Swal.fire('รูปแบบไม่ถูกต้อง', 'กรอกเป็น IP เช่น 49.228.10.55 หรือช่วง เช่น 49.228.*', 'warning');
        if (ipData.ips.some(x => x.ip === ip)) return Swal.fire('ซ้ำ', 'IP นี้อยู่ในรายการแล้ว', 'info');
        ipData.ips.push({ ip, note, added_by: (window.currentUser && currentUser.username) || '-', added_at: new Date().toISOString() });
        if (await saveData()) {
            if (ipEl) ipEl.value = ''; if (noteEl) noteEl.value = '';
            render();
            window.showToast && window.showToast('✅ เพิ่ม IP แล้ว');
        } else { ipData.ips.pop(); }
    };

    window.ipAllowAddMyIp = function () {
        if (!myIp) return Swal.fire('ยังไม่ทราบ IP', 'กำลังตรวจสอบ IP ของคุณ ลองใหม่อีกครั้ง', 'info');
        window.ipAllowAdd(myIp, 'เพิ่มจากปุ่ม IP ของฉัน');
    };

    window.ipAllowRemove = async function (i) {
        const item = ipData.ips[i];
        if (!item) return;
        // กันลบ IP ตัวเองตอนที่ระบบเปิดบังคับอยู่ → จะล็อกตัวเองออก
        if (ipData.enabled && myIp && ipMatches(myIp, item.ip) &&
            !ipData.ips.some((x, j) => j !== i && ipMatches(myIp, x.ip))) {
            const ok = await Swal.fire({
                icon: 'warning', title: 'นี่คือ IP ของคุณเอง!',
                text: 'ลบแล้วครั้งหน้าคุณอาจเข้าระบบไม่ได้ (ถ้าไม่ใช่ admin) ยืนยันลบไหม?',
                showCancelButton: true, confirmButtonText: 'ลบเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#d33'
            });
            if (!ok.isConfirmed) return;
        }
        const removed = ipData.ips.splice(i, 1);
        if (await saveData()) { render(); window.showToast && window.showToast('🗑️ ลบแล้ว'); }
        else { ipData.ips.splice(i, 0, removed[0]); }
    };

    // ═══ จุดเริ่มหน้า ═══
    window.initIpAllowApp = async function () {
        const role = ((window.currentUser && currentUser.role) || '').toLowerCase();
        const canUse = role === 'admin' || role === 'manager' ||
                       (typeof window.hasUserPerm === 'function' && window.hasUserPerm('ip_allow'));
        const app = document.getElementById('ipAllowApp');
        const noPerm = document.getElementById('ipAllowNoPerm');
        if (!canUse) {
            if (noPerm) noPerm.classList.remove('hidden');
            if (app) { app.classList.add('hidden'); app.style.display = 'none'; }
            return;
        }
        if (noPerm) noPerm.classList.add('hidden');
        if (app) { app.classList.remove('hidden'); app.style.display = 'flex'; }

        await loadData();
        render();

        myIp = await fetchMyIp();
        const el = document.getElementById('ipAllowMyIp');
        if (el) el.textContent = myIp || 'ตรวจสอบไม่ได้';
        render(); // วาดซ้ำให้ป้าย "IP ของคุณ" ขึ้น
    };
})();
