// coms.js
// VERSION 0.01 : LAST_CHANGED 2020-05-06
'use strict';
import * as Sig from './com_sig_pusher'; // Can change backend; keep intf
import {RTCSimpleConnection} from './com_rtc';

// Options
const offerOpts = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};
const dataChOpts = {
  ordered: true,
  negotiated: true,
  id: 0
};
const branch_obj = {
    pc: undefined,
    presence: [],
    pc_conf: false
  }

export class Coms {
  parent = scopy(branch_obj);
  child = scopy(branch_obj);
  state = {
    "panic": "false", // || "true" || "pending"
    "obsv": "false",  // || "true" || "pending"
    "ctrl": "false",  // || "true" || "pending"
  };
  root_state = scopy(this.state);
  conn_timer = undefined;
  swap_conf = false;

  onchat = undefined;

  // Non-awaiting
  constructor(){
    this._constructor();
  }
  _constructor(){
    this.reset("parent");
    this.reset("child");
    this.reset("state");
    this._branch_setup("parent");
  }

  async init(timeout){ // Join the group
    this.conn_timer = window.setTimeout(function(){
      return false;
    }, timeout);
    do{
      this.parent.pc.connect();
    }while((await !this.conn_timer()) || !this.parent.pc_conf);
  }

  reset(elem){ // Oops, dup
    if(elem === "parent" || elem === "child"){
      this[elem] = {
        pc: undefined,
        presence: [],
        pc_conf: false
      };
    }else if(elem === "state"){
      this.state = {
        "panic": "false",
        "obsv": "false",
        "ctrl": "false",
      };
    }
  }

  // Return state.ctrl === "true"; aka if connected or not
  async ReqCtrl(){
    this.parent.pc.send(JSON.stringify({
      type: "ctrl_req",
      from: this.parent.pc.localDescription.sdp
    }));
    this.state.ctrl = "pending";
    while(this.state.ctrl === "pending"){
      await this._timeout(100);
    }
    return this.state.ctrl === "true";
  }

  async RmCtrl(){ // Robot side needs to handle conn close
    ["parent", "child"].forEach(branch => {
      this[branch].pc.onconnectionstatechange = evt =>
       this[branch].pc_conf = false;
    });
    this._pop();
    while(this.parent.pc_conf || this.child.pc_conf){
      await this._timeout(100);
    }
    this._constructor();
  }

  async RmObsv(){
    this.ReqCtrl(); // Same thing really
  }

  // Internal functions
  _pc_defs(pc, branch, debug_msg = ""){
    pc.onerror = err => console.log(debug_msg + " " + branch + "Err: " + err);
    pc.onmessage = this._onmessage_(this._notBranch(branch));
    // TODO: onconnectionstatechange, set pc = undef if bad; recon iff parent
    // Everywhere I use this^, usually want onclose
  }

  _branch_setup(branch){
    this[branch].pc = RTCSimpleConnection(offerOpts, new Sig());
    this[branch].onopen = evt => {
      this[branch].pc_conf = true;
      if(branch === "parent"){
        !!this.conn_timer && clearTimeout(this.conn_timer);
        this._branch_setup("child");
      }
    };
    this._pc_defs(this[branch].pc, branch);
  }

  async _onmessage_(to){
    return (evt => {return this._onmessage(evt, to);});
  }

  async _onmessage(evt, to){
    const msg = JSON.parse(evt.data);
    const from = this._notBranch(to);
    const req_app_fn = () => {
      ["parent", "child"].forEach(branch => {
        this[branch].pc.send(JSON.stringify({
          type: "req_approved",
          to: msg.from,
          from: this.child.pc.localDescription.sdp,
          child: this.child.pc.remoteDescription.sdp
        }));
      });
    };
    if(!(msg.to && (msg.to !== this[from].pc.localDescription.sdp)))
    switch(msg.type){
      /*
      case "swap_req": // Must be for me, btwn my [from].pc & msg.from
        if(msg.ctrl && this.state.ctrl === "pending"){
          this.state.ctrl = "true";
        }
        const req = branch => JSON.stringify({
          type: "swap_req",
          from: this[branch].pc.localDescription.sdp,
          to: msg.from
        });
        const resp = JSON.stringify({
          type: "swap_info",
          to: msg.from,
          parent: this.parent.pc.remoteDescription.sdp,
          child: this.child.pc.remoteDescription.sdp
        });
        this.parent.pc.send(resp);
        this.child.pc.send(resp); // Forgot logic of which to-where
        // To avoid looping, also send out to new peer the req
        this.parent.pc.send(req("parent"));
        this.child.pc.send(req("parent")); // Forgot logic of which to-where
        return;
      case "swap_info": // Between nodes w/ parents/childs swap
        await this._swap(from, msg);
        return;
      case "swap_me": // Only parent/child should recv
        await this._onswap_conf(from, await this._swap_me(from, msg));
        return;
      case "swap_conf": // Between each swap
        this.swap_conf = true;
        return;
        */
      case "child_req":

        break;
      case "parent_notice":

        break;
      case "req_approved":

        break;
      case "obsv_req":
        if(this.state.obsv === "true"){ // Intercept call
          req_app_fn();
          // child_req code

          return;
        }
        break;
      case "chat":
        this.onchat && this.onchat(msg);
        break;
      case "root_state":
        this.root_state = msg.root_state;
        if(this.state.ctrl === "pending" && this.root_state.ctrl !== "false"){
          this.state.ctrl = "false";
        }
        break;
      case "ctrl_req":
        if(this.state.ctrl !== "false") return; // Silence
        else break; // Answered by root, as swap or neg root_state
        // Actually, here: just check if no-parent && root && state ctrl, req_app_fn();
      //case "ctrl_rm": // These are actually just handled locally; pop & start new
      //case "obsv_rm": // These are same: mv'd to end of obsv list
      default: break;
    }
    this[to].pc.send(evt.data); // Pass along
  }

