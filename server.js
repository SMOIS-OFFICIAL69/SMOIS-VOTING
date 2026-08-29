/**
 * MC OF ISKKU 2026 - NODE.JS EXPRESS REST API SERVER
 * 
 * Instructions to run:
 * 1. npm install
 * 2. npm start
 * 3. Server runs at http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './')));

// In-Memory SQLite fallback datastore for Node server
let DB = {
    users: [],
    candidates: [
        { id: 'cand_01', number: 'MC 01', nickname: 'มิ้นท์', full_name: 'ณิชาภัทร วงศ์สว่าง', major: 'สาขาวิชาสารสนเทศศาสตร์', year: 'ปี 3', image_url: 'assets/candidates/mc01.jpg', status: 'ACTIVE' },
        { id: 'cand_02', number: 'MC 02', nickname: 'ฟ้า', full_name: 'ปาริฉัตร จินดาโชติ', major: 'สาขาวิชานวัตกรรมการจัดการ', year: 'ปี 2', image_url: 'assets/candidates/mc02.jpg', status: 'ACTIVE' },
        { id: 'cand_03', number: 'MC 03', nickname: 'บอส', full_name: 'กิตติกร อัครเดชา', major: 'สาขาวิชาเทคโนโลยีสารสนเทศ', year: 'ปี 4', image_url: 'assets/candidates/mc01.jpg', status: 'ACTIVE' },
        { id: 'cand_04', number: 'MC 04', nickname: 'เจนนี่', full_name: 'ศุภนันท์ เลิศวรคุณ', major: 'สาขาวิชาวิทยาการคอมพิวเตอร์', year: 'ปี 3', image_url: 'assets/candidates/mc02.jpg', status: 'ACTIVE' },
        { id: 'cand_05', number: 'MC 05', nickname: 'คิม', full_name: 'ธนทัต ประเสริฐศรี', major: 'สาขาวิชาการสื่อสารดิจิทัล', year: 'ปี 2', image_url: 'assets/candidates/mc01.jpg', status: 'ACTIVE' },
        { id: 'cand_06', number: 'MC 06', nickname: 'พลอย', full_name: 'ชัญญา พลอยส่องแสง', major: 'สาขาวิชารัฐประศาสนศาสตร์', year: 'ปี 3', image_url: 'assets/candidates/mc02.jpg', status: 'ACTIVE' }
    ],
    voting_rounds: [
        { id: 'ROUND_1', round_name: 'VOTE ROUND 1', subtitle: 'THE ROAD TO TOP 10', description: 'เลือกผู้เข้าแข่งขันที่คุณต้องการให้เข้าสู่ TOP 10', status: 'OPEN', start_at: null, end_at: null },
        { id: 'ROUND_2', round_name: 'VOTE ROUND 2', subtitle: 'THE ROAD TO TOP 6', description: 'เลือกผู้เข้าแข่งขันที่คุณต้องการให้เข้าสู่ TOP 6', status: 'DRAFT', start_at: null, end_at: null }
    ],
    votes: [],
    audit_logs: [],
    judge_selections: { ROUND_1: [], ROUND_2: [] },
    published_results: { ROUND_1: null, ROUND_2: null }
};

// Middleware: Audit Logger
function logAudit(userId, action, roundId, candidateId, details) {
    DB.audit_logs.unshift({
        id: 'log_' + Date.now(),
        user_id: userId || 'ANONYMOUS',
        action: action,
        round_id: roundId || null,
        candidate_id: candidateId || null,
        details: details || '',
        created_at: new Date().toISOString()
    });
}

// -----------------------------------------------------------------
// API ENDPOINTS (AS SPECIFIED IN REQUIREMENT #27)
// -----------------------------------------------------------------

// POST /auth/login (STUDENT ID & GUEST NAME AUTH)
app.post('/auth/login', (req, res) => {
    const { user_type, student_id, guest_name } = req.body;

    if (user_type === 'STUDENT') {
        const cleanId = (student_id || '').trim().replace(/\s+/g, '');
        if (!cleanId) return res.status(400).json({ error: 'กรุณากรอกรหัสนักศึกษา' });

        const userId = 'std_' + cleanId.replace(/[^a-zA-Z0-9]/g, '_');
        let user = DB.users.find(u => u.id === userId);
        if (!user) {
            user = {
                id: userId,
                student_id: cleanId,
                name: `นักศึกษา (${cleanId})`,
                user_type: 'STUDENT',
                role: 'VOTER'
            };
            DB.users.push(user);
        }
        logAudit(user.id, 'STUDENT_LOGIN', null, null, `Student ID: ${cleanId}`);
        return res.json({ success: true, user });

    } else if (user_type === 'GUEST') {
        const cleanName = (guest_name || '').trim().replace(/\s+/g, ' ');
        if (!cleanName) return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });

        const userId = 'guest_' + cleanName.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '_');
        let user = DB.users.find(u => u.id === userId);
        if (!user) {
            user = {
                id: userId,
                name: cleanName,
                user_type: 'GUEST',
                role: 'VOTER'
            };
            DB.users.push(user);
        }
        logAudit(user.id, 'GUEST_LOGIN', null, null, `Guest Name: ${cleanName}`);
        return res.json({ success: true, user });

    } else {
        return res.status(400).json({ error: 'ประเภทการเข้าสู่ระบบไม่ถูกต้อง' });
    }
});

// GET /voting-round/current
app.get('/voting-round/current', (req, res) => {
    const openRound = DB.voting_rounds.find(r => r.status === 'OPEN') || DB.voting_rounds[0];
    res.json({ success: true, round: openRound });
});

// GET /candidates
app.get('/candidates', (req, res) => {
    const roundId = req.query.round_id || 'ROUND_1';
    let candidates = DB.candidates;
    if (roundId === 'ROUND_2') {
        const top10 = DB.candidates.slice(0, 10);
        candidates = top10;
    }
    res.json({ success: true, candidates });
});

// POST /votes (ATOMIC MULTI-CANDIDATE VOTING - UNIQUE(voter_id, round_id, candidate_id))
app.post('/votes', (req, res) => {
    const { voter_id, round_id, candidate_id, candidate_ids } = req.body;
    const targets = candidate_ids || (candidate_id ? [candidate_id] : []);

    if (!voter_id || !round_id || targets.length === 0) {
        return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน กรุณาเลือกผู้เข้าแข่งขันอย่างน้อย 1 ท่าน' });
    }

    const round = DB.voting_rounds.find(r => r.id === round_id);
    if (!round || round.status !== 'OPEN') {
        return res.status(400).json({ error: 'ขออภัย ขณะนี้ปิดการโหวตแล้ว' });
    }

    const MAX_VOTES = 5;
    const existingUserVotes = DB.votes.filter(v => v.voter_id === voter_id && v.round_id === round_id);
    if (existingUserVotes.length + targets.length > MAX_VOTES) {
        return res.status(400).json({ error: `คุณสามารถโหวตได้สูงสุด 5 คนในรอบนี้ (ใช้สิทธิ์ไปแล้ว ${existingUserVotes.length} คน)` });
    }

    const createdVoteIds = [];

    for (const candId of targets) {
        // CHECK UNIQUE CONSTRAINT: UNIQUE(voter_id, round_id, candidate_id)
        const existing = DB.votes.find(v => v.voter_id === voter_id && v.round_id === round_id && v.candidate_id === candId);
        if (existing) {
            return res.status(409).json({ error: `คุณเคยใช้สิทธิ์โหวตให้ผู้สมัคร ID ${candId} ในรอบนี้แล้ว` });
        }

        const voteRecord = {
            id: 'vt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
            voter_id,
            round_id,
            candidate_id: candId,
            created_at: new Date().toISOString()
        };

        DB.votes.push(voteRecord);
        createdVoteIds.push(voteRecord.id);
    }

    logAudit(voter_id, 'VOTE_CREATED', round_id, null, `Voted for ${targets.length} candidates (${createdVoteIds.join(', ')})`);

    res.json({
        success: true,
        vote_ids: createdVoteIds,
        round_id: round_id,
        timestamp: new Date().toISOString()
    });
});

// GET /votes/status
app.get('/votes/status', (req, res) => {
    const { voter_id, round_id } = req.query;
    const hasVoted = DB.votes.some(v => v.voter_id === voter_id && v.round_id === round_id);
    res.json({ success: true, has_voted: hasVoted });
});

// GET /admin/dashboard
app.get('/admin/dashboard', (req, res) => {
    res.json({
        success: true,
        rounds: DB.voting_rounds,
        total_users: DB.users.length,
        total_votes: DB.votes.length,
        audit_logs: DB.audit_logs.slice(0, 50)
    });
});

// GET /admin/judges
app.get('/admin/judges', (req, res) => {
    res.json({ success: true, judges: DB.judges || [] });
});

// POST /admin/judges
app.post('/admin/judges', (req, res) => {
    const { name, role_title, avatar_url } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อกรรมการ' });
    const newJudge = {
        id: 'judge_' + Date.now(),
        name,
        role_title: role_title || 'กรรมการตัดสิน',
        avatar_url: avatar_url || '',
        status: 'ACTIVE'
    };
    if (!DB.judges) DB.judges = [];
    DB.judges.push(newJudge);
    logAudit('ADMIN', 'JUDGE_ADDED', null, null, `Added judge: ${name}`);
    res.json({ success: true, judge: newJudge });
});

// PUT /admin/judges/:id
app.put('/admin/judges/:id', (req, res) => {
    const { id } = req.params;
    const { name, role_title, avatar_url, status } = req.body;
    if (!DB.judges) DB.judges = [];
    const target = DB.judges.find(j => j.id === id);
    if (!target) return res.status(404).json({ error: 'ไม่พบข้อมูลกรรมการ' });

    if (name) target.name = name;
    if (role_title) target.role_title = role_title;
    if (avatar_url) target.avatar_url = avatar_url;
    if (status) target.status = status;

    logAudit('ADMIN', 'JUDGE_UPDATED', null, null, `Updated judge: ${target.name}`);
    res.json({ success: true, judge: target });
});

// POST /admin/candidates/batch
app.post('/admin/candidates/batch', (req, res) => {
    const { candidates } = req.body;
    if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลผู้เข้าแข่งขันที่ต้องการนำเข้า' });
    }

    const added = [];
    candidates.forEach((c, idx) => {
        const newCand = {
            id: 'cand_' + Date.now() + '_' + idx,
            number: c.number || `MC ${(DB.candidates.length + 1).toString().padStart(2, '0')}`,
            nickname: c.nickname || 'ผู้เข้าแข่งขัน',
            full_name: c.full_name || 'ชื่อ-นามสกุล',
            major: c.major || 'สาขาวิชา',
            year: c.year || 'ปี 1',
            image_url: c.image_url || 'assets/candidates/mc01.jpg',
            status: 'ACTIVE'
        };
        DB.candidates.push(newCand);
        added.push(newCand);
    });

    logAudit('ADMIN', 'CANDIDATES_BATCH_ADDED', null, null, `Batch added ${added.length} candidates via API`);
    res.json({ success: true, count: added.length, candidates: added });
});

// POST /admin/round/open (MUTEX RULE ENFORCEMENT)
app.post('/admin/round/open', (req, res) => {
    const { round_id } = req.body;
    const existingOpen = DB.voting_rounds.find(r => r.id !== round_id && r.status === 'OPEN');
    if (existingOpen) {
        return res.status(400).json({ error: `ห้ามเปิด 2 รอบพร้อมกัน! ขณะนี้ ${existingOpen.round_name} เปิดอยู่ออก` });
    }
    const target = DB.voting_rounds.find(r => r.id === round_id);
    if (!target) return res.status(404).json({ error: 'ไม่พบรอบการโหวต' });
    target.status = 'OPEN';
    logAudit('ADMIN', 'VOTING_OPENED', round_id, null, 'Opened via API');
    res.json({ success: true, round: target });
});

// POST /admin/round/close
app.post('/admin/round/close', (req, res) => {
    const { round_id } = req.body;
    const target = DB.voting_rounds.find(r => r.id === round_id);
    if (!target) return res.status(404).json({ error: 'ไม่พบรอบการโหวต' });
    target.status = 'CLOSED';
    logAudit('ADMIN', 'VOTING_CLOSED', round_id, null, 'Closed via API');
    res.json({ success: true, round: target });
});

// POST /admin/results/generate (WILDCARD CALCULATOR)
app.post('/admin/results/generate', (req, res) => {
    const { round_id, judge_picks } = req.body;
    const judgeSelectedIds = judge_picks || [];
    
    // Tally votes
    const votes = DB.votes.filter(v => v.round_id === round_id);
    const tally = {};
    DB.candidates.forEach(c => tally[c.id] = 0);
    votes.forEach(v => { if (tally[v.candidate_id] !== undefined) tally[v.candidate_id]++; });

    const sorted = DB.candidates.map(c => ({
        ...c, votes: tally[c.id] || 0
    })).sort((a, b) => b.votes - a.votes);

    // Find highest voted NOT in judge_picks
    let wildcard = null;
    let bypassed = 0;
    for (const item of sorted) {
        if (judgeSelectedIds.includes(item.id)) {
            bypassed++;
        } else {
            wildcard = item;
            break;
        }
    }

    const result = { round_id, wildcard, bypassed_count: bypassed, scoreboard: sorted, generated_at: new Date().toISOString() };
    logAudit('ADMIN', 'RESULT_GENERATED', round_id, wildcard ? wildcard.id : null, 'Generated via API');
    res.json({ success: true, result });
});

// POST /admin/results/publish
app.post('/admin/results/publish', (req, res) => {
    const { round_id, result } = req.body;
    DB.published_results[round_id] = result;
    const r = DB.voting_rounds.find(x => x.id === round_id);
    if (r) r.status = 'PUBLISHED';
    logAudit('ADMIN', 'RESULT_PUBLISHED', round_id, null, 'Published via API');
    res.json({ success: true, published: DB.published_results[round_id] });
});

// Serve HTML pages for routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'results.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server conditionally
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🎤 MC OF ISKKU 2026 Server Running at http://localhost:${PORT}`);
        console.log(`====================================================`);
    });
}

module.exports = app;
