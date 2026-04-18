# AI-Powered Skin Analysis &
Personalized Skincare Product
Recommendation System

```
Author(s): Kritika Mandale
Affiliation: St. Vincent Pallotti College of Engineering and Technology
Date: 2026
```

## Abstract
```
Consumers struggle to find suitable skincare products, often wasting money on mismatched options. This project presents an AI-powered web application that captures a user selfie, analyzes skin conditions via Claude Vision API, asks adaptive follow-up questions, and fetches real, budget-filtered products from live e-commerce platforms using SerpAPI. The system delivers a personalized, dermatologist-like experience without clinical costs.
- The global AI in skincare market was valued at USD 1.19 billion in 2024 and is projected to reach USD 4.28 billion by 2035 at a CAGR of 12.1%.

```

## introduction
```
Billions of dollars are spent annually on skincare products that do not match individual skin types. Traditional guidance relies on expensive consultations or generic brand quizzes. AI and computer vision now enable real-time, image-based skin assessment at scale. This project combines skin diagnosis with live product discovery to solve a clear, unmet consumer need.
- 83% of Gen Z beauty consumers expect personalized recommendations (McKinsey & Business of Fashion, 2024).
- Companies implementing AI technologies saw 38% higher customer engagement and 30% better conversion rates (McKinsey, 2024).

```
## Literature review
```
Lee et al. (2024) built a deep neural network combining cosmetic ingredient analysis with facial skin status assessment for personalized product recommendations. Rajegowda et al. (2024) developed a CNN-based system in Extended Reality (XR), though limited by high computational demands. Vinit et al. (IEEE) proposed a hybrid KNN + EfficientNet B0 model for skin type and acne detection. Platforms like Haut.AI have demonstrated commercial viability. A key gap remains: connecting live market pricing to real-time diagnosis.
- EfficientNet B0 hybrid model achieved 87.10% training accuracy and 80% validation accuracy (IEEE, 2023).
- Haut.AI reports 98% diagnostic accuracy, trained on 3M+ facial images across 20+ skin health metrics.

```

## Methodology
```
The system follows a five-stage pipeline. First, the user captures a selfie which is sent to Claude's Vision API for skin analysis, identifying conditions such as acne, oiliness, dryness, uneven tone, and wrinkles. Second, the AI generates a customized follow-up questionnaire covering sensitivity, allergies, lifestyle, age, and skincare goals to enrich the skin profile. Third, the combined inputs produce a structured skin diagnosis. Fourth, SerpAPI queries live e-commerce platforms — such as Amazon, Nykaa, and Flipkart — using diagnosis-derived search terms to fetch real, currently available products. Fifth, results are ranked and filtered against the user's stated budget, presenting the top recommendations with price, platform, and product details.
```


## implementation
```
Programming Languages:  JavaScript / TypeScript (Frontend), Python (optional preprocessing backend).
Frameworks & Libraries:  React.js, Node.js / Express, Axios, Tailwind CSS.
AI & Vision:  Claude Vision API (skin image analysis), Claude Text API (questionnaire & diagnosis generation).
Product Fetching:  SerpAPI — real-time Google Shopping and e-commerce search results with CAPTCHA handling and proxy management.
Other Tools:  Browser Camera API (selfie capture), REST APIs, JSON (data interchange), Git / GitHub (version control).

```

## Results and Discussion
```
End-to-end testing confirmed successful skin diagnosis and product retrieval. Claude Vision accurately identified oiliness, acne, and hyperpigmentation across varied lighting and skin tones. SerpAPI returned live product listings with pricing from Amazon and Nykaa within seconds. Budget filtering correctly segmented products into tiers (e.g., under ₹500 / ₹500–₹1500 / ₹1500+). Full flow completed in under 30 seconds on average.
- Olay's similar AI selfie-based skin advisor doubled sales conversion rates and increased average basket size by 40% in key markets.
- AI beauty tools have shown 47% higher ingredient effectiveness prediction accuracy and 58% faster formulation optimization (Mintel, 2024).

```

## Limitation
```
Image quality is highly dependent on lighting and camera angle, reducing diagnosis accuracy in poor conditions. The system is not a medical tool and cannot detect clinical conditions like eczema or melanoma. SerpAPI costs scale quickly and face legal uncertainty following Google's lawsuit against the service in December 2025. Fetched listings may include out-of-stock or region-restricted items. Skin tone diversity bias remains a challenge without large, representative training datasets.
- SerpAPI charges $15 per 1,000 requests, making high-volume usage potentially cost-prohibitive for large user bases.


```

## Future Scope
```
Future versions will incorporate longitudinal skin tracking via periodic selfies, enabling adaptive routine updates. An ingredient safety checker (via EWG Skin Deep database) will flag allergens. Multilingual support will improve accessibility across India. Replacing SerpAPI with official retailer affiliate APIs (Nykaa, Flipkart) will improve legal compliance and data accuracy. AR-powered virtual product try-on and environmental factor inputs (humidity, pollution) are also planned.
- The global AI in beauty market is projected to reach USD 16.3 billion by 2026, growing at a CAGR of 25.4% (Statista, 2024).

```
## Conculusion  
```
This project successfully demonstrates an end-to-end AI pipeline for skin diagnosis and budget-aware product recommendation. By combining Claude Vision API, adaptive questioning, and live SerpAPI product fetching, the system delivers an accessible, personalized skincare experience previously available only through expensive dermatological consultations. The commercial viability of this approach is validated by real-world tools like Olay's AI Skin Advisor. Future enhancements will elevate accuracy, legal compliance, and user experience.
```
## References
```
[1]  J. Lee et al., "Deep learning-based skin care product recommendation: A focus on cosmetic ingredient analysis and facial skin conditions," J. Cosmet. Dermatol., vol. 23, no. 6, pp. 2066–2077, 2024. DOI: 10.1111/jocd.16218
[2]  G. M. Rajegowda et al., "An AI-Assisted Skincare Routine Recommendation System in XR," in Proc. AIVR, Springer, 2023, pp. 381–395.
[3]  Vinit714, "A Recommendation System for Facial Skin Care using Machine Learning Models," IEEE Published, GitHub, 2023. https://github.com/vinit714/A-Recommendation-system-for-Facial-Skin-Care-using-Machine-Learning-Models
[4]  N. Ramrakhiani and D. Kalbande, "A comprehensive review of AI-powered skincare product recommendation systems," SAGE Journals, 2024. https://journals.sagepub.com/doi/10.1177/20427530241304073
[5]  PMC / NLM, "Artificial Intelligence in the Evolution of Customized Skincare Regimens," 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC12085869/
[6]  Haut.AI, "AI Skin Analysis & Personalized Product Recommendation System," 2025. https://haut.ai/
[7]  Roots Analysis, "AI in Skincare Market Report 2025–2035," 2025. https://www.rootsanalysis.com/reports/ai-in-skincare-market.html
[8]  SerpAPI, "Google Search API — Documentation and Pricing," 2026. https://serpapi.com/
[9]  ALM Corp, "Google Sues SerpAPI: Lawsuit Analysis," December 2025. https://almcorp.com/blog/google-sues-serpapi-lawsuit-analysis/
[10]  SyndellTech, "Before and After AI: Beauty Industry's Virtual Transformation," 2025. https://syndelltech.com/ai-in-beauty-industry/

```
