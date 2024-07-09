const minYear = "1980";
const maxYear = "2022";
function truncateData(data, { min = minYear, max = maxYear } = {}) {
	return data.filter(d => d.Year >= min && d.Year <= max);
}
function cleanYear(year) {
	// year missing data
	return year == "2020" ? "2019" : year;
}

// map stuff
const routeData = await d3.csv("data/route.csv");
const routeDataByStateRouteId = {};
for (const entry of routeData) {
	const state = entry.State.replace(/^0+/, "");
	const route = entry.Route.replace(/^0+/, "");
	if (state in routeDataByStateRouteId) {
		routeDataByStateRouteId[state][route] = entry;
	} else {
		routeDataByStateRouteId[state] = { [route]: entry };
	}
}

const yearRouteData = truncateData(await d3.csv("data/year_route.csv"));
const yearRouteDataByYear = {};
const maxMinForRoute = {};
for (const entry of yearRouteData) {
	if (entry.Year in yearRouteDataByYear) {
		yearRouteDataByYear[entry.Year].push(entry);
	} else {
		yearRouteDataByYear[entry.Year] = [entry];
	}

	if (entry.State in maxMinForRoute) {
		maxMinForRoute[entry.State][entry.Route] = {
			max: Math.max(maxMinForRoute[entry.State]?.[entry.Route]?.max ?? 0, +entry.SpeciesTotal),
			min: Math.min(maxMinForRoute[entry.State]?.[entry.Route]?.min ?? 999_999_999, +entry.SpeciesTotal),
		}
	} else {
		maxMinForRoute[entry.State] = { [entry.Route]: {
			max: +entry.SpeciesTotal,
			min: +entry.SpeciesTotal,
		} };
	}
}

const colorScalesForRoute = {};
const colorSpeciesColors = ["lightgreen", "red"];
const scale = (max, min) => d3.scaleLinear()
	.domain([max * 0.8, min * 1.2])
	.range(colorSpeciesColors)
	.clamp(true);
for (const [state, routeMaxMin] of Object.entries(maxMinForRoute))
	for (const [route, { max, min }] of Object.entries(routeMaxMin)) {
		if (state in colorScalesForRoute) {
			colorScalesForRoute[state][route] = scale(max, min);
		} else {
			colorScalesForRoute[state] = { [route]: scale(max, min) };
		}
	}

const mapWidth = 975;
const mapHeight = 610;
const statesMapData = await d3.json("data/countries-albers-10m.json");
const projection = d3.geoAlbersUsa().scale(1300).translate([mapWidth / 2, mapHeight / 2]);
const mapSvg = d3.select("#map-container")
	.append("svg")
	.attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
	.attr("width", "100%");

