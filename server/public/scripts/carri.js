let roboturl = "http://localhost:8000";
let flirip = "92.168.0.205";
let flirurl = "http://" + flirip;
let currentTemp = 0;

ready = new Promise(function(resolve, reject) {
    console.log("CARRI ready");
    var driverSocket = "";

    const robotio = io(roboturl, { transport : ['websocket'] });

    createCallback = function(sockid, connection) {
        if (sockid === driverSocket) {
            connection.peerconnection.ondatachannel = (ev) => {
                if (ev.channel.label === "control") {
                    ev.channel.onmessage = ev_ => {
                        robotio.emit("keys", ev_.data);
                        console.log(ev_.data);
                    };
                }
                else if (ev.channel.label === "thermal") {
                    let spotId = "measure";
                    subscribeToSpot(spotId);
                    let intervalID = 0;
                    let dt = 1000 / 30;
                    ev.channel.onmessage = ev_ => {
                        var msg = ev_.data;
                        if (msg.type === "startThermal") {
                            intervalID = setInterval(function() {
                                $.get(flirurl + "/snapshot.jpg" + Math.random()).done(function(data) {
                                    sendImage(data, ev.channel);
                                });
                            }, dt);
                        }
                        else if (msg.type === "endThermal") {
                            clearInterval(intervalID);
                        }
                        else if (msg.type === "moveSpot") {
                            let x = msg.x;
                            let y = msg.y;
                            let sensorX = scaleToSensor(x, 'x');
                            let sensorY = scaleToSensor(y, 'y');
                            setResource('.image.sysimg.measureFuncs.spot.' + spotId + '.x ', sensorX);
                            setResource('.image.sysimg.measureFuncs.spot.' + spotId + '.y ', sensorY);
                        }
                    };

                    
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
canvas.width = 320;
canvas.height = 160;
var ctx = canvas.getContext('2d');

function sendImage(image, channel) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.width);

    var delay = 10;
    var charSlice = 10000;
    var terminator = "\n";

    var data = canvas.toDataURL("image/jpeg");
    var dataSent = 0;
    var intervalID = 0;

    intervalID = setInterval(function() {
        var slideEndIndex = dataSent + charSlice;
        if (slideEndIndex > data.length) {
            slideEndIndex = data.length;
        }
        sendChannel.send({type: "img", "data": data.slice(dataSent, slideEndIndex)});
        dataSent = slideEndIndex;
        if (dataSent + 1 >= data.length) {
            channel.send({type: "img", data: terminator});
            clearInterval(intervalID);
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
    if (window.location.protocol === 'https:') {
        wsUri = 'wss://';
    } else {
        wsUri = 'ws://';
    }
    wsUri += flirip;
    return wsUri;
}

function scaleToSensor(val, axis, size) {
    var ret = val / globScaling;
    if (axis === 'x') {
        if (hflip) {
            if (size != undefined) {
                ret = (globImgWidth - parseFloat(val)) / globScaling - parseFloat(size);
            } else {
                ret = (globImgWidth - parseFloat(val)) / globScaling - 1;
            }
        }
    } else if (axis === 'y') {
        if (vflip) {
            if (size != undefined) {
                ret = (globImgHeight - parseFloat(val)) / globScalingHeight - parseFloat(size);
            } else {
                ret = (globImgHeight - parseFloat(val)) / globScalingHeight - 1;
            }
        } else {
            ret = val / globScalingHeight;
        }
    }
    return Math.round(ret);
}