const API_BASE = 'https://api.zerossin.com';
const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD'];
const DIFF_INTENSITY = { EASY: 3, NORMAL: 6, HARD: 9 }; // 장식용 난이도 강도 표시(10칸 중)

// 대분류(테마). 테마마다 선택 그라데이션 색이 다르다.
// 커스텀 테마는 다중 세그먼트 바가 잘 구성되는지 확인해보기 위한 테스트용 항목.
const THEMES = [
    { id: 'default', label: '기본곡 테마', from: '#ffd23f', to: '#8a2be2' },
    { id: 'custom', label: '커스텀 테마', from: '#5ec8ff', to: '#00ffb3' },
];
let selectedTheme = THEMES[0].id;

// 곡 목록. "전역까지" 컨셉으로 3곡을 신병->고참->말년 서사로 구성했다.
// charts의 passCountAll/makeSpeed/longNoteTermList는 rhythm.js의 gameSettings와 1:1로 대응된다.
// longNoteTermList는 반드시 4칸이어야 한다 (rhythm.js의 createNewLongNote가
// Math.floor(Math.random()*4)로 고정 인덱싱하기 때문 — 3칸 이하면 term이 undefined가 됨).
const DEFAULT_SONGS = [
    {
        id: 'song1', title: '여유', artist: '말년병장', bpm: 95,
        gradient: ['#8e2de2', '#4a00e0'],
        // 말년 병장의 여유: 느긋함 그 자체 — EASY만 존재
        charts: {
            EASY: { passCountAll: 40, makeSpeed: 300, longNoteTermList: [2, 3, 4, 4] },
        },
    },
    {
        id: 'song2', title: '근무', artist: '상병', bpm: 128,
        gradient: ['#00c6ff', '#0072ff'],
        // 표준적인 일과: 딱 NORMAL 하나
        charts: {
            NORMAL: { passCountAll: 50, makeSpeed: 250, longNoteTermList: [1, 2, 4, 4] },
        },
    },
    {
        id: 'song3', title: '얼차려', artist: '조교', bpm: 195,
        gradient: ['#ff416c', '#ff4b2b'],
        // 얼차려엔 쉬운 길이 없다 — HARD만 존재
        charts: {
            HARD: { passCountAll: 130, makeSpeed: 95, longNoteTermList: [1, 2, 2, 3] },
        },
    },
];

// 대분류(테마)마다 곡 목록 자체가 다르다. 커스텀 테마는 아직 실제 곡이 없어서 빈 목록 —
// 목록칸에는 "곡 추가하기" 더미 행만 뜬다.
const SONGS_BY_THEME = {
    default: DEFAULT_SONGS,
    custom: [],
};

function currentSongs() {
    return SONGS_BY_THEME[selectedTheme] || [];
}

let selectedIndex = 0;
let selectedDifficulty = 'NORMAL';
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
        const isActive = theme.id === selectedTheme;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.style.background = `linear-gradient(90deg, ${theme.from}, ${theme.to})`;
        } else {
            btn.style.color = theme.from; // 선택 안 됐을 때는 그라데이션의 상징색 1을 글자색으로
        }
        btn.addEventListener('click', () => selectTheme(theme.id));
        container.appendChild(btn);
    });
}

function selectTheme(themeId) {
    selectedTheme = themeId;
    selectedIndex = 0;
    const theme = THEMES.find(t => t.id === themeId);
    document.documentElement.style.setProperty('--list-gradient-from', theme.from);
    document.documentElement.style.setProperty('--list-gradient-to', theme.to);
    renderCategoryTabs();
    renderSongList();
    renderSongInfo();
}

function triggerAddSongFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', () => {
        if (input.files.length > 0) {
            alert(`"${input.files[0].name}" 파일이 채보 형식과 맞지 않습니다.\n(채보 가져오기 기능은 아직 준비 중입니다)`);
        }
    });
    input.click();
}

function renderSongList() {
    const songList = document.getElementById('songs');
    songList.innerHTML = '';
    const list = currentSongs();

    if (list.length === 0) {
        const li = document.createElement('li');
        li.className = 'add-song-row';

        const thumb = document.createElement('div');
        thumb.className = 'song-thumb add-song-thumb';
        thumb.textContent = '+';

        const fill = document.createElement('div');
        fill.className = 'song-row-fill';

        const info = document.createElement('div');
        info.className = 'song-row-info';
        info.innerHTML = `<span class="song-row-title">곡 추가하기</span><span class="song-row-artist">채보 파일 첨부</span>`;

        li.appendChild(thumb);
        li.appendChild(fill);
        li.appendChild(info);
        li.addEventListener('click', triggerAddSongFile);
        songList.appendChild(li);
        return;
    }

    list.forEach((song, index) => {
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
            if (!song.charts[diff]) {
                badge.classList.add('unavailable');
                badge.textContent = '✕';
            } else {
                badge.classList.toggle('cleared', !!clearStatusCache[`${song.id}_${diff}`]);
            }
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

function availableDifficulties(song) {
    return DIFFICULTIES.filter(diff => !!song.charts[diff]);
}

function renderDiffTabs(song) {
    const container = document.getElementById('diff-tabs');
    container.innerHTML = '';
    const available = availableDifficulties(song);
    DIFFICULTIES.forEach(diff => {
        const btn = document.createElement('button');
        btn.className = 'diff-tab';
        btn.dataset.diff = diff;
        btn.textContent = diff;
        if (!available.includes(diff)) {
            btn.classList.add('disabled');
            btn.disabled = true;
        } else {
            btn.classList.toggle('active', diff === selectedDifficulty);
            btn.addEventListener('click', () => selectDifficulty(diff));
        }
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

// 최상위 난이도(HARD) 선택 시에만 은은하게 떠오르는 잔불 파티클
function renderDiffParticles() {
    const container = document.getElementById('diff-particles');
    container.innerHTML = '';
    if (selectedDifficulty !== 'HARD') return;
    for (let i = 0; i < 14; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        p.style.setProperty('--x', `${Math.random() * 100}%`);
        p.style.setProperty('--drift', `${(Math.random() * 40 - 20).toFixed(0)}px`);
        p.style.setProperty('--duration', `${(3 + Math.random() * 3).toFixed(1)}s`);
        p.style.setProperty('--delay', `${(Math.random() * -6).toFixed(1)}s`);
        container.appendChild(p);
    }
}

function renderSongInfo() {
    const list = currentSongs();
    const infoCard = document.querySelector('.info-card');
    const isEmpty = list.length === 0;
    infoCard.classList.toggle('empty', isEmpty);
    document.querySelector('.left-panel').classList.toggle('empty-theme', isEmpty);
    if (isEmpty) {
        document.getElementById('atmo-bg').style.background = '#0b0a0e';
        return;
    }

    const song = list[selectedIndex];

    // 이 곡에 지금 선택된 난이도가 없으면(예: 얼차려로 넘어왔는데 HARD가 선택돼 있던 경우)
    // 그 곡에서 고를 수 있는 첫 난이도로 자동 전환
    const available = availableDifficulties(song);
    if (!available.includes(selectedDifficulty)) {
        selectedDifficulty = available[0];
    }

    const jacket = document.getElementById('song-jacket');
    jacket.style.background = `linear-gradient(135deg, ${song.gradient[0]}, ${song.gradient[1]})`;
    document.getElementById('atmo-bg').style.background = `linear-gradient(135deg, ${song.gradient[0]}, ${song.gradient[1]})`;

    document.getElementById('song-title').textContent = song.title;
    document.getElementById('song-artist').textContent = song.artist;
    document.getElementById('song-bpm').textContent = `BPM ${song.bpm}`;

    renderDiffTabs(song);
    renderDiffRating();
    renderDiffParticles();
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
    DEFAULT_SONGS.forEach(song => {
        availableDifficulties(song).forEach(diff => {
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
    const list = currentSongs();
    if (list.length === 0) return;
    const song = list[selectedIndex];
    if (!song.charts[diff]) return; // 이 곡엔 없는 난이도

    selectedDifficulty = diff;
    renderDiffTabs(song);
    renderDiffRating();
    renderDiffParticles();
    fetchAndRenderRanking(song, selectedDifficulty);
}

function handleKeyDown(e) {
    const list = currentSongs();
    const total = list.length;
    if (e.key === 'ArrowUp') {
        if (total > 0) selectSong(selectedIndex > 0 ? selectedIndex - 1 : total - 1);
    } else if (e.key === 'ArrowDown') {
        if (total > 0) selectSong(selectedIndex < total - 1 ? selectedIndex + 1 : 0);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (total === 0) return;
        const available = availableDifficulties(list[selectedIndex]);
        const i = available.indexOf(selectedDifficulty);
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        selectDifficulty(available[(i + step + available.length) % available.length]);
    } else if (e.key === 'Enter') {
        startGame();
    }
}

function startGame() {
    const list = currentSongs();
    if (list.length === 0) return; // 이 테마엔 아직 곡이 없음

    const song = list[selectedIndex];
    const chart = song.charts[selectedDifficulty];
    alert(`${song.title} [${selectedDifficulty}] 모드로 시작하시겠습니까?`);

    localStorage.setItem('song', `${song.id}_${selectedDifficulty}`);
    localStorage.setItem('chart', JSON.stringify({ ...chart, title: song.title, gradient: song.gradient }));
    localStorage.setItem('noteSpeed', noteSpeed);

    window.location.href = 'rhythm.html';
}

document.addEventListener('keydown', handleKeyDown);
document.getElementById('up-button').addEventListener('click', () => {
    const total = currentSongs().length;
    if (total > 0) selectSong(selectedIndex > 0 ? selectedIndex - 1 : total - 1);
});
document.getElementById('down-button').addEventListener('click', () => {
    const total = currentSongs().length;
    if (total > 0) selectSong(selectedIndex < total - 1 ? selectedIndex + 1 : 0);
});
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
selectTheme(selectedTheme); // 내부에서 renderSongList()/renderSongInfo()까지 호출함
updateSpeedDisplay();
if (nickname) refreshClearBadges();
