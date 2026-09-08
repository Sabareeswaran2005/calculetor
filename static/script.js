/**
 * Modern Flask Calculator - Frontend JavaScript Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. DOM Element References
    // -------------------------------------------------------------------------
    const mainDisplay = document.getElementById('main-display');
    const expressionDisplay = document.getElementById('expression-display');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const historyToggleBtn = document.getElementById('history-toggle');
    const historyPanel = document.getElementById('history-panel');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const copyBtn = document.getElementById('copy-btn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Keypad Buttons
    const keypad = document.querySelector('.calculator-keypad');

    // -------------------------------------------------------------------------
    // 2. Application State Variables
    // -------------------------------------------------------------------------
    let currentInput = '0';
    let expression = '';
    let isCalculated = false;
    let history = JSON.parse(localStorage.getItem('calc_history') || '[]');
    let activeOperator = null;

    // -------------------------------------------------------------------------
    // 3. UI Display Updater
    // -------------------------------------------------------------------------
    function updateDisplay() {
        // Remove error styling by default
        mainDisplay.classList.remove('error-text');

        // Update Main Output Display
        mainDisplay.textContent = currentInput;

        // Auto-scale font size if input string is long
        if (currentInput.length > 12) {
            mainDisplay.style.fontSize = '1.5rem';
        } else if (currentInput.length > 8) {
            mainDisplay.style.fontSize = '1.8rem';
        } else {
            mainDisplay.style.fontSize = '2.3rem';
        }

        // Update Expression Preview Line
        expressionDisplay.textContent = expression;
    }

    function showToast(msg) {
        toastMessage.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }

    // -------------------------------------------------------------------------
    // 4. Calculator Input Handler Actions
    // -------------------------------------------------------------------------

    // Append digit (0-9) or decimal (.)
    function handleDigit(digit) {
        if (isCalculated) {
            currentInput = digit === '.' ? '0.' : digit;
            expression = '';
            isCalculated = false;
        } else {
            if (digit === '.') {
                if (currentInput.includes('.')) return; // Prevent multiple decimal points
                currentInput += '.';
            } else {
                if (currentInput === '0') {
                    currentInput = digit;
                } else {
                    currentInput += digit;
                }
            }
        }
        updateDisplay();
    }

    // Append Operator (+, -, ×, ÷)
    function handleOperator(op) {
        if (mainDisplay.classList.contains('error-text')) {
            clearAll();
            return;
        }

        if (isCalculated) {
            expression = currentInput + ' ' + op + ' ';
            currentInput = '0';
            isCalculated = false;
        } else {
            if (expression.endsWith(' ') && currentInput === '0') {
                // Replace trailing operator if consecutive operator clicked
                expression = expression.trim().slice(0, -1) + ' ' + op + ' ';
            } else {
                expression += currentInput + ' ' + op + ' ';
                currentInput = '0';
            }
        }
        updateDisplay();
    }

    // Toggle Positive/Negative (+/-)
    function toggleSign() {
        if (currentInput === '0' || mainDisplay.classList.contains('error-text')) return;

        if (currentInput.startsWith('-')) {
            currentInput = currentInput.slice(1);
        } else {
            currentInput = '-' + currentInput;
        }
        updateDisplay();
    }

    // Percentage (%)
    function handlePercent() {
        if (mainDisplay.classList.contains('error-text')) return;
        const num = parseFloat(currentInput);
        if (!isNaN(num)) {
            currentInput = (num / 100).toString();
            updateDisplay();
        }
    }

    // Clear All (AC)
    function clearAll() {
        currentInput = '0';
        expression = '';
        isCalculated = false;
        activeOperator = null;
        updateDisplay();
    }

    // Backspace (Delete last digit)
    function handleBackspace() {
        if (isCalculated || mainDisplay.classList.contains('error-text')) {
            clearAll();
            return;
        }

        if (currentInput.length > 1) {
            currentInput = currentInput.slice(0, -1);
            if (currentInput === '-' || currentInput === '') {
                currentInput = '0';
            }
        } else {
            currentInput = '0';
        }
        updateDisplay();
    }

    // -------------------------------------------------------------------------
    // 5. Backend Flask API Communication (/calculate)
    // -------------------------------------------------------------------------
    async function performCalculation() {
        if (mainDisplay.classList.contains('error-text')) return;

        let fullExpression = expression + currentInput;
        fullExpression = fullExpression.trim();

        if (!fullExpression) return;

        try {
            const response = await fetch('/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ expression: fullExpression })
            });

            const data = await response.json();

            if (data.status === 'success') {
                const resultVal = data.result.toString();
                expression = fullExpression + ' =';
                currentInput = resultVal;
                isCalculated = true;
                updateDisplay();

                // Save to history
                addHistoryItem(fullExpression, resultVal);
            } else {
                // Display friendly error message
                expression = fullExpression + ' =';
                currentInput = data.error || 'Error';
                mainDisplay.classList.add('error-text');
                isCalculated = true;
                updateDisplay();
            }
        } catch (err) {
            console.error('Calculation request error:', err);
            currentInput = 'Connection Error';
            mainDisplay.classList.add('error-text');
            updateDisplay();
        }
    }

    // -------------------------------------------------------------------------
    // 6. Calculation History Management
    // -------------------------------------------------------------------------
    function renderHistory() {
        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fa-regular fa-folder-open"></i>
                    <p>No calculation history yet</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = '';
        history.slice().reverse().forEach((item, index) => {
            const historyEl = document.createElement('div');
            historyEl.className = 'history-item';
            historyEl.innerHTML = `
                <div class="history-expr">${escapeHtml(item.expr)} =</div>
                <div class="history-res">${escapeHtml(item.res)}</div>
            `;

            // Click history item to populate result into current calculator input
            historyEl.addEventListener('click', () => {
                currentInput = item.res;
                expression = '';
                isCalculated = false;
                updateDisplay();
                showToast('Loaded history result!');
            });

            historyList.appendChild(historyEl);
        });
    }

    function addHistoryItem(expr, res) {
        history.push({ expr, res, timestamp: Date.now() });
        if (history.length > 50) history.shift(); // Keep last 50
        localStorage.setItem('calc_history', JSON.stringify(history));
        renderHistory();
    }

    clearHistoryBtn.addEventListener('click', () => {
        history = [];
        localStorage.removeItem('calc_history');
        renderHistory();
        showToast('History cleared');
    });

    historyToggleBtn.addEventListener('click', () => {
        historyPanel.classList.toggle('hidden');
    });

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }

    // Render history on startup
    renderHistory();

    // -------------------------------------------------------------------------
    // 7. Theme Switcher (Dark / Light Mode)
    // -------------------------------------------------------------------------
    const savedTheme = localStorage.getItem('calc_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('calc_theme', newTheme);
    });

    // -------------------------------------------------------------------------
    // 8. Copy to Clipboard Feature
    // -------------------------------------------------------------------------
    copyBtn.addEventListener('click', () => {
        if (!mainDisplay.classList.contains('error-text') && currentInput) {
            navigator.clipboard.writeText(currentInput)
                .then(() => showToast('Result copied to clipboard!'))
                .catch(() => showToast('Failed to copy'));
        }
    });

    // -------------------------------------------------------------------------
    // 9. Event Listeners for Keypad & Keyboard
    // -------------------------------------------------------------------------

    // Keypad Click Delegation
    keypad.addEventListener('click', (e) => {
        const target = e.target.closest('.btn');
        if (!target) return;

        // Visual click tactile animation
        target.classList.add('pressed');
        setTimeout(() => target.classList.remove('pressed'), 150);

        if (target.dataset.num !== undefined) {
            handleDigit(target.dataset.num);
        } else if (target.dataset.operator !== undefined) {
            handleOperator(target.dataset.operator);
        } else if (target.dataset.action) {
            const action = target.dataset.action;
            switch (action) {
                case 'decimal':
                    handleDigit('.');
                    break;
                case 'clear':
                    clearAll();
                    break;
                case 'toggle-sign':
                    toggleSign();
                    break;
                case 'percent':
                    handlePercent();
                    break;
                case 'backspace':
                    handleBackspace();
                    break;
                case 'calculate':
                    performCalculation();
                    break;
            }
        }
    });

    // Physical Keyboard Listener
    document.addEventListener('keydown', (e) => {
        // Avoid intercepting input if focused on input elements (if any)
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        const key = e.key;

        // Numbers 0-9
        if (key >= '0' && key <= '9') {
            handleDigit(key);
            highlightButton(`[data-num="${key}"]`);
        }
        // Decimal point
        else if (key === '.' || key === ',') {
            handleDigit('.');
            highlightButton('[data-action="decimal"]');
        }
        // Operators
        else if (key === '+') {
            handleOperator('+');
            highlightButton('[data-operator="+"]');
        }
        else if (key === '-') {
            handleOperator('-');
            highlightButton('[data-operator="-"]');
        }
        else if (key === '*') {
            handleOperator('×');
            highlightButton('[data-operator="×"]');
        }
        else if (key === '/') {
            e.preventDefault(); // Prevent browser quick search
            handleOperator('÷');
            highlightButton('[data-operator="÷"]');
        }
        else if (key === '%') {
            handlePercent();
            highlightButton('[data-action="percent"]');
        }
        // Enter or Equal (=)
        else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            performCalculation();
            highlightButton('[data-action="calculate"]');
        }
        // Backspace / Delete
        else if (key === 'Backspace' || key === 'Delete') {
            handleBackspace();
            highlightButton('[data-action="backspace"]');
        }
        // Escape or 'c'/'C'
        else if (key === 'Escape' || key.toLowerCase() === 'c') {
            clearAll();
            highlightButton('[data-action="clear"]');
        }
    });

    // Visual button press animation on physical key trigger
    function highlightButton(selector) {
        const btn = document.querySelector(selector);
        if (btn) {
            btn.classList.add('pressed');
            setTimeout(() => btn.classList.remove('pressed'), 150);
        }
    }
});
