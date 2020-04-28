#!/usr/bin/python3

from flask import Flask
from flask_socketio import SocketIO
import json

app = Flask(__name__)
socketio = SocketIO(app)

@app.route('/')
def index():
    return "".join(open("index.html"))

@socketio.on('keys')
def handle_keys(msg):
    print(f"left: {msg['left']}")
    print(f"right: {msg['right']}")
    print(f"forward: {msg['forward']}")
    print(f"reverse: {msg['reverse']}")
    print()

if __name__ == '__main__':
    socketio.run(app)