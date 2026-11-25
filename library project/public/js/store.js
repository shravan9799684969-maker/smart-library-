/**
 * SMART LIBRARY - JECRC UNIVERSITY
 * Data Layer & API Client with Seamless Offline/Local Storage Fallback
 */

(function(window) {
  'use strict';

  // Seed Dataset for Local Fallback Mode (35 Students)
  const SEED_STUDENTS = [
    { id: 1, barcode_id: 'JU20240101', roll_number: '21BCON101', full_name: 'Aarav Sharma', branch: 'Computer Science & Engineering', semester: 6, email: 'aarav.sharma@jecrcu.edu.in', phone: '9829011221', avatar_color: '#1E3A8A', status: 'INSIDE' },
    { id: 2, barcode_id: 'JU20240102', roll_number: '21BCON102', full_name: 'Ananya Gupta', branch: 'Computer Science & Engineering', semester: 6, email: 'ananya.gupta@jecrcu.edu.in', phone: '9829011222', avatar_color: '#0D9488', status: 'INSIDE' },
    { id: 3, barcode_id: 'JU20240103', roll_number: '22BCON201', full_name: 'Rohan Mehta', branch: 'AI & Data Science', semester: 4, email: 'rohan.mehta@jecrcu.edu.in', phone: '9829011223', avatar_color: '#B45309', status: 'INSIDE' },
    { id: 4, barcode_id: 'JU20240104', roll_number: '22BCON202', full_name: 'Ishita Verma', branch: 'AI & Data Science', semester: 4, email: 'ishita.verma@jecrcu.edu.in', phone: '9829011224', avatar_color: '#4338CA', status: 'INSIDE' },
    { id: 5, barcode_id: 'JU20240105', roll_number: '21BTEC011', full_name: 'Vikramaditya Rathore', branch: 'Electronics & Comm. Engineering', semester: 6, email: 'vikram.rathore@jecrcu.edu.in', phone: '9829011225', avatar_color: '#047857', status: 'INSIDE' },
    { id: 6, barcode_id: 'JU20240106', roll_number: '21BTEC012', full_name: 'Pooja Choudhary', branch: 'Electronics & Comm. Engineering', semester: 6, email: 'pooja.choudhary@jecrcu.edu.in', phone: '9829011226', avatar_color: '#7C2D12', status: 'INSIDE' },
    { id: 7, barcode_id: 'JU20240107', roll_number: '23BCON301', full_name: 'Kabir Joshi', branch: 'Computer Science & Engineering', semester: 2, email: 'kabir.joshi@jecrcu.edu.in', phone: '9829011227', avatar_color: '#6D28D9', status: 'INSIDE' },
    { id: 8, barcode_id: 'JU20240108', roll_number: '23BCON302', full_name: 'Diya Agarwal', branch: 'Computer Science & Engineering', semester: 2, email: 'diya.agarwal@jecrcu.edu.in', phone: '9829011228', avatar_color: '#0369A1', status: 'INSIDE' },
    { id: 9, barcode_id: 'JU20240109', roll_number: '21BTME005', full_name: 'Siddharth Singh Shekhawat', branch: 'Mechanical Engineering', semester: 6, email: 'siddharth.singh@jecrcu.edu.in', phone: '9829011229', avatar_color: '#BE123C', status: 'INSIDE' },
    { id: 10, barcode_id: 'JU20240110', roll_number: '22BTME015', full_name: 'Tanvi Mathur', branch: 'Mechanical Engineering', semester: 4, email: 'tanvi.mathur@jecrcu.edu.in', phone: '9829011230', avatar_color: '#4D7C0F', status: 'INSIDE' },
    { id: 11, barcode_id: 'JU20240111', roll_number: '21BTCE008', full_name: 'Harshvardhan Jain', branch: 'Civil Engineering', semester: 6, email: 'harsh.jain@jecrcu.edu.in', phone: '9829011231', avatar_color: '#1E3A8A', status: 'INSIDE' },
    { id: 12, barcode_id: 'JU20240112', roll_number: '22BTCE012', full_name: 'Meera Khandelwal', branch: 'Civil Engineering', semester: 4, email: 'meera.k@jecrcu.edu.in', phone: '9829011232', avatar_color: '#0D9488', status: 'INSIDE' },
    { id: 13, barcode_id: 'JU20240113', roll_number: '22BBAN045', full_name: 'Aditya Singhal', branch: 'Business Administration (BBA)', semester: 4, email: 'aditya.singhal@jecrcu.edu.in', phone: '9829011233', avatar_color: '#B45309', status: 'OUTSIDE' },
    { id: 14, barcode_id: 'JU20240114', roll_number: '23BBAN012', full_name: 'Sneha Soni', branch: 'Business Administration (BBA)', semester: 2, email: 'sneha.soni@jecrcu.edu.in', phone: '9829011234', avatar_color: '#4338CA', status: 'OUTSIDE' },
    { id: 15, barcode_id: 'JU20240115', roll_number: '21BCAN033', full_name: 'Gaurav Pareek', branch: 'Computer Applications (BCA)', semester: 6, email: 'gaurav.pareek@jecrcu.edu.in', phone: '9829011235', avatar_color: '#047857', status: 'OUTSIDE' },
    { id: 16, barcode_id: 'JU20240116', roll_number: '22BCAN019', full_name: 'Rhea Saxena', branch: 'Computer Applications (BCA)', semester: 4, email: 'rhea.saxena@jecrcu.edu.in', phone: '9829011236', avatar_color: '#7C2D12', status: 'OUTSIDE' },
    { id: 17, barcode_id: 'JU20240117', roll_number: '20BLAW004', full_name: 'Manish Bhardwaj', branch: 'School of Law (B.A. LL.B)', semester: 8, email: 'manish.law@jecrcu.edu.in', phone: '9829011237', avatar_color: '#6D28D9', status: 'OUTSIDE' },
    { id: 18, barcode_id: 'JU20240118', roll_number: '21BLAW021', full_name: 'Kavya Trivedi', branch: 'School of Law (B.A. LL.B)', semester: 6, email: 'kavya.trivedi@jecrcu.edu.in', phone: '9829011238', avatar_color: '#0369A1', status: 'OUTSIDE' },
    { id: 19, barcode_id: 'JU20240119', roll_number: '22BSBT007', full_name: 'Yash Maheshwari', branch: 'Biotechnology (B.Sc)', semester: 4, email: 'yash.m@jecrcu.edu.in', phone: '9829011239', avatar_color: '#BE123C', status: 'OUTSIDE' },
    { id: 20, barcode_id: 'JU20240120', roll_number: '23BSBT014', full_name: 'Simran Kulshreshtha', branch: 'Biotechnology (B.Sc)', semester: 2, email: 'simran.k@jecrcu.edu.in', phone: '9829011240', avatar_color: '#4D7C0F', status: 'OUTSIDE' },
    { id: 21, barcode_id: 'JU20240121', roll_number: '21BCON140', full_name: 'Kartik Rawat', branch: 'Computer Science & Engineering', semester: 6, email: 'kartik.rawat@jecrcu.edu.in', phone: '9829011241', avatar_color: '#1E3A8A', status: 'OUTSIDE' },
    { id: 22, barcode_id: 'JU20240122', roll_number: '22BCON245', full_name: 'Bhavna Malani', branch: 'AI & Data Science', semester: 4, email: 'bhavna.m@jecrcu.edu.in', phone: '9829011242', avatar_color: '#0D9488', status: 'OUTSIDE' },
    { id: 23, barcode_id: 'JU20240123', roll_number: '23BCON380', full_name: 'Nikhil Kumawat', branch: 'Computer Science & Engineering', semester: 2, email: 'nikhil.k@jecrcu.edu.in', phone: '9829011243', avatar_color: '#B45309', status: 'OUTSIDE' },
    { id: 24, barcode_id: 'JU20240124', roll_number: '21BTEC045', full_name: 'Deepika Sharma', branch: 'Electronics & Comm. Engineering', semester: 6, email: 'deepika.s@jecrcu.edu.in', phone: '9829011244', avatar_color: '#4338CA', status: 'OUTSIDE' },
    { id: 25, barcode_id: 'JU20240125', roll_number: '22BTME032', full_name: 'Akash Badaya', branch: 'Mechanical Engineering', semester: 4, email: 'akash.b@jecrcu.edu.in', phone: '9829011245', avatar_color: '#047857', status: 'OUTSIDE' },
    { id: 26, barcode_id: 'JU20240126', roll_number: '23BBAN088', full_name: 'Priyanshu Tiwari', branch: 'Business Administration (BBA)', semester: 2, email: 'priyanshu.t@jecrcu.edu.in', phone: '9829011246', avatar_color: '#7C2D12', status: 'OUTSIDE' },
    { id: 27, barcode_id: 'JU20240127', roll_number: '21BCAN078', full_name: 'Muskan Jangid', branch: 'Computer Applications (BCA)', semester: 6, email: 'muskan.j@jecrcu.edu.in', phone: '9829011247', avatar_color: '#6D28D9', status: 'OUTSIDE' },
    { id: 28, barcode_id: 'JU20240128', roll_number: '22BLAW055', full_name: 'Lakshya Rajavat', branch: 'School of Law (B.A. LL.B)', semester: 4, email: 'lakshya.r@jecrcu.edu.in', phone: '9829011248', avatar_color: '#0369A1', status: 'OUTSIDE' },
    { id: 29, barcode_id: 'JU20240129', roll_number: '21BCON199', full_name: 'Avani Dadhich', branch: 'Computer Science & Engineering', semester: 6, email: 'avani.d@jecrcu.edu.in', phone: '9829011249', avatar_color: '#BE123C', status: 'OUTSIDE' },
    { id: 30, barcode_id: 'JU20240130', roll_number: '22BCON299', full_name: 'Pranav Solanki', branch: 'AI & Data Science', semester: 4, email: 'pranav.s@jecrcu.edu.in', phone: '9829011250', avatar_color: '#4D7C0F', status: 'OUTSIDE' },
    { id: 31, barcode_id: 'JU20240131', roll_number: '23BTEC019', full_name: 'Ritika Chouhan', branch: 'Electronics & Comm. Engineering', semester: 2, email: 'ritika.c@jecrcu.edu.in', phone: '9829011251', avatar_color: '#1E3A8A', status: 'OUTSIDE' },
    { id: 32, barcode_id: 'JU20240132', roll_number: '21BTCE044', full_name: 'Mohit Gehlot', branch: 'Civil Engineering', semester: 6, email: 'mohit.g@jecrcu.edu.in', phone: '9829011252', avatar_color: '#0D9488', status: 'OUTSIDE' },
    { id: 33, barcode_id: 'JU20240133', roll_number: '22BBAN105', full_name: 'Sonakshi Gaur', branch: 'Business Administration (BBA)', semester: 4, email: 'sonakshi.g@jecrcu.edu.in', phone: '9829011253', avatar_color: '#B45309', status: 'OUTSIDE' },
    { id: 34, barcode_id: 'JU20240134', roll_number: '23BCAN044', full_name: 'Devendra Poonia', branch: 'Computer Applications (BCA)', semester: 2, email: 'devendra.p@jecrcu.edu.in', phone: '9829011254', avatar_color: '#4338CA', status: 'OUTSIDE' },
    { id: 35, barcode_id: 'JU20240135', roll_number: '22BLAW089', full_name: 'Tanya Rajvanshi', branch: 'School of Law (B.A. LL.B)', semester: 4, email: 'tanya.r@jecrcu.edu.in', phone: '9829011255', avatar_color: '#047857', status: 'OUTSIDE' }
  ];

  class SmartLibraryStore {
    constructor() {
      this.apiBase = window.location.origin.includes('http') ? window.location.origin : 'http://localhost:5000';
      this.serverConnected = false;
      this.token = localStorage.getItem('jecrc_auth_token') || null;
      this.user = JSON.parse(localStorage.getItem('jecrc_auth_user') || 'null');
      this.listeners = [];
      this.initLocalFallback();
      this.testConnection();
    }

    onUpdate(fn) {
      this.listeners.push(fn);
    }

    notify() {
      this.listeners.forEach(fn => fn());
    }

    async testConnection() {
      try {
        const res = await fetch(`${this.apiBase}/api/stats`, { method: 'GET' });
        if (res.ok) {
          this.serverConnected = true;
          console.log('[Store] Live REST Backend connected.');
        } else {
          this.serverConnected = false;
        }
      } catch (e) {
        this.serverConnected = false;
        console.log('[Store] Using Local In-Browser Storage Engine.');
      }
      this.notify();
    }

    // Local in-browser SQLite simulation engine
    initLocalFallback() {
      if (!localStorage.getItem('jecrc_students')) {
        localStorage.setItem('jecrc_students', JSON.stringify(SEED_STUDENTS));
      }
      if (!localStorage.getItem('jecrc_capacity')) {
        localStorage.setItem('jecrc_capacity', '200');
      }
      if (!localStorage.getItem('jecrc_visits')) {
        // Generate baseline visits
        const visits = [];
        const now = new Date();
        // 12 active visits
        for (let i = 0; i < 12; i++) {
          const s = SEED_STUDENTS[i];
          const entryTime = new Date(now.getTime() - (i * 20 + 30) * 60000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          visits.push({
            id: i + 1,
            student_id: s.id,
            roll_number: s.roll_number,
            full_name: s.full_name,
            branch: s.branch,
            avatar_color: s.avatar_color,
            barcode_id: s.barcode_id,
            entry_time: entryTime,
            exit_time: null,
            duration_minutes: null,
            status: 'ACTIVE',
            entry_station: 'Central Gate - Station A',
            exit_station: null,
            notes: 'Current ongoing session'
          });
        }
        // Past visits
        for (let i = 12; i < 25; i++) {
          const s = SEED_STUDENTS[i];
          const dur = 45 + (i * 7);
          const entryTime = new Date(now.getTime() - (dur + 120) * 60000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          const exitTime = new Date(now.getTime() - 120 * 60000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          visits.push({
            id: i + 1,
            student_id: s.id,
            roll_number: s.roll_number,
            full_name: s.full_name,
            branch: s.branch,
            avatar_color: s.avatar_color,
            barcode_id: s.barcode_id,
            entry_time: entryTime,
            exit_time: exitTime,
            duration_minutes: dur,
            status: 'COMPLETED',
            entry_station: 'Central Gate - Station A',
            exit_station: 'Exit Turnstile B',
            notes: 'Historical study session'
          });
        }
        localStorage.setItem('jecrc_visits', JSON.stringify(visits));
      }
      if (!localStorage.getItem('jecrc_audit_logs')) {
        const audit = [{
          id: 1,
          admin_username: 'admin',
          action: 'SYSTEM_INIT',
          timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          description: 'Smart Library system initialized with 35 student records.'
        }];
        localStorage.setItem('jecrc_audit_logs', JSON.stringify(audit));
      }
      if (!localStorage.getItem('jecrc_qr_tokens')) {
        localStorage.setItem('jecrc_qr_tokens', JSON.stringify([]));
      }
    }

    getAuthHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      return headers;
    }

    // ----------------------------------------------------
    // SCAN OPERATION
    // ----------------------------------------------------
    async scan(barcode, station_mode = 'demo', station_name = 'Entry Gate A') {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/scan`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ barcode, station_mode, station_name })
          });
          const data = await res.json();
          this.notify();
          return data;
        } catch (e) {
          console.warn('Backend fetch failed, falling back to local store', e);
        }
      }

      // Local In-Browser Processing
      return this.localScan(barcode, station_mode, station_name);
    }

    localScan(barcode, station_mode, station_name) {
      const students = JSON.parse(localStorage.getItem('jecrc_students') || '[]');
      const visits = JSON.parse(localStorage.getItem('jecrc_visits') || '[]');
      const qrTokens = JSON.parse(localStorage.getItem('jecrc_qr_tokens') || '[]');
      const capacity = parseInt(localStorage.getItem('jecrc_capacity') || '200', 10);
      const cleanInput = (barcode || '').trim();

      if (!cleanInput) {
        return { success: false, message: 'No barcode detected' };
      }

      let student = null;
      let qrToken = null;

      // Check QR
      if (cleanInput.startsWith('JECRC-QR-') || cleanInput.startsWith('QR:')) {
        const tokenStr = cleanInput.replace(/^QR:/, '');
        qrToken = qrTokens.find(t => t.token === tokenStr);
        if (!qrToken) {
          return { success: false, error_code: 'INVALID_QR_TOKEN', message: 'Digital QR Pass not found in system.' };
        }
        if (qrToken.used_at) {
          return { success: false, error_code: 'QR_TOKEN_ALREADY_USED', message: 'This temporary QR pass was already redeemed.' };
        }
        if (new Date() > new Date(qrToken.expires_at)) {
          return { success: false, error_code: 'QR_TOKEN_EXPIRED', message: 'This temporary QR pass has expired.' };
        }
        student = students.find(s => s.id === qrToken.student_id);
      } else {
        student = students.find(s => s.barcode_id === cleanInput || s.roll_number === cleanInput);
      }

      if (!student) {
        return { success: false, error_code: 'UNREGISTERED_STUDENT', message: `Card [${cleanInput}] is not registered in JECRC library records.` };
      }

      const now = new Date();
      const timeStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      if (station_mode === 'entry' && student.status === 'INSIDE') {
        return { success: false, error_code: 'ALREADY_INSIDE', student, message: `${student.full_name} is ALREADY marked INSIDE. Exit must be recorded first.` };
      }
      if (station_mode === 'exit' && student.status === 'OUTSIDE') {
        return { success: false, error_code: 'NOT_INSIDE', student, message: `${student.full_name} is marked OUTSIDE. No active check-in found.` };
      }

      const action = (station_mode === 'entry' || (station_mode === 'demo' && student.status === 'OUTSIDE')) ? 'ENTRY' : 'EXIT';

      if (action === 'ENTRY') {
        student.status = 'INSIDE';
        localStorage.setItem('jecrc_students', JSON.stringify(students));

        const newVisit = {
          id: visits.length + 1,
          student_id: student.id,
          roll_number: student.roll_number,
          full_name: student.full_name,
          branch: student.branch,
          avatar_color: student.avatar_color,
          barcode_id: student.barcode_id,
          entry_time: timeStr,
          exit_time: null,
          duration_minutes: null,
          status: 'ACTIVE',
          entry_station: station_name,
          exit_station: null,
          notes: qrToken ? 'Entry via Digital QR Pass' : 'Standard Barcode Entry'
        };
        visits.unshift(newVisit);
        localStorage.setItem('jecrc_visits', JSON.stringify(visits));

        if (qrToken) {
          qrToken.used_at = timeStr;
          localStorage.setItem('jecrc_qr_tokens', JSON.stringify(qrTokens));
        }

        const insideCount = students.filter(s => s.status === 'INSIDE').length;
        this.notify();

        return {
          success: true,
          action: 'ENTRY',
          student,
          visit: newVisit,
          capacity_info: { total: capacity, occupied: insideCount, available: Math.max(capacity - insideCount, 0) },
          message: 'Welcome to JECRC University Library.'
        };
      } else {
        const activeVisit = visits.find(v => v.student_id === student.id && v.status === 'ACTIVE');
        let duration = 35;
        let entryTime = timeStr;

        if (activeVisit) {
          entryTime = activeVisit.entry_time;
          try {
            const dtEntry = new Date(entryTime);
            duration = Math.max(Math.round((now - dtEntry) / 60000), 1);
          } catch (e) {
            duration = 35;
          }
          activeVisit.exit_time = timeStr;
          activeVisit.duration_minutes = duration;
          activeVisit.status = 'COMPLETED';
          activeVisit.exit_station = station_name;
        } else {
          visits.unshift({
            id: visits.length + 1,
            student_id: student.id,
            roll_number: student.roll_number,
            full_name: student.full_name,
            branch: student.branch,
            avatar_color: student.avatar_color,
            barcode_id: student.barcode_id,
            entry_time: timeStr,
            exit_time: timeStr,
            duration_minutes: duration,
            status: 'COMPLETED',
            entry_station: 'Gate A',
            exit_station: station_name,
            notes: 'Auto-closed exit session'
          });
        }

        student.status = 'OUTSIDE';
        localStorage.setItem('jecrc_students', JSON.stringify(students));
        localStorage.setItem('jecrc_visits', JSON.stringify(visits));

        if (qrToken) {
          qrToken.used_at = timeStr;
          localStorage.setItem('jecrc_qr_tokens', JSON.stringify(qrTokens));
        }

        const formattedDuration = duration >= 60
          ? `${Math.floor(duration / 60)} hr ${duration % 60} mins`
          : `${duration} mins`;

        const insideCount = students.filter(s => s.status === 'INSIDE').length;
        this.notify();

        return {
          success: true,
          action: 'EXIT',
          student,
          visit: {
            entry_time: entryTime,
            exit_time: timeStr,
            duration_minutes: duration,
            formatted_duration: formattedDuration,
            status: 'COMPLETED',
            station: station_name
          },
          capacity_info: { total: capacity, occupied: insideCount, available: Math.max(capacity - insideCount, 0) },
          message: 'Thank you for visiting the library. Have a productive day!'
        };
      }
    }

    // ----------------------------------------------------
    // GET STATS & KPI
    // ----------------------------------------------------
    async getStats() {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/stats`);
          if (res.ok) return await res.json();
        } catch (e) {
          console.warn('API error, using local stats');
        }
      }

      const students = JSON.parse(localStorage.getItem('jecrc_students') || '[]');
      const visits = JSON.parse(localStorage.getItem('jecrc_visits') || '[]');
      const capacity = parseInt(localStorage.getItem('jecrc_capacity') || '200', 10);

      const inside = students.filter(s => s.status === 'INSIDE').length;
      const outside = students.length - inside;
      const todayVisits = visits.length;

      const completed = visits.filter(v => v.duration_minutes);
      const avgDur = completed.length
        ? Math.round(completed.reduce((a, b) => a + (b.duration_minutes || 0), 0) / completed.length)
        : 65;

      return {
        total_students: students.length,
        currently_inside: inside,
        currently_outside: outside,
        visits_today: todayVisits,
        avg_duration_minutes: avgDur,
        capacity: capacity,
        available_seats: Math.max(capacity - inside, 0),
        occupancy_pct: capacity > 0 ? Math.round((inside / capacity) * 1000) / 10 : 0,
        recent_activity: visits.slice(0, 8),
        server_time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      };
    }

    // ----------------------------------------------------
    // GET ANALYTICS DATA
    // ----------------------------------------------------
    async getAnalytics() {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/analytics`);
          if (res.ok) return await res.json();
        } catch (e) {}
      }

      return {
        daily: {
          labels: ['Nov 08', 'Nov 09', 'Nov 10', 'Nov 11', 'Nov 12', 'Nov 13', 'Nov 14'],
          data: [18, 22, 19, 25, 29, 24, 31]
        },
        hourly: {
          labels: ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'],
          data: [5, 14, 28, 35, 22, 18, 30, 38, 29, 19, 11, 4]
        },
        department: {
          labels: ['Computer Science', 'AI & Data Science', 'Electronics & Comm', 'Mechanical Eng', 'BBA', 'BCA', 'Law', 'Civil Eng'],
          data: [42, 28, 19, 15, 18, 16, 12, 10],
          avg_duration: [85, 75, 60, 50, 45, 65, 90, 55]
        }
      };
    }

    // ----------------------------------------------------
    // STUDENT DIRECTORY
    // ----------------------------------------------------
    async getStudents(q = '', dept = '', status = '') {
      if (this.serverConnected) {
        try {
          const params = new URLSearchParams({ q, dept, status });
          const res = await fetch(`${this.apiBase}/api/students?${params.toString()}`);
          if (res.ok) return await res.json();
        } catch (e) {}
      }

      let list = JSON.parse(localStorage.getItem('jecrc_students') || '[]');
      if (q) {
        const query = q.toLowerCase();
        list = list.filter(s => s.full_name.toLowerCase().includes(query) || s.roll_number.toLowerCase().includes(query) || s.barcode_id.toLowerCase().includes(query));
      }
      if (dept && dept !== 'ALL') {
        list = list.filter(s => s.branch === dept);
      }
      if (status && status !== 'ALL') {
        list = list.filter(s => s.status === status);
      }
      return { students: list, count: list.length };
    }

    async addStudent(data) {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/students`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
          });
          const json = await res.json();
          this.notify();
          return json;
        } catch (e) {}
      }

      const students = JSON.parse(localStorage.getItem('jecrc_students') || '[]');
      const newStudent = {
        id: students.length + 1,
        barcode_id: data.barcode_id.toUpperCase(),
        roll_number: data.roll_number.toUpperCase(),
        full_name: data.full_name,
        branch: data.branch,
        semester: parseInt(data.semester || 1, 10),
        email: data.email,
        phone: data.phone || '',
        avatar_color: '#1E3A8A',
        status: 'OUTSIDE'
      };
      students.push(newStudent);
      localStorage.setItem('jecrc_students', JSON.stringify(students));
      this.notify();
      return { success: true, student: newStudent };
    }

    async deleteStudent(id) {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/students/${id}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
          });
          const json = await res.json();
          this.notify();
          return json;
        } catch (e) {}
      }

      let students = JSON.parse(localStorage.getItem('jecrc_students') || '[]');
      students = students.filter(s => s.id !== id);
      localStorage.setItem('jecrc_students', JSON.stringify(students));
      this.notify();
      return { success: true };
    }

    // ----------------------------------------------------
    // ATTENDANCE & VISITS
    // ----------------------------------------------------
    async getVisits(filters = {}) {
      if (this.serverConnected) {
        try {
          const params = new URLSearchParams(filters);
          const res = await fetch(`${this.apiBase}/api/visits?${params.toString()}`);
          if (res.ok) return await res.json();
        } catch (e) {}
      }

      let visits = JSON.parse(localStorage.getItem('jecrc_visits') || '[]');
      if (filters.q) {
        const q = filters.q.toLowerCase();
        visits = visits.filter(v => v.full_name.toLowerCase().includes(q) || v.roll_number.toLowerCase().includes(q));
      }
      if (filters.status && filters.status !== 'ALL') {
        visits = visits.filter(v => v.status === filters.status);
      }
      if (filters.dept && filters.dept !== 'ALL') {
        visits = visits.filter(v => v.branch === filters.dept);
      }
      return { visits, total: visits.length, page: 1, total_pages: 1 };
    }

    async correctVisit(visitId, entryTime, exitTime, status, reason) {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/visits/correct`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ visit_id: visitId, entry_time: entryTime, exit_time: exitTime, status, reason })
          });
          const json = await res.json();
          this.notify();
          return json;
        } catch (e) {}
      }

      const visits = JSON.parse(localStorage.getItem('jecrc_visits') || '[]');
      const target = visits.find(v => v.id === parseInt(visitId, 10));
      if (target) {
        target.entry_time = entryTime;
        target.exit_time = exitTime;
        target.status = status || 'MANUAL_CORRECTED';
        target.notes = `Corrected by Admin: ${reason}`;
        localStorage.setItem('jecrc_visits', JSON.stringify(visits));
      }

      const logs = JSON.parse(localStorage.getItem('jecrc_audit_logs') || '[]');
      logs.unshift({
        id: logs.length + 1,
        admin_username: this.user ? this.user.username : 'admin',
        action: 'ATTENDANCE_CORRECTION',
        timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        description: `Manual correction on Record #${visitId}. Reason: ${reason}`
      });
      localStorage.setItem('jecrc_audit_logs', JSON.stringify(logs));
      this.notify();
      return { success: true };
    }

    // ----------------------------------------------------
    // QR TOKEN GENERATION
    // ----------------------------------------------------
    async generateQrToken(identifier) {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/qr/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier })
          });
          return await res.json();
        } catch (e) {}
      }

      const students = JSON.parse(localStorage.getItem('jecrc_students') || '[]');
      const clean = identifier.trim().toLowerCase();
      const student = students.find(s => s.roll_number.toLowerCase() === clean || s.email.toLowerCase() === clean);
      if (!student) {
        return { error: `No student record found matching '${identifier}'.` };
      }

      const token = `JECRC-QR-${student.id}-${Math.random().toString(16).substring(2, 8).toUpperCase()}`;
      const expires = new Date(Date.now() + 5 * 60000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      const qrTokens = JSON.parse(localStorage.getItem('jecrc_qr_tokens') || '[]');
      qrTokens.push({ token, student_id: student.id, expires_at: expires, used_at: null });
      localStorage.setItem('jecrc_qr_tokens', JSON.stringify(qrTokens));

      return {
        success: true,
        token,
        student,
        expires_at: expires,
        expires_in_seconds: 300
      };
    }

    // ----------------------------------------------------
    // AUTHENTICATION
    // ----------------------------------------------------
    async login(username, password) {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (data.success) {
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('jecrc_auth_token', data.token);
            localStorage.setItem('jecrc_auth_user', JSON.stringify(data.user));
          }
          return data;
        } catch (e) {}
      }

      // Local demo login check
      if ((username === 'admin' && password === 'admin123') || (username === 'librarian' && password === 'jecrc2026')) {
        const user = {
          id: 1,
          username: username,
          full_name: username === 'admin' ? 'Chief Librarian - Dr. Rajesh Sharma' : 'Assistant Librarian - Sunita Meena',
          role: username
        };
        this.token = 'demo_token_' + Date.now();
        this.user = user;
        localStorage.setItem('jecrc_auth_token', this.token);
        localStorage.setItem('jecrc_auth_user', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, message: 'Invalid credentials. For demo: admin / admin123' };
    }

    logout() {
      if (this.serverConnected && this.token) {
        fetch(`${this.apiBase}/api/auth/logout`, { method: 'POST', headers: this.getAuthHeaders() });
      }
      this.token = null;
      this.user = null;
      localStorage.removeItem('jecrc_auth_token');
      localStorage.removeItem('jecrc_auth_user');
      this.notify();
    }

    // ----------------------------------------------------
    // DEMO DATA RESET
    // ----------------------------------------------------
    async resetDemoData() {
      if (this.serverConnected) {
        try {
          const res = await fetch(`${this.apiBase}/api/demo/reset`, {
            method: 'POST',
            headers: this.getAuthHeaders()
          });
          const data = await res.json();
          this.notify();
          return data;
        } catch (e) {}
      }

      localStorage.removeItem('jecrc_students');
      localStorage.removeItem('jecrc_visits');
      localStorage.removeItem('jecrc_audit_logs');
      localStorage.removeItem('jecrc_qr_tokens');
      this.initLocalFallback();
      this.notify();
      return { success: true, message: 'Demo environment reset with 35 students and attendance history.' };
    }

    async updateCapacity(newCapacity) {
      if (this.serverConnected) {
        try {
          await fetch(`${this.apiBase}/api/settings`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ capacity: newCapacity })
          });
        } catch (e) {}
      }
      localStorage.setItem('jecrc_capacity', newCapacity.toString());
      this.notify();
    }
  }

  window.SmartLibraryStore = SmartLibraryStore;
})(window);
