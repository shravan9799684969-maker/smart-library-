# JECRC UNIVERSITY – SMART LIBRARY: DIGITAL ENTRY & EXIT MANAGEMENT SYSTEM

> **Tagline:** *"Scan. Enter. Study."*  
> **Deployment Site:** Central Library, JECRC University, Jaipur, Rajasthan, India

---

## 1. System Overview

Manual library registers cause long queues, wasted student study time, handwritten illegibility, and inaccurate occupancy tracking. 

The **JECRC Smart Library System** completely digitizes library entry and checkout using the existing barcode printed on student university ID cards (Code 128 / EAN standard). It provides:
- **Instant 1-Second Check-In/Check-Out** with audio-visual chimes.
- **Strict Station Mode Enforcement** (Entry Station, Exit Station, or Smart Dual Gate).
- **Live Occupancy Monitoring & Capacity Alerts** (default 200 seats, configurable).
- **Emergency Digital QR Pass Backup System** for students who forget physical cards (5-minute single-use secure tokens).
- **Executive Librarian Dashboard** with interactive Chart.js analytics (7-day trends, hourly peaks, department breakdowns, average durations).
- **Student Registry & Attendance History** with search, filters, pagination, CSV/Excel export, and print formatting.
- **Audit Logging** for every administrative action, capacity change, and manual record correction.

---

## 2. Technology Stack & Architecture

- **Backend:** 
  - `server.rb`: Native Ruby REST API using WEBrick and SQLite3 (built-in on macOS/Linux, **zero external gem dependencies**).
  - `server.py`: Python 3 standard library equivalent (zero pip dependencies required).
- **Database:** SQLite3 (`library.db`) with indexes, foreign keys, and Indian Standard Time (IST, UTC+5:30) timestamps. Ready for zero-hassle migration to PostgreSQL.
- **Frontend:** Responsive Single Page Application (SPA) built with clean CSS, Inter & JetBrains Mono typography, Lucide Icons, Chart.js, HTML5-QRCode, and Web Audio API synthesized chimes.
- **Dual-Mode Client:** Automatic fallback to an in-browser local storage engine if accessed offline or directly via `file://`.

---

## 3. Quick Start & Installation

### Option A: Running with Ruby (Recommended on macOS)
Ruby 2.6+ with SQLite3 is pre-installed on macOS.

1. Open your Terminal:
   ```bash
   cd "/Users/shravankumar/Desktop/library project"
   ```
2. Initialize database with seed data:
   ```bash
   ruby database.rb
   ```
3. Start the server:
   ```bash
   ruby server.rb
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

---

### Option B: Running with Python
If you prefer running via Python 3:

1. Initialize database:
   ```bash
   python3 database.py
   ```
2. Start Python server:
   ```bash
   python3 server.py
   ```
3. Open `http://localhost:5000` in your web browser.

---

### Option C: Direct Browser Opening (No Server Required)
Simply double-click `public/index.html` in Finder or run:
```bash
open public/index.html
```
The application will automatically use its built-in client-side storage engine with all 35 students, historical analytics, and demo tools!

---

## 4. Connecting a Physical USB Barcode Scanner

Most commercial USB or 2.4GHz wireless barcode scanners (e.g., Honeywell, Zebra, TVS, Datalogic) operate in **USB HID Keyboard Wedge Mode**:
1. Plug the USB scanner cable into the computer or scanning station terminal.
2. The scanner is recognized as a standard USB keyboard without installing drivers.
3. In the scanner's user manual, ensure **"Add Enter / Carriage Return (CR) Suffix"** is enabled (this is usually enabled by default on most scanners).
4. Open the **Access Scanner** screen (`http://localhost:5000`).
5. Scan any student ID card barcode:
   - The scanner inputs the barcode string and sends the `Enter` key.
   - The application automatically captures the scan, verifies the student in the database, records entry/exit, calculates duration, plays the audio chime, and displays the confirmation card.
   - The input field automatically clears and re-focuses, ready for the next student in under 2 seconds.

---

## 5. User Roles & Credentials

### A. Student Role
- **Hardware ID Scan:** Point student ID card at the barcode scanner to enter or exit.
- **Verification Screen:** View student photograph initials, name, roll number, department, check-in time, and remaining seats.
- **Exit Summary:** View entry time, exit time, and total study duration (e.g. `1 hr 45 mins`).
- **QR Emergency Pass:** Open the "QR Emergency Pass" tab, enter roll number (e.g. `21BCON101`), and generate a 5-minute single-use pass that can be scanned at the turnstile camera or barcode scanner.

### B. Librarian / Administrator Role
Click **"Admin Login"** in the top-right header:

