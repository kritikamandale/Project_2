# Data Privacy — Camera & Skin Analysis

## Your photo never leaves your device

When you use the SkinAI camera scan feature:

1. **Your camera feed is processed entirely in your browser.** The video stream from your camera is analysed by a TensorFlow.js model that runs locally on your device — not on our servers.

2. **Only skin characteristics are transmitted.** After analysis, we send a compact, mathematical representation of your skin's characteristics (a 512-number feature vector) to our server for validation and recommendation generation. This vector contains no visual information that could reconstruct your image.

3. **Your photo is discarded immediately.** The captured frame is held in memory only long enough to complete the analysis (typically 2–5 seconds). It is never written to disk, never uploaded, and never stored. Every scan record in our database is marked `image_permanently_deleted = TRUE`.

4. **EXIF metadata is stripped.** Before analysis, each captured frame is redrawn through the browser's Canvas API, which automatically removes all EXIF metadata (camera model, GPS location, timestamps) from the image data.

---

## What we store

For each scan session we store only:

| Field | Example | Purpose |
|-------|---------|---------|
| Skin type | "combination" | Recommendation engine |
| Skin type confidence | 0.87 | Quality tracking |
| Fitzpatrick tone (I–VI) | "IV" | Bias monitoring, retraining |
| Detected conditions | ["acne", "pigmentation"] | Recommendations |
| Lighting quality score | 0.92 | Quality tracking |
| Scan timestamp | 2026-06-10T10:30:00Z | History |
| `image_permanently_deleted` | true | Audit / compliance |
| `image_was_processed_locally` | true | Audit / compliance |

We do **not** store: your photo, your face geometry, any biometric identifier derived from your image, or your device's camera hardware information.

---

## Fitzpatrick skin tone — why we ask and how we use it

The [Fitzpatrick scale](https://en.wikipedia.org/wiki/Fitzpatrick_scale) (Types I–VI) was developed in 1975 to classify human skin colour. We use it for two purposes:

1. **Bias monitoring.** AI skin analysis models can perform less accurately on darker skin tones (IV–VI) due to underrepresentation in training data. We flag low-confidence results for darker tones and offer a manual override. We log confidence scores to Sentry to build a dataset for future model retraining.

2. **Climate-personalised recommendations.** Melanin content (which the Fitzpatrick scale approximates) affects how skin responds to UV exposure, humidity, and pollution — factors that vary significantly across Indian climates.

Your Fitzpatrick tone is stored alongside your scan data and is used only for these purposes. It is never shared with third parties.

---

## India's DPDP Act 2023 compliance

This feature is designed to comply with India's **Digital Personal Data Protection Act 2023** (DPDP Act):

- **Biometric data minimisation:** Raw facial images are classified as biometric data under the DPDP Act. We avoid storing them entirely — the mathematical feature vector is not biometric data because it cannot be used to identify you or reconstruct your image.
- **Purpose limitation:** Scan data is used only for skin analysis and product recommendations, not for advertising, profiling, or sale to data fiduciaries.
- **Consent:** You must provide explicit consent before the camera can be activated. Consent can be withdrawn at any time by deleting your account, which permanently removes all associated scan data.
- **Data principal rights:** You may request a copy of your stored scan data or request deletion via Settings → Data & Privacy.

---

## Security

- The feature vector is transmitted over HTTPS only.
- Our server validates the feature vector's statistical properties to detect spoofed or malformed submissions.
- All scan records are stored in an encrypted PostgreSQL database.
- Scan data is accessible only to your account; administrators can access it only for support purposes.

---

## Contact

For privacy inquiries: [majorprojectsvpcet@gmail.com](mailto:majorprojectsvpcet@gmail.com)

_Last updated: June 2026_
