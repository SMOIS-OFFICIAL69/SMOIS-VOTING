/**
 * MC OF ISKKU 2026 - ADMIN DASHBOARD CONTROLLER
 */

(function () {
    'use strict';

    let activeConfirmCallback = null;
    function formatDateTimeLocal(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // DOM Elements
    const adminAuthModal = document.getElementById('adminAuthModal');
    const adminPinInput = document.getElementById('adminPinInput');
    const btnAdminLogin = document.getElementById('btnAdminLogin');

    // Status Elements
    const admCurrentRound = document.getElementById('admCurrentRound');
    const admStatusBadge = document.getElementById('admStatusBadge');
    const admUsersCount = document.getElementById('admUsersCount');
    const admVotersCount = document.getElementById('admVotersCount');
    const admTotalVotes = document.getElementById('admTotalVotes');

    // Round Control Buttons
    const btnOpenRound1 = document.getElementById('btnOpenRound1');
    const btnCloseRound1 = document.getElementById('btnCloseRound1');
    const btnOpenRound2 = document.getElementById('btnOpenRound2');
    const btnCloseRound2 = document.getElementById('btnCloseRound2');

    // Schedule Inputs
    const schRoundSelect = document.getElementById('schRoundSelect');
    const schStartAt = document.getElementById('schStartAt');
    const schEndAt = document.getElementById('schEndAt');
    const btnSaveSchedule = document.getElementById('btnSaveSchedule');



    // Candidates Management Elements
    const btnOpenAddCandidateModal = document.getElementById('btnOpenAddCandidateModal');
    const btnOpenBatchModal = document.getElementById('btnOpenBatchModal');
    const candidatesTableBody = document.getElementById('candidatesTableBody');
    const candidateModal = document.getElementById('candidateModal');
    const candidateModalTitle = document.getElementById('candidateModalTitle');
    const candidateForm = document.getElementById('candidateForm');
    const candidateEditId = document.getElementById('candidateEditId');
    const candNumInput = document.getElementById('candNumInput');
    const candNicknameInput = document.getElementById('candNicknameInput');
    const candFullNameInput = document.getElementById('candFullNameInput');
    const candMajorInput = document.getElementById('candMajorInput');
    const candYearInput = document.getElementById('candYearInput');
    const candImageInput = document.getElementById('candImageInput');
    const btnCancelCandModal = document.getElementById('btnCancelCandModal');

    // Admin User Management Elements
    const btnOpenAddAdminModal = document.getElementById('btnOpenAddAdminModal');
    const adminsTableBody = document.getElementById('adminsTableBody');
    const adminUserModal = document.getElementById('adminUserModal');
    const adminUserModalTitle = document.getElementById('adminUserModalTitle');
    const adminUserForm = document.getElementById('adminUserForm');
    const adminUserEditId = document.getElementById('adminUserEditId');
    const admUsernameInput = document.getElementById('admUsernameInput');
    const admNameInput = document.getElementById('admNameInput');
    const admPinInput = document.getElementById('admPinInput');
    const admRoleSelect = document.getElementById('admRoleSelect');
    const btnCancelAdminUserModal = document.getElementById('btnCancelAdminUserModal');

    // Quick Batch Elements
    const quickBatchModal = document.getElementById('quickBatchModal');
    const quickBatchForm = document.getElementById('quickBatchForm');
    const batchInputText = document.getElementById('batchInputText');
    const btnQuickPresetDemo = document.getElementById('btnQuickPresetDemo');
    const btnCancelBatchModal = document.getElementById('btnCancelBatchModal');

    // Scoreboard & Calculator
    const calcRoundSelect = document.getElementById('calcRoundSelect');
    const scoreboardTableBody = document.getElementById('scoreboardTableBody');
    const btnGenerateResult = document.getElementById('btnGenerateResult');
    const btnPublishResult = document.getElementById('btnPublishResult');
    const wildcardResultBox = document.getElementById('wildcardResultBox');
    const wcWinnerTitle = document.getElementById('wcWinnerTitle');
    const wcBypassedNote = document.getElementById('wcBypassedNote');

    // Audit Logs
    const auditLogsTableBody = document.getElementById('auditLogsTableBody');

    // Export Buttons
    const btnExportVotesCsv = document.getElementById('btnExportVotesCsv');
    const btnExportSummaryCsv = document.getElementById('btnExportSummaryCsv');
    const btnPrintReport = document.getElementById('btnPrintReport');

    // Confirmation Modal
    const adminConfirmModal = document.getElementById('adminConfirmModal');
    const admConfirmTitle = document.getElementById('admConfirmTitle');
    const admConfirmDesc = document.getElementById('admConfirmDesc');
    const btnAdmCancel = document.getElementById('btnAdmCancel');
    const btnAdmConfirm = document.getElementById('btnAdmConfirm');

    document.addEventListener('DOMContentLoaded', () => {
        setupAdminAuth();
    });

    function setupAdminAuth() {
        const adminSession = sessionStorage.getItem('MC_ISKKU_ADMIN_AUTH');
        if (adminSession === 'TRUE') {
            adminAuthModal.classList.remove('active');
            initAdminDashboard();
        } else {
            adminAuthModal.classList.add('active');
        }

        btnAdminLogin.addEventListener('click', () => {
            const input = adminPinInput.value.trim();
            const authAdmin = window.BackendDB.authenticateAdmin(input);
            if (authAdmin) {
                sessionStorage.setItem('MC_ISKKU_ADMIN_AUTH', 'TRUE');
                adminAuthModal.classList.remove('active');
                window.BackendDB.logAudit(authAdmin.id, 'ADMIN_LOGIN', null, null, `Admin authenticated: ${authAdmin.username}`);
                initAdminDashboard();
            } else {
                alert('ชื่อผู้ใช้งานหรือรหัส PIN ไม่ถูกต้อง!');
            }
        });
    }

    function initAdminDashboard() {
        refreshDashboardStats();
        setupControlListeners();
        setupAdminsManagementListeners();
        setupCandidatesManagementListeners();
        setupCalculatorListeners();
        setupExportListeners();

        // Real-time live auto refresh every 3 seconds for stats & tables
        if (!window.adminAutoRefreshInterval) {
            window.adminAutoRefreshInterval = setInterval(() => {
                refreshDashboardStats();
            }, 3000);
        }

        window.addEventListener('storage', () => {
            refreshDashboardStats();
        });

        // Background non-blocking sync if Webhook URL exists
        if (window.BackendDB && window.BackendDB.getGoogleSheetsWebhookUrl()) {
            window.BackendDB.pullFromGoogleSheets(true).then(res => {
                if (res && res.success) {
                    refreshDashboardStats();
                }
            });
        }
    }

    // -----------------------------------------------------------------
    // REFRESH DASHBOARD STATS & TABLES
    // -----------------------------------------------------------------
    function refreshDashboardStats() {
        const rounds = window.BackendDB.getAllRounds();
        const currentRound = window.BackendDB.getCurrentVotingRound();
        const stats = window.BackendDB.getVoteStats(currentRound.id);
        const allUsers = window.BackendDB.getData('users');
        const allVotes = window.BackendDB.getData('votes');

        admCurrentRound.innerText = currentRound.round_name;

        if (currentRound.status === 'OPEN') {
            admStatusBadge.innerHTML = `<span class="badge-open"><span class="pulse-dot"></span> OPEN</span>`;
        } else if (currentRound.status === 'PUBLISHED') {
            admStatusBadge.innerHTML = `<span class="badge-open" style="background:rgba(6,182,212,0.15); color:#22d3ee; border-color:rgba(6,182,212,0.4);">PUBLISHED</span>`;
        } else {
            admStatusBadge.innerHTML = `<span class="badge-closed">CLOSED</span>`;
        }

        admUsersCount.innerText = `${allUsers.length} คน`;
        admVotersCount.innerText = `${stats.total_voters} คน`;
        admTotalVotes.innerText = `${stats.total_votes} คะแนน (รวมทั้งหมด: ${allVotes.length})`;

        if (document.activeElement !== schStartAt && document.activeElement !== schEndAt) {
            const targetRound = rounds.find(r => r.id === schRoundSelect.value);
            if (targetRound) {
                schStartAt.value = formatDateTimeLocal(targetRound.start_at);
                schEndAt.value = formatDateTimeLocal(targetRound.end_at);
            }
        }

        renderAdminsTable();
        renderCandidatesTable();
        renderScoreboardTable();
        renderAuditLogsTable();
    }



    // -----------------------------------------------------------------
    // ADMIN USER MANAGEMENT HANDLERS
    // -----------------------------------------------------------------
    function setupAdminsManagementListeners() {
        if (!btnOpenAddAdminModal) return;

        btnOpenAddAdminModal.addEventListener('click', () => {
            adminUserModalTitle.innerText = "เพิ่มผู้ดูแลระบบคนใหม่";
            adminUserEditId.value = "";
            admUsernameInput.value = "";
            admUsernameInput.readOnly = false;
            admNameInput.value = "";
            admPinInput.value = "";
            admRoleSelect.value = "ADMIN";
            adminUserModal.classList.add('active');
        });

        btnCancelAdminUserModal.addEventListener('click', () => {
            adminUserModal.classList.remove('active');
        });

        adminUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const editId = adminUserEditId.value;
            const adminData = {
                username: admUsernameInput.value.trim(),
                name: admNameInput.value.trim(),
                pin: admPinInput.value.trim(),
                role: admRoleSelect.value
            };

            try {
                if (editId) {
                    window.BackendDB.updateAdmin(editId, adminData);
                    alert('อัปเดตข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว');
                } else {
                    window.BackendDB.addAdmin(adminData);
                    alert('เพิ่มผู้ดูแลระบบคนใหม่เรียบร้อยแล้ว');
                }
                adminUserModal.classList.remove('active');
                refreshDashboardStats();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    function renderAdminsTable() {
        if (!adminsTableBody) return;
        const admins = window.BackendDB.getAdmins();
        adminsTableBody.innerHTML = '';

        if (admins.length === 0) {
            adminsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">ยังไม่มีข้อมูลผู้ดูแลระบบ</td></tr>`;
            return;
        }

        admins.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong style="color:var(--accent-cyan); font-family:monospace;">@${escapeHtml(a.username)}</strong></td>
                <td><div style="font-weight:700;">${escapeHtml(a.name || a.username)}</div></td>
                <td><span class="logo-badge" style="background:rgba(139,92,246,0.2); color:#c4b5fd;">${escapeHtml(a.role || 'ADMIN')}</span></td>
                <td><span style="font-family:monospace; color:var(--gold-light);">••••${a.pin ? a.pin.slice(-2) : ''}</span></td>
                <td><span class="badge-open" style="font-size:0.75rem; padding:0.15rem 0.5rem;">${a.status || 'ACTIVE'}</span></td>
                <td style="text-align:center;">
                    <button class="btn-primary btn-edit-admin" style="font-size:0.8rem; padding:0.3rem 0.6rem; margin-right:0.3rem;">✏️ แก้ไข</button>
                    <button class="btn-danger btn-del-admin" style="font-size:0.8rem; padding:0.3rem 0.6rem;">🗑️ ลบ</button>
                </td>
            `;

            tr.querySelector('.btn-edit-admin').addEventListener('click', () => {
                adminUserModalTitle.innerText = "แก้ไขข้อมูลผู้ดูแลระบบ";
                adminUserEditId.value = a.id;
                admUsernameInput.value = a.username;
                admUsernameInput.readOnly = true;
                admNameInput.value = a.name;
                admPinInput.value = a.pin;
                admRoleSelect.value = a.role || 'ADMIN';
                adminUserModal.classList.add('active');
            });

            tr.querySelector('.btn-del-admin').addEventListener('click', () => {
                if (confirm(`คุณต้องการลบบัญชีแอดมิน @${a.username} ใช่หรือไม่?`)) {
                    try {
                        window.BackendDB.deleteAdmin(a.id);
                        refreshDashboardStats();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });

            adminsTableBody.appendChild(tr);
        });
    }

    // -----------------------------------------------------------------
    // CANDIDATES MANAGEMENT HANDLERS
    // -----------------------------------------------------------------
    function setupCandidatesManagementListeners() {
        btnOpenAddCandidateModal.addEventListener('click', () => {
            candidateModalTitle.innerText = "เพิ่มผู้เข้าแข่งขันคนใหม่";
            candidateEditId.value = "";
            candNumInput.value = `MC ${(window.BackendDB.getData('candidates').length + 1).toString().padStart(2, '0')}`;
            candNicknameInput.value = "";
            candFullNameInput.value = "";
            candMajorInput.value = "";
            candYearInput.value = "ปี 1";
            candImageInput.value = "";
            candidateModal.classList.add('active');
        });

        btnCancelCandModal.addEventListener('click', () => {
            candidateModal.classList.remove('active');
        });

        // Quick Batch Add Modal Listeners
        btnOpenBatchModal.addEventListener('click', () => {
            batchInputText.value = "";
            quickBatchModal.classList.add('active');
        });

        btnCancelBatchModal.addEventListener('click', () => {
            quickBatchModal.classList.remove('active');
        });

        btnQuickPresetDemo.addEventListener('click', () => {
            const startNum = window.BackendDB.getData('candidates').length + 1;
            const pad = (n) => `MC ${n.toString().padStart(2, '0')}`;

            const demoLines = [
                `${pad(startNum)} | ก้อง | กิตติพงษ์ สุขเสริฐ | สาขาวิชาสารสนเทศศาสตร์ | ปี 3 | https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80`,
                `${pad(startNum + 1)} | เมย์ | เมธาวี จิตมั่น | สาขาวิชาเทคโนโลยีสารสนเทศ | ปี 2 | https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80`,
                `${pad(startNum + 2)} | ท็อป | ณัฐภัทร วรโชติ | สาขาวิชาการสื่อสารดิจิทัล | ปี 4 | https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80`,
                `${pad(startNum + 3)} | น้ำหวาน | พรรณทิพา วิจิตร | สาขาวิชาวิทยาการคอมพิวเตอร์ | ปี 1 | https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
                `${pad(startNum + 4)} | อาร์ต | พีรพล สุทธิประภา | สาขาวิชานวัตกรรมการจัดการ | ปี 3 | https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80`
            ];

            batchInputText.value = demoLines.join('\n');
        });

        quickBatchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = batchInputText.value.trim();
            if (!text) return;

            const lines = text.split('\n');
            const parsedList = [];

            lines.forEach(line => {
                const cleanLine = line.trim();
                if (!cleanLine) return;

                // Support separators: | , or tab
                let parts = cleanLine.split('|');
                if (parts.length < 2) parts = cleanLine.split(',');
                if (parts.length < 2) parts = cleanLine.split('\t');

                if (parts.length >= 2) {
                    parsedList.push({
                        number: parts[0] ? parts[0].trim() : '',
                        nickname: parts[1] ? parts[1].trim() : '',
                        full_name: parts[2] ? parts[2].trim() : '',
                        major: parts[3] ? parts[3].trim() : 'สาขาวิชาทั่วไป',
                        year: parts[4] ? parts[4].trim() : 'ปี 1',
                        image_url: parts[5] ? parts[5].trim() : 'assets/candidates/mc01.jpg'
                    });
                }
            });

            if (parsedList.length === 0) {
                alert('ไม่พบรูปแบบข้อมูลที่ถูกต้อง กรุณาใช้เครื่องหมาย | คั่นข้อมูล');
                return;
            }

            try {
                const added = window.BackendDB.addCandidatesBatch(parsedList);
                alert(`⚡ นำเข้าข้อมูลผู้เข้าแข่งขันสำเร็จเรียบร้อยแล้ว ${added.length} ท่าน!`);
                quickBatchModal.classList.remove('active');
                refreshDashboardStats();
            } catch (err) {
                alert(err.message);
            }
        });

        candidateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const editId = candidateEditId.value;
            const candData = {
                number: candNumInput.value.trim(),
                nickname: candNicknameInput.value.trim(),
                full_name: candFullNameInput.value.trim(),
                major: candMajorInput.value.trim(),
                year: candYearInput.value.trim(),
                image_url: candImageInput.value.trim()
            };

            try {
                if (editId) {
                    window.BackendDB.updateCandidate(editId, candData);
                    alert('แก้ไขข้อมูลผู้เข้าแข่งขันเรียบร้อยแล้ว');
                } else {
                    window.BackendDB.addCandidate(candData);
                    alert('เพิ่มผู้เข้าแข่งขันคนใหม่เรียบร้อยแล้ว');
                }
                candidateModal.classList.remove('active');
                refreshDashboardStats();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    function renderCandidatesTable() {
        const candidates = window.BackendDB.getData('candidates');
        candidatesTableBody.innerHTML = '';

        if (candidates.length === 0) {
            candidatesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">ยังไม่มีข้อมูลผู้เข้าแข่งขัน</td></tr>`;
            return;
        }

        candidates.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <img src="${c.image_url}" alt="${escapeHtml(c.nickname)}" style="width:40px; height:40px; border-radius:var(--radius-sm); object-fit:cover; border:1px solid var(--gold-primary);" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'">
                </td>
                <td><span class="logo-badge" style="background:rgba(255,255,255,0.1); color:var(--gold-light);">${escapeHtml(c.number)}</span></td>
                <td><div style="font-weight:700;">${escapeHtml(c.nickname)}</div></td>
                <td>${escapeHtml(c.full_name)}</td>
                <td><span style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(c.major)} (${escapeHtml(c.year)})</span></td>
                <td style="text-align:center;">
                    <button class="btn-primary btn-edit-cand" style="font-size:0.8rem; padding:0.3rem 0.6rem; margin-right:0.3rem;">✏️ แก้ไข</button>
                    <button class="btn-danger btn-del-cand" style="font-size:0.8rem; padding:0.3rem 0.6rem;">🗑️ ลบ</button>
                </td>
            `;

            tr.querySelector('.btn-edit-cand').addEventListener('click', () => {
                candidateModalTitle.innerText = "แก้ไขข้อมูลผู้เข้าแข่งขัน";
                candidateEditId.value = c.id;
                candNumInput.value = c.number;
                candNicknameInput.value = c.nickname;
                candFullNameInput.value = c.full_name;
                candMajorInput.value = c.major;
                candYearInput.value = c.year;
                candImageInput.value = c.image_url;
                candidateModal.classList.add('active');
            });

            tr.querySelector('.btn-del-cand').addEventListener('click', () => {
                if (confirm(`คุณต้องการลบข้อมูลผู้เข้าแข่งขัน ${c.number} (${c.nickname}) ใช่หรือไม่?`)) {
                    try {
                        window.BackendDB.deleteCandidate(c.id);
                        alert(`🗑️ ลบผู้เข้าแข่งขัน ${c.number} (${c.nickname}) เรียบร้อยแล้ว`);
                        refreshDashboardStats();
                    } catch (err) {
                        alert('❌ ' + err.message);
                    }
                }
            });

            candidatesTableBody.appendChild(tr);
        });
    }

    // -----------------------------------------------------------------
    // ROUND CONTROL ACTIONS (WITH CONFIRMATION & MUTEX ENFORCEMENT)
    // -----------------------------------------------------------------
    function setupControlListeners() {
        btnOpenRound1.addEventListener('click', () => {
            promptAdminConfirm(
                'คุณกำลังจะเปิด VOTE ROUND 1',
                'หลังจากเปิดแล้ว ผู้ชมทั่วไปจะสามารถเข้ามาใช้สิทธิ์โหวตในรอบที่ 1 ได้ ยืนยันหรือไม่?',
                () => {
                    try {
                        window.BackendDB.openVotingRound('ROUND_1');
                        refreshDashboardStats();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            );
        });

        btnCloseRound1.addEventListener('click', () => {
            promptAdminConfirm(
                'คุณกำลังจะปิด VOTE ROUND 1',
                'หลังจากปิดแล้ว ผู้ใช้จะไม่สามารถโหวตเพิ่มในรอบที่ 1 ได้ ยืนยันหรือไม่?',
                () => {
                    try {
                        window.BackendDB.closeVotingRound('ROUND_1');
                        refreshDashboardStats();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            );
        });

        btnOpenRound2.addEventListener('click', () => {
            promptAdminConfirm(
                'คุณกำลังจะเปิด VOTE ROUND 2',
                'ระบบจะเปิดให้โหวตเฉพาะผู้เข้าแข่งขัน TOP 10 เท่านั้น ยืนยันหรือไม่?',
                () => {
                    try {
                        window.BackendDB.openVotingRound('ROUND_2');
                        refreshDashboardStats();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            );
        });

        btnCloseRound2.addEventListener('click', () => {
            promptAdminConfirm(
                'คุณกำลังจะปิด VOTE ROUND 2',
                'หลังจากปิดแล้ว ผู้ใช้จะไม่สามารถโหวตเพิ่มในรอบที่ 2 ได้ ยืนยันหรือไม่?',
                () => {
                    try {
                        window.BackendDB.closeVotingRound('ROUND_2');
                        refreshDashboardStats();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            );
        });

        schRoundSelect.addEventListener('change', () => {
            refreshDashboardStats();
        });

        btnSaveSchedule.addEventListener('click', (e) => {
            e.preventDefault();
            const roundId = schRoundSelect.value;
            const rawStart = schStartAt.value;
            const rawEnd = schEndAt.value;

            if (!rawStart || !rawEnd) {
                alert('⚠️ กรุณากรอกวัน-เวลาเริ่มต้น และวัน-เวลาสิ้นสุดให้ครบถ้วน');
                return;
            }

            const startDate = new Date(rawStart);
            const endDate = new Date(rawEnd);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                alert('⚠️ รูปแบบวัน-เวลาไม่ถูกต้อง กรุณาเลือกใหม่จากปฏิทิน');
                return;
            }

            if (endDate.getTime() <= startDate.getTime()) {
                alert('⚠️ เวลาสิ้นสุด (End Time) ต้องมาหลังเวลาเริ่มต้น (Start Time) เสมอ');
                return;
            }

            const startVal = startDate.toISOString();
            const endVal = endDate.toISOString();

            try {
                window.BackendDB.setRoundSchedule(roundId, startVal, endVal);
                alert(`✅ บันทึกเวลาเปิด-ปิดสำหรับ ${roundId} เรียบร้อยแล้ว!\n• เวลาเริ่มต้น: ${startDate.toLocaleString('th-TH')}\n• เวลาสิ้นสุด: ${endDate.toLocaleString('th-TH')}`);
                refreshDashboardStats();
            } catch (err) {
                alert('❌ ' + err.message);
            }
        });

        const btnCancelSchedule = document.getElementById('btnCancelSchedule');
        if (btnCancelSchedule) {
            btnCancelSchedule.addEventListener('click', (e) => {
                e.preventDefault();
                const roundId = schRoundSelect.value;
                if (confirm(`คุณต้องการยกเลิกการตั้งเวลาเปิด-ปิดอัตโนมัติสำหรับรอบ ${roundId} ใช่หรือไม่?`)) {
                    try {
                        window.BackendDB.setRoundSchedule(roundId, null, null);
                        schStartAt.value = "";
                        schEndAt.value = "";
                        alert(`✅ ยกเลิกการตั้งเวลาสำหรับรอบ ${roundId} และอัปเดตลง Google Sheets เรียบร้อยแล้ว`);
                        refreshDashboardStats();
                    } catch (err) {
                        alert('❌ ' + err.message);
                    }
                }
            });
        }

        btnAdmCancel.addEventListener('click', () => {
            adminConfirmModal.classList.remove('active');
            activeConfirmCallback = null;
        });

        btnAdmConfirm.addEventListener('click', () => {
            if (typeof activeConfirmCallback === 'function') {
                activeConfirmCallback();
            }
            adminConfirmModal.classList.remove('active');
            activeConfirmCallback = null;
        });
    }

    function promptAdminConfirm(title, desc, onConfirm) {
        admConfirmTitle.innerText = title;
        admConfirmDesc.innerText = desc;
        activeConfirmCallback = onConfirm;
        adminConfirmModal.classList.add('active');
    }

    // -----------------------------------------------------------------
    // SCOREBOARD & WILDCARD CALCULATOR
    // -----------------------------------------------------------------
    function setupCalculatorListeners() {
        calcRoundSelect.addEventListener('change', (e) => {
            selectedCalcRound = e.target.value;
            renderScoreboardTable();
            wildcardResultBox.style.display = 'none';
        });

        btnGenerateResult.addEventListener('click', () => {
            const roundId = calcRoundSelect.value;
            const result = window.BackendDB.calculateWildcardResult(roundId);

            if (!result.wildcard) {
                alert('ไม่พบผู้ชนะ Wild Card สำหรับรอบนี้');
                return;
            }

            const wc = result.wildcard;
            const roundName = roundId === 'ROUND_1' ? 'TOP 10' : 'TOP 6';

            wcWinnerTitle.innerText = `👑 ${roundName} WILD CARD : ${wc.number} ${wc.nickname} (${wc.full_name}) - ${wc.votes.toLocaleString()} คะแนน`;
            wcBypassedNote.innerText = `(ระบบข้ามผู้สมัครที่มีคะแนนโหวตสูงกว่า ${result.bypassed_count} ท่านที่ได้รับคัดเลือกจากกรรมการแล้ว)`;

            wildcardResultBox.style.display = 'block';
            wildcardResultBox.scrollIntoView({ behavior: 'smooth' });

            window.BackendDB.logAudit('ADMIN', 'GENERATE_RESULT', roundId, wc.id, `Generated official wildcard winner: ${wc.number} (${wc.votes} votes)`);
        });

        btnPublishResult.addEventListener('click', () => {
            const roundId = calcRoundSelect.value;
            const resultData = window.BackendDB.calculateWildcardResult(roundId);

            promptAdminConfirm(
                'ยืนยันการประกาศผลสู่สาธารณะ',
                `คุณต้องการประกาศผลการโหวต ${roundId} สู่หน้าเว็บไซต์สาธารณะใช่หรือไม่?`,
                () => {
                    window.BackendDB.publishResult(roundId, resultData);
                    alert('📢 ประกาศผลอย่างเป็นทางการเรียบร้อยแล้ว! ผู้ชมสามารถเข้าดูผลได้ที่หน้า Results');
                    refreshDashboardStats();
                }
            );
        });
    }

    function renderScoreboardTable() {
        const roundId = calcRoundSelect.value;
        const stats = window.BackendDB.getVoteStats(roundId);
        const judgeSelectedIds = window.BackendDB.getJudgeSelections(roundId);

        scoreboardTableBody.innerHTML = '';

        if (stats.scoreboard.length === 0) {
            scoreboardTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">ไม่มีข้อมูลคะแนนโหวต</td></tr>`;
            return;
        }

        stats.scoreboard.forEach((item, idx) => {
            const isJudgePicked = judgeSelectedIds.includes(item.id);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${idx + 1}</strong></td>
                <td><span class="logo-badge" style="background:rgba(255,255,255,0.1); color:var(--gold-light);">${item.number}</span></td>
                <td>
                    <div style="font-weight:700;">${escapeHtml(item.nickname)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(item.full_name)}</div>
                </td>
                <td>${escapeHtml(item.major)}</td>
                <td>
                    <button class="btn-primary btn-view-voters" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: var(--gold-light); cursor: pointer; font-weight: 800; font-size: 0.9rem; padding: 0.25rem 0.75rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.35rem;" title="คลิกเพื่อดูรายชื่อผู้ลงคะแนนให้ท่านนี้">
                        <span style="pointer-events: none;">${item.votes.toLocaleString()}</span>
                        <span style="font-size: 0.75rem; opacity: 0.85; pointer-events: none;">👁️</span>
                    </button>
                </td>
                <td style="text-align:center;">
                    <input type="checkbox" class="judge-pick-chk" data-id="${item.id}" ${isJudgePicked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                </td>
            `;

            tr.querySelector('.btn-view-voters').addEventListener('click', () => {
                showVoterDetailsModal(item.id, item.number, item.nickname, roundId);
            });

            const chk = tr.querySelector('.judge-pick-chk');
            chk.addEventListener('change', () => {
                const currentJudgePicks = window.BackendDB.getJudgeSelections(roundId);
                let updatedPicks = [];
                if (chk.checked) {
                    updatedPicks = Array.from(new Set([...currentJudgePicks, item.id]));
                } else {
                    updatedPicks = currentJudgePicks.filter(id => id !== item.id);
                }
                window.BackendDB.setJudgeSelections(roundId, updatedPicks);
            });

            scoreboardTableBody.appendChild(tr);
        });
    }

    function showVoterDetailsModal(candId, candNum, candNickname, roundId) {
        const voterDetailsModal = document.getElementById('voterDetailsModal');
        const voterDetailsTitle = document.getElementById('voterDetailsTitle');
        const voterDetailsSubTitle = document.getElementById('voterDetailsSubTitle');
        const voterDetailsTableBody = document.getElementById('voterDetailsTableBody');
        const btnCloseVoterDetailsModal = document.getElementById('btnCloseVoterDetailsModal');

        if (!voterDetailsModal) return;

        const voters = window.BackendDB.getCandidateVoters(candId, roundId);
        const roundName = roundId === 'ROUND_1' ? 'VOTE ROUND 1 (TOP 10)' : 'VOTE ROUND 2 (TOP 6)';

        voterDetailsTitle.innerText = `👥 รายชื่อผู้ลงคะแนนให้ ${candNum} (${candNickname})`;
        voterDetailsSubTitle.innerText = `${roundName} | รวมทั้งหมด ${voters.length} คะแนน`;

        voterDetailsTableBody.innerHTML = '';

        if (voters.length === 0) {
            voterDetailsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">ยังไม่มีผู้โหวตให้ผู้เข้าแข่งขันคนนี้ในรอบนี้</td></tr>`;
        } else {
            voters.forEach(v => {
                const tr = document.createElement('tr');
                const isStudent = v.user_type === 'STUDENT';
                const badgeStyle = isStudent 
                    ? 'background:rgba(245,158,11,0.15); color:var(--gold-light); border:1px solid rgba(245,158,11,0.3);' 
                    : 'background:rgba(139,92,246,0.15); color:#c4b5fd; border:1px solid rgba(139,92,246,0.3);';
                const badgeText = isStudent ? '🎓 นักศึกษา' : '👤 บุคคลภายนอก';

                tr.innerHTML = `
                    <td><strong>#${v.idx}</strong></td>
                    <td><span class="logo-badge" style="${badgeStyle}">${badgeText}</span></td>
                    <td><strong style="color:#fff;">${escapeHtml(v.display_name)}</strong></td>
                    <td><span style="font-size:0.82rem; color:var(--text-secondary);">${new Date(v.created_at).toLocaleString('th-TH')}</span></td>
                    <td style="text-align:center;">
                        <button class="btn-danger btn-del-vote" style="font-size:0.75rem; padding:0.25rem 0.5rem;" title="ลบผลโหวตนี้">🗑️ ลบ</button>
                    </td>
                `;

                tr.querySelector('.btn-del-vote').addEventListener('click', () => {
                    if (confirm(`คุณต้องการลบผลโหวตของ ${v.display_name} ใช่หรือไม่?`)) {
                        try {
                            window.BackendDB.deleteVote(v.vote_id);
                            alert(`🗑️ ลบผลโหวตเรียบร้อยแล้ว`);
                            refreshDashboardStats();
                            showVoterDetailsModal(candId, candNum, candNickname, roundId);
                        } catch (err) {
                            alert('❌ ' + err.message);
                        }
                    }
                });

                voterDetailsTableBody.appendChild(tr);
            });
        }

        if (btnCloseVoterDetailsModal) {
            btnCloseVoterDetailsModal.onclick = () => {
                voterDetailsModal.classList.remove('active');
            };
        }

        voterDetailsModal.classList.add('active');
    }

    // -----------------------------------------------------------------
    // AUDIT LOGS TABLE
    // -----------------------------------------------------------------
    function renderAuditLogsTable() {
        const logs = window.BackendDB.getAuditLogs();
        auditLogsTableBody.innerHTML = '';

        logs.slice(0, 50).forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size:0.8rem; color:var(--text-muted);">${new Date(log.timestamp).toLocaleString('th-TH')}</td>
                <td style="font-family:monospace; font-size:0.8rem; color:var(--accent-cyan);">${escapeHtml(log.user_id)}</td>
                <td><span class="logo-badge" style="background:rgba(139,92,246,0.2); color:#c4b5fd;">${escapeHtml(log.action)}</span></td>
                <td>${log.round_id || '-'}</td>
                <td style="font-size:0.85rem;">${escapeHtml(log.details || '')}</td>
            `;
            auditLogsTableBody.appendChild(tr);
        });
    }

    // -----------------------------------------------------------------
    // EXPORT & GOOGLE SHEETS LIVE SYNC HANDLERS
    // -----------------------------------------------------------------
    function setupExportListeners() {
        const btnExportFullSpreadsheet = document.getElementById('btnExportFullSpreadsheet');
        const sheetsWebhookInput = document.getElementById('sheetsWebhookInput');
        const btnSaveSheetsWebhook = document.getElementById('btnSaveSheetsWebhook');
        const btnTestSheetsWebhook = document.getElementById('btnTestSheetsWebhook');
        const btnSyncAllSheets = document.getElementById('btnSyncAllSheets');

        // Pre-fill webhook URL if saved
        if (sheetsWebhookInput) {
            sheetsWebhookInput.value = window.BackendDB.getGoogleSheetsWebhookUrl();
        }

        if (btnSaveSheetsWebhook) {
            btnSaveSheetsWebhook.addEventListener('click', () => {
                const url = sheetsWebhookInput.value.trim();
                window.BackendDB.setGoogleSheetsWebhookUrl(url);
                alert('💾 บันทึก URL สำหรับเชื่อมต่อ Google Sheets เรียบร้อยแล้ว!');
            });
        }

        if (btnTestSheetsWebhook) {
            btnTestSheetsWebhook.addEventListener('click', async () => {
                const url = sheetsWebhookInput ? sheetsWebhookInput.value.trim() : '';
                if (!url) {
                    alert('⚠️ กรุณากรอก Webhook URL ก่อนกดทดสอบ');
                    return;
                }
                window.BackendDB.setGoogleSheetsWebhookUrl(url);
                btnTestSheetsWebhook.disabled = true;
                btnTestSheetsWebhook.textContent = '⏳ กำลังส่ง...';
                try {
                    const result = await window.BackendDB.testGoogleSheetsConnection();
                    alert(`✅ ${result.message}\n(ตรวจสอบข้อมูลแถวใหม่ได้ที่ชีท 6_Audit_Logs ใน Google Sheets)`);
                } catch (err) {
                    alert(`❌ การส่งข้อมูลทดสอบล้มเหลว: ${err.message}`);
                } finally {
                    btnTestSheetsWebhook.disabled = false;
                    btnTestSheetsWebhook.textContent = '🧪 ทดสอบส่ง';
                }
            });
        }

        if (btnSyncAllSheets) {
            btnSyncAllSheets.addEventListener('click', async () => {
                const url = sheetsWebhookInput ? sheetsWebhookInput.value.trim() : '';
                if (!url) {
                    alert('⚠️ กรุณากรอก Webhook URL ก่อนกดสั่งซิงค์ข้อมูล');
                    return;
                }
                if (!confirm('คุณต้องการซิงค์ข้อมูลทั้งหมดในระบบ (6 แท็บ: สรุปผล, การโหวต, ผู้สมัคร, กรรมการ, ผู้ลงทะเบียน, Audit Logs) ไปยัง Google Sheets ใช่หรือไม่?')) {
                    return;
                }
                window.BackendDB.setGoogleSheetsWebhookUrl(url);
                btnSyncAllSheets.disabled = true;
                btnSyncAllSheets.textContent = '⏳ กำลังซิงค์ข้อมูลทั้งหมด 6 แท็บ...';
                try {
                    const result = await window.BackendDB.syncAllDataToGoogleSheets();
                    alert(`✅ ${result.message}`);
                } catch (err) {
                    alert(`❌ การซิงค์ข้อมูลล้มเหลว: ${err.message}`);
                } finally {
                    btnSyncAllSheets.disabled = false;
                    btnSyncAllSheets.textContent = '🔄 ซิงค์ข้อมูลทั้งหมดลง Google Sheets (6 แท็บ)';
                }
            });
        }

        if (btnPullAllSheets) {
            btnPullAllSheets.addEventListener('click', async () => {
                const url = sheetsWebhookInput ? sheetsWebhookInput.value.trim() : '';
                if (!url) {
                    alert('⚠️ กรุณากรอก Webhook URL ก่อนกดดึงข้อมูล');
                    return;
                }
                window.BackendDB.setGoogleSheetsWebhookUrl(url);
                btnPullAllSheets.disabled = true;
                btnPullAllSheets.textContent = '⏳ กำลังดึงข้อมูลจาก Google Sheets...';
                try {
                    const res = await window.BackendDB.pullFromGoogleSheets(true, 25000);
                    if (res.success) {
                        alert(`✅ ${res.message}`);
                        refreshDashboardStats();
                    } else {
                        alert(`❌ ดึงข้อมูลไม่สำเร็จ: ${res.message}`);
                    }
                } catch (err) {
                    alert(`❌ การดึงข้อมูลล้มเหลว: ${err.message}`);
                } finally {
                    btnPullAllSheets.disabled = false;
                    btnPullAllSheets.textContent = '📥 ดึงข้อมูลทั้งหมดจาก Google Sheets มาอัปเดตระบบ (Pull Sync)';
                }
            });
        }

        const btnClearDemoData = document.getElementById('btnClearDemoData');
        if (btnClearDemoData) {
            btnClearDemoData.addEventListener('click', () => {
                if (confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลตัวอย่างทั้งหมด? (ผู้สมัคร, การโหวต, รายชื่อผู้โหวต จะถูกล้างเป็นระบบเปล่าพร้อมใช้งาน)')) {
                    const res = window.BackendDB.resetAllDataClean();
                    alert(`✅ ${res.message}`);
                    refreshDashboardStats();
                }
            });
        }

        const btnAdminLogout = document.getElementById('btnAdminLogout');
        if (btnAdminLogout) {
            btnAdminLogout.addEventListener('click', () => {
                sessionStorage.removeItem('MC_ISKKU_ADMIN_AUTH');
                alert('👋 ออกจากระบบผู้ดูแลระบบเรียบร้อยแล้ว!');
                window.location.reload();
            });
        }

        if (btnExportFullSpreadsheet) {
            btnExportFullSpreadsheet.addEventListener('click', () => {
                const xmlContent = window.BackendDB.exportMultiSheetExcel();
                downloadFile(xmlContent, `MC_ISKKU_2026_Full_Database_MultiSheet_${Date.now()}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
            });
        }

        btnExportVotesCsv.addEventListener('click', () => {
            const csv = window.BackendDB.exportVotesCSV();
            downloadFile(csv, `MC_ISKKU_2026_Votes_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
        });

        btnExportSummaryCsv.addEventListener('click', () => {
            const csv = window.BackendDB.exportSummaryCSV(selectedCalcRound);
            downloadFile(csv, `MC_ISKKU_2026_Leaderboard_${selectedCalcRound}_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
        });

        btnPrintReport.addEventListener('click', () => {
            window.print();
        });
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

})();
