const API_BASE = 'https://api.zerossin.com';
const DIFFICULTIES = ['NORMAL', 'HARD', 'MAXIMUM'];
const DIFF_INTENSITY = { NORMAL: 3, HARD: 6, MAXIMUM: 9 }; // 장식용 난이도 강도 표시(10칸 중)

// 대분류(테마). 지금은 1개뿐이지만, 나중에 테마를 늘리면 각 테마마다
// 선택 그라데이션 색을 다르게 줄 수 있도록 미리 구조를 잡아둔다.
const THEMES = [
    { id: 'default', label: '기본곡 테마', from: '#ffd23f', to: '#8a2be2' },
];
let selectedTheme = THEMES[0].id;

// 곡 목록(더미 데이터). 실제 곡을 추가하려면 이 배열에 항목을 늘리면 된다.
// charts의 passCountAll/makeSpeed/longNoteTermList는 rhythm.js의 gameSettings와 1:1로 대응된다.
const songs = [
    {
        id: 'song1', title: '예시1', artist: '--', bpm: 210,
        gradient: ['#8e2de2', '#4a00e0'],
        charts: {
            NORMAL: { passCountAll: 50, makeSpeed: 260, longNoteTermList: [1, 2] },
            HARD: { passCountAll: 80, makeSpeed: 190, longNoteTermList: [1, 2, 4] },
            MAXIMUM: { passCountAll: 110, makeSpeed: 130, longNoteTermList: [1, 2, 4, 4] },
        },
    },
    {
        id: 'song2', title: '예시2', artist: '--', bpm: 128,
        gradient: ['#00c6ff', '#0072ff'],
        charts: {
            NORMAL: { passCountAll: 45, makeSpeed: 280, longNoteTermList: [1, 2] },
            HARD: { passCountAll: 70, makeSpeed: 200, longNoteTermList: [1, 2, 4] },
            MAXIMUM: { passCountAll: 95, makeSpeed: 150, longNoteTermList: [1, 2, 4, 4] },
        },
    },
    {
        id: 'song3', title: '예시3', artist: '--', bpm: 175,
        gradient: ['#ff416c', '#ff4b2b'],
        charts: {
            NORMAL: { passCountAll: 55, makeSpeed: 250, longNoteTermList: [1, 2] },
            HARD: { passCountAll: 85, makeSpeed: 180, longNoteTermList: [1, 2, 4] },
            MAXIMUM: { passCountAll: 120, makeSpeed: 125, longNoteTermList: [1, 2, 4, 4] },
        },
    },
];

let selectedIndex = 0;
let selectedDifficulty = 'HARD';
let rankingRequestId = 0; // 늦게 도착한 이전 곡의 랭킹 응답을 무시하기 위한 카운터
let noteSpeed = parseInt(localStorage.getItem('noteSpeed')) || 50;
const clearStatusCache = {}; // `${songId}_${diff}` -> true/false, renderSongList()가 다시 그려도 유지됨

function getGrade(rate) {
    const r = parseFloat(rate);
    if (isNaN(r)) return null;
    if (r === 100) return { label: 'SSS', color: '#ff8fe3' };
    if (r >= 95) return { label: 'SS', color: '#ffd23f' };
    if (r >= 90) return { label: 'S', color: '#ffd23f' };
    if (r >= 80) return { label: 'A', color: '#5ec8ff' };
    if (r >= 70) return { label: 'B', color: '#7cf29c' };
    if (r >= 50) return { label: 'C', color: '#cfc9d8' };
    return { label: 'D', color: '#948da3' };
}

localStorage.removeItem('scoreSubmitted');

// localStorage에 저장된 닉네임 확인
let nickname = localStorage.getItem('player');

if (!nickname) {
    // 닉네임이 없으면 fetch로 가져와서 닉네임 생성 후 저장
    fetch('https://raw.githubusercontent.com/zerossin/js-random-nickname-generator/main/randomNicknameGenerator.js')
        .then(response => response.text())
        .then(scriptContent => {
            eval(scriptContent);
            nickname = getRandomNickname();

            // 닉네임을 localStorage에 저장
            localStorage.setItem('player', nickname);
            console.log('새 닉네임 생성:', nickname);
            refreshClearBadges();
        })
        .catch(error => console.error('닉네임 생성기 가져오기 오류:', error));
} else {
    console.log('기존 닉네임 유지:', nickname);
}

function renderCategoryTabs() {
    const container = document.getElementById('category-tabs');
    container.innerHTML = '';
    THEMES.forEach(theme => {
        const btn = document.createElement('button');
        btn.className = 'category-tab';
        btn.textContent = theme.label;
        btn.classList.toggle('active', theme.id === selectedTheme);
        btn.addEventListener('click', () => selectTheme(theme.id));
        container.appendChild(btn);
    });
}

