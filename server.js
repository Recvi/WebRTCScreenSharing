'user strict';

// Load required modules
var https = require('https'),
    fs = require('fs'),
    config = require('getconfig'),
    express = require('express'), // web framework external module
    morgan = require('morgan'),
    yetify = require('yetify'),
    uuid = require('node-uuid'),
    crypto = require('crypto'),
    socketio = require('socket.io'),
    app = express(); // initialization of application

// initialize logger
app.use(morgan('dev'));

// set the static files location /public/lib will be /lib for users
app.use(express.static(__dirname + '/public'));

// send index.html when someone enters page
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/presentation', function(req, res) {
    res.sendFile(__dirname + '/public/presentation.html');
});

app.get('/demo', function(req, res) {
    res.sendFile(__dirname + '/public/demo.html');
});

app.get('/help', function(req, res) {
    res.sendFile(__dirname + '/public/help.html');
});


// start the server on port 443
var server = https.createServer({
        key: fs.readFileSync(config.server.key),
        cert: fs.readFileSync(config.server.cert)
    },
    app).listen(config.server.port, function() {
    var host = server.address().address,
        port = server.address().port;
    console.log('WebRTC ScreenSharing app is listening at http://snf-647197.vm.okeanos.grnet.gr:%s', port);
});


var io = socketio.listen(server);

if (config.logLevel) {
    // https://github.com/Automattic/socket.io/wiki/Configuring-Socket.IO
    io.set('log level', config.logLevel);
}

function describeRoom(name) {
    var clients = io.sockets.clients(name);
    var result = {
        clients: {}
    };
    clients.forEach(function(client) {
        result.clients[client.id] = client.resources;
    });
    return result;
}

function clientsInRoom(name) {
    return io.sockets.clients(name).length;
}

function safeCb(cb) {
    if (typeof cb === 'function') {
        return cb;
    } else {
        return function() {};
    }
}

io.sockets.on('connection', function(client) {

    console.log('Client connected:'+client);

    client.resources = {
        screen: false,
        video: true,
        audio: false
    };

    // pass a message to another id
    client.on('message', function(details) {
        if (!details) return;

        var otherClient = io.sockets.sockets[details.to];
        if (!otherClient) return;

        details.from = client.id;
        otherClient.emit('message', details);
    });

    client.on('shareScreen', function() {
        client.resources.screen = true;
    });

    client.on('unshareScreen', function(type) {
        client.resources.screen = false;
        removeFeed('screen');
    });

    client.on('join', join);

    function removeFeed(type) {
        if (client.room) {
            io.sockets.in(client.room).emit('remove', {
                id: client.id,
                type: type
            });
            if (!type) {
                client.leave(client.room);
                client.room = undefined;
            }
        }
    }

    function join(name, cb) {

        console.log('Client join group:'+name);

        // sanity check
        if (typeof name !== 'string') return;
        // check if maximum number of clients reached
        if (config.rooms && config.rooms.maxClients > 0 &&
            clientsInRoom(name) >= config.rooms.maxClients) {
            safeCb(cb)('full');
            return;
        }
        // leave any existing rooms
        removeFeed();
        safeCb(cb)(null, describeRoom(name));
        client.join(name);
        client.room = name;
    }

    // we don't want to pass "leave" directly because the
    // event type string of "socket end" gets passed too.
    client.on('disconnect', function() {
        removeFeed();
    });
    client.on('leave', function() {
        removeFeed();
    });

    client.on('create', function(name, cb) {
        if (arguments.length == 2) {
            cb = (typeof cb == 'function') ? cb : function() {};
            name = name || uuid();
        } else {
            cb = name;
            name = uuid();
        }
        // check if exists
        if (io.sockets.clients(name).length) {
            safeCb(cb)('taken');
        } else {
            join(name);
            safeCb(cb)(null, name);
        }
    });

    // tell client about stun and turn servers and generate nonces
    client.emit('stunservers', config.stunservers || []);

    // create shared secret nonces for TURN authentication
    // the process is described in draft-uberti-behave-turn-rest
    var credentials = [];
    config.turnservers.forEach(function(server) {
        var hmac = crypto.createHmac('sha1', server.secret);
        // default to 86400 seconds timeout unless specified
        var username = Math.floor(new Date().getTime() / 1000) + (server.expiry || 86400) + "";
        hmac.update(username);
        credentials.push({
            username: username,
            credential: hmac.digest('base64'),
            url: server.url
        });
    });
    client.emit('turnservers', credentials);
});

if (config.uid) process.setuid(config.uid);

var httpUrl;
if (config.server.secure) {
    httpUrl = "https://snf-647197.vm.okeanos.grnet.gr:" + config.server.port;
}
console.log(yetify.logo() + ' -- signal master is running at: ' + httpUrl);
