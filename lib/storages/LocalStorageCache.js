/*
 * LocalStorageCache
 */
 
function lGet(key) {
	return localStorage.getItem(key);
}

function lSet(key, val) {
	return localStorage.setItem(key, val);
}

function lRemove(key) {
	return localStorage.removeItem(key);
}


function LocalStorageCache(opt) {
	this.opt = opt;
}

LocalStorageCache.prototype._key = function (key) {
	return this.opt.cacheKey + ':' + (key || '');
};

LocalStorageCache.prototype._lock = function (fn) {
	var lockExpire = 1000 * 10, //10s
		key = this._key('lock');
	
	function get() {
		var now = Date.now(),
			isLocked = parseInt(lGet(key), 10) > now;
		
		if (!isLocked) {
			lSet(key, now + lockExpire);
			fn(null);
		} else {
			setTimeout(get, 0);
		}
	}
	
	get();
};

LocalStorageCache.prototype._unlock = function (fn) {
	lRemove(this._key('lock'));
	fn(null);
};

LocalStorageCache.prototype._getCache = function (fn) {
	var self = this,
		key = self._key('');
	
	function onLock(err) {
		var data;
		
		if (err) {
			fn(err);
		} else {
			data = parse(lGet(key));
			fn(null, data);
		}
	}
	
	self._lock(onLock);
};

LocalStorageCache.prototype._setCache = function (cache, fn) {
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

LocalStorageCache.prototype.get = function (key, fn) {
	var self = this;
	
	function end(err, data) {
		self._unlock(function () {
			fn(err, data);
		});
	}
	
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
			self._setCache(cache, end);
		} else {
			end(null, data ? data.val : null);
		}
	}
	
	function onGetCache(err, cache) {
		if (err || !cache) {
			end(err, null);
		} else {
			find(cache);
		}
	}
	
	self._getCache(onGetCache);
};

LocalStorageCache.prototype.set = function (key, val, fn) {
	var self = this;
	
	function set(cache) {
		var max = self.opt.max,
			l = cache.length,
			data,
			obj;
		
		if (l < max) {
			cache.push({
					key: key,
					expire: Date.now() + self.opt.expire,
					val: val
			});
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
			set(cache || []);
		}
	}
	
	self._getCache(onGetCache)
};

LocalStorageCache.prototype.clear = function (fn) {
	var self = this;
	
	function onLock(err) {
		lRemove(self._key());
		self._unlock(fn);
	}
	
	self._lock(onLock);
};