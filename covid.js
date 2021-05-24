

// Themes begin
am4core.useTheme(am4themes_animated);
// Themes end

	var backgroundColor = am4core.color("#1e2128");
	var activeColor = am4core.color("#FFD900");
	var confirmedColor = am4core.color("#FF7D00");
	var recoveredColor = am4core.color("#5BE300");
	var deathsColor = am4core.color("#FF0012");
	var textColor = am4core.color("#ffffff");

	// for an easier access by key
	var colors = { active: activeColor, confirmed: confirmedColor, recovered: recoveredColor, deaths: deathsColor };

	var countryColor = am4core.color("#3b3b3b");
	var countryStrokeColor = am4core.color("#000000");
	var buttonStrokeColor = am4core.color("#ffffff");
	var countryHoverColor = am4core.color("#1b1b1b");
	var activeCountryColor = am4core.color("#0f0f0f");

	var currentIndex;
	var currentCountry = "World";

	// last date of the data
	var lastDate = new Date(covid_total_timeline[covid_total_timeline.length - 1].date);
	var currentDate = lastDate;

	var currentPolygon;

	var countryDataTimeout;

	var sliderAnimation;

	//////////////////////////////////////////////////////////////////////////////
	// PREPARE DATA
	//////////////////////////////////////////////////////////////////////////////

	// make a map of country indexes for later use
	var countryIndexMap = {};
	var list = covid_world_timeline[0].list;
	for (var i = 0; i < list.length; i++) {
		var country = list[i]
		countryIndexMap[country.id] = i;
	}

	// calculated active cases in world data (active = confirmed - recovered)
	for (var i = 0; i < covid_total_timeline.length; i++) {
		var di = covid_total_timeline[i];
		di.active = di.confirmed - di.recovered;
	}

	// function that returns current slide
	// if index is not set, get last slide
	function getSlideData(index) {
		if (index == undefined) {
			index = covid_world_timeline.length - 1;
		}

		var data = covid_world_timeline[index];

		return data;
	}

	// get slide data
	var slideData = getSlideData();

	// as we will be modifying raw data, make a copy
	var mapData = JSON.parse(JSON.stringify(slideData.list));
	var max = { confirmed: 0, recovered: 0, deaths: 0 };

	// the last day will have most
	for (var i = 0; i < mapData.length; i++) {
		var di = mapData[i];
		if (di.confirmed > max.confirmed) {
			max.confirmed = di.confirmed;
		}
		if (di.recovered > max.recovered) {
			max.recovered = di.recovered;
		}
		if (di.deaths > max.deaths) {
			max.deaths = di.deaths
		}
		max.active = max.confirmed;
	}

	// END OF DATA

	//////////////////////////////////////////////////////////////////////////////
	// LAYOUT & CHARTS
	//////////////////////////////////////////////////////////////////////////////

	// main container
	// https://www.amcharts.com/docs/v4/concepts/svg-engine/containers/
	var container = am4core.create("chartdiv", am4core.Container);
	container.width = am4core.percent(100);
	container.height = am4core.percent(100);
	container.background.fill = am4core.color("#0084B0");
	container.background.fillOpacity = 1;

	// MAP CHART 
	// https://www.amcharts.com/docs/v4/chart-types/map/
	var mapChart = container.createChild(am4maps.MapChart);
	mapChart.height = am4core.percent(80);
	mapChart.zoomControl = new am4maps.ZoomControl();
	mapChart.zoomControl.align = "right";
	mapChart.zoomControl.marginRight = 15;
	mapChart.zoomControl.valign = "middle";

	// by default minus button zooms out by one step, but we modify the behavior so when user clicks on minus, the map would fully zoom-out and show world data
	mapChart.zoomControl.minusButton.events.on("hit", showWorld);
	// clicking on a "sea" will also result a full zoom-out
	mapChart.seriesContainer.background.events.on("hit", showWorld);
	mapChart.seriesContainer.background.events.on("over", resetHover);
	mapChart.seriesContainer.background.fillOpacity = 0;
	mapChart.zoomEasing = am4core.ease.sinOut;

	// https://www.amcharts.com/docs/v4/chart-types/map/#Map_data
	// you can use more accurate world map or map of any other country - a wide selection of maps available at: https://github.com/amcharts/amcharts4-geodata
	mapChart.geodata = am4geodata_worldLow;

	// Set projection
	// https://www.amcharts.com/docs/v4/chart-types/map/#Setting_projection
	// instead of Miller, you can use Mercator or many other projections available: https://www.amcharts.com/demos/map-using-d3-projections/
	mapChart.projection = new am4maps.projections.Miller();
	mapChart.panBehavior = "move";

	// when map is globe, beackground is made visible
	mapChart.backgroundSeries.mapPolygons.template.polygon.fillOpacity = 0.05;
	mapChart.backgroundSeries.mapPolygons.template.polygon.fill = am4core.color("#ffffff");
	mapChart.backgroundSeries.hidden = true;


	// Map polygon series (defines how country areas look and behave)
	var polygonSeries = mapChart.series.push(new am4maps.MapPolygonSeries());
	polygonSeries.dataFields.id = "id";
	polygonSeries.exclude = ["AQ"]; // Antarctica is excluded in non-globe projection
	polygonSeries.useGeodata = true;
	polygonSeries.nonScalingStroke = true;
	polygonSeries.strokeWidth = 0.5;
	// this helps to place bubbles in the visual middle of the area
	polygonSeries.calculateVisualCenter = true;

	var polygonTemplate = polygonSeries.mapPolygons.template;
	polygonTemplate.fill = countryColor;
	polygonTemplate.fillOpacity = 1
	polygonTemplate.stroke = countryStrokeColor;
	polygonTemplate.strokeOpacity = 0.15
	polygonTemplate.setStateOnChildren = true;

	polygonTemplate.events.on("hit", handleCountryHit);
	polygonTemplate.events.on("over", handleCountryOver);
	polygonTemplate.events.on("out", handleCountryOut);

	// you can have pacific - centered map if you set this to -154.8
	mapChart.deltaLongitude = -10;

	// polygon states
	var polygonHoverState = polygonTemplate.states.create("hover");
	polygonHoverState.properties.fill = countryHoverColor;

	var polygonActiveState = polygonTemplate.states.create("active")
	polygonActiveState.properties.fill = activeCountryColor;

	// Bubble series
	var bubbleSeries = mapChart.series.push(new am4maps.MapImageSeries());
	bubbleSeries.data = mapData;
	bubbleSeries.dataFields.value = "confirmed";
	bubbleSeries.dataFields.id = "id";

	// adjust tooltip
	bubbleSeries.tooltip.animationDuration = 0;
	bubbleSeries.tooltip.showInViewport = false;
	bubbleSeries.tooltip.background.fillOpacity = 0.2;
	bubbleSeries.tooltip.getStrokeFromObject = true;
	bubbleSeries.tooltip.getFillFromObject = false;
	bubbleSeries.tooltip.background.fillOpacity = 0.2;
	bubbleSeries.tooltip.background.fill = am4core.color("#000000");

	var imageTemplate = bubbleSeries.mapImages.template;
	// if you want bubbles to become bigger when zoomed, set this to false
	imageTemplate.nonScaling = true;
	imageTemplate.strokeOpacity = 0;
	imageTemplate.fillOpacity = 0.5;
	imageTemplate.tooltipText = "{name}: [bold]{value}[/]";
	// this is needed for the tooltip to point to the top of the circle instead of the middle
	imageTemplate.adapter.add("tooltipY", function(tooltipY, target) {
		return -target.children.getIndex(0).radius;
	})

	imageTemplate.events.on("over", handleImageOver);
	imageTemplate.events.on("out", handleImageOut);
	imageTemplate.events.on("hit", handleImageHit);

	// When hovered, circles become non-opaque	
	var imageHoverState = imageTemplate.states.create("hover");
	imageHoverState.properties.fillOpacity = 1;

	// add circle inside the image
	var circle = imageTemplate.createChild(am4core.Circle);
	// this makes the circle to pulsate a bit when showing it
	circle.hiddenState.properties.scale = 0.0001;
	circle.hiddenState.transitionDuration = 2000;
	circle.defaultState.transitionDuration = 2000;
	circle.defaultState.transitionEasing = am4core.ease.elasticOut;
	// later we set fill color on template (when changing what type of data the map should show) and all the clones get the color because of this
	circle.applyOnClones = true;

	// heat rule makes the bubbles to be of a different width. Adjust min/max for smaller/bigger radius of a bubble
	bubbleSeries.heatRules.push({
		"target": circle,
		"property": "radius",
		"min": 3,
		"max": 30,
		"dataField": "value"
	})

	// when data items validated, hide 0 value bubbles (because min size is set)
	bubbleSeries.events.on("dataitemsvalidated", function() {
		bubbleSeries.dataItems.each((dataItem) => {
			var mapImage = dataItem.mapImage;
			var circle = mapImage.children.getIndex(0);
			if (mapImage.dataItem.value == 0) {
				circle.hide(0);
			}
			else if (circle.isHidden || circle.isHiding) {
				circle.show();
			}
		})
	})

	// this places bubbles at the visual center of a country
	imageTemplate.adapter.add("latitude", function(latitude, target) {
		var polygon = polygonSeries.getPolygonById(target.dataItem.id);
		if (polygon) {
			return polygon.visualLatitude;
		}
		return latitude;
	})

	imageTemplate.adapter.add("longitude", function(longitude, target) {
		var polygon = polygonSeries.getPolygonById(target.dataItem.id);
		if (polygon) {
			return polygon.visualLongitude;
		}
		return longitude;
	})

	// END OF MAP	

	// top title
	var title = mapChart.titles.create();
	title.fontSize = "1.5em";
	title.fill = textColor;
	title.text = "COVID-19 Spread Data";
	title.align = "center";
	title.horizontalCenter = "left";
	title.marginLeft = 20;
	title.paddingBottom = 10;
	title.y = 20;

	// switch between map and globe
	var mapGlobeSwitch = mapChart.createChild(am4core.SwitchButton);
	mapGlobeSwitch.align = "right"
	mapGlobeSwitch.y = 15;
	mapGlobeSwitch.leftLabel.text = "Map";
	mapGlobeSwitch.rightLabel.text = "Globe";
	mapGlobeSwitch.verticalCenter = "top";
	mapGlobeSwitch.leftLabel.fill = textColor;
	mapGlobeSwitch.rightLabel.fill = textColor;


	mapGlobeSwitch.events.on("toggled", function() {
		if (mapGlobeSwitch.isActive) {
			mapChart.projection = new am4maps.projections.Orthographic;
			mapChart.backgroundSeries.show();
			mapChart.panBehavior = "rotateLongLat";
			polygonSeries.exclude = [];
		} else {
			mapChart.projection = new am4maps.projections.Miller;
			mapChart.backgroundSeries.hide();
			mapChart.panBehavior = "move";
			polygonSeries.data = [];
			polygonSeries.exclude = ["AQ"];
		}
	})

	// buttons & chart container
	var buttonsAndChartContainer = container.createChild(am4core.Container);
	buttonsAndChartContainer.layout = "vertical";
	buttonsAndChartContainer.height = am4core.percent(40); // make this bigger if you want more space for the chart
	buttonsAndChartContainer.width = am4core.percent(100);
	buttonsAndChartContainer.valign = "bottom";

	// country name and buttons container
	var nameAndButtonsContainer = buttonsAndChartContainer.createChild(am4core.Container)
	nameAndButtonsContainer.width = am4core.percent(100);
	nameAndButtonsContainer.padding(0, 10, 5, 20);
	nameAndButtonsContainer.layout = "horizontal";

	// name of a country and date label
	var countryName = nameAndButtonsContainer.createChild(am4core.Label);
	countryName.fontSize = "1.1em";
	countryName.fill = textColor;
	countryName.valign = "middle";

	// buttons container (active/confirmed/recovered/deaths)
	var buttonsContainer = nameAndButtonsContainer.createChild(am4core.Container);
	buttonsContainer.layout = "grid";
	buttonsContainer.width = am4core.percent(100);
	buttonsContainer.x = 10;
	buttonsContainer.contentAlign = "right";

	// Chart & slider container
	var chartAndSliderContainer = buttonsAndChartContainer.createChild(am4core.Container);
	chartAndSliderContainer.layout = "vertical";
	chartAndSliderContainer.height = am4core.percent(100);
	chartAndSliderContainer.width = am4core.percent(100);
	chartAndSliderContainer.background.fill = am4core.color("#000000");
	chartAndSliderContainer.background = new am4core.RoundedRectangle();
	chartAndSliderContainer.background.cornerRadius(30, 30, 0, 0)
	chartAndSliderContainer.background.fillOpacity = 0.15;
	chartAndSliderContainer.background.fill = am4core.color("#000000");
	chartAndSliderContainer.paddingTop = 10;
	chartAndSliderContainer.paddingBottom = 0;

	// Slider container
	var sliderContainer = chartAndSliderContainer.createChild(am4core.Container);
	sliderContainer.width = am4core.percent(100);
	sliderContainer.padding(0, 15, 15, 10);
	sliderContainer.layout = "horizontal";

	var slider = sliderContainer.createChild(am4core.Slider);
	slider.width = am4core.percent(100);
	slider.valign = "middle";
	slider.background.opacity = 0.4;
	slider.opacity = 0.7;
	slider.background.fill = am4core.color("#ffffff");
	slider.marginLeft = 20;
	slider.marginRight = 35;
	slider.height = 15;
	slider.start = 1;


	// what to do when slider is dragged
	slider.events.on("rangechanged", function(event) {
		var index = Math.round((covid_world_timeline.length - 1) * slider.start);
		updateMapData(getSlideData(index).list);
		updateTotals(index);
	})
	// stop animation if dragged
	slider.startGrip.events.on("drag", () => {
		stop();
		if (sliderAnimation) {
			sliderAnimation.setProgress(slider.start);
		}
	});

	// play button
	var playButton = sliderContainer.createChild(am4core.PlayButton);
	playButton.valign = "middle";
	// play button behavior
	playButton.events.on("toggled", function(event) {
		if (event.target.isActive) {
			play();
		} else {
			stop();
		}
	})
	// make slider grip look like play button
	slider.startGrip.background.fill = playButton.background.fill;
	slider.startGrip.background.strokeOpacity = 0;
	slider.startGrip.icon.stroke = am4core.color("#ffffff");
	slider.startGrip.background.states.copyFrom(playButton.background.states)

	// play behavior
	function play() {
		if (!sliderAnimation) {
			sliderAnimation = slider.animate({ property: "start", to: 1, from: 0 }, 50000, am4core.ease.linear).pause();
			sliderAnimation.events.on("animationended", () => {
				playButton.isActive = false;
			})
		}

		if (slider.start >= 1) {
			slider.start = 0;
			sliderAnimation.start();
		}
		sliderAnimation.resume();
		playButton.isActive = true;
	}

	// stop behavior
	function stop() {
		if (sliderAnimation) {
			sliderAnimation.pause();
		}
		playButton.isActive = false;
	}

	// BOTTOM CHART
	// https://www.amcharts.com/docs/v4/chart-types/xy-chart/
	var lineChart = chartAndSliderContainer.createChild(am4charts.XYChart);
	lineChart.fontSize = "0.8em";
	lineChart.paddingRight = 30;
	lineChart.paddingLeft = 30;
	lineChart.maskBullets = false;
	lineChart.zoomOutButton.disabled = true;
	lineChart.paddingBottom = 3;
  lineChart.paddingTop = 0;

	// make a copy of data as we will be modifying it
	lineChart.data = JSON.parse(JSON.stringify(covid_total_timeline));

	// date axis
	// https://www.amcharts.com/docs/v4/concepts/axes/date-axis/
	var dateAxis = lineChart.xAxes.push(new am4charts.DateAxis());
	dateAxis.renderer.minGridDistance = 50;
	dateAxis.renderer.grid.template.stroke = am4core.color("#000000");
	dateAxis.max = lastDate.getTime() + am4core.time.getDuration("day", 3);
	dateAxis.tooltip.label.fontSize = "0.8em";
	dateAxis.renderer.labels.template.fill = textColor;
	dateAxis.tooltip.background.fill = am4core.color("#FF7D00")
	dateAxis.tooltip.background.stroke = am4core.color("#FF7D00")
	dateAxis.tooltip.label.fill = am4core.color("#000000")

	// value axis
	// https://www.amcharts.com/docs/v4/concepts/axes/value-axis/
	var valueAxis = lineChart.yAxes.push(new am4charts.ValueAxis());
	valueAxis.interpolationDuration = 3000;
	valueAxis.renderer.grid.template.stroke = am4core.color("#000000");
	valueAxis.renderer.baseGrid.disabled = true;
	valueAxis.tooltip.disabled = true;
	valueAxis.extraMax = 0.05;
	valueAxis.renderer.inside = true;
	valueAxis.renderer.labels.template.verticalCenter = "bottom";
	valueAxis.renderer.labels.template.padding(2, 2, 2, 2);
	valueAxis.renderer.labels.template.fill = textColor;

	// cursor
	// https://www.amcharts.com/docs/v4/concepts/chart-cursor/
	lineChart.cursor = new am4charts.XYCursor();
	lineChart.cursor.behavior = "none"; // set zoomX for a zooming possibility
	lineChart.cursor.lineY.disabled = true;
	lineChart.cursor.xAxis = dateAxis;
	lineChart.cursor.lineX.stroke = am4core.color("#FF7D00");
	// this prevents cursor to move to the clicked location while map is dragged
	am4core.getInteraction().body.events.off("down", lineChart.cursor.handleCursorDown, lineChart.cursor)
	am4core.getInteraction().body.events.off("up", lineChart.cursor.handleCursorUp, lineChart.cursor)

	// legend
	// https://www.amcharts.com/docs/v4/concepts/legend/	
	lineChart.legend = new am4charts.Legend();
	lineChart.legend.parent = lineChart.plotContainer;
	lineChart.legend.labels.template.fill = textColor;

	// create series
	var activeSeries = addSeries("active", activeColor);
	// active series is visible initially
	activeSeries.tooltip.disabled = true;
	activeSeries.hidden = false;

	var confirmedSeries = addSeries("confirmed", confirmedColor);
	var recoveredSeries = addSeries("recovered", recoveredColor);
	var deathsSeries = addSeries("deaths", deathsColor);

	var series = { active: activeSeries, confirmed: confirmedSeries, recovered: recoveredSeries, deaths: deathsSeries };
	// add series
	function addSeries(name, color) {
		var series = lineChart.series.push(new am4charts.LineSeries())
		series.dataFields.valueY = name;
		series.dataFields.dateX = "date";
		series.name = capitalizeFirstLetter(name);
		series.strokeOpacity = 0.6;
		series.stroke = color;
		series.maskBullets = false;
		series.hidden = true;
		series.minBulletDistance = 10;
		series.hideTooltipWhileZooming = true;
		// series bullet
		var bullet = series.bullets.push(new am4charts.CircleBullet());

		// only needed to pass it to circle
		var bulletHoverState = bullet.states.create("hover");
		bullet.setStateOnChildren = true;

		bullet.circle.fillOpacity = 1;
		bullet.circle.fill = backgroundColor;
		bullet.circle.radius = 2;

		var circleHoverState = bullet.circle.states.create("hover");
		circleHoverState.properties.fillOpacity = 1;
		circleHoverState.properties.fill = color;
		circleHoverState.properties.scale = 1.4;

		// tooltip setup
		series.tooltip.pointerOrientation = "down";
		series.tooltip.getStrokeFromObject = true;
		series.tooltip.getFillFromObject = false;
		series.tooltip.background.fillOpacity = 0.2;
		series.tooltip.background.fill = am4core.color("#000000");
		series.tooltip.dy = -4;
		series.tooltip.fontSize = "0.8em";
		series.tooltipText = "{valueY}";

		return series;
	}

	// BUTTONS
	// create buttons
	var activeButton = addButton("active", activeColor);
	var confirmedButton = addButton("confirmed", confirmedColor);
	var recoveredButton = addButton("recovered", recoveredColor);
	var deathsButton = addButton("deaths", deathsColor);

	var buttons = { active: activeButton, confirmed: confirmedButton, recovered: recoveredButton, deaths: deathsButton };

	// add button
	function addButton(name, color) {
		var button = buttonsContainer.createChild(am4core.Button)
		button.label.valign = "middle"
		button.fontSize = "1em";
		button.background.cornerRadius(30, 30, 30, 30);
		button.background.strokeOpacity = 0.3
		button.background.fillOpacity = 0;
		button.background.stroke = buttonStrokeColor;
		button.background.padding(2, 3, 2, 3);
		button.states.create("active");
		button.setStateOnChildren = true;
		button.label.fill = textColor;

		var activeHoverState = button.background.states.create("hoverActive");
		activeHoverState.properties.fillOpacity = 0;

		var circle = new am4core.Circle();
		circle.radius = 8;
		circle.fillOpacity = 0.3;
		circle.fill = buttonStrokeColor;
		circle.strokeOpacity = 0;
		circle.valign = "middle";
		circle.marginRight = 5;
		button.icon = circle;

		// save name to dummy data for later use
		button.dummyData = name;

		var circleActiveState = circle.states.create("active");
		circleActiveState.properties.fill = color;
		circleActiveState.properties.fillOpacity = 0.5;

		button.events.on("hit", handleButtonClick);

		return button;
	}

	// handle button clikc
	function handleButtonClick(event) {
		// we saved name to dummy data
		changeDataType(event.target.dummyData);
	}

	// change data type (active/confirmed/recovered/deaths)
	function changeDataType(name) {
		// make button active
		var activeButton = buttons[name];
		activeButton.isActive = true;
		// make other buttons inactive
		for (var key in buttons) {
			if (buttons[key] != activeButton) {
				buttons[key].isActive = false;
			}
		}
		// tell series new field name
		bubbleSeries.dataFields.value = name;
		bubbleSeries.invalidateData();
		// change color of bubbles
		// setting colors on mapImage for tooltip colors
		bubbleSeries.mapImages.template.fill = colors[name];
		bubbleSeries.mapImages.template.stroke = colors[name];
		// first child is circle
		bubbleSeries.mapImages.template.children.getIndex(0).fill = colors[name];

		// show series
		var activeSeries = series[name];
		activeSeries.show();
		// hide other series
		for (var key in series) {
			if (series[key] != activeSeries) {
				series[key].hide();
			}
		}
		// update heat rule's maxValue
		bubbleSeries.heatRules.getIndex(0).maxValue = max[name];
	}

	// select a country
	function selectCountry(mapPolygon) {
		resetHover();
		polygonSeries.hideTooltip();

		// if the same country is clicked show world
		if (currentPolygon == mapPolygon) {
			currentPolygon.isActive = false;
			currentPolygon = undefined;
			showWorld();
			return;
		}
		// save current polygon
		currentPolygon = mapPolygon;
		var countryIndex = countryIndexMap[mapPolygon.dataItem.id];
		currentCountry = mapPolygon.dataItem.dataContext.name;

		// make others inactive
		polygonSeries.mapPolygons.each(function(polygon) {
			polygon.isActive = false;
		})

		// clear timeout if there is one
		if (countryDataTimeout) {
			clearTimeout(countryDataTimeout);
		}
		// we delay change of data for better performance (so that data is not changed whil zooming)
		countryDataTimeout = setTimeout(function() {
			setCountryData(countryIndex);
		}, 1000); // you can adjust number, 1000 is one second

		updateTotals(currentIndex);
		updateCountryName();

		mapPolygon.isActive = true;
		// meaning it's globe
		if (mapGlobeSwitch.isActive) {
			// animate deltas (results the map to be rotated to the selected country)
			if (mapChart.zoomLevel != 1) {
				mapChart.goHome();
				rotateAndZoom(mapPolygon);
			}
			else {
				rotateAndZoom(mapPolygon);
			}
		}
		// if it's not a globe, simply zoom to the country
		else {
			mapChart.zoomToMapObject(mapPolygon, getZoomLevel(mapPolygon));
		}
	}

	// change line chart data to the selected countries	
	function setCountryData(countryIndex) {
		// instead of setting whole data array, we modify current raw data so that a nice animation would happen
		for (var i = 0; i < lineChart.data.length; i++) {
			var di = covid_world_timeline[i].list;

			var countryData = di[countryIndex];
			var dataContext = lineChart.data[i];
			if (countryData) {
				dataContext.recovered = countryData.recovered;
				dataContext.confirmed = countryData.confirmed;
				dataContext.deaths = countryData.deaths;
				dataContext.active = countryData.confirmed - countryData.recovered;
				valueAxis.min = undefined;
				valueAxis.max = undefined;
			}
			else {
				dataContext.recovered = 0;
				dataContext.confirmed = 0;
				dataContext.deaths = 0;
				dataContext.active = 0;
				valueAxis.min = 0;
				valueAxis.max = 10;
			}
		}

		lineChart.invalidateRawData();
		updateTotals(currentIndex);
		setTimeout(updateSeriesTooltip, 2000);
	}

	function updateSeriesTooltip() {
		lineChart.cursor.triggerMove(lineChart.cursor.point, "soft", true);
		lineChart.series.each(function(series) {
			if (!series.isHidden) {
				series.tooltip.disabled = false;
				series.showTooltipAtDataItem(series.tooltipDataItem);
			}
		})
	}

	// what happens when a country is rolled-over
	function rollOverCountry(mapPolygon) {

		resetHover();
		if (mapPolygon) {
			mapPolygon.isHover = true;

			// make bubble hovered too
			var image = bubbleSeries.getImageById(mapPolygon.dataItem.id);
			if (image) {
				image.dataItem.dataContext.name = mapPolygon.dataItem.dataContext.name;
				image.isHover = true;
			}
		}
	}
	// what happens when a country is rolled-out
	function rollOutCountry(mapPolygon) {
		var image = bubbleSeries.getImageById(mapPolygon.dataItem.id)
		resetHover();
		if (image) {
			image.isHover = false;
		}
	}

	// rotate and zoom
	function rotateAndZoom(mapPolygon) {
		polygonSeries.hideTooltip();
		var animation = mapChart.animate([{ property: "deltaLongitude", to: -mapPolygon.visualLongitude }, { property: "deltaLatitude", to: -mapPolygon.visualLatitude }], 1000)
		animation.events.on("animationended", function() {
			mapChart.zoomToMapObject(mapPolygon, getZoomLevel(mapPolygon));
		})
	}

	// calculate zoom level (default is too close)
	function getZoomLevel(mapPolygon) {
		var w = mapPolygon.polygon.bbox.width;
		var h = mapPolygon.polygon.bbox.width;
		// change 2 to smaller walue for a more close zoom
		return Math.min(mapChart.seriesWidth / (w * 2), mapChart.seriesHeight / (h * 2))
	}

	// show world data
	function showWorld() {
		currentCountry = "World";
		currentPolygon = undefined;
		resetHover();

		if(countryDataTimeout){
			clearTimeout(countryDataTimeout);
		}

		// make all inactive
		polygonSeries.mapPolygons.each(function(polygon) {
			polygon.isActive = false;
		})
		
		updateCountryName();

		// update line chart data (again, modifying instead of setting new data for a nice animation)
		for (var i = 0; i < lineChart.data.length; i++) {
			var di = covid_total_timeline[i];
			var dataContext = lineChart.data[i];

			dataContext.recovered = di.recovered;
			dataContext.confirmed = di.confirmed;
			dataContext.deaths = di.deaths;
			dataContext.active = di.confirmed - di.recovered;
			valueAxis.min = undefined;
			valueAxis.max = undefined;
		}

		lineChart.invalidateRawData();

		updateTotals(currentIndex);
		mapChart.goHome();
	}

	// updates country name and date
	function updateCountryName() {
		countryName.text = currentCountry + ", " + mapChart.dateFormatter.format(currentDate, "MMM dd, yyyy");
	}

	// update total values in buttons
	function updateTotals(index) {
		if (!isNaN(index)) {
			var di = covid_total_timeline[index];
			var date = new Date(di.date);
			currentDate = date;

			updateCountryName();

			var position = dateAxis.dateToPosition(date);
			position = dateAxis.toGlobalPosition(position);
			var x = dateAxis.positionToCoordinate(position);

			if (lineChart.cursor) {
				lineChart.cursor.triggerMove({ x: x, y: 0 }, "soft", true);
			}
			for (var key in buttons) {
				buttons[key].label.text = capitalizeFirstLetter(key) + ": " + lineChart.data[index][key];
			}
			currentIndex = index;
		}
	}

	// update map data
	function updateMapData(data) {
		//modifying instead of setting new data for a nice animation
		bubbleSeries.dataItems.each(function(dataItem) {
			dataItem.dataContext.confirmed = 0;
			dataItem.dataContext.deaths = 0;
			dataItem.dataContext.recovered = 0;
			dataItem.dataContext.active = 0;
		})

		for (var i = 0; i < data.length; i++) {
			var di = data[i];
			var image = bubbleSeries.getImageById(di.id);
			if (image) {
				image.dataItem.dataContext.confirmed = di.confirmed;
				image.dataItem.dataContext.deaths = di.deaths;
				image.dataItem.dataContext.recovered = di.recovered;
				image.dataItem.dataContext.active = di.confirmed - di.recovered;
			}
		}
		bubbleSeries.invalidateRawData();
	}

	// capitalize first letter
	function capitalizeFirstLetter(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	}

	function handleImageOver(event) {
		rollOverCountry(polygonSeries.getPolygonById(event.target.dataItem.id));
	}

	function handleImageOut(event) {
		rollOutCountry(polygonSeries.getPolygonById(event.target.dataItem.id));
	}

	function handleImageHit(event) {
		selectCountry(polygonSeries.getPolygonById(event.target.dataItem.id));
	}		

	function handleCountryHit(event) {
		selectCountry(event.target);
	}

	function handleCountryOver(event) {
		rollOverCountry(event.target);
	}

	function handleCountryOut(event) {
		rollOutCountry(event.target);
	}

	function resetHover() {
		polygonSeries.mapPolygons.each(function(polygon) {
			polygon.isHover = false;
		})

		bubbleSeries.mapImages.each(function(image) {
			image.isHover = false;
		})
	}

	container.events.on("layoutvalidated", function() {
		dateAxis.tooltip.hide();
		lineChart.cursor.hide();
		updateTotals(currentIndex);
	});


	updateCountryName();
	changeDataType("active");

	setTimeout(updateSeriesTooltip, 3000);

