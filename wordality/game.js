// =============================================
// WORDALITY - Game Logic
// =============================================

class Wordality {
    constructor() {
        this.phase = 'wordle'; // 'wordle' | 'transition' | 'bee' | 'end'
        this.wordle = null;
        this.bee = null;
        this.init();
    }

    init() {
        this.wordle = new WordleGame(this);
        this.showPhase('wordle');
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.getElementById('play-again-btn').addEventListener('click', () => this.restart());
        document.getElementById('start-bee-btn').addEventListener('click', () => this.startBeePhase());
    }

    handleKeyDown(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (this.phase === 'wordle') {
            this.wordle.handleKey(e.key);
        } else if (this.phase === 'bee') {
            this.bee.handleKey(e.key);
        }
    }

    showPhase(phase) {
        this.phase = phase;
        document.querySelectorAll('.phase').forEach(p => p.classList.remove('active'));
        const el = document.getElementById(
            phase === 'wordle' ? 'wordle-phase' :
            phase === 'transition' ? 'transition-phase' :
            phase === 'bee' ? 'bee-phase' : 'end-phase'
        );
        if (el) el.classList.add('active');
    }

    onWordleComplete(won, targetWord, guessCount) {
        if (won) {
            this.showTransition(targetWord, guessCount);
        } else {
            // Lost wordle - still transition but with different message
            this.showTransition(targetWord, guessCount, true);
        }
    }

    showTransition(word, guessCount, lost = false) {
        this.showPhase('transition');
        const icon = document.getElementById('transition-icon');
        const title = document.getElementById('transition-title');
        const wordReveal = document.getElementById('transition-word-reveal');
        const subtitle = document.getElementById('transition-subtitle');
        const lettersContainer = document.getElementById('transition-letters');

        if (lost) {
            icon.textContent = '!';
            icon.style.background = 'var(--present)';
            title.textContent = 'Not quite!';
        } else {
            icon.textContent = '\u2713';
            icon.style.background = 'var(--correct)';
            if (guessCount <= 3) title.textContent = 'Brilliant!';
            else if (guessCount <= 6) title.textContent = 'Nice!';
            else title.textContent = 'Phew!';
        }

        wordReveal.textContent = word.toUpperCase();
        subtitle.textContent = 'Those 7 letters are now your Spelling Bee!';

        lettersContainer.innerHTML = '';
        const letters = [...new Set(word.toLowerCase().split(''))];
        // If the word has repeated letters, use all unique letters
        // Pad to 7 if needed (shouldn't happen with our target words)
        letters.forEach(letter => {
            const div = document.createElement('div');
            div.className = 'transition-letter';
            div.textContent = letter.toUpperCase();
            lettersContainer.appendChild(div);
        });

        this.pendingBeeLetters = letters;
    }

    startBeePhase() {
        this.bee = new SpellingBeeGame(this, this.pendingBeeLetters);
        this.showPhase('bee');
        this.bee.start();
    }

    onBeeComplete(score, foundWords, allValidWords) {
        this.showPhase('end');
        this.showEndScreen(score, foundWords, allValidWords);
    }

    showEndScreen(score, foundWords, allValidWords) {
        document.getElementById('stat-wordle-guesses').textContent = this.wordle.currentRow;
        document.getElementById('stat-bee-score').textContent = score;
        document.getElementById('stat-words-found').textContent = foundWords.length;

        const pangrams = foundWords.filter(w => this.isPangram(w, this.pendingBeeLetters));
        document.getElementById('stat-pangrams').textContent = pangrams.length;

        // Found words
        const foundContainer = document.getElementById('end-found-words');
        foundContainer.innerHTML = '';
        [...foundWords].sort().forEach(word => {
            const div = document.createElement('div');
            div.className = 'found-word' + (this.isPangram(word, this.pendingBeeLetters) ? ' pangram' : '');
            div.textContent = word;
            foundContainer.appendChild(div);
        });

        // Missed words
        const missedContainer = document.getElementById('end-missed-words');
        missedContainer.innerHTML = '';
        const missed = allValidWords.filter(w => !foundWords.includes(w)).sort();
        if (missed.length === 0) {
            missedContainer.innerHTML = '<span style="color: var(--success); font-size: 0.85rem;">You found them all!</span>';
        } else {
            missed.slice(0, 50).forEach(word => {
                const div = document.createElement('div');
                div.className = 'missed-word' + (this.isPangram(word, this.pendingBeeLetters) ? ' pangram' : '');
                div.textContent = word;
                missedContainer.appendChild(div);
            });
            if (missed.length > 50) {
                const more = document.createElement('div');
                more.className = 'missed-word';
                more.textContent = `+${missed.length - 50} more`;
                missedContainer.appendChild(more);
            }
        }
    }

