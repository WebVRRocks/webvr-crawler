#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const bodyParser = require('body-parser');
const cors = require('cors');
const deepAssign = require('deep-assign');
const elasticlunr = require('elasticlunr');
const express = require('express');
const ip = require('ip');

const logger = require('./logger')(__filename);
let env = process.env.NODE_ENV || 'development';
let host = parseInt(process.env.HOST || 3000, 10);
let port = process.env.PORT || 3000;
let apiHostProd = 'https://search.webvr.rocks';
let apiHost = apiHostProd;
let server = null;

const rootPath = path.join(__dirname);
const dbPath = path.join(rootPath, 'preload.txt');

const app = express()
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({extended: true}))
  .options('*', cors())
  .use(cors())
  .set('server_host', apiHost);

if (!module.parent) {
  server = app.listen(port, host, () => {
    env = app.get('env');

    if (env === 'development') {
      apiHost = `http://${ip.address()}:${server.address().port}`;
    }

    app.set('server_host', apiHost);

    console.log('Listening on %s', apiHost);

    new Routes(app);
  });
}

function Routes (app, routes) {
  let sites = new Sites();
  routes = sites.routes || {
    get: {
      '/': sites.api.root,
      '/sites': sites.api.getAll
    }
  };
  Object.keys(routes).forEach(routeMethod => {
    Object.keys(routes[routeMethod]).forEach(routePath => {
      app[routeMethod](routePath, routes[routeMethod][routePath]);
    });
  });
  return routes;
}

function Search (name, opts) {
  let self = this;

  if (typeof name === 'string') {
    opts = opts || {};
    opts.name = name;
  } else if (typeof name === 'object') {
    opts = name || {};
  }

  const optsDefaults = {
    name: 'main',
    paths: {
      root: './data/main/',
      documents: './documents.json',
      index: './index.json'
    },
    idName: '_id'
  };

  opts = deepAssign(optsDefaults, opts);

  self.opts = opts || {};

  self.name = self.opts.name || optsDefaults.name;
  self.paths = self.opts.path || {};
  self.paths.root = path.join(process.cwd(), self.opts.paths.root || `./data/${self.name}`);
  self.paths.documents = path.join(self.paths.root, self.opts.paths.documents || 'documents.json');
  self.paths.index = path.join(self.paths.root, self.opts.paths.index || 'index.json');

  self.idName = self.opts.idName || optsDefault.idName;
  self.filename = self.opts.filename;
  self.fields = self.opts.fields || {};
  self.index = null;
  self._lookup = {};

  self.ready = new Promise(resolve => {
    elasticlunr(function () {
      this.setRef(self._idName);

      Object.keys(self.fields).forEach(key => {
        this.addField(self.fields[key]);
      }, this);
    });
  }).then(
    self.importDocs()
  ).then(index => {
    self.index = index;
  }).catch(err => {
    if (err) {
      // console.error('Error creating search index:', err);
      throw err;
    }
  });
}

// TODO: Add methods for `write` and `export`.

Search.prototype.importIndex = function (defaultIndex) {
  var self = this;
  return this.readIndex(defaultIndex).then(self.updateIndex);
};

Search.prototype.importDocs = function (defaultDocs) {
  var self = this;
  return this.readDocs(defaultDocs).then(self.updateDocs);
};

Search.prototype.readIndex = function (defaultIndex) {
  const self = this;
  let index = {};

  if (typeof defaultIndex !== 'undefined') {
    docs = self.parseIndex(defaultIndex);
  }

  return new Promise((resolve, reject) => {
    fs.readFile(self.paths.index, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(data);
    });
  }).then(data => deepAssign(index, self.parseIndex(data)));
};

Search.prototype.readDocs = function (defaultDocs) {
  const self = this;
  let docs = [];

  if (typeof defaultDocs !== 'undefined') {
    docs = self.parseDocs(defaultDocs);
  }

  return new Promise((resolve, reject) => {
    fs.readFile(self.paths.documents, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(data.toString());
    });
  }).then(data => {
    data = self.parseDocs(data);
    return data;
  });
};

Search.prototype.updateIndex = function (index) {
  this.index = index;
  return index;
};

Search.prototype.updateDocs = function (docs) {
  var self = this;
  return docs.map((doc, idx) => self.addDoc(doc, idx));
};

Search.prototype.parseIndex = function (data) {
  let index = {};

  try {
    index = JSON.parse(data);
  } catch (e) {
  }

  return index;
};

