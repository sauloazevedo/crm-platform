const imageTypes = new Set(["image/jpeg", "image/png"]);

type CompressImageOptions = {
  maxBytes: number;
  maxDimension?: number;
  initialQuality?: number;
  minQuality?: number;
};

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number) {
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlByteLength(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;

  return Math.floor((base64.length * 3) / 4) - padding;
}

function getCanvas(image: HTMLImageElement, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare image compression.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

export function isCompressibleImage(file: File) {
  return imageTypes.has(file.type);
}

export async function compressImageFile(file: File, options: CompressImageOptions) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const minQuality = options.minQuality ?? 0.52;
  const maxDimension = options.maxDimension ?? 1400;
  let canvas = getCanvas(image, maxDimension);
  let quality = options.initialQuality ?? 0.82;
  let output = canvasToDataUrl(canvas, quality);

  while (dataUrlByteLength(output) > options.maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.08);
    output = canvasToDataUrl(canvas, quality);
  }

  let dimension = Math.max(canvas.width, canvas.height);

  while (dataUrlByteLength(output) > options.maxBytes && dimension > 360) {
    dimension = Math.floor(dimension * 0.86);
    canvas = getCanvas(image, dimension);
    quality = options.initialQuality ?? 0.82;
    output = canvasToDataUrl(canvas, quality);

    while (dataUrlByteLength(output) > options.maxBytes && quality > minQuality) {
      quality = Math.max(minQuality, quality - 0.08);
      output = canvasToDataUrl(canvas, quality);
    }
  }

  if (dataUrlByteLength(output) > options.maxBytes) {
    throw new Error("Image could not be compressed enough.");
  }

  return {
    dataUrl: output,
    base64: output.split(",")[1] ?? "",
    contentType: "image/jpeg",
    size: dataUrlByteLength(output),
  };
}
