**A Multi-Country Spatiotemporal Machine Learning
Framework for Methane Hotspot Detection Using
Satellite Observations**

Methane (CH₄) is a potent greenhouse gas with
major implications for climate change and atmospheric chemistry.
Detecting methane emission hotspots remains challenging due to
spatial heterogeneity, atmospheric transport processes, and
limitations in observational data. This study presents a scalable,
multi-country framework for methane hotspot detection based on
satellite observations and machine learning. A spatiotemporal
dataset was constructed using Google Earth Engine by integrating
TROPOMI methane concentrations, Sentinel-2 surface
reflectance, ERA5 wind fields and additional geospatial variables
on a hexagonal grid across Europe from 2021 to 2025. A
LightGBM-based classification model was trained to identify
methane hotspots using both methane-derived and environmental
features. To ensure robustness and avoid data leakage, a global
normalization strategy was applied across all regions. An ablation
study shows that methane-derived features are the primary drivers
of model performance, while environmental variables provide
complementary explanatory information. Cross-country
validation demonstrates strong generalization, with consistently
high ROC-AUC scores and more variable PR-AUC values
reflecting regional emission characteristics. Overall, the proposed
framework enables scalable methane monitoring and offers
insights into the interaction between atmospheric conditions and
surface drivers of emissions. This work contributes a robust
pipeline for satellite-based environmental monitoring and
highlights the potential for future integration with hyperspectral
data, such as EMIT, to further improve detection capabilities.
