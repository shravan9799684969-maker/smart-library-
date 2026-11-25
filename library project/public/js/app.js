/**
 * SMART LIBRARY - JECRC UNIVERSITY
 * Main Application Controller & View Orchestrator
 */

(function(window) {
  'use strict';

  class SmartLibraryApp {
    constructor() {
      this.currentView = 'scanner';
      this.store = new window.SmartLibraryStore();
      this.scanner = null;
      this.charts = null;
      this.qrModule = null;
      this.selectedStudentId = null;
      this.selectedVisitId = null;

      this.init();
    }

    async init() {
      this.initScanner();
      this.initCharts();
      this.initQrModule();
      this.initNavigation();
      this.initClock();
      this.initModals();
      this.initFilters();
      this.initDemoButtons();

      this.store.onUpdate(() => {
        this.refreshActiveView();
      });

      // Initial data load
      await this.refreshGlobalStats();
      this.switchView('scanner');

      // Check if lucide icons are available
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    initScanner() {
      this.scanner = new window.BarcodeScannerController(this.store, {
        onModeChange: (mode, name) => {
          const badge = document.getElementById('header-station-badge');
          if (badge) badge.textContent = name;
        }
      });
    }

    initCharts() {
      this.charts = new window.LibraryChartsManager(this.store);
    }

    initQrModule() {
      this.qrModule = new window.QrBackupModule(this.store, this.scanner);
    }

    // ----------------------------------------------------
    // LIVE CLOCK & IST DATE
    // ----------------------------------------------------
    initClock() {
      const clockElem = document.getElementById('header-live-clock');
      const update = () => {
        const now = new Date();
        const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
        const optionsDate = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' };

        const timeStr = now.toLocaleTimeString('en-IN', optionsTime);
        const dateStr = now.toLocaleDateString('en-IN', optionsDate);

        if (clockElem) {
          clockElem.textContent = `${timeStr} IST • ${dateStr}`;
        }
      };
      update();
      setInterval(update, 1000);
    }

    // ----------------------------------------------------
    // VIEW SWITCHER
    // ----------------------------------------------------
    initNavigation() {
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          const target = item.dataset.view;
          this.switchView(target);
        });
      });
    }

    switchView(viewName) {
      this.currentView = viewName;

      // Update Nav active tab
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
      });

      // Hide all view panels
      const views = ['scanner', 'dashboard', 'students', 'attendance', 'audit', 'qr'];
      views.forEach(v => {
        const elem = document.getElementById(`view-${v}`);
        if (elem) elem.style.display = (v === viewName) ? 'block' : 'none';
      });

      // Refresh view-specific content
      if (viewName === 'scanner') {
        if (this.scanner && this.scanner.inputElem) {
          setTimeout(() => this.scanner.inputElem.focus(), 150);
        }
      } else if (viewName === 'dashboard') {
        this.renderDashboard();
      } else if (viewName === 'students') {
        this.renderStudents();
      } else if (viewName === 'attendance') {
        this.renderAttendance();
      } else if (viewName === 'audit') {
        this.renderAuditLogs();
      }

      this.refreshGlobalStats();

      if (window.lucide) {
        setTimeout(() => window.lucide.createIcons(), 50);
      }
    }

    async refreshActiveView() {
      await this.refreshGlobalStats();
      if (this.currentView === 'dashboard') this.renderDashboard();
      if (this.currentView === 'students') this.renderStudents();
      if (this.currentView === 'attendance') this.renderAttendance();
      if (this.currentView === 'audit') this.renderAuditLogs();
    }

    // ----------------------------------------------------
    // GLOBAL HEADER STATS
    // ----------------------------------------------------
    async refreshGlobalStats() {
      const stats = await this.store.getStats();

      // Header pills
      const occBadge = document.getElementById('header-occupancy-pill');
      if (occBadge) {
        occBadge.innerHTML = `
          <div class="occupancy-dot"></div>
          Inside: <strong>${stats.currently_inside}</strong> / ${stats.capacity} (${stats.occupancy_pct}%)
        `;
      }

      // Scanner live counts
      const sInside = document.getElementById('scanner-count-inside');
      const sSeats = document.getElementById('scanner-count-seats');
      if (sInside) sInside.textContent = stats.currently_inside;
      if (sSeats) sSeats.textContent = stats.available_seats;
    }

    // ----------------------------------------------------
    // DASHBOARD RENDERING
    // ----------------------------------------------------
    async renderDashboard() {
      const stats = await this.store.getStats();

      // Fill KPI cards
      const elTotal = document.getElementById('kpi-total-students');
      const elInside = document.getElementById('kpi-inside');
      const elOutside = document.getElementById('kpi-outside');
      const elVisits = document.getElementById('kpi-visits-today');
      const elAvg = document.getElementById('kpi-avg-duration');

      if (elTotal) elTotal.textContent = stats.total_students;
      if (elInside) elInside.textContent = stats.currently_inside;
      if (elOutside) elOutside.textContent = stats.currently_outside;
      if (elVisits) elVisits.textContent = stats.visits_today;
      if (elAvg) elAvg.textContent = `${stats.avg_duration_minutes}m`;

      // Occupancy Gauge
      const pctText = document.getElementById('gauge-percent-text');
      const circleFill = document.getElementById('gauge-fill-path');
      const boxInside = document.getElementById('occ-box-inside');
      const boxAvail = document.getElementById('occ-box-avail');
      const boxCap = document.getElementById('occ-box-cap');

      if (pctText) pctText.textContent = `${stats.occupancy_pct}%`;
      if (boxInside) boxInside.textContent = stats.currently_inside;
      if (boxAvail) boxAvail.textContent = stats.available_seats;
      if (boxCap) boxCap.textContent = stats.capacity;

      if (circleFill) {
        // Circumference of r=54 circle is 2 * PI * 54 ≈ 339.29
        const circum = 339.29;
        const offset = circum - (stats.occupancy_pct / 100) * circum;
        circleFill.style.strokeDasharray = circum;
        circleFill.style.strokeDashoffset = Math.max(offset, 0);

        if (stats.occupancy_pct > 85) {
          circleFill.style.stroke = '#dc2626'; // red warning
        } else if (stats.occupancy_pct > 65) {
          circleFill.style.stroke = '#d97706'; // amber warning
        } else {
          circleFill.style.stroke = '#059669'; // green normal
        }
      }

      // Recent Activity Feed
      const feedTable = document.getElementById('dashboard-recent-activity-body');
      if (feedTable && stats.recent_activity) {
        feedTable.innerHTML = stats.recent_activity.map(v => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: ${v.avatar_color || '#1e3a8a'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700;">
                  ${this.getInitials(v.full_name)}
                </div>
                <div>
                  <div style="font-weight: 600;">${v.full_name}</div>
                  <div style="font-size: 0.72rem; color: #64748b;">${v.roll_number}</div>
                </div>
              </div>
            </td>
            <td><span style="font-size: 0.8rem; color: #475569;">${v.branch}</span></td>
            <td>
              <span class="status-pill ${v.status === 'ACTIVE' ? 'inside' : 'completed'}">
                ${v.status === 'ACTIVE' ? 'Checked In' : 'Completed'}
              </span>
            </td>
            <td style="font-family: var(--font-mono); font-size: 0.78rem;">${v.entry_time}</td>
            <td style="font-family: var(--font-mono); font-size: 0.78rem;">${v.exit_time || '<span style="color: #059669; font-weight: 600;">Currently Inside</span>'}</td>
          </tr>
        `).join('');
      }

      // Update charts
      if (this.charts) {
        await this.charts.initCharts();
      }
    }

    // ----------------------------------------------------
    // STUDENT REGISTRY RENDERING
    // ----------------------------------------------------
    async renderStudents() {
      const q = document.getElementById('search-student-input')?.value || '';
      const dept = document.getElementById('filter-student-dept')?.value || 'ALL';
      const status = document.getElementById('filter-student-status')?.value || 'ALL';

      const res = await this.store.getStudents(q, dept, status);
      const tbody = document.getElementById('students-table-body');
      const countLabel = document.getElementById('students-count-label');

      if (countLabel) countLabel.textContent = `Showing ${res.students.length} students`;

      if (!tbody) return;

      if (res.students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">No students found matching your filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.students.map(s => `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background-color: ${s.avatar_color || '#1e3a8a'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                ${this.getInitials(s.full_name)}
              </div>
              <div>
                <div style="font-weight: 700; color: #0f172a;">${s.full_name}</div>
                <div style="font-size: 0.75rem; color: #64748b;">${s.email}</div>
              </div>
            </div>
          </td>
          <td><span style="font-family: var(--font-mono); font-weight: 600; font-size: 0.82rem;">${s.roll_number}</span></td>
          <td>
            <span style="font-family: var(--font-mono); background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.78rem; border: 1px solid #cbd5e1;">
              ${s.barcode_id}
            </span>
          </td>
          <td>
            <div style="font-size: 0.82rem; font-weight: 500;">${s.branch}</div>
            <div style="font-size: 0.72rem; color: #94a3b8;">Semester ${s.semester}</div>
          </td>
          <td>
            <span class="status-pill ${s.status === 'INSIDE' ? 'inside' : 'outside'}">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: ${s.status === 'INSIDE' ? '#16a34a' : '#94a3b8'}"></span>
              ${s.status}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.app.testScanStudent('${s.barcode_id}')" title="Test Scan Barcode">
                ⚡ Scan
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.app.viewStudentDetails(${s.id})" title="View Visit History">
                👁️ View
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.app.confirmDeleteStudent(${s.id}, '${s.full_name.replace(/'/g, "\\'")}')" title="Delete Student" style="color: #dc2626;">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // ----------------------------------------------------
    // ATTENDANCE RECORDS RENDERING
    // ----------------------------------------------------
    async renderAttendance() {
      const q = document.getElementById('search-attendance-input')?.value || '';
      const status = document.getElementById('filter-attendance-status')?.value || 'ALL';
      const dept = document.getElementById('filter-attendance-dept')?.value || 'ALL';

      const res = await this.store.getVisits({ q, status, dept });
      const tbody = document.getElementById('attendance-table-body');
      const countLabel = document.getElementById('attendance-count-label');

      if (countLabel) countLabel.textContent = `Showing ${res.visits.length} records`;

      if (!tbody) return;

      if (res.visits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">No attendance records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.visits.map(v => `
        <tr>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${v.full_name}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-family: var(--font-mono);">${v.roll_number}</div>
          </td>
          <td><span style="font-size: 0.8rem; color: #475569;">${v.branch}</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.78rem;">${v.entry_time}</td>
          <td style="font-family: var(--font-mono); font-size: 0.78rem;">
            ${v.exit_time ? v.exit_time : '<span style="color: #059669; font-weight: 700;">Active in Library</span>'}
          </td>
          <td style="font-weight: 700; color: #0f2a4a; font-family: var(--font-mono); font-size: 0.82rem;">
            ${v.duration_minutes ? `${v.duration_minutes}m` : '-'}
          </td>
          <td>
            <span class="status-pill ${v.status === 'ACTIVE' ? 'active' : (v.status === 'MANUAL_CORRECTED' ? 'corrected' : 'completed')}">
              ${v.status}
            </span>
          </td>
          <td>
            <span style="font-size: 0.75rem; color: #64748b;">${v.entry_station || 'Main Gate'}</span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.app.openCorrectionModal(${v.id}, '${v.full_name.replace(/'/g, "\\'")}', '${v.entry_time}', '${v.exit_time || ''}', '${v.status}')" title="Manual Librarian Correction">
              ✏️ Correct
            </button>
          </td>
        </tr>
      `).join('');
    }

    // ----------------------------------------------------
    // AUDIT LOGS RENDERING
    // ----------------------------------------------------
    async renderAuditLogs() {
      let logs = [];
      if (this.store.serverConnected) {
        try {
          const res = await fetch(`${this.store.apiBase}/api/audit_logs`);
          const data = await res.json();
          logs = data.logs || [];
        } catch (e) {}
      } else {
        logs = JSON.parse(localStorage.getItem('jecrc_audit_logs') || '[]');
      }

      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">No audit logs recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 0.78rem;">#${l.id}</td>
          <td style="font-family: var(--font-mono); font-size: 0.78rem;">${l.timestamp}</td>
          <td><strong>${l.admin_username}</strong></td>
          <td><span class="status-pill completed">${l.action}</span></td>
          <td style="font-size: 0.85rem;">${l.description}</td>
        </tr>
      `).join('');
    }

    // ----------------------------------------------------
    // MODAL DIALOGS & ACTIONS
    // ----------------------------------------------------
    initModals() {
      // Add Student Modal
      const btnAddStudent = document.getElementById('btn-add-student-modal');
      const modalAddStudent = document.getElementById('modal-add-student');
      const formAddStudent = document.getElementById('form-add-student');

      if (btnAddStudent && modalAddStudent) {
        btnAddStudent.addEventListener('click', () => {
          modalAddStudent.classList.add('open');
        });
      }

      if (formAddStudent) {
        formAddStudent.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = {
            full_name: document.getElementById('student-input-name').value,
            roll_number: document.getElementById('student-input-roll').value,
            barcode_id: document.getElementById('student-input-barcode').value,
            branch: document.getElementById('student-input-dept').value,
            semester: document.getElementById('student-input-sem').value,
            email: document.getElementById('student-input-email').value,
            phone: document.getElementById('student-input-phone').value
          };

          const res = await this.store.addStudent(formData);
          if (res.success) {
            alert('Student registered successfully into JECRC Smart Library database!');
            modalAddStudent.classList.remove('open');
            formAddStudent.reset();
            this.renderStudents();
          } else {
            alert(res.error || 'Failed to add student. Check roll number/barcode uniqueness.');
          }
        });
      }

      // Edit Capacity Modal
      const btnEditCap = document.getElementById('btn-edit-capacity');
      const modalCap = document.getElementById('modal-edit-capacity');
      const formCap = document.getElementById('form-edit-capacity');

      if (btnEditCap && modalCap) {
        btnEditCap.addEventListener('click', async () => {
          const stats = await this.store.getStats();
          document.getElementById('input-capacity-value').value = stats.capacity;
          modalCap.classList.add('open');
        });
      }

      if (formCap) {
        formCap.addEventListener('submit', async (e) => {
          e.preventDefault();
          const newCap = parseInt(document.getElementById('input-capacity-value').value, 10);
          if (newCap > 0) {
            await this.store.updateCapacity(newCap);
            modalCap.classList.remove('open');
            this.refreshActiveView();
          }
        });
      }

      // Manual Attendance Correction Modal
      const formCorrection = document.getElementById('form-manual-correction');
      if (formCorrection) {
        formCorrection.addEventListener('submit', async (e) => {
          e.preventDefault();
          const visitId = document.getElementById('corr-visit-id').value;
          const entryTime = document.getElementById('corr-entry-time').value;
          const exitTime = document.getElementById('corr-exit-time').value;
          const status = document.getElementById('corr-status').value;
          const reason = document.getElementById('corr-reason').value;

          if (!reason.trim()) {
            alert('A justification reason is strictly required for library audit trail.');
            return;
          }

          const res = await this.store.correctVisit(visitId, entryTime, exitTime, status, reason);
          if (res.success) {
            alert(`Record #${visitId} updated with audit justification.`);
            document.getElementById('modal-manual-correction').classList.remove('open');
            this.renderAttendance();
          }
        });
      }

      // Admin Login Modal
      const btnOpenLogin = document.getElementById('btn-open-login');
      const modalLogin = document.getElementById('modal-admin-login');
      const formLogin = document.getElementById('form-admin-login');

      if (btnOpenLogin && modalLogin) {
        btnOpenLogin.addEventListener('click', () => {
          modalLogin.classList.add('open');
        });
      }

      if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
          e.preventDefault();
          const u = document.getElementById('login-username').value;
          const p = document.getElementById('login-password').value;

          const res = await this.store.login(u, p);
          if (res.success) {
            alert(`Logged in as ${res.user.full_name}`);
            modalLogin.classList.remove('open');
            formLogin.reset();
            this.updateAuthUI(res.user);
          } else {
            alert(res.message || 'Invalid credentials');
          }
        });
      }

      // Close modal buttons
      document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
        });
      });
    }

    updateAuthUI(user) {
      const authBox = document.getElementById('header-auth-box');
      if (!authBox) return;

      if (user) {
        authBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
            <span style="background: rgba(255,255,255,0.15); padding: 0.25rem 0.55rem; border-radius: 4px;">👤 ${user.username}</span>
            <button class="btn btn-secondary btn-sm" onclick="window.app.store.logout(); location.reload();">Logout</button>
          </div>
        `;
      } else {
        authBox.innerHTML = `
          <button class="btn btn-secondary btn-sm" id="btn-open-login" onclick="document.getElementById('modal-admin-login').classList.add('open')">
            Admin Login
          </button>
        `;
      }
    }

    openCorrectionModal(id, name, entryTime, exitTime, status) {
      const modal = document.getElementById('modal-manual-correction');
      if (!modal) return;

      document.getElementById('corr-visit-id').value = id;
      document.getElementById('corr-student-name').textContent = name;
      document.getElementById('corr-entry-time').value = entryTime;
      document.getElementById('corr-exit-time').value = exitTime || '';
      document.getElementById('corr-status').value = status;
      document.getElementById('corr-reason').value = '';

      modal.classList.add('open');
    }

    async viewStudentDetails(studentId) {
      let student = null;
      let visits = [];
      let totalMins = 0;

      if (this.store.serverConnected) {
        try {
          const res = await fetch(`${this.store.apiBase}/api/students/${studentId}`);
          const data = await res.json();
          student = data.student;
          visits = data.visits || [];
          totalMins = data.total_time_minutes || 0;
        } catch (e) {}
      } else {
        const students = JSON.parse(localStorage.getItem('jecrc_students') || '[]');
        student = students.find(s => s.id === studentId);
        const allVisits = JSON.parse(localStorage.getItem('jecrc_visits') || '[]');
        visits = allVisits.filter(v => v.student_id === studentId);
        totalMins = visits.reduce((acc, v) => acc + (v.duration_minutes || 0), 0);
      }

      if (!student) return;

      const modal = document.getElementById('modal-student-details');
      const content = document.getElementById('student-details-content');

      const formattedTotal = totalMins >= 60
        ? `${Math.floor(totalMins / 60)} hrs ${totalMins % 60} mins`
        : `${totalMins} mins`;

      content.innerHTML = `
        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.25rem;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: ${student.avatar_color || '#1e3a8a'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700;">
            ${this.getInitials(student.full_name)}
          </div>
          <div>
            <h3 style="font-size: 1.15rem; color: #0f2a4a; margin-bottom: 0.15rem;">${student.full_name}</h3>
            <div style="font-size: 0.85rem; color: #64748b;">${student.roll_number} • Barcode: <strong>${student.barcode_id}</strong></div>
            <div style="font-size: 0.78rem; color: #475569;">${student.branch} (Semester ${student.semester})</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; background: #f8fafc; padding: 0.85rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.8rem;">
          <div><div style="color: #94a3b8; font-size: 0.7rem; text-transform: uppercase;">Current State</div><strong style="color: ${student.status === 'INSIDE' ? '#059669' : '#64748b'}">${student.status}</strong></div>
          <div><div style="color: #94a3b8; font-size: 0.7rem; text-transform: uppercase;">Total Visits</div><strong>${visits.length}</strong></div>
          <div><div style="color: #94a3b8; font-size: 0.7rem; text-transform: uppercase;">Time Spent</div><strong>${formattedTotal}</strong></div>
        </div>

        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: #64748b; margin-bottom: 0.5rem;">Recent Visits</h4>
        <div style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
          <table class="primary-table" style="font-size: 0.75rem;">
            <thead>
              <tr><th>Entry</th><th>Exit</th><th>Duration</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${visits.length ? visits.map(v => `
                <tr>
                  <td>${v.entry_time}</td>
                  <td>${v.exit_time || '<span style="color: #059669;">Inside</span>'}</td>
                  <td>${v.duration_minutes ? `${v.duration_minutes}m` : '-'}</td>
                  <td><span class="status-pill ${v.status === 'ACTIVE' ? 'inside' : 'completed'}">${v.status}</span></td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 1rem;">No prior visits recorded.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;

      modal.classList.add('open');
    }

    async confirmDeleteStudent(id, name) {
      if (confirm(`Are you sure you want to delete student '${name}'? This action is audited.`)) {
        await this.store.deleteStudent(id);
        alert(`Student '${name}' deleted.`);
        this.renderStudents();
      }
    }

    testScanStudent(barcode) {
      this.switchView('scanner');
      this.scanner.processScan(barcode);
    }

    // ----------------------------------------------------
    // FILTERS & EXPORT HANDLERS
    // ----------------------------------------------------
    initFilters() {
      // Student search & filter debounces
      const searchStudent = document.getElementById('search-student-input');
      const deptStudent = document.getElementById('filter-student-dept');
      const statusStudent = document.getElementById('filter-student-status');

      if (searchStudent) searchStudent.addEventListener('input', () => this.renderStudents());
      if (deptStudent) deptStudent.addEventListener('change', () => this.renderStudents());
      if (statusStudent) statusStudent.addEventListener('change', () => this.renderStudents());

      // Attendance search & filter debounces
      const searchAtt = document.getElementById('search-attendance-input');
      const deptAtt = document.getElementById('filter-attendance-dept');
      const statusAtt = document.getElementById('filter-attendance-status');

      if (searchAtt) searchAtt.addEventListener('input', () => this.renderAttendance());
      if (deptAtt) deptAtt.addEventListener('change', () => this.renderAttendance());
      if (statusAtt) statusAtt.addEventListener('change', () => this.renderAttendance());

      // Export CSV
      const btnExport = document.getElementById('btn-export-csv');
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          if (this.store.serverConnected) {
            window.location.href = `${this.store.apiBase}/api/export/csv`;
          } else {
            this.exportLocalCsv();
          }
        });
      }

      // Print Report
      const btnPrint = document.getElementById('btn-print-report');
      if (btnPrint) {
        btnPrint.addEventListener('click', () => {
          window.print();
        });
      }
    }

    exportLocalCsv() {
      const visits = JSON.parse(localStorage.getItem('jecrc_visits') || '[]');
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'Record ID,Roll Number,Student Name,Department,Barcode ID,Entry Time,Exit Time,Duration (Mins),Status,Station\r\n';

      visits.forEach(v => {
        csvContent += `"${v.id}","${v.roll_number}","${v.full_name}","${v.branch}","${v.barcode_id}","${v.entry_time}","${v.exit_time || 'Active'}","${v.duration_minutes || 'N/A'}","${v.status}","${v.entry_station || 'Gate A'}"\r\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `jecrc_library_attendance_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // ----------------------------------------------------
    // QUICK DEMO TEST BAR
    // ----------------------------------------------------
    initDemoButtons() {
      const btnResetDemo = document.getElementById('btn-reset-demo-data');
      if (btnResetDemo) {
        btnResetDemo.addEventListener('click', async () => {
          if (confirm('Reset demo environment to the original 35 fictional students and realistic visits?')) {
            const res = await this.store.resetDemoData();
            alert(res.message);
            this.refreshActiveView();
          }
        });
      }

      // Camera scanner open button
      const btnCam = document.getElementById('btn-toggle-camera-scan');
      if (btnCam) {
        btnCam.addEventListener('click', () => {
          if (this.scanner) this.scanner.startCameraScanner();
        });
      }

      const btnCloseCam = document.getElementById('btn-close-camera');
      if (btnCloseCam) {
        btnCloseCam.addEventListener('click', () => {
          if (this.scanner) this.scanner.stopCameraScanner();
        });
      }
    }

    getInitials(name) {
      if (!name) return 'JU';
      const parts = name.split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.app = new SmartLibraryApp();
  });
})(window);
