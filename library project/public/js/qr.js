/**
 * SMART LIBRARY - JECRC UNIVERSITY
 * QR Code Emergency Backup Pass Module
 */

(function(window) {
  'use strict';

  class QrBackupModule {
    constructor(store, scanner) {
      this.store = store;
      this.scanner = scanner;
      this.timerInterval = null;
      this.currentToken = null;
      this.initEvents();
    }

    initEvents() {
      const btnGen = document.getElementById('btn-generate-qr');
      const inputRoll = document.getElementById('qr-student-identifier');

      if (btnGen && inputRoll) {
        btnGen.addEventListener('click', () => {
          const val = inputRoll.value.trim();
          if (val) this.generatePass(val);
        });

        inputRoll.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const val = inputRoll.value.trim();
            if (val) this.generatePass(val);
          }
        });
      }

      const btnTestQr = document.getElementById('btn-test-scan-qr');
      if (btnTestQr) {
        btnTestQr.addEventListener('click', () => {
          if (this.currentToken) {
            // Switch to scanner view and scan this QR token
            window.app.switchView('scanner');
            this.scanner.processScan(this.currentToken);
          }
        });
      }
    }

    async generatePass(identifier) {
      const displayContainer = document.getElementById('qr-result-display');
      const qrCodeBox = document.getElementById('qr-code-canvas');
      const tokenText = document.getElementById('qr-token-string');
      const timerText = document.getElementById('qr-timer-text');
      const studentBox = document.getElementById('qr-student-profile');

      clearInterval(this.timerInterval);

      const res = await this.store.generateQrToken(identifier);
      if (!res.success) {
        alert(res.error || 'Could not generate emergency QR pass. Check roll number.');
        return;
      }

      this.currentToken = res.token;
      displayContainer.style.display = 'block';

      // Render QR code
      qrCodeBox.innerHTML = '';
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrCodeBox, {
          text: res.token,
          width: 180,
          height: 180,
          colorDark: '#0f2a4a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      } else {
        // Fallback text display if CDN not loaded
        qrCodeBox.innerHTML = `
          <div style="padding: 1.5rem; background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 8px; font-family: monospace; font-size: 0.9rem; word-break: break-all;">
            <strong>${res.token}</strong>
          </div>
        `;
      }

      tokenText.textContent = res.token;
      studentBox.innerHTML = `
        <div style="font-weight: 700; font-size: 1.1rem; color: #0f2a4a;">${res.student.full_name}</div>
        <div style="font-size: 0.85rem; color: #475569;">${res.student.roll_number} • ${res.student.branch}</div>
        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem;">Current Status: <strong style="color: ${res.student.status === 'INSIDE' ? '#059669' : '#475569'}">${res.student.status}</strong></div>
      `;

      // Start 5-minute countdown (300 seconds)
      let secondsLeft = 300;
      this.updateTimerDisplay(secondsLeft, timerText);

      this.timerInterval = setInterval(() => {
        secondsLeft--;
        this.updateTimerDisplay(secondsLeft, timerText);
        if (secondsLeft <= 0) {
          clearInterval(this.timerInterval);
          timerText.textContent = 'EXPIRED';
          timerText.style.color = '#dc2626';
          alert('Your temporary QR emergency pass has expired. Please generate a new one.');
        }
      }, 1000);
    }

    updateTimerDisplay(seconds, elem) {
      if (!elem) return;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      elem.textContent = `Valid for: ${m}:${s < 10 ? '0' : ''}${s}`;
      if (seconds <= 60) {
        elem.style.color = '#dc2626';
      } else {
        elem.style.color = '#0f2a4a';
      }
    }
  }

  window.QrBackupModule = QrBackupModule;
})(window);
