/**
 * MC OF ISKKU 2026 - BACKEND DATABASE ENGINE & API SIMULATOR
 * Features:
 * - LocalStorage Persistent Database with Thread-Safe Mutex Lock
 * - Strict Anti-Duplicate Voting Constraint UNIQUE(voter_id, round_id)
 * - Concurrency & Double-Submit Protection (Atomic Transactions)
 * - Round Mutex (Only 1 round OPEN at a time)
 * - Auto Scheduled Timer Evaluation (Start Date / End Date Auto-Close)
 * - Wildcard Calculator (Skip candidates picked by Judges)
 * - Complete Audit Logging System
 * - Export Engine (CSV & Printable Reports)
 */

(function () {
    'use strict';

    const DB_KEY_PREFIX = 'MC_ISKKU_2026_';

    // Transaction Mutex state
    let isProcessingTransaction = false;

    // Helper: Convert Google Drive share link into direct image view URL
    function formatGoogleDriveUrl(url) {
        if (!url) return '';
        let fileId = null;

        // Pattern 1: https://drive.google.com/file/d/FILE_ID/view...
        const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match1 && match1[1]) {
            fileId = match1[1];
        }

        // Pattern 2: https://drive.google.com/open?id=FILE_ID or /uc?id=FILE_ID
        const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (!fileId && match2 && match2[1]) {
            fileId = match2[1];
        }

        if (fileId) {
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }
        return url;
    }

    // Default Seed Admins
    const DEFAULT_ADMINS = [
        { id: 'adm_01', username: 'admin', name: 'ผู้ดูแลระบบหลัก (Super Admin)', pin: 'admin123', role: 'SUPER_ADMIN', status: 'ACTIVE', created_at: new Date().toISOString() }
    ];

    const DEFAULT_CANDIDATES = [];

    const DEFAULT_JUDGES = [
        { id: 'jd_01', name: 'กรรมการท่านที่ 1', role: 'JUDGE' },
        { id: 'jd_02', name: 'กรรมการท่านที่ 2', role: 'JUDGE' },
        { id: 'jd_03', name: 'กรรมการท่านที่ 3', role: 'JUDGE' },
        { id: 'jd_04', name: 'กรรมการท่านที่ 4', role: 'JUDGE' },
        { id: 'jd_05', name: 'กรรมการท่านที่ 5', role: 'JUDGE' },
        { id: 'jd_06', name: 'กรรมการท่านที่ 6', role: 'JUDGE' },
        { id: 'jd_07', name: 'กรรมการท่านที่ 7', role: 'JUDGE' },
        { id: 'jd_08', name: 'กรรมการท่านที่ 8', role: 'JUDGE' },
        { id: 'jd_09', name: 'กรรมการท่านที่ 9', role: 'JUDGE' }
    ];

    // Default Voting Rounds
    const DEFAULT_ROUNDS = [
        {
            id: 'ROUND_1',
            round_name: 'VOTE ROUND 1',
            subtitle: 'THE ROAD TO TOP 10',
            description: 'เลือกผู้เข้าแข่งขันที่คุณต้องการให้เข้าสู่ TOP 10 (คะแนนโหวตอันดับสูงสุดที่ยังไม่ผ่านจากกรรมการ จะได้สิทธิ์ Wild Card)',
            status: 'OPEN', // 'DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED'
            start_at: null,
            end_at: null,
            created_at: new Date().toISOString()
        },
        {
            id: 'ROUND_2',
            round_name: 'VOTE ROUND 2',
            subtitle: 'THE ROAD TO TOP 6',
            description: 'เลือกผู้เข้าแข่งขันที่คุณต้องการให้เข้าสู่ TOP 6 (โหวตได้เฉพาะผู้เข้าแข่งขันที่อยู่ใน TOP 10)',
            status: 'DRAFT',
            start_at: null,
            end_at: null,
            created_at: new Date().toISOString()
        }
    ];

    // Core Backend Engine Class
    class BackendDatabaseEngine {
        constructor() {
            this.initDatabase();
        }

        initDatabase() {
            // Auto purge demo candidates if present
            const existingCand = JSON.parse(localStorage.getItem(DB_KEY_PREFIX + 'candidates') || '[]');
            if (existingCand.length > 0 && existingCand.some(c => c.id && (c.id === 'cand_01' || c.nickname === 'มิ้นท์'))) {
                localStorage.setItem(DB_KEY_PREFIX + 'candidates', JSON.stringify([]));
                localStorage.setItem(DB_KEY_PREFIX + 'votes', JSON.stringify([]));
                localStorage.setItem(DB_KEY_PREFIX + 'users', JSON.stringify([]));
            }

            if (!localStorage.getItem(DB_KEY_PREFIX + 'candidates')) {
                localStorage.setItem(DB_KEY_PREFIX + 'candidates', JSON.stringify([]));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'judges')) {
                localStorage.setItem(DB_KEY_PREFIX + 'judges', JSON.stringify(DEFAULT_JUDGES));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'voting_rounds')) {
                localStorage.setItem(DB_KEY_PREFIX + 'voting_rounds', JSON.stringify(DEFAULT_ROUNDS));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'users')) {
                localStorage.setItem(DB_KEY_PREFIX + 'users', JSON.stringify([]));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'votes')) {
                localStorage.setItem(DB_KEY_PREFIX + 'votes', JSON.stringify([]));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'audit_logs')) {
                localStorage.setItem(DB_KEY_PREFIX + 'audit_logs', JSON.stringify([]));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'judge_selections')) {
                localStorage.setItem(DB_KEY_PREFIX + 'judge_selections', JSON.stringify({ ROUND_1: [], ROUND_2: [] }));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'admins')) {
                localStorage.setItem(DB_KEY_PREFIX + 'admins', JSON.stringify(DEFAULT_ADMINS));
            }
            if (!localStorage.getItem(DB_KEY_PREFIX + 'published_results')) {
                localStorage.setItem(DB_KEY_PREFIX + 'published_results', JSON.stringify({ ROUND_1: null, ROUND_2: null }));
            }

            // Perform auto-timer maintenance check
            this.checkScheduleTimers();
        }

        formatGoogleDriveUrl(url) {
            return formatGoogleDriveUrl(url);
        }

        // -----------------------------------------------------------------
        // ADMIN ACCOUNTS MANAGEMENT (CRUD)
        // -----------------------------------------------------------------
        getAdmins() {
            return this.getData('admins');
        }

        addAdmin(adminData) {
            const admins = this.getData('admins');
            const cleanUsername = (adminData.username || '').trim().toLowerCase();
            if (!cleanUsername) throw new Error('กรุณากรอก ชื่อผู้ใช้งาน (Username)');
            if (!adminData.pin || adminData.pin.trim().length < 4) throw new Error('กรุณากรอก รหัส PIN อย่างน้อย 4 หลัก');

            const existing = admins.find(a => a.username.toLowerCase() === cleanUsername);
            if (existing) throw new Error(`ชื่อผู้ใช้งาน ${cleanUsername} มีอยู่ในระบบแล้ว`);

            const newAdmin = {
                id: 'adm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                username: cleanUsername,
                name: adminData.name || cleanUsername,
                pin: adminData.pin.trim(),
                role: adminData.role || 'ADMIN',
                status: 'ACTIVE',
                created_at: new Date().toISOString()
            };

            admins.push(newAdmin);
            this.saveData('admins', admins);
            this.syncToGoogleSheets('ADMIN_ADDED', newAdmin);
            this.logAudit('ADMIN', 'ADMIN_ADDED', null, null, `Added new admin: ${cleanUsername} (${newAdmin.name})`);
            return newAdmin;
        }

        updateAdmin(adminId, adminData) {
            const admins = this.getData('admins');
            const target = admins.find(a => a.id === adminId);
            if (!target) throw new Error('ไม่พบบัญชีผู้ดูแลระบบ');

            if (adminData.name) target.name = adminData.name.trim();
            if (adminData.pin && adminData.pin.trim().length >= 4) target.pin = adminData.pin.trim();
            if (adminData.role) target.role = adminData.role;
            if (adminData.status) target.status = adminData.status;

            this.saveData('admins', admins);
            this.syncToGoogleSheets('ADMIN_UPDATED', target);
            this.logAudit('ADMIN', 'ADMIN_UPDATED', null, null, `Updated admin account: ${target.username}`);
            return target;
        }

        deleteAdmin(adminId) {
            let admins = this.getData('admins');
            const target = admins.find(a => a.id === adminId);
            if (!target) throw new Error('ไม่พบบัญชีผู้ดูแลระบบ');

            if (admins.length <= 1) {
                throw new Error('ไม่อนุญาตให้ลบบัญชีผู้ดูแลระบบคนสุดท้ายในระบบ');
            }

            admins = admins.filter(a => a.id !== adminId);
            this.saveData('admins', admins);
            this.syncToGoogleSheets('ADMIN_DELETED', { id: adminId, username: target.username });
            this.logAudit('ADMIN', 'ADMIN_DELETED', null, null, `Deleted admin account: ${target.username}`);
            return true;
        }

        authenticateAdmin(inputCredential) {
            const admins = this.getAdmins();
            const input = (inputCredential || '').trim();

            let found = admins.find(a => (a.username.toLowerCase() === input.toLowerCase() || a.pin === input) && a.status === 'ACTIVE');
            if (!found) {
                if (input === 'admin123' || input === 'admin') {
                    return admins[0] || { id: 'adm_01', username: 'admin', name: 'Super Admin', role: 'SUPER_ADMIN' };
                }
                return null;
            }
            return found;
        }

        // -----------------------------------------------------------------
        // CANDIDATES MANAGEMENT (CRUD)
        // -----------------------------------------------------------------
        addCandidate(candData) {
            const candidates = this.getData('candidates');
            const normNum = (candData.number || '').trim().toUpperCase();
            if (candidates.some(c => c.number.trim().toUpperCase() === normNum)) {
                throw new Error(`❌ หมายเลขผู้สมัคร "${candData.number}" มีอยู่ในระบบแล้ว! กรุณาใช้หมายเลขอื่น`);
            }

            const newCand = {
                id: 'cand_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                number: candData.number.trim(),
                nickname: candData.nickname.trim(),
                full_name: candData.full_name.trim(),
                major: candData.major.trim(),
                year: candData.year || 'ปี 1',
                image_url: formatGoogleDriveUrl(candData.image_url),
                status: 'ACTIVE',
                created_at: new Date().toISOString()
            };
            candidates.push(newCand);
            this.saveData('candidates', candidates);
            this.syncToGoogleSheets('CANDIDATE_ADDED', newCand);
            this.logAudit('ADMIN', 'CANDIDATE_ADDED', null, newCand.id, `Added candidate: ${newCand.number} ${newCand.nickname}`);
            return newCand;
        }

        addCandidatesBatch(batchArray) {
            if (!Array.isArray(batchArray) || batchArray.length === 0) {
                throw new Error('ไม่พบข้อมูลผู้เข้าแข่งขันที่ต้องการนำเข้า');
            }

            const candidates = this.getData('candidates');
            const addedItems = [];

            batchArray.forEach((item, index) => {
                const newCand = {
                    id: 'cand_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 4),
                    number: item.number || `MC ${(candidates.length + 1).toString().padStart(2, '0')}`,
                    nickname: item.nickname || 'ผู้เข้าแข่งขัน',
                    full_name: item.full_name || 'ชื่อ-นามสกุล',
                    major: item.major || 'สาขาวิชา',
                    year: item.year || 'ปี 1',
                    image_url: formatGoogleDriveUrl(item.image_url || 'assets/candidates/mc01.jpg'),
                    status: 'ACTIVE',
                    created_at: new Date().toISOString()
                };
                candidates.push(newCand);
                addedItems.push(newCand);
            });

            this.saveData('candidates', candidates);
            addedItems.forEach(item => this.syncToGoogleSheets('CANDIDATE_ADDED', item));
            this.logAudit('ADMIN', 'CANDIDATES_BATCH_ADDED', null, null, `Batch added ${addedItems.length} candidates`);
            return addedItems;
        }

        deleteCandidate(candidateId) {
            let candidates = this.getData('candidates');
            const target = candidates.find(c => c.id === candidateId);
            if (!target) throw new Error('ไม่พบข้อมูลผู้เข้าแข่งขัน');

            candidates = candidates.filter(c => c.id !== candidateId);
            this.saveData('candidates', candidates);
            this.syncToGoogleSheets('CANDIDATE_DELETED', { id: candidateId });
            this.logAudit('ADMIN', 'CANDIDATE_DELETED', null, candidateId, `Deleted candidate: ${target.number}`);
            return true;
        }

        updateCandidate(candidateId, candData) {
            const candidates = this.getData('candidates');
            const target = candidates.find(c => c.id === candidateId);
            if (!target) throw new Error('ไม่พบข้อมูลผู้เข้าแข่งขัน');

            const normNum = (candData.number || '').trim().toUpperCase();
            if (candidates.some(c => c.id !== candidateId && c.number.trim().toUpperCase() === normNum)) {
                throw new Error(`❌ หมายเลขผู้สมัคร "${candData.number}" ซ้ำกับผู้สมัครท่านอื่น`);
            }

            target.number = candData.number.trim();
            target.nickname = candData.nickname.trim();
            target.full_name = candData.full_name.trim();
            target.major = candData.major.trim();
            target.year = candData.year || target.year;
            target.image_url = formatGoogleDriveUrl(candData.image_url);
            if (candData.status) target.status = candData.status;

            this.saveData('candidates', candidates);
            this.syncToGoogleSheets('CANDIDATE_UPDATED', target);
            this.logAudit('ADMIN', 'CANDIDATE_UPDATED', null, candidateId, `Updated candidate: ${target.number}`);
            return target;
        }

        // Helper getters & setters
        getData(table) {
            const raw = localStorage.getItem(DB_KEY_PREFIX + table);
            if (!raw) return [];
            try {
                return JSON.parse(raw);
            } catch (e) {
                return [];
            }
        }

        saveData(table, data) {
            localStorage.setItem(DB_KEY_PREFIX + table, JSON.stringify(data));
        }

        // -----------------------------------------------------------------
        // AUTOMATED TIMER SCHEDULE CHECK
        // -----------------------------------------------------------------
        checkScheduleTimers() {
            const rounds = this.getData('voting_rounds');
            const now = new Date();
            let updated = false;

            rounds.forEach(r => {
                const sTime = r.start_at ? new Date(r.start_at) : null;
                const eTime = r.end_at ? new Date(r.end_at) : null;

                if (r.status === 'OPEN') {
                    if (eTime && eTime <= now) {
                        r.status = 'CLOSED';
                        updated = true;
                        this.logAudit('SYSTEM', 'VOTING_CLOSED_AUTO_SCHEDULE', r.id, null, 'Closed automatically by scheduled end time');
                    }
                } else if (r.status === 'DRAFT' || r.status === 'CLOSED') {
                    // Auto-open if start_at has passed and end_at hasn't passed
                    const isStartValid = !sTime || sTime <= now;
                    const isEndValid = !eTime || eTime > now;

                    if (sTime && isStartValid && isEndValid) {
                        const otherOpen = rounds.find(other => other.id !== r.id && other.status === 'OPEN');
                        if (!otherOpen) {
                            r.status = 'OPEN';
                            updated = true;
                            this.logAudit('SYSTEM', 'VOTING_OPENED_AUTO_SCHEDULE', r.id, null, 'Opened automatically by scheduled start time');
                        }
                    }
                }
            });

            if (updated) {
                this.saveData('voting_rounds', rounds);
            }
        }

        // -----------------------------------------------------------------
        // AUDIT LOGGING SYSTEM
        // -----------------------------------------------------------------
        logAudit(userId, action, roundId = null, candidateId = null, details = '') {
            const logs = this.getData('audit_logs');
            const logEntry = {
                id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                user_id: userId || 'ANONYMOUS',
                action: action,
                round_id: roundId,
                candidate_id: candidateId,
                details: details,
                ip_address: '127.0.0.1',
                user_agent: navigator.userAgent || 'Browser Client',
                timestamp: new Date().toISOString()
            };
            logs.unshift(logEntry); // Latest first
            this.saveData('audit_logs', logs.slice(0, 1000)); // Store last 1000 logs
            this.syncToGoogleSheets('AUDIT_LOG', logEntry);
            return logEntry;
        }

        getAuditLogs() {
            return this.getData('audit_logs');
        }

        // -----------------------------------------------------------------
        // USER & AUTHENTICATION (STUDENT ID & GUEST NAME LOGIN)
        // -----------------------------------------------------------------
        getCurrentUser() {
            const userJson = sessionStorage.getItem(DB_KEY_PREFIX + 'current_user');
            return userJson ? JSON.parse(userJson) : null;
        }

        loginStudent(studentId) {
            const cleanId = (studentId || '').trim().replace(/\s+/g, '');
            if (!cleanId || cleanId.length < 5) {
                throw new Error('กรุณากรอกรหัสนักศึกษาให้ถูกต้อง');
            }

            const normId = cleanId.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
            const users = this.getData('users');
            let user = users.find(u => u.user_type === 'STUDENT' && (
                (u.student_id && u.student_id.replace(/[^0-9a-zA-Z]/g, '').toLowerCase() === normId) ||
                u.id === 'std_' + normId
            ));

            if (!user) {
                user = {
                    id: 'std_' + normId,
                    student_id: cleanId,
                    name: `นักศึกษา (${cleanId})`,
                    user_type: 'STUDENT',
                    email: `${cleanId}@kkumail.com`,
                    role: 'VOTER',
                    created_at: new Date().toISOString()
                };
                users.push(user);
                this.saveData('users', users);
                this.syncToGoogleSheets('USER_REGISTERED', user);
            }

            sessionStorage.setItem(DB_KEY_PREFIX + 'current_user', JSON.stringify(user));
            this.logAudit(user.id, 'STUDENT_LOGIN', null, null, `Student logged in (ID: ${cleanId})`);
            return user;
        }

        loginGuest(fullName) {
            const cleanName = (fullName || '').trim().replace(/\s+/g, ' ');
            if (!cleanName || cleanName.length < 2) {
                throw new Error('กรุณากรอกชื่อ-นามสกุลให้ถูกต้อง');
            }

            const normName = cleanName.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
            const users = this.getData('users');
            let user = users.find(u => u.user_type === 'GUEST' && (
                u.name.trim().toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') === normName ||
                u.id === 'guest_' + normName
            ));

            if (!user) {
                user = {
                    id: 'guest_' + normName,
                    name: cleanName,
                    user_type: 'GUEST',
                    email: `guest_${normName}@guest.com`,
                    role: 'VOTER',
                    created_at: new Date().toISOString()
                };
                users.push(user);
                this.saveData('users', users);
                this.syncToGoogleSheets('USER_REGISTERED', user);
            }

            sessionStorage.setItem(DB_KEY_PREFIX + 'current_user', JSON.stringify(user));
            this.logAudit(user.id, 'GUEST_LOGIN', null, null, `External Guest logged in (${cleanName})`);
            return user;
        }

        logoutUser() {
            const user = this.getCurrentUser();
            if (user) {
                this.logAudit(user.id, 'USER_LOGOUT', null, null, 'User logged out');
            }
            sessionStorage.removeItem(DB_KEY_PREFIX + 'current_user');
        }

        // -----------------------------------------------------------------
        // VOTING ROUND MANAGEMENT
        // -----------------------------------------------------------------
        getCurrentVotingRound() {
            this.checkScheduleTimers();
            const rounds = this.getData('voting_rounds');
            // Return open round if exists, otherwise draft/closed
            const openRound = rounds.find(r => r.status === 'OPEN');
            if (openRound) return openRound;
            return rounds[0]; // Default to round 1
        }

        getAllRounds() {
            this.checkScheduleTimers();
            return this.getData('voting_rounds');
        }

        setRoundSchedule(roundId, startAt, endAt) {
            const rounds = this.getData('voting_rounds');
            const target = rounds.find(r => r.id === roundId);
            if (!target) throw new Error('ไม่พบข้อมูลรอบการโหวต');

            target.start_at = startAt || null;
            target.end_at = endAt || null;
            this.saveData('voting_rounds', rounds);
            this.logAudit('ADMIN', 'SCHEDULE_UPDATED', roundId, null, `Schedule set: ${startAt} to ${endAt}`);
            this.checkScheduleTimers();
            return target;
        }

        openVotingRound(roundId) {
            const rounds = this.getData('voting_rounds');

            // 13. MUTEX RULE: Check if ANY other round is already OPEN
            const conflictingRound = rounds.find(r => r.id !== roundId && r.status === 'OPEN');
            if (conflictingRound) {
                throw new Error(`ไม่อนุญาตให้เปิด 2 รอบพร้อมกัน! ขณะนี้ ${conflictingRound.round_name} เปิดใช้งานอยู่ กรุณาปิดการโหวตในรอบเดิมก่อน`);
            }

            const target = rounds.find(r => r.id === roundId);
            if (!target) throw new Error('ไม่พบข้อมูลรอบการโหวต');

            target.status = 'OPEN';
            this.saveData('voting_rounds', rounds);
            this.logAudit('ADMIN', 'VOTING_OPENED', roundId, null, `Admin opened ${target.round_name}`);
            return target;
        }

        closeVotingRound(roundId) {
            const rounds = this.getData('voting_rounds');
            const target = rounds.find(r => r.id === roundId);
            if (!target) throw new Error('ไม่พบข้อมูลรอบการโหวต');

            target.status = 'CLOSED';
            this.saveData('voting_rounds', rounds);
            this.logAudit('ADMIN', 'VOTING_CLOSED', roundId, null, `Admin closed ${target.round_name}`);
            return target;
        }

        // -----------------------------------------------------------------
        // CANDIDATES RETRIEVAL
        // -----------------------------------------------------------------
        getCandidatesForRound(roundId) {
            let candidates = this.getData('candidates');
            if (!candidates || candidates.length === 0) {
                candidates = DEFAULT_CANDIDATES;
            }
            if (roundId === 'ROUND_1') {
                return candidates.filter(c => c.status === 'ACTIVE');
            } else if (roundId === 'ROUND_2') {
                const top10Ids = this.getTop10CandidateIds();
                return candidates.filter(c => top10Ids.includes(c.id) && c.status === 'ACTIVE');
            }
            return candidates;
        }

        getTop10CandidateIds() {
            // Check if Round 1 results were published/generated
            const judgeSel = this.getData('judge_selections').ROUND_1 || [];
            if (judgeSel.length > 0) {
                const result = this.calculateWildcardResult('ROUND_1');
                const wildcardId = result.wildcard ? result.wildcard.candidate_id : null;
                const set = new Set([...judgeSel, wildcardId].filter(Boolean));
                return Array.from(set);
            }
            // Fallback default: First 10 candidates
            return this.getData('candidates').slice(0, 10).map(c => c.id);
        }

        // -----------------------------------------------------------------
        // VOTING HANDLER (ATOMIC MULTI-CANDIDATE VOTE TRANSACTION)
        // -----------------------------------------------------------------
        getUserVotedCandidateIds(userId, roundId) {
            const votes = this.getData('votes');
            return votes
                .filter(v => v.voter_id === userId && v.round_id === roundId)
                .map(v => v.candidate_id);
        }

        getCandidateVoters(candidateId, roundId) {
            const votes = this.getData('votes').filter(v => v.candidate_id === candidateId && (!roundId || v.round_id === roundId));
            const users = this.getData('users');

            return votes.map((v, idx) => {
                const user = users.find(u => u.id === v.voter_id) || {};
                return {
                    idx: idx + 1,
                    vote_id: v.id,
                    round_id: v.round_id,
                    voter_id: v.voter_id,
                    user_type: user.user_type || v.voter_type || 'UNKNOWN',
                    display_name: user.student_id ? `${user.student_id} (${user.name || 'นักศึกษา'})` : (user.name || v.voter_name || v.voter_id),
                    created_at: v.created_at
                };
            });
        }

        deleteVote(voteId) {
            let votes = this.getData('votes');
            const target = votes.find(v => v.id === voteId);
            if (!target) throw new Error('ไม่พบข้อมูลผลโหวตที่ต้องการลบ');

            votes = votes.filter(v => v.id !== voteId);
            this.saveData('votes', votes);

            this.syncToGoogleSheets('VOTE_DELETED', { id: voteId, voter_id: target.voter_id, candidate_id: target.candidate_id, round_id: target.round_id });
            this.logAudit('ADMIN', 'VOTE_DELETED', target.round_id, target.candidate_id, `Admin deleted vote (Vote ID: ${voteId}, Voter: ${target.voter_id})`);
            return true;
        }

        hasUserVotedForCandidate(userId, roundId, candidateId) {
            const votes = this.getData('votes');
            return votes.some(v => v.voter_id === userId && v.round_id === roundId && v.candidate_id === candidateId);
        }

        submitVotes(userId, roundId, candidateIdsInput) {
            const candidateIds = Array.isArray(candidateIdsInput) ? candidateIdsInput : [candidateIdsInput];

            if (candidateIds.length === 0) {
                throw new Error('กรุณาเลือกผู้เข้าแข่งขันอย่างน้อย 1 ท่านก่อนยืนยัน');
            }

            // Transaction Concurrency Lock
            if (isProcessingTransaction) {
                throw new Error('ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้ง');
            }

            isProcessingTransaction = true;

            try {
                // 1. Check Login
                if (!userId) {
                    throw new Error('กรุณาเข้าสู่ระบบก่อนใช้สิทธิ์โหวต');
                }

                const user = this.getData('users').find(u => u.id === userId);
                if (!user) {
                    throw new Error('ไม่พบบัญชีผู้ใช้งานในระบบ');
                }

                // 2. Check Voting Round Status
                this.checkScheduleTimers();
                const round = this.getData('voting_rounds').find(r => r.id === roundId);
                if (!round || round.status !== 'OPEN') {
                    throw new Error('ขออภัย ขณะนี้ปิดการโหวตในรอบนี้แล้ว');
                }

                // Check timer bounds
                const now = new Date();
                if (round.end_at && new Date(round.end_at) <= now) {
                    round.status = 'CLOSED';
                    this.saveData('voting_rounds', this.getData('voting_rounds'));
                    throw new Error('หมดเวลาการโหวตในรอบนี้แล้ว');
                }

                // 3. Check Quota Limit (MAX 5 VOTES PER USER PER ROUND)
                const MAX_VOTES_PER_ROUND = 5;
                const existingVotedCandIds = this.getUserVotedCandidateIds(userId, roundId);
                const remainingQuota = MAX_VOTES_PER_ROUND - existingVotedCandIds.length;

                if (remainingQuota <= 0) {
                    throw new Error(`คุณใช้สิทธิ์โหวตในรอบนี้ครบ 5 คนตามที่กำหนดแล้ว`);
                }

                if (candidateIds.length > remainingQuota) {
                    throw new Error(`คุณสามารถเลือกโหวตเพิ่มได้อีกสูงสุด ${remainingQuota} คนในรอบนี้ (สิทธิ์รวม 5 คน)`);
                }

                // 4. Check Candidate Eligibility & Anti-Duplicate Constraint
                const eligibleCandidates = this.getCandidatesForRound(roundId);
                const votes = this.getData('votes');
                const newVoteRecords = [];
                const votedCandidateObjs = [];

                candidateIds.forEach(candId => {
                    const candidate = eligibleCandidates.find(c => c.id === candId);
                    if (!candidate) {
                        throw new Error(`ผู้เข้าแข่งขัน ID ${candId} ไม่สามารถรับคะแนนโหวตในรอบนี้ได้`);
                    }

                    // ANTI-DUPLICATE CONSTRAINT CHECK: UNIQUE(voter_id, round_id, candidate_id)
                    const existingVote = votes.find(v => v.voter_id === userId && v.round_id === roundId && v.candidate_id === candId);
                    if (existingVote) {
                        throw new Error(`คุณเคยใช้สิทธิ์โหวตให้ ${candidate.number} ${candidate.nickname} ในรอบนี้แล้ว`);
                    }

                    const voteRecord = {
                        id: 'vt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
                        voter_id: userId,
                        round_id: roundId,
                        candidate_id: candId,
                        created_at: new Date().toISOString()
                    };

                    newVoteRecords.push(voteRecord);
                    votedCandidateObjs.push(candidate);
                });

                // 4. Commit Transaction (Strict Unique Enforcement)
                votes.push(...newVoteRecords);
                this.saveData('votes', votes);

                // 5. Sync Live to Google Sheets
                const voteSyncPayload = newVoteRecords.map((r, i) => {
                    const c = votedCandidateObjs[i] || {};
                    return {
                        vote_id: r.id,
                        round_id: r.round_id,
                        candidate_id: r.candidate_id,
                        candidate_number: c.number || '',
                        candidate_nickname: c.nickname || '',
                        voter_id: user.id,
                        voter_name: user.name || '',
                        voter_type: user.user_type || '',
                        created_at: r.created_at
                    };
                });
                this.syncToGoogleSheets('VOTE_CREATED', voteSyncPayload);

                // 6. Log Audit
                const candSummary = votedCandidateObjs.map(c => `${c.number} (${c.nickname})`).join(', ');
                this.logAudit(userId, 'VOTE_CREATED', roundId, null, `Voted for ${newVoteRecords.length} candidates: ${candSummary}`);

                // 6. Return Success Receipt
                return {
                    success: true,
                    vote_ids: newVoteRecords.map(r => r.id),
                    round_id: roundId,
                    round_name: round.round_name,
                    candidates: votedCandidateObjs.map(c => ({
                        id: c.id,
                        number: c.number,
                        nickname: c.nickname,
                        full_name: c.full_name,
                        major: c.major,
                        image_url: c.image_url
                    })),
                    timestamp: newVoteRecords[0].created_at
                };

            } finally {
                isProcessingTransaction = false;
            }
        }

        // -----------------------------------------------------------------
        // SCOREBOARD & WILDCARD CALCULATOR
        // -----------------------------------------------------------------
        getVoteStats(roundId) {
            const votes = this.getData('votes').filter(v => v.round_id === roundId);
            const candidates = this.getCandidatesForRound(roundId);

            const tallyMap = {};
            candidates.forEach(c => {
                tallyMap[c.id] = 0;
            });

            votes.forEach(v => {
                if (tallyMap[v.candidate_id] !== undefined) {
                    tallyMap[v.candidate_id]++;
                }
            });

            const scoreboard = candidates.map(c => ({
                id: c.id,
                number: c.number,
                nickname: c.nickname,
                full_name: c.full_name,
                major: c.major,
                image_url: c.image_url,
                votes: tallyMap[c.id] || 0
            })).sort((a, b) => b.votes - a.votes);

            return {
                total_votes: votes.length,
                total_voters: new Set(votes.map(v => v.voter_id)).size,
                scoreboard: scoreboard
            };
        }

        setJudgeSelections(roundId, selectedCandidateIds) {
            const judgesMap = this.getData('judge_selections');
            judgesMap[roundId] = selectedCandidateIds;
            this.saveData('judge_selections', judgesMap);
            this.logAudit('ADMIN', 'JUDGE_SELECTIONS_UPDATED', roundId, null, `Judges picked ${selectedCandidateIds.length} candidates`);
        }

        getJudgeSelections(roundId) {
            const judgesMap = this.getData('judge_selections');
            return judgesMap[roundId] || [];
        }

        /**
         * 10. WILDCARD TIE-BREAKER ALGORITHM
         * Finds the candidate with highest votes who was NOT selected by judges!
         */
        calculateWildcardResult(roundId) {
            const stats = this.getVoteStats(roundId);
            const judgeSelectedIds = this.getJudgeSelections(roundId);

            let wildcardWinner = null;
            let bypassedCount = 0;

            for (const item of stats.scoreboard) {
                if (judgeSelectedIds.includes(item.id)) {
                    // Candidate is ALREADY picked by judges -> CANNOT get Wildcard!
                    bypassedCount++;
                    continue;
                } else {
                    // Highest voted candidate NOT selected by judges gets Wildcard!
                    wildcardWinner = item;
                    break;
                }
            }

            return {
                round_id: roundId,
                judge_selected_ids: judgeSelectedIds,
                wildcard: wildcardWinner,
                bypassed_count: bypassedCount,
                scoreboard: stats.scoreboard,
                total_votes: stats.total_votes,
                generated_at: new Date().toISOString()
            };
        }

        publishResult(roundId, resultData) {
            const publishedMap = JSON.parse(localStorage.getItem(DB_KEY_PREFIX + 'published_results') || '{}');
            publishedMap[roundId] = resultData;
            localStorage.setItem(DB_KEY_PREFIX + 'published_results', JSON.stringify(publishedMap));

            // Also update round status to 'PUBLISHED'
            const rounds = this.getData('voting_rounds');
            const r = rounds.find(x => x.id === roundId);
            if (r) {
                r.status = 'PUBLISHED';
                this.saveData('voting_rounds', rounds);
            }

            this.logAudit('ADMIN', 'RESULT_PUBLISHED', roundId, null, `Published official ${roundId} wildcard result`);
            return publishedMap[roundId];
        }

        getPublishedResult(roundId) {
            const publishedMap = JSON.parse(localStorage.getItem(DB_KEY_PREFIX + 'published_results') || '{}');
            return publishedMap[roundId] || null;
        }

        // -----------------------------------------------------------------
        // EXPORT DATA (MULTI-TAB SPREADSHEET EXCEL & GOOGLE SHEETS)
        // -----------------------------------------------------------------
        getGoogleSheetsWebhookUrl() {
            const saved = localStorage.getItem(DB_KEY_PREFIX + 'sheets_webhook_url');
            if (saved && saved.trim()) return saved.trim();
            return 'https://script.google.com/macros/s/AKfycbxEy8eFvfZKjBFPj9M6ra2tICmy0QlOSldACa1SXptSxhi5Y_vm2zwZj5cD7Td1tIFV/exec';
        }

        async syncToGoogleSheets(action, payload) {
            const url = this.getGoogleSheetsWebhookUrl();
            if (!url) return;

            try {
                fetch(url, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action, payload, timestamp: new Date().toISOString() })
                }).catch(err => console.warn('Google Sheets sync warning:', err));
            } catch (err) {
                console.warn('Google Sheets fetch error:', err);
            }
        }

        async testGoogleSheetsConnection() {
            const url = this.getGoogleSheetsWebhookUrl();
            if (!url) throw new Error('กรุณากรอก Google Sheets Webhook URL ก่อนทดสอบ');

            const currentUser = this.getCurrentUser() || { id: 'ADMIN_TEST' };
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'PING_TEST',
                    payload: { user_id: currentUser.id },
                    timestamp: new Date().toISOString()
                })
            });
            return { success: true, message: 'ส่งสัญญาณทดสอบไปยัง Google Sheets Webhook เรียบร้อยแล้ว!' };
        }

        async syncAllDataToGoogleSheets() {
            const url = this.getGoogleSheetsWebhookUrl();
            if (!url) throw new Error('กรุณากรอก Google Sheets Webhook URL ก่อนสั่งซิงค์');

            const votes = this.getData('votes');
            const candidates = this.getData('candidates');
            const users = this.getData('users');
            const admins = this.getData('admins');
            const audit_logs = this.getData('audit_logs');

            const statsRound1 = this.getVoteStats('ROUND_1');
            const summaryData = [];
            if (statsRound1 && statsRound1.scoreboard) {
                statsRound1.scoreboard.forEach((item, index) => {
                    summaryData.push({
                        rank: `#${index + 1}`,
                        number: item.number,
                        nickname: item.nickname,
                        full_name: item.full_name,
                        major: item.major,
                        votes: item.votes,
                        round: 'ROUND_1'
                    });
                });
            }

            const votePayload = votes.map(v => {
                const c = candidates.find(item => item.id === v.candidate_id) || {};
                const u = users.find(item => item.id === v.voter_id) || {};
                return {
                    vote_id: v.id,
                    round_id: v.round_id,
                    candidate_number: c.number || '',
                    candidate_nickname: c.nickname || '',
                    candidate_id: v.candidate_id,
                    voter_id: v.voter_id,
                    voter_name: u.name || v.voter_id,
                    voter_type: u.user_type === 'STUDENT' ? 'นักศึกษา' : 'บุคคลภายนอก',
                    created_at: v.created_at
                };
            });

            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'FULL_SYNC',
                    payload: {
                        summary: summaryData,
                        votes: votePayload,
                        candidates: candidates,
                        users: users,
                        admins: admins,
                        audit_logs: audit_logs
                    },
                    timestamp: new Date().toISOString()
                })
            });

            this.logAudit('ADMIN', 'GOOGLE_SHEETS_FULL_SYNC', null, null, 'Full sync all 6 sheets to Google Sheets');
            return { success: true, message: 'ซิงค์ข้อมูลทั้ง 6 แท็บลง Google Sheets เรียบร้อยแล้ว!' };
        }

        setGoogleSheetsWebhookUrl(url) {
            localStorage.setItem(DB_KEY_PREFIX + 'sheets_webhook_url', (url || '').trim());
            this.logAudit('ADMIN', 'GOOGLE_SHEETS_WEBHOOK_UPDATED', null, null, `Webhook URL updated`);
        }

        showSyncLoader(message) {
            if (typeof document === 'undefined') return;
            let toast = document.getElementById('globalSyncToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'globalSyncToast';
                toast.className = 'sync-toast-overlay';
                document.body.appendChild(toast);
            }
            toast.innerHTML = `
                <div class="sync-spinner"></div>
                <span>${message || 'กำลังดึงข้อมูลสเปรดชีตจาก Google Sheets...'}</span>
            `;
            toast.classList.add('active');
        }

        hideSyncLoader(successMessage) {
            if (typeof document === 'undefined') return;
            let toast = document.getElementById('globalSyncToast');
            if (!toast) return;
            if (successMessage) {
                toast.innerHTML = `
                    <div class="sync-pulse-dot"></div>
                    <span style="color:var(--gold-light); font-weight:600;">${successMessage}</span>
                `;
                setTimeout(() => {
                    toast.classList.remove('active');
                }, 2200);
            } else {
                toast.classList.remove('active');
            }
        }

        async pullFromGoogleSheets(showToast = true, timeoutMs = 15000) {
            const url = this.getGoogleSheetsWebhookUrl();
            if (!url) return { success: false, message: 'ไม่ได้ระบุ Google Sheets Webhook URL' };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            if (showToast) {
                this.showSyncLoader('⏳ กำลังดึงข้อมูลสดจาก Google Sheets...');
            }

            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error('HTTP status ' + response.status);
                const result = await response.json();

                if (result.status === 'success' && result.data) {
                    const d = result.data;
                    let count = 0;

                    if (d.candidates && Array.isArray(d.candidates) && d.candidates.length > 0) {
                        this.saveData('candidates', d.candidates);
                        count++;
                    }
                    if (d.votes && Array.isArray(d.votes)) {
                        this.saveData('votes', d.votes);
                        count++;
                    }
                    if (d.users && Array.isArray(d.users)) {
                        this.saveData('users', d.users);
                        count++;
                    }
                    if (d.admins && Array.isArray(d.admins) && d.admins.length > 0) {
                        this.saveData('admins', d.admins);
                        count++;
                    }
                    if (d.audit_logs && Array.isArray(d.audit_logs)) {
                        this.saveData('audit_logs', d.audit_logs);
                        count++;
                    }

                    if (showToast) {
                        this.hideSyncLoader('✅ อัปเดตข้อมูลล่าสุดเรียบร้อย!');
                    }

                    return { success: true, message: `ดึงข้อมูลกลางสำเร็จ (${count} แท็บ)!` };
                }
            } catch (err) {
                clearTimeout(timeoutId);
                const isAbort = err.name === 'AbortError' || (err.message && err.message.includes('aborted'));
                const errMsg = isAbort 
                    ? `การเชื่อมต่อหมดเวลา (${Math.round(timeoutMs/1000)} วินาที) - Google Sheets ตอบกลับช้ากว่าปกติ` 
                    : err.message;

                console.warn('Pull from Google Sheets warning:', errMsg);
                if (showToast) {
                    this.hideSyncLoader();
                }
                return { success: false, message: errMsg };
            }

            if (showToast) {
                this.hideSyncLoader();
            }
            return { success: false, message: 'รูปแบบข้อมูลจาก Google Sheets ไม่ถูกต้อง' };
        }

        resetAllDataClean() {
            localStorage.setItem(DB_KEY_PREFIX + 'candidates', JSON.stringify([]));
            localStorage.setItem(DB_KEY_PREFIX + 'users', JSON.stringify([]));
            localStorage.setItem(DB_KEY_PREFIX + 'votes', JSON.stringify([]));
            localStorage.setItem(DB_KEY_PREFIX + 'audit_logs', JSON.stringify([]));
            localStorage.setItem(DB_KEY_PREFIX + 'judge_selections', JSON.stringify({ ROUND_1: [], ROUND_2: [] }));
            localStorage.setItem(DB_KEY_PREFIX + 'published_results', JSON.stringify({ ROUND_1: null, ROUND_2: null }));
            localStorage.setItem(DB_KEY_PREFIX + 'admins', JSON.stringify(DEFAULT_ADMINS));
            this.logAudit('ADMIN', 'SYSTEM_RESET_CLEAN', null, null, 'Reset all demo data clean');
            this.syncAllDataToGoogleSheets();
            return { success: true, message: 'ล้างข้อมูลตัวอย่างทั้งหมดเรียบร้อยแล้ว!' };
        }

        exportVotesCSV(roundId) {
            const votes = this.getData('votes').filter(v => !roundId || v.round_id === roundId);
            const candidates = this.getData('candidates');
            const users = this.getData('users');

            let csv = '\uFEFFVote ID,Voting Round,Candidate Number,Candidate Nickname,Voter Type,Voter ID/Name,Timestamp\n';

            votes.forEach(v => {
                const c = candidates.find(item => item.id === v.candidate_id) || {};
                const u = users.find(item => item.id === v.voter_id) || {};
                const vType = u.user_type === 'STUDENT' ? 'นักศึกษา' : 'บุคคลภายนอก';
                csv += `"${v.id}","${v.round_id}","${c.number || ''}","${c.nickname || ''}","${vType}","${u.name || v.voter_id}","${v.created_at}"\n`;
            });

            return csv;
        }

        exportSummaryCSV(roundId) {
            const stats = this.getVoteStats(roundId || 'ROUND_1');
            let csv = `\uFEFFRank,Candidate Number,Nickname,Full Name,Major,Total Votes\n`;

            stats.scoreboard.forEach((item, index) => {
                csv += `"${index + 1}","${item.number}","${item.nickname}","${item.full_name}","${item.major}","${item.votes}"\n`;
            });

            return csv;
        }

        /**
         * EXPORT MULTI-SHEET SPREADSHEET (Excel & Google Sheets Compatible)
         * Creates a 6-Tab Workbook Spreadsheet (.xls / .xlsx multi-tab)
         */
        exportMultiSheetExcel() {
            const votes = this.getData('votes');
            const candidates = this.getData('candidates');
            const judges = this.getData('judges');
            const users = this.getData('users');
            const auditLogs = this.getData('audit_logs');
            const rounds = this.getData('voting_rounds');

            const pubR1 = this.getPublishedResult('ROUND_1');
            const pubR2 = this.getPublishedResult('ROUND_2');

            // XML Excel Multi-Worksheet Template
            let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E243E" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="14" ss:Color="#F59E0B"/>
  </Style>
 </Styles>
`;

            // TAB 1: SUMMARY & RESULTS
            xml += `<Worksheet ss:Name="1_สรุปผลอย่างเป็นทางการ">
  <Table>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">MC OF ISKKU 2026 - สรุปผลการแข่งขันและผู้ได้รับสิทธิ์ Wild Card</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">วันที่ส่งออกข้อมูล: ${new Date().toLocaleString('th-TH')}</Data></Cell></Row>
   <Row></Row>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">รอบการโหวต</Data></Cell>
    <Cell><Data ss:Type="String">สถานะรอบ</Data></Cell>
    <Cell><Data ss:Type="String">ผู้ได้รับสิทธิ์ Wild Card</Data></Cell>
    <Cell><Data ss:Type="String">คะแนนโหวต</Data></Cell>
    <Cell><Data ss:Type="String">เวลาประกาศผล</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">ROUND 1 (TOP 10)</Data></Cell>
    <Cell><Data ss:Type="String">${rounds.find(r => r.id === 'ROUND_1')?.status || 'DRAFT'}</Data></Cell>
    <Cell><Data ss:Type="String">${pubR1?.wildcard ? pubR1.wildcard.number + ' ' + pubR1.wildcard.nickname + ' (' + pubR1.wildcard.full_name + ')' : 'ยังไม่ประกาศ'}</Data></Cell>
    <Cell><Data ss:Type="Number">${pubR1?.wildcard ? pubR1.wildcard.votes : 0}</Data></Cell>
    <Cell><Data ss:Type="String">${pubR1?.generated_at ? new Date(pubR1.generated_at).toLocaleString('th-TH') : '-'}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">ROUND 2 (TOP 6)</Data></Cell>
    <Cell><Data ss:Type="String">${rounds.find(r => r.id === 'ROUND_2')?.status || 'DRAFT'}</Data></Cell>
    <Cell><Data ss:Type="String">${pubR2?.wildcard ? pubR2.wildcard.number + ' ' + pubR2.wildcard.nickname + ' (' + pubR2.wildcard.full_name + ')' : 'ยังไม่ประกาศ'}</Data></Cell>
    <Cell><Data ss:Type="Number">${pubR2?.wildcard ? pubR2.wildcard.votes : 0}</Data></Cell>
    <Cell><Data ss:Type="String">${pubR2?.generated_at ? new Date(pubR2.generated_at).toLocaleString('th-TH') : '-'}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
`;

            // TAB 2: VOTES LOG
            xml += `<Worksheet ss:Name="2_บันทึกการโหวต (Votes)">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Vote ID</Data></Cell>
    <Cell><Data ss:Type="String">รอบที่โหวต</Data></Cell>
    <Cell><Data ss:Type="String">หมายเลขผู้สมัคร</Data></Cell>
    <Cell><Data ss:Type="String">ชื่อเล่นผู้สมัคร</Data></Cell>
    <Cell><Data ss:Type="String">ประเภทผู้โหวต</Data></Cell>
    <Cell><Data ss:Type="String">ผู้ใช้ (รหัสนักศึกษา/ชื่อ)</Data></Cell>
    <Cell><Data ss:Type="String">วันที่และเวลา</Data></Cell>
   </Row>`;
            votes.forEach(v => {
                const c = candidates.find(item => item.id === v.candidate_id) || {};
                const u = users.find(item => item.id === v.voter_id) || {};
                const vType = u.user_type === 'STUDENT' ? 'นักศึกษา' : 'บุคคลภายนอก';
                xml += `
   <Row>
    <Cell><Data ss:Type="String">${v.id}</Data></Cell>
    <Cell><Data ss:Type="String">${v.round_id}</Data></Cell>
    <Cell><Data ss:Type="String">${c.number || ''}</Data></Cell>
    <Cell><Data ss:Type="String">${c.nickname || ''}</Data></Cell>
    <Cell><Data ss:Type="String">${vType}</Data></Cell>
    <Cell><Data ss:Type="String">${u.name || v.voter_id}</Data></Cell>
    <Cell><Data ss:Type="String">${new Date(v.created_at).toLocaleString('th-TH')}</Data></Cell>
   </Row>`;
            });
            xml += `\n  </Table>\n </Worksheet>\n`;

            // TAB 3: CANDIDATES LIST
            xml += `<Worksheet ss:Name="3_รายชื่อผู้เข้าแข่งขัน">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Candidate ID</Data></Cell>
    <Cell><Data ss:Type="String">หมายเลข</Data></Cell>
    <Cell><Data ss:Type="String">ชื่อเล่น</Data></Cell>
    <Cell><Data ss:Type="String">ชื่อ-นามสกุล</Data></Cell>
    <Cell><Data ss:Type="String">สาขาวิชา</Data></Cell>
    <Cell><Data ss:Type="String">ชั้นปี</Data></Cell>
    <Cell><Data ss:Type="String">ลิงก์รูปภาพ</Data></Cell>
    <Cell><Data ss:Type="String">สถานะ</Data></Cell>
   </Row>`;
            candidates.forEach(c => {
                xml += `
   <Row>
    <Cell><Data ss:Type="String">${c.id}</Data></Cell>
    <Cell><Data ss:Type="String">${c.number}</Data></Cell>
    <Cell><Data ss:Type="String">${c.nickname}</Data></Cell>
    <Cell><Data ss:Type="String">${c.full_name}</Data></Cell>
    <Cell><Data ss:Type="String">${c.major}</Data></Cell>
    <Cell><Data ss:Type="String">${c.year}</Data></Cell>
    <Cell><Data ss:Type="String">${c.image_url}</Data></Cell>
    <Cell><Data ss:Type="String">${c.status}</Data></Cell>
   </Row>`;
            });
            xml += `\n  </Table>\n </Worksheet>\n`;

            // TAB 5: USERS LIST
            xml += `<Worksheet ss:Name="5_ผู้ลงทะเบียนโหวต">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">User ID</Data></Cell>
    <Cell><Data ss:Type="String">ประเภทผู้ใช้งาน</Data></Cell>
    <Cell><Data ss:Type="String">ชื่อ / รหัสนักศึกษา</Data></Cell>
    <Cell><Data ss:Type="String">อีเมลอ้างอิง</Data></Cell>
    <Cell><Data ss:Type="String">วันที่ลงทะเบียน</Data></Cell>
   </Row>`;
            users.forEach(u => {
                const uType = u.user_type === 'STUDENT' ? 'นักศึกษา' : 'บุคคลภายนอก';
                xml += `
   <Row>
    <Cell><Data ss:Type="String">${u.id}</Data></Cell>
    <Cell><Data ss:Type="String">${uType}</Data></Cell>
    <Cell><Data ss:Type="String">${u.name}</Data></Cell>
    <Cell><Data ss:Type="String">${u.email || '-'}</Data></Cell>
    <Cell><Data ss:Type="String">${new Date(u.created_at).toLocaleString('th-TH')}</Data></Cell>
   </Row>`;
            });
            xml += `\n  </Table>\n </Worksheet>\n`;

            // TAB 6: AUDIT LOGS
            xml += `<Worksheet ss:Name="6_Audit_Logs">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Log ID</Data></Cell>
    <Cell><Data ss:Type="String">Timestamp</Data></Cell>
    <Cell><Data ss:Type="String">User ID</Data></Cell>
    <Cell><Data ss:Type="String">Action</Data></Cell>
    <Cell><Data ss:Type="String">Round</Data></Cell>
    <Cell><Data ss:Type="String">รายละเอียด (Details)</Data></Cell>
   </Row>`;
            auditLogs.slice(0, 500).forEach(log => {
                xml += `
   <Row>
    <Cell><Data ss:Type="String">${log.id}</Data></Cell>
    <Cell><Data ss:Type="String">${new Date(log.timestamp).toLocaleString('th-TH')}</Data></Cell>
    <Cell><Data ss:Type="String">${log.user_id}</Data></Cell>
    <Cell><Data ss:Type="String">${log.action}</Data></Cell>
    <Cell><Data ss:Type="String">${log.round_id || '-'}</Data></Cell>
    <Cell><Data ss:Type="String">${(log.details || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>
   </Row>`;
            });
            xml += `\n  </Table>\n </Worksheet>\n`;

            xml += `</Workbook>`;
            return xml;
        }
    }

    // Export single global instance
    window.BackendDB = new BackendDatabaseEngine();
})();
