// com_sig_pusher.js
// VERSION 0.01 : LAST_CHANGED 2020-04-14
'use strict';
// <script src="https://js.pusher.com/4.1/pusher.min.js"></script>
import {Pusher} from './js/pusher.min';

export class Sig {
  pusher = undefined;
  channel = undefined;
  onmessage = undefined;

  constructor(channel_name="common", event="common", channel_prefix="client-"){
    this.pusher = new Pusher('9627d07a9c6ddb39f270', {
      cluster: 'us2',
      encrypted: true,
      authEndpoint: 'pusher/auth' // This is not right!
    });
    this.channel = this.pusher.subscribe(channel_prefix+channel_name);
    this.pusher.bind_global(function(evtName, data){
      this.onmessage && this.onmessage(data);
    });
  }

  // The string
  send(data, evtName="common"){
    return this.channel.trigger(evtName, JSON.parse(data));
  }
}