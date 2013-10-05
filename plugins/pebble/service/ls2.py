import sys
import json
import signal
from threading import Thread
from ctypes import *

glib = cdll.LoadLibrary("libglib-2.0.so.0")
lunaservice = cdll.LoadLibrary("liblunaservice.so")

glib.g_main_loop_new.restype = c_void_p
glib.g_timeout_add.restype = c_uint

lunaservice.LSRegisterPubPriv.restype = c_bool
lunaservice.LSMessageGetResponseToken.restype = c_ulong
lunaservice.LSMessageGetPayload.restype = c_char_p

mainloop = glib.g_main_loop_new(None, False)

class LS2Exception(Exception):
    def __init__(self, err):
        super(Exception, self).__init__(err.message)

class LSError(Structure):
    _fields_ = [
        ("error_code", c_int),
        ("message", c_char_p),
        ("file", c_char_p),
        ("file", c_char_p),
        ("line", c_int),
        ("func", c_char_p),
        ("padding", c_void_p),
        ("magic", c_ulong)
    ]

    def __init__(self):
        Structure.__init__(self)
        self.ref = byref(self)

        lunaservice.LSErrorInit(self.ref)

    def __del__(self):
        lunaservice.LSErrorFree(self.ref)

LSFILTERFUNC = CFUNCTYPE(c_bool, c_void_p, c_void_p, c_void_p)
LSMETHODFUNC = CFUNCTYPE(c_bool, c_void_p, c_void_p, c_void_p)
GSOURCEFUNC = CFUNCTYPE(c_bool, c_void_p)

class ServiceRequest(object):
    def __init__(self, service, token, subscribe = False):
        self.service = service
        self.token = token
        self.ls2Token = None
        self.isSubscription = subscribe
        self._callback = None
        self._errback = None

    def tellLS2Token(self, token):
        self.ls2Token = token

    def handleResponse(self, response):
        if response.get("returnValue") == False:
            if self._errback:
                self._errback(response)
            else:
                print "Unhandled error response:", response
        else:
            if self._callback:
                self._callback(response)

    def setCallback(self, func):
        self._callback = func
        return self

    def setErrback(self, func):
        self._callback = func
        return self

    def cancel(self):
        if self.isSubscription == True:
            self.service.cancel(self.ls2Token)

class LS2Client(object):
    def __init__(self, busName):
        self.requests = {}

        handlePub = c_void_p(0)
        handlePrv = c_void_p(0)
        err = LSError()

        try:
            if not lunaservice.LSRegisterPubPriv(busName, byref(handlePub), True, err.ref):
                raise LS2Exception(err)

            if not lunaservice.LSRegisterPubPriv(busName, byref(handlePrv), False, err.ref):
                raise LS2Exception(err)

            if not lunaservice.LSGmainAttach(handlePub, mainloop, err.ref):
                raise LS2Exception(err)

            if not lunaservice.LSGmainAttach(handlePrv, mainloop, err.ref):
                raise LS2Exception(err)

            self.handlePub = handlePub
            self.handlePrv = handlePrv
        except:
            if handlePub:
                err = LSError()
                lunaservice.LSUnregister(handlePub, err)

            if handlePrv:
                err = LSError()
                lunaservice.LSUnregister(handlePrv, err)

            raise

        self.handleResponseCallback = LSFILTERFUNC(self.handleResponse)

    def handleResponse(self, handle, message, ctx):
        token = lunaservice.LSMessageGetResponseToken(message)

        request = self.requests.get(token, None)

        if request:
            payload = lunaservice.LSMessageGetPayload(message)
            response = json.loads(payload)

            if not request.isSubscription:
                del self.requests[token]

            request.tellLS2Token(token)
            request.handleResponse(response)

            return True
        else:
            return False

    def _call(self, uri, params, subscribe = False):
        err = LSError()

        payload = json.dumps(params) if params else "{}"

        token = c_ulong()

        if subscribe:
            sendCall = lunaservice.LSCall
        else:
            sendCall = lunaservice.LSCallOneReply

        sendCall(self.handlePrv, uri, payload, self.handleResponseCallback, None, byref(token), err.ref)

        request = self.requests[token.value] = ServiceRequest(self, token, subscribe = subscribe)
        return request

    def call(self, uri, params):
        return self._call(uri, params, subscribe = False)

    def subscribe(self, uri, params):
        return self._call(uri, params, subscribe = True)

    def cancel(self, token):
        err = LSError()
        lunaservice.LSCallCancel(self.handlePrv, token, err.ref)

        del self.requests[token]

        return True