function routeMap(year) {
	year = cleanYear(year);

	// wasteful to redraw country stuff
	mapSvg.selectAll("*").remove();

	// us outline
	mapSvg.append("g")
		.attr("stroke", "black")
		.attr("fill", "none")
		.append("path")
		.datum(topojson.feature(statesMapData, statesMapData.objects.nation))
		.attr("d", d3.geoPath());

	// states
	mapSvg.append("g")
		.attr("stroke", "#ddd")
		.attr("fill", "#eee")
		.selectAll("path")
		.data(topojson.feature(statesMapData, statesMapData.objects.states).features)
		.enter().append("path")
		.attr("d", d3.geoPath())

	// points
	mapSvg.append("g")
		.attr("stroke", "black")
		.attr("fill-opacity", 0.5)
		.selectAll("circle")
		.data(yearRouteDataByYear[year])
		.enter()
		.append("circle")
		.attr("fill", d => colorScalesForRoute[d.State][d.Route](+d.SpeciesTotal))
		.attr("r", 2.5)
		.attr("transform", d => {
			const rd = routeDataByStateRouteId[d.State][d.Route];
			return `translate(${projection([rd.Longitude, rd.Latitude])})`;
		});

	const gradient = mapSvg.append("defs")
		.append("linearGradient")
		.attr("id", "gradient")
		.attr("x1", "0%")
		.attr("x2", "100%")
		.attr("y1", "0%")
		.attr("y2", "0%");

	gradient.selectAll("stop")
		.data(colorSpeciesColors)
		.enter()
		.append("stop")
		.style("stop-color", d => d)
		.attr("offset", (_, i) => ((i + 0.8) / colorSpeciesColors.length * 100)  + "%");


	const legend = mapSvg.append("g")
		.attr("transform", "translate(30, 0)");

	legend.append("rect")
		.attr("x", mapWidth - 60 - 100)
		.attr("y", mapHeight - 10 - 15)
		.attr("width", 100)
		.attr("height", 10)
		.style("fill", "url(#gradient)");

	const makeAnnotation = d3.annotation()
		.annotations([{
			note: { label: "Increased Routes Example" },
			x: 190,
			y: 300,
			dy: 120,
			dx: -75,
			subject: { radius: 75, radiusPadding: 10 },
		}])
		.type(d3.annotationCalloutCircle);

	mapSvg.append("g")
		.call(makeAnnotation);


	/*
	legend.append("text")
		.attr("x", mapWidth - 50 - 150 + 25)
		.attr("y", mapHeight - 10 - 10 + 20)
		.text(maxSpeciesValue);

	legend.append("text")
		.attr("x", mapWidth - 15 + 2)
		.attr("y", mapHeight - 10 - 10 + 20)
		.text(minSpeciesValue);
	*/
}

routeMap(minYear);

// total count chart stuff
const yearData = truncateData(await d3.csv("data/year.csv"));

const chartWidth = 800;
const chartHeight = 450;
const chartSvg = d3.select("#chart-container")
	.append("svg")
	.attr("viewBox", `0 0 ${chartWidth + 100} ${chartHeight + 40}`)
	.attr("width", "100%");
const chartGroup = chartSvg.append("g")
	.attr("transform", "translate(65, 10)");
const yearParser = d3.timeParse("%Y");

function totalCountChart(year) {
	year = cleanYear(year);

	chartGroup.selectAll("*").remove();

	const yearAxis = d3.scaleTime()
		.domain(d3.extent(yearData, d => yearParser(d.Year)))
		.range([0, chartWidth]);
	chartGroup.append("g")
		.attr("transform", `translate(0, ${chartHeight})`)
		.call(d3.axisBottom(yearAxis));

	const countRange = d3.extent(yearData, d => +d.SpeciesTotal);
	const countAxis = d3.scaleLinear()
		.domain(countRange)
		.range([chartHeight, 0]);
	chartGroup.append("g")
		.attr("color", "blue")
		.call(d3.axisLeft(countAxis));

	const averageCountRange = d3.extent(yearData, d => +d.AveragePerRoute);
	const averageCountAxis = d3.scaleLinear()
		.domain(averageCountRange)
		.range([chartHeight, 0]);
	chartGroup.append("g")
		.attr("color", "red")
		.attr("transform", `translate(${chartWidth}, 0)`)
		.call(d3.axisRight(averageCountAxis));

	/*
	const percentAxis = d3.scaleLinear()
		.domain([countRange[0] / countRange[1], 1])
		.range([chartHeight, 0]);
	chartGroup.append("g")
		.attr("transform", `translate(${chartWidth}, 0)`)
		.call(d3.axisRight(percentAxis)
			.tickFormat(v => v * 100 + "%")
		);
	*/

	const data = truncateData(yearData, { max: +year + 1 });
	chartGroup.append("path")
		.datum(data)
		.attr("stroke", "blue")
		.attr("stroke-width", 3)
		.attr("fill", "none")
		.attr("d", d3.line()
			.x(d => yearAxis(yearParser(d.Year)))
			.y(d => countAxis(+d.SpeciesTotal))
		);
	chartGroup.append("path")
		.datum(data)
		.attr("stroke", "red")
		.attr("stroke-width", 3)
		.attr("fill", "none")
		.attr("d", d3.line()
			.x(d => yearAxis(yearParser(d.Year)))
			.y(d => averageCountAxis(+d.AveragePerRoute))
		);

	const makeAnnotation = d3.annotation()
		.annotations([{
			note: { label: "Average Birds Sighted Per Route" },
			x: 300,
			y: 220,
			dy: 100,
			dx: 100,
			subject: { radius: 50, radiusPadding: 10 },
		}, {
			note: { label: "Total Birds Sighted" },
			x: 420,
			y: 70,
			dy: 100,
			dx: 100,
			subject: { radius: 50, radiusPadding: 10 },
		}]);

	chartGroup.append("g")
		.call(makeAnnotation);
}
totalCountChart(minYear);

