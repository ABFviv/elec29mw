/**
 * ================================================================
 *  29MW Plant EMS — Daily Check Scheduler
 *  29MW Power Plant â€” Electrical Team
 * ================================================================
 *
 *  ARCHITECTURE OVERVIEW
 *  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *  â€¢ 24 master tasks (S1â€“S24) with priority levels.
 *  â€¢ 3 shifts/day â†’ 90 slots/month (30d) or 93 (31d).
 *  â€¢ Each slot gets exactly 1 unique task per day.
 *  â€¢ Priority weights drive how often each task recurs.
 *  â€¢ Largest-Remainder Method ensures slot totals are exact.
 *  â€¢ Greedy scheduler with cooldown window prevents back-to-back.
 *  â€¢ Seeded RNG (mulberry32) makes schedules reproducible.
 * ================================================================
 */

const Scheduler = (() => {

  // ================================================================
  //  MASTER TASK LIST  (S1 â€“ S24)
  // ================================================================
  const MASTER_TASKS = [
    { id: 'S1', code: 'S1', name: 'DAS #1 & DAS #2 Cooling Systems (HT and LT)', priority: 'high', category: 'Engine cooling Systems', special: false },
    { id: 'S2', code: 'S2', name: 'DAS #1 & DAS #2 Lube Oil System incl. Separators', priority: 'high', category: 'Engine auxuilary Systems', special: false },
    { id: 'S3', code: 'S3', name: 'DAS #1 & DAS #2 Fuel Injection System incl. FO Booster', priority: 'critical', category: 'Engine Fuel Systems', special: false },
    { id: 'S4', code: 'S4', name: 'DAS #3 & DAS #4 Cooling Systems (HT and LT)', priority: 'high', category: 'Engine cooling Systems', special: false },
    { id: 'S5', code: 'S5', name: 'DAS #3 & DAS #4 Lube Oil System incl. Separators', priority: 'high', category: 'Engine auxuilary Systems', special: false },
    { id: 'S6', code: 'S6', name: 'DAS #3 & DAS #4 Fuel Injection System incl. FO Booster', priority: 'critical', category: 'Engine Fuel Systems', special: false },
    { id: 'S7', code: 'S7', name: 'live tightness check if possible ( DAS4 & LO seperator 4)', priority: 'critical', category: 'DAS Systems', special: false },
    { id: 'S8', code: 'S8', name: 'RCS check ( panel visual inspection)', priority: 'medium', category: 'Engine cooling Systems', special: false },
    { id: 'S9', code: 'S9', name: 'RCS MCC (Motor Control center) tightness check.', priority: 'low', category: 'Engine cooling Systems', special: false },
    { id: 'S10', code: 'S10', name: 'UNIT #1 Cleaning', priority: 'low', category: 'Housekeeping', special: false },
    { id: 'S11', code: 'S11', name: 'UNIT #2 Cleaning', priority: 'low', category: 'Housekeeping', special: false },
    { id: 'S12', code: 'S12', name: 'Common Starting Air Comp. & Service Air Comp.', priority: 'medium', category: 'Air Systems', special: false },
    { id: 'S13', code: 'S13', name: 'Engine Speed Control Unit', priority: 'low', category: 'Engine control Systems', special: false },
    { id: 'S14', code: 'S14', name: 'Voltage Control Unit', priority: 'low', category: 'AVR System', special: false },
    { id: 'S15', code: 'S15', name: 'HFO seperators panel & supply pumps ', priority: 'high', category: 'Fuel Systems', special: false },
    { id: 'S16', code: 'S16', name: 'storage tanks tanks & heaters', priority: 'high', category: 'Fuel Systems', special: false },
    { id: 'S17', code: 'S17', name: 'MIMIC panel battery check & switch gear battery', priority: 'low', category: 'DSC System', special: false },
    { id: 'S18', code: 'S18', name: 'live tightness check if possible ( DAS 1 & LO seperator 1)', priority: 'critical', category: 'DAS Systems', special: false },
    { id: 'S19', code: 'S19', name: 'LV & MV breakers ( visual inspection and gas level check)', priority: 'low', category: '11KV Switchgear', special: false },
    { id: 'S20', code: 'S20', name: 'AUX transformer check ( breather colour, oil level, leakage visual inspection)', priority: 'low', category: 'LV System', special: false },
    { id: 'S21', code: 'S21', name: 'HFO seperators panel tightness', priority: 'low', category: 'Fuel Systems', special: false },
    { id: 'S22', code: 'S22', name: 'UNIT #3 Cleaning', priority: 'low', category: 'Housekeeping', special: false },
    { id: 'S23', code: 'S23', name: 'UNIT #4 Cleaning', priority: 'low', category: 'Housekeeping', special: false },
    { id: 'S24', code: 'S24', name: 'live tightness check if possible ( DAS2 & LO seperator 2)', priority: 'critical', category: 'DAS Systems', special: false },
    { id: 'S25', code: 'S25', name: 'live tightness check if possible ( DAS3 & LO seperator 3) ', priority: 'critical', category: 'DAS Systems', special: false },
  ];

  // ================================================================
  //  PRIORITY WEIGHT CONFIGURATION (Target Monthly Repeats per Task)
  //  ────────────────────────────────────────────────────────────────
  //  These numbers specify how many times EACH task of that priority
  //  level repeats during the month.
  //  For example: if low = 2, every low-priority task is performed 2 times.
  // ================================================================
  const DEFAULT_PRIORITY_WEIGHTS = {
    critical: 10,  // S3, S6, S7, S18, S24, S25 (6 tasks × 10 = ~60 slots)
    high: 8,       // S1, S2, S4, S5, S15, S16 (6 tasks × 8 = ~48 slots)
    medium: 6,     // S8, S12 (2 tasks × 6 = ~12 slots)
    low: 2,        // S9, S10, S11, S13, S14, S17, S19, S20, S21, S22, S23 (11 tasks × 2 = ~22 slots)
  };

  // Category color palette for UI rendering
  const CATEGORY_COLORS = {
    'Engine Systems': { bg: 'rgba(0,212,255,0.1)', color: '#00d4ff' },
    'Fuel Systems': { bg: 'rgba(240,165,0,0.1)', color: '#f0a500' },
    'Control Systems': { bg: 'rgba(124,58,237,0.1)', color: '#a78bfa' },
    'Housekeeping': { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
    'Air Systems': { bg: 'rgba(56,189,248,0.1)', color: '#38bdf8' },
    'Safety': { bg: 'rgba(255,71,87,0.1)', color: '#ff4757' },
    'Electrical': { bg: 'rgba(0,230,118,0.1)', color: '#00e676' },
    'Utilities': { bg: 'rgba(251,113,133,0.1)', color: '#fb7185' },
  };

  // ================================================================
  //  SEEDED PSEUDO-RANDOM NUMBER GENERATOR  (mulberry32 algorithm)
  //  Returns a function rng() that yields floats in [0, 1).
  //  Using a seed makes each month's schedule deterministic —
  //  regenerating November 2026 always produces the same result.
  // ================================================================
  function createRNG(seed) {
    let s = seed >>> 0; // force unsigned 32-bit
    return function rng() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ================================================================
  //  EXACT REPEAT ALLOCATION
  //  Distributes `totalSlots` across tasks based on target repeats:
  //  Each task gets its priority's target repeats (e.g. low=2 -> 2 times).
  //  Remaining month slots are absorbed by critical/high priority tasks.
  //  Guarantees total count equals totalSlots and every task >= 1.
  // ================================================================
  function allocateSlots(tasks, weights, totalSlots) {
    const counts = {};

    // Step 1: Assign base target repeats per task
    tasks.forEach(t => {
      const target = Number(weights[t.priority]);
      counts[t.id] = Math.max(1, isNaN(target) ? 1 : Math.round(target));
    });

    let currentSum = Object.values(counts).reduce((sum, n) => sum + n, 0);

    // Step 2: If we have deficit slots to reach totalSlots in the month,
    // distribute the extra slots to higher priority tasks (critical, then high, then medium)
    // so the lower priority tasks remain strictly at the user's requested number (e.g. 2)
    if (currentSum < totalSlots) {
      let diff = totalSlots - currentSum;
      let higherTasks = tasks.filter(t => t.priority === 'critical' || t.priority === 'high');
      if (higherTasks.length === 0) higherTasks = tasks;
      let i = 0;
      while (diff > 0) {
        counts[higherTasks[i % higherTasks.length].id]++;
        diff--;
        i++;
      }
    } else if (currentSum > totalSlots) {
      // Step 3: If target repeats exceed total slots in month, trim surplus from lowest priority
      let diff = currentSum - totalSlots;
      const pOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const sorted = [...tasks].sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
      let i = 0;
      while (diff > 0 && i < sorted.length * 20) {
        const t = sorted[i % sorted.length];
        if (counts[t.id] > 1) {
          counts[t.id]--;
          diff--;
        }
        i++;
      }
    }

    // Step 4: Ensure every single task appears at least once
    tasks.forEach(t => {
      if (!counts[t.id] || counts[t.id] < 1) counts[t.id] = 1;
    });

    return counts;
  }

  // ================================================================
  //  CORE SCHEDULING ALGORITHM
  //  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  STRATEGY: Greedy with Cooldown Window
  //
  //  For each slot (day Ã— shift):
  //    1. Filter eligible tasks:
  //       a. Has remaining count > 0
  //       b. Not already assigned today (different shift = different task)
  //       c. Not assigned within the last `cooldownShifts` slots
  //    2. Sort eligible tasks by "urgency score":
  //         urgency = (remaining / allocated) + small_random_noise
  //       Tasks that have used fewer of their quota are more urgent.
  //    3. Pick the top eligible task.
  //    4. If no eligible tasks exist (rare edge case), progressively
  //       relax constraints (cooldown â†’ same-day ban â†’ none).
  // ================================================================
  function runScheduler(tasks, slotCounts, daysInMonth, rng, cooldownDays) {
    const cooldownShifts = cooldownDays * 6; // 6 slots per day now

    // Working state per task
    const state = {};
    tasks.forEach(t => {
      state[t.id] = {
        ...t,
        allocated: slotCounts[t.id],
        remaining: slotCounts[t.id],
        lastUsedSlot: -99, // never used yet
      };
    });

    const schedule = [];       // final output: array of day objects
    const recentSlots = [];    // flat history for cooldown checks

    let slotIndex = 0;         // global slot counter across all shifts

    for (let day = 1; day <= daysInMonth; day++) {
      const dayAssignments = []; // 6 unique task IDs per day (2 per shift)

      for (let slot = 0; slot < 6; slot++) {  // 6 slots: [S1a,S1b, S2a,S2b, S3a,S3b]
        // Build candidate list (progressive constraint relaxation)
        let chosen = null;

        for (let relaxLevel = 0; relaxLevel < 4 && !chosen; relaxLevel++) {
          const candidates = Object.values(state).filter(t => {
            if (t.remaining <= 0) return false;
            if (relaxLevel < 3 && dayAssignments.includes(t.id)) return false;        // same-day ban
            if (relaxLevel < 2 && (slotIndex - t.lastUsedSlot) < cooldownShifts) return false; // cooldown
            return true;
          });

          if (candidates.length === 0) continue;

          // Score: urgency (relative remaining %) + random jitter
          candidates.forEach(c => {
            c._score = (c.remaining / c.allocated) + (rng() * 0.25);
          });
          candidates.sort((a, b) => b._score - a._score);

          chosen = candidates[0];
        }

        if (!chosen) {
          // Absolute fallback: pick any task with remaining > 0
          const any = Object.values(state).find(t => t.remaining > 0);
          chosen = any || Object.values(state)[0];
        }

        // Assign
        state[chosen.id].remaining--;
        state[chosen.id].lastUsedSlot = slotIndex;
        dayAssignments.push(chosen.id);
        slotIndex++;
      }

      // Store day entry — 2 tasks per shift
      schedule.push({
        day,
        shift1a: dayAssignments[0], shift1b: dayAssignments[1],
        shift2a: dayAssignments[2], shift2b: dayAssignments[3],
        shift3a: dayAssignments[4], shift3b: dayAssignments[5],
      });
    }

    return { schedule, finalState: state };
  }

  // ================================================================
  //  PUBLIC API: generateMonthlySchedule
  //  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  @param year         {number}  e.g. 2026
  //  @param month        {number}  1â€“12
  //  @param customWeights {object} override DEFAULT_PRIORITY_WEIGHTS
  //  @param options      {object}  { cooldownDays: 1, seed: null }
  //
  //  @returns {
  //    year, month, daysInMonth,
  //    days: [ { date, dayName, day, shift1, shift2, shift3,
  //              status1, status2, status3 }, ... ],
  //    taskFrequencies: [ { id, name, allocated, ... } ],
  //    generatedAt
  //  }
  // ================================================================
  function generateMonthlySchedule(year, month, customWeights = {}, options = {}) {
    const weights = { ...DEFAULT_PRIORITY_WEIGHTS, ...customWeights };
    const cooldownDays = options.cooldownDays ?? 1;

    // Use year+month as base seed for reproducibility; admin can override
    const seed = options.seed != null ? options.seed : (year * 100 + month) * 1337;
    const rng = createRNG(seed);

    // Days in this month (month is 1-indexed)
    const daysInMonth = new Date(year, month, 0).getDate();
    const totalSlots = daysInMonth * 6; // 2 checks per shift × 3 shifts

    // Proportional slot allocation
    const slotCounts = allocateSlots(MASTER_TASKS, weights, totalSlots);

    // Run the scheduler
    const { schedule: rawSchedule, finalState } = runScheduler(
      MASTER_TASKS, slotCounts, daysInMonth, rng, cooldownDays
    );

    // Format output
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = rawSchedule.map(d => {
      const dateObj = new Date(year, month - 1, d.day);
      return {
        day: d.day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`,
        dayName: DAYS[dateObj.getDay()],
        shift1a: d.shift1a,
        shift1b: d.shift1b,
        shift2a: d.shift2a,
        shift2b: d.shift2b,
        shift3a: d.shift3a,
        shift3b: d.shift3b,
        // Legacy fallbacks
        shift1: d.shift1a,
        shift2: d.shift2a,
        shift3: d.shift3a,
        // Completion status — starts pending, updated by engineers
        status1a: 'pending', status1b: 'pending',
        status2a: 'pending', status2b: 'pending',
        status3a: 'pending', status3b: 'pending',
        doneBy1a: null, doneAt1a: null, notes1a: '',
        doneBy1b: null, doneAt1b: null, notes1b: '',
        doneBy2a: null, doneAt2a: null, notes2a: '',
        doneBy2b: null, doneAt2b: null, notes2b: '',
        doneBy3a: null, doneAt3a: null, notes3a: '',
        doneBy3b: null, doneAt3b: null, notes3b: '',
      };
    });

    // Task frequency summary for admin view
    const taskFrequencies = MASTER_TASKS.map(t => ({
      id: t.id,
      name: t.name,
      priority: t.priority,
      category: t.category,
      allocated: slotCounts[t.id],
      remaining: finalState[t.id]?.remaining ?? 0,
      actual: slotCounts[t.id] - (finalState[t.id]?.remaining ?? 0),
    }));

    return {
      year,
      month,
      daysInMonth,
      totalSlots,
      days,
      taskFrequencies,
      weights,
      seed,
      generatedAt: new Date().toISOString(),
    };
  }

  // ================================================================
  //  VALIDATION HELPER
  //  Returns per-task and per-constraint violation counts.
  // ================================================================
  function validateSchedule(scheduleData) {
    const { days } = scheduleData;
    const violations = [];
    const taskCount = {};

    days.forEach((d, di) => {
      const slots = [d.shift1a, d.shift1b, d.shift2a, d.shift2b, d.shift3a, d.shift3b];

      // Check: no duplicate tasks within same day
      const unique = new Set(slots);
      if (unique.size < 6) {
        violations.push({ day: d.day, type: 'SAME_DAY_DUPLICATE', slots });
      }

      // Check: no task repeated in same position on consecutive days
      if (di > 0) {
        const prev = days[di - 1];
        const prevSlots = [prev.shift1a, prev.shift1b, prev.shift2a, prev.shift2b, prev.shift3a, prev.shift3b];
        slots.forEach((id, si) => {
          if (id === prevSlots[si]) {
            violations.push({ day: d.day, type: 'CONSECUTIVE_SAME_SLOT', slot: si, task: id });
          }
        });
      }

      slots.forEach(id => { taskCount[id] = (taskCount[id] || 0) + 1; });
    });

    return {
      ok: violations.length === 0,
      violations,
      taskCount,
      minCount: Math.min(...Object.values(taskCount)),
      maxCount: Math.max(...Object.values(taskCount)),
      uniqueTasks: Object.keys(taskCount).length,
    };
  }

  // ================================================================
  //  UTILITY: get task by ID
  // ================================================================
  function getTask(id) {
    return MASTER_TASKS.find(t => t.id === id) || null;
  }

  function getTaskColor(id) {
    const task = getTask(id);
    if (!task) return { bg: 'rgba(100,116,139,0.1)', color: '#64748b' };
    return CATEGORY_COLORS[task.category] || { bg: 'rgba(100,116,139,0.1)', color: '#64748b' };
  }

  // ================================================================
  //  EXPORTS
  // ================================================================
  return {
    MASTER_TASKS,
    DEFAULT_PRIORITY_WEIGHTS,
    CATEGORY_COLORS,
    generateMonthlySchedule,
    validateSchedule,
    getTask,
    getTaskColor,
  };

})();
