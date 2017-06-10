from __future__ import absolute_import
__author__ = 'dkirker'

import errno
import struct

from ls2 import main, LS2Service, add_timeout
import os.path
from . import BaseTransport, MessageTargetWatch
from libpebble2.exceptions import ConnectionError

SERIAL_RX_PREFIX = "/dev/spp_rx_"
SERIAL_TX_PREFIX = "/dev/spp_tx_"

class WebosSerialTransport(BaseTransport):
    """
    Represents a direct connection to a physical Pebble paired to webOS via Bluetooth serial over luna-bus.
    This transport expects to be given a device name or MAC in which to communicate.

    :param address: The MAC of the device
    :type address: str
    """
    must_initialise = True

    def __init__(self, address):
        self.address = address
        self.instanceId = None
        self.input = None
        self.output = None

    def connect(self):
        this.connectToPebble(self.address)

    @property
    def connected(self):
        return self.input is not None and self.output is not None

    def read_packet(self):
        try:
            data = self.input.read(2)
        # except serial.SerialException:
        #    self.input.close()
        #    raise ConnectionError("Disconnected from watch.")
        if len(data) < 2:
            raise ConnectionError("Got malformed packet.")

        length, = struct.unpack('!H', data)
        data += self.input.read(length + 2)
        return MessageTargetWatch(), data

    def send_packet(self, message, target=MessageTargetWatch()):
        assert isinstance(target, MessageTargetWatch)
        self.output.write(message)

    def findAndConnect(self):
        request = self.call("palm://com.palm.bluetooth/gap/gettrusteddevices", {})

        request.setCallback(self.gotTrustedDevices)

    def gotTrustedDevices(self, response):
        pebbleDevice = None

        for device in response["trusteddevices"]:
            if device["name"].contains(self.address): # if device["name"].startswith("Pebble"):
                pebbleDevice = device
                break

        if pebbleDevice:
            print "Found pebble:", pebbleDevice["address"]
            self.connectToPebble(pebbleDevice["address"])

    def connectToPebble(self, address):
        if self.sppSubscription == None:
            self.sppSubscription = self.subscribe("palm://com.palm.bluetooth/spp/subscribenotifications", {"subscribe": True})
            self.sppSubscription.setCallback(self.gotSPPUpdate)

        self.address = address

        request = self.call("palm://com.palm.bluetooth/spp/connect", {"address": address})
        request.setCallback(self.gotConnectResponse)
        request.setErrback(self.gotConnectError)

    def gotConnectResponse(self, response):
        print "Got connect response"

    def gotConnectError(self, response):
        print "Got connect error"
        #self.sppSubscription.cancel()
        #self.sppSubscription = None

    def disconnectFromPebble(self): #, address):
        request = self.call("palm://com.palm.bluetooth/spp/disconnect", {"address": self.address})
        request.setCallback(self.gotDisconnectResponse)
        request.setErrback(self.gotDisconnectResponse)

    def gotDisconnectResponse(self, response):
        print "Got disconnect response"
		
        self.sppSubscription.cancel()
        self.sppSubscription = None

    def gotSPPUpdate(self, response):
        print `response`

        notifyType = response.get("notification", None)

        if notifyType == "notifnservicenames":
            services = response["services"]
            instanceId = response["instanceId"]

            if len(services) == 1:
                self.connectToSPPService(response["instanceId"], services[0])
        elif notifyType == "notifnconnected":
            if response["instanceId"] == self.instanceId and response["error"] == 0:
                self.wait_for_serial()
        elif notifyType == "notifndisconnected":
            if response["instanceId"] == self.instanceId:
                print "Notified of disconnect"
                self.disconnectedEvent()

    def connectToSPPService(self, instanceId, serviceName):
        self.instanceId = instanceId

        request = self.call("palm://com.palm.bluetooth/spp/selectservice", {"instanceId": instanceId, "servicename": serviceName})
        request.setCallback(self.gotSelectServiceResponse)

    def gotSelectServiceResponse(self, response):
        print "selected instanceId", self.instanceId

    def wait_for_serial(self):
        if self.scanTimer:
            self.scanTimer.cancel()
            self.scanTimer = None

        self.scanCount = 0
        self.scanTimer = add_timeout(self.scan_serial_device, 100, repeat = True)

    def scan_serial_device(self):
        self.scanCount = 0

        print "Checking if serial device is ready"
        ready = os.path.exists(SERIAL_RX_PREFIX + str(self.instanceId)) and os.path.exists(SERIAL_TX_PREFIX + str(self.instanceId))

        if ready:
            print "Serial device is ready"
            if self.scanTimer:
                self.scanTimer.cancel()
                self.scanTimer = None

            add_timeout(self.connectedEvent, 1)
            return False
        elif self.scanCount < 50:
            self.scanCount += 1
            return True
        else:
            print "Timed out waiting for device"
            self.scanTimer.cancel()
            self.scanTimer = None

            add_timeout(self.disconnectFromPebble, 1)
            return False

    def connectedEvent(self):
        print "Connected! Setting up libpebble"

        try:
            self.input = open(SERIAL_RX_PREFIX + str(instanceId), "rb", 0)
            self.output = open(SERIAL_TX_PREFIX + str(instanceId), "wb+", 0)
        except OSError as e:
            if e.errno == errno.EBUSY:
                raise ConnectionError("Could not connect to Pebble.")
            else:
                raise
        

    def disconnectedEvent(self):
        self.instanceId = None

        if self.input:
            self.input.close()
            self.input = None

        if self.output:
            self.output.close()
            self.output = None