const slider = document.getElementById("year-slider");
slider.addEventListener("input", e => {
	const year = e.target.value;
	routeMap(year);
	totalCountChart(year);
});

addEventListener("scroll", () => {
	const totalHeight = document.body.offsetHeight;
	const scrolledHeight = window.pageYOffset + window.innerHeight;
	const scrolledPercent = scrolledHeight / totalHeight;

	console.log(scrolledPercent);

	/*
	const countChartAnimStart = 0.5;
	const countChartAnimFinish = 0.75;
	let year;
	if (scrolledPercent < countChartAnimStart) {
		year = minYear - 1;
	} else if (scrolledPercent < countChartAnimFinish) {
		const step = (countChartAnimFinish - countChartAnimStart) / (maxYear - minYear);
		const yearsAway = Math.floor((countChartAnimFinish - scrolledPercent) / countChartAnimFinish / step);
		year = maxYear - yearsAway;
	} else {
		year = maxYear;
	}
	slider.value = year;
	slider.dispatchEvent(new Event("input"));
	*/
});

// species specific chart stuff
const wantedSpecies = new Set(["6140", "7190", "6882", "5300", "4200", "6810", "5738", "4590", "3050", "4330"]);
const yearSpeciesData = truncateData(await d3.csv("data/year_species.csv"))
	.filter(d => wantedSpecies.has(d.Aou));
const chartSvg2 = d3.select("#chart-container-2")
	.append("svg")
	.attr("viewBox", `0 0 ${chartWidth + 100} ${chartHeight + 40}`)
	.attr("width", "100%");
const chartGroup2 = chartSvg2.append("g")
	.attr("transform", "translate(65, 10)");

function speciesCountChart(year) {
	year = cleanYear(year);

	chartGroup2.selectAll("*").remove();

	const yearAxis = d3.scaleTime()
		.domain(d3.extent(yearData, d => yearParser(d.Year)))
		.range([0, chartWidth]);
	chartGroup2.append("g")
		.attr("transform", `translate(0, ${chartHeight})`)
		.call(d3.axisBottom(yearAxis));

	/*
	const countRange = d3.extent(yearSpeciesData, d => +d.SpeciesTotal);
	const countAxis = d3.scaleLinear()
		.domain(countRange)
		.range([chartHeight, 0]);
	chartGroup2.append("g")
		.call(d3.axisLeft(countAxis));
	*/

	const percentAxis = d3.scaleLinear()
		.domain([0, 1])
		.range([chartHeight, 0]);
	chartGroup2.append("g")
		.call(d3.axisLeft(percentAxis)
			.tickFormat(v => v * 100 + "%")
		)

	const data = d3.group(truncateData(yearSpeciesData, { max: +year + 1 }),
		d => d.Aou);

	const g = chartGroup2.append("g")
		.attr("stroke-width", 3)
		.attr("fill", "none");
	g.selectAll("path")
		.data(data)
		.enter()
		.append("path")
		.attr("stroke", (_, i) => ["red", "green", "yellow", "blue", "orange"][i % 5])
		.attr("d", d => {
			const max = d3.max(d[1], d => +d.SpeciesTotal);
			return d3.line()
				.x(d => yearAxis(yearParser(d.Year)))
				.y(d => percentAxis(d.SpeciesTotal / max))(d[1]);
		});
}

speciesCountChart(maxYear);
