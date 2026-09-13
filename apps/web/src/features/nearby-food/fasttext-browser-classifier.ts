import {
  formatNearbyRestaurantForFastText,
  parseNearbyFastTextLabel,
} from './fasttext-input';
import {
  classifyKnownRestaurantBrand,
  classifyNearbyRestaurantName,
  hasStrongNearbyLuosifenSignal,
  type NearbyRestaurantClassification,
} from './restaurant-type-classifier';

export type FastTextPredictionVector = {
  size(): number;
  get(index: number): readonly [number, string];
};

export type FastTextModelLike = {
  predict(text: string, k: number, threshold: number): FastTextPredictionVector;
};

export type FastTextModelLoader = () => Promise<FastTextModelLike>;

export type NearbyFastTextClassifier = {
  ready(): Promise<void>;
  classify(name: string, amapType: string): Promise<NearbyRestaurantClassification>;
};

const FASTTEXT_MODEL_URL = '/models/nearby-classifier/nearby-restaurant-classifier.ftz';
const FASTTEXT_MIN_CONFIDENCE = 0.6;

type FastTextBrowserRuntime = {
  FastText: new () => { loadModel(url: string): Promise<FastTextModelLike> };
  addOnPostRun(callback: () => void): void;
};

const loadModelFromBrowserAssets: FastTextModelLoader = async () => {
  const runtime = await import('./fasttext-runtime/fasttext.js') as FastTextBrowserRuntime;
  await new Promise<void>((resolve) => runtime.addOnPostRun(resolve));
  return new runtime.FastText().loadModel(FASTTEXT_MODEL_URL);
};

function fallbackClassification(name: string, amapType: string): NearbyRestaurantClassification {
  return classifyNearbyRestaurantName(name, amapType);
}

function readTopPrediction(predictions: FastTextPredictionVector): { label: string; probability: number } | undefined {
  if (predictions.size() < 1) return undefined;
  const prediction = predictions.get(0);
  if (!Array.isArray(prediction) || typeof prediction[1] !== 'string' || typeof prediction[0] !== 'number') return undefined;
  if (!Number.isFinite(prediction[0])) return undefined;
  return { label: prediction[1], probability: Math.max(0, Math.min(1, prediction[0])) };
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
      const knownBrandClassification = classifyKnownRestaurantBrand(name);
      if (knownBrandClassification) return knownBrandClassification;

      try {
        const model = await getModel();
        const prediction = readTopPrediction(model.predict(formatNearbyRestaurantForFastText(name, amapType), 1, 0));
        const category = prediction ? parseNearbyFastTextLabel(prediction.label) : undefined;
        if (!prediction || !category || prediction.probability < FASTTEXT_MIN_CONFIDENCE) {
          return fallbackClassification(name, amapType);
        }
        if (category === '螺蛳粉' && !hasStrongNearbyLuosifenSignal(name, amapType)) {
          return fallbackClassification(name, amapType);
        }
        return { category, confidence: prediction.probability, source: 'fasttext' };
      } catch {
        return fallbackClassification(name, amapType);
      }
    },
  };
}
