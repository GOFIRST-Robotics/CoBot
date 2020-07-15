
socket.on('connect', () => {
    socket.emit("set-type", {type: "user"});
});

socket.on("user-connect", (data) => {
    // Send offer to user
});

socket.on("offer", (data) => {
    // Send answer
});

socket.on("answer", (data) => {
    // Use answer to set up stream
});