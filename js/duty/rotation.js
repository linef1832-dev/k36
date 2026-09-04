// ════════════════════════════════════════════════════════════════════
// 📦 duty/rotation.js — ส่วนที่ 6/6 ของหน้าจัดหน้าที่/เวร (แยกจาก duty.js เดิม 5,478 บรรทัด)
// เนื้อหา: ระบบหมุนเวียนเว็บ (วนครบก่อนซ้ำ) + แพตช์ชื่อเต็ม/toast ท้ายไฟล์
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): duty/core → duty/dragdrop → duty/roles → duty/tools → duty/support → duty/rotation
// ตัวแปร top-level (currentDutyDept, sortedTeams ฯลฯ) แชร์ข้ามไฟล์กันอัตโนมัติ — scope เดียวกัน
// ════════════════════════════════════════════════════════════════════
// 🔄 ระบบหมุนเวียนเว็บ — ให้แต่ละคนวนครบทุกเว็บก่อนกลับมาซ้ำ
// ============================================================
// ของเดิมดูแค่ "เมื่อวานอยู่เว็บไหน" ซึ่งกันได้แค่ซ้ำติดกัน
// คนจึงเด้ง A→B→A→B ได้ตลอดโดยไม่เคยไปเว็บ C D E เลย
//
// ตัวนี้อ่านตารางย้อนหลังหลายวัน แล้วเลือกจาก "ห่างจากเว็บนี้นานสุด"
// (แนวคิดเดียวกับ LRU) คนที่ไม่เคยทำเว็บนั้นเลยจะถูกหยิบก่อนเสมอ
// ผลคือทุกคนไล่ครบทุกเว็บที่ตัวเองมีสิทธิ์ ก่อนจะวนกลับมาเว็บแรก
// ============================================================

// อ่านตารางย้อนหลังมาสรุปว่า "ใครเคยอยู่เว็บไหน เมื่อกี่วันก่อน"
window.loadDutyRotationHistory = async function(targetDate, shiftFilter, lookbackDays) {
    // ย้อนให้ยาวกว่าจำนวนเว็บนิดหน่อย จะได้เห็นครบ 1 รอบเต็มของทุกคน
    const lookback = lookbackDays || Math.min(30, Math.max(10, sortedTeams.length + 4));

    const keys = [];
    const agoOfKey = {};
    for (let i = 1; i <= lookback; i++) {
        const d = window.dutyAddDays(targetDate, -i);
        const k = `duty_roster_${currentDutyDept}_${d}_${shiftFilter}`;
        keys.push(k);
        agoOfKey[k] = i;                 // i = ย้อนหลังกี่วัน (1 = เมื่อวาน)
    }

    const lastSeen = {};   // uid -> { team: ทำล่าสุดเมื่อกี่วันก่อน } (งานหลัก)
    const counts   = {};   // uid -> { team: ทำไปกี่ครั้งในช่วงนี้ }
    const lastTeam = {};   // uid -> { team, ago } ของวันล่าสุดที่มีตาราง
    const lastSec  = {};   // uid -> { team: เคยเป็น "งานรอง" ล่าสุดเมื่อกี่วันก่อน }
    const lastSecTeam = {};// uid -> { team, ago } งานรองของวันล่าสุดที่มีตาราง
    let daysFound = 0;

    try {
        const { data } = await appDB.from('settings').select('key, value').in('key', keys);
        (data || []).forEach(row => {
            if (!row.value) return;
            let roster;
            try { roster = JSON.parse(row.value); } catch (e) { return; }
            const ago = agoOfKey[row.key];
            daysFound++;

            Object.entries(roster).forEach(([team, list]) => {
                (list || []).forEach(u => {
                    if (!u || !u.id) return;
                    if (String(u.username || '').includes('ขาดคน')) return;
                    const uid = String(u.id);

                    lastSeen[uid] = lastSeen[uid] || {};
                    counts[uid]   = counts[uid]   || {};

                    // เก็บ "ครั้งล่าสุด" = ค่า ago ที่น้อยที่สุด
                    if (lastSeen[uid][team] === undefined || ago < lastSeen[uid][team]) {
                        lastSeen[uid][team] = ago;
                    }
                    counts[uid][team] = (counts[uid][team] || 0) + 1;

                    // วันล่าสุดที่เขามีตาราง — ใช้แทน "เมื่อวาน" แบบเดิม
                    // ดีกว่าตรงที่ถ้าเว้นวัน (ไม่ได้จัดเวร/ลาหยุด) ก็ยังหาเจอ
                    if (lastTeam[uid] === undefined || ago < lastTeam[uid].ago) {
                        lastTeam[uid] = { team, ago };
                    }

                    // 🆕 เก็บประวัติ "งานรอง" (สแตนด์บายช่วย) ด้วย
                    // เพื่อไม่ให้วันถัดไปได้งานรอง (หรืองานหลัก) ซ้ำเว็บเดิม
                    const st = u.secondary_team;
                    if (st) {
                        lastSec[uid] = lastSec[uid] || {};
                        if (lastSec[uid][st] === undefined || ago < lastSec[uid][st]) {
                            lastSec[uid][st] = ago;
                        }
                        if (lastSecTeam[uid] === undefined || ago < lastSecTeam[uid].ago) {
                            lastSecTeam[uid] = { team: st, ago };
                        }
                    }
                });
            });
        });
    } catch (e) {
        console.warn('[rotation] โหลดประวัติไม่สำเร็จ ใช้การสุ่มแบบไม่มีประวัติแทน', e);
    }

    return { lastSeen, counts, lastTeam, lastSec, lastSecTeam, daysFound, lookback };
};

