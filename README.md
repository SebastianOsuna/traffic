# Traffic
A node.js semaphore implementation.

# Single node semaphore

## Usage

```javascript
var traffic = require('node-traffic');

traffic.enter(function criticalZone () {
// ...
traffic.leave();  
});
```

### Example with web servers

```javascript
app.post('/resource', function (req, res) {
  traffic.enter(function () {
    // DB stuff...
    traffic.leave();
    res.respond();
  });
});
```

## Namespaced semaphores

```javascript
traffic.enter('changeResource', function criticalZone () {
  // ...
  traffic.leave('changeResource');
});
```

### Example for web servers

```javascript
app.post('/resource/:id', function (req, res) {
  traffic.enter('changeResource-' + req.params.id, function () {
    // DB stuff...
    traffic.leave('changeResource-' + req.params.id);
    res.respond();
  });
});
```

# Distributed semaphore

Traffic allows to have a distributed semaphore across multiples nodes using Zookeeper.

## Configure

```javascript
var config = {
  zkHost: 'localhost:2181', // host:port
  zkRoot: '/', // znode path
  zkTimeout: 4000 // 4 seconds
};
var traffic = require('node-traffic').distributed(config);
traffic.on('connectionTimeout', function (err) {
  // handle Zookeeper connection timeout
});
```
`zkRoot` will be created if it doesn't exists.

## Usage

```javascript
traffic.enter(function criticalZone () {
  // ...
  traffic.leave();
});

// Namespaced
traffic.enter('myNamespace', function () {
  // ...
  traffic.leave('myNamespace');
});
```
**Note:** Using namespaces creates znodes under `config.zkRoot`.

**Don't forget** to close the Zookeeper connection...

```javascript
process.on('exit',function(){
  traffic.close();
});
```

## Common patterns

If `traffic` fails to connect to Zookeeper you can fallback into normal semaphores.

```javascript
traffic.on('connectionTimeout', function (err) {
  traffic = require('node-traffic');
});
```

## Run tests

Install jasmine

```
npm install -g jasmine
```

Run specs

```
npm test
jasmine spec/semaphore_spec.js
jasmine spec/distributed_semaphore_spec.js
```