function selectTheme(themeId) {
    selectedTheme = themeId;
    const theme = THEMES.find(t => t.id === themeId);
    document.documentElement.style.setProperty('--list-gradient-from', theme.from);
    document.documentElement.style.setProperty('--list-gradient-to', theme.to);
    renderCategoryTabs();
}

function renderSongList() {
    const songList = document.getElementById('songs');
    songList.innerHTML = '';
    songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.classList.toggle('selected', index === selectedIndex);
        li.dataset.songId = song.id;

        const thumb = document.createElement('div');
        thumb.className = 'song-thumb';
        thumb.style.background = `linear-gradient(135deg, ${song.gradient[0]}, ${song.gradient[1]})`;

        const fill = document.createElement('div');
        fill.className = 'song-row-fill';

        const info = document.createElement('div');
        info.className = 'song-row-info';
        info.innerHTML = `<span class="song-row-title">${song.title}</span><span class="song-row-artist">${song.artist}</span>`;

        const badges = document.createElement('div');
        badges.className = 'diff-badges';
        DIFFICULTIES.forEach(diff => {
            const badge = document.createElement('span');
            badge.className = 'diff-badge';
            badge.dataset.diff = diff;
            badge.classList.toggle('cleared', !!clearStatusCache[`${song.id}_${diff}`]);
            badges.appendChild(badge);
        });

        li.appendChild(thumb);
        li.appendChild(fill);
        li.appendChild(info);
        li.appendChild(badges);
        li.addEventListener('click', () => selectSong(index));

        songList.appendChild(li);
    });
}

function renderDiffTabs() {
    const container = document.getElementById('diff-tabs');
    container.innerHTML = '';
    DIFFICULTIES.forEach(diff => {
        const btn = document.createElement('button');
        btn.className = 'diff-tab';
        btn.dataset.diff = diff;
        btn.textContent = diff;
        btn.classList.toggle('active', diff === selectedDifficulty);
        btn.addEventListener('click', () => selectDifficulty(diff));
        container.appendChild(btn);
    });
}

function renderDiffRating() {
    const container = document.getElementById('diff-rating');
    container.innerHTML = '';
    const filled = DIFF_INTENSITY[selectedDifficulty];
    for (let i = 0; i < 10; i++) {
        const mark = document.createElement('span');
        mark.textContent = '✕';
        mark.style.color = i < filled ? `var(--diff-${selectedDifficulty.toLowerCase()})` : '#3a3642';
        container.appendChild(mark);
    }
}

function renderSongInfo() {
    const song = songs[selectedIndex];
    const jacket = document.getElementById('song-jacket');
    jacket.style.background = `linear-gradient(135deg, ${song.gradient[0]}, ${song.gradient[1]})`;
    document.getElementById('atmo-bg').style.background = `linear-gradient(135deg, ${song.gradient[0]}, ${song.gradient[1]})`;

    document.getElementById('song-title').textContent = song.title;
    document.getElementById('song-artist').textContent = song.artist;
    document.getElementById('song-bpm').textContent = `BPM ${song.bpm}`;

    renderDiffTabs();
    renderDiffRating();
    fetchAndRenderRanking(song, selectedDifficulty);
}

function fetchAndRenderRanking(song, difficulty) {
    const list = document.getElementById('lobby-ranking-list');
    list.innerHTML = '<li class="ranking-loading">불러오는 중...</li>';
    document.getElementById('stat-score').textContent = '-';
    document.getElementById('stat-rate').textContent = 'RATE --';
    document.getElementById('stat-combo').textContent = '내 순위 --';
    const gradeBadge = document.getElementById('grade-badge');
    gradeBadge.textContent = '-';
    gradeBadge.style.color = '';

    const songKey = `${song.id}_${difficulty}`;
    const thisRequestId = ++rankingRequestId;

    fetch(`${API_BASE}/rankings?song=${encodeURIComponent(songKey)}`)
        .then(response => response.json())
        .then(data => {
            if (thisRequestId !== rankingRequestId) return; // 그 사이 다른 곡/난이도로 넘어갔으면 버림
            if (!Array.isArray(data) || data.length === 0) {
                list.innerHTML = '<li class="ranking-empty">아직 기록이 없습니다</li>';
                return;
            }
            list.innerHTML = data
                .slice(0, 5)
                .map((rank, i) => `<li><span class="rank-no">${i + 1}</span> ${rank.player} <span class="rank-score">${rank.score}점 (${rank.rate}%)</span></li>`)
                .join('');

            const myIndex = data.findIndex(rank => rank.player === nickname);
            if (myIndex !== -1) {
                const mine = data[myIndex];
                document.getElementById('stat-score').textContent = `${mine.score}점`;
                document.getElementById('stat-rate').textContent = `RATE ${mine.rate}%`;
                document.getElementById('stat-combo').textContent = `내 순위 ${myIndex + 1}위`;
                const grade = getGrade(mine.rate);
                if (grade) {
                    const gradeBadge = document.getElementById('grade-badge');
                    gradeBadge.textContent = grade.label;
                    gradeBadge.style.color = grade.color;
                }
            }
        })
        .catch(error => {
            if (thisRequestId !== rankingRequestId) return;
            console.error('랭킹 조회 오류:', error);
            list.innerHTML = '<li class="ranking-empty">랭킹을 불러올 수 없습니다</li>';
        });
}

