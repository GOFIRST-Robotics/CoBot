
ready = new Promise(function(resolve, reject) {
    console.log("User ready");
  
    socket.on('connect', () => {
        socket.emit("authenticate", {type: "user"});
    });
  
    socket.on("user-connect", (data) => {
        initiateConnection(data, true);
        console.log("A user connected");
    });
    resolve();
});