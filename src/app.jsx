import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  ArrowRightLeft, 
  Plus, 
  BookOpen,
  GraduationCap,
  Bell,
  MoreVertical,
  ListTodo,
  PieChart,
  X,
  Ban
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* FIREBASE SETUP (YOUR CONFIG)                 */
/* -------------------------------------------------------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyAJMGUL8PGmSTAX324hXR7BS1PG7NFHEvI",
  authDomain: "my-timetable-12.firebaseapp.com",
  projectId: "my-timetable-12",
  storageBucket: "my-timetable-12.firebasestorage.app",
  messagingSenderId: "1025855918092",
  appId: "1:1025855918092:web:9661e91f284c485de9de29",
  measurementId: "G-GE9HDRN86R"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// This is the collection name where data will be stored in your database
const APP_COLLECTION_ID = 'timetable-tracker-main';

/* -------------------------------------------------------------------------- */
/* UTILITIES                                   */
/* -------------------------------------------------------------------------- */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${suffix}`;
};

const getDateForDayOfWeek = (dayName) => {
  const today = new Date();
  const currentDayIndex = today.getDay(); 
  const adjustedCurrentDayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
  const targetDayIndex = DAYS.indexOf(dayName);
  const diff = targetDayIndex - adjustedCurrentDayIndex;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  return targetDate.toISOString().split('T')[0];
};

const getWeekIdentifier = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day == 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

/* -------------------------------------------------------------------------- */
/* SUB-COMPONENTS                              */
/* -------------------------------------------------------------------------- */

const StatsModal = ({ isOpen, onClose, slots, logs, overrides }) => {
  if (!isOpen) return null;

  let totalClasses = 0;
  let presentClasses = 0;
  let totalStudy = 0;
  let completedStudy = 0;

  DAYS.forEach(day => {
    const dateStr = getDateForDayOfWeek(day);
    const daySlots = slots.filter(s => s.day === day);
    
    const activeSlots = daySlots.filter(s => {
      const overrideKey = `${s.id}_${dateStr}`;
      return !overrides[overrideKey]; 
    }).map(s => ({ ...s, id: s.id, instanceDate: dateStr }));

    const movedIn = Object.values(overrides).filter(o => 
      o.newDay === day && o.weekOf === getWeekIdentifier()
    ).map(o => ({
       id: o.slotId,
       type: slots.find(s => s.id === o.slotId)?.type || 'study',
       instanceDate: o.originalDate, 
       logKeyDate: o.originalDate
    }));

    const allDayEvents = [...activeSlots, ...movedIn];

    allDayEvents.forEach(slot => {
      const logId = `${slot.id}_${slot.logKeyDate || slot.instanceDate}`;
      const log = logs[logId];
      const status = log?.status;

      if (status === 'cancelled') return;

      const isPast = new Date() > new Date(`${getDateForDayOfWeek(day)}T23:59:59`);
      const hasStatus = !!status;

      if (isPast || hasStatus) {
        if (slot.type === 'class') {
          totalClasses++;
          if (status === 'present') presentClasses++;
        } else {
          totalStudy++;
          if (status === 'completed') completedStudy++;
        }
      }
    });
  });

  const classRate = totalClasses ? Math.round((presentClasses / totalClasses) * 100) : 0;
  const studyRate = totalStudy ? Math.round((completedStudy / totalStudy) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2"><PieChart size={20} /> Weekly Stats</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-6 grid gap-6">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Class Attendance</h3>
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-500" style={{ width: `${classRate}%` }}></div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-700">{classRate}%</p>
            <p className="text-xs text-slate-400">{presentClasses} / {totalClasses} classes</p>
          </div>

          <div className="text-center">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Study Goals</h3>
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-500" style={{ width: `${studyRate}%` }}></div>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-700">{studyRate}%</p>
            <p className="text-xs text-slate-400">{completedStudy} / {totalStudy} sessions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                              */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [user, setUser] = useState(null);
  
  // Data State
  const [slots, setSlots] = useState([]); 
  const [logs, setLogs] = useState({});   
  const [overrides, setOverrides] = useState({}); 
  
  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ open: false, slot: null });
  const [overrideModal, setOverrideModal] = useState({ open: false, slot: null, type: 'edit' });

  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [permission, setPermission] = useState(Notification.permission);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Form States
  const [formData, setFormData] = useState({
    title: '',
    type: 'class',
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
  });

  const [overrideForm, setOverrideForm] = useState({
    newDay: 'Monday',
    newStartTime: '',
    newEndTime: '',
    newTitle: ''
  });

  const [newTaskText, setNewTaskText] = useState("");

  /* ----------------------- INIT & SYNC ----------------------- */

  useEffect(() => {
    // Standalone Auth Logic
    const initAuth = async () => {
       try {
         await signInAnonymously(auth);
       } catch (error) {
         console.error("Auth Failed", error);
       }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // We use APP_COLLECTION_ID to group your data
    const userPath = [APP_COLLECTION_ID, 'users', user.uid];

    const unsubSlots = onSnapshot(collection(db, ...userPath, 'timetable_slots'), (snap) => {
      setSlots(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLogs = onSnapshot(collection(db, ...userPath, 'timetable_logs'), (snap) => {
      const loadedLogs = {};
      snap.docs.forEach(doc => loadedLogs[doc.id] = doc.data());
      setLogs(loadedLogs);
    });

    const unsubOverrides = onSnapshot(collection(db, ...userPath, 'timetable_overrides'), (snap) => {
      const loadedOverrides = {};
      snap.docs.forEach(doc => loadedOverrides[doc.id] = doc.data());
      setOverrides(loadedOverrides);
    });

    return () => { unsubSlots(); unsubLogs(); unsubOverrides(); };
  }, [user]);

  /* ----------------------- NOTIFICATIONS ----------------------- */
  
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkNotifications(now);
    }, 60000);
    return () => clearInterval(timer);
  }, [slots, overrides]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications");
        return;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
  };

  const checkNotifications = (now) => {
    if (permission !== 'granted') return;
    const currentDayName = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const events = getEventsForDay(currentDayName);
    
    events.forEach(event => {
       const [h, m] = event.startTime.split(':').map(Number);
       const eventMinutes = h * 60 + m;
       if (eventMinutes - currentMinutes === 15) {
         new Notification(`Upcoming: ${event.title}`, {
           body: `Starts at ${formatTime(event.startTime)}`
         });
       }
    });
  };

  /* ----------------------- LOGIC HANDLERS ----------------------- */

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!user) return;
    await addDoc(collection(db, APP_COLLECTION_ID, 'users', user.uid, 'timetable_slots'), {
      ...formData,
      createdAt: new Date()
    });
    setIsAddModalOpen(false);
    setFormData({ title: '', type: 'class', day: 'Monday', startTime: '09:00', endTime: '10:00' });
  };

  const updateStatus = async (slotId, dateKey, status) => {
    const logId = `${slotId}_${dateKey}`;
    const logRef = doc(db, APP_COLLECTION_ID, 'users', user.uid, 'timetable_logs', logId);
    await setDoc(logRef, {
      slotId,
      date: dateKey,
      status,
      updatedAt: new Date()
    }, { merge: true });
  };

  const addTask = async (slot) => {
    if (!newTaskText.trim()) return;
    const dateKey = slot.logKeyDate || slot.instanceDate;
    const logId = `${slot.id}_${dateKey}`;
    const logRef = doc(db, APP_COLLECTION_ID, 'users', user.uid, 'timetable_logs', logId);
    
    const currentLog = logs[logId] || { tasks: [] };
    const currentTasks = currentLog.tasks || [];
    
    const updatedTasks = [...currentTasks, { id: Date.now(), text: newTaskText, completed: false }];
    
    await setDoc(logRef, {
      slotId: slot.id,
      date: dateKey,
      tasks: updatedTasks,
      updatedAt: new Date()
    }, { merge: true });

    setNewTaskText("");
  };

  const toggleTask = async (slot, taskId) => {
    const dateKey = slot.logKeyDate || slot.instanceDate;
    const logId = `${slot.id}_${dateKey}`;
    const logRef = doc(db, APP_COLLECTION_ID, 'users', user.uid, 'timetable_logs', logId);
    
    const currentLog = logs[logId];
    if (!currentLog) return;

    const updatedTasks = currentLog.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );

    await updateDoc(logRef, { tasks: updatedTasks });
  };

  const handleEditInstance = async (e) => {
    e.preventDefault();
    if (!overrideModal.slot) return;
    
    const slot = overrideModal.slot;
    const originalDate = slot.logKeyDate || slot.instanceDate; 
    const overrideId = `${slot.id}_${originalDate}`;
    
    await setDoc(doc(db, APP_COLLECTION_ID, 'users', user.uid, 'timetable_overrides', overrideId), {
      slotId: slot.id,
      slotTitle: overrideForm.newTitle || slot.title,
      originalDate: originalDate,
      newDay: overrideForm.newDay,
      newStartTime: overrideForm.newStartTime,
      newEndTime: overrideForm.newEndTime,
      weekOf: getWeekIdentifier(), 
      createdAt: new Date()
    });
    setOverrideModal({ open: false, slot: null, type: 'edit' });
  };

  const handleCancelInstance = async (slot) => {
    if (!confirm("Cancel this session for this week?")) return;
    const dateKey = slot.logKeyDate || slot.instanceDate;
    await updateStatus(slot.id, dateKey, 'cancelled');
  };

  const handleDeletePermanent = async (slotId) => {
    if(!confirm("Delete this slot permanently from your schedule?")) return;
    await deleteDoc(doc(db, APP_COLLECTION_ID, 'users', user.uid, 'timetable_slots', slotId));
  };

  const getEventsForDay = (dayName) => {
    const dateStr = getDateForDayOfWeek(dayName);
    const regularSlots = slots.filter(s => s.day === dayName);

    const activeSlots = regularSlots.filter(s => {
      const overrideKey = `${s.id}_${dateStr}`;
      return !overrides[overrideKey]; 
    }).map(s => ({
      ...s,
      instanceDate: dateStr,
      isRescheduled: false,
      isOverride: false
    }));

    const movedHereSlots = Object.values(overrides).filter(o => 
      o.newDay === dayName && o.weekOf === getWeekIdentifier()
    ).map(o => {
      const original = slots.find(s => s.id === o.slotId) || { type: 'study' }; 
      return {
        id: o.slotId,
        title: o.slotTitle,
        type: original.type,
        startTime: o.newStartTime,
        endTime: o.newEndTime,
        day: o.newDay,
        instanceDate: dateStr,
        logKeyDate: o.originalDate,
        isRescheduled: true,
        isOverride: true
      };
    });

    return [...activeSlots, ...movedHereSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  /* ----------------------- UI RENDER ----------------------- */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      
      {/* HEADER */}
      <header className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              My Week
            </h1>
            <p className="text-indigo-100 text-xs opacity-90">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setIsStatsOpen(true)} className="p-2 rounded-full bg-indigo-700 text-indigo-100 hover:bg-indigo-800">
              <PieChart className="w-5 h-5" />
            </button>
            <button 
              onClick={requestNotificationPermission}
              className={`p-2 rounded-full ${permission === 'granted' ? 'bg-indigo-700 text-green-300' : 'bg-indigo-700 text-indigo-200'}`}
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-white text-indigo-600 px-3 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="max-w-6xl mx-auto p-4">
        
        {/* Mobile Tabs */}
        <div className="md:hidden flex overflow-x-auto pb-4 gap-2 mb-2 no-scrollbar">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedDay === day ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS.map(day => {
            const isHiddenMobile = day !== selectedDay;
            const events = getEventsForDay(day);
            const isToday = day === DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

            return (
              <div key={day} className={`flex flex-col gap-3 ${isHiddenMobile ? 'hidden md:flex' : 'flex'}`}>
                {/* Day Header */}
                <div className={`text-center py-2 rounded-t-lg font-bold border-b-4 ${isToday ? 'bg-white border-indigo-500 text-indigo-700 shadow-sm' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                  {day}
                  {isToday && <span className="block text-[10px] font-normal uppercase text-indigo-400">Today</span>}
                </div>

                {/* Slots */}
                <div className="flex flex-col gap-3 min-h-[200px]">
                  {events.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-slate-300 text-sm p-4 border-2 border-dashed border-slate-200 rounded-lg">
                      Free Day
                    </div>
                  )}

                  {events.map((slot) => {
                    // Status Check
                    const dateKey = slot.logKeyDate || slot.instanceDate;
                    const logId = `${slot.id}_${dateKey}`;
                    const logData = logs[logId];
                    const status = logData?.status || 'pending';
                    
                    if (status === 'cancelled') {
                      return (
                         <div key={slot.id} className="p-3 rounded-lg border-2 border-slate-100 bg-slate-50 opacity-60 flex justify-between items-center">
                           <div className="flex items-center gap-2 text-slate-400">
                             <Ban size={16} /> <span className="text-xs font-medium line-through">{slot.title}</span>
                           </div>
                           <button onClick={() => updateStatus(slot.id, dateKey, 'pending')} className="text-[10px] text-indigo-500 underline">Undo</button>
                         </div>
                      );
                    }

                    const isMissed = status === 'pending' && new Date() > new Date(`${getDateForDayOfWeek(day)}T${slot.endTime}`);
                    const isClass = slot.type === 'class';
                    
                    // Task Preview
                    const tasks = logData?.tasks || [];
                    const completedTasks = tasks.filter(t => t.completed).length;
                    
                    return (
                      <div 
                        key={`${slot.id}-${day}`} 
                        className={`relative group p-3 rounded-xl border-l-4 shadow-sm bg-white hover:shadow-md transition-all
                          ${isClass ? 'border-l-blue-500' : 'border-l-emerald-500'}
                          ${status === 'completed' || status === 'present' ? 'opacity-75 bg-slate-50' : ''}
                        `}
                      >
                        {/* Header Row */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-mono font-semibold text-slate-400">
                            {formatTime(slot.startTime)}
                          </span>
                          <div className="flex items-center gap-1">
                            {slot.isRescheduled && (
                              <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <ArrowRightLeft className="w-3 h-3" /> Shifted
                              </span>
                            )}
                            <div className="relative group/menu">
                              <button className="text-slate-300 hover:text-slate-600"><MoreVertical size={14} /></button>
                              <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-lg border border-slate-100 overflow-hidden hidden group-hover/menu:block z-10 w-32">
                                <button 
                                  onClick={() => {
                                    setOverrideForm({ newDay: slot.day, newStartTime: slot.startTime, newEndTime: slot.endTime, newTitle: slot.title });
                                    setOverrideModal({ open: true, slot, type: 'edit' });
                                  }}
                                  className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600"
                                >
                                  Edit this week
                                </button>
                                <button 
                                  onClick={() => handleCancelInstance(slot)}
                                  className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-amber-600"
                                >
                                  Cancel this week
                                </button>
                                <div className="border-t border-slate-100 my-0"></div>
                                <button 
                                  onClick={() => handleDeletePermanent(slot.id)}
                                  className="block w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-500"
                                >
                                  Delete Slot
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Title & Click for Details */}
                        <div 
                          className="cursor-pointer"
                          onClick={() => {
                             if (!isClass) setDetailsModal({ open: true, slot });
                          }}
                        >
                          <h3 className="font-bold text-slate-700 leading-tight flex items-center gap-2">
                            {slot.title}
                            {!isClass && tasks.length > 0 && (
                              <span className="text-[10px] font-normal bg-emerald-100 text-emerald-700 px-1.5 rounded-full">
                                {completedTasks}/{tasks.length}
                              </span>
                            )}
                          </h3>
                          {!isClass && (
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                              <ListTodo size={10} /> {tasks.length ? 'View Tasks' : 'Add Tasks'}
                            </p>
                          )}
                        </div>

                        {/* Actions Footer */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                          <div className="text-slate-300">
                             {isClass ? <GraduationCap size={16} /> : <BookOpen size={16} />}
                          </div>

                          <div className="flex gap-2">
                            {/* Class Actions */}
                            {isClass && status === 'pending' && !isMissed && (
                              <>
                                <button onClick={() => updateStatus(slot.id, dateKey, 'present')} className="text-green-600 bg-green-50 p-1 rounded hover:bg-green-100"><CheckCircle2 size={16}/></button>
                                <button onClick={() => updateStatus(slot.id, dateKey, 'absent')} className="text-red-500 bg-red-50 p-1 rounded hover:bg-red-100"><XCircle size={16}/></button>
                              </>
                            )}

                            {/* Study Actions */}
                            {!isClass && status === 'pending' && !isMissed && (
                               <button 
                                 onClick={() => updateStatus(slot.id, dateKey, 'completed')} 
                                 className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-bold hover:bg-emerald-100"
                               >
                                 Mark Done
                               </button>
                            )}

                            {/* Status Badges */}
                            {status === 'present' && <span className="text-xs text-green-600 font-bold flex gap-1 items-center"><CheckCircle2 size={12}/> Present</span>}
                            {status === 'absent' && <span className="text-xs text-red-500 font-bold flex gap-1 items-center"><XCircle size={12}/> Absent</span>}
                            {status === 'completed' && <span className="text-xs text-emerald-600 font-bold flex gap-1 items-center"><CheckCircle2 size={12}/> Done</span>}

                            {/* Missed / Recovery */}
                            {isMissed && !['present','completed','absent'].includes(status) && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-red-400">Missed</span>
                                <button 
                                  onClick={() => {
                                    setOverrideForm({ newDay: slot.day, newStartTime: slot.startTime, newEndTime: slot.endTime, newTitle: slot.title });
                                    setOverrideModal({ open: true, slot, type: 'edit' });
                                  }}
                                  className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-medium"
                                >
                                  Shift
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* STATS MODAL */}
      <StatsModal 
        isOpen={isStatsOpen} 
        onClose={() => setIsStatsOpen(false)}
        slots={slots}
        logs={logs}
        overrides={overrides}
      />

      {/* ADD SLOT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold">New Recurring Slot</h2>
              <button onClick={() => setIsAddModalOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddSlot} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Title</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Subject or Activity Name"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Type</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="class">Class</option>
                    <option value="study">Study Session</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Day</label>
                  <select 
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.day}
                    onChange={e => setFormData({...formData, day: e.target.value})}
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Start</label>
                  <input 
                    type="time" required
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">End</label>
                  <input 
                    type="time" required
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                  />
                </div>
              </div>

              <button type="submit" className="mt-2 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                Add to Schedule
              </button>
            </form>
          </div>
        </div>
      )}

      {/* OVERRIDE/EDIT MODAL */}
      {overrideModal.open && overrideModal.slot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" /> Edit This Session</h2>
              <button onClick={() => setOverrideModal({ open: false, slot: null, type: 'edit' })}><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-4 bg-amber-50 text-amber-900 text-sm">
              <p>You are changing <strong>only this week's</strong> instance of <strong>{overrideModal.slot.title}</strong>.</p>
            </div>

            <form onSubmit={handleEditInstance} className="p-6 flex flex-col gap-4">
               <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Title (Optional)</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={overrideForm.newTitle}
                  onChange={e => setOverrideForm({...overrideForm, newTitle: e.target.value})}
                  placeholder={overrideModal.slot.title}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">New Day</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={overrideForm.newDay}
                  onChange={e => setOverrideForm({...overrideForm, newDay: e.target.value})}
                >
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">New Start</label>
                  <input 
                    type="time" required
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={overrideForm.newStartTime}
                    onChange={e => setOverrideForm({...overrideForm, newStartTime: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">New End</label>
                  <input 
                    type="time" required
                    className="w-full border border-slate-300 rounded-lg p-2"
                    value={overrideForm.newEndTime}
                    onChange={e => setOverrideForm({...overrideForm, newEndTime: e.target.value})}
                  />
                </div>
              </div>

              <button type="submit" className="mt-2 bg-amber-500 text-white py-3 rounded-lg font-bold hover:bg-amber-600 transition-colors">
                Save Change
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SLOT DETAILS (TASKS) MODAL */}
      {detailsModal.open && detailsModal.slot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="bg-emerald-600 p-4 text-white flex justify-between items-center flex-shrink-0">
              <h2 className="font-bold flex items-center gap-2"><BookOpen className="w-5 h-5" /> {detailsModal.slot.title}</h2>
              <button onClick={() => setDetailsModal({ open: false, slot: null })}><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-4 bg-emerald-50 text-emerald-900 text-sm flex-shrink-0">
              <p>Tasks for <strong>{detailsModal.slot.day}</strong> ({detailsModal.slot.isRescheduled ? 'Rescheduled' : 'Regular'}).</p>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">To-Do List</h3>
               
               <div className="space-y-2 mb-4">
                 {(() => {
                   const dateKey = detailsModal.slot.logKeyDate || detailsModal.slot.instanceDate;
                   const logId = `${detailsModal.slot.id}_${dateKey}`;
                   const tasks = logs[logId]?.tasks || [];
                   
                   if (tasks.length === 0) return <p className="text-slate-400 italic text-sm">No tasks added yet.</p>;

                   return tasks.map(task => (
                     <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100">
                       <button 
                        onClick={() => toggleTask(detailsModal.slot, task.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}
                       >
                         {task.completed && <CheckCircle2 size={14} />}
                       </button>
                       <span className={`text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.text}</span>
                     </div>
                   ));
                 })()}
               </div>

               <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                 <input 
                   type="text" 
                   className="flex-1 border border-slate-300 rounded-lg p-2 text-sm"
                   placeholder="Add a new task..."
                   value={newTaskText}
                   onChange={e => setNewTaskText(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && addTask(detailsModal.slot)}
                 />
                 <button 
                  onClick={() => addTask(detailsModal.slot)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700"
                 >
                   Add
                 </button>
               </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
               <span className="text-xs text-slate-400">Marking slot as Done checks completion</span>
               {(() => {
                 const dateKey = detailsModal.slot.logKeyDate || detailsModal.slot.instanceDate;
                 const logId = `${detailsModal.slot.id}_${dateKey}`;
                 const status = logs[logId]?.status;
                 if (status !== 'completed') {
                   return (
                     <button 
                      onClick={() => {
                        updateStatus(detailsModal.slot.id, dateKey, 'completed');
                        setDetailsModal({open: false, slot: null});
                      }}
                      className="text-emerald-600 font-bold text-sm hover:underline"
                    >
                      Mark Slot Done
                    </button>
                   )
                 }
                 return <span className="text-emerald-600 font-bold text-sm flex items-center gap-1"><CheckCircle2 size={16}/> Completed</span>
               })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
