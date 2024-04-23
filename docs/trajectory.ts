import { norm, number, dot, isNaN } from "mathjs";
import { IR, Instruction } from './type-utils';
import { lowerEBB, lowerGCode, lowerSBP } from './ir';
import { toolpath, Toolpath } from './type-utils';
import { exampleToolpaths } from './example-toolpaths';

const TOOLPATH_TABLE: Record<string, Toolpath> = {
    testToolpath: toolpath("sbp", ["M2, 0, 0", "M2, 10, 10"]),
    rectangle: toolpath("sbp", ["M2, 0, 0", "M2, 10, 0", "M2, 10, 5", "M2, 0, 5", "M2, 0, 0"]),
    triangle: toolpath("sbp", ["M2, 0, 0", "M2, 10, 0", "M2, 5, 5", "M2, 0, 0"]),
    star: toolpath("sbp", ["M2, 5.0, 0", "M2, 6.5, 3.5", "M2, 10.0, 3.5", "M2, 7.5, 6.0",
                    "M2, 9.0, 9.5", "M2, 5.0, 7.5", "M2, 1.0, 9.5", "M2, 2.5, 6.0", "M2, 0, 3.5",
                    "M2, 3.5, 3.5", "M2, 5.0, 0"]),
    wave: exampleToolpaths.gCodeWave,
    box: exampleToolpaths.ebbBox,
    signature: exampleToolpaths.ebbSignature,
    gears: exampleToolpaths.gears,
    propellerTopScallop: exampleToolpaths.propellerTopScallop,
    propellerTopPocket: exampleToolpaths.propellerTopPocket
};

type TSSMark = 'heatMapHistogram' | 'heatMapDensity' | 'sharpAngles' |
                'lines'
const allTSSMarks: Set<TSSMark> = new Set(['heatMapHistogram', 'heatMapDensity',
                                            'sharpAngles', 'lines']);



interface LimitInputs {
    vMaxX: string;
    vMaxY: string;
    vMaxZ: string;
    aMaxX: string;
    aMaxY: string;
    aMaxZ: string;
    junctionDeviation: string;
    junctionSpeed: string;
}


// @ts-ignore
let l1Norm = (v1: Vec3, v2: Vec3) => {
    let dx = Math.abs(v1.x - v2.x);
    let dy = Math.abs(v1.y - v2.y);
    let dz = Math.abs(v1.z - v2.z);
    return dx + dy + dz;
}

let l2Norm = (v1: Vec3, v2: Vec3) => {
    let dx = (v1.x - v2.x) ** 2;
    let dy = (v1.y - v2.y) ** 2;
    let dz = Math.abs(v1.z - v2.z);
    return Math.sqrt(dx + dy + dz);
}