  _pop(){ // From node to pop out
    this.parent.pc.send(JSON.stringify({
      type: "child_req",
      to: this.parent.pc.remoteDescription.sdp,
      from: this.child.pc.remoteDescription.sdp
    }));
    this.child.pc.send(JSON.stringify({
      type: "parent_notice",
      to: this.child.pc.remoteDescription.sdp,
      from: this.parent.pc.remoteDescription.sdp
    }));
  }

  async _child_insert(from, prch_str=""){ // For child_req, to swap child
    this.child.pc.send(JSON.stringify({
      type: "parent_notice",
      to: this.child.pc.remoteDescription.sdp,
      from: from
    }));
    ["parent", "child"].forEach(branch => {
      this[branch].pc.send(JSON.stringify({
        type: "req_approved",
        to: from
      }));
    });
    return this._insert_replace("child", prch_str);
  }

  // The cb allows to delay final release/swap
  async _insert_replace(branch, prch_str = ""){ // From parent_notice, to swap parent
    return new Promise(resolve => {
      const br = scopy(branch_obj);
      br.pc = RTCSimpleConnection(offerOpts, new Sig(prch_str));
      br.pc.onerror = err => console.log("_insert_replace" + branch + " err: " + err);
      // This is a closed loop btwn this & other, no other nodes
      br.pc.onopen = evt => {
        br.pc_conf = true;
        br.pc.send(JSON.stringify({
          type: "conf"
        }));
      };
      br.pc.onmessage = async evt => {
        if(JSON.parse(evt.data).type === "conf" && br.pc_conf){
          await resolve(branch); // This allows
          if(this[branch].pc){
            this[branch].pc.onconnectionstatechange = function(){};
            this[branch].pc.close();
          }
          this[branch] = br;
          this._pc_defs(this[branch].pc, branch);
        }else if(br.pc_conf){
          br.pc.send(JSON.stringify({
            type: "conf"
          }));
        }
      };
    });
  }

  async _swap(from, msg){ // Received from [from].pc,
    // Until finished, maintain original parent/child pc's, as the sig
    // msg has .parent/.child of new peer
    ["parent", "child"].forEach(branch => {
      this[branch].pc.send(JSON.stringify({
        type: "swap_me",
        from: this[branch].pc.localDescription.sdp,
        to: msg[branch]
      }));
    });
    const p2_prom = this._swap_me(from, msg); // FIX
    const c2_prom = this._swap_me(from, msg); // Need to also handle if no child
    const p2 = await p2_prom;
    const c2 = await c2_prom;
    this[from].pc.send(JSON.stringify({
      type: "swap_conf"
    }))
    this._onswap_conf("parent", p2);
    this.swap_conf = true;
    this._onswap_conf("child", c2);
  }

  async _onswap_conf(branch, pc){
    while(!this.swap_conf){
      await this._timeout(100);
    }
    this.swap_conf = false;
    this[branch].pc.close();
    this[branch].pc = pc;
  }

  async _swap_me(from, msg){
    // msg has .from with the id of [from].pc to swap
    const pc = RTCSimpleConnection(offerOpts, new Sig());
    let pc_conf = false;
    // @ts-ignore
    pc.onopen = evt => {pc_conf = true;};
    // @ts-ignore
    pc.connect();
    while(!pc_conf){
      await this._timeout(100);
    }
    return pc;
  }

  // Useful functions
  _notBranch(branch){
    return branch === "child" ? "parent" : "child";
  }

  _timeout(ms){
    new Promise(res => setTimeout(res, ms));
  }
}

function scopy(obj){
  return JSON.parse(JSON.stringify(obj));
}