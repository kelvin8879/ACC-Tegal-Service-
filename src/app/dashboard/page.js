'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFirstLoadRef = useRef(true);

  // Database Connection and Size States
  const [dbStatus, setDbStatus] = useState('CHECKING'); // 'CONNECTED' | 'DISCONNECTED' | 'CHECKING'
  const [dbSize, setDbSize] = useState({ size_mb: 0.02, is_almost_full: false });

  // Filter & Search State
  const [activeTab, setActiveTab] = useState('Prospek'); // 'Prospek', 'Aplikasi IN', 'Aplikasi Valid'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSegment, setFilterSegment] = useState('');
  const [filterOfficer, setFilterOfficer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal States
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // To toggle between Add and Edit for Prospek
  const [isLengkapiModalOpen, setIsLengkapiModalOpen] = useState(false);
  const [isDateValidModalOpen, setIsDateValidModalOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);

  // Form States
  // 1. Input/Edit Prospek Form
  const [inputForm, setInputForm] = useState({
    pengajuan: 'Non Top Up',
    nama: '',
    alamat: '',
    status: 'Open',
    progress: '',
    call: false,
    blasting: false,
    note: '',
  });

  const [activeInputTab, setActiveInputTab] = useState('Prospek');
  const [contacting, setContacting] = useState([]);
  const [contactingForm, setContactingForm] = useState({
    call: '',
    blasting: '',
  });

  // Date Filter for Officer Performance Table
  const [perfQuickFilter, setPerfQuickFilter] = useState('month'); // 'today' | 'month' | 'custom'
  const [filterOfficerPerf, setFilterOfficerPerf] = useState('');
  const [filterOfficerAct, setFilterOfficerAct] = useState('');
  const [filterOfficerPipe, setFilterOfficerPipe] = useState('');
  const [filterDivisionAct, setFilterDivisionAct] = useState('');
  const [filterDivisionPipe, setFilterDivisionPipe] = useState('');
  const [filterDivisionPerf, setFilterDivisionPerf] = useState('');
  const [filterDivisionMon, setFilterDivisionMon] = useState('');
  const [filterDivisionManage, setFilterDivisionManage] = useState('');
  const [filterOfficerManage, setFilterOfficerManage] = useState('');
  const [selectedWaProspectId, setSelectedWaProspectId] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Helper to generate UUIDs
  const generateUUID = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Chart 1 Metric Visibility Toggles
  const [showCallLine, setShowCallLine] = useState(true);
  const [showBlastingLine, setShowBlastingLine] = useState(true);
  const [showProspekLine, setShowProspekLine] = useState(true);

  // Chart 2 (Pipeline) Metric Visibility Toggles
  const [showPipeProspek, setShowPipeProspek] = useState(true);
  const [showPipeAplikasiIn, setShowPipeAplikasiIn] = useState(true);
  const [showPipeAplikasiValid, setShowPipeAplikasiValid] = useState(true);

  // Date Filter for Monitoring Aplikasi
  const [appQuickFilter, setAppQuickFilter] = useState('month'); // 'today' | 'month' | 'custom'

  // Get today's business date
  const getTodayBusinessDateStr = () => {
    const now = new Date();
    // Shift to UTC+7 first, then apply 3-hour business day shift
    const localTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const shifted = new Date(localTime.getTime() - (3 * 60 * 60 * 1000));
    return shifted.toISOString().split('T')[0];
  };

  const getStartOfMonthStr = () => {
    const todayStr = getTodayBusinessDateStr();
    return todayStr.slice(0, 8) + '01';
  };

  const [perfStartDate, setPerfStartDate] = useState(getStartOfMonthStr());
  const [perfEndDate, setPerfEndDate] = useState(getTodayBusinessDateStr());

  // Date Filter for Tren Pipeline Aplikasi (Chart 2)
  const [pipeQuickFilter, setPipeQuickFilter] = useState('7days'); // '7days' | '15days' | '30days' | 'custom'
  const [pipeStartDate, setPipeStartDate] = useState(getStartOfMonthStr());
  const [pipeEndDate, setPipeEndDate] = useState(getTodayBusinessDateStr());

  // Date Filter for Tren Aktivitas & Prospek (Chart 1)
  const [actQuickFilter, setActQuickFilter] = useState('7days'); // '7days' | '15days' | '30days' | 'custom'
  const [actStartDate, setActStartDate] = useState(getStartOfMonthStr());
  const [actEndDate, setActEndDate] = useState(getTodayBusinessDateStr());

  const [appStartDate, setAppStartDate] = useState(getStartOfMonthStr());
  const [appEndDate, setAppEndDate] = useState(getTodayBusinessDateStr());

  // 2. Lengkapi/Edit Data Form (For Aplikasi IN)
  const [inForm, setInForm] = useState({
    segment: '',
    no_reg: '',
    date_in: '',
    status: 'On Progress',
    keterangan: '',
  });

  // 3. Date Valid Form (For transitioning from IN to Valid, and editing Valid date)
  const [dateValid, setDateValid] = useState('');

  // Coordinator Form
  const [newOfficerName, setNewOfficerName] = useState('');
  const [newOfficerPin, setNewOfficerPin] = useState('');
  const [newOfficerEmail, setNewOfficerEmail] = useState('');
  const [editingOfficerId, setEditingOfficerId] = useState(null);
  const [editingOfficerEmail, setEditingOfficerEmail] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [coordError, setCoordError] = useState('');
  const [coordSuccess, setCoordSuccess] = useState('');

  // Session check
  useEffect(() => {
    const session = sessionStorage.getItem('acc_session');
    if (!session) {
      router.replace('/');
    } else {
      setUser(JSON.parse(session));
    }
  }, [router]);

  // Helper to check if a prospect was created within the current business day (resets at 3:00 AM)
  const isCreatedWithinCurrentBusinessDay = useCallback((createdAtStr) => {
    if (!createdAtStr) return false;
    try {
      const createdDate = new Date(createdAtStr);

      const now = new Date();
      const startOfBusinessDay = new Date(now);
      if (now.getHours() < 3) {
        // If it's before 3 AM, the business day started yesterday at 3 AM
        startOfBusinessDay.setDate(startOfBusinessDay.getDate() - 1);
      }
      startOfBusinessDay.setHours(3, 0, 0, 0);

      const endOfBusinessDay = new Date(startOfBusinessDay);
      endOfBusinessDay.setDate(endOfBusinessDay.getDate() + 1);

      return createdDate >= startOfBusinessDay && createdDate < endOfBusinessDay;
    } catch (e) {
      return false;
    }
  }, []);

  const getBusinessDateString = (createdAtStr) => {
    if (!createdAtStr) return '';
    try {
      const date = new Date(createdAtStr);
      // Shift to UTC+7 first, then apply 3-hour business day shift
      const localTime = new Date(date.getTime() + (7 * 60 * 60 * 1000));
      const shiftedDate = new Date(localTime.getTime() - (3 * 60 * 60 * 1000));
      return shiftedDate.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const isDateWithinRange = (dateStr, startDate, endDate) => {
    if (!dateStr) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };

  // Sync offline queue to Supabase
  const syncOfflineData = useCallback(async () => {
    if (isSyncing) return;
    const queue = JSON.parse(localStorage.getItem('acc_sync_queue') || '[]');
    if (queue.length === 0) return;

    // Check if online
    try {
      const { error } = await supabase.from('officers').select('id').limit(1);
      if (error) return; // Still offline
    } catch (e) {
      return; // Offline
    }

    setIsSyncing(true);
    const remainingQueue = [...queue];

    for (const item of queue) {
      try {
        let error;
        if (item.action === 'insert') {
          const res = await supabase.from(item.table).insert([item.payload]);
          error = res.error;
        } else if (item.action === 'update') {
          const res = await supabase.from(item.table).update(item.payload).eq('id', item.targetId);
          error = res.error;
        } else if (item.action === 'delete') {
          const res = await supabase.from(item.table).delete().eq('id', item.targetId);
          error = res.error;
        }
        if (error) throw error;

        remainingQueue.shift();
        localStorage.setItem('acc_sync_queue', JSON.stringify(remainingQueue));
      } catch (err) {
        console.error('Failed to sync item:', item, err);
        // If it's a structural database error (not a network error), skip to avoid blockages
        if (err.status && err.status !== 0) {
          remainingQueue.shift();
          localStorage.setItem('acc_sync_queue', JSON.stringify(remainingQueue));
        } else {
          break; // Network error, stop sync for now
        }
      }
    }
    setIsSyncing(false);
    loadData();
  }, [isSyncing]);

  // Helper to sanitize prospect status based on its pipeline stage
  const sanitizeProspect = (p) => {
    if (!p) return p;
    const pipeline = p.pipeline || 'Prospek';
    let status = p.status;

    if (pipeline === 'Prospek') {
      if (status !== 'Open' && status !== 'Close') {
        status = 'Open';
      }
    } else if (pipeline === 'Aplikasi IN') {
      const validStatuses = ['Belum Melengkapi Data', 'On Progress', 'RE', 'NB', 'OV', 'DP OP', 'Open', 'Close'];
      if (!validStatuses.includes(status)) {
        status = 'Open';
      }
    } else if (pipeline === 'Aplikasi Valid') {
      status = 'OV';
    }

    return {
      ...p,
      pipeline,
      status
    };
  };

  // Helper to check if a prospect belongs to the Operation division
  const isOperationProspect = (p) => {
    if (!user) return false;
    if (user.role === 'officer' && user.division === 'Operation') return true;
    if (user.role === 'coordinator' && user.coordRole === 'operation') return true;
    if (p && p.officer_id) {
      const officer = officers.find(o => o.id === p.officer_id);
      if (officer && officer.division === 'Operation') return true;
    }
    return false;
  };

  // Handle write operations with offline fallback
  async function executeWrite(action, table, payload, targetId = null) {
    const isOnlineNow = navigator.onLine;
    let success = false;

    if (isOnlineNow) {
      try {
        let error;
        if (action === 'insert') {
          const res = await supabase.from(table).insert([payload]);
          error = res.error;
        } else if (action === 'update') {
          const res = await supabase.from(table).update(payload).eq('id', targetId);
          error = res.error;
        } else if (action === 'delete') {
          const res = await supabase.from(table).delete().eq('id', targetId);
          error = res.error;
        }

        if (!error) {
          success = true;
          setIsOffline(false);
        } else {
          console.warn('Supabase write error, queueing locally:', error.message);
        }
      } catch (err) {
        console.warn('Network write error, queueing locally:', err.message);
      }
    }

    if (!success) {
      const queue = JSON.parse(localStorage.getItem('acc_sync_queue') || '[]');
      queue.push({
        id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        table,
        action,
        payload,
        targetId,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('acc_sync_queue', JSON.stringify(queue));
      setIsOffline(true);
    }

    // Optimistically update React State
    if (table === 'prospects') {
      let updatedProspects = [...prospects];
      if (action === 'insert') {
        updatedProspects = [sanitizeProspect(payload), ...prospects];
      } else if (action === 'update') {
        updatedProspects = prospects.map(p => p.id === targetId ? sanitizeProspect({ ...p, ...payload }) : p);
      } else if (action === 'delete') {
        updatedProspects = prospects.filter(p => p.id !== targetId);
      }
      setProspects(updatedProspects);
      localStorage.setItem('acc_prospects_cache', JSON.stringify(updatedProspects));
    }

    if (success) {
      await loadData();
    }
  }

  // Load Data
  const loadData = useCallback(async () => {
    if (!user) return;
    if (isFirstLoadRef.current) {
      setLoading(true);
    }

    let rawProspects = [];
    let rawOfficers = [];
    let rawContacting = [];

    // Load from Supabase
    try {
      // 1. Load Officers
      let officerQuery = supabase
        .from('officers')
        .select('*')
        .order('name', { ascending: true });

      if (user.role === 'coordinator' && user.coordRole !== 'master') {
        const divMap = {
          operation: 'Operation',
          pe: 'PE',
          cabang: 'Cabang'
        };
        const division = divMap[user.coordRole];
        if (division) {
          officerQuery = officerQuery.eq('division', division);
        }
      }

      const { data: oData, error: oError } = await officerQuery;
      if (oError) throw oError;
      rawOfficers = (oData || []).map(o => ({
        ...o,
        division: o.division || 'Operation'
      }));
      localStorage.setItem('acc_officers_cache', JSON.stringify(rawOfficers));

      const allowedOfficerIds = rawOfficers.map(o => o.id);

      // 2. Load Prospects
      let pData = [];
      if (user.role === 'officer') {
        const { data, error: pError } = await supabase
          .from('prospects')
          .select('*')
          .eq('officer_id', user.id)
          .order('created_at', { ascending: false });
        if (pError) throw pError;
        pData = data || [];
      } else if (user.role === 'coordinator' && user.coordRole !== 'master') {
        if (allowedOfficerIds.length > 0) {
          const { data, error: pError } = await supabase
            .from('prospects')
            .select('*')
            .in('officer_id', allowedOfficerIds)
            .order('created_at', { ascending: false });
          if (pError) throw pError;
          pData = data || [];
        }
      } else {
        // Master coordinator
        const { data, error: pError } = await supabase
          .from('prospects')
          .select('*')
          .order('created_at', { ascending: false });
        if (pError) throw pError;
        pData = data || [];
      }
      rawProspects = pData.map(sanitizeProspect);
      localStorage.setItem('acc_prospects_cache', JSON.stringify(rawProspects));

      // 3. Load Contacting
      let cData = [];
      if (user.role === 'officer') {
        const { data, error: cError } = await supabase
          .from('contacting')
          .select('*')
          .eq('officer_id', user.id)
          .order('created_at', { ascending: false });
        if (!cError) cData = data || [];
      } else if (user.role === 'coordinator' && user.coordRole !== 'master') {
        if (allowedOfficerIds.length > 0) {
          const { data, error: cError } = await supabase
            .from('contacting')
            .select('*')
            .in('officer_id', allowedOfficerIds)
            .order('created_at', { ascending: false });
          if (!cError) cData = data || [];
        }
      } else {
        // Master coordinator
        const { data, error: cError } = await supabase
          .from('contacting')
          .select('*')
          .order('created_at', { ascending: false });
        if (!cError) cData = data || [];
      }
      rawContacting = cData;
      localStorage.setItem('acc_contacting_cache', JSON.stringify(rawContacting));

      setIsOffline(false);
    } catch (err) {
      console.warn('Offline or network error, loading from local cache:', err.message);
      setIsOffline(true);

      const cachedProspects = localStorage.getItem('acc_prospects_cache');
      const cachedOfficers = localStorage.getItem('acc_officers_cache');
      const cachedContacting = localStorage.getItem('acc_contacting_cache');

      rawProspects = cachedProspects ? JSON.parse(cachedProspects).map(sanitizeProspect) : [];
      rawOfficers = cachedOfficers ? JSON.parse(cachedOfficers) : [];
      rawContacting = cachedContacting ? JSON.parse(cachedContacting) : [];
    }

    // Apply Role-Based Access Control Filters (Secondary safeguard in frontend)
    let filteredOfficers = rawOfficers;
    let filteredProspects = rawProspects;
    let filteredContacting = rawContacting;

    if (user.role === 'coordinator' && user.coordRole !== 'master') {
      if (user.coordRole === 'operation') {
        filteredOfficers = rawOfficers.filter(o => o.division === 'Operation');
      } else if (user.coordRole === 'pe') {
        filteredOfficers = rawOfficers.filter(o => o.division === 'PE');
      } else if (user.coordRole === 'cabang') {
        filteredOfficers = rawOfficers.filter(o => o.division === 'Cabang');
      }
      const allowedOfficerIds = filteredOfficers.map(o => o.id);
      filteredProspects = rawProspects.filter(p => allowedOfficerIds.includes(p.officer_id));
      filteredContacting = rawContacting.filter(c => allowedOfficerIds.includes(c.officer_id));
    }

    // Apply pending local queue updates to the loaded data (to prevent reverting UI state while offline/syncing)
    const queue = JSON.parse(localStorage.getItem('acc_sync_queue') || '[]');
    if (queue.length > 0) {
      queue.forEach(item => {
        if (item.table === 'prospects') {
          if (item.action === 'insert') {
            if (!filteredProspects.some(p => p.id === item.payload.id)) {
              filteredProspects = [sanitizeProspect(item.payload), ...filteredProspects];
            }
          } else if (item.action === 'update') {
            filteredProspects = filteredProspects.map(p => 
              p.id === item.targetId ? sanitizeProspect({ ...p, ...item.payload }) : p
            );
          } else if (item.action === 'delete') {
            filteredProspects = filteredProspects.filter(p => p.id !== item.targetId);
          }
        } else if (item.table === 'contacting') {
          if (item.action === 'insert') {
            if (!filteredContacting.some(c => c.id === item.payload.id)) {
              filteredContacting = [item.payload, ...filteredContacting];
            }
          } else if (item.action === 'update') {
            filteredContacting = filteredContacting.map(c => 
              c.id === item.targetId ? { ...c, ...item.payload } : c
            );
          } else if (item.action === 'delete') {
            filteredContacting = filteredContacting.filter(c => c.id !== item.targetId);
          }
        }
      });
    }

    setOfficers(filteredOfficers);
    setProspects(filteredProspects);
    setContacting(filteredContacting);
    setLoading(false);
    isFirstLoadRef.current = false;
  }, [user]);

  useEffect(() => {
    loadData();

    // Listen for online/offline status
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineData();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Check Supabase connection and size
  useEffect(() => {
    if (!user) return;

    const checkConnection = async () => {
      try {
        const { error: connError } = await supabase.from('prospects').select('id').limit(1);
        if (connError) throw connError;
        setDbStatus('CONNECTED');

        const { data: sizeData, error: sizeError } = await supabase.rpc('get_db_size');
        if (!sizeError && sizeData && sizeData.length > 0) {
          setDbSize({
            size_mb: Number(sizeData[0].size_mb),
            is_almost_full: Boolean(sizeData[0].is_almost_full)
          });
        } else {
          // Fallback estimate based on number of prospects if RPC is not available
          const estimateMb = Math.max(0.01, (prospects.length * 0.002)).toFixed(3);
          setDbSize({
            size_mb: Number(estimateMb),
            is_almost_full: false
          });
        }
      } catch (err) {
        console.error('Database connection check failed:', err);
        setDbStatus('DISCONNECTED');
      }
    };

    checkConnection();
  }, [user, prospects]);

  // Logout
  const handleLogout = () => {
    sessionStorage.removeItem('acc_session');
    router.replace('/');
  };

  // Save/Update helper
  async function saveProspectsList() {
    await loadData(); // Reload from Supabase
  }

  // Open Edit Prospek Modal
  function openEditProspek(prospect) {
    setSelectedProspect(prospect);
    setIsEditMode(true);
    setInputForm({
      pengajuan: prospect.pengajuan,
      nama: prospect.nama,
      alamat: prospect.alamat || '',
      status: prospect.status || 'Open',
      progress: prospect.progress || '',
      call: prospect.call || false,
      blasting: prospect.blasting || false,
      note: prospect.note || '',
    });
    setIsInputModalOpen(true);
  }

  // Open Add Prospek Modal
  function openAddProspek() {
    setIsEditMode(false);
    setSelectedProspect(null);
    setActiveInputTab('Prospek');
    setInputForm({
      pengajuan: 'Non Top Up',
      nama: '',
      alamat: '',
      status: 'Open',
      progress: '',
      call: false,
      blasting: false,
      note: '',
    });
    setContactingForm({
      call: '',
      blasting: '',
    });
    setIsInputModalOpen(true);
  }

  // Submit Contacting
  async function handleAddContacting(e) {
    e.preventDefault();
    const callCount = parseInt(contactingForm.call) || 0;
    const blastingCount = parseInt(contactingForm.blasting) || 0;

    if (callCount < 0 || blastingCount < 0) {
      return alert('Angka tidak boleh negatif.');
    }
    if (callCount === 0 && blastingCount === 0) {
      return alert('Silakan masukkan jumlah Call atau Blasting.');
    }

    const newRecord = {
      officer_id: user.role === 'officer' ? user.id : null,
      call_count: callCount,
      blasting_count: blastingCount,
    };

    try {
      const { error } = await supabase.from('contacting').insert([newRecord]);
      if (error) throw error;
      await loadData(); // Reload from Supabase
    } catch (err) {
      alert('Gagal menambah data contacting: ' + err.message);
    }

    // Reset form and close modal
    setContactingForm({ call: '', blasting: '' });
    setIsInputModalOpen(false);
  }

  // Submit Add or Edit Prospek
  async function handleAddProspect(e) {
    e.preventDefault();
    if (!inputForm.nama) return alert('Nama harus diisi.');

    // Clean description to avoid "dipindahkan" text
    const currentNote = inputForm.note;
    const cleanNote = (!currentNote || currentNote.toLowerCase().includes('dipindahkan')) ? '-' : currentNote;

    if (isEditMode && selectedProspect) {
      // Edit Mode: Update existing
      const updateFields = {
        pengajuan: inputForm.pengajuan,
        nama: inputForm.nama,
        alamat: inputForm.alamat || null,
        status: inputForm.status || null,
        progress: inputForm.progress || null,
        note: cleanNote,
      };

      await executeWrite('update', 'prospects', updateFields, selectedProspect.id);
    } else {
      // Add Mode: Insert new
      const recordId = generateUUID();
      const newRecord = {
        id: recordId,
        officer_id: user.role === 'officer' ? user.id : null,
        pipeline: 'Prospek', // Starts at Prospek
        pengajuan: inputForm.pengajuan,
        nama: inputForm.nama,
        alamat: inputForm.alamat || null,
        status: inputForm.status || null,
        progress: inputForm.progress || null,
        call: false, // Defaulted to false
        blasting: false, // Defaulted to false
        note: cleanNote,
        created_at: new Date().toISOString(),
      };

      await executeWrite('insert', 'prospects', newRecord);
    }

    setIsInputModalOpen(false);
    setSelectedProspect(null);
  }

  // One-click transition from 'Prospek' to 'Aplikasi IN'
  async function handleMoveToAplikasiIn(prospect) {
    const todayStr = new Date().toISOString().split('T')[0];
    const updateFields = {
      pipeline: 'Aplikasi IN',
      segment: null, // Set to null instead of '' to satisfy database check constraint
      date_in: todayStr, // Default date
      status: prospect.status || 'Open', // Keep the existing status (e.g. Open/Close)
      no_reg: null, // Set to null instead of '' to satisfy database check constraint
      keterangan: '-', // Set to '-' instead of empty or text as requested
    };

    await executeWrite('update', 'prospects', updateFields, prospect.id);
    setFilterStatus('');
    setActiveTab('Aplikasi IN');
  }

  // Open "Lengkapi/Edit Data" Modal (for IN)
  function openLengkapiData(prospect) {
    setSelectedProspect(prospect);
    setInForm({
      segment: prospect.segment || '', // Empty if not set yet
      no_reg: prospect.no_reg || '',
      date_in: prospect.date_in || new Date().toISOString().split('T')[0],
      status: prospect.status === 'OV' ? 'On Progress' : (prospect.status || 'Open'), // Clean OV if any
      keterangan: prospect.keterangan || '',
    });
    setIsLengkapiModalOpen(true);
  }

  // Submit "Lengkapi/Edit Data" (for IN)
  async function handleLengkapiData(e) {
    e.preventDefault();
    
    const isOperation = isOperationProspect(selectedProspect);

    if (!isOperation) {
      if (!inForm.segment) {
        return alert('Segmen harus dipilih.');
      }
      if (!inForm.no_reg || inForm.no_reg.length !== 7 || !/^\d+$/.test(inForm.no_reg)) {
        return alert('No Reg harus berisi 7 digit angka.');
      }
    } else {
      if (inForm.no_reg && (inForm.no_reg.length !== 7 || !/^\d+$/.test(inForm.no_reg))) {
        return alert('No Reg harus berisi 7 digit angka jika diisi.');
      }
    }

    // Clean description to avoid "dipindahkan" text
    const currentKet = inForm.keterangan;
    const cleanKet = (!currentKet || currentKet.toLowerCase().includes('dipindahkan')) ? '-' : currentKet;

    const updateFields = {
      segment: inForm.segment || null,
      no_reg: inForm.no_reg || null,
      date_in: inForm.date_in,
      status: inForm.status,
      keterangan: cleanKet,
    };

    await executeWrite('update', 'prospects', updateFields, selectedProspect.id);

    setIsLengkapiModalOpen(false);
    setSelectedProspect(null);
    setFilterStatus('');
  }

  // Open "Input Date Valid" Modal (for transitioning from IN to Valid, and editing Valid date)
  function openDateValid(prospect) {
    setSelectedProspect(prospect);
    setDateValid(prospect.date_valid || new Date().toISOString().split('T')[0]);
    setIsDateValidModalOpen(true);
  }

  // Submit "Input Date Valid" (saves the date and transitions if necessary)
  async function handleSaveDateValid(e) {
    e.preventDefault();
    if (!dateValid) return alert('Tanggal Valid harus diisi.');

    // If coming from Aplikasi IN, transition the pipeline and status to OV
    const isTransition = selectedProspect.pipeline === 'Aplikasi IN';

    // Clean description to avoid "dipindahkan" text
    const currentKet = selectedProspect.keterangan;
    const cleanKet = (!currentKet || currentKet.toLowerCase().includes('dipindahkan')) ? '-' : currentKet;

    const updateFields = {
      date_valid: dateValid,
      keterangan: cleanKet,
      ...(isTransition ? { pipeline: 'Aplikasi Valid', status: 'OV' } : {})
    };

    await executeWrite('update', 'prospects', updateFields, selectedProspect.id);

    setIsDateValidModalOpen(false);
    setSelectedProspect(null);
    if (isTransition) {
      setActiveTab('Aplikasi Valid');
    }
  }

  // Coordinator: Add New Officer
  async function handleAddOfficer(e) {
    e.preventDefault();
    if (!newOfficerName || !newOfficerPin) {
      return setCoordError('Nama dan PIN harus diisi.');
    }

    if (newOfficerPin.length !== 4 || !/^\d+$/.test(newOfficerPin)) {
      return setCoordError('PIN harus berisi 4 digit angka.');
    }

    try {
      let division = 'PE';
      if (user.coordRole === 'operation') {
        division = 'Operation';
      } else if (user.coordRole === 'pe') {
        division = 'PE';
      } else if (user.coordRole === 'cabang') {
        division = 'Cabang';
      } else if (user.coordRole === 'master') {
        division = 'Operation';
      }
      const { error } = await supabase
        .from('officers')
        .insert([{ name: newOfficerName, pin: newOfficerPin, email: newOfficerEmail || null, division }]);
      if (error) throw error;

      setCoordSuccess(`Officer ${newOfficerName} berhasil ditambahkan!`);
      setNewOfficerName('');
      setNewOfficerPin('');
      setNewOfficerEmail('');
      await loadData();
    } catch (err) {
      setCoordError('Gagal menambah officer: ' + err.message);
    }
  }

  // Coordinator: Update Officer Email
  async function handleUpdateOfficerEmail(id, name, email) {
    try {
      const { error } = await supabase
        .from('officers')
        .update({ email: email || null })
        .eq('id', id);
      if (error) throw error;
      await loadData();
      setEditingOfficerId(null);
    } catch (err) {
      alert('Gagal memperbarui email officer: ' + err.message);
    }
  }

  // Coordinator: Test Trigger Email Reminder
  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    try {
      let url = '/api/reminders?test=true';
      if (filterDivisionManage) {
        url += `&division=${encodeURIComponent(filterDivisionManage)}`;
      }
      if (filterOfficerManage) {
        url += `&officerId=${encodeURIComponent(filterOfficerManage)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        alert(`Sukses! ${data.message || ''}\nDetail: ${JSON.stringify(data.sentReminders)}`);
      } else {
        alert(`Gagal: ${data.error || 'Terjadi kesalahan'} - ${data.details || ''}`);
      }
    } catch (err) {
      alert('Gagal memicu email: ' + err.message);
    }
    setTestEmailLoading(false);
  };

  // Coordinator: Delete Officer
  async function handleDeleteOfficer(id, name) {
    if (!confirm(`Apakah Anda yakin ingin menghapus officer ${name}?`)) return;

    try {
      const { error } = await supabase.from('officers').delete().eq('id', id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      alert('Gagal menghapus officer: ' + err.message);
    }
  }

  // Compute Statistics (for Cards - separated daily vs monthly)
  const getStats = () => {
    // If Officer, filter prospects by their ID. If Coordinator, count all.
    const relevantProspects = user?.role === 'officer'
      ? prospects.filter((p) => p.officer_id === user.id)
      : prospects;

    const relevantContacting = user?.role === 'officer'
      ? contacting.filter((c) => c.officer_id === user.id)
      : contacting;

    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Get business day date (shifts at 3 AM)
    const now = new Date();
    const businessDate = new Date(now);
    if (now.getHours() < 3) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    const todayStr = businessDate.toISOString().split('T')[0];

    // Call (Hari Ini): Sum call_count from relevantContacting created within current business day
    const countCall = relevantContacting
      .filter((c) => isCreatedWithinCurrentBusinessDay(c.created_at))
      .reduce((sum, c) => sum + (Number(c.call_count) || 0), 0);

    // Blasting (Hari Ini): Sum blasting_count from relevantContacting created within current business day
    const countBlasting = relevantContacting
      .filter((c) => isCreatedWithinCurrentBusinessDay(c.created_at))
      .reduce((sum, c) => sum + (Number(c.blasting_count) || 0), 0);

    // Prospek (Hari Ini): Created within current business day (shifts at 3 AM) in Prospek pipeline
    const countProspek = relevantProspects.filter(
      (p) => p.pipeline === 'Prospek' && isCreatedWithinCurrentBusinessDay(p.created_at)
    ).length;

    // Aplikasi IN (Hari Ini): date_in is today
    const countAplikasiInToday = relevantProspects.filter(
      (p) => p.date_in === todayStr
    ).length;

    // Aplikasi Valid (Hari Ini): pipeline is Aplikasi Valid and date_valid is today
    const countAplikasiValidToday = relevantProspects.filter(
      (p) => p.pipeline === 'Aplikasi Valid' && p.date_valid === todayStr
    ).length;

    // Prospek (Bulan Ini): Created this month in Prospek pipeline
    const countProspekMonth = relevantProspects.filter((p) => {
      if (p.pipeline !== 'Prospek') return false;
      const dateToCheck = p.created_at;
      return dateToCheck && dateToCheck.startsWith(currentMonthStr);
    }).length;

    // Aplikasi IN, Aplikasi Valid: Bulan Ini (This Month)
    const countAplikasiIn = relevantProspects.filter((p) => {
      if (p.pipeline !== 'Aplikasi IN') return false;
      const dateToCheck = p.date_in || p.created_at;
      return dateToCheck && dateToCheck.startsWith(currentMonthStr);
    }).length;

    const countAplikasiValid = relevantProspects.filter((p) => {
      if (p.pipeline !== 'Aplikasi Valid') return false;
      const dateToCheck = p.date_valid || p.created_at;
      return dateToCheck && dateToCheck.startsWith(currentMonthStr);
    }).length;

    return {
      countCall,
      countBlasting,
      countProspek,
      countAplikasiInToday,
      countAplikasiValidToday,
      countProspekMonth,
      countAplikasiIn,
      countAplikasiValid
    };
  };

  const stats = getStats();

  // Resolve active dates for Performa Officer & Chart
  const getActivePerfDates = () => {
    let startDate = perfStartDate;
    let endDate = perfEndDate;

    if (perfQuickFilter === 'today') {
      const todayStr = getTodayBusinessDateStr();
      startDate = todayStr;
      endDate = todayStr;
    } else if (perfQuickFilter === 'month') {
      startDate = getStartOfMonthStr();
      endDate = getTodayBusinessDateStr();
    }

    return { startDate, endDate };
  };

  // Resolve active dates for Tren Aktivitas & Prospek (Chart 1)
  const getActiveActDates = () => {
    let startDate = actStartDate;
    let endDate = actEndDate;

    if (actQuickFilter === '7days') {
      const today = new Date();
      const localToday = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      const start = new Date(localToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startShifted = new Date(start.getTime() - (3 * 60 * 60 * 1000));
      const endShifted = new Date(localToday.getTime() - (3 * 60 * 60 * 1000));
      startDate = startShifted.toISOString().split('T')[0];
      endDate = endShifted.toISOString().split('T')[0];
    } else if (actQuickFilter === '15days') {
      const today = new Date();
      const localToday = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      const start = new Date(localToday.getTime() - 14 * 24 * 60 * 60 * 1000);
      const startShifted = new Date(start.getTime() - (3 * 60 * 60 * 1000));
      const endShifted = new Date(localToday.getTime() - (3 * 60 * 60 * 1000));
      startDate = startShifted.toISOString().split('T')[0];
      endDate = endShifted.toISOString().split('T')[0];
    } else if (actQuickFilter === '30days') {
      const today = new Date();
      const localToday = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      const start = new Date(localToday.getTime() - 29 * 24 * 60 * 60 * 1000);
      const startShifted = new Date(start.getTime() - (3 * 60 * 60 * 1000));
      const endShifted = new Date(localToday.getTime() - (3 * 60 * 60 * 1000));
      startDate = startShifted.toISOString().split('T')[0];
      endDate = endShifted.toISOString().split('T')[0];
    }

    return { startDate, endDate };
  };

  // Resolve active dates for Tren Pipeline Aplikasi (Chart 2)
  const getActivePipeDates = () => {
    let startDate = pipeStartDate;
    let endDate = pipeEndDate;

    if (pipeQuickFilter === '7days') {
      const today = new Date();
      const localToday = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      const start = new Date(localToday.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startShifted = new Date(start.getTime() - (3 * 60 * 60 * 1000));
      const endShifted = new Date(localToday.getTime() - (3 * 60 * 60 * 1000));
      startDate = startShifted.toISOString().split('T')[0];
      endDate = endShifted.toISOString().split('T')[0];
    } else if (pipeQuickFilter === '15days') {
      const today = new Date();
      const localToday = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      const start = new Date(localToday.getTime() - 14 * 24 * 60 * 60 * 1000);
      const startShifted = new Date(start.getTime() - (3 * 60 * 60 * 1000));
      const endShifted = new Date(localToday.getTime() - (3 * 60 * 60 * 1000));
      startDate = startShifted.toISOString().split('T')[0];
      endDate = endShifted.toISOString().split('T')[0];
    } else if (pipeQuickFilter === '30days') {
      const today = new Date();
      const localToday = new Date(today.getTime() + (7 * 60 * 60 * 1000));
      const start = new Date(localToday.getTime() - 29 * 24 * 60 * 60 * 1000);
      const startShifted = new Date(start.getTime() - (3 * 60 * 60 * 1000));
      const endShifted = new Date(localToday.getTime() - (3 * 60 * 60 * 1000));
      startDate = startShifted.toISOString().split('T')[0];
      endDate = endShifted.toISOString().split('T')[0];
    }

    return { startDate, endDate };
  };

  // Compute Officer Performance (for Coordinator - matching selected period)
  const getOfficerPerformance = () => {
    // Determine active date range
    const { startDate, endDate } = getActivePerfDates();
    let filtered = officers;
    if (filterDivisionPerf) {
      filtered = filtered.filter((o) => o.division === filterDivisionPerf);
    }
    if (filterOfficerPerf) {
      filtered = filtered.filter((o) => o.id === filterOfficerPerf);
    }
    return filtered.map((o) => {
      const oProspects = prospects.filter((p) => p.officer_id === o.id);
      const oContacting = contacting.filter((c) => c.officer_id === o.id);

      const call = oContacting
        .filter((c) => {
          const bizDate = getBusinessDateString(c.created_at);
          return isDateWithinRange(bizDate, startDate, endDate);
        })
        .reduce((sum, c) => sum + (Number(c.call_count) || 0), 0);

      const blasting = oContacting
        .filter((c) => {
          const bizDate = getBusinessDateString(c.created_at);
          return isDateWithinRange(bizDate, startDate, endDate);
        })
        .reduce((sum, c) => sum + (Number(c.blasting_count) || 0), 0);

      const prospek = oProspects.filter((p) => {
        const bizDate = getBusinessDateString(p.created_at);
        return p.pipeline === 'Prospek' && isDateWithinRange(bizDate, startDate, endDate);
      }).length;

      const aplikasiIn = oProspects.filter((p) => {
        const dateToCheck = p.date_in || getBusinessDateString(p.created_at);
        return p.pipeline === 'Aplikasi IN' && isDateWithinRange(dateToCheck, startDate, endDate);
      }).length;

      const aplikasiValid = oProspects.filter((p) => {
        const dateToCheck = p.date_valid || getBusinessDateString(p.created_at);
        return p.pipeline === 'Aplikasi Valid' && isDateWithinRange(dateToCheck, startDate, endDate);
      }).length;

      return {
        id: o.id,
        name: o.name,
        call,
        blasting,
        prospek,
        aplikasiIn,
        aplikasiValid,
      };
    });
  };

  const performance = getOfficerPerformance();

  const getFilteredManageOfficers = () => {
    let list = officers;
    if (filterDivisionManage) {
      list = list.filter((o) => o.division === filterDivisionManage);
    }
    if (filterOfficerManage) {
      list = list.filter((o) => o.id === filterOfficerManage);
    }
    return list;
  };
  const displayedManageOfficers = getFilteredManageOfficers();

  // Compute Daily Trend Chart Data (for Coordinator)
  const getChartData = () => {
    const { startDate, endDate } = getActiveActDates();

    const dateArray = [];
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    let safetyCounter = 0;
    while (currentDate <= lastDate && safetyCounter < 90) {
      dateArray.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
      safetyCounter++;
    }

    let filteredProspects = prospects;
    let filteredContacting = contacting;

    if (filterDivisionAct) {
      const allowedOfficerIds = officers.filter(o => o.division === filterDivisionAct).map(o => o.id);
      filteredProspects = prospects.filter(p => allowedOfficerIds.includes(p.officer_id));
      filteredContacting = contacting.filter(c => allowedOfficerIds.includes(c.officer_id));
    }

    if (filterOfficerAct) {
      filteredProspects = filteredProspects.filter((p) => p.officer_id === filterOfficerAct);
      filteredContacting = filteredContacting.filter((c) => c.officer_id === filterOfficerAct);
    }

    return dateArray.map((dateStr) => {
      const dateObj = new Date(dateStr);
      const day = dateObj.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthLabel = monthNames[dateObj.getMonth()];
      const label = `${day} ${monthLabel}`;

      const call = filteredContacting
        .filter((c) => getBusinessDateString(c.created_at) === dateStr)
        .reduce((sum, c) => sum + (Number(c.call_count) || 0), 0);

      const blasting = filteredContacting
        .filter((c) => getBusinessDateString(c.created_at) === dateStr)
        .reduce((sum, c) => sum + (Number(c.blasting_count) || 0), 0);

      const prospek = filteredProspects.filter((p) => {
        const bizDate = getBusinessDateString(p.created_at);
        return p.pipeline === 'Prospek' && bizDate === dateStr;
      }).length;

      return {
        dateStr,
        label,
        call,
        blasting,
        prospek
      };
    });
  };

  const chartData = getChartData();

  // Compute Daily Pipeline Chart Data (for Coordinator)
  const getPipelineChartData = () => {
    const { startDate, endDate } = getActivePipeDates();

    const dateArray = [];
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    let safetyCounter = 0;
    while (currentDate <= lastDate && safetyCounter < 90) {
      dateArray.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
      safetyCounter++;
    }

    let filteredProspects = prospects;

    if (filterDivisionPipe) {
      const allowedOfficerIds = officers.filter(o => o.division === filterDivisionPipe).map(o => o.id);
      filteredProspects = prospects.filter(p => allowedOfficerIds.includes(p.officer_id));
    }

    if (filterOfficerPipe) {
      filteredProspects = filteredProspects.filter((p) => p.officer_id === filterOfficerPipe);
    }

    return dateArray.map((dateStr) => {
      const dateObj = new Date(dateStr);
      const day = dateObj.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthLabel = monthNames[dateObj.getMonth()];
      const label = `${day} ${monthLabel}`;

      const prospek = filteredProspects.filter((p) => {
        const bizDate = getBusinessDateString(p.created_at);
        return p.pipeline === 'Prospek' && bizDate === dateStr;
      }).length;

      const aplikasiIn = filteredProspects.filter((p) => {
        const bizDate = p.date_in || getBusinessDateString(p.created_at);
        return p.pipeline === 'Aplikasi IN' && bizDate === dateStr;
      }).length;

      const aplikasiValid = filteredProspects.filter((p) => {
        const bizDate = p.date_valid || getBusinessDateString(p.created_at);
        return p.pipeline === 'Aplikasi Valid' && bizDate === dateStr;
      }).length;

      return {
        dateStr,
        label,
        prospek,
        aplikasiIn,
        aplikasiValid
      };
    });
  };

  const pipelineChartData = getPipelineChartData();

  // Filtered Prospects for Display
  const getFilteredProspects = () => {
    let list = prospects;

    // Filter by role: Officer only sees their own
    if (user?.role === 'officer') {
      list = list.filter((p) => p.officer_id === user.id);
    } else {
      // Coordinator filters
      if (filterDivisionMon) {
        const divOfficers = officers.filter(o => o.division === filterDivisionMon).map(o => o.id);
        list = list.filter((p) => divOfficers.includes(p.officer_id));
      }
      if (filterOfficer) {
        list = list.filter((p) => p.officer_id === filterOfficer);
      }
    }

    // Filter by pipeline tab
    list = list.filter((p) => p.pipeline === activeTab);

    // Filter by date range (Only for Coordinator)
    if (user?.role === 'coordinator') {
      let startDate = appStartDate;
      let endDate = appEndDate;
      if (appQuickFilter === 'today') {
        const todayStr = getTodayBusinessDateStr();
        startDate = todayStr;
        endDate = todayStr;
      } else if (appQuickFilter === 'month') {
        startDate = getStartOfMonthStr();
        endDate = getTodayBusinessDateStr();
      }

      list = list.filter((p) => {
        if (activeTab === 'Prospek') {
          const bizDate = getBusinessDateString(p.created_at);
          return isDateWithinRange(bizDate, startDate, endDate);
        } else if (activeTab === 'Aplikasi IN') {
          const dateToCheck = p.date_in || getBusinessDateString(p.created_at);
          return isDateWithinRange(dateToCheck, startDate, endDate);
        } else if (activeTab === 'Aplikasi Valid') {
          const dateToCheck = p.date_valid || getBusinessDateString(p.created_at);
          return isDateWithinRange(dateToCheck, startDate, endDate);
        }
        return true;
      });
    }

    // Filter by segment
    if (filterSegment) {
      list = list.filter((p) => p.segment === filterSegment);
    }

    // Filter by status (only applies to Aplikasi IN)
    if (activeTab === 'Aplikasi IN' && filterStatus) {
      list = list.filter((p) => p.status === filterStatus);
    }

    // Filter by search query (Name or Reg No)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.nama.toLowerCase().includes(q) ||
          (p.no_reg && p.no_reg.includes(q))
      );
    }

    // Sort by created_at DESC (Newest to Oldest)
    list.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return list;
  };

  const displayedProspects = getFilteredProspects();

  // Helper to format date nicely (e.g., 29 Jun 2026)
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Helper to clean and format Keterangan/Catatan
  const formatKeterangan = (ket) => {
    if (!ket || ket === '-') return '-';
    if (ket.toLowerCase().includes('dipindahkan')) return '-';
    return ket;
  };

  // Helper to get today's date in "Senin - 29 Juni 2026" format (Shifts at 3:00 AM)
  const getTodayIndonesian = () => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    // Get business day date (shifts at 3 AM)
    const now = new Date();
    const businessDate = new Date(now);
    if (now.getHours() < 3) {
      businessDate.setDate(businessDate.getDate() - 1);
    }

    const dayName = days[businessDate.getDay()];
    const date = businessDate.getDate();
    const monthName = months[businessDate.getMonth()];
    const year = businessDate.getFullYear();
    return `${dayName} - ${date} ${monthName} ${year}`;
  };

  // Helper to get current month in "Juni 2026" format
  const getCurrentMonthIndonesian = () => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const today = new Date();
    const monthName = months[today.getMonth()];
    const year = today.getFullYear();
    return `${monthName} ${year}`;
  };

  // Send daily performance report to WhatsApp
  const handleSendWA = () => {
    const reportText = `Nama : ${user.name}\nCall : ${stats.countCall}\nBlasting : ${stats.countBlasting}\nProspek : ${stats.countProspek}\nAplikasi In : ${stats.countAplikasiInToday}\nAplikasi Valid : ${stats.countAplikasiValidToday}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportText)}`;
    window.open(waUrl, '_blank');
  };

  // Format date as DD/MM/YYYY
  const formatDdMmYyyy = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      // Shift to UTC+7 first
      const localTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
      const day = String(localTime.getUTCDate()).padStart(2, '0');
      const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
      const year = localTime.getUTCFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return '';
    }
  };

  // Send single prospect details to WhatsApp
  const handleSendWaProspect = () => {
    const list = prospects.filter(p => p.pipeline === 'Prospek');
    // If officer, filter list by officer id
    const filteredList = user.role === 'officer' ? list.filter(p => p.officer_id === user.id) : list;

    if (filteredList.length === 0) {
      alert('Tidak ada data prospek untuk dikirim.');
      return;
    }

    const prospect = filteredList.find(p => p.id === selectedWaProspectId) || filteredList[0];
    const prospectDate = formatDdMmYyyy(prospect.created_at) || formatDdMmYyyy(new Date());
    
    const assignedOfficer = officers.find(o => o.id === prospect.officer_id);
    const officerName = assignedOfficer?.name || user.name;
    const divisionName = (assignedOfficer?.division || user.division || 'OPERATION').toUpperCase();

    const text = `*PROSPECT ORDER ${divisionName} ${prospectDate}*
PENGAJUAN : ${prospect.pengajuan || ''}
NAMA : ${prospect.nama || ''}
REFERRAL : ${officerName || ''}
STATUS : ${prospect.status || 'Open'}
Alamat : ${prospect.alamat || '-'}
*NOTE:* ${prospect.note || '-'}`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Delete a single prospect from Supabase / LocalStorage
  const handleDeleteProspect = async () => {
    if (!selectedProspect) return;

    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus prospek "${selectedProspect.nama}" secara permanen dari database?`);
    if (!confirmDelete) return;

    await executeWrite('delete', 'prospects', null, selectedProspect.id);
    setIsInputModalOpen(false);
    setIsLengkapiModalOpen(false);
    setSelectedProspect(null);
  };

  // Download Performa Officer as Excel (XLSX)
  const handleDownloadExcelPerformance = () => {
    const headers = ['Nama Officer', 'Call', 'Blasting', 'Prospek', 'Aplikasi IN', 'Aplikasi Valid'];
    const rows = performance.map(perf => [
      perf.name,
      perf.call,
      perf.blasting,
      perf.prospek,
      perf.aplikasiIn,
      perf.aplikasiValid
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Performa Officer');

    let periodStr = perfQuickFilter;
    if (perfQuickFilter === 'custom') {
      periodStr = `${perfStartDate}_to_${perfEndDate}`;
    }
    XLSX.writeFile(workbook, `performa_officer_${periodStr}.xlsx`);
  };

  // Download Monitoring Aplikasi as Excel (XLSX)
  const handleDownloadExcelAplikasi = () => {
    let headers = [];
    let rows = [];

    if (activeTab === 'Prospek') {
      headers = ['Nama Customer', 'Pengajuan', 'Tanggal Input', 'Alamat', 'Status', 'Progress', 'Officer', 'Catatan'];
      rows = displayedProspects.map(p => {
        const officerName = officers.find((o) => o.id === p.officer_id)?.name || 'Unassigned';
        return [
          p.nama,
          p.pengajuan,
          formatDate(p.created_at),
          p.alamat || '-',
          p.status || 'Open',
          p.progress || '-',
          officerName,
          formatKeterangan(p.note)
        ];
      });
    } else if (activeTab === 'Aplikasi IN') {
      headers = ['Nama Customer', 'Segmen', 'No Reg', 'Date IN', 'Status', 'Officer', 'Keterangan'];
      rows = displayedProspects.map(p => {
        const officerName = officers.find((o) => o.id === p.officer_id)?.name || 'Unassigned';
        return [
          p.nama,
          p.segment || '-',
          p.no_reg || '-',
          formatDate(p.date_in),
          p.status,
          officerName,
          formatKeterangan(p.keterangan)
        ];
      });
    } else { // Aplikasi Valid
      headers = ['Nama Customer', 'Segmen', 'No Reg', 'Date IN', 'Date Valid', 'Officer', 'Keterangan'];
      rows = displayedProspects.map(p => {
        const officerName = officers.find((o) => o.id === p.officer_id)?.name || 'Unassigned';
        return [
          p.nama,
          p.segment || '-',
          p.no_reg || '-',
          formatDate(p.date_in),
          formatDate(p.date_valid),
          officerName,
          '' // Clear remarks for Valid prospects as requested
        ];
      });
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab);

    XLSX.writeFile(workbook, `monitoring_aplikasi_${activeTab.toLowerCase().replace(' ', '_')}.xlsx`);
  };

  // Download All Stages for the Entire Month sorted day-by-day
  const handleDownloadExcelMonth = () => {
    const startDate = getStartOfMonthStr();
    const endDate = getTodayBusinessDateStr();

    // Filter prospects with any activity in this month
    const monthProspects = prospects.filter(p => {
      const createdDate = getBusinessDateString(p.created_at);
      const inDate = p.date_in;
      const validDate = p.date_valid;

      const isCreatedThisMonth = createdDate >= startDate && createdDate <= endDate;
      const isInThisMonth = inDate && inDate >= startDate && inDate <= endDate;
      const isValidThisMonth = validDate && validDate >= startDate && validDate <= endDate;

      return isCreatedThisMonth || isInThisMonth || isValidThisMonth;
    });

    // Map to daily records sorted by date
    const rows = monthProspects.map(p => {
      const officerName = officers.find((o) => o.id === p.officer_id)?.name || 'Unassigned';

      let primaryDate = '';
      if (p.pipeline === 'Aplikasi Valid') {
        primaryDate = p.date_valid || p.date_in || getBusinessDateString(p.created_at);
      } else if (p.pipeline === 'Aplikasi IN') {
        primaryDate = p.date_in || getBusinessDateString(p.created_at);
      } else {
        primaryDate = getBusinessDateString(p.created_at);
      }

      return {
        date: primaryDate,
        nama: p.nama,
        tahapan: p.pipeline || 'Prospek',
        segment: p.segment || '-',
        no_reg: p.no_reg || '-',
        date_in: p.date_in ? formatDate(p.date_in) : '-',
        date_valid: p.date_valid ? formatDate(p.date_valid) : '-',
        officer: officerName,
        keterangan: p.pipeline === 'Aplikasi Valid' ? '' : (p.pipeline === 'Prospek' ? formatKeterangan(p.note) : formatKeterangan(p.keterangan))
      };
    });

    // Sort chronologically
    rows.sort((a, b) => a.date.localeCompare(b.date));

    const headers = ['Tanggal Aktivitas', 'Nama Customer', 'Tahapan', 'Segmen', 'No Reg', 'Date IN', 'Date Valid', 'Officer', 'Keterangan/Catatan'];
    const excelRows = rows.map(r => [
      formatDate(r.date),
      r.nama,
      r.tahapan,
      r.segment,
      r.no_reg,
      r.date_in,
      r.date_valid,
      r.officer,
      r.keterangan
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Harian');

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentMonthName = monthNames[new Date().getMonth()];

    XLSX.writeFile(workbook, `data_harian_aplikasi_${currentMonthName.toLowerCase()}_${new Date().getFullYear()}.xlsx`);
  };

  // Critical: Delete All Data in Supabase (Prospects and Contacting only) and LocalStorage
  const handleDeleteAllData = async () => {
    if (user?.role !== 'coordinator' || user?.coordRole !== 'master') {
      alert("Hanya Master Coordinator yang dapat menghapus seluruh data.");
      return;
    }
    const firstConfirm = window.confirm("⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus seluruh data Prospek dan Aktivitas di aplikasi ini? Akun Officer dan Koordinator TIDAK akan dihapus.");
    if (!firstConfirm) return;

    const secondConfirm = window.confirm("❗ KONFIRMASI KEDUA: Semua data prospek dan aktivitas di database Supabase dan penyimpanan lokal (LocalStorage) akan DIHAPUS BERSIH secara permanen. Lanjutkan?");
    if (!secondConfirm) return;

    try {
      // 1. Delete all prospects
      await supabase
        .from('prospects')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // 2. Delete all contacting logs
      await supabase
        .from('contacting')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // 3. Clear localStorage fallback data
      localStorage.removeItem('acc_prospects_cache');
      localStorage.removeItem('acc_contacting_cache');

      alert("🎉 Seluruh data Prospek dan Aktivitas telah dibersihkan total! Akun Officer tetap aman.");
      await loadData();
    } catch (err) {
      console.error("Gagal menghapus data:", err);
      alert(`Gagal menghapus data: ${err.message}`);
    }
  };

  // Download Chart 1 (Tren Aktivitas & Prospek) data as Excel
  const handleDownloadChart1Excel = () => {
    const data = getChartData();
    const headers = ['Tanggal', 'Call', 'Blasting', 'Prospek'];
    const excelRows = data.map(d => [formatDate(d.dateStr), d.call, d.blasting, d.prospek]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tren Aktivitas & Prospek');

    XLSX.writeFile(workbook, 'tren_aktivitas_dan_prospek.xlsx');
  };

  // Download Chart 2 (Tren Pipeline Aplikasi) data as Excel
  const handleDownloadChart2Excel = () => {
    const data = getPipelineChartData();
    const headers = ['Tanggal', 'Prospek', 'Aplikasi IN', 'Aplikasi Valid'];
    const excelRows = data.map(d => [formatDate(d.dateStr), d.prospek, d.aplikasiIn, d.aplikasiValid]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tren Pipeline Aplikasi');

    XLSX.writeFile(workbook, 'tren_pipeline_aplikasi.xlsx');
  };

  if (loading || !user) {
    return (
      <main className="container flex-center" style={{ minHeight: '100vh' }}>
        <h2 className="text-gradient">Memuat Data...</h2>
      </main>
    );
  }

  return (
    <main className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      {/* Header */}
      <header className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 className="text-gradient" style={{ fontSize: '1.75rem', margin: 0 }}>S.W.A.T - Tegal</h1>

            {/* Delete All Data Button (Visible only to Master Coordinator) */}
            {user.role === 'coordinator' && user.coordRole === 'master' && (
              <button
                onClick={handleDeleteAllData}
                className="btn"
                style={{
                  width: 'auto',
                  padding: '0 0.8rem',
                  fontSize: '0.85rem',
                  height: '30px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Hapus semua data di database Supabase"
              >
                🗑️ Hapus Semua Data
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Masuk sebagai: <strong>{user.name}</strong> ({user.role === 'coordinator' ? 'Coordinator' : 'Officer'})
            </p>
            <span style={{ color: 'rgba(255, 255, 255, 0.15)' }} className="desktop-only">|</span>

            {/* Supabase Connection Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: '600' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: dbStatus === 'CONNECTED' ? '#10b981' : dbStatus === 'DISCONNECTED' ? '#ef4444' : '#e2e8f0',
                display: 'inline-block'
              }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                {dbStatus === 'CONNECTED' ? 'Supabase Connected' : dbStatus === 'DISCONNECTED' ? 'Supabase Offline' : 'Mengecek...'}
              </span>
            </div>

          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {user.role === 'officer' && (
            <button className="btn btn-primary" onClick={openAddProspek} style={{ width: 'auto' }}>
              + Input Data Baru
            </button>
          )}
          <button className="btn btn-secondary" onClick={async () => { await loadData(); syncOfflineData(); }} style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} title="Sinkronisasi & Segarkan Data">
            🔄 Segarkan
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ width: 'auto' }}>
            Keluar
          </button>
        </div>
      </header>

      {/* Offline Warning Banner */}
      {isOffline && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '0.75rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#f87171',
          fontSize: '0.9rem',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <div>
            <strong>Mode Offline Aktif:</strong> Koneksi terputus. Perubahan Anda disimpan sementara di perangkat ini dan akan diunggah otomatis saat sinyal kembali.
          </div>
        </div>
      )}

      {/* KPI Stats Grid - Divided into Daily vs Monthly Sections */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* Section 1: Harian (Call, Blasting, Prospek) */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>
              Hari Ini ({getTodayIndonesian()})
            </div>

            {user.role === 'officer' && (
              <button onClick={handleSendWA} className="btn-wa" style={{ margin: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Kirim Laporan WA
              </button>
            )}
          </div>
          <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="glass-card stat-card">
              <label>Call</label>
              <div className="stat-val" style={{ color: 'var(--warning)' }}>{stats.countCall}</div>
            </div>
            <div className="glass-card stat-card">
              <label>Blasting</label>
              <div className="stat-val" style={{ color: 'var(--danger)' }}>{stats.countBlasting}</div>
            </div>
            <div className="glass-card stat-card">
              <label>Prospek</label>
              <div className="stat-val" style={{ color: 'var(--primary)' }}>{stats.countProspek}</div>
            </div>
          </section>
        </div>

        {/* Section 2: Bulanan (Prospek, Aplikasi IN, Aplikasi Valid) */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
              Bulan Ini ({getCurrentMonthIndonesian()})
            </div>

            {user.role === 'coordinator' && (
              <button
                onClick={handleDownloadExcelMonth}
                className="btn btn-secondary"
                style={{
                  width: 'auto',
                  padding: '0 0.8rem',
                  fontSize: '0.85rem',
                  height: '30px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  color: '#60a5fa',
                  fontWeight: '600',
                  borderRadius: '6px',
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  transition: 'all 0.2s ease'
                }}
              >
                📥 Unduh Data Bulan Ini
              </button>
            )}
          </div>
          <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="glass-card stat-card">
              <label>Prospek</label>
              <div className="stat-val" style={{ color: 'var(--primary)' }}>{stats.countProspekMonth}</div>
            </div>
            <div className="glass-card stat-card">
              <label>Aplikasi IN</label>
              <div className="stat-val" style={{ color: 'var(--secondary)' }}>{stats.countAplikasiIn}</div>
            </div>
            <div className="glass-card stat-card">
              <label>Aplikasi Valid</label>
              <div className="stat-val" style={{ color: 'var(--success)' }}>{stats.countAplikasiValid}</div>
            </div>
          </section>
        </div>
      </div>

      {user.role === 'coordinator' ? (
        /* ========================================================================= */
        /*                          COORDINATOR DASHBOARD                            */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Charts Container (Stacked Vertically) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Chart 1: Tren Aktivitas & Prospek */}
            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.15rem', margin: 0 }} className="text-gradient">Tren Aktivitas & Prospek</h2>
                    {user.role === 'coordinator' && user.coordRole === 'master' && (
                      <select
                        className="input-control"
                        value={filterDivisionAct}
                        onChange={(e) => {
                          setFilterDivisionAct(e.target.value);
                          setFilterOfficerAct('');
                        }}
                        style={{ height: '26px', padding: '0 2rem 0 0.5rem', fontSize: '0.75rem', width: 'auto', marginRight: '0.5rem' }}
                      >
                        <option value="">Semua Divisi</option>
                        <option value="Operation">Operation</option>
                        <option value="PE">PE</option>
                        <option value="Cabang">Cabang</option>
                      </select>
                    )}
                    <select
                      className="input-control"
                      value={filterOfficerAct}
                      onChange={(e) => setFilterOfficerAct(e.target.value)}
                      style={{ height: '26px', padding: '0 2rem 0 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                    >
                      <option value="">Semua Officer</option>
                      {officers
                        .filter((o) => !filterDivisionAct || o.division === filterDivisionAct)
                        .map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Metric Toggles */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowCallLine(!showCallLine)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        border: '1px solid',
                        borderColor: showCallLine ? '#ffd700' : 'rgba(255, 255, 255, 0.1)',
                        background: showCallLine ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                        color: showCallLine ? '#ffd700' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s ease',
                        fontWeight: '500'
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ffd700' }}></span>
                      Call {showCallLine ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBlastingLine(!showBlastingLine)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        border: '1px solid',
                        borderColor: showBlastingLine ? '#ff4d4d' : 'rgba(255, 255, 255, 0.1)',
                        background: showBlastingLine ? 'rgba(255, 77, 77, 0.15)' : 'transparent',
                        color: showBlastingLine ? '#ff4d4d' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s ease',
                        fontWeight: '500'
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ff4d4d' }}></span>
                      Blasting {showBlastingLine ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProspekLine(!showProspekLine)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        border: '1px solid',
                        borderColor: showProspekLine ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                        background: showProspekLine ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: showProspekLine ? '#38bdf8' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s ease',
                        fontWeight: '500'
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8' }}></span>
                      Prospek {showProspekLine ? '✓' : ''}
                    </button>
                  </div>
                </div>

                {/* Date & Officer Filter Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>

                  <div className="tabs-container" style={{ marginBottom: 0, borderBottom: 'none', display: 'inline-flex', height: '30px' }}>
                    <button
                      type="button"
                      className={`tab-btn ${actQuickFilter === '7days' ? 'active' : ''}`}
                      onClick={() => setActQuickFilter('7days')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      7H
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${actQuickFilter === '15days' ? 'active' : ''}`}
                      onClick={() => setActQuickFilter('15days')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      15H
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${actQuickFilter === '30days' ? 'active' : ''}`}
                      onClick={() => setActQuickFilter('30days')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      1M
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${actQuickFilter === 'custom' ? 'active' : ''}`}
                      onClick={() => setActQuickFilter('custom')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      Pilih
                    </button>
                  </div>

                  {actQuickFilter === 'custom' && (
                    <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }} className="animate-fade-in">
                      <input
                        type="date"
                        className="input-control"
                        value={actStartDate}
                        onChange={(e) => setActStartDate(e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                        style={{ padding: '0 0.35rem', fontSize: '0.8rem', width: '105px', height: '30px', cursor: 'pointer' }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>s/d</span>
                      <input
                        type="date"
                        className="input-control"
                        value={actEndDate}
                        onChange={(e) => setActEndDate(e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                        style={{ padding: '0 0.35rem', fontSize: '0.8rem', width: '105px', height: '30px', cursor: 'pointer' }}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleDownloadChart1Excel}
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.8rem', height: '30px', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399', borderRadius: '6px' }}
                  >
                    📊 Unduh Excel
                  </button>
                </div>
              </div>
              <LineChart
                data={chartData}
                showCall={showCallLine}
                showBlasting={showBlastingLine}
                showProspek={showProspekLine}
              />
            </section>

            {/* Chart 2: Tren Pipeline Aplikasi */}
            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.15rem', margin: 0 }} className="text-gradient">Tren Pipeline Aplikasi</h2>
                    {user.role === 'coordinator' && user.coordRole === 'master' && (
                      <select
                        className="input-control"
                        value={filterDivisionPipe}
                        onChange={(e) => {
                          setFilterDivisionPipe(e.target.value);
                          setFilterOfficerPipe('');
                        }}
                        style={{ height: '26px', padding: '0 2rem 0 0.5rem', fontSize: '0.75rem', width: 'auto', marginRight: '0.5rem' }}
                      >
                        <option value="">Semua Divisi</option>
                        <option value="Operation">Operation</option>
                        <option value="PE">PE</option>
                        <option value="Cabang">Cabang</option>
                      </select>
                    )}
                    <select
                      className="input-control"
                      value={filterOfficerPipe}
                      onChange={(e) => setFilterOfficerPipe(e.target.value)}
                      style={{ height: '26px', padding: '0 2rem 0 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                    >
                      <option value="">Semua Officer</option>
                      {officers
                        .filter((o) => !filterDivisionPipe || o.division === filterDivisionPipe)
                        .map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Metric Toggles */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowPipeProspek(!showPipeProspek)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        border: '1px solid',
                        borderColor: showPipeProspek ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                        background: showPipeProspek ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: showPipeProspek ? '#38bdf8' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s ease',
                        fontWeight: '500'
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8' }}></span>
                      Prospek {showPipeProspek ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPipeAplikasiIn(!showPipeAplikasiIn)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        border: '1px solid',
                        borderColor: showPipeAplikasiIn ? '#c084fc' : 'rgba(255, 255, 255, 0.1)',
                        background: showPipeAplikasiIn ? 'rgba(192, 132, 252, 0.15)' : 'transparent',
                        color: showPipeAplikasiIn ? '#c084fc' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s ease',
                        fontWeight: '500'
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#c084fc' }}></span>
                      Aplikasi IN {showPipeAplikasiIn ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPipeAplikasiValid(!showPipeAplikasiValid)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        border: '1px solid',
                        borderColor: showPipeAplikasiValid ? '#34d399' : 'rgba(255, 255, 255, 0.1)',
                        background: showPipeAplikasiValid ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                        color: showPipeAplikasiValid ? '#34d399' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.2s ease',
                        fontWeight: '500'
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399' }}></span>
                      Aplikasi Valid {showPipeAplikasiValid ? '✓' : ''}
                    </button>
                  </div>
                </div>

                {/* Date & Officer Filter Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="tabs-container" style={{ marginBottom: 0, borderBottom: 'none', display: 'inline-flex', height: '30px' }}>
                    <button
                      type="button"
                      className={`tab-btn ${pipeQuickFilter === '7days' ? 'active' : ''}`}
                      onClick={() => setPipeQuickFilter('7days')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      7H
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${pipeQuickFilter === '15days' ? 'active' : ''}`}
                      onClick={() => setPipeQuickFilter('15days')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      15H
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${pipeQuickFilter === '30days' ? 'active' : ''}`}
                      onClick={() => setPipeQuickFilter('30days')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      1M
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${pipeQuickFilter === 'custom' ? 'active' : ''}`}
                      onClick={() => setPipeQuickFilter('custom')}
                      style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                    >
                      Pilih
                    </button>
                  </div>

                  {pipeQuickFilter === 'custom' && (
                    <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }} className="animate-fade-in">
                      <input
                        type="date"
                        className="input-control"
                        value={pipeStartDate}
                        onChange={(e) => setPipeStartDate(e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                        style={{ padding: '0 0.35rem', fontSize: '0.8rem', width: '105px', height: '30px', cursor: 'pointer' }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>s/d</span>
                      <input
                        type="date"
                        className="input-control"
                        value={pipeEndDate}
                        onChange={(e) => setPipeEndDate(e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                        style={{ padding: '0 0.35rem', fontSize: '0.8rem', width: '105px', height: '30px', cursor: 'pointer' }}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleDownloadChart2Excel}
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.8rem', height: '30px', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399', borderRadius: '6px' }}
                  >
                    📊 Unduh Excel
                  </button>
                </div>
              </div>
              <PipelineChart
                data={pipelineChartData}
                showProspek={showPipeProspek}
                showAplikasiIn={showPipeAplikasiIn}
                showAplikasiValid={showPipeAplikasiValid}
              />
            </section>
          </div>

          {/* Officer Performance Table */}
          <section className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }} className="text-gradient">Performa Officer</h2>
                {/* Division Filter Dropdown (Visible only to Master) */}
                {user.role === 'coordinator' && user.coordRole === 'master' && (
                  <select
                    className="input-control"
                    value={filterDivisionPerf}
                    onChange={(e) => {
                      setFilterDivisionPerf(e.target.value);
                      setFilterOfficerPerf('');
                    }}
                    style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                  >
                    <option value="">Semua Divisi</option>
                    <option value="Operation">Operation</option>
                    <option value="PE">PE</option>
                    <option value="Cabang">Cabang</option>
                  </select>
                )}
                {/* Officer Filter Dropdown */}
                <select
                  className="input-control"
                  value={filterOfficerPerf}
                  onChange={(e) => setFilterOfficerPerf(e.target.value)}
                  style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="">Semua Officer</option>
                  {officers
                    .filter((o) => !filterDivisionPerf || o.division === filterDivisionPerf)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Date Filter Controls */}
                <div className="tabs-container" style={{ marginBottom: 0, borderBottom: 'none', display: 'inline-flex', height: '30px' }}>
                  <button
                    type="button"
                    className={`tab-btn ${perfQuickFilter === 'today' ? 'active' : ''}`}
                    onClick={() => setPerfQuickFilter('today')}
                    style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${perfQuickFilter === 'month' ? 'active' : ''}`}
                    onClick={() => setPerfQuickFilter('month')}
                    style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${perfQuickFilter === 'custom' ? 'active' : ''}`}
                    onClick={() => setPerfQuickFilter('custom')}
                    style={{ padding: '0 0.75rem', fontSize: '0.85rem', height: '100%' }}
                  >
                    Pilih Tanggal
                  </button>
                </div>

                {perfQuickFilter === 'custom' && (
                  <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }} className="animate-fade-in">
                    <input
                      type="date"
                      className="input-control"
                      value={perfStartDate}
                      onChange={(e) => setPerfStartDate(e.target.value)}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                      style={{ padding: '0 0.35rem', fontSize: '0.8rem', width: '105px', height: '30px', cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>s/d</span>
                    <input
                      type="date"
                      className="input-control"
                      value={perfEndDate}
                      onChange={(e) => setPerfEndDate(e.target.value)}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                      style={{ padding: '0 0.35rem', fontSize: '0.8rem', width: '105px', height: '30px', cursor: 'pointer' }}
                    />
                  </div>
                )}

                <button
                  onClick={handleDownloadExcelPerformance}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.8rem', height: '30px', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}
                >
                  📥 Unduh Excel
                </button>
              </div>
            </div>

            <div className="responsive-table-container">
              <table className="data-table" style={{ minWidth: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th>Nama Officer</th>
                    <th style={{ textAlign: 'center', width: '12%' }}>Call</th>
                    <th style={{ textAlign: 'center', width: '12%' }}>Blasting</th>
                    <th style={{ textAlign: 'center', width: '12%' }}>Prospek</th>
                    <th style={{ textAlign: 'center', width: '15%' }}>Aplikasi IN</th>
                    <th style={{ textAlign: 'center', width: '15%' }}>Aplikasi Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((perf) => (
                    <tr key={perf.id}>
                      <td><strong>{perf.name}</strong></td>
                      <td style={{ textAlign: 'center' }}>{perf.call}</td>
                      <td style={{ textAlign: 'center' }}>{perf.blasting}</td>
                      <td style={{ textAlign: 'center' }}>{perf.prospek}</td>
                      <td style={{ textAlign: 'center' }}>{perf.aplikasiIn}</td>
                      <td style={{ textAlign: 'center' }}>{perf.aplikasiValid}</td>
                    </tr>
                  ))}
                  {performance.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        Belum ada Officer yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pipeline Monitor for Coordinator */}
          <section className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }} className="text-gradient">Monitoring Aplikasi</h2>

                {/* Division Filter Dropdown (Visible only to Master) */}
                {user.role === 'coordinator' && user.coordRole === 'master' && (
                  <select
                    className="input-control"
                    value={filterDivisionMon}
                    onChange={(e) => {
                      setFilterDivisionMon(e.target.value);
                      setFilterOfficer('');
                    }}
                    style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                  >
                    <option value="">Semua Divisi</option>
                    <option value="Operation">Operation</option>
                    <option value="PE">PE</option>
                    <option value="Cabang">Cabang</option>
                  </select>
                )}

                {/* Officer Filter Dropdown */}
                <select
                  className="input-control"
                  value={filterOfficer}
                  onChange={(e) => setFilterOfficer(e.target.value)}
                  style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="">Semua Officer</option>
                  {officers
                    .filter((o) => !filterDivisionMon || o.division === filterDivisionMon)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>

                {/* Tahapan Filter Dropdown (Prospek / Aplikasi IN / Aplikasi Valid) */}
                <select
                  className="input-control"
                  value={activeTab}
                  onChange={(e) => {
                    setActiveTab(e.target.value);
                    setSearchQuery('');
                    setFilterStatus('');
                  }}
                  style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="Prospek">Prospek</option>
                  <option value="Aplikasi IN">Aplikasi IN</option>
                  <option value="Aplikasi Valid">Aplikasi Valid</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Date Filter Controls for Monitoring Aplikasi */}
                <div className="tabs-container" style={{ marginBottom: 0, borderBottom: 'none', display: 'inline-flex', height: '30px' }}>
                  <button
                    type="button"
                    className={`tab-btn ${appQuickFilter === 'today' ? 'active' : ''}`}
                    onClick={() => setAppQuickFilter('today')}
                    style={{ padding: '0 0.75rem', fontSize: '0.8rem', height: '100%' }}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${appQuickFilter === 'month' ? 'active' : ''}`}
                    onClick={() => setAppQuickFilter('month')}
                    style={{ padding: '0 0.75rem', fontSize: '0.8rem', height: '100%' }}
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${appQuickFilter === 'custom' ? 'active' : ''}`}
                    onClick={() => setAppQuickFilter('custom')}
                    style={{ padding: '0 0.75rem', fontSize: '0.8rem', height: '100%' }}
                  >
                    Pilih Tanggal
                  </button>
                </div>

                {appQuickFilter === 'custom' && (
                  <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }} className="animate-fade-in">
                    <input
                      type="date"
                      className="input-control"
                      value={appStartDate}
                      onChange={(e) => setAppStartDate(e.target.value)}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                      style={{ padding: '0 0.35rem', fontSize: '0.75rem', width: '110px', height: '30px', cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>s/d</span>
                    <input
                      type="date"
                      className="input-control"
                      value={appEndDate}
                      onChange={(e) => setAppEndDate(e.target.value)}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                      style={{ padding: '0 0.35rem', fontSize: '0.75rem', width: '110px', height: '30px', cursor: 'pointer' }}
                    />
                  </div>
                )}

                <button
                  onClick={handleDownloadExcelAplikasi}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '0 0.75rem', fontSize: '0.8rem', height: '30px', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}
                >
                  📥 Unduh Excel
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Cari nama customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ height: '30px', padding: '0 0.75rem', fontSize: '0.8rem' }}
                />
              </div>
              <select
                className="input-control"
                value={filterSegment}
                onChange={(e) => setFilterSegment(e.target.value)}
                style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="">Semua Segmen</option>
                <option value="Bronze">Bronze</option>
                <option value="Flexi">Flexi</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
                <option value="Solitaire">Solitaire</option>
              </select>
              {activeTab === 'Aplikasi IN' && (
                <select
                  className="input-control"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="">Semua Status</option>
                  <option value="Belum Melengkapi Data">Belum Melengkapi Data</option>
                  <option value="On Progress">On Progress</option>
                  <option value="RE">RE</option>
                  <option value="NB">NB</option>
                  <option value="DP OP">DP OP</option>
                </select>
              )}
            </div>

            {/* Global Prospects Table */}
            <div className="responsive-table-container">
              {activeTab === 'Aplikasi Valid' ? (
                <table className="data-table" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Nama Customer</th>
                      <th style={{ width: '12%' }}>Segmen</th>
                      <th style={{ width: '14%' }}>No Reg</th>
                      <th style={{ width: '14%' }}>Date IN</th>
                      <th style={{ width: '18%' }}>Date Valid</th>
                      <th style={{ width: '14%' }}>Officer</th>
                      <th style={{ width: '17%' }}>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedProspects.map((p) => {
                      const officerName = officers.find((o) => o.id === p.officer_id)?.name || 'Unassigned';
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.nama}</strong></td>
                          <td>{p.segment ? <span className="badge badge-info">{p.segment}</span> : '-'}</td>
                          <td><code>{p.no_reg}</code></td>
                          <td>{formatDate(p.date_in)}</td>
                          <td>
                            <span className="badge badge-success">
                              {formatDate(p.date_valid)}
                            </span>
                          </td>
                          <td><span style={{ fontSize: '0.85rem' }}>{officerName}</span></td>
                          <td style={{ fontSize: '0.85rem' }}>{formatKeterangan(p.keterangan)}</td>
                        </tr>
                      );
                    })}
                    {displayedProspects.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                          <div className="empty-state">
                            <div className="empty-icon">📂</div>
                            <p>Tidak ada data di tahapan {activeTab}.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="data-table">
                  {activeTab === 'Prospek' ? (
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Nama Customer</th>
                        <th style={{ width: '12%' }}>Pengajuan</th>
                        <th style={{ width: '14%' }}>Tanggal Input</th>
                        <th style={{ width: '16%' }}>Alamat</th>
                        <th style={{ width: '9%' }}>Status</th>
                        <th style={{ width: '10%' }}>Progress</th>
                        <th style={{ width: '10%' }}>Officer</th>
                        <th style={{ width: '14%' }}>Catatan</th>
                      </tr>
                    </thead>
                  ) : (
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Nama Customer</th>
                        <th style={{ width: '12%' }}>Segmen</th>
                        <th style={{ width: '14%' }}>No Reg</th>
                        <th style={{ width: '14%' }}>Date IN</th>
                        <th style={{ width: '18%' }}>Status</th>
                        <th style={{ width: '14%' }}>Officer</th>
                        <th style={{ width: '13%' }}>Keterangan</th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {displayedProspects.map((p) => {
                      const officerName = officers.find((o) => o.id === p.officer_id)?.name || 'Unassigned';
                      return activeTab === 'Prospek' ? (
                        <tr key={p.id}>
                          <td><strong>{p.nama}</strong></td>
                          <td><span className="badge badge-info">{p.pengajuan}</span></td>
                          <td>{formatDate(p.created_at)}</td>
                          <td style={{ fontSize: '0.85rem' }}>{p.alamat}</td>
                          <td>
                            <span className={`badge ${p.status === 'Close' ? 'badge-danger' : 'badge-success'}`}>
                              {p.status || 'Open'}
                            </span>
                          </td>
                          <td><span style={{ fontSize: '0.85rem' }}>{p.progress || '-'}</span></td>
                          <td><span style={{ fontSize: '0.85rem' }}>{officerName}</span></td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatKeterangan(p.note)}</td>
                        </tr>
                      ) : (
                        <tr key={p.id}>
                          <td><strong>{p.nama}</strong></td>
                          <td>{p.segment ? <span className="badge badge-info">{p.segment}</span> : '-'}</td>
                          <td><code>{p.no_reg || '-'}</code></td>
                          <td>{formatDate(p.date_in)}</td>
                          <td>
                            <span className={`badge ${p.status === 'OV' ? 'badge-success' : p.status === 'Belum Melengkapi Data' ? 'badge-danger' : 'badge-warning'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td><span style={{ fontSize: '0.85rem' }}>{officerName}</span></td>
                          <td style={{ fontSize: '0.85rem' }}>{formatKeterangan(p.keterangan)}</td>
                        </tr>
                      );
                    })}
                    {displayedProspects.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                          <div className="empty-state">
                            <div className="empty-icon">📂</div>
                            <p>Tidak ada data di tahapan {activeTab}.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Card: Kelola Officer (Daftar & Tambah Officer) */}
          <section className="glass-card" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }} className="text-gradient">Kelola Akun & Email Officer</h2>

                {/* Division Filter Dropdown (Visible only to Master) */}
                {user.role === 'coordinator' && user.coordRole === 'master' && (
                  <select
                    className="input-control"
                    value={filterDivisionManage}
                    onChange={(e) => {
                      setFilterDivisionManage(e.target.value);
                      setFilterOfficerManage('');
                    }}
                    style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                  >
                    <option value="">Semua Divisi</option>
                    <option value="Operation">Operation</option>
                    <option value="PE">PE</option>
                    <option value="Cabang">Cabang</option>
                  </select>
                )}

                {/* Officer Filter Dropdown */}
                <select
                  className="input-control"
                  value={filterOfficerManage}
                  onChange={(e) => setFilterOfficerManage(e.target.value)}
                  style={{ height: '30px', padding: '0 2.2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="">Semua Officer</option>
                  {officers
                    .filter((o) => !filterDivisionManage || o.division === filterDivisionManage)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestEmail}
                disabled={testEmailLoading}
                style={{
                  width: 'auto',
                  padding: '0 0.8rem',
                  fontSize: '0.85rem',
                  height: '30px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  color: '#60a5fa',
                  borderRadius: '6px'
                }}
              >
                📧 {testEmailLoading ? 'Mengirim...' : 'Uji Kirim Email (Cron)'}
              </button>
            </div>

            {coordError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{coordError}</div>}
            {coordSuccess && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{coordSuccess}</div>}

            <div className="responsive-table-container">
              <table className="data-table" style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th>Nama Officer</th>
                    <th>Email Officer (Klik untuk Tambah / Edit Email)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedManageOfficers.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.name}</strong></td>
                      <td>
                        {editingOfficerId === o.id ? (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <input
                              type="email"
                              className="input-control"
                              value={editingOfficerEmail}
                              onChange={(e) => setEditingOfficerEmail(e.target.value)}
                              style={{ height: '26px', padding: '0 0.35rem', fontSize: '0.8rem', width: '220px' }}
                            />
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: '0 0.5rem', height: '26px', fontSize: '0.75rem', width: 'auto' }}
                              onClick={() => handleUpdateOfficerEmail(o.id, o.name, editingOfficerEmail)}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0 0.5rem', height: '26px', fontSize: '0.75rem', color: '#f87171', width: 'auto' }}
                              onClick={() => setEditingOfficerId(null)}
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingOfficerId(o.id);
                              setEditingOfficerEmail(o.email || '');
                            }}
                            style={{ cursor: 'pointer', color: o.email ? 'var(--primary)' : 'var(--text-secondary)', fontStyle: o.email ? 'normal' : 'italic', textDecoration: 'underline' }}
                            title="Klik untuk edit email"
                          >
                            {o.email || 'Belum ada email (klik di sini untuk menambahkan)'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {displayedManageOfficers.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                        Belum ada officer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      ) : (
        /* ========================================================================= */
        /*                            OFFICER DASHBOARD                              */
        /* ========================================================================= */
        <>
          <section className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              {/* Tab Switcher (Only Prospek, Aplikasi IN, Aplikasi Valid) */}
              <div className="tabs-container" style={{ marginBottom: 0, borderBottom: 'none' }}>
                {['Prospek', 'Aplikasi IN', 'Aplikasi Valid'].map((tab) => (
                  <button
                    key={tab}
                    className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab);
                      setSearchQuery('');
                      setFilterStatus('');
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '720px', flexWrap: 'wrap', alignItems: 'center' }}>
                {activeTab === 'Prospek' && prospects.filter(p => p.officer_id === user.id && p.pipeline === 'Prospek').length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                    {prospects.filter(p => p.officer_id === user.id && p.pipeline === 'Prospek').length > 1 && (
                      <select
                        className="input-control"
                        value={selectedWaProspectId}
                        onChange={(e) => setSelectedWaProspectId(e.target.value)}
                        style={{ height: '30px', padding: '0 2rem 0 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      >
                        <option value="">Pilih Customer</option>
                        {prospects.filter(p => p.officer_id === user.id && p.pipeline === 'Prospek').map((p) => (
                          <option key={p.id} value={p.id}>{p.nama}</option>
                        ))}
                      </select>
                    )}
                    <button onClick={handleSendWaProspect} className="btn-wa" style={{ margin: 0, height: '30px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Kirim WA Prospek
                    </button>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Cari nama customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {activeTab === 'Aplikasi IN' && (
                  <div style={{ width: '180px' }}>
                    <select
                      className="input-control"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="">Semua Status</option>
                      <option value="Belum Melengkapi Data">Belum Melengkapi Data</option>
                      <option value="On Progress">On Progress</option>
                      <option value="RE">RE</option>
                      <option value="NB">NB</option>
                      <option value="DP OP">DP OP</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="responsive-table-container">
              {activeTab === 'Aplikasi Valid' ? (
                <table className="data-table" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Nama Customer</th>
                      <th style={{ width: '12%' }}>Segmen</th>
                      <th style={{ width: '14%' }}>No Reg</th>
                      <th style={{ width: '14%' }}>Date IN</th>
                      <th style={{ width: '18%' }}>Date Valid</th>
                      <th style={{ width: '27%' }}>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedProspects.map((p) => (
                      <tr key={p.id}>
                        <td style={{ position: 'relative', paddingRight: '50px' }}>
                          <strong>{p.nama}</strong>
                          {/* Only open the datepicker modal for valid prospects */}
                          <button className="row-hover-btn" onClick={() => openDateValid(p)}>
                            Edit
                          </button>
                        </td>
                        <td>{p.segment ? <span className="badge badge-info">{p.segment}</span> : '-'}</td>
                        <td><code>{p.no_reg}</code></td>
                        <td>{formatDate(p.date_in)}</td>
                        <td>
                          <span className="badge badge-success">
                            {formatDate(p.date_valid)}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{formatKeterangan(p.keterangan)}</td>
                      </tr>
                    ))}
                    {displayedProspects.length === 0 && (
                      <tr>
                        <td colSpan="6">
                          <div className="empty-state">
                            <div className="empty-icon">📂</div>
                            <h3>Belum ada data di tahapan ini</h3>
                            <p style={{ marginTop: '0.25rem' }}>
                              Pindahkan data dari tahap sebelumnya ke tahapan {activeTab}.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="data-table">
                  {activeTab === 'Prospek' ? (
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Nama Customer</th>
                        <th style={{ width: '12%' }}>Pengajuan</th>
                        <th style={{ width: '14%' }}>Tanggal Input</th>
                        <th style={{ width: '16%' }}>Alamat</th>
                        <th style={{ width: '9%' }}>Status</th>
                        <th style={{ width: '10%' }}>Progress</th>
                        <th style={{ width: '10%' }}>Catatan</th>
                        <th style={{ width: '14%', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                  ) : (
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Nama Customer</th>
                        <th style={{ width: '12%' }}>Segmen</th>
                        <th style={{ width: '14%' }}>No Reg</th>
                        <th style={{ width: '14%' }}>Date IN</th>
                        <th style={{ width: '18%' }}>Status</th>
                        <th style={{ width: '13%' }}>Keterangan</th>
                        <th style={{ width: '14%', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {displayedProspects.map((p) => {
                      const hasCompletedData = isOperationProspect(p) || (p.no_reg && p.segment);
                      return (
                        <tr key={p.id}>
                          {activeTab === 'Prospek' ? (
                            <>
                              <td style={{ position: 'relative', paddingRight: '50px' }}>
                                <strong>{p.nama}</strong>
                                <button className="row-hover-btn" onClick={() => openEditProspek(p)}>
                                  Edit
                                </button>
                              </td>
                              <td><span className="badge badge-info">{p.pengajuan}</span></td>
                              <td>{formatDate(p.created_at)}</td>
                              <td style={{ fontSize: '0.85rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.alamat}
                              </td>
                              <td>
                                <span className={`badge ${p.status === 'Close' ? 'badge-danger' : 'badge-success'}`}>
                                  {p.status || 'Open'}
                                </span>
                              </td>
                              <td>{p.progress || '-'}</td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatKeterangan(p.note)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', width: 'auto', whiteSpace: 'nowrap' }}
                                  onClick={() => handleMoveToAplikasiIn(p)}
                                >
                                  Aplikasi IN
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ position: 'relative', paddingRight: '50px' }}>
                                <strong>{p.nama}</strong>
                                <button className="row-hover-btn" onClick={() => openLengkapiData(p)}>
                                  Edit
                                </button>
                              </td>
                              <td>{p.segment ? <span className="badge badge-info">{p.segment}</span> : '-'}</td>
                              <td><code>{p.no_reg || '-'}</code></td>
                              <td>{formatDate(p.date_in)}</td>
                              <td>
                                <span className={`badge ${p.status === 'OV' ? 'badge-success' : p.status === 'Belum Melengkapi Data' ? 'badge-danger' : 'badge-warning'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.85rem' }}>{formatKeterangan(p.keterangan)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                  {hasCompletedData ? (
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', width: 'auto', whiteSpace: 'nowrap' }}
                                      onClick={() => openDateValid(p)}
                                    >
                                      Aplikasi Valid
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', width: 'auto', whiteSpace: 'nowrap' }}
                                      onClick={() => openLengkapiData(p)}
                                    >
                                      Lengkapi Data
                                    </button>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {displayedProspects.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ padding: 0 }}>
                          <div
                            className="empty-state"
                            onClick={openAddProspek}
                            style={{ cursor: 'pointer', padding: '3.5rem 2rem', transition: 'all 0.25rem ease' }}
                          >
                            <div className="empty-icon" style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</div>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Belum ada data Prospek</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                              Klik di sini atau tombol "+ Input Data Baru" untuk mendaftarkan customer baru.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/*                                  MODALS                                   */}
      {/* ========================================================================= */}

      {/* 1. Modal Input/Edit Prospek */}
      {isInputModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }} className="text-gradient">
                {isEditMode ? 'Edit Data Prospek' : 'Input Data Baru'}
              </h2>
              {isEditMode && (
                <button
                  type="button"
                  className="btn"
                  onClick={handleDeleteProspect}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    width: '42px',
                    height: '42px',
                    fontSize: '1.25rem',
                    transition: 'all 0.2s ease'
                  }}
                  title="Hapus Prospek"
                >
                  🗑️
                </button>
              )}
            </div>

            {/* Tab Switcher in Modal (only in Add Mode) */}
            {!isEditMode && (
              <div className="tabs-container" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  className={`tab-btn ${activeInputTab === 'Prospek' ? 'active' : ''}`}
                  onClick={() => setActiveInputTab('Prospek')}
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  Prospek
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeInputTab === 'Contacting' ? 'active' : ''}`}
                  onClick={() => setActiveInputTab('Contacting')}
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  Contacting
                </button>
              </div>
            )}

            {activeInputTab === 'Contacting' && !isEditMode ? (
              <form onSubmit={handleAddContacting}>
                <div className="form-group">
                  <label htmlFor="contacting-call">Jumlah Call</label>
                  <input
                    id="contacting-call"
                    type="number"
                    min="0"
                    className="input-control"
                    required
                    placeholder="Masukkan angka (contoh: 15)"
                    value={contactingForm.call}
                    onChange={(e) => setContactingForm({ ...contactingForm, call: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contacting-blasting">Jumlah Blasting</label>
                  <input
                    id="contacting-blasting"
                    type="number"
                    min="0"
                    className="input-control"
                    required
                    placeholder="Masukkan angka (contoh: 30)"
                    value={contactingForm.blasting}
                    onChange={(e) => setContactingForm({ ...contactingForm, blasting: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsInputModalOpen(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Simpan Contacting
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddProspect}>
                <div className="form-group">
                  <label>Jenis Pengajuan</label>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                    <label className="checkbox-group">
                      <input
                        type="radio"
                        name="pengajuan"
                        value="Non Top Up"
                        checked={inputForm.pengajuan === 'Non Top Up'}
                        onChange={(e) => setInputForm({ ...inputForm, pengajuan: e.target.value })}
                      />
                      Non Top Up
                    </label>
                    <label className="checkbox-group">
                      <input
                        type="radio"
                        name="pengajuan"
                        value="Top Up"
                        checked={inputForm.pengajuan === 'Top Up'}
                        onChange={(e) => setInputForm({ ...inputForm, pengajuan: e.target.value })}
                      />
                      Top Up
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="cust-name">Nama Customer</label>
                  <input
                    id="cust-name"
                    type="text"
                    className="input-control"
                    required
                    placeholder="Masukkan nama"
                    value={inputForm.nama}
                    onChange={(e) => setInputForm({ ...inputForm, nama: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cust-address">Alamat</label>
                  <textarea
                    id="cust-address"
                    className="input-control"
                    rows={2}
                    placeholder="Alamat lengkap"
                    value={inputForm.alamat}
                    onChange={(e) => setInputForm({ ...inputForm, alamat: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="cust-status">Status</label>
                    <select
                      id="cust-status"
                      className="input-control"
                      value={inputForm.status}
                      onChange={(e) => setInputForm({ ...inputForm, status: e.target.value })}
                    >
                      <option value="Open">Open</option>
                      <option value="Close">Close</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="cust-progress">Progress</label>
                    <input
                      id="cust-progress"
                      type="text"
                      className="input-control"
                      placeholder="Contoh: Kunjungan Pertama"
                      value={inputForm.progress}
                      onChange={(e) => setInputForm({ ...inputForm, progress: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="cust-note">Catatan</label>
                  <textarea
                    id="cust-note"
                    className="input-control"
                    rows={2}
                    placeholder="Catatan tambahan..."
                    value={inputForm.note}
                    onChange={(e) => setInputForm({ ...inputForm, note: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsInputModalOpen(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {isEditMode ? 'Simpan Perubahan' : 'Simpan Data'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. Modal Lengkapi/Edit Data (Aplikasi IN) */}
      {isLengkapiModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0 }} className="text-gradient">Lengkapi Data Aplikasi</h2>
              <button
                type="button"
                className="btn"
                onClick={handleDeleteProspect}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  width: '42px',
                  height: '42px',
                  fontSize: '1.25rem',
                  transition: 'all 0.2s ease'
                }}
                title="Hapus Prospek"
              >
                🗑️
              </button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Customer: <strong>{selectedProspect?.nama}</strong>
            </p>
            <form onSubmit={handleLengkapiData}>
              <div className="form-group">
                <label htmlFor="edit-segment">Segmen</label>
                <select
                  id="edit-segment"
                  className="input-control"
                  value={inForm.segment}
                  onChange={(e) => setInForm({ ...inForm, segment: e.target.value })}
                >
                  <option value="">Pilih Segmen</option>
                  <option value="Bronze">Bronze</option>
                  <option value="Flexi">Flexi</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                  <option value="Solitaire">Solitaire</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-reg">No Reg (7 Digit)</label>
                <input
                  id="edit-reg"
                  type="text"
                  maxLength={7}
                  className="input-control"
                  placeholder="Contoh: 1234567"
                  value={inForm.no_reg}
                  onChange={(e) => setInForm({ ...inForm, no_reg: e.target.value.replace(/\D/g, '') })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-date">Date IN</label>
                <input
                  id="edit-date"
                  type="date"
                  className="input-control"
                  required
                  value={inForm.date_in}
                  onChange={(e) => setInForm({ ...inForm, date_in: e.target.value })}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  className="input-control"
                  value={inForm.status}
                  onChange={(e) => setInForm({ ...inForm, status: e.target.value })}
                >
                  <option value="On Progress">On Progress</option>
                  <option value="RE">RE</option>
                  <option value="NB">NB</option>
                  <option value="DP OP">DP OP</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-ket">Keterangan</label>
                <textarea
                  id="edit-ket"
                  className="input-control"
                  rows={2}
                  placeholder="Keterangan aplikasi..."
                  value={inForm.keterangan}
                  onChange={(e) => setInForm({ ...inForm, keterangan: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsLengkapiModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Input Date Valid */}
      {isDateValidModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '400px' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '3rem' }}>📅</span>
            </div>
            <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }} className="text-gradient">Tanggal Valid</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Pilih tanggal valid untuk customer:<br /><strong>{selectedProspect?.nama}</strong>
            </p>
            <form onSubmit={handleSaveDateValid}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="valid-date" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Klik kolom di bawah untuk membuka kalender:
                </label>
                <input
                  id="valid-date"
                  type="date"
                  className="input-control"
                  required
                  value={dateValid}
                  onChange={(e) => setDateValid(e.target.value)}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontSize: '1.1rem',
                    letterSpacing: '0.05em',
                    padding: '0.875rem 1rem',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    background: 'rgba(99, 102, 241, 0.05)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsDateValidModalOpen(false)} style={{ flex: 1 }}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Simpan Tanggal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// Custom SVG Line Chart Component for Premium Visuals and SSR Safety
const LineChart = ({ data, showCall = true, showBlasting = true, showProspek = true }) => {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(
    ...data.map(d => {
      const vals = [];
      if (showCall) vals.push(d.call);
      if (showBlasting) vals.push(d.blasting);
      if (showProspek) vals.push(d.prospek);
      return vals.length > 0 ? Math.max(...vals) : 0;
    }),
    10
  );

  const width = 800;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.call / maxVal) * chartHeight;
    const yBlast = paddingTop + chartHeight - (d.blasting / maxVal) * chartHeight;
    const yProspek = paddingTop + chartHeight - (d.prospek / maxVal) * chartHeight;
    return { x, y, yBlast, yProspek, label: d.label, call: d.call, blasting: d.blasting, prospek: d.prospek };
  });

  const getPathD = (pts, key) => {
    if (pts.length === 0) return '';
    return pts.reduce((path, p, i) => {
      const yVal = key === 'call' ? p.y : key === 'blasting' ? p.yBlast : p.yProspek;
      return i === 0 ? `M ${p.x} ${yVal}` : `${path} L ${p.x} ${yVal}`;
    }, '');
  };

  const pathCall = getPathD(points, 'call');
  const pathBlasting = getPathD(points, 'blasting');
  const pathProspek = getPathD(points, 'prospek');

  const [activePoint, setActivePoint] = useState(null);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = paddingTop + chartHeight * (1 - ratio);
    const value = Math.round(maxVal * ratio);
    return { y, value };
  });

  return (
    <div className="chart-container" style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>

        {/* Grid Lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={line.y}
              x2={width - paddingRight}
              y2={line.y}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeDasharray="3 3"
            />
            <text
              x={paddingLeft - 8}
              y={line.y + 4}
              fill="rgba(255, 255, 255, 0.5)"
              fontSize="10"
              textAnchor="end"
            >
              {line.value}
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {points.map((p, i) => {
          const step = Math.ceil(data.length / 10);
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={height - 8}
              fill="rgba(255, 255, 255, 0.5)"
              fontSize="10"
              textAnchor="middle"
            >
              {p.label}
            </text>
          );
        })}


        {/* Trend Lines with elegant thin strokes */}
        {/* Call: Solid Yellow */}
        {showCall && <path d={pathCall} fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />}
        {/* Blasting: Solid Red */}
        {showBlasting && <path d={pathBlasting} fill="none" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />}
        {/* Prospek: Solid Sky Blue */}
        {showProspek && <path d={pathProspek} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />}

        {/* Permanent Distinct Shape Markers on Every Data Point (Small and Elegant) */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Call: Yellow Circle */}
            {showCall && <circle cx={p.x} cy={p.y} r="2.5" fill="#ffd700" stroke="#0f172a" strokeWidth="1" />}

            {/* Blasting: Red Square */}
            {showBlasting && <rect x={p.x - 2.5} y={p.yBlast - 2.5} width="5" height="5" fill="#ff4d4d" stroke="#0f172a" strokeWidth="1" />}

            {/* Prospek: Sky Blue Diamond */}
            {showProspek && (
              <polygon
                points={`${p.x},${p.yProspek - 3.5} ${p.x + 3.5},${p.yProspek} ${p.x},${p.yProspek + 3.5} ${p.x - 3.5},${p.yProspek}`}
                fill="#38bdf8"
                stroke="#0f172a"
                strokeWidth="1"
              />
            )}
          </g>
        ))}

        {/* Interactive Hover Vertical Bar */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={paddingTop}
            x2={activePoint.x}
            y2={paddingTop + chartHeight}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        )}

        {/* Interactive Hover Dots (Larger & Glowing on Hover) */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Hover Target Area */}
            <rect
              x={p.x - (chartWidth / (data.length - 1 || 1)) / 2}
              y={paddingTop}
              width={chartWidth / (data.length - 1 || 1)}
              height={chartHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActivePoint(p)}
              onMouseLeave={() => setActivePoint(null)}
            />

            {activePoint === p && (
              <>
                {showCall && <circle cx={p.x} cy={p.y} r="6" fill="#ffd700" stroke="#ffffff" strokeWidth="1.5" />}
                {showBlasting && <circle cx={p.x} cy={p.yBlast} r="6" fill="#ff4d4d" stroke="#ffffff" strokeWidth="1.5" />}
                {showProspek && <circle cx={p.x} cy={p.yProspek} r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />}
              </>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip Overlay */}
      {activePoint && (
        <div
          className="chart-tooltip animate-fade-in"
          style={{
            position: 'absolute',
            left: `${(activePoint.x / width) * 100}%`,
            top: '10px',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          <div className="tooltip-title">{activePoint.label}</div>
          {showCall && <div className="tooltip-item"><span className="dot" style={{ background: '#ffd700' }}></span> Call: <strong>{activePoint.call}</strong></div>}
          {showBlasting && <div className="tooltip-item"><span className="dot" style={{ background: '#ff4d4d' }}></span> Blasting: <strong>{activePoint.blasting}</strong></div>}
          {showProspek && <div className="tooltip-item"><span className="dot" style={{ background: '#38bdf8' }}></span> Prospek: <strong>{activePoint.prospek}</strong></div>}
        </div>
      )}
    </div>
  );
};

// Custom SVG Pipeline Chart Component
const PipelineChart = ({ data, showProspek = true, showAplikasiIn = true, showAplikasiValid = true }) => {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(
    ...data.map(d => {
      const vals = [];
      if (showProspek) vals.push(d.prospek);
      if (showAplikasiIn) vals.push(d.aplikasiIn);
      if (showAplikasiValid) vals.push(d.aplikasiValid);
      return vals.length > 0 ? Math.max(...vals) : 0;
    }),
    10
  );

  const width = 800;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth;
    const yProspek = paddingTop + chartHeight - (d.prospek / maxVal) * chartHeight;
    const yAppIn = paddingTop + chartHeight - (d.aplikasiIn / maxVal) * chartHeight;
    const yAppValid = paddingTop + chartHeight - (d.aplikasiValid / maxVal) * chartHeight;
    return { x, yProspek, yAppIn, yAppValid, label: d.label, prospek: d.prospek, aplikasiIn: d.aplikasiIn, aplikasiValid: d.aplikasiValid };
  });

  const getPathD = (pts, key) => {
    if (pts.length === 0) return '';
    return pts.reduce((path, p, i) => {
      const yVal = key === 'prospek' ? p.yProspek : key === 'aplikasiIn' ? p.yAppIn : p.yAppValid;
      return i === 0 ? `M ${p.x} ${yVal}` : `${path} L ${p.x} ${yVal}`;
    }, '');
  };

  const pathProspek = getPathD(points, 'prospek');
  const pathAplikasiIn = getPathD(points, 'aplikasiIn');
  const pathAplikasiValid = getPathD(points, 'aplikasiValid');

  const [activePoint, setActivePoint] = useState(null);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = paddingTop + chartHeight * (1 - ratio);
    const value = Math.round(maxVal * ratio);
    return { y, value };
  });

  return (
    <div className="chart-container" style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        {/* Grid Lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={line.y}
              x2={width - paddingRight}
              y2={line.y}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeDasharray="3 3"
            />
            <text
              x={paddingLeft - 8}
              y={line.y + 4}
              fill="rgba(255, 255, 255, 0.5)"
              fontSize="10"
              textAnchor="end"
            >
              {line.value}
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {points.map((p, i) => {
          const step = Math.ceil(data.length / 10);
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={height - 8}
              fill="rgba(255, 255, 255, 0.5)"
              fontSize="10"
              textAnchor="middle"
            >
              {p.label}
            </text>
          );
        })}

        {/* Trend Lines */}
        {/* Prospek: Solid Sky Blue */}
        {showProspek && <path d={pathProspek} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />}
        {/* Aplikasi IN: Solid Purple */}
        {showAplikasiIn && <path d={pathAplikasiIn} fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />}
        {/* Aplikasi Valid: Solid Emerald Green */}
        {showAplikasiValid && <path d={pathAplikasiValid} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chart-line" />}

        {/* Permanent Distinct Shape Markers */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Prospek: Sky Blue Circle */}
            {showProspek && <circle cx={p.x} cy={p.yProspek} r="2.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />}

            {/* Aplikasi IN: Purple Square */}
            {showAplikasiIn && <rect x={p.x - 2.5} y={p.yAppIn - 2.5} width="5" height="5" fill="#c084fc" stroke="#0f172a" strokeWidth="1" />}

            {/* Aplikasi Valid: Emerald Diamond */}
            {showAplikasiValid && (
              <polygon
                points={`${p.x},${p.yAppValid - 3.5} ${p.x + 3.5},${p.yAppValid} ${p.x},${p.yAppValid + 3.5} ${p.x - 3.5},${p.yAppValid}`}
                fill="#34d399"
                stroke="#0f172a"
                strokeWidth="1"
              />
            )}
          </g>
        ))}

        {/* Interactive Hover Vertical Bar */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={paddingTop}
            x2={activePoint.x}
            y2={paddingTop + chartHeight}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        )}

        {/* Interactive Hover Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x - (chartWidth / (data.length - 1 || 1)) / 2}
              y={paddingTop}
              width={chartWidth / (data.length - 1 || 1)}
              height={chartHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActivePoint(p)}
              onMouseLeave={() => setActivePoint(null)}
            />

            {activePoint === p && (
              <>
                {showProspek && <circle cx={p.x} cy={p.yProspek} r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />}
                {showAplikasiIn && <circle cx={p.x} cy={p.yAppIn} r="6" fill="#c084fc" stroke="#ffffff" strokeWidth="1.5" />}
                {showAplikasiValid && <circle cx={p.x} cy={p.yAppValid} r="6" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" />}
              </>
            )}
          </g>
        ))}
      </svg>

      {/* Tooltip Overlay */}
      {activePoint && (
        <div
          className="chart-tooltip animate-fade-in"
          style={{
            position: 'absolute',
            left: `${(activePoint.x / width) * 100}%`,
            top: '10px',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          <div className="tooltip-title">{activePoint.label}</div>
          {showProspek && <div className="tooltip-item"><span className="dot" style={{ background: '#38bdf8' }}></span> Prospek: <strong>{activePoint.prospek}</strong></div>}
          {showAplikasiIn && <div className="tooltip-item"><span className="dot" style={{ background: '#c084fc' }}></span> Aplikasi IN: <strong>{activePoint.aplikasiIn}</strong></div>}
          {showAplikasiValid && <div className="tooltip-item"><span className="dot" style={{ background: '#34d399' }}></span> Aplikasi Valid: <strong>{activePoint.aplikasiValid}</strong></div>}
        </div>
      )}
    </div>
  );
};