var ts = new Date;
    ts = ts.getTime();
    let url = 'https://cdn.abplive.com/coronastats/prod/coronastats-new.json?ts='+ts;
    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        //console.log(data)
        appendData(data);
      })
      .catch(function (err) {
        console.log(err);
      });

    function appendData(data) {
      let stateCount = document.getElementById("stateCount");
      let totalCases = document.getElementById("totalCases");
      let recovered = document.getElementById("recovered");
      let death = document.getElementById("death");
      //console.log(data.statewise.length)

      totalCases.innerHTML = data.totalConfirmed;
      recovered.innerHTML = data.totalRecovered;
      death.innerHTML = data.totalDeaths;

      var marquee = document.createElement("marquee");
      marquee.setAttribute("onmouseover", "this.stop();");
      marquee.setAttribute("onmouseout", "this.start();");
      marquee.setAttribute("behavior", "scroll");
      marquee.setAttribute("direction", "left");
      marquee.setAttribute("scrollamount", "10");
      var marqueeInner = document.createElement("div");
      marqueeInner.setAttribute("class", "marqueeInner");

      for (var i = 0; i < data.statewise.length; i++) {
        var stateInner = document.createElement("div");
        stateInner.innerHTML = '<span class="name">' + data.statewise[i].state + '</span>' + '<span class="number">' +
          data.statewise[i].confirmed + '</span>';
        // stateCount.appendChild(stateInner);
        marqueeInner.appendChild(stateInner);
      }
      marquee.appendChild(marqueeInner);
      stateCount.appendChild(marquee);
      //console.log(data)
      let update = document.getElementById("para1");
      //let update2 = document.getElementById("para2");

      function formatAMPM() {
        var d = new Date(),
          minutes = d.getMinutes().toString().length == 1 ? '0' + d.getMinutes() : d.getMinutes(),
          hours = d.getHours().toString().length == 1 ? '0' + d.getHours() : d.getHours(),
          ampm = d.getHours() >= 12 ? 'pm' : 'am',
          months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[d.getDay()] + ' ' + months[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear() + ' ' +
          hours + ':' + minutes + ampm;
      }

      update.innerHTML = formatAMPM();
      //update2.innerHTML = formatAMPM();

    }


    function lockDown() {
      let date1 = new Date("03/24/2020");
      let today = new Date();
      var dd = today.getDate();
      var mm = today.getMonth() + 1;
      var yyyy = today.getFullYear();
      if (dd < 10) {
        dd = '0' + dd;
      }
      if (mm < 10) {
        mm = '0' + mm;
      }
      today = mm + '/' + dd + '/' + yyyy;

      let date2 = new Date(today);
      let Difference_In_Time = date2.getTime() - date1.getTime();

      let Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
      //console.log(Difference_In_Days)
      //
      let lockdays = document.getElementById("lockdown-day");
      lockdays.innerHTML = Difference_In_Days;
      let sup = document.getElementById("sup");
      sup.innerHTML = ordinal_suffix_of(Difference_In_Days);
    }
    function ordinal_suffix_of(s) {
        let j = s % 10,
            k = s % 100;
        if (j == 1 && k != 11) {
            return "st";
        }
        if (j == 2 && k != 12) {
            return "nd";
        }
        if (j == 3 && k != 13) {
            return "rd";
        }
        return "th";
    }
      
 function getQueryVariable(r) {
      for (var t = window.location.search.substring(1).split("&"), i = 0; i < t.length; i++) {
        var n = t[i].split("=");
        if (n[0] == r) return n[1]
      }
      return !1
    }
    var siteurl = getQueryVariable('mode');
    if (siteurl === "app") {
      sethref();
    }

    function sethref() {
      var topicElement = document.getElementsByClassName("topicUrl");
      
      for(var j = 0; j<=1; j++){
        var helplineAnchor = document.getElementById("helpline").getElementsByTagName("p")[j].getElementsByTagName("a");
        for(var k=0; k<=j; k++){
          helplineAnchor[k].removeAttribute("href");
          helplineAnchor[k].removeAttribute("target");
        }
      }
      
      for(var i =0; i< topicElement.length; i++){
        //var topicURL = topicElement[i].getAttribute("href");
        topicElement[i].removeAttribute("href");
        topicElement[i].removeAttribute("target");
      }
    }
    lockDown();

"use strict";
var stage = {
  w: 1280,
  h: 720
};

var _pexcanvas = document.getElementById("canvas");
_pexcanvas.width = stage.w;
_pexcanvas.height = stage.h;
var ctx = _pexcanvas.getContext("2d");

var pointer = {
  x: stage.w / 2,
  y: stage.h / 4
};

var scale = 1;
var portrait = true;
var loffset = 0;
var toffset = 0;
var mxpos = 0;
var mypos = 0;

// ------------------------------------------------------------------------------- Gamy

var againprog = 0;

var healthprog = 0;

function newGame() {
  score = 0;
  health = 100;
  enemies = [];
  enemies.push(new Enemy());
  enemies.push(new Enemy());
  enemies.push(new Enemy());
  againprog = 0;
}

function drawHeart(x, y, w) {
  ctx.beginPath();
  ctx.arc(x - w / 4, y, w / 4, 0.75 * Math.PI, 0);
  ctx.arc(x + w / 4, y, w / 4, 1 * Math.PI, 2.25 * Math.PI);
  ctx.lineTo(x, y + w / 1.5);
  ctx.closePath();
  ctx.fill();
}

var Cannon = function (x, y, tx, ty) {
  this.x = x;
  this.y = y;
  this.tx = tx;
  this.ty = ty;
  this.r = 10;
};

var cannons = [];

var gameover = false;

cannons.push(new Cannon(stage.w, stage.h, stage.w / 2, stage.h / 2));

var firetm = 0;
var fireact = true;

var health = 100;
var score = 0;

var arm = { x: stage.w, y: stage.h };
var arm2 = { x: 0, y: stage.h };
var danger = false;
var dangera = 0;

var Enemy = function () {
  this.x = stage.w / 2;
  this.y = stage.h / 2;
  this.r = 10;
  this.tx = Math.floor(Math.random() * stage.w);
  this.ty = Math.floor(Math.random() * stage.h);
  this.des = false;
  this.eyeX = 0.4;
  this.eyeY = 0.25;
  this.eyeR = 0.25;
  this.sp = 50;
  this.spl = 1.4;
  this.op = 1;
  this.danger = false;
  this.nuked = false;
};

var enemies = [];
// for (var i = 0; i < 10; i++) {
// 	enemies[i] = new Enemy();
// }
enemies.push(new Enemy());
enemies.push(new Enemy());
enemies.push(new Enemy());

var entm = 0;
var ga = 0;

var steptime = 0;

var Star = function () {
  this.a = Math.random() * Math.PI * 2;
  this.v = 3 + Math.random() * 5;
  this.x = stage.w / 2;
  this.y = stage.h / 2;
  this.r = 0.2;
};

var Power = function () {
  this.type = Math.floor(Math.random() * 2) + 1;
  this.a = Math.random() * Math.PI * 2;
  this.v = 3 + Math.random() * 5;
  this.x = stage.w / 2;
  this.y = stage.h / 2;
  this.r = 0.2;
  this.dis = false;
  this.op = 1;
};

var powers = [];
var powertm = 0;
var powermax = Math.random() * 800 + 300;
// powermax = 10;

var stars = [];

for (var i = 0; i < 200; i++) {
  stars[i] = new Star();
  var st = stars[i];
  var move = Math.random() * 400;

  st.x += Math.sin(st.a) * move;
  st.y += Math.cos(st.a) * move;
}

// powers.push(new Power());

function enginestep() {
  steptime = Date.now();
  ctx.clearRect(0, 0, stage.w, stage.h);

  ctx.fillStyle = "#ffffff";

  for (var i = 0; i < stars.length; i++) {
    var st = stars[i];

    st.x += Math.sin(st.a) * st.v;
    st.y += Math.cos(st.a) * st.v;
    st.r += st.v / 200;

    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 2 * Math.PI, 0);
    ctx.fill();

    if (st.x > stage.w || st.x < 0 || st.y < 0 || st.y > stage.h) {
      stars[i] = new Star();
    }
  }
  if (!gameover) {
    danger = false;

    powertm++;
    if (powertm > powermax) {
      powers.push(new Power());
      powertm = 0;
      powermax = Math.random() * 1200 + 600;
      // powermax = 10;
    }

    for (var i = 0; i < powers.length; i++) {
      var st = powers[i];

      if (!st.des) {
        st.x += (Math.sin(st.a) * st.v) / 1.5;
        st.y += (Math.cos(st.a) * st.v) / 1.5;
        st.r += st.v / 15;
      } else {
        st.r *= 1.1;
        if (st.type == 1) {
          st.op += (0 - st.op) / 10;
        } else {
          st.op += (0 - st.op) / 20;
        }
        st.x += (stage.w / 2 - st.x) / 10;
        st.y += (stage.h / 2 - st.y) / 10;
      }

      if (st.type == 1) {
        ctx.fillStyle = "rgba(255,0,0," + st.op + ")";

        drawHeart(st.x, st.y - st.r / 4, st.r * 2);
      } else {
        ctx.fillStyle = "rgba(255,255,0," + st.op + ")";
        ctx.strokeStyle = "rgba(255,255,0," + st.op + ")";
        ctx.lineWidth = st.r / 10;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 2 * Math.PI, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * 0.15, 2 * Math.PI, 0);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * 0.85, 1.67 * Math.PI, 2 * Math.PI);
        ctx.arc(st.x, st.y, st.r * 0.25, 2 * Math.PI, 1.67 * Math.PI, true);

        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * 0.85, 3 * Math.PI, 3.33 * Math.PI);
        ctx.arc(st.x, st.y, st.r * 0.25, 3.33 * Math.PI, 3 * Math.PI, true);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * 0.85, 2.33 * Math.PI, 2.67 * Math.PI);
        ctx.arc(st.x, st.y, st.r * 0.25, 2.67 * Math.PI, 2.33 * Math.PI, true);
        ctx.lineTo(st.x, st.y);
        ctx.closePath();
        ctx.fill();
      }
      if (
        st.x > stage.w ||
        st.x < 0 ||
        st.y < 0 ||
        st.y > stage.h ||
        st.r > stage.w / 2
      ) {
        powers.splice(i, 1);
        if (st.type == 2 && st.r > stage.w / 2) {
          for (var e = 0; e < enemies.length; e++) {
            enemies[e].des = true;
            enemies[e].nuked = true;
          }
        }
        i--;
      }
    }

    entm++;
    if (enemies.length < 10 && entm > 300) {
      entm = 0;
      enemies.push(new Enemy());
    }

    ctx.lineWidth = 2;
    for (var i = 0; i < enemies.length; i++) {
      var en = enemies[i];
      if (!en.danger) {
        ctx.strokeStyle = "rgba(0,255,255," + en.op * 2 + ")";
      } else {
        health -= 0.01;
        ctx.strokeStyle = "rgba(255,0,0," + en.op * 2 + ")";
        danger = true;
      }

      if (!en.des) {
        if (en.danger) {
          var randx = Math.floor(Math.random() * 4) - 2;
          var randy = Math.floor(Math.random() * 4) - 2;

          en.x = en.tx + randx;
          en.y = en.ty + randy;
        } else {
          en.x += (en.tx - en.x) / 100;
          en.y += (en.ty - en.y) / 100;
          var randx = 0;
          var randy = 0;
        }

        en.r += (50 - en.r) / 100;
        if (Math.abs(50 - en.r) < 2 && !en.danger) {
          en.tx = en.x;
          en.ty = en.y;
          en.danger = true;
        }
        ctx.beginPath();
        ctx.arc(
          en.x - en.r * en.eyeX,
          en.y - en.r * en.eyeY,
          en.r * en.eyeR,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          en.x + en.r * en.eyeX,
          en.y - en.r * en.eyeY,
          en.r * en.eyeR,
          0,
          2 * Math.PI
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(en.x, en.y + en.r / 4, en.r / 3, 2 * Math.PI, Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(en.x, en.y, en.r, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        en.eyeR += (0.5 - en.eyeR) / 5;
        en.op += (0 - en.op) / 5;
        // en.sp += (5-en.sp)/20;
        en.r += (100 - en.r) / 20;
        en.spl += (2.5 - en.spl) / 5;
        ctx.beginPath();
        ctx.arc(
          en.x - en.r * en.eyeX,
          en.y - en.r * en.eyeY,
          en.r * en.eyeR,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(
          en.x + en.r * en.eyeX,
          en.y - en.r * en.eyeY,
          en.r * en.eyeR,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(en.x, en.y + en.r / 2, en.r * en.eyeR, Math.PI, 2 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(en.x, en.y, en.r, 0, 2 * Math.PI);
        ctx.stroke();
      }

      //spikes
      for (var s = 0; s < 12; s++) {
        var a = ((Math.PI * 2) / 12) * s + ga;
        ctx.beginPath();
        ctx.moveTo(en.x + Math.sin(a) * en.r, en.y + Math.cos(a) * en.r);
        ctx.lineTo(
          en.x + Math.sin(a) * en.r * 1.2,
          en.y + Math.cos(a) * en.r * 1.2
        );
        ctx.lineTo(
          en.x + Math.sin(a + Math.PI / en.sp) * en.r * en.spl,
          en.y + Math.cos(a + Math.PI / en.sp) * en.r * en.spl
        );
        ctx.lineTo(
          en.x + Math.sin(a - Math.PI / en.sp) * en.r * en.spl,
          en.y + Math.cos(a - Math.PI / en.sp) * en.r * en.spl
        );
        ctx.lineTo(
          en.x + Math.sin(a) * en.r * 1.2,
          en.y + Math.cos(a) * en.r * 1.2
        );
        ctx.stroke();
        // ctx.fill();
      }

      if (Math.abs(0.5 - en.eyeR) < 0.01) {
        var rand = Math.floor(Math.random() * 2);
        if (enemies[i].nuked && rand == 1) {
          enemies.splice(i, 1);
        } else {
          enemies[i] = new Enemy();
        }
      }
    }

    if (danger) {
      dangera += 0.05 + (100 - health) / 1000;
      if (dangera >= Math.PI) {
        dangera = 0;
      }
      ctx.fillStyle = "rgba(255,0,0," + (1 - Math.sin(dangera)) / 4 + ")";
      ctx.fillRect(0, 0, stage.w, stage.h);
      if (health < 10) {
        ctx.fillStyle = "rgba(255,255,0," + Math.sin(dangera) + ")";
        ctx.strokeStyle = "rgba(255,255,0," + Math.sin(dangera) + ")";

        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.lineJoin = "round";
        ctx.moveTo(stage.w / 2, stage.h / 4);
        ctx.lineTo(stage.w / 2 + stage.h / 7, stage.h / 2);
        ctx.lineTo(stage.w / 2 - stage.h / 7, stage.h / 2);
        ctx.closePath();
        ctx.stroke();

        ctx.font = "bold 130px arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", stage.w / 2, stage.h / 2.5);

        ctx.font = "bold 50px arial";
        ctx.fillText("LOW HEALTH", stage.w / 2, stage.h * 0.6);
      }
    } else {
      dangera = 0;
    }

    healthprog += (health - healthprog) / 5;
    ctx.fillStyle = "#00ffff";
    ctx.font = "30px arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Health: ", 20, 40);

    ctx.fillText("Score: " + score, stage.w - 200, 40);
    // ctx.fillText("Step:   "+(Date.now()-steptime),20,120);
    if (health > 30) {
      ctx.fillStyle = "rgba(0,255,255,0.8)";
    } else {
      ctx.fillStyle = "rgba(255,0,0,0.8)";
    }
    ctx.lineWidth = 2;
    ctx.fillRect(130, 25, healthprog * 3, 30);
    ctx.strokeStyle = "#00ffff";
    ctx.strokeRect(130, 25, 300, 30);

    if (health < 0) {
      gameover = true;
    }
  } else {
    ctx.fillStyle = "rgba(0,255,255,0.3)";
    ctx.fillRect((stage.w - 220) / 2, stage.h * 0.65 - 25, againprog, 50);

    ctx.fillStyle = "#00ffff";
    ctx.font = "bold 130px arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GAME OVER", stage.w / 2, stage.h / 3);
    ctx.font = "bold 50px arial";
    ctx.fillText("SCORE: " + score, stage.w / 2, stage.h / 2);

    ctx.font = "bold 30px arial";

    ctx.fillText("PLAY AGAIN", stage.w / 2, stage.h * 0.65);
    ctx.strokeRect((stage.w - 220) / 2, stage.h * 0.65 - 25, 220, 50);

    againprog += (0 - againprog) / 50;
  }

  ctx.strokeStyle = "#00ffff";
  ctx.fillStyle = "#00ffff";
  ctx.lineWidth = 2;
  if (fireact) {
    firetm++;
    if (firetm > 5) {
      cannons.push(
        new Cannon(
          pointer.x + (stage.w - pointer.x) / 2.5,
          pointer.y + (stage.h - pointer.y) / 2.5,
          pointer.x,
          pointer.y
        )
      );
      cannons.push(
        new Cannon(
          pointer.x - pointer.x / 2.5,
          pointer.y + (stage.h - pointer.y) / 2.5,
          pointer.x,
          pointer.y
        )
      );

      firetm = 0;
    }

    arm.x = Math.floor(Math.random() * 50) - 25 + stage.w;
    arm.y = Math.floor(Math.random() * 50) - 25 + stage.h;
    arm2.x = Math.floor(Math.random() * 30) - 15;
    arm2.y = Math.floor(Math.random() * 30) - 15 + stage.h;
  } else {
    arm.x = stage.w;
    arm.y = stage.h;
    arm2.x = 0;
    arm2.y = stage.h;
  }

  for (var i = 0; i < cannons.length; i++) {
    var can = cannons[i];

    can.x += (can.tx - can.x) / 5;
    can.y += (can.ty - can.y) / 5;
    can.r += (0 - can.r) / 5;

    ctx.beginPath();
    ctx.arc(can.x, can.y, can.r, 0, 2 * Math.PI);
    ctx.fill();

    if (can.r < 2 && !gameover) {
      for (var a = 0; a < enemies.length; a++) {
        var en = enemies[a];
        var dx = can.x - en.x;
        var dy = can.y - en.y;
        var dis = dx * dx + dy * dy;
        if (dis < en.r * en.r) {
          // enemies.splice(a,1);
          if (!enemies[a].des) {
            enemies[a].des = true;

            score += 10;
          }
        }
      }
    }

    if (can.r < 1 && !gameover) {
      for (var a = 0; a < powers.length; a++) {
        var en = powers[a];
        var dx = can.x - en.x;
        var dy = can.y - en.y;
        var dis = dx * dx + dy * dy;
        if (dis < en.r * en.r) {
          if (!en.des) {
            powers[a].des = true;
            if (en.type == 1) {
              health = 100;
            }
          }
        }
      }
    }

    if (can.r < 1 && gameover) {
      if (
        can.x > (stage.w - 220) / 2 &&
        can.y > stage.h * 0.65 - 25 &&
        can.x < (stage.w - 220) / 2 + 220 &&
        can.y < stage.h * 0.65 - 25 + 50
      ) {
        againprog += 1;
        if (againprog > 220) {
          newGame();
          gameover = false;
        }
      }
    }
    if (Math.abs(can.tx - can.x) < 1) {
      cannons.splice(i, 1);
    }
  }
  ctx.beginPath();
  ctx.moveTo(pointer.x - 20, pointer.y);
  ctx.lineTo(pointer.x + 20, pointer.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pointer.x, pointer.y - 20);
  ctx.lineTo(pointer.x, pointer.y + 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 8, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    pointer.x + (arm.x - pointer.x) / 3,
    pointer.y + (arm.y - pointer.y) / 3 + 10
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 2.5,
    pointer.y + (arm.y - pointer.y) / 2.5 + 10
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 2,
    pointer.y + (arm.y - pointer.y) / 2 + 10
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.5,
    pointer.y + (arm.y - pointer.y) / 1.5 + 50
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.2,
    pointer.y + (arm.y - pointer.y) / 1.2 + 80
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.1,
    pointer.y + (arm.y - pointer.y) / 1.1 + 100
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(
    pointer.x + (arm.x - pointer.x) / 3 - 10,
    pointer.y + (arm.y - pointer.y) / 3
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 2.5 - 10,
    pointer.y + (arm.y - pointer.y) / 2.5
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 2 - 10,
    pointer.y + (arm.y - pointer.y) / 2
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.5 - 50,
    pointer.y + (arm.y - pointer.y) / 1.5
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.2 - 80,
    pointer.y + (arm.y - pointer.y) / 1.2
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.1 - 100,
    pointer.y + (arm.y - pointer.y) / 1.1
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    pointer.x + (arm.x - pointer.x) / 3,
    pointer.y + (arm.y - pointer.y) / 3 - 10
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 2.5,
    pointer.y + (arm.y - pointer.y) / 2.5 - 10
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 2,
    pointer.y + (arm.y - pointer.y) / 2 - 10
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.5,
    pointer.y + (arm.y - pointer.y) / 1.5 - 50
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.2,
    pointer.y + (arm.y - pointer.y) / 1.2 - 80
  );
  ctx.lineTo(
    pointer.x + (arm.x - pointer.x) / 1.1,
    pointer.y + (arm.y - pointer.y) / 1.1 - 100
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    arm2.x + pointer.x - pointer.x / 3,
    pointer.y + (arm2.y - pointer.y) / 3 + 10
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 2.5,
    pointer.y + (arm2.y - pointer.y) / 2.5 + 10
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 2,
    pointer.y + (arm2.y - pointer.y) / 2 + 10
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.5,
    pointer.y + (arm2.y - pointer.y) / 1.5 + 50
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.2,
    pointer.y + (arm2.y - pointer.y) / 1.2 + 80
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.1,
    pointer.y + (arm2.y - pointer.y) / 1.1 + 100
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    arm2.x + pointer.x - pointer.x / 3 - 10,
    pointer.y + (arm2.y - pointer.y) / 3
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 2.5 - 10,
    pointer.y + (arm2.y - pointer.y) / 2.5
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 2 - 10,
    pointer.y + (arm2.y - pointer.y) / 2
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.5 - 50,
    pointer.y + (arm2.y - pointer.y) / 1.5
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.2 - 80,
    pointer.y + (arm2.y - pointer.y) / 1.2
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.1 - 100,
    pointer.y + (arm2.y - pointer.y) / 1.1
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    arm2.x + pointer.x - pointer.x / 3,
    pointer.y + (arm2.y - pointer.y) / 3 - 10
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 2.5,
    pointer.y + (arm2.y - pointer.y) / 2.5 - 10
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 2,
    pointer.y + (arm2.y - pointer.y) / 2 - 10
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.5,
    pointer.y + (arm2.y - pointer.y) / 1.5 - 50
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.2,
    pointer.y + (arm2.y - pointer.y) / 1.2 - 80
  );
  ctx.lineTo(
    arm2.x + pointer.x - pointer.x / 1.1,
    pointer.y + (arm2.y - pointer.y) / 1.1 - 100
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    pointer.x + (arm.x - pointer.x) / 3,
    pointer.y + (arm.y - pointer.y) / 3,
    10,
    0,
    2 * Math.PI
  );
  ctx.arc(
    pointer.x + (arm.x - pointer.x) / 2.5,
    pointer.y + (arm.y - pointer.y) / 2.5,
    10,
    0,
    2 * Math.PI
  );
  ctx.arc(
    pointer.x + (arm.x - pointer.x) / 2,
    pointer.y + (arm.y - pointer.y) / 2,
    10,
    0,
    2 * Math.PI
  );
  ctx.arc(
    pointer.x + (arm.x - pointer.x) / 1.5,
    pointer.y + (arm.y - pointer.y) / 1.5,
    50,
    0,
    2 * Math.PI
  );
  ctx.arc(
    pointer.x + (arm.x - pointer.x) / 1.2,
    pointer.y + (arm.y - pointer.y) / 1.2,
    80,
    0,
    2 * Math.PI
  );
  ctx.arc(
    pointer.x + (arm.x - pointer.x) / 1.1,
    pointer.y + (arm.y - pointer.y) / 1.1,
    100,
    0,
    2 * Math.PI
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(
    arm2.x + pointer.x - pointer.x / 3,
    pointer.y + (arm2.y - pointer.y) / 3,
    10,
    0,
    2 * Math.PI
  );
  ctx.arc(
    arm2.x + pointer.x - pointer.x / 2.5,
    pointer.y + (arm2.y - pointer.y) / 2.5,
    10,
    0,
    2 * Math.PI
  );
  ctx.arc(
    arm2.x + pointer.x - pointer.x / 2,
    pointer.y + (arm2.y - pointer.y) / 2,
    10,
    0,
    2 * Math.PI
  );
  ctx.arc(
    arm2.x + pointer.x - pointer.x / 1.5,
    pointer.y + (arm2.y - pointer.y) / 1.5,
    50,
    0,
    2 * Math.PI
  );
  ctx.arc(
    arm2.x + pointer.x - pointer.x / 1.2,
    pointer.y + (arm2.y - pointer.y) / 1.2,
    80,
    0,
    2 * Math.PI
  );
  ctx.arc(
    arm2.x + pointer.x - pointer.x / 1.1,
    pointer.y + (arm2.y - pointer.y) / 1.1,
    100,
    0,
    2 * Math.PI
  );
  ctx.stroke();

  ctx.fillStyle = "#004444";
  ctx.font = "14px arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "Coronavirus Shooting Game, Designed & Developed by Arshiya Mittal",
    stage.w / 2,
    stage.h - 20
  );
}

// ------------------------------------------------------------------------------- events
// ------------------------------------------------------------------------------- events
// ------------------------------------------------------------------------------- events
// ------------------------------------------------------------------------------- events

function toggleFullScreen() {
  var doc = window.document;
  var docEl = doc.documentElement;

  var requestFullScreen =
    docEl.requestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.webkitRequestFullScreen ||
    docEl.msRequestFullscreen;
  var cancelFullScreen =
    doc.exitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.webkitExitFullscreen ||
    doc.msExitFullscreen;

  if (
    !doc.fullscreenElement &&
    !doc.mozFullScreenElement &&
    !doc.webkitFullscreenElement &&
    !doc.msFullscreenElement
  ) {
    requestFullScreen.call(docEl);
  } else {
    cancelFullScreen.call(doc);
  }
}

var ox = 0;
var oy = 0;
function mousestart(e) {
  mxpos = (e.pageX - loffset) * scale;
  mypos = (e.pageY - toffset) * scale;
  pointer.x = mxpos;
  pointer.y = mypos;

  // fireact = true;
}
function mousemove(e) {
  mxpos = (e.pageX - loffset) * scale;
  mypos = (e.pageY - toffset) * scale;
  pointer.x = mxpos;
  pointer.y = mypos;

  // ball.vY += (mxpos-ox)/15*line.d;

  ox = mxpos;
}

function mouseend(e) {
  // fireact = false;
}

var moveX = 0;
var moveY = 0;
var moveZ = 0;

function keydowned(e) {
  // if (e.keyCode==65) {
  // 	moveX = 10;
  // } else if (e.keyCode==68) {
  // 	moveX = -10;
  // }
  // if (e.keyCode==83) {
  // 	moveY = -10;
  // } else if (e.keyCode==87) {
  // 	moveY = 10;
  // }
  // if (e.keyCode==69) {
  // 	moveZ = 10;
  // } else if (e.keyCode==81) {
  // 	moveZ = -10;
  // }
  // console.log(e.keyCode);
}

function keyuped(e) {
  // if (e.keyCode==65) {
  // 	moveX = 0;
  // } else if (e.keyCode==68) {
  // 	moveX = 0;
  // }
  // if (e.keyCode==87) {
  // 	moveY = 0;
  // } else if (e.keyCode==83) {
  // 	moveY = 0;
  // }
  // if (e.keyCode==81) {
  // 	moveZ = 0;
  // } else if (e.keyCode==69) {
  // 	moveZ = 0;
  // }
  // console.log("u"+e.keyCode);
}

window.addEventListener(
  "mousedown",
  function (e) {
    mousestart(e);
  },
  false
);
window.addEventListener(
  "mousemove",
  function (e) {
    mousemove(e);
  },
  false
);
window.addEventListener(
  "mouseup",
  function (e) {
    mouseend(e);
  },
  false
);
window.addEventListener(
  "touchstart",
  function (e) {
    e.preventDefault();
    mousestart(e.touches[0]);
  },
  false
);
window.addEventListener(
  "touchmove",
  function (e) {
    e.preventDefault();
    mousemove(e.touches[0]);
  },
  false
);
window.addEventListener(
  "touchend",
  function (e) {
    e.preventDefault();
    mouseend(e.touches[0]);
  },
  false
);

window.addEventListener(
  "keydown",
  function (e) {
    keydowned(e);
  },
  false
);
window.addEventListener(
  "keyup",
  function (e) {
    keyuped(e);
  },
  false
);

// ------------------------------------------------------------------------ stager
// ------------------------------------------------------------------------ stager
// ------------------------------------------------------------------------ stager
// ------------------------------------------------------------------------ stager
function _pexresize() {
  var cw = window.innerWidth;
  var ch = window.innerHeight;
  if (cw <= (ch * stage.w) / stage.h) {
    portrait = true;
    scale = stage.w / cw;
    loffset = 0;
    toffset = Math.floor(ch - (cw * stage.h) / stage.w) / 2;
    _pexcanvas.style.width = cw + "px";
    _pexcanvas.style.height = Math.floor((cw * stage.h) / stage.w) + "px";
  } else {
    scale = stage.h / ch;
    portrait = false;
    loffset = Math.floor(cw - (ch * stage.w) / stage.h) / 2;
    toffset = 0;
    _pexcanvas.style.height = ch + "px";
    _pexcanvas.style.width = Math.floor((ch * stage.w) / stage.h) + "px";
  }
  _pexcanvas.style.marginLeft = loffset + "px";
  _pexcanvas.style.marginTop = toffset + "px";
}

window.requestAnimFrame = (function () {
  return (
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60);
    }
  );
})();

