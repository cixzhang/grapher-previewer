var Grapher = require('grapher');

require('grapher-center')(Grapher);
require('grapher-target')(Grapher);

var Previewer = {
  initialize: function () {
    this.viewport = document.body;
    this.grapher = new Grapher();
    this.canvas = this.grapher.canvas;

    this.textarea = document.createElement('textarea');


    this.viewport.appendChild(this.canvas);
    this.viewport.appendChild(this.textarea);
  }
};

module.exports = Previewer;
