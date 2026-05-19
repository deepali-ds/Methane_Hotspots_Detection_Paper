// =============================
// HEX GRID (CHANGE PER COUNTRY)
// =============================
var hexGrid = ee.FeatureCollection(
  'projects/ee-deepalibidwai/assets/spain_h3_res6'
);

// =============================
// YEARS
// =============================
var years = [2021, 2022, 2023, 2024, 2025];


// =============================
// EMPTY IMAGE HELPERS (DO NOT TOUCH)
// =============================
function emptyCH4() {
  return ee.Image.constant([0, 1, 0, 0])
    .rename(['CH4_mean','CH4_std','CH4_zscore','CH4_persistence']);
}

function emptyS2() {
  return ee.Image.constant([0,0,0,0,0])
    .rename(['NDVI','NDWI','NDMI','NDBI','BSI']);
}

function emptyWind() {
  return ee.Image.constant([0,0])
    .rename(['wind_speed','wind_direction']);
}


// =============================
// CH4 MODULE (UNCHANGED LOGIC)
// =============================
function getCH4(start, end, geom) {

  var col = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4')
    .select('CH4_column_volume_mixing_ratio_dry_air')
    .filterDate(start, end)
    .filterBounds(geom);

  var hasData = col.size().gt(0);

  return ee.Image(ee.Algorithms.If(hasData, (function() {

    var meanImg = col.mean().rename('CH4_mean');
    var stdImg  = col.reduce(ee.Reducer.stdDev()).rename('CH4_std');

    var stats = meanImg.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      }),
      geometry: geom,
      scale: 10000,
      maxPixels: 1e13
    });

    var mean = ee.Number(ee.Algorithms.If(
      stats.get('CH4_mean_mean'), stats.get('CH4_mean_mean'), 0
    ));

    var std = ee.Number(ee.Algorithms.If(
      stats.get('CH4_mean_stdDev'), stats.get('CH4_mean_stdDev'), 1
    )).max(1e-6);

    var z = meanImg.subtract(mean).divide(std)
      .rename('CH4_zscore');

    var persistence = col.map(function(img) {
      var zimg = img.subtract(meanImg).divide(std);
      return zimg.gt(2);
    }).sum().rename('CH4_persistence');

    return meanImg.addBands([stdImg, z, persistence]);

  })(), emptyCH4()));
}


// =============================
// SENTINEL-2 (UNCHANGED LOGIC)
// =============================
function getS2(start, end, geom) {

  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(start, end)
    .filterBounds(geom)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

  var hasData = s2.size().gt(0);

  return ee.Image(ee.Algorithms.If(hasData, (function() {

    var cs = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
    var linked = s2.linkCollection(cs, ['cs']);

    function mask(img) {
      var csBand = img.select('cs');
      return img.updateMask(csBand.gte(0.5));
    }

    var composite = linked.map(mask)
      .select(['B2','B3','B4','B8','B11'])
      .median();

    var NDVI = composite.normalizedDifference(['B8','B4']).rename('NDVI');
    var NDWI = composite.normalizedDifference(['B3','B8']).rename('NDWI');
    var NDMI = composite.normalizedDifference(['B8','B11']).rename('NDMI');
    var NDBI = composite.normalizedDifference(['B11','B8']).rename('NDBI');

    var BSI = composite.expression(
      '(SWIR + RED - NIR - BLUE) / (SWIR + RED + NIR + BLUE)', {
        SWIR: composite.select('B11'),
        RED: composite.select('B4'),
        NIR: composite.select('B8'),
        BLUE: composite.select('B2')
    }).rename('BSI');

    return NDVI.addBands([NDWI, NDMI, NDBI, BSI]);

  })(), emptyS2()));
}


// =============================
// WIND (YOUR VERSION — UNCHANGED)
// =============================
function getWind(start, end) {

  var col = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY')
    .filterDate(start, end)
    .select(['u_component_of_wind_10m','v_component_of_wind_10m']);

  var hasData = col.size().gt(0);

  return ee.Image(ee.Algorithms.If(hasData, (function() {

    var wind = col.mean();

    var wind_speed = wind.expression('sqrt(u*u + v*v)',{
      u: wind.select('u_component_of_wind_10m'),
      v: wind.select('v_component_of_wind_10m')
    }).rename('wind_speed');

    var wind_direction = wind.expression('atan2(u,v)',{
      u: wind.select('u_component_of_wind_10m'),
      v: wind.select('v_component_of_wind_10m')
    }).rename('wind_direction');

    return wind_speed.addBands(wind_direction);

  })(), emptyWind()));
}


// =============================
// STATIC FEATURES
// =============================
var dem = ee.Image('USGS/SRTMGL1_003');
var elevation = dem.rename('elevation');
var slope = ee.Terrain.slope(dem).rename('slope');

var infra = ee.FeatureCollection("EDF/OGIM/current");
var infraRaster = ee.Image().byte().paint(infra, 1);

var infra_distance = infraRaster.fastDistanceTransform()
  .sqrt()
  .multiply(ee.Image.pixelArea().sqrt())
  .divide(1000)
  .rename('infra_distance');


// =============================
// EXPECTED BANDS (DO NOT CHANGE)
// =============================
var expectedBands = [
  'CH4_mean','CH4_std','CH4_zscore','CH4_persistence',
  'NDVI','NDWI','NDMI','NDBI','BSI',
  'wind_speed','wind_direction',
  'elevation','slope','infra_distance'
];


// =============================
// FEATURE BUILDER
// =============================
function buildFeatures(start, end) {

  var ch4 = getCH4(start, end, hexGrid);
  var s2 = getS2(start, end, hexGrid);
  var wind = getWind(start, end);

  var stack = ee.Image.cat([
    ch4,
    s2,
    wind,
    elevation,
    slope,
    infra_distance
  ]);

  // 🔴 HARD FIX: FORCE IDENTICAL SCHEMA
  var template = ee.Image.constant([
    0,1,0,0,
    0,0,0,0,0,
    0,0,
    0,0,0
  ]).rename(expectedBands);

  stack = template.addBands(stack, null, true);
  stack = stack.select(expectedBands);
  stack = stack.unmask(0);

  return stack.reduceRegions({
    collection: hexGrid,
    reducer: ee.Reducer.mean(),
    scale: 1000,
    tileScale: 8
  }).map(function(f) {
    var c = f.geometry().centroid();
    return f.set({
      lat: c.coordinates().get(1),
      lon: c.coordinates().get(0),
      year: start.get('year'),
      month: start.get('month')
    });
  });
}


// =============================
// EXPORT LOOP (FINAL)
// =============================
for (var i = 0; i < years.length; i++) {

  var y = years[i];
  var yearly = ee.FeatureCollection([]);

  for (var m = 1; m <= 12; m++) {

    var start = ee.Date.fromYMD(y, m, 1);
    var end = start.advance(1, 'month');

    var fc = buildFeatures(start, end);
    yearly = yearly.merge(fc);
  }

  Export.table.toDrive({
    collection: yearly,
    description: 'Methane_Spain_' + y,
    fileNamePrefix: 'Methane_Spain_' + y,
    fileFormat: 'CSV'
  });
}