// 🆕 เว็บนี้ "เพิ่งเป็นงานรองไปเมื่อกี่วันก่อน"
window.dutyDaysAgoOnSecTeam = function(rotation, uid, team) {
    const m = rotation && rotation.lastSec ? rotation.lastSec[String(uid)] : null;
    if (!m || m[team] === undefined) return Infinity;
    return m[team];
};

// 🆕 เมื่อวาน (วันล่าสุดที่มีตาราง) คนนี้แตะเว็บนี้ไหม — นับทั้งงานหลักและงานรอง
window.dutyTouchedTeamYesterday = function(rotation, uid, team) {
    if (!rotation || !team) return false;
    const u = String(uid);
    const lt = rotation.lastTeam && rotation.lastTeam[u];
    const ls = rotation.lastSecTeam && rotation.lastSecTeam[u];
    if (lt && lt.ago === 1 && lt.team === team) return true;   // เมื่อวานเป็นงานหลักเว็บนี้
    if (ls && ls.ago === 1 && ls.team === team) return true;   // เมื่อวานเป็นงานรองเว็บนี้
    return false;
};

// เว็บนี้ "เพิ่งทำไปเมื่อกี่วันก่อน" — ไม่เคยทำเลยคืน Infinity (ดีที่สุด ควรได้ก่อน)
window.dutyDaysAgoOnTeam = function(rotation, uid, team) {
    const m = rotation && rotation.lastSeen ? rotation.lastSeen[String(uid)] : null;
    if (!m || m[team] === undefined) return Infinity;
    return m[team];
};

// คะแนนความ "ไม่ควร" ของการเอาคนนี้ลงเว็บนี้ — ยิ่งมากยิ่งแย่
window.dutyRotationPenalty = function(rotation, uid, team) {
    const ago = window.dutyDaysAgoOnTeam(rotation, uid, team);
    if (ago === 1) return 3;                                        // ซ้ำกับวันล่าสุด — แย่สุด
    const cycleLen = (dutyAccessMatrix[String(uid)] || []).length;
    if (ago >= cycleLen) return 0;                                  // วนครบรอบแล้ว — ดี
    return 1;                                                       // ซ้ำก่อนครบรอบ — พอรับได้
};

