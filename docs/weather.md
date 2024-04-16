# Trajectory Visualization

```js
const forecast = FileAttachment("./data/forecast.json").json();
```

```js
import {vec3, toolpath, segment, lineSegment, firstOrder, kinematicLimits, planTriplets} from "./type-utils.js";
```

```js
import {ir, lowerGCode, lowerEBB, lowerSBP} from "./ir.js";
```

```js
const TOOLPATH_TABLE = {
    testToolpath: toolpath("sbp", ["M2, 0, 0", "M2, 10, 10"]),
    rectangle: toolpath("sbp", ["M2, 0, 0", "M2, 10, 0", "M2, 10, 5", "M2, 0, 5", "M2, 0, 0"]),
    triangle: toolpath("sbp", ["M2, 0, 0", "M2, 10, 0", "M2, 5, 5", "M2, 0, 0"]),
    star: toolpath("sbp", ["M2, 5.0, 0", "M2, 6.5, 3.5", "M2, 10.0, 3.5", "M2, 7.5, 6.0",
                    "M2, 9.0, 9.5", "M2, 5.0, 7.5", "M2, 1.0, 9.5", "M2, 2.5, 6.0", "M2, 0, 3.5",
                    "M2, 3.5, 3.5", "M2, 5.0, 0"])
};
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
      Plot.brushX({
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
      }))
    ]
  });
}
```

```js
function fromGeo(instruction, parent, v0, v1, start, end, k1) {
    let startVel = Math.abs(v0);
    let endVel = Math.abs(v1);
    let delta = vec3(end.x - start.x, end.y - start.y, end.z - start.z)

    let length = Math.sqrt((end.x - start.x)**2 + (end.y - start.y)**2);
    let profile = normalize(startVel, endVel, null, null, length);
    let unit = vec3(delta.x / length, delta.y / length, delta.z / length);
    return lineSegment(instruction, parent, start, end, unit, profile,
                        limitVector(unit, k1.aMax));
}
```

```js
function limitVector(unitVec, limits) {
  let absUnitVec = vec3(Math.abs(unitVec.x) / limits.x,
                        Math.abs(unitVec.y) / limits.y,
                        Math.abs(unitVec.z) / limits.z);
  // TODO: determine if we need to treat Z differently, we don't want 2D moves
  // to behave differently.
  let max = Math.max(absUnitVec.x, absUnitVec.y, absUnitVec.z);
  return 1 / max;
}
```

```js
function normalize(v0, v, a, t, x) {
    let arr = [v0, v, a, t, x];
    /*
    if ((arr.length - arr.filter(element => element !== null
            && !isNaN(element)).length) != 2) {
        return null;
    }
    */
    if (v0 === null) {
        if (v === null) {
            let startVel = x / t - a * t / 2;
            return firstOrder(startVel, startVel + a * t, a, t, x);
        } else if (a === null) {
            let startVel = 2 * x / t - v;
            return firstOrder(startVel, v, (v - startVel) / t, t, x);
        } else if (t === null) {
            let startVel = Math.sqrt(v**2 - 2 * a * x);
            return firstOrder(startVel, v, a, (v - startVel) / a, x);
        } else if (x === null) {
            let startVel = v - a * t;
            return firstOrder(startVel, v, a, t, t * (startVel + v) / 2);
        }
    }
    
    if (v === null) {
        if (a === null) {
            let endVel = 2 * x / t - v0;
            return firstOrder(v0, endVel, (endVel - v0) / t, t, x);
        } else if (t === null) {
            let endVel = Math.sqrt(v0**2 + 2 * a * x);
            return firstOrder(v0, endVel, a, (endVel - v0) / a, x);
        } else {
            let endVel = v0 + a * t;
            return firstOrder(v0, endVel, a, t, t * (v0 + endVel) / 2);
        }
    }
    
    if (a === null) {
        if (t === null) {
            let time = 2 * x / (v0 + v);
            return firstOrder(v0, v, (v - v0) / time, time, x);
        } else if (x === null) {
            let acc = (v - v0) / t;
            return firstOrder(v0, v, acc, t, t * (v0 + v) / 2);
        }
    }
    let time = (v - v0) / a;
    return firstOrder(v0, v, a, time, time * (v0 + v) / 2);
}
```


```js
let segments = computeLineSegments(TOOLPATH_TABLE.testToolpath, kinematicLimits(vec3(10, 15, 20), vec3(5, 5, 5), 7, 8));
```

```js
function computeLineSegments(tp, kl){
    let irs;
    // handles lowering
    if (tp.isa == "ebb") {
        irs = lowerEBB(tp);
    } else if (tp.isa == "sbp") {
        irs = lowerSBP(tp);
    } else {
        irs = lowerGCode(tp);
    }
    let segments = [];
    let isNullMoveCommand = (ir) => {
        return ir.op === "move" && (ir.args.x === null || ir.args.y === null);
    }
    let vMaxEitherAxis = Math.max(kl.vMax.x, kl.vMax.y);
    irs.forEach(function (ir, index) {
        if (isNullMoveCommand(ir)) {
            return;
        }
        let seg = segment(ir.originalInstruction, index, vMaxEitherAxis, vMaxEitherAxis,
                            vec3(ir.args.x, ir.args.y, ir.args.z));
        segments.push(seg);
    });
    let startLocation = { x: 0, y: 0, z: 0};
    let plannerSegments= [];
    
    segments.forEach(function (s) {
        let endLocation = s.coords;
        let segmentNorm = norm([startLocation.x - endLocation.x,
                                       startLocation.y - endLocation.y]);

        if (segmentNorm >= 1e-18) {
            let segment = fromGeo(s.instruction, s.moveId, s.startVelocity,
                                  s.endVelocity, startLocation, endLocation, kl);
            plannerSegments.push(segment);
            startLocation = endLocation;
        }
    });
    let halfPlanned = [... forwardPass(plannerSegments, 0, kl)];
    let plannedSegments = [...planSegments(plannerSegments, kl)];

    return planTriplets(segments, plannerSegments, halfPlanned, plannedSegments);
}
```

```js
function* forwardPass(segments, v0, limits) {
  let res = [];
  if (segments.length == 0) {
    return res;
  }
  let prev = null;
  let velocityInit = v0;
  for (let s of segments) {
    let p = s.profile;
    let v = limitVector(s.unit, limits.vMax);

    if (prev != null) {
      let jv = computeJunctionVelocity(prev, s, limits);
      if (jv != null) {
        velocityInit = Math.min(velocityInit, jv);
      }
    }
  
    let changed = false;
    if (p.v0 > v || p.v > v) {
      p = normalize(Math.min(p.v0, v), Math.min(p.v, v), null, null, p.x);
      changed = true;
    }
  
    if (Math.abs(p.a) > s.aMax) {
      p = normalize(p.v0, null, (s.aMax * p.a) / Math.abs(p.a), null, p.x);
      changed = true;
    }
    let seg = s;
    if (changed) {
      seg = lineSegment(
        s.instruction,
        s.parent,
        s.start,
        s.end,
        s.unit,
        p,
        s.aMax
      );
    }
    for (let sub of planSegment(seg, velocityInit)) {
      velocityInit = sub.profile.v;
      yield sub;
    }

    prev = seg;
  }
}
```
```js
function* planSegment(s, v, reverse = false) {
  let a = s.aMax;
  let p;
  if (reverse) {
    p = reverseFirstOrder(s.profile);
  } else {
    p = s.profile;
  }

  if (p.v0 <= v) {
    yield s;
    return;
  }

  let da = a - p.a;
  let dv = p.v0 - v;

  if (da <= 0 || p.t * da <= dv) {
    if (reverse) {
      p = normalize(null, v, -1 * a, null, p.x);
    } else {
      p = normalize(v, null, a, null, s.profile.x);
    }
    yield lineSegment(
      s.instruction,
      s.parent,
      s.start,
      s.end,
      s.unit,
      p,
      s.aMax
    );
    return;
  }

  let firstProfile = normalize(v, null, a, dv / da, null);
  let secondProfile = normalize(
    firstProfile.v,
    p.v,
    null,
    null,
    p.x - firstProfile.x
  );

  if (reverse) {
    // potential area for error
    let firstProfileOg = firstProfile;
    firstProfile = reverseFirstOrder(secondProfile);
    secondProfile = reverseFirstOrder(firstProfileOg);
  }

  let crossing = vec3(
    s.start.x + s.unit.x * firstProfile.x,
    s.start.y + s.unit.y * firstProfile.x,
    s.start.z + s.unit.z * firstProfile.x
  );

  yield lineSegment(
    s.instruction,
    s.parent,
    s.start,
    crossing,
    s.unit,
    firstProfile,
    s.aMax
  );
  yield lineSegment(
    s.instruction,
    s.parent,
    crossing,
    s.end,
    s.unit,
    secondProfile,
    s.aMax
  );
}
```

