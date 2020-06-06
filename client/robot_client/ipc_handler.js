// ipc_handler.js
// VERSION 0.20 : LAST_CHANGED 2020-06-06

import net from 'net';

export class IPC {
  // External
  onmessage = undefined; // To be defined
  ready = false;
  // Internal
  socket = undefined;
  _send = undefined;

  constructor(sys_path){
    this.socket = net.createConnection(sys_path);
    this.socket.on('ready', () => {
      this._send = (str) => this.socket.write(str);
      this.ready = true;
    });
    this.socket.on('data', (data) => {
      this.onmessage && this.onmessage(data);
    });
  }

  send(str){
    this._send && this._send(str);
  }
}