#!/usr/bin/env python3
"""
JECRC SMART LIBRARY - SQLite Database Initializer and Seeder (Python)
Compatible with Python 3 standard library (no pip packages needed).
"""
import sqlite3
import hashlib
import os
import random
from datetime import datetime, timedelta, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'library.db')
IST = timezone(timedelta(hours=5, minutes=30))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_schema(conn):
    cursor = conn.cursor()
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode_id TEXT UNIQUE NOT NULL,
      roll_number TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      semester INTEGER NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      avatar_color TEXT DEFAULT '#1E3E62',
      status TEXT DEFAULT 'OUTSIDE' CHECK(status IN ('INSIDE', 'OUTSIDE')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS library_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      duration_minutes INTEGER,
      status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED', 'MANUAL_CORRECTED')),
      entry_station TEXT DEFAULT 'Main Gate - Entry',
      exit_station TEXT,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'librarian' CHECK(role IN ('admin', 'librarian')),
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      record_id INTEGER,
      timestamp TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS qr_tokens (
      token TEXT PRIMARY KEY,
      student_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_students_barcode ON students(barcode_id);
    CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
    CREATE INDEX IF NOT EXISTS idx_visits_student ON library_visits(student_id);
    CREATE INDEX IF NOT EXISTS idx_visits_entry ON library_visits(entry_time);
    CREATE INDEX IF NOT EXISTS idx_visits_status ON library_visits(status);
    """)
    conn.commit()

def now_ist_str():
    return datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S')

def seed_data(conn):
    print("Seeding database via Python...")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM qr_tokens;")
    cursor.execute("DELETE FROM audit_logs;")
    cursor.execute("DELETE FROM library_visits;")
    cursor.execute("DELETE FROM students;")
    cursor.execute("DELETE FROM admin_users;")
    cursor.execute("DELETE FROM system_settings;")

    t_now = now_ist_str()
    cursor.execute("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)", ('library_capacity', '200', t_now))
    cursor.execute("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)", ('library_name', 'JECRC Central Library', t_now))
    cursor.execute("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)", ('university_name', 'JECRC University, Jaipur', t_now))
    cursor.execute("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)", ('entry_station_name', 'Main Gate - Station A', t_now))
    cursor.execute("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)", ('exit_station_name', 'Main Gate - Station B', t_now))

    pass_admin = hashlib.sha256('admin123'.encode('utf-8')).hexdigest()
    pass_lib = hashlib.sha256('jecrc2026'.encode('utf-8')).hexdigest()
    cursor.execute("INSERT INTO admin_users (username, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?)",
                   ('admin', pass_admin, 'Chief Librarian - Dr. Rajesh Sharma', 'admin', t_now))
    cursor.execute("INSERT INTO admin_users (username, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?)",
                   ('librarian', pass_lib, 'Assistant Librarian - Sunita Meena', 'librarian', t_now))
    conn.commit()

if __name__ == '__main__':
    conn = get_db()
    init_schema(conn)
    seed_data(conn)
    conn.close()
    print("Python database setup complete.")
