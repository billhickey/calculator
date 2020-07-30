var port = process.env.PORT || 3000;
var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let last10Calculations = [];
let equation = [0];
let previousEquation = [];
let previousResult = 0;
let justCalulated = false;

const NUMERIC_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const OPERATORS = ['%', '÷', 'x', '-', '+'];
const DECIMAL_POINT = '.'
const EQUALS = '='
const ALL_CLEAR = 'AC'

const NUMERIC_KEY = 'NUMERIC_KEY';
const OPERATOR = 'OPERATOR';

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
    socket.emit('calculationsUpdate', last10Calculations);
    socket.emit('mouseCoordinates', last10Calculations);
    io.emit('calculatorStateChange', { equation, previousEquation, previousResult, justCalulated});
    socket.on('calculation', (newCalculation) => {
       
    })
    socket.on('mouseMove', (value) => {
        value.socketID = socket.id;
        socket['coordinates'] = value;
        emitMouseCoordinates();
    })
    socket.on('keyPress', (value) => {
        // comparing equation state to handle for potential latency issues
        if(JSON.stringify(equation) === JSON.stringify(value.calculatorState.equation)) {
            io.emit("keyPress", {key: value.key, socketID: socket.id});
            handleKeyClick(value.key);
        }
    })
    socket.on('disconnect', () => {
        emitMouseCoordinates();
    })
});

function emitMouseCoordinates() {
    const allClients = Object.values(io.sockets.sockets);
    io.emit('mouseCoordinates', allClients.map(s => s.coordinates));
}

function handleKeyClick(key) {
    const keyType = determineKeyType(key);
    switch (keyType) {
        case NUMERIC_KEY:
            handleNumericKeyPress(key);
            justCalulated = false;
            break;
        case DECIMAL_POINT:
            handleDecimalKeyPress();
            justCalulated = false;
            break;
        case OPERATOR:
            handleOperatorKeyPress(key);
            justCalulated = false;
            break;
        case ALL_CLEAR:
            handleClearEquation();
            justCalulated = false;
            break;
        case EQUALS:
            handleEqualsKeyPress();
            break;
    }
    io.emit('calculatorStateChange', { equation, previousEquation, previousResult, justCalulated});
}

function handleNumericKeyPress(key) {
    if (!equation.length) {
        equation.push(key)
    } else {
        const lastElementOfEquation = equation[equation.length - 1];
        if (isNumber(lastElementOfEquation)) {
            appendToExistingNumber(key);
        } else {
            equation.push(key)
        }
    }
}

function handleDecimalKeyPress() {
    const lastElementOfEquation = equation[equation.length - 1];
    if (!lastElementOfEquation) {
        equation.push('0.');
    } else {
        if (lastElementOfEquation.includes(DECIMAL_POINT)) {
            // cannot have two decimal points in an equation element
            return;
        } else if (isNumber(lastElementOfEquation)) {
            appendToExistingNumber(DECIMAL_POINT);
        } else {
            // if starting a number with a decimal, include leading zero
            equation.push('0.');
        }
    }
}

function appendToExistingNumber(key) {
    const newNumber = equation[equation.length - 1].toString() + key.toString();

    // only situation to display a leading 0 is '0.'
    const newNumberClean = newNumber.startsWith('0.') ? newNumber : newNumber.replace(/^0+/, '');
    equation[equation.length - 1] = newNumberClean;
}

function isNumber(equationElement) {
    return equationElement.toString().split('').some(character => NUMERIC_KEYS.includes(character) || character == DECIMAL_POINT)
}

function determineKeyType(key) {
    if (NUMERIC_KEYS.includes(key)) {
        return NUMERIC_KEY;
    } else if (OPERATORS.includes(key)) {
        return OPERATOR;
    } else {
        // all keys which are not operators or numberic are represented as themselves as they are not part of a group of related keys
        return key;
    }
}

function handleEqualsKeyPress() {
    // must be an odd number of elements to the equation and at least three elements to calculate
    if (equation.length >= 3 && equation.length % 2 === 1) {
        calculate();
    }
}

function calculate() {
    previousEquation = equation;

    // replace "pretty" representations of operators with their valid js equivalent
    const jsValidEquation = equation.map(element => {
        if (element === '÷') {
            return '/';
        }
        if (element === 'x') {
            return '*';
        }
        return element;
    })

    const validJSEquationString = jsValidEquation.join("");
    const result = eval(validJSEquationString);
    previousResult = result;

    last10Calculations = [{input: equation.join(" "), result}, ...last10Calculations.slice(0, 9)];
    io.emit('calculationsUpdate', last10Calculations);

    equation = [];
    justCalulated = true;
}

function removeTrailingDecimal(element) {
    const splitNumber = element.toString().split('')
    const splitRemovedDecimal = splitNumber.slice(0, splitNumber.length - 1);
    return splitRemovedDecimal.join('');
}

function handleClearEquation() {
    equation = [];
    previousEquation = [];
    previousResult = 0;
    justCalulated = false;
}


function handleOperatorKeyPress(key) {
    if (justCalulated) {
        equation.push(previousResult)
    }
    if (!equation.length) {
        return;
    }
    const lastElementOfEquation = equation[equation.length - 1];
    if (OPERATORS.includes(lastElementOfEquation)) {
        equation[equation.length - 1] = key;
    }
    if (isNumber(lastElementOfEquation)) {
        if (lastElementOfEquation.toString().endsWith('.')) {
            equation[equation.length - 1] = removeTrailingDecimal(equation[equation.length - 1]);
        }
        equation.push(key);
    }
}

http.listen(port);