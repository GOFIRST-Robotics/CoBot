#!/usr/bin/python3

from flask import Flask, make_response
from flask_socketio import SocketIO
from engineio.payload import Payload
from multiprocessing.connection import Client
import json

app = Flask(__name__)
Payload.max_decode_packets = 100
socketio = SocketIO(app, cors_allowed_origins=["https://carri.julias.ch"])
address = ('localhost', 6000)

@app.route('/secret')
def index():
    resp = make_response("".join(open("/etc/robot_secret")))
    resp.headers['Access-Control-Allow-Origin'] = 'https://carri.julias.ch'
    return resp

@socketio.on('control')
def handle_keys(msg):
    with Client(address, authkey=b'cobot') as conn:
        conn.send(json.loads(msg))

if __name__ == '__main__':
    socketio.run(app, port=8000)
