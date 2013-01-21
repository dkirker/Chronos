/*
    The contents of this file are subject to the Mozilla Public License
    Version 1.1 (the "License"); you may not use this file except in
    compliance with the License. You may obtain a copy of the License at
    http://www.mozilla.org/MPL/

    Software distributed under the License is distributed on an "AS IS"
    basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
    License for the specific language governing rights and limitations
    under the License.

    The Original Code is OpenMobl Systems code.

    The Initial Developer of the Original Code is OpenMobl Systems.
    Portions created by OpenMobl Systems are Copyright (C) 2010-2011
    OpenMobl Systems. All Rights Reserved.

    Contributor(s):
        OpenMobl Systems
        Donald C. Kirker <donald.kirker@openmobl.com>
        Palm, Inc.

    Alternatively, the contents of this file may be used under the terms
    of the GNU General Public License Version 2 license (the  "GPL"), in
    which case the provisions of GPL License are applicable instead of
    those above. If you wish to allow use of your version of this file only
    under the terms of the GPL License and not to allow others to use
    your version of this file under the MPL, indicate your decision by
    deleting the provisions above and replace them with the notice and
    other provisions required by the GPL License. If you do not delete
    the provisions above, a recipient may use your version of this file
    under either the MPL or the GPL License.
 */

function MainAssistant()
{
    this.watch = new MetaWatch();

    this.serialPortPollRate = 10;
    this.serialPortBufferSize = 32;
    
    this.deviceID = "MetaWatch";
    
    this.title = "";
    this.message = "";
    
    this.watchServiceName = $L("Watch Service");
}

MainAssistant.prototype.aboutToActivate = function(callback)
{
    callback.defer(); //makes the setup behave like it should.
};

MainAssistant.prototype.activate = function()
{
    Chronos.closeAltStage();
    this.updateMessage(this.watchServiceName, $L("Starting..."));
};

MainAssistant.prototype.setup = function()
{
    this.sppNotificationService = this.controller.serviceRequest("palm://com.palm.bluetooth/spp", {
                                        method: "subscribenotifications",
                                        parameters: { "subscribe": true },
                                        onSuccess: this.sppNotify.bind(this),
                                        onFailure: function(failData){
                                            Mojo.Log.info("notifnserverenabled, errCode: ", failData.errorCode);
                                            this.updateMessage(this.watchServiceName, $L("Failed: ") + failData.errorCode + " " + failData.errorText);
                                        }                                                            
                                    });
    //get a list of paired GPS devices and filter using the getDevicesSuccess function
    /*this.getBTDevices = this.controller.serviceRequest("palm://com.palm.bluetooth/gap", {
                                    method: "gettrusteddevices",
                                    parameters: {},
                                    onSuccess: this.getDevicesSuccess.bind(this),
                                    onFailure: function(failData){
                                        Mojo.Log.error("gettrusteddevices, errCode: ", failData.errorCode);
                                    }                                                            
                                });*/
    this.controller.get("icon-action").addEventListener(Mojo.Event.tap, this.onIconTap.bindAsEventListener(this));
    this.controller.get("text-action").addEventListener(Mojo.Event.tap, this.onMessageTap.bindAsEventListener(this));
    this.controller.get("title").innerHTML = this.title;
    this.controller.get("message").innerHTML = this.message;
};

  // run callback and close this
MainAssistant.prototype.onIconTap = function()
{
    if (this.iconCallback) {
        this.iconCallback();
    } /*else {
        Mojo.Controller.getAppController().closeStage(this.windowName);
    }*/
};
  
MainAssistant.prototype.onMessageTap = function()
{
	if (this.messageCallback) {
		this.messageCallback();
	}/* else {
		Mojo.Controller.getAppController().closeStage(this.windowName);
	}*/
};
  
MainAssistant.prototype.updateMessage = function(header, body)
{
	this.title = header;
	this.controller.get("title").innerHTML = this.title;
	this.message = body;
	this.controller.get("message").innerHTML = this.message;
	this.controller.stageController.indicateNewContent(true);
};

MainAssistant.prototype.cleanup = function(event)
{
    this.updateMessage(this.watchServiceName, $L("Stopping..."));
    this.disconnectSPP();  //make sure to disconnect from the SPP SERVICE!
};

MainAssistant.prototype.handleCommand = function(event)
{        

};

