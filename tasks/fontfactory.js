/*
 * grunt-fontfactory
 * https://github.com/cameronhunter/grunt-fontfactory
 *
 * Copyright (c) 2013 Cameron Hunter
 * Licensed under the MIT license.
 */

"use strict";

// http://en.wikipedia.org/wiki/Private_Use_(Unicode)
var UNICODE_PRIVATE_USE_AREA = {
  start: 0xE001,
  end: 0xF8FF
};

var DOMParser = require("xmldom").DOMParser;
var Hogan = require("hogan.js");
var Path = require("path");
var StringUtils = require("strutil");
var Package = require("../package.json");
var Fs = require("fs");
var FontConversion = {
  svg2ttf: require("svg2ttf"),
  ttf2eot: require("ttf2eot"),
  ttf2woff: require("ttf2woff")
};

// TODO: Check that number of glyphs isn't larger than the unicode private use area
// TODO: Provide some stability between builds when choosing the unicode codepoints
// TODO: Ensure all the glyphs are the same height
// TODO: CamelCase glyph names

module.exports = function(grunt) {

  var dom = new DOMParser();
  var font = template("font.svg");

  grunt.registerMultiTask("fontfactory", Package.description, function() {
    this.requiresConfig([this.name, this.target, "src"].join("."));
    this.requiresConfig([this.name, this.target, "dest"].join("."));

    var options = this.options({
      font: "my-font"
    });

    var done = this.async();

    this.files.forEach(function(files) {
      var fontDestination = Path.join(files.dest, options.font);

      var glyphs = readGlyphs(files);

      var svg = createSVG(fontDestination + ".svg", options.font, glyphs);
      var ttf = createTTF(fontDestination + ".ttf", svg);
      createEOT(fontDestination + ".eot", ttf);
      createWOFF(fontDestination + ".woff", ttf, done);

      createCSS(fontDestination + ".css", options.font, "suit", glyphs);
      createHTML(fontDestination + ".html", options.font, "suit", glyphs);
    });
  });

  function createHTML(filename, font, syntax, glyphs) {
    var HTML = template(syntax + ".html");

    var contents = HTML.render({
      font: font,
      glyphs: glyphs
    });

    grunt.file.write(filename, contents);
    grunt.log.ok("Created: " + filename);
  }

  function createCSS(filename, font, syntax, glyphs) {
    var CSS = template(syntax + ".css");

    var contents = CSS.render({
      font: font,
      glyphs: glyphs
    });

    grunt.file.write(filename, contents);
    grunt.log.ok("Created: " + filename);
  }

  function readGlyphs(files) {
    return files.src.map(function(file, index) {
      var svg = parseSVG(grunt.file.read(file));
      var name = Path.basename(file).replace(/\.svg$/i, "");
      var codepoint = UNICODE_PRIVATE_USE_AREA.start + index;
      var character = String.fromCharCode(codepoint);

      return grunt.util._.merge(svg, {
        name: name,
        codepoint: codepoint.toString(16),
        character: StringUtils.escapeToNumRef(character, 16)
      });
    });
  }

  function createSVG(filename, fontname, glyphs) {
    var contents = font.render({
      font: fontname,
      canvasSize: glyphs[0].height,
      glyphs: glyphs
    });

    grunt.file.write(filename, contents);
    grunt.log.ok("Created: " + filename);
    return contents;
  }

  function createTTF(filename, svg) {
    var ttf = FontConversion.svg2ttf(svg);
    var buffer = new Buffer(ttf.buffer)
    grunt.file.write(filename, buffer);
    grunt.log.ok("Created: " + filename);
    return buffer;
  }

  function createWOFF(filename, ttf, callback) {
    FontConversion.ttf2woff(ttf, {}, function(err, woff) {
      grunt.file.write(filename, woff.buffer);
      grunt.log.ok("Created: " + filename);
      callback();
    });
  }

  function createEOT(filename, ttf) {
    var eot = FontConversion.ttf2eot(ttf);
    grunt.file.write(filename, eot);
    grunt.log.ok("Created: " + filename);
  }

  function template(name) {
    return Hogan.compile(grunt.file.read(Path.join(__dirname, "..", "templates", name)));
  }

  function parseSVG(contents) {
    // TODO: Ignore/error on invalid content?
    var doc = dom.parseFromString(contents, "application/xml");

    // TODO: Handle possibility of no svg element
    var svg = doc.getElementsByTagName("svg")[0];

    var width  = parseFloat(svg.getAttribute("width"));
    var height = parseFloat(svg.getAttribute("height"));

    // TODO: Handle possibility of no/multiple paths
    var path = svg.getElementsByTagName("path")[0];

    return {
      width: svg.getAttribute("width"),
      height: svg.getAttribute("height"),
      d: path.getAttribute("d")
    };
  }

};
