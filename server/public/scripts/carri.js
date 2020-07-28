let roboturl = "http://localhost:8000";
let flirip = "192.168.0.205";
let flirurl = "http://" + flirip;
let currentTemp = 0;

ready = new Promise(function(resolve, reject) {
    console.log("CARRI ready");
    var driverSocket = "";

    //const robotio = io(roboturl, { transport : ['websocket'] });

    let thermalIntervalId = undefined;
    let thermalImg = new Image(640, 480);
    let spotId = "1";
    let thermalChannel = undefined;

    console.log("Starting thermal camera");
    keepAlive(30000);
    initFLIRSocket();
    $.get(flirurl + "/?user:user").done(() => {
        subscribeToSpot(spotId);
        
        let blocked = false;
        thermalImg.onload = () => {
            if (thermalChannel) {
                sendImage(thermalImg, thermalChannel, () => blocked = false);
            }
            else {
                blocked = false;
            }
        };
        thermalImg.onerror = () => blocked = false;
        thermalIntervalId = setInterval(() => {
            if (!blocked) {
                thermalImg.src = flirurl + "/snapshot.jpg?user:user&bust=" + Math.random();
                blocked = true;
            }
        }, 100);
        thermalImg.crossOrigin = "anonymous";

        setInterval(() => {
            if (thermalChannel) {
                thermalChannel.send(JSON.stringify({type: "temp", data: currentTemp}));
            }
        }, 100);
    });

    createCallback = function(sockid, connection) {
        if (sockid === driverSocket) {
            connection.peerconnection.ondatachannel = (ev) => {
                if (ev.channel.label === "control") {
                    ev.channel.onmessage = ev_ => {
                        //robotio.emit("keys", ev_.data);
                    };
                }
                else if (ev.channel.label === "thermal") {
                    thermalChannel = ev.channel;
                    ev.channel.onmessage = ev_ => {
                        var msg = JSON.parse(ev_.data);
                        if (msg.type === "moveSpot") {
                            let x = msg.x;
                            let y = msg.y;
                            let sensorX = scaleToSensor(x, 'x');
                            let sensorY = scaleToSensor(y, 'y');
                            setResource('.image.sysimg.measureFuncs.spot.' + spotId + '.x ', sensorX);
                            setResource('.image.sysimg.measureFuncs.spot.' + spotId + '.y ', sensorY);
                        }
                    };
                    ev.channel.onclose = () => {
                        thermalChannel = undefined;
                    }
                }
            }
        }
    }
    
    $.get(roboturl + "/secret").done(function(data) {
        socket.on('connect', () => {
            socket.emit("authentication", {type: "carri", secret: data});
        });
        resolve();
    }).fail(() => { reject(); });

    socket.on("user-connect", (data) => {
        initiateConnection(data, true);
    });

    socket.on("driver-connect", (data) => {
        driverSocket = data;
        // Driver will send offer to us, we only have to answer
    });
});

var canvas = document.createElement('canvas');
canvas.width = thermalWidth;
canvas.height = thermalHeight;
var ctx = canvas.getContext('2d');

function sendImage(image, channel, callback) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    var delay = 10;
    var charSlice = 10000;
    var terminator = "\n";

    var data = canvas.toDataURL("image/jpeg");
    var dataSent = 0;
    var intervalID = 0;
    intervalID = setInterval(function() {
        if (dataSent + 1 >= data.length) {
            channel.send(JSON.stringify({type: "img", end: true}));
            clearInterval(intervalID);
            if (callback) {callback();}
        }
        else {
            var slideEndIndex = dataSent + charSlice;
            if (slideEndIndex > data.length) {
                slideEndIndex = data.length;
            }
            let dataSend = data.slice(dataSent, slideEndIndex);
            channel.send(JSON.stringify({type: "img", "data": dataSend, end: false}));
            dataSent = slideEndIndex;
        }
    }, delay);
}

// These functions taken from FLIR AX8 webpage

function subscribeToSpot(id, callback) {
    $.post(flirurl + '/home/subscribe/spot/' + id)
        .done(function () {
            console.log('Subscribed to spot ', id);
            if (callback !== undefined) {
                callback();
            }
        });
}

function setResource(resource, value, callback, requestReset) {
    return poll({
        action: 'set',
        resource: resource,
        value: value,
    }, callback, requestReset);
}

function poll(data, callback, requestReset) {
    return $.ajax({
        type: 'POST',
        url: flirurl + '/res.php',
        data: data,
        dataType: 'json',
        success: function (result, status, xhr) {
            if (callback != undefined) {
                callback(result);
            }
        },
        error: function (result, status, xhr) {
            // console.log(result);
        },
        complete: function () {
            if (requestReset != undefined) {
                requestRunning = false;
                // console.log("Ajax complete: requestRunning=" + requestRunning);
            }
        }
    });
}

var websocket = undefined;

function initFLIRSocket() {
    // create a new WebSocket object.
    var wsUri = getWebSocketUri();
    websocket = new WebSocket(wsUri);
    websocket.onopen = function (ev) { // connection is open
        console.log('Connected to WebSocket server');
    };

    websocket.onmessage = function (ev) {
        var msg = JSON.parse(ev.data); // PHP sends Json data
        // console.log(msg);

        $.each(msg, function (k, v) {
            if (k !== 'notify') {
                var res = k.slice(1).split('.');
                if (res[2] === 'measureFuncs') {
                    switch (res[5]) {
                    case 'valueT':
                        let value = kelvinToFahrenheit(v, res[3] == 'diff');
                        currentTemp = value;
                        break;
                    }
                } 
            }
        });
    };

    websocket.onerror = function (ev) {
        console.log('WebSocket error occured: ' + ev.data);
    };

    websocket.onclose = function (ev) {
        console.log('WebSocket connection closed');
    };
}

function kelvinToFahrenheit(t, diff) {
    if (typeof(t) == 'string') {
        if (diff) {
            return(parseFloat(t) * 1.8).toFixed(1);
        }
        return((parseFloat(t) - 273.15) * 1.8 + 32).toFixed(1);
    }
    console.log('kelvinToFahrenheit() - Error');
}

function getWebSocketUri() {
    var wsUri;
    wsUri = 'ws://';
    wsUri += flirip;
    return wsUri;
}

function keepAlive(rate) {
    setResource('.rtp.keepalive', 'true', function () {
        setTimeout(function () {
            keepAlive(rate);
        }, rate);
    });
}