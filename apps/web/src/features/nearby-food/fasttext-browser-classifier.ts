import {
  formatNearbyRestaurantForFastText,
  parseNearbyFastTextLabel,
} from './fasttext-input';
import {
  classifyNearbyRestaurantName,
  type NearbyRestaurantClassification,
} from './restaurant-type-classifier';

export type FastTextPredictionVector = {
  size(): number;
  get(index: number): { first: number; second: string };
};

export type FastTextModelLike = {
  predict(text: string, k: number, threshold: number): FastTextPredictionVector;
};

export type FastTextModelLoader = () => Promise<FastTextModelLike>;

export type NearbyFastTextClassifier = {
  ready(): Promise<void>;
  classify(name: string, amapType: string): Promise<NearbyRestaurantClassification>;
};

const FASTTEXT_RUNTIME_URL = '/models/nearby-classifier/fasttext.js';
const FASTTEXT_MODEL_URL = '/models/nearby-classifier/nearby-restaurant-classifier.ftz';

type FastTextBrowserRuntime = {
  FastText: new () => { loadModel(url: string): Promise<FastTextModelLike> };
  addOnPostRun(callback: () => void): void;
};

const loadModelFromBrowserAssets: FastTextModelLoader = async () => {
  const runtime = await import(/* @vite-ignore */ FASTTEXT_RUNTIME_URL) as FastTextBrowserRuntime;
  await new Promise<void>((resolve) => runtime.addOnPostRun(resolve));
  return new runtime.FastText().loadModel(FASTTEXT_MODEL_URL);
};

function fallbackClassification(name: string, amapType: string): NearbyRestaurantClassification {
  return classifyNearbyRestaurantName(name, amapType);
}

function readTopPrediction(predictions: FastTextPredictionVector): { label: string; probability: number } | undefined {
  if (predictions.size() < 1) return undefined;
  const prediction = predictions.get(0);
  if (!prediction || typeof prediction.second !== 'string' || typeof prediction.first !== 'number') return undefined;
  if (!Number.isFinite(prediction.first)) return undefined;
  return { label: prediction.second, probability: Math.max(0, Math.min(1, prediction.first)) };
}

export function createNearbyFastTextClassifier(options: { loadModel?: FastTextModelLoader } = {}): NearbyFastTextClassifier {
  const loadModel = options.loadModel ?? loadModelFromBrowserAssets;
  let modelPromise: Promise<FastTextModelLike> | undefined;

  const getModel = () => {
    modelPromise ??= loadModel();
    return modelPromise;
  };

  return {
    async ready() {
      try {
        await getModel();
      } catch {
        // The caller can continue rendering with the synchronous fallback classifier.
      }
    },
    async classify(name, amapType) {
      try {
        const model = await getModel();
        const prediction = readTopPrediction(model.predict(formatNearbyRestaurantForFastText(name, amapType), 1, 0));
        const category = prediction ? parseNearbyFastTextLabel(prediction.label) : undefined;
        if (!prediction || !category) return fallbackClassification(name, amapType);
        return { category, confidence: prediction.probability, source: 'fasttext' };
      } catch {
        return fallbackClassification(name, amapType);
      }
    },
  };
}
