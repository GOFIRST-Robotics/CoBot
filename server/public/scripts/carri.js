function ready() {
    console.log("CARRI ready");
    var driverSocket = "";

    socket.on('connect', () => {
        socket.emit("set-type", {type: "carri"});
    });

    socket.on("user-connect", (data) => {
        initiateConnection(data, true);
    });

    socket.on("driver-connect", (data) => {
        driverSocket = data;
        // Driver will send offer to us, we only have to answer
        //initiateConnection(driverSocket, false);
    });
}