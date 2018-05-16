import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import Handlebars from 'handlebars';
import SvgAjax from './../../../shared/components/SvgAjax';
import {startScoper} from './scoper';

const getProp = (...args) => {
  let head = args[0];
  let tail = args.slice(1, args.length);

  const isObjectKind =  (h) => ['[object Object]', '[object Window]'].some((type) =>Object.prototype.toString.call(h) === type);

  if(tail.length > 0 && isObjectKind(head)) {
    return getProp(head[tail[0]], tail.slice(1, tail.length));
  } else {
    return head;
  }
};

const eachNode = (selector, fn) => {
  let list = document.querySelectorAll(selector);
  for (var i = list.length - 1; i >= 0; i--) {
    fn(list[i]);
  }
};

const getUrlParameter = (name = '', url = '') => {
  if (!url && !!window) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
    //if (!results) return null;//should return null to say the parameter did not exist
  if (!results) return '';
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

const Sandbox = ({options = {}, component, scope, playground}) => {

  if (playground) {

    // let Mock = require('themeMocks')[`${component}Mock`];
    let Mock = getProp(window, 'themeMocks', `${component}Mock`);
    if(Mock){
      return (<div id="sandbox"><Mock cssScope={scope} /></div>);
    }
    else{
      return null;
    }
  } else {
    //TODO: remove deprecated
    let Component = require('theme')[`${component}`];
    return (<div className={scope}><Component {...options}>{options.children}</Component> </div>);
  }
};

function RenderComponents(scope){

  const demoEl = document.getElementById('demo');
  const demoComponent = demoEl.getAttribute('data-component');


  if(demoEl && demoComponent) {
    ReactDOM.render(<Sandbox component={demoComponent} scope={scope} playground={true} />, demoEl);
  } else {
    console.warn('Demo component not found!');
  }

  // HTML components
  eachNode('[scope]', (el) => {

    let wrapper = el.parentNode;

    if(wrapper.classList.value.indexOf('scoper-') > -1) {

      wrapper.classList.value = 0;
      wrapper.classList.add(scope);

    } else {

      let newEl = document.createElement('div');
      newEl.classList.add(scope);
      wrapper.replaceChild(newEl, el);
      newEl.appendChild(el);
    }
  });

  // React components
  //TODO: remove deprecated
  eachNode('[data-component]:not(#demo)', (el) => {
    let json = el.getAttribute('data-props');
    let options = JSON.parse(json);

    ReactDOM.render(<Sandbox component={el.getAttribute('data-component')} scope={scope} options={options} />, el);
  });
}

function SwitchBrand(brand) {


  return Promise.all([
    InjectCSS(brand),
    InjectJS(brand)
  ]).then(result => result[0]);
}

function InjectJS(brand) {

  let headTag = document.getElementsByTagName('head')[0];

  let scriptArray = [
      {id: 'theme-script', url: THEME_SCRIPT_URL[brand]},
      {id: 'mock-script',  url: MOCKS_SCRIPT_URL[brand]}
  ].map((currentScript) => {
    return new Promise((resolve, reject) => {

      let prevScript = document.getElementById(currentScript.id);

      if(prevScript) {
        prevScript.parentNode.removeChild(prevScript);
      }

      let script = document.createElement('script');
      script.id = currentScript.id;
      script.onload = () => {
        resolve('');
      };
      script.onerror = (e) => {
        reject(e);
      };
      script.src = currentScript.url;
      headTag.appendChild(script);
    });
  });

  return Promise.all(scriptArray);
}


function InjectCSS(brand) {

  return new Promise((resolve, reject) => {

    let allEls = document.querySelectorAll('[data-component]');

    for (var i = allEls.length - 1; i >= 0; i--) {
      allEls[i].style.visibility = 'hidden;';
    }

    eachNode('[data-component]', (el) => {
      el.style.visibility = 'hidden;';
    });

    let request = new XMLHttpRequest();
    request.open('GET', THEME_URL[brand], true);

    request.onload = function() {
      if (this.status >= 200 && this.status < 400) {
        eachNode('[data-component]', (el) => {
          el.style.visibility = 'hidden;';
        });
        let scopeId = startScoper(this.response);
        resolve(scopeId);
      } else {
        console.error('Could not inject theme. Server error.', this.status);
        reject(this.status);
      }
    };

    request.onerror = (err) => reject(this.status);//console.error('Could not inject theme.', err);

    request.send();

    var actualSvgStore = document.getElementsByClassName('hidden')[0];

    var brandIcon = document.getElementById('brand-icon');
    var brandIconName = document.getElementById('current-brand').value;
    brandIcon.classList='';
    addClass(brandIcon, brandIconName);


    if(actualSvgStore) {
      actualSvgStore.parentNode.removeChild(actualSvgStore);
    }

    SvgAjax(SVG_STORE_URL[brand]);

  });
}

// search for components
function InitSearchComponents(){

  const templateData = Handlebars.compile(window.componentsTemplate);
  const title = window.componentName;
  const noResultMessage = '<em>no result</em>';

  //delays consecutive search inputs to avoid overhead
  let timeout;
  const debounce = (func, wait = 300, immediate = false) => {
    let context = this, args = arguments;
    if (immediate && !timeout) func.apply(context, args);
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }, wait);
  };

  //filters components by input term match
  const filter = value => {
    if (!value) {
      return window.componentsJson;
    }

    let filtered = {};

    if(value[0] === '@'){
      filtered = searchProp(value, window.componentsJson);
    }
    else{
      //search
      const searchReplace = (name, val = '') => {
        return name.replace(new RegExp(`(${val.replace(/ {1,}/g,' ').replace(/\s/g, '|')})`, 'gi'), '<strong>$1</strong>');
      };
      filtered = search(value, window.componentsJson, searchReplace);

      //suggest if no search result
      if(!Object.keys(filtered).length){
        const suggestReplace = (name, val = '') => {
          return (name.replace(new RegExp(`(${val.replace(/ {1,}/g,' ').replace(/\s/g, '|')})`, 'gi'), '<u>$1</u>') + ' ?');
        };
        filtered = suggest(value, window.componentsJson, suggestReplace);
      }
    }


    if(!Object.keys(filtered).length){
      filtered[noResultMessage] = [];
    }

    return filtered;
  };

  const propFlags = ['info', 'warning', 'alert', 'new'];
  const searchProp = (value = '', obj = {}) => {

    if(value.length === 1){
      let props = {};
      let flags = {};
      let tags = {};
      Object.keys(obj).map((prop, index) => {
        obj[prop].map((key, index) => {
          key.new && (flags.new = (flags.new || 0) + 1);
          key.info && (flags.info = (flags.info || 0) + 1);
          key.warning && (flags.warning = (flags.warning || 0) + 1);
          key.alert && (flags.alert = (flags.alert || 0) + 1);
          if(key.tags){
            let tag = (`${key.tags}`).split(',');
            for (var i = 0; i < tag.length; i++) {
              tags[tag[i]] = (tags[tag[i]] || 0) + 1;
            }
          }
        });
      });
      Object.keys(flags).sort().map((prop, index) => {
        (props.flags = props.flags || []) && props.flags.push({
          name: `@${prop} (${flags[prop]})`,
          path: `?s=@${prop}`
        });
      });
      Object.keys(tags).sort().map((prop, index) => {
        (props.tags = props.tags || []) && props.tags.push({
          name: `@tags:${prop} (${tags[prop]})`,
          path: `?s=@tags:${prop}`
        });
      });
      return props;
    }

    const kvp = {
      key: (value.substring(1).split(':').shift() || '_'),
      value: (value.substring(1).split(':')[1] || true)
    };

    const regFindValue = new RegExp(`${kvp.value}`.replace(/ {1,}/g,' ').replace(/\s/g, '.*'), 'i');
    let searched = {};
    Object.keys(obj).map((prop, index) => {
      let searchedValues = [];
      obj[prop].map((key, index) => {
        if(key[kvp.key]){
          let value = `${(key[kvp.key]).constructor == Object ? Object.keys(key[kvp.key]): key[kvp.key]}`;
          if((propFlags.indexOf(kvp.key) > -1 || regFindValue.test(value))){
            let found = Object.assign({}, key);
            searchedValues.push(found);
          }
        }
      });
      if(searchedValues.length){
        searched[prop] = searchedValues;
      }
    });

    return searched;
  };

  const search = (value = '', obj = {}, nameReplace = (name) => name) => {
    const regFindValue = new RegExp(value.replace(/ {1,}/g,' ').replace(/\s/g, '.*'), 'i');
    let searched = {};
    Object.keys(obj).map((prop, index) => {
      let searchedValues = [];
      obj[prop].map((key, index) => {
        if(regFindValue.test(key.originalName || key.name)){
          let found = Object.assign({}, key);
          found.originalName  = found.originalName || found.name;
          found.name = nameReplace(found.originalName, value);
          searchedValues.push(found);
        }
      });
      if(searchedValues.length){
        searched[prop] = searchedValues.sort((a,b)=>a.name.indexOf('<') - b.name.indexOf('<') || a.name > b.name);
      }
    });

    return searched;
  };

  const suggest = (value, obj, nameReplace = (nam) => nam) => {

    const values = value.replace(/\s/g, '').split('');
    let partial = '';
    let suggested = {};
    let lookup = obj;
    for (var i = 0; i < values.length; i++) {
      partial+= values[i];

      if(Object.keys(lookup).length){
        lookup = search(partial, lookup, nameReplace);
        if(Object.keys(lookup).length){
          suggested = Object.assign({}, lookup);
        }
      }
      else{
        break;
      }
    }

    return suggested;
  };

  //scroll to selected DOM element
  const scrollTo = (element, to = 100, duration = 100, horizontal = false) => {
    const direction = horizontal ? 'scrollLeft' : 'scrollTop';
    if (duration <= 0) return;
    const difference = to - element[direction];
    const perTick = difference / duration * 10;
    setTimeout(function() {
      element[direction] = element[direction] + perTick;
      if (element[direction] === to) return;
      scrollTo(element, to, duration - 10);
    }, 10);
  };

  const scrollToSelected = () => {
    const selectedItem = document.querySelector('.dmi-selected');
    (selectedItem
      && selectedItem.previousSibling
      && scrollTo(document.querySelector('.doc-nav'), selectedItem.previousSibling.offsetTop - 13));
  };

  //404 not-found
  const initNotFound = () => {
    if(window.location.pathname !== '/404.html'){
      return;
    }

    const origin = getUrlParameter('o', window.location.search).split('/').pop().split('.').shift();
    if(!origin){
      return;
    }

    let folder = getUrlParameter('o', window.location.search).replace(/^\//, '').split('/');
    if(folder.length > 1){
      folder = folder.shift();
    }
    else{
      folder = false;
    }

    const suggest = filter(origin);
    let templateNotFound = Handlebars.compile(`
      <p>{{title}}</p>
      <ul class='doc-notfound'>
      {{#each pageIndex}}
        {{#each this}}
        <li class='doc-notfound-item{{#if (eq @root.title (fallback originalName name))}} dmi-selected{{/if}}'>
          {{#if @root/folder}}
            {{#unless (eqstring @root/folder @../key)}}
              {{{@../key}}}
            {{/unless}}
          {{/if}}
          <a href='{{path}}'><small>{{{name}}}</small></a>
        </li>
        {{/each}}
      {{/each}}
      </ul>`);

    document.getElementById('notfound-term').innerHTML = origin;
    folder && (document.getElementById('notfound-folder').innerHTML = `in ${folder}`);
    if(!suggest[noResultMessage]){
      document.getElementById('notfound-suggest').innerHTML = templateNotFound({title: 'Perhaps you meant', folder, pageIndex: suggest});
    }
  };

  let searchbar = document.getElementById('search-components');
  Handlebars.registerHelper({
    eq: (v1, v2) => v1 == v2,
    eqstring: (v1, v2) => (v1 || '').toLowerCase() == (v2 || '').toLowerCase(),
    fallback: (...args) => {//returns first non-empty value
      let value = '';
      for (var i = 0; i < args.length; i++) {
        if(args[i]){
          value = args[i];
          break;
        }
      }
      return value;
    }
  });

  searchbar.addEventListener('input', (e) => {
    debounce(() => {
      const result = filter(e.target.value);
      document.getElementById('components-list').innerHTML = templateData({title, pageIndex: result});
      scrollToSelected();
    });
  });

  const searchTerm = getUrlParameter('s', window.location.search);
  if(searchTerm){
    searchbar.value = searchTerm;
    const result = filter(searchTerm);
    document.getElementById('components-list').innerHTML = templateData({title, pageIndex: result});
  }

  scrollToSelected();

  searchbar.removeAttribute('disabled');
  addClass(searchbar.parentNode, 'ready');

  initNotFound();

  let searchSample = document.querySelectorAll('.search-sample');
  function sample(el){
    searchSample[i].addEventListener('click', (e) => {
      console.dir(el);
      scrollToSelected();
      const result = filter(el.text);
      document.getElementById('components-list').innerHTML = templateData({title, pageIndex: result});
      searchbar.value = el.text;
      e.preventDefault();

      if(hasClass(docContainer, 'sidebar-closed')){
        addClass(docContainer, 'sidebar-opened');
        removeClass(docContainer, 'sidebar-closed');
      }
      return false;
    });
  }
  for (var i = 0; i < searchSample.length; i++) {
    sample(searchSample[i]);
  }
}


function InitBrandMenu() {

  let menu = document.getElementById('current-brand');
  let initialBrand = localStorage.getItem('brand') || 'acom';

  menu.value = initialBrand;

  SwitchBrand(initialBrand).then((scope) => {
    RenderComponents(scope);
    if(typeof RenderOverview === 'function') {
      RenderOverview(scope);
    }
  });

  menu.addEventListener('change', (e) => {
    localStorage.setItem('brand', e.target.value);

    location.reload(true);
  });

  InitSearchComponents();
}

var menuLink = document.getElementById('doc-menu');
var docContainer = document.getElementById('doc-container');

function hasClass(el, className) {
  if (el.classList)
    return el.classList.contains(className);
  else
    return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
}
function addClass(el, className) {
  if (el.classList)
    el.classList.add(className);
  else if (!hasClass(el, className)) el.className += ' ' + className;
}
function removeClass(el, className) {
  if (el.classList)
    el.classList.remove(className);
  else if (hasClass(el, className)) {
    var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
    el.className=el.className.replace(reg, ' ');
  }
}
menuLink.onclick = function() {
  if(hasClass(docContainer, 'sidebar-closed')){
    addClass(docContainer, 'sidebar-opened');
    removeClass(docContainer, 'sidebar-closed');
  }else{
    addClass(docContainer, 'sidebar-closed');
    removeClass(docContainer, 'sidebar-opened');
  }
  return false;
};
if(typeof window !== 'undefined') {
  if (window.innerWidth <= 768){
    addClass(docContainer, 'sidebar-closed');
    removeClass(docContainer, 'sidebar-opened');
  }
}

var menugroup = document.getElementsByClassName('doc-menu-title');
for(var x=0; x<menugroup.length; x++){
  menugroup[x].addEventListener('click', function(e) {
    if(hasClass(this.parentNode, 'collapsed')){
      removeClass(this.parentNode, 'collapsed');
    }else{
      addClass(this.parentNode, 'collapsed');
    }
  });
}

setTimeout(function() {
  var previewLink = document.getElementById('doc-preview-close');
  if(previewLink != undefined){
    previewLink.onclick = function() {
      if(hasClass(docContainer, 'preview-closed')){
        addClass(docContainer, 'preview-opened');
        removeClass(docContainer, 'preview-closed');
      }else{
        addClass(docContainer, 'preview-closed');
        removeClass(docContainer, 'preview-opened');
      }
      return false;
    };
  }
}, 1000);

function EasterEgg() {
  if(location.search.indexOf('maestro=true') > -1) {
    (document.getElementById('fullbanner') || {style:{}}).style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  InitBrandMenu();
  EasterEgg();
});
