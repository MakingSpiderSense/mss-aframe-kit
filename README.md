# MSS A-Frame Kit

## Overview

**mss-aframe-kit** is a collection of A-Frame components built for my projects. I've decided to make it public in case anyone else finds these extras useful in their own A-Frame scenes. While others are free to use it, I don't plan on providing active support for this project at this time and flexibility may be limited.

Each A-Frame component is maintained in its own folder under `src/components/`. Some components include their own README files and examples. Check out the docs folder for more information. The project includes both minified and unminified builds in the `dist/` folder.

Tested up to **A-Frame 1.7.0**.

## Featured Components

- <code>[arm-swing-movement](docs/arm-swing-movement/README.md)</code> enables intuitive, full-body locomotion in VR by translating natural arm-swinging gestures into forward (or backward) movement. This component is ideal for VR experiences where you want users to physically feel like they're walking or jogging through the environment - without the need for specialized hardware like an omnidirectional treadmill. It uses the Z-axis reversal of each controller to detect "steps", dynamically calculates a target speed, and moves the player rig accordingly. It supports nav-mesh constrained movement, adjustable smoothing, speed limits, and even synchronized footstep sound playback for added realism.
- <code>[holdable](src/components/holdable/holdable.js)</code> is an alternative to the `grabbable` component in the "Super Hands" library. I needed a few features that weren't immediately supported, so I ended up building something I could tailor to my needs. It works with the `cannon.js` option in the <a href="https://github.com/c-frame/aframe-physics-system" target="_blank">aframe-physics-system</a> and lets you either preserve an object's original position and rotation when grabbed or define a specific grip pose, which can be useful for things like swords.

## Conflicts

If a custom component shares a name with one from `mss-aframe-kit` and it's not needed, it can be removed before registering the new one. For example:

```javascript
delete AFRAME.components["holdable"];
```

## License

You are free to use *mss-aframe-kit* in your own projects.