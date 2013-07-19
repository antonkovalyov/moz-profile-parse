/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var RE_CPP = [ // for symbols describing c++ functions
  /^(.*) \(in ([^\)]*)\) (\+ [0-9]+)$/,
  /^(.*) \(in ([^\)]*)\) (\(.*:.*\))$/,
  /^(.*) \(in ([^\)]*)\)$/
];

var RE_JS  = [ // for symbols describing js functions
  /^(.*) \((.*):([0-9]+)\)$/,
  /^()(.*):([0-9]+)$/
];

var RE_ADDON = [ // addon urls
  /^file:\/\/\/.*\/extensions\/(.*?)/,
  /^jar:file:\/\/\/.*\/extensions\/(.*?).xpi/
];

var resources = {};
var functions = { list: [], revl: {} };
var symbols   = { list: [], revl: {} };
var addons    = null;

/* Parses a URL and returns whatever information it can
 * extract. */
function parseAddonURL(url, host) {
  /* Get the first addon that matches either id or host */
  function get(id, host) {
    var addon = null;

    addons.some(function (add) {
      if (id && (add.toLowerCase() == id.toLowerCase()))
        return add;

      if (host && (add.chromeURIHosts && add.chromeURIHosts.indexOf(host) != -1))
        return add;

      return null;
    });

    return addon;
  }

  if (!addons)
    return null;

  if (/^resource:.*\-at\-jetpack$/.test(url)) // JetPack?
    return get(host.substring(0, host.length - 11) + "@jetpack");

  var match = null;
  RE_ADDON.some(function (re) { return match = re.exec(url) });

  if (match)
    return get(decodeURIComponent(match[1], null));

  match = /chrome\:\/\/(.*?)\//.exec(url);
  if (match)
    return get(null, match[1]);

  return null;
}

/* Parses a symbol and returns whatever function information
 * it can extract. */
function parseFunction(sym) {
  function clean(name) {
    return name.replace(/^non\-virtual\sthunk\sto\s/, "");
  }

  function cpp() {
    var match = null;
    
    if (!RE_CPP.some(function (re) { return match = re.exec(sym) }))
      return null;

    return {
      functionName:    clean(match[1]),
      libraryName:     addResource(match[2]),
      lineInformation: match[3] || "",
      isRoot:          false,
      isJSFrame:       false
    };
  }

  function js() {
    var match = null;

    if (!RE_JS.some(function (re) { return match = re.exec(sym) }))
      return null;

    // JavaScript file information sometimes comes with multiple
    // URIs separated with " -> ". We only want the last URI the list.

    var uri  = match[2] ? match[2].split(" -> ").pop() : match[2];    
    var name = match[1] || "<Anonymous>";
    var line = match[3];
    var file = /([^\/]*)$/.exec(uri);

    // Parse a resource name from URI.

    var resn = (function () {
      var match = /^(.*):\/\/(.*?)\//.exec(uri);

      if (!uri)
        return addResource("unknown", { type: "unknown", name: "<unknown>" });

      if (!match)
        return addResource("url_" + uri, { type: "url", name: uri });

      var root  = match[0];
      var proto = match[1];
      var host  = match[2];
      var addon = parseAddonURL(uri, host);

      if (addon) {
        return addResource("addon_" + addon.id, {
          type:    "addon",
          name:    addon.name,
          addonID: addon.id,
          icon:    addon.iconURL
        });
      }

      if (/^http/.test(proto)) {
        return addResource("webhost_" + host, {
          type: "webhost",
          name: host,
          icon: root + "favicon.ico"
        });
      }

      return addResource("otherhost_" + host, {
        type: "otherhost",
        name: host
      });
    })();

    return {
      functionName:    name + "() @ " + (file[1] || uri) + ":" + line,
      libraryName:     resn,
      lineInformation: "",
      isRoot:          false,
      isJSFrame:       true,
      scriptLocation:  { scriptURI: uri, lineInformation: line }
    };
  }

  function def() {
    return {
      functionName:    clean(sym),
      libraryName:     "",
      lineInformation: "",
      isRoot:          sym === "(root)",
      isJSFrame:       false
    };
  }

  var info = cpp() || js() || def();
  var name = info.functionName + "__" + info.libraryName;

  info.symbol = sym;
  info.functionIndex = addFunction(name, info);

  return info;
}

function addFunction(name, info) {
  if (name in functions.revl)
    return functions.revl[name];

  functions.list.push(JSON.parse(JSON.stringify(info)));
  return functions.revl[name] = functions.list.length - 1;
}

function addResource(name, desc) {
  resources[name] = resources[name] || desc;
  return name;
}

function addSymbol(sym) {
  sym = sym.location || sym;

  if (symbols.revl[sym] != null)
    return symbols.revl[sym];

  var info = parseFunction(sym);
  var obj = {
    symbolName: sym,
    functionName: info.functionName,
    functionIndex: info.functionIndex,
    lineInformation: info.lineInformation,
    isRoot: info.isRoot,
    isJSFrame: info.isJSFrame
  };

  if (info.scriptLocation)
    obj.scriptLocation = info.scriptLocation;

  symbols.list.push(obj);
  return symbols.revl[sym] = symbols.list.length - 1;
}

function parse(obj) {
  var samples = obj.threads ? obj.threads[0].samples : obj;
  var root = null;
  var meta = obj.meta || {};

  if (obj.meta) {
    addons = obj.meta.addons;
  }

  samples = samples.map(function (sample) {
    if (!sample)
      return null;

    var frames = sample.frames.map(addSymbol);
    sample.extraInfo = sample.extraInfo || {};

    [ "responsiveness", "marker", "time", "frameNumber" ].forEach(function (prop) {
      if (sample[prop] == null) return;
      sample.extraInfo[prop] = sample[prop];
    });

    return { frames: frames, extraInfo: sample.extraInfo };
  });

  return {
    meta:       meta,
    symbols:    symbols.list,
    functions:  functions.list,
    resources:  resources,
    allSamples: samples
  };
}

module.exports = parse;