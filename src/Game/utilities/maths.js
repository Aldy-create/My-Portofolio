export function clamp(value, min, max)
{
    return Math.max(min, Math.min(max, value))
}

export function lerp(a, b, t)
{
    return a + (b - a) * t
}

export function remap(value, inMin, inMax, outMin, outMax)
{
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

export function remapClamp(value, inMin, inMax, outMin, outMax)
{
    const t = clamp((value - inMin) / (inMax - inMin), 0, 1)
    return outMin + t * (outMax - outMin)
}

export function smoothstep(value, min, max)
{
    const x = clamp((value - min) / (max - min), 0, 1)
    return x * x * (3 - 2 * x)
}

export function smallestAngle(start, end)
{
    let delta = (end - start) % (Math.PI * 2)
    if(delta > Math.PI)
        delta -= Math.PI * 2
    if(delta < -Math.PI)
        delta += Math.PI * 2
    return delta
}