    isPangram(word, letters) {
        const letterSet = new Set(letters);
        const wordLetters = new Set(word.toLowerCase().split(''));
        for (const l of letterSet) {
            if (!wordLetters.has(l)) return false;
        }
        return true;
    }

    restart() {
        // Clean up
        if (this.bee && this.bee.timer) {
            clearInterval(this.bee.timer);
        }
        document.getElementById('wordle-board').innerHTML = '';
        document.getElementById('keyboard').innerHTML = '';
        document.getElementById('wordle-message').textContent = '';
        document.getElementById('wordle-message').className = '';

        this.wordle = new WordleGame(this);
        this.bee = null;
        this.showPhase('wordle');
    }
}

// =============================================
// WORDLE GAME
// =============================================
class WordleGame {
    constructor(parent) {
        this.parent = parent;
        this.maxGuesses = 10;
        this.wordLength = 7;
        this.currentRow = 0;
        this.currentCol = 0;
        this.currentGuess = '';
        this.gameOver = false;
        this.won = false;
        this.revealing = false;
        this.keyStates = {}; // letter -> 'correct' | 'present' | 'absent'

        // Pick a random target word
        this.target = this.pickTarget();
        this.buildBoard();
        this.buildKeyboard();
        this.updateGuessCounter();
    }

    pickTarget() {
        // Filter for words with mostly unique letters
        const candidates = TARGET_WORDS.filter(w => {
            const lower = w.toLowerCase();
            return lower.length === 7 && new Set(lower.split('')).size >= 6;
        });
        const word = candidates[Math.floor(Math.random() * candidates.length)] || 'strange';
        return word.toLowerCase();
    }

    buildBoard() {
        const board = document.getElementById('wordle-board');
        board.innerHTML = '';
        for (let r = 0; r < this.maxGuesses; r++) {
            const row = document.createElement('div');
            row.className = 'wordle-row';
            row.id = `row-${r}`;
            for (let c = 0; c < this.wordLength; c++) {
                const tile = document.createElement('div');
                tile.className = 'wordle-tile';
                tile.id = `tile-${r}-${c}`;
                row.appendChild(tile);
            }
            board.appendChild(row);
        }
    }