MainAssistant.prototype.getDevicesSuccess = function(objData)
{
    Mojo.Log.info("gettrusteddevices:", objData.returnValue);
    this.targetAddress = "";
    var targetDevice = this.deviceID;
    
    if(objData.returnValue) {
		if(objData.trusteddevices) {
            for (i = 0; i < objData.trusteddevices.length; i++) {
                if(objData.trusteddevices[i].name.search(targetDevice) > -1) {
                    Mojo.Log.info("found: ", objData.trusteddevices[i].address);
                    this.targetAddress = objData.trusteddevices[i].address;
                    this.targetName = objData.trusteddevices[i].name;
                }
            }

            /*this.sppNotificationService = this.controller.serviceRequest("palm://com.palm.bluetooth/spp", {
                                        method: "subscribenotifications",
                                        parameters: { "subscribe": true },
                                        onSuccess: this.sppNotify.bind(this),
                                        onFailure: function(failData){
                                            Mojo.Log.info("notifnserverenabled, errCode: ", failData.errorCode);
                                        }                                                            
                                    });*/

            if(this.targetAddress !== "") {
                this.connectBTDevice = this.controller.serviceRequest('palm://com.palm.bluetooth/spp', {
                                                method: "connect",
                                                parameters: { "address" : this.targetAddress },
                                                });                                                           
            }
        }
    } else {
        Mojo.Log.info("gettrusteddevice call returned no trusted devices!");
    }
 
};

MainAssistant.prototype.sppNotify = function(objData)
{
    var that = this; //used to scope this here.

    Mojo.Log.info("SPP notification: ", JSON.stringify(objData));
    this.instanceId = objData.instanceId;

    if (!objData.notification) {
		Mojo.Log.info("SPP startup server: %j", objData);
		if (objData.returnValue  &&  objData.subscribed) {
			this.controller.serviceRequest('palm://com.palm.bluetooth/spp', {
                                    method: "enableserver",
                                    parameters: { "servicename": "SPP slave" },
                                    onSuccess: function(e) {
                                        Mojo.Log.info("Server enabled");
                                        
                                        //get a list of paired GPS devices and filter using the getDevicesSuccess function
                                        /*this.getBTDevices = this.controller.serviceRequest("palm://com.palm.bluetooth/gap", {
                                                                        method: "gettrusteddevices",
                                                                        parameters: {},
                                                                        onSuccess: this.getDevicesSuccess.bind(this),
                                                                        onFailure: function(failData){
                                                                            Mojo.Log.error("gettrusteddevices, errCode: ", failData.errorCode);
                                                                        }                                                            
                                                                    });*/
                                    }.bind(this),
                                    onFailure: function(e) {
                                        Mojo.Log.error("Unable to Open SPP Port, errCode: ", e.errorCode, " ", e.errorText);
                                        this.updateMessage(this.watchServiceName, $L("Failed: ") + e.errorCode + " " + e.errorText);
                                    }
                                });
		}
		return;
	}

    for(var key in objData) {
        if (key === "notification") {
            switch(objData.notification){
                case "notifnservicenames":
                    Mojo.Log.info("SPP service name: ", objData.services[0]);
                    this.serviceName = objData.services[0];
                    /* Send select service response */
                    this.controller.serviceRequest('palm://com.palm.bluetooth/spp', {
                                    method: "selectservice",
                                    parameters: { "instanceId": objData.instanceId, "servicename": objData.services[0] },
                                });
                    return;                                                           
                    break;

                case "notifnconnected":
                    Mojo.Log.info("SPP Connected");  
                    //for some reason two different keys are used for instanceId are passed
                    if(objData.error === 0){
                        this.updateMessage(this.watchServiceName, $L("Connected: ") + this.targetName);
                        this.controller.serviceRequest('palm://com.palm.service.bluetooth.spp', {
                                    method: "open",
                                    parameters: { "instanceId": objData.instanceId },
                                    onSuccess: this.openReadReady.bind(this),
                                    onFailure: function(failData) {
                                        Mojo.Log.error("Unable to Open SPP Port, errCode: ", failData.errorCode, " ", failData.errorText);
                                        this.updateMessage(this.watchServiceName, $L("Failed: ") + failData.errorCode + " " + failData.errorText);
                                }                                                            
                            });
                        }
                    return;    
                    break;

                case "notifndisconnected":
                    Mojo.Log.info("Device has terminated the connection or is out of range...");
                    this.updateMessage(this.watchServiceName, $L("Disconnected..."));
                    break;
                    
                case "notifnserverenabled":
                    this.getBTDevices = this.controller.serviceRequest("palm://com.palm.bluetooth/gap", {
                                                                        method: "gettrusteddevices",
                                                                        parameters: {},
                                                                        onSuccess: this.getDevicesSuccess.bind(this),
                                                                        onFailure: function(failData){
                                                                            Mojo.Log.error("gettrusteddevices, errCode: ", failData.errorCode);
                                                                            this.updateMessage(this.watchServiceName, $L("Failed: ") + failData.errorCode + " " + failData.errorText);
                                                                        }                                                            
                                                                    });
                    break;

                default:
                    break;
            }
        } 
    }
};

