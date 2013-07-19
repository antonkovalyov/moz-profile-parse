Utility to parse SPS profile data from Firefox
==============================================

[![Build Status](https://travis-ci.org/antonkovalyov/moz-profile-parse.png?branch=master)](https://travis-ci.org/antonkovalyov/moz-profile-parse)

A library to transform raw data received from Firefox SPS profiler into
something more structured. This library is similar to parserWorker.js
in the [Cleopatra](https://github.com/bgirard/cleopatra) source code.

For example input and output data see `data` directory. To run tests
use `npm test` (assuming you installed dependencies by running
`npm install`).