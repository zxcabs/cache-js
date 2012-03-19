/*
 * Cache-js
 *
 * The MIT License
 */
 
(function () {
	'use strict';
	
	var global = (function () { return this; }()),
		stringify = JSON.stringify,
		slice = Array.prototype.slice,
		_defCacheOpt = {
			expire: 1000 * 60 * 60 * 24 * 365, //one year expire
			max: 10                            //maximun chache count
		};
	
	function hash(str) {
		var l = str.length,
			hash = 0;
			
		while (l--) {
			hash += (hash << 5) + str.charCodeAt(l);
		}
	
		return Math.abs(hash).toString(32);
	}
	
	/*
	 * App Cache
	 */
	function AppCache(opt) {
		this.opt = opt;
		this.cache = [];
	}
	
	/*
	 * delete all expire keys or if key exist
	 * return true if one or more keys have been removed
	 */
	AppCache.prototype._delExpire = function (key) {
		var rm = false,
			cache = this.cache,
			l = cache.length,
			now = Date.now(),
			obj;
			
		while (l--) {
			obj = cache[l];
			
			if (now > obj.expire || key === obj.key) {
				cache.splice(l, 1);
				rm = true;
			}
		}
		
		return rm;
	};
	
	AppCache.prototype.get = function (key, fn) {
		var data,
			now = Date.now(),
			cache = this.cache,
			l = cache.length,
			obj;
		
		while (l--) {
			obj = cache[l];
			
			if (obj.key === key) {
				data = obj;
				break;
			}
		}
		
		if (data && now > data.expire) {
			cache.splice(l, 1);
			data = null;
		}
		
		fn(null, (data ? data.val : null));
	};
	
	AppCache.prototype.set = function (key, val, fn) {
		var cache = this.cache,
			max = this.opt.max,
			data = {
					key: key,
					expire: Date.now() + this.opt.expire,
					val: val
			},
			l = cache.length;
		
		if (l < max) {
			cache.push(data);
		} else if (l >= max && this._delExpire(key)) {
			cache.push(data);
		} else if (l >= this.opt.max) {
			cache.shift();
			cache.push(data);
		}
		
		fn(null);
	};
	
	//[opt,] func
	function cache() {
		var argv = slice.call(arguments),
			func = argv.pop(),
			opt = argv.pop();
	}
	
}());