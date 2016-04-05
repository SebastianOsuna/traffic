var EventEmitter = require('events').EventEmitter;
var zk = require('node-zookeeper-client');
var DEFAULT_NAMESPACE = '_';

var Semaphore = function (config) {
  var self = this;
  // Semaphore configuration
  self.config = config;

  self._events = [];
  self.emiter = new EventEmitter();
  self.semaphoreQueue = new EventEmitter();
  self._ready = false;
  var client = self.zkClient = zk.createClient(config.zkHost);
  self.tryToConnect();
};

Semaphore.prototype.tryToConnect = function () {
  var self = this;
  var connectionTimeout = setTimeout(function () {
    if (self.config.connectionRetries > 0) {
      self.config.connectionRetries = self.config.connectionRetries - 1;
      return self.tryToConnect();
    }
    if (self._events.indexOf('error') > -1) {
      self.emiter.emit('connectionTimeout', new Error('Timeout trying to connect to Zookeeper.'));
    } else {
      throw "Timeout trying to connect to Zookeeper.";
    }
  }, self.config.timeout);
  self.zkClient.once('connected', function (err) {
    if (err) {
      throw "Couldn't connect to Zookeeper: " + err.message;
    }
    clearTimeout(connectionTimeout);
    self.zkClient.mkdirp(self.config.zkRoot, function (err) {
        if (err && err.code != zk.Exception.NODE_EXISTS) {
          throw "Error creating root znode: " + err.message;
        }
        self._ready = true;
        self.semaphoreQueue.emit('#_ready_#');
    });
  });
  self.zkClient.connect();
};

Semaphore.prototype.on = function (event, fn) {
  this._events.push(event);
  this.emiter.on(event, fn);
};

Semaphore.prototype.enter = function (namespace, fn) {
  if (fn == null && "function" == typeof namespace) {
    fn = namespace;
    namespace = DEFAULT_NAMESPACE;
  }
  var self = this;
  if (!self._ready) {
    return self.semaphoreQueue.once('#_ready_#', self.enter.bind(self, namespace, fn));
  }

  self.zkClient.create(self.config.zkRoot + '/' + namespace, function (err) {
    if (err && err.code == zk.Exception.NODE_EXISTS) {
      return self.semaphoreQueue.once(namespace, self.enter.bind(self, namespace, fn));
    } else if (err) {
      throw 'Error locking ' + namespace + ': ' + err.message;
    }
    fn();
  });
  return self;
};

Semaphore.prototype.leave = function (namespace) {
  namespace = namespace || DEFAULT_NAMESPACE;
  var self = this;

  self.zkClient.remove(self.config.zkRoot + '/' + namespace, function (err) {
    if (err && err.code != -101) {

      throw 'Error releasing lock ' + namespace + ': ' + err.message;
    }
    self.semaphoreQueue.emit(namespace);
  });
};

Semaphore.prototype.close = function () {
  this.zkClient.close();
};

module.exports = function (config) {
  config = config || {};
  config.zkHost = config.zkHost || 'localhost:2181';
  config.zkRoot = config.zkRoot || '';
  config.timeout = config.timeout || 4000;
  config.connectionRetries = config.connectionRetries || 0;
  return new Semaphore(config);
};
