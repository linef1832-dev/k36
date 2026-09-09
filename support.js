// ════════════════════════════════════════════════════════════════════
// 📦 duty/support.js — ส่วนที่ 5/6 ของหน้าจัดหน้าที่/เวร (แยกจาก duty.js เดิม 5,478 บรรทัด)
// เนื้อหา: ซัพพอร์ตข้ามเว็บ (A ช่วย B ผลัดช่วง), ระบบ "อยู่ต่ออีกกี่วัน" ล็อกคนไว้เว็บเดิม
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): duty/core → duty/dragdrop → duty/roles → duty/tools → duty/support → duty/rotation
// ตัวแปร top-level (currentDutyDept, sortedTeams ฯลฯ) แชร์ข้ามไฟล์กันอัตโนมัติ — scope เดียวกัน
// ════════════════════════════════════════════════════════════════════
// 🤝 ระบบซัพพอร์ตข้ามเว็บ — "เว็บ A เข้าช่วยเว็บ B ผลัดกันคนละช่วง"
// ============================================================
// ต่างจาก "ตารางซัพพอร์ต" เดิม ที่แบ่งเวลาให้ทุกเว็บพร้อมกันแต่ไม่ระบุว่าไปช่วยใคร
// (ในโค้ดเดิมมีตัวแปร helpCalcTarget + dropdown เลือกเป้าหมายสร้างค้างไว้ แต่ไม่เคยถูกใช้)
//
// ตัวนี้: เลือกเว็บต้นทาง 1 เว็บ → คนของเว็บนั้นผลัดกันไปประจำเว็บเป้าหมาย
// ซอยเวลากะออกเป็นช่วงเท่าๆ กันตามจำนวนคน แล้วจับคู่คนกับช่วงที่ชนเวลาพักน้อยที่สุด
//
//   settings key : duty_support_<dept>_<date>_<shift>
//   value        : { "<เว็บเป้าหมาย>": { source, slots:[{id,name,start,end,breakMin}] } }
// ============================================================

window.currentSupportData = {};

window.getSupportKey = function(dateStr, shift) {
    return `duty_support_${currentDutyDept}_${dateStr}_${shift}`;
};

// key ของแต่ละรายการ = คู่ "ต้นทาง→เป้าหมาย"
//
// ⚠️ เดิมผมใช้แค่ชื่อเว็บเป้าหมายเป็น key ซึ่งผิด — พอจัด MK8→Jun88
// ทับ VV72→Jun88 ที่มีอยู่ รายการเก่าหายเงียบๆ โดยไม่มีอะไรเตือน
// เว็บหนึ่งรับซัพพอร์ตจากหลายเว็บพร้อมกันได้ จึงต้องแยกด้วยคู่
window.supportEntryKey = function(source, target) {
    return `${source}→${target}`;
};

// อ่านข้อมูลเก่าที่ยัง key ด้วยชื่อเว็บเป้าหมายอย่างเดียว ให้กลายเป็นรูปแบบใหม่
// ไม่งั้นตารางที่บันทึกไว้ก่อนหน้านี้จะอ่านไม่ออกแล้วหายไปทั้งหมด
window.normalizeSupportData = function(raw) {
    const out = {};
    Object.entries(raw || {}).forEach(([k, v]) => {
        if (!v || !Array.isArray(v.slots)) return;
        const target = v.target || k;        // ของเก่า: key คือเว็บเป้าหมาย
        const source = v.source || '?';
        out[window.supportEntryKey(source, target)] = { ...v, source, target };
    });
    return out;
};

// แปลงเวลาที่พิมพ์ในช่อง (เช่น "02:00") เป็นนาทีของกะนั้น
// กะดึก (20:00–08:00) เก็บท้ายกะเป็นนาทีที่ 1920 คือ 08:00 ของวันถัดไป
// เลขที่น้อยกว่าจุดเริ่มกะจึงต้องบวก 24 ชม. เช่น 02:00 → 1560
//
// แต่ต้องทำเฉพาะกะที่ข้ามเที่ยงคืนจริงๆ เท่านั้น — ถ้าเหมาบวกทุกกะ
// กะเช้าที่กรอก 06:00 (นอกกะ) จะกลายเป็น 06:00 ของวันถัดไปแล้วรอดด่านตรวจไปได้
window.parseShiftTime = function(str, cfg) {
    const m = timeToMin(str);
    if (m == null || isNaN(m)) return null;
    const crossesMidnight = cfg.end > 24 * 60;
    return (crossesMidnight && m < cfg.start) ? m + 24 * 60 : m;
};

// จำช่วงเวลาที่แอดมินเลือกไว้ แยกตามกะ (แผงถูกวาดใหม่บ่อย ค่าจะได้ไม่เด้งกลับ)
window.supportWindowPref = null;

window.rememberSupportWindow = function() {
    const s = document.getElementById('supportStartTime');
    const e = document.getElementById('supportEndTime');
    const shift = document.getElementById('dutyShiftSelect');
    if (!s || !e || !shift) return;
    window.supportWindowPref = { shift: shift.value, start: s.value, end: e.value };
};

window.resetSupportWindow = function() {
    window.supportWindowPref = null;
    window.renderHelpCalcPanel();
};

// สร้างแผนที่เวลาพักของแต่ละคน (นาทีจากเที่ยงคืน, กะดึกบวก 24 ชม.)
window.buildBreakMap = function(schedules, cfg) {
    const map = {};
    (schedules || []).forEach(sc => {
        if (!map[sc.staff_name]) map[sc.staff_name] = [];
        (sc.time_slot || '').split(',').map(t => t.trim()).filter(Boolean).forEach(slot => {
            const [s, e] = slot.split('-').map(timeToMin);
            if (s == null || e == null) return;
            // กะดึกเริ่ม 20:00 — ช่วงพักที่เป็นเลขเช้า (เช่น 03:00) คือของวันถัดไป ต้องบวก 24 ชม.
            if (cfg.start >= 20 * 60 && s < 12 * 60) map[sc.staff_name].push({ s: s + 24 * 60, e: e + 24 * 60 });
            else map[sc.staff_name].push({ s, e });
        });
    });
    return map;
};

// ซอยกะเป็น n ช่วงเท่าๆ กัน แล้วจับคู่คนกับช่วงที่โดนเวลาพักกินน้อยที่สุด
window.splitShiftAmong = function(members, cfg, breakMap) {
    const n = members.length;
    if (n === 0) return [];

    const slotMin = Math.floor((cfg.end - cfg.start) / n);
    const slots = Array.from({ length: n }, (_, i) => ({
        start: cfg.start + i * slotMin,
        end:   cfg.start + (i + 1) * slotMin
    }));
    slots[n - 1].end = cfg.end;   // ช่วงสุดท้ายกินเศษที่เหลือ ไม่ให้ขาดท้ายกะ

    const overlap = (name, a, b) => (breakMap[name] || []).reduce(
        (t, br) => t + Math.max(0, Math.min(br.e, b) - Math.max(br.s, a)), 0);
    const cost = (mi, si) => overlap(members[mi].username, slots[si].start, slots[si].end);

    // รอบที่ 1 — greedy: ไล่คู่ที่เสียเวลาพักน้อยสุดก่อน
    const pairs = [];
    members.forEach((_, mi) => slots.forEach((_, si) => pairs.push({ mi, si, c: cost(mi, si) })));
    pairs.sort((a, b) => a.c - b.c);

    const assign = new Array(n).fill(-1);   // assign[si] = mi
    const usedM = new Set(), usedS = new Set();
    pairs.forEach(p => {
        if (usedM.has(p.mi) || usedS.has(p.si)) return;
        usedM.add(p.mi); usedS.add(p.si);
        assign[p.si] = p.mi;
    });

    // รอบที่ 2 — ขัดด้วยการสลับคู่
    // greedy อย่างเดียวไม่พอ: มันแจกช่วงดีๆ ให้คนแรกๆ จนคนสุดท้ายเหลือแต่ช่วงที่ชนพัก
    // ทั้งที่สลับกันแล้วไม่มีใครชนเลยก็มี — ไล่สลับจนไม่มีอะไรดีขึ้นแล้วค่อยหยุด
    for (let pass = 0; pass < 5; pass++) {
        let changed = false;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const mi = assign[i], mj = assign[j];
                if (mi < 0 || mj < 0) continue;
                if (cost(mi, j) + cost(mj, i) < cost(mi, i) + cost(mj, j)) {
                    assign[i] = mj; assign[j] = mi;
                    changed = true;
                }
            }
        }
        if (!changed) break;
    }

    return assign.map((mi, si) => ({
        id:       members[mi].id,
        name:     members[mi].username,
        start:    slots[si].start,
        end:      slots[si].end,
        breakMin: cost(mi, si)
    }));
};

// 🤝 ปุ่มหลัก — จัดคนเว็บต้นทางไปซัพพอร์ตเว็บเป้าหมาย
window.assignSupportTeam = async function() {
    if (window.blockIfPreview()) return;
    if (!window.isDutyAdmin()) return;

    // ตั้งใจให้ใช้เฉพาะแผนก AM — OD ไม่ใช้ระบบนี้ (เขามีแจกโปร/เคส TG ของตัวเองอยู่แล้ว)
    // แผงก็ถูกซ่อนไว้อยู่แล้ว แต่ดักซ้ำตรงนี้กันถูกเรียกผ่าน console หรือปุ่มค้างจากแผนกอื่น
    if (currentDutyDept !== 'AM') {
        return Swal.fire('ใช้ได้เฉพาะ AM', 'ระบบซัพพอร์ตข้ามเว็บเปิดใช้เฉพาะแผนก AM ครับ', 'info');
    }

    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate  = document.getElementById('dutyDate').value;
    const cfg = SHIFT_CONFIG[shiftFilter];
    if (!cfg) return Swal.fire('เตือน', 'ระบบรองรับแค่กะเช้าและกะดึกครับ', 'warning');

    const srcEl = document.getElementById('supportSourceSel');
    const tgtEl = document.getElementById('supportTargetSel');
    const source = srcEl ? srcEl.value : '';
    const target = tgtEl ? tgtEl.value : '';

    if (!source || !target) return Swal.fire('เตือน', 'เลือกเว็บต้นทางและเว็บเป้าหมายก่อนครับ', 'warning');
    if (source === target)  return Swal.fire('เตือน', 'เว็บต้นทางกับเป้าหมายต้องคนละเว็บครับ', 'warning');

    const roster = currentRosterData || {};
    const hasStaff = t => (roster[t] || []).filter(u => u && u.id && !String(u.username || '').includes('ขาดคน'));
    const members = hasStaff(source);
    if (members.length === 0) {
        // บอกไปเลยว่ามีเว็บไหนให้เลือกบ้าง จะได้ไม่ต้องไล่กดทีละอันเอง
        const usable = (sortedTeams || []).filter(t => hasStaff(t).length > 0);
        return Swal.fire({
            icon: 'error',
            title: `เว็บ ${source} ไม่มีคน`,
            html: usable.length
                ? `<div style="font-size:13px;color:#94a3b8;line-height:1.8">เว็บนี้ไม่มีพนักงานในตารางวันนี้ จึงส่งไปช่วยใครไม่ได้<br><br>
                     เว็บที่ส่งคนไปช่วยได้:<br><b style="color:#38bdf8">${usable.map(t => `${t} (${hasStaff(t).length})`).join(' · ')}</b></div>`
                : `<div style="font-size:13px;color:#94a3b8">ยังไม่ได้จัดเวรของวันนี้เลย — กด <b style="color:#818cf8">"สุ่มจัดหน้าที่"</b> ก่อนครับ</div>`,
            background: '#0b1120',
            confirmButtonColor: '#6366f1',
            customClass: { popup: 'rounded-3xl border border-slate-700 dark:text-white' }
        });
    }

    // ── ช่วงเวลาที่จะให้ไปช่วย ── (ไม่กรอก = เต็มกะ)
    const sEl = document.getElementById('supportStartTime');
    const eEl = document.getElementById('supportEndTime');
    const winStart = sEl && sEl.value ? window.parseShiftTime(sEl.value, cfg) : cfg.start;
    const winEnd   = eEl && eEl.value ? window.parseShiftTime(eEl.value, cfg) : cfg.end;

    const badTime = (msg) => Swal.fire({
        icon: 'warning', title: 'ช่วงเวลาไม่ถูกต้อง',
        html: `<div style="font-size:13px;color:#94a3b8;line-height:1.8">${msg}<br><br>
                 กะ <b style="color:#e2e8f0">${shiftFilter}</b> อยู่ในช่วง
                 <b style="color:#38bdf8">${minToTime(cfg.start)}–${minToTime(cfg.end)}</b></div>`,
        background: '#0b1120', confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-3xl border border-slate-700 dark:text-white' }
    });

    if (winStart == null || winEnd == null) return badTime('กรอกเวลาไม่ครบหรือรูปแบบไม่ถูกต้อง');
    if (winStart >= winEnd) return badTime('เวลาเริ่มต้องมาก่อนเวลาสิ้นสุด');
    if (winStart < cfg.start || winEnd > cfg.end) return badTime('ช่วงเวลาต้องอยู่ในกะนี้เท่านั้น');

    // กันช่วงสั้นเกินจนแบ่งแล้วได้คนละไม่กี่นาที
    const spanMin = winEnd - winStart;
    if (spanMin < members.length * 15) {
        return badTime(`ช่วงนี้ยาว ${spanMin} นาที แบ่งให้ ${members.length} คนแล้วได้คนละไม่ถึง 15 นาที`);
    }

    const breakMap = window.buildBreakMap(window.currentDutySchedules || [], cfg);
    const slots = window.splitShiftAmong(members, { start: winStart, end: winEnd }, breakMap);
    const perSlot = Math.floor(spanMin / members.length);

    const preview = slots.map((s, i) =>
        `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1e293b">
            <span style="width:18px;height:18px;border-radius:50%;background:#0369a1;color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</span>
            <span style="flex:1;text-align:left;font-weight:800;font-size:12px;color:#f1f5f9">${s.name}</span>
            <span style="font-size:11px;font-weight:800;color:#38bdf8">${minToTime(s.start)}–${minToTime(s.end)}</span>
            <span style="font-size:9px;color:${s.breakMin > 0 ? '#fbbf24' : '#34d399'};min-width:56px;text-align:right">${s.breakMin > 0 ? `พักใน ${s.breakMin} น.` : 'ไม่ชนพัก'}</span>
        </div>`).join('');

    // เตือนถ้าคนคนเดียวถูกจัดไปช่วยสองที่ในเวลาทับกัน — ตัวเขาไปอยู่สองที่พร้อมกันไม่ได้
    const clashes = [];
    slots.forEach(s => {
        (window.getSupportForUser(s.id) || []).forEach(prev => {
            if (prev.target === target && prev.source === source) return;   // รายการเดิมของคู่นี้ เดี๋ยวถูกทับอยู่แล้ว
            if (s.start < prev.end && prev.start < s.end) {
                clashes.push(`${s.name} — ช่วยเว็บ ${prev.target} อยู่แล้ว ${minToTime(prev.start)}–${minToTime(prev.end)}`);
            }
        });
    });

    const existingKey = window.supportEntryKey(source, target);
    const isReplace = !!window.currentSupportData[existingKey];

    const confirm = await Swal.fire({
        title: `<div style="font-size:15px;font-weight:900">🤝 ${source} → ซัพพอร์ต ${target}</div>`,
        html: `<div style="font-size:11.5px;color:#94a3b8;margin-bottom:10px">
                   ช่วง <b style="color:#38bdf8">${minToTime(winStart)}–${minToTime(winEnd)}</b>
                   ${spanMin === (cfg.end - cfg.start) ? '<span style="opacity:.7">(เต็มกะ)</span>' : `<span style="opacity:.7">(${Math.floor(spanMin/60)} ชม. ${spanMin%60 ? spanMin%60 + ' น.' : ''})</span>`}
                   <br>${members.length} คน ผลัดกันคนละ <b style="color:#e2e8f0">${perSlot} นาที</b>
               </div>
               ${isReplace ? `<div style="background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);border-radius:10px;padding:7px 10px;font-size:11px;color:#fbbf24;margin-bottom:8px;text-align:left">
                   ⚠️ มีตาราง <b>${source} → ${target}</b> อยู่แล้ว กดยืนยันจะเขียนทับของเดิม</div>` : ''}
               ${clashes.length ? `<div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:7px 10px;font-size:11px;color:#f87171;margin-bottom:8px;text-align:left;line-height:1.7">
                   🚨 <b>เวลาชนกัน</b> — คนเหล่านี้ถูกจัดไปช่วยที่อื่นในเวลาเดียวกันอยู่แล้ว:<br>${clashes.join('<br>')}</div>` : ''}
               <div style="max-height:46vh;overflow-y:auto">${preview}</div>`,
        background: '#0b1120',
        width: 480,
        showCancelButton: true,
        confirmButtonText: 'บันทึกตารางนี้',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#475569',
        customClass: { popup: 'rounded-3xl border border-slate-700 dark:text-white' }
    });
    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        window.currentSupportData[existingKey] = { source, target, slots, win: { start: winStart, end: winEnd } };
        window.clearSettingCache();
        const { error } = await appDB.from('settings').upsert([{
            key: window.getSupportKey(targetDate, shiftFilter),
            value: JSON.stringify(window.currentSupportData)
        }]);
        if (error) throw error;

        await appDB.from('system_logs').insert([{
            action_type: 'จัดซัพพอร์ต',
            performed_by: currentUser.username,
            target_details: `${source} → ซัพพอร์ต ${target} (${members.length} คน คนละ ${perSlot} นาที, `
                + `${currentDutyDept}, ${shiftFilter}, ${targetDate}) — `
                + slots.map(s => `${s.name} ${minToTime(s.start)}-${minToTime(s.end)}`).join(', ')
        }]);

        window.debouncedBroadcast('duty-updates', 'force_reload');
        window.renderRosterGrid(currentRosterData);
        window.renderHelpCalcPanel();
        Swal.fire({ icon: 'success', title: 'บันทึกแล้ว!', text: `${source} จะช่วย ${target} ผลัดกันคนละ ${perSlot} นาที`, timer: 2200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.clearSupportForTarget = async function(entryKey) {
    if (!window.isDutyAdmin()) return;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate  = document.getElementById('dutyDate').value;

    const info = (window.currentSupportData || {})[entryKey];
    if (!info) return;
    const target = info.target || entryKey;

    const ok = await Swal.fire({
        icon: 'warning', title: `ลบตาราง ${info.source} → ${target}?`,
        text: 'ตารางซัพพอร์ตคู่อื่นจะไม่ถูกแตะ',
        showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ไม่',
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    if (!ok.isConfirmed) return;

    try {
        delete window.currentSupportData[entryKey];
        window.clearSettingCache();
        await appDB.from('settings').upsert([{
            key: window.getSupportKey(targetDate, shiftFilter),
            value: JSON.stringify(window.currentSupportData)
        }]);
        await appDB.from('system_logs').insert([{
            action_type: 'จัดซัพพอร์ต',
            performed_by: currentUser.username,
            target_details: `ลบตารางซัพพอร์ต ${info.source} → ${target} (${currentDutyDept}, ${shiftFilter}, ${targetDate})`
        }]);
        window.debouncedBroadcast('duty-updates', 'force_reload');
        window.renderRosterGrid(currentRosterData);
        window.renderHelpCalcPanel();
        Swal.fire({ icon: 'success', title: 'ลบแล้ว', timer: 1200, showConfirmButton: false });
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// หา "งานซัพพอร์ต" ของคนคนหนึ่ง — คืนเป็น array เพราะคนเดียวถูกจัดไปช่วยได้หลายเว็บ
// (คนละช่วงเวลากัน) ถ้าคืนแค่ตัวแรกจะโชว์ไม่ครบและตรวจเวลาชนกันไม่เจอ
window.getSupportForUser = function(userId) {
    const found = [];
    Object.values(window.currentSupportData || {}).forEach(info => {
        const hit = (info.slots || []).find(s => String(s.id) === String(userId));
        if (hit) found.push({ target: info.target, source: info.source, ...hit });
    });
    return found.sort((a, b) => a.start - b.start);
};

window.calcHelpTime = async function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const cfg = SHIFT_CONFIG[shiftFilter];
    if (!cfg) return Swal.fire('เตือน', 'ระบบรองรับแค่กะเช้าและกะดึกครับ', 'warning');

    const targetDate = document.getElementById('dutyDate').value;
    const shiftDuration = cfg.end - cfg.start; // 720 นาที

    // ดึง roster และ schedules จาก DB
    let roster = {};
    let schedules = [];
    try {
        const key = getDutySaveKey(targetDate, shiftFilter);   // แผงนี้เปิดเฉพาะ AM อยู่แล้ว
        const [rosterRes, schedRes] = await Promise.all([
            appDB.from('settings').select('value').eq('key', key),
            appDB.from('schedules').select('staff_name, time_slot').eq('work_date', targetDate).eq('shift_name', shiftFilter)
        ]);
        if (rosterRes.data?.[0]?.value) roster = JSON.parse(rosterRes.data[0].value);
        if (schedRes.data?.length > 0) schedules = schedRes.data;
    } catch(e) {}

    if (Object.keys(roster).length === 0) roster = currentRosterData || {};
    if (schedules.length === 0) schedules = window.currentDutySchedules || [];

    // [REFACTOR] เดิมเขียน breakMap + greedy ซ้ำกับ buildBreakMap/splitShiftAmong
    // ใช้ตัวเดียวกับระบบซัพพอร์ตข้ามเว็บ (มีรอบสลับคู่ เลี่ยงเวลาพักได้ดีกว่า greedy อย่างเดียว)
    const breakMap = window.buildBreakMap(schedules, cfg);
    const results = [];

    Object.keys(roster).forEach(team => {
        const members = (roster[team] || []).filter(u => u && !String(u.username || '').includes('ขาดคน'));
        if (members.length === 0) return;
        const slotMin = Math.floor(shiftDuration / members.length);
        window.splitShiftAmong(members, cfg, breakMap).forEach(sl => {
            results.push({ team, name: sl.name, helpStart: sl.start, helpEnd: sl.end, breakMin: sl.breakMin, slotMin });
        });
    });

    window.helpCalcResult = results;
    window.renderHelpCalcPanel();
};

// ============================================================
// 📌 ระบบ "อยู่ต่ออีกกี่วัน" — ล็อกพนักงานไว้เว็บเดิมข้ามวัน
// ============================================================
// เดิม generateDutyRoster บังคับหมุนเว็บทุกวัน (กันไม่ให้ซ้ำกับเมื่อวาน)
// ฟีเจอร์นี้ให้แอดมินสั่งยกเว้นเป็นรายคนว่า "คนนี้อยู่เว็บนี้ต่ออีก N วัน"
//
// เก็บแยกจากตารางเวรรายวัน เพราะเป็น "กติกาข้ามวัน" ไม่ใช่ผลลัพธ์ของวันใดวันหนึ่ง
// ถ้าไปฝังใน duty_roster_<date> จะต้องไล่เขียนล่วงหน้าทีละวัน และแก้ทีหลังไม่ได้
//   settings key : duty_stay_pins_<dept>
//   value        : { "<user_id>": {username, team, shift, from, until, days, by} }
//   ขอบเขต       : ใช้กับวันที่  from < วันที่จัด <= until
//                  (from คือวันที่กดตั้ง ซึ่งเขาอยู่เว็บนั้นอยู่แล้ว จึงไม่นับซ้ำ)
// ============================================================

window.dutyStayPins = {};

window.getStayPinKey = function() {
    return `duty_stay_pins_${currentDutyDept}`;
};

// ใครมีสิทธิ์ล็อก "อยู่ต่อ" ได้บ้าง
// แยกจาก isDutyAdmin เพื่อให้เปิดให้ตำแหน่งอื่นใช้ได้ โดยไม่ต้องยกสิทธิ์
// จัดการเวรทั้งก้อน (สุ่มเวร/ล้างตาราง/ตั้งค่าหัวข้อ) ให้เขาไปด้วย
// ติ๊กได้ที่ ตั้งค่าระบบ → จัดการสิทธิ์ → จัดหน้าที่ / เวร → "📌 ล็อกให้อยู่เว็บเดิมข้ามวัน"
window.canManageStayPin = function() {
    if (window.isDutyAdmin()) return true;
    return typeof window.hasUserPerm === 'function' && window.hasUserPerm('duty_stay_pin');
};

// ── ตัวช่วยเรื่องวันที่ ────────────────────────────────────────
// ใช้ UTC ล้วนในการบวกวัน เพื่อไม่ให้ผลลัพธ์เพี้ยนตามโซนเวลาของเครื่อง
// (เทียบวันที่ใช้ string 'YYYY-MM-DD' เทียบตรงๆ ได้เลย เพราะเรียงตามตัวอักษร = เรียงตามเวลา)
window.dutyAddDays = function(dateStr, n) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
};

window.dutyDiffDays = function(fromStr, toStr) {
    const p = s => { const [y, m, d] = String(s).split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((p(toStr) - p(fromStr)) / 86400000);
};

window.dutyTodayStr = function() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

window.dutyFmtShortDate = function(dateStr) {
    const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const [y, m, d] = String(dateStr).split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return `${d} ${TH_MONTHS[m - 1]} ${String((y + 543)).slice(-2)}`;
};

// ── อ่าน/เขียน pin ────────────────────────────────────────────
window.loadStayPins = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', window.getStayPinKey()).maybeSingle();
        window.dutyStayPins = (data && data.value) ? JSON.parse(data.value) : {};
    } catch (e) {
        window.dutyStayPins = {};
    }
    return window.dutyStayPins;
};

// ล้าง pin ที่หมดอายุแล้วทิ้ง เพื่อไม่ให้ค่าเก่าค้างสะสมในตาราง settings
// เขียนกลับเฉพาะตอนที่มีของหมดอายุจริง จะได้ไม่ยิง DB ทุกครั้งที่เปิดหน้า
window.prunePins = function(pins) {
    const today = window.dutyTodayStr();
    let changed = false;
    const kept = {};
    Object.entries(pins || {}).forEach(([uid, p]) => {
        if (p && p.until && p.until >= today) kept[uid] = p;
        else changed = true;
    });
    if (changed) {
        window.dutyStayPins = kept;
        window.clearSettingCache();
        appDB.from('settings').upsert([{ key: window.getStayPinKey(), value: JSON.stringify(kept) }])
            .then(() => {}, e => console.warn('[stayPin] prune failed', e));
    }
    return kept;
};

window.saveStayPins = async function() {
    window.clearSettingCache();
    const { error } = await appDB.from('settings').upsert([
        { key: window.getStayPinKey(), value: JSON.stringify(window.dutyStayPins) }
    ]);
    if (error) throw error;
};

// pin ที่ยัง "มีผล" กับวันที่+กะที่กำลังดูอยู่ → ช่วง [from, until]
//
// ⚠️ เดิมเขียนเป็น dateStr > p.from (ไม่นับวันที่กดตั้ง) โดยคิดว่า
//    "วันนั้นเขาอยู่เว็บนั้นอยู่แล้ว ไม่ต้องบังคับซ้ำ" — ซึ่งผิด
//    เพราะถ้าแอดมินกด "ล้างตาราง" แล้วสุ่มใหม่ในวันเดียวกัน
//    ระบบจะไม่รู้ว่าคนนี้ถูกล็อก แล้วสุ่มเขาไปลงเว็บอื่นทันที
//    การนับวัน from ด้วยไม่มีผลเสีย เพราะถ้าวันนั้นมีตารางอยู่แล้ว
//    ปุ่มสุ่มจะถูกล็อกเป็น "จัดแล้ว" ตั้งแต่แรก
// ⚠️ ตัดสินจาก "ช่วงวันที่" อย่างเดียว ไม่เอา p.shift มากรอง
//
// เดิมกรองด้วย p.shift (กะที่บังเอิญเลือกไว้ตอนกดล็อก) ซึ่งทำให้:
//   1) ป้ายบนการ์ดกับภาพตัวอย่างไม่ตรงกัน เพราะป้ายส่ง shift = null
//      วันที่กดล็อกจึงเห็นครบ แต่วันถัดไปหายไปบางคน
//   2) ถ้าคนนั้นสลับกะ การล็อกจะหลุดทั้งที่ตัวคนยังทำงานอยู่
//
// กะที่ถูกต้องคือ "กะจริงของคนนั้นในวันนั้น" ซึ่งถูกกรองอยู่แล้วที่ต้นทาง:
//   - ตอนสุ่ม: activeStaff กรองด้วย isDutyShiftMatch ไปแล้ว
//   - ภาพตัวอย่าง: เช็ค isDutyShiftMatch ตรงนั้น
// p.shift จึงเหลือไว้เป็นข้อมูลประกอบเท่านั้น
window.getActiveStayPin = function(userId, dateStr) {
    const p = (window.dutyStayPins || {})[String(userId)];
    if (!p || !p.until || !p.from) return null;
    if (dateStr < p.from || dateStr > p.until) return null;
    return p;
};

// ใช้ตอนโชว์ป้ายบนการ์ด — เรียกต่อจากตัวเดียวกัน
// จะได้ไม่มีกติกาสองชุดที่เพี้ยนออกจากกันทีหลัง (เคยพลาดมาแล้ว)
window.getLiveStayPin = function(userId, dateStr) {
    return window.getActiveStayPin(userId, dateStr || window.dutyTodayStr());
};

// ── ป้ายบนการ์ดพนักงาน ────────────────────────────────────────
window.renderStayPinHtml = function(a, team, isAdmin) {
    if (!a || !a.id) return '';

    // ข้อมูลการล็อกเป็นเรื่องของฝ่ายจัดเวรเท่านั้น
    // พนักงานทั่วไปไม่ต้องเห็นทั้งป้ายและปุ่ม แม้แต่ของตัวเอง
    // (เดิมให้เห็นแบบอ่านอย่างเดียว แต่เจ้าของงานขอให้ซ่อน)
    if (!isAdmin) return '';

    const dateEl = document.getElementById('dutyDate');
    const dateStr = dateEl ? dateEl.value : window.dutyTodayStr();
    const pin = window.getLiveStayPin(a.id, dateStr);

    const safeName = String(a.username || '').replace(/'/g, "\\'");

    if (pin) {
        // เหลืออีกกี่วันนับจากวันที่กำลังดู (อย่างน้อย 0)
        const left = Math.max(0, window.dutyDiffDays(dateStr, pin.until));
        const warn = pin.team !== team
            ? `<span class="text-[9px] text-red-600 dark:text-red-400 font-bold ml-1" title="pin ชี้ไปเว็บ ${pin.team}">(≠ ${pin.team})</span>`
            : '';
        return `<div onclick="event.stopPropagation(); openStayPinModal('${team}', '${a.id}', '${safeName}')"
            title="คลิกเพื่อแก้ไข / ยกเลิกการอยู่ต่อ"
            class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-800/50 w-fit shadow-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-800/40 transition">
            <span class="material-icons text-[14px]">push_pin</span>
            อยู่ต่อ ${left > 0 ? `อีก ${left} วัน` : 'วันสุดท้าย'} (ถึง ${window.dutyFmtShortDate(pin.until)})${warn}
            <span class="material-icons text-[11px] opacity-50 ml-0.5">edit</span>
        </div>`;
    }

    return `<div onclick="event.stopPropagation(); openStayPinModal('${team}', '${a.id}', '${safeName}')"
        title="ล็อกให้อยู่เว็บนี้ต่ออีกหลายวัน"
        class="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-0.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 hover:border-amber-400 w-fit transition cursor-pointer">
        <span class="material-icons text-[13px]">push_pin</span> อยู่ต่อ...
    </div>`;
};

// ── ภาพตัวอย่างของวันที่ยังไม่ได้จัดเวร ────────────────────────
// รวมเฉพาะคนที่ถูกล็อกไว้ ให้เห็นชื่อทันทีที่เลื่อนวันที่ ไม่ต้องกดสุ่มก่อน
window.isRosterPreview = false;

window.buildStayPinPreview = function(dateStr, shiftFilter) {
    const roster = {};
    sortedTeams.forEach(t => roster[t] = []);
    let count = 0;

    Object.keys(window.dutyStayPins || {}).forEach(uid => {
        const pin = window.getActiveStayPin(uid, dateStr);
        if (!pin || !pin.team || !sortedTeams.includes(pin.team)) return;

        // วันนั้นลาหยุด → ไม่ต้องโชว์ ให้ตรงกับตอนกดสุ่มจริงที่จะข้ามเขาไป
        if (currentDutyLeaves.has(String(uid))) return;

        const u = (GLOBAL_USER_LIST || []).find(x => String(x.id) === String(uid));
        if (!u) return;

        // ใช้กะจริงของเขาในวันนั้น (รองรับคนสลับกะด้วย) ให้ตรงกับตอนกดสุ่มจริง
        if (!window.isDutyShiftMatch(u, shiftFilter)) return;

        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL';
        if (uDept !== currentDutyDept) return;

        roster[pin.team].push({ ...u, secondary_team: null, stay_pinned: true });
        count++;
    });

    return { roster, count };
};

// ตัวกันพลาด — ระหว่างอยู่ในโหมดตัวอย่าง ห้ามทำอะไรที่เขียนตารางลง DB
// ไม่งั้นจะได้ตารางที่มีแต่คนถูกล็อก แล้วปุ่มสุ่มจะถูกล็อกเป็น "จัดแล้ว" ทันที
window.blockIfPreview = function() {
    if (!window.isRosterPreview) return false;
    Swal.fire({
        icon: 'info',
        title: 'ยังไม่ได้จัดเวรวันนี้',
        html: `<div style="font-size:13px;color:#94a3b8;line-height:1.7">
                 ที่เห็นอยู่เป็น <b style="color:#fbbf24">ภาพตัวอย่าง</b> จากคนที่ถูกล็อก "อยู่ต่อ" เท่านั้น<br>
                 กรุณากด <b style="color:#818cf8">"สุ่มจัดหน้าที่"</b> เพื่อจัดคนที่เหลือให้ครบก่อนครับ
               </div>`,
        background: '#0b1120',
        confirmButtonText: 'เข้าใจแล้ว',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-3xl border border-slate-700 dark:text-white' }
    });
    return true;
};

// ── กล่องตั้งค่า "อยู่ต่อกี่วัน" ───────────────────────────────
window.openStayPinModal = async function(team, userId, username) {
    if (!window.canManageStayPin()) return;

    const dateStr = document.getElementById('dutyDate').value;
    const shift   = document.getElementById('dutyShiftSelect').value;
    if (!dateStr) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const existing = window.getLiveStayPin(userId, dateStr);

    // นับ "อีกกี่วัน" จากวันที่กำลังดูอยู่เสมอ ให้ตรงกับข้อความบนหัวกล่อง
    //
    // เดิมผมยึด existing.from เป็นจุดตั้งต้น ซึ่งทำให้สับสน:
    // ล็อกวันที่ 7 ไว้ 3 วัน (ถึงวันที่ 10) พอมาเปิดกล่องตอนวันที่ 9
    // แล้วเลือก "3 วัน" กลับได้ถึงแค่วันที่ 10 (เหลือวันเดียว) ไม่ใช่วันที่ 12
    //
    // ยึดวันที่กำลังดูแทน แล้วตั้งค่าเริ่มต้นเป็น "จำนวนวันที่เหลือ"
    // กดเปิดแล้วกดตกลงเฉยๆ วันสิ้นสุดจึงไม่ขยับ (ไม่เลื่อนออกไปเรื่อยๆ)
    const baseDate = dateStr;
    const defaultDays = existing ? Math.max(1, window.dutyDiffDays(dateStr, existing.until)) : 3;

    // ย้ายเว็บ: เปิดกล่องจากการ์ดที่อยู่คนละเว็บกับที่ล็อกไว้เดิม
    // เกิดตอนแอดมินลากคนไปเว็บอื่นแล้วกดปุ่มอยู่ต่อ — ต้องล็อกไปที่เว็บใหม่
    const movingFrom = (existing && existing.team !== team) ? existing.team : null;

    const chip = (n) => `<button type="button" data-days="${n}"
        class="stay-day-chip px-3 py-2 rounded-lg border-2 font-black text-sm transition"
        style="min-width:44px">${n}</button>`;

    const { value: result } = await Swal.fire({
        title: `<div class="text-base font-black">📌 ให้อยู่เว็บ <span style="color:#6366f1">${team}</span> ต่ออีกกี่วัน?</div>`,
        html: `
            <div style="text-align:left">
                <div style="font-size:12px;color:#94a3b8;margin-bottom:14px">
                    พนักงาน: <b style="color:#e2e8f0;font-size:14px">${username}</b>
                    &nbsp;•&nbsp; กะ: <b style="color:#e2e8f0">${shift}</b>
                </div>

                ${movingFrom ? `<div style="background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.35);border-radius:10px;padding:8px 11px;font-size:11.5px;color:#7dd3fc;margin-bottom:14px;line-height:1.6">
                    🔀 เดิมล็อกไว้ที่เว็บ <b>${movingFrom}</b> — กดยืนยันแล้วจะย้ายมาล็อกที่ <b>${team}</b> แทน
                </div>` : ''}

                <div style="font-size:11px;font-weight:800;color:#64748b;letter-spacing:.5px;margin-bottom:6px">เลือกจำนวนวัน</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
                    ${[1,2,3,4,5,7,14].map(chip).join('')}
                </div>

                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                    <span style="font-size:11px;font-weight:800;color:#64748b">หรือพิมพ์เอง</span>
                    <input id="stayDaysInput" type="number" min="1" max="60" value="${defaultDays}"
                        style="width:80px;padding:8px 10px;border-radius:10px;border:1.5px solid #334155;background:#0f172a;color:#f1f5f9;font-weight:800;text-align:center;outline:none">
                    <span style="font-size:12px;color:#94a3b8">วัน</span>
                </div>

                <div id="stayPreview" style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.35);border-radius:12px;padding:10px 12px;font-size:12px;color:#c7d2fe;line-height:1.7"></div>

                <div style="margin-top:10px;font-size:10.5px;color:#64748b;line-height:1.6">
                    ℹ️ ระบบจะจัด <b>${username}</b> ลงเว็บ <b>${team}</b> ให้อัตโนมัติทุกครั้งที่กด "สุ่มจัดหน้าที่" ในช่วงวันดังกล่าว
                    (ข้ามกฎห้ามซ้ำเว็บเดิม) — ถ้าวันไหนติดลาหยุด ระบบจะข้ามวันนั้นให้เอง
                </div>
            </div>
        `,
        background: '#0b1120',
        showCancelButton: true,
        showDenyButton: !!existing,
        confirmButtonText: existing ? 'อัปเดต' : 'ยืนยัน',
        denyButtonText: 'ยกเลิกการอยู่ต่อ',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#6366f1',
        denyButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        customClass: { popup: 'rounded-3xl border border-slate-700 dark:text-white' },
        didOpen: () => {
            const input   = document.getElementById('stayDaysInput');
            const preview = document.getElementById('stayPreview');
            const chips   = Array.from(document.querySelectorAll('.stay-day-chip'));

            const paint = () => {
                const n = parseInt(input.value) || 0;
                chips.forEach(c => {
                    const on = parseInt(c.dataset.days) === n;
                    c.style.borderColor = on ? '#6366f1' : '#334155';
                    c.style.background  = on ? 'rgba(99,102,241,.2)' : '#0f172a';
                    c.style.color       = on ? '#c7d2fe' : '#94a3b8';
                });
                if (n < 1) { preview.innerHTML = '<span style="color:#f87171">กรุณาใส่จำนวนวันอย่างน้อย 1 วัน</span>'; return; }
                const until = window.dutyAddDays(baseDate, n);
                const start = window.dutyAddDays(baseDate, 1);
                preview.innerHTML = `📅 อยู่เว็บ <b>${team}</b> ตั้งแต่ <b>${window.dutyFmtShortDate(start)}</b>`
                    + ` ถึง <b>${window.dutyFmtShortDate(until)}</b> รวม <b>${n} วัน</b>`;
            };

            chips.forEach(c => c.addEventListener('click', () => { input.value = c.dataset.days; paint(); }));
            input.addEventListener('input', paint);
            paint();
        },
        preConfirm: () => {
            const n = parseInt(document.getElementById('stayDaysInput').value) || 0;
            if (n < 1)  { Swal.showValidationMessage('ใส่จำนวนวันอย่างน้อย 1 วันครับ'); return false; }
            if (n > 60) { Swal.showValidationMessage('เกิน 60 วันไม่ได้ครับ'); return false; }
            return { days: n };
        }
    });

    // กด "ยกเลิกการอยู่ต่อ"
    if (result === false) return window.removeStayPin(userId, username);
    if (!result || !result.days) return;

    const until = window.dutyAddDays(baseDate, result.days);

    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        window.dutyStayPins[String(userId)] = {
            username: username,
            team:     team,
            shift:    shift,
            from:     baseDate,
            until:    until,
            days:     result.days,
            by:       currentUser.username
        };
        await window.saveStayPins();

        await appDB.from('system_logs').insert([{
            action_type: 'ล็อกอยู่ต่อ',
            performed_by: currentUser.username,
            target_details: `ล็อก ${username} ให้อยู่เว็บ [${team}] ต่ออีก ${result.days} วัน `
                + `(${window.dutyAddDays(baseDate, 1)} ถึง ${until}, แผนก ${currentDutyDept}, กะ ${shift})`
                + (movingFrom ? ` — ย้ายมาจากเว็บ [${movingFrom}]` : '')
        }]);

        window.debouncedBroadcast('duty-updates', 'force_reload');
        window.renderRosterGrid(currentRosterData);
        window.updateStayPinButton();

        Swal.fire({
            icon: 'success',
            title: movingFrom ? 'ย้ายการล็อกเรียบร้อย!' : 'ล็อกเรียบร้อย!',
            html: (movingFrom ? `ย้ายจากเว็บ <b>${movingFrom}</b> → <b>${team}</b><br>` : '')
                + `<b>${username}</b> จะอยู่เว็บ <b>${team}</b> ถึงวันที่ <b>${window.dutyFmtShortDate(until)}</b>`,
            timer: 2600, showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.removeStayPin = async function(userId, username) {
    if (!window.canManageStayPin()) return;
    const pin = (window.dutyStayPins || {})[String(userId)];
    if (!pin) return;

    const ok = await Swal.fire({
        icon: 'warning',
        title: 'ยกเลิกการอยู่ต่อ?',
        html: `<b>${username || pin.username}</b> จะกลับไปหมุนเว็บตามปกติ`,
        showCancelButton: true,
        confirmButtonText: 'ยกเลิกการล็อก',
        cancelButtonText: 'ไม่',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    if (!ok.isConfirmed) return;

    try {
        delete window.dutyStayPins[String(userId)];
        await window.saveStayPins();

        await appDB.from('system_logs').insert([{
            action_type: 'ล็อกอยู่ต่อ',
            performed_by: currentUser.username,
            target_details: `ยกเลิกล็อก ${username || pin.username} (เดิมอยู่เว็บ [${pin.team}] ถึง ${pin.until}, แผนก ${currentDutyDept})`
        }]);

        window.debouncedBroadcast('duty-updates', 'force_reload');
        window.renderRosterGrid(currentRosterData);
        window.updateStayPinButton();
        Swal.fire({ icon: 'success', title: 'ยกเลิกแล้ว', timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ── ปุ่ม + รายการรวมคนที่ถูกล็อก ──────────────────────────────
window.updateStayPinButton = function() {
    const btn = document.getElementById('btnStayPinList');
    if (!btn) return;

    // ปุ่มนี้คุมด้วยสิทธิ์ duty_stay_pin ของตัวเอง ไม่ได้ผูกกับ duty-admin-only
    // จึงต้องสั่งซ่อน/โชว์เองตรงนี้ (applyDutyRoleUI จะไม่ยุ่งกับมัน)
    if (!window.canManageStayPin()) { btn.style.display = 'none'; return; }
    btn.style.display = 'flex';

    const today = window.dutyTodayStr();
    const n = Object.values(window.dutyStayPins || {}).filter(p => p && p.until >= today).length;
    const badge = document.getElementById('stayPinCount');
    if (badge) badge.innerText = n;
    if (n > 0) btn.classList.remove('opacity-60');
    else btn.classList.add('opacity-60');
};

// ============================================================