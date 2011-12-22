(function() {
  /*
  # Reference:
  #		STL specs.	http://en.wikipedia.org/wiki/STL_%28file_format%29#Binary_STL
  #
  # MIT LICENSE
  # Copyright (c) 2011 Devon Govett
  # 
  # Permission is hereby granted, free of charge, to any person obtaining a copy of this 
  # software and associated documentation files (the "Software"), to deal in the Software 
  # without restriction, including without limitation the rights to use, copy, modify, merge, 
  # publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons 
  # to whom the Software is furnished to do so, subject to the following conditions:
  # 
  # The above copyright notice and this permission notice shall be included in all copies or 
  # substantial portions of the Software.
  # 
  # THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING 
  # BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
  # NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
  # DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
  # OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
  */  
  
  var STL;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  
  STL = (function() {
    STL.load = function(url, callback) {
      var xhr;
      xhr = new XMLHttpRequest;
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = __bind(function() {
        var data;
        data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
        return callback(new STL(data));
      }, this);
      return xhr.send(null);
    };
	
    function STL(data) {
	  var HDR_LEN = 80;
	  var hdr;
      this.data = data;
	  
	  if(this.data.length<(HDR_LEN+4))
	  	throw 'STL file too small';
    }
	
    STL.prototype.readUInt16 = function() {
      var b1, b2;
      b1 = this.data[this.pos++];
      b2 = this.data[this.pos++] << 8;
      return b1 | b2;
    };
	
    STL.prototype.readUInt32 = function() {
      var b1, b2, b3, b4;
      b1 = this.data[this.pos++];
      b2 = this.data[this.pos++] << 8;
      b3 = this.data[this.pos++] << 16;
      b4 = this.data[this.pos++] << 24;
      var num = b1 | b2 | b3 | b4;
	  return num;
    };
	
	STL.prototype.readReal32 = function() {
		if(this.data.length<=this.pos+4)		// over run !!! error condition
			return 0;
			
		var byteArray = [0,0,0,0];
		byteArray[3] = this.data[this.pos++];
		byteArray[2] = this.data[this.pos++];
		byteArray[1] = this.data[this.pos++];
		byteArray[0] = this.data[this.pos++];
		
		var sign = this.parseSign(byteArray);
		var exponent = this.parseExponent(byteArray);
		var mantissa = this.parseSignificand(byteArray);
		var num = sign * exponent * mantissa;
		return num;
    };
	
	STL.prototype.parseSign = function(byteArray) {
		if(byteArray[0]&0x80)
			return -1;
		return 1;
	}
	
	STL.prototype.parseExponent = function(byteArray) {
		var ex = (byteArray[0] & 0x7F);
		ex = ex << 1;
		
		if(0!=(byteArray[1] & 0x80))
			ex += 0x01;
		
		ex = Math.pow(2, ex-127);
		return ex;
	}
	
	STL.prototype.parseSignificand = function(byteArray) {
		var num=0;
		var bit;
		var mask = 0x40;
		for(var i=1; i<8; i++) {
			if(0!=(byteArray[1]&mask)) 
				num += 1 / Math.pow(2, i);
			mask = mask >> 1;
		}
		mask = 0x80;
		for(var j=0; j<8; j++) {
			if(0!=(byteArray[2]&mask))
				num += 1 / Math.pow(2, j+8);
			mask = mask >> 1;
		}
		mask = 0x80;
		for(var k=0; k<8; k++) {
			if(0!=(byteArray[2]&mask))
				num += 1 / Math.pow(2, k+16);
			mask = mask >> 1;
		}
		return (num+1);
	}
	
    STL.prototype.drawWireFrame = function(context, w, h) {
	  var HDR_LEN = 80;
      this.pos = HDR_LEN;
	  var numTriangles = this.readUInt32();
	  
	  context.strokeStyle = 'black';
	  var num = (2000<numTriangles)? 2000:numTriangles;
	  for(var i=0; i<num; i++) {
		  var j;
		  
		  var normal = [0,0,0];
		  for(j=0; j<3; j++) 
			  normal[j] = this.readReal32();
		  
		  var vtx = [0,0,0,0,0,0,0,0,0];
		  for(j=0; j<3; j++) {
			  for(var k=0; k<3; k++) {
			  	var n = this.readReal32();
				vtx[j*3+k] = n * 30.0 + 200.0;
			  }
			  
			  if(j==0)
			  	context.moveTo(vtx[0], vtx[1]);			// move to 1st triangle corner
			  else {
			  	context.lineTo(vtx[j*3], vtx[j*3+1]);	// render only (x,y)
				context.stroke();
			  }
		  } 
		  context.lineTo(vtx[0], vtx[1]);				// complete triangle
		  
		  // skip attribute for now
		  //var attr = this.readUInt16();
		  this.pos += 2;
	  }
    };
    return STL;
  })();
  
  window.STL = STL;
}).call(this);
// JavaScript Document