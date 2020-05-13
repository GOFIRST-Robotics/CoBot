// robot.js
// VERSION 0.01 : LAST_CHANGED 2020-05-10

// This file runs the robot; to be replaced with python

import {Coms} from '../common/coms.js';
const coms = new Coms();
coms.parent = undefined; // Override for robot control
coms.branch_setup("child");
coms.state.obsv = "true";
coms.child.onmessage = evt => {
  const msg = JSON.parse(evt.data);
  if(!(msg.to && (mst.to !== coms.child.pc.localDescription.sdp)))
  switch(msg.type){
    case "ctrl_req":
    case "obsv_req": // There's redundancy here
      if(msg.from !== coms.child.pc.remoteDescription.sdp)
      coms.child.pc.send(JSON.stringify({
        type: "swap_req",
        from: msg.from,
        to: coms.child.pc.remoteDescription.sdp
      }));
      break;
    default: // Don't care about it
      break;
  }
};