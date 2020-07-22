var id_token = null;

ready = new Promise(function(resolve, reject) {
  console.log("Driver ready");
  var carriSocket = "";

  socket.on('connect', () => {
      socket.emit("authentication", {type: "driver", secret: id_token});
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

      dataChannel.addEventListener("open", (event) => { initControls(dataChannel); });
  });
  // Do the setup and then never complete the promise so the socket isn't initiated
  resolve();
});

function initControls(dataChannel) {
  window.addEventListener('blur',()=>pressed = {},false);
  var KEYS = {left: 37, right: 39, forward: 38, reverse: 40};
  var pressed={};
  document.onkeydown=function(e){
      e = e || window.event;
      pressed[e.keyCode] = true;
  }

  document.onkeyup=function(e){
      e = e || window.event;
      pressed[e.keyCode] = false;
  }

  function isPressed(keyCode) {
      if (keyCode in pressed) {
          return pressed[keyCode];
      }
      return false;
  }

  setInterval(() => {
      dataChannel.send(JSON.stringify({
          "left" : isPressed(KEYS.left),
          "right" : isPressed(KEYS.right),
          "forward" : isPressed(KEYS.forward),
          "reverse" : isPressed(KEYS.reverse)
      }));
  }, 100);
}

function onSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
    console.log('Name: ' + profile.getName());
    console.log('Image URL: ' + profile.getImageUrl());
    console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.

    id_token = googleUser.getAuthResponse().id_token;
    //socket.connect();
  }
  