    buildKeyboard() {
        const container = document.getElementById('keyboard');
        container.innerHTML = '';
        const rows = [
            'qwertyuiop',
            'asdfghjkl',
            'zxcvbnm'
        ];
        rows.forEach((row, i) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';

            if (i === 2) {
                const enter = document.createElement('button');
                enter.className = 'key wide';
                enter.textContent = 'Enter';
                enter.addEventListener('click', () => this.handleKey('Enter'));
                rowDiv.appendChild(enter);
            }

            [...row].forEach(letter => {
                const key = document.createElement('button');
                key.className = 'key';
                key.textContent = letter;
                key.id = `key-${letter}`;
                key.addEventListener('click', () => this.handleKey(letter));
                rowDiv.appendChild(key);
            });

            if (i === 2) {
                const backspace = document.createElement('button');
                backspace.className = 'key wide';
                backspace.textContent = '\u232B';
                backspace.addEventListener('click', () => this.handleKey('Backspace'));
                rowDiv.appendChild(backspace);
            }

            container.appendChild(rowDiv);
        });
    }

    handleKey(key) {
        if (this.gameOver || this.revealing) return;

        if (key === 'Enter') {
            this.submitGuess();
        } else if (key === 'Backspace' || key === 'Delete') {
            this.deleteLetter();
        } else if (/^[a-zA-Z]$/.test(key)) {
            this.addLetter(key.toLowerCase());
        }
    }

    addLetter(letter) {
        if (this.currentCol >= this.wordLength) return;
        this.currentGuess += letter;
        const tile = document.getElementById(`tile-${this.currentRow}-${this.currentCol}`);
        tile.textContent = letter.toUpperCase();
        tile.classList.add('filled');
        this.currentCol++;
    }

    deleteLetter() {
        if (this.currentCol <= 0) return;
        this.currentCol--;
        this.currentGuess = this.currentGuess.slice(0, -1);
        const tile = document.getElementById(`tile-${this.currentRow}-${this.currentCol}`);
        tile.textContent = '';
        tile.classList.remove('filled');
    }

    submitGuess() {
        if (this.currentGuess.length !== this.wordLength) {
            this.showMessage('Not enough letters', 'error');
            this.shakeRow(this.currentRow);
            return;
        }

        // Validate guess is in dictionary
        if (!DICTIONARY.has(this.currentGuess)) {
            this.showMessage('Not in word list', 'error');
            this.shakeRow(this.currentRow);
            return;
        }

        const result = this.checkGuess(this.currentGuess);
        this.revealTiles(result);
    }

    checkGuess(guess) {
        const result = [];
        const targetArr = this.target.split('');
        const guessArr = guess.split('');
        const used = new Array(this.wordLength).fill(false);

        // First pass: find correct (green)
        for (let i = 0; i < this.wordLength; i++) {
            if (guessArr[i] === targetArr[i]) {
                result[i] = { letter: guessArr[i], status: 'correct' };
                used[i] = true;
            } else {
                result[i] = { letter: guessArr[i], status: 'absent' };
            }
        }

        // Second pass: find present (yellow)
        for (let i = 0; i < this.wordLength; i++) {
            if (result[i].status === 'correct') continue;
            for (let j = 0; j < this.wordLength; j++) {
                if (!used[j] && guessArr[i] === targetArr[j]) {
                    result[i].status = 'present';
                    used[j] = true;
                    break;
                }
            }
        }

        return result;
    }

    revealTiles(result) {
        this.revealing = true;
        const row = this.currentRow;
        const won = result.every(r => r.status === 'correct');

        result.forEach((r, i) => {
            const tile = document.getElementById(`tile-${row}-${i}`);
            setTimeout(() => {
                tile.classList.add('reveal');
                setTimeout(() => {
                    tile.classList.add(r.status);
                    tile.classList.remove('reveal');
                }, 150);
            }, i * 200);
        });

        // Update keyboard after reveal animation
        setTimeout(() => {
            this.revealing = false;
            result.forEach(r => {
                const currentState = this.keyStates[r.letter];
                if (r.status === 'correct') {
                    this.keyStates[r.letter] = 'correct';
                } else if (r.status === 'present' && currentState !== 'correct') {
                    this.keyStates[r.letter] = 'present';
                } else if (!currentState) {
                    this.keyStates[r.letter] = 'absent';
                }
            });
            this.updateKeyboard();

            if (won) {
                this.gameOver = true;
                this.won = true;
                this.currentRow++;
                this.showMessage('', 'success');
                setTimeout(() => {
                    this.parent.onWordleComplete(true, this.target, this.currentRow);
                }, 600);
            } else {
                this.currentRow++;
                this.currentCol = 0;
                this.currentGuess = '';
                this.updateGuessCounter();

                if (this.currentRow >= this.maxGuesses) {
                    this.gameOver = true;
                    this.showMessage(`The word was ${this.target.toUpperCase()}`, 'error');
                    setTimeout(() => {
                        this.parent.onWordleComplete(false, this.target, this.currentRow);
                    }, 2000);
                }
            }
        }, this.wordLength * 200 + 300);
    }

    updateKeyboard() {
        Object.keys(this.keyStates).forEach(letter => {
            const key = document.getElementById(`key-${letter}`);
            if (key) {
                key.className = 'key ' + this.keyStates[letter];
            }
        });
    }

    updateGuessCounter() {
        document.getElementById('guess-counter').textContent =
            `Guess ${this.currentRow + 1} of ${this.maxGuesses}`;
    }

    showMessage(msg, type) {
        const el = document.getElementById('wordle-message');
        el.textContent = msg;
        el.className = type || '';
        if (msg) {
            setTimeout(() => {
                el.textContent = '';
                el.className = '';
            }, 2000);
        }
    }

    shakeRow(row) {
        const rowEl = document.getElementById(`row-${row}`);
        rowEl.classList.add('shake');
        setTimeout(() => rowEl.classList.remove('shake'), 500);
    }
}

// =============================================
// SPELLING BEE GAME
// =============================================
class SpellingBeeGame {
    constructor(parent, letters) {
        this.parent = parent;
        this.letters = letters; // array of unique letters
        this.centerIndex = 0;
        this.currentInput = '';
        this.foundWords = [];
        this.score = 0;
        this.timePerLetter = 10; // seconds
        this.timeRemaining = this.timePerLetter;
        this.timer = null;
        this.lastTick = null;
        this.allValidWords = this.computeAllValidWords();

        this.buildHoneycomb();
        this.buildControls();
        this.updateDisplay();
        this.updateFoundWordsTotal();
        this.updateWordDisplay();
        // Clear found words from any previous game
        document.getElementById('found-words-list').innerHTML = '';
    }

    get centerLetter() {
        return this.letters[this.centerIndex];
    }

    computeAllValidWords() {
        // Find all valid words using these letters (with the current center constraint being
        // that at least one of the letters is the center - we compute ALL valid words and
        // filter per-center-letter during gameplay)
        const letterSet = new Set(this.letters);
        const valid = [];

        DICTIONARY.forEach(word => {
            if (word.length < 4) return;
            // Check all characters are in our letter set
            for (const ch of word) {
                if (!letterSet.has(ch)) return;
            }
            // Check word uses at least one of our letters as center at some point
            valid.push(word);
        });

        return valid;
    }

    getWordsForCenter(centerLetter) {
        return this.allValidWords.filter(w => w.includes(centerLetter));
    }

    buildHoneycomb() {
        const container = document.getElementById('honeycomb');
        container.innerHTML = '';

        // Hex positions: center + 6 surrounding
        // Center at (79, 69), surrounding at ~82px distance
        const cx = 79, cy = 69;
        const dist = 78;
        const positions = [
            { x: cx, y: cy }, // center (index 0 maps to centerIndex)
        ];

        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 2) + (i * Math.PI / 3); // Start from top
            positions.push({
                x: cx + dist * Math.cos(angle),
                y: cy - dist * Math.sin(angle)
            });
        }

        // Map letter indices to positions
        // Position 0 is center, positions 1-6 are outer
        const outerLetters = this.letters.filter((_, i) => i !== this.centerIndex);

        // Center hex
        const centerHex = this.createHex(this.letters[this.centerIndex], true, positions[0]);
        container.appendChild(centerHex);

        // Outer hexes
        outerLetters.forEach((letter, i) => {
            const hex = this.createHex(letter, false, positions[i + 1]);
            container.appendChild(hex);
        });
    }

    createHex(letter, isCenter, pos) {
        const hex = document.createElement('div');
        hex.className = `hex-cell ${isCenter ? 'center' : 'outer'}`;
        hex.textContent = letter.toUpperCase();
        hex.style.left = `${pos.x - 36}px`;
        hex.style.top = `${pos.y - 36}px`;
        hex.addEventListener('click', () => {
            this.addBeeLetterInput(letter);
        });
        return hex;
    }

    buildControls() {
        document.getElementById('delete-bee-btn').onclick = () => this.deleteBeeInput();
        document.getElementById('shuffle-btn').onclick = () => this.shuffleLetters();
        document.getElementById('submit-bee-btn').onclick = () => this.submitBeeWord();
    }

    handleKey(key) {
        if (key === 'Enter') {
            this.submitBeeWord();
        } else if (key === 'Backspace' || key === 'Delete') {
            this.deleteBeeInput();
        } else if (/^[a-zA-Z]$/.test(key)) {
            this.addBeeLetterInput(key.toLowerCase());
        }
    }

    addBeeLetterInput(letter) {
        const l = letter.toLowerCase();
        if (!this.letters.includes(l)) return;
        if (this.currentInput.length >= 15) return;
        this.currentInput += l;
        this.updateWordDisplay();
    }

    deleteBeeInput() {
        if (this.currentInput.length === 0) return;
        this.currentInput = this.currentInput.slice(0, -1);
        this.updateWordDisplay();
    }

    updateWordDisplay() {
        const display = document.getElementById('bee-current-word');
        if (this.currentInput.length === 0) {
            display.innerHTML = '<span class="cursor"></span>';
        } else {
            display.innerHTML = this.currentInput.split('').map(
                l => `<span class="letter">${l.toUpperCase()}</span>`
            ).join('') + '<span class="cursor"></span>';
        }
    }

    submitBeeWord() {
        const word = this.currentInput.toLowerCase();
        this.currentInput = '';
        this.updateWordDisplay();

        if (word.length < 4) {
            this.showBeeMessage('Too short (min 4 letters)', 'error');
            return;
        }

        // Check all letters are valid
        const letterSet = new Set(this.letters);
        for (const ch of word) {
            if (!letterSet.has(ch)) {
                this.showBeeMessage('Invalid letter used', 'error');
                return;
            }
        }

        // Check center letter
        if (!word.includes(this.centerLetter)) {
            this.showBeeMessage(`Must include center letter: ${this.centerLetter.toUpperCase()}`, 'error');
            return;
        }

        // Check dictionary
        if (!DICTIONARY.has(word)) {
            this.showBeeMessage('Not in word list', 'error');
            return;
        }

        // Check already found
        if (this.foundWords.includes(word)) {
            this.showBeeMessage('Already found!', 'error');
            return;
        }

        // Valid word!
        this.foundWords.push(word);
        const points = this.calculatePoints(word);
        this.score += points;

        const isPangram = this.parent.isPangram(word, this.letters);

        if (isPangram) {
            this.showBeeMessage(`PANGRAM! +${points} points`, 'pangram');
        } else {
            this.showBeeMessage(`+${points} point${points > 1 ? 's' : ''}`, 'success');
        }

        this.updateDisplay();
        this.addFoundWordPill(word, isPangram);

        // Animate score
        const scoreEl = document.getElementById('score');
        scoreEl.classList.add('score-pop');
        setTimeout(() => scoreEl.classList.remove('score-pop'), 300);
    }

    calculatePoints(word) {
        const isPangram = this.parent.isPangram(word, this.letters);
        if (word.length === 4) return 1;
        let points = word.length;
        if (isPangram) points += 7;
        return points;
    }

    addFoundWordPill(word, isPangram) {
        const list = document.getElementById('found-words-list');
        const pill = document.createElement('div');
        pill.className = 'found-word' + (isPangram ? ' pangram' : '');
        pill.textContent = word.toUpperCase();
        list.insertBefore(pill, list.firstChild);
    }

    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('words-found-count').textContent = this.foundWords.length;
    }

    updateFoundWordsTotal() {
        const total = this.allValidWords.length;
        document.getElementById('found-words-total').textContent = `${total} possible words`;
    }

    showBeeMessage(msg, type) {
        const el = document.getElementById('bee-message');
        el.textContent = msg;
        el.className = type || '';
        setTimeout(() => {
            el.textContent = '';
            el.className = '';
        }, 1500);
    }

    shuffleLetters() {
        // Shuffle outer letters (keep center in place)
        const outer = this.letters.filter((_, i) => i !== this.centerIndex);
        for (let i = outer.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [outer[i], outer[j]] = [outer[j], outer[i]];
        }

        // Rebuild letters array with center in place
        const newLetters = [];
        let outerIdx = 0;
        for (let i = 0; i < this.letters.length; i++) {
            if (i === this.centerIndex) {
                newLetters.push(this.letters[this.centerIndex]);
            } else {
                newLetters.push(outer[outerIdx++]);
            }
        }
        this.letters = newLetters;
        this.buildHoneycomb();
    }

    start() {
        this.lastTick = Date.now();
        this.timeRemaining = this.timePerLetter;
        this.updateTimer();
        this.timer = setInterval(() => this.tick(), 50);
    }

    tick() {
        const now = Date.now();
        const delta = (now - this.lastTick) / 1000;
        this.lastTick = now;
        this.timeRemaining -= delta;

        if (this.timeRemaining <= 0) {
            this.rotateCenter();
        }

        this.updateTimer();
    }

    rotateCenter() {
        this.centerIndex++;
        if (this.centerIndex >= this.letters.length) {
            // Game over
            clearInterval(this.timer);
            this.timer = null;
            setTimeout(() => {
                this.parent.onBeeComplete(this.score, this.foundWords, this.allValidWords);
            }, 500);
            return;
        }

        this.timeRemaining = this.timePerLetter;
        this.currentInput = '';
        this.updateWordDisplay();
        this.buildHoneycomb();

        // Pulse animation on center hex
        const centerHex = document.querySelector('.hex-cell.center');
        if (centerHex) {
            centerHex.classList.add('center-pulse');
            setTimeout(() => centerHex.classList.remove('center-pulse'), 600);
        }
    }

    updateTimer() {
        const fraction = Math.max(0, this.timeRemaining / this.timePerLetter);
        const bar = document.getElementById('timer-bar');
        bar.style.width = `${fraction * 100}%`;

        // Color based on time remaining
        bar.classList.remove('warning', 'critical');
        if (this.timeRemaining <= 3) {
            bar.classList.add('critical');
        } else if (this.timeRemaining <= 5) {
            bar.classList.add('warning');
        }

        document.getElementById('timer-text').textContent = `${Math.ceil(Math.max(0, this.timeRemaining))}s`;
        document.getElementById('rotation-text').textContent = `Letter ${this.centerIndex + 1}/${this.letters.length}`;
    }
}

// =============================================
// START THE GAME
// =============================================
const game = new Wordality();
