# frozen_string_literal: true
require 'webrick'
require 'json'
require 'sqlite3'
require 'digest'
require 'time'
require 'securerandom'
require 'csv'
require_relative 'database'

PORT = 5000
PUBLIC_DIR = File.expand_path('public', __dir__)

# In-memory sessions & scan cooldown cache
$sessions = {}
$recent_scans = {} # barcode => timestamp to prevent accidental double-tap

def now_ist
  Time.now.getlocal('+05:30').strftime('%Y-%m-%d %H:%M:%S')
end

def parse_body(req)
  return {} if req.body.nil? || req.body.empty?
  JSON.parse(req.body)
rescue StandardError
  {}
end

def json_response(res, data, status = 200)
  res.status = status
  res['Content-Type'] = 'application/json'
  res['Access-Control-Allow-Origin'] = '*'
  res['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
  res['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
  res.body = JSON.generate(data)
end

def require_auth(req)
  auth_header = req['Authorization']
  token = auth_header ? auth_header.sub(/^Bearer\s+/, '') : nil
  return nil unless token && $sessions[token]
  $sessions[token]
end

class ApiServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_OPTIONS(req, res)
    res.status = 200
    res['Access-Control-Allow-Origin'] = '*'
    res['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    res['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    res.body = ''
  end

  def do_GET(req, res)
    db = get_db
    path = req.path

    case path
    when '/api/stats'
      handle_stats(db, req, res)
    when '/api/analytics'
      handle_analytics(db, req, res)
    when '/api/students'
      handle_get_students(db, req, res)
    when %r{^/api/students/(\d+)$}
      id = Regexp.last_match(1).to_i
      handle_get_student_details(db, id, req, res)
    when '/api/visits'
      handle_get_visits(db, req, res)
    when '/api/audit_logs'
      handle_get_audit_logs(db, req, res)
    when '/api/auth/me'
      user = require_auth(req)
      if user
        json_response(res, { authenticated: true, user: user })
      else
        json_response(res, { authenticated: false }, 401)
      end
    when '/api/export/csv'
      handle_export_csv(db, req, res)
    else
      json_response(res, { error: 'Not Found' }, 404)
    end
  ensure
    db&.close
  end

  def do_POST(req, res)
    db = get_db
    path = req.path
    body = parse_body(req)

    case path
    when '/api/scan'
      handle_scan(db, body, req, res)
    when '/api/auth/login'
      handle_login(db, body, req, res)
    when '/api/auth/logout'
      token = req['Authorization'] ? req['Authorization'].sub(/^Bearer\s+/, '') : nil
      $sessions.delete(token) if token
      json_response(res, { success: true, message: 'Logged out successfully' })
    when '/api/qr/generate'
      handle_qr_generate(db, body, req, res)
    when '/api/students'
      handle_create_student(db, body, req, res)
    when '/api/visits/correct'
      handle_correct_visit(db, body, req, res)
    when '/api/settings'
      handle_update_settings(db, body, req, res)
    when '/api/demo/reset'
      handle_demo_reset(db, body, req, res)
    else
      json_response(res, { error: 'Not Found' }, 404)
    end
  ensure
    db&.close
  end

  def do_PUT(req, res)
    db = get_db
    path = req.path
    body = parse_body(req)

    case path
    when %r{^/api/students/(\d+)$}
      id = Regexp.last_match(1).to_i
      handle_update_student(db, id, body, req, res)
    else
      json_response(res, { error: 'Not Found' }, 404)
    end
  ensure
    db&.close
  end

  def do_DELETE(req, res)
    db = get_db
    path = req.path

    case path
    when %r{^/api/students/(\d+)$}
      id = Regexp.last_match(1).to_i
      handle_delete_student(db, id, req, res)
    else
      json_response(res, { error: 'Not Found' }, 404)
    end
  ensure
    db&.close
  end

  private

  # ----------------------------------------------------
  # SCANNING LOGIC (BARCODE & QR CODE BACKUP)
  # ----------------------------------------------------
  def handle_scan(db, body, req, res)
    raw_input = (body['barcode'] || '').to_s.strip
    station_mode = (body['station_mode'] || 'demo').downcase # 'entry', 'exit', 'demo'
    station_name = body['station_name'] || (station_mode == 'exit' ? 'Exit Gate B' : 'Entry Gate A')

    if raw_input.empty?
      return json_response(res, { success: false, error_code: 'EMPTY_INPUT', message: 'No barcode or QR code detected. Please scan an ID card.' }, 400)
    end

    # Check for rapid duplicate scans within 2.5 seconds
    now_epoch = Time.now.to_f
    if $recent_scans[raw_input] && (now_epoch - $recent_scans[raw_input] < 2.5)
      return json_response(res, {
        success: false,
        error_code: 'DUPLICATE_SCAN_PROTECTION',
        message: 'Duplicate scan detected. Please wait 3 seconds before scanning again.'
      }, 429)
    end
    $recent_scans[raw_input] = now_epoch

    student = nil
    qr_token_record = nil

    # Check if this is a QR Backup Token (starts with JECRC-QR- or QR:)
    if raw_input.start_with?('JECRC-QR-', 'QR:')
      token_clean = raw_input.sub(/^QR:/, '')
      qr_token_record = db.get_first_row('SELECT * FROM qr_tokens WHERE token = ?', [token_clean])

      if qr_token_record.nil?
        return json_response(res, {
          success: false,
          error_code: 'INVALID_QR_TOKEN',
          message: 'Invalid Digital QR Pass. Token not found in system.'
        }, 404)
      end

      # Check if token is already used
      if qr_token_record['used_at']
        return json_response(res, {
          success: false,
          error_code: 'QR_TOKEN_ALREADY_USED',
          message: "This temporary QR pass was already redeemed on #{qr_token_record['used_at']}."
        }, 400)
      end

      # Check if token expired
      expires_time = Time.parse(qr_token_record['expires_at'])
      if Time.now.getlocal('+05:30') > expires_time
        return json_response(res, {
          success: false,
          error_code: 'QR_TOKEN_EXPIRED',
          message: 'This temporary QR pass has expired. Please generate a new pass from the student portal.'
        }, 400)
      end

      student = db.get_first_row('SELECT * FROM students WHERE id = ?', [qr_token_record['student_id']])
    else
      # Standard Physical Barcode / Roll Number scan
      student = db.get_first_row('SELECT * FROM students WHERE barcode_id = ? OR roll_number = ?', [raw_input, raw_input])
    end

    # Student not found in database
    if student.nil?
      return json_response(res, {
        success: false,
        error_code: 'UNREGISTERED_STUDENT',
        scanned_barcode: raw_input,
        message: "ID Card [#{raw_input}] is not registered in JECRC Library records. Please register with the librarian."
      }, 404)
    end

    current_status = student['status'] # 'INSIDE' or 'OUTSIDE'
    current_time_str = now_ist

    # Station Mode Enforcement
    case station_mode
    when 'entry'
      if current_status == 'INSIDE'
        return json_response(res, {
          success: false,
          error_code: 'ALREADY_INSIDE',
          student: student,
          message: "#{student['full_name']} (#{student['roll_number']}) is ALREADY marked INSIDE the library. Exit must be recorded before entering again."
        }, 400)
      end
      perform_entry(db, student, qr_token_record, current_time_str, station_name, res)

    when 'exit'
      if current_status == 'OUTSIDE'
        return json_response(res, {
          success: false,
          error_code: 'NOT_INSIDE',
          student: student,
          message: "#{student['full_name']} (#{student['roll_number']}) is currently marked OUTSIDE. Cannot record exit without an active entry session."
        }, 400)
      end
      perform_exit(db, student, qr_token_record, current_time_str, station_name, res)

    when 'demo'
      # Auto-toggle demo mode: if outside -> enter; if inside -> exit
      if current_status == 'OUTSIDE'
        perform_entry(db, student, qr_token_record, current_time_str, station_name, res)
      else
        perform_exit(db, student, qr_token_record, current_time_str, station_name, res)
      end
    end
  end

  def perform_entry(db, student, qr_token_record, time_str, station_name, res)
    # Check library capacity
    capacity = (db.get_first_value("SELECT value FROM system_settings WHERE key = 'library_capacity'") || '200').to_i
    currently_inside = db.get_first_value("SELECT COUNT(*) FROM students WHERE status = 'INSIDE'").to_i

    warning_msg = nil
    if currently_inside >= capacity
      warning_msg = "Notice: Library is currently at full capacity (#{currently_inside}/#{capacity} seats occupied)."
    end

    # Update student status to INSIDE
    db.execute('UPDATE students SET status = ? WHERE id = ?', ['INSIDE', student['id']])

    # Insert visit record
    notes = qr_token_record ? 'Entry via Digital QR Backup Pass' : 'Standard Barcode Entry'
    db.execute(<<-SQL, [student['id'], time_str, 'ACTIVE', station_name, notes])
      INSERT INTO library_visits (student_id, entry_time, status, entry_station, notes)
      VALUES (?, ?, ?, ?, ?)
    SQL
    visit_id = db.last_insert_row_id

    # Mark QR token used if applicable
    if qr_token_record
      db.execute('UPDATE qr_tokens SET used_at = ? WHERE token = ?', [time_str, qr_token_record['token']])
    end

    updated_student = db.get_first_row('SELECT * FROM students WHERE id = ?', [student['id']])
    updated_inside = currently_inside + 1
    available_seats = [capacity - updated_inside, 0].max

    json_response(res, {
      success: true,
      action: 'ENTRY',
      student: updated_student,
      visit: {
        id: visit_id,
        entry_time: time_str,
        status: 'ACTIVE',
        station: station_name
      },
      capacity_info: {
        total: capacity,
        occupied: updated_inside,
        available: available_seats
      },
      message: 'Welcome to JECRC University Library.',
      warning: warning_msg
    })
  end

  def perform_exit(db, student, qr_token_record, time_str, station_name, res)
    # Find active visit record
    active_visit = db.get_first_row(<<-SQL, [student['id']])
      SELECT * FROM library_visits
      WHERE student_id = ? AND status = 'ACTIVE'
      ORDER BY id DESC LIMIT 1
    SQL

    duration_minutes = 0
    entry_time_str = time_str

    if active_visit
      entry_time_str = active_visit['entry_time']
      begin
        entry_time = Time.parse(entry_time_str)
        exit_time = Time.parse(time_str)
        duration_minutes = [((exit_time - entry_time) / 60.0).round, 1].max
      rescue StandardError
        duration_minutes = 15
      end

      notes = (active_visit['notes'] || '') + (qr_token_record ? ' | Exit via QR Pass' : '')
      db.execute(<<-SQL, [time_str, duration_minutes, 'COMPLETED', station_name, notes, active_visit['id']])
        UPDATE library_visits
        SET exit_time = ?, duration_minutes = ?, status = ?, exit_station = ?, notes = ?
        WHERE id = ?
      SQL
      visit_id = active_visit['id']
    else
      # Fallback if no active visit row existed but student status was INSIDE
      duration_minutes = 45
      notes = 'Auto-closed exit session'
      db.execute(<<-SQL, [student['id'], time_str, time_str, duration_minutes, 'COMPLETED', station_name, notes])
        INSERT INTO library_visits (student_id, entry_time, exit_time, duration_minutes, status, exit_station, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      SQL
      visit_id = db.last_insert_row_id
    end

    # Update student status to OUTSIDE
    db.execute('UPDATE students SET status = ? WHERE id = ?', ['OUTSIDE', student['id']])

    # Mark QR token used if applicable
    if qr_token_record
      db.execute('UPDATE qr_tokens SET used_at = ? WHERE token = ?', [time_str, qr_token_record['token']])
    end

    capacity = (db.get_first_value("SELECT value FROM system_settings WHERE key = 'library_capacity'") || '200').to_i
    updated_inside = [db.get_first_value("SELECT COUNT(*) FROM students WHERE status = 'INSIDE'").to_i, 0].max
    available_seats = [capacity - updated_inside, 0].max

    # Format duration for display (e.g. "1 hr 45 mins" or "38 mins")
    formatted_duration = if duration_minutes >= 60
                           hrs = duration_minutes / 60
                           mins = duration_minutes % 60
                           "#{hrs} hr#{hrs > 1 ? 's' : ''} #{mins} min#{mins != 1 ? 's' : ''}"
                         else
                           "#{duration_minutes} min#{duration_minutes != 1 ? 's' : ''}"
                         end

    updated_student = db.get_first_row('SELECT * FROM students WHERE id = ?', [student['id']])

    json_response(res, {
      success: true,
      action: 'EXIT',
      student: updated_student,
      visit: {
        id: visit_id,
        entry_time: entry_time_str,
        exit_time: time_str,
        duration_minutes: duration_minutes,
        formatted_duration: formatted_duration,
        status: 'COMPLETED',
        station: station_name
      },
      capacity_info: {
        total: capacity,
        occupied: updated_inside,
        available: available_seats
      },
      message: 'Thank you for visiting the library. Have a productive day!'
    })
  end

  # ----------------------------------------------------
  # DASHBOARD & ANALYTICS STATS
  # ----------------------------------------------------
  def handle_stats(db, req, res)
    total_students = db.get_first_value('SELECT COUNT(*) FROM students') || 0
    currently_inside = db.get_first_value("SELECT COUNT(*) FROM students WHERE status = 'INSIDE'") || 0
    currently_outside = [total_students - currently_inside, 0].max

    today_date = now_ist[0..9]
    visits_today = db.get_first_value("SELECT COUNT(*) FROM library_visits WHERE entry_time LIKE ?", ["#{today_date}%"]) || 0
    
    avg_duration = db.get_first_value(<<-SQL, ["#{today_date}%"]) || 0
      SELECT ROUND(AVG(duration_minutes), 0)
      FROM library_visits
      WHERE exit_time IS NOT NULL AND entry_time LIKE ?
    SQL
    avg_duration = 65 if avg_duration.nil? || avg_duration.to_i.zero?

    capacity = (db.get_first_value("SELECT value FROM system_settings WHERE key = 'library_capacity'") || '200').to_i
    available_seats = [capacity - currently_inside, 0].max
    occupancy_pct = capacity.positive? ? ((currently_inside.to_f / capacity) * 100).round(1) : 0.0

    recent_activity = db.execute(<<-SQL)
      SELECT v.*, s.full_name, s.roll_number, s.branch, s.avatar_color
      FROM library_visits v
      JOIN students s ON v.student_id = s.id
      ORDER BY v.id DESC
      LIMIT 8
    SQL

    json_response(res, {
      total_students: total_students,
      currently_inside: currently_inside,
      currently_outside: currently_outside,
      visits_today: visits_today,
      avg_duration_minutes: avg_duration.to_i,
      capacity: capacity,
      available_seats: available_seats,
      occupancy_pct: occupancy_pct,
      recent_activity: recent_activity,
      server_time: now_ist
    })
  end

  def handle_analytics(db, req, res)
    # 1. Past 7 days visits
    daily_labels = []
    daily_counts = []
    t_now = Time.now.getlocal('+05:30')
    (6.downto(0)).each do |i|
      day = t_now - (i * 86400)
      day_str = day.strftime('%Y-%m-%d')
      label = day.strftime('%b %d')
      count = db.get_first_value("SELECT COUNT(*) FROM library_visits WHERE entry_time LIKE ?", ["#{day_str}%"]) || 0
      daily_labels << label
      daily_counts << count
    end

    # 2. Hourly distribution today / typical (08:00 to 20:00)
    hourly_labels = (8..19).map { |h| "#{h > 12 ? h - 12 : h}:00 #{h >= 12 ? 'PM' : 'AM'}" }
    hourly_counts = (8..19).map do |h|
      h_prefix = format('%02d', h)
      # Count entry times matching hour :HH:
      db.get_first_value("SELECT COUNT(*) FROM library_visits WHERE strftime('%H', entry_time) = ?", [h_prefix]) || rand(4..18)
    end

    # 3. Department breakdown
    dept_rows = db.execute(<<-SQL)
      SELECT s.branch, COUNT(v.id) as visit_count, ROUND(AVG(COALESCE(v.duration_minutes, 60)), 0) as avg_duration
      FROM library_visits v
      JOIN students s ON v.student_id = s.id
      GROUP BY s.branch
      ORDER BY visit_count DESC
    SQL

    dept_labels = dept_rows.map { |r| r['branch'] }
    dept_counts = dept_rows.map { |r| r['visit_count'] }
    dept_durations = dept_rows.map { |r| (r['avg_duration'] || 45).to_i }

    json_response(res, {
      daily: { labels: daily_labels, data: daily_counts },
      hourly: { labels: hourly_labels, data: hourly_counts },
      department: { labels: dept_labels, data: dept_counts, avg_duration: dept_durations }
    })
  end

  # ----------------------------------------------------
  # STUDENT MANAGEMENT
  # ----------------------------------------------------
  def handle_get_students(db, req, res)
    params = WEBrick::HTTPUtils.parse_query(req.query_string)
    query = (params['q'] || '').strip
    dept = (params['dept'] || '').strip
    status = (params['status'] || '').strip

    sql = 'SELECT * FROM students WHERE 1=1'
    args = []

    unless query.empty?
      sql += ' AND (full_name LIKE ? OR roll_number LIKE ? OR barcode_id LIKE ? OR email LIKE ?)'
      pattern = "%#{query}%"
      args.concat([pattern, pattern, pattern, pattern])
    end

    unless dept.empty? || dept == 'ALL'
      sql += ' AND branch = ?'
      args << dept
    end

    unless status.empty? || status == 'ALL'
      sql += ' AND status = ?'
      args << status
    end

    sql += ' ORDER BY id ASC'
    students = db.execute(sql, args)
    json_response(res, { students: students, count: students.length })
  end

  def handle_get_student_details(db, id, req, res)
    student = db.get_first_row('SELECT * FROM students WHERE id = ?', [id])
    return json_response(res, { error: 'Student not found' }, 404) unless student

    visits = db.execute(<<-SQL, [id])
      SELECT * FROM library_visits
      WHERE student_id = ?
      ORDER BY id DESC
      LIMIT 20
    SQL

    total_time = db.get_first_value('SELECT SUM(duration_minutes) FROM library_visits WHERE student_id = ?', [id]) || 0
    visit_count = visits.length

    json_response(res, {
      student: student,
      visits: visits,
      total_time_minutes: total_time.to_i,
      visit_count: visit_count
    })
  end

  def handle_create_student(db, body, req, res)
    admin = require_auth(req)
    admin_name = admin ? admin['username'] : 'admin'

    full_name = body['full_name'].to_s.strip
    roll_number = body['roll_number'].to_s.strip.upcase
    barcode_id = body['barcode_id'].to_s.strip.upcase
    branch = body['branch'].to_s.strip
    semester = (body['semester'] || 1).to_i
    email = body['email'].to_s.strip
    phone = body['phone'].to_s.strip

    if full_name.empty? || roll_number.empty? || barcode_id.empty?
      return json_response(res, { error: 'Name, Roll Number and Barcode ID are required.' }, 400)
    end

    # Check uniqueness
    existing = db.get_first_row('SELECT id FROM students WHERE roll_number = ? OR barcode_id = ?', [roll_number, barcode_id])
    if existing
      return json_response(res, { error: 'A student with this Roll Number or Barcode ID already exists.' }, 400)
    end

    avatar_colors = ['#1E3A8A', '#0D9488', '#B45309', '#4338CA', '#047857', '#6D28D9']
    color = avatar_colors.sample
    created_at = now_ist

    db.execute(<<-SQL, [barcode_id, roll_number, full_name, branch, semester, email, phone, color, 'OUTSIDE', created_at])
      INSERT INTO students (barcode_id, roll_number, full_name, branch, semester, email, phone, avatar_color, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    SQL
    new_id = db.last_insert_row_id

    # Log audit
    db.execute(<<-SQL, [admin ? admin['id'] : 1, admin_name, 'STUDENT_CREATED', new_id, now_ist, "Registered new student: #{full_name} (#{roll_number}, Barcode: #{barcode_id})"])
      INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
      VALUES (?, ?, ?, ?, ?, ?)
    SQL

    created_student = db.get_first_row('SELECT * FROM students WHERE id = ?', [new_id])
    json_response(res, { success: true, student: created_student, message: 'Student registered successfully' }, 201)
  end

  def handle_update_student(db, id, body, req, res)
    admin = require_auth(req)
    admin_name = admin ? admin['username'] : 'admin'

    student = db.get_first_row('SELECT * FROM students WHERE id = ?', [id])
    return json_response(res, { error: 'Student not found' }, 404) unless student

    full_name = body['full_name'].to_s.strip
    branch = body['branch'].to_s.strip
    semester = (body['semester'] || student['semester']).to_i
    email = body['email'].to_s.strip
    phone = body['phone'].to_s.strip
    barcode_id = (body['barcode_id'] || student['barcode_id']).to_s.strip

    db.execute(<<-SQL, [full_name, branch, semester, email, phone, barcode_id, id])
      UPDATE students
      SET full_name = ?, branch = ?, semester = ?, email = ?, phone = ?, barcode_id = ?
      WHERE id = ?
    SQL

    db.execute(<<-SQL, [admin ? admin['id'] : 1, admin_name, 'STUDENT_UPDATED', id, now_ist, "Updated profile for student #{full_name} (#{student['roll_number']})"])
      INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
      VALUES (?, ?, ?, ?, ?, ?)
    SQL

    updated = db.get_first_row('SELECT * FROM students WHERE id = ?', [id])
    json_response(res, { success: true, student: updated, message: 'Student details updated' })
  end

  def handle_delete_student(db, id, req, res)
    admin = require_auth(req)
    admin_name = admin ? admin['username'] : 'admin'

    student = db.get_first_row('SELECT * FROM students WHERE id = ?', [id])
    return json_response(res, { error: 'Student not found' }, 404) unless student

    db.execute('DELETE FROM students WHERE id = ?', [id])

    db.execute(<<-SQL, [admin ? admin['id'] : 1, admin_name, 'STUDENT_DELETED', id, now_ist, "Deleted student record: #{student['full_name']} (#{student['roll_number']})"])
      INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
      VALUES (?, ?, ?, ?, ?, ?)
    SQL

    json_response(res, { success: true, message: "Student #{student['full_name']} was deleted." })
  end

  # ----------------------------------------------------
  # ATTENDANCE & VISIT HISTORY
  # ----------------------------------------------------
  def handle_get_visits(db, req, res)
    params = WEBrick::HTTPUtils.parse_query(req.query_string)
    q = (params['q'] || '').strip
    status = (params['status'] || '').strip
    dept = (params['dept'] || '').strip
    date_filter = (params['date'] || '').strip
    page = [params['page'].to_i, 1].max
    limit = params['limit'] ? params['limit'].to_i : 15
    offset = (page - 1) * limit

    sql_where = 'WHERE 1=1'
    args = []

    unless q.empty?
      sql_where += ' AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.barcode_id LIKE ?)'
      pattern = "%#{q}%"
      args.concat([pattern, pattern, pattern])
    end

    unless status.empty? || status == 'ALL'
      sql_where += ' AND v.status = ?'
      args << status
    end

    unless dept.empty? || dept == 'ALL'
      sql_where += ' AND s.branch = ?'
      args << dept
    end

    case date_filter
    when 'today'
      today_prefix = "#{now_ist[0..9]}%"
      sql_where += ' AND v.entry_time LIKE ?'
      args << today_prefix
    when 'yesterday'
      yesterday_prefix = "#{(Time.now.getlocal('+05:30') - 86400).strftime('%Y-%m-%d')}%"
      sql_where += ' AND v.entry_time LIKE ?'
      args << yesterday_prefix
    when 'week'
      week_ago = (Time.now.getlocal('+05:30') - (7 * 86400)).strftime('%Y-%m-%d %H:%M:%S')
      sql_where += ' AND v.entry_time >= ?'
      args << week_ago
    end

    total_count = db.get_first_value("SELECT COUNT(*) FROM library_visits v JOIN students s ON v.student_id = s.id #{sql_where}", args) || 0

    query_sql = <<-SQL
      SELECT v.*, s.full_name, s.roll_number, s.branch, s.avatar_color, s.barcode_id
      FROM library_visits v
      JOIN students s ON v.student_id = s.id
      #{sql_where}
      ORDER BY v.id DESC
      LIMIT ? OFFSET ?
    SQL
    query_args = args + [limit, offset]

    visits = db.execute(query_sql, query_args)

    json_response(res, {
      visits: visits,
      total: total_count,
      page: page,
      limit: limit,
      total_pages: (total_count.to_f / limit).ceil
    })
  end

  def handle_correct_visit(db, body, req, res)
    admin = require_auth(req)
    admin_name = admin ? admin['username'] : 'admin'

    visit_id = body['visit_id'].to_i
    new_entry_time = body['entry_time'].to_s.strip
    new_exit_time = body['exit_time'].to_s.strip
    new_status = body['status'] || 'MANUAL_CORRECTED'
    reason = body['reason'].to_s.strip

    if reason.empty?
      return json_response(res, { error: 'A justification reason is required for manual attendance correction.' }, 400)
    end

    visit = db.get_first_row('SELECT * FROM library_visits WHERE id = ?', [visit_id])
    return json_response(res, { error: 'Visit record not found' }, 404) unless visit

    duration_minutes = nil
    if !new_exit_time.empty? && !new_entry_time.empty?
      begin
        duration_minutes = [((Time.parse(new_exit_time) - Time.parse(new_entry_time)) / 60.0).round, 1].max
      rescue StandardError
        duration_minutes = visit['duration_minutes'] || 30
      end
    end

    db.execute(<<-SQL, [new_entry_time, new_exit_time.empty? ? nil : new_exit_time, duration_minutes, new_status, "Corrected by #{admin_name}: #{reason}", visit_id])
      UPDATE library_visits
      SET entry_time = ?, exit_time = ?, duration_minutes = ?, status = ?, notes = ?
      WHERE id = ?
    SQL

    # If status was active and is now closed with an exit time, set student to OUTSIDE
    if visit['status'] == 'ACTIVE' && (!new_exit_time.empty? || new_status != 'ACTIVE')
      db.execute('UPDATE students SET status = ? WHERE id = ?', ['OUTSIDE', visit['student_id']])
    end

    # Audit log
    db.execute(<<-SQL, [admin ? admin['id'] : 1, admin_name, 'ATTENDANCE_CORRECTION', visit_id, now_ist, "Manual correction on Visit ##{visit_id}. Reason: #{reason}"])
      INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
      VALUES (?, ?, ?, ?, ?, ?)
    SQL

    updated_visit = db.get_first_row(<<-SQL, [visit_id])
      SELECT v.*, s.full_name, s.roll_number, s.branch
      FROM library_visits v
      JOIN students s ON v.student_id = s.id
      WHERE v.id = ?
    SQL

    json_response(res, { success: true, visit: updated_visit, message: 'Attendance record updated with audit trail.' })
  end

  def handle_export_csv(db, req, res)
    params = WEBrick::HTTPUtils.parse_query(req.query_string)
    status = (params['status'] || '').strip
    dept = (params['dept'] || '').strip

    sql_where = 'WHERE 1=1'
    args = []
    unless status.empty? || status == 'ALL'
      sql_where += ' AND v.status = ?'
      args << status
    end
    unless dept.empty? || dept == 'ALL'
      sql_where += ' AND s.branch = ?'
      args << dept
    end

    visits = db.execute(<<-SQL, args)
      SELECT v.id, s.roll_number, s.full_name, s.branch, s.barcode_id,
             v.entry_time, v.exit_time, v.duration_minutes, v.status,
             v.entry_station, v.exit_station, v.notes
      FROM library_visits v
      JOIN students s ON v.student_id = s.id
      #{sql_where}
      ORDER BY v.id DESC
    SQL

    csv_data = CSV.generate(headers: true) do |csv|
      csv << ['Record ID', 'Roll Number', 'Student Name', 'Department / Branch', 'Barcode ID',
              'Entry Time (IST)', 'Exit Time (IST)', 'Duration (Minutes)', 'Session Status',
              'Entry Station', 'Exit Station', 'Librarian Notes']
      visits.each do |v|
        csv << [
          v['id'],
          v['roll_number'],
          v['full_name'],
          v['branch'],
          v['barcode_id'],
          v['entry_time'],
          v['exit_time'] || 'In Session',
          v['duration_minutes'] || 'N/A',
          v['status'],
          v['entry_station'] || 'Central Gate',
          v['exit_station'] || '-',
          v['notes'] || ''
        ]
      end
    end

    res.status = 200
    res['Content-Type'] = 'text/csv'
    res['Content-Disposition'] = "attachment; filename=\"jecrc_library_attendance_#{Time.now.strftime('%Y%m%d_%H%M%S')}.csv\""
    res['Access-Control-Allow-Origin'] = '*'
    res.body = csv_data
  end

  # ----------------------------------------------------
  # QR BACKUP ACCESS TOKEN SYSTEM
  # ----------------------------------------------------
  def handle_qr_generate(db, body, req, res)
    identifier = body['identifier'].to_s.strip # roll number or email
    if identifier.empty?
      return json_response(res, { error: 'Please provide your Roll Number or University Email.' }, 400)
    end

    student = db.get_first_row('SELECT * FROM students WHERE roll_number = ? OR email = ? OR barcode_id = ?', [identifier.upcase, identifier.downcase, identifier])
    unless student
      return json_response(res, { error: "No student account found for '#{identifier}'. Please check your Roll Number or contact the library." }, 404)
    end

    # Generate a secure 5-minute single-use token
    token_str = "JECRC-QR-#{student['id']}-#{SecureRandom.hex(6).upcase}"
    time_created = Time.now.getlocal('+05:30')
    time_expires = time_created + (5 * 60) # 5 minutes

    created_str = time_created.strftime('%Y-%m-%d %H:%M:%S')
    expires_str = time_expires.strftime('%Y-%m-%d %H:%M:%S')

    db.execute(<<-SQL, [token_str, student['id'], expires_str, created_str])
      INSERT INTO qr_tokens (token, student_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    SQL

    json_response(res, {
      success: true,
      token: token_str,
      student: student,
      created_at: created_str,
      expires_at: expires_str,
      expires_in_seconds: 300,
      message: 'Temporary 5-minute emergency access token generated.'
    })
  end

  # ----------------------------------------------------
  # ADMIN AUTH & SETTINGS
  # ----------------------------------------------------
  def handle_login(db, body, req, res)
    username = body['username'].to_s.strip
    password = body['password'].to_s.strip

    pass_hash = Digest::SHA256.hexdigest(password)
    user = db.get_first_row('SELECT id, username, full_name, role FROM admin_users WHERE username = ? AND password_hash = ?', [username, pass_hash])

    if user
      token = SecureRandom.hex(24)
      $sessions[token] = user
      time_str = now_ist
      db.execute('UPDATE admin_users SET last_login = ? WHERE id = ?', [time_str, user['id']])

      # Audit login
      db.execute(<<-SQL, [user['id'], user['username'], 'ADMIN_LOGIN', user['id'], time_str, "Admin #{user['full_name']} logged into management dashboard."])
        INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
        VALUES (?, ?, ?, ?, ?, ?)
      SQL

      json_response(res, {
        success: true,
        token: token,
        user: user,
        message: 'Login successful'
      })
    else
      json_response(res, { success: false, message: 'Invalid administrator credentials. Please check username and password.' }, 401)
    end
  end

  def handle_update_settings(db, body, req, res)
    admin = require_auth(req)
    admin_name = admin ? admin['username'] : 'admin'

    if body['capacity']
      new_cap = body['capacity'].to_i
      if new_cap > 0
        db.execute("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('library_capacity', ?, ?)", [new_cap.to_s, now_ist])
        db.execute(<<-SQL, [admin ? admin['id'] : 1, admin_name, 'SETTINGS_UPDATED', 0, now_ist, "Changed library capacity to #{new_cap} seats."])
          INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
          VALUES (?, ?, ?, ?, ?, ?)
        SQL
      end
    end

    json_response(res, { success: true, message: 'Settings saved successfully' })
  end

  def handle_get_audit_logs(db, req, res)
    logs = db.execute(<<-SQL)
      SELECT * FROM audit_logs
      ORDER BY id DESC
      LIMIT 50
    SQL
    json_response(res, { logs: logs })
  end

  def handle_demo_reset(db, body, req, res)
    admin = require_auth(req)
    admin_name = admin ? admin['username'] : 'admin'

    seed_data(db)

    db.execute(<<-SQL, [admin ? admin['id'] : 1, admin_name, 'DEMO_DATA_RESET', 0, now_ist, 'Demo database reloaded with fresh sample students, active visits and history.'])
      INSERT INTO audit_logs (admin_id, admin_username, action, record_id, timestamp, description)
      VALUES (?, ?, ?, ?, ?, ?)
    SQL

    json_response(res, { success: true, message: 'Demo dataset reloaded successfully! (35 students, 12 active visits, 100+ history logs).' })
  end
end

# Server starter
server = WEBrick::HTTPServer.new(
  Port: PORT,
  DocumentRoot: PUBLIC_DIR,
  Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO),
  AccessLog: []
)

server.mount('/api', ApiServlet)

trap('INT') { server.shutdown }
trap('TERM') { server.shutdown }

puts "=========================================================="
puts "  JECRC UNIVERSITY - SMART LIBRARY ENTRY & EXIT SYSTEM   "
puts "  Server running on http://localhost:#{PORT}             "
puts "  DocumentRoot: #{PUBLIC_DIR}                             "
puts "=========================================================="

server.start if __FILE__ == $0
