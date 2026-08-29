/**
 * MC OF ISKKU 2026 - PUBLIC RESULTS CONTROLLER
 */

(function () {
    'use strict';

    let currentTabRound = 'ROUND_1';

    // DOM Elements
    const tabResRound1 = document.getElementById('tabResRound1');
    const tabResRound2 = document.getElementById('tabResRound2');
    const lockedResultBox = document.getElementById('lockedResultBox');
    const unlockedResultBox = document.getElementById('unlockedResultBox');

    const resHeaderTitle = document.getElementById('resHeaderTitle');
    const resWinnerImg = document.getElementById('resWinnerImg');
    const resWinnerNum = document.getElementById('resWinnerNum');
    const resWinnerNickname = document.getElementById('resWinnerNickname');
    const resWinnerMajor = document.getElementById('resWinnerMajor');
    const resWinnerVotes = document.getElementById('resWinnerVotes');
    const resTimestampNotice = document.getElementById('resTimestampNotice');

    document.addEventListener('DOMContentLoaded', () => {
        setupTabs();
        loadPublishedResult(currentTabRound);

        // Background non-blocking sync if Webhook URL exists
        if (window.BackendDB && window.BackendDB.getGoogleSheetsWebhookUrl()) {
            window.BackendDB.pullFromGoogleSheets(true).then(res => {
                if (res && res.success) {
                    loadPublishedResult(currentTabRound);
                }
            });
        }
    });

    function setupTabs() {
        tabResRound1.addEventListener('click', () => {
            currentTabRound = 'ROUND_1';
            updateTabStyles();
            loadPublishedResult('ROUND_1');
        });

        tabResRound2.addEventListener('click', () => {
            currentTabRound = 'ROUND_2';
            updateTabStyles();
            loadPublishedResult('ROUND_2');
        });
    }

    function updateTabStyles() {
        if (currentTabRound === 'ROUND_1') {
            tabResRound1.style.background = 'linear-gradient(135deg, var(--gold-primary), #d97706)';
            tabResRound1.style.color = '#000';
            tabResRound2.style.background = 'rgba(255,255,255,0.08)';
            tabResRound2.style.color = '#fff';
        } else {
            tabResRound2.style.background = 'linear-gradient(135deg, var(--purple-primary), var(--purple-dark))';
            tabResRound2.style.color = '#fff';
            tabResRound1.style.background = 'rgba(255,255,255,0.08)';
            tabResRound1.style.color = '#fff';
        }
    }

    function loadPublishedResult(roundId) {
        const publishedData = window.BackendDB.getPublishedResult(roundId);

        if (!publishedData || !publishedData.wildcard) {
            // Lock State
            lockedResultBox.style.display = 'block';
            unlockedResultBox.style.display = 'none';
        } else {
            // Unlocked State
            lockedResultBox.style.display = 'none';

            const wc = publishedData.wildcard;
            const roundTitle = roundId === 'ROUND_1' ? 'TOP 10 WILD CARD' : 'TOP 6 WILD CARD';

            resHeaderTitle.innerText = `🎉 VOTE RESULT : ${roundTitle}`;
            resWinnerImg.src = wc.image_url;
            resWinnerNum.innerText = wc.number;
            resWinnerNickname.innerText = `${wc.nickname} (${wc.full_name})`;
            resWinnerMajor.innerText = `${wc.major}`;
            resWinnerVotes.innerText = `🗳️ ${wc.votes.toLocaleString()} คะแนนโหวต`;
            resTimestampNotice.innerText = `ประกาศผลอย่างเป็นทางการเมื่อ: ${new Date(publishedData.generated_at).toLocaleString('th-TH')}`;

            unlockedResultBox.style.display = 'block';
        }
    }

})();
