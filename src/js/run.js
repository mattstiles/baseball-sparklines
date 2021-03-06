import constants from './constants';
import addYears from './year-chooser';
import labeler from './label-shifter';
import divisionSorter from './division-sorter';

var body = d3.select("body");
var fullWidth = 400,
    fullHeight = fullWidth / 2,
    margin = {top: 20, right: 175, bottom: 10, left: 10},
    width = fullWidth - margin.left - margin.right,
    height = fullHeight - margin.top - margin.bottom;
// Various x coordinate starting points to lay out different pieces of text.
var winLossX = 51;
var homeX = 88;
var roadX = 120;
var pctX = 152;
var defaultSize = { width: fullWidth, height: fullHeight };
var bigSize = { width: fullWidth * 2, height: fullHeight * 2 };
var hiddenSize = { width: 0 }
var bigChart, hiddenChart;
var year = 2015;
var query = window.location.search.slice(1).split('=');
if ( query.length ) {
  var yearIndex = -1;
  query.forEach((p, i) => {
    if ( p === 'year' ) {
      yearIndex = i;
    }
  });
  if ( yearIndex > -1 ) {
    year = query[yearIndex+1];
  }
}
var availableYears = d3.range(1919, new Date().getFullYear());
addYears(availableYears, body);
body.append("h1").text("MLB Sparklines:  " + year);

d3.json('seasons-data/' + year + '.json', (error, data) => {
  if (error) { throw error; }

  // Group data by division.
  var divisions = d3.nest()
    .key((d) => d.league)
    .entries(data);

  // Sort divisions so that NL has priority.
  divisions = divisionSorter(divisions, constants);

  // Need some scales.
  var x = d3.scale.linear()
    .domain([0, d3.max(data, (d) => d.games)])
    .range([0, width]);
  var min = d3.min(data, (d) => d3.min(d.results));
  var max = d3.max(data, (d) => d3.max(d.results));
  var y = d3.scale.linear()
    .domain([min, max])
    .range([height, 0]);

  // Path generator.
  var line = d3.svg.line()
    .x((d, i) => x(i))
    .y((d, i) => y(d));

  // Make sure labels don't step on each other.
  divisions = labeler(divisions, y);

  // Make one chart (svg) per division.
  var charts = body.selectAll('svg')
    .data(divisions)
    .enter()
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .attr('viewBox', '0 0 400 200')
    .attr('preserveAspectRatio', 'none')
    .attr('data-division', (d) => d.key)
    .on('click', function() {
      // Use a function expression because `this` is the svg element.
      // In an arrow function, `this` is undefined.

      // Only shrink when there are two charts per line.
      if ( parseInt(body.style("width").replace("px", "")) > 400 ) {
        ( this === bigChart ) ? shrink(this) : grow(this);
      }
    })
    .append('g')
    .attr('transform', 'translate(0, 0)');
  // Already have an appropriate selection, add each division name.
  charts.append('text')
    .attr('x', margin.left)
    .attr('y', 10)
    .text((d) => d.key);
  // Add labels for home record.
  charts.append('text')
    .attr('y', 10)
    .attr('x', width + homeX + margin.left)
    .text('home');
  // Add labels for road record.
  charts.append('text')
    .attr('y', 10)
    .attr('x', width + roadX + margin.left)
    .text('road');
  // Add labels for winning percentage.
  charts.append('text')
    .attr('y', 10)
    .attr('x', width + pctX + margin.left)
    .text('pct');
  // Another <g> for main chart areas.
  charts = charts.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
  // Make one line for each team. Data is nested so need a new selection.
  charts.selectAll('.line')
    .data((d) => d.values)
    .enter()
    .append('path')
    .attr('class', 'line')
    .attr('d', (d) => line(d.results))
    .style('stroke', (d) => constants.teamColors[d.abbreviation]);
  // Add labels for lines.
  var labels = charts.selectAll('g')
    .data((d) => d.values)
    .enter()
    .append('g')
    .attr('transform', 'translate(' + width + ',0)')
    .style('fill', (d) => constants.teamColors[d.abbreviation]);
  // Number of games above or below .500.
  labels.append('text')
    .attr('x', (d) => {
      // Right-align final result (number like -12, 2, 34, etc.).
      var result = d.results[d.results.length-1];
      var position = ( result <= -10 ) ? 0 : 
        ( result < 0 ) ? 5 :
        ( result < 10 ) ? 10 : 5;
      return position;
    })
    .attr('y', (d) => d.labelPosition)
    .attr('class', 'team')
    .text((d) => d.results[d.results.length-1]);
  // Team labels.
  labels.append('text')
    .attr('x', 20)
    .attr('y', (d) => d.labelPosition)
    .attr('class', 'team')
    .text((d) => d.abbreviation);
  // W-L record.
  labels.append('text')
    .attr('x', (d) => {
      var pad = 0;
      if ( d.wins > 99 || d.losses > 99 ) {
        pad = -5;
      }
      return winLossX + pad;
    })
    .attr('y', (d) => d.labelPosition)
    .attr('class', 'team')
    .text((d) => d.wins + "–" + d.losses)
  // Home W-L record.
  labels.append('text')
    .attr('x', homeX)
    .attr('y', (d) => d.labelPosition)
    .attr('class', 'team')
    .text((d) => d.winsHome + "–" + d.lossesHome)
  // Road W-L record.
  labels.append('text')
    .attr('x', roadX)
    .attr('y', (d) => d.labelPosition)
    .attr('class', 'team')
    .text((d) => d.winsRoad + "–" + d.lossesRoad)
  // Winning percentage.
  labels.append('text')
    .attr('x', pctX)
    .attr('y', (d) => d.labelPosition)
    .attr('class', 'team')
    .text((d) => (d.wins / d.games).toFixed(3).slice(1));

  // See if charts needs to be scaled up or down.
  let bodyWidth = d3.select('body').style('width').replace('px', '');
  if ( bodyWidth % 400 !== 0 ) {
    // We are not on a wide screen.
    let scaledHeight = (200 * (bodyWidth / fullHeight)) / 2;
    // Scale svg's appropriately.
    d3.selectAll('svg').transition().attr({
      width: bodyWidth,
      height: scaledHeight
    });
    // Take off the click handler that does zoom in/out.
    d3.selectAll('svg').on('click', null);
  }
  d3.selectAll('svg').style('opacity', 1);

  let shrink = (e, callback, next) => {
    if ( hiddenChart ) {
      d3.select(hiddenChart).transition().attr(defaultSize);
    }
    d3.select(e).transition().attr(defaultSize).each('end', () => {
      bigChart = hiddenChart = null;
      if ( callback ) {
        callback(next);
      }
    });
  }

  let grow = (e) => {
    // Only allow one big chart.
    if ( bigChart ) {
      shrink(bigChart, grow, e);
      return;
    }
    if ( isAL(e) ) {
      hiddenChart = e.previousSibling;
    } else {
      hiddenChart = e.nextSibling;
    }
    bigChart = e;
    d3.select(e).transition().attr(bigSize);
    if ( hiddenChart ) {
      d3.select(hiddenChart).transition().attr(hiddenSize);
    }
  }

  let isAL = (n) => {
    return n.getAttribute('data-division').indexOf('AL') > -1;
  }
});