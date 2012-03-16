/*
 * Cache-js
 *
 * The MIT License
 */
 
(function () {
	'use strict';
	
	var global = (function () { return this; }()),
		stringify = JSON.stringify,
		slice = Array.prototype.slice;
	
	function hash(str) {
		var l = str.length,
			hash = 0;
			
		while (l--) {
			hash += (hash << 5) + str.charCodeAt(l);
		}
	
		return Math.abs(hash).toString(32);
	}
	
	
}());