# traffic
A node.js semaphore implementation.

## Usage

```javascript
var traffic = require('traffic');

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

## Run tests

Install jasmine

```
npm instll -g jasmine
```

Run specs

```
npm test
jasmine spec/semaphore_spec.js
```
