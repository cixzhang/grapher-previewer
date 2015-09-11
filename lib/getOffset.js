module.exports = function (e) {
  if (e.offsetX) return {x: e.offsetX, y: e.offsetY};
  var rect = e.target.getBoundingClientRect();
  var x = e.clientX - rect.left,
      y = e.clientY - rect.top;
  return {x: x, y: y};
};
