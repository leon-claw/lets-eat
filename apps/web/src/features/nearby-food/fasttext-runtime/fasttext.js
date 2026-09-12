/**
 * Browser adapter for the official fastText WebAssembly build.
 *
 * Recent Emscripten versions expose an asynchronous ES-module factory, while
 * the upstream wrapper assumes a synchronous Module object. This small
 * adapter keeps only the API used by the nearby-food classifier and waits for
 * the factory before constructing the native FastText object.
 */

import fastTextModularized from './fasttext_wasm.js';

const fastTextModulePromise = fastTextModularized();
const modelFileInWasmFs = 'model.bin';

const addOnPostRun = (callback) => {
  void fastTextModulePromise.then(callback, callback);
};

class FastTextModel {
  constructor(fastTextNative) {
    this.f = fastTextNative;
  }

  predict(text, k = 1, threshold = 0.0) {
    return this.f.predict(text, k, threshold);
  }
}

class FastText {
  async loadModel(url) {
    const fastTextModule = await fastTextModulePromise;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load fastText model: ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    fastTextModule.FS.writeFile(modelFileInWasmFs, bytes);

    const fastTextNative = new fastTextModule.FastText();
    fastTextNative.loadModel(modelFileInWasmFs);
    return new FastTextModel(fastTextNative);
  }
}

export { FastText, addOnPostRun };
