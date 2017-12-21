(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('selector-set')) :
	typeof define === 'function' && define.amd ? define(['exports', 'selector-set'], factory) :
	(factory((global.SelectorObserver = {}),global.SelectorSet));
}(this, (function (exports,SelectorSet) { 'use strict';

SelectorSet = SelectorSet && SelectorSet.hasOwnProperty('default') ? SelectorSet['default'] : SelectorSet;

var innerHTMLReplacementIsBuggy = null;

// In IE 9/10/11 replacing child via innerHTML will orphan all of the child
// elements. This prevents walking the descendants of removedNodes.
// https://connect.microsoft.com/IE/feedback/details/797844/ie9-10-11-dom-child-kill-bug
function detectInnerHTMLReplacementBuggy(document) {
  if (innerHTMLReplacementIsBuggy === null) {
    var a = document.createElement('div');
    var b = document.createElement('div');
    var c = document.createElement('div');
    a.appendChild(b);
    b.appendChild(c);
    a.innerHTML = '';
    innerHTMLReplacementIsBuggy = c.parentNode !== b;
  }
  return innerHTMLReplacementIsBuggy;
}

var el = null;
var observer = null;
var queue = [];

function scheduleMacroTask(document, callback) {
  if (!observer) {
    observer = new MutationObserver(handleMutations);
  }

  if (!el) {
    el = document.createElement('div');
    observer.observe(el, { attributes: true });
  }

  queue.push(callback);
  el.setAttribute('data-twiddle', '' + Date.now());
}

function handleMutations() {
  var callbacks = queue;
  queue = [];
  for (var i = 0; i < callbacks.length; i++) {
    try {
      callbacks[i]();
    } catch (error) {
      setTimeout(function () {
        throw error;
      }, 0);
    }
  }
}

function whenReady(document, callback) {
  var readyState = document.readyState;
  if (readyState === 'interactive' || readyState === 'complete') {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

// observe
//
// Observe provides a declarative hook thats informed when an element becomes
// matched by a selector, and then when it stops matching the selector.
//
// Examples
//
//   observe('.js-foo', (el) => {
//     console.log(el, 'was added to the DOM')
//   })
//
//   observe('.js-bar', {
//     add(el) { console.log('js-bar was added to', el) },
//     remove(el) { console.log 'js-bar was removed from', el) }
//   })
//

// Observer uid counter
var uid = 0;

// Map of observer id to object
var documentObservers = [];

// Index of selectors to observer objects
var selectorSet = new SelectorSet();
var initMap = new WeakMap();
var addMap = new WeakMap();
var initializerMap = new WeakMap();

// Run observer node "initialize" callback once.
// Call when observer selector matches node.
//
// el       - An Element
// observer - An observer Object.
//
// Returns nothing.
function runInit(el, observer) {
  var initIds = initMap.get(el);
  if (!initIds) {
    initIds = [];
    initMap.set(el, initIds);
  }

  if (initIds.indexOf(observer.id) === -1) {
    var initializer = void 0;
    if (observer.initialize) {
      initializer = observer.initialize.call(undefined, el);
    }
    if (initializer) {
      var initializers = initializerMap.get(el);
      if (!initializers) {
        initializers = {};
        initializerMap.set(el, initializers);
      }
      initializers['' + observer.id] = initializer;
    }
    initIds.push(observer.id);
  }
}

// Run observer node "add" callback.
// Call when observer selector matches node.
//
// el       - An Element
// observer - An observer Object.
//
// Returns nothing.
function runAdd(el, observer) {
  var addIds = addMap.get(el);
  if (!addIds) {
    addIds = [];
    addMap.set(el, addIds);
  }
  if (addIds.indexOf(observer.id) === -1) {
    observer.elements.push(el);
    var initializers = initializerMap.get(el);
    var initializer = initializers ? initializers['' + observer.id] : null;
    if (initializer) {
      if (initializer.add) {
        initializer.add.call(undefined, el);
      }
    }
    if (observer.add) {
      observer.add.call(undefined, el);
    }
    addIds.push(observer.id);
  }
}

// Runs all observer element "remove" callbacks.
// Call when element is completely removed from the DOM.
//
// el       - An Element
// observer - Optional observer to check
//
// Returns nothing.
function runRemove(el, observer) {
  var addIds = addMap.get(el);
  if (!addIds) {
    return;
  }

  if (observer && el instanceof observer.klass) {
    var index = observer.elements.indexOf(el);
    if (index !== -1) {
      observer.elements.splice(index, 1);
    }
    index = addIds.indexOf(observer.id);
    if (index !== -1) {
      var initializers = initializerMap.get(el);
      var initializer = initializers ? initializers['' + observer.id] : null;
      if (initializer) {
        if (initializer.remove) {
          initializer.remove.call(undefined, el);
        }
      }
      if (observer.remove) {
        observer.remove.call(undefined, el);
      }
      addIds.splice(index, 1);
    }
    if (addIds.length === 0) {
      addMap.delete(el);
    }
  } else {
    var ids = addIds.slice(0);
    for (var i = 0; i < ids.length; i++) {
      observer = documentObservers[ids[i]];
      if (!observer) {
        continue;
      }
      var _index = observer.elements.indexOf(el);
      if (_index !== -1) {
        observer.elements.splice(_index, 1);
      }
      var _initializers = initializerMap.get(el);
      var _initializer = _initializers ? _initializers['' + observer.id] : null;
      if (_initializer) {
        if (_initializer.remove) {
          _initializer.remove.call(undefined, el);
        }
      }
      if (observer.remove) {
        observer.remove.call(undefined, el);
      }
    }
    addMap.delete(el);
  }
}

// Run observer node "add" callback once on the any matching
// node and its subtree.
//
// changes - Array of changes to append to
// nodes   - A NodeList of Nodes
//
// Returns Array of changes
function addNodes(changes, nodes) {
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (!(el instanceof Element)) {
      continue;
    }

    var matches = selectorSet.matches(el);
    for (var j = 0; j < matches.length; j++) {
      var data = matches[j].data;

      changes.push(['add', el, data]);
    }

    var matches2 = selectorSet.queryAll(el);
    for (var _j = 0; _j < matches2.length; _j++) {
      var _matches2$_j = matches2[_j],
          _data = _matches2$_j.data,
          elements = _matches2$_j.elements;

      for (var k = 0; k < elements.length; k++) {
        changes.push(['add', elements[k], _data]);
      }
    }
  }
}

// Run all observer node "remove" callbacks on the node
// and its entire subtree.
//
// changes - Array of changes to append to
// nodes   - A NodeList of Nodes
//
// Returns Array of changes
function removeNodes(changes, nodes) {
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (!(el instanceof Element)) {
      continue;
    }

    changes.push(['remove', el, null]);
    var descendants = el.getElementsByTagName('*');
    for (var j = 0; j < descendants.length; j++) {
      changes.push(['remove', descendants[j], null]);
    }
  }
}

// Check all observed elements to see if they are still in the DOM.
// Only intended to run on IE where innerHTML replacement is buggy.
//
// changes - Array of changes to append to
//
// Returns nothing.
function revalidateOrphanedElements(changes) {
  for (var i = 0; i < documentObservers.length; i++) {
    var observer = documentObservers[i];
    if (observer) {
      var elements = observer.elements;

      for (var j = 0; j < elements.length; j++) {
        var el = elements[j];
        if (!el.parentNode) {
          changes.push(['remove', el, null]);
        }
      }
    }
  }
}

// Recheck all "add" observers to see if the selector still matches.
// If not, run the "remove" callback.
//
// changes - Array of changes to append to
// node    - A Node
//
// Returns nothing.
function revalidateObservers(changes, node) {
  if (!(node instanceof Element)) {
    return;
  }

  var matches = selectorSet.matches(node);
  for (var i = 0; i < matches.length; i++) {
    var data = matches[i].data;

    changes.push(['add', node, data]);
  }

  var ids = addMap.get(node);
  if (ids) {
    for (var _i = 0; _i < ids.length; _i++) {
      var observer = documentObservers[ids[_i]];
      if (observer) {
        if (!selectorSet.matchesSelector(node, observer.selector)) {
          changes.push(['remove', node, observer]);
        }
      }
    }
  }
}

// Recheck all "add" observers to see if the selector still matches.
// If not, run the "remove" callback. Runs on node and all its descendants.
//
// changes - Array of changes to append to
// node    - The root Node
//
// Returns nothing.
function revalidateDescendantObservers(changes, node) {
  if (!(node instanceof Element)) {
    return;
  }

  revalidateObservers(changes, node);
  var descendants = node.getElementsByTagName('*');
  for (var i = 0; i < descendants.length; i++) {
    revalidateObservers(changes, descendants[i]);
  }
}

function applyChanges(changes) {
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var type = change[0];
    var el = change[1];
    var observer = change[2];
    if (type === 'add' && observer && el instanceof observer.klass) {
      runInit(el, observer);
      runAdd(el, observer);
    } else if (type === 'remove') {
      runRemove(el, observer);
    }
  }
}

// Removes observer and calls any remaining remove hooks.
//
// observer - Observer object
//
// Returns nothing.
function stopObserving(observer) {
  var elements = observer.elements;
  for (var i = 0; i < elements.length; i++) {
    runRemove(elements[i], observer);
  }
  selectorSet.remove(observer.selector, observer);
  delete documentObservers[observer.id];
  observerCount--;
}

// Register a new observer.
//
// selector - String CSS selector.
// handlers - Initialize Function or Object with keys:
//   initialize - Function to invoke once when Node is first matched
//   add        - Function to invoke when Node matches selector
//   remove     - Function to invoke when Node no longer matches selector
//
// Returns Observer object.
function observe(a, b) {
  var handlers = void 0;

  if (typeof b === 'function') {
    handlers = {
      selector: a,
      initialize: b
    };
  } else if ((typeof b === 'undefined' ? 'undefined' : _typeof(b)) === 'object') {
    handlers = b;
    handlers.selector = a;
  } else {
    handlers = a;
  }

  var observer = {
    id: uid++,
    selector: handlers.selector,
    initialize: handlers.initialize,
    add: handlers.add,
    remove: handlers.remove,
    elements: [],
    klass: handlers.constructor || Element,
    stop: function stop() {
      stopObserving(observer);
    }
  };
  selectorSet.add(observer.selector, observer);
  documentObservers[observer.id] = observer;
  scheduleAddDocumentNodes();
  observerCount++;
  return observer;
}

var addDocumentNodesScheduled = false;
function scheduleAddDocumentNodes() {
  if (addDocumentNodesScheduled) {
    return;
  }
  scheduleMacroTask(document, addDocumentNodes);
  addDocumentNodesScheduled = true;
}

function addDocumentNodes() {
  var changes = [];
  var nodes = [document.documentElement];
  addNodes(changes, nodes);
  applyChanges(changes);
  addDocumentNodesScheduled = false;
}

// Internal: Track number of observers for debugging.
var observerCount = 0;

function getObserverCount() {
  return observerCount;
}

// Internal: For hacking in dirty changes that aren't getting picked up
function triggerObservers(container) {
  var changes = [];
  revalidateDescendantObservers(changes, container);
  applyChanges(changes);
}

var changedTargets = [];

function handleAsyncChangeEvents() {
  var changes = [];
  var targets = changedTargets;
  changedTargets = [];
  for (var i = 0; i < targets.length; i++) {
    var target = targets[i];
    var els = target.form ? target.form.elements : target.ownerDocument.getElementsByTagName('input');
    for (var j = 0; j < els.length; j++) {
      revalidateObservers(changes, els[j]);
    }
  }
  applyChanges(changes);
}

function handleChangeEvent(event) {
  changedTargets.push(event.target);
  scheduleMacroTask(document, handleAsyncChangeEvents);
}
document.addEventListener('change', handleChangeEvent, false);

function handleDocumentMutations(mutations) {
  var changes = [];
  for (var i = 0; i < mutations.length; i++) {
    var mutation = mutations[i];
    if (mutation.type === 'childList') {
      addNodes(changes, mutation.addedNodes);
      removeNodes(changes, mutation.removedNodes);
    } else if (mutation.type === 'attributes') {
      revalidateObservers(changes, mutation.target);
    }
  }
  if (detectInnerHTMLReplacementBuggy(document)) {
    revalidateOrphanedElements(changes);
  }
  applyChanges(changes);
}

var documentObserver = new MutationObserver(handleDocumentMutations);

whenReady(document, function () {
  scheduleMacroTask(document, function () {
    documentObserver.observe(document, {
      childList: true,
      attributes: true,
      subtree: true
    });
    var changes = [];
    var nodes = [document.documentElement];
    addNodes(changes, nodes);
    applyChanges(changes);
  });
});

exports.observe = observe;
exports.getObserverCount = getObserverCount;
exports.triggerObservers = triggerObservers;

Object.defineProperty(exports, '__esModule', { value: true });

})));
