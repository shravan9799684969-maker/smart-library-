#!/usr/bin/env python3
"""
JECRC UNIVERSITY - SMART LIBRARY ENTRY & EXIT MANAGEMENT SYSTEM
Python 3 HTTP Server & REST API (Standard Library - zero pip dependencies required).
"""
import os
import sys
import json
import sqlite3
import hashlib
import secrets
import mimetypes
import time
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 5000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
DB_PATH = os.path.join(BASE_DIR, 'library.db')
IST = timezone(timedelta(hours=5, minutes=30))

sessions = {}
recent_scans = {}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def now_ist():
    return datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S')

class SmartLibraryHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def parse_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0:
            return {}
        try:
            raw = self.rfile.read(length).decode('utf-8')
            return json.loads(raw)
        except Exception:
            return {}

    def get_user(self):
        auth = self.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            token = auth[7:]
            return sessions.get(token)
        return None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path.startswith('/api/'):
            conn = get_db()
            try:
                if path == '/api/stats':
                    self.handle_stats(conn)
                elif path == '/api/analytics':
                    self.handle_analytics(conn)
                elif path == '/api/students':
                    self.handle_students(conn, query)
                elif path == '/api/visits':
                    self.handle_visits(conn, query)
                elif path == '/api/audit_logs':
                    self.handle_audit_logs(conn)
                elif path == '/api/export/csv':
                    self.handle_export_csv(conn, query)
                elif path == '/api/auth/me':
                    user = self.get_user()
                    if user:
                        self.send_json({'authenticated': True, 'user': user})
                    else:
                        self.send_json({'authenticated': False}, 401)
                else:
                    self.send_json({'error': 'Not found'}, 404)
            finally:
                conn.close()
            return

        # Serve static files from public/
        clean_path = path.lstrip('/')
        if not clean_path or clean_path == '/':
            clean_path = 'index.html'
        filepath = os.path.join(PUBLIC_DIR, clean_path)

        if os.path.isfile(filepath):
            ctype, _ = mimetypes.guess_type(filepath)
            ctype = ctype or 'application/octet-stream'
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            # Fallback to index.html for SPA
            index_path = os.path.join(PUBLIC_DIR, 'index.html')
            if os.path.isfile(index_path):
                with open(index_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'File Not Found')

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_body()
        conn = get_db()
        try:
            if path == '/api/scan':
                self.handle_scan(conn, body)
            elif path == '/api/auth/login':
                self.handle_login(conn, body)
            elif path == '/api/auth/logout':
                auth = self.headers.get('Authorization', '')
                if auth.startswith('Bearer '):
                    sessions.pop(auth[7:], None)
                self.send_json({'success': True, 'message': 'Logged out'})
            elif path == '/api/qr/generate':
                self.handle_qr_generate(conn, body)
            elif path == '/api/students':
                self.handle_create_student(conn, body)
            elif path == '/api/visits/correct':
                self.handle_correct_visit(conn, body)
            elif path == '/api/settings':
                self.handle_settings(conn, body)
            elif path == '/api/demo/reset':
                from database import seed_data, init_schema
                init_schema(conn)
                seed_data(conn)
                self.send_json({'success': True, 'message': 'Demo dataset reset.'})
            else:
                self.send_json({'error': 'Not found'}, 404)
        finally:
            conn.close()

    def handle_scan(self, conn, body):
        barcode = (body.get('barcode') or '').strip()
        station_mode = (body.get('station_mode') or 'demo').lower()
        station_name = body.get('station_name') or ('Exit Gate B' if station_mode == 'exit' else 'Entry Gate A')

        if not barcode:
            return self.send_json({'success': False, 'message': 'No barcode scanned'}, 400)

        # Rate-limiting / duplicate scan protection
        now_ts = time.time()
        if barcode in recent_scans and (now_ts - recent_scans[barcode] < 2.5):
            return self.send_json({'success': False, 'message': 'Duplicate scan detected. Please wait 3 seconds.'}, 429)
        recent_scans[barcode] = now_ts

        cursor = conn.cursor()
        student = None
        qr_token_record = None

        if barcode.startswith(('JECRC-QR-', 'QR:')):
            token_clean = barcode[3:] if barcode.startswith('QR:') else barcode
            cursor.execute("SELECT * FROM qr_tokens WHERE token = ?", (token_clean,))
            qr_token_record = cursor.fetchone()
            if not qr_token_record:
                return self.send_json({'success': False, 'message': 'Invalid Digital QR Pass'}, 404)
            if qr_token_record['used_at']:
                return self.send_json({'success': False, 'message': 'QR token already used'}, 400)
            if datetime.now(IST) > datetime.strptime(qr_token_record['expires_at'], '%Y-%m-%d %H:%M:%S').replace(tzinfo=IST):
                return self.send_json({'success': False, 'message': 'QR token expired'}, 400)
            cursor.execute("SELECT * FROM students WHERE id = ?", (qr_token_record['student_id'],))
            student = cursor.fetchone()
        else:
            cursor.execute("SELECT * FROM students WHERE barcode_id = ? OR roll_number = ?", (barcode, barcode))
            student = cursor.fetchone()

        if not student:
            return self.send_json({'success': False, 'message': f'Unregistered ID: {barcode}'}, 404)

        current_status = student['status']
        t_now = now_ist()

        if station_mode == 'entry' and current_status == 'INSIDE':
            return self.send_json({'success': False, 'message': f'{student["full_name"]} is already INSIDE.'}, 400)
        if station_mode == 'exit' and current_status == 'OUTSIDE':
            return self.send_json({'success': False, 'message': f'{student["full_name"]} is currently OUTSIDE.'}, 400)

        action = 'ENTRY' if (station_mode == 'entry' or (station_mode == 'demo' and current_status == 'OUTSIDE')) else 'EXIT'

        if action == 'ENTRY':
            cursor.execute("UPDATE students SET status = 'INSIDE' WHERE id = ?", (student['id'],))
            cursor.execute("INSERT INTO library_visits (student_id, entry_time, status, entry_station) VALUES (?, ?, 'ACTIVE', ?)",
                           (student['id'], t_now, station_name))
            if qr_token_record:
                cursor.execute("UPDATE qr_tokens SET used_at = ? WHERE token = ?", (t_now, qr_token_record['token']))
            conn.commit()

            cursor.execute("SELECT * FROM students WHERE id = ?", (student['id'],))
            up_student = dict(cursor.fetchone())
            return self.send_json({
                'success': True,
                'action': 'ENTRY',
                'student': up_student,
                'visit': {'entry_time': t_now, 'status': 'ACTIVE', 'station': station_name},
                'message': 'Welcome to JECRC University Library.'
            })
        else:
            cursor.execute("SELECT * FROM library_visits WHERE student_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1", (student['id'],))
            act_visit = cursor.fetchone()
            dur = 30
            e_time = t_now
            if act_visit:
                e_time = act_visit['entry_time']
                try:
                    dt_e = datetime.strptime(e_time, '%Y-%m-%d %H:%M:%S').replace(tzinfo=IST)
                    dt_x = datetime.now(IST)
                    dur = max(int((dt_x - dt_e).total_seconds() / 60), 1)
                except Exception:
                    dur = 30
                cursor.execute("UPDATE library_visits SET exit_time = ?, duration_minutes = ?, status = 'COMPLETED', exit_station = ? WHERE id = ?",
                               (t_now, dur, station_name, act_visit['id']))
            else:
                cursor.execute("INSERT INTO library_visits (student_id, entry_time, exit_time, duration_minutes, status, exit_station) VALUES (?, ?, ?, 45, 'COMPLETED', ?)",
                               (student['id'], t_now, t_now, station_name))

            cursor.execute("UPDATE students SET status = 'OUTSIDE' WHERE id = ?", (student['id'],))
            if qr_token_record:
                cursor.execute("UPDATE qr_tokens SET used_at = ? WHERE token = ?", (t_now, qr_token_record['token']))
            conn.commit()

            cursor.execute("SELECT * FROM students WHERE id = ?", (student['id'],))
            up_student = dict(cursor.fetchone())
            formatted_dur = f"{dur // 60} hrs {dur % 60} mins" if dur >= 60 else f"{dur} mins"
            return self.send_json({
                'success': True,
                'action': 'EXIT',
                'student': up_student,
                'visit': {'entry_time': e_time, 'exit_time': t_now, 'duration_minutes': dur, 'formatted_duration': formatted_dur},
                'message': 'Thank you for visiting the library.'
            })

    def handle_stats(self, conn):
        cursor = conn.cursor()
        total = cursor.execute("SELECT COUNT(*) FROM students").fetchone()[0]
        inside = cursor.execute("SELECT COUNT(*) FROM students WHERE status = 'INSIDE'").fetchone()[0]
        outside = max(total - inside, 0)
        today = now_ist()[:10] + '%'
        today_visits = cursor.execute("SELECT COUNT(*) FROM library_visits WHERE entry_time LIKE ?", (today,)).fetchone()[0]
        avg_dur = cursor.execute("SELECT ROUND(AVG(duration_minutes), 0) FROM library_visits WHERE exit_time IS NOT NULL AND entry_time LIKE ?", (today,)).fetchone()[0] or 60
        cap = int(cursor.execute("SELECT value FROM system_settings WHERE key = 'library_capacity'").fetchone()[0] or 200)

        cursor.execute("""
            SELECT v.*, s.full_name, s.roll_number, s.branch, s.avatar_color
            FROM library_visits v JOIN students s ON v.student_id = s.id
            ORDER BY v.id DESC LIMIT 8
        """)
        recent = [dict(r) for r in cursor.fetchall()]

        self.send_json({
            'total_students': total,
            'currently_inside': inside,
            'currently_outside': outside,
            'visits_today': today_visits,
            'avg_duration_minutes': int(avg_dur),
            'capacity': cap,
            'available_seats': max(cap - inside, 0),
            'occupancy_pct': round((inside / cap) * 100, 1) if cap > 0 else 0,
            'recent_activity': recent,
            'server_time': now_ist()
        })

    def handle_analytics(self, conn):
        cursor = conn.cursor()
        # Daily
        daily_labels, daily_data = [], []
        t_now = datetime.now(IST)
        for i in range(6, -1, -1):
            day_str = (t_now - timedelta(days=i)).strftime('%Y-%m-%d')
            label = (t_now - timedelta(days=i)).strftime('%b %d')
            cnt = cursor.execute("SELECT COUNT(*) FROM library_visits WHERE entry_time LIKE ?", (f"{day_str}%",)).fetchone()[0]
            daily_labels.append(label)
            daily_data.append(cnt)

        # Hourly
        hourly_labels = [f"{h if h <= 12 else h - 12}:00 {'AM' if h < 12 else 'PM'}" for h in range(8, 20)]
        hourly_data = [cursor.execute("SELECT COUNT(*) FROM library_visits WHERE strftime('%H', entry_time) = ?", (f"{h:02d}",)).fetchone()[0] for h in range(8, 20)]

        # Dept
        dept_rows = cursor.execute("""
            SELECT s.branch, COUNT(v.id) as cnt, ROUND(AVG(COALESCE(v.duration_minutes, 60)), 0) as avg_d
            FROM library_visits v JOIN students s ON v.student_id = s.id
            GROUP BY s.branch ORDER BY cnt DESC
        """).fetchall()

        self.send_json({
            'daily': {'labels': daily_labels, 'data': daily_data},
            'hourly': {'labels': hourly_labels, 'data': hourly_data},
            'department': {
                'labels': [r[0] for r in dept_rows],
                'data': [r[1] for r in dept_rows],
                'avg_duration': [r[2] for r in dept_rows]
            }
        })

    def handle_students(self, conn, query):
        q = query.get('q', [''])[0].strip()
        dept = query.get('dept', [''])[0].strip()
        status = query.get('status', [''])[0].strip()

        sql = "SELECT * FROM students WHERE 1=1"
        args = []
        if q:
            sql += " AND (full_name LIKE ? OR roll_number LIKE ? OR barcode_id LIKE ?)"
            args.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
        if dept and dept != 'ALL':
            sql += " AND branch = ?"
            args.append(dept)
        if status and status != 'ALL':
            sql += " AND status = ?"
            args.append(status)

        cursor = conn.cursor()
        rows = cursor.execute(sql, args).fetchall()
        self.send_json({'students': [dict(r) for r in rows], 'count': len(rows)})

    def handle_visits(self, conn, query):
        q = query.get('q', [''])[0].strip()
        status = query.get('status', [''])[0].strip()
        dept = query.get('dept', [''])[0].strip()
        page = max(int(query.get('page', ['1'])[0]), 1)
        limit = int(query.get('limit', ['15'])[0])
        offset = (page - 1) * limit

        sql_where = "WHERE 1=1"
        args = []
        if q:
            sql_where += " AND (s.full_name LIKE ? OR s.roll_number LIKE ?)"
            args.extend([f"%{q}%", f"%{q}%"])
        if status and status != 'ALL':
            sql_where += " AND v.status = ?"
            args.append(status)
        if dept and dept != 'ALL':
            sql_where += " AND s.branch = ?"
            args.append(dept)

        cursor = conn.cursor()
        total = cursor.execute(f"SELECT COUNT(*) FROM library_visits v JOIN students s ON v.student_id = s.id {sql_where}", args).fetchone()[0]
        rows = cursor.execute(f"""
            SELECT v.*, s.full_name, s.roll_number, s.branch, s.avatar_color, s.barcode_id
            FROM library_visits v JOIN students s ON v.student_id = s.id
            {sql_where} ORDER BY v.id DESC LIMIT ? OFFSET ?
        """, args + [limit, offset]).fetchall()

        self.send_json({
            'visits': [dict(r) for r in rows],
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': (total + limit - 1) // limit
        })

    def handle_login(self, conn, body):
        u = body.get('username', '').strip()
        p = body.get('password', '').strip()
        p_hash = hashlib.sha256(p.encode('utf-8')).hexdigest()
        cursor = conn.cursor()
        row = cursor.execute("SELECT id, username, full_name, role FROM admin_users WHERE username = ? AND password_hash = ?", (u, p_hash)).fetchone()
        if row:
            token = secrets.token_hex(24)
            sessions[token] = dict(row)
            self.send_json({'success': True, 'token': token, 'user': dict(row)})
        else:
            self.send_json({'success': False, 'message': 'Invalid credentials'}, 401)

    def handle_qr_generate(self, conn, body):
        ident = (body.get('identifier') or '').strip()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM students WHERE roll_number = ? OR email = ? OR barcode_id = ?", (ident.upper(), ident.lower(), ident))
        student = cursor.fetchone()
        if not student:
            return self.send_json({'error': 'Student not found'}, 404)

        token = f"JECRC-QR-{student['id']}-{secrets.token_hex(6).upper()}"
        exp = (datetime.now(IST) + timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S')
        now_str = now_ist()
        cursor.execute("INSERT INTO qr_tokens (token, student_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                       (token, student['id'], exp, now_str))
        conn.commit()

        self.send_json({
            'success': True,
            'token': token,
            'student': dict(student),
            'expires_at': exp,
            'expires_in_seconds': 300
        })

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), SmartLibraryHandler)
    print(f"JECRC Smart Library Python Server running on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
