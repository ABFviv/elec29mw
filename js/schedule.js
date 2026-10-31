// ================================================
//  29MW Plant EMS — Schedule Engine
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
    { name: NAMO,   role: 'Electrical Engineer',  initials: 'NH' },
  ];

  // Rotating-shift workers: 3 engineers covering 3 shifts (Morning, Afternoon, Night)
  const SHIFT_WORKERS = [
    { name: BAQI,  role: 'Electrical Engineer', initials: 'MB' },
    { name: SHWAN, role: 'Electrical Engineer', initials: 'MS' },
    { name: ZAMWA, role: 'Electrical Engineer', initials: 'ZP' },
  ];

  // All team members in display order
  const ALL_WORKERS = [FIXED_WORKERS[0], FIXED_WORKERS[1], ...SHIFT_WORKERS];

  // ---- 8-Day Rotating Pattern (3 Engineers covering 3 shifts 24/7) ----
  // Shifts: morning 07:30-15:30 | afternoon 15:30-23:30 | night 23:30-07:30
  // Namo & Hameed are fixed (08:00-17:00, off Friday) — not in shift rotation
  const PATTERN = [
    { morning: ZAMWA, afternoon: SHWAN, night: null,  off: BAQI  }, // Day 0 — Oct 19 & Nov 04
    { morning: ZAMWA, afternoon: SHWAN, night: null,  off: BAQI  }, // Day 1 — Oct 20 & Nov 05
    { morning: BAQI,  afternoon: ZAMWA, night: SHWAN, off: null  }, // Day 2 — Oct 21 & Nov 06
    { morning: BAQI,  afternoon: ZAMWA, night: SHWAN, off: null  }, // Day 3 — Oct 22 & Nov 07
    { morning: null,  afternoon: BAQI,  night: ZAMWA, off: SHWAN }, // Day 4 — Oct 23 & Oct 31
    { morning: null,  afternoon: BAQI,  night: ZAMWA, off: SHWAN }, // Day 5 — Oct 24 & Nov 01
    { morning: SHWAN, afternoon: null,  night: BAQI,  off: ZAMWA }, // Day 6 — Oct 25 & Nov 02
    { morning: SHWAN, afternoon: null,  night: BAQI,  off: ZAMWA }, // Day 7 — Oct 26 & Nov 03
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

    // Fixed workers status (Hameed & Namo: 08:00–17:00 except Friday)
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
        status = 'off';
        label  = 'Off duty (Shift ended 17:00)';
      }

      return { ...w, status, label, isFixed: true };
    });

    // Shift workers status (Baqi, Shwan, Zamwa)
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

      if (isOff) {
        status = 'off';
        label  = 'Off today';
      } else if (isMorning) {
        if (t < 7.5) {
          status = 'upcoming';
          label  = 'Upcoming: Morning Shift at 07:30';
        } else if (t < 15.5) {
          status = 'at-work';
          label  = SHIFT_LABELS.morning;
        } else {
          status = 'off';
          label  = 'Off duty (Shift ended 15:30)';
        }
      } else if (isAfternoon) {
        if (t < 15.5) {
          status = 'upcoming';
          label  = 'Upcoming: Afternoon Shift at 15:30';
        } else if (t < 23.5) {
          status = 'at-work';
          label  = SHIFT_LABELS.afternoon;
        } else {
          status = 'off';
          label  = 'Off duty (Shift ended 23:30)';
        }
      } else if (isNight) {
        if (t >= 7.5 && t < 23.5) {
          status = 'upcoming';
          label  = 'Upcoming: Night Shift at 23:30';
        } else if (t >= 23.5) {
          status = 'at-work';
          label  = SHIFT_LABELS.night;
        } else {
          // Early morning past midnight (00:00–07:30): this person's night shift is tonight at 23:30
          status = 'off';
          label  = 'Night Shift tonight at 23:30';
        }
      } else {
        status = 'off';
        label  = 'Off today';
      }

      return { ...w, status, label, isFixed: false };
    });

    // Build ordered list: Fixed workers (Hameed, Namo), then rotating shift workers (Baqi, Shwan, Zamwa)
    const allMembers = [
      ...fixedStatuses,   // Hameed, Namo (fixed 08:00–17:00)
      ...shiftStatuses,   // Baqi, Shwan, Zamwa (rotating shifts)
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
