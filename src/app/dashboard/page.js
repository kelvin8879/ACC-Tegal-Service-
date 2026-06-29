'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const [coordError, setCoordError] = useState('');
  const [coordSuccess, setCoordSuccess] = useState('');

  // Session check
  useEffect(() => {
    const session = localStorage.getItem('acc_session');
    if (!session) {
      router.push('/');
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

  // Load Data
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    if (user.isMock) {
      // Load from localStorage
      const localProspects = localStorage.getItem('acc_prospects');
      if (localProspects) {
        setProspects(JSON.parse(localProspects));
      } else {
        // Seed initial mock prospects representing the 3 stages with different dates
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStr = lastMonth.toISOString().split('T')[0];

        const seedProspects = [
          {
            id: 'p-1',
            officer_id: 'mock-1',
            pipeline: 'Prospek',
            pengajuan: 'Top Up',
            nama: 'Rian Hidayat',
            alamat: 'Jl. Merdeka No. 12, Tegal',
            status: 'Open',
            progress: 'Kunjungan Pertama',
            call: true,
            blasting: false,
            note: 'Butuh follow up minggu depan',
            created_at: new Date().toISOString(), // Today -> Prospek (Today) + Call (Today)
          },
          {
            id: 'p-1-old',
            officer_id: 'mock-1',
            pipeline: 'Prospek',
            pengajuan: 'Non Top Up',
            nama: 'Joko Widodo (Kemarin)',
            alamat: 'Jl. Diponegoro No. 1, Brebes',
            status: 'Open',
            progress: 'Kunjungan Pertama',
            call: true,
            blasting: true,
            note: 'Telepon ulang nanti',
            created_at: yesterday.toISOString(), // Yesterday -> NOT counted in Today's Prospek/Call/Blast
          },
          {
            id: 'p-2',
            officer_id: 'mock-1',
            pipeline: 'Prospek',
            pengajuan: 'Non Top Up',
            nama: 'Sarah Wijaya',
            alamat: 'Jl. Ahmad Yani No. 45, Tegal',
            status: 'Open',
            progress: 'Kunjungan Kedua',
            call: false,
            blasting: true,
            note: 'Menunggu respon WA',
            created_at: new Date().toISOString(), // Today -> Prospek (Today) + Blasting (Today)
          },
          {
            id: 'p-3',
            officer_id: 'mock-1',
            pipeline: 'Aplikasi IN',
            pengajuan: 'Non Top Up',
            nama: 'Dewi Lestari',
            alamat: 'Jl. Mawar No. 5, Brebes',
            status: 'On Progress',
            progress: '',
            call: false,
            blasting: false,
            note: 'Berkas lengkap sedang diverifikasi',
            segment: 'Gold',
            no_reg: '1234567',
            date_in: todayStr, // This Month -> Counted in This Month's IN
            keterangan: 'Sedang diverifikasi',
            created_at: new Date().toISOString(),
          },
          {
            id: 'p-3-old',
            officer_id: 'mock-1',
            pipeline: 'Aplikasi IN',
            pengajuan: 'Top Up',
            nama: 'Megawati (Bulan Lalu)',
            alamat: 'Jl. Sukarno No. 2, Pemalang',
            status: 'RE',
            progress: '',
            call: false,
            blasting: false,
            note: 'Perbaikan berkas',
            segment: 'Bronze',
            no_reg: '1112223',
            date_in: lastMonthStr, // Last Month -> NOT counted in This Month's IN
            keterangan: 'Menunggu tanda tangan',
            created_at: lastMonth.toISOString(),
          },
          {
            id: 'p-4',
            officer_id: 'mock-2',
            pipeline: 'Aplikasi Valid',
            pengajuan: 'Top Up',
            nama: 'Bambang Susilo',
            alamat: 'Jl. Melati No. 8, Slawi',
            status: 'OV',
            progress: '',
            call: false,
            blasting: false,
            note: 'Persetujuan komite beres',
            segment: 'Platinum',
            no_reg: '7654321',
            date_in: todayStr,
            date_valid: todayStr, // This Month -> Counted in This Month's Valid
            keterangan: 'Aplikasi disetujui',
            created_at: new Date().toISOString(),
          },
        ];
        localStorage.setItem('acc_prospects', JSON.stringify(seedProspects));
        setProspects(seedProspects);
      }

      // Load officers from localStorage
      const localOfficers = localStorage.getItem('acc_officers');
      if (localOfficers) {
        setOfficers(JSON.parse(localOfficers));
      } else {
        const seedOfficers = [
          { id: 'mock-1', name: 'Budi Pratama (Mock)', pin: '1234' },
          { id: 'mock-2', name: 'Siti Aminah (Mock)', pin: '5678' },
          { id: 'mock-3', name: 'Andi Wijaya (Mock)', pin: '1111' },
        ];
        localStorage.setItem('acc_officers', JSON.stringify(seedOfficers));
        setOfficers(seedOfficers);
      }
    } else {
      // Load from Supabase
      try {
        let prospectQuery = supabase.from('prospects').select('*').order('created_at', { ascending: false });
        
        // If Officer, only load their own prospects
        if (user.role === 'officer') {
          prospectQuery = prospectQuery.eq('officer_id', user.id);
        }

        const { data: pData, error: pError } = await prospectQuery;
        if (pError) throw pError;
        setProspects(pData || []);

        const { data: oData, error: oError } = await supabase
          .from('officers')
          .select('id, name')
          .order('name', { ascending: true });
        if (oError) throw oError;
        setOfficers(oData || []);
      } catch (err) {
        console.error('Error fetching data from Supabase:', err.message);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check Supabase connection and size
  useEffect(() => {
    if (!user) return;
    if (user.isMock) {
      setDbStatus('CONNECTED');
      return;
    }

    const checkConnection = async () => {
      try {
        const { error: connError } = await supabase.from('prospects').select('id').limit(1);
        if (connError) throw connError;
        setDbStatus('CONNECTED');

        const { data: sizeData, error: sizeError } = await supabase.rpc('get_db_size');
        if (!sizeError && sizeData) {
          setDbSize({
            size_mb: Number(sizeData.size_mb),
            is_almost_full: Boolean(sizeData.is_almost_full)
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
  function handleLogout() {
    localStorage.removeItem('acc_session');
    router.push('/');
  }

  // Save/Update helper
  async function saveProspectsList(updatedList) {
    if (user.isMock) {
      localStorage.setItem('acc_prospects', JSON.stringify(updatedList));
      setProspects(updatedList);
    } else {
      await loadData(); // Reload from Supabase
    }
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
    setIsInputModalOpen(true);
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

      if (user.isMock) {
        const updated = prospects.map((p) =>
          p.id === selectedProspect.id ? { ...p, ...updateFields } : p
        );
        await saveProspectsList(updated);
      } else {
        try {
          const { error } = await supabase
            .from('prospects')
            .update(updateFields)
            .eq('id', selectedProspect.id);
          if (error) throw error;
          await saveProspectsList();
        } catch (err) {
          alert('Gagal menyimpan perubahan: ' + err.message);
        }
      }
    } else {
      // Add Mode: Insert new
      const newRecord = {
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
      };

      if (user.isMock) {
        const newItem = {
          ...newRecord,
          id: 'p-' + Date.now(),
          created_at: new Date().toISOString(),
        };
        const updated = [newItem, ...prospects];
        await saveProspectsList(updated);
      } else {
        try {
          const { error } = await supabase.from('prospects').insert([newRecord]);
          if (error) throw error;
          await saveProspectsList();
        } catch (err) {
          alert('Gagal menambah data: ' + err.message);
        }
      }
    }

    setIsInputModalOpen(false);
    setSelectedProspect(null);
  }

  // One-click transition from 'Prospek' to 'Aplikasi IN'
  async function handleMoveToAplikasiIn(prospect) {
    const todayStr = new Date().toISOString().split('T')[0];
    const updateFields = {
      pipeline: 'Aplikasi IN',
      segment: '', // Empty on transition as requested
      date_in: todayStr, // Default date
      status: 'Belum Melengkapi Data', // Default status
      no_reg: '', // Needs to be filled in later
      keterangan: '-', // Set to '-' instead of empty or text as requested
    };

    if (user.isMock) {
      const updated = prospects.map((p) =>
        p.id === prospect.id ? { ...p, ...updateFields } : p
      );
      await saveProspectsList(updated);
    } else {
      try {
        const { error } = await supabase
          .from('prospects')
          .update(updateFields)
          .eq('id', prospect.id);
        if (error) throw error;
        await saveProspectsList();
      } catch (err) {
        alert('Gagal memproses ke Aplikasi IN: ' + err.message);
      }
    }
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
      status: prospect.status === 'OV' ? 'On Progress' : (prospect.status || 'Belum Melengkapi Data'), // Clean OV if any
      keterangan: prospect.keterangan || '',
    });
    setIsLengkapiModalOpen(true);
  }

  // Submit "Lengkapi/Edit Data" (for IN)
  async function handleLengkapiData(e) {
    e.preventDefault();
    if (!inForm.segment) {
      return alert('Segmen harus dipilih.');
    }
    if (!inForm.no_reg || inForm.no_reg.length !== 7 || !/^\d+$/.test(inForm.no_reg)) {
      return alert('No Reg harus berisi 7 digit angka.');
    }

    // Clean description to avoid "dipindahkan" text
    const currentKet = inForm.keterangan;
    const cleanKet = (!currentKet || currentKet.toLowerCase().includes('dipindahkan')) ? '-' : currentKet;

    const updateFields = {
      segment: inForm.segment,
      no_reg: inForm.no_reg,
      date_in: inForm.date_in,
      status: inForm.status,
      keterangan: cleanKet,
    };

    if (user.isMock) {
      const updated = prospects.map((p) =>
        p.id === selectedProspect.id ? { ...p, ...updateFields } : p
      );
      await saveProspectsList(updated);
    } else {
      try {
        const { error } = await supabase
          .from('prospects')
          .update(updateFields)
          .eq('id', selectedProspect.id);
        if (error) throw error;
        await saveProspectsList();
      } catch (err) {
        alert('Gagal mengupdate data: ' + err.message);
      }
    }

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

    if (user.isMock) {
      const updated = prospects.map((p) =>
        p.id === selectedProspect.id ? { ...p, ...updateFields } : p
      );
      await saveProspectsList(updated);
    } else {
      try {
        const { error } = await supabase
          .from('prospects')
          .update(updateFields)
          .eq('id', selectedProspect.id);
        if (error) throw error;
        await saveProspectsList();
      } catch (err) {
        alert('Gagal menyimpan tanggal valid: ' + err.message);
      }
    }

    setIsDateValidModalOpen(false);
    setSelectedProspect(null);
    if (isTransition) {
      setActiveTab('Aplikasi Valid');
    }
  }

  // Coordinator: Add Officer
  async function handleAddOfficer(e) {
    e.preventDefault();
    setCoordError('');
    setCoordSuccess('');

    if (!newOfficerName || !newOfficerPin) {
      return setCoordError('Nama dan PIN harus diisi.');
    }
    if (newOfficerPin.length !== 4 || !/^\d+$/.test(newOfficerPin)) {
      return setCoordError('PIN harus berisi 4 digit angka.');
    }

    if (user.isMock) {
      const newOfficer = {
        id: 'mock-' + Date.now(),
        name: newOfficerName,
        pin: newOfficerPin,
      };
      const updatedOfficers = [...officers, newOfficer];
      localStorage.setItem('acc_officers', JSON.stringify(updatedOfficers));
      setOfficers(updatedOfficers);
      setCoordSuccess(`Officer ${newOfficerName} berhasil ditambahkan!`);
      setNewOfficerName('');
      setNewOfficerPin('');
    } else {
      try {
        const { error } = await supabase
          .from('officers')
          .insert([{ name: newOfficerName, pin: newOfficerPin }]);
        if (error) throw error;

        setCoordSuccess(`Officer ${newOfficerName} berhasil ditambahkan!`);
        setNewOfficerName('');
        setNewOfficerPin('');
        await loadData();
      } catch (err) {
        setCoordError('Gagal menambah officer: ' + err.message);
      }
    }
  }

  // Coordinator: Delete Officer
  async function handleDeleteOfficer(id, name) {
    if (!confirm(`Apakah Anda yakin ingin menghapus officer ${name}?`)) return;

    if (user.isMock) {
      const updatedOfficers = officers.filter((o) => o.id !== id);
      localStorage.setItem('acc_officers', JSON.stringify(updatedOfficers));
      setOfficers(updatedOfficers);

      // Clean up prospects for deleted officer
      const updatedProspects = prospects.map((p) =>
        p.officer_id === id ? { ...p, officer_id: null } : p
      );
      localStorage.setItem('acc_prospects', JSON.stringify(updatedProspects));
      setProspects(updatedProspects);
    } else {
      try {
        const { error } = await supabase.from('officers').delete().eq('id', id);
        if (error) throw error;
        await loadData();
      } catch (err) {
        alert('Gagal menghapus officer: ' + err.message);
      }
    }
  }

  // Compute Statistics (for Cards - separated daily vs monthly)
  const getStats = () => {
    // If Officer, filter prospects by their ID. If Coordinator, count all.
    const relevantProspects = user?.role === 'officer'
      ? prospects.filter((p) => p.officer_id === user.id)
      : prospects;

    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Call (Hari Ini): Created within current business day (shifts at 3 AM) with call = true
    const countCall = relevantProspects.filter(
      (p) => p.call === true && isCreatedWithinCurrentBusinessDay(p.created_at)
    ).length;

    // Blasting (Hari Ini): Created within current business day (shifts at 3 AM) with blasting = true
    const countBlasting = relevantProspects.filter(
      (p) => p.blasting === true && isCreatedWithinCurrentBusinessDay(p.created_at)
    ).length;

    // Prospek (Hari Ini): Created within current business day (shifts at 3 AM) in Prospek pipeline
    const countProspek = relevantProspects.filter(
      (p) => p.pipeline === 'Prospek' && isCreatedWithinCurrentBusinessDay(p.created_at)
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

    return { countCall, countBlasting, countProspek, countProspekMonth, countAplikasiIn, countAplikasiValid };
  };

  const stats = getStats();

  // Compute Officer Performance (for Coordinator - matching daily vs monthly)
  const getOfficerPerformance = () => {
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    return officers.map((o) => {
      const oProspects = prospects.filter((p) => p.officer_id === o.id);
      
      const call = oProspects.filter(
        (p) => p.call === true && isCreatedWithinCurrentBusinessDay(p.created_at)
      ).length;

      const blasting = oProspects.filter(
        (p) => p.blasting === true && isCreatedWithinCurrentBusinessDay(p.created_at)
      ).length;

      const prospek = oProspects.filter(
        (p) => p.pipeline === 'Prospek' && isCreatedWithinCurrentBusinessDay(p.created_at)
      ).length;

      const prospekMonth = oProspects.filter((p) => {
        if (p.pipeline !== 'Prospek') return false;
        const dateToCheck = p.created_at;
        return dateToCheck && dateToCheck.startsWith(currentMonthStr);
      }).length;
      
      const aplikasiIn = oProspects.filter((p) => {
        if (p.pipeline !== 'Aplikasi IN') return false;
        const dateToCheck = p.date_in || p.created_at;
        return dateToCheck && dateToCheck.startsWith(currentMonthStr);
      }).length;
      
      const aplikasiValid = oProspects.filter((p) => {
        if (p.pipeline !== 'Aplikasi Valid') return false;
        const dateToCheck = p.date_valid || p.created_at;
        return dateToCheck && dateToCheck.startsWith(currentMonthStr);
      }).length;

      return {
        id: o.id,
        name: o.name,
        call,
        blasting,
        prospek,
        prospekMonth,
        aplikasiIn,
        aplikasiValid,
        total: oProspects.length,
      };
    });
  };

  const performance = getOfficerPerformance();

  // Filtered Prospects for Display
  const getFilteredProspects = () => {
    let list = prospects;

    // Filter by role: Officer only sees their own
    if (user?.role === 'officer') {
      list = list.filter((p) => p.officer_id === user.id);
    } else {
      // Coordinator filters
      if (filterOfficer) {
        list = list.filter((p) => p.officer_id === filterOfficer);
      }
    }

    // Filter by pipeline tab
    list = list.filter((p) => p.pipeline === activeTab);

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
    const reportText = `Nama : ${user.name}\nCall : ${stats.countCall}\nBlasting : ${stats.countBlasting}\nProspek : ${stats.countProspek}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportText)}`;
    window.open(waUrl, '_blank');
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
          <h1 className="text-gradient" style={{ fontSize: '1.75rem' }}>ACC Prospect Tracker</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
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
                backgroundColor: user.isMock ? '#3b82f6' : (dbStatus === 'CONNECTED' ? '#10b981' : dbStatus === 'DISCONNECTED' ? '#ef4444' : '#e2e8f0'),
                display: 'inline-block' 
              }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                {user.isMock ? 'Local Memory Connected' : (dbStatus === 'CONNECTED' ? 'Supabase Connected' : dbStatus === 'DISCONNECTED' ? 'Supabase Offline' : 'Mengecek...')}
              </span>
            </div>

            {/* Storage Info */}
            <span style={{ color: 'rgba(255, 255, 255, 0.15)' }} className="desktop-only">|</span>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Memori Sisa: {user.isMock ? '499.98 MB' : `${(500 - dbSize.size_mb).toFixed(2)} MB`} / 500 MB
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {user.role === 'officer' && (
            <button className="btn btn-primary" onClick={openAddProspek} style={{ width: 'auto' }}>
              + Input Data Baru
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleLogout} style={{ width: 'auto' }}>
            Keluar
          </button>
        </div>
      </header>

      {/* KPI Stats Grid - Divided into Daily vs Monthly Sections */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* Section 1: Harian (Call, Blasting, Prospek) */}
        <div>
          <div style={{ 
            fontSize: '0.8rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em', 
            color: 'var(--text-secondary)', 
            marginBottom: '0.75rem', 
            fontWeight: '700', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem' 
          }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>
            Hari Ini ({getTodayIndonesian()})
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
            fontSize: '0.8rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em', 
            color: 'var(--text-secondary)', 
            marginBottom: '0.75rem', 
            fontWeight: '700', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem' 
          }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
            Bulan Ini ({getCurrentMonthIndonesian()})
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
          {/* Officer Performance Table */}
          <section className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }} className="text-gradient">Performa Officer</h2>
            <div className="responsive-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '16%' }}>Nama Officer</th>
                    <th style={{ width: '10%' }}>Call <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Hari)</span></th>
                    <th style={{ width: '10%' }}>Blasting <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Hari)</span></th>
                    <th style={{ width: '10%' }}>Prospek <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Hari)</span></th>
                    <th style={{ width: '12%' }}>Prospek <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Bulan)</span></th>
                    <th style={{ width: '12%' }}>Aplikasi IN <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Bulan)</span></th>
                    <th style={{ width: '14%' }}>Aplikasi Valid <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Bulan)</span></th>
                    <th style={{ width: '10%' }}>Total Pipeline</th>
                    <th style={{ width: '6%', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((perf) => (
                    <tr key={perf.id}>
                      <td><strong>{perf.name}</strong></td>
                      <td><span className="badge badge-warning" style={{ minWidth: '24px', justifyContent: 'center' }}>{perf.call}</span></td>
                      <td><span className="badge badge-danger" style={{ minWidth: '24px', justifyContent: 'center' }}>{perf.blasting}</span></td>
                      <td><span className="badge badge-info" style={{ minWidth: '24px', justifyContent: 'center' }}>{perf.prospek}</span></td>
                      <td><span className="badge badge-info" style={{ minWidth: '24px', justifyContent: 'center' }}>{perf.prospekMonth}</span></td>
                      <td><span className="badge badge-warning" style={{ minWidth: '24px', justifyContent: 'center' }}>{perf.aplikasiIn}</span></td>
                      <td><span className="badge badge-success" style={{ minWidth: '24px', justifyContent: 'center' }}>{perf.aplikasiValid}</span></td>
                      <td><strong>{perf.total}</strong></td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 'auto', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
                          onClick={() => handleDeleteOfficer(perf.id, perf.name)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {performance.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        Belum ada Officer yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            {/* Add Officer Card */}
            <section className="glass-card">
              <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }} className="text-gradient">Tambah Officer Baru</h2>
              <form onSubmit={handleAddOfficer} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                  <label htmlFor="officer-name">Nama Officer</label>
                  <input
                    id="officer-name"
                    type="text"
                    className="input-control"
                    placeholder="Nama lengkap"
                    value={newOfficerName}
                    onChange={(e) => setNewOfficerName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ width: '120px', marginBottom: 0 }}>
                  <label htmlFor="officer-pin">4-Digit PIN</label>
                  <input
                    id="officer-pin"
                    type="password"
                    maxLength={4}
                    className="input-control"
                    placeholder="••••"
                    value={newOfficerPin}
                    onChange={(e) => setNewOfficerPin(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', height: '42px' }}>
                  Tambah
                </button>
              </form>
              {coordError && <div style={{ color: '#f87171', fontSize: '0.875rem', marginTop: '0.75rem' }}>{coordError}</div>}
              {coordSuccess && <div style={{ color: '#34d399', fontSize: '0.875rem', marginTop: '0.75rem' }}>{coordSuccess}</div>}
            </section>
          </div>

          {/* Pipeline Monitor for Coordinator */}
          <section className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem' }} className="text-gradient">Monitor Pipeline Global</h2>
              
              {/* Pipeline Tab Switcher (Only Prospek, Aplikasi IN, Aplikasi Valid) */}
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
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Cari nama customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ width: '180px' }}>
                <select
                  className="input-control"
                  value={filterOfficer}
                  onChange={(e) => setFilterOfficer(e.target.value)}
                >
                  <option value="">Semua Officer</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: '150px' }}>
                <select
                  className="input-control"
                  value={filterSegment}
                  onChange={(e) => setFilterSegment(e.target.value)}
                >
                  <option value="">Semua Segmen</option>
                  <option value="Bronze">Bronze</option>
                  <option value="Flexi">Flexi</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                  <option value="Solitaire">Solitaire</option>
                </select>
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
        </div>
      ) : (
        /* ========================================================================= */
        /*                            OFFICER DASHBOARD                              */
        /* ========================================================================= */
        <>
          {/* WhatsApp Report Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={handleSendWA} className="btn-wa">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Kirim Laporan WA
            </button>
          </div>

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
              
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '520px', flexWrap: 'wrap' }}>
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
                      const hasCompletedData = p.no_reg && p.segment;
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
            <h2 style={{ marginBottom: '1.5rem' }} className="text-gradient">
              {isEditMode ? 'Edit Data Prospek' : 'Input Data Baru (Tahap Prospek)'}
            </h2>
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
          </div>
        </div>
      )}

      {/* 3. Modal Lengkapi/Edit Data (Aplikasi IN) */}
      {isLengkapiModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2 style={{ marginBottom: '1.5rem' }} className="text-gradient">Lengkapi Data Aplikasi</h2>
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
                  required
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
                  onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
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
                  onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
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
