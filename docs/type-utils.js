export function vec3(x, y, z) {
  return {
    x: x,
    y: y,
    z: z
  }
}

export function toolpath(isa, instructions) {
    return {
      isa: isa,
      instructions: instructions
    }
}


 export function segment(instruction, moveId, startVelocity, endVelocity, coords) {
  return {
    instruction: instruction,
    moveId: moveId,
    startVelocity: startVelocity,
    endVelocity: endVelocity,
    coords: coords
  }
}


export function lineSegment(instruction, parent, start, end, unit, profile, aMax) {
  return {
    instruction: instruction,
    parent: parent,
    start: start,
    end: end,
    unit: unit,
    profile: profile,
    aMax: aMax
  }
}


export function firstOrder(initialVelocity, finalVelocity, acceleration,
         timeDuration, length) {
  return {
      v0: initialVelocity,
      v: finalVelocity,
      a: acceleration,
      t: timeDuration,
      x: length
  }
}

export function kinematicLimits(vMax, aMax, junctionSpeed, junctionDeviation) {
  return {
    vMax: vMax,
    aMax: aMax,
    junctionSpeed: junctionSpeed,
    junctionDeviation: junctionDeviation
  }
}

export function planTriplets(locations, prePlanned,
    halfPlanned, fullyPlanned) {
  return {
      locations: locations,
      prePlanned: prePlanned,
      halfPlanned: halfPlanned,
      fullyPlanned: fullyPlanned
  }
}