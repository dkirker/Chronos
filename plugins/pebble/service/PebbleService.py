#!/usr/bin/env python2.7

from ls2 import main, LS2Service, add_timeout
import os.path
import pebble

SERIAL_RX_PREFIX = "/dev/spp_rx_"
SERIAL_TX_PREFIX = "/dev/spp_tx_"

class PalmBluetoothPebbleDevice(object):
    def __init__(self, instanceId):
        print "Opening serial for instanceId", instanceId
        self.input = open(SERIAL_RX_PREFIX + str(instanceId), "rb", 0)
        self.output = open(SERIAL_TX_PREFIX + str(instanceId), "wb+", 0)
        print "rx/tx ready for instanceId", instanceId

    def read(self, size = 1):
        print "Reading: " + size
        return self.input.read(size)

    def write(self, data):
        print "Writing: " + `data`
        return self.output.write(data)

    def close(self):
        print "Closing"
        self.input.close()
        self.output.close()

class PebbleService(LS2Service):
    def __init__(self):
        super(PebbleService, self).__init__("com.palm.service.pebble")

        self.instanceId = None
        self.device = None
        self.pebble = None

        self.scanTimer = None
        self.scanCount = 0

        self.registerCategory("/", [
            ("connect", self.connectHandler),
            ("sendNotificationSMS", self.sendNotificationSMSHandler),
            ("sendNotificationEmail", self.sendNotificationEmailHandler),
        ])

    def isConnected(self):
        return self.pebble is not None

    def findAndConnect(self):
        request = self.call("palm://com.palm.bluetooth/gap/gettrusteddevices", {})

        request.setCallback(self.gotTrustedDevices)

    def gotTrustedDevices(self, response):
        pebbleDevice = None

        for device in response["trusteddevices"]:
            if device["name"].startswith("Pebble"):
                pebbleDevice = device
                break

        if pebbleDevice:
            print "Found pebble:", pebbleDevice["address"]
            self.connectToPebble(pebbleDevice["address"])

    def connectToPebble(self, address):
        self.sppSubscription = self.subscribe("palm://com.palm.bluetooth/spp/subscribenotifications", {"subscribe": True})
        self.sppSubscription.setCallback(self.gotSPPUpdate)

        request = self.call("palm://com.palm.bluetooth/spp/connect", {"address": address})
        request.setCallback(self.gotConnectResponse)

    def gotConnectResponse(self, response):
        print "Got connect response"

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
                self.disconnected()

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

            add_timeout(self.connected, 1)
            return False
        elif self.scanCount < 50:
            self.scanCount += 1
            return True
        else:
            self.scanTimer.cancel()
            return False

    def connected(self):
        print "Connected! Setting up libpebble"

        self.device = PalmBluetoothPebbleDevice(self.instanceId)
        self.pebble = pebble.Pebble(device = self.device)

        print "Created pebble instance"

    def disconnected(self):
        self.instanceId = None

        if self.device:
            self.device.close()
            self.device = None

        if self.pebble:
            self.pebble = None

    def checkConnected(self, message):
        if not self.isConnected():
            message.reply({"returnValue": False, "errorCode": -5000, "errorText": "Not connected to pebble watch"})
            return False
        return True

    ######## Bus methods ########

    def connectHandler(self, message):
        if not self.isConnected():
            self.findAndConnect()

        message.reply({"returnValue": True})

    def sendNotificationSMSHandler(self, message):
        print message.payload

        if self.checkConnected(message):
            sender = message.payload["sender"].encode("utf-8")
            body = message.payload["body"].encode("utf-8")

            self.pebble.notification_sms(sender, body)
            message.reply({"returnValue": True})

    def sendNotificationEmailHandler(self, message):
        if self.checkConnected(message):
            sender = message.payload["sender"].encode("utf-8")
            subject = message.payload["subject"].encode("utf-8")
            body = message.payload["body"].encode("utf-8")

            self.pebble.notification_email(sender, subject, body)
            message.reply({"returnValue": True})

PebbleService()

main()
