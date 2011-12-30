(function() {
  /*
  #	Module:			STL.js
  #	
  #	Description:	decode STL 3D file
  #					modified Devon Govett's bmp.js
  #
  #	Reference:
  #		STL specs.	http://en.wikipedia.org/wiki/STL_%28file_format%29#Binary_STL
  # 	BMP.js		http://devongovett.github.com/bmp.js/
  #      
  # Author(s):		Devon Govett provide a bmp decoding example.
  # 				C.T. Yeung modify to decode STL.
  #  
  # History:		
  # 20Dec11			1st crack at it								cty
  # 23Dec11			loading vertexies OK
  # 				need to test normal when rendering shades
  #                 rotation is off when passed 180 degrees		cty
  #
  # MIT LICENSE
  # Copyright (c) 2011 CT Yeung
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
  var HDR_LEN = 80;
  var PI = 3.14159265;
	
	STL = (function() {
		STL.load = function(url, callback) {
			var xhr;
			xhr = new XMLHttpRequest;
			xhr.open("GET", url, true);
			xhr.responseType = "arraybuffer";
			xhr.onload = __bind(function() {
				var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
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
		};
		
		STL.prototype.parseExponent = function(byteArray) {
			var ex = (byteArray[0] & 0x7F);
			ex = ex << 1;
			
			if(0!=(byteArray[1] & 0x80))
				ex += 0x01;
			
			ex = Math.pow(2, ex-127);
			return ex;
		};
		
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
		};
		
		STL.prototype.drawWireFrame = function(context,		// [in] canvas context 
											   w, 			// [in] canvas width
											   h, 			// [in] canvas height
											   mag,			// [in] magnification
											   rX,
											   rY,
											   rZ) {
			
			this.pos = HDR_LEN;
			var numTriangles = this.readUInt32();
			
			for(var i=0; i<numTriangles; i++) {		  
				// retrieve normal
				var normal = [0,0,0];
				for(var j=0; j<3; j++) 
				  normal[j] = this.readReal32();
				
				this.drawTriangles(context, w, h, mag, rX, rY, rZ);
				
				//var attr = this.readUInt16();				// retrieve attribute
				this.pos += 2;								// skip attribute for now
			}
		};
		
		STL.prototype.drawTriangles = function(context,		// [in] canvas context 
											   w, 			// [in] canvas width
											   h, 			// [in] canvas height
											   mag,			// [in] magnification
											   rX,			// [in] amount of rotation X
											   rY,			// [in] amount of rotation Y
											   rZ){			// [in] amount of rotation Z
			
			var vtx = [0,0,0,0,0,0,0,0,0];
			var offX = w/2;
			var offY = h/2
			context.beginPath();
			
			// convert rotation from degrees to radian
			var radX = PI / 180.0 * rX;
			var radY = PI / 180.0 * rY;
			var radZ = PI / 180.0 * rZ;	
			
			for(j=0; j<3; j++) {  
			
				// convert byte array to (x,y,z) coordinates
				vtx[j*3]   = this.readReal32();
				vtx[j*3+1] = this.readReal32();
				vtx[j*3+2] = this.readReal32();
			
				this.rotate(vtx, mag, j, radX, radY, radZ);
						  
				// draw 2 lengths of a triangle
				if(j==0)
					context.moveTo(vtx[0]+ offX, 
								   vtx[1]+ offY);				// move to 1st triangle corner
				else 
					context.lineTo(vtx[j*3]+ offX, 
								   vtx[j*3+1]+ offY);			// render only (x,y)
			} 
			// complete triangle
			context.lineTo(vtx[0]+ offX, 
						   vtx[1]+ offY);						// complete triangle
			
			// render on canvase
			context.stroke();
			context.closePath();
		};
		
		STL.prototype.rotate = function (vtx,		// [in] vertexies (x,y,z)
										 mag,		// [in] magnification
										 index,		// [in] array index 
										 radX, 		// [in] rotation amount in radian
										 radY, 
										 radZ){
			// read STL coordinates 	
			var x = vtx[index*3];
			var y = vtx[index*3+1];
			var z = vtx[index*3+2];
			
			var dx, dy, dz;
			
			// rotate X
			dy = Math.cos(radX)*y-Math.sin(radX)*z;
			dz = Math.sin(radX)*y+Math.cos(radX)*z;
			
			// rotate Y
			z = dz;
			dx = Math.cos(radY)*x+Math.sin(radY)*z;
			dz = -Math.sin(radY)*x+Math.cos(radY)*z;
			
			// rotate Z
			y = dy;
			dx = Math.cos(radZ)*x-Math.sin(radZ)*y;
			dy = Math.sin(radZ)*x+Math.cos(radZ)*y;
				
			// assign values
			vtx[index*3] = dx * mag;
			vtx[index*3+1] = dy * mag;
			vtx[index*3+2] = dz * mag;
		};
		
		return STL;
	})();
	
	window.STL = STL;
}).call(this);
// JavaScript Document