var config = {
  zkHost: 'localhost:2181',
  zkRoot: '/my/distributed/semaphore'
};
var semaphore = require('../libs/distributed_semaphore')(config);

process.on('exit',function(){
  semaphore.close();
});

/*
This test illustrates a case where the is shared resource that is accesed asynchronously.
Without a semaphore, the resouce is exposed to corruption, since asynchronous
access can have random times, the state of the resouce when READ might be
different than it's state when WRITING.
*/
describe("Use case without semaphore", function () {

  // Subject of the test
  // This function will change the values of the resource.
  // It simulates asynchronous behavior
  var subject = function (resource, newValue, callback) {
    setTimeout(function () {
      if (resource.value != 10) {
        resource.value = newValue;
      }

      callback(resource);
    }, newValue); // This simulates a random wait time
  };

  it("should fail to protect the shared resource", function (done) {
    semaphore.on('error', function (err) {
      done.fail(err);
    });
    var resource = { value: 4 },
        end = function (firstValue) {
          expect(firstValue).toBe(1); // This is where the resource wasn't protected
          return function (secondValue) {
            expect(secondValue).toBe(10);
            done();
          };
        };


    // This is called first
    // This should set the value = 2 and thus not allowing further changes
    // in the resources values
    subject(resource, 10, function (result) {
      end = end(result.value);
    });

    // This is called later but will finish first, but since the previuos
    // call changed the value to 2, the resources value shouldnt change.
    subject(resource, 1, function (result) {
      end = end(result.value);
    });

  });
});


/*
This test illustrates a case where the is shared resource that is accesed asynchronously.
A semephore is used to protect the resource from dirty WRITES.
*/
describe("Use case with semaphore", function () {

  // Subject of the test
  // This function will change the values of the resource.
  // It simulates asynchronous behavior protected by a semaphore
  var subject = function (resource, newValue, callback) {
    semaphore.enter(function () {
      setTimeout(function () {
        if (resource.value != 10) {
          resource.value = newValue;
        }

        semaphore.leave();
        callback(resource);
      }, newValue); // This simulates a random wait time
    });
  };

  it("should protect the shared resource", function (done) {
    semaphore.on('error', function (err) {
      done.fail(err);
    });
    var resource = { value: 4 },
        end = function (firstValue) {
          expect(firstValue).toBe(10);
          return function (secondValue) {
            expect(secondValue).toBe(10);
            done();
          };
        };

    subject(resource, 10, function (result) {
      end = end(result.value);
    });

    subject(resource, 1, function (result) {
      end = end(result.value);
    });

  });
});

describe("Namespaced semaphores", function () {
  var subject = function (resource, newValue, callback) {
    semaphore.enter(resource.name, function () {
      setTimeout(function () {
        if (resource.value != 10) {
          resource.value = newValue;
        }

        semaphore.leave(resource.name);
        callback(resource);
      }, newValue);
    });
  };

  it("should work independently", function (done) {

    semaphore.on('error', function (err) {
      done.fail(err);
    });

    var resource1 = { value: 4, name: 'resource1' },
        resource2 = { value: 99, name: 'resource2' },
        end = function (firstValue) {
          expect(firstValue).toBe(4);
          return function (secondValue) {
            expect(secondValue).toBe(10);
            return function (thirdValue) {
              expect(thirdValue).toBe(10);
              return function (fourthValue) {
                expect(fourthValue).toBe(13);
                done();
              }
            };
          };
        };

    subject(resource1, 10, function (result) {
      end = end(result.value);
    });

    // first call on resource1 has value 10, so this should not change the value.
    // it will wait on the first call, thus finishing in 15ms ()
    subject(resource1, 5, function (result) {
      end = end(result.value);
    });

    subject(resource2, 4, function (result) {
      end = end(result.value);
    });

    // Shares namespace with the second call thus, should finish in 17ms (last)
    subject(resource2, 13, function (result) {
      end = end(result.value);
    });



  });
});
