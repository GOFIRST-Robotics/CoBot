import pysher
import pusher
import my_secrets
import time
import json
import asyncio
from collections import deque

pusher_http = None
pusher_client = None
is_connected = False
BYE = object()

def pusher_trigger(channels, event, message, exclude=None):
    pusher_http.trigger(channels, event, message, socket_id=exclude)

def object_from_json(message):
    if message["type"] in ["answer", "offer"]:
        return RTCSessionDescription(**message)
    elif message["type"] == "candidate" and message["candidate"]:
        candidate = candidate_from_sdp(message["candidate"].split(":", 1)[1])
        candidate.sdpMid = message["id"]
        candidate.sdpMLineIndex = message["label"]
        return candidate
    elif message["type"] == "bye":
        return BYE


def object_to_json(obj):
    if isinstance(obj, RTCSessionDescription):
        message = {"sdp": obj.sdp, "type": obj.type}
    elif isinstance(obj, RTCIceCandidate):
        message = {
            "candidate": "candidate:" + candidate_to_sdp(obj),
            "id": obj.sdpMid,
            "label": obj.sdpMLineIndex,
            "type": "candidate",
        }
    else:
        assert obj is BYE
        message = {"type": "bye"}
    return message


class PusherSocket:
    def __init__(self, pusher_inst, channel_name):
        self.channel_name = channel_name
        self.pusher_inst = pusher_inst
        self.channel = None
        self.messages = deque()
    
    def send_raw(self, message):
        if self.channel:
            pusher_trigger([self.channel_name], 'common', json.dumps(message), 
                            exclude=self.channel.connection.socket_id)

    def rx_msg(self, message):
        self.messages.append(json.loads(message))

    async def wait_for_msg(self):
        while True:
            if len(self.messages) > 0:
                return self.messages.popleft()
            await asyncio.sleep(50/1000)

    async def connect(self):
        # Connect to pusher to start rxing messages
        self.channel = self.pusher_inst.subscribe(self.channel_name)
        self.channel.bind('common', lambda msg: self.rx_msg(msg))

    async def close(self):
        pass
    
    async def receive(self):
        message = await self.wait_for_msg()
        return object_from_json(message)

    async def send(self, obj):
        message = object_to_json(obj)
        self.send_raw(message)

def connect_handler(data):
    # Called on successful Pusher connection
    global is_connected
    is_connected = True

def init_pusher():
    pusher_client = pysher.Pusher(key=my_secrets.key, secret=my_secrets.secret, cluster=u'us2')
    pusher_http = pusher.Pusher(my_secrets.app_id, my_secrets.key, my_secrets.secret, cluster=u'us2')
    
    pusher_client.connection.bind('pusher:connection_established', connect_handler)
    pusher_client.connect()

    print("Waiting for Pusher connection")
    while not is_connected:
        time.sleep(100/1000)

    print("Connected")
    return pusher_client, pusher_http