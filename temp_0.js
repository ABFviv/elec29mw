
    // ================================================================
    //  State
    // ================================================================
    let currentUser = null;
    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth() + 1; // 1-indexed
    let calViewYear = viewYear;
    let calViewMonth = viewMonth;
    let currentSchedule = null;

    const SHIFT_COLORS = ['#00d4ff', '#f0a500', '#a78bfa'];
    const SHIFT_LABELS = ['Shift 1  07:30 – 15:30', 'Shift 2  15:30 – 23:30', 'Shift 3  23:30 – 07:30'];
    const SHIFT_SHORT = ['07:30–15:30', '15:30–23:30', '23:30–07:30'];
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // ================================================================
    //  Boot
    // ================================================================
    document.addEventListener('DOMContentLoaded', () => {
      const session = DB.Session.require();
      if (!session) return;
      currentUser = session.user;
      renderTopbar('Daily Check');

      // Show admin button for admin and supervisor
      if (['System Administrator', 'Electrical Supervisor'].includes(currentUser.role)) {
        document.getElementById('adminBtn').style.display = '';
      }

      loadOrPrompt();
      populateGenDropdowns();
    });

    // ================================================================
    //  Load / Prompt
    // ================================================================
    function loadOrPrompt() {
      currentSchedule = DB.MonthlySchedule.load(viewYear, viewMonth);
      renderStatsRow();
      renderToday();
      renderCalendar();
      renderCoverage();
    }

    // ================================================================
    //  STATS ROW
    // ================================================================
    function renderStatsRow() {
      const stats = DB.MonthlySchedule.getStats(viewYear, viewMonth);
      const el = document.getElementById('statsRow');
      if (!stats.exists) {
        el.innerHTML = `
      <div class="stat-mini"><div class="stat-mini-val" style="color:var(--text-muted);">—</div><div class="stat-mini-lbl">Schedule Status</div></div>`;
        return;
      }
      const pct = Math.round((stats.done / stats.total) * 100);
      el.innerHTML = `
    <div class="stat-mini"><div class="stat-mini-val" style="color:#00e676;">${stats.done}</div><div class="stat-mini-lbl">Completed Checks</div></div>
    <div class="stat-mini"><div class="stat-mini-val" style="color:#f0a500;">${stats.skipped}</div><div class="stat-mini-lbl">Skipped</div></div>
    <div class="stat-mini"><div class="stat-mini-val" style="color:#38bdf8;">${stats.pending}</div><div class="stat-mini-lbl">Pending</div></div>
    <div class="stat-mini"><div class="stat-mini-val" style="color:var(--text-primary);">${pct}%</div><div class="stat-mini-lbl">Monthly Progress</div></div>
    <div class="stat-mini"><div class="stat-mini-val" style="color:#00d4ff;">${stats.todayDone}/6</div><div class="stat-mini-lbl">Today Done</div></div>`;
    }

    // ================================================================
    //  TAB SWITCH
    // ================================================================
    function switchTab(tab) {
      ['today', 'month', 'coverage'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
        document.getElementById(`panel-${t}`).classList.toggle('active', t === tab);
      });
      if (tab === 'month') renderCalendar();
      if (tab === 'coverage') renderCoverage();
    }

    // ================================================================
    //  TODAY'S SHIFTS (2 checks per shift = 6 checks / 24h)
    // ================================================================
    function renderToday() {
    let selectedDailyDateStr = null;

    function navigateDailyDate(offsetDays) {
      const base = selectedDailyDateStr ? new Date(selectedDailyDateStr + 'T12:00:00') : new Date();
      base.setDate(base.getDate() + offsetDays);
      selectedDailyDateStr = base.toISOString().split('T')[0];
      renderToday(selectedDailyDateStr);
    }

    function resetDailyDateToday() {
      selectedDailyDateStr = new Date().toISOString().split('T')[0];
      renderToday(selectedDailyDateStr);
    }

    // ================================================================
    //  TODAY'S SHIFTS (2 checks per shift = 6 checks / 24h)
    // ================================================================
    function renderToday(targetDateStr) {
      const el = document.getElementById('todayContent');
      const realTodayStr = new Date().toISOString().split('T')[0];
      const todayStr = targetDateStr || selectedDailyDateStr || realTodayStr;
      selectedDailyDateStr = todayStr;

      const [targetYear, targetMonth] = todayStr.split('-').map(Number);
      // Ensure schedule for this date's month is loaded
      let sched = currentSchedule;
      if (!sched || sched.year !== targetYear || sched.month !== targetMonth) {
        sched = DB.MonthlySchedule.load(targetYear, targetMonth);
      }

      if (!sched) {
        el.innerHTML = buildNoScheduleCard(targetYear, targetMonth);
        return;
      }

      const day = sched.days.find(d => d.date === todayStr);

      if (!day) {
        el.innerHTML = `<div class="no-schedule">
          <div class="no-schedule-icon">📅</div>
          <h3>No entry for date: ${todayStr}</h3>
          <p>This date is outside the loaded schedule. Try generating the schedule for ${targetYear}-${targetMonth}.</p>
        </div>`;
        return;
      }

      const now = new Date();
      const isRealToday = todayStr === realTodayStr;
      const h = now.getHours() + now.getMinutes() / 60;
      // Current shift based on time: Shift 1 (07:30–15:30), Shift 2 (15:30–23:30), Shift 3 (23:30–07:30)
      const activeShift = isRealToday ? (h >= 7.5 && h < 15.5 ? 1 : h >= 15.5 && h < 23.5 ? 2 : 3) : null;

      const dateObj = new Date(todayStr + 'T12:00:00');
      const dateLabel = dateObj.toLocaleDateString('en-GB',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      let daySched = null;
      if (typeof Schedule !== 'undefined') {
        daySched = Schedule.getDaySchedule(dateObj);
      }

      const SHIFT_ICONS = ['🌅 Morning', '☀️ Afternoon', '🌙 Night'];
      const SHIFT_ASSIGNED = [daySched?.morning, daySched?.afternoon, daySched?.night];

      // Identify if current logged-in user is assigned to one of the 3 shifts today
      const userName = currentUser?.name || '';
      let myShiftIndex = -1;
      if (userName && daySched) {
        myShiftIndex = SHIFT_ASSIGNED.findIndex(w => w && w.toLowerCase() === userName.toLowerCase());
      }

      const isFixedWorker = typeof Schedule !== 'undefined' && Schedule.FIXED_WORKERS &&
        Schedule.FIXED_WORKERS.some(w => w.name.toLowerCase() === userName.toLowerCase());

      // Personal Welcome & Shift Alert Banner
      let bannerHtml = '';
      if (myShiftIndex !== -1) {
        const glowColor = SHIFT_COLORS[myShiftIndex];
        bannerHtml = `
        <div class="user-shift-banner active-shift">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:${glowColor}25;border:1px solid ${glowColor}66;display:flex;align-items:center;justify-content:center;font-size:20px;">
              ⭐
            </div>
            <div>
              <div style="font-weight:700;font-size:14.5px;color:#fff;">
                ${esc(userName)} — Your Assigned Shift: <span style="color:${glowColor};">${SHIFT_ICONS[myShiftIndex]} (${SHIFT_SHORT[myShiftIndex]})</span>
              </div>
              <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">
                Your inspections (Checks 1 & 2) are highlighted below. Complete your checks during your shift.
              </div>
            </div>
          </div>
          <button type="button" class="btn-done" style="flex:0 0 auto;padding:7px 16px;font-size:12px;border-radius:100px;"
            onclick="document.getElementById('shift-card-${myShiftIndex + 1}')?.scrollIntoView({behavior:'smooth',block:'center'})">
            Jump to My Checks ↓
          </button>
        </div>`;
      } else if (isFixedWorker) {
        bannerHtml = `
        <div class="user-shift-banner fixed-hours">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:22px;">🕗</span>
            <div>
              <strong style="color:#00e676;">${esc(userName)}</strong> • You are on <strong>Fixed Schedule: 08:00 – 17:00</strong> (Every day except Friday).
              <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:2px;">You can review or support checks on any shift as needed.</div>
            </div>
          </div>
        </div>`;
      } else if (userName && typeof Schedule !== 'undefined') {
        // Engineer is off duty on this date — calculate their next scheduled shift
        let nextShiftInfo = '';
        for (let d = 1; d <= 8; d++) {
          const probe = new Date(dateObj);
          probe.setDate(probe.getDate() + d);
          const pSched = Schedule.getDaySchedule(probe);
          const pShifts = [pSched?.morning, pSched?.afternoon, pSched?.night];
          const foundIdx = pShifts.findIndex(w => w && w.toLowerCase() === userName.toLowerCase());
          if (foundIdx !== -1) {
            const dayName = probe.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            nextShiftInfo = `${SHIFT_ICONS[foundIdx]} on ${dayName}`;
            break;
          }
        }
        bannerHtml = `
        <div class="user-shift-banner off-duty">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:22px;">🏖️</span>
            <div>
              <strong>${esc(userName)}</strong> • You are <strong>Off Duty</strong> on ${dateLabel}.
              ${nextShiftInfo ? `<span style="margin-left:8px;color:#38bdf8;font-weight:700;">Next Shift: ${nextShiftInfo}</span>` : ''}
            </div>
          </div>
        </div>`;
      }

      let outHtml = bannerHtml;

      // Date header with quick previous/today/next controls
      outHtml += `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
        <div style="font-size:14px;color:var(--text-primary);font-weight:600;display:flex;align-items:center;gap:8px;">
          <span>📅 ${dateLabel}</span>
          ${isRealToday
            ? '<span style="font-size:10.5px;padding:2px 8px;border-radius:100px;background:rgba(0,212,255,0.15);color:#00d4ff;font-weight:700;">TODAY</span>'
            : ''
          }
          <span style="font-size:12px;color:var(--text-muted);font-weight:normal;">• 6 Checks (2 checks per shift)</span>
        </div>
        <div class="date-nav-controls">
          <button type="button" class="btn-date-nav" onclick="navigateDailyDate(-1)">◀ Previous Day</button>
          <button type="button" class="btn-date-nav" onclick="resetDailyDateToday()" style="${isRealToday ? 'border-color:var(--cyan);color:var(--cyan);font-weight:700;' : ''}">Today</button>
          <button type="button" class="btn-date-nav" onclick="navigateDailyDate(1)">Next Day ▶</button>
        </div>
      </div>
      <div class="shift-grid">`;

      [1, 2, 3].forEach(s => {
        const slots = [`${s}a`, `${s}b`];
        const isShiftActive = s === activeShift;
        const checksDone = slots.filter(k => (day[`status${k}`] ?? day[`status${s}`]) === 'done').length;
        const allDone = checksDone === 2;
        const assignedWorker = SHIFT_ASSIGNED[s - 1] || null;
        const isMyShift = (myShiftIndex === (s - 1));
        const isDimmed = (myShiftIndex !== -1 && !isMyShift);

        let shiftStatusBadge = '';
        if (allDone) {
          shiftStatusBadge = `<span class="shift-status-badge done">✓ 2/2 Complete</span>`;
        } else if (checksDone === 1) {
          shiftStatusBadge = `<span class="shift-status-badge skipped">1/2 Done</span>`;
        } else if (isShiftActive) {
          shiftStatusBadge = `<span class="shift-status-badge active">● Active Shift</span>`;
        } else {
          shiftStatusBadge = `<span class="shift-status-badge upcoming">Upcoming</span>`;
        }

        const cardClasses = [
          'shift-card',
          `shift${s}`,
          allDone ? 'done' : isShiftActive ? 'active' : '',
          isMyShift ? 'user-assigned-shift' : '',
          isDimmed ? 'shift-card-dimmed' : ''
        ].filter(Boolean).join(' ');

        outHtml += `<div id="shift-card-${s}" class="${cardClasses}">
          ${isMyShift ? `
            <div class="user-shift-tag" style="background:${SHIFT_COLORS[s-1]}22;border:1px solid ${SHIFT_COLORS[s-1]};color:${SHIFT_COLORS[s-1]};">
              ⭐ YOUR SHIFT • PLEASE PERFORM YOUR CHECKS
            </div>
          ` : ''}

          <div class="shift-header">
            <div>
              <span class="shift-label" style="color:${SHIFT_COLORS[s - 1]};font-size:13px;">${SHIFT_ICONS[s - 1]} Shift ${s}</span>
              <span class="shift-time"> • ${SHIFT_SHORT[s - 1]}</span>
            </div>
            ${shiftStatusBadge}
          </div>

          <div class="shift-assigned-badge" style="${!assignedWorker ? 'opacity:0.55;' : ''}">
            <span>👤 Assigned:</span>
            ${assignedWorker
              ? `<strong style="color:var(--text-primary);">${esc(assignedWorker)}</strong> ${isMyShift ? '<span style="color:#00e676;font-weight:700;">(YOU)</span>' : ''}`
              : `<strong style="color:#f0a500;">No Engineer Assigned</strong>`
            }
          </div>`;

        slots.forEach((slotKey, idx) => {
          const checkLabel = `Check ${idx + 1}`;
          const taskId = day[`shift${slotKey}`] || (idx === 0 ? day[`shift${s}`] : null);
          const status = day[`status${slotKey}`] || (idx === 0 ? (day[`status${s}`] || 'pending') : 'pending');
          const doneBy = day[`doneBy${slotKey}`] || (idx === 0 ? day[`doneBy${s}`] : null);
          const doneAt = day[`doneAt${slotKey}`] || (idx === 0 ? day[`doneAt${s}`] : null);
          const notes = day[`notes${slotKey}`] || (idx === 0 ? day[`notes${s}`] : '');

          const task = Scheduler.getTask(taskId);
          const colors = Scheduler.getTaskColor(taskId);
          const isSlotActive = isShiftActive && status === 'pending';

          let statusClass = status;
          if (isSlotActive) statusClass = 'active';
          if (status === 'pending' && !isSlotActive) statusClass = 'upcoming';

          const canUndo = (currentUser && doneBy && (currentUser.name === doneBy || currentUser.role === 'System Administrator'));

          outHtml += `
          <div class="check-slot-box ${statusClass} ${isMyShift ? 'user-my-slot' : ''}">
            <div class="check-slot-header">
              <span class="check-slot-badge" style="color:${SHIFT_COLORS[s - 1]};border-left:3px solid ${SHIFT_COLORS[s - 1]};">${checkLabel}</span>
              ${isMyShift && status === 'pending' ? `<span style="font-size:11px;font-weight:700;color:${SHIFT_COLORS[s-1]};">👉 Your Action</span>` : ''}
              <span class="shift-status-badge ${statusClass}">
                ${status === 'done' ? '✓ Done' : status === 'skipped' ? '⚠ Skipped' : isSlotActive ? '● Active' : 'Pending'}
              </span>
            </div>

            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">
              Must be performed by: <strong style="color:${assignedWorker ? 'var(--text-secondary)' : '#f0a500'};">${
                assignedWorker ? esc(assignedWorker) : 'No Engineer Assigned'
              }</strong>
            </div>

            ${task ? `
              <div class="task-code">${task.code}</div>
              <div class="task-name">${esc(task.name)}</div>
              <div style="margin-bottom:10px;">
                <span class="cat-badge" style="background:${colors.bg};color:${colors.color};margin-bottom:0;">
                  ${esc(task.category)}
                </span>
                ${task.special ? '<span class="special-badge">📋 Special Sheet</span>' : ''}
              </div>
            ` : `<div class="task-name" style="color:var(--text-muted);">No task assigned</div>`}

            ${status === 'done' ? `
              <div class="done-meta">
                <strong>${esc(doneBy || '—')}</strong> completed<br/>
                ${doneAt ? `at ${new Date(doneAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
                ${notes ? `<br/><em style="color:var(--text-muted);font-size:11px;">${esc(notes)}</em>` : ''}
              </div>
              <div class="shift-actions">
                ${canUndo ? `
                  <button class="btn-undo" onclick="undoShift('${todayStr}','${slotKey}')">↩ Undo</button>
                ` : `
                  <span style="font-size:11px;color:var(--text-muted);padding:6px 0;display:inline-flex;align-items:center;gap:4px;" title="Only ${esc(doneBy)} can undo">
                    🔒 Done by ${esc(doneBy)}
                  </span>
                `}
              </div>
            ` : status === 'skipped' ? `
              <div class="done-meta">
                <strong>Skipped</strong> by ${esc(doneBy || '—')}
                ${notes ? `<br/><em style="font-size:11px;color:var(--text-muted);">${esc(notes)}</em>` : ''}
              </div>
              <div class="shift-actions">
                <button class="btn-done" onclick="openMarkModal('${todayStr}','${slotKey}','done')">Mark Done</button>
                ${canUndo ? `
                  <button class="btn-undo" onclick="undoShift('${todayStr}','${slotKey}')">↩ Undo</button>
                ` : ''}
              </div>
            ` : `
              <div class="shift-actions">
                <button class="btn-done" onclick="openMarkModal('${todayStr}','${slotKey}','done')">✓ Mark Complete</button>
                <button class="btn-skip" onclick="openMarkModal('${todayStr}','${slotKey}','skipped')">Skip</button>
              </div>
            `}
          </div>`;
        });

        outHtml += `</div>`;
      });

      outHtml += '</div>';
      el.innerHTML = outHtml;

      // Smooth scroll into focus if the logged in user is on shift today
      if (myShiftIndex !== -1) {
        setTimeout(() => {
          const myCard = document.getElementById(`shift-card-${myShiftIndex + 1}`);
          if (myCard) myCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);
      }
    }

    // ================================================================
    //  MARK / UNDO (supports slotKey: '1a','1b','2a','2b','3a','3b')
    // ================================================================
    function openMarkModal(dateStr, slotKey, action) {
      slotKey = String(slotKey);
      const day = currentSchedule?.days.find(d => d.date === dateStr);
      if (!day) return;
      const sNum = Number(slotKey[0]) || 1;
      const checkNum = slotKey.endsWith('b') ? 2 : 1;
      const taskId = day[`shift${slotKey}`] || day[`shift${sNum}`];
      const task = Scheduler.getTask(taskId);

      let assignedWorker = null;
      if (typeof Schedule !== 'undefined') {
        const daySched = Schedule.getDaySchedule(new Date(dateStr + 'T12:00:00'));
        if (sNum === 1) assignedWorker = daySched?.morning;
        if (sNum === 2) assignedWorker = daySched?.afternoon;
        if (sNum === 3) assignedWorker = daySched?.night;
      }

      const elDate = document.getElementById('mark_date');
      if (elDate) elDate.value = dateStr;
      const elShift = document.getElementById('mark_shift');
      if (elShift) elShift.value = slotKey;
      const elAction = document.getElementById('mark_action');
      if (elAction) elAction.value = action;
      const elNotes = document.getElementById('mark_notes');
      if (elNotes) elNotes.value = '';
      const elSkip = document.getElementById('mark_skip_reason');
      if (elSkip) elSkip.value = '';

      const elTitle = document.getElementById('markModalTitle');
      if (elTitle) {
        elTitle.textContent = action === 'done'
          ? `Mark Shift ${sNum} • Check ${checkNum} Complete`
          : `Skip Shift ${sNum} • Check ${checkNum} Task`;
      }

      const elBtn = document.getElementById('markSubmitBtn');
      if (elBtn) {
        elBtn.textContent = action === 'done' ? 'Confirm Done' : 'Confirm Skip';
        elBtn.style.background = action === 'done' ? '' : 'rgba(240,165,0,0.8)';
      }

      const elNotesField = document.getElementById('notesField');
      if (elNotesField) elNotesField.style.display = action === 'done' ? '' : 'none';

      const elSkipField = document.getElementById('skipReasonField');
      if (elSkipField) elSkipField.style.display = action === 'skipped' ? '' : 'none';

      const elPreview = document.getElementById('markTaskPreview');
      if (elPreview) {
        elPreview.innerHTML = task
          ? `<div style="font-size:11px;font-weight:700;color:${SHIFT_COLORS[sNum - 1]};text-transform:uppercase;margin-bottom:4px;">
              Shift ${sNum} • Check ${checkNum} (${SHIFT_SHORT[sNum - 1]})
              ${assignedWorker ? `&nbsp;•&nbsp; Assigned: <strong style="color:white;">${esc(assignedWorker)}</strong>` : ''}
             </div>
             <span style="font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">${task.code}</span><br/>
             <strong>${esc(task.name)}</strong>`
          : 'Unknown task';
      }

      // Populate employees
      const users = DB.Users.getActive().filter(u => u.role !== 'System Administrator');
      const sel = document.getElementById('mark_employee');
      if (sel) {
        sel.innerHTML = '<option value="">Select engineer…</option>' +
          users.map(u => `<option value="${u.name}">${u.name} — ${u.role}</option>`).join('');
        
        // Pre-select assigned worker or current user
        if (assignedWorker && users.find(u => u.name === assignedWorker)) {
          sel.value = assignedWorker;
        } else if (currentUser && users.find(u => u.name === currentUser.name)) {
          sel.value = currentUser.name;
        }
      }

      openModal('markModal');
    }

    function submitMark() {
      const dateStr = document.getElementById('mark_date')?.value;
      const slotKey = document.getElementById('mark_shift')?.value;
      const action = document.getElementById('mark_action')?.value;
      const employee = document.getElementById('mark_employee')?.value;
      const notes = action === 'done'
        ? (document.getElementById('mark_notes')?.value.trim() || '')
        : (document.getElementById('mark_skip_reason')?.value.trim() || '');

      if (!employee) { showToast('Please select an engineer', 'error'); return; }
      if (action === 'skipped' && !notes) { showToast('Please give a reason for skipping', 'error'); return; }

      DB.MonthlySchedule.markShift(dateStr, slotKey, action, employee, notes);

      // Reload
      currentSchedule = DB.MonthlySchedule.load(viewYear, viewMonth);
      closeModal('markModal');
      renderToday();
      renderCalendar();
      renderStatsRow();
      showToast(action === 'done' ? 'Check marked complete ✓' : 'Check marked as skipped', 'success');
    }

    function undoShift(dateStr, slotKey) {
  const day = currentSchedule?.days.find(d => d.date === dateStr);
  const doneBy = day?.[ `doneBy${slotKey}` ] || day?.[ `doneBy${slotKey[0]}` ];
  if (doneBy && currentUser && currentUser.name !== doneBy && currentUser.role !== 'System Administrator') {
    showToast(`Permission denied: Only ${doneBy} (who completed this task) can undo it.`, 'error');
    return;
  }
  if (!confirm('Undo this completion and reset to pending?')) return;
  DB.MonthlySchedule.unmarkShift(dateStr, slotKey);
  currentSchedule = DB.MonthlySchedule.load(viewYear, viewMonth);
  renderToday(); renderCalendar(); renderStatsRow();
  showToast('Reset to pending', 'info');
}

    function undoSubShift(dateStr, slotKey) {
      undoShift(dateStr, slotKey);
    }

    // ================================================================
    //  MONTHLY CALENDAR
    // ================================================================
    function changeCalMonth(delta) {
      calViewMonth += delta;
      if (calViewMonth > 12) { calViewMonth = 1; calViewYear++; }
      if (calViewMonth < 1) { calViewMonth = 12; calViewYear--; }
      renderCalendar();
    }

    function renderCalendar() {
      const sched = DB.MonthlySchedule.load(calViewYear, calViewMonth);
      const todayStr = new Date().toISOString().split('T')[0];

      document.getElementById('calMonthTitle').textContent =
        `${MONTH_NAMES[calViewMonth - 1]} ${calViewYear}`;

      const grid = document.getElementById('calGrid');
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let html = days.map(d => `<div class="cal-header">${d}</div>`).join('');

      if (!sched) {
        grid.innerHTML = html + `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">
      No schedule generated for ${MONTH_NAMES[calViewMonth - 1]} ${calViewYear}.
      <br/>Use <strong>Schedule Settings</strong> to generate one.
    </div>`;
        return;
      }

      const firstDay = new Date(calViewYear, calViewMonth - 1, 1).getDay();
      for (let i = 0; i < firstDay; i++) html += `<div class="cal-day cal-empty"></div>`;

      const allSlots = ['1a', '1b', '2a', '2b', '3a', '3b'];

      sched.days.forEach(d => {
        const isToday = d.date === todayStr;
        const statuses = allSlots.map(k => d[`status${k}`] ?? d[`status${k[0]}`] ?? 'pending');
        const tasks = allSlots.map(k => d[`shift${k}`] ?? (k.endsWith('a') ? d[`shift${k[0]}`] : null));

        const dots = statuses.map(s =>
          `<div class="cal-dot" style="background:${s === 'done' ? '#00e676' : s === 'skipped' ? '#f0a500' : '#334155'};"></div>`
        ).join('');

        const validTasks = tasks.filter(Boolean);
        const pills = validTasks.slice(0, 4).map((tid, i) => {
          const t = Scheduler.getTask(tid);
          const c = Scheduler.getTaskColor(tid);
          const s = statuses[i];
          return t ? `<div class="cal-task-pill" style="background:${c.bg};color:${c.color};
        ${s === 'done' ? 'opacity:0.6;text-decoration:line-through;' : ''}">${t.code}</div>` : '';
        }).join('');

        const extraCount = validTasks.length - 4;
        const extraPill = extraCount > 0 ? `<div class="cal-task-pill" style="background:rgba(255,255,255,.05);color:var(--text-muted);font-size:9px;">+${extraCount}</div>` : '';

        html += `<div class="cal-day ${isToday ? 'today' : ''}" onclick="showDayDetail('${d.date}')">
      <div class="cal-done-dot">${dots}</div>
      <div class="cal-day-num">${d.day}</div>
      ${pills}${extraPill}
    </div>`;
      });

      grid.innerHTML = html;
    }

    function showDayDetail(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const sched = DB.MonthlySchedule.load(y, m);
  if (!sched) return;
  const day = sched.days.find(d => d.date === dateStr);
  if (!day) return;

  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let daySched = null;
  if (typeof Schedule !== 'undefined') {
    daySched = Schedule.getDaySchedule(dateObj);
  }

  document.getElementById('dayModalTitle').textContent = `${dateLabel} (6 Checks)`;

  let body = '';
  [1, 2, 3].forEach(s => {
    const slots = [`${s}a`, `${s}b`];
    let assignedWorker = null;
    if (s === 1) assignedWorker = daySched?.morning;
    if (s === 2) assignedWorker = daySched?.afternoon;
    if (s === 3) assignedWorker = daySched?.night;

    body += `<div style="background:var(--bg-card-2);border:1px solid var(--border);
  border-radius:var(--radius-md);padding:14px;margin-bottom:12px;border-left:4px solid ${SHIFT_COLORS[s - 1]};">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
    <span style="font-size:12px;font-weight:800;color:${SHIFT_COLORS[s - 1]};text-transform:uppercase;">
      Shift ${s} • ${SHIFT_SHORT[s - 1]}
    </span>
    <span style="font-size:11px;color:var(--text-secondary);">
      👤 Assigned: <strong style="color:${assignedWorker ? 'var(--text-primary)' : '#f0a500'};">${esc(assignedWorker || 'No Engineer Assigned')}</strong>
    </span>
  </div>`;

    slots.forEach((slotKey, idx) => {
      const tid = day[`shift${slotKey}`] || (idx === 0 ? day[`shift${s}`] : null);
      const status = day[`status${slotKey}`] || (idx === 0 ? (day[`status${s}`] || 'pending') : 'pending');
      const doneBy = day[`doneBy${slotKey}`] || (idx === 0 ? day[`doneBy${s}`] : null);
      const doneAt = day[`doneAt${slotKey}`] || (idx === 0 ? day[`doneAt${s}`] : null);
      const notes = day[`notes${slotKey}`] || (idx === 0 ? day[`notes${s}`] : '');
      const task = Scheduler.getTask(tid);
      const colors = Scheduler.getTaskColor(tid);

      body += `
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:10px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;">Check ${idx + 1}</span>
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;
            background:${status === 'done' ? 'rgba(0,230,118,.12)' : status === 'skipped' ? 'rgba(240,165,0,.12)' : 'rgba(100,116,139,.1)'};
            color:${status === 'done' ? '#00e676' : status === 'skipped' ? '#f0a500' : '#64748b'};">
            ${status === 'done' ? '✓ Done' : status === 'skipped' ? '⚠ Skipped' : 'Pending'}
          </span>
        </div>
        ${task ? `
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);margin-bottom:2px;">${task.code}</div>
          <div style="font-size:12px;font-weight:700;margin-bottom:4px;">${esc(task.name)}</div>
          <span style="font-size:9px;padding:2px 7px;border-radius:100px;background:${colors.bg};color:${colors.color};">${task.category}</span>
          ${task.special ? `<span style="font-size:9px;padding:2px 7px;border-radius:100px;background:rgba(244,63,94,.1);color:#fb7185;margin-left:4px;">📋 Special Sheet</span>` : ''}
        ` : '<div style="color:var(--text-muted);font-size:12px;">No task assigned</div>'}
        ${doneBy ? `<div style="margin-top:6px;font-size:11px;color:var(--text-secondary);">By: <strong>${esc(doneBy)}</strong>${doneAt ? ' at ' + new Date(doneAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}${notes ? '<br/><em style="font-size:10px;">' + esc(notes) + '</em>' : ''}</div>` : ''}
      </div>`;
    });

    body += `</div>`;
  });

  document.getElementById('dayModalBody').innerHTML = body;
  openModal('dayModal');
}

    // ================================================================
    //  TASK COVERAGE
    // ================================================================
    function renderCoverage() {
      const el = document.getElementById('coverageContent');
      if (!currentSchedule) {
        el.innerHTML = buildNoScheduleCard(viewYear, viewMonth);
        return;
      }

      // Count actual appearances in schedule across all 6 slots
      const counts = {};
      Scheduler.MASTER_TASKS.forEach(t => { counts[t.id] = 0; });
      const allSlots = ['1a', '1b', '2a', '2b', '3a', '3b'];

      currentSchedule.days.forEach(d => {
        allSlots.forEach(k => {
          const id = d[`shift${k}`] ?? (k.endsWith('a') ? d[`shift${k[0]}`] : null);
          if (id && counts[id] !== undefined) counts[id]++;
        });
      });

      const max = Math.max(...Object.values(counts));
      const PRIORITY_COLORS = { critical: '#ff4757', high: '#f0a500', medium: '#38bdf8', low: '#64748b' };

      const tasksByPriority = { critical: [], high: [], medium: [], low: [] };
      Scheduler.MASTER_TASKS.forEach(t => {
        if (tasksByPriority[t.priority]) tasksByPriority[t.priority].push(t);
      });

      let html = `<div style="margin-bottom:16px;font-size:13px;color:var(--text-secondary);">
    Showing scheduled frequency for each of the 25 tasks in
    <strong>${MONTH_NAMES[viewMonth - 1]} ${viewYear}</strong>
    (${currentSchedule.daysInMonth} days × 6 checks = ${currentSchedule.totalSlots} total slots)
  </div>`;

      ['critical', 'high', 'medium', 'low'].forEach(priority => {
        const tasks = tasksByPriority[priority];
        if (!tasks.length) return;
        const col = PRIORITY_COLORS[priority];
        html += `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${col};margin-bottom:10px;margin-top:18px;">${priority} Priority</div>
    <div class="coverage-grid">`;
        tasks.forEach(t => {
          const c = counts[t.id] || 0;
          const col2 = Scheduler.getTaskColor(t.id);
          const barW = max > 0 ? Math.round((c / max) * 100) : 0;
          html += `<div class="coverage-item">
        <div class="coverage-code">${t.code}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div class="coverage-name">${esc(t.name)}</div>
            <div class="coverage-count" style="color:${col2.color};">${c}</div>
          </div>
          <div class="coverage-bar-wrap">
            <div class="coverage-bar" style="width:${barW}%;background:${col2.color};"></div>
          </div>
          ${t.special ? '<div style="font-size:10px;color:#fb7185;margin-top:3px;">📋 Special sheet required</div>' : ''}
        </div>
      </div>`;
        });
        html += '</div>';
      });

      el.innerHTML = html;
    }

    // ================================================================
    //  ADMIN — GENERATE SCHEDULE
    // ================================================================
    function openAdminPanel() {
      const yEl = document.getElementById('genYear');
      const mEl = document.getElementById('genMonth');
      if (yEl) yEl.value = String(viewYear || new Date().getFullYear());
      if (mEl) mEl.value = String(viewMonth || (new Date().getMonth() + 1));

      // Sync priority sliders with current schedule weights or defaults
      const w = currentSchedule?.weights || Scheduler.DEFAULT_PRIORITY_WEIGHTS || { critical: 10, high: 8, medium: 6, low: 2 };
      ['Critical', 'High', 'Medium', 'Low'].forEach(name => {
        const key = name.toLowerCase();
        const sEl = document.getElementById(`s${name}`);
        const wEl = document.getElementById(`w${name}`);
        const val = w[key] !== undefined ? w[key] : (key === 'critical' ? 10 : key === 'high' ? 8 : key === 'medium' ? 6 : 2);
        if (sEl) sEl.value = val;
        if (wEl) wEl.textContent = val;
      });

      previewFrequencies();
      openModal('adminModal');
    }

    function updateWeight(name) {
      const sEl = document.getElementById(`s${name}`);
      const wEl = document.getElementById(`w${name}`);
      if (sEl && wEl) {
        wEl.textContent = sEl.value;
      }
      previewFrequencies();
    }

    function getWeightsFromUI() {
      return {
        critical: Number(document.getElementById('sCritical')?.value || 10),
        high: Number(document.getElementById('sHigh')?.value || 8),
        medium: Number(document.getElementById('sMedium')?.value || 6),
        low: Number(document.getElementById('sLow')?.value || 2),
      };
    }

    function previewFrequencies() {
      const yEl = document.getElementById('genYear');
      const mEl = document.getElementById('genMonth');
      const y = Number(yEl?.value) || viewYear || new Date().getFullYear();
      const m = Number(mEl?.value) || viewMonth || (new Date().getMonth() + 1);
      const days = new Date(y, m, 0).getDate();
      const slots = days * 6; // 6 checks per 24h
      const weights = getWeightsFromUI();
      const preview = document.getElementById('freqPreview');
      if (!preview) return;

      // Exact repeats calculation requested by user:
      // Critical (6 tasks), High (6 tasks), Medium (2 tasks), Low (11 tasks)
      const critSlots = 6 * weights.critical;
      const highSlots = 6 * weights.high;
      const medSlots  = 2 * weights.medium;
      const lowSlots  = 11 * weights.low;
      const baseTotal = critSlots + highSlots + medSlots + lowSlots;

      preview.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <strong style="color:var(--text-primary);font-size:13px;">${MONTH_NAMES[m - 1]} ${y} Schedule Capacity</strong>
          <span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:100px;background:rgba(0,212,255,.12);color:#00d4ff;">
            ${days} Days × 6 Checks = ${slots} Total Shift Slots
          </span>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-bottom:8px;">
          <span style="color:#ff4757;font-weight:700;">● Critical: ${weights.critical}×/task <span style="color:var(--text-muted);font-weight:400;">(6 tasks = ${critSlots} slots)</span></span>
          <span style="color:#f0a500;font-weight:700;">● High: ${weights.high}×/task <span style="color:var(--text-muted);font-weight:400;">(6 tasks = ${highSlots} slots)</span></span>
          <span style="color:#38bdf8;font-weight:700;">● Medium: ${weights.medium}×/task <span style="color:var(--text-muted);font-weight:400;">(2 tasks = ${medSlots} slots)</span></span>
          <span style="color:#94a3b8;font-weight:700;">● Low: ${weights.low}×/task <span style="color:var(--text-muted);font-weight:400;">(11 tasks = ${lowSlots} slots)</span></span>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);border-top:1px solid var(--border);padding-top:6px;line-height:1.5;">
          Base repeats planned: <strong style="color:var(--text-primary);">${baseTotal} slots</strong> out of <strong>${slots} slots</strong> capacity.
          ${baseTotal <= slots 
            ? `<span style="color:#00e676;">✓ Perfectly fits (${slots - baseTotal} remaining slots automatically filled by high/critical checks).</span>`
            : `<span style="color:#f0a500;">⚠ Exceeds month capacity by ${baseTotal - slots} slots; distribution algorithm will balance accordingly.</span>`}
        </div>`;
    }

    function generateAndSave() {
      const y = Number(document.getElementById('genYear')?.value) || viewYear;
      const m = Number(document.getElementById('genMonth')?.value) || viewMonth;
      const weights = getWeightsFromUI();

      if (DB.MonthlySchedule.exists(y, m)) {
        if (!confirm(`A schedule for ${MONTH_NAMES[m - 1]} ${y} already exists. Overwrite it?\n\nAll marked completions will be LOST.`)) return;
      }

      const btn = document.querySelector('#adminModal .btn-primary');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generating…';
      }

      setTimeout(() => {
        const sched = Scheduler.generateMonthlySchedule(y, m, weights);

        // Validate
        const validation = Scheduler.validateSchedule(sched);
        DB.MonthlySchedule.save(sched);

        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.18-6.24"/></svg> Generate Schedule`;
        }

        closeModal('adminModal');

        // Always update views to generated month
        currentSchedule = sched;
        viewYear = y; viewMonth = m;
        calViewYear = y; calViewMonth = m;

        renderStatsRow(); renderToday(); renderCalendar(); renderCoverage();

        const vMsg = validation.ok
          ? `✓ Valid — ${validation.uniqueTasks}/25 tasks · ${sched.totalSlots} total slots (6 checks/day)`
          : `⚠ ${validation.violations.length} constraint(s) flagged`;
        showToast(`Schedule generated for ${MONTH_NAMES[m - 1]} ${y}. ${vMsg}`, 'success');
      }, 200);
    }

    function populateGenDropdowns() {
      const now = new Date();
      const yEl = document.getElementById('genYear');
      const mEl = document.getElementById('genMonth');
      if (yEl && !yEl.value) yEl.value = String(viewYear || now.getFullYear());
      if (mEl && !mEl.value) mEl.value = String(viewMonth || (now.getMonth() + 1));
      ['genYear', 'genMonth'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', previewFrequencies);
      });
      previewFrequencies();
    }

    // ================================================================
    //  HELPERS
    // ================================================================
    function buildNoScheduleCard(y, m) {
      const isAdmin = ['System Administrator', 'Electrical Supervisor'].includes(currentUser?.role);
      return `<div class="no-schedule">
    <div class="no-schedule-icon">⚙️</div>
    <h3>No Schedule for ${MONTH_NAMES[m - 1]} ${y}</h3>
    <p>The monthly shift schedule hasn't been generated yet.
       ${isAdmin ? 'Use <strong>Schedule Settings</strong> to automatically assign the 24 routine tasks across all 3 shifts for every day of the month.' : 'Please ask your supervisor or administrator to generate the schedule.'}</p>
    ${isAdmin ? `<button class="btn-primary" onclick="openAdminPanel()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.18-6.24"/></svg>
      Generate ${MONTH_NAMES[m - 1]} ${y} Schedule
    </button>` : ''}
  </div>`;
    }

    function esc(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  