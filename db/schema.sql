-- ============================================================
-- MC OF ISKKU 2026 DATABASE SCHEMA
-- Target DB: SQLite 3 / PostgreSQL / MySQL Compatible
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    google_id VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'VOTER', -- 'ADMIN' | 'VOTER'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(64) PRIMARY KEY,
    number VARCHAR(32) NOT NULL UNIQUE,       -- e.g., 'MC 01'
    nickname VARCHAR(128) NOT NULL,            -- e.g., 'MINT'
    full_name VARCHAR(255) NOT NULL,           -- e.g., 'ชลธิชา สมบูรณ์'
    major VARCHAR(255) NOT NULL,               -- e.g., 'สาขาวิชาสารสนเทศศาสตร์'
    year VARCHAR(32) DEFAULT 'ปี 3',            -- e.g., 'ปี 3'
    image_url TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'ELIMINATED' | 'WITHDRAWN'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. VOTING ROUNDS TABLE
CREATE TABLE IF NOT EXISTS voting_rounds (
    id VARCHAR(64) PRIMARY KEY,                -- 'ROUND_1' | 'ROUND_2'
    round_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_at DATETIME,
    end_at DATETIME,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT' | 'OPEN' | 'CLOSED' | 'PUBLISHED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. VOTES TABLE (WITH ANTI-DUPLICATE CONSTRAINT)
CREATE TABLE IF NOT EXISTS votes (
    id VARCHAR(64) PRIMARY KEY,
    voter_id VARCHAR(64) NOT NULL,
    round_id VARCHAR(64) NOT NULL,
    candidate_id VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES voting_rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    CONSTRAINT unique_voter_candidate_per_round UNIQUE (voter_id, round_id, candidate_id)
);

-- 5. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    action VARCHAR(64) NOT NULL,               -- 'USER_LOGIN' | 'VOTE_CREATED' | 'VOTING_OPENED' | 'VOTING_CLOSED' | 'GENERATE_RESULT' etc.
    round_id VARCHAR(64),
    candidate_id VARCHAR(64),
    ip_address VARCHAR(64) DEFAULT '127.0.0.1',
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. JUDGES TABLE
CREATE TABLE IF NOT EXISTS judges (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role_title VARCHAR(255) NOT NULL,          -- e.g., 'ประธานกรรมการตัดสิน'
    avatar_url TEXT NOT NULL,                   -- Supports Google Drive link & direct URL
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. JUDGE SELECTIONS TABLE (FOR WILDCARD COMPUTATION)
CREATE TABLE IF NOT EXISTS judge_selections (
    id VARCHAR(64) PRIMARY KEY,
    round_id VARCHAR(64) NOT NULL,
    candidate_id VARCHAR(64) NOT NULL,
    judge_id VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_judge_selection UNIQUE (round_id, candidate_id)
);

-- Seed Judges Data
INSERT OR IGNORE INTO judges (id, name, role_title, avatar_url, status) VALUES
('judge_01', 'ผศ.ดร.สมชาย ใจดี', 'ประธานกรรมการตัดสิน / ผู้เชี่ยวชาญด้านการสื่อสาร', 'https://lh3.googleusercontent.com/d/1Bzx7y8z9aBCDEFghijklmnOPQRstuvwX', 'ACTIVE'),
('judge_02', 'คุณณัฐวุฒิ สายบันเทิง', 'กรรมการ / พิธีกรมืออาชีพรายการโทรทัศน์', 'https://lh3.googleusercontent.com/d/1Bzx7y8z9aBCDEFghijklmnOPQRstuvwY', 'ACTIVE'),
('judge_03', 'คุณศุภสิทธิ์ วงศ์สว่าง', 'กรรมการ / โค้ชผู้เชี่ยวชาญด้านบุคลิกภาพ', 'https://lh3.googleusercontent.com/d/1Bzx7y8z9aBCDEFghijklmnOPQRstuvwZ', 'ACTIVE');

-- ============================================================
-- SEED DATA FOR MC OF ISKKU 2026
-- ============================================================

-- Insert Voting Rounds
INSERT OR IGNORE INTO voting_rounds (id, round_name, description, status) VALUES
('ROUND_1', 'VOTE ROUND 1 : THE ROAD TO TOP 10', 'เลือกผู้เข้าแข่งขันที่คุณต้องการให้เข้าสู่ TOP 10 (คัดเลือก 1 คนจากคะแนนโหวต)', 'OPEN'),
('ROUND_2', 'VOTE ROUND 2 : THE ROAD TO TOP 6', 'เลือกผู้เข้าแข่งขันที่คุณต้องการให้เข้าสู่ TOP 6 (คัดเลือก 1 คนจากคะแนนโหวต)', 'DRAFT');

-- Insert Candidates
INSERT OR IGNORE INTO candidates (id, number, nickname, full_name, major, year, image_url, status) VALUES
('cand_01', 'MC 01', 'มิ้นท์', 'ณิชาภัทร วงศ์สว่าง', 'สาขาวิชาสารสนเทศศาสตร์', 'ปี 3', 'assets/candidates/mc01.jpg', 'ACTIVE'),
('cand_02', 'MC 02', 'ฟ้า', 'ปาริฉัตร จินดาโชติ', 'สาขาวิชานวัตกรรมการจัดการ', 'ปี 2', 'assets/candidates/mc02.jpg', 'ACTIVE'),
('cand_03', 'MC 03', 'บอส', 'กิตติกร อัครเดชา', 'สาขาวิชาเทคโนโลยีสารสนเทศ', 'ปี 4', 'assets/candidates/mc01.jpg', 'ACTIVE'),
('cand_04', 'MC 04', 'เจนนี่', 'ศุภนันท์ เลิศวรคุณ', 'สาขาวิชาวิทยาการคอมพิวเตอร์', 'ปี 3', 'assets/candidates/mc02.jpg', 'ACTIVE'),
('cand_05', 'MC 05', 'คิม', 'ธนทัต ประเสริฐศรี', 'สาขาวิชาการสื่อสารดิจิทัล', 'ปี 2', 'assets/candidates/mc01.jpg', 'ACTIVE'),
('cand_06', 'MC 06', 'พลอย', 'ชัญญา พลอยส่องแสง', 'สาขาวิชารัฐประศาสนศาสตร์', 'ปี 3', 'assets/candidates/mc02.jpg', 'ACTIVE'),
('cand_07', 'MC 07', 'กาย', 'พีรพัฒน์ ชัยวิวัฒน์', 'สาขาวิชาการตลาดดิจิทัล', 'ปี 1', 'assets/candidates/mc01.jpg', 'ACTIVE'),
('cand_08', 'MC 08', 'เบลล์', 'ธนิสรา วโรดม', 'สาขาวิชาภาษาอังกฤษเพื่อการสื่อสาร', 'ปี 4', 'assets/candidates/mc02.jpg', 'ACTIVE'),
('cand_09', 'MC 09', 'โอม', 'วรัญญู จันทรากร', 'สาขาวิชาการจัดการธุรกิจ', 'ปี 2', 'assets/candidates/mc01.jpg', 'ACTIVE'),
('cand_10', 'MC 10', 'มายด์', 'สุชาดา ฤทัยวิเศษ', 'สาขาวิชาการบัญชี', 'ปี 3', 'assets/candidates/mc02.jpg', 'ACTIVE'),
('cand_11', 'MC 11', 'วิน', 'ชยุตม์ ตระกูลไทย', 'สาขาวิชาวิศวกรรมซอฟต์แวร์', 'ปี 2', 'assets/candidates/mc01.jpg', 'ACTIVE'),
('cand_12', 'MC 12', 'แพรวา', 'กุลนันท์ รัตนพร', 'สาขาวิชาสถาปัตยกรรมศาสตร์', 'ปี 1', 'assets/candidates/mc02.jpg', 'ACTIVE');

-- Default Admin User
INSERT OR IGNORE INTO users (id, google_id, email, name, role) VALUES
('admin_user_01', 'google_admin_1001', 'admin@iskku.ac.th', 'Admin MC ISKKU', 'ADMIN');