| Role | Username | Password | Full Name |
| :--- | :--- | :--- | :--- |
| **Chief Librarian** | `admin` | `admin123` | Dr. Rajesh Sharma |
| **Assistant Librarian** | `librarian` | `jecrc2026` | Sunita Meena |

**Administrator Capabilities:**
- Real-time seat occupancy gauge & live capacity editor.
- Complete Student Registry: Add new students, view historical visits, edit profiles, or delete with confirmation.
- Attendance History: Search by name/roll, filter by branch/status, download CSV, and print letterhead reports.
- Manual Attendance Correction: Adjust missing exit times or correct scanner errors with mandatory audit trail explanation.
- View Audit Logs: Comprehensive audit log tracking every login, edit, correction, and demo reset.
- "Load Demo Data" button to reset the prototype dataset at any time.

---

## 6. Testing Scenarios & Demo Data

The prototype comes seeded with **35 realistic fictional JECRC University students** across 9 departments (CSE, AI&DS, ECE, Mechanical, Civil, BBA, BCA, Law, Biotechnology).

### Convenient 1-Click Testing (Quick Test Simulator)
On the **Access Scanner** screen, click any of the quick-test buttons:
1. **Entry Test:** Click `🟢 Test Entry: Aditya Singhal (BBA • Outside)`
   - Green confirmation banner: *"ENTRY SUCCESSFUL"*
   - Live students inside increases from 12 to 13.
   - Available seats decreases from 188 to 187.
2. **Duplicate Entry Test:** Click the same button again
   - Rejection alert: *"Aditya Singhal is ALREADY marked INSIDE the library. Exit must be recorded before entering again."*
3. **Exit Test:** Click `🔵 Test Exit: Aarav Sharma (CSE • Inside)`
   - Blue confirmation banner: *"EXIT SUCCESSFUL"*
   - Total duration spent calculated (e.g. `46 mins`).
   - Status updated to `OUTSIDE`.
4. **Unregistered Barcode Test:** Click `⚠️ Test Error: Unregistered Barcode`
   - Red rejection banner: *"ID Card is not registered in JECRC Library records."*
5. **Digital QR Backup Pass Test:**
   - Go to **QR Emergency Pass** tab.
   - Enter `21BCON102` (Ananya Gupta) and click **"Generate Pass"**.
   - Notice the 5-minute countdown clock and QR token string.
   - Click **"⚡ Test Scan This QR Token at Station"**.
   - Watch the pass redeem and complete checkout.
   - Try scanning it again: the system rejects it as *"already redeemed"*.

---

## 7. Station Modes & Gates

In the top section of the Access Scanner screen, select the physical gate operating mode:

1. **Entry Station (Gate A):**
   - Strictly records entry transactions.
   - Rejects any student who is already inside.
2. **Exit Station (Gate B):**
   - Strictly records exit transactions and calculates session duration.
   - Rejects any student who does not have an active entry record.
3. **Demo Smart Dual-Gate:**
   - Auto-detects student status: if outside &rarr; checks them in; if inside &rarr; checks them out. Ideal for single-scanner demonstration.

---

## 8. Migration to University Production Deployment

To transition this prototype into a full enterprise deployment at JECRC University:

1. **Database Migration to PostgreSQL:**
   The SQLite schema uses ANSI SQL compatible tables (`students`, `library_visits`, `admin_users`, `audit_logs`, `system_settings`, `qr_tokens`).
   - Run: `pg_dump` or migrate tables using standard SQLAlchemy / ActiveRecord migrations.
   - Replace SQLite connection string with `postgres://user:password@jecrc-db:5432/library_db`.
2. **Turnstile Flap Barrier / Tripod Gate Integration:**
   - Relay signal trigger: When `perform_entry()` or `perform_exit()` returns `success: true`, send a 12V pulse via GPIO / USB relay controller (e.g., Numato USB Relay) to unlock the turnstile barrier for 4 seconds.
3. **Student ERP Synchronization:**
   - Connect the `students` table to JECRC University's central ERP (e.g., CollPoll, TCS iON, or SAP Student Lifecycle Management) using scheduled REST API synchronization or Webhooks to auto-import newly admitted students.
4. **High Availability Deployment:**
   - Run two low-cost Raspberry Pi or mini-PC touchscreen kiosks at the Central Library gates (one dedicated to Entry Gate A, one to Exit Gate B) running Chromium in Kiosk Mode (`chromium-browser --kiosk http://library-server:5000`).

---

## 9. Contact & Support

- **Institution:** JECRC University, Ramchandrapura, Sitapura Industrial Area Extension, Jaipur, Rajasthan 303905, India.
- **System Version:** 2.0.4-PROD
- **Prototype Status:** Fully Functional Prototype with Live SQLite Database & Interactive Dashboard.
