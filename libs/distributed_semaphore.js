var EventEmitter = require('events').EventEmitter;
var zk = require('node-zookeeper-client');
var DEFAULT_NAMESPACE = '_';

var ERR_TIMEOUT = 'Timeout trying to connect to Zookeeper.';
var ERR_CONNECTION = 'Couldn\'t connect to Zookeeper: ';
var ERR_ZNODE = 'Error creating root znode: ';

var Semaphore = function (config) {
  var self = this;
  self.localEvents = [];
  self.ready = false;
  self.config = config;
  self.emiter = new EventEmitter();
  self.semaphoreQueue = new EventEmitter();
  self.zkClient = zk.createClient(config.zkHost, { sessionTimeout: 10000 });

  self.tryToConnect();
};

function initRoot() {
  var self = this;

  // Create root znode
  self.zkClient.mkdirp(self.config.zkRoot, function (err) {
    if (err && err.code !== zk.Exception.NODE_EXISTS) {
      throw new Error(ERR_ZNODE + err.message);
    }
    self.ready = true;
    self.semaphoreQueue.emit('#_ready_#');
  });
}

function handleStates() {
  var self = this;
  
  self.zkClient.on('disconnected', function () {
    self.ready = false;
  });

  self.zkClient.on('connected', function () {
    initRoot.call(self);
  });
}

Semaphore.prototype.tryToConnect = function () {
  var self = this;
  var connectionTimeout = setTimeout(function () {
    if (self.config.connectionRetries > 0) {
      self.config.connectionRetries = self.config.connectionRetries - 1;
      return self.tryToConnect();
    }
    if (self.localEvents.indexOf('connectionTimeout') > -1) {
      return self.emiter.emit('connectionTimeout', new Error(ERR_TIMEOUT));
    }
    throw new Error(ERR_TIMEOUT);
  }, self.config.timeout);

  // Wait for connection
  self.zkClient.once('connected', function (err) {
    if (err) {
      throw new Error(ERR_CONNECTION + err.message);
    }

    // Clear timeout
    clearTimeout(connectionTimeout);
    initRoot.call(self);
    handleStates.call(self);
  });
  self.zkClient.connect();
};

Semaphore.prototype.on = function (event, fn) {
  this.localEvents.push(event);
  this.emiter.on(event, fn);
};

Semaphore.prototype.enter = function (_namespace, _fn) {
  var self = this;
  var fn = _fn;
  var namespace = _namespace;

  // Handle default parameters
  if (!fn && typeof namespace === 'function') {
    fn = namespace;
    namespace = DEFAULT_NAMESPACE;
  }

  // If trying to enter the critical zone before the zookeeper connection is
  // acquired, the `enter` call is queued until the connection is done
  if (!self.ready) {
    return self.semaphoreQueue.once('#_ready_#', self.enter.bind(self, namespace, fn));
  }

  // Try to acquire the lock of the namespace.
  // Created znode is ephemeral in case connection is lost while in the critical zone.
  self.zkClient.create(
    self.config.zkRoot + '/' + namespace,
    zk.CreateMode.EPHEMERAL,
    function (err) {
      if (!err) {
        return fn();
      } else if (err.code === zk.Exception.NODE_EXISTS) {
        return self.semaphoreQueue.once(namespace, self.enter.bind(self, namespace, fn));
      }

      throw new Error('Error locking ' + namespace + ': ' + err.message);
    }
  );

  return self;
};

Semaphore.prototype.leave = function (_namespace) {
  var namespace = _namespace || DEFAULT_NAMESPACE;
  var self = this;

  self.zkClient.remove(self.config.zkRoot + '/' + namespace, function (err) {
    if (err && err.code !== zk.Exception.NO_NODE) {
      throw new Error('Error releasing lock ' + namespace + ': ' + err.message);
    }

    self.semaphoreQueue.emit(namespace);
  });
};

Semaphore.prototype.close = function () {
  this.zkClient.close();
};

Semaphore.prototype.currentStatus = function () {
  return this.zkClient.getState();
};

Semaphore.prototype.mode = 'distributed';

module.exports = function (_config) {
  var config = _config || {};
  config.zkHost = config.zkHost || 'localhost:2181';
  config.zkRoot = config.zkRoot || '';
  config.timeout = config.timeout || 4000;
  return new Semaphore(config);
};
