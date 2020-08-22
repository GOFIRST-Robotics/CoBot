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

var abs = Math.abs;
var max = Math.max;

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

  var panAngle = 90;
  var tiltAngle = 90;

  setInterval(() => {
      var gpData = getGamepadData();
      var forward = -gpData.forward;
      var turn = gpData.turn;
      var angSpeed = abs(forward) * turn;
      if (abs(forward) < 0.1) {
        angSpeed = turn;
      }
      var rightSpeed = forward - angSpeed;
      var leftSpeed = forward + angSpeed;
      var maxMag = max(abs(rightSpeed), abs(leftSpeed));
      if (maxMag > 1.0) {
          rightSpeed /= maxMag;
          leftSpeed /= maxMag;
      }

      var panDelta = gpData.lookPan * 3;
      var tiltDelta = gpData.lookTilt * 3;
      panAngle += panDelta;
      tiltDelta += tiltDelta;

      dataChannel.send(JSON.stringify({
          "left" : leftSpeed,
          "right" : rightSpeed,
          "pan" : panAngle,
          "tilt" : tiltAngle
      }));
  }, 100);
}

function openThermal(dataChannel) {
    measureModal.removeClass("modal-hidden");
}

function closeThermal(dataChannel) {
    measureModal.addClass("modal-hidden");
}

function initThermalCam(dataChannel) {
    measureModal = $("#measure-modal");
    $("#open-measure").removeAttr("disabled");
    $("#open-measure").click(() => openThermal(dataChannel));
    $("#close-measure").click(() => closeThermal(dataChannel));
    
    let imgData = "";
    let firstImg = true;
    dataChannel.onmessage = (ev) => {
        let msg = JSON.parse(ev.data);
        if (msg.type === "img") {
            if (msg.end) {
                $("#measure-img").prop("src", imgData);
                imgData = "";
                if (firstImg) {
                    firstImg = false;
                    setMeasurePos(640/2, 480/2);
                    $("#measure-value").removeClass("modal-hidden");
                    $("#spot").removeClass("modal-hidden");
                }
            }
            else {
                imgData += msg.data;
            }
        }
        else if (msg.type === "temp") {
            $("#measure-value").text(msg.data);
        }
    };

    function setMeasurePos(xx, yy) {
        $("#spot").css("top", 480-(scaleToSensor(yy, 'y')+1)*8);
        $("#spot").css("left", (scaleToSensor(xx, 'x')+1)*8);
        dataChannel.send(JSON.stringify({type: "moveSpot", x: xx, y: yy}));
    }

    $("#measure-img").on("click", function (event) {
        var pos = $(this).offset();
        var x = (event.pageX - pos.left);
        var y = (event.pageY - pos.top);
        setMeasurePos(x, y);
    });
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

function deadzone(x) {
    if (abs(x) < 1e-2) {
        return 0.0;
    }
    return x;
}

function symmetricSquare(x) {
    return x * abs(x);
}

function oneSign(x) {
    if (abs(x) < 1e-2) {
        return 1;
    }
    return x / abs(x);
}

var gamepad = undefined;
function getGamepadData() {
    var data = {
        "forward": 0.0,
        "turn": 0.0,
        "lookPan": 0.0,
        "lookTilt": 0.0
    };
    if (gamepad !== undefined) {
        data["forward"] = deadzone(gamepad.axes[1]);
        data["turn"] = deadzone(gamepad.axes[0]);
        data["lookPan"] = deadzone(gamepad.axes[3]);
        data["lookTilt"] = deadzone(gamepad.axes[4]);
    }
    return data;
}

window.addEventListener("gamepadconnected", function(e) {
    gamepad = e.gamepad;
});
window.addEventListener("gamepaddisconnected", function(e) {
    gamepad = undefined;
});