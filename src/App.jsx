import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, Trash2, ChevronLeft, ChevronRight, Calendar, Settings2 } from "lucide-react";

// -----------------------------
// Utilities
// -----------------------------
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const isSameDay = (a, b) => a.toDateString() === b.toDateString();
const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const startOfISOWeek = (date) => { const d = new Date(date); const day = d.getDay(); const diff = (day === 0 ? -6 : 1 - day); d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d; };
const hexToRgba = (hex, a = 1) => { if (!hex) return `rgba(16, 185, 129, ${a})`; let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); const num = parseInt(c, 16); const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255; return `rgba(${r}, ${g}, ${b}, ${a})`; };
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// Month grid helpers (Monday-start 6x7 grid)
const monthGridStart = (cursor) => { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const dow = (first.getDay() + 6) % 7; return addDays(first, -dow); };
const monthGridDays = (cursor) => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart(cursor), i));

// -----------------------------
// Storage
// -----------------------------
const LS_KEY = "habit-tracker-v1";
const loadState = () => { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const saveState = (state) => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} };

// Limits
const MAX_HABITS = 12; // hard cap
const MAX_DOTS = 12;   // visible dots per day in month view

export default function App() {
  const persisted = loadState() || {};
  const [viewMode, setViewMode] = useState("week");
  const [cursor, setCursor] = useState(new Date());
  const [habits, setHabits] = useState(persisted.habits ?? []);
  const [checks, setChecks] = useState(persisted.checks ?? {}); // { [habitId]: { [dateKey]: true } }
  const [congratsShownWeek, setCongratsShownWeek] = useState(persisted.congratsShownWeek ?? "");
  const [editingHabit, setEditingHabit] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Persist to localStorage on changes
  useEffect(() => { saveState({ habits, checks, congratsShownWeek }); }, [habits, checks, congratsShownWeek]);

  // Derived ranges
  const weekStart = useMemo(() => startOfISOWeek(cursor), [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const days = useMemo(() => {
    if (viewMode === "day") return [cursor];
    if (viewMode === "week") return weekDays;
    return monthGridDays(cursor); // month
  }, [viewMode, cursor, weekDays]);

  // Labels
  const monthLabel = useMemo(() => {
    if (viewMode === "day") {
      return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(cursor);
    }
    if (viewMode === "week") {
      const first = weekDays[0], last = weekDays[6];
      if (first.getMonth() !== last.getMonth()) {
        const f = new Intl.DateTimeFormat(undefined, { month: "short" }).format(first);
        const l = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(last);
        return `${f} – ${l}`;
      }
      return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(first);
    }
    // month view
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor);
  }, [viewMode, cursor, weekDays]);

  // Navigation
  const goPrev = () => {
    if (viewMode === "day") setCursor((d) => addDays(d, -1));
    else if (viewMode === "week") setCursor((d) => addDays(d, -7));
    else setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (viewMode === "day") setCursor((d) => addDays(d, 1));
    else if (viewMode === "week") setCursor((d) => addDays(d, 7));
    else setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  // Toggling & counts
  const toggleCheck = (habitId, day) => {
    if (viewMode === "month") return; // month is read-only for toggling
    const key = dateKey(day);
    setChecks((prev) => {
      const next = { ...prev };
      const h = { ...(next[habitId] || {}) };
      h[key] = !h[key];
      next[habitId] = h;
      return next;
    });
  };
  const countForDateSet = (habitId, dateList) => {
    const map = checks[habitId] || {};
    return dateList.reduce((acc, d) => acc + (map[dateKey(d)] ? 1 : 0), 0);
  };
  const countForWeek = (habitId) => countForDateSet(habitId, weekDays);

  // Add/Edit/Delete Habits
  const addHabit = () => {
    if (habits.length >= MAX_HABITS) {
      alert(`You can have up to ${MAX_HABITS} habits. Delete one to add another.`);
      return;
    }
    setEditingHabit({ id: uid(), name: "", color: "#6366f1", goal: 7, _isNew: true });
    setConfirmingDelete(false);
  };
  const requestEdit = (habit) => { setEditingHabit(habit); setConfirmingDelete(false); };
  const saveEdit = (id, values) => {
    if (editingHabit?._isNew) setHabits((hs) => [...hs, { id, ...values }]);
    else setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, ...values } : h)));
    setEditingHabit(null);
    setConfirmingDelete(false);
  };
  const removeHabit = (id) => {
    // Remove habit and ALL past ticks/history for that habit
    setHabits((hs) => hs.filter((h) => h.id !== id));
    setChecks((c) => { const clone = { ...c }; delete clone[id]; return clone; });
    setEditingHabit(null);
    setConfirmingDelete(false);
  };

  // Congrats only once per week (for current cursor week)
  const weekKey = useMemo(() => `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`, [weekStart]);
  useEffect(() => {
    if (!habits.length) return;
    const allMet = habits.every((h) => h.goal > 0 && countForWeek(h.id) >= h.goal);
    if (allMet && congratsShownWeek !== weekKey) setShowCongrats(true);
    if (!allMet) setShowCongrats(false);
  }, [checks, habits, weekKey, congratsShownWeek]);

  // Layout sizing (kept tight so 7 days fit on small phones)
  const cellHeight = viewMode === "day" ? "h-12 sm:h-14" : "h-8 sm:h-11";
  const dayCols = viewMode === "day" ? 1 : 7;
  const dateBadge = viewMode === "day" ? "w-7 h-7 sm:w-8 sm:h-8" : "w-5 h-5 sm:w-6 sm:h-6";

  const HabitLabel = ({ h }) => (
    <button className="text-left px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-3 select-none hover:bg-neutral-50" onClick={() => requestEdit(h)}>
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color || "#10b981" }} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-sm sm:text-base">{h.name || "New Habit"}</div>
        <div className="text-[11px] sm:text-xs text-neutral-500 truncate">{countForWeek(h.id)}/{h.goal}</div>
      </div>
    </button>
  );

  // Sanity tests (runtime assertions)
  useEffect(() => {
    try {
      console.assert(dateKey(new Date("2025-08-11")) === "2025-08-11", "dateKey OK");
      console.assert(monthGridDays(new Date()).length === 42, "month grid 6x7");
      console.assert(typeof removeHabit === "function", "removeHabit present");
      console.assert(MAX_HABITS === 12 && MAX_DOTS === 12, "limits set");
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col items-center py-4 sm:py-6">
      <div className="w-full max-w-5xl px-2 sm:px-3">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-neutral-500">
            <Calendar className="w-5 h-5" />
            <span className="text-xs sm:text-sm capitalize">{viewMode} view</span>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label="Previous" className="p-2 rounded-xl hover:bg-neutral-200/70 active:bg-neutral-300" onClick={goPrev}><ChevronLeft className="w-5 h-5" /></button>
            <div className="px-3 py-1.5 rounded-xl bg-neutral-200 text-neutral-900 text-sm font-medium select-none">{monthLabel}</div>
            <button aria-label="Next" className="p-2 rounded-xl hover:bg-neutral-200/70 active:bg-neutral-300" onClick={goNext}><ChevronRight className="w-5 h-5" /></button>
            {/* New Habit button: icon-only on phones, text on >= sm */}
            <button onClick={addHabit} className="inline-flex items-center gap-2 px-2 py-2 sm:px-3 sm:py-2 rounded-2xl bg-neutral-200 text-neutral-900 text-xs sm:text-sm font-medium shadow-sm hover:shadow-md">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Habit</span>
            </button>
            <button onClick={() => setShowSettings(v => !v)} className="p-2 rounded-xl hover:bg-neutral-200/70"><Settings2 className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Empty state */}
        {!habits.length && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-6 sm:p-8 text-center mb-3">
            <div className="text-neutral-700 text-sm sm:text-base">No habits yet.</div>
            <div className="text-neutral-500 text-xs sm:text-sm mt-1">Tap <span className="font-medium">+ New Habit</span> to get started.</div>
            <button onClick={addHabit} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-neutral-200 text-neutral-900 text-sm font-medium hover:shadow-md"><Plus className="w-4 h-4"/>Add your first habit</button>
          </div>
        )}

        {/* DAY/WEEK */}
        {viewMode !== "month" && habits.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {/* Header row */}
            <div className="text-xs sm:text-sm" style={{ display: "grid", gridTemplateColumns: `160px repeat(${dayCols}, minmax(26px, 1fr))` }}>
              <div className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-neutral-700">Habits</div>
              {days.map((d, i) => (
                <div key={i} className={`px-1 py-1.5 text-center font-semibold ${isSameDay(d, new Date()) ? "text-neutral-900" : "text-neutral-500"}`}>
                  <div>{new Intl.DateTimeFormat(undefined, { weekday: dayCols === 1 ? "long" : "short" }).format(d)}</div>
                  <div className={`${dateBadge} mt-0.5 inline-flex items-center justify-center rounded-full ${isSameDay(d, new Date()) ? "ring-2 ring-neutral-300 bg-neutral-50 text-neutral-900" : "bg-neutral-100 text-neutral-700"}`}>{d.getDate()}</div>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-neutral-200">
              {habits.map((h) => (
                <div key={h.id} style={{ display: "grid", gridTemplateColumns: `160px repeat(${dayCols}, minmax(26px, 1fr))` }}>
                  <HabitLabel h={h} />
                  {days.map((d, i) => {
                    const key = dateKey(d);
                    const done = !!(checks[h.id]?.[key]);
                    const tint = h.color || "#10b981";
                    return (
                      <button key={i} onClick={() => toggleCheck(h.id, d)} className={`m-1 rounded-xl border flex items-center justify-center ${cellHeight}`} style={done ? { backgroundColor: hexToRgba(tint, 0.18), borderColor: hexToRgba(tint, 0.35) } : { borderColor: "#e5e7eb", backgroundColor: "#ffffff" }}>
                        {done ? <Check className="w-4 h-4" /> : <span className="text-neutral-400">–</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MONTH (with per-habit colours & legend) */}
        {viewMode === "month" && habits.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1 text-[11px] sm:text-xs mb-1 text-neutral-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => <div key={w} className="px-2 py-1 text-center font-semibold">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {days.map((d, idx) => (
                <div key={idx} className={`border rounded-lg p-1.5 h-16 sm:h-20 ${isSameDay(d, new Date()) ? "ring-2 ring-neutral-300 bg-neutral-50" : "bg-white"} ${isSameMonth(d, cursor) ? "opacity-100" : "opacity-50"}`}>
                  <div className="font-semibold text-neutral-700 text-[11px] sm:text-xs">{d.getDate()}</div>
                  {/* Fixed-size grid of dots: up to 12, fits small phones without overlap */}
                  <div className="mt-1 grid grid-cols-6 gap-0.5 sm:gap-1">
                    {habits.slice(0, MAX_DOTS).map((h) => {
                      const done = !!(checks[h.id]?.[dateKey(d)]);
                      const tint = h.color || "#10b981";
                      const style = done ? { backgroundColor: hexToRgba(tint, 1), borderColor: hexToRgba(tint, 1) } : { borderColor: "#e5e7eb", backgroundColor: "transparent" };
                      return <span key={h.id + dateKey(d)} className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full border" style={style} title={h.name}></span>;
                    })}
                    {habits.length > MAX_DOTS && (
                      <span className="col-span-6 text-[9px] text-neutral-400">+{habits.length - MAX_DOTS} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex gap-3 mt-2 flex-wrap">
              {habits.map(h => (
                <div key={h.id} className="flex items-center gap-2 text-[11px] text-neutral-600">
                  <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: h.color, borderColor: h.color }}></span>
                  <span>{h.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings sheet (view toggle only) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)}>
            <motion.div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-auto" initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Settings</h3>
                <button className="px-3 py-1.5 rounded-xl bg-neutral-200 text-neutral-900 text-sm" onClick={() => setShowSettings(false)}>Done</button>
              </div>
              <div className="inline-flex rounded-xl overflow-hidden border border-neutral-300">
                {["day", "week", "month"].map((m) => (
                  <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1.5 ${viewMode === m ? "bg-neutral-200 text-neutral-900" : "bg-white text-neutral-700"}`}>{m[0].toUpperCase() + m.slice(1)}</button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Habit modal */}
      <AnimatePresence>
        {editingHabit && (
          <motion.div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md bg-white rounded-2xl p-5" initial={{ scale: 0.98, y: 8, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.98, y: 8, opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{editingHabit._isNew ? "Add Habit" : "Edit Habit"}</h3>
                {/* Always-visible delete on mobile */}
                {!editingHabit._isNew && (
                  <button type="button" aria-label="Delete habit" className="p-2 rounded-xl border border-neutral-300 text-red-600 sm:hidden" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const values = { name: (f.get("name") || "").toString().trim() || "New Habit", goal: Math.max(1, Number(f.get("goal") || 7)), color: f.get("color") || editingHabit.color }; saveEdit(editingHabit.id, values); }} className="space-y-4">
                <div>
                  <label className="text-sm text-neutral-600">Name</label>
                  <input name="name" defaultValue={editingHabit.name} placeholder="e.g. 10k steps" className="mt-1 w-full px-3 py-2 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                </div>
                <div>
                  <label className="text-sm text-neutral-600">Weekly goal (1–7)</label>
                  <input name="goal" type="number" min={1} max={7} defaultValue={editingHabit.goal} className="mt-1 w-full px-3 py-2 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                </div>
                <div>
                  <label className="text-sm text-neutral-600">Colour</label>
                  <input name="color" type="color" defaultValue={editingHabit.color || "#10b981"} className="mt-1 w-full h-10 px-3 py-2 rounded-xl border border-neutral-300 bg-white" />
                </div>

                {/* Desktop delete button */}
                {!editingHabit._isNew && (
                  <div className="flex justify-between items-center pt-2">
                    <button type="button" onClick={() => setConfirmingDelete(true)} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-300 text-red-600"><Trash2 className="w-4 h-4" />Delete</button>
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={() => setEditingHabit(null)} className="px-3 py-2 rounded-xl border border-neutral-300">Cancel</button>
                      <button type="submit" className="px-3 py-2 rounded-xl bg-neutral-200 text-neutral-900">Save</button>
                    </div>
                  </div>
                )}

                {editingHabit._isNew && (
                  <div className="flex justify-end items-center pt-2">
                    <button type="button" onClick={() => setEditingHabit(null)} className="px-3 py-2 rounded-xl border border-neutral-300">Cancel</button>
                    <button type="submit" className="ml-2 px-3 py-2 rounded-xl bg-neutral-200 text-neutral-900">Save</button>
                  </div>
                )}
              </form>

              {/* Inline confirm bar to avoid mobile confirm() issues */}
              <AnimatePresence>
                {confirmingDelete && !editingHabit._isNew && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700">
                    <div className="text-sm">Delete this habit and all its history?</div>
                    <div className="mt-2 flex gap-2 justify-end">
                      <button onClick={() => setConfirmingDelete(false)} className="px-3 py-1.5 rounded-xl border border-red-200 bg-white">Cancel</button>
                      <button onClick={() => removeHabit(editingHabit.id)} className="px-3 py-1.5 rounded-xl bg-red-600 text-white">Delete</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Congrats modal */}
      <AnimatePresence>
        {showCongrats && (
          <motion.div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-sm bg-white rounded-2xl p-6 text-center" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="font-semibold text-lg">All goals smashed!</h3>
              <p className="text-sm text-neutral-600 mt-1">You completed every habit for this week. Brilliant work.</p>
              <button onClick={() => { setShowCongrats(false); setCongratsShownWeek(weekKey); }} className="mt-4 px-4 py-2 rounded-xl bg-neutral-200 text-neutral-900">Nice!</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
