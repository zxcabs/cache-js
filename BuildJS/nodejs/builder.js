var fs = require('fs'),
    path = require('path');

var realpathCache = {};

function realpath(fname, callback) {
    if (realpathCache[fname]) {
        callback(null, realpathCache[fname]);
    } else {
        fs.realpath(fname, function(err, absFname) {
            if (err) {
                callback(err);
                return;
            }
            absFname = absFname.replace(/\\/g, '/');
            realpathCache[fname] = absFname;
            callback(null, absFname);
        });
    }
}

exports.build = function(fname, context, callback) {
    realpath(fname, function(err, absFname) {
        if (err) {
            callback(err);
            return;
        }

        loadAllFiles(absFname, function(err, files) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, files[absFname].generate(files, context, files[absFname].requireFn(['full'], files)));
        });
    })
};

function loadAllFiles(fname, callback) {
    var fnames = [fname], files = {};
    (function loadNextFile(i) {
        if (i < fnames.length) {
            loadFile(fnames[i], function(err, fileProps) {
                if (err) {
                    callback(err);
                    return;
                }

                files[fnames[i]] = fileProps;
                fileProps.requires.forEach(function(required) {
                    if (fnames.indexOf(required) == -1) {
                        fnames.push(required);
                    }
                });
                loadNextFile(i + 1);
            })
        } else {
            callback(null, files);
        }
    })(0);
}

function loadFile(fname, callback) {
    fs.readFile(fname, 'utf8', function(err, content) {
        if (err) {
            callback(err);
            return;
        }

        var requires = [];
        var requireFnBody = 'requireList = requireList || {};' +
                            'var appended = false;' +
                            'for (var i = 0; i < labels.length; i++) {' +
                                'if (!requireList["' + fname + '::" + labels[i]]) {' +
                                    'appended = true;' +
                                    'requireList["' + fname + '::" + labels[i]] = true;' +
                                '}' +
                            '}' +
                            'if (appended) {';

        var generateBody =  'generatedFiles = generatedFiles || {};' +
                            'var result = [];' +
                            'if (!generatedFiles["' + fname + '"]) {' +
                                'generatedFiles["' + fname + '"] = true;';

        content.split('\n').forEach(function(line) {
            if (line.match(/^\s*\/\/#label\s+([$a-zA-Z0-9_]+)\s*$/)) {
                requireFnBody += 'if (labels.indexOf("' + RegExp.$1 + '") != -1 || labels.indexOf("full") != -1) {';
                generateBody += 'if (requires["' + fname + '::full"] || requires["' + fname + '::' + RegExp.$1 + '"]) {'

            } else if (line.match(/^\s*\/\/#endlabel(?:\s+[$a-zA-Z0-9_]+)?\s*$/)) {
                requireFnBody += '}';
                generateBody += '}';

            } else if (line.match(/^\s*\/\/#if\s+(not\s+)?([a-zA-Z_$][a-zA-Z_$0-9]*)\s*$/)) {
                var operand = RegExp.$1 ? '!' : '';
                generateBody += 'if (' + operand + 'context.' + RegExp.$2 + ') {';

            } else if (line.match(/^\s*\/\/#endif\s*$/)) {
                generateBody += '}';

            } else if (line.match(/^\s*\/\/#(un)?set\s+([a-zA-Z_$][a-zA-Z_$0-9]*)\s*$/)) {
                generateBody += 'context.' + RegExp.$2 + ' = ' + (RegExp.$1 ? 'false' : 'true') + ';';

            } else if (line.match(/^\s*\/\/#include\s+([-_a-zA-Z0-9.:/$]+)\s*$/)) {
                var includeValues = RegExp.$1.split('::');
                var includeFname = includeValues.shift();
                if (includeFname && requires.indexOf(includeFname) == -1) {
                    requires.push(includeFname);
                }
                if (!includeValues.length) {
                    includeValues.push('full');
                }
                var fnamePlaceholder = includeFname ? '${' + includeFname + '}' : fname;
                requireFnBody += 'files["' + fnamePlaceholder + '"].requireFn([' + includeValues.map(function(label) {
                    return '"' + label + '"';
                }).join(',') + '], files, requireList);';
                generateBody += 'result.push(files["' + fnamePlaceholder + '"].generate(files, context, requires, generatedFiles));'

            } else {
                generateBody += 'result.push(' + JSON.stringify(line + '\n') + ');'
            }
        });
        requireFnBody += '}; return requireList;';
        generateBody += '}; return result.join("");';

        var i = 0;
        (function resolvePaths() {
            if (i < requires.length) {
                var relativePath = requires[i];
                realpath(path.join(path.dirname(fname), relativePath), function(err, absolutePath) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    requires[i] = absolutePath;
                    requireFnBody = requireFnBody.replace(new RegExp('\\$\\{' + relativePath + '\\}', 'g'), absolutePath);
                    generateBody = generateBody.replace(new RegExp('\\$\\{' + relativePath + '\\}', 'g'), absolutePath);
                    i++;
                    resolvePaths();
                })
            } else {
                callback(null, {
                    requires: requires,
                    requireFn: new Function('labels, files, requireList', requireFnBody),
                    generate: new Function('files, context, requires, generatedFiles', generateBody)
                });
            }
        })();
    })
}