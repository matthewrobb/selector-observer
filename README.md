# Selector Observer


## Usage

``` javascript
var observer = new SelectorObserver(document);
observer.observe(‘form’, function() {
  this.addEventListener(‘submit’, onSubmit);
  return function() {
    this.removeEventListener(‘submit’, onSubmit);
  };
});
````


## Installation

Available on [Bower](http://bower.io) as **selector-observer**.

```
$ bower install selector-observer
```


## Browser Support

Chrome (latest), Safari (6.0+), Firefox (latest) and IE 9+.


## See Also

* [@csuwildcat](github.com/csuwildcat)'s "[I Want a DAMNodeInserted Event!](http://www.backalleycoder.com/2012/04/25/i-want-a-damnodeinserted/)" post
* [mutation-summary](https://code.google.com/p/mutation-summary/)


## License

Copyright (c) 2014 Joshua Peek

Distributed under an MIT-style license. See LICENSE for details.
