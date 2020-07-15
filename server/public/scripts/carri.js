
var driverSocket = "";

socket.on('connect', () => {
    socket.emit("set-type", {type: "carri"});
});

socket.on("user-connect", (data) => {
    // Send offer to user
});

socket.on("driver-connect", (data) => {
    driverSocket = data;
    // Driver will send offer to us, we only have to answer
});

socket.on("offer", (data) => {
    // Respond to offer, change type depending on driver or user
});

socket.on("answer", (data) => {
    // Use answer to set up stream
    // Answers should only be from users
});