CREATE TABLE IF NOT EXISTS interview_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  owner_id BINARY(32) NOT NULL,
  problem_id VARCHAR(128) NOT NULL,
  problem_title VARCHAR(255) NOT NULL,
  transcript_json JSON NOT NULL,
  final_code TEXT NOT NULL,
  evaluation_json JSON NOT NULL,
  overall_score TINYINT UNSIGNED NOT NULL,
  tests_passed SMALLINT UNSIGNED NOT NULL,
  tests_total SMALLINT UNSIGNED NOT NULL,
  mocked TINYINT(1) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_owner_completed (owner_id, completed_at DESC, id DESC),
  CONSTRAINT chk_interview_score CHECK (overall_score <= 100),
  CONSTRAINT chk_interview_tests CHECK (tests_passed <= tests_total)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
