#!/usr/bin/python3

from flask import Flask
from flask_socketio import SocketIO
from multiprocessing.connection import Client

app = Flask(__name__)
socketio = SocketIO(app)
address = ('localhost', 6000)

@app.route('/')
def index():
    return "".join(open("index.html"))

@socketio.on('keys')
def handle_keys(msg):
    with Client(address, authkey=b'cobot') as conn:
        conn.send(msg)

if __name__ == '__main__':
    socketio.run(app)