```js
function backwardPass(segments, v = 0) {
    let out = [];
    let runningV = v;
    for (let i = segments.length - 1; i >= 0; i--) {
        out[i] = [...planSegment(segments[i], runningV, true)];
        runningV = out[i][0].profile.v0;
    }
    return out;
}
```

```js
function reverseFirstOrder(profile) {
    return firstOrder(profile.v, profile.v0, 0 - profile.a, profile.t, profile.x);
}
```

```js
function dot(vector1, vector2) {
    // Check if both vectors have the same length
    if (vector1.length !== vector2.length) {
        throw new Error('Vectors must have the same length');
    }

    // Calculate the dot product
    let result = 0;
    for (let i = 0; i < vector1.length; i++) {
        result += vector1[i] * vector2[i];
    }
    return result;
}
```

```js
function computeJunctionVelocity(p, s, limits) {
    let junctionCos = -1 * dot([s.unit.x, s.unit.y], [p.unit.x, p.unit.y]);

    if (junctionCos > 0.9999) {
        return limits.junctionSpeed;
    } else if (junctionCos < -0.9999) {
        return null;
    } else {
        let junctionVect = vec3(s.unit.x - p.unit.x, s.unit.y - p.unit.y, s.unit.z - p.unit.z);
        let vectDotSelf = dot([junctionVect.x, junctionVect.y, junctionVect.z],
                              [junctionVect.x, junctionVect.y, junctionVect.z]);
        junctionVect.x /= Math.sqrt(vectDotSelf);
        junctionVect.y /= Math.sqrt(vectDotSelf);
        junctionVect.z /= Math.sqrt(vectDotSelf);

        let junctionAcceleration = limitValueByAxis(limits.aMax, junctionVect);
        let sinThetaD2 = Math.sqrt(0.5 * (1 - junctionCos));
        let junctionVelocity = (junctionAcceleration * limits.junctionDeviation
                                * sinThetaD2) / (1 - sinThetaD2);
        return Math.max(limits.junctionSpeed, junctionVelocity);
    }
}
```

```js
function norm(vector) {
    // Calculate the sum of squares of each component of the vector
    
    let sumOfSquares = vector.reduce((acc, val) => acc + (val * val), 0);
    
    // Return the square root of the sum of squares
    
    return Math.sqrt(2);
}
```

```js
function limitValueByAxis(limits, vector) {
    let limitValue = 1e19;
    if (vector.x != 0) {
        limitValue = Math.min(limitValue, Math.abs(limits.x / vector.x));
    }
    if (vector.y != 0) {
        limitValue = Math.min(limitValue, Math.abs(limits.y / vector.y));
    }
    if (vector.z != 0) {
        limitValue = Math.min(limitValue, Math.abs(limits.z / vector.z));
    }
    return limitValue;
}
```

```js
function* planSegments(segs, k1, v0 = 0.0) {
  for (let chunk of backwardPass([...forwardPass(segs, v0, k1)])) {
    yield* chunk;
  }
}
```

<div class="grid grid-cols-1">
  <div class="card">${resize((width) => temperaturePlot(forecast, {width}))}</div>
</div>

<div className="depth-histogram-container">
   <div class="card">${resize((width) => DepthHistogram(segments.fullyPlanned))}</div>        
</div>