var fps = 60;

var nfcount = 0;

function animated() {
  requestAnimFrame(animated);
  enginestep();

  nfcount++;
  ctx.fillStyle = "#00ffff";
  ctx.font = "12px arial";
  ctx.textAlign = "left";
  ctx.fillText("FPS: " + Math.floor(fps), 10, stage.h - 20);
}

_pexresize();
animated();

function countfps() {
  fps = nfcount;
  nfcount = 0;
}
setInterval(countfps, 1000);

axios
  .get("https://covid19-api.com/totals?format=json")
  .then(({ data }) => {
    for (let total of data) {
      
      //Elements
      const confirmData = document.querySelector("#confirmData");
      const recoverData = document.querySelector("#recoverData");
      const criticalData = document.querySelector("#criticalData");
      const deathsData = document.querySelector("#deathsData");
      const updateData = document.querySelector("#updateData");
      const lastUpdate = new Date(total.lastUpdate).toLocaleString();

      //Data
      const totalConfirm = total.confirmed.toLocaleString();
      const totalRecover = total.recovered.toLocaleString();
      const totalCritical = total.critical.toLocaleString();
      const totalDeaths = total.deaths.toLocaleString();

      //Insert Data
      confirmData.innerHTML = `${totalConfirm}`;
      recoverData.innerHTML = `${totalRecover}`;
      criticalData.innerHTML = `${totalCritical}`;
      deathsData.innerHTML = `${totalDeaths}`;
      updateData.innerHTML = `${lastUpdate}`;
    }
  })
  .catch(function (error) {
    console.log(error);
  });



