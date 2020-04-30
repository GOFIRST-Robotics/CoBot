#!/usr/bin/python3

from flask import Flask
from flask_socketio import SocketIO
import json
import threading
import queue
import time

app = Flask(__name__)
socketio = SocketIO(app)
pwm_dispatch_queue = queue.Queue()

# PWM dispatch thread
def handle_pwm(my_queue):
    while True:
        try:
            cmd = my_queue.get(block=True, timeout=0.5)
        except queue.Empty:
            print("Didn't get msg within 0.5s")
        else:
            print("Got msg")
        time.sleep(50/1000)

@app.route('/')
def index():
    return "".join(open("index.html"))

@socketio.on('keys')
def handle_keys(msg):
    pwm_dispatch_queue.put_nowait(msg)

if __name__ == '__main__':
    pwm_dispatch_thread = threading.Thread(target=handle_pwm, args=(pwm_dispatch_queue,))
    pwm_dispatch_thread.start()
    socketio.run(app)