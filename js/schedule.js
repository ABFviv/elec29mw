// ================================================
//  PowerCore EMS — Schedule Engine
//  8-day rotating shift + fixed hours
//  Cycle starts: October 19, 2026
// ================================================

const Schedule = (() => {

  // ---- Employee name constants (must match DB.Users names) ----
  const BAQI  = 'Mohammed Baqi';
  const SHWAN = 'Mohammed Shwan';
  const ZAMWA = 'Zamwa Pshtiwan';
  const HAMEED = 'Hameed Tahsin';
  const NAMO   = 'Namo Hoshyar';

  // Fixed-hours workers: every day except Friday, 08:00-17:00
  const FIXED_WORKERS = [
    { name: HAMEED, role: 'Electrical Supervisor', initials: 'HT' },
    { name: NAMO,   role: 'Electrical Engineer',   initials: 'NH' },
  ];

  // Rotating-shift workers
  const SHIFT_WORKERS = [
    { name: BAQI,  role: 'Electrical Engineer', initials: 'MB' },
    { name: SHWAN, role: 'Electrical Engineer', initials: 'MS' },
    { name: ZAMWA, role: 'Electrical Engineer', initials: 'ZP' },
  ];

  // All team members in display order
  const ALL_WORKERS = [FIXED_WORKERS[0], ...SHIFT_WORKERS, FIXED_WORKERS[1]];

  // ---- 8-Day Rotating Pattern ----
  // Index 0 = October 19, 2026 (repeats every 8 days)
  // Shifts: morning 07:30-15:30 | afternoon 15:30-23:30 | night 23:30-07:30
  const PATTERN = [
    { morning: BAQI,  afternoon: ZAMWA, night: SHWAN, off: null  }, // Day 0 — Oct 19
    { morning: BAQI,  afternoon: ZAMWA, night: SHWAN, off: null  }, // Day 1 — Oct 20
    { morning: null,  afternoon: BAQI,  night: ZAMWA, off: SHWAN }, // Day 2 — Oct 21
    { morning: null,  afternoon: BAQI,  night: ZAMWA, off: SHWAN }, // Day 3 — Oct 22
    { morning: SHWAN, afternoon: null,  night: BAQI,  off: ZAMWA }, // Day 4 — Oct 23
    { morning: SHWAN, afternoon: null,  night: BAQI,  off: ZAMWA }, // Day 5 — Oct 24
    { morning: ZAMWA, afternoon: SHWAN, night: null,  off: BAQI  }, // Day 6 — Oct 25
    { morning: ZAMWA, afternoon: SHWAN, night: null,  off: BAQI  }, // Day 7 — Oct 26
  ];

  // Cycle reference (midnight local)
  const CYCLE_START_MS = new Date(2026, 9, 19).getTime(); // Oct 19, 2026

  // ---- Core helpers ----

  function getCycleIndex(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((d.getTime() - CYCLE_START_MS) / 86400000);
    return ((diffDays % 8) + 8) % 8;
  }

  function getDaySchedule(date) {
    return PATTERN[getCycleIndex(date)];
  }

  // Returns: 'morning' | 'afternoon' | 'night'
  function getCurrentShiftType(now) {
    const t = now.getHours() + now.getMinutes() / 60;
    if (t >= 7.5  && t < 15.5) return 'morning';
    if (t >= 15.5 && t < 23.5) return 'afternoon';
    return 'night';
  }

  // The night shift spans midnight. For 00:00–07:30, the night worker
  // belongs to the PREVIOUS day's schedule.
  function getActiveSchedule(now) {
    const shiftType = getCurrentShiftType(now);
    if (shiftType === 'night') {
      const t = now.getHours() + now.getMinutes() / 60;
      if (t < 7.5) {
        // Past midnight — yesterday's night shift is still running
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { schedule: getDaySchedule(yesterday), shiftType };
      }
    }
    return { schedule: getDaySchedule(now), shiftType };
  }

  // ---- Shift label helpers ----
  const SHIFT_LABELS = {
    morning:   'Morning Shift   07:30 – 15:30',
    afternoon: 'Afternoon Shift 15:30 – 23:30',
    night:     'Night Shift     23:30 – 07:30',
  };

  const SHIFT_SHORT = {
    morning:   '07:30 – 15:30',
    afternoon: '15:30 – 23:30',
    night:     '23:30 – 07:30',
  };

  // ---- Main status function ----
  function getTeamStatus(now) {
    now = now || new Date();
    const t = now.getHours() + now.getMinutes() / 60;
    const { schedule: activeSchedule, shiftType } = getActiveSchedule(now);
    const todaySchedule = getDaySchedule(now);
    const currentShiftWorker = activeSchedule[shiftType]; // who is on right now (may be null)

    // Fixed workers status
    const fixedStatuses = FIXED_WORKERS.map(w => {
      const isFriday = now.getDay() === 5;
      let status, label;

      if (isFriday) {
        status = 'off';
        label  = 'Off — Friday';
      } else if (t >= 8 && t < 17) {
        status = 'at-work';
        label  = 'Day Shift   08:00 – 17:00';
      } else if (t < 8) {
        status = 'upcoming';
        label  = 'Shift starts at 08:00';
      } else {
        status = 'done';
        label  = 'Done — 08:00 to 17:00';
      }

      return { ...w, status, label, isFixed: true };
    });

    // Shift workers status
    const shiftStatuses = SHIFT_WORKERS.map(w => {
      const name = w.name;
      let status, label;

      // Is this person on shift RIGHT NOW?
      if (name === currentShiftWorker) {
        status = 'at-work';
        label  = SHIFT_LABELS[shiftType];
        return { ...w, status, label, isFixed: false };
      }

      // Not on shift now — figure out today's position
      const isMorning   = todaySchedule.morning   === name;
      const isAfternoon = todaySchedule.afternoon === name;
      const isNight     = todaySchedule.night     === name;
      const isOff       = todaySchedule.off       === name;

      // Special case: person was working night shift (past midnight) but now their "night"
      // appears in today's schedule as night — they haven't started yet (starts at 23:30 tonight)
      if (isOff) {
        status = 'off'; label = 'Off today';
      } else if (isMorning) {
        if (t < 7.5)       { status = 'upcoming'; label = 'Morning Shift at 07:30'; }
        else if (t < 15.5) { status = 'at-work';  label = SHIFT_LABELS.morning; }   // should be currentWorker already
        else               { status = 'done';      label = 'Done — 07:30 to 15:30'; }
      } else if (isAfternoon) {
        if (t < 15.5)      { status = 'upcoming'; label = 'Afternoon Shift at 15:30'; }
        else if (t < 23.5) { status = 'at-work';  label = SHIFT_LABELS.afternoon; }
        else               { status = 'done';      label = 'Done — 15:30 to 23:30'; }
      } else if (isNight) {
        if (t >= 7.5 && t < 23.5) { status = 'upcoming'; label = 'Night Shift at 23:30'; }
        else                       { status = 'at-work';  label = SHIFT_LABELS.night; }
      } else {
        // Not in today's schedule at all — check if they might be finishing a night from yesterday
        // (This handles the case where currentShiftWorker is null — no night person)
        status = 'off'; label = 'Off today';
      }

      return { ...w, status, label, isFixed: false };
    });

    // Build ordered list: Hameed, Baqi, Shwan, Zamwa, Namo
    const allMembers = [
      fixedStatuses[0],     // Hameed
      ...shiftStatuses,     // Baqi, Shwan, Zamwa
      fixedStatuses[1],     // Namo
    ];

    return {
      members:      allMembers,
      shiftType,
      shiftLabel:   SHIFT_LABELS[shiftType],
      shiftTime:    SHIFT_SHORT[shiftType],
      todaySchedule,
      currentShiftWorker,
      atWorkCount:  allMembers.filter(m => m.status === 'at-work').length,
      now,
    };
  }

  // ---- Get schedule for any date (for display) ----
  function getDateOverview(date) {
    const s = getDaySchedule(date);
    return {
      date,
      cycleDay: getCycleIndex(date) + 1,
      morning:   s.morning,
      afternoon: s.afternoon,
      night:     s.night,
      off:       s.off,
    };
  }

  return {
    getTeamStatus,
    getDateOverview,
    getDaySchedule,
    getCurrentShiftType,
    FIXED_WORKERS,
    SHIFT_WORKERS,
    ALL_WORKERS,
  };

})();
