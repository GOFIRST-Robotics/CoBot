ready = new Promise(function(resolve, reject) {
    console.log("CARRI ready");
    var driverSocket = "";

    //const robotio = io("http://localhost:10000")

    createCallback = function(sockid, connection) {
        if (sockid === driverSocket) {
            connection.peerconnection.ondatachannel = (ev) => {
                console.log('Data channel is created!');
                ev.channel.onopen = function() {
                    console.log('Data channel is open and ready to be used.');
                };
                ev.channel.onmessage = ev_ => {
                    //robotio.emit("keys", ev_.data);
                    console.log(ev_.data);
                };
            }
        }
    }
    
    $.get("http://localhost:8000/secret").done(function(data) {
        socket.on('connect', () => {
            socket.emit("authenticate", {type: "carri", secret: data});
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