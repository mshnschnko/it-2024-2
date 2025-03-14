'use strict';

function createElement(query, ns) {
  const {
    tag,
    id,
    className
  } = parse(query);
  const element = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  if (id) {
    element.id = id;
  }
  if (className) {
    {
      element.className = className;
    }
  }
  return element;
}
function parse(query) {
  const chunks = query.split(/([.#])/);
  let className = "";
  let id = "";
  for (let i = 1; i < chunks.length; i += 2) {
    switch (chunks[i]) {
      case ".":
        className += ` ${chunks[i + 1]}`;
        break;
      case "#":
        id = chunks[i + 1];
    }
  }
  return {
    className: className.trim(),
    tag: chunks[0] || "div",
    id
  };
}
function html(query, ...args) {
  let element;
  const type = typeof query;
  if (type === "string") {
    element = createElement(query);
  } else if (type === "function") {
    const Query = query;
    element = new Query(...args);
  } else {
    throw new Error("At least one argument required");
  }
  parseArgumentsInternal(getEl(element), args);
  return element;
}
const el = html;
html.extend = function extendHtml(...args) {
  return html.bind(this, ...args);
};
function doUnmount(child, childEl, parentEl) {
  const hooks = childEl.__redom_lifecycle;
  if (hooksAreEmpty(hooks)) {
    childEl.__redom_lifecycle = {};
    return;
  }
  let traverse = parentEl;
  if (childEl.__redom_mounted) {
    trigger(childEl, "onunmount");
  }
  while (traverse) {
    const parentHooks = traverse.__redom_lifecycle || {};
    for (const hook in hooks) {
      if (parentHooks[hook]) {
        parentHooks[hook] -= hooks[hook];
      }
    }
    if (hooksAreEmpty(parentHooks)) {
      traverse.__redom_lifecycle = null;
    }
    traverse = traverse.parentNode;
  }
}
function hooksAreEmpty(hooks) {
  if (hooks == null) {
    return true;
  }
  for (const key in hooks) {
    if (hooks[key]) {
      return false;
    }
  }
  return true;
}

/* global Node, ShadowRoot */

const hookNames = ["onmount", "onremount", "onunmount"];
const shadowRootAvailable = typeof window !== "undefined" && "ShadowRoot" in window;
function mount(parent, _child, before, replace) {
  let child = _child;
  const parentEl = getEl(parent);
  const childEl = getEl(child);
  if (child === childEl && childEl.__redom_view) {
    // try to look up the view if not provided
    child = childEl.__redom_view;
  }
  if (child !== childEl) {
    childEl.__redom_view = child;
  }
  const wasMounted = childEl.__redom_mounted;
  const oldParent = childEl.parentNode;
  if (wasMounted && oldParent !== parentEl) {
    doUnmount(child, childEl, oldParent);
  }
  {
    parentEl.appendChild(childEl);
  }
  doMount(child, childEl, parentEl, oldParent);
  return child;
}
function trigger(el, eventName) {
  if (eventName === "onmount" || eventName === "onremount") {
    el.__redom_mounted = true;
  } else if (eventName === "onunmount") {
    el.__redom_mounted = false;
  }
  const hooks = el.__redom_lifecycle;
  if (!hooks) {
    return;
  }
  const view = el.__redom_view;
  let hookCount = 0;
  view?.[eventName]?.();
  for (const hook in hooks) {
    if (hook) {
      hookCount++;
    }
  }
  if (hookCount) {
    let traverse = el.firstChild;
    while (traverse) {
      const next = traverse.nextSibling;
      trigger(traverse, eventName);
      traverse = next;
    }
  }
}
function doMount(child, childEl, parentEl, oldParent) {
  if (!childEl.__redom_lifecycle) {
    childEl.__redom_lifecycle = {};
  }
  const hooks = childEl.__redom_lifecycle;
  const remount = parentEl === oldParent;
  let hooksFound = false;
  for (const hookName of hookNames) {
    if (!remount) {
      // if already mounted, skip this phase
      if (child !== childEl) {
        // only Views can have lifecycle events
        if (hookName in child) {
          hooks[hookName] = (hooks[hookName] || 0) + 1;
        }
      }
    }
    if (hooks[hookName]) {
      hooksFound = true;
    }
  }
  if (!hooksFound) {
    childEl.__redom_lifecycle = {};
    return;
  }
  let traverse = parentEl;
  let triggered = false;
  if (remount || traverse?.__redom_mounted) {
    trigger(childEl, remount ? "onremount" : "onmount");
    triggered = true;
  }
  while (traverse) {
    const parent = traverse.parentNode;
    if (!traverse.__redom_lifecycle) {
      traverse.__redom_lifecycle = {};
    }
    const parentHooks = traverse.__redom_lifecycle;
    for (const hook in hooks) {
      parentHooks[hook] = (parentHooks[hook] || 0) + hooks[hook];
    }
    if (triggered) {
      break;
    }
    if (traverse.nodeType === Node.DOCUMENT_NODE || shadowRootAvailable && traverse instanceof ShadowRoot || parent?.__redom_mounted) {
      trigger(traverse, remount ? "onremount" : "onmount");
      triggered = true;
    }
    traverse = parent;
  }
}
function setStyle(view, arg1, arg2) {
  const el = getEl(view);
  if (typeof arg1 === "object") {
    for (const key in arg1) {
      setStyleValue(el, key, arg1[key]);
    }
  } else {
    setStyleValue(el, arg1, arg2);
  }
}
function setStyleValue(el, key, value) {
  el.style[key] = value == null ? "" : value;
}

/* global SVGElement */

const xlinkns = "http://www.w3.org/1999/xlink";
function setAttrInternal(view, arg1, arg2, initial) {
  const el = getEl(view);
  const isObj = typeof arg1 === "object";
  if (isObj) {
    for (const key in arg1) {
      setAttrInternal(el, key, arg1[key]);
    }
  } else {
    const isSVG = el instanceof SVGElement;
    const isFunc = typeof arg2 === "function";
    if (arg1 === "style" && typeof arg2 === "object") {
      setStyle(el, arg2);
    } else if (isSVG && isFunc) {
      el[arg1] = arg2;
    } else if (arg1 === "dataset") {
      setData(el, arg2);
    } else if (!isSVG && (arg1 in el || isFunc) && arg1 !== "list") {
      el[arg1] = arg2;
    } else {
      if (isSVG && arg1 === "xlink") {
        setXlink(el, arg2);
        return;
      }
      if (arg1 === "class") {
        setClassName(el, arg2);
        return;
      }
      if (arg2 == null) {
        el.removeAttribute(arg1);
      } else {
        el.setAttribute(arg1, arg2);
      }
    }
  }
}
function setClassName(el, additionToClassName) {
  if (additionToClassName == null) {
    el.removeAttribute("class");
  } else if (el.classList) {
    el.classList.add(additionToClassName);
  } else if (typeof el.className === "object" && el.className && el.className.baseVal) {
    el.className.baseVal = `${el.className.baseVal} ${additionToClassName}`.trim();
  } else {
    el.className = `${el.className} ${additionToClassName}`.trim();
  }
}
function setXlink(el, arg1, arg2) {
  if (typeof arg1 === "object") {
    for (const key in arg1) {
      setXlink(el, key, arg1[key]);
    }
  } else {
    if (arg2 != null) {
      el.setAttributeNS(xlinkns, arg1, arg2);
    } else {
      el.removeAttributeNS(xlinkns, arg1, arg2);
    }
  }
}
function setData(el, arg1, arg2) {
  if (typeof arg1 === "object") {
    for (const key in arg1) {
      setData(el, key, arg1[key]);
    }
  } else {
    if (arg2 != null) {
      el.dataset[arg1] = arg2;
    } else {
      delete el.dataset[arg1];
    }
  }
}
function text(str) {
  return document.createTextNode(str != null ? str : "");
}
function parseArgumentsInternal(element, args, initial) {
  for (const arg of args) {
    if (arg !== 0 && !arg) {
      continue;
    }
    const type = typeof arg;
    if (type === "function") {
      arg(element);
    } else if (type === "string" || type === "number") {
      element.appendChild(text(arg));
    } else if (isNode(getEl(arg))) {
      mount(element, arg);
    } else if (arg.length) {
      parseArgumentsInternal(element, arg);
    } else if (type === "object") {
      setAttrInternal(element, arg, null);
    }
  }
}
function getEl(parent) {
  return parent.nodeType && parent || !parent.el && parent || getEl(parent.el);
}
function isNode(arg) {
  return arg?.nodeType;
}

function _classCallCheck(a, n) {
  if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties(e, r) {
  for (var t = 0; t < r.length; t++) {
    var o = r[t];
    o.enumerable = o.enumerable || false, o.configurable = true, "value" in o && (o.writable = true), Object.defineProperty(e, _toPropertyKey(o.key), o);
  }
}
function _createClass(e, r, t) {
  return r && _defineProperties(e.prototype, r), Object.defineProperty(e, "prototype", {
    writable: false
  }), e;
}
function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r);
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}

var Input = /*#__PURE__*/_createClass(function Input() {
  var _this = this;
  var settings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  _classCallCheck(this, Input);
  _defineProperty(this, "_ui_render", function () {
    var label = _this._prop.label;
    return el("div", null, el("label", {
      className: "form-label"
    }, label, el("input", {
      type: "text",
      className: "form-control"
    })));
  });
  var _label = settings.label;
  this._prop = {
    label: _label
  };
  this.el = this._ui_render();
});

var LoginAndPasswordForm = /*#__PURE__*/_createClass(function LoginAndPasswordForm() {
  _classCallCheck(this, LoginAndPasswordForm);
  _defineProperty(this, "_ui_render", function () {
    return el("div", {
      className: 'd-flex flex-column'
    }, new Input({
      label: 'Логин'
    }), new Input({
      label: 'Пароль'
    }));
  });
  this.el = this._ui_render();
});

var Button = /*#__PURE__*/_createClass(function Button() {
  var _this = this;
  var settings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  _classCallCheck(this, Button);
  _defineProperty(this, "_ui_render", function () {
    var _this$_prop = _this._prop,
      label = _this$_prop.label,
      className = _this$_prop.className;
    return el("div", null, el("button", {
      className: "btn ".concat(className).trim()
    }, label));
  });
  var _label = settings.label,
    _settings$className = settings.className,
    _className = _settings$className === void 0 ? '' : _settings$className;
  this._prop = {
    label: _label,
    className: _className
  };
  this.el = this._ui_render();
});

var LinkButton = /*#__PURE__*/function () {
  function LinkButton() {
    _classCallCheck(this, LinkButton);
    this.el = el('a.link-button');
    this._children = [];
  }
  return _createClass(LinkButton, [{
    key: "update",
    value: function update(_ref, children) {
      var _this = this;
      var href = _ref.href,
        className = _ref.className;
      this.el.href = href || '#';
      this.el.className = "link-button ".concat(className || '').trim();

      // Очищаем предыдущие children
      this.el.innerHTML = '';

      // Добавляем новые children
      this._children = children.map(function (child) {
        if (typeof child === 'string') {
          return text(child);
        }
        return child;
      });
      this._children.forEach(function (child) {
        return _this.el.appendChild(child);
      });
      return this.el;
    }
  }]);
}();
var linkButton = function linkButton(props) {
  var component = new LinkButton();
  for (var _len = arguments.length, children = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    children[_key - 1] = arguments[_key];
  }
  return component.update(props, children.flat());
};

var LoginForm = /*#__PURE__*/_createClass(function LoginForm() {
  _classCallCheck(this, LoginForm);
  _defineProperty(this, "_ui_render", function () {
    return el("div", {
      className: 'd-flex flex-column'
    }, new LoginAndPasswordForm({}), new Button({
      label: 'Войти',
      className: 'btn-primary'
    }), new linkButton({
      href: '/register'
    }, text('Зарегистрироваться')));
  });
  this.el = this._ui_render();
});

// login.js
mount(document.getElementById("main"), new LoginForm({}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9naW4uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2NsaWVudC9ub2RlX21vZHVsZXMvcmVkb20vZGlzdC9yZWRvbS5lcy5qcyIsIi4uLy4uLy4uL2NsaWVudC9zcmMvYXRvbS9pbnB1dC5qcyIsIi4uLy4uLy4uL2NsaWVudC9zcmMvd2lkZ2V0L0xvZ2luQW5kUGFzc3dvcmRGb3JtLmpzIiwiLi4vLi4vLi4vY2xpZW50L3NyYy9hdG9tL2J1dHRvbi5qcyIsIi4uLy4uLy4uL2NsaWVudC9zcmMvYXRvbS9saW5rLmpzIiwiLi4vLi4vLi4vY2xpZW50L3NyYy93aWRnZXQvTG9naW5Gb3JtLmpzIiwiLi4vLi4vLi4vY2xpZW50L3NyYy9sb2dpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHF1ZXJ5LCBucykge1xuICBjb25zdCB7IHRhZywgaWQsIGNsYXNzTmFtZSB9ID0gcGFyc2UocXVlcnkpO1xuICBjb25zdCBlbGVtZW50ID0gbnNcbiAgICA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhucywgdGFnKVxuICAgIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXG4gIGlmIChpZCkge1xuICAgIGVsZW1lbnQuaWQgPSBpZDtcbiAgfVxuXG4gIGlmIChjbGFzc05hbWUpIHtcbiAgICBpZiAobnMpIHtcbiAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiY2xhc3NcIiwgY2xhc3NOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWxlbWVudC5jbGFzc05hbWUgPSBjbGFzc05hbWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIHBhcnNlKHF1ZXJ5KSB7XG4gIGNvbnN0IGNodW5rcyA9IHF1ZXJ5LnNwbGl0KC8oWy4jXSkvKTtcbiAgbGV0IGNsYXNzTmFtZSA9IFwiXCI7XG4gIGxldCBpZCA9IFwiXCI7XG5cbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBjaHVua3MubGVuZ3RoOyBpICs9IDIpIHtcbiAgICBzd2l0Y2ggKGNodW5rc1tpXSkge1xuICAgICAgY2FzZSBcIi5cIjpcbiAgICAgICAgY2xhc3NOYW1lICs9IGAgJHtjaHVua3NbaSArIDFdfWA7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFwiI1wiOlxuICAgICAgICBpZCA9IGNodW5rc1tpICsgMV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjbGFzc05hbWU6IGNsYXNzTmFtZS50cmltKCksXG4gICAgdGFnOiBjaHVua3NbMF0gfHwgXCJkaXZcIixcbiAgICBpZCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gaHRtbChxdWVyeSwgLi4uYXJncykge1xuICBsZXQgZWxlbWVudDtcblxuICBjb25zdCB0eXBlID0gdHlwZW9mIHF1ZXJ5O1xuXG4gIGlmICh0eXBlID09PSBcInN0cmluZ1wiKSB7XG4gICAgZWxlbWVudCA9IGNyZWF0ZUVsZW1lbnQocXVlcnkpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNvbnN0IFF1ZXJ5ID0gcXVlcnk7XG4gICAgZWxlbWVudCA9IG5ldyBRdWVyeSguLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJBdCBsZWFzdCBvbmUgYXJndW1lbnQgcmVxdWlyZWRcIik7XG4gIH1cblxuICBwYXJzZUFyZ3VtZW50c0ludGVybmFsKGdldEVsKGVsZW1lbnQpLCBhcmdzLCB0cnVlKTtcblxuICByZXR1cm4gZWxlbWVudDtcbn1cblxuY29uc3QgZWwgPSBodG1sO1xuY29uc3QgaCA9IGh0bWw7XG5cbmh0bWwuZXh0ZW5kID0gZnVuY3Rpb24gZXh0ZW5kSHRtbCguLi5hcmdzKSB7XG4gIHJldHVybiBodG1sLmJpbmQodGhpcywgLi4uYXJncyk7XG59O1xuXG5mdW5jdGlvbiB1bm1vdW50KHBhcmVudCwgX2NoaWxkKSB7XG4gIGxldCBjaGlsZCA9IF9jaGlsZDtcbiAgY29uc3QgcGFyZW50RWwgPSBnZXRFbChwYXJlbnQpO1xuICBjb25zdCBjaGlsZEVsID0gZ2V0RWwoY2hpbGQpO1xuXG4gIGlmIChjaGlsZCA9PT0gY2hpbGRFbCAmJiBjaGlsZEVsLl9fcmVkb21fdmlldykge1xuICAgIC8vIHRyeSB0byBsb29rIHVwIHRoZSB2aWV3IGlmIG5vdCBwcm92aWRlZFxuICAgIGNoaWxkID0gY2hpbGRFbC5fX3JlZG9tX3ZpZXc7XG4gIH1cblxuICBpZiAoY2hpbGRFbC5wYXJlbnROb2RlKSB7XG4gICAgZG9Vbm1vdW50KGNoaWxkLCBjaGlsZEVsLCBwYXJlbnRFbCk7XG5cbiAgICBwYXJlbnRFbC5yZW1vdmVDaGlsZChjaGlsZEVsKTtcbiAgfVxuXG4gIHJldHVybiBjaGlsZDtcbn1cblxuZnVuY3Rpb24gZG9Vbm1vdW50KGNoaWxkLCBjaGlsZEVsLCBwYXJlbnRFbCkge1xuICBjb25zdCBob29rcyA9IGNoaWxkRWwuX19yZWRvbV9saWZlY3ljbGU7XG5cbiAgaWYgKGhvb2tzQXJlRW1wdHkoaG9va3MpKSB7XG4gICAgY2hpbGRFbC5fX3JlZG9tX2xpZmVjeWNsZSA9IHt9O1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCB0cmF2ZXJzZSA9IHBhcmVudEVsO1xuXG4gIGlmIChjaGlsZEVsLl9fcmVkb21fbW91bnRlZCkge1xuICAgIHRyaWdnZXIoY2hpbGRFbCwgXCJvbnVubW91bnRcIik7XG4gIH1cblxuICB3aGlsZSAodHJhdmVyc2UpIHtcbiAgICBjb25zdCBwYXJlbnRIb29rcyA9IHRyYXZlcnNlLl9fcmVkb21fbGlmZWN5Y2xlIHx8IHt9O1xuXG4gICAgZm9yIChjb25zdCBob29rIGluIGhvb2tzKSB7XG4gICAgICBpZiAocGFyZW50SG9va3NbaG9va10pIHtcbiAgICAgICAgcGFyZW50SG9va3NbaG9va10gLT0gaG9va3NbaG9va107XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGhvb2tzQXJlRW1wdHkocGFyZW50SG9va3MpKSB7XG4gICAgICB0cmF2ZXJzZS5fX3JlZG9tX2xpZmVjeWNsZSA9IG51bGw7XG4gICAgfVxuXG4gICAgdHJhdmVyc2UgPSB0cmF2ZXJzZS5wYXJlbnROb2RlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhvb2tzQXJlRW1wdHkoaG9va3MpIHtcbiAgaWYgKGhvb2tzID09IG51bGwpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBmb3IgKGNvbnN0IGtleSBpbiBob29rcykge1xuICAgIGlmIChob29rc1trZXldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKiBnbG9iYWwgTm9kZSwgU2hhZG93Um9vdCAqL1xuXG5cbmNvbnN0IGhvb2tOYW1lcyA9IFtcIm9ubW91bnRcIiwgXCJvbnJlbW91bnRcIiwgXCJvbnVubW91bnRcIl07XG5jb25zdCBzaGFkb3dSb290QXZhaWxhYmxlID1cbiAgdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBcIlNoYWRvd1Jvb3RcIiBpbiB3aW5kb3c7XG5cbmZ1bmN0aW9uIG1vdW50KHBhcmVudCwgX2NoaWxkLCBiZWZvcmUsIHJlcGxhY2UpIHtcbiAgbGV0IGNoaWxkID0gX2NoaWxkO1xuICBjb25zdCBwYXJlbnRFbCA9IGdldEVsKHBhcmVudCk7XG4gIGNvbnN0IGNoaWxkRWwgPSBnZXRFbChjaGlsZCk7XG5cbiAgaWYgKGNoaWxkID09PSBjaGlsZEVsICYmIGNoaWxkRWwuX19yZWRvbV92aWV3KSB7XG4gICAgLy8gdHJ5IHRvIGxvb2sgdXAgdGhlIHZpZXcgaWYgbm90IHByb3ZpZGVkXG4gICAgY2hpbGQgPSBjaGlsZEVsLl9fcmVkb21fdmlldztcbiAgfVxuXG4gIGlmIChjaGlsZCAhPT0gY2hpbGRFbCkge1xuICAgIGNoaWxkRWwuX19yZWRvbV92aWV3ID0gY2hpbGQ7XG4gIH1cblxuICBjb25zdCB3YXNNb3VudGVkID0gY2hpbGRFbC5fX3JlZG9tX21vdW50ZWQ7XG4gIGNvbnN0IG9sZFBhcmVudCA9IGNoaWxkRWwucGFyZW50Tm9kZTtcblxuICBpZiAod2FzTW91bnRlZCAmJiBvbGRQYXJlbnQgIT09IHBhcmVudEVsKSB7XG4gICAgZG9Vbm1vdW50KGNoaWxkLCBjaGlsZEVsLCBvbGRQYXJlbnQpO1xuICB9XG5cbiAgaWYgKGJlZm9yZSAhPSBudWxsKSB7XG4gICAgaWYgKHJlcGxhY2UpIHtcbiAgICAgIGNvbnN0IGJlZm9yZUVsID0gZ2V0RWwoYmVmb3JlKTtcblxuICAgICAgaWYgKGJlZm9yZUVsLl9fcmVkb21fbW91bnRlZCkge1xuICAgICAgICB0cmlnZ2VyKGJlZm9yZUVsLCBcIm9udW5tb3VudFwiKTtcbiAgICAgIH1cblxuICAgICAgcGFyZW50RWwucmVwbGFjZUNoaWxkKGNoaWxkRWwsIGJlZm9yZUVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50RWwuaW5zZXJ0QmVmb3JlKGNoaWxkRWwsIGdldEVsKGJlZm9yZSkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBwYXJlbnRFbC5hcHBlbmRDaGlsZChjaGlsZEVsKTtcbiAgfVxuXG4gIGRvTW91bnQoY2hpbGQsIGNoaWxkRWwsIHBhcmVudEVsLCBvbGRQYXJlbnQpO1xuXG4gIHJldHVybiBjaGlsZDtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlcihlbCwgZXZlbnROYW1lKSB7XG4gIGlmIChldmVudE5hbWUgPT09IFwib25tb3VudFwiIHx8IGV2ZW50TmFtZSA9PT0gXCJvbnJlbW91bnRcIikge1xuICAgIGVsLl9fcmVkb21fbW91bnRlZCA9IHRydWU7XG4gIH0gZWxzZSBpZiAoZXZlbnROYW1lID09PSBcIm9udW5tb3VudFwiKSB7XG4gICAgZWwuX19yZWRvbV9tb3VudGVkID0gZmFsc2U7XG4gIH1cblxuICBjb25zdCBob29rcyA9IGVsLl9fcmVkb21fbGlmZWN5Y2xlO1xuXG4gIGlmICghaG9va3MpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB2aWV3ID0gZWwuX19yZWRvbV92aWV3O1xuICBsZXQgaG9va0NvdW50ID0gMDtcblxuICB2aWV3Py5bZXZlbnROYW1lXT8uKCk7XG5cbiAgZm9yIChjb25zdCBob29rIGluIGhvb2tzKSB7XG4gICAgaWYgKGhvb2spIHtcbiAgICAgIGhvb2tDb3VudCsrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChob29rQ291bnQpIHtcbiAgICBsZXQgdHJhdmVyc2UgPSBlbC5maXJzdENoaWxkO1xuXG4gICAgd2hpbGUgKHRyYXZlcnNlKSB7XG4gICAgICBjb25zdCBuZXh0ID0gdHJhdmVyc2UubmV4dFNpYmxpbmc7XG5cbiAgICAgIHRyaWdnZXIodHJhdmVyc2UsIGV2ZW50TmFtZSk7XG5cbiAgICAgIHRyYXZlcnNlID0gbmV4dDtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZG9Nb3VudChjaGlsZCwgY2hpbGRFbCwgcGFyZW50RWwsIG9sZFBhcmVudCkge1xuICBpZiAoIWNoaWxkRWwuX19yZWRvbV9saWZlY3ljbGUpIHtcbiAgICBjaGlsZEVsLl9fcmVkb21fbGlmZWN5Y2xlID0ge307XG4gIH1cblxuICBjb25zdCBob29rcyA9IGNoaWxkRWwuX19yZWRvbV9saWZlY3ljbGU7XG4gIGNvbnN0IHJlbW91bnQgPSBwYXJlbnRFbCA9PT0gb2xkUGFyZW50O1xuICBsZXQgaG9va3NGb3VuZCA9IGZhbHNlO1xuXG4gIGZvciAoY29uc3QgaG9va05hbWUgb2YgaG9va05hbWVzKSB7XG4gICAgaWYgKCFyZW1vdW50KSB7XG4gICAgICAvLyBpZiBhbHJlYWR5IG1vdW50ZWQsIHNraXAgdGhpcyBwaGFzZVxuICAgICAgaWYgKGNoaWxkICE9PSBjaGlsZEVsKSB7XG4gICAgICAgIC8vIG9ubHkgVmlld3MgY2FuIGhhdmUgbGlmZWN5Y2xlIGV2ZW50c1xuICAgICAgICBpZiAoaG9va05hbWUgaW4gY2hpbGQpIHtcbiAgICAgICAgICBob29rc1tob29rTmFtZV0gPSAoaG9va3NbaG9va05hbWVdIHx8IDApICsgMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoaG9va3NbaG9va05hbWVdKSB7XG4gICAgICBob29rc0ZvdW5kID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWhvb2tzRm91bmQpIHtcbiAgICBjaGlsZEVsLl9fcmVkb21fbGlmZWN5Y2xlID0ge307XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IHRyYXZlcnNlID0gcGFyZW50RWw7XG4gIGxldCB0cmlnZ2VyZWQgPSBmYWxzZTtcblxuICBpZiAocmVtb3VudCB8fCB0cmF2ZXJzZT8uX19yZWRvbV9tb3VudGVkKSB7XG4gICAgdHJpZ2dlcihjaGlsZEVsLCByZW1vdW50ID8gXCJvbnJlbW91bnRcIiA6IFwib25tb3VudFwiKTtcbiAgICB0cmlnZ2VyZWQgPSB0cnVlO1xuICB9XG5cbiAgd2hpbGUgKHRyYXZlcnNlKSB7XG4gICAgY29uc3QgcGFyZW50ID0gdHJhdmVyc2UucGFyZW50Tm9kZTtcblxuICAgIGlmICghdHJhdmVyc2UuX19yZWRvbV9saWZlY3ljbGUpIHtcbiAgICAgIHRyYXZlcnNlLl9fcmVkb21fbGlmZWN5Y2xlID0ge307XG4gICAgfVxuXG4gICAgY29uc3QgcGFyZW50SG9va3MgPSB0cmF2ZXJzZS5fX3JlZG9tX2xpZmVjeWNsZTtcblxuICAgIGZvciAoY29uc3QgaG9vayBpbiBob29rcykge1xuICAgICAgcGFyZW50SG9va3NbaG9va10gPSAocGFyZW50SG9va3NbaG9va10gfHwgMCkgKyBob29rc1tob29rXTtcbiAgICB9XG5cbiAgICBpZiAodHJpZ2dlcmVkKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgaWYgKFxuICAgICAgdHJhdmVyc2Uubm9kZVR5cGUgPT09IE5vZGUuRE9DVU1FTlRfTk9ERSB8fFxuICAgICAgKHNoYWRvd1Jvb3RBdmFpbGFibGUgJiYgdHJhdmVyc2UgaW5zdGFuY2VvZiBTaGFkb3dSb290KSB8fFxuICAgICAgcGFyZW50Py5fX3JlZG9tX21vdW50ZWRcbiAgICApIHtcbiAgICAgIHRyaWdnZXIodHJhdmVyc2UsIHJlbW91bnQgPyBcIm9ucmVtb3VudFwiIDogXCJvbm1vdW50XCIpO1xuICAgICAgdHJpZ2dlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgdHJhdmVyc2UgPSBwYXJlbnQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0U3R5bGUodmlldywgYXJnMSwgYXJnMikge1xuICBjb25zdCBlbCA9IGdldEVsKHZpZXcpO1xuXG4gIGlmICh0eXBlb2YgYXJnMSA9PT0gXCJvYmplY3RcIikge1xuICAgIGZvciAoY29uc3Qga2V5IGluIGFyZzEpIHtcbiAgICAgIHNldFN0eWxlVmFsdWUoZWwsIGtleSwgYXJnMVtrZXldKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgc2V0U3R5bGVWYWx1ZShlbCwgYXJnMSwgYXJnMik7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0U3R5bGVWYWx1ZShlbCwga2V5LCB2YWx1ZSkge1xuICBlbC5zdHlsZVtrZXldID0gdmFsdWUgPT0gbnVsbCA/IFwiXCIgOiB2YWx1ZTtcbn1cblxuLyogZ2xvYmFsIFNWR0VsZW1lbnQgKi9cblxuXG5jb25zdCB4bGlua25zID0gXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI7XG5cbmZ1bmN0aW9uIHNldEF0dHIodmlldywgYXJnMSwgYXJnMikge1xuICBzZXRBdHRySW50ZXJuYWwodmlldywgYXJnMSwgYXJnMik7XG59XG5cbmZ1bmN0aW9uIHNldEF0dHJJbnRlcm5hbCh2aWV3LCBhcmcxLCBhcmcyLCBpbml0aWFsKSB7XG4gIGNvbnN0IGVsID0gZ2V0RWwodmlldyk7XG5cbiAgY29uc3QgaXNPYmogPSB0eXBlb2YgYXJnMSA9PT0gXCJvYmplY3RcIjtcblxuICBpZiAoaXNPYmopIHtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiBhcmcxKSB7XG4gICAgICBzZXRBdHRySW50ZXJuYWwoZWwsIGtleSwgYXJnMVtrZXldLCBpbml0aWFsKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgaXNTVkcgPSBlbCBpbnN0YW5jZW9mIFNWR0VsZW1lbnQ7XG4gICAgY29uc3QgaXNGdW5jID0gdHlwZW9mIGFyZzIgPT09IFwiZnVuY3Rpb25cIjtcblxuICAgIGlmIChhcmcxID09PSBcInN0eWxlXCIgJiYgdHlwZW9mIGFyZzIgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHNldFN0eWxlKGVsLCBhcmcyKTtcbiAgICB9IGVsc2UgaWYgKGlzU1ZHICYmIGlzRnVuYykge1xuICAgICAgZWxbYXJnMV0gPSBhcmcyO1xuICAgIH0gZWxzZSBpZiAoYXJnMSA9PT0gXCJkYXRhc2V0XCIpIHtcbiAgICAgIHNldERhdGEoZWwsIGFyZzIpO1xuICAgIH0gZWxzZSBpZiAoIWlzU1ZHICYmIChhcmcxIGluIGVsIHx8IGlzRnVuYykgJiYgYXJnMSAhPT0gXCJsaXN0XCIpIHtcbiAgICAgIGVsW2FyZzFdID0gYXJnMjtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzU1ZHICYmIGFyZzEgPT09IFwieGxpbmtcIikge1xuICAgICAgICBzZXRYbGluayhlbCwgYXJnMik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChpbml0aWFsICYmIGFyZzEgPT09IFwiY2xhc3NcIikge1xuICAgICAgICBzZXRDbGFzc05hbWUoZWwsIGFyZzIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoYXJnMiA9PSBudWxsKSB7XG4gICAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZShhcmcxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZShhcmcxLCBhcmcyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0Q2xhc3NOYW1lKGVsLCBhZGRpdGlvblRvQ2xhc3NOYW1lKSB7XG4gIGlmIChhZGRpdGlvblRvQ2xhc3NOYW1lID09IG51bGwpIHtcbiAgICBlbC5yZW1vdmVBdHRyaWJ1dGUoXCJjbGFzc1wiKTtcbiAgfSBlbHNlIGlmIChlbC5jbGFzc0xpc3QpIHtcbiAgICBlbC5jbGFzc0xpc3QuYWRkKGFkZGl0aW9uVG9DbGFzc05hbWUpO1xuICB9IGVsc2UgaWYgKFxuICAgIHR5cGVvZiBlbC5jbGFzc05hbWUgPT09IFwib2JqZWN0XCIgJiZcbiAgICBlbC5jbGFzc05hbWUgJiZcbiAgICBlbC5jbGFzc05hbWUuYmFzZVZhbFxuICApIHtcbiAgICBlbC5jbGFzc05hbWUuYmFzZVZhbCA9XG4gICAgICBgJHtlbC5jbGFzc05hbWUuYmFzZVZhbH0gJHthZGRpdGlvblRvQ2xhc3NOYW1lfWAudHJpbSgpO1xuICB9IGVsc2Uge1xuICAgIGVsLmNsYXNzTmFtZSA9IGAke2VsLmNsYXNzTmFtZX0gJHthZGRpdGlvblRvQ2xhc3NOYW1lfWAudHJpbSgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNldFhsaW5rKGVsLCBhcmcxLCBhcmcyKSB7XG4gIGlmICh0eXBlb2YgYXJnMSA9PT0gXCJvYmplY3RcIikge1xuICAgIGZvciAoY29uc3Qga2V5IGluIGFyZzEpIHtcbiAgICAgIHNldFhsaW5rKGVsLCBrZXksIGFyZzFba2V5XSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChhcmcyICE9IG51bGwpIHtcbiAgICAgIGVsLnNldEF0dHJpYnV0ZU5TKHhsaW5rbnMsIGFyZzEsIGFyZzIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbC5yZW1vdmVBdHRyaWJ1dGVOUyh4bGlua25zLCBhcmcxLCBhcmcyKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0RGF0YShlbCwgYXJnMSwgYXJnMikge1xuICBpZiAodHlwZW9mIGFyZzEgPT09IFwib2JqZWN0XCIpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiBhcmcxKSB7XG4gICAgICBzZXREYXRhKGVsLCBrZXksIGFyZzFba2V5XSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChhcmcyICE9IG51bGwpIHtcbiAgICAgIGVsLmRhdGFzZXRbYXJnMV0gPSBhcmcyO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZWwuZGF0YXNldFthcmcxXTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gdGV4dChzdHIpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHN0ciAhPSBudWxsID8gc3RyIDogXCJcIik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlQXJndW1lbnRzSW50ZXJuYWwoZWxlbWVudCwgYXJncywgaW5pdGlhbCkge1xuICBmb3IgKGNvbnN0IGFyZyBvZiBhcmdzKSB7XG4gICAgaWYgKGFyZyAhPT0gMCAmJiAhYXJnKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlID0gdHlwZW9mIGFyZztcblxuICAgIGlmICh0eXBlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGFyZyhlbGVtZW50KTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwic3RyaW5nXCIgfHwgdHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgZWxlbWVudC5hcHBlbmRDaGlsZCh0ZXh0KGFyZykpO1xuICAgIH0gZWxzZSBpZiAoaXNOb2RlKGdldEVsKGFyZykpKSB7XG4gICAgICBtb3VudChlbGVtZW50LCBhcmcpO1xuICAgIH0gZWxzZSBpZiAoYXJnLmxlbmd0aCkge1xuICAgICAgcGFyc2VBcmd1bWVudHNJbnRlcm5hbChlbGVtZW50LCBhcmcsIGluaXRpYWwpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgc2V0QXR0ckludGVybmFsKGVsZW1lbnQsIGFyZywgbnVsbCwgaW5pdGlhbCk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUVsKHBhcmVudCkge1xuICByZXR1cm4gdHlwZW9mIHBhcmVudCA9PT0gXCJzdHJpbmdcIiA/IGh0bWwocGFyZW50KSA6IGdldEVsKHBhcmVudCk7XG59XG5cbmZ1bmN0aW9uIGdldEVsKHBhcmVudCkge1xuICByZXR1cm4gKFxuICAgIChwYXJlbnQubm9kZVR5cGUgJiYgcGFyZW50KSB8fCAoIXBhcmVudC5lbCAmJiBwYXJlbnQpIHx8IGdldEVsKHBhcmVudC5lbClcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNOb2RlKGFyZykge1xuICByZXR1cm4gYXJnPy5ub2RlVHlwZTtcbn1cblxuZnVuY3Rpb24gZGlzcGF0Y2goY2hpbGQsIGRhdGEsIGV2ZW50TmFtZSA9IFwicmVkb21cIikge1xuICBjb25zdCBjaGlsZEVsID0gZ2V0RWwoY2hpbGQpO1xuICBjb25zdCBldmVudCA9IG5ldyBDdXN0b21FdmVudChldmVudE5hbWUsIHsgYnViYmxlczogdHJ1ZSwgZGV0YWlsOiBkYXRhIH0pO1xuICBjaGlsZEVsLmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xufVxuXG5mdW5jdGlvbiBzZXRDaGlsZHJlbihwYXJlbnQsIC4uLmNoaWxkcmVuKSB7XG4gIGNvbnN0IHBhcmVudEVsID0gZ2V0RWwocGFyZW50KTtcbiAgbGV0IGN1cnJlbnQgPSB0cmF2ZXJzZShwYXJlbnQsIGNoaWxkcmVuLCBwYXJlbnRFbC5maXJzdENoaWxkKTtcblxuICB3aGlsZSAoY3VycmVudCkge1xuICAgIGNvbnN0IG5leHQgPSBjdXJyZW50Lm5leHRTaWJsaW5nO1xuXG4gICAgdW5tb3VudChwYXJlbnQsIGN1cnJlbnQpO1xuXG4gICAgY3VycmVudCA9IG5leHQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJhdmVyc2UocGFyZW50LCBjaGlsZHJlbiwgX2N1cnJlbnQpIHtcbiAgbGV0IGN1cnJlbnQgPSBfY3VycmVudDtcblxuICBjb25zdCBjaGlsZEVscyA9IEFycmF5KGNoaWxkcmVuLmxlbmd0aCk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgIGNoaWxkRWxzW2ldID0gY2hpbGRyZW5baV0gJiYgZ2V0RWwoY2hpbGRyZW5baV0pO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoaWxkID0gY2hpbGRyZW5baV07XG5cbiAgICBpZiAoIWNoaWxkKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZEVsID0gY2hpbGRFbHNbaV07XG5cbiAgICBpZiAoY2hpbGRFbCA9PT0gY3VycmVudCkge1xuICAgICAgY3VycmVudCA9IGN1cnJlbnQubmV4dFNpYmxpbmc7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNOb2RlKGNoaWxkRWwpKSB7XG4gICAgICBjb25zdCBuZXh0ID0gY3VycmVudD8ubmV4dFNpYmxpbmc7XG4gICAgICBjb25zdCBleGlzdHMgPSBjaGlsZC5fX3JlZG9tX2luZGV4ICE9IG51bGw7XG4gICAgICBjb25zdCByZXBsYWNlID0gZXhpc3RzICYmIG5leHQgPT09IGNoaWxkRWxzW2kgKyAxXTtcblxuICAgICAgbW91bnQocGFyZW50LCBjaGlsZCwgY3VycmVudCwgcmVwbGFjZSk7XG5cbiAgICAgIGlmIChyZXBsYWNlKSB7XG4gICAgICAgIGN1cnJlbnQgPSBuZXh0O1xuICAgICAgfVxuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoY2hpbGQubGVuZ3RoICE9IG51bGwpIHtcbiAgICAgIGN1cnJlbnQgPSB0cmF2ZXJzZShwYXJlbnQsIGNoaWxkLCBjdXJyZW50KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY3VycmVudDtcbn1cblxuZnVuY3Rpb24gbGlzdFBvb2woVmlldywga2V5LCBpbml0RGF0YSkge1xuICByZXR1cm4gbmV3IExpc3RQb29sKFZpZXcsIGtleSwgaW5pdERhdGEpO1xufVxuXG5jbGFzcyBMaXN0UG9vbCB7XG4gIGNvbnN0cnVjdG9yKFZpZXcsIGtleSwgaW5pdERhdGEpIHtcbiAgICB0aGlzLlZpZXcgPSBWaWV3O1xuICAgIHRoaXMuaW5pdERhdGEgPSBpbml0RGF0YTtcbiAgICB0aGlzLm9sZExvb2t1cCA9IHt9O1xuICAgIHRoaXMubG9va3VwID0ge307XG4gICAgdGhpcy5vbGRWaWV3cyA9IFtdO1xuICAgIHRoaXMudmlld3MgPSBbXTtcblxuICAgIGlmIChrZXkgIT0gbnVsbCkge1xuICAgICAgdGhpcy5rZXkgPSB0eXBlb2Yga2V5ID09PSBcImZ1bmN0aW9uXCIgPyBrZXkgOiBwcm9wS2V5KGtleSk7XG4gICAgfVxuICB9XG5cbiAgdXBkYXRlKGRhdGEsIGNvbnRleHQpIHtcbiAgICBjb25zdCB7IFZpZXcsIGtleSwgaW5pdERhdGEgfSA9IHRoaXM7XG4gICAgY29uc3Qga2V5U2V0ID0ga2V5ICE9IG51bGw7XG5cbiAgICBjb25zdCBvbGRMb29rdXAgPSB0aGlzLmxvb2t1cDtcbiAgICBjb25zdCBuZXdMb29rdXAgPSB7fTtcblxuICAgIGNvbnN0IG5ld1ZpZXdzID0gQXJyYXkoZGF0YS5sZW5ndGgpO1xuICAgIGNvbnN0IG9sZFZpZXdzID0gdGhpcy52aWV3cztcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaXRlbSA9IGRhdGFbaV07XG4gICAgICBsZXQgdmlldztcblxuICAgICAgaWYgKGtleVNldCkge1xuICAgICAgICBjb25zdCBpZCA9IGtleShpdGVtKTtcblxuICAgICAgICB2aWV3ID0gb2xkTG9va3VwW2lkXSB8fCBuZXcgVmlldyhpbml0RGF0YSwgaXRlbSwgaSwgZGF0YSk7XG4gICAgICAgIG5ld0xvb2t1cFtpZF0gPSB2aWV3O1xuICAgICAgICB2aWV3Ll9fcmVkb21faWQgPSBpZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZpZXcgPSBvbGRWaWV3c1tpXSB8fCBuZXcgVmlldyhpbml0RGF0YSwgaXRlbSwgaSwgZGF0YSk7XG4gICAgICB9XG4gICAgICB2aWV3LnVwZGF0ZT8uKGl0ZW0sIGksIGRhdGEsIGNvbnRleHQpO1xuXG4gICAgICBjb25zdCBlbCA9IGdldEVsKHZpZXcuZWwpO1xuXG4gICAgICBlbC5fX3JlZG9tX3ZpZXcgPSB2aWV3O1xuICAgICAgbmV3Vmlld3NbaV0gPSB2aWV3O1xuICAgIH1cblxuICAgIHRoaXMub2xkVmlld3MgPSBvbGRWaWV3cztcbiAgICB0aGlzLnZpZXdzID0gbmV3Vmlld3M7XG5cbiAgICB0aGlzLm9sZExvb2t1cCA9IG9sZExvb2t1cDtcbiAgICB0aGlzLmxvb2t1cCA9IG5ld0xvb2t1cDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9wS2V5KGtleSkge1xuICByZXR1cm4gZnVuY3Rpb24gcHJvcHBlZEtleShpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW1ba2V5XTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gbGlzdChwYXJlbnQsIFZpZXcsIGtleSwgaW5pdERhdGEpIHtcbiAgcmV0dXJuIG5ldyBMaXN0KHBhcmVudCwgVmlldywga2V5LCBpbml0RGF0YSk7XG59XG5cbmNsYXNzIExpc3Qge1xuICBjb25zdHJ1Y3RvcihwYXJlbnQsIFZpZXcsIGtleSwgaW5pdERhdGEpIHtcbiAgICB0aGlzLlZpZXcgPSBWaWV3O1xuICAgIHRoaXMuaW5pdERhdGEgPSBpbml0RGF0YTtcbiAgICB0aGlzLnZpZXdzID0gW107XG4gICAgdGhpcy5wb29sID0gbmV3IExpc3RQb29sKFZpZXcsIGtleSwgaW5pdERhdGEpO1xuICAgIHRoaXMuZWwgPSBlbnN1cmVFbChwYXJlbnQpO1xuICAgIHRoaXMua2V5U2V0ID0ga2V5ICE9IG51bGw7XG4gIH1cblxuICB1cGRhdGUoZGF0YSwgY29udGV4dCkge1xuICAgIGNvbnN0IHsga2V5U2V0IH0gPSB0aGlzO1xuICAgIGNvbnN0IG9sZFZpZXdzID0gdGhpcy52aWV3cztcblxuICAgIHRoaXMucG9vbC51cGRhdGUoZGF0YSB8fCBbXSwgY29udGV4dCk7XG5cbiAgICBjb25zdCB7IHZpZXdzLCBsb29rdXAgfSA9IHRoaXMucG9vbDtcblxuICAgIGlmIChrZXlTZXQpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmlld3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qgb2xkVmlldyA9IG9sZFZpZXdzW2ldO1xuICAgICAgICBjb25zdCBpZCA9IG9sZFZpZXcuX19yZWRvbV9pZDtcblxuICAgICAgICBpZiAobG9va3VwW2lkXSA9PSBudWxsKSB7XG4gICAgICAgICAgb2xkVmlldy5fX3JlZG9tX2luZGV4ID0gbnVsbDtcbiAgICAgICAgICB1bm1vdW50KHRoaXMsIG9sZFZpZXcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2aWV3cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgdmlldyA9IHZpZXdzW2ldO1xuXG4gICAgICB2aWV3Ll9fcmVkb21faW5kZXggPSBpO1xuICAgIH1cblxuICAgIHNldENoaWxkcmVuKHRoaXMsIHZpZXdzKTtcblxuICAgIGlmIChrZXlTZXQpIHtcbiAgICAgIHRoaXMubG9va3VwID0gbG9va3VwO1xuICAgIH1cbiAgICB0aGlzLnZpZXdzID0gdmlld3M7XG4gIH1cbn1cblxuTGlzdC5leHRlbmQgPSBmdW5jdGlvbiBleHRlbmRMaXN0KHBhcmVudCwgVmlldywga2V5LCBpbml0RGF0YSkge1xuICByZXR1cm4gTGlzdC5iaW5kKExpc3QsIHBhcmVudCwgVmlldywga2V5LCBpbml0RGF0YSk7XG59O1xuXG5saXN0LmV4dGVuZCA9IExpc3QuZXh0ZW5kO1xuXG4vKiBnbG9iYWwgTm9kZSAqL1xuXG5cbmZ1bmN0aW9uIHBsYWNlKFZpZXcsIGluaXREYXRhKSB7XG4gIHJldHVybiBuZXcgUGxhY2UoVmlldywgaW5pdERhdGEpO1xufVxuXG5jbGFzcyBQbGFjZSB7XG4gIGNvbnN0cnVjdG9yKFZpZXcsIGluaXREYXRhKSB7XG4gICAgdGhpcy5lbCA9IHRleHQoXCJcIik7XG4gICAgdGhpcy52aXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy52aWV3ID0gbnVsbDtcbiAgICB0aGlzLl9wbGFjZWhvbGRlciA9IHRoaXMuZWw7XG5cbiAgICBpZiAoVmlldyBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgIHRoaXMuX2VsID0gVmlldztcbiAgICB9IGVsc2UgaWYgKFZpZXcuZWwgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICB0aGlzLl9lbCA9IFZpZXc7XG4gICAgICB0aGlzLnZpZXcgPSBWaWV3O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9WaWV3ID0gVmlldztcbiAgICB9XG5cbiAgICB0aGlzLl9pbml0RGF0YSA9IGluaXREYXRhO1xuICB9XG5cbiAgdXBkYXRlKHZpc2libGUsIGRhdGEpIHtcbiAgICBjb25zdCBwbGFjZWhvbGRlciA9IHRoaXMuX3BsYWNlaG9sZGVyO1xuICAgIGNvbnN0IHBhcmVudE5vZGUgPSB0aGlzLmVsLnBhcmVudE5vZGU7XG5cbiAgICBpZiAodmlzaWJsZSkge1xuICAgICAgaWYgKCF0aGlzLnZpc2libGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VsKSB7XG4gICAgICAgICAgbW91bnQocGFyZW50Tm9kZSwgdGhpcy5fZWwsIHBsYWNlaG9sZGVyKTtcbiAgICAgICAgICB1bm1vdW50KHBhcmVudE5vZGUsIHBsYWNlaG9sZGVyKTtcblxuICAgICAgICAgIHRoaXMuZWwgPSBnZXRFbCh0aGlzLl9lbCk7XG4gICAgICAgICAgdGhpcy52aXNpYmxlID0gdmlzaWJsZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBWaWV3ID0gdGhpcy5fVmlldztcbiAgICAgICAgICBjb25zdCB2aWV3ID0gbmV3IFZpZXcodGhpcy5faW5pdERhdGEpO1xuXG4gICAgICAgICAgdGhpcy5lbCA9IGdldEVsKHZpZXcpO1xuICAgICAgICAgIHRoaXMudmlldyA9IHZpZXc7XG5cbiAgICAgICAgICBtb3VudChwYXJlbnROb2RlLCB2aWV3LCBwbGFjZWhvbGRlcik7XG4gICAgICAgICAgdW5tb3VudChwYXJlbnROb2RlLCBwbGFjZWhvbGRlcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMudmlldz8udXBkYXRlPy4oZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLnZpc2libGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VsKSB7XG4gICAgICAgICAgbW91bnQocGFyZW50Tm9kZSwgcGxhY2Vob2xkZXIsIHRoaXMuX2VsKTtcbiAgICAgICAgICB1bm1vdW50KHBhcmVudE5vZGUsIHRoaXMuX2VsKTtcblxuICAgICAgICAgIHRoaXMuZWwgPSBwbGFjZWhvbGRlcjtcbiAgICAgICAgICB0aGlzLnZpc2libGUgPSB2aXNpYmxlO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIG1vdW50KHBhcmVudE5vZGUsIHBsYWNlaG9sZGVyLCB0aGlzLnZpZXcpO1xuICAgICAgICB1bm1vdW50KHBhcmVudE5vZGUsIHRoaXMudmlldyk7XG5cbiAgICAgICAgdGhpcy5lbCA9IHBsYWNlaG9sZGVyO1xuICAgICAgICB0aGlzLnZpZXcgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnZpc2libGUgPSB2aXNpYmxlO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlZihjdHgsIGtleSwgdmFsdWUpIHtcbiAgY3R4W2tleV0gPSB2YWx1ZTtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKiBnbG9iYWwgTm9kZSAqL1xuXG5cbmZ1bmN0aW9uIHJvdXRlcihwYXJlbnQsIHZpZXdzLCBpbml0RGF0YSkge1xuICByZXR1cm4gbmV3IFJvdXRlcihwYXJlbnQsIHZpZXdzLCBpbml0RGF0YSk7XG59XG5cbmNsYXNzIFJvdXRlciB7XG4gIGNvbnN0cnVjdG9yKHBhcmVudCwgdmlld3MsIGluaXREYXRhKSB7XG4gICAgdGhpcy5lbCA9IGVuc3VyZUVsKHBhcmVudCk7XG4gICAgdGhpcy52aWV3cyA9IHZpZXdzO1xuICAgIHRoaXMuVmlld3MgPSB2aWV3czsgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgICB0aGlzLmluaXREYXRhID0gaW5pdERhdGE7XG4gIH1cblxuICB1cGRhdGUocm91dGUsIGRhdGEpIHtcbiAgICBpZiAocm91dGUgIT09IHRoaXMucm91dGUpIHtcbiAgICAgIGNvbnN0IHZpZXdzID0gdGhpcy52aWV3cztcbiAgICAgIGNvbnN0IFZpZXcgPSB2aWV3c1tyb3V0ZV07XG5cbiAgICAgIHRoaXMucm91dGUgPSByb3V0ZTtcblxuICAgICAgaWYgKFZpZXcgJiYgKFZpZXcgaW5zdGFuY2VvZiBOb2RlIHx8IFZpZXcuZWwgaW5zdGFuY2VvZiBOb2RlKSkge1xuICAgICAgICB0aGlzLnZpZXcgPSBWaWV3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy52aWV3ID0gVmlldyAmJiBuZXcgVmlldyh0aGlzLmluaXREYXRhLCBkYXRhKTtcbiAgICAgIH1cblxuICAgICAgc2V0Q2hpbGRyZW4odGhpcy5lbCwgW3RoaXMudmlld10pO1xuICAgIH1cbiAgICB0aGlzLnZpZXc/LnVwZGF0ZT8uKGRhdGEsIHJvdXRlKTtcbiAgfVxufVxuXG5jb25zdCBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjtcblxuZnVuY3Rpb24gc3ZnKHF1ZXJ5LCAuLi5hcmdzKSB7XG4gIGxldCBlbGVtZW50O1xuXG4gIGNvbnN0IHR5cGUgPSB0eXBlb2YgcXVlcnk7XG5cbiAgaWYgKHR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICBlbGVtZW50ID0gY3JlYXRlRWxlbWVudChxdWVyeSwgbnMpO1xuICB9IGVsc2UgaWYgKHR5cGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNvbnN0IFF1ZXJ5ID0gcXVlcnk7XG4gICAgZWxlbWVudCA9IG5ldyBRdWVyeSguLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJBdCBsZWFzdCBvbmUgYXJndW1lbnQgcmVxdWlyZWRcIik7XG4gIH1cblxuICBwYXJzZUFyZ3VtZW50c0ludGVybmFsKGdldEVsKGVsZW1lbnQpLCBhcmdzLCB0cnVlKTtcblxuICByZXR1cm4gZWxlbWVudDtcbn1cblxuY29uc3QgcyA9IHN2Zztcblxuc3ZnLmV4dGVuZCA9IGZ1bmN0aW9uIGV4dGVuZFN2ZyguLi5hcmdzKSB7XG4gIHJldHVybiBzdmcuYmluZCh0aGlzLCAuLi5hcmdzKTtcbn07XG5cbnN2Zy5ucyA9IG5zO1xuXG5mdW5jdGlvbiB2aWV3RmFjdG9yeSh2aWV3cywga2V5KSB7XG4gIGlmICghdmlld3MgfHwgdHlwZW9mIHZpZXdzICE9PSBcIm9iamVjdFwiKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwidmlld3MgbXVzdCBiZSBhbiBvYmplY3RcIik7XG4gIH1cbiAgaWYgKCFrZXkgfHwgdHlwZW9mIGtleSAhPT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBFcnJvcihcImtleSBtdXN0IGJlIGEgc3RyaW5nXCIpO1xuICB9XG4gIHJldHVybiBmdW5jdGlvbiBmYWN0b3J5Vmlldyhpbml0RGF0YSwgaXRlbSwgaSwgZGF0YSkge1xuICAgIGNvbnN0IHZpZXdLZXkgPSBpdGVtW2tleV07XG4gICAgY29uc3QgVmlldyA9IHZpZXdzW3ZpZXdLZXldO1xuXG4gICAgaWYgKFZpZXcpIHtcbiAgICAgIHJldHVybiBuZXcgVmlldyhpbml0RGF0YSwgaXRlbSwgaSwgZGF0YSk7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGB2aWV3ICR7dmlld0tleX0gbm90IGZvdW5kYCk7XG4gIH07XG59XG5cbmV4cG9ydCB7IExpc3QsIExpc3RQb29sLCBQbGFjZSwgUm91dGVyLCBkaXNwYXRjaCwgZWwsIGgsIGh0bWwsIGxpc3QsIGxpc3RQb29sLCBtb3VudCwgcGxhY2UsIHJlZiwgcm91dGVyLCBzLCBzZXRBdHRyLCBzZXRDaGlsZHJlbiwgc2V0RGF0YSwgc2V0U3R5bGUsIHNldFhsaW5rLCBzdmcsIHRleHQsIHVubW91bnQsIHZpZXdGYWN0b3J5IH07XG4iLCJpbXBvcnQgeyBtb3VudCwgZWwgfSBmcm9tICcuLi8uLi9ub2RlX21vZHVsZXMvcmVkb20vZGlzdC9yZWRvbS5lcyc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJbnB1dCB7XHJcbiAgICBjb25zdHJ1Y3RvcihzZXR0aW5ncyA9IHt9KSB7XHJcbiAgICAgICAgY29uc3QgeyBsYWJlbCB9ID0gc2V0dGluZ3M7XHJcbiAgICAgICAgdGhpcy5fcHJvcCA9IHsgbGFiZWwgfTtcclxuICAgICAgICB0aGlzLmVsID0gdGhpcy5fdWlfcmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgX3VpX3JlbmRlciA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCB7IGxhYmVsIH0gPSB0aGlzLl9wcm9wXHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJmb3JtLWxhYmVsXCI+e2xhYmVsfVxyXG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzTmFtZT1cImZvcm0tY29udHJvbFwiLz5cclxuICAgICAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIClcclxuICAgIH1cclxufSIsImltcG9ydCB7IG1vdW50LCBlbCB9IGZyb20gJy4uLy4uL25vZGVfbW9kdWxlcy9yZWRvbS9kaXN0L3JlZG9tLmVzJztcclxuaW1wb3J0IElucHV0IGZyb20gJy4uL2F0b20vaW5wdXQuanMnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTG9naW5BbmRQYXNzd29yZEZvcm0ge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5lbCA9IHRoaXMuX3VpX3JlbmRlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIF91aV9yZW5kZXIgPSAoKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2QtZmxleCBmbGV4LWNvbHVtbic+XHJcbiAgICAgICAgICAgICAgICA8SW5wdXQgbGFiZWw9J9Cb0L7Qs9C40L0nLz5cclxuICAgICAgICAgICAgICAgIDxJbnB1dCBsYWJlbD0n0J/QsNGA0L7Qu9GMJy8+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIClcclxuICAgIH1cclxufSIsImltcG9ydCB7IG1vdW50LCBlbCB9IGZyb20gJy4uLy4uL25vZGVfbW9kdWxlcy9yZWRvbS9kaXN0L3JlZG9tLmVzJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJ1dHRvbiB7XHJcbiAgICBjb25zdHJ1Y3RvcihzZXR0aW5ncyA9IHt9KSB7XHJcbiAgICAgICAgY29uc3QgeyBsYWJlbCwgY2xhc3NOYW1lID0gJycgfSA9IHNldHRpbmdzO1xyXG4gICAgICAgIHRoaXMuX3Byb3AgPSB7IGxhYmVsLCBjbGFzc05hbWUgfTtcclxuICAgICAgICB0aGlzLmVsID0gdGhpcy5fdWlfcmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgX3VpX3JlbmRlciA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCB7IGxhYmVsLCBjbGFzc05hbWUgfSA9IHRoaXMuX3Byb3A7XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPXtgYnRuICR7Y2xhc3NOYW1lfWAudHJpbSgpfT5cclxuICAgICAgICAgICAgICAgICAgICB7bGFiZWx9XHJcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgKVxyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgZWwsIHRleHQgfSBmcm9tICcuLi8uLi9ub2RlX21vZHVsZXMvcmVkb20vZGlzdC9yZWRvbS5lcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgTGlua0J1dHRvbiB7XHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLmVsID0gZWwoJ2EubGluay1idXR0b24nKTtcclxuICAgIHRoaXMuX2NoaWxkcmVuID0gW107XHJcbiAgfVxyXG4gIFxyXG4gIHVwZGF0ZSh7IGhyZWYsIGNsYXNzTmFtZSB9LCBjaGlsZHJlbikge1xyXG4gICAgdGhpcy5lbC5ocmVmID0gaHJlZiB8fCAnIyc7XHJcbiAgICB0aGlzLmVsLmNsYXNzTmFtZSA9IGBsaW5rLWJ1dHRvbiAke2NsYXNzTmFtZSB8fCAnJ31gLnRyaW0oKTtcclxuICAgIFxyXG4gICAgLy8g0J7Rh9C40YnQsNC10Lwg0L/RgNC10LTRi9C00YPRidC40LUgY2hpbGRyZW5cclxuICAgIHRoaXMuZWwuaW5uZXJIVE1MID0gJyc7XHJcbiAgICBcclxuICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQvdC+0LLRi9C1IGNoaWxkcmVuXHJcbiAgICB0aGlzLl9jaGlsZHJlbiA9IGNoaWxkcmVuLm1hcChjaGlsZCA9PiB7XHJcbiAgICAgIGlmICh0eXBlb2YgY2hpbGQgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgcmV0dXJuIHRleHQoY2hpbGQpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBjaGlsZDtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLl9jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHRoaXMuZWwuYXBwZW5kQ2hpbGQoY2hpbGQpKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMuZWw7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgbGlua0J1dHRvbiA9IChwcm9wcywgLi4uY2hpbGRyZW4pID0+IHtcclxuICBjb25zdCBjb21wb25lbnQgPSBuZXcgTGlua0J1dHRvbigpO1xyXG4gIHJldHVybiBjb21wb25lbnQudXBkYXRlKHByb3BzLCBjaGlsZHJlbi5mbGF0KCkpO1xyXG59OyIsImltcG9ydCB7IG1vdW50LCBlbCwgdGV4dCB9IGZyb20gJy4uLy4uL25vZGVfbW9kdWxlcy9yZWRvbS9kaXN0L3JlZG9tLmVzJztcclxuaW1wb3J0IExvZ2luQW5kUGFzc3dvcmRGb3JtIGZyb20gJy4vTG9naW5BbmRQYXNzd29yZEZvcm0uanMnO1xyXG5pbXBvcnQgQnV0dG9uIGZyb20gJy4uL2F0b20vYnV0dG9uLmpzJztcclxuaW1wb3J0IHsgbGlua0J1dHRvbiBhcyBMaW5rQnV0dG9uIH0gZnJvbSAnLi4vYXRvbS9saW5rLmpzJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIExvZ2luRm9ybSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLmVsID0gdGhpcy5fdWlfcmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgX3VpX3JlbmRlciA9ICgpID0+IHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nZC1mbGV4IGZsZXgtY29sdW1uJz5cclxuICAgICAgICAgICAgICAgIDxMb2dpbkFuZFBhc3N3b3JkRm9ybS8+XHJcbiAgICAgICAgICAgICAgICA8QnV0dG9uIGxhYmVsPSfQktC+0LnRgtC4JyBjbGFzc05hbWU9J2J0bi1wcmltYXJ5JyAvPlxyXG4gICAgICAgICAgICAgICAgPExpbmtCdXR0b24gaHJlZj0nL3JlZ2lzdGVyJz5cclxuICAgICAgICAgICAgICAgICAgICB7dGV4dCgn0JfQsNGA0LXQs9C40YHRgtGA0LjRgNC+0LLQsNGC0YzRgdGPJyl9XHJcbiAgICAgICAgICAgICAgICA8L0xpbmtCdXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIClcclxuICAgIH1cclxufSIsIi8vIGxvZ2luLmpzXHJcbmltcG9ydCB7IG1vdW50LCBlbCB9IGZyb20gXCIuLi9ub2RlX21vZHVsZXMvcmVkb20vZGlzdC9yZWRvbS5lc1wiO1xyXG5pbXBvcnQgTG9naW5Gb3JtIGZyb20gJy4vd2lkZ2V0L0xvZ2luRm9ybS5qcyc7XHJcblxyXG5tb3VudChcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWFpblwiKSxcclxuICAgIDxMb2dpbkZvcm0vPlxyXG4pO1xyXG4iXSwibmFtZXMiOlsiY3JlYXRlRWxlbWVudCIsInF1ZXJ5IiwibnMiLCJ0YWciLCJpZCIsImNsYXNzTmFtZSIsInBhcnNlIiwiZWxlbWVudCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudE5TIiwiY2h1bmtzIiwic3BsaXQiLCJpIiwibGVuZ3RoIiwidHJpbSIsImh0bWwiLCJhcmdzIiwidHlwZSIsIlF1ZXJ5IiwiRXJyb3IiLCJwYXJzZUFyZ3VtZW50c0ludGVybmFsIiwiZ2V0RWwiLCJlbCIsImV4dGVuZCIsImV4dGVuZEh0bWwiLCJiaW5kIiwiZG9Vbm1vdW50IiwiY2hpbGQiLCJjaGlsZEVsIiwicGFyZW50RWwiLCJob29rcyIsIl9fcmVkb21fbGlmZWN5Y2xlIiwiaG9va3NBcmVFbXB0eSIsInRyYXZlcnNlIiwiX19yZWRvbV9tb3VudGVkIiwidHJpZ2dlciIsInBhcmVudEhvb2tzIiwiaG9vayIsInBhcmVudE5vZGUiLCJrZXkiLCJob29rTmFtZXMiLCJzaGFkb3dSb290QXZhaWxhYmxlIiwid2luZG93IiwibW91bnQiLCJwYXJlbnQiLCJfY2hpbGQiLCJiZWZvcmUiLCJyZXBsYWNlIiwiX19yZWRvbV92aWV3Iiwid2FzTW91bnRlZCIsIm9sZFBhcmVudCIsImFwcGVuZENoaWxkIiwiZG9Nb3VudCIsImV2ZW50TmFtZSIsInZpZXciLCJob29rQ291bnQiLCJmaXJzdENoaWxkIiwibmV4dCIsIm5leHRTaWJsaW5nIiwicmVtb3VudCIsImhvb2tzRm91bmQiLCJob29rTmFtZSIsInRyaWdnZXJlZCIsIm5vZGVUeXBlIiwiTm9kZSIsIkRPQ1VNRU5UX05PREUiLCJTaGFkb3dSb290Iiwic2V0U3R5bGUiLCJhcmcxIiwiYXJnMiIsInNldFN0eWxlVmFsdWUiLCJ2YWx1ZSIsInN0eWxlIiwieGxpbmtucyIsInNldEF0dHJJbnRlcm5hbCIsImluaXRpYWwiLCJpc09iaiIsImlzU1ZHIiwiU1ZHRWxlbWVudCIsImlzRnVuYyIsInNldERhdGEiLCJzZXRYbGluayIsInNldENsYXNzTmFtZSIsInJlbW92ZUF0dHJpYnV0ZSIsInNldEF0dHJpYnV0ZSIsImFkZGl0aW9uVG9DbGFzc05hbWUiLCJjbGFzc0xpc3QiLCJhZGQiLCJiYXNlVmFsIiwic2V0QXR0cmlidXRlTlMiLCJyZW1vdmVBdHRyaWJ1dGVOUyIsImRhdGFzZXQiLCJ0ZXh0Iiwic3RyIiwiY3JlYXRlVGV4dE5vZGUiLCJhcmciLCJpc05vZGUiLCJJbnB1dCIsIl9jcmVhdGVDbGFzcyIsIl90aGlzIiwic2V0dGluZ3MiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJfY2xhc3NDYWxsQ2hlY2siLCJfZGVmaW5lUHJvcGVydHkiLCJsYWJlbCIsIl9wcm9wIiwiX3VpX3JlbmRlciIsIkxvZ2luQW5kUGFzc3dvcmRGb3JtIiwiQnV0dG9uIiwiX3RoaXMkX3Byb3AiLCJjb25jYXQiLCJfc2V0dGluZ3MkY2xhc3NOYW1lIiwiTGlua0J1dHRvbiIsIl9jaGlsZHJlbiIsInVwZGF0ZSIsIl9yZWYiLCJjaGlsZHJlbiIsImhyZWYiLCJpbm5lckhUTUwiLCJtYXAiLCJmb3JFYWNoIiwibGlua0J1dHRvbiIsInByb3BzIiwiY29tcG9uZW50IiwiX2xlbiIsIkFycmF5IiwiX2tleSIsImZsYXQiLCJMb2dpbkZvcm0iLCJnZXRFbGVtZW50QnlJZCJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxTQUFTQSxhQUFhQSxDQUFDQyxLQUFLLEVBQUVDLEVBQUUsRUFBRTtFQUNoQyxNQUFNO0lBQUVDLEdBQUc7SUFBRUMsRUFBRTtBQUFFQyxJQUFBQTtBQUFVLEdBQUMsR0FBR0MsS0FBSyxDQUFDTCxLQUFLLENBQUM7QUFDM0MsRUFBQSxNQUFNTSxPQUFPLEdBQUdMLEVBQUUsR0FDZE0sUUFBUSxDQUFDQyxlQUFlLENBQUNQLEVBQUUsRUFBRUMsR0FBRyxDQUFDLEdBQ2pDSyxRQUFRLENBQUNSLGFBQWEsQ0FBQ0csR0FBRyxDQUFDO0FBRS9CLEVBQUEsSUFBSUMsRUFBRSxFQUFFO0lBQ05HLE9BQU8sQ0FBQ0gsRUFBRSxHQUFHQSxFQUFFO0FBQ2pCO0FBRUEsRUFBQSxJQUFJQyxTQUFTLEVBQUU7QUFDYixJQUVPO01BQ0xFLE9BQU8sQ0FBQ0YsU0FBUyxHQUFHQSxTQUFTO0FBQy9CO0FBQ0Y7QUFFQSxFQUFBLE9BQU9FLE9BQU87QUFDaEI7QUFFQSxTQUFTRCxLQUFLQSxDQUFDTCxLQUFLLEVBQUU7QUFDcEIsRUFBQSxNQUFNUyxNQUFNLEdBQUdULEtBQUssQ0FBQ1UsS0FBSyxDQUFDLFFBQVEsQ0FBQztFQUNwQyxJQUFJTixTQUFTLEdBQUcsRUFBRTtFQUNsQixJQUFJRCxFQUFFLEdBQUcsRUFBRTtBQUVYLEVBQUEsS0FBSyxJQUFJUSxDQUFDLEdBQUcsQ0FBQyxF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
