// com_sig_gfb_rtdb.js
// VERSION 0.01 : LAST_CHANGED 2020-06-03
'use strict';

// Two chief modes to use this:
// 1. Just talk in an open channel, default behavior starting on Ctor
// 2. Make a private 1-1 subchannel, to only talk to the first person to show up
//  This can either be done at constructor (priv_subchannel=true) (an awaiting op)
//  Or this can be called after creation. The ability to send(...) will always
//  Be available, but to go to a subchannel, it must finish. Likewise,
//  onmessage(...) will be called on all channel msgs until the subchannel
//  is connected. Ergo it can either be passed as a parameter, or set
//  after via await/then.
export class Sig {
  constructor(db, channel_name="common"){
    this.db = db;
    this.channel_name = channel_name;
    this.ref = this.db.ref(channel_name);
    this.priv_ch = {state: "init"}; // kill?
    // This is for triggering onmessage immediately, when set, in case the
    // values were already there lingering, w/o being updated
    return new Proxy(this, {
      set(target, name, value){
        target[name] = value;
        if(name === "onmessage"){
          target._register_onmessage(value);
        }
        return true; // This could not be case if _register_onmessage has err
      }
    });
  }

  // More docs:
  // So, 'channel' is the common ch directed to in this use-case.
  //  Opt. #1 would just stop here
  // Here, 'channel'/{'$push()'} subchannels declare state-connection
  //  This is only for conn state, getting connected to another
  //  Makes it easy/cheap/nonblocking to update
  // Then, 'channel'+'_data'/{'$push_val'} subchannels, known by both
  //  parties, are open for 1-1 communication. This case is improved by
  //  moving to webrtc datachannels, which this was intended for.
  async find_priv_subchannel(){
    const data_ch_suffix = "_data__com_sig_gfb_rtdb__";
    const waiting = "__waiting__com_sig_gfb_rtdb__";
    return new Promise((res, rej) => {
      // This may abort in the middle, no can't make self-changes until
      // completion cb verifies it worked
      let data_ref = undefined;
      let child_key = undefined;
      this.ref.transaction((channel_val) => {
        // If there's someone waiting, connect to them
        if(channel_val != null){
          for(const [key,val] of Object.entries(channel_val)){
            if(val === waiting){
              data_ref = this.db.ref(this.channel_name + data_ch_suffix).push();
              child_key = key;
              channel_val[child_key] = data_ref.key;
              return channel_val;
            }
          }
        }
        // else, become someone waiting
        let self_ref = this.ref.push();
        // data_ref not set
        child_key = self_ref.key; // Logic of 2 states
        channel_val[child_key] = waiting;
        return channel_val;
      }, (err, bSuccess, snapshot) => { // If ok, change ref & be ready
        // On completion!
        if(bSuccess){
          if(data_ref != null){ // Found waiter
            // Update this with the ref, mark ready
          }else{ // Waiting
            // Think about onDisconnect, on close
            let self_ref = this.ref.child(child_key);
            self_ref.on('value', (snapshot) => {
              if(snapshot.val() != waiting){
                data_ref = this.db.ref(this.channel_name + data_ch_suffix).child(self_ref.val());
                self_ref.off(); // Removes all callbacks on this!
                self_ref.set(null); // & just delete the data, used up!
              }
            });
          }
        }else if(err != null){
          rej(err);
        }
      }, true);
    }

  }

  _register_onmessage(cb){
    // Need set to watch / run on set, an init for it, to call cb
    // right away on the data
  }

  // The string
  send(data, evtName="common"){
    return "Not Impl Yet"; //this.channel.trigger(evtName, JSON.parse(data));
  }

  // To close
  close(){

  }
}
