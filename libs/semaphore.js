var EventEmitter = require('events').EventEmitter,
    semaphoreQueue = new EventEmitter(),
    semaphoreLookup = {},
    DEFAULT_NAMESPACE = '_';

module.exports.enter = function (namespace, fn) {
  if (fn == null && "function" == typeof namespace) {
    fn = namespace;
    namespace = DEFAULT_NAMESPACE;
  }

  if(semaphoreLookup[namespace]) {
    return semaphoreQueue.once(namespace, this.enter.bind(this, namespace, fn));
  } else {
    semaphoreLookup[namespace] = true;
  }
  fn();
  return this;
};

module.exports.leave = function (namespace) {
  namespace = namespace || DEFAULT_NAMESPACE;
  delete semaphoreLookup[namespace];
  semaphoreQueue.emit(namespace);
};
