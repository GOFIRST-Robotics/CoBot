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
  constructor(uid, db, channel_name="common"){
    this.uid = uid;
    this.db = db;
    this.channel_name = channel_name;
    this.ref = this.db.ref(this.channel_name);
    this.priv = false;
    this.closed = false; // Set when est. connection
    this.onmessage = undefined;
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
  // TODO: timeouts, closing, onDisconnect... aka dealing w errors
  async find_priv_subchannel(){
    const data_ch_suffix = "_data__com_sig_gfb_rtdb__";
    const waiting = "__waiting__com_sig_gfb_rtdb__";
    this.closed = true;
    return new Promise((res, rej) => {
      let data_ref = undefined;
      let child_key = undefined;
      function complete(){
        this.priv = true;
        this.closed = false;
        this._change_ref(data_ref);
        this.send(""); // Set it to existance with an empty string
        // I should set a cb on 'child_removed' evt, if priv, that re-runs
        // close && find_priv_subchannel; this is my attempt
        this.ref.once('child_removed', (old_snapshot) => {
          this.close();
          this.find_priv_subchannel();
        });
      }
      function oncompletion(err, bSuccess, snapshot){ // If ok, change ref & be ready
        if(bSuccess){
          if(data_ref != null){ // Found waiter
            // Update this with the ref, assume the other will be ready
            complete();
            res(); // Done! call the code after/awaiting
          }else{ // I'm the waiter, waiting
            // TODO Think about onDisconnect, on close
            let self_ref = this.ref.child(child_key);
            self_ref.on('value', (snapshot) => {
              if(snapshot.val() != waiting){
                data_ref = this.db.ref(this.channel_name + data_ch_suffix).child(self_ref.val());
                // if(){ Check if data_ref is valid/exists; poss timing issue w above
                complete();
                self_ref.off(); // Removes all callbacks on this!
                self_ref.set(null); // & just delete the data, used up!
                res(); // Done! call the code after/awaiting
                //}
              }
            });
          }
        }else if(err != null){
          rej(err);
        }else{
          console.log("Error?");
          throw Error;
        }
      }
      // This may abort in the middle, can't make this-changes until
      // completion cb verifies it worked
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
      }, oncompletion, true);
    });
  }

  _change_ref(ref){
    if(this.onmessage){
      this.ref.off();
      this.ref = ref;
      this.ref.on('child_added', this._onmessage_cb);
    }else{
      this.ref = ref;
    }
  }

  _onmessage_cb(snapshot, prevKey = null){
    if(this.onmessage && !this.closed){
      const val = snapshot.val();
      val != null
      && val.uid != null && val.uid != this.uid
      && val.data != null && val.data != ""
      && this.onmessage(val.data);
    }
  }

  _register_onmessage(onmessage){
    if(this.priv){ // priv ch made before onmessage set
      this.ref.on('child_added', this._onmessage_cb);
    }
  }

  // The string
  send(data, evtName="common"){
    // evtName, not impl/used? Like a topic? Only matters if try to sync api w/ other sigs
    let sent = false;
    if(!this.closed){
      this.ref.push({uid: this.uid, data: data},
        (err) => { sent = (err === null); });
    }
    return sent;
  }

  // To close
  // Alt, to use the main channel again, just set this.closed = true
  close(){ // Resets & turns off all subs
    //this.onmessage = undefined;
    this.closed = true;
    this.ref.off();
    if(this.priv){
      this.ref.set(null); // Delete priv subch
      this.ref = this.db.ref(this.channel_name);
    }
    this.priv = false;
  }
}