Search.prototype.parseDocs = function (data) {
  let docs = [];

  if (data) {
    if (typeof data === 'string') {
      try {
        docs = JSON.parse(data);
      } catch (e) {
      }
      if (docs) {
        return docs;
      }
    } else if (data.isArray(data)) {
      return docs;
    }

    const dataLines = (data || '').toString().trim().split('\n');
    let doc = {};

    dataLines.forEach((line, idx) => {
      doc = {};

      try {
        doc = JSON.parse(line);
      } catch (e) {
      }

      if (!doc) {
        return;
      }

      docs.push(doc);
    });
  }

  return docs;
};

Search.prototype.transformDoc = function (item, idx) {
  item = item || {};
  this.setDocKey(item, idx);
  return item;
};

Search.prototype.addDoc = function (item, idx) {
  if (typeof idx !== 'undefined') {
    item = this._lookup[getDocKey(item, idx)];
  }

  this.transformDoc(item, idx);
  this.index.addDoc(item);
  index._lookup[getDocKey(item)] = item;
  return item;
};

Search.prototype.getDoc = (item, idx) => {
  return this._lookup[getDocKey(item, idx)] || null;
};

Search.prototype.updateDoc = function (item, idx) {
  if (typeof idx !== 'undefined') {
    item = this._lookup[getDocKey(item, idx)];
  }

  this.transformDoc(item, idx);
  this.index.updateDoc(item);
  this._lookup[getDocKey(item)] = item;
  return item;
};

Search.prototype.removeDoc = function (item, idx) {
  if (typeof idx !== 'undefined') {
    item = index._lookup[getDocKey(item, idx)];
  }

  this.transformDoc(item, idx);
  const result = index.removeDoc(item);
  if (getDocKey(item) in index._lookup) {
    delete index._lookup[getDocKey(item)];
    return true;
  }
  return result;
};

Search.prototype.setDocKey = function (item, idx) {
  const self = this;
  self.setDocKey = (item, idx) => {
    if (self.idName in item) {
      return item;
    }
    if ('id' in item[self.idName]) {
      item[self.idName] = String(item.id);
    }
    if ('_id' in item[self.idName]) {
      item[self.idName] = String(item._id);
    }
    if (typeof idx !== 'undefined') {
      item[self.idName] = String(idx);
    }
    return item;
  };
};

Search.prototype.getDocKey = function (item, idx) {
  if (!item && typeof idx === 'undefined') {
    return null;
  }
  if (typeof item === 'string') {
    return item;
  }
  if (typeof item === 'object' && this.idName in item) {
    return String(item[this.idName]);
  }
  return String(item);
};

Search.prototype.search = function (q, config) {
  return this.index.search(q, config);
};

function Sites () {
  const self = this;
  self.name = 'sites';
  self.search = {};
  self.search = new Search({
    name: self.name,
    fields: [
      'id',
      'name',
      'url',
      'description',
      'authors',
      'tags',
      'source_code_url',
      'screenshots',
      'case_study_or_landing_page_urls',
      'videos',
      'video_urls',
      'notes',
      'featured',
      'slug',
      'createdTime',
      'compat_reports',
      'uses_frameworks',
      'tweet_urls',
      'webvr_api_version_support',
      'dependencies',
      'genres',
      'reddit_urls',
      'community_picks',
      'evaluation',
      'support_for_htc_vive',
      'support_for_htc_vive_controllers',
      'support_for_positional',
      'support_for_roomscale',
      'support_for_standing',
      'support_for_oculus_touch_controllers',
      'support_for_oculus_rift',
      'support_for_google_daydream',
      'support_for_osvr_hdk2',
      'support_for_google_cardboard_android',
      'support_for_google_cardboard_ios copy',
      'support_for_google_daydream_controller',
      'support_for_leap_motion',
      'date_released',
      'aframe_version',
      'threejs_version',
      'itchio_links',
      'support_for_multiplayer',
      'chromeexperiments_urls',
      'dependencies_notes',
      'date_updated',
      'awoa_feature_number',
      'date_added'
    ],
    idName: 'id',
    paths: {
      root: './data/sites/',
      documents: './documents.json',
      index: './index.json'
    }
  });
  self.api = {
    root: (req, res) => {
      const apiUrlNamespace = `${apiHost}/${self.name}`;
      return res.json({
        sites_url: apiUrlNamespace,
        site_search_url: `${apiUrlNamespace}?q={query}{&type,page,per_page,sort,order}`
      });
    },
    getAll: (req, res) => {
      // URL: `${apiHost}/sites`

      let searchConfig = {
        fields: {
          url: {
            boost: 2,
            bool: 'OR',
            expand: true
          },
          type: {
            bool: 'AND'
          },
          message: {
            boost: 1
          }
        }
      };

      return self.search.ready.then(() => {
        return res.json(self.search.search(req.params.q || '', searchConfig));
      }).catch(err => {
        console.error('Search error:', err);
      });
    }
  };
};

module.exports = {
  app: app,
  server: server
};