class LSMethod(Structure):
    _fields_ = (
        ("name", c_char_p),
        ("function", LSMETHODFUNC),
        ("flags", c_uint)
    )

class LS2Message(object):
    def __init__(self, lsMessage):
        self.lsMessage = lsMessage
        self.payload = json.loads(lunaservice.LSMessageGetPayload(lsMessage))

    def reply(self, response):
        err = LSError()

        if not lunaservice.LSMessageRespond(self.lsMessage, json.dumps(response), err):
            raise LS2Exception(err)

class LS2Service(LS2Client):
    def __init__(self, serviceName):
        super(LS2Service, self).__init__(serviceName)

        self.categoriesPub = {}
        self.categoriesPrv = {}

    def _makeWrapper(self, callback):
        def wrapper(handle, lsMessage, ctx):
            message = LS2Message(lsMessage)

            try:
                callback(message)
            except Exception, e:
                message.reply({"returnValue": False, "errorCode": -1000, "errorText": "internal error: " + str(e)})
                raise

        return wrapper

    def registerCategory(self, category, methods):
        err = LSError()

        methodTable = (LSMethod * len(methods))()

        for i, (name, callback) in enumerate(methods):
            methodTable[i].name = name
            methodTable[i].function = LSMETHODFUNC(self._makeWrapper(callback))
            methodTable[i].flags = 0

        self.categoriesPub[name] = methodTable
        self.categoriesPrv[name] = methodTable

        if not lunaservice.LSRegisterCategory(self.handlePub, category, methodTable, None, None, err.ref):
            raise LS2Exception(err)

        if not lunaservice.LSRegisterCategory(self.handlePrv, category, methodTable, None, None, err.ref):
            raise LS2Exception(err)

class LS2ReactorThread(Thread):
    def __init__(self, mainloop):
        Thread.__init__(self)
        self.mainloop = mainloop
        self.timers = {}

    def run(self):
        glib.g_main_loop_run(self.mainloop)

    def quit(self):
        glib.g_main_loop_quit(self.mainloop)

    def add_timeout(self, callback, millis, repeat = False):
        class Timer(object):
            def __init__(self, reactor, callback, repeat):
                self.reactor = reactor
                self.callback = callback
                self.wrapped = GSOURCEFUNC(self.tick)

            def tick(self, ctx):
                try:
                    keep = callback()
                except Exception, e:
                    print "Uncaught exception", e
                    keep = False

                if keep and repeat:
                    return 1
                else:
                    timer.cancel()
                    return 0                

            def cancel(self):
                if self.id is not None:
                    self.reactor.timers[self.id] = None
                    glib.g_source_remove(self.id)
                    self.id = None

        timer = Timer(self, callback, repeat)

        timerId = glib.g_timeout_add(c_uint(millis), timer.wrapped, None)

        if timerId:
            self.timers[timerId] = timer
            timer.id = timerId

        return timer

reactor = LS2ReactorThread(mainloop)

def add_timeout(callback, millis, repeat = False):
    reactor.add_timeout(callback, millis, repeat)

def main():
    # currently not working ...
    def exit(sig, frame):
        print >>sys.stderr, "SIGINT"
        thread.quit()

    signal.signal(signal.SIGINT, exit)

    reactor.start()
