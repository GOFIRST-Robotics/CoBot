#!/usr/bin/python3

import time
import json
import asyncio

from multiprocessing.connection import Client

from sig_pusher import PusherSocket, init_pusher

from aiortc import (
    RTCIceCandidate,
    RTCPeerConnection,
    RTCSessionDescription,
    VideoStreamTrack,
)
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder

address = ('localhost', 6000)

async def run(pc, player, signaling):
    # Setup media
    def add_tracks():
        if player and player.audio:
            pc.addTrack(player.audio)

        if player and player.video:
            pc.addTrack(player.video)

        datachannel = pc.createDataChannel("control")
        @datachannel.on("message")
        def on_message(message): # forward data to pwm handler thread
            with Client(address, authkey=b'cobot') as conn:
                conn.send(msg)

    # Wait for signal server connection
    await signaling.connect()

    # consume signaling
    while True:
        obj = await signaling.receive()

        if isinstance(obj, RTCSessionDescription):
            await pc.setRemoteDescription(obj)
            await recorder.start()

            if obj.type == "offer":
                # send answer
                add_tracks()
                await pc.setLocalDescription(await pc.createAnswer())
                await signaling.send(pc.localDescription)
        elif isinstance(obj, RTCIceCandidate):
            await pc.addIceCandidate(obj)
        elif obj is BYE:
            print("Exiting")
            break

if __name__ == "__main__":
    pusher_client, pusher_http = init_pusher()

    sigsocket = PusherSocket(pusher_client, 'common')
    pc = RTCPeerConnection()

    options = {"framerate": "30", "video_size": "640x480"}
    player = MediaPlayer("/dev/video0", format="v4l2", options=options)
    
    loop = asyncio.get_event_loop()
    loop.run_until_complete(
        run(pc=pc, player=None, signaling=sigsocket)
    )
    