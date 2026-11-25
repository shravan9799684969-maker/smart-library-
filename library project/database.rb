# frozen_string_literal: true
require 'sqlite3'
require 'digest'
require 'time'
require 'securerandom'

DB_PATH = File.expand_path('library.db', __dir__)

def get_db
  db = SQLite3::Database.new(DB_PATH)
  db.results_as_hash = true
  db.execute('PRAGMA foreign_keys = ON;')
  db
end

def init_schema(db)
  db.execute_batch <<-SQL
    -- Students Table
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

    -- Library Visits Table
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

    -- Admin Users Table
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'librarian' CHECK(role IN ('admin', 'librarian')),
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    -- Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      record_id INTEGER,
      timestamp TEXT NOT NULL,
      description TEXT NOT NULL
    );

    -- System Settings Table
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- QR Backup Access Tokens Table
    CREATE TABLE IF NOT EXISTS qr_tokens (
      token TEXT PRIMARY KEY,
      student_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- Indexes for fast scanning and reporting
    CREATE INDEX IF NOT EXISTS idx_students_barcode ON students(barcode_id);
    CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
    CREATE INDEX IF NOT EXISTS idx_visits_student ON library_visits(student_id);
    CREATE INDEX IF NOT EXISTS idx_visits_entry ON library_visits(entry_time);
    CREATE INDEX IF NOT EXISTS idx_visits_status ON library_visits(status);
  SQL
end

def now_ist
  Time.now.getlocal('+05:30').strftime('%Y-%m-%d %H:%M:%S')
end

def ist_time_offset(hours_ago = 0, mins_ago = 0)
  t = Time.now.getlocal('+05:30') - (hours_ago * 3600 + mins_ago * 60)
  t.strftime('%Y-%m-%d %H:%M:%S')
end

def ist_date_offset(days_ago = 0, hour = 10, min = 30)
  t = Time.now.getlocal('+05:30') - (days_ago * 86400)
  Time.new(t.year, t.month, t.day, hour, min, rand(0..59), '+05:30').strftime('%Y-%m-%d %H:%M:%S')
end

def seed_data(db)
  puts 'Seeding JECRC Smart Library database with demo data...'

  # Clear existing data
  db.execute('DELETE FROM qr_tokens;')
  db.execute('DELETE FROM audit_logs;')
  db.execute('DELETE FROM library_visits;')
  db.execute('DELETE FROM students;')
  db.execute('DELETE FROM admin_users;')
  db.execute('DELETE FROM system_settings;')

  # Default Settings
  time_str = now_ist
  db.execute('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', ['library_capacity', '200', time_str])
  db.execute('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', ['library_name', 'JECRC Central Library', time_str])
  db.execute('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', ['university_name', 'JECRC University, Jaipur', time_str])
  db.execute('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', ['entry_station_name', 'Main Gate - Station A', time_str])
  db.execute('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', ['exit_station_name', 'Main Gate - Station B', time_str])

  # Default Admin Users
  # Passwords:
  # admin -> admin123
  # librarian -> jecrc2026
  pass_admin = Digest::SHA256.hexdigest('admin123')
  pass_lib = Digest::SHA256.hexdigest('jecrc2026')
  db.execute('INSERT INTO admin_users (username, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?)',
             ['admin', pass_admin, 'Chief Librarian - Dr. Rajesh Sharma', 'admin', time_str])
  db.execute('INSERT INTO admin_users (username, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?)',
             ['librarian', pass_lib, 'Assistant Librarian - Sunita Meena', 'librarian', time_str])

  # 35 Realistic Fictional Students for JECRC University
  departments = [
    'Computer Science & Engineering',
    'AI & Data Science',
    'Electronics & Comm. Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Computer Applications (BCA)',
    'Business Administration (BBA)',
    'School of Law (B.A. LL.B)',
    'Biotechnology (B.Sc)'
  ]

  avatar_colors = [
    '#1E3A8A', '#0D9488', '#B45309', '#4338CA', '#047857',
    '#7C2D12', '#6D28D9', '#0369A1', '#BE123C', '#4D7C0F'
  ]

  students_data = [
    ['JU20240101', '21BCON101', 'Aarav Sharma', 'Computer Science & Engineering', 6, 'aarav.sharma@jecrcu.edu.in', '9829011221'],
    ['JU20240102', '21BCON102', 'Ananya Gupta', 'Computer Science & Engineering', 6, 'ananya.gupta@jecrcu.edu.in', '9829011222'],
    ['JU20240103', '22BCON201', 'Rohan Mehta', 'AI & Data Science', 4, 'rohan.mehta@jecrcu.edu.in', '9829011223'],
    ['JU20240104', '22BCON202', 'Ishita Verma', 'AI & Data Science', 4, 'ishita.verma@jecrcu.edu.in', '9829011224'],
    ['JU20240105', '21BTEC011', 'Vikramaditya Rathore', 'Electronics & Comm. Engineering', 6, 'vikram.rathore@jecrcu.edu.in', '9829011225'],
    ['JU20240106', '21BTEC012', 'Pooja Choudhary', 'Electronics & Comm. Engineering', 6, 'pooja.choudhary@jecrcu.edu.in', '9829011226'],
    ['JU20240107', '23BCON301', 'Kabir Joshi', 'Computer Science & Engineering', 2, 'kabir.joshi@jecrcu.edu.in', '9829011227'],
    ['JU20240108', '23BCON302', 'Diya Agarwal', 'Computer Science & Engineering', 2, 'diya.agarwal@jecrcu.edu.in', '9829011228'],
    ['JU20240109', '21BTME005', 'Siddharth Singh Shekhawat', 'Mechanical Engineering', 6, 'siddharth.singh@jecrcu.edu.in', '9829011229'],
    ['JU20240110', '22BTME015', 'Tanvi Mathur', 'Mechanical Engineering', 4, 'tanvi.mathur@jecrcu.edu.in', '9829011230'],
    ['JU20240111', '21BTCE008', 'Harshvardhan Jain', 'Civil Engineering', 6, 'harsh.jain@jecrcu.edu.in', '9829011231'],
    ['JU20240112', '22BTCE012', 'Meera Khandelwal', 'Civil Engineering', 4, 'meera.k@jecrcu.edu.in', '9829011232'],
    ['JU20240113', '22BBAN045', 'Aditya Singhal', 'Business Administration (BBA)', 4, 'aditya.singhal@jecrcu.edu.in', '9829011233'],
    ['JU20240114', '23BBAN012', 'Sneha Soni', 'Business Administration (BBA)', 2, 'sneha.soni@jecrcu.edu.in', '9829011234'],
    ['JU20240115', '21BCAN033', 'Gaurav Pareek', 'Computer Applications (BCA)', 6, 'gaurav.pareek@jecrcu.edu.in', '9829011235'],
    ['JU20240116', '22BCAN019', 'Rhea Saxena', 'Computer Applications (BCA)', 4, 'rhea.saxena@jecrcu.edu.in', '9829011236'],
    ['JU20240117', '20BLAW004', 'Manish Bhardwaj', 'School of Law (B.A. LL.B)', 8, 'manish.law@jecrcu.edu.in', '9829011237'],
    ['JU20240118', '21BLAW021', 'Kavya Trivedi', 'School of Law (B.A. LL.B)', 6, 'kavya.trivedi@jecrcu.edu.in', '9829011238'],
    ['JU20240119', '22BSBT007', 'Yash Maheshwari', 'Biotechnology (B.Sc)', 4, 'yash.m@jecrcu.edu.in', '9829011239'],
    ['JU20240120', '23BSBT014', 'Simran Kulshreshtha', 'Biotechnology (B.Sc)', 2, 'simran.k@jecrcu.edu.in', '9829011240'],
    ['JU20240121', '21BCON140', 'Kartik Rawat', 'Computer Science & Engineering', 6, 'kartik.rawat@jecrcu.edu.in', '9829011241'],
    ['JU20240122', '22BCON245', 'Bhavna Malani', 'AI & Data Science', 4, 'bhavna.m@jecrcu.edu.in', '9829011242'],
    ['JU20240123', '23BCON380', 'Nikhil Kumawat', 'Computer Science & Engineering', 2, 'nikhil.k@jecrcu.edu.in', '9829011243'],
    ['JU20240124', '21BTEC045', 'Deepika Sharma', 'Electronics & Comm. Engineering', 6, 'deepika.s@jecrcu.edu.in', '9829011244'],
    ['JU20240125', '22BTME032', 'Akash Badaya', 'Mechanical Engineering', 4, 'akash.b@jecrcu.edu.in', '9829011245'],
    ['JU20240126', '23BBAN088', 'Priyanshu Tiwari', 'Business Administration (BBA)', 2, 'priyanshu.t@jecrcu.edu.in', '9829011246'],
    ['JU20240127', '21BCAN078', 'Muskan Jangid', 'Computer Applications (BCA)', 6, 'muskan.j@jecrcu.edu.in', '9829011247'],
    ['JU20240128', '22BLAW055', 'Lakshya Rajavat', 'School of Law (B.A. LL.B)', 4, 'lakshya.r@jecrcu.edu.in', '9829011248'],
    ['JU20240129', '21BCON199', 'Avani Dadhich', 'Computer Science & Engineering', 6, 'avani.d@jecrcu.edu.in', '9829011249'],
    ['JU20240130', '22BCON299', 'Pranav Solanki', 'AI & Data Science', 4, 'pranav.s@jecrcu.edu.in', '9829011250'],
    ['JU20240131', '23BTEC019', 'Ritika Chouhan', 'Electronics & Comm. Engineering', 2, 'ritika.c@jecrcu.edu.in', '9829011251'],
    ['JU20240132', '21BTCE044', 'Mohit Gehlot', 'Civil Engineering', 6, 'mohit.g@jecrcu.edu.in', '9829011252'],
    ['JU20240133', '22BBAN105', 'Sonakshi Gaur', 'Business Administration (BBA)', 4, 'sonakshi.g@jecrcu.edu.in', '9829011253'],
    ['JU20240134', '23BCAN044', 'Devendra Poonia', 'Computer Applications (BCA)', 2, 'devendra.p@jecrcu.edu.in', '9829011254'],
    ['JU20240135', '22BLAW089', 'Tanya Rajvanshi', 'School of Law (B.A. LL.B)', 4, 'tanya.r@jecrcu.edu.in', '9829011255']
  ]

  insert_student = db.prepare <<-SQL
    INSERT INTO students (barcode_id, roll_number, full_name, branch, semester, email, phone, avatar_color, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  SQL

  # First 12 students are marked as currently INSIDE
  # The remaining 23 are OUTSIDE
  student_ids = []
  students_data.each_with_index do |s, idx|
    is_inside = idx < 12
    initial_status = is_inside ? 'INSIDE' : 'OUTSIDE'
    color = avatar_colors[idx % avatar_colors.length]
    reg_date = ist_date_offset(rand(30..180), 9, 0)
    
    insert_student.execute(s[0], s[1], s[2], s[3], s[4], s[5], s[6], color, initial_status, reg_date)
    student_ids << db.last_insert_row_id
  end
  insert_student.close

  # Seed Library Visits
  insert_visit = db.prepare <<-SQL
    INSERT INTO library_visits (student_id, entry_time, exit_time, duration_minutes, status, entry_station, exit_station, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  SQL

  # 1. Active sessions for the 12 currently inside students
  # Entered today between 30 minutes and 3.5 hours ago
  inside_intervals = [
    [0, 35], [0, 50], [1, 15], [1, 40], [2, 10], [2, 25],
    [2, 45], [3, 0], [3, 15], [3, 30], [3, 45], [4, 10]
  ]

  inside_intervals.each_with_index do |(hrs, mins), idx|
    s_id = student_ids[idx]
    entry_t = ist_time_offset(hrs, mins)
    insert_visit.execute(s_id, entry_t, nil, nil, 'ACTIVE', 'Central Library - Main Gate (Entry)', nil, 'Current ongoing session')
  end

  # 2. Completed visits for today (earlier this morning)
  today_completed = [
    [student_ids[12], 4, 30, 2, 45, 105],
    [student_ids[13], 5, 0, 3, 20, 100],
    [student_ids[14], 4, 15, 2, 0, 135],
    [student_ids[15], 5, 30, 4, 0, 90],
    [student_ids[16], 3, 45, 1, 30, 135],
    [student_ids[17], 4, 0, 1, 45, 135],
    [student_ids[18], 5, 15, 3, 10, 125],
    [student_ids[19], 4, 45, 2, 15, 150]
  ]

  today_completed.each do |s_id, in_hrs, in_mins, out_hrs, out_mins, dur|
    entry_t = ist_time_offset(in_hrs, in_mins)
    exit_t = ist_time_offset(out_hrs, out_mins)
    insert_visit.execute(s_id, entry_t, exit_t, dur, 'COMPLETED', 'Central Library - Main Gate (Entry)', 'Central Library - Exit Turnstile', 'Regular study visit')
  end

  # 3. Past 6 days realistic historical records (~100 visits)
  (1..6).each do |days_ago|
    # Generate 15-20 visits per day
    visit_count = rand(14..20)
    sampled_students = student_ids.sample(visit_count)
    sampled_students.each do |s_id|
      start_hour = rand(8..17)
      start_min = rand(0..59)
      duration = rand(25..190)
      
      entry_t = ist_date_offset(days_ago, start_hour, start_min)
      exit_t_raw = Time.parse(entry_t) + (duration * 60)
      exit_t = exit_t_raw.strftime('%Y-%m-%d %H:%M:%S')

      status = 'COMPLETED'
      notes = 'Historical study session'
      
      # Occasionally simulate one manual corrected record
      if rand < 0.05
        status = 'MANUAL_CORRECTED'
        notes = 'Student card scanner error on exit. Adjusted by librarian.'
      end

      insert_visit.execute(s_id, entry_t, exit_t, duration, status, 'Central Library - Main Gate (Entry)', 'Central Library - Exit Turnstile', notes)
    end
  end
  insert_visit.close

  # Seed initial audit log
  db.execute <<-SQL, ['admin', 'SYSTEM_INIT', 1, time_str, 'Smart Library system initialized with 35 student records and baseline demo dataset.']
    INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
    VALUES (1, ?, ?, ?, ?, ?)
  SQL

  puts "Database initialized successfully! Students: #{students_data.length}, Inside: 12, Total Visits: #{db.get_first_value('SELECT COUNT(*) FROM library_visits')}"
end

if __FILE__ == $0
  db = get_db
  init_schema(db)
  seed_data(db)
  db.close
end
