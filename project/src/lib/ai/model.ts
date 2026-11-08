import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

let model: tf.LayersModel | null = null;
let modelLoading: Promise<tf.LayersModel> | null = null;
let modelTrained = false;

/**
 * DeepGuard CNN Model Architecture
 *
 * A custom CNN designed for deepfake detection inspired by Xception-style
 * depthwise separable convolutions. The model analyzes face regions for
 * manipulation artifacts including blending boundaries, texture inconsistencies,
 * and frequency-domain anomalies.
 *
 * Architecture:
 * - Input: 128x128x3 (aligned face region)
 * - 4 depthwise separable conv blocks with batch norm and spatial dropout
 * - Global average pooling
 * - Dense layers with dropout
 * - Binary output: P(manipulated) via sigmoid
 *
 * Output meaning:
 * - sigmoid output = P(manipulated) in [0, 1]
 * - 0.0 = strongly authentic, 1.0 = strongly manipulated
 * - Threshold: > 0.5 = manipulated, < 0.5 = authentic
 */

export async function buildModel(): Promise<tf.LayersModel> {
  const input = tf.input({ shape: [128, 128, 3], name: 'face_input' });

  let x = tf.layers.conv2d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu', name: 'entry_conv' }).apply(input) as tf.SymbolicTensor;
  x = tf.layers.batchNormalization({ name: 'entry_bn' }).apply(x) as tf.SymbolicTensor;
  x = tf.layers.maxPooling2d({ poolSize: 2, name: 'entry_pool' }).apply(x) as tf.SymbolicTensor;

  for (let i = 0; i < 4; i++) {
    const filters = 64 * Math.pow(2, Math.floor(i / 2));
    x = tf.layers.separableConv2d({
      filters,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu',
      name: `sep_conv_${i}`,
    }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.batchNormalization({ name: `sep_bn_${i}` }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dropout({ rate: 0.15, name: `sep_dropout_${i}` }).apply(x) as tf.SymbolicTensor;
    if (i % 2 === 1) {
      x = tf.layers.maxPooling2d({ poolSize: 2, name: `sep_pool_${i}` }).apply(x) as tf.SymbolicTensor;
    }
  }

  x = tf.layers.globalAveragePooling2d({ name: 'gap' }).apply(x) as tf.SymbolicTensor;
  x = tf.layers.dense({ units: 128, activation: 'relu', name: 'dense_1' }).apply(x) as tf.SymbolicTensor;
  x = tf.layers.dropout({ rate: 0.4, name: 'dense_dropout' }).apply(x) as tf.SymbolicTensor;
  x = tf.layers.dense({ units: 64, activation: 'relu', name: 'dense_2' }).apply(x) as tf.SymbolicTensor;
  x = tf.layers.dropout({ rate: 0.3, name: 'dense_dropout_2' }).apply(x) as tf.SymbolicTensor;
  const output = tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'manipulation_prob' }).apply(x) as tf.SymbolicTensor;

  const m = tf.model({ inputs: input, outputs: output, name: 'DeepGuard-CNN-v1' });
  m.compile({
    optimizer: tf.train.adam(0.0001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  return m;
}

export async function getModel(): Promise<tf.LayersModel> {
  if (model) return model;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    await tf.ready();
    console.log('[DeepGuard] Initializing TensorFlow backend:', tf.getBackend());
    const m = await buildModel();
    model = m;
    console.log('[DeepGuard] Model built. Architecture:');
    m.summary();
    console.log('[DeepGuard] Model trained:', modelTrained);
    return m;
  })();

  return modelLoading;
}

export async function warmupModel(): Promise<void> {
  const m = await getModel();
  const dummy = tf.zeros([1, 128, 128, 3]);
  const result = m.predict(dummy) as tf.Tensor;
  const val = (await result.data())[0];
  console.log('[DeepGuard] Warmup prediction (untrained, expected ~0.5):', val);
  result.dispose();
  dummy.dispose();
}

export function isModelTrained(): boolean {
  return modelTrained;
}

export function setModelTrained(value: boolean): void {
  modelTrained = value;
  console.log('[DeepGuard] Model trained state set to:', value);
}

/**
 * Run inference on a preprocessed face tensor.
 * Returns manipulation probability [0, 1] where:
 *   0.0 = authentic, 1.0 = manipulated
 *
 * If the model is untrained, the sigmoid output will be ~0.5 (random weights
 * produce near-zero logits → sigmoid(0) = 0.5). We do NOT silently replace
 * this with a fixed value — we return the actual model output so the
 * evidence-fusion module can properly label the result as inconclusive.
 *
 * If inference produces NaN (genuine failure), we throw an error rather
 * than returning a misleading 0.5.
 */
export async function runInference(faceTensor: tf.Tensor3D | tf.Tensor4D): Promise<number> {
  const m = await getModel();

  let batched: tf.Tensor4D;
  let needsDispose = false;
  if (faceTensor.shape.length === 3) {
    batched = tf.expandDims(faceTensor, 0);
    needsDispose = true;
  } else {
    batched = faceTensor as tf.Tensor4D;
  }

  const prediction = m.predict(batched) as tf.Tensor;
  const prob = await prediction.data();
  const result = prob[0];

  prediction.dispose();
  if (needsDispose) batched.dispose();

  if (isNaN(result) || !isFinite(result)) {
    throw new Error('CNN inference produced NaN/Infinity — model may have failed to initialize');
  }

  console.log('[DeepGuard] CNN raw prediction:', result, '(0=authentic, 1=manipulated)');
  return result;
}

/**
 * Generate Grad-CAM heatmap for explainability.
 * Uses the last convolutional layer's activations weighted by their
 * mean activation intensity as an attention map.
 */
export async function generateGradCAM(
  faceTensor: tf.Tensor3D,
  targetLayerName: string = 'sep_conv_3'
): Promise<{
  heatmap: Float32Array;
  width: number;
  height: number;
  prediction: number;
}> {
  const m = await getModel();

  return tf.tidy(() => {
    const batched = tf.expandDims(faceTensor, 0);

    const layerOutput = m.getLayer(targetLayerName).output as tf.SymbolicTensor;
    const camModel = tf.model({ inputs: m.inputs, outputs: [layerOutput, m.outputs[0]] });

    const [convOutput, prediction] = camModel.predict(batched) as tf.Tensor[];
    const predVal = prediction.dataSync()[0];

    const convData = convOutput.dataSync();
    const convShape = convOutput.shape as [number, number, number, number];
    const [, height, width, channels] = convShape;

    const weights = new Float32Array(channels);
    for (let c = 0; c < channels; c++) {
      let sum = 0;
      let count = 0;
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const idx = ((h * width + w) * channels + c);
          sum += Math.abs(convData[idx]);
          count++;
        }
      }
      weights[c] = sum / count;
    }

    const heatmap = new Float32Array(height * width);
    let maxVal = 0;
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        let val = 0;
        for (let c = 0; c < channels; c++) {
          const idx = ((h * width + w) * channels + c);
          val += convData[idx] * weights[c];
        }
        heatmap[h * width + w] = val;
        if (Math.abs(val) > maxVal) maxVal = Math.abs(val);
      }
    }

    if (maxVal > 0) {
      for (let i = 0; i < heatmap.length; i++) {
        heatmap[i] = Math.max(0, heatmap[i]) / maxVal;
      }
    }

    return { heatmap, width, height, prediction: predVal };
  }) as { heatmap: Float32Array; width: number; height: number; prediction: number };
}

export async function trainOnBatch(
  images: tf.Tensor4D,
  labels: tf.Tensor2D,
  modelOverride?: tf.LayersModel
): Promise<{ loss: number; accuracy: number }> {
  const m = modelOverride ?? (await getModel());
  const result = await m.trainOnBatch(images, labels);
  const [loss, accuracy] = result as number[];
  modelTrained = true;
  return { loss, accuracy };
}

export function disposeModel() {
  if (model) {
    model.dispose();
    model = null;
  }
  modelLoading = null;
  modelTrained = false;
}