// 🔧 รอบซ่อมท้าย — สลับคู่ที่สลับแล้วดีขึ้นทั้งคู่
// ลูปสุ่มเป็น greedy ทีละเว็บ พอถึงเว็บท้ายๆ คนในกองมักเหลือแต่ตัวเลือกแย่
// การไล่สลับคู่หลังจัดเสร็จช่วยเก็บกวาดเคสซ้ำติดกันที่หลุดมาได้เกือบหมด
// (วัดจากการจำลอง 30 วัน: ซ้ำติดกัน 22 ครั้ง → เหลือ 0-2 ครั้ง)
window.repairRosterRotation = function(rosterResult, rotation, lockedIds) {
    const slots = [];
    Object.entries(rosterResult).forEach(([team, list]) => {
        (list || []).forEach((u, idx) => {
            if (!u || !u.id) return;
            if (lockedIds && lockedIds.has(String(u.id))) return;   // คนที่ถูกล็อก "อยู่ต่อ" ห้ามสลับ
            slots.push({ u, team, idx });
        });
    });

    let swaps = 0;
    for (let pass = 0; pass < 3; pass++) {
        let changed = false;
        for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
                const A = slots[i], B = slots[j];
                if (A.team === B.team) continue;

                const accA = dutyAccessMatrix[String(A.u.id)] || [];
                const accB = dutyAccessMatrix[String(B.u.id)] || [];
                if (!accA.includes(B.team) || !accB.includes(A.team)) continue;

                const before = window.dutyRotationPenalty(rotation, A.u.id, A.team)
                             + window.dutyRotationPenalty(rotation, B.u.id, B.team);
                const after  = window.dutyRotationPenalty(rotation, A.u.id, B.team)
                             + window.dutyRotationPenalty(rotation, B.u.id, A.team);
                if (after >= before) continue;

                // ช่อง (team, idx) อยู่ที่เดิม เปลี่ยนแค่ "คน" ที่นั่งอยู่ในช่องนั้น
                // จึงสลับเฉพาะ .u — ถ้าสลับ .team ด้วยจะหักล้างกันเองแล้วข้อมูลเพี้ยน
                rosterResult[A.team][A.idx] = B.u;
                rosterResult[B.team][B.idx] = A.u;
                const tmp = A.u; A.u = B.u; B.u = tmp;
                swaps++; changed = true;
            }
        }
        if (!changed) break;
    }
    return swaps;
};

