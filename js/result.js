const domElements = {
    // Top Section
    songTitle: document.querySelector('.top-bar .song-info h1'),
    songDifficulty: document.querySelector('.top-bar .song-info span'),

    // Center Section
    grade: document.querySelector('.center-section .grade'),
    grade_id: document.getElementById('grade'),
    score: document.querySelector('.center-section .score'),
    rate: document.querySelector('.center-section .rate'),

    // Left Section
    maxCombo: document.querySelector('.left-panel ul li:nth-child(1) span'),
    totalCombo: document.querySelector('.left-panel ul li:nth-child(2) span'),
    perfects: document.querySelector('.left-panel ul li:nth-child(3) span'),
    successes: document.querySelector('.left-panel ul li:nth-child(4) span'),
    bads: document.querySelector('.left-panel ul li:nth-child(5) span'),
    fails: document.querySelector('.left-panel ul li:nth-child(6) span'),

    // Right Section
    globalRank: document.querySelector('.right-panel .ranking-details p:nth-child(1) span'),
    scoreRank: document.querySelector('.right-panel .ranking-details p:nth-child(2) span'),

    // Action Buttons
    mainMenuBtn: document.querySelector('.action-buttons .main-menu-btn'),
    replayBtn: document.querySelector('.action-buttons .replay-btn')
};

// localStorage에서 값 읽어오기
const song = localStorage.getItem('song');
const player = localStorage.getItem('player');
const score = localStorage.getItem('score');
const rate = localStorage.getItem('rate');
const maxCombo = localStorage.getItem('maxCombo');
const totalCombo = localStorage.getItem('totalCombo');
const perfectCount = localStorage.getItem('perfectCount');
const goodCount = localStorage.getItem('goodCount');
const badCount = localStorage.getItem('badCount');
const missCount = localStorage.getItem('missCount');

// DOM 요소에 값 설정하기
updateRatingDisplay(rate);
domElements.score.textContent = `${score}점`;
domElements.rate.textContent = `${rate}%`;
domElements.maxCombo.textContent = maxCombo;
domElements.totalCombo.textContent = totalCombo;
domElements.perfects.textContent = perfectCount;
domElements.successes.textContent = goodCount;
domElements.bads.textContent = badCount;
domElements.fails.textContent = missCount;

function getRating(rate) {
    const numericRate = parseFloat(rate);

    if (isNaN(numericRate)) {
        return { label: "Invalid", gradient: "linear-gradient(45deg, #000, #000)" }; // Black for invalid
    }

    if (numericRate === 100) {
        return { label: "SSS", gradient: "linear-gradient(45deg, #8A2BE2, #FF69B4, #00FFFF)" }; // Purple base gradient
    } else if (numericRate >= 95) {
        return { label: "SS", gradient: "linear-gradient(45deg, #FFD700, #FF6347, #FF4500)" }; // Gold gradient
    } else if (numericRate >= 90) {
        return { label: "S", gradient: "linear-gradient(45deg, #FFD700, #FFFFFF)" }; // Gold to white gradient
    } else if (numericRate >= 80) {
        return { label: "A", gradient: "linear-gradient(45deg, #FF4500, #FF6347)" }; // Red to orange gradient
    } else if (numericRate >= 70) {
        return { label: "B", gradient: "#1967D2" }; // Solid blue
    } else if (numericRate >= 50) {
        return { label: "C", gradient: "#008000" }; // Solid green
    } else if (numericRate >= 30) {
        return { label: "D", gradient: "#808080" }; // Solid gray
    } else {
        return { label: "E", gradient: "#8B4513" }; // Solid brown
    }
}

function updateRatingDisplay(rate) {
    const gradeElement = document.getElementById('grade');
    const { label, gradient } = getRating(rate);

    gradeElement.textContent = label;
    gradeElement.style.background = gradient;
    gradeElement.style.backgroundClip = 'text';
    gradeElement.style.backgroundSize = '200% 100%'; // Make gradient move
}


// 랭킹 불러오기
function fetchRankings() {
    fetch(`https://api.zerossin.com/rankings?song=${encodeURIComponent(song)}`)
        .then(response => response.json())
        .then(data => {
            let rankingHtml = '';
            let yourRank = null; // 플레이어가 랭킹에 포함되었는지 확인하기 위한 변수
            
            data.forEach((rank, index) => {
                // 방금 플레이한 점수와 비교하여 랭킹 안에 있으면 노란색 강조
                const isCurrentPlayer = (rank.player === player && rank.score === score && rank.rate === rate);
                
                rankingHtml += `<li style="color: ${isCurrentPlayer ? 'yellow' : 'white'}">
                    ${index + 1}. ${rank.player} - ${rank.score}점, rate: ${rank.rate}%
                </li>`;
                
                // 내 랭킹 위치를 저장
                if (isCurrentPlayer) {
                    yourRank = index + 1;
                }
            });

            document.getElementById('ranking-list').innerHTML = rankingHtml;
            document.getElementById('your-rank').textContent = yourRank ? yourRank : '순위권 밖';
            
            // 내 점수 표시
            document.getElementById('your-score-details').textContent = `${score}점, rate: ${rate}%`;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// 점수 서버로 전송
function sendScoreToServer(song, player, score, rate) {
    if (localStorage.getItem('scoreSubmitted') === 'true') {
        // 이미 점수를 제출한 경우, 새로 제출하지 않음
        console.log('Score already submitted.');
        fetchRankings();
        return;
    }

    fetch('https://api.zerossin.com/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            song: song,
            player: player,
            score: score,
            rate: rate
        })
    })
        .then(response => response.text())
        .then(data => {
            console.log('Success:', data);
            // 점수 전송 후 랭킹 새로고침
            fetchRankings();
            // 점수 제출 상태 저장
            localStorage.setItem('scoreSubmitted', 'true');
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// 방금 플레이한 점수 서버로 전송 후 랭킹 새로고침
sendScoreToServer(song, player, parseInt(score, 10), parseFloat(rate));

domElements.mainMenuBtn.addEventListener('click', () => {
    // 값 삭제
    localStorage.removeItem('song');
    localStorage.removeItem('score');
    localStorage.removeItem('rate');
    localStorage.removeItem('maxCombo');
    localStorage.removeItem('totalCombo');
    localStorage.removeItem('perfectCount');
    localStorage.removeItem('goodCount');
    localStorage.removeItem('badCount');
    localStorage.removeItem('missCount');
    localStorage.removeItem('scoreSubmitted');

    window.location.href = 'main.html'; // Navigate to the main menu page
});

domElements.replayBtn.addEventListener('click', () => {
    localStorage.removeItem('score');
    localStorage.removeItem('rate');
    localStorage.removeItem('maxCombo');
    localStorage.removeItem('totalCombo');
    localStorage.removeItem('perfectCount');
    localStorage.removeItem('goodCount');
    localStorage.removeItem('badCount');
    localStorage.removeItem('missCount');
    localStorage.removeItem('scoreSubmitted');

    window.location.href = 'rhythm.html'; // Navigate to the replay page
});