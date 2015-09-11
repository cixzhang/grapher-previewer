var Grapher = require('grapher'),
    _ = require('underscore'),
    d3 = require('d3');

require('grapher-center')(Grapher);
require('grapher-target')(Grapher);

var generateData = require('./generateData.js'),
    getOffset = require('./getOffset.js'),
    parseJSON = require('./parseJSON.js');

module.exports = (function () {
  var viewport, grapher, canvas, textarea;

  var initialize = function () {
    var network = generateData();

    viewport = document.body;

    textarea = document.createElement('textarea');
    textarea.innerHTML = JSON.stringify(network, null, 1);
    textarea.addEventListener('input', onInput);

    grapher = new Grapher({data: setupData(network)});
    canvas = grapher.canvas;

    viewport.appendChild(canvas);
    viewport.appendChild(textarea);

    setupForce();
    grapher.play();
  };

  var setupData = function (data) {
    var nodes = _.map(data.nodes, function (node) {
      node.r = node.r || 6;
      node.weight = 1;
      return node;
    });

    var links = _.map(data.links, function (link) {
      link.source = link.from;
      link.target = link.to;
      return link;
    });

    return {nodes: nodes, links: links};
  };

  var setupForce = function () {
    var dragging = null,
        offset = null;

    var data = grapher.data();

    var onTick = function () {
      if (dragging && offset) {
        // update the node's position here so it's sticky
        dragging.node.x = offset.x;
        dragging.node.y = offset.y;
      }
      grapher.update(); // update the grapher
    };

    var force = d3.layout.force()
        .nodes(data.nodes)
        .links(data.links)
        .on('tick', onTick)
        .charge(-5000)
        .gravity(0.005)
        .linkStrength(0.2)
        .linkDistance(100)
        .friction(0.02)
        .start();

    grapher.off();

    grapher.on('mousedown', function (e) {
      var eOffset = getOffset(e);
      var point = grapher.getDataPosition(eOffset);
      var nodeId = grapher.target(point);
      if (nodeId > -1) {
        dragging = {node: data.nodes[nodeId], id: nodeId};
        offset = point;
      }
      else dragging = offset = null;
    });
    // When the user moves the mouse, we update the node's position
    grapher.on('mousemove', function (e) {
      var eOffset = getOffset(e);
      var point = grapher.getDataPosition(eOffset);
      if (dragging) {
        offset = point;
        force.alpha(1); // restart the force graph
      }
    });

    // Finally when the user lets go of the mouse, we stop dragging
    grapher.on('mouseup', function (e) { dragging = offset = null; });
  };

  var onInput = _.debounce(function (e) {
    var input = parseJSON(this.value);
    if (input && checkData(input)) {
      grapher.data(setupData(input));
      grapher.update();
      grapher.center();
      setupForce();
    }
  }, 400);

  function checkData (data) {
    if (!data.nodes || ! data.links) return false;
    if (!_.isArray(data.nodes) || !_.isArray(data.links)) return false;

    var checkNode = function (node) {
          return node && 'x' in node && 'y' in node;
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
