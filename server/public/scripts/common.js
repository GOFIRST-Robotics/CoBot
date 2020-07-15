const configuration = {iceServers: [{urls: 'stun:18.191.246.40'}]};
const pc = new RTCPeerConnection(configuration);

const { RTCPeerConnection, RTCSessionDescription } = window;

const socket = io.connect("localhost:5000");