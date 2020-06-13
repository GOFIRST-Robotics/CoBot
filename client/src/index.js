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


// This should be wrapped up in coms.js ... but then this would be empty
import {Sig} from '../common/com_sig_gfb_rtdb';
import {RTCSimpleConnection} from '../common/com_rtc';
const gfb_db = firebase.database();
const sig = new Sig(gfb_db, "rtc");
// This is everything, with config options
const video_el = document.getElementById('remoteview');

async function setup_com(){
  const offerOpts = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  }
  await sig.find_priv_subchannel();
  const pc = RTCSimpleConnection(offerOpts, sig);
  pc.onopen = evt => {
    // Have sending cmds go here
  };
  pc.onaddstream = evt => {
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
