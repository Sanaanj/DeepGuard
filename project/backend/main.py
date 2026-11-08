"""
DeepGuard detector backend (pretrained models, no training needed).

Two detectors are used:
  A) Organika/sdxl-detector  - general "AI-generated image" detector (labels: artificial / human)
  B) prithivMLmods/AI-vs-Deepfake-vs-Real - face deepfake / AI-face detector (Artificial / Deepfake / Real)

Final P(fake):
  - large face(s) found -> mean(A, B on the face crops)
  - otherwise           -> A only (B was trained on close-up faces, not group photos)

Also returns a Grad-CAM heatmap showing where the model found evidence.

Run:  uvicorn main:app --port 8000
"""
import io
import json
import math
import os
import re

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

MODEL_A_ID = os.environ.get("MODEL_A", "Organika/sdxl-detector")
MODEL_B_ID = os.environ.get("MODEL_B", "prithivMLmods/AI-vs-Deepfake-vs-Real")

device = "cuda" if torch.cuda.is_available() else "cpu"
FAKE_RE = re.compile(r"fake|artificial|synthetic|\bai\b|generated|manipulat", re.I)
REAL_RE = re.compile(r"real|human|authentic|genuine|original", re.I)


class Detector:
    def __init__(self, model_id: str):
        print(f"Loading {model_id} on {device} ...")
        self.model_id = model_id
        self.processor = AutoImageProcessor.from_pretrained(model_id)
        self.model = AutoModelForImageClassification.from_pretrained(model_id).to(device).eval()
        self.id2label = {int(k): v for k, v in self.model.config.id2label.items()}
        self.fake_ids = [i for i, l in self.id2label.items() if FAKE_RE.search(l)]
        self.real_ids = [i for i, l in self.id2label.items() if REAL_RE.search(l)]
        if not self.fake_ids and not self.real_ids:
            raise RuntimeError(f"{model_id}: cannot tell which label means fake: {self.id2label}")
        print("  labels:", self.id2label, "-> fake ids:", self.fake_ids)

    def _p_fake(self, probs: torch.Tensor) -> torch.Tensor:
        if self.fake_ids:
            return probs[self.fake_ids].sum()
        return 1.0 - probs[self.real_ids].sum()

    def predict(self, image: Image.Image, explain: bool):
        inputs = self.processor(images=image, return_tensors="pt").to(device)
        if not explain:
            with torch.no_grad():
                probs = torch.softmax(self.model(**inputs).logits, dim=-1)[0]
            return float(self._p_fake(probs)), None, {self.id2label[i]: float(probs[i]) for i in range(len(probs))}

        # Grad-CAM on the last token grid (works for ViT and Swin)
        with torch.enable_grad():
            out = self.model(**inputs, output_hidden_states=True)
            hs = out.hidden_states[-1]
            hs.retain_grad()
            probs = torch.softmax(out.logits, dim=-1)[0]
            target = torch.log(self._p_fake(probs).clamp_min(1e-6))
            self.model.zero_grad()
            target.backward()
        grads = hs.grad[0]            # (tokens, C)
        acts = hs.detach()[0]         # (tokens, C)
        weights = grads.mean(dim=0)   # (C,)
        cam = torch.relu((acts * weights).sum(dim=-1))
        n = cam.shape[0]
        if int(math.isqrt(n)) ** 2 != n and int(math.isqrt(n - 1)) ** 2 == n - 1:
            cam = cam[1:]             # drop CLS token (ViT)
            n -= 1
        side = int(math.isqrt(n))
        heat = None
        if side * side == n:
            cam = cam.reshape(side, side)
            cam = cam - cam.min()
            if float(cam.max()) > 1e-8:
                cam = cam / cam.max()
            heat = cam.cpu().tolist()
        p = float(self._p_fake(probs.detach()))
        return p, heat, {self.id2label[i]: float(probs[i]) for i in range(len(probs))}


det_a = Detector(MODEL_A_ID)
det_b = Detector(MODEL_B_ID)

app = FastAPI(title="DeepGuard detector")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "model": f"{MODEL_A_ID} + {MODEL_B_ID}", "device": device}


MIN_FACE_PX = 96   # smaller faces are too blurry for the face detector
MAX_FACES = 4


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    boxes: str = Form("[]"),   # JSON [[x1,y1,x2,y2], ...] in the pixel coordinates of the sent image
    explain: int = Form(0),
):
    try:
        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the image")

    # A) general AI-image detector on the whole image
    pa, heat, sa = det_a.predict(image, bool(explain))

    # B) face-deepfake detector, only on reasonably large face CROPS
    #    (it was trained on single close-up faces, not group photos)
    face_scores = []
    try:
        box_list = json.loads(boxes)
    except Exception:
        box_list = []
    big = [b for b in box_list if min(b[2] - b[0], b[3] - b[1]) >= MIN_FACE_PX]
    big.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
    for x1, y1, x2, y2 in big[:MAX_FACES]:
        w, h = x2 - x1, y2 - y1
        pad = 0.3
        crop = image.crop((
            max(0, int(x1 - w * pad)), max(0, int(y1 - h * pad)),
            min(image.width, int(x2 + w * pad)), min(image.height, int(y2 + h * pad)),
        ))
        pb_i, _, _ = det_b.predict(crop, False)
        face_scores.append(pb_i)

    if face_scores:
        pb = sum(face_scores) / len(face_scores)
        p = (pa + pb) / 2
    else:
        pb, p = None, pa

    print(f"[predict] general_ai={pa:.3f}  face_model={'n/a' if pb is None else f'{pb:.3f}'} "
          f"(faces used: {len(face_scores)}/{len(box_list)})  -> P(fake)={p:.3f}")

    return {
        "fake_probability": p,
        "heatmap": heat,
        "detectors": {
            "general_ai": {"model": MODEL_A_ID, "p_fake": pa, "scores": sa},
            "face": {"model": MODEL_B_ID, "p_fake": pb, "faces_used": len(face_scores)},
        },
    }