// 곡 리스트 우측 난이도별 클리어 배지: 닉네임이 해당 곡+난이도 랭킹에 있으면 클리어로 표시
function refreshClearBadges() {
    if (!nickname) return;
    songs.forEach(song => {
        DIFFICULTIES.forEach(diff => {
            const songKey = `${song.id}_${diff}`;
            fetch(`${API_BASE}/rankings?song=${encodeURIComponent(songKey)}`)
                .then(response => response.json())
                .then(data => {
                    const cleared = Array.isArray(data) && data.some(rank => rank.player === nickname);
                    clearStatusCache[songKey] = cleared; // renderSongList()가 다시 그려도 유지되도록 캐시에 저장
                    const badge = document.querySelector(`#songs li[data-song-id="${song.id}"] .diff-badge[data-diff="${diff}"]`);
                    if (badge) badge.classList.toggle('cleared', cleared);
                })
                .catch(error => console.error(`클리어 배지 조회 오류(${songKey}):`, error));
        });
    });
}

function updateSpeedDisplay() {
    document.getElementById('speed-value').textContent = (noteSpeed * 0.1).toFixed(1);
}

function selectSong(index) {
    selectedIndex = index;
    renderSongList();
    renderSongInfo();
}

function selectDifficulty(diff) {
    selectedDifficulty = diff;
    renderDiffTabs();
    renderDiffRating();
    fetchAndRenderRanking(songs[selectedIndex], selectedDifficulty);
}

function handleKeyDown(e) {
    if (e.key === 'ArrowUp') {
        selectSong(selectedIndex > 0 ? selectedIndex - 1 : songs.length - 1);
    } else if (e.key === 'ArrowDown') {
        selectSong(selectedIndex < songs.length - 1 ? selectedIndex + 1 : 0);
    } else if (e.key === 'ArrowLeft') {
        const i = DIFFICULTIES.indexOf(selectedDifficulty);
        selectDifficulty(DIFFICULTIES[i > 0 ? i - 1 : DIFFICULTIES.length - 1]);
    } else if (e.key === 'ArrowRight') {
        const i = DIFFICULTIES.indexOf(selectedDifficulty);
        selectDifficulty(DIFFICULTIES[i < DIFFICULTIES.length - 1 ? i + 1 : 0]);
    } else if (e.key === 'Enter') {
        startGame();
    }
}

function startGame() {
    const song = songs[selectedIndex];
    const chart = song.charts[selectedDifficulty];
    alert(`${song.title} [${selectedDifficulty}] 모드로 시작하시겠습니까?`);

    localStorage.setItem('song', `${song.id}_${selectedDifficulty}`);
    localStorage.setItem('chart', JSON.stringify({ ...chart, title: song.title }));
    localStorage.setItem('noteSpeed', noteSpeed);

    window.location.href = 'rhythm.html';
}

document.addEventListener('keydown', handleKeyDown);
document.getElementById('up-button').addEventListener('click', () => selectSong(selectedIndex > 0 ? selectedIndex - 1 : songs.length - 1));
document.getElementById('down-button').addEventListener('click', () => selectSong(selectedIndex < songs.length - 1 ? selectedIndex + 1 : 0));
document.getElementById('speed-up').addEventListener('click', () => {
    noteSpeed = Math.min(99, noteSpeed + 1);
    localStorage.setItem('noteSpeed', noteSpeed);
    updateSpeedDisplay();
});
document.getElementById('speed-down').addEventListener('click', () => {
    noteSpeed = Math.max(10, noteSpeed - 1);
    localStorage.setItem('noteSpeed', noteSpeed);
    updateSpeedDisplay();
});
document.getElementById('start-button').addEventListener('click', startGame);

// 초기 렌더링
selectTheme(selectedTheme);
renderSongList();
renderSongInfo();
updateSpeedDisplay();
if (nickname) refreshClearBadges();
