<?php
declare(strict_types=1);

// XAMPP / MySQL configuration. Change these values if your MySQL account differs.
const DB_HOST = '127.0.0.1';
const DB_NAME = 'logbook_bmkg';
const DB_USER = 'root';
const DB_PASSWORD = '';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
session_name('logbook_session');
session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

function response(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function input(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASSWORD,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    return $pdo;
}
function current_user(): array {
    if (empty($_SESSION['user'])) response(['error' => 'Silakan masuk terlebih dahulu.'], 401);
    return $_SESSION['user'];
}
function ensure_schema(): void {
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS officers (id INT UNSIGNED NOT NULL AUTO_INCREMENT, unit ENUM('Teknisi','Observasi','Datin') NOT NULL, name VARCHAR(100) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), KEY idx_officers_unit (unit, active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS activity_options (id INT UNSIGNED NOT NULL AUTO_INCREMENT, unit ENUM('Teknisi','Observasi','Datin') NOT NULL, title VARCHAR(150) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uq_activity_unit_title (unit, title), KEY idx_activity_unit_active (unit, active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if ((int)$pdo->query('SELECT COUNT(*) FROM activity_options')->fetchColumn() === 0) {
        $seed = $pdo->prepare('INSERT INTO activity_options (unit, title) VALUES (?, ?)');
        $defaults = ['Teknisi' => ['Pemeriksaan Perangkat Jaringan', 'Kalibrasi Sensor Seismograf', 'Pemeliharaan Peralatan', 'Monitoring Jaringan', 'Penggantian Komponen', 'Corrective Maintenance Seismometer Ina TEWS', 'Preventive Maintenance Seismometer Ina TEWS', 'Lainnya'], 'Observasi' => ['Observasi Layanan Lapangan', 'Rekap Hasil Observasi Harian', 'Pemantauan Data Gempa', 'Pencatatan Hasil Observasi', 'Pemeriksaan Data Observasi', 'Lainnya'], 'Datin' => ['Pembaruan Basis Data Informasi', 'Validasi Data Gempa Bumi', 'Pengolahan Data Informasi', 'Rekapitulasi Data Harian', 'Publikasi Informasi', 'Lainnya']];
        foreach ($defaults as $unit => $titles) foreach ($titles as $title) $seed->execute([$unit, $title]);
    }
    $missingOption = $pdo->prepare("INSERT IGNORE INTO activity_options (unit, title) VALUES (?, 'Lainnya')");
    foreach (['Teknisi', 'Observasi', 'Datin'] as $unit) $missingOption->execute([$unit]);
    $column = $pdo->query("SHOW COLUMNS FROM logs LIKE 'officer_id'")->fetch();
    if (!$column) $pdo->exec('ALTER TABLE logs ADD COLUMN officer_id INT UNSIGNED NULL AFTER user_id, ADD KEY idx_logs_officer_id (officer_id), ADD CONSTRAINT fk_logs_officer FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE SET NULL');
    $columns = [
        'activity_time' => "ALTER TABLE logs ADD COLUMN activity_time TIME NULL AFTER activity_date",
        'details' => "ALTER TABLE logs ADD COLUMN details TEXT NULL AFTER title",
        'document_path' => "ALTER TABLE logs ADD COLUMN document_path VARCHAR(255) NULL AFTER details",
        'document_name' => "ALTER TABLE logs ADD COLUMN document_name VARCHAR(255) NULL AFTER document_path",
        'document_mime' => "ALTER TABLE logs ADD COLUMN document_mime VARCHAR(100) NULL AFTER document_name",
        'document_data' => "ALTER TABLE logs ADD COLUMN document_data LONGBLOB NULL AFTER document_mime",
        'status' => "ALTER TABLE logs ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'Selesai' AFTER document_path",
    ];
    foreach ($columns as $name => $query) {
        if (!$pdo->query("SHOW COLUMNS FROM logs LIKE " . $pdo->quote($name))->fetch()) $pdo->exec($query);
    }
    // Pindahkan PDF yang pernah disimpan versi lama ke database saat aplikasi pertama kali dijalankan.
    $legacyLogs = $pdo->query("SELECT id, document_path FROM logs WHERE document_path IS NOT NULL AND document_path <> '' AND document_data IS NULL")->fetchAll();
    $migrate = $pdo->prepare('UPDATE logs SET document_name = ?, document_mime = ?, document_data = ? WHERE id = ?');
    foreach ($legacyLogs as $legacy) {
        $filename = basename((string)$legacy['document_path']);
        $path = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($path)) continue;
        $data = file_get_contents($path);
        if ($data === false || (new finfo(FILEINFO_MIME_TYPE))->file($path) !== 'application/pdf') continue;
        $migrate->bindValue(1, $filename);
        $migrate->bindValue(2, 'application/pdf');
        $migrate->bindValue(3, $data, PDO::PARAM_LOB);
        $migrate->bindValue(4, (int)$legacy['id'], PDO::PARAM_INT);
        $migrate->execute();
    }
}
function upload_document(): ?array {
    if (empty($_FILES['document']) || $_FILES['document']['error'] === UPLOAD_ERR_NO_FILE) return null;
    $file = $_FILES['document'];
    if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 10 * 1024 * 1024) response(['error' => 'Dokumen PDF maksimal berukuran 10 MB.'], 422);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if ($mime !== 'application/pdf') response(['error' => 'Dokumen harus berupa file PDF.'], 422);
    $data = file_get_contents($file['tmp_name']);
    if ($data === false) response(['error' => 'Dokumen gagal dibaca.'], 500);
    return ['name' => mb_substr(basename((string)$file['name']), 0, 255), 'mime' => $mime, 'data' => $data];
}

try {
    ensure_schema();
    $action = $_GET['action'] ?? '';
    if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = input();
        $username = strtolower(trim((string)($data['username'] ?? '')));
        $password = (string)($data['password'] ?? '');
        $statement = db()->prepare('SELECT id, username, unit, password_hash FROM users WHERE username = ? LIMIT 1');
        $statement->execute([$username]);
        $user = $statement->fetch();
        if (!$user || !hash_equals($user['password_hash'], hash('sha256', $password))) {
            response(['error' => 'Username atau password tidak valid.'], 401);
        }
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => (int)$user['id'], 'username' => $user['username'], 'unit' => $user['unit']];
        response(['user' => $_SESSION['user']]);
    }
    if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $_SESSION = [];
        session_destroy();
        response(['ok' => true]);
    }
    if ($action === 'me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        response(['user' => current_user()]);
    }
    if ($action === 'document' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $user = current_user();
        $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
        if (!$id) response(['error' => 'Dokumen tidak ditemukan.'], 404);
        $statement = db()->prepare('SELECT document_name, document_mime, document_data FROM logs WHERE id = ? AND unit = ? AND document_data IS NOT NULL LIMIT 1');
        $statement->execute([$id, $user['unit']]);
        $document = $statement->fetch();
        if (!$document) response(['error' => 'Dokumen tidak ditemukan.'], 404);
        header_remove('Content-Type');
        header('Content-Type: ' . ($document['document_mime'] ?: 'application/pdf'));
        header('Content-Disposition: inline; filename="' . rawurlencode($document['document_name'] ?: 'dokumen.pdf') . '"');
        header('Content-Length: ' . strlen($document['document_data']));
        echo $document['document_data'];
        exit;
    }
    if ($action === 'logs' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $user = current_user();
        $statement = db()->prepare("SELECT l.id, l.title, l.details, l.document_data IS NOT NULL AS has_document, l.document_name, COALESCE(l.status, 'Selesai') AS status, l.hours, l.unit, l.activity_date, DATE_FORMAT(l.activity_time, '%H:%i') AS activity_time, COALESCE(o.name, '-') AS officer_name FROM logs l LEFT JOIN officers o ON o.id = l.officer_id WHERE l.unit = ? ORDER BY l.activity_date DESC, l.activity_time DESC, l.id DESC");
        $statement->execute([$user['unit']]);
        $logs = $statement->fetchAll();
        $totalHours = array_sum(array_map(static fn($log) => (float)$log['hours'], $logs));
        response(['logs' => $logs, 'summary' => ['total_logs' => count($logs), 'total_hours' => $totalHours]]);
    }
    if ($action === 'officers' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $user = current_user();
        $statement = db()->prepare('SELECT id, name, unit FROM officers WHERE unit = ? AND active = 1 ORDER BY name');
        $statement->execute([$user['unit']]);
        response(['officers' => $statement->fetchAll()]);
    }
    if ($action === 'activities' && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $user = current_user();
        $statement = db()->prepare('SELECT id, title FROM activity_options WHERE unit = ? AND active = 1 ORDER BY title');
        $statement->execute([$user['unit']]);
        response(['activities' => $statement->fetchAll()]);
    }
    if ($action === 'logs' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $user = current_user();
        $data = $_POST ?: input();
        $title = trim((string)($data['title'] ?? ''));
        $details = trim((string)($data['details'] ?? ''));
        $status = trim((string)($data['status'] ?? ''));
        $hours = filter_var($data['hours'] ?? null, FILTER_VALIDATE_FLOAT);
        $activityAt = (string)($data['activity_at'] ?? '');
        $officerId = filter_var($data['officer_id'] ?? null, FILTER_VALIDATE_INT);
        $activity = DateTime::createFromFormat('Y-m-d\\TH:i', $activityAt);
        $officerCheck = db()->prepare('SELECT id FROM officers WHERE id = ? AND unit = ? AND active = 1');
        $officerCheck->execute([$officerId, $user['unit']]);
        $allowedStatuses = ['Normal', 'Dalam Proses', 'Perlu Perhatian', 'Dalam Perbaikan', 'Selesai'];
        if ($title === '' || mb_strlen($title) > 150 || $details === '' || mb_strlen($details) > 5000 || !in_array($status, $allowedStatuses, true) || $hours === false || $hours <= 0 || $hours > 24 || !$activity || $activity->format('Y-m-d\\TH:i') !== $activityAt || !$officerCheck->fetch()) {
            response(['error' => 'Data aktivitas tidak valid.'], 422);
        }
        $document = upload_document();
        $statement = db()->prepare('INSERT INTO logs (user_id, officer_id, unit, title, details, document_name, document_mime, document_data, status, hours, activity_date, activity_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->bindValue(1, $user['id'], PDO::PARAM_INT);
        $statement->bindValue(2, $officerId, PDO::PARAM_INT);
        $statement->bindValue(3, $user['unit']);
        $statement->bindValue(4, $title);
        $statement->bindValue(5, $details);
        $statement->bindValue(6, $document['name'] ?? null, $document ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $statement->bindValue(7, $document['mime'] ?? null, $document ? PDO::PARAM_STR : PDO::PARAM_NULL);
        $statement->bindValue(8, $document['data'] ?? null, $document ? PDO::PARAM_LOB : PDO::PARAM_NULL);
        $statement->bindValue(9, $status);
        $statement->bindValue(10, $hours);
        $statement->bindValue(11, $activity->format('Y-m-d'));
        $statement->bindValue(12, $activity->format('H:i:s'));
        $statement->execute();
        response(['ok' => true], 201);
    }
    response(['error' => 'Endpoint tidak ditemukan.'], 404);
} catch (PDOException $exception) {
    response(['error' => 'Koneksi database gagal. Pastikan MySQL XAMPP aktif dan database logbook_bmkg sudah diimpor.'], 500);
}