MainAssistant.prototype.convertHexToBinary = function(hexString)
{
    var binary = "";
    var bin = ['0000', '0001', '0010', '0011', '0100', '0101', '0110', '0111', '1000', '1001', '1010', '1011', '1100', '1101', '1110', '1111'];
    
    var i = 0;
    for (i = 0; i < hexString.length; i += 2) {
        var h = hexString.charAt(i);
        var l = hexString.charAt(i + 1);
        
        //byteArray = byteArray + String.fromCharCode(parseInt(hex, 16)); //.push(parseInt(hex, 16));
        var hhex = "ABCDEF";
        var lown = parseInt(l, 16);//l < 10 ? parseInt(l, 10) : (10 + hhex.indexOf(l));
        var highn = parseInt(h, 16);//h < 10 ? parseInt(h, 10) : (10 + hhex.indexOf(h));
        
        binary = binary + bin[highn] + bin[lown];
    }
    
    return binary;
};

MainAssistant.prototype.openReadReady = function(objData)
{
    Mojo.Log.info("openSuccess: ", JSON.stringify(objData));
    
    var success = function(data) {
        Mojo.Log.info("Write success!", JSON.stringify(data));
        this.readPort(this.readPortSuccess.bind(this));
    };
    
    //this.writePort(this.watch.deviceType(), success.bind(this));
    this.writePort(this.watch.vibrate(100,500,4), success.bind(this));
    this.writePort(this.watch.setClock(new Date()), success.bind(this));
    
    var writeCallback = function(data) {
        Mojo.Log.info("Writing for image");
        this.writePort(data, function(){ Mojo.Log.info("Wrote image data"); });
    };
    
    var image = "00000003C0000000000000001FF000000000000000393E000000000000007FFF00000000000000FFFF00000000000001FFFF80000000000001FFFFC0000000000001FFFFC0000000000001FFFFC0000000000001FFFFC0000000000001DF0FE00000000000018F27E00000000000016777E0000000000001FF77E0000000000001FFF7E0000000000001E07FE0000000000001C00FE0000000000001800FE0000000000001000FE0000000000001803FF0000000000001E07FF0000000000001B1C3F80000000000018F83F80000000000038201FC0000000000030001FC0000000000070000FE00000000000E0000FF00000000001E0000FF00000000003C00007F80000000003C00007FC0000000007800007FC0000000007800003FE000000000F800003FF000000000F000001FF000000001F000001FF800000001E000001FF800000001E000000FF800000003E000000FFC00000003C000000FFC00000007C000000FFE00000007C000000FFE0000000FC000000FFE0000000FC000000FFE0000000FC000000FFE0000000FC000001FFC0000000C6000007FFC000000183800004FFE000000301C00004FE6000001E01E000047E6000003800F00004386000002000F800040030000020007C00040018000020003C000C000C000020003C001C00020000200018001C0002000020000800F80006000060000C03F8000E0000600007FFF8001C0000600003FFF800780000300003FFF801C000003F8007FFF8038000000FE00FFFF80600000000F81F001C0C000000001F380004180000000001F00003F000000000000000000000000";
    var binaryImage = this.convertHexToBinary(image);
    
    this.watch.writeImage(binaryImage, 0, 30, 66, 66, MetaWatch.kMode.IDLE, writeCallback.bind(this));
    
    //use "setTimeout" here because the SPP input buffer might not be full yet
    var success = function(data) {
        this.readPortSuccess(data);
    }.bind(this);
    
    this.handleTimeout = this.controller.window.setTimeout(this.readPort.bind(this, success), this.serialPortPollRate);
};

MainAssistant.prototype.readPort = function(success)
{
    Mojo.Log.info("SPP Read Port");
    this.controller.serviceRequest('palm://com.palm.service.bluetooth.spp', {
            method: "read",
            parameters: {"instanceId": this.instanceId, "dataLength": this.serialPortBufferSize, "encoding": "binary" },
            onSuccess: success,
            onFailure: function(failData) {
                    Mojo.Log.error("Unable to Read SPP Port, errCode: ", failData.errorCode, " ", failData.errorText);
                }                                                            
        });
};

MainAssistant.prototype.writePort = function(data, success)
{
    Mojo.Log.info("SPP Write Port: ", data.length, " bytes");
    
    this.controller.serviceRequest('palm://com.palm.service.bluetooth.spp', {
            method: "write",
            parameters: {"instanceId": this.instanceId, "data": data, "dataLength": data.length, "encoding": "binary" },
            onSuccess: success,
            onFailure: function(failData) {
                    Mojo.Log.error("Unable to write SPP Port, errCode: ", failData.errorCode, " ", failData.errorText);
                }                                                            
        });
};

