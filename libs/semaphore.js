var EventEmitter = require('events').EventEmitter;
var semaphoreQueue = new EventEmitter();
var semaphoreLookup = {};
var DEFAULT_NAMESPACE = '_';

module.exports.enter = function (_namespace, _fn) {
  var namespace = _namespace;
  var fn = _fn;

  if (!fn && typeof namespace === 'function') {
    fn = namespace;
    namespace = DEFAULT_NAMESPACE;
  }

  if (semaphoreLookup[namespace]) {
    return semaphoreQueue.once(namespace, this.enter.bind(this, namespace, fn));
  }

  semaphoreLookup[namespace] = true;
  fn();
  return this;
};

module.exports.leave = function (_namespace) {
  var namespace = _namespace || DEFAULT_NAMESPACE;
  delete semaphoreLookup[namespace];
  semaphoreQueue.emit(namespace);
};

module.exports.currentStatus = function () {
  return 'OK';
};

module.exports.mode = 'local';
