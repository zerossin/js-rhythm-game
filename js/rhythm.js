// Constants
const PERFECT_SCORE = 5;
const GOOD_SCORE = 1;
const BAD_PENALTY = 40;
const MISS_PENALTY = 80;
const MAX_HP = 1000;
const BASE_SCORE = 10; //노트 한 개 칠 때마다 얻는 점수

const theme = document.querySelector(':root');
const styles = window.getComputedStyle(theme);

styles.getPropertyValue('--degCD');
styles.getPropertyValue('--myHPpercent');

// DOM Elements
const domElements = {
    container: document.getElementById('container'),
    testPage: document.getElementById('testPage'),
    lanes: Array.from({ length: 4 }, (_, i) => document.getElementById(`l${i + 1}`)),
    footers: Array.from({ length: 4 }, (_, i) => document.getElementById(`f${i + 1}`)),
    hitLights: Array.from({ length: 4 }, (_, i) => document.getElementById(`hL${i + 1}`)),
    footerBtns: document.getElementsByClassName('footerBtn'),
    mainCounter: document.getElementById('mainCounter'),
    mainComboNumber: document.getElementById('mainComboNumber'),
    mainComboText: document.getElementById('mainComboText'),
    mainEnding: document.getElementById('mainEnding'),
    mainFooterRate: document.getElementById('mainFooterRate'),
    mainFooterText: document.getElementById('mainFooterText'),
    mainFooterTextDetail: document.getElementById('mainFooterTextDetail'),
    noteSpeed: document.getElementById('noteSpeed'),
    myHP: document.getElementById('myHP'),
    songTitle: document.getElementById('songTitle'),
    escContainer: document.getElementById('escContainer'),
    escConnectBtn: document.getElementById('escConnectBtn'),
    escReplayBtn: document.getElementById('escReplayBtn'),
    escSettingBtn: document.getElementById('escSettingBtn'),
    escLobbyBtn: document.getElementById('escLobbyBtn'),
    overContainer: document.getElementById('overContainer'),
    gameOverReplay: document.getElementById('gameOverReplay')
};

// Game State
const gameState = {
    timer: null,
    timerCounter: null,
    noteList: [[], [], [], []], //현재 필드에 존재하는 노트(0부터)
    noteIndex: [0, 0, 0, 0], //필드에 존재했던 노트 개수(0부터)
    noteCount: 0, //필드에 만들어진 노트 개수(1이 1개)
    timeCount: 10,
    comboCount: 0, //현재 실시간 콤보
    perfectCount: 0,
    goodCount: 0,
    badCount: 0,
    missCount: 0,
    passCount: 0,
    totalCombo: 0, //총 콤보 성공 수
    score: 0, //최종 점수
    maxCombo: 0, //가장 많은 콤보 수
    myHP: MAX_HP,
    esc: false,
    escMenu: 1,
    startCount: false,
    gameOver: false,
    prevLongNoteYN: [false, false, false, false], //롱노트 존재여부
    pressLongNoteYN: [false, false, false, false], //롱노트 진입여부
    longNoteTerm: [0, 0, 0, 0], //롱노트 남은 박자
    longNoteTermRecode: [0, 0, 0, 0], //롱노트 남은 박자 기록용
    longNotePanjung: ['', '', '', ''],
    longNoteStartEnd: [0, 0, 0, 0],
    //키 이벤트
    check: [false, false, false, false],
    press: [false, false, false, false]
};

// Game Settings
//////////게임 기본 설정///////////
// 로비(main.js)에서 곡+난이도를 고르면 여기에 저장해둔 값을 그대로 사용한다.
// 값이 없으면(=rhythm.html을 곧바로 열었을 때) 아래 기본값으로 대체.
const savedChart = JSON.parse(localStorage.getItem('chart') || 'null');

const gameSettings = {
    passCountAll: savedChart?.passCountAll ?? 80, //쳐야 할 전체 노트 개수
    makeSpeed: savedChart?.makeSpeed ?? 200, //노트 생성 속도(ms)
    mujuk: false, //무적여부
    longNoteTermList: savedChart?.longNoteTermList ?? [1, 2, 4, 4], //롱노트 기간 개수
    noteSpeed: parseInt(localStorage.getItem('noteSpeed')) || 50
};

gameSettings.gameTime = gameSettings.makeSpeed * gameSettings.passCountAll;

