// com_rtc.js
// VERSION 0.01 : LAST_CHANGED 2020-05-06
'use strict';
import adapter from 'webrtc-adapter';

// Returns normal pc
// Inputs:
// config: RTCPeerConnection(config)
// socket: sig server impl .send(string), .onmessage(evt) (opt: close())
// Has additional methods:
// .connect() -> void; Creates connection
// .send(chat_msg : string)
// Can specify:
// .onopen(evt)
// .onerror(err)
// .onmessage(chat_msg : string)
export class RTCSimpleConnection extends RTCPeerConnection {
  constructor(config, socket){
    // @ts-ignore
    super(args);
    this.onopen = undefined;
    this.onerror = undefined;
    this.onmessage = undefined;
    // Def below
    this.connect = undefined;
    this.send = undefined;
    this._RTCSimpleConnection(this, socket); // This is pc
  }

  // EX: pc = RTCSimpleConnection(PeerConn_Config, new SigServConn())
  _RTCSimpleConnection(pc, socket) {
    let sc = socket, dc, cc // , pc = new RTCSimpleConnectionClass(config);
    let fail = e => pc.onerror && pc.onerror(e);
    let once = name => new Promise(r => pc.addEventListener(name, r));
    let set = sdp => pc.setLocalDescription(sdp).then(() => sc.send(JSON.stringify({sdp})));
    let incoming = function(msg){
      msg.sdp && pc.setRemoteDescription(msg.sdp)
      .then(() => pc.signalingState == "stable" || pc.createAnswer().then(set)) .catch(fail)
      || msg.ice && pc.addIceCandidate(msg.ice).catch(fail);
    }

    sc.onmessage = e => incoming(JSON.parse(e.data));
    let init = () => {
      dc.onopen = e => {
        sc.close && sc.close();
        (sc = dc).onmessage = e => incoming(JSON.parse(e.data));
        pc.addEventListener("negotiationneeded", e => pc.createOffer().then(set).catch(fail));
      };
      cc.onopen = e => (cc.onmessage = e => pc.onmessage && pc.onmessage(e)) && pc.onopen && pc.onopen(e);
    };
    let co = pc.createOffer.bind(pc);
    // @ts-ignore
    pc.createOffer = o => (dc || !init([dc, cc] = ["signaling", "chat"].map(n => pc.createDataChannel(n)))) && co(o);
    once("datachannel").then(e => (dc = e.channel) && once("datachannel").then(e => cc = e.channel)).then(init);
    pc.addEventListener("icecandidate", e => sc.send(JSON.stringify({ice: e.candidate})));
    pc.connect = () => pc.createOffer().then(set).catch(fail);
    pc.send = msg => cc && cc.send(msg);
    // return pc;
  }
}
// https://blog.mozilla.org/webrtc/signaling-with-rtcsimpleconnection/
// This might work better in ts as class ext