/*
function SegmentPlot({ lineSegments, filterSegmentIds, selectedTSSMarks }: PlotProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    const findXYExtrema = (lineSegments: LineSegment[]): [number, number] => {
    
        let points = lineSegments.flatMap(ls => [ls.start, ls.end]);
        let components = points.flatMap(pt => [pt.x, pt.y]);
        return [Math.min(...components), Math.max(...components)];
    }

    useEffect(() => {
        if (lineSegments === undefined) return;
        let extrema = findXYExtrema(lineSegments);
        let windowSize = 7;
        let windowCenterIdx = Math.floor(windowSize / 2);
        let cost = (distance: number, timeDiff: number) => {
            if (distance === 0 || timeDiff === 0) {
                // It seems we hit this case every time, so just ignore it
                // By returning 0 until we understand what's going on.
                return 0;
            }
            return Math.max(0,
                Math.log((1 / distance) / timeDiff)
            );
        };
        let filteredSegments = lineSegments.filter((ls) => {
            if (filterSegmentIds === 'all_segments') {
                return true;
            }
            return filterSegmentIds.has(ls.parent);
        });
        let tssDatasets = {
            weightedPoints: () => {
                return filteredSegments.flatMap((segment, idx, arr) => {
                    if (filteredSegments.length < windowSize) {
                        return {
                            id: segment.parent,
                            x: segment.start.x,
                            y: segment.start.y,
                            z: segment.start.z,
                            weight: 1
                        };
                    }
                    let windowLower = Math.max(0, idx - windowSize);
                    let windowUpper = Math.min(arr.length - 1, idx + windowSize);
                    let window = arr.slice(windowLower, windowUpper);
                    let windowCenter = window[windowCenterIdx];
                    let weightedDistanceResiduals = window.map((ls, idx, arr) => {
                        if (idx === windowCenterIdx) {
                            return 0;
                        }
                        let distance = l2Norm(ls.start, windowCenter.start);
                        let subWindow = idx <= windowCenterIdx
                                            ? arr.slice(idx, windowCenterIdx)
                                            : arr.slice(windowCenterIdx + 1, idx);
                        let timeDiff = subWindow.reduce((timeSoFar, currLs) => {
                            return timeSoFar + currLs.profile.t;
                        }, 0);
                        return cost(distance, timeDiff);
                    });
                    return {
                        id: segment.parent,
                        x: segment.start.x,
                        y: segment.start.y,
                        z: segment.start.z,
                        weight: weightedDistanceResiduals.reduce((soFar, curr) => soFar + curr, 0)
                    };
                });
            },
            discreteLines: () => {
                return filteredSegments.flatMap((segment) => {
                    let startPlusId = {...segment.start, id: segment.parent};
                    let endPlusId = {...segment.end, id: segment.parent};
                    return [startPlusId, endPlusId, null]
                });
            },
            lsPairs: () => {
                return filteredSegments.map((_, i, arr) => {
                    if (i === arr.length - 1) {
                        return null;
                    }
                    let curr = arr[i];
                    let next = arr[i + 1];
                    if (curr.start.z > 0 && next.start.z > 0) {
                        return null;
                    }
                    return [curr, next];
                }).filter(pair => {
                    if (pair === null) {
                        return false;
                    }
                    let curr = pair[0];
                    let next = pair[1];
                    let maxZDiff = 0.1;
                    let maxAngle = Math.PI / 2;
                    if (Math.abs(curr.start.z - next.start.z) > maxZDiff) {
                        return 0;
                    }
                    let theta = Math.acos(dot([-curr.unit.x, -curr.unit.y],
                        [next.unit.x, next.unit.y]));
                    return theta <= maxAngle;
                })
            }
        };
        let tssMarks = {
            lines: () => {
                return Plot.line(tssDatasets.discreteLines(), {
                    x: (d: Vec3 | null) => {
                        if (d === null) {
                            return null;
                        }
                        return d.x;
                    },
                    y: (d: Vec3 | null) => {
                        if (d === null) {
                            return null;
                        }
                        return d.y;
                    },
                    strokeWidth: 0.5
                })
            },
            sharpAngles: () => {
                return Plot.dot(tssDatasets.lsPairs(), {
                    r: 5,
                    strokeWidth: 0,
                    fill: 'red',
                    opacity: 0.8,
                    x: (pair: [LineSegment, LineSegment]) => pair[0].end.x,
                    y: (pair: [LineSegment, LineSegment]) => pair[0].end.y
                })
            },
            heatMapHistogram: () => {
                return Plot.rect(tssDatasets.weightedPoints(),
                    Plot.bin({ fill: 'proportion' }, {
                        x: { value: 'x', interval: 0.1 },
                        y: { value: 'y', interval: 0.1 }
                    })
                )
            },
            heatMapDensity: () => {
                let maxHeight = 0;
                return Plot.density(tssDatasets.weightedPoints(), {
                    x: 'x',
                    y: 'y',
                    weight: (pt) => pt.z <= maxHeight ? pt.weight : 0,
                    bandwidth: 3,
                    fill: 'density'
                })
            }
        };
        const xyPlot = Plot.plot({
          x: {
            domain: extrema,
            label: 'x position'
          },
          y: {
            domain: extrema,
            label: 'y position'
          },
          inset: 10,
          color: {
            scheme: 'viridis',
            reverse: true
          },
          marks: [
            Plot.frame(),
            ...Array.from(selectedTSSMarks).map(name => tssMarks[name]()),
          ]
        });
        if (containerRef.current) {
            containerRef.current.append(xyPlot);
        }
        return () => {
            xyPlot.remove();
        };
      }, [lineSegments, selectedTSSMarks, filterSegmentIds]);

    return <div className="flex" ref={containerRef}/>;
}*/

