/*
 * Cache-js
 *
 * The MIT License
 */

'use strict';

(function () {
	var global = window,
		stringify = JSON.stringify,
		parse = JSON.parse,
		slice = Array.prototype.slice,
		toString = Object.prototype.toString,
		foo = function () {},
		getKeys = Object.keys,
		defCacheOpt = {
			cacheKey: '',
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
		return 'object' === typeof obj && '[object Object]' === toString.call(obj);
	}
	
	//#include storages/AppCache.js
	//#include storages/LocalStorageCache.js

	function createCache(opt) {
		var res, 
			storage = opt.storage;
		
		if (isObject(storage)) {
			res = storage;
		} else if (isString(storage)){
			
			switch (storage) {
				case 'local':
					res = new LocalStorageCache(opt);
				break;
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
		wrap.clearCache = function (fn) {
			cache.clear(fn || foo);
		};
		
		
		if (!func) {
			return null;
		} else {
			opt = mix(argv.pop(), defCacheOpt);
			opt.cacheKey = opt.cacheKey || hash(stringify(opt) + func.toString());
		}
		
		cache = createCache(opt);
		return wrap;
	}
	
	global.cache = cache;
}());