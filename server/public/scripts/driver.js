var carriSocket = "";

socket.on('connect', () => {
    socket.emit("set-type", {type: "driver"});
});

socket.on("user-connect", (data) => {
    // Send offer to user
});

socket.on("carri-connect", (data) => {
    carriSocket = data;
    // Send offer to CARRI
});

socket.on("offer", (data) => {
    // Driver shouldn't get any offers
});

socket.on("answer", (data) => {
    // Use answer to set up stream
    // Answers can be from CARRI or users
});