/*
function ProfilePlot({ lineSegments, filterSegmentIds }: PlotProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (lineSegments === undefined) return;
        let cumulativeTimes: (number | null)[] = [];
        let soFar = 0;
        filterLineSegments(lineSegments, filterSegmentIds)
            .forEach((ls: LineSegment) => {
                let newTime = soFar + ls.profile.t;
                cumulativeTimes.push(soFar);
                cumulativeTimes.push(newTime);
                cumulativeTimes.push(null);
                soFar = newTime;
            });

        const vPairs = filterLineSegments(lineSegments, filterSegmentIds)
            .flatMap((ls: LineSegment) => {
                let v0Pair = [ls.profile.v0, ls.parent];
                let vPair = [ls.profile.v, ls.parent];
                return [v0Pair, vPair, null];
            }).filter(el => el !== undefined);
        const aPairs = filterLineSegments(lineSegments, filterSegmentIds)
            .flatMap((ls: LineSegment) => {
                let aPair = [ls.profile.a, ls.parent];
                return [aPair, aPair, null];
            }).filter(el => el !== undefined);

        const plot = Plot.plot({
            x: {
                grid: true,
                label: "time (s)",
            },
            y: {
              grid: true,
              label: "unit"
            },
            color: { legend: true },
            marks: [
              Plot.line(cumulativeTimes, {
                x: (_, i: number) => cumulativeTimes[i],
                y: (_, i: number) => vPairs[i]?.[0],
                stroke: "#4e79a7"
              }),
              Plot.text(cumulativeTimes, Plot.selectLast({
                x: (_, i: number) => cumulativeTimes[i],
                y: (_, i: number) => vPairs[i],
                text: (_) => "Velocity",
                lineAnchor: "top",
                dy: -5
              })),
              Plot.line(cumulativeTimes, {
                x: (_, i: number) => cumulativeTimes[i],
                y: (_, i: number) => aPairs[i]?.[0],
                stroke: "#e15759"
              }),
              Plot.text(cumulativeTimes, Plot.selectLast({
                x: (_, i: number) => cumulativeTimes[i],
                y: (_, i: number) => aPairs[i],
                text: (_) => "Acceleration",
                lineAnchor: "top",
                dy: -5
              }))
            ]
          })
        if (containerRef.current) {
            containerRef.current.append(plot);
        }

        return () => plot.remove();
      }, [lineSegments, filterSegmentIds]);

    return <div ref={containerRef}/>;
}*/

interface DepthHistogramProps {
    lineSegments: LineSegment[];
}

interface LineSegmentWithId extends LineSegment {
    id: number;
}

interface Vec3 {
    x: number,
    y: number,
    z: number
}

interface Segment {
    instruction: Instruction,
    moveId: number,
    startVelocity: number,
    endVelocity: number,
    coords: Vec3 
}

interface LineSegment {
    instruction: Instruction;
    parent: number,
    start: Vec3,
    end: Vec3,
    unit: Vec3,
    profile: FirstOrder,
    aMax: number
}

interface KinematicLimits {
    vMax: Vec3,
    aMax: Vec3,
    junctionSpeed: number,
    junctionDeviation: number
}

function kinematicLimits(vMax: Vec3, aMax: Vec3, junctionSpeed: number, junctionDeviation: number): KinematicLimits {
    return {
        vMax: vMax,
        aMax: aMax,
        junctionDeviation: junctionDeviation,
        junctionSpeed: junctionSpeed
    }
}

interface FirstOrder {
    v0: number,
    v: number,
    a: number,
    t: number,
    x: number
}

interface TrajectoryPasses {
    locations: Segment[],
    prePlanned: LineSegment[],
    halfPlanned: LineSegment[],
    fullyPlanned: LineSegment[]
}

function Vec3(x: number, y: number, z: number): Vec3 {
    return {
        x: x,
        y: y,
        z: z
    }
}

function segment(instruction: Instruction, moveId: number, startVelocity: number,
                    endVelocity: number, coords: Vec3): Segment {
    return {
        instruction: instruction,
        moveId: moveId,
        startVelocity: startVelocity,
        endVelocity: endVelocity,
        coords: coords
    }
}

function lineSegment(instruction: Instruction, parent: number, start: Vec3, end: Vec3,
                     unit: Vec3, profile: FirstOrder, amax: number): LineSegment {
    return {
        instruction: instruction,
        parent: parent,
        start: start,
        end: end,
        unit: unit,
        profile: profile,
        aMax: amax
    }
}