MainAssistant.prototype.readPortSuccess = function(objData)
{
    Mojo.Log.info("Read Success: ", objData.returnValue, " Data Length: ", objData.dataLength);

    if (objData.returnValue === true) {
        if (typeof objData.data !== "undefined") {
            // Read data
            Mojo.Log.info("objData.data=(", this.watch.toHex(objData.data), ")");
        } else {
            Mojo.Log.error("Error: Data undefined.")
        }        
    } else {
        Mojo.Log.error("Unable to read from SPP Port. Unknown error.");
    }

    //recursive call to SPP read
    //this.openReadReady({"returnValue": true}); 
};

MainAssistant.prototype.disconnectSPP = function()
{
    var that = this;
    
    //stop our timout
    this.controller.window.clearTimeout(this.handleTimeout);
 
    //close serial and spp connection
    if (this.targetAddress !== "" && this.instanceId !== undefined) {
        //close comm port
        this.controller.serviceRequest('palm://com.palm.service.bluetooth.spp', {
                    method: "close",
                    parameters: {"instanceId": this.instanceId},
                    onSuccess: function(objData){return;},
                    onFailure: function(failData) {
                        Mojo.Log.error("Unable to Close SPP Port, errCode: ", failData.errorCode, "<br/>", failData.errorText);
                }
            });
        
        //disconnect from SPP
        this.connectBTDevice = this.controller.serviceRequest('palm://com.palm.bluetooth/spp', {
            method: "disconnect",
            parameters: {
                "address": this.targetAddress,
                "instanceId": this.instanceId
            },
            onSuccess: function(objData){
                Mojo.Log.info("Disconnected from SPP");
                return;
            },
            onFailure: function(failData){
                Mojo.Log.info("Disconnect, errCode: ", failData.errorCode);
            }
        });
    } 
};

MainAssistant.prototype.buzzWatch = function()
{
    Mojo.Log.info("buzzWatch: ");
    
    this.writePort(this.watch.vibrate(200,100,3), success.bind(this));
    
    //use "setTimeout" here because the SPP input buffer might not be full yet
    var success = function(data) {
        this.readPortSuccess(data);
    }.bind(this);
    
    this.handleTimeout = this.controller.window.setTimeout(this.readPort.bind(this, success), this.serialPortPollRate);
};

MainAssistant.prototype.displayNotification = function(text)
{
    Mojo.Log.info("displayNotification: ", text);
    
    var success = function(data) {
        Mojo.Log.info("Write success!", JSON.stringify(data));
        this.readPort(this.readPortSuccess.bind(this));
    };
    
    var writeCallback = function(data) {
        Mojo.Log.info("Writing for image");
        this.writePort(data, function(){ Mojo.Log.info("Wrote image data"); });
    };
    
    //var image = this.watch.renderText(template, text);
    var image = "00000003C0000000000000001FF000000000000000393E000000000000007FFF00000000000000FFFF00000000000001FFFF80000000000001FFFFC0000000000001FFFFC0000000000001FFFFC0000000000001FFFFC0000000000001DF0FE00000000000018F27E00000000000016777E0000000000001FF77E0000000000001FFF7E0000000000001E07FE0000000000001C00FE0000000000001800FE0000000000001000FE0000000000001803FF0000000000001E07FF0000000000001B1C3F80000000000018F83F80000000000038201FC0000000000030001FC0000000000070000FE00000000000E0000FF00000000001E0000FF00000000003C00007F80000000003C00007FC0000000007800007FC0000000007800003FE000000000F800003FF000000000F000001FF000000001F000001FF800000001E000001FF800000001E000000FF800000003E000000FFC00000003C000000FFC00000007C000000FFE00000007C000000FFE0000000FC000000FFE0000000FC000000FFE0000000FC000000FFE0000000FC000001FFC0000000C6000007FFC000000183800004FFE000000301C00004FE6000001E01E000047E6000003800F00004386000002000F800040030000020007C00040018000020003C000C000C000020003C001C00020000200018001C0002000020000800F80006000060000C03F8000E0000600007FFF8001C0000600003FFF800780000300003FFF801C000003F8007FFF8038000000FE00FFFF80600000000F81F001C0C000000001F380004180000000001F00003F000000000000000000000000";
    var binaryImage = this.convertHexToBinary(image);
    
    this.watch.writeImage(binaryImage, 0, 30, 66, 66, MetaWatch.kMode.NOTIFICATION, writeCallback.bind(this));
    
    //use "setTimeout" here because the SPP input buffer might not be full yet
    var success = function(data) {
        this.readPortSuccess(data);
    }.bind(this);
    
    this.handleTimeout = this.controller.window.setTimeout(this.readPort.bind(this, success), this.serialPortPollRate);
}

MainAssistant.prototype.handleWatchCommand = function(params)
{
    switch (params.command) {
        case "notification":
            // params.data.text
            this.buzzWatch();
            if (params.data && params.data.text)
                this.displayNotification(params.data.text);
            break;
    }
};
