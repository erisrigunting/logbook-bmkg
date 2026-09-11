-- Import file for XAMPP (MySQL/MariaDB)
-- Database: logbook_bmkg
-- Default accounts:
-- teknisi / teknisi123
-- observasi / observasi123
-- datin / datin123

CREATE DATABASE IF NOT EXISTS logbook_bmkg
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE logbook_bmkg;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS activity_options;
DROP TABLE IF EXISTS officers;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  unit ENUM('Teknisi', 'Observasi', 'Datin') NOT NULL,
  password_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE officers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit ENUM('Teknisi', 'Observasi', 'Datin') NOT NULL,
  name VARCHAR(100) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_officers_unit (unit, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_options (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit ENUM('Teknisi', 'Observasi', 'Datin') NOT NULL,
  title VARCHAR(150) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_activity_unit_title (unit, title),
  KEY idx_activity_unit_active (unit, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  officer_id INT UNSIGNED NULL,
  unit ENUM('Teknisi', 'Observasi', 'Datin') NOT NULL,
  title VARCHAR(150) NOT NULL,
  details TEXT NULL,
  document_name VARCHAR(255) NULL,
  document_mime VARCHAR(100) NULL,
  document_data LONGBLOB NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Selesai',
  hours DECIMAL(5,2) NOT NULL,
  activity_date DATE NOT NULL,
  activity_time TIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_unit_date (unit, activity_date),
  KEY idx_logs_user_id (user_id),
  KEY idx_logs_officer_id (officer_id),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_logs_officer FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE SET NULL,
  CONSTRAINT chk_logs_hours CHECK (hours > 0 AND hours <= 24)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password hashes use SHA-256 so the passwords are not stored as plain text.
INSERT INTO users (id, username, unit, password_hash) VALUES
  (1, 'teknisi', 'Teknisi', SHA2('teknisi123', 256)),
  (2, 'observasi', 'Observasi', SHA2('observasi123', 256)),
  (3, 'datin', 'Datin', SHA2('datin123', 256));

-- Daftar ini dikelola admin. Tambahkan/nonaktifkan petugas dari tabel officers.
INSERT INTO officers (id, unit, name) VALUES
  (1, 'Teknisi', 'Petugas Teknisi 1'),
  (2, 'Teknisi', 'Petugas Teknisi 2'),
  (3, 'Observasi', 'Petugas Observasi 1'),
  (4, 'Observasi', 'Petugas Observasi 2'),
  (5, 'Datin', 'Petugas Datin 1'),
  (6, 'Datin', 'Petugas Datin 2');

INSERT INTO activity_options (unit, title) VALUES
  ('Teknisi', 'Pemeriksaan Perangkat Jaringan'),
  ('Teknisi', 'Kalibrasi Sensor Seismograf'),
  ('Teknisi', 'Pemeliharaan Peralatan'),
  ('Teknisi', 'Monitoring Jaringan'),
  ('Teknisi', 'Penggantian Komponen'),
  ('Teknisi', 'Corrective Maintenance Seismometer Ina TEWS'),
  ('Teknisi', 'Preventive Maintenance Seismometer Ina TEWS'),
  ('Teknisi', 'Lainnya'),
  ('Observasi', 'Observasi Layanan Lapangan'),
  ('Observasi', 'Rekap Hasil Observasi Harian'),
  ('Observasi', 'Pemantauan Data Gempa'),
  ('Observasi', 'Pencatatan Hasil Observasi'),
  ('Observasi', 'Pemeriksaan Data Observasi'),
  ('Observasi', 'Lainnya'),
  ('Datin', 'Pembaruan Basis Data Informasi'),
  ('Datin', 'Validasi Data Gempa Bumi'),
  ('Datin', 'Pengolahan Data Informasi'),
  ('Datin', 'Rekapitulasi Data Harian'),
  ('Datin', 'Publikasi Informasi'),
  ('Datin', 'Lainnya');

INSERT INTO logs (user_id, unit, title, hours, activity_date, created_at) VALUES
  (1, 'Teknisi', 'Pemeriksaan Perangkat Jaringan', 3.50, '2026-09-09', '2026-09-09 12:00:00'),
  (1, 'Teknisi', 'Kalibrasi Sensor Seismograf', 2.00, '2026-09-08', '2026-09-08 11:00:00'),
  (2, 'Observasi', 'Observasi Layanan Lapangan', 2.50, '2026-09-08', '2026-09-08 15:30:00'),
  (2, 'Observasi', 'Rekap Hasil Observasi Harian', 1.50, '2026-09-07', '2026-09-07 16:00:00'),
  (3, 'Datin', 'Pembaruan Basis Data Informasi', 1.50, '2026-09-07', '2026-09-07 10:30:00'),
  (3, 'Datin', 'Validasi Data Gempa Bumi', 2.00, '2026-09-06', '2026-09-06 14:00:00');
