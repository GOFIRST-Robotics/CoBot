#!/usr/bin/python3

import pysher
import pusher
import secrets
import time
import json

pusher_http = None
is_connected = False

def pusher_trigger(channels, event, message):
    pusher_http.trigger(channels, event, message)

class PusherSocket:
    def __init__(self, pusher_inst, channel_name):
        self.pusher_inst = pusher_inst
        self.channel_name = channel_name
        self.channel = self.pusher_inst.subscribe(channel_name)
        self.channel.bind('signal', lambda evt: self.rx_msg(evt))
    
    def send(self, message):
        pusher_trigger([self.channel_name], 'signal', json.dumps({"source": "robot", "message": message}))

    def rx_msg(self, evt):
        data = json.loads(evt)
        if data['source'] == 'robot':
            print("Got message from robot, ignoring")
        else:
            return data['message']

def connect_handler(data):
    global is_connected
    is_connected = True

if __name__ == "__main__":
    pusher_client = pysher.Pusher(key=secrets.key, secret=secrets.secret, cluster=u'us2')
    pusher_http = pusher.Pusher(secrets.app_id, secrets.key, secrets.secret, cluster=u'us2')
    
    pusher_client.connection.bind('pusher:connection_established', connect_handler)
    pusher_client.connect()

    while not is_connected:
        time.sleep(1)

    print("Connected")

    sigsocket = PusherSocket(pusher_client, 'connections')
    while True:
        sigsocket.send("test")
        time.sleep(1)
    