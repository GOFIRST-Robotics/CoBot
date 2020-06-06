const net = require('net');

/**
 * Send a message to the robot control thread over IPC
 * @param {*} message JSON representation of the message to send
 */
function sendIPC(message) {
    var ipcSocket = net.createConnection("/tmp/ipccarri");
    ipcSocket.write(message.stringify());
    ipcSocket.destroy();
}

