import Adafruit_PCA9685

pwm = Adafruit_PCA9685.PCA9685(address=0x40, busnum=1)
min_pulse = 500
max_pulse = 2500
offset = 125
oscillator_freq = 25000000

def write_motors(left, right):
    set_servo_us(0, get_motor_pulse(left))
    set_servo_us(1, get_motor_pulse(right))

def get_motor_pulse(pct):
    return (pct + 1)/2 * (max_pulse - min_pulse) + min_pulse + offset

# Helper function to make setting a servo pulse width simpler.
def set_servo_us(channel, us):
    print(f"{channel}: {us}")
    time_per_tick = 20000 / 4095
    pwm.set_pwm(channel, 0, round(us/time_per_tick))

def read_prescale():
    return pwm._device.readU8(0xFE)

pwm.set_pwm_freq(50)
while True:
    write_motors(0,0)
