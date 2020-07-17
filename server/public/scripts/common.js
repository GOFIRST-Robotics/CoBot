const { RTCPeerConnection, RTCSessionDescription } = window;

const configuration = { iceServers: [{ urls: 'stun:18.191.246.40' }] };

const socket = io("http://localhost:5000", { "autoConnect": false });

var getMedia = navigator.mediaDevices.getUserMedia({ audio: false, video: true });
var localMedia = null;
var connections = {};

var initiateConnection = null;
var sendOffer = null;

getMedia.then(function (stream) {
    document.getElementById("local-video").srcObject = stream;
    localMedia = stream;

    initiateConnection = function (sockid, initiate) {
        var pc = new RTCPeerConnection(configuration);
        var element = document.createElement("video");
        element.className = "remote-video";
        element.setAttribute("autoplay", "true");
        document.getElementById("videos").appendChild(element);
        var connection = { peerconnection: pc, inboundStream: null, initiator: initiate, videoElement: element };
        connections[sockid] = connection;
        for (const track of localMedia.getTracks()) {
            pc.addTrack(track);
        }
        pc.ontrack = e => {
            if (e.streams && e.streams[0]) {
                element.srcObject = e.streams[0];
            } else {
                if (!connection.inboundStream) {
                    connection.inboundStream = new MediaStream();
                    element.srcObject = connection.inboundStream;
                }
                connection.inboundStream.addTrack(e.track);
            }
            console.log("Got a track");
        };
        pc.onicecandidate = function (evt) {
            if (evt.candidate) {
                socket.emit("ice", { to: sockid, candidate: evt.candidate });
            }
        };
        pc.onconnectionstatechange = function (event) {
            switch (pc.connectionState) {
                case "connected":
                    break;
                case "disconnected":
                case "failed":
                case "closed":
                    element.parentNode.removeChild(element);
                    delete connections[sockid];
                    break;
            }
        }
        pc.onnegotiationneeded = ev => { if (initiate) { sendOffer(sockid); } };

    }

    sendOffer = function (sockid) {
        var pc = connections[sockid].peerconnection;
        pc.createOffer().then(function (sdp) {
            pc.setLocalDescription(sdp);
            socket.emit("offer", { to: sockid, offer: sdp });
        });
    }

    socket.on("ice", (data) => {
        if (!(data.from in connections)) {
            initiateConnection(data.from, false);
        }
        connections[data.from].peerconnection.addIceCandidate(data.candidate);
    });

    socket.on("offer", (data) => {
        // Respond to offer, change type depending on driver or user

        if (!(data.from in connections)) {
            initiateConnection(data.from, false);
        }
        var pc = connections[data.from].peerconnection;
        pc.setRemoteDescription(data.offer);
        pc.createAnswer().then(function (sdp) {
            pc.setLocalDescription(sdp);
            socket.emit("answer", { to: data.from, answer: sdp });
        });

    });

    socket.on("answer", (data) => {
        // Use answer to set up stream
        var connection = connections[data.from];
        if (connection !== undefined) {
            connection.peerconnection.setRemoteDescription(data.answer);
        }
    });
    console.log("Calling ready");
    ready();
    socket.connect();
});
