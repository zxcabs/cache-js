build:
	node ./build/nodejs/build.js index.js > ./builds/cache.js
	uglifyjs -o ./builds/cache.min.js ./builds/cache.js
