document.addEventListener("DOMContentLoaded", function () {
    setUpCalculator();
    setUpSocket();
});

let socket;
let last10Calculations = [];
let calculatorContainer;
let calculatorState;
let previousKeyPresses;
let allKeys;

function setUpCalculator() {
    allKeys = Array.from(document.getElementsByClassName('key'));
    allKeys.forEach(element => {
        element.addEventListener("click", handleKeyClick);
    });

    calculatorContainer = document.getElementsByClassName('container')[0];
    calculatorContainer.addEventListener('mousemove', e => {
        const calculatorRect = calculatorContainer.getBoundingClientRect();
        const percentY = (e.clientY - calculatorRect.top) / (calculatorRect.bottom - calculatorRect.top)
        const percentX = (e.clientX - calculatorRect.left) / (calculatorRect.right - calculatorRect.left)
        socket.emit('mouseMove', { percentX, percentY });
    })
}

function setUpSocket() {
    socket = io();
    socket.on('calculationsUpdate', (value) => {
        last10Calculations = value;
        setHistoryDisplay()
    });
    socket.on('mouseCoordinates', (value) => {
        drawMice(value);
    });
    socket.on('calculatorStateChange', (value) => {
        calculatorState = value;
        syncCalculator();
    })
    socket.on('keyPress', (value) => {
        if (value.socketID !== socket.id) {
            mockKeyPress(value.key)
        }
    })
}

function mockKeyPress(key) {
    const nodeToPress = allKeys.find(k => k.value == key);
    nodeToPress.focus();
    nodeToPress.classList.add('mock-click');
    setTimeout(() => {
        nodeToPress.classList.remove('mock-click');
    }, (200));
}

function syncCalculator() {
    setDisplay();
}

function handleKeyClick() {
    // sending up calculator state with the keypress to prevent errors from latency
    // if calculator state has been changed by another user, the keypress will not register
    // more robust solution would be better
    socket.emit('keyPress', { key: event.target.value, calculatorState });
}

function drawMice(mice) {
    const calculatorRect = calculatorContainer.getBoundingClientRect();
    var validCoordinates = mice.filter(m => m);
    validCoordinates.forEach(m => {
        const existingMouseForSocket = Array.from(document.getElementsByClassName(m.socketID));
        if (existingMouseForSocket.length) {
            // modify mouse position if it already exists
            const leftPostion = calculatorRect.left + ((calculatorRect.right - calculatorRect.left) * m.percentX) - 7;
            existingMouseForSocket[0].style.left = `${leftPostion}px`;
            const topPosition = calculatorRect.top + ((calculatorRect.bottom - calculatorRect.top) * m.percentY) - 7;
            existingMouseForSocket[0].style.top = `${topPosition}px`;
        } else {
            // create mouse for other users
            if (m.socketID !== socket.id) {
                const mouse = document.createElement('img')
                mouse.classList.add('mouse');
                mouse.classList.add(m.socketID);
                mouse.id = m.socketID;
                mouse.src = "cursor.svg"
                const leftPostion = calculatorRect.left + ((calculatorRect.right - calculatorRect.left) * m.percentX) - 7;
                mouse.style.left = `${leftPostion}px`;
                const topPosition = calculatorRect.top + ((calculatorRect.bottom - calculatorRect.top) * m.percentY) - 7;
                mouse.style.top = `${topPosition}px`;
                calculatorContainer.appendChild(mouse);
            }
        }
    })
    // delete mouse for users that are gone
    const allMice = Array.from(document.getElementsByClassName('mouse'));
    const existingSockets = validCoordinates.map(m => m.socketID);
    const oldMice = allMice.filter(m => !existingSockets.includes(m.id));
    oldMice.forEach(mouse => {
        mouse.remove();
    })
}

function setHistoryDisplay() {
    const historyElement = document.getElementsByClassName('history')[0];
    historyElement.innerHTML = '';
    last10Calculations.forEach(previousCalculation => {
        var previousCalculationNode = document.createElement("div");
        previousCalculationNode.classList.add('previous-calculation')

        var input = document.createElement('span');
        input.innerHTML = `${previousCalculation.input}&nbsp&nbsp`;
        input.classList.add('previous-input')

        var result = document.createElement('span');
        result.innerHTML = `=&nbsp&nbsp${previousCalculation.result}`;
        result.classList.add('previous-result')

        previousCalculationNode.appendChild(input);
        previousCalculationNode.appendChild(result);
        historyElement.appendChild(previousCalculationNode);
    })
}

function setDisplay() {
    /* immediately after a calculation show equation in small display
    * after new equation is started show the result of the previous equation
    * inspired by google calculator */
    const { justCalulated, previousCalculation, previousResult, previousEquation, equation } = calculatorState;
    const smallDisplayText = justCalulated ? previousEquation.join(" ") : previousResult;
    const largeDisplayText = justCalulated ? previousResult : equation.join(" ");
    document.getElementsByClassName('sub-display-small')[0].innerHTML = smallDisplayText;
    document.getElementsByClassName('sub-display-large')[0].innerHTML = largeDisplayText;
}