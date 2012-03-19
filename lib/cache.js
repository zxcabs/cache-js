/*
 * Cache-js
 *
 * The MIT License
 */
 
(function () {
	'use strict';
	
	var global = window,
		stringify = JSON.stringify,
		slice = Array.prototype.slice,
		toString = Object.prototype.toString,
		getKeys = Object.keys,
		defCacheOpt = {
			storage: 'app',
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
	
	function mix(a, b) {
		var res = {},
			keys = getKeys(b),
			l = keys.length,
			key;
		
		while (l--) {
			key = keys[l];
			res[key] = (a && a[key]) ? a[key] : b[key];
		}
		
		return res;
	}
	
	function isString(str) {
		return 'string' === typeof str || ('object' === typeof str && '[object String]' === toString.call(str));
	}
	
	function isObject(obj) {
		return '[object Object]' === toString.call(obj);
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
	
	AppCache.prototype.clear = function () {
		this.cache = [];
	};
	
	function createCache(opt) {
		var res;
		
		if (isObject(opt.storage)) {
			res = opt.storage;
		} else if (isString(opt.storage)){
			
			switch (opt.storage) {
				case 'app':
				default:
					res = new AppCache(opt);
				break;
			}
		}
		
		return res;
	}
	
	//[opt,] func
	function cache() {		
		var argv = slice.call(arguments),
			func = argv.pop(),
			rqPool = {},
			opt,
			cache;
		
		//return true if new pool
		function addRqPool(key, cb) {
			var isNew = false,
				pool = rqPool[key];
				
			if (!pool) {
				pool = [];
				rqPool[key] = pool;
				isNew = true;
			}
			
			pool.push(cb);
			return isNew;
		}
		
		function applyRqPool(key, data) {
			var pool = rqPool[key],
				l;
			
			if (pool) {
				l = pool.length;
				
				while (l--) {
					pool[l].apply(null, data);
				}
			}
			
			rqPool[key] = null;
		}
		
		function wrap() {
			var argv = slice.call(arguments),
				cb = argv.pop(),
				key = hash(stringify(argv));
			
			function cacher() {
				var argv = slice.call(arguments);
				
				function onCacheSet(err) {
					applyRqPool(key, argv);
				}
				
				cache.set(key, argv, onCacheSet);
			}
			
			function onCacheGet(err, data) {
				if (err || !data) {
					func.apply(null, argv);
				} else {
					applyRqPool(key, data);
				}
			}
			
			if (addRqPool(key, cb)) {
				argv.push(cacher);
				cache.get(key, onCacheGet);
			}
		}
		
		wrap.__proto__ = func;
		wrap.clearCache = function () {
			cache.clear();
		};
		
		
		if (!func) {
			return null;
		} else {
			opt = mix(argv.pop(), defCacheOpt);
		}
		
		cache = createCache(opt);
		return wrap;
	}
	
	global.cache = cache;
}());