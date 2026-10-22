// ═══════════════════════════════════════════════════
// 🔒 หน้าตั้งค่า IP ที่อนุญาต (IP Allowlist)
// เก็บใน settings key: 'ip_whitelist' รูปแบบ { enabled: bool, ips: [{ip, note, added_by, added_at}] }
// การบังคับจริงอยู่ใน auth.js (handleLogin) — ตรวจหลังกรอก PIN ถูกแล้ว
// ⚠️ หมายเหตุ: auth.js ตอนนี้ตรวจ "ทุกคน" รวมแอดมิน (ไม่มีข้อยกเว้น) → หน้านี้จึงกันไม่ให้เปิดบังคับ/ลบ IP ตัวเองโดยไม่รู้ตัว
// ═══════════════════════════════════════════════════
(function () {
    let ipData = { enabled: false, ips: [] };
    let myIp = null;
    let myIpChecked = false;

    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (id) => document.getElementById(id);
    const toast = (m) => { if (window.showToast) window.showToast(m); };

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

    function normalize(d) {
        const o = (d && typeof d === 'object') ? d : {};
        return { enabled: !!o.enabled, ips: Array.isArray(o.ips) ? o.ips.filter(x => x && x.ip) : [] };
    }
    async function loadData() {
        try {
            const { data, error } = await appDB.from('settings').select('value').eq('key', 'ip_whitelist').maybeSingle();
            if (error) throw error;
            let v = data && data.value;
            if (typeof v === 'string') v = JSON.parse(v);
            ipData = normalize(v);
            return true;
        } catch (e) { console.error('โหลด ip_whitelist:', e); return false; }
    }
    async function saveData() {
        const { error } = await appDB.from('settings').upsert([{ key: 'ip_whitelist', value: JSON.stringify(ipData) }]);
        if (error) { Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error'); return false; }
        return true;
    }
    // [แก้] โหลดค่าล่าสุดจากฐานข้อมูลก่อนแก้ทุกครั้ง — เดิมใช้ค่าที่ค้างในเครื่อง
    //      ถ้าแอดมิน 2 คนเปิดหน้านี้พร้อมกัน คนที่บันทึกทีหลังจะเขียนทับรายการที่อีกคนเพิ่งเพิ่ม (IP หายเงียบ ๆ)
    async function mutate(fn) {
        if (!(await loadData())) { Swal.fire('โหลดข้อมูลไม่สำเร็จ', 'ลองใหม่อีกครั้ง', 'error'); return false; }
        const backup = JSON.parse(JSON.stringify(ipData));
        const r = await fn(ipData);
        if (r === false) { ipData = backup; render(); return false; }
        if (await saveData()) { render(); return true; }
        ipData = backup; render(); return false;
    }

    // 🌍 GeoIP: ประเทศ/ผู้ให้บริการของแต่ละ IP (cache + ยิงพร้อมกัน — เดิมยิงทีละตัวต่อกัน)
    const geoCache = {};
    async function fetchGeo(ip) {
        if (geoCache[ip] !== undefined) return geoCache[ip];
        try {
            const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
            const d = await r.json();
            geoCache[ip] = d && d.success ? { flag: (d.flag && d.flag.emoji) || '', country: d.country || '', isp: (d.connection && d.connection.isp) || '' } : null;
        } catch (e) { geoCache[ip] = null; }
        return geoCache[ip];
    }
    const geoId = (ip) => 'ipGeo_' + String(ip).replace(/[^0-9a-zA-Z]/g, '_');
    function paintGeo(ip) {
        const g = geoCache[ip]; const el = $(geoId(ip));
        if (el && g) el.textContent = ` · ${g.flag} ${g.country}${g.isp ? ' · ' + g.isp : ''}`;
    }
    function decorateGeo() {
        ipData.ips.filter(x => !x.ip.includes('*')).forEach(x => {
            if (geoCache[x.ip] !== undefined) paintGeo(x.ip);
            else fetchGeo(x.ip).then(() => paintGeo(x.ip));
        });
    }

    // ── ตรวจว่า IP ตรงกับรายการไหม (exact หรือ prefix แบบ 184.22.*) — กติกาเดียวกับ auth.js ──
    function ipMatches(ip, pattern) {
        if (!ip || !pattern) return false;
        if (pattern.includes('*')) return ip.startsWith(pattern.replace(/\*+$/, ''));
        return ip === pattern;
    }
    const myIpAllowed = () => !!myIp && ipData.ips.some(x => ipMatches(myIp, x.ip));

    function validIpInput(v) {
        // ยอมรับ IPv4/IPv6 หรือช่วงที่ลงท้ายด้วย * (ดาวต้องอยู่ท้ายสุดเท่านั้น)
        if (!/^[0-9a-fA-F:.]+\*?$/.test(v) || v.length < 3) return false;
        if (/^[0-9.]+$/.test(v)) {   // IPv4 เต็ม → ตรวจว่าเป็นเลข 0–255 ครบ 4 ชุด
            const p = v.split('.'); return p.length === 4 && p.every(n => n !== '' && +n >= 0 && +n <= 255);
        }
        return true;
    }

    // ═══ วาดหน้าจอ ═══
    function renderHero() {
        const on = ipData.enabled;
        const hero = $('ipAllowHero'); if (hero) { hero.classList.toggle('on', on); hero.classList.toggle('off', !on); }
        const ic = $('ipAllowHeroIcon'); if (ic) ic.textContent = on ? 'lock' : 'lock_open';
        const st = $('ipStatStatus'); if (st) st.textContent = on ? 'เปิดบังคับตรวจ IP อยู่' : 'ปิดอยู่ · ทุกคนเข้าได้';
        const tx = $('ipAllowHeroText');
        if (tx) tx.textContent = on
            ? `เข้าสู่ระบบได้เฉพาะจาก IP ในรายการ (${ipData.ips.length} รายการ) · ตรวจทุกคนรวมแอดมิน`
            : 'เปิดสวิตช์เมื่อพร้อม — จากนั้นเข้าสู่ระบบได้เฉพาะ IP ในรายการ (ตรวจทุกคนรวมแอดมิน)';
        const btn = $('ipAllowToggleBtn'); if (btn) { btn.classList.toggle('on', on); btn.setAttribute('aria-checked', on ? 'true' : 'false'); }
        const lb = $('ipAllowToggleLbl'); if (lb) lb.textContent = on ? 'เปิด' : 'ปิด';
        const c = $('ipStatCount'); if (c) c.textContent = ipData.ips.length;
        const rg = $('ipStatRanges'); if (rg) rg.textContent = ipData.ips.filter(x => x.ip.includes('*')).length;
        const cnt = $('ipAllowCount'); if (cnt) cnt.textContent = `${ipData.ips.length} รายการ`;
    }
    function renderMe() {
        const el = $('ipAllowMyIp'); if (el) el.textContent = myIp || (myIpChecked ? 'ตรวจสอบไม่ได้' : 'กำลังตรวจสอบ…');
        const st = $('ipAllowMyStatus');
        if (st) {
            if (!myIpChecked) { st.className = 'ia-me-st wait'; st.textContent = 'กำลังตรวจสอบ'; }
            else if (!myIp) { st.className = 'ia-me-st wait'; st.textContent = 'ตรวจ IP ไม่ได้'; }
            else if (myIpAllowed()) { st.className = 'ia-me-st ok'; st.textContent = '✓ อยู่ในรายการ · เข้าระบบได้'; }
            else { st.className = 'ia-me-st no'; st.textContent = ipData.enabled ? '✕ ไม่อยู่ในรายการ · ถูกบล็อกถ้าออกแล้วเข้าใหม่' : '✕ ยังไม่อยู่ในรายการ'; }
        }
        const b = $('ipAllowAddMeBtn'); if (b) b.style.display = (myIp && !myIpAllowed()) ? '' : 'none';
    }
    window.ipAllowRenderList = function () {
        const list = $('ipAllowList'); if (!list) return;
        if (ipData.ips.length === 0) {
            list.innerHTML = `<div class="ia-empty">ยังไม่มี IP ในรายการ — ถ้าเปิดบังคับตอนนี้ จะไม่มีใครเข้าระบบได้เลย</div>`;
            return;
        }
        const q = (($('ipAllowFilter') || {}).value || '').trim().toLowerCase();
        const rows = ipData.ips.filter(x => !q || x.ip.toLowerCase().includes(q) || String(x.note || '').toLowerCase().includes(q) || String(x.added_by || '').toLowerCase().includes(q));
        if (!rows.length) { list.innerHTML = `<div class="ia-empty">ไม่พบ "${esc(q)}"</div>`; return; }
        list.innerHTML = rows.map(item => {
            const range = item.ip.includes('*');
            const me = myIp && ipMatches(myIp, item.ip);
            const when = item.added_at ? new Date(item.added_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
            return `<div class="ia-row">
                <span class="ia-row-ic" style="--ic:${range ? '#a855f7' : '#10b981'};--ic-bg:${range ? 'rgba(168,85,247,.13)' : 'rgba(16,185,129,.13)'}"><span class="material-icons">${range ? 'lan' : 'computer'}</span></span>
                <div style="flex:1;min-width:0">
                    <div class="ia-row-ip"><span class="ia-mono">${esc(item.ip)}</span>${range ? '<span class="ia-tag range">ทั้งช่วง</span>' : ''}${me ? '<span class="ia-tag me">IP ของคุณ</span>' : ''}</div>
                    <div class="ia-row-m">${esc(item.note || 'ไม่มีหมายเหตุ')} · เพิ่มโดย ${esc(item.added_by || '-')}${when ? ' · ' + esc(when) : ''}<span id="${geoId(item.ip)}"></span></div>
                </div>
                <button class="ia-del" data-ip="${esc(item.ip)}" onclick="ipAllowRemove(this.dataset.ip)" title="ลบ ${esc(item.ip)}" aria-label="ลบ ${esc(item.ip)}"><span class="material-icons">delete</span></button>
            </div>`;
        }).join('');
        rows.forEach(x => { if (!x.ip.includes('*')) paintGeo(x.ip); });
    };
    function render() { renderHero(); renderMe(); window.ipAllowRenderList(); }

    // ═══ ปุ่มต่าง ๆ ═══
    window.ipAllowToggle = async function () {
        const turningOn = !ipData.enabled;
        if (turningOn) {
            if (ipData.ips.length === 0) {
                const ok = await Swal.fire({ icon: 'warning', title: 'ยังไม่มี IP ในรายการ', text: 'ถ้าเปิดตอนนี้ จะไม่มีใครเข้าระบบได้เลย (รวมแอดมิน) ต้องการเปิดจริงไหม?', showCancelButton: true, confirmButtonText: 'เปิดเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#d33' });
                if (!ok.isConfirmed) return;
            } else if (myIp && !myIpAllowed()) {
                // [ใหม่] กันล็อกตัวเองออก: IP ที่ใช้อยู่ไม่อยู่ในรายการ
                const ok = await Swal.fire({ icon: 'warning', title: 'IP ของคุณไม่อยู่ในรายการ', html: `IP ตอนนี้ <b class="ia-mono">${esc(myIp)}</b><br>ถ้าเปิด แล้วคุณออกจากระบบ จะ<b>เข้ากลับไม่ได้</b> จนกว่าจะใช้ IP ที่อยู่ในรายการ`, showCancelButton: true, showDenyButton: true, confirmButtonText: 'เปิดเลย', denyButtonText: 'เพิ่ม IP นี้แล้วเปิด', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#d33', denyButtonColor: '#16a34a' });
                if (ok.isDenied) {
                    const done = await mutate(d => { if (!d.ips.some(x => ipMatches(myIp, x.ip))) d.ips.push({ ip: myIp, note: 'เพิ่มอัตโนมัติก่อนเปิดบังคับ', added_by: (window.currentUser && currentUser.username) || '-', added_at: new Date().toISOString() }); d.enabled = true; });
                    if (done) { toast('🔒 เพิ่ม IP ของคุณ + เปิดบังคับแล้ว'); decorateGeo(); }
                    return;
                }
                if (!ok.isConfirmed) return;
            }
        }
        const done = await mutate(d => { d.enabled = turningOn; });
        if (done) toast(turningOn ? '🔒 เปิดบังคับตรวจ IP แล้ว' : '🔓 ปิดการตรวจ IP แล้ว');
    };

    window.ipAllowAdd = async function (ipArg, noteArg) {
        const ipEl = $('ipAllowNewIp'), noteEl = $('ipAllowNewNote');
        const ip = String(ipArg || (ipEl ? ipEl.value : '')).trim().replace(/\s+/g, '');
        const note = String(noteArg !== undefined ? noteArg : (noteEl ? noteEl.value : '')).trim().slice(0, 80);
        if (!validIpInput(ip)) { Swal.fire('รูปแบบไม่ถูกต้อง', 'กรอกเป็น IP เช่น 49.228.10.55 หรือช่วง เช่น 49.228.*', 'warning'); return false; }
        let dup = false;
        const done = await mutate(d => {
            if (d.ips.some(x => x.ip === ip)) { dup = true; return false; }
            d.ips.push({ ip, note, added_by: (window.currentUser && currentUser.username) || '-', added_at: new Date().toISOString() });
        });
        if (dup) { Swal.fire('ซ้ำ', 'IP นี้อยู่ในรายการแล้ว', 'info'); return false; }
        if (done) {
            if (!ipArg) { if (ipEl) ipEl.value = ''; if (noteEl) noteEl.value = ''; }
            decorateGeo(); toast('✅ เพิ่ม IP แล้ว');
        }
        return done;
    };

    window.ipAllowAddMyIp = function () {
        if (!myIp) return Swal.fire('ยังไม่ทราบ IP', 'กำลังตรวจสอบ IP ของคุณ ลองใหม่อีกครั้ง', 'info');
        return window.ipAllowAdd(myIp, 'เพิ่มจากปุ่ม IP ของฉัน');
    };

    // [แก้] ลบด้วย "ค่า IP" แทนลำดับ — เดิมใช้ลำดับในรายการ ถ้ารายการเปลี่ยน (มีคนเพิ่ม/ลบพร้อมกัน) อาจลบผิดตัว
    window.ipAllowRemove = async function (ip) {
        if (typeof ip === 'number') ip = (ipData.ips[ip] || {}).ip;   // รองรับแบบเดิม
        const item = ipData.ips.find(x => x.ip === ip);
        if (!item) return;
        const lastForMe = ipData.enabled && myIp && ipMatches(myIp, item.ip) && !ipData.ips.some(x => x.ip !== ip && ipMatches(myIp, x.ip));
        const ok = await Swal.fire({
            icon: lastForMe ? 'warning' : 'question',
            title: lastForMe ? 'นี่คือ IP ที่คุณใช้อยู่!' : `ลบ ${ip}?`,
            html: lastForMe ? 'ลบแล้วถ้าออกจากระบบ คุณจะเข้ากลับไม่ได้ ยืนยันลบไหม?' : `${esc(item.note || '')}`,
            showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#d33'
        });
        if (!ok.isConfirmed) return;
        const done = await mutate(d => { const i = d.ips.findIndex(x => x.ip === ip); if (i === -1) return false; d.ips.splice(i, 1); });
        if (done) toast('🗑️ ลบแล้ว');
    };

    // 🧪 ทดสอบ IP
    window.ipAllowTest = function () {
        const inp = $('ipTestInput'), out = $('ipTestResult');
        if (!inp || !out) return;
        const ip = inp.value.trim();
        if (!ip) { out.innerHTML = ''; return; }
        const hit = ipData.ips.find(x => ipMatches(ip, x.ip));
        if (!ipData.enabled) {
            out.innerHTML = `<div class="ia-res mute">ระบบปิดอยู่ ตอนนี้ IP ไหนก็เข้าได้ · ถ้าเปิด: ${hit ? `<b style="color:var(--k-green-tx)">เข้าได้</b> (ตรงกับ <span class="ia-mono">${esc(hit.ip)}</span>)` : '<b style="color:var(--k-red-tx)">ถูกบล็อก</b>'}</div>`;
        } else if (hit) {
            out.innerHTML = `<div class="ia-res ok">✓ เข้าได้ — ตรงกับ <b class="ia-mono">${esc(hit.ip)}</b>${hit.note ? ' (' + esc(hit.note) + ')' : ''}</div>`;
        } else {
            out.innerHTML = `<div class="ia-res no">✕ ถูกบล็อก — ไม่ตรงกับรายการไหนเลย</div>`;
        }
    };

    // 🚫 ประวัติคนถูกบล็อก (จาก system_logs)
    window.ipAllowLoadBlocked = async function () {
        const box = $('ipBlockedList'); if (!box) return;
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            // [แก้] เดิมนับ "ถูกบล็อกวันนี้" จากแค่ 20 รายการล่าสุด → วันที่โดนบล็อกเยอะ ตัวเลขต่ำกว่าจริง
            const [listRes, cntRes] = await Promise.all([
                appDB.from('system_logs').select('created_at, performed_by, target_details').eq('action_type', 'ถูกบล็อก IP').order('created_at', { ascending: false }).limit(20),
                appDB.from('system_logs').select('id', { count: 'exact', head: true }).eq('action_type', 'ถูกบล็อก IP').gte('created_at', today.toISOString()),
            ]);
            if (listRes.error) throw listRes.error;
            const logs = listRes.data || [];
            const b = $('ipStatBlocked');
            if (b) b.textContent = (typeof cntRes.count === 'number') ? cntRes.count : logs.filter(l => new Date(l.created_at) >= today).length;
            if (!logs.length) { box.innerHTML = `<div class="ia-empty">ยังไม่มีใครถูกบล็อก 🎉</div>`; return; }
            box.innerHTML = logs.map(l => {
                const m = (l.target_details || '').match(/IP\s+([0-9a-fA-F:.]+)/);
                const ip = m ? m[1] : null;
                const t = l.created_at ? new Date(l.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
                const canAllow = ip && !ipData.ips.some(x => ipMatches(ip, x.ip));
                // [แก้] เดิมใส่ชื่อ/IP ลงใน onclick ตรง ๆ → ชื่อที่มีเครื่องหมาย " ทำให้ปุ่มพัง · ตอนนี้ใช้ data-*
                return `<div class="ia-blk">
                    <span class="material-icons" style="color:var(--k-red-tx)">gpp_bad</span>
                    <div style="flex:1;min-width:0">
                        <div class="ia-blk-n">${esc(l.performed_by || '-')}${ip ? `<span class="ia-blk-ip">${esc(ip)}</span>` : ''}</div>
                        <div class="ia-blk-t">${esc(t)}</div>
                    </div>
                    ${canAllow ? `<button class="ia-allow" data-ip="${esc(ip)}" data-who="${esc(l.performed_by || '')}" onclick="ipAllowFromBlocked(this)">+ อนุญาต</button>` : ''}
                </div>`;
            }).join('');
        } catch (e) {
            box.innerHTML = `<div class="ia-empty">โหลดประวัติไม่สำเร็จ</div>`;
        }
    };
    window.ipAllowFromBlocked = async function (btn) {
        const ok = await window.ipAllowAdd(btn.dataset.ip, `อนุญาตจากประวัติบล็อก (${btn.dataset.who})`);
        if (ok) window.ipAllowLoadBlocked();
    };

    // ═══ จุดเริ่มหน้า ═══
    window.initIpAllowApp = async function () {
        const canUse = canPerm('ip_allow') || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('ip_allow'));
        const app = $('ipAllowApp'), noPerm = $('ipAllowNoPerm');
        if (!canUse) {
            if (noPerm) noPerm.classList.remove('hidden');
            if (app) { app.classList.add('hidden'); app.style.display = 'none'; }
            return;
        }
        if (noPerm) noPerm.classList.add('hidden');
        if (app) { app.classList.remove('hidden'); app.style.display = 'flex'; }

        myIpChecked = false;
        await loadData();
        render();
        window.ipAllowLoadBlocked();   // ไม่ต้องรอ
        decorateGeo();

        myIp = await fetchMyIp();
        myIpChecked = true;
        render();
    };
})();
