module.exports = function (str) {
  var res;
  try {
    res = JSON.parse(str);
  } catch (e) {
    return false;
  }
  return res;
};
  