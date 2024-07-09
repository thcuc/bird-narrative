const minYear = "1995";
const maxYear = "2022";
function truncateData(data, { min = minYear, max = maxYear } = {}) {
	return data.filter(d => d.Year >= min && d.Year <= max);
}
function cleanYear(year) {
	return year == "2020" ? "2019" : year;
}

// map stuff
const yearRouteData = truncateData(await d3.csv("data/year_route.csv"));
const routeData = await d3.csv("data/route.csv");

const routeDataByRouteId = Object.fromEntries(routeData.map(r => [r.Route.replace(/^0+/, ""), r]));
const yearRouteDataByYear = yearRouteData.reduce((o, c) => {
	if (c.Year in o) o[c.Year].push(c);
	else o[c.Year] = [c];
	return o;
});
const maxMinForRoute = {};
for (const data of yearRouteData) {
	maxMinForRoute[data.Route] = {
		max: Math.max(maxMinForRoute[data.Route]?.max ?? 0, data.SpeciesTotal),
		min: Math.min(maxMinForRoute[data.Route]?.min ?? 99999, data.SpeciesTotal),
	}
}
const colorScalesForRoute = {};
const colorSpeciesColors = ["lightgreen", "red"];
for (const [route, { max, min }] of Object.entries(maxMinForRoute))
	colorScalesForRoute[route] = d3.scaleLog()
		.domain([max, min])
		.range(colorSpeciesColors)
		.clamp(true);

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
		.selectAll("circle")
		.data(yearRouteDataByYear[year])
		.enter()
		.append("circle")
		.attr("fill", d => colorScalesForRoute[d.Route](d.SpeciesTotal))
		.attr("r", 3)
		.attr("transform", d => {
			const rd = routeDataByRouteId[d.Route];
			return `translate(${projection([rd.Longitude, rd.Latitude])})`;
		});

	/*
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
		.attr("offset", (d, i) => (i / colorSpeciesColors.length * 100)  + "%");


	const legend = mapSvg.append("g")
		.attr("transform", "translate(0, -150)");

	legend.append("rect")
		.attr("x", mapWidth - 60 - 100)
		.attr("y", mapHeight - 10 - 15)
		.attr("width", 150)
		.attr("height", 10)
		.style("fill", "url(#gradient)");

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

// chart stuff
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

	const countRange = d3.extent(yearData, d => d.SpeciesTotal);
	const countAxis = d3.scaleLinear()
		.domain(countRange)
		.range([chartHeight, 0]);
	chartGroup.append("g")
		.call(d3.axisLeft(countAxis));

	const percentAxis = d3.scaleLinear()
		.domain([countRange[0] / countRange[1], 1])
		.range([chartHeight, 0]);
	chartGroup.append("g")
		.attr("transform", `translate(${chartWidth}, 0)`)
		.call(d3.axisRight(percentAxis)
			.tickFormat(v => v * 100 + "%")
		);

	chartGroup.append("path")
		.datum(truncateData(yearData, { max: +year + 1 }))
		.attr("stroke", "black")
		.attr("fill", "none")
		.attr("d", d3.line()
			.x(d => yearAxis(yearParser(d.Year)))
			.y(d => countAxis(d.SpeciesTotal))
		);
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
});

const yearSpeciesData = await d3.csv("data/year_species.csv");
