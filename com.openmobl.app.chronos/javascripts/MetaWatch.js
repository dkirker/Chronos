/**
 * JavaScript implementation of the MetaWatch python library from
 * pyMW.
 *
 * https://github.com/travisgoodspeed/PyMetaWatch/blob/master/pymw.py
 *
 */

function MetaWatch()
{
    this.crc = new CRC(true);
    this.crc.test();
}

MetaWatch.kButtons =
{
    "A": 0,
    "B": 1,
    "C": 2,
    "D": 3,
    "reserved4": 4,
    "E": 5,
    "F": 6,
};

MetaWatch.kButtonType =
{
    "IMMEDIATE": 0,
    "PRESSANDRELEASE": 1,
    "HOLDANDRELEASE": 2,
    "LONGHOLDANDRELEASE": 3
};

MetaWatch.kStatusChange =
{
    "MODE": 0,
    "DISPLAYTIMEOUT": 1
};

MetaWatch.kMode = {
    "IDLE": 0,
    "APPLICATION": 1,
    "NOTIFICATION": 2,
    "SCROLL": 3
};

MetaWatch.prototype.prepareForTx = function(message)
{
    Mojo.Log.info("Message length = " + message.length);
    
    var datagram = String.fromCharCode(0x01) +
                   String.fromCharCode(message.length + 4) + message;
    
    var crc = this.crc.checksum(datagram);
    
    datagram = datagram + String.fromCharCode(crc & 0xFF) +
                          String.fromCharCode(crc >> 8);
    
    Mojo.Log.info("Preparing to send: message(", this.toHex(message),
                  "), datagram(" + this.toHex(datagram) + ")");
    
    return datagram;
};

MetaWatch.prototype.deviceType = function()
{
    var message = String.fromCharCode(0x01, 0x00);
    
    return this.prepareForTx(message);
};

MetaWatch.prototype.vibrate = function(on, off, count)
{
    var ms_on = on || 500;
    var ms_off = off || 500;
    var cycles = count || 1;
    
    ms_on = Math.min(ms_on, 65535);
    ms_off = Math.min(ms_off, 65535);
    cycles = Math.min(cycles, 256);

    var message = "" + String.fromCharCode(0x23, 0x00, 0x01) +
                  String.fromCharCode(ms_on & 0xFF) +
                  String.fromCharCode(ms_on >> 8) +
                  String.fromCharCode(ms_off & 0xFF) +
                  String.fromCharCode(ms_off >> 8) +
                  String.fromCharCode(cycles);
    
    return this.prepareForTx(message);
};

MetaWatch.prototype.setClock = function(date)
{
    var message = "" + String.fromCharCode(0x26, 0x00) +
                  String.fromCharCode(date.getFullYear() & 0xFF) + // MSB of Year
                  String.fromCharCode(date.getFullYear() >> 8) + // LSB of Year
                  String.fromCharCode(date.getMonth() + 1) + // Month 1-12
                  String.fromCharCode(date.getDate()) + // Day of Month 1-31
                  String.fromCharCode(date.getDay()) + // Day of Week 0-6
                  String.fromCharCode(date.getHours()) + // Hour 0-23
                  String.fromCharCode(date.getMinutes()) + // Minute 0-59
                  String.fromCharCode(date.getSeconds());  // Second 0-59

    return this.prepareForTx(message);
};

MetaWatch.prototype.writeBuffer = function(mode, writeCallback,
                                           row1, data1, row2, data2)
{
    if (writeCallback) {
        var option = mode;
        
        if (row2 !== undefined) {
            option = option | 0x10;
        }
        
        var packet = "" +
                     String.fromCharCode(0x40) +
                     String.fromCharCode(option) +
                     String.fromCharCode(row1) + 
                     data1 +
                     String.fromCharCode(0x00);
                     
        if (row2 !== undefined) {
            packet = packet +
                     String.fromCharCode(row2) +
                     data2;
        }
        
        var toSend = this.prepareForTx(packet);
        
        writeCallback(toSend);
    }
};

MetaWatch.prototype.updateDisplay = function(mode, activate)
{
    if (activate) {
        mode = mode | 0x10;
    }
    
    var message = "" +
                  String.fromCharCode(0x43) +
                  String.fromCharCode(mode);

    return this.prepareForTx(message);
};

MetaWatch.prototype.clearDisplay = function(mode, update, writeCallback)
{
    if (writeCallback) {
        writeCallback(this.loadTemplate(mode, 0));
        if (update) {
            writeCallback(this.updateDisplay(mode));
        }
    }
};

MetaWatch.prototype.loadTemplate = function(mode, filled)
{
    var message = "" +
                  String.fromCharCode(0x44) +
                  String.fromCharCode(mode) +
                  String.fromCharCode(filled);

    return this.prepareForTx(message);
};

MetaWatch.prototype.writeImage = function(image, xoff, yoff, width, height,
                                          mode, writeCallback)
{
    if (writeCallback) {
        this.clearDisplay(mode, true, writeCallback);
        
        var i = 0;
        
        for (var y = 0; y < height; y++) {
            var rowdata = "";
            
            for (var x = 0; x < width; x += 8) {
                var byte = 0;
                
                for (var pindex = 0; pindex < 8; pindex++) {
                    var pixel = image.charAt(i);
                    var pixelData = (pixel === "0") ? 0 : 1;
                    
                    byte = ((byte >> 1) | (pixelData << 7));
                    
                    i++; /* Just play dumb :) */
                }
                
                rowdata = rowdata + String.fromCharCode(byte);
            }
            
            Mojo.Log.info("Writing row: ", y);
            this.writeBuffer(mode, writeCallback, y + yoff, rowdata,
                             undefined, undefined);
        }
        
        writeCallback(this.updateDisplay(mode));
    }
};

MetaWatch.prototype.toHex = function(str)
{
    return this.crc._toHex(str);
};



