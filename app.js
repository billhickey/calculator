var port = process.env.PORT || 3000;
var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let last10Calculations = [];

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
    socket.emit('calculationsUpdate', last10Calculations);
    socket.on('calculation', (value) => {
        updateCalculationCache(value);
    })
});

function updateCalculationCache(newCalculation) {
    last10Calculations = [newCalculation, ...last10Calculations.slice(0, 9)];
    io.emit('calculationsUpdate', last10Calculations);
}

http.listen(port);