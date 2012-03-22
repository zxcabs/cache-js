build:
	node ./BuildJS/nodejs/build.js ./lib/index.js > ./builds/cache.js
	uglifyjs -o ./builds/cache.min.js ./builds/cache.js
