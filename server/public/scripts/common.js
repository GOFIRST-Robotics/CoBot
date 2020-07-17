const { RTCPeerConnection, RTCSessionDescription } = window;

const configuration = { iceServers: [{ urls: 'stun:18.191.246.40' }] };

const socket = io("http://localhost:5000", { "autoConnect": false });

// Todo add audio
var getMedia = navigator.mediaDevices.getUserMedia({ audio: false, video: true });
var localMedia = null;
var connections = {};

// These are "function prototypes" so that the ready() function knows that they exist
var initiateConnection = undefined;
var sendOffer = undefined;
var createCallback = undefined;
var connectCallback = undefined;

// Everything is wrapped inside the getMedia promise callback because we need to add the
// local video to the peer connection before any negotiation can happen
getMedia.then(function (stream) {
    document.getElementById("local-video").srcObject = stream;
    localMedia = stream;

    // This function is called to initiate a connection to another client that has socket ID 'sockid'
    // The "initiate" parameter is whether this connection will initiate an offer.
    initiateConnection = function (sockid, initiate) {
        var pc = new RTCPeerConnection(configuration);

        // Set up the remote video element
        var element = document.createElement("video");
        element.className = "remote-video";
        element.setAttribute("autoplay", "true");
        document.getElementById("videos").appendChild(element);

        // create the connection object for future storage
        var connection = { peerconnection: pc, inboundStream: null, initiator: initiate, videoElement: element };
        connections[sockid] = connection;

        // Add local media to the peer connection
        for (const track of localMedia.getTracks()) {
            pc.addTrack(track);
        }

        // PeerConnection callbacks
        
        pc.ontrack = e => {
            // Taken from MDN, I'm not sure how it works. Adds tracks to the remote video element when they arrive from the PC
            if (e.streams && e.streams[0]) {
                element.srcObject = e.streams[0];
            } else {
                if (!connection.inboundStream) {
                    connection.inboundStream = new MediaStream();
                    element.srcObject = connection.inboundStream;
                }
                connection.inboundStream.addTrack(e.track);
            }
        };
        pc.onicecandidate = function (evt) {
            // ICE signaling setup
            if (evt.candidate) {
                socket.emit("ice", { to: sockid, candidate: evt.candidate });
            }
        };
        pc.onconnectionstatechange = function (event) {
            switch (pc.connectionState) {
                case "connected":
                    // connectCallback could be defined by the different scripts
                    if (connectCallback) {
                        connectCallback(sockid, connection);
                    }
                    break;
                case "disconnected":
                case "failed":
                case "closed":
                    // Get rid of the remote video element and delete this connection
                    // TODO this doesn't always work
                    element.parentNode.removeChild(element);
                    delete connections[sockid];
                    break;
            }
        }
        // If negotiation is available to start and this is an initiating side, send an offer
        pc.onnegotiationneeded = ev => { if (initiate) { sendOffer(sockid); } };

        // createCallback could be defined by the different scripts
        if (createCallback) {
            createCallback(sockid, connection);
        }
        return connection;
    }

    // Create an offer and send it to the other client
    // This should not be needed to be called by the individual scripts
    sendOffer = function (sockid) {
        var pc = connections[sockid].peerconnection;
        pc.createOffer().then(function (sdp) {
            pc.setLocalDescription(sdp);
            socket.emit("offer", { to: sockid, offer: sdp });
        });
    }

    // ICE signaling
    socket.on("ice", (data) => {
        if (!(data.from in connections)) {
            initiateConnection(data.from, false);
        }
        connections[data.from].peerconnection.addIceCandidate(data.candidate);
    });

    // Respond to an offer
    // initiateConnection with initiate=false will just set up the local PC without sending an offer
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

    // Use answer to set up stream
    socket.on("answer", (data) => {
        var connection = connections[data.from];
        if (connection !== undefined) {
            connection.peerconnection.setRemoteDescription(data.answer);
        }
    });

    // Run the ready callback to let individual scripts do their tasks
    console.log("Calling ready");
    ready.then(() => {
        // Connect to sockets only after everything else is completed, because we need to catch the connection event
        socket.connect();
    });
});
