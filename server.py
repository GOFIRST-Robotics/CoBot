#!/usr/bin/python3

from flask import Flask
from flask_socketio import SocketIO
import json
import threading
import queue
import time
import Adafruit_PCA9685

app = Flask(__name__)
socketio = SocketIO(app)
pwm_dispatch_queue = queue.Queue()
pwm = Adafruit_PCA9685.PCA9685(address=0x40, busnum=1)
min_pulse = 1000
max_pulse = 2000
oscillator_freq = 25000000

# PWM dispatch thread
def handle_pwm(my_queue):
    while True:
        try:
            cmd = my_queue.get(block=True, timeout=0.5)
        except queue.Empty:
            write_motors(0,0)
        else:
            print("Got msg")
            speed = 0.5
            if msg['forward']:
                write_motors(speed, speed)
            elif msg['reverse']:
                write_motors(-speed, -speed)
            elif msg['left']:
                write_motors(-speed, speed)
            elif msg['right']:
                write_motors(speed, -speed)
        time.sleep(50/1000)

def write_motors(left, right):
    set_servo_us(0, get_motor_pulse(left))
    set_servo_us(1, get_motor_pulse(right))

def get_motor_pulse(pct):
    return (pct + 1)/2 * (max_pulse - min_pulse) + min_pulse

# Helper function to make setting a servo pulse width simpler.
def set_servo_us(channel, us):
    pulse_length = 1000000    # 1,000,000 us per second
    prescale = read_prescale() + 1
    pulse_length *= prescale / oscillator_freq
    us /= pulse_length
    pwm.set_pwm(channel, 0, us)

def read_prescale():
    return pwm._device.readU8(0xFE)

@app.route('/')
def index():
    return "".join(open("index.html"))

@socketio.on('keys')
def handle_keys(msg):
    pwm_dispatch_queue.put_nowait(msg)

if __name__ == '__main__':
    pwm.set_pwm_freq(60)
    pwm_dispatch_thread = threading.Thread(target=handle_pwm, args=(pwm_dispatch_queue,))
    pwm_dispatch_thread.start()
    socketio.run(app)