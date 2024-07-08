const yearData = await d3.csv("data/year.csv");
const yearRouteData = await d3.csv("data/year_route.csv");
const yearSpeciesData = await d3.csv("data/year_species.csv");
const routeData = await d3.csv("data/route.csv");

// map stuff
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
	if (year === "2020") {
		year = "2021"; // because no Covid data
	}

	if (!(year in yearRouteDataByYear)) {
		return console.error(`${year} is not in the data`);
	}

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

routeMap("1995");
document.getElementById("year-slider").addEventListener("input", e =>
	routeMap(e.target.value)
);

