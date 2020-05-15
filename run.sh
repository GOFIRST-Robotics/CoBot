#!/bin/bash

python3 pwm_listener.py &
/usr/local/bin/gunicorn -b 0.0.0.0 --worker-class eventlet -w 1 server:app
