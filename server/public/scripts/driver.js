function ready() {
  console.log("Driver ready");
  var carriSocket = "";

  socket.on('connect', () => {
      socket.emit("set-type", {type: "driver"});
  });

  socket.on("user-connect", (data) => {
      initiateConnection(data, true);
      console.log("A user connected");
  });

  socket.on("carri-connect", (data) => {
      carriSocket = data;
      console.log("Got CARRI on " + carriSocket);
      // Send offer to CARRI
      let connection = initiateConnection(carriSocket, true);
      let dataChannel = connection.peerconnection.createDataChannel("control");

      dataChannel.addEventListener("open", (event) => {
        setInterval(() => {dataChannel.send(""+Math.random());}, 1000);
      });
  });
  }