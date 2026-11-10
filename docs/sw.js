/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-8d0d8005'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "ec33a67a7f78a5a4df81ca6d275724aa"
  }, {
    "url": "pwa-512x512.png",
    "revision": "10f3749010ba4e1ad8a385c9f1d74f04"
  }, {
    "url": "pwa-192x192.png",
    "revision": "52e1bd7babef017f80b7ea16d9c62b46"
  }, {
    "url": "jalmitra-sw.js",
    "revision": "5564835b567c69305651b1d2aa91fe7f"
  }, {
    "url": "index.html",
    "revision": "032e11c623ab05ee1ee1654cbbe5eb9e"
  }, {
    "url": "icon.svg",
    "revision": "2240a94d07d41215e35cc9728a9b5121"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2dcdfc6604f0508c1760c7e920de4f81"
  }, {
    "url": "assets/main-HMNPL7Ty.js",
    "revision": null
  }, {
    "url": "assets/main-Bw1VuU6A.css",
    "revision": null
  }, {
    "url": "assets/index-CRg55TQy.js",
    "revision": null
  }, {
    "url": "assets/index-Bdw3dcgW.css",
    "revision": null
  }, {
    "url": "assets/drip_irrigated_healthy_crop_1794107197074-CXkoKdIB.jpg",
    "revision": null
  }, {
    "url": "assets/crop_leaf_disease_sample_1794107197354-DVngKkto.jpg",
    "revision": null
  }, {
    "url": "assets/cotton_water_stress_field_1794107194483-DCjvHr7E.jpg",
    "revision": null
  }, {
    "url": "assets/images/drip_irrigated_healthy_crop_1794107197074.jpg",
    "revision": null
  }, {
    "url": "assets/images/crop_leaf_disease_sample_1794107197354.jpg",
    "revision": null
  }, {
    "url": "assets/images/cotton_water_stress_field_1794107194483.jpg",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2dcdfc6604f0508c1760c7e920de4f81"
  }, {
    "url": "icon.svg",
    "revision": "2240a94d07d41215e35cc9728a9b5121"
  }, {
    "url": "pwa-192x192.png",
    "revision": "52e1bd7babef017f80b7ea16d9c62b46"
  }, {
    "url": "pwa-512x512.png",
    "revision": "10f3749010ba4e1ad8a385c9f1d74f04"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "ec33a67a7f78a5a4df81ca6d275724aa"
  }, {
    "url": "manifest.webmanifest",
    "revision": "38e3814e4bac9e96fe15806b8f316b3f"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/\/advisory-cache\/.*\.json$/i, new workbox.NetworkFirst({
    "cacheName": "jalmitra-advisory-data-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
