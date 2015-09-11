var Grapher = require('grapher'),
    _ = require('underscore');

require('grapher-center')(Grapher);
require('grapher-target')(Grapher);

module.exports = (function () {
  var viewport, grapher, canvas, textarea;

  var initialize = function () {
    viewport = document.body;
    grapher = new Grapher();
    canvas = grapher.canvas;
    textarea = document.createElement('textarea');

    viewport.appendChild(canvas);
    viewport.appendChild(textarea);

    textarea.addEventListener('input', onInput);
    grapher.play();
  };

  var onInput = _.debounce(function (e) {
    var input = parseJSON(this.value);
    if (input && checkData(input)) {
      grapher.data(input);
      grapher.update();
      grapher.center();
    }
  }, 400);

  function parseJSON (str) {
    var res;
    try {
      res = JSON.parse(str);
    } catch (e) {
      return false;
    }
    return res;
  }

  function checkData (data) {
    if (!data.nodes || ! data.links) return false;
    if (!_.isArray(data.nodes) || !_.isArray(data.links)) return false;

    var r = 8; // default radius

    var checkNode = function (node) {
          var check = node && 'x' in node && 'y' in node;
          if (check && !('r' in node)) node.r = r;
          return check;
        };
    var checkLink = function (link) {
          return link && 'from' in link && 'to' in link &&
              link.from < data.nodes.length && link.to < data.nodes.length;
        };
    return _.every(data.nodes, checkNode) && _.every(data.links, checkLink);
  }

  return {
    initialize: initialize
  };
})();
