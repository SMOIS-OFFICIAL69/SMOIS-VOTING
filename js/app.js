/**
 * MC OF ISKKU 2026 - VOTER FRONTEND CONTROLLER (STUDENT ID & GUEST NAME AUTH)
 */

(function () {
    'use strict';

    let currentRound = null;
    let selectedCandidateIds = new Set();
    let countdownInterval = null;

    // DOM Elements
    const userAuthContainer = document.getElementById('userAuthContainer');
    const currentRoundTitle = document.getElementById('currentRoundTitle');
    const statusBadgeContainer = document.getElementById('statusBadgeContainer');
    const totalVotersCount = document.getElementById('totalVotersCount');
    const countdownDisplay = document.getElementById('countdownDisplay');
    const roundHeaderTitle = document.getElementById('roundHeaderTitle');
    const roundHeaderDesc = document.getElementById('roundHeaderDesc');
    const candidateGrid = document.getElementById('candidateGrid');
    const confirmModal = document.getElementById('confirmModal');

    // Auth Modal Elements
    const voterAuthModal = document.getElementById('voterAuthModal');
    const tabAuthStudent = document.getElementById('tabAuthStudent');
    const tabAuthGuest = document.getElementById('tabAuthGuest');
    const studentLoginForm = document.getElementById('studentLoginForm');
    const guestLoginForm = document.getElementById('guestLoginForm');
    const studentIdInput = document.getElementById('studentIdInput');
    const guestNameInput = document.getElementById('guestNameInput');
    const btnCancelAuthModal = document.getElementById('btnCancelAuthModal');

    // Floating Multi-Submit Bar & Badges
    const floatingSubmitBar = document.getElementById('floatingSubmitBar');
    const selectedCountBadge = document.getElementById('selectedCountBadge');
    const btnOpenConfirmModal = document.getElementById('btnOpenConfirmModal');

    // Receipt Elements
    const voteSuccessReceipt = document.getElementById('voteSuccessReceipt');
    const recVoteId = document.getElementById('recVoteId');
    const recRoundName = document.getElementById('recRoundName');
    const recCandidatesList = document.getElementById('recCandidatesList');
    const recTimestamp = document.getElementById('recTimestamp');

    // Modal Elements
    const modalSelectedList = document.getElementById('modalSelectedList');
    const btnCancelVote = document.getElementById('btnCancelVote');
    const btnConfirmVote = document.getElementById('btnConfirmVote');

    // Initialize Application
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
    });

    function initApp() {
        // Render instantly from local database
        renderAuthBar();
        loadRoundData();
        setupEventListeners();
        setupAuthModalListeners();

        // Background non-blocking sync if Webhook URL exists
        if (window.BackendDB && window.BackendDB.getGoogleSheetsWebhookUrl()) {
            window.BackendDB.pullFromGoogleSheets(false).then(res => {
                if (res && res.success) {
                    loadRoundData();
                }
            });

            // Polling every 10s so all voter devices & mobiles auto-sync closing timers live
            if (!window.voterAutoRefreshInterval) {
                window.voterAutoRefreshInterval = setInterval(() => {
                    window.BackendDB.pullFromGoogleSheets(false).then(res => {
                        if (res && res.success) {
                            loadRoundData();
                        }
                    });
                }, 10000);
            }
        }
    }

    // -----------------------------------------------------------------
    // AUTHENTICATION RENDERING & MODAL LOGIC
    // -----------------------------------------------------------------
    function renderAuthBar() {
        const user = window.BackendDB.getCurrentUser();
        if (user) {
            const userIcon = user.user_type === 'STUDENT' ? '🎓' : '👤';
            const userLabel = user.user_type === 'STUDENT' ? user.student_id : user.name;

            userAuthContainer.innerHTML = `
                <div class="user-profile-badge">
                    <div style="width:28px; height:28px; border-radius:50%; background:var(--gold-primary); color:#000; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">
                        ${userIcon}
                    </div>
                    <span class="user-name" title="${escapeHtml(user.name)}">${escapeHtml(userLabel)}</span>
                    <button class="btn-logout" id="btnLogout" title="ออกจากระบบ">✕</button>
                </div>
            `;
            document.getElementById('btnLogout').addEventListener('click', () => {
                window.BackendDB.logoutUser();
                location.reload();
            });
        } else {
            userAuthContainer.innerHTML = `
                <button class="btn-google-login" id="btnOpenVoterAuth">
                    <span>🔐 เข้าสู่ระบบเพื่อโหวต</span>
                </button>
            `;
            document.getElementById('btnOpenVoterAuth').addEventListener('click', () => {
                voterAuthModal.classList.add('active');
            });
        }
    }

    function setupAuthModalListeners() {
        tabAuthStudent.addEventListener('click', () => {
            tabAuthStudent.style.background = 'linear-gradient(135deg, var(--gold-primary), #d97706)';
            tabAuthStudent.style.color = '#000';
            tabAuthGuest.style.background = 'transparent';
            tabAuthGuest.style.color = 'var(--text-secondary)';

            studentLoginForm.style.display = 'block';
            guestLoginForm.style.display = 'none';
        });

        tabAuthGuest.addEventListener('click', () => {
            tabAuthGuest.style.background = 'linear-gradient(135deg, var(--purple-primary), var(--purple-dark))';
            tabAuthGuest.style.color = '#fff';
            tabAuthStudent.style.background = 'transparent';
            tabAuthStudent.style.color = 'var(--text-secondary)';

            guestLoginForm.style.display = 'block';
            studentLoginForm.style.display = 'none';
        });

        btnCancelAuthModal.addEventListener('click', () => {
            voterAuthModal.classList.remove('active');
        });

        studentLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const sid = studentIdInput.value.trim();
            try {
                window.BackendDB.loginStudent(sid);
                voterAuthModal.classList.remove('active');
                initApp();
            } catch (err) {
                alert(err.message);
            }
        });

        guestLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = guestNameInput.value.trim();
            try {
                window.BackendDB.loginGuest(name);
                voterAuthModal.classList.remove('active');
                initApp();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // -----------------------------------------------------------------
    // LOAD ROUND & CANDIDATE DATA
    // -----------------------------------------------------------------
    function loadRoundData() {
        currentRound = window.BackendDB.getCurrentVotingRound();
        const user = window.BackendDB.getCurrentUser();

        // Update Round Headers
        currentRoundTitle.innerText = currentRound.round_name;
        roundHeaderTitle.innerText = `${currentRound.round_name} : ${currentRound.subtitle || ''}`;
        roundHeaderDesc.innerText = 'เลือกผู้เข้าแข่งขันที่คุณต้องการโหวตให้ (สามารถโหวตได้สูงสุด 5 คนในรอบนี้)';

        // Update Status Badge
        if (currentRound.status === 'OPEN') {
            statusBadgeContainer.innerHTML = `<span class="badge-open"><span class="pulse-dot"></span> Voting Open</span>`;
        } else {
            statusBadgeContainer.innerHTML = `<span class="badge-closed">🔒 Voting Closed</span>`;
        }

        // Update Total Voters Count (if element exists)
        const totalVotersElem = document.getElementById('totalVotersCount');
        if (totalVotersElem) {
            const stats = window.BackendDB.getVoteStats(currentRound.id);
            totalVotersElem.innerText = `${stats.total_voters} คน (${stats.total_votes} คะแนน)`;
        }

        // Start Countdown Timer
        setupCountdownTimer(currentRound);

        // Get candidate IDs user has ALREADY voted for
        let alreadyVotedCandIds = [];
        if (user) {
            alreadyVotedCandIds = window.BackendDB.getUserVotedCandidateIds(user.id, currentRound.id);
        }

        // Render Candidates Grid
        renderCandidates(alreadyVotedCandIds);
    }

    function setupCountdownTimer(round) {
        if (countdownInterval) clearInterval(countdownInterval);

        function updateTimer() {
            if (!round || round.status !== 'OPEN') {
                countdownDisplay.innerText = "00 : 00 : 00";
                if (statusBadgeContainer) {
                    statusBadgeContainer.innerHTML = `<span class="badge-closed">🔒 VOTING CLOSED</span>`;
                }
                return;
            }

            let endTime;
            if (round.end_at) {
                endTime = new Date(round.end_at).getTime();
            } else {
                // If no custom closing time set by admin, countdown to midnight (23:59:59)
                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);
                endTime = todayEnd.getTime();
            }

            const now = new Date().getTime();
            const diff = endTime - now;

            if (diff <= 0) {
                countdownDisplay.innerText = "00 : 00 : 00";
                if (statusBadgeContainer) {
                    statusBadgeContainer.innerHTML = `<span class="badge-closed">🔒 VOTING CLOSED</span>`;
                }
                clearInterval(countdownInterval);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const pad = (n) => n.toString().padStart(2, '0');
            if (days > 0) {
                countdownDisplay.innerText = `${days}วัน ${pad(hours)} : ${pad(minutes)} : ${pad(seconds)}`;
            } else {
                countdownDisplay.innerText = `${pad(hours)} : ${pad(minutes)} : ${pad(seconds)}`;
            }
        }

        updateTimer();
        countdownInterval = setInterval(updateTimer, 1000);
    }

    function renderCandidates(alreadyVotedCandIds) {
        const candidates = window.BackendDB.getCandidatesForRound(currentRound.id);
        candidateGrid.innerHTML = '';

        if (candidates.length === 0) {
            candidateGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    ยังไม่มีข้อมูลผู้เข้าแข่งขันสำหรับรอบนี้
                </div>
            `;
            return;
        }

        candidates.forEach(c => {
            const hasVotedForThisCand = alreadyVotedCandIds.includes(c.id);
            const isCurrentlySelected = selectedCandidateIds.has(c.id);

            const card = document.createElement('div');
            card.className = `candidate-card ${isCurrentlySelected ? 'selected' : ''}`;

            let buttonText = isCurrentlySelected ? "☑ เลือกแล้ว" : "☐ เลือกคนนี้";
            let buttonStyle = isCurrentlySelected ? "background: linear-gradient(135deg, var(--gold-primary), #d97706); color:#000; font-weight:700;" : "";
            let disabledAttr = "";

            if (hasVotedForThisCand) {
                disabledAttr = "disabled";
                buttonText = "✓ โหวตแล้ว";
                buttonStyle = "background: rgba(16, 185, 129, 0.2); color:#34d399; border-color:rgba(16, 185, 129, 0.4); cursor:not-allowed;";
            } else if (currentRound.status !== 'OPEN') {
                disabledAttr = "disabled";
                buttonText = "ปิดการโหวต";
                buttonStyle = "opacity: 0.5; cursor: not-allowed;";
            }

            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${c.image_url}" alt="${c.nickname}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'">
                    <div class="candidate-number-badge">${c.number}</div>
                </div>
                <div class="card-body">
                    <div class="candidate-nickname">${escapeHtml(c.nickname)}</div>
                    <div class="candidate-fullname">${escapeHtml(c.full_name)}</div>
                    <div class="candidate-major">${escapeHtml(c.major)} (${c.year})</div>
                    <button class="btn-select-candidate" style="${buttonStyle}" ${disabledAttr} data-id="${c.id}">
                        ${buttonText}
                    </button>
                </div>
            `;

            const selectBtn = card.querySelector('.btn-select-candidate');
            selectBtn.addEventListener('click', () => {
                toggleCandidateSelection(c.id, card, selectBtn);
            });

            candidateGrid.appendChild(card);
        });
    }

    function toggleCandidateSelection(candidateId, cardEl, btnEl) {
        const user = window.BackendDB.getCurrentUser();

        // 1. Check Login
        if (!user) {
            voterAuthModal.classList.add('active');
            return;
        }

        // 2. Check Round Status
        if (currentRound.status !== 'OPEN') {
            alert('ขออภัย ขณะนี้ปิดการโหวตในรอบนี้แล้ว');
            return;
        }

        const MAX_VOTES = 5;
        const alreadyVotedCandIds = window.BackendDB.getUserVotedCandidateIds(user.id, currentRound.id);
        const alreadyVotedCount = alreadyVotedCandIds.length;

        if (alreadyVotedCount >= MAX_VOTES) {
            alert(`คุณได้ใช้สิทธิ์โหวตในรอบนี้ครบ 5 คนตามที่กำหนดแล้ว`);
            return;
        }

        // Toggle candidate selection in Set
        if (selectedCandidateIds.has(candidateId)) {
            selectedCandidateIds.delete(candidateId);
            cardEl.classList.remove('selected');
            btnEl.innerText = "☐ เลือกคนนี้";
            btnEl.style = "";
        } else {
            if (alreadyVotedCount + selectedCandidateIds.size >= MAX_VOTES) {
                alert(`คุณสามารถเลือกโหวตได้สูงสุด 5 คนในรอบนี้ (ใช้สิทธิ์ไปแล้ว ${alreadyVotedCount} คน, เลือกอยู่ ${selectedCandidateIds.size} คน)`);
                return;
            }

            selectedCandidateIds.add(candidateId);
            cardEl.classList.add('selected');
            btnEl.innerText = "☑ เลือกแล้ว";
            btnEl.style = "background: linear-gradient(135deg, var(--gold-primary), #d97706); color:#000; font-weight:700;";
        }

        updateFloatingBar();
    }

    function updateFloatingBar() {
        const count = selectedCandidateIds.size;
        selectedCountBadge.innerText = count;
        if (count > 0) {
            floatingSubmitBar.style.display = 'flex';
        } else {
            floatingSubmitBar.style.display = 'none';
        }
    }

    function setupEventListeners() {
        btnOpenConfirmModal.addEventListener('click', () => {
            if (selectedCandidateIds.size === 0) return;

            const allCandidates = window.BackendDB.getCandidatesForRound(currentRound.id);
            const selectedObjs = allCandidates.filter(c => selectedCandidateIds.has(c.id));

            modalSelectedList.innerHTML = '';
            selectedObjs.forEach(c => {
                const box = document.createElement('div');
                box.className = 'candidate-preview-box';
                box.style.marginBottom = '0';
                box.innerHTML = `
                    <img src="${c.image_url}" alt="${c.nickname}" class="preview-thumb">
                    <div>
                        <div style="color: var(--gold-light); font-weight: 800; font-size: 0.85rem;">${c.number}</div>
                        <div style="font-weight: 700; font-size: 1rem; color: #fff;">${escapeHtml(c.nickname)} (${escapeHtml(c.full_name)})</div>
                        <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(c.major)}</div>
                    </div>
                `;
                modalSelectedList.appendChild(box);
            });

            confirmModal.classList.add('active');
        });

        btnCancelVote.addEventListener('click', () => {
            confirmModal.classList.remove('active');
        });

        btnConfirmVote.addEventListener('click', () => {
            if (selectedCandidateIds.size === 0) return;

            const user = window.BackendDB.getCurrentUser();
            try {
                const receipt = window.BackendDB.submitVotes(user.id, currentRound.id, Array.from(selectedCandidateIds));

                confirmModal.classList.remove('active');
                floatingSubmitBar.style.display = 'none';

                // Display Receipt Screen
                document.getElementById('votingSection').style.display = 'none';

                recVoteId.innerText = receipt.vote_ids.join(', ');
                recRoundName.innerText = receipt.round_name;

                recCandidatesList.innerHTML = '';
                receipt.candidates.forEach(c => {
                    const row = document.createElement('div');
                    row.style.cssText = "background:rgba(255,255,255,0.05); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-weight:600; color:var(--text-primary);";
                    row.innerText = `✓ ${c.number} ${c.nickname} (${c.full_name})`;
                    recCandidatesList.appendChild(row);
                });

                recTimestamp.innerText = new Date(receipt.timestamp).toLocaleString('th-TH');

                voteSuccessReceipt.style.display = 'block';
                voteSuccessReceipt.scrollIntoView({ behavior: 'smooth' });

            } catch (err) {
                alert(err.message);
            }
        });
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

})();
