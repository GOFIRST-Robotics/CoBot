// index.js
// VERSION 0.01 : LAST_CHANGED 2020-06-06

import {IPC} from './ipc_handler';

pydrive = new IPC("/tmp/ipc_carri");
// On recv msg from com
// drive.send(JSON.stringify(cmds));