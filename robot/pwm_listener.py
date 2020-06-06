#!/usr/bin/python3

import threading
import queue
import time
import Adafruit_PCA9685
import socketserver
import json

pwm_dispatch_queue = queue.Queue()
pwm = Adafruit_PCA9685.PCA9685(address=0x40, busnum=1)
min_pulse = 500
max_pulse = 2500
offset = 125
oscillator_freq = 25000000
pwm_thread_started = False
address = "/tmp/ipccarri"

class PWMDispatchHandler(socketserver.StreamRequestHandler):
    def handle(self):
        data = self.request.recv(1024)
        pwm_dispatch_queue.put_nowait(json.loads(data.decode('U8')))

def handle_pwm(my_queue):
    print("Starting PWM Dispatch")
    pwm.set_pwm_freq(50)
    while True:
        try:
            msg = my_queue.get(block=True, timeout=0.5)
        except queue.Empty:
            write_motors(0,0)
        else:
            speed = 0.75
            if msg['forward']:
                write_motors(speed, speed)
            elif msg['reverse']:
                write_motors(-speed, -speed)
            elif msg['left']:
                write_motors(-speed, speed)
            elif msg['right']:
                write_motors(speed, -speed)
            else:
                write_motors(0,0);
        time.sleep(50/1000)

def write_motors(left, right):
    set_servo_us(0, get_motor_pulse(-left))
    set_servo_us(1, get_motor_pulse(right))

def get_motor_pulse(pct):
    return (pct + 1)/2 * (max_pulse - min_pulse) + min_pulse + offset

# Helper function to make setting a servo pulse width simpler.
def set_servo_us(channel, us):
    time_per_tick = 20000 / 4095
    pwm.set_pwm(channel, 0, round(us/time_per_tick))

if __name__ == '__main__':
    pwm_dispatch_thread = threading.Thread(target=handle_pwm, args=(pwm_dispatch_queue,))
    pwm_dispatch_thread.start()
    with socketserver.UnixStreamServer(address, PWMDispatchHandler) as server:
        server.serve_forever()
