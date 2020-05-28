// client.js
// VERSION 0.01 : LAST_CHANGE 2020-05-14
'use strict';

// firebase stuff
import * as firebase from "firebase/app";
import {firebaseConfig} from "../firebaseConfig";
const firebaseApp = firebase.initializeApp(firebaseConfig);
import {ui_init} from './fire_auth';
const ui = ui_init(firebase);

// This should be wrapped up in coms.js ... but then this would be empty
import {Sig} from '../common/com_sig_pusher';
import {RTCSimpleConnection} from '../common/com_rtc';
// This is everything, with config options
const video_el = document.getElementById('remoteview');
function setup_com(){
  const offerOpts = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  }
  const pc = RTCSimpleConnection(offerOpts, new Sig());
  pc.onopen = evt => {
    // Have sending cmds go here
  };
  pc.onaddstream = evt => {
    video_el.srcObject = evt.stream;
  };
}

// This sets up, & connects to robot; done
const pc = setup_com();
pc.connect();