// Note Class
class Note {
    constructor(index, line, type) {
        this.index = index;
        this.line = line;
        this.type = type;
        this.top = 0;
        this.sequence = gameState.noteList[line - 1].length;
        this.color = this.getColor(line, type);
    }

    getColor(line, type) {
        if (line === 1 || line === 4) {
            return type === 'sn' ? 'whiteNote' : 'whiteLongNote';
        } else {
            return type === 'sn' ? 'blueNote' : 'blueLongNote';
        }
    }

    spanNote() {
        const temp = document.createElement('div');
        temp.classList.add(this.type === 'sn' ? 'note' : 'longnote');
        temp.classList.add(this.color);
        if (this.type === 'lns') {
            temp.classList.add('start');
        } else if (this.type === 'lne') {
            temp.classList.add('end');
        }
        domElements.lanes[this.line - 1].append(temp);
    }

    fallNote(speed) {
        const thisNote = domElements.lanes[this.line - 1].children[this.sequence + 1];
        const dpt = 0.12 * (speed * 2 * 0.1); //10ms(단위)당 이동거리

        //높이 설정(매 초 발동)
        this.top += dpt;
        thisNote.style.top = `${this.top}%`;

        if (this.type === 'lnm') {
            //롱노트 모양 구현
            thisNote.style.height = `${(dpt * 0.1 * gameSettings.makeSpeed) * 2}%`; //노트이동거리(1ms당) X 노트생성속도 = 노트가 생성될 때마다 이동한거리
            if (!gameState.gameOver && this.sequence === 0 && !gameState.check[this.line - 1] && gameState.pressLongNoteYN[this.line - 1]) {
                //롱노트가 있는데 누르지 않는 경우
                gameState.longNotePanjung[this.line - 1] = '실패';
            }
        } else if (this.type === 'lns' || this.type === 'lne') {
            //롱노트 모양 구현
            thisNote.style.height = `calc(${(dpt * 0.1 * gameSettings.makeSpeed) * (this.term)}% + 20px)`;
        }

        if (this.top > 92 + dpt * 15) {//실패(나쁨 판정 이상으로 넘어감)판정일 경우
            comboCounter('실패', '', this.type, this.line);
            this.deleteNote();
            if (this.type === 'lnm') {
                gameState.longNotePanjung[this.line - 1] = '실패';
            }
        }

        this.checkHit(dpt);
    }

    //클릭 판정
    checkHit(dpt) {
        if (gameState.gameOver || this.sequence !== 0 || !gameState.check[this.line - 1]) return;
        //클릭 판정은 게임 중 + 우선순위 0 + 키보드 눌러질 때만 작동
        if (92 - dpt * 5 <= this.top && this.top <= 92 + dpt * 5) {
            if ((this.type === 'lns' || this.type === 'sn') || ((this.type === 'lnm' || this.type === 'lne') && gameState.longNotePanjung[this.line - 1] === '완벽')) {
                comboCounter('완벽', '', this.type, this.line);
                this.deleteNote();
            }
        } else if (92 - dpt * 10 <= this.top && this.top <= 92 + dpt * 10) {
            if (this.top < 95) {
                if ((this.type === 'lns' || this.type === 'sn') || ((this.type === 'lnm' || this.type === 'lne') && gameState.longNotePanjung[this.line - 1] === '성공빠름')) {
                    comboCounter('성공', '빠름', this.type, this.line);
                    this.deleteNote();
                }
            } else {
                if ((this.type === 'lns' || this.type === 'sn') || ((this.type === 'lnm' || this.type === 'lne') && gameState.longNotePanjung[this.line - 1] === '성공느림')) {
                    comboCounter('성공', '느림', this.type, this.line);
                    this.deleteNote();
                }
            }
        } else if (92 - dpt * 15 <= this.top && this.top <= 92 + dpt * 15) {
            if (this.top < 95) {
                if ((this.type === 'lns' || this.type === 'sn') || ((this.type === 'lnm' || this.type === 'lne') && gameState.longNotePanjung[this.line - 1] === '나쁨빠름')) {
                    comboCounter('나쁨', '빠름', this.type, this.line);
                    this.deleteNote();
                }
            } else {
                if ((this.type === 'lns' || this.type === 'sn') || ((this.type === 'lnm' || this.type === 'lne') && gameState.longNotePanjung[this.line - 1] === '나쁨느림')) {
                    comboCounter('나쁨', '느림', this.type, this.line);
                    this.deleteNote();
                }
            }
        }
    }

