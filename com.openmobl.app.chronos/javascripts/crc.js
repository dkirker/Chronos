/**
 * JavaScript implementation of the CRC-CCITT python library from
 * pyMW.
 *
 * https://github.com/travisgoodspeed/PyMetaWatch/blob/master/pymw.py
 *
 */

function CRC(inverted)
{
    this.inverted = inverted;
    this.tab = new Array(256);
    
    if (this.inverted === undefined) {
        this.inverted = true;
    }
    
    for (var i = 0; i < 256; i++) {
        var crc = 0;
        var c = i << 8;
        
        for (var j = 0; j < 8; j++) {
            if ((crc ^ c) & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
            c = c << 1;
            crc = crc & 0xFFFF;
        }
        this.tab[i] = crc;
    }
}

CRC.prototype.update_crc = function(crc, c)
{
    c = 0x00FF & (c % 256)
    if (this.inverted) c = this.flip(c);
    
    tmp = ((crc >> 8) ^ c) & 0xFFFF;
    crc = (((crc << 8) ^ this.tab[tmp])) & 0xFFFF;
    
    return crc;
};

CRC.prototype.checksum = function(str)
{
    crcval = 0xFFFF;
    
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        crcval = this.update_crc(crcval, c);
    }
    return crcval;
};

CRC.prototype.flip = function(c)
{
    var l = new Array(0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15);
    return ((l[c & 0x0F]) << 4) + l[(c & 0xF0) >> 4];
};

CRC.prototype.test = function()
{
    var tests = [
        { test: "THIS IS A TEST", result: 0xA263 }, // flipped
        { test: "0123456789", result: 0x7D61 }, // flipped
    ];
    
    var i = 0;
    for (i = 0; i < tests.length; i++) {
        var check = this.checksum(tests[i].test);
        
        if (check === tests[i].result) {
            Mojo.Log.info("Test pass for ", tests[i].test);
        } else {
            Mojo.Log.info("Test fail for ", tests[i].test,
                          ". Bad CRC: ", check);
        }
    }
};

CRC.prototype._toHex = function(str)
{
    var hex = "";
    var chars = new Array('0','1','2','3','4','5','6','7','8','9',
                          'A','B','C','D','E','F');
    
    for (var i = 0; i < str.length; i++) {
        hex = hex + "0x" + chars[(str.charCodeAt(i) >> 4) & 0xf]
         + chars[str.charCodeAt(i) & 0xf] + " ";
    }
    
    return hex;
}
