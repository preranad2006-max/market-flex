# Dynamic Price Pilot

Role & Goal

You are an Principal AI Architect and Senior Data Engineer. Build a full-stack, end-to-end AI-Powered Dynamic Pricing Engine for an online retail marketplace managing 50,000+ SKUs. The goal is to replace static pricing with a dynamic engine capable of real-time price optimization, demand prediction, flash sale detection, and stockout mitigation while delivering sub-second inference latency.

---

1. System Requirements & Architecture

Business Core Objectives

- Target Metrics: 10–20% revenue uplift, 15% reduction in stockouts, sub-second (<100ms) real-time pricing updates.

- Key Capabilities: Real-time signal integration, price elasticity modeling, demand forecasting, flash sale detection, competitive response, and inventory balancing.

Technical Stack

- Languages & Frameworks: Python 3.10+, FastAPI (API layer), Streamlit (Admin & Analytics Dashboard).

- Machine Learning: XGBoost, Random Forest, Scikit-learn (Elasticity & Demand Models).

- Streaming & Data Infrastructure: Apache Kafka (Event Ingestion), Redis (Low-latency Price & Feature Cache).

- Deployment & Infrastructure (AWS): Docker, AWS EC2, AWS Lambda, AWS S3 (Model Artifacts), CloudWatch (Logging & Metrics).

- Data Engineering: Pandas, NumPy, Joblib.

---

2. Comprehensive System Architecture Diagram

[ Incoming Events ] ---> ( Kafka Ingestion Topics ) │ ▼ [ FastAPI Streaming Consumer ] │ ┌──────────────┴──────────────┐ ▼ ▼ [ Redis Feature Store ] [ Elasticity & XGBoost Model ]

Competitor Prices - Predict Demand Q(p)

Inventory Levels - Optimize Revenue R(p) = p * Q(p)

Clickstream Signals │ │ ▼ └─────────────────> [ Dynamic Rules Engine ] - Flash Sale Trigger - Inventory Guardrails │ ▼ [ Updated Price Output ] │ ▼ [ Streamlit Dashboard ]

3. Data Schema & Feature Engineering ### Data Sources 1. Click Events: `timestamp`, `user_id`, `sku_id`, `event_type` (view, add_to_cart, purchase), `session_id`. 2. Order History: `order_id`, `sku_id`, `quantity`, `price_applied`, `timestamp`, `customer_segment`. 3. Inventory Levels: `sku_id`, `current_stock`, `reorder_point`, `lead_time_days`, `last_updated`. 4. Competitor Prices (API): `competitor_id`, `sku_id`, `competitor_price`, `scraped_at`. 5. Seasonal & Context Factors: `day_of_week`, `hour_of_day`, `is_holiday`, `promo_flag`. ### Feature Vector Formulation $$X = [\text{stock\ratio}, \text{comp\_price\_ratio}, \text{conversion\_rate\_1h}, \text{elasticity\_score}, \text{seasonal\_index}]$$ Where: - $\text{stock\_ratio} = \frac{\text{current\_stock}}{\text{reorder\_point}}$ - $\text{comp\_price\_ratio} = \frac{\text{our\_current\_price}}{\text{min\_competitor\_price}}$ - $\text{conversion\_rate\_1h} = \frac{\text{purchases\_1h}}{\text{views\_1h}}$ --- ## 4. Machine Learning & Optimization Engine ### Elasticity & Demand Model Logic The price elasticity of demand ($\epsilon$) is calculated as: $$\epsilon = \frac{\% \Delta Q}{\% \Delta P} = \frac{(Q_1 - Q_0) / Q_0}{(P_1 - P_0) / P_0}$$ The optimization objective optimizes revenue $R(P)$ bounded by guardrails: $$\max{P} R(P) = P \cdot \hat{Q}(P, X)$$ $$\text{Subject to: } P_{\min} \le P \le P_{\max} \quad \text{and} \quad P \le 1.15 \cdot P_{\text{competitor\_min}}$$ --- ## 5. File Structure & Project Implementation Plan Generate code for the following project layout: ```text dynamic_pricing_engine/ │ ├── config/ │ └── settings.py # System parameters, AWS, Redis, Kafka configs │ ├── data_pipeline/ │ ├── kafka_producer.py # Mocks real-time market signals (clicks, inventory, competitor) │ └── feature_store.py # Redis client for real-time feature retrieval │ ├── models/ │ ├── train_demand.py # Trains XGBoost & Random Forest demand models │ ├── elasticity.py # Calculates price elasticity coefficients │ └── optimizer.py # Revenue optimization algorithm with constraints │ ├── api/ │ └── main.py # FastAPI server for low-latency (<100ms) price updates │ ├── dashboard/ │ └── app.py # Streamlit UI (Monitoring, Override Control, Visualizations) │ ├── docker-compose.yml # Local setup with Kafka, Zookeeper, Redis, FastAPI, Streamlit └── Requirements.txt

6. Implementation Code Deliverables

File 1: config/settings.py

Provide configurable settings using Pydantic, specifying default values for Redis host, Kafka endpoints, dynamic price bounds (e.g., minimum margin = 10%, max price surge = 35%), and AWS CloudWatch logging thresholds.

File 2: models/elasticity.py & models/optimizer.py

Implement an optimizer class using scipy.optimize or grid search over discretized price steps ($P_0 \pm 30\%$).

Apply Flash Sale Detection: If views_1h spikes $> 300\%$ over moving average and stock_ratio $< 0.3$, apply dynamic scarcity premium.

Apply Emergency Guardrails: Prevent prices from dropping below cost + minimum margin or exceeding competitor prices by $> 20\%$.

File 3: api/main.py (FastAPI Real-Time Server)

Construct a high-performance endpoint /api/v1/recommend-price accepting sku_id. It must:

Fetch real-time features from Redis (feature_store.py).

Pass features to the model & optimizer.

Return recommended_price, elasticity, predicted_demand, applied_rule, and latency_ms.

Run inference under 50ms.

File 4: dashboard/app.py (Streamlit Command Center)

Build an enterprise Streamlit interface featuring:

Executive Metrics: Revenue uplift tracker, stockout rate reduction, live price changes/sec.

SKU Price Comparator: Interactive chart showing Our Price vs. Competitor Price vs. Optimal Predicted Price.

Emergency Override: Manual kill switch to freeze automated pricing for specific categories or SKUs.

Simulator: Interactive sliders for inventory level, competitor price drop, and traffic spikes to simulate real-time engine reaction.

7. Execution & Verification Steps

Provide step-by-step terminal commands to:

Spin up Kafka, Redis, and API services via docker-compose up.

Run data_pipeline/kafka_producer.py to simulate market stream data.

Train and save model artifacts using python models/train_demand.py.

Launch the Streamlit dashboard and run test inference requests via curl to verify response times $< 100\text{ms}$.

Recommended Next Steps

 1. Copy the markdown block above into your developer workflow or coding assistant (Cursor, Claude, or ChatGPT). 

2. If you would like to start building immediately, let me know which specific module (e.g., the FastAPI real-time engine, the XGBoost elasticity model, or the Streamlit dashboard) you would like to generate first!

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5ecb0051-cf05-4374-8cd2-e3a0b21d478c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
