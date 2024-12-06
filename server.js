const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');  // Import compression
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server); // Correct initialization
const less = require('less');

// config
var port = 8000;

server.listen(port, function () {
    console.log('epsile server listening at port %d', port);
});

app.use(compression()); // Use the compression middleware

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API to return .js files
app.get('/js/lib/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'js', 'lib', req.params.file);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('JavaScript file not found');
    }
});

// API to return .js files in the general js folder
app.get('/js/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'js', req.params.file);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('JavaScript file not found');
    }
});

// API to return images
app.get('/img/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'img', req.params.file);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Image file not found');
    }
});

// API to return media files (audio)
app.get('/media/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'media', req.params.file);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Media file not found');
    }
});

// Serve .less files as compiled CSS
app.get("/style/:file", (req, res) => {
    const filePath = path.join(__dirname, "style", "epsile" + ".less");

    // Check if the .less file exists
    if (fs.existsSync(filePath)) {
        // Read the .less file
        fs.readFile(filePath, "utf8", (err, data) => {
            if (err) {
                return res.status(500).send("Error reading .less file");
            }

            // Compile the .less content to CSS
            less.render(data, (err, output) => {
                if (err) {
                    return res.status(500).send("Error compiling LESS to CSS");
                }

                // Return the compiled CSS to the client
                res.header("Content-Type", "text/css");
                res.send(output.css);
            });
        });
    } else {
        res.status(404).send("LESS file not found");
    }
});

// Fallback for other routes (e.g., serving index.html)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/index.html"));
});

// global variables, keeps the state of the app
var sockets = {},
    users = {},
    strangerQueue = false,
    peopleActive = 0,
    peopleTotal = 0;

// helper functions, for logging
function fillZero(val) {
    if (val > 9) return "" + val;
    return "0" + val;
}

function timestamp() {
    var now = new Date();
    return "[" + fillZero(now.getHours()) + ":" + fillZero(now.getMinutes()) + ":" + fillZero(now.getSeconds()) + "]";
}

// listen for connections
io.on('connection', function (socket) {
    // store the socket and info about the user
    sockets[socket.id] = socket;
    users[socket.id] = {
        connectedTo: -1,
        isTyping: false
    };

    // connect the user to another if strangerQueue isn't empty
    if (strangerQueue !== false) {
        users[socket.id].connectedTo = strangerQueue;
        users[socket.id].isTyping = false;
        users[strangerQueue].connectedTo = socket.id;
        users[strangerQueue].isTyping = false;
        socket.emit('conn');
        sockets[strangerQueue].emit('conn');
        strangerQueue = false;
    } else {
        strangerQueue = socket.id;
    }

    peopleActive++;
    peopleTotal++;
    io.emit('stats', { people: peopleActive });

    socket.on("new", function () {
        // Got data from someone
        if (strangerQueue !== false) {
            users[socket.id].connectedTo = strangerQueue;
            users[strangerQueue].connectedTo = socket.id;
            users[socket.id].isTyping = false;
            users[strangerQueue].isTyping = false;
            socket.emit('conn');
            sockets[strangerQueue].emit('conn');
            strangerQueue = false;
        } else {
            strangerQueue = socket.id;
        }
        peopleActive++;
        io.emit('stats', { people: peopleActive });
    });

    // Conversation ended
    socket.on("disconn", function () {
        var connTo = users[socket.id].connectedTo;
        if (strangerQueue === socket.id || strangerQueue === connTo) {
            strangerQueue = false;
        }
        users[socket.id].connectedTo = -1;
        users[socket.id].isTyping = false;
        if (sockets[connTo]) {
            users[connTo].connectedTo = -1;
            users[connTo].isTyping = false;
            sockets[connTo].emit("disconn", { who: 2 });
        }
        socket.emit("disconn", { who: 1 });
        peopleActive -= 2;
        io.emit('stats', { people: peopleActive });
    });

    socket.on('chat', function (message) {
        if (users[socket.id].connectedTo !== -1 && sockets[users[socket.id].connectedTo]) {
            sockets[users[socket.id].connectedTo].emit('chat', message);
        }
    });

    socket.on('typing', function (isTyping) {
        if (users[socket.id].connectedTo !== -1 && sockets[users[socket.id].connectedTo] && users[socket.id].isTyping !== isTyping) {
            users[socket.id].isTyping = isTyping;
            sockets[users[socket.id].connectedTo].emit('typing', isTyping);
        }
    });

    socket.on("disconnect", function (err) {
        var connTo = (users[socket.id] && users[socket.id].connectedTo);
        if (connTo === undefined) {
            connTo = -1;
        }
        if (connTo !== -1 && sockets[connTo]) {
            sockets[connTo].emit("disconn", { who: 2, reason: err && err.toString() });
            users[connTo].connectedTo = -1;
            users[connTo].isTyping = false;
            peopleActive -= 2;
        }

        delete sockets[socket.id];
        delete users[socket.id];

        if (strangerQueue === socket.id || strangerQueue === connTo) {
            strangerQueue = false;
            peopleActive--;
        }
        peopleTotal--;
        io.emit('stats', { people: peopleActive });
    });
});
