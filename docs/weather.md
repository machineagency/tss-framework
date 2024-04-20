# Trajectory Visualization

```js
const forecast = FileAttachment("./data/forecast.json").json();
```

```js
import {passes} from '/trajectory.ts';
```
```js
function temperaturePlot(data, {width} = {}) {
  return Plot.plot({
    title: "Hourly temperature forecast",
    width,
    x: {type: "utc", ticks: "day", label: null},
    y: {grid: true, inset: 10, label: "Degrees (F)"},
    marks: [
      Plot.lineY(data.properties.periods, {
        x: "startTime",
        y: "temperature",
        z: null, 
        stroke: "temperature",
        curve: "step-after"
      })
    ]
  });
}
```

```js
function DepthHistogram(lineSegments) {
  return Plot.plot({
    title: "Depth by Segment",
    x: {
      grid: true,
      label: 'segment'
    },
    y: {
      grid: true,
      label: 'z position'
    },
    marks: [
      Plot.line(lineSegments.map((segment) => {
          let startPlusId = {...segment.start, id: segment.parent};
          let endPlusId = {...segment.end, id: segment.parent};
          return [startPlusId, endPlusId, null]
      }).flat(), 
      {
          x: (_, index) => {
              return index / 3;
          },
          y: (d) => {
              if (d === null) {
                return null;
              }
              return d.z;
          },
          strokeWidth: 0.5
      })
    ]
  });
}
```

<div class="grid grid-cols-1">
  <div class="card">${resize((width) => temperaturePlot(forecast, {width}))}</div>
</div>

<div className="depth-histogram-container">
   <div class="card">${resize((width) => DepthHistogram(passes.fullyPlanned))}</div>        
</div>