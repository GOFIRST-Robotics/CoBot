// client.js
// VERSION 0.01 : LAST_CHANGED 2020-05-05

// Define initial & transitional state(machine) of client browser
let state = {};
state.logged_in = "false";
state.btn_ctrl = "off"; // || "on" || "disabled" || "hidden"
state.btn_obsv = "off"; // || "on" || "disabled" || "hidden"
state.btn_stop = "hidden"; // || "on" || "off" || "disabled"
state.btn_panic = "disabled"; // || "on" || "off-high" || "off-low" || "hidden"
state.btn_cin = "hidden"; // || "visible"
state.btn_cin_wasd = "off"; // || "on"
state.btn_cin_arrow = "off"; // || "on"
state.btn_cin_mouse = "off"; // || "on"
state.btn_fullscreen = "off"; // || "on"
state.fdbk = "hidden"; // N/A yet
import {Coms} from '../common/coms.js';
const coms = new Coms();

const btn_ctrl = document.getElementById('btn_ctrl');
const btn_obsv = document.getElementById('btn_obsv');
const btn_stop = document.getElementById('btn_stop');
const btn_panic = document.getElementById('btn_panic');
const btn_cin = document.getElementById('btn_cin');
const btn_cin_wasd = document.getElementById('btn_cin_wasd');
const btn_cin_arrow = document.getElementById('btn_cin_arrow');
const btn_cin_mouse = document.getElementById('btn_cin_mouse');
//const btn_cin_arr = [btn_cin_wasd, btn_cin_arrow, btn_cin_mouse];
const btn_fullscreen = document.getElementById('btn_fullscreen');

// TODO:
// //render(state); done
// comms.Req/RmCtrl()
// robot-side resp for video
// Callback/integration somehow for wasd inputs
// robot-side resp for key inputs

btn_ctrl.onclick = function() {
  switch(state.btn_ctrl){
    case "on":
      if(state.btn_stop === "on"){
        // await comms.Stop(false);
        console.log("comms.Stop(false)");
      }
      if(state.btn_panic === "on"){
        // await comms.Panic(false);
        console.log("comms.Panic(false)");
      }
      //comms.RmCtrl();
      state.btn_ctrl = "off";
      state.btn_obsv = "off";
      state.btn_stop = "hidden";
      state.btn_panic = "disabled";
      state.btn_cin = "hidden";
      state.fdbk = "hidden";
      console.log("comms.RmCtrl()");
      break;
    case "off":
      // Render waiting btn
      console.log("comms.ReqCtrl(): " + rtc_pc0);
      //rtc_pc0 = comms.ReqCtrl();
      if(!!rtc_pc0){ // Connection secured
        console.log("Control On");
        state.btn_ctrl = "on";
        state.btn_obsv = "disabled";
        state.btn_stop = "off";
        state.btn_panic = "off-low";
        state.btn_cin = "visible";
        state.btn_cin_wasd = "off";
        state.btn_cin_arrow = "off";
        state.btn_cin_mouse = "off";
        state.btn_fullscreen = "off";
        state.fdbk = "hidden"; //TODO TODO ON!
      }else{ // Denied, in use; robot should ret failed offer to sig ch as notif that busy/refresh userchain
        console.log("Control Disabled");
        state.btn_ctrl = "disabled";
        state.btn_obsv = "off";
        state.btn_stop = "hidden";
        state.btn_panic = "disabled";
        state.btn_cin = "hidden";
        state.fdbk = "hidden";
      }
      break;
    case "disabled":
    case "hidden":
      break;
  }
  render(state);
};

btn_obsv.onclick = function() {
  switch(state.btn_obsv){
    case "on":
      state.btn_obsv = "off";
      if(state.btn_panic === "on"){
        //comms.Panic(false);
        console.log("comms.Panic(false)");
      }
      state.btn_panic = "disabled";
      console.log("comms.RmObsv()");
      //comms.RmObsv();
      break;
    case "off":
      state.btn_obsv = "on";
      state.btn_panic = "off-high";
      console.log("comms.AddObsv()");
      //comms.AddObsv();
      break;
    case "disabled":
    case "hidden":
      break;
  }
  render(state);
};

btn_stop.onclick = function() {
  switch(state.btn_stop){
    case "on":
      state.btn_stop = "off";
      console.log("comms.Stop(false)");
      //comms.Stop(false);
      break;
    case "off":
      state.btn_stop = "on";
      console.log("comms.Stop(true)");
      //comms.Stop(true);
      break;
    case "disabled":
    case "hidden":
      break;
  }
  render(state);
};

btn_panic.onclick = function() {
  switch(state.btn_panic){
    case "on": // Assuming perms to have on
      if(state.btn_obsv === "on"){ // Then this is off-high visuals
        state.btn_panic = "off-high";
      }else{
        state.btn_panic = "off-low";
      }
      console.log("comms.Panic(false)");
      //comms.Panic(false);
      break;
    case "off-low":
    case "off-high":
      state.btn_panic = "on";
      console.log("comms.Panic(true)");
      //comms.Panic(true);
      break;
    case "disabled":
    case "hidden":
      break;
  }
  render(state);
};

btn_cin_wasd.onclick = function() {
  if(state.btn_cin === "visible"){
    if(state.btn_cin_wasd === "off"){
      state.btn_cin_wasd = "on";
      // Should turn other states off...
      state.btn_cin_arrow = "off";
      state.btn_cin_mouse = "off";
      // Listen to wasd keys, add callback somewhere comms?
    }else{
      state.btn_cin_wasd = "off";
      // Rm callback for wasd
    }
  }
  render(state);
};

btn_cin_arrow.onclick = function() {
  if(state.btn_cin === "visible"){
    if(state.btn_cin_arrow === "off"){
      state.btn_cin_arrow = "on";
      state.btn_cin_wasd = "off";
      state.btn_cin_mouse = "off";
      // Listen to arrow keys, add callback somewhere comms?
    }else{
      state.btn_cin_arrow = "off";
      // Rm callback for arrow
    }
  }
  render(state);
};

btn_cin_mouse.onclick = function() {
  if(state.btn_cin === "visible"){
    if(state.btn_cin_mouse === "off"){
      state.btn_cin_mouse = "on";
      state.btn_cin_wasd = "off";
      state.btn_cin_arrow = "off";
      // Listen to mouse keys, add callback somewhere comms?
    }else{
      state.btn_cin_mouse = "off";
      // Rm callback for mouse
    }
  }
  render(state);
};

btn_fullscreen.onclick = function() {
  if(state.btn_fullscreen === "off" &&
      (state.btn_ctrl === "on" || state.btn_obsv === "on")){
    state.btn_fullscreen = "on";
    // https://stackoverflow.com/questions/6039909/html5-full-screen-video
  }else if(state.btn_fullscreen === "on"){
    state.btn_fullscreen = "off"; // Fallback
  }
  // Idk what else todo for this
  render(state); // Enjoy
};

window.onload = render(state);

function render(state){
  // Change states of DOM components, by var state
  // All the handles are already const-def
  // Using className incase of IE
  btn_ctrl.className = "btn";
  btn_ctrl.setAttribute("tabindex", "");
  btn_ctrl.style.visibility = "visible";
  if("on" === state.btn_ctrl){
    btn_ctrl.className += " btn-success";
  }else if("disabled" === state.btn_ctrl){
    btn_ctrl.className += " disabled";
    btn_ctrl.setAttribute("tabindex", "-1");
  }else if("hidden" === state.btn_ctrl){
    btn_ctrl.style.visibility = "hidden";
  }
  btn_obsv.className = "btn";
  btn_obsv.setAttribute("tabindex", "");
  btn_obsv.style.visibility = "visible";
  if("on" === state.btn_obsv){
    btn_obsv.className += " btn-success";
  }else if("disabled" === state.btn_obsv){
    btn_obsv.className += " disabled";
    btn_obsv.setAttribute("tabindex", "-1");
  }else if("hidden" === state.btn_obsv){
    btn_obsv.style.visibility = "hidden";
  }
  btn_stop.className = "btn btn-primary";
  btn_stop.setAttribute("tabindex", "");
  btn_stop.setAttribute("visibility", "visible");
  btn_stop.style.visibility = "visible";
  if("on" === state.btn_stop){
    btn_stop.className += " btn-error";
  }else if("disabled" === state.btn_stop){
    btn_stop.className += " disabled";
    btn_stop.setAttribute("tabindex", "-1");
  }else if("hidden" === state.btn_stop){
    btn_stop.style.visibility = "hidden";
  }
  btn_panic.className = "btn btn-primary";
  btn_panic.setAttribute("tabindex", "");
  btn_panic.setAttribute("visibility", "visible");
  btn_panic.style.visibility = "visible";
  if("on" === state.btn_panic){
    btn_panic.className += " btn-error";
  }else if("disabled" === state.btn_panic){
    btn_panic.className += " disabled";
    btn_panic.setAttribute("tabindex", "-1");
  }else if("hidden" === state.btn_panic){
    btn_panic.style.visibility = "hidden";
  }
  btn_cin.style.visibility = state.btn_cin;
  btn_cin_wasd.className = state.btn_cin_wasd === "on" ? "btn btn-primary" : "btn";
  btn_cin_arrow.className = state.btn_cin_arrow === "on" ? "btn btn-primary" : "btn";
  btn_cin_mouse.className = state.btn_cin_mouse === "on" ? "btn btn-primary" : "btn";
  btn_fullscreen.className = state.btn_fullscreen === "on" ? "btn btn-primary" : "btn";

}