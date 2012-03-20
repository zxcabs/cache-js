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
	
	function lGet(key) {
		return localStorage.getItem(key);
	}
	
	function lSet(key, val) {
		return localStorage.setItem(key, val);
	}
	
	function lRemove(key) {
		return localStorage.removeItem(key);
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
		} else if (l >= max) {
			cache.shift();
			cache.push(data);
		}
		
		fn(null);
	};
	
	AppCache.prototype.clear = function (fn) {
		this.cache = [];
		fn(null);
	};
	
	
	/*
	 * localStorageCache
	 */
	function StorageCache(opt) {
		this.opt = opt;
	}
	
	StorageCache.prototype._key = function (key) {
		return this.opt.cacheKey + ':' + key;
	};
	
	StorageCache.prototype._lock = function (fn) {
		var lockExpire = Date.now() + 1000 * 2,
			key = this._key('lock');
		
		function get() {
			var isLocked = !!lGet(key);
			
			if (!isLocked) {
				lSet(key, 1);
				fn(null);
			} else if (lockExpire < Date.now()) {
				setTimeout(get, 0);
			} else {
				fn('Time out');
			}
		}
		
		get();
	};
	
	StorageCache.prototype._unlock = function (fn) {
		lRemove(this._key('lock'));
		fn(null);
	};

	StorageCache.prototype._getCache = function (fn) {
		var self = this,
			count = 5,
			key = self._key('');
		
		function onLock(err) {
			var data;
			
			count -= 1;
			
			if (err && count) {
				setTimeout(lock, 50);
			} else {
				data = parse(lGet(key));
				fn(null, data);
			}
		}
		
		function lock() {
			self._lock(onLock);
		}
		
		lock();
	};
	
	StorageCache.prototype._setCache = function (cache, fn) {
		var key = this._key(''),
			err;
		
		try {
			lSet(key, stringify(cache));
		} catch (e) {
			err = e;
		} finally {
			this._unlock(fn);
		}
	};
	
	StorageCache.prototype.get = function (key, fn) {
		var self = this;
		
		function find(cache) {
			var obj,
				data,
				l = cache.length;
			
			while (l--) {
				obj = cache[l];
				
				if (obj && obj.key === key) {
					data = obj;
					break;
				}
			}
			
			if (data && Date.now() > data.expire) {
				cache.splice(l, 1);
				data = null;
				self._setCache(cache, fn);
			} else {
				fn(null, data ? data.val : null);
			}
		}
		
		function onGetCache(err, cache) {
			var obj, l;
			
			if (err || !cache) {
				fn(err, null);
			} else {
				find(cache);
			}
		}
		
		self._getCache(onGetCache);
	};
	
	StorageCache.prototype.set = function (key, val, fn) {
		var self = this;
		
		function set(cache) {
			var max = self.opt.max,
				l = cache.length,
				data,
				obj;
			
			if (l < max) {
				cache.push(data);
			} else if (l >= max) {
				while (l--) {
					obj = cache[l];
					
					if (obj && obj.key === key) {
						data = obj;
						break;
					}
				}
				
				if (data) {
					data.expire = Date.now() + self.opt.expire;
					data.val = val;
				} else {
					cache.shift();
					cache.push({
						key: key,
						expire: Date.now() + self.opt.expire,
						val: val
					});					
				}
			}
			
			self._setCache(cache, fn);
		}
	
		function onGetCache(err, cache) {

			if (err) {
				fn(err);
			} else {
				set(cache = cache || []);
			}
		}
		
		self._getCache(onGetCache)
	};
	
	StorageCache.prototype.clear = function (fn) {
		function onGetCache(err, cache) {
			if (err || !cahce) {
				fn(err);
			} else {
				this._setCache(null, fn);
			}
		}
		
		this._getCache(onGetCache);
	};
	
	function createCache(opt) {
		var res, 
			storage = opt.storage;
		
		if (isObject(storage)) {
			res = storage;
		} else if (isString(storage)){
			
			switch (storage) {
				case 'local':
					res = new StorageCache(opt);
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