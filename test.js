var parse  = require("./parse.js");
var input  = require("./data/input.json");
var output = require("./data/output.json");

function cmp(test, o1, o2) {
  var k1 = Object.keys(o1);
  var k2 = Object.keys(o2);

  if (k1.length !== k2.length) {
    console.log("my: ", o1);
    console.log("orig: ", o2);
    console.log("---");
  }

  test.equal(k1.length, k2.length);
  k1.forEach(function (k) { test.deepEqual(o1[k], o2[k]); });
}

exports.test = function (test) {
  var out = parse(input);

  cmp(test, out.meta, output.meta);
  test.deepEqual(out.resources, output.resources);  

  test.equal(out.symbols.length, output.symbols.length);
  out.symbols.forEach(function (o, i) {
    cmp(test, o, output.symbols[i]);
  });

  test.equal(out.functions.length, output.functions.length);
  out.functions.forEach(function (o, i) {
    cmp(test, o, output.functions[i]);
  });

  test.equal(out.allSamples.length, output.allSamples.length);
  out.allSamples.forEach(function (o, i) {
    test.deepEqual(o.frames, output.allSamples[i].frames);
    cmp(test, o.extraInfo, output.allSamples[i].extraInfo);
  });

  test.done();
};