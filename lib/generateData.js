module.exports = function () {
  var network = {nodes: [], links: []},
        width = 500,
        height = 500,
        numNodes = 10,
        numLinks = 30,
        i;

  for (i = 0; i < numNodes; i++) {
    network.nodes.push({
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height)
    });
  }

  for (i = 0; i < numLinks; i++) {
    network.links.push({
      from: Math.floor(Math.random() * numNodes),
      to: Math.floor(Math.random() * numNodes),
    });
  }
  return network;
};