window.openStayPinListModal = async function() {
    const today = window.dutyTodayStr();
    const shift = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : '';
    const rows = Object.entries(window.dutyStayPins || {})
        .filter(([, p]) => p && p.until >= today)
        .sort((a, b) => a[1].until.localeCompare(b[1].until));

    if (rows.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'ยังไม่มีใครถูกล็อก',
            html: `<div style="font-size:13px;color:#94a3b8">กดปุ่ม <b>📌 อยู่ต่อ...</b> บนการ์ดพนักงานในตาราง เพื่อล็อกให้เขาอยู่เว็บเดิมข้ามวัน</div>`,
            background: '#0b1120',
            confirmButtonColor: '#6366f1',
            customClass: { popup: 'rounded-3xl border border-slate-700 dark:text-white' }
        });
    }

    const isAdmin = window.canManageStayPin();
    const body = rows.map(([uid, p]) => {
        const left  = Math.max(0, window.dutyDiffDays(today, p.until));
        // ไม่ทำให้จางตามกะที่บันทึกไว้แล้ว — กะที่ใช้จริงคือกะของคนนั้นในวันนั้น
        // ทำจางตาม p.shift เคยทำให้เข้าใจผิดว่ารายการนั้นใช้ไม่ได้
        const dim   = '';
        const safe  = String(p.username || '').replace(/'/g, "\\'");
        // วันที่กำลังดูอยู่ เขาลาหยุดไหม — ถ้าลา ระบบจะข้ามเขาแล้วดึงคนอื่นมาแทน
        // โชว์ไว้ให้แอดมินเห็นตั้งแต่ยังไม่กดสุ่ม จะได้ไม่งงว่าทำไมชื่อไม่ขึ้น
        const onLeave = currentDutyLeaves && currentDutyLeaves.has(String(uid));
        const leaveTag = onLeave
            ? `<span style="font-size:9px;font-weight:900;background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.35);padding:2px 6px;border-radius:999px;white-space:nowrap;margin-left:6px">ลาหยุดวันนี้</span>`
            : '';
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#0f172a;border:1px solid #1e293b;margin-bottom:8px;${dim}">
            <span class="material-icons" style="font-size:16px;color:#fbbf24">push_pin</span>
            <div style="flex:1;min-width:0;text-align:left">
                <div style="font-weight:800;font-size:13px;color:#f1f5f9;display:flex;align-items:center;flex-wrap:wrap">${p.username}${leaveTag}</div>
                <div style="font-size:10.5px;color:#64748b;margin-top:2px">
                    เว็บ <b style="color:#a5b4fc">${p.team}</b> • ${p.shift || '-'} • ถึง ${window.dutyFmtShortDate(p.until)}
                    ${p.by ? ` • ตั้งโดย ${p.by}` : ''}
                </div>
                ${onLeave ? `<div style="font-size:10px;color:#f87171;margin-top:3px">↳ วันนี้ระบบจะข้ามเขา แล้วดึงคนอื่นมาลง ${p.team} แทน — การล็อกยังอยู่ ใช้ต่อวันถัดไป</div>` : ''}
            </div>
            <span style="font-size:10px;font-weight:900;background:${left > 0 ? 'rgba(251,191,36,.15)' : 'rgba(148,163,184,.15)'};color:${left > 0 ? '#fbbf24' : '#94a3b8'};border:1px solid ${left > 0 ? 'rgba(251,191,36,.35)' : 'rgba(148,163,184,.3)'};padding:3px 8px;border-radius:999px;white-space:nowrap">
                ${left > 0 ? `เหลือ ${left} วัน` : 'วันสุดท้าย'}
            </span>
            ${isAdmin ? `<button onclick="removeStayPin('${uid}', '${safe}')" title="ยกเลิก"
                style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#f87171;border-radius:9px;padding:5px 7px;cursor:pointer;display:flex;align-items:center">
                <span class="material-icons" style="font-size:15px">delete</span></button>` : ''}
        </div>`;
    }).join('');

    Swal.fire({
        title: `<div style="font-size:16px;font-weight:900">📌 คนที่ถูกล็อกอยู่ต่อ (${rows.length})</div>`,
        html: `<div style="max-height:55vh;overflow-y:auto;padding-right:4px">${body}</div>
               <div style="font-size:10.5px;color:#64748b;margin-top:6px;text-align:left">กะที่แสดงคือกะตอนกดล็อก • เวลาจัดจริงระบบยึดกะของคนนั้นในวันนั้น • หมดอายุแล้วลบให้เอง</div>`,
        background: '#0b1120',
        width: 560,
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'rounded-3xl border border-slate-700 dark:text-white' }
    });
};
// ============================================================
// 🩹 แพตช์ระบบจัดหน้าที่ — วางต่อท้าย duty.js (บรรทัดล่างสุด) แล้วเซฟ
//   1) ชื่อพนักงานในการ์ดโชว์เต็ม ไม่โดนตัด (…)  — ทำผ่าน CSS
//   2) เพิ่ม/ลดคนต่อเว็บ → เด้ง toast บอกว่าดึง/คืนคนจากเว็บไหน — override manualAdjustReq
// * ใช้ตัวแปร sortedTeams / currentDutyDept ได้ปกติ — ทุกไฟล์ duty/* โหลดเป็น scope เดียวกัน (ต้องโหลดหลัง core เสมอ)
// ============================================================
(function () {
    // ── แพตช์ 1: ชื่อเต็ม ไม่โดนตัด + ให้ป้าย (เมื่อวานทำ/รองเมื่อวาน) ตกบรรทัดแทนที่จะบีบชื่อ ──
    try {
        if (!document.getElementById('dutyNameFixStyle')) {
            const st = document.createElement('style');
            st.id = 'dutyNameFixStyle';
            st.textContent =
                '.duty-user-card span.truncate.tracking-wide{white-space:normal !important;overflow:visible !important;text-overflow:clip !important;}' +
                '.duty-user-card .flex.items-center.gap-2\\.5{flex-wrap:wrap;}';
            document.head.appendChild(st);
        }
    } catch (e) { console.warn('[dutyPatch] name-fix css failed', e); }
})();

// ── แพตช์ 2: ปรับยอดคนต่อเว็บ แล้วบอกว่าระบบดึง/คืนคนจากเว็บไหน ──
window.manualAdjustReq = function (changedTeam) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const activeStaff = window.getDutyActiveStaff(shiftFilter);
    const availableCount = activeStaff.length;
    if (availableCount === 0) return;

    let reqs = {};
    let totalReq = 0;
    sortedTeams.forEach(team => {
        const val = parseInt(document.getElementById(`req_${team}`).value) || 0;
        reqs[team] = val;
        totalReq += val;
    });

    // 📊 จำค่าก่อนปรับ ไว้เทียบว่าระบบดึง/คืนคนจากเว็บไหน
    const beforeReqs = { ...reqs };

    const changedInput = document.getElementById(`req_${changedTeam}`);
    let changedVal = parseInt(changedInput.value) || 0;

    if (changedVal < 0) {
        changedVal = 0;
        reqs[changedTeam] = 0;
        totalReq = Object.values(reqs).reduce((a, b) => a + b, 0);
    }

    let diff = totalReq - availableCount;
    if (diff === 0) { window.updateDutyStats(); return; }

    let safeLoopLimit = 1000;
    while (diff > 0 && safeLoopLimit-- > 0) {
        let maxTeam = null; let maxVal = -1;
        sortedTeams.forEach(t => {
            if (t !== changedTeam && reqs[t] > maxVal && reqs[t] > 0) { maxVal = reqs[t]; maxTeam = t; }
        });
        if (maxTeam) { reqs[maxTeam]--; diff--; } else { reqs[changedTeam]--; diff--; }
    }
    while (diff < 0 && safeLoopLimit-- > 0) {
        let minTeam = null; let minVal = Infinity;
        sortedTeams.forEach(t => {
            if (t !== changedTeam && reqs[t] < minVal) { minVal = reqs[t]; minTeam = t; }
        });
        if (minTeam) { reqs[minTeam]++; diff++; } else { reqs[changedTeam]++; diff++; }
    }

    const reqsToSave = {};
    sortedTeams.forEach(team => {
        const input = document.getElementById(`req_${team}`);
        if (input) input.value = reqs[team];
        reqsToSave[`req_${team}`] = reqs[team];
    });

    window.safeSetItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));
    window.updateDutyStats();

    // 🔔 แจ้งว่าระบบไปดึง/คืนคนจากเว็บไหนให้อัตโนมัติ
    if (typeof window.dutyReqAdjustToast === 'function') window.dutyReqAdjustToast(changedTeam, beforeReqs, reqs);
};

// 🔔 Toast บอกการปรับยอดคนอัตโนมัติ (เว็บอื่นที่ยอดเปลี่ยนไปเพราะเว็บที่เราแก้)
window.dutyReqAdjustToast = function (changedTeam, before, after) {
    const ups = [], downs = [];
    sortedTeams.forEach(t => {
        if (t === changedTeam) return;
        const d = (after[t] || 0) - (before[t] || 0);
        if (d > 0) ups.push(`${t} +${d}`);
        else if (d < 0) downs.push(`${t} ${d}`);   // d ติดลบอยู่แล้ว
    });
    if (ups.length === 0 && downs.length === 0) return;

    let html = `<div style="text-align:left;font-size:12.5px;line-height:1.9;color:#e2e8f0">`;
    if (downs.length) html += `🔻 <b>ดึงคนออกจาก:</b> <span style="color:#f87171;font-weight:800">${downs.join(' · ')}</span><br>`;
    if (ups.length)   html += `🔺 <b>คืนคนให้:</b> <span style="color:#34d399;font-weight:800">${ups.join(' · ')}</span>`;
    html += `</div>`;

    Swal.fire({
        toast: true, position: 'top-end', icon: 'info',
        title: `<span style="font-size:12.5px;font-weight:900">⚖️ ปรับยอดคนให้พอดี (แก้ ${changedTeam})</span>`,
        html: html, showConfirmButton: false, timer: 4500, timerProgressBar: true,
        background: '#0b1120', customClass: { popup: 'rounded-2xl border border-slate-700' }
    });
};
