// client.js
// VERSION 0.01 : LAST_CHANGE 2020-05-14
'use strict';
// Transpiling imports to support diff versions, replacing babel polyfill
import "core-js/stable";
import "regenerator-runtime/runtime";

// firebase stuff
import * as firebase from "firebase/app";
import {firebaseConfig} from "../firebaseConfig";
const firebaseApp = firebase.initializeApp(firebaseConfig);
import {ui_init} from './gfb_auth';
const ui = ui_init(firebase);
//const uid = firebase.auth().currentUser.uid; // Idk if this is ready
// Should I have to wait somewhere for auth to finish? Or put the following in a cb for auth?

// This should be wrapped up in coms.js ... but then this would be empty
import {Sig} from '../common/com_sig_gfb_rtdb';
import {RTCSimpleConnection} from '../common/com_rtc';
const gfb_db = firebase.database();
const sig = new Sig((new Date()).getTime().toString(), gfb_db, "rtc"); // Uncert about uid
// This is everything, with config options
const video_el = document.getElementById('remoteview');

async function setup_com(){
  const offerOpts = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  }
  await sig.find_priv_subchannel();
  const pc = new RTCSimpleConnection(offerOpts, sig);
  pc.onopen = evt => {
    // Have sending cmds go here
  };
  pc.onaddstream = evt => { // This method doesn't seem exposed by the RTCPeerConnection; should still work
    video_el.srcObject = evt.stream;
  };
  //pc.ontrack = evt => {};
  pc.connect();
  return pc;
}
// This sets up, & connects to robot; done
const pc = setup_com()
  .then((pc) => { return pc; })
  .catch(err => { console.log(err); });
