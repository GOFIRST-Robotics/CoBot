var id_token = null;
var measureModal = null;

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
      let controlChannel = connection.peerconnection.createDataChannel("control");
      let thermalChannel = connection.peerconnection.createDataChannel("thermal");

      controlChannel.addEventListener("open", (event) => { initControls(controlChannel); });
      thermalChannel.addEventListener("open", (event) => { initThermalCam(thermalChannel); });
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

function openThermal(dataChannel) {
    measureModal.classList.remove("modal-hidden");
    dataChannel.send({type: "startThermal"});
}

function closeThermal(dataChannel) {
    measureModal.classList.add("modal-hidden")
    dataChannel.send({type: "endThermal"});
}

function initThermalCam(dataChannel) {
    measureModal = document.getElementById("measure-modal");
    document.getElementById("open-measure").onclick = () => openThermal(dataChannel);
    document.getElementById("close-measure").onclick = () => closeThermal(dataChannel);
    
    let imgData = "";
    dataChannel.onmessage = (ev) => {
        let msg = ev.data;
        if (msg.type === "img") {
            if (msg.data === "\n") {
                document.getElementById("measure-img").src = imgData;
                imgData = "";
            }
            else {
                imgData += msg.data;
            }
        }
        else if (msg.type === "temp") {
            document.getElementById("measure-value").textContent = msg.data;
        }
    };

    function setMeasurePos(xx, yy) {
        dataChannel.send({type: "moveSpot", x: xx, y: yy})
    }

    $("#measure-img").on("click", function (event) {
        var x = (event.pageX - this.offsetLeft);
        var y = (event.pageY - this.offsetTop);
        setMeasurePos(x, y);
    });
    setMeasurePos(160, 80);
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
  