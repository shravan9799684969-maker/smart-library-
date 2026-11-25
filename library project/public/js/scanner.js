/**
 * SMART LIBRARY - JECRC UNIVERSITY
 * Hardware Barcode Scanner & Web Audio Engine
 */

(function(window) {
  'use strict';

  class BarcodeScannerController {
    constructor(store, uiCallbacks) {
      this.store = store;
      this.ui = uiCallbacks;
      this.stationMode = 'demo'; // 'entry', 'exit', 'demo'
      this.stationName = 'Gate A - Central Library';
      this.isProcessing = false;
      this.soundEnabled = true;
      this.audioCtx = null;
      this.lastScannedCode = '';
      this.lastScanTime = 0;
      this.html5QrCode = null;
      this.isCameraScanning = false;
      this.resetTimer = null;

      this.initElements();
      this.initEvents();
    }

    initElements() {
      this.inputElem = document.getElementById('barcode-scanner-input');
      this.statusBeacon = document.getElementById('scanner-beacon');
      this.statusText = document.getElementById('scanner-status-text');
      this.resultCard = document.getElementById('scan-result-card');
      this.cameraModal = document.getElementById('camera-scanner-modal');
    }

    initEvents() {
      if (!this.inputElem) return;

      // Ensure scanner input maintains focus for hardware barcode reader
      this.inputElem.focus();
      document.addEventListener('click', (e) => {
        // Don't steal focus if clicking inside forms, inputs, modals or buttons
        const isInteractive = e.target.closest('input, textarea, select, button, .modal-window, .nav-item, .test-pill-btn');
        if (!isInteractive && this.inputElem) {
          setTimeout(() => this.inputElem.focus(), 150);
        }
      });

      // Keyboard wedge detection (Enter key submits barcode)
      this.inputElem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = this.inputElem.value.trim();
          if (code) {
            this.processScan(code);
            this.inputElem.value = '';
          }
        }
      });

      // Station mode buttons
      const modeButtons = document.querySelectorAll('.station-mode-btn');
      modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          modeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.stationMode = btn.dataset.mode;
          this.stationName = btn.dataset.stationName || (this.stationMode === 'exit' ? 'Exit Gate B' : 'Entry Gate A');
          if (this.ui.onModeChange) this.ui.onModeChange(this.stationMode, this.stationName);
          this.inputElem.focus();
        });
      });
    }

    // ----------------------------------------------------
    // WEB AUDIO API SOUND CHIMES
    // ----------------------------------------------------
    getAudioContext() {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    }

    playSuccessChime(isEntry = true) {
      if (!this.soundEnabled) return;
      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        if (isEntry) {
          // Bright, uplifting major arpeggio (C5 -> E5 -> G5)
          const notes = [523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0.18, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.35);
          });
        } else {
          // Smooth two-tone departure chime (A4 -> E5)
          const notes = [440.0, 659.25];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);

            gain.gain.setValueAtTime(0.15, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.4);
          });
        }
      } catch (err) {
        console.warn('Audio feedback error:', err);
      }
    }

    playErrorBuzz() {
      if (!this.soundEnabled) return;
      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.setValueAtTime(110, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } catch (err) {
        console.warn('Audio feedback error:', err);
      }
    }

    // ----------------------------------------------------
    // SCAN PROCESSING
    // ----------------------------------------------------
    async processScan(barcode) {
      if (this.isProcessing) return;

      const cleanCode = barcode.trim();
      const now = Date.now();

      // Debounce duplicate scans within 2.5s
      if (cleanCode === this.lastScannedCode && (now - this.lastScanTime < 2500)) {
        this.showToast('Please wait 3 seconds before re-scanning the same card.', 'warning');
        return;
      }

      this.isProcessing = true;
      this.lastScannedCode = cleanCode;
      this.lastScanTime = now;

      // Update beacon status
      this.setStatus('busy', 'Verifying student card in JECRC database...');

      try {
        const result = await this.store.scan(cleanCode, this.stationMode, this.stationName);

        if (result.success) {
          if (result.action === 'ENTRY') {
            this.playSuccessChime(true);
            this.renderEntrySuccess(result);
            this.setStatus('ready', 'Scanner Ready • Green Light');
          } else {
            this.playSuccessChime(false);
            this.renderExitSuccess(result);
            this.setStatus('ready', 'Scanner Ready • Blue Light');
          }
        } else {
          this.playErrorBuzz();
          this.renderScanError(result);
          this.setStatus('error', result.message || 'Verification Error');
        }
      } catch (error) {
        console.error('Scan error:', error);
        this.playErrorBuzz();
        this.renderScanError({ message: 'Internal system error. Please contact library administrator.' });
        this.setStatus('error', 'System Connection Error');
      } finally {
        this.isProcessing = false;
        if (this.inputElem) {
          this.inputElem.value = '';
          this.inputElem.focus();
        }
      }
    }

    setStatus(state, text) {
      if (!this.statusBeacon || !this.statusText) return;
      this.statusBeacon.className = 'status-beacon';
      if (state === 'busy') this.statusBeacon.classList.add('busy');
      if (state === 'error') this.statusBeacon.classList.add('error');
      this.statusText.textContent = text;
    }

    // ----------------------------------------------------
    // RENDER SCAN CONFIRMATION CARDS
    // ----------------------------------------------------
    renderEntrySuccess(data) {
      if (!this.resultCard) return;
      clearTimeout(this.resetTimer);

      const s = data.student;
      const v = data.visit;
      const cap = data.capacity_info || {};

      this.resultCard.className = 'scan-result-card entry-success';
      this.resultCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span class="result-badge entry">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ENTRY SUCCESSFUL
          </span>
          <span style="font-size: 0.78rem; font-weight: 600; color: #059669; font-family: var(--font-mono);">${v.station || 'Main Entry Gate'}</span>
        </div>

        <div class="student-result-profile">
          <div class="student-result-avatar" style="background-color: ${s.avatar_color || '#1E3A8A'}">
            ${this.getInitials(s.full_name)}
          </div>
          <div class="student-result-info">
            <h3>${s.full_name}</h3>
            <div class="roll">${s.roll_number} • Barcode: ${s.barcode_id}</div>
            <div class="branch">${s.branch} (Sem ${s.semester})</div>
          </div>
        </div>

        <div class="result-metrics-grid">
          <div class="result-metric-item">
            <div class="label">Entry Time</div>
            <div class="value">${v.entry_time}</div>
          </div>
          <div class="result-metric-item">
            <div class="label">Status</div>
            <div class="value" style="color: #059669;">CHECKED IN</div>
          </div>
          <div class="result-metric-item">
            <div class="label">Library Seats</div>
            <div class="value">${cap.available !== undefined ? `${cap.available} Avail` : 'Available'}</div>
          </div>
        </div>

        ${data.warning ? `<div style="background: #fef3c7; color: #92400e; padding: 0.6rem; border-radius: var(--radius-sm); font-size: 0.8rem; margin-bottom: 0.85rem;">⚠️ ${data.warning}</div>` : ''}

        <div class="result-farewell-message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
          <strong>Welcome to JECRC University Central Library.</strong> Please maintain silence.
        </div>
      `;

      this.scheduleCardReset(5000);
    }

    renderExitSuccess(data) {
      if (!this.resultCard) return;
      clearTimeout(this.resetTimer);

      const s = data.student;
      const v = data.visit;
      const cap = data.capacity_info || {};

      this.resultCard.className = 'scan-result-card exit-success';
      this.resultCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span class="result-badge exit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
            EXIT SUCCESSFUL
          </span>
          <span style="font-size: 0.78rem; font-weight: 600; color: #1e40af; font-family: var(--font-mono);">${v.station || 'Exit Gate B'}</span>
        </div>

        <div class="student-result-profile">
          <div class="student-result-avatar" style="background-color: ${s.avatar_color || '#1E3A8A'}">
            ${this.getInitials(s.full_name)}
          </div>
          <div class="student-result-info">
            <h3>${s.full_name}</h3>
            <div class="roll">${s.roll_number}</div>
            <div class="branch">${s.branch}</div>
          </div>
        </div>

        <div class="result-metrics-grid">
          <div class="result-metric-item">
            <div class="label">Entry Time</div>
            <div class="value">${v.entry_time}</div>
          </div>
          <div class="result-metric-item">
            <div class="label">Exit Time</div>
            <div class="value">${v.exit_time}</div>
          </div>
          <div class="result-metric-item">
            <div class="label">Time Spent</div>
            <div class="value" style="color: #2563eb;">${v.formatted_duration || `${v.duration_minutes || 0} mins`}</div>
          </div>
        </div>

        <div class="result-farewell-message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <strong>Thank you for visiting JECRC Library.</strong> Have a great day ahead!
        </div>
      `;

      this.scheduleCardReset(5000);
    }

    renderScanError(data) {
      if (!this.resultCard) return;
      clearTimeout(this.resetTimer);

      this.resultCard.className = 'scan-result-card scan-error';
      this.resultCard.innerHTML = `
        <div class="result-badge error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          ACCESS REJECTED
        </div>
        <div style="margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.2rem; color: #dc2626; margin-bottom: 0.4rem;">${data.error_code || 'Verification Denied'}</h3>
          <p style="color: #475569; font-size: 0.95rem; line-height: 1.4;">${data.message || 'Unknown barcode card detected.'}</p>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.8rem; color: #991b1b;">
          <strong>Resolution:</strong> If this is your college ID card, visit the Chief Librarian desk or generate an emergency temporary pass via <strong>QR Emergency Pass</strong>.
        </div>
      `;

      this.scheduleCardReset(6000);
    }

    scheduleCardReset(delayMs = 4500) {
      this.resetTimer = setTimeout(() => {
        if (this.resultCard) {
          this.resultCard.style.display = 'none';
          this.resultCard.className = 'scan-result-card';
        }
      }, delayMs);
    }

    getInitials(name) {
      if (!name) return 'JU';
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }

    showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }

    // ----------------------------------------------------
    // WEBCAM CAMERA SCANNER
    // ----------------------------------------------------
    startCameraScanner() {
      if (typeof Html5Qrcode === 'undefined') {
        alert('Webcam scanner library is loading. Please try again in a moment or test via barcode input.');
        return;
      }

      const readerElem = document.getElementById('camera-reader-box');
      if (!readerElem) return;

      this.cameraModal.classList.add('open');
      this.html5QrCode = new Html5Qrcode('camera-reader-box');

      this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          this.stopCameraScanner();
          this.processScan(decodedText);
        },
        (errorMessage) => {
          // scanning frame (ignore frame parse errors)
        }
      ).catch(err => {
        console.warn('Unable to start camera scanner:', err);
        alert('Could not access device camera. Please make sure camera permissions are allowed, or use manual barcode input.');
        this.stopCameraScanner();
      });
    }

    stopCameraScanner() {
      if (this.html5QrCode) {
        this.html5QrCode.stop().then(() => {
          this.html5QrCode.clear();
          this.html5QrCode = null;
        }).catch(err => console.warn(err));
      }
      if (this.cameraModal) {
        this.cameraModal.classList.remove('open');
      }
      if (this.inputElem) {
        this.inputElem.focus();
      }
    }
  }

  window.BarcodeScannerController = BarcodeScannerController;
})(window);