function firstOrder(initialVelocity: number, finalVelocity: number, acceleration: number,
         timeDuration: number, length: number): FirstOrder {
    return {
        v0: initialVelocity,
        v: finalVelocity,
        a: acceleration,
        t: timeDuration,
        x: length
    }
}

function planTriplets(locations: Segment[], prePlanned: LineSegment[],
    halfPlanned: LineSegment[], fullyPlanned: LineSegment[]): TrajectoryPasses {
    return {
        locations: locations,
        prePlanned: prePlanned,
        halfPlanned: halfPlanned,
        fullyPlanned: fullyPlanned
    }
}

function fromGeo(instruction: Instruction, parent: number, v0: number, v1: number,
                    start: Vec3, end: Vec3, k1: KinematicLimits): LineSegment {
    let startVel = Math.abs(v0);
    let endVel = Math.abs(v1);
    let delta = Vec3(end.x - start.x, end.y - start.y, end.z - start.z)

    let length = Math.sqrt((end.x - start.x)**2 + (end.y - start.y)**2);
    let profile = normalize(startVel, endVel, null, null, length) as FirstOrder;
    let unit = Vec3(delta.x / length, delta.y / length, delta.z / length);
    return lineSegment(instruction, parent, start, end, unit, profile,
                        limitVector(unit, k1.aMax));

}

function limitVector(unitVec: Vec3, limits: Vec3): number {
    let absUnitVec = Vec3(Math.abs(unitVec.x) / limits.x,
                          Math.abs(unitVec.y) / limits.y,
                          Math.abs(unitVec.z) / limits.z);
    // TODO: determine if we need to treat Z differently, we don't want 2D moves
    // to behave differently.
    let max = Math.max(absUnitVec.x, absUnitVec.y, absUnitVec.z);
    return 1 / max;
}

function normalize(v0: number | null, v: number | null, a: number | null,
                    t: number | null, x: number | null): FirstOrder | null {
    let arr = [v0, v, a, t, x];
    if ((arr.length - arr.filter(element => element !== null
            && !isNaN(element)).length) != 2) {
        return null;
    }

    if (v0 === null) {
        if (v === null) {
            let startVel = x! / t! - a! * t! / 2;
            return firstOrder(startVel, startVel + a! * t!, a!, t!, x!);
        } else if (a === null) {
            let startVel = 2 * x! / t! - v;
            return firstOrder(startVel, v, (v - startVel) / t!, t!, x!);
        } else if (t === null) {
            let startVel = Math.sqrt(v**2 - 2 * a * x!);
            return firstOrder(startVel, v, a, (v - startVel) / a, x!);
        } else if (x === null) {
            let startVel = v - a * t;
            return firstOrder(startVel, v, a, t, t * (startVel + v) / 2);
        }
    }
    if (v === null) {
        if (a === null) {
            let endVel = 2 * x! / t! - v0!;
            return firstOrder(v0!, endVel, (endVel - v0!) / t!, t!, x!);
        } else if (t === null) {
            let endVel = Math.sqrt(v0!**2 + 2 * a * x!);
            return firstOrder(v0!, endVel, a, (endVel - v0!) / a, x!);
        } else {
            let endVel = v0! + a * t;
            return firstOrder(v0!, endVel, a, t, t * (v0! + endVel) / 2);
        }
    }
    if (a === null) {
        if (t === null) {
            let time = 2 * x! / (v0! + v);
            return firstOrder(v0!, v, (v - v0!) / time, time, x!);
        } else if (x === null) {
            let acc = (v - v0!) / t;
            return firstOrder(v0!, v, acc, t, t * (v0! + v) / 2);
        }
    }
    let time = (v - v0!) / a!;
    return firstOrder(v0!, v, a!, time, time * (v0! + v) / 2);
}

const limits = kinematicLimits(Vec3(10, 10, 10), Vec3(10, 10, 10), 10, 10);
export const passes: TrajectoryPasses = computeLineSegments(TOOLPATH_TABLE.rectangle, limits);

 export function computeLineSegments(tp: Toolpath, kl: KinematicLimits): TrajectoryPasses {
    let irs;
    // handles lowering
    if (tp.isa == "ebb") {
        irs = lowerEBB(tp);
    } else if (tp.isa == "sbp") {
        irs = lowerSBP(tp);
    } else {
        irs = lowerGCode(tp);
    }
    let segments: Segment[] = [];
    let isNullMoveCommand = (ir: IR) => {
        return ir.op === "move" && (ir.args.x === null || ir.args.y === null);
    }
    let vMaxEitherAxis = Math.max(kl.vMax.x, kl.vMax.y);
    irs.forEach(function (ir: IR, index: number) {
        if (isNullMoveCommand(ir)) {
            return;
        }
        let seg = segment(ir.originalInstruction, index, vMaxEitherAxis, vMaxEitherAxis,
                            Vec3(ir.args.x!, ir.args.y!, ir.args.z!));
        segments.push(seg);
    });
    let startLocation = { x: 0, y: 0, z: 0};
    let plannerSegments: LineSegment[] = [];

    segments.forEach(function (s: Segment) {
        let endLocation = s.coords;
        let segmentNorm = number(norm([startLocation.x - endLocation.x,
                                       startLocation.y - endLocation.y]));

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

function* planSegments(segs: LineSegment[], k1: KinematicLimits, v0: number = 0.0)  {
    for (let chunk of backwardPass([...forwardPass(segs, v0, k1)])) {
        yield chunk;
    }
}

function backwardPass(segments: LineSegment[], v: number = 0) {
    let out: LineSegment[] = [];
    let runningV = v;
    for (let i = segments.length - 1; i >= 0; i--) {
        // @ts-ignore
        out[i] = [...planSegment(segments[i], runningV, true)];
        runningV = out[i][0].profile.v0;
    }
    return out;
}

function* forwardPass(segments: LineSegment[], v0: number, limits: KinematicLimits) {
    let res: LineSegment[] = [];
    if (segments.length == 0) {
        return res;
    }
    let prev: LineSegment | null = null;
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
            p = normalize(Math.min(p.v0, v), Math.min(p.v, v), null, null, p.x) as FirstOrder;
            changed = true;
        }
        if (Math.abs(p.a) > s.aMax) {
            p = normalize(p.v0, null, s.aMax * p.a / Math.abs(p.a), null, p.x) as FirstOrder;
            changed = true;
        }
        let seg = s;
        if (changed) {
            seg = lineSegment(s.instruction, s.parent, s.start, s.end, s.unit, p, s.aMax);
        }

        for (let sub of planSegment(seg, velocityInit)) {
            velocityInit = sub.profile.v;
            yield sub;
        }

        prev = seg;
    }
}

function* planSegment(s: LineSegment, v: number, reverse: boolean = false) {
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
        yield lineSegment(s.instruction, s.parent, s.start, s.end, s.unit, p!, s.aMax);
        return;
    }

    let firstProfile = normalize(v, null, a, dv / da, null) as FirstOrder;
    let secondProfile = normalize(firstProfile.v, p.v, null, null,  p.x - firstProfile.x) as FirstOrder;

    if (reverse) {
        // potential area for error
        let firstProfileOg = firstProfile;
        firstProfile = reverseFirstOrder(secondProfile);
        secondProfile = reverseFirstOrder(firstProfileOg);
    }

    let crossing = Vec3(s.start.x + s.unit.x * firstProfile.x,
                          s.start.y + s.unit.y * firstProfile.x,
                          s.start.z + s.unit.z * firstProfile.x);

    yield lineSegment(s.instruction, s.parent, s.start, crossing, s.unit, firstProfile, s.aMax);
    yield lineSegment(s.instruction, s.parent, crossing, s.end, s.unit, secondProfile, s.aMax);
}

function reverseFirstOrder(profile: FirstOrder): FirstOrder {
    return firstOrder(profile.v, profile.v0, 0 - profile.a, profile.t, profile.x);
}

function computeJunctionVelocity(p: LineSegment, s: LineSegment, limits: KinematicLimits): number | null {
    let junctionCos = -1 * dot([s.unit.x, s.unit.y], [p.unit.x, p.unit.y]);

    if (junctionCos > 0.9999) {
        return limits.junctionSpeed;
    } else if (junctionCos < -0.9999) {
        return null;
    } else {
        let junctionVect = Vec3(s.unit.x - p.unit.x, s.unit.y - p.unit.y, s.unit.z - p.unit.z);
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

function limitValueByAxis(limits: Vec3, vector: Vec3): number {
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