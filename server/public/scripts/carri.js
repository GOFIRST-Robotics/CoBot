function ready() {
    console.log("CARRI ready");
    var driverSocket = "";

    createCallback = function(sockid, connection) {
        if (sockid === driverSocket) {
            connection.peerconnection.ondatachannel = (ev) => {
                console.log('Data channel is created!');
                ev.channel.onopen = function() {
                    console.log('Data channel is open and ready to be used.');
                };
                ev.channel.onmessage = ev_ => {console.log(ev_.data);};
            }
        }
    }

    socket.on('connect', () => {
        socket.emit("set-type", {type: "carri"});
    });

    socket.on("user-connect", (data) => {
        initiateConnection(data, true);
    });

    socket.on("driver-connect", (data) => {
        driverSocket = data;
        // Driver will send offer to us, we only have to answer
    });
}