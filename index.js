(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Previewer = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"grapher":4,"grapher-center":2,"grapher-target":3,"underscore":17}],2:[function(require,module,exports){
;(function () {
  var center = function (g) {

  /**
    * grapher.center
    * ------------------
    * 
    * Center the whole network or provided nodeIds in the view.
    */
    g.prototype.center = function (nodeIds) {
      var x = 0,
          y = 0,
          scale = 1,
          allNodes = this.data() ? this.data().nodes : null,
          nodes = [];
      if (nodeIds) for (i = 0; i < nodeIds.length; i++) { nodes.push(allNodes[nodeIds[i]]); }
      else nodes = allNodes;

      var numNodes = nodes ? nodes.length : 0;

      if (numNodes) { // get initial transform
        var minX = Infinity, maxX = -Infinity,
            minY = Infinity, maxY = -Infinity,
            width = this.width(),
            height = this.height(),
            pad = 1.1,
            i;

        for (i = 0; i < numNodes; i++) {
          if (nodes[i].x < minX) minX = nodes[i].x;
          if (nodes[i].x > maxX) maxX = nodes[i].x;
          if (nodes[i].y < minY) minY = nodes[i].y;
          if (nodes[i].y > maxY) maxY = nodes[i].y;
        }
        
        var dX = maxX - minX,
            dY = maxY - minY;

        scale = Math.min(width / dX, height / dY, 2) / pad;
        x = (width - dX * scale) / 2 - minX * scale;
        y = (height - dY * scale) / 2 - minY * scale;
      }

      return this.scale(scale).translate([x, y]);
    };

  /**
    * grapher.centerToPoint
    * ------------------
    * 
    * Center the network to the point with x and y coordinates
    */
    g.prototype.centerToPoint = function (point) {
      var width = this.width(),
          height = this.height(),
          x = this.translate()[0] + width / 2 - point.x,
          y = this.translate()[1] + height / 2 - point.y;

      return this.translate([x, y]);
    };

  /**
    * Extend data to call this.center,
    * scale and translate to track when the user modifies the transform.
    */
    var render = g.prototype.render,
        scale = g.prototype.scale,
        translate = g.prototype.translate;

    g.prototype._hasModifiedTransform = false;
    g.prototype.render = function () {
      if (!this._hasModifiedTransform) this.center();
      return render.apply(this, arguments);
    };
    g.prototype.scale = function () {
      var res = scale.apply(this, arguments);
      if (res === this) this._hasModifiedTransform = true;
      return res;
    };
    g.prototype.translate = function () {
      var res = translate.apply(this, arguments);
      if (res === this) this._hasModifiedTransform = true;
      return res;
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = center;
  else center(Grapher);
})();

},{}],3:[function(require,module,exports){
;(function () {
  /**
    * Helper functions and distance calculations
    */
  function square (a) {
    return a * a;
  }

  function getDistanceFunction (point, fn) {
    return function (obj) { return fn(point, obj); };
  }

  function distSquared (p1, p2) {
    return square(p2.x - p1.x) + square(p2.y - p1.y);
  }

  function distToLineSquared (p1, l1, l2) {
    var dot = (p1.x - l1.x) * (l2.x - l1.x) + (p1.y - l1.y) * (l2.y - l1.y),
        ratio = dot / distSquared(l1, l2);
    if (ratio < 0) return distSquared(p1, l1);
    if (ratio > 1) return distSquared(p1, l2);
    return distSquared(
      p1,
      {
        x: l1.x + ratio * (l2.x - l1.x),
        y: l1.y + ratio * (l2.y - l1.y)
      }
    );
  }

  function nodeDistanceSquared (point, node) {
    // preserve monomorphism
    node = {x: node.x, y: node.y};
    return distSquared(point, node);
  }

  function linkDistanceSquared (point, link) {
    // preserve monomorphism
    var nodes = this.data().nodes,
        from = {x: nodes[link.from].x, y: nodes[link.from].y},
        to = {x: nodes[link.to].x, y: nodes[link.to].y};
    return distToLineSquared(point, from, to);
  }

  var target = function (g) {
    /**
      * grapher.target
      * ------------------
      * 
      * A naive target node/link implementation. Finds the node or link at the point ({x, y}).
      *
      * @param point    an object containing x, y attributes in data space
      * @param type     (optional, defaults to 'nodes') nodes' or 'links'
      *
      */
    g.prototype.target = function (point, type) {
      type = type || g.NODES;
      if (type == g.LINKS) return this.targetLink(point);
      else return this.targetNode(point);
    };

    g.prototype.targetNode = function (point) {
      var node = -1,
          isTarget = function (n, i) {
            var found = nodeDistanceSquared(point, n) <= square(n.r);
            if (found) node = i;
            return !found;
          };
      this.data().nodes.every(isTarget);
      return node;
    };

    g.prototype.targetLink = function (point) {
      var link = -1,
          lineWidth = this.renderer.lineWidth,
          d = linkDistanceSquared.bind(this),
          isTarget = function (l, i) {
            var found = d(point, l) <= square(lineWidth);
            if (found) link = i;
            return !found;
          };
      this.data().links.every(isTarget);
      return link;
    };

    /**
      * grapher.nearest
      * ------------------
      * 
      * A naive nearest node/link implementation.
      * Returns an array of node or link indices sorted by smallest to largest distance.
      *
      * @param point    an object containing x, y attributes in data space
      * @param type     (optional, defaults to 'nodes') nodes' or 'links'
      * @param options  (optional) an object containing:
      *          - d      (default euclidean squared) a distance function that takes two args -- a point and a node or link
      *          - count  (default 1) the number of nearest nodes or links to return
      *
      */
    g.prototype.nearest = function (point, type, options) {
      type = type || g.NODES;
      if (type == g.LINKS) return this.nearestLink(point, options);
      else return this.nearestNode(point, options);
    };

    g.prototype.nearestNode = function (point, options) {
      var d = options && options.d || nodeDistanceSquared;
      var count = options && options.count || 1;
      var dataPoint = this.getDataPosition(point),
          distances = [],
          sorted = [];

      d = getDistanceFunction(dataPoint, d);

      this.data().nodes.forEach(function (n, i) {
        var dist = d(n);
        var index = g.utils.sortedIndex(distances, dist);
        distances.splice(index, 0, dist);
        sorted.splice(index, 0, i);
      });

      var nearest = sorted.slice(0, count);
      return nearest;
    };

    g.prototype.nearestLink = function (point, options) {
      var d = options && options.d || linkDistanceSquared.bind(this);
      var count = options && options.count || 1;
      var dataPoint = this.getDataPosition(point),
          distances = [],
          sorted = [];

      d = getDistanceFunction(dataPoint, d);
      this.data().links.forEach(function (l, i) {
        var dist = d(l);
        var index = g.utils.sortedIndex(distances, dist);
        distances.splice(index, 0, dist);
        sorted.splice(index, 0, i);
      });

      var nearest = sorted.slice(0, count);
      return nearest;
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = target;
  else target(Grapher);
})();

},{}],4:[function(require,module,exports){
// Ayasdi Inc. Copyright 2014
// Grapher.js may be freely distributed under the Apache 2.0 license

;(function () {
  
/**
  * Grapher
  * =======
  * WebGL network grapher rendering with PIXI
  */
  function Grapher () {
    this.initialize.apply(this, arguments);
    return this;
  }

/**
  * Helpers and Renderers
  * =====================
  * Load helpers and renderers.
  */
  var WebGLRenderer = Grapher.WebGLRenderer = require('./renderers/gl/renderer.js'),
      CanvasRenderer = Grapher.CanvasRenderer = require('./renderers/canvas/renderer.js'),
      Color = Grapher.Color = require('./helpers/color.js'),
      Link = Grapher.Link = require('./helpers/link.js'),
      Node = Grapher.Node = require('./helpers/node.js'),
      Shaders = Grapher.Shaders = require('./helpers/shaders.js'),
      u = Grapher.utils = require('./helpers/utilities.js');

  Grapher.prototype = {};

  /**
    * grapher.initialize
    * ------------------
    * 
    * Initialize is called when a grapher instance is created:
    *     
    *     var grapher = new Grapher(width, height, options);
    *
    */
  Grapher.prototype.initialize = function (o) {
    if (!o) o = {};
    
    // Extend default properties with options
    this.props = u.extend({
      color: 0xff222222,
      scale: 1,
      translate: [0, 0],
      resolution: window.devicePixelRatio || 1
    }, o);

    if (!o.canvas) this.props.canvas = document.createElement('canvas');
    this.canvas = this.props.canvas;

    var webGL = this._getWebGL();
    if (webGL) {
      this.props.webGL = webGL;
      this.props.canvas.addEventListener('webglcontextlost', function (e) { this._onContextLost(e); }.bind(this));
      this.props.canvas.addEventListener('webglcontextrestored', function (e) { this._onContextRestored(e); }.bind(this));
      this.props.linkShaders = new Shaders(this.props.linkShaders);
      this.props.nodeShaders = new Shaders(this.props.nodeShaders);
    }

    // Renderer and view
    this.renderer =  webGL ? new WebGLRenderer(this.props) : new CanvasRenderer(this.props);
    this.rendered = false;

    // Sprite array
    this.links = [];
    this.nodes = [];

    this.renderer.setLinks(this.links);
    this.renderer.setNodes(this.nodes);

    // Indices that will update
    this.willUpdate = {};
    this.updateAll = {};
    this._clearUpdateQueue();

    // Bind some updaters
    this._updateLink = u.bind(this._updateLink, this);
    this._updateNode = u.bind(this._updateNode, this);
    this._updateLinkByIndex = u.bind(this._updateLinkByIndex, this);
    this._updateNodeByIndex = u.bind(this._updateNodeByIndex, this);
    this.animate = u.bind(this.animate, this);

    // Event Handlers
    this.handlers = {};

    // Do any additional setup
    u.eachKey(o, this.set, this);
  };

  /**
    * grapher.set
    * ------------------
    * 
    * General setter for a grapher's properties.
    *
    *     grapher.set(1, 'scale');
    */
  Grapher.prototype.set = function (val, key) {
    var setter = this[key];
    if (setter && u.isFunction(setter))
      return setter.call(this, val);
  };

  /**
    * grapher.on
    * ------------------
    * 
    * Add a listener to a grapher event. Only one listener can be bound to an
    * event at this time. Available events:
    *
    *   * mousedown
    *   * mouseover
    *   * mouseup
    */
  Grapher.prototype.on = function (event, fn) {
    this.handlers[event] = this.handlers[event] || [];
    this.handlers[event].push(fn);
    this.canvas.addEventListener(event, fn, false);
    return this;
  };

  /**
    * grapher.off
    * ------------------
    * 
    * Remove a listener from an event, or all listeners from an event if fn is not specified.
    */
  Grapher.prototype.off = function (event, fn) {
    var removeHandler = u.bind(function (fn) {
      var i = u.indexOf(this.handlers[event], fn);
      if (i > -1) this.handlers[event].splice(i, 1);
      this.canvas.removeEventListener(event, fn, false);
    }, this);

    if (fn && this.handlers[event]) removeHandler(fn);
    else if (u.isUndefined(fn) && this.handlers[event]) u.each(this.handlers[event], removeHandler);

    return this;
  };

  /**
    * grapher.data
    * ------------------
    * 
    * Accepts network data in the form:
    *
    *     {
    *       nodes: [{x: 0, y: 0, r: 20, color: (swatch or hex/rgb)}, ... ],
    *       links: [{from: 0, to: 1, color: (swatch or hex/rgb)}, ... ]
    *     }
    */
  Grapher.prototype.data = function (data) {
    if (u.isUndefined(data)) return this.props.data;

    this.props.data = data;
    this.exit();
    this.enter();
    this.update();

    return this;
  };

  /**
    * grapher.enter
    * ------------------
    * 
    * Creates node and link sprites to match the number of nodes and links in the
    * data.
    */
  Grapher.prototype.enter = function () {
    var data = this.data();
    if (this.links.length < data.links.length) {
      var links = data.links.slice(this.links.length, data.links.length);
      u.eachPop(links, u.bind(function () { this.links.push(new Link()); }, this));
    }

    if (this.nodes.length < data.nodes.length) {
      var nodes = data.nodes.slice(this.nodes.length, data.nodes.length);
      u.eachPop(nodes, u.bind(function () { this.nodes.push(new Node()); }, this));
    }

    return this;
  };

  /**
    * grapher.exit
    * ------------------
    * 
    * Removes node and link sprites to match the number of nodes and links in the
    * data.
    */
  Grapher.prototype.exit = function () {
    var data = this.data(),
        exiting = [];

    if (data.links.length < this.links.length) {
      this.links.splice(data.links.length, this.links.length - data.links.length);
    }
    if (data.nodes.length < this.nodes.length) {
      this.nodes.splice(data.nodes.length, this.nodes.length - data.nodes.length);
    }

    return this;
  };

  /**
    * grapher.update
    * ------------------
    * 
    * Add nodes and/or links to the update queue by index. Passing in no arguments will 
    * add all nodes and links to the update queue. Node and link sprites in the update
    * queue are updated at the time of rendering.
    *
    *     grapher.update(); // updates all nodes and links
    *     grapher.update('links'); // updates only links
    *     grapher.update('nodes', 0, 4); // updates nodes indices 0 to 3 (4 is not inclusive)
    *     grapher.update('links', [0, 1, 2, 6, 32]); // updates links indexed by the indices
    */
  Grapher.prototype.update = function (type, start, end) {
    var indices;
    if (u.isArray(start)) indices = start;
    else if (u.isNumber(start) && u.isNumber(end)) indices = u.range(start, end);

    if (u.isArray(indices)) {
      this._addToUpdateQueue(type, indices);
      if (type === NODES) this._addToUpdateQueue(LINKS, this._findLinks(indices));
    } else {
      if (type !== NODES) this.updateAll.links = true;
      if (type !== LINKS) this.updateAll.nodes = true;
    }
    return this;
  };

  /**
    * grapher.updateNode
    * ------------------
    * 
    * Add an individual node to the update queue. Optionally pass in a boolean to
    * specify whether or not to also add links connected with the node to the update queue.
    */
  Grapher.prototype.updateNode = function (index, willUpdateLinks) {
    this._addToUpdateQueue(NODES, [index]);
    if (willUpdateLinks) this._addToUpdateQueue(LINKS, this._findLinks([index]));
    return this;
  };

  /**
    * grapher.updateLink
    * ------------------
    * 
    * Add an individual link to the update queue.
    */
  Grapher.prototype.updateLink = function (index) {
    this._addToUpdateQueue(LINKS, [index]);
    return this;
  };

  /**
    * grapher.clear
    * ------------------
    * 
    * Clears the canvas and grapher data.
    */
  Grapher.prototype.clear = function () {
    this.data({links: [], nodes: []});
    this.render();
    return this;
  };

  /**
    * grapher.render
    * ------------------
    * 
    * Updates each sprite and renders the network.
    */
  Grapher.prototype.render = function () {
    this.rendered = true;
    this._update();
    this.renderer.render();
    return this;
  };

  /**
    * grapher.animate
    * ------------------
    * 
    * Calls render in a requestAnimationFrame loop.
    */
  Grapher.prototype.animate = function (time) {
    this.render();
    this.currentFrame = requestAnimationFrame(this.animate);
  };

  /**
    * grapher.play
    * ------------------
    * 
    * Starts the animate loop.
    */
  Grapher.prototype.play = function () {
    this.currentFrame = requestAnimationFrame(this.animate);
    return this;
  };

  /**
    * grapher.pause
    * ------------------
    * 
    * Pauses the animate loop.
    */
  Grapher.prototype.pause = function () {
    if (this.currentFrame) cancelAnimationFrame(this.currentFrame);
    this.currentFrame = null;
    return this;
  };

  /**
    * grapher.resize
    * ------------------
    * 
    * Resize the grapher view.
    */
  Grapher.prototype.resize = function (width, height) {
    this.renderer.resize(width, height);
    return this;
  };

  /**
    * grapher.width
    * ------------------
    * 
    * Specify or retrieve the width.
    */
  Grapher.prototype.width = function (width) {
    if (u.isUndefined(width)) return this.canvas.clientWidth;
    this.resize(width, null);
    return this;
  };

   /**
    * grapher.height
    * ------------------
    * 
    * Specify or retrieve the height.
    */
  Grapher.prototype.height = function (height) {
    if (u.isUndefined(height)) return this.canvas.clientHeight;
    this.resize(null, height);
    return this;
  };

  /**
    * grapher.transform
    * ------------------
    * 
    * Set the scale and translate as an object.
    * If no arguments are passed in, returns the current transform object.
    */
  Grapher.prototype.transform = function (transform) {
    if (u.isUndefined(transform))
      return {scale: this.props.scale, translate: this.props.translate};

    this.scale(transform.scale);
    this.translate(transform.translate);
    return this;
  };

  /**
    * grapher.scale
    * ------------------
    * 
    * Set the scale.
    * If no arguments are passed in, returns the current scale.
    */
  Grapher.prototype.scale = function (scale) {
    if (u.isUndefined(scale)) return this.props.scale;
    if (u.isNumber(scale)) this.props.scale = scale;
    this.updateTransform = true;
    return this;
  };

  /**
    * grapher.translate
    * ------------------
    * 
    * Set the translate.
    * If no arguments are passed in, returns the current translate.
    */
  Grapher.prototype.translate = function (translate) {
    if (u.isUndefined(translate)) return this.props.translate;
    if (u.isArray(translate)) this.props.translate = translate;
    this.updateTransform = true;
    return this;
  };

  /**
    * grapher.color
    * ------------------
    * 
    * Set the default color of nodes and links.
    * If no arguments are passed in, returns the current default color.
    */
  Grapher.prototype.color = function (color) {
    if (u.isUndefined(color)) return this.props.color;
    this.props.color = Color.parse(color);
    return this;
  };

  /**
    * grapher.getDataPosition
    * ------------------
    * 
    * Returns data space coordinates given display coordinates.
    * If a single argument passed in, function considers first argument an object with x and y props.
    */
  Grapher.prototype.getDataPosition = function (x, y) {
    var xCoord = u.isUndefined(y) ? x.x : x;
    var yCoord = u.isUndefined(y) ? x.y : y;
    x = this.renderer.untransformX(xCoord);
    y = this.renderer.untransformY(yCoord);
    return {x: x, y: y};
  };

  /**
  * grapher.getDisplayPosition
  * ------------------
  * 
  * Returns display space coordinates given data coordinates.
  * If a single argument passed in, function considers first argument an object with x and y props.
  */
  Grapher.prototype.getDisplayPosition = function (x, y) {
    var xCoord = u.isUndefined(y) ? x.x : x;
    var yCoord = u.isUndefined(y) ? x.y : y;
    x = this.renderer.transformX(xCoord);
    y = this.renderer.transformY(yCoord);
    return {x: x, y: y};
  };

/**
  * Private Functions
  * =================
  * 
  */

  /**
    * grapher._addToUpdateQueue
    * -------------------
    * 
    * Add indices to the nodes or links update queue.
    *
    */
  Grapher.prototype._addToUpdateQueue = function (type, indices) {
    var willUpdate = type === NODES ? this.willUpdate.nodes : this.willUpdate.links,
        updateAll = type === NODES ? this.updateAll.nodes : this.updateAll.links,
        spriteSet = type === NODES ? this.nodes : this.links;

    var insert = function (n) { u.uniqueInsert(willUpdate, n); };
    if (!updateAll && u.isArray(indices)) u.each(indices, insert, this);

    updateAll = updateAll || willUpdate.length >= spriteSet.length;

    if (type === NODES) this.updateAll.nodes = updateAll;
    else this.updateAll.links = updateAll;
  };

  /**
    * grapher._clearUpdateQueue
    * -------------------
    * 
    * Clear the update queue.
    *
    */
  Grapher.prototype._clearUpdateQueue = function () {
    this.willUpdate.links = [];
    this.willUpdate.nodes = [];
    this.updateAll.links = false;
    this.updateAll.nodes = false;
    this.updateTransform = false;
  };

  /**
    * grapher._update
    * -------------------
    * 
    * Update nodes and links in the update queue.
    *
    */
  Grapher.prototype._update = function () {
    var updatingLinks = this.willUpdate.links,
        updatingNodes = this.willUpdate.nodes,
        i;

    if (this.updateAll.links) u.each(this.links, this._updateLink);
    else if (updatingLinks && updatingLinks.length) u.eachPop(updatingLinks, this._updateLinkByIndex);

    if (this.updateAll.nodes) u.each(this.nodes, this._updateNode);
    else if (updatingNodes && updatingNodes.length) u.eachPop(updatingNodes, this._updateNodeByIndex);

    if (this.updateTransform) {
      this.renderer.setScale(this.props.scale);
      this.renderer.setTranslate(this.props.translate);
    }

    this._clearUpdateQueue();
  };

  Grapher.prototype._updateLink = function (link, i) {
    var data = this.data(),
        l = data.links[i],
        from = data.nodes[l.from],
        to = data.nodes[l.to];

    var color = !u.isUndefined(l.color) ? this._findColor(l.color) :
        Color.interpolate(this._findColor(from.color), this._findColor(to.color));

    link.update(from.x, from.y, to.x, to.y, color);
  };

  Grapher.prototype._updateNode = function (node, i) {
    var n = this.data().nodes[i];
    node.update(n.x, n.y, n.r, this._findColor(n.color));
  };

  Grapher.prototype._updateNodeByIndex = function (i) { this._updateNode(this.nodes[i], i); };

  Grapher.prototype._updateLinkByIndex = function (i) { this._updateLink(this.links[i], i); };

  /**
    * grapher._findLinks
    * -------------------
    * 
    * Search for links connected to the node indices provided.
    *
    * isLinked is a helper function that returns true if a link is
    * connected to a node in indices.
    */
  var isLinked = function (indices, l) {
    var i, len = indices.length, flag = false;
    for (i = 0; i < len; i++) {
      if (l.to == indices[i] || l.from == indices[i]) {
        flag = true;
        break;
      }
    }
    return flag;
  };

  Grapher.prototype._findLinks = function (indices) {
    var links = this.data().links,
        i, numLinks = links.length,
        updatingLinks = [];

    for (i = 0; i < numLinks; i++) {
      if (isLinked(indices, links[i])) updatingLinks.push(i);
    }

    return updatingLinks;
  };

  /**
    * grapher._findColor
    * -------------------
    * 
    * Search for a color whether it's defined by palette index, string,
    * integer.
    */
  Grapher.prototype._findColor = function (c) {
    var color = Color.parse(c);

    // if color is still not set, use the default
    if (u.isNaN(color)) color = this.color();
    return color;
  };

  /**
    * grapher._getWebGL
    * -------------------
    * 
    *get webGL context if available
    *
    */
  Grapher.prototype._getWebGL = function () {
    var gl = null;
    try { gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl"); }
    catch (x) { gl = null; }
    return gl;
  };

 /**
    * grapher._onContextLost
    * ----------------------
    * 
    * Handle context lost.
    *
    */
  Grapher.prototype._onContextLost = function (e) {
    e.preventDefault();
    if (this.currentFrame) cancelAnimationFrame(this.currentFrame);
  };

  /**
    * grapher._onContextRestored
    * --------------------------
    * 
    * Handle context restored.
    *
    */
  Grapher.prototype._onContextRestored = function (e) {
    var webGL = this._getWebGL();
    this.renderer.initGL(webGL);
    if (this.currentFrame) this.play(); // Play the graph if it was running.
    else if (this.rendered) this.render();
  };


/**
  * Grapher Static Properties
  * =========================
  */
  var NODES = Grapher.NODES = 'nodes';
  var LINKS = Grapher.LINKS = 'links';

  if (module && module.exports) module.exports = Grapher;
})();

},{"./helpers/color.js":5,"./helpers/link.js":6,"./helpers/node.js":7,"./helpers/shaders.js":8,"./helpers/utilities.js":9,"./renderers/canvas/renderer.js":10,"./renderers/gl/renderer.js":11}],5:[function(require,module,exports){
// Ayasdi Inc. Copyright 2014
// Color.js may be freely distributed under the Apache 2.0 license

var Color = module.exports = {
  interpolate: interpolate,
  parse: parse,
  fromIntToRgb: fromIntToRgb,
  fromIntToRgba: fromIntToRgba,
  fromRgbToHex: fromRgbToHex,
  fromRgbaToHex: fromRgbaToHex,
  fromIntToRgbString: fromIntToRgbString,
  fromIntToRgbaString: fromIntToRgbaString,
  fromRgbStringToInt: fromRgbStringToInt,
  fromRgbaStringToInt: fromRgbaStringToInt,
  fromRgbToInt: fromRgbToInt,
  fromRgbaToInt: fromRgbaToInt,
  fromHexToInt: fromHexToInt
};

function interpolate (a, b, amt) {
  amt = amt === undefined ? 0.5 : amt;
  var colorA = fromIntToRgba(a),
      colorB = fromIntToRgba(b),
      interpolated = {
        r: colorA.r + (colorB.r - colorA.r) * amt,
        g: colorA.g + (colorB.g - colorA.g) * amt,
        b: colorA.b + (colorB.b - colorA.b) * amt,
        a: colorA.a + (colorB.a - colorA.a) * amt
      };
  return fromRgbaToInt(interpolated.r, interpolated.g, interpolated.b, interpolated.a);
}

function parse (c) {
  var color = parseInt(c, 10); // usually NaN, in case we pass in an int for color
  if (typeof c === 'string') {
    var string = c.replace(/ /g, ''); // strip spaces immediately

    if (c.split('#').length > 1) color = fromHexToInt(string);
    else if (c.split('rgb(').length > 1) color = fromRgbStringToInt(string);
    else if (c.split('rgba(').length > 1) color = fromRgbaStringToInt(string);
  }
  return color;
}

function fromIntToRgb (intColor) {
  return {
    r: Math.floor(intColor / Math.pow(2, 16)) % Math.pow(2, 8),
    g: Math.floor(intColor / Math.pow(2, 8)) % Math.pow(2, 8),
    b: intColor % Math.pow(2, 8)
  };
}

function fromIntToRgba (intColor) {
  return {
    a: Math.floor(intColor / Math.pow(2, 24)) % Math.pow(2, 8),
    r: Math.floor(intColor / Math.pow(2, 16)) % Math.pow(2, 8),
    g: Math.floor(intColor / Math.pow(2, 8)) % Math.pow(2, 8),
    b: intColor % Math.pow(2, 8)
  };
}

function fromRgbToHex (r, g, b) {
  var rgb = (parseInt(r, 10) * Math.pow(2, 16)) + (parseInt(g, 10) * Math.pow(2, 8)) + parseInt(b, 10);
  return '#' + (0x1000000 + rgb).toString(16).slice(1);
}

function fromRgbaToHex (r, g, b, a) {
  var rgba = (parseInt(a, 10) * Math.pow(2, 24)) + (parseInt(r, 10) * Math.pow(2, 16)) + (parseInt(g, 10) * Math.pow(2, 8)) + parseInt(b, 10);
  return '#' + ( 0x100000000 + rgba).toString(16).slice(1);
}

function fromIntToRgbString (intColor) {
  var rgb = fromIntToRgb(intColor);
  return 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
}

function fromIntToRgbaString (intColor) {
  var rgba = fromIntToRgba(intColor);
  return 'rgba(' + rgba.r + ', ' + rgba.g + ', ' + rgba.b + ', ' + rgba.a / 255 + ')';
}

function fromRgbStringToInt (string) {
  var rgb = string.substring(4, string.length - 1).split(',');
  return fromRgbToInt(rgb[0], rgb[1], rgb[2]);
}

function fromRgbaStringToInt (string) {
  var rgba = string.substring(5, string.length - 1).split(',');
  return fromRgbaToInt(rgba[0], rgba[1], rgba[2], rgba[3] * 255);
}

function fromRgbToInt (r, g, b) {
  return fromRgbaToInt(r, g, b, 255);
}

function fromRgbaToInt (r, g, b, a) {
  return parseInt(fromRgbaToHex(r, g, b, a ).replace('#', '0x'), 16);
}

function fromHexToInt (string) {
  var hex = string.replace('#', '');
  if (hex.length === 6) hex = 'ff' + hex; // prepend full alpha if needed
  return parseInt(hex, 16);
}

},{}],6:[function(require,module,exports){
;(function () {
  function Link () {
    this.x1 = 0;
    this.y1 = 0;
    this.x2 = 0;
    this.y2 = 0;
    this.color = 0;
    return this;
  }

  Link.prototype.update = function (x1, y1, x2, y2, color) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.color = color;
    return this;
  };

  if (module && module.exports) module.exports = Link;
})();

},{}],7:[function(require,module,exports){
;(function () {
  function Node () {
    this.x = 0;
    this.y = 0;
    this.r = 10;
    this.color = 0;
    return this;
  }

  Node.prototype.update = function (x, y, r, color) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = color;
    return this;
  };

  if (module && module.exports) module.exports = Node;
})();

},{}],8:[function(require,module,exports){
;(function () {
  function Shaders (obj) {
    this.vertexCode = obj && obj.vertexCode || null;
    this.fragmentCode = obj && obj.fragmentCode || null;
    return this;
  }

  Shaders.prototype.addVertexAttr = function (name, value, size, type, normalized) {
    var attrs = {
      name: name,
      value: value,
      size: size,
      type: type,
      normalized: normalized
    };

    this.vertexAttrs.push(attrs);
  };

  Shaders.prototype.addUniformAttr = function (name, value) {
    var attrs = {
      name: name,
      value: value
    };

    this.uniformAttrs.push(attrs);
  };

  if (module && module.exports) module.exports = Shaders;
})();

},{}],9:[function(require,module,exports){
/**
 * Utilities
 * =========
 *
 * Various utility functions
 */
var Utilities = module.exports = {
  each: each,
  eachPop: eachPop,
  eachKey: eachKey,
  map: map,
  clean: clean,
  range: range,
  sortedIndex: sortedIndex,
  indexOf: indexOf,
  uniqueInsert: uniqueInsert,
  extend: extend,
  bind: bind,
  noop: noop,
  isUndefined: isUndefined,
  isFunction: isFunction,
  isObject: isObject,
  isArray: Array.isArray,
  isNumber: isNumber,
  isNaN: isNaN
};

/**
 * noop
 * -----
 *
 * A function that does nothing.
 */
function noop () {}

/**
 * each
 * -----
 *
 * Perform an operation on each element in an array.
 *
 *     var arr = [1, 2, 3];
 *     u.each(arr, fn);
 */
function each (arr, fn, ctx) {
  fn = bind(fn, ctx);
  var i = arr.length;
  while (--i > -1) {
    fn(arr[i], i);
  }
  return arr;
}

/**
 * eachPop
 * -------
 *
 * Perform a function on each element in an array. Faster than each, but won't pass index and the
 * array will be cleared.
 *
 *     u.eachPop([1, 2, 3], fn);
 */
function eachPop (arr, fn, ctx) {
  fn = bind(fn, ctx);
  while (arr.length) {
    fn(arr.pop());
  }
  return arr;
}

/**
 * eachKey
 * -------
 *
 * Perform a function on each property in an object.
 *
 *     var obj = {foo: 0, bar: 0};
 *     u.eachKey(obj, fn);
 */
function eachKey (obj, fn, ctx) {
  fn = bind(fn, ctx);
  if (isObject(obj)) {
    var keys = Object.keys(obj);

    while (keys.length) {
      var key = keys.pop();
      fn(obj[key], key);
    }
  }
  return obj;
}

/**
 * map
 * -----
 *
 * Get a new array with values calculated from original array.
 *
 *     var arr = [1, 2, 3];
 *     var newArr = u.map(arr, fn);
 */
function map (arr, fn, ctx) {
  fn = bind(fn, ctx);
  var i = arr.length,
      mapped = new Array(i);
  while (--i > -1) {
    mapped[i] = fn(arr[i], i);
  }
  return mapped;
}

/**
 * clean
 * -----
 *
 * Clean an array by reference.
 *
 *     var arr = [1, 2, 3];
 *     u.clean(arr); // arr = []
 */
function clean (arr) {
  eachPop(arr, noop);
  return arr;
}

/**
 * range
 * -----
 *
 * Create an array of numbers from start to end, incremented by step.
 */
function range (start, end, step) {
  step = isNumber(step) ? step : 1;
  if (isUndefined(end)) {
    end = start;
    start = 0;
  }

  var i = Math.max(Math.ceil((end - start) / step), 0),
      result = new Array(i);

  while (--i > -1) {
    result[i] = start + (step * i);
  }
  return result;
}

/**
 * sortedIndex
 * -----------
 *
 * Finds the sorted position of a number in an Array of numbers.
 */
function sortedIndex (arr, n) {
  var min = 0,
      max = arr.length;

  while (min < max) {
    var mid = min + max >>> 1;
    if (n < arr[mid]) max = mid;
    else min = mid + 1;
  }

  return min;
}

/**
 * indexOf
 * -------
 *
 * Finds the index of a variable in an array.
 * Returns -1 if not found.
 */
function indexOf (arr, n) {
  var i = arr.length;
  while (--i > -1) {
    if (arr[i] === n) return i;
  }
  return i;
}

/**
 * uniqueInsert
 * ------------
 *
 * Inserts a value into an array only if it does not already exist
 * in the array.
 */
function uniqueInsert (arr, n) {
  if (indexOf(arr, n) === -1) arr.push(n);
  return arr;
}

/**
 * extend
 * ------
 *
 * Extend an object with the properties of one other objects
 */
function extend (obj, source) {
  if (isObject(obj) && isObject(source)) {
    var props = Object.getOwnPropertyNames(source),
      i = props.length;
    while (--i > -1) {
      var prop = props[i];
      obj[prop] = source[prop];
    }
  }
  return obj;
}

/**
   * bind
   * ----
   *
   * Bind a function to a context. Optionally pass in the number of arguments
   * which will use the faster fn.call if the number of arguments is 0, 1, or 2.
   */
function bind (fn, ctx) {
  if (!ctx) return fn;
  return function () { return fn.apply(ctx, arguments); };
}

/**
 * isUndefined
 * -----------
 *
 * Checks if a variable is undefined.
 */
function isUndefined (o) {
  return typeof o === 'undefined';
}

/**
 * isFunction
 * ----------
 *
 * Checks if a variable is a function.
 */
function isFunction (o) {
  return typeof o === 'function';
}

/**
 * isObject
 * --------
 *
 * Checks if a variable is an object.
 */
function isObject (o) {
  return typeof o === 'object' && !!o;
}

/**
 * isNumber
 * --------
 *
 * Checks if a variable is a number.
 */
function isNumber (o) {
  return typeof o === 'number';
}

/**
 * isNaN
 * -----
 *
 * Checks if a variable is NaN.
 */
function isNaN (o) {
  return isNumber(o) && o !== +o;
}

},{}],10:[function(require,module,exports){
;(function () {

  var Renderer = require('../renderer.js');
  var Color = require('../../helpers/color.js');
  
  var CanvasRenderer = Renderer.extend({
    init: function (o) {
      this._super(o);
      this.context = this.canvas.getContext('2d');
    },

    render: function () {
      this.resize();
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderLinks();
      this.renderNodes();
    },

    renderNodes: function () {
      for (var i = 0 ; i < this.nodeObjects.length; i ++) {
        var node = this.nodeObjects[i];
        var cx = this.transformX(node.x) * this.resolution;
        var cy = this.transformY(node.y) * this.resolution;
        var r = node.r * Math.abs(this.scale * this.resolution);

        this.context.beginPath();
        this.context.arc(cx, cy, r, 0, 2 * Math.PI, false);
        this.context.fillStyle = Color.fromIntToRgbaString(node.color);
        this.context.fill();
      }
    },

    renderLinks: function () {
      for (var i = 0 ; i < this.linkObjects.length; i ++) {
        var link = this.linkObjects[i];
        var x1 = this.transformX(link.x1) * this.resolution;
        var y1 = this.transformY(link.y1) * this.resolution;
        var x2 = this.transformX(link.x2) * this.resolution;
        var y2 = this.transformY(link.y2) * this.resolution;

        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.lineWidth = this.lineWidth * Math.abs(this.scale * this.resolution);
        this.context.strokeStyle = Color.fromIntToRgbaString(link.color);
        this.context.stroke();
      }
    }
  });
  
  if (module && module.exports) module.exports = CanvasRenderer;
})();

},{"../../helpers/color.js":5,"../renderer.js":16}],11:[function(require,module,exports){
;(function () {
  var LinkVertexShaderSource = require('./shaders/link.vert.js'),
      LinkFragmentShaderSource = require('./shaders/link.frag.js'),
      NodeVertexShaderSource = require('./shaders/node.vert.js'),
      NodeFragmentShaderSource = require('./shaders/node.frag.js'),
      Renderer = require('../renderer.js'),
      Color = require('../../helpers/color.js');

  var WebGLRenderer = Renderer.extend({
    init: function (o) {
      this.gl = o.webGL;
      
      this.linkVertexShader = o.linkShaders && o.linkShaders.vertexCode || LinkVertexShaderSource;
      this.linkFragmentShader = o.linkShaders && o.linkShaders.fragmentCode || LinkFragmentShaderSource;
      this.nodeVertexShader = o.nodeShaders && o.nodeShaders.vertexCode ||  NodeVertexShaderSource;
      this.nodeFragmentShader = o.nodeShaders && o.nodeShaders.fragmentCode || NodeFragmentShaderSource;


      this._super(o);
      this.initGL();

      this.NODE_ATTRIBUTES = 9;
      this.LINK_ATTRIBUTES = 6;
    },

    initGL: function (gl) {
      if (gl) this.gl = gl;

      this.linksProgram = this.initShaders(this.linkVertexShader, this.linkFragmentShader);
      this.nodesProgram = this.initShaders(this.nodeVertexShader, this.nodeFragmentShader);

      this.gl.linkProgram(this.linksProgram);
      this.gl.linkProgram(this.nodesProgram);

      this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
      this.gl.enable(this.gl.BLEND);
    },

    initShaders: function (vertexShaderSource, fragmentShaderSource) {
      var vertexShader = this.getShaders(this.gl.VERTEX_SHADER, vertexShaderSource);
      var fragmentShader = this.getShaders(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
      var shaderProgram = this.gl.createProgram();
      this.gl.attachShader(shaderProgram, vertexShader);
      this.gl.attachShader(shaderProgram, fragmentShader);
      return shaderProgram;
    },

    getShaders: function (type, source) {
      var shader = this.gl.createShader(type);
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      return shader;
    },

    updateNodesBuffer: function () {
      var j = 0;
      this.nodes = [];
      for (var i = 0; i < this.nodeObjects.length; i++) {
        var node = this.nodeObjects[i];
        var cx = this.transformX(node.x) * this.resolution;
        var cy = this.transformY(node.y) * this.resolution;
        var r = node.r * Math.abs(this.scale * this.resolution) + 1;
        // adding few px to keep shader area big enough for antialiasing pixesls
        var shaderSize = r + 10;
        var rgba = Color.fromIntToRgba(node.color);

        this.nodes[j++] = (cx - shaderSize);
        this.nodes[j++] = (cy - shaderSize);
        this.nodes[j++] = rgba.r;
        this.nodes[j++] = rgba.g;
        this.nodes[j++] = rgba.b;
        this.nodes[j++] = rgba.a;
        this.nodes[j++] = cx;
        this.nodes[j++] = cy;
        this.nodes[j++] = r;

        this.nodes[j++] = (cx + (1 + Math.sqrt(2)) * shaderSize);
        this.nodes[j++] = cy - shaderSize;
        this.nodes[j++] = rgba.r;
        this.nodes[j++] = rgba.g;
        this.nodes[j++] = rgba.b;
        this.nodes[j++] = rgba.a ;
        this.nodes[j++] = cx;
        this.nodes[j++] = cy;
        this.nodes[j++] = r;

        this.nodes[j++] = (cx - shaderSize);
        this.nodes[j++] = (cy + (1 + Math.sqrt(2)) * shaderSize);
        this.nodes[j++] = rgba.r;
        this.nodes[j++] = rgba.g;
        this.nodes[j++] = rgba.b;
        this.nodes[j++] = rgba.a;
        this.nodes[j++] = cx;
        this.nodes[j++] = cy;
        this.nodes[j++] = r;
      }
    },

    updateLinksBuffer: function () {
      var j = 0;
      this.links = [];
      for (var i = 0; i < this.linkObjects.length; i++) {
        var link = this.linkObjects[i];
        var x1 = this.transformX(link.x1) * this.resolution;
        var y1 = this.transformY(link.y1) * this.resolution;
        var x2 = this.transformX(link.x2) * this.resolution;
        var y2 = this.transformY(link.y2) * this.resolution;
        var rgba = Color.fromIntToRgba(link.color);

        this.links[j++] = x1;
        this.links[j++] = y1;
        this.links[j++] = rgba.r;
        this.links[j++] = rgba.g;
        this.links[j++] = rgba.b;
        this.links[j++] = rgba.a;

        this.links[j++] = x2;
        this.links[j++] = y2;
        this.links[j++] = rgba.r;
        this.links[j++] = rgba.g;
        this.links[j++] = rgba.b;
        this.links[j++] = rgba.a;
      }
    },

    resize: function (width, height) {
      this._super(width, height);
      this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    },

    render: function () {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      this.resize();
      this.updateNodesBuffer();
      this.updateLinksBuffer();
      this.renderLinks(); // links have to be rendered first because of blending;
      this.renderNodes();
    },

    renderLinks: function () {
      var program = this.linksProgram;
      this.gl.useProgram(program);

      var linksBuffer = new Float32Array(this.links);
      var buffer = this.gl.createBuffer();

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, linksBuffer, this.gl.STATIC_DRAW);

      var resolutionLocation = this.gl.getUniformLocation(program, 'u_resolution');
      this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

      var positionLocation = this.gl.getAttribLocation(program, 'a_position');
      var rgbaLocation = this.gl.getAttribLocation(program, 'a_rgba');
      
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.enableVertexAttribArray(rgbaLocation);

      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, this.LINK_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 0);
      this.gl.vertexAttribPointer(rgbaLocation, 4, this.gl.FLOAT, false, this.LINK_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 8);

      var lineWidthRange = this.gl.getParameter(this.gl.ALIASED_LINE_WIDTH_RANGE), // ex [1,10] 
          lineWidth = this.lineWidth * Math.abs(this.scale * this.resolution),
          lineWidthInRange = Math.min(Math.max(lineWidth, lineWidthRange[0]), lineWidthRange[1]);

      this.gl.lineWidth(lineWidthInRange);
      this.gl.drawArrays(this.gl.LINES, 0, this.links.length/this.LINK_ATTRIBUTES);
    },

    renderNodes: function () {
      var program = this.nodesProgram;
      this.gl.useProgram(program);

      var nodesBuffer = new Float32Array(this.nodes);
      var buffer = this.gl.createBuffer();

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, nodesBuffer, this.gl.STATIC_DRAW);

      var resolutionLocation = this.gl.getUniformLocation(program, 'u_resolution');
      this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

      var positionLocation = this.gl.getAttribLocation(program, 'a_position');
      var rgbaLocation = this.gl.getAttribLocation(program, 'a_rgba');
      var centerLocation = this.gl.getAttribLocation(program, 'a_center');
      var radiusLocation = this.gl.getAttribLocation(program, 'a_radius');
      
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.enableVertexAttribArray(rgbaLocation);
      this.gl.enableVertexAttribArray(centerLocation);
      this.gl.enableVertexAttribArray(radiusLocation);

      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 0);
      this.gl.vertexAttribPointer(rgbaLocation, 4, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 8);
      this.gl.vertexAttribPointer(centerLocation, 2, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 24);
      this.gl.vertexAttribPointer(radiusLocation, 1, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 32);

      this.gl.drawArrays(this.gl.TRIANGLES, 0, this.nodes.length/this.NODE_ATTRIBUTES);
    }
  });

  if (module && module.exports) module.exports = WebGLRenderer;
})();

},{"../../helpers/color.js":5,"../renderer.js":16,"./shaders/link.frag.js":12,"./shaders/link.vert.js":13,"./shaders/node.frag.js":14,"./shaders/node.vert.js":15}],12:[function(require,module,exports){
/*jshint multistr: true */
module.exports = ' \
  precision mediump float; \
  varying vec4 rgba; \
  void main() { \
    gl_FragColor = rgba; \
  }';

},{}],13:[function(require,module,exports){
/*jshint multistr: true */
module.exports = ' \
  uniform vec2 u_resolution; \
  attribute vec2 a_position; \
  attribute vec4 a_rgba; \
  varying vec4 rgba; \
  void main() { \
    vec2 clipspace = a_position / u_resolution * 2.0 - 1.0; \
    gl_Position = vec4(clipspace * vec2(1, -1), 0, 1); \
    rgba = a_rgba / 255.0; \
  }';
},{}],14:[function(require,module,exports){
/*jshint multistr: true */
module.exports = ' \
  precision mediump float; \
  varying vec4 rgba; \
  varying vec2 center; \
  varying vec2 resolution; \
  varying float radius; \
  void main() { \
    vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0); \
    float x = gl_FragCoord.x; \
    float y = resolution[1] - gl_FragCoord.y; \
    float dx = center[0] - x; \
    float dy = center[1] - y; \
    float distance = sqrt(dx * dx + dy * dy); \
    float diff = distance - radius; \
    if ( diff < 0.0 ) \
      gl_FragColor = rgba; \
    else if ( diff >= 0.0 && diff <= 1.0 ) \
      gl_FragColor = vec4(rgba.r, rgba.g, rgba.b, rgba.a - diff); \
    else  \
      gl_FragColor = color0; \
  }';
},{}],15:[function(require,module,exports){
/*jshint multistr: true */
module.exports = ' \
  uniform vec2 u_resolution; \
  attribute vec2 a_position; \
  attribute vec4 a_rgba; \
  attribute vec2 a_center; \
  attribute float a_radius; \
  varying vec4 rgba; \
  varying vec2 center; \
  varying vec2 resolution; \
  varying float radius; \
  void main() { \
    vec2 clipspace = a_position / u_resolution * 2.0 - 1.0; \
    gl_Position = vec4(clipspace * vec2(1, -1), 0, 1); \
    rgba = a_rgba / 255.0; \
    radius = a_radius; \
    center = a_center; \
    resolution = u_resolution; \
  }';
},{}],16:[function(require,module,exports){
;(function () {

  var Renderer = function () {
    if ( !initializing && this.init )
      this.init.apply(this, arguments);
    return this;
  };

  Renderer.prototype = {
    init: function (o) {
      this.canvas = o.canvas;
      this.lineWidth = o.lineWidth || 2;
      this.resolution = o.resolution || 1;
      this.scale = o.scale;
      this.translate = o.translate;

      this.resize();
    },
    setNodes: function (nodes) { this.nodeObjects = nodes; },
    setLinks: function (links) { this.linkObjects = links; },
    setScale: function (scale) { this.scale = scale; },
    setTranslate: function (translate) { this.translate = translate; },
    transformX: function (x) { return x * this.scale + this.translate[0]; },
    transformY: function (y) { return y * this.scale + this.translate[1]; },
    untransformX: function (x) { return (x - this.translate[0]) / this.scale; },
    untransformY: function (y) { return (y - this.translate[1]) / this.scale; },
    resize: function (width, height) {
      var displayWidth  = (width || this.canvas.clientWidth) * this.resolution;
      var displayHeight = (height || this.canvas.clientHeight) * this.resolution;

      if (this.canvas.width != displayWidth) this.canvas.width  = displayWidth;
      if (this.canvas.height != displayHeight) this.canvas.height = displayHeight;
    }
  };

  var initializing = false;

  Renderer.extend = function (prop) {
    var _super = this.prototype;

    initializing = true;
    var prototype = new this();
    initializing = false;

    prototype._super = this.prototype;
    for (var name in prop) {
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && /\b_super\b/.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;
           
            // Add a new ._super() method that is the same method
            // but on the super-class
            this._super = _super[name];
           
            // The method only need to be bound temporarily, so we
            // remove it when we're done executing
            var ret = fn.apply(this, arguments);
            this._super = tmp;
           
            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }

    // The dummy class constructor
    function Renderer () {
      // All construction is actually done in the init method
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
    }
   
    // Populate our constructed prototype object
    Renderer.prototype = prototype;
   
    // Enforce the constructor to be what we expect
    Renderer.prototype.constructor = Renderer;
 
    // And make this class extendable
    Renderer.extend = arguments.callee;
   
    return Renderer;
  };

  if (module && module.exports) module.exports = Renderer;
})();

},{}],17:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}]},{},[1])(1)
});