    deleteNote() {
        gameState.noteList[this.line - 1].shift(); //노트 리스트에서 자신 삭제
        domElements.lanes[this.line - 1].children[1].remove(); //라인 요소에서 자신 삭제(0은 빛)
        if (gameState.noteList[this.line - 1].length > 0) { //노트가 하나라도 존재하면
            gameState.noteList[this.line - 1].forEach(note => note.sequence--);
        }
    }

    setNoteTerm(term) {
        this.term = term;
    }
}

// Game Functions

/**
 * 노트가 생성될 라인을 무작위로 정한다.
 */
function setRandomLine() {
    let longLine = gameState.prevLongNoteYN.includes(true) ? gameState.prevLongNoteYN.findIndex(yn => yn) + 1 : 0; //롱노트가 있는 줄
    let ranLine = Math.floor(Math.random() * 4) + 1;

    while (ranLine === gameState.ranLine_prev || ranLine === longLine) { //현재 선택될 라인은 전 라인과 같거나 롱노트 라인과 같으면 안된다.
        ranLine = Math.floor(Math.random() * 4) + 1;
    }
    gameState.ranLine_prev = ranLine;

    return ranLine;
}

/**
* 콤보를 세고, 레이트를 계산한다.
* 
* @param panjung: '완벽', '성공','나쁨', '실패'
* @param fastslow: '', '
*/
function comboCounter(panjung, fastslow, type, line) {
    let text = '';
    let textDetail = '';
    let color = '';
    let colorDetail = '';

    switch (panjung) {
        case '완벽':
            text = '완벽';
            color = 'rgb(238, 192, 39)';
            gameState.comboCount++;
            gameState.perfectCount++;
            gameState.totalCombo++;
            gameState.score += 2 * BASE_SCORE * Math.sqrt(gameState.comboCount);
            gameState.myHP = Math.min(gameState.myHP + PERFECT_SCORE, MAX_HP);
            break;
        case '성공':
            text = '성공';
            color = 'rgb(39, 238, 172)';
            gameState.comboCount++;
            gameState.goodCount++;
            gameState.totalCombo++;
            gameState.score += 1 * BASE_SCORE * Math.sqrt(gameState.comboCount);
            gameState.myHP = Math.min(gameState.myHP + GOOD_SCORE, MAX_HP);
            break;
        case '나쁨':
            text = '나쁨';
            color = 'rgb(143, 86, 197)';
            gameState.comboCount = 0;
            gameState.badCount++;
            gameState.score += 0.5 * BASE_SCORE * Math.sqrt(gameState.comboCount);
            if (!gameSettings.mujuk) {
                gameState.myHP -= type === 'sn' ? BAD_PENALTY : BAD_PENALTY / 4;
            }
            break;
        case '실패':
            text = '실패';
            color = 'rgb(158, 158, 158)';
            gameState.comboCount = 0;
            gameState.missCount++;
            if (!gameSettings.mujuk) {
                gameState.myHP -= type === 'sn' ? MISS_PENALTY : MISS_PENALTY / 4;
            }
            break;
    }

    if (fastslow === '빠름') {
        textDetail = '빠름!';
        colorDetail = 'rgb(140, 161, 255)';
    } else if (fastslow === '느림') {
        textDetail = '느림';
        colorDetail = 'rgb(255, 140, 140)';
    }

    gameState.passCount++;

    //콤보 최대치 기록
    if(gameState.maxCombo < gameState.comboCount){
        gameState.maxCombo = gameState.comboCount;
    }

    updateLongNoteState(type, line, panjung, fastslow);
    updateUI(text, textDetail, color, colorDetail);
}

function updateLongNoteState(type, line, panjung, fastslow) {
    if (type === 'lns') {
        gameState.longNotePanjung[line - 1] = panjung + fastslow;
        gameState.pressLongNoteYN[line - 1] = true;
    } else if (type === 'lne') {
        gameState.longNotePanjung[line - 1] = '';
        gameState.pressLongNoteYN[line - 1] = false;
        gameState.check[line - 1] = false;
    } else if (type !== 'lnm') {
        gameState.check[line - 1] = false;
    }
}

function updateUI(text, textDetail, color, colorDetail) {
    // Update combo
    domElements.mainComboNumber.style.animation = 'none';
    domElements.mainComboNumber.offsetWidth;
    if (gameState.comboCount !== 0) {
        domElements.mainComboNumber.style.animation = 'entryCombo 0.2s';
        domElements.mainComboNumber.innerHTML = gameState.comboCount;
        domElements.mainComboText.innerHTML = 'COMBO';
    } else {
        domElements.mainComboNumber.innerHTML = '';
        domElements.mainComboText.innerHTML = '';
    }

    // Update rate
    const rate = (((gameState.perfectCount + gameState.goodCount * 0.6 + gameState.badCount * 0.2) / gameState.passCount) * 100).toFixed(2);
    domElements.mainFooterRate.innerHTML = `RATE ${rate}%`;

    // Update judgment text
    domElements.mainFooterText.style.animation = 'none';
    domElements.mainFooterText.offsetWidth;
    domElements.mainFooterText.style.animation = 'entryFooterText 0.2s';
    domElements.mainFooterText.innerHTML = text;
    domElements.mainFooterTextDetail.innerHTML = textDetail;

    // Set judgment text color
    domElements.mainFooterText.style.color = color;
    if (colorDetail) {
        domElements.mainFooterTextDetail.style.color = colorDetail;
    }
}

/**
 * 3초 뒤에 메인 동작을 시작시키는 함수입니다.
 */
function startGame() {
    domElements.noteSpeed.innerHTML = `x${(gameSettings.noteSpeed * 0.1).toFixed(1)}`;// 현재 스피드 표시
    let timerCount = 100;
    domElements.mainCounter.innerHTML = '3';

    gameState.timerCounter = setInterval(function () {
        gameState.startCount = true;
        if (timerCount >= 3000) {
            domElements.mainCounter.innerHTML = '';
            gameState.startCount = false;
            startTimer();
            clearInterval(gameState.timerCounter);
        } else if (timerCount >= 2000) {
            domElements.mainCounter.innerHTML = '1';
        } else if (timerCount >= 1000) {
            domElements.mainCounter.innerHTML = '2';
        }

        timerCount += 100;
    }, 100);//1초에 10번
}

/**
 * 상황에 따라 메인 동작을 중지시키는 함수입니다.
 */
function pauseGame() {
    if (gameState.startCount) {//카운트 중인 경우
        domElements.mainCounter.innerHTML = '';
        clearInterval(gameState.timerCounter);
        gameState.startCount = false;
    } else {//게임 중인 경우
        clearInterval(gameState.timer);
    }
}

/**
 * 노트를 파라매터로 정한 라인에 생성합니다.
 */
function makeNote(line, type, term) {
    const note = new Note(gameState.noteIndex[line - 1], line, type);
    gameState.noteList[line - 1].push(note);
    note.spanNote();

    if (type === 'lns' || type === 'lne') {
        note.setNoteTerm(term);
        gameState.longNoteStartEnd[line - 1] = gameState.noteIndex[line - 1]++;//롱노트 작동 방식
    }

    gameState.noteIndex[line - 1]++;
    gameState.noteCount++;
}

function startTimer() {
    gameState.gameOver = false;

    gameState.timer = setInterval(function () {
        if (gameState.noteCount < gameSettings.passCountAll) {//정해진 개수만 생성
            if (gameState.timeCount % gameSettings.makeSpeed === 0) {//생성 간격마다
                const line = setRandomLine();
                handleComplexNoteCreation(line);
            }
        }

        moveNotes();
        updateHealth();
        checkGameEnd();

        //1카운트 = 10ms
        gameState.timeCount += 10;

        //디버그
    }, 10);
}

function handleComplexNoteCreation(line) {
    if (gameState.prevLongNoteYN.includes(true)) {//롱노트가 화면 내에 존재한다면
        handleExistingLongNote(line);
    } else if (gameState.timeCount % (gameSettings.makeSpeed * 10) === 0 && gameState.noteCount < gameSettings.passCountAll - 8) {// 롱노트 생성
        createNewLongNote(line);
    } else {
        makeNote(line, 'sn');
    }
}

function handleExistingLongNote(line) {
    const longNoteLine = gameState.prevLongNoteYN.findIndex(yn => yn) + 1;
    if (gameState.longNoteTerm[longNoteLine - 1] === 0) {
        endLongNote(longNoteLine, line);
    } else {
        continueLongNote(line, longNoteLine);
    }
}

//롱노트가 끝나면
function endLongNote(longNoteLine, line) {
    //롱노트 끝 노트 생성
    makeNote(longNoteLine, 'lne', gameState.longNoteTermRecode[longNoteLine - 1]);
    gameState.longNoteTermRecode[longNoteLine - 1] = 0;
    gameState.prevLongNoteYN[longNoteLine - 1] = false;

    //50% 확률로 롱노트 끝에 다른 줄의 노트 추가
    if (Math.random() < 0.5) {
        makeNote(line, 'sn');
    }
}

function continueLongNote(line, longNoteLine) {
    makeNote(line, 'sn'); //롱노트가 있는 동안에도 다른 노트 계속 생성
    makeNote(longNoteLine, 'lnm'); //롱노트 중간 노트 생성
    gameState.longNoteTerm[longNoteLine - 1]--;
}

function createNewLongNote(line) {
    const ranTerm = gameSettings.longNoteTermList[Math.floor(Math.random() * 4)];
    gameState.longNoteTerm[line - 1] = ranTerm; //롱노트 텀
    gameState.longNoteTermRecode[line - 1] = ranTerm; //롱노트 텀 기록
    gameState.prevLongNoteYN[line - 1] = true; //롱노트 존재여부
    makeNote(line, 'lns', ranTerm);
}

//노트 떨어트리기
function moveNotes() {
    const noteListFlat = gameState.noteList.flat();
    for (let i = 0; i < noteListFlat.length; i++) {
        noteListFlat[i].fallNote(gameSettings.noteSpeed);
    }
}

//체력세팅
function updateHealth() {
    gameState.myHP = Math.max(0, Math.min(gameState.myHP, MAX_HP));
    const myHPpercent = ((gameState.myHP / MAX_HP) * 100).toFixed(2);
    document.documentElement.style.setProperty('--myHPpercent', myHPpercent);
    
    if (myHPpercent > 30) {
        domElements.myHP.style.background = "white";
    } else if (myHPpercent > 0) {
        domElements.myHP.style.background = "rgb(255, 36, 54)";
    } else if (!gameState.gameOver) {//한 번만 실행
        handleGameOver();
    }
}

function handleGameOver() {
    gameState.gameOver = true;
    domElements.overContainer.style.transition = 'opacity 3s';
    domElements.overContainer.style.opacity = '1';
    setTimeout(function () {//다시하기는 나중에 뜬다
        clearTimer();
        domElements.gameOverReplay.style.opacity = '1';
        domElements.overContainer.style.pointerEvents = 'all';
    }, 3000);
}

//최종 판단
function checkGameEnd() {
    if (gameSettings.passCountAll === gameState.passCount) {
        pauseGame();
        let endingText = 'CLEAR';
        if (gameState.passCount === gameState.perfectCount) {
            endingText = 'PERFECT<br>COMBO';
        } else if (gameState.passCount === (gameState.perfectCount + gameState.goodCount)) {
            endingText = "ALL<br>COMBO";
        }

        // localStorage에 결과값 저장
        localStorage.setItem('score', Math.round(gameState.score));
        localStorage.setItem('rate', (((gameState.perfectCount + gameState.goodCount * 0.6 + gameState.badCount * 0.2) / gameState.passCount) * 100).toFixed(2));
        localStorage.setItem('maxCombo', gameState.maxCombo);
        localStorage.setItem('totalCombo', gameState.totalCombo);
        localStorage.setItem('perfectCount', gameState.perfectCount);
        localStorage.setItem('goodCount', gameState.goodCount);
        localStorage.setItem('badCount', gameState.badCount);
        localStorage.setItem('missCount', gameState.missCount);

        showEnding(endingText);
    }
}

function showEnding(endingText) {
    setTimeout(function () {
        domElements.mainEnding.innerHTML = endingText;
        domElements.mainEnding.style.opacity = '1';
        domElements.mainEnding.style.animation = 'none';
        domElements.mainEnding.offsetWidth;
        domElements.mainEnding.style.animation = 'entryEnding 0.2s';
        setTimeout(function () {
            domElements.container.style.animation = 'none';
            domElements.container.offsetWidth;
            domElements.container.style.animation = 'stageClearAnimation 0.25s';
            setTimeout(function () {
                window.location.href = 'result.html';
            }, 2000);
        }, 200);
        resetUI();
    }, 1500);
}

function resetUI() {
    domElements.mainFooterText.innerHTML = '';
    domElements.mainFooterTextDetail.innerHTML = '';
    domElements.mainComboNumber.innerHTML = '';
    domElements.mainComboText.innerHTML = '';
}

function clearTimer() {
    if (gameState.timer != null) {
        clearInterval(gameState.timer);
    }
    resetGameState();
    resetUI();
    resetHealth();
}

function resetGameState() {
    for (let i = 0; i < 4; i++) {
        domElements.lanes[i].innerHTML = `<div class="hitLight" id="hL${i + 1}"></div>`;
    }
    gameState.noteList = [[], [], [], []];
    gameState.noteIndex = [0, 0, 0, 0];
    gameState.noteCount = 0;
    gameState.timeCount = 10;
    gameState.comboCount = 0;
    gameState.perfectCount = 0;
    gameState.goodCount = 0;
    gameState.badCount = 0;
    gameState.missCount = 0;
    gameState.passCount = 0;
    gameState.esc = false;
    gameState.escMenu = 1;
    gameState.startCount = false;
    gameState.gameOver = false;
    gameState.prevLongNoteYN = [false, false, false, false];
    gameState.pressLongNoteYN = [false, false, false, false];
    gameState.longNoteTerm = [0, 0, 0, 0];
    gameState.longNoteTermRecode = [0, 0, 0, 0];
    gameState.longNotePanjung = ['', '', '', ''];
    gameState.longNoteStartEnd = [0, 0, 0, 0];
}

//체력 원상복구
function resetHealth() {
    gameState.myHP = MAX_HP;
    document.documentElement.style.setProperty('--myHPpercent', 100);
    domElements.myHP.style.background = "white";
    domElements.mainFooterRate.innerHTML = 'RATE 0.00%';
    domElements.mainEnding.style.opacity = '0';
}


// 상수 정의
const KEYS = {
    D: 68,
    F: 70,
    J: 74,
    K: 75,
    ESC: 27,
    ENTER: 13,
    ONE: 49,
    TWO: 50
};
const LANES = [KEYS.D, KEYS.F, KEYS.J, KEYS.K];

// 이벤트 리스너 등록
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

// 각 레인에 터치/클릭 이벤트 추가
domElements.footers.forEach((footer, index) => {
    footer.addEventListener('mousedown', () => handleLaneInteraction(index + 1, true));
    footer.addEventListener('mouseup', () => handleLaneInteraction(index + 1, false));
    footer.addEventListener('touchstart', () => handleLaneInteraction(index + 1, true));
    footer.addEventListener('touchend', () => handleLaneInteraction(index + 1, false));
});

// 기타 버튼 이벤트 등록
domElements.escConnectBtn.addEventListener('click', handleEscConnect);
domElements.escReplayBtn.addEventListener('click', handleEscReplay);
domElements.escSettingBtn.addEventListener('click', handleEscSetting);
domElements.escLobbyBtn.addEventListener('click', handleEscLobby);
domElements.gameOverReplay.addEventListener('click', handleGameOverReplay);


// 키 입력 핸들러
function handleKeyDown(e) {
    const action = {
        [KEYS.D]: () => handleLaneInteraction(1, true),
        [KEYS.F]: () => handleLaneInteraction(2, true),
        [KEYS.J]: () => handleLaneInteraction(3, true),
        [KEYS.K]: () => handleLaneInteraction(4, true),
        [KEYS.ESC]: handleEscKey,
        [KEYS.ONE]: decreaseNoteSpeed,
        [KEYS.TWO]: increaseNoteSpeed
    }[e.keyCode];

    if (action) action();

    if (gameState.esc) handleEscMenuNavigation(e);
    if (gameState.gameOver && domElements.gameOverReplay.style.opacity === '1' && e.keyCode === KEYS.ENTER) {
        handleGameOverReplay();
    }
}

// 키 해제 핸들러
function handleKeyUp(e) {
    if (LANES.includes(e.keyCode)) {
        const index = LANES.indexOf(e.keyCode) + 1;
        handleLaneInteraction(index, false);
    }
}

// 레인 상호작용 핸들러
function handleLaneInteraction(index, isPressed) {
    if (index >= 1 && index <= 4) {
        gameState.check[index - 1] = isPressed;
        gameState.press[index - 1] = isPressed;
        updateLaneUI(index, isPressed);
    }
}


function updateLaneUI(index, isKeyDown) {
    const lane = domElements.lanes[index - 1];
    const footer = domElements.footers[index - 1];
    const hitLight = domElements.hitLights[index - 1];

    if (isKeyDown) {
        lane.style.background = 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 50%, rgba(238, 152, 39, 0.7))';
        footer.style = 'border-top: solid 7px rgb(1, 54, 68); background: rgb(238, 152, 39)';
        hitLight.style.opacity = '1';
        hitLight.style.width = '100px';
        hitLight.style.height = '100px';
    } else {
        lane.style.background = 'rgb(0,0,0,0)';
        footer.style = 'border-top: solid 3px rgb(51, 54, 68); background: rgb(197, 197, 207);';
        hitLight.style.opacity = '0';
        hitLight.style.width = '50px';
        hitLight.style.height = '50px';
    }
}

function handleEscKey() {
    if (!gameState.esc) {
        gameState.esc = true;
        pauseGame();
        domElements.escContainer.style.opacity = '1';
        domElements.escContainer.style.pointerEvents = 'all';
        gameState.escMenu = 1;
    } else {
        //esc 상태에서 esc 한 번 더 누르면
        gameState.esc = false;
        domElements.escConnectBtn.click();
    }
}

function decreaseNoteSpeed() {//1 속도 감소
    gameSettings.noteSpeed = Math.max(10, gameSettings.noteSpeed - 1);
    updateNoteSpeedDisplay();
}

function increaseNoteSpeed() {//2 속도 증가
    gameSettings.noteSpeed = Math.min(99, gameSettings.noteSpeed + 1);
    updateNoteSpeedDisplay();
}

function updateNoteSpeedDisplay() {
    localStorage.setItem('noteSpeed', gameSettings.noteSpeed);
    domElements.noteSpeed.innerHTML = `x${(gameSettings.noteSpeed * 0.1).toFixed(1)}`;
}

function handleEscMenuNavigation(e) {
    if (e.keyCode === 13) { // Enter
        handleEscMenuSelection();
    } else if (e.keyCode === 40) { // Down arrow
        navigateEscMenu(1);
    } else if (e.keyCode === 38) { // Up arrow
        navigateEscMenu(-1);
    }
}

function handleEscMenuSelection() {
    document.getElementById('escBtnBox').children[gameState.escMenu - 1].classList.toggle('escBtnSelect');
    document.getElementById('escBtnBox').children[0].classList.add('escBtnSelect');
    const actions = [
        () => domElements.escConnectBtn.click(),
        () => domElements.escReplayBtn.click(),
        () => domElements.escSettingBtn.click(),
        () => domElements.escLobbyBtn.click()
    ];
    actions[gameState.escMenu - 1]();
}

//위 아래 키 누를 시 키선택 이동
function navigateEscMenu(direction) {
    document.getElementById('escBtnBox').children[gameState.escMenu - 1].classList.toggle('escBtnSelect');
    gameState.escMenu = ((gameState.escMenu - 1 + direction + 4) % 4) + 1;
    document.getElementById('escBtnBox').children[gameState.escMenu - 1].classList.toggle('escBtnSelect');
}

//ESC 이어하기
function handleEscConnect() {
    domElements.escContainer.style.opacity = '0';
    domElements.escContainer.style.pointerEvents = 'none';
    gameState.esc = false;
    startGame();
}
//ESC 재시작
function handleEscReplay() {
    domElements.escContainer.style.opacity = '0';
    domElements.escContainer.style.pointerEvents = 'none';
    clearTimer();
    startGame();
}
//ESC 환경설정
function handleEscSetting() {
    domElements.escContainer.style.opacity = '0';
    domElements.escContainer.style.pointerEvents = 'none';
    clearTimer();
    startGame();
}
// ESC 메인화면으로
function handleEscLobby() {
    domElements.escContainer.style.opacity = '0';
    domElements.escContainer.style.pointerEvents = 'none';
    clearTimer();
    location.href = "main.html";
}
//게임오버 다시하기
function handleGameOverReplay() {
    domElements.overContainer.style.transition = 'none';
    domElements.overContainer.style.opacity = '0'
    domElements.gameOverReplay.style.opacity = '0'
    domElements.overContainer.style.pointerEvents = 'none';

    clearTimer();
    startGame();
}

//CD돌리기
let degCD = 0;
let timerCD = setInterval(function () {
    degCD = degCD + 2;
    if(degCD >= 360){
        degCD = 0;
    }
    theme.style.setProperty('--degCD',degCD);
}, 100);

domElements.songTitle.innerHTML = savedChart?.title ?? 'RANDOM